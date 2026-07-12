# Socket Application Shell

## Role

Socket is the **host workspace** for synchronized tool tabs. It coordinates reads,
drafts, and operator-approved writes across native tools and external apps.

## Assistant (S5)

The Socket assistant is a **participant** inside the workspace, not Socket itself
and not a provider-owned chat product. S5 adds a native right-side slide-out
panel with Socket-owned in-session conversations and a single hardcoded
completion path (xAI). See `SOCKET-S5-assistant-workspace.md`.

## Tool model

- Tools appear as synchronized tabs in the Socket UI.
- The **transcriber** is one Socket tool, not Socket itself.
- **Oracle** is a separate application loadable through `src/adapters/oracle/`.
- Tabs synchronize through the shared session and event layer (`src/session/`,
  `src/events/`).
- Tools must not call one another directly; they communicate only through
  registered session events.

## Permissions

Agent autonomy is bounded by explicit permission categories in
`src/permissions/`:

- automatic — local reads and drafting
- operator_approval — durable writes, Oracle proposals, external effects
- forbidden — governance bypass and silent authority creation

## First validated workflow

The existing vertical slice remains the reference path:

**YouTube → Transcriber → Markdown → Obsidian**

Implementation today still lives in the established modules:

- `src/dropins/youtube/`
- `src/processors/whisper/`
- `src/workflows/transcript/`
- `src/dropins/obsidian/`

New `src/tools/*` entry points are compatibility wrappers only. They do not
replace the working workflow in this pass.

## Oracle boundary

Socket may prepare intake material and propose it to Oracle. Socket may not
create Oracle authority, perform lifecycle transitions, or bypass Oracle gates.
See `src/adapters/oracle/README.md`.

## Configuration

- Tool enablement: `config/tools.json`
- Enabled `external-app` tools require an absolute `http:` or `https:` `url` in the
  manifest. Socket renders those tools as sandboxed iframe panels; it does not proxy
  application APIs or share storage with the embedded app.
- API requests made inside an embedded application page use that application's own
  origin (for Pylon: `http://127.0.0.1:4780`). Socket does not submit, authenticate,
  or sign those requests. `PYLON_SOCKET_ORIGIN` authorizes the Socket parent frame
  where applicable; it does not convert Pylon API traffic into Socket-origin requests.
- Obsidian defaults: `socket.config.json.example` and operator-saved defaults
  (not duplicated in the tool manifest)
- Canonical Socket origin for Stage B: `http://127.0.0.1:3847`