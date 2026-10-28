# Gulch — shared-world game server

A shared-world browser dungeon crawler with a server-authoritative world state,
an in-browser source editor driven by Codex, and a revision-gated backend
activation system.

## Layout

```
server.js              supervisor entry point (delegates to backend-release.mjs)
server-app.mjs         the game server worker: HTTP, SSE, auth, game API, editor lane
backend-release.mjs    digest-gated activation + rollback of backend code
app-server-stream.mjs  adapter over `codex app-server` (streamed source generation)
codex-bridge.mjs       prompt construction + candidate proposal
editor-lane.mjs        the build/editor task pipeline
movement-engine.mjs    authoritative movement simulation
world-store.mjs        world-state persistence
room-store.mjs         room/chat persistence
revisions.mjs          source-revision store
revision-history.mjs   revision history
upload-store.mjs       player image uploads
browser-smoke.mjs      headless smoke test for generated candidates
two_client_test.mjs    two-client contention harness
index.html             the shell UI: game pane + activity pane + chat/task composer
game.html              the game client
revisions/<candidate>/ the served client modules (one dir per accepted source revision)
```

## How a change flows

1. A player or operator types a request in the composer (Task mode).
2. `editor-lane.mjs` assembles scoped source context and asks Codex for a
   structured candidate (source operations, not diffs).
3. `browser-smoke.mjs` loads the candidate headlessly and checks it renders and
   responds to input.
4. `backend-release.mjs` verifies the candidate manifest, quiesces the running
   worker, writes the new files atomically, boots a new worker, and only then
   commits an activation journal. Any failure restores the previous code.

## The activation digest gate

`backend-release.mjs` refuses to serve unless the code on disk matches the
committed activation record in `.backend-activation.json`:

- `rootCode()` hashes every `.mjs`/`.js` at the root plus `index.html`.
- `backendDigest()` then **excludes `index.html`** from the digest.

So `index.html` is digest-exempt (safe to edit and reload), while any `.mjs`
change must be accompanied by a rewritten journal or the supervisor will refuse
to boot with `Committed activation code digest mismatch`.

## Ask mode

`POST /api/ask` provides read-only Q&A over the same Codex lane. Because the
model runs with shell and file tools disabled, `askSourceContext()` inlines a
keyword-scored slice of the source (140 KB budget) plus a full file manifest
into the prompt.

## Running locally

```
PORT=8790 HOST=127.0.0.1 node server.js
```

Requires a Codex login (`~/.codex/auth.json`) and a room password, which the
server generates on first run.

## Notes

This is a working codebase published for review. It contains no player state,
no credentials, and no deployment secrets — those live outside the repository.
