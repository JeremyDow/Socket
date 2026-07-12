# Socket

Personal Orchestration Operating System prototype.

**Founding doctrine:** Applications should not own workflows. Workflows should own applications.

Socket is a local-first workflow runtime where external systems connect through **drop-ins** — pluggable source and destination adapters registered against core contracts.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Socket Core                    │
│  capability-registry · workflow-runner · artifact │
│  safe-paths · config                             │
└─────────────────────────────────────────────────┘
         ▲                              ▲
         │ source contract              │ destination contract
         │                              │
┌────────┴────────┐            ┌────────┴────────┐
│  YouTube drop-in │            │ Obsidian drop-in │
└─────────────────┘            └─────────────────┘
         ▲                              ▲
         │         composed by          │
         └──────────┬───────────────────┘
                    │
         ┌──────────┴──────────┐
         │  Transcript Workflow │
         │  label → render → write│
         └───────────────────────┘
```

## Core Contracts

### Artifact
Typed payload passed between stages. Created via `createArtifact(type, data, meta)`.

### Source Drop-in
```js
{ id, name, role: 'source', fetch(params) => Artifact }
```

### Destination Drop-in
```js
{ id, name, role: 'destination', write(artifact, params) => Artifact }
```

### Workflow
```js
{ id, name, run(input, context) => { artifact, writtenPath, preview, meta } }
```

Workflows compose drop-ins — they do not embed provider-specific logic.

## Running

```bash
cd socket
npm start
# Open http://127.0.0.1:3847
```

Requires **yt-dlp** on PATH for live YouTube caption fetching.

## Assistant workspace (S5)

Socket includes a native right-side assistant panel. Conversations are owned by
Socket for the current browser session. A single hardcoded provider path (OpenAI
Responses API) returns assistant replies via `POST /api/assistant/chat`.
Requires `OPENAI_API_KEY`.

See `docs/architecture/SOCKET-S5-assistant-workspace.md`.

## Project Layout

```
socket/
  server.js              — HTTP server + API
  src/core/              — contracts and runtime
  src/assistant/         — S5 hardcoded completion path (OpenAI Responses)
  src/dropins/           — pluggable adapters
  src/workflows/         — composed workflows
  public/                — local web UI (+ Socket-owned assistant panel)
  data/runs/             — workflow run logs
  test/                  — unit tests
  docs/                  — documentation
```