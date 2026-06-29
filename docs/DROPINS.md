# Drop-ins

Drop-ins are pluggable adapters that implement Socket core contracts. They are registered at startup via `bootstrapDropins()` and resolved by the capability registry.

## Source Drop-ins

### YouTube (`src/dropins/youtube/`)

Fetches video metadata and captions via **yt-dlp**.

| Param | Required | Description |
|-------|----------|-------------|
| `url` | yes | YouTube video URL |
| `startTime` | no | Range start (seconds, MM:SS, or HH:MM:SS) |
| `endTime` | no | Range end |
| `_execYtDlp` | no | Injectable executor for tests |

**Behavior:**
- Prefers captions/subtitles (auto-generated or manual)
- Preserves source timestamps
- Rejects with clear error if captions unavailable
- Audio transcription fallback is **not implemented**

**Returns:** `youtube.transcript` artifact with `{ url, videoId, title, segments[] }`

## Destination Drop-ins

### Obsidian (`src/dropins/obsidian/`)

Writes markdown files into a configured vault folder.

| Param | Required | Description |
|-------|----------|-------------|
| `vaultPath` | yes | Obsidian vault root directory |
| `transcriptFolder` | yes | Folder within vault (created if missing) |
| `filename` | no | Base filename (sanitized, unique suffix if collision) |

**Behavior:**
- Path sanitization and escape prevention
- Never overwrites existing files
- Returns written file path

**Returns:** `obsidian.file` artifact with `{ path, markdown }`

## Adding a Drop-in

1. Implement the contract in `src/dropins/<name>/`
2. Export a `register<Name>Dropin()` function from `index.js`
3. Call it from `src/bootstrap.js`

Do not hardcode drop-in logic into workflows — always resolve through the registry.