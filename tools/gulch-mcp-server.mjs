#!/usr/bin/env node
/**
 * Gulch MCP server — gives the Ask agent the ability to queue real work.
 *
 * The Codex model sandbox has no network, so the agent cannot POST to the
 * Gulch API itself. MCP servers are spawned by the app-server OUTSIDE that
 * sandbox, so the tool call is performed here instead.
 *
 * Tools:
 *   create_task(text, scope?)  queue a change request through /api/chat
 *   list_tasks(limit?)         recent task status, newest first
 *
 * Auth: reads .room-password from the repo root, exchanges it for a session
 * cookie at /api/auth. Nothing is written to disk; the cookie lives in memory.
 *
 * Protocol: MCP over stdio, newline-delimited JSON-RPC 2.0.
 */
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.GULCH_ROOT || process.cwd();
const BASE = process.env.GULCH_BASE || 'http://127.0.0.1:8790';
const SCOPE_OK = new Set(['gameplay', 'game-ui', 'build-tools']);

let cookie = null;

function log(...a) {
  // stderr only — stdout is the protocol channel
  process.stderr.write('[gulch-mcp] ' + a.join(' ') + '\n');
}

async function authenticate() {
  if (cookie) return cookie;
  const pwPath = path.join(ROOT, '.room-password');
  const password = fs.readFileSync(pwPath, 'utf8').trim();
  const r = await fetch(BASE + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) throw new Error(`auth failed: HTTP ${r.status}`);
  const set = r.headers.getSetCookie?.() || [];
  const raw = set.map((c) => c.split(';')[0]).find((c) => c.startsWith('gulch_sess='));
  if (!raw) throw new Error('auth returned no session cookie');
  cookie = raw;
  return cookie;
}

// The local server can briefly refuse connections while it boots or hands off
// between backends. Those are transient: retry with backoff rather than
// surfacing "fetch failed" to the agent.
async function withRetry(fn, attempts = 4, baseMs = 300) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const transient = /fetch failed|ECONNREFUSED|ECONNRESET|socket hang up|HTTP 503|network/i.test(msg);
      if (!transient || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function apiCall(pathname, { method = 'GET', body } = {}) {
  return withRetry(() => apiCallOnce(pathname, { method, body }));
}

async function apiCallOnce(pathname, { method = 'GET', body } = {}) {
  const c = await authenticate();
  const r = await fetch(BASE + pathname, {
    method,
    headers: {
      Cookie: c,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    cookie = null; // session expired; retry once
    const c2 = await authenticate();
    const r2 = await fetch(BASE + pathname, {
      method,
      headers: { Cookie: c2, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r2.ok) throw new Error(`HTTP ${r2.status}: ${(await r2.text()).slice(0, 300)}`);
    return r2.json();
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

const TOOLS = [
  {
    name: 'create_task',
    description:
      'Queue a real change request against the Gulch game repository. Use this when the '
      + 'user asks you to build, fix, change or add something. The request enters the '
      + 'editor lane and produces a candidate revision for review. Returns a task id.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The change request in plain language. Be specific: what to change, where, and the desired behaviour.',
        },
        scope: {
          type: 'string',
          enum: ['gameplay', 'game-ui', 'build-tools'],
          description: 'Workspace scope. gameplay = game logic/simulation, game-ui = interface, build-tools = build pipeline. Default gameplay.',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List recent tasks with their status (queued, running, done, failed), newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return. Default 10.', minimum: 1, maximum: 50 },
      },
    },
  },
];

async function createTask({ text, scope }) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('text is required');
  if (text.length > 20000) throw new Error('text too long (max 20000)');
  const s = scope === undefined ? 'gameplay' : scope;
  if (!SCOPE_OK.has(s)) throw new Error(`invalid scope: ${s}`);

  const before = await snapshotIds();
  await apiCall('/api/chat', { method: 'POST', body: { text: text.trim(), scope: s } });

  // find the newly queued task
  let created = null;
  for (let i = 0; i < 10 && !created; i++) {
    const after = await snapshotIds();
    created = after.find((t) => !before.some((b) => b.id === t.id)) || null;
    if (!created) await new Promise((r) => setTimeout(r, 250));
  }
  return {
    queued: true,
    taskId: created?.id ?? null,
    status: created?.status ?? 'queued',
    scope: s,
    note: created
      ? 'Task queued. It will run through the editor lane and produce a candidate revision.'
      : 'Request accepted by the server, but the new task id could not be read back yet. Use list_tasks to confirm.',
  };
}

async function snapshotIds() {
  const boot = await apiCall('/api/bootstrap');
  const tu = boot?.shell?.taskUpdates ?? boot?.taskUpdates ?? [];
  return Array.isArray(tu) ? tu.map((t) => ({ id: t.id, status: t.status })) : [];
}

async function listTasks({ limit = 10 } = {}) {
  const n = Math.max(1, Math.min(50, Number(limit) || 10));
  const boot = await apiCall('/api/bootstrap');
  const tu = boot?.shell?.taskUpdates ?? boot?.taskUpdates ?? [];
  if (!Array.isArray(tu) || !tu.length) return { tasks: [], note: 'No task updates present.' };
  const sorted = [...tu].sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return {
    tasks: sorted.slice(0, n).map((t) => ({
      id: t.id,
      status: t.status,
      scope: t.scope ?? null,
      text: String(t.text ?? '').slice(0, 200),
      updatedAt: t.updatedAt || t.createdAt || null,
      error: t.error ? String(t.error).slice(0, 200) : undefined,
    })),
  };
}

// ---- JSON-RPC over stdio ------------------------------------------------
const rl = createInterface({ input: process.stdin });
const write = (m) => process.stdout.write(JSON.stringify(m) + '\n');

rl.on('line', async (line) => {
  const t = line.trim();
  if (!t) return;
  let msg;
  try { msg = JSON.parse(t); } catch { return; }

  const { id, method, params } = msg;
  const isNotification = id === undefined || id === null;

  try {
    if (method === 'initialize') {
      write({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: params?.protocolVersion || '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'gulch', version: '1.0.0' },
        },
      });
      return;
    }
    if (method === 'notifications/initialized' || method === 'initialized') return;

    if (method === 'tools/list') {
      write({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
      return;
    }

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      let out;
      if (name === 'create_task') out = await createTask(args);
      else if (name === 'list_tasks') out = await listTasks(args);
      else throw new Error(`unknown tool: ${name}`);
      write({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(out, null, 2) }],
          isError: false,
        },
      });
      return;
    }

    if (method === 'ping') { write({ jsonrpc: '2.0', id, result: {} }); return; }

    if (!isNotification) {
      write({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
    }
  } catch (e) {
    log('error:', String(e.message || e));
    if (!isNotification) {
      write({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: 'Error: ' + String(e.message || e) }], isError: true },
      });
    }
  }
});

log('ready root=' + ROOT + ' base=' + BASE);
