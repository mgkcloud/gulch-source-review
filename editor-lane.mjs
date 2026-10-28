// editor-lane.mjs — executable editor lane for "Build tools" (build-tools scope) jobs.
//
// Contract (GULCH-EDITOR-RECOVERY-01):
//  * Consumes jobs whose scope === 'build-tools' (currently parked in
//    status 'awaiting_editor' by server.js queuePatch). Never touches game-plane
//    (gameplay / game-ui) jobs — those stay on the existing codex-bridge lane.
//  * Only mutates the BUILDER source plane: index.html at the repo root (the
//    operations/editor page), optionally plus small operator-side assets listed
//    in EDITOR_ALLOWED_FILES. game-project/ is never written by this lane.
//  * Source generation is delegated to an injectable generator that wraps
//    app-server-stream.mjs streamSourceTurn (real deltas, read-only sandbox,
//    ChatGPT auth preserved). No live model call is made by this module's
//    tests — tests inject a deterministic generator.
//  * Validation: (1) every inline <script> in the candidate index.html passes
//    node --check; (2) a copied server on an isolated port serves the candidate
//    page and proves the auth gate, the main chat input and task controls
//    (stop / retry) still exist and are wired; (3) only then is the change
//    promoted (staged into candidate dir + revision bumped).
//  * Stop/abort is honoured at every await point; a cancelled job keeps the
//    previous builder page live.
//
// Unexpected backend/file operations requested by the model are routed to an
// explicit 'unsupported_operation' error — never silently applied, never
// faked as implemented.

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import http from 'node:http';
import {checkEditor} from './editor-browser-check.mjs';
import {BACKEND_ALLOWED_FILES,backendSources,applyBackendOperations,stageBackendCandidate} from './backend-release.mjs';

// The ONLY files the editor lane may modify. Root index.html is the builder /
// operations page served at '/'.
export const EDITOR_ALLOWED_FILES = new Set(BACKEND_ALLOWED_FILES);
export const MAX_EDITOR_FILE_BYTES = 200000;

/* ------------------------------------------------------------------ *
 * Injectables (dependency-injection seam for the scheduler child and
 * for tests). The default generator uses streamSourceTurn; tests pass
 * their own.
 * ------------------------------------------------------------------ */

let generator = null;
let validator = null;

/** Register the source generator. Signature:
 *  ({prompt, sources, signal, onEvent}) -> {text, operations}
 *  `operations` = [{op:'update', path:'index.html', content}] style file ops.
 *  Throwing marks the job failed; abort signal marks it cancelled. */
export function setGenerator(fn) {
  if (typeof fn !== 'function') throw new Error('generator must be a function');
  generator = fn;
}

/** Register an override browser validator (tests can stub headless Chrome).
 *  Default: validateCandidatePage below. */
export function setValidator(fn) {
  if (typeof fn !== 'function') throw new Error('validator must be a function');
  validator = fn;
}

async function defaultGenerator({prompt, sources, signal, onEvent}) {
  // Injectable seam: an external scheduler (or an isolated test) can supply
  // its own generator module instead of the real app-server transport.
  const stubModule = process.env.GULCH_EDITOR_GENERATOR_MODULE;
  if (stubModule) {
    const mod = await import(stubModule.startsWith('/') ? 'file://' + stubModule : stubModule);
    return mod.generate({prompt, sources, signal, onEvent});
  }
  const {streamSourceTurn} = await import('./app-server-stream.mjs');
  const result = await streamSourceTurn({
    prompt,
    root: laneRoot(),
    onEvent,
    signal,
    timeoutMs: 600000,
    effort: 'low',
  });
  const match=/```json\s*([\s\S]*?)```/.exec(result.text);const raw=match?match[1]:result.text;const parsed=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));return {text:parsed.reply||'',operations:parsed.operations,remaining:parsed.remaining||[]};
}

/** The generator contract: the model returns a JSON block with file
 *  operations. We accept either a fenced ```json block or a bare JSON object
 *  whose top-level contains `operations`. Anything else is an explicit error. */
export function parseOperationsFromText(text) {
  const fenced = /```json\s*([\s\S]*?)```/.exec(String(text || ''));
  const raw = fenced ? fenced[1] : String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('editor model response contained no JSON source operations');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (e) {
    throw new Error('editor model response JSON unparseable: ' + e.message);
  }
  const ops = parsed.operations ?? parsed.ops ?? null;
  if (!Array.isArray(ops)) throw new Error('editor model response missing operations array');
  return ops;
}

/* ------------------------------------------------------------------ *
 * Job processing
 * ------------------------------------------------------------------ */

function laneRoot() {
  return path.resolve(laneRootOverride || path.dirname(new URL(import.meta.url).pathname));
}
let laneRootOverride = null;
export function setLaneRoot(p) { laneRootOverride = p ? path.resolve(p) : null; }

function log(job, type, detail = '') {
  job.events = [...(job.events || []), {type: `editor.${type}`, at: Date.now(), ...(detail ? {text: detail} : {})}].slice(-100);
}

function assertOperable(job) {
  if (job.cancelRequested) throw Object.assign(new Error('cancelled'), {cancelled: true});
}

/**
 * Claim a job for the editor lane. Returns true when the job belongs to this
 * lane and is eligible to run right now (awaiting_editor, or a retry of a
 * previously-parked build-tools job). Mirrors room-store retryable().
 */
export function claimable(job) {
  if (!job) return false;
  if (job.scope !== 'build-tools') return false;
  // Deliberately narrow: only never-run (parked/queued) jobs auto-drain.
  // Old failed/rejected/interrupted build-tools jobs stay where the player
  // left them and are retried explicitly via /api/retry, which enqueues a
  // fresh 'queued' job.
  return ['awaiting_editor', 'queued', 'queued_not_sent'].includes(job.status);
}

/**
 * Resume a parked awaiting_editor job IN PLACE: preserves id, verbatim text,
 * replies/history/events. Called by the server integration the moment an
 * editor worker exists (module import time), so parked jobs 72/76/77 move to
 * 'queued' with a routing event instead of being recreated.
 */
export function resumeParkedJobs(state, {now = Date.now()} = {}) {
  const resumed = [];
  for (const job of state.patches) {
    if (job.scope === 'build-tools' && job.status === 'awaiting_editor') {
      job.status = 'queued';
      job.stage = 'queued';
      delete job.error;
      log(job, 'resume', 'Editor worker connected; parked request resumed with original id and prompt.');
      resumed.push(job.id);
    }
  }
  return resumed;
}

/**
 * Validate file operations from the editor model. Throws explicit
 * unsupported-operation errors for anything outside the builder plane.
 */
export function validateEditorOperations(operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 5) {
    throw new Error('Expected 1–5 editor file operations');
  }
  if (Buffer.byteLength(JSON.stringify(operations)) > 400000) throw new Error('Editor batch exceeds size limit');
  const seen = new Set();
  for (const op of operations) {
    if (!op || !['update', 'create'].includes(op.op)) {
      throw new Error(`unsupported_operation: op "${op?.op}" — the editor lane applies only update/create`);
    }
    if (typeof op.path !== 'string' || !EDITOR_ALLOWED_FILES.has(op.path)) {
      throw new Error(`unsupported_operation: path "${op.path}" — the editor lane may only modify ${[...EDITOR_ALLOWED_FILES].join(', ')}`);
    }
    if (seen.has(op.path)) throw new Error('Duplicate path in editor batch');
    seen.add(op.path);
    if (typeof op.content !== 'string' || !op.content.trim()) throw new Error(`Empty content for ${op.path}`);
    if (Buffer.byteLength(op.content) > MAX_EDITOR_FILE_BYTES) throw new Error(`${op.path} exceeds ${MAX_EDITOR_FILE_BYTES} bytes`);
    if(op.path==='index.html'){
      if (!/^\s*<!doctype html>/i.test(op.content)) throw new Error('index.html candidate must start with <!doctype html>');
      if (!op.content.includes('<script>')) throw new Error('candidate index.html lost its inline script block');
    }
  }
  return operations;
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

/** Extract every inline <script> (no src) and node --check it. Returns list of
 *  {startLine, ok} or throws on first failure with line info. */
export function syntaxCheckIndexHtml(htmlText, nodeBin = process.execPath, file = 'index.html') {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(htmlText))) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const line = htmlText.slice(0, m.index).split('\n').length;
    scripts.push({line, code: m[2]});
  }
  if (!scripts.length) throw new Error('No inline scripts found in candidate index.html');
  const dir = fs.mkdtempSync(path.join(laneRoot(), '.editor-syntax-'));
  try {
    for (const s of scripts) {
      const f = path.join(dir, `s${s.line}.js`);
      fs.writeFileSync(f, s.code);
      const check = spawnSync(nodeBin, ['--check', f], {encoding: 'utf8', timeout: 5000});
      if (check.status !== 0) {
        throw new Error(`JavaScript syntax rejected in ${file} inline script at line ${s.line}: ${(check.stderr || '').split('\n')[0]}`);
      }
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
  return scripts.length;
}

/**
 * Serve the candidate page from an isolated throwaway HTTP server on a random
 * loopback port (same serving shape as live '/': CSP nonce injection into the
 * first <script>) and assert, from the served page:
 *   1. auth gate: page contains the gate form + /api/auth wiring
 *   2. chat input: #input and #send exist and send posts to /api/chat
 *   3. task controls: /api/task-action wiring present (stop control)
 * The validator reads the SERVED page text (render-equivalent read path for a
 * text page: DOM element presence is asserted from served markup, and every
 * assertion fails closed). No live model requests occur.
 */
export async function validateCandidatePage(html,{root=laneRoot()}={}){return checkEditor(html,root);}

/* ------------------------------------------------------------------ *
 * The lane executor
 * ------------------------------------------------------------------ */

/**
 * Run one editor job end to end. Mutates the job record exactly like the
 * existing queuePatch lane does (same status/stage vocabulary) so the existing
 * board renders it unchanged:
 *   queued -> running(waiting_for_model -> writing_source -> syntax ->
 *   browser_smoke) -> applied | failed | cancelled
 *
 * @param {object} opts
 *  job           job record (id/text/events preserved in place)
 *  state         room state (patches array identity preserved)
 *  persist       () => void  — persist + broadcast hook from server
 *  controller    AbortController registered for Stop cancellation
 *  root          repo root (defaults to module dir)
 *  generatorFn   optional one-shot generator override (tests)
 */
export async function runEditorJob({job, state, persist = () => {}, controller = new AbortController(), root, generatorFn, progress=persist}) {
  if(process.env.GULCH_VALIDATION==='1')throw Error('Generation disabled during validation');
  if (!job || job.scope !== 'build-tools') throw new Error('editor lane only accepts build-tools jobs');
  if (job.status === 'running' || job.status === 'applied') throw new Error('job already active/done');
  const laneRootDir = root ? path.resolve(root) : laneRoot();
  const gen = generatorFn || generator || defaultGenerator;
  const checkAbort = () => { if (controller.signal.aborted) throw Object.assign(new Error('cancelled'), {cancelled: true}); };

  job.status = 'running';
  job.stage = 'waiting_for_model';
  job.startedAt = Date.now();
  delete job.error;
  log(job, 'start', 'Editor lane claimed the request; the game plane is untouched.');
  persist();

  let progressTimer=null;
  try {
    // ---- model turn -------------------------------------------------
    const sources = {index: fs.readFileSync(path.join(laneRootDir, 'index.html'), 'utf8'),backend:backendSources(laneRootDir)};
    const prompt = buildPrompt(job, sources);
    const {text, operations, remaining=[]} = await gen({
      prompt,
      sources,
      signal: controller.signal,
      onEvent: (e) => {
        job.lastEventAt = Date.now();
        if (e.type === 'source.delta') {
          job.sourceStream = ((job.sourceStream || '') + (e.text || '')).slice(0, 450000);
          job.streamDeltaCount = (job.streamDeltaCount || 0) + 1;
          job.stage = 'writing_source';
          if(!progressTimer)progressTimer=setTimeout(()=>{progressTimer=null;progress();},400);return;
        } else {
          job.events = [...(job.events || []), e].slice(-100);
        }
        persist();
      },
    });
    checkAbort();
    job.reply = typeof text === 'string' ? text.slice(0, 20000) : '';
    log(job, 'model_completed', `${job.streamDeltaCount || 0} streamed deltas received.`);

    // ---- validate operations ---------------------------------------
    const resolved=applyBackendOperations(laneRootDir,operations);
    job.generated=operations;job.remaining=remaining;persist();
    if(resolved.some(c=>c.path!=='index.html')){
      if(remaining.length)throw Error('Backend candidate has unimplemented requirements: '+remaining.join('; '));
      if(resolved.some(c=>c.path==='index.html'))syntaxCheckIndexHtml(resolved.find(c=>c.path==='index.html').after);
      const staged=await stageBackendCandidate({root:laneRootDir,state,operations,signal:controller.signal,onStage:phase=>{job.stage=phase;persist();},check:checkEditor});
      checkAbort();assertOperable(job);
      job.backendCandidate=staged.ref;job.changes=staged.changes;job.editorProof=staged.proof;job.proof=staged.proof;
      job.status='awaiting_activation';job.stage='awaiting_activation';
      log(job,'awaiting_activation','Full backend candidate verified; waiting for all accepted work to drain.');persist();
      return {ok:true,awaitingActivation:true,candidate:staged.ref};
    }
    const html=resolved.find(c=>c.path==='index.html').after;
    const ops=validateEditorOperations([{op:'update',path:'index.html',content:html}]);
    const candidateHtml = ops.find((o) => o.path === 'index.html').content;

    // ---- syntax ------------------------------------------------------
    job.stage = 'syntax';
    persist();
    const scriptCount = syntaxCheckIndexHtml(candidateHtml);
    log(job, 'syntax_passed', `${scriptCount} inline scripts parsed.`);
    checkAbort();

    // ---- browser-equivalent page validation --------------------------
    job.stage = 'browser_smoke';
    persist();
    const validate = validator || validateCandidatePage;
    const result = await validate(candidateHtml,{root:laneRootDir});job.editorProof=result;
    log(job, 'page_validation_passed', `served on isolated port ${result.port}; ${result.checked.join(', ')} verified.`);
    checkAbort();

    // ---- promote (atomic: stage then swap) ----------------------------
    const backupPath = path.join(laneRootDir, '.editor-index-backup.html');
    fs.copyFileSync(path.join(laneRootDir, 'index.html'), backupPath);
    try {
      const tmp = path.join(laneRootDir, '.index.html.tmp');
      fs.writeFileSync(tmp, candidateHtml, {mode: 0o644});
      fs.renameSync(tmp, path.join(laneRootDir, 'index.html'));
    } catch (e) {
      fs.copyFileSync(backupPath, path.join(laneRootDir, 'index.html'));
      throw e;
    }
    job.changes = ops.filter(o=>o.content!==sources.index).map(o=>({path:'editor/'+o.path,op:o.op,before:sources.index,after:o.content}));
    job.generated = ops;
    state.editorRevision=(state.editorRevision||0)+1;job.editorRevision=state.editorRevision;job.remaining=remaining;
    job.status=remaining.length?'partial':'applied';job.stage=job.status;
    job.finishedAt = Date.now();
    log(job, 'applied', `Builder index.html verified; editor revision ${state.editorRevision}. Game source and state unchanged.`);
    persist();
    return {ok: true, revision: state.revision};
  } catch (e) {
    if (e && (e.cancelled || controller.signal.aborted)) {
      job.status = 'cancelled';
      job.stage = 'cancelled';
      job.error = 'Editor request stopped; previous builder page retained.';
      job.finishedAt = Date.now();
      log(job, 'cancelled');
      persist();
      return {ok: false, cancelled: true};
    }
    job.status = 'failed';
    job.stage = 'failed';
    job.error = String(e.message).slice(0, 600);
    job.finishedAt = Date.now();
    log(job, 'failed', job.error);
    persist();
    return {ok: false, error: job.error};
  }finally{if(progressTimer)clearTimeout(progressTimer);}
}

/* Prompt for the editor model. Bounded, and honest about what the lane can
 * actually do — the model is told to return ONLY index.html operations. */
export function buildPrompt(job, sources) {
  return [
    'You are the Gulch outer-editor worker. Allowed source paths: index.html, server-app.mjs, world-store.mjs, room-store.mjs, upload-store.mjs; you may also create movement-engine.mjs if needed by the request.',
    'Never edit server.js, backend-release.mjs, editor-lane.mjs, editor-browser-check.mjs, game-project/, credentials, uploads, chat or persisted state. Keep executable files at the original root. Preserve authentication, permissions, supervisor readiness/finalization/quiesce integration, durable world commits and existing gameplay. Do not change movement unless explicitly requested. Maximum five operations, 200KB per resulting file, 400KB batch. update requires an existing file; create requires missing movement-engine.mjs. Prefer exact unique replace operations.',
    'Return a JSON object: {"reply": "<one short paragraph for the player>", "operations": [{"op": "update", "path": "index.html", "content": "<full new file>"}]}',
    'The full current index.html is provided. Preserve every existing feature: the auth gate, the main chat input and send, the request scope selector, task controls (stop/retry/reply), the build board, project notebook, versions panel, and mobile layout. Additive changes only.',
    'The page is served with a strict CSP; keep all JavaScript inline (no external sources). The file must remain a single HTML document starting with <!doctype html>.',
    `Player request (task #${job.id}, verbatim):`,
    '---',
    job.text,
    '---',
    'Prefer op replace with path index.html, find as an exact unique existing substring, and content as its replacement. This avoids rewriting the entire file. Return remaining:[] only when the full request is implemented. List any unimplemented behaviors in remaining. No fake QA results or fake automatic backend features.',
    'Backend operations are staged and validated against a complete isolated application, then await activation after accepted work drains. Do not claim a candidate is already applied. Pure index.html jobs retain the native page lane.',
    'CURRENT COMPLETE index.html:',
    sources.index,
    'CURRENT BACKEND CODE (no player state or credentials):',
    JSON.stringify(Object.fromEntries(Object.entries(sources.backend||{}).filter(([name])=>name!=='index.html'))),
    'Respond with the JSON object only.',
  ].join('\n');
}
