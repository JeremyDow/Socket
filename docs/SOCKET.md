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
# Open http://localhost:3847
```

Requires **yt-dlp** on PATH for live YouTube caption fetching.

## Project Layout

```
socket/
  server.js              — HTTP server + API
  src/core/              — contracts and runtime
  src/dropins/           — pluggable adapters
  src/workflows/         — composed workflows
  public/                — local web UI
  data/runs/             — workflow run logs
  test/                  — unit tests
  docs/                  — documentation
```