# Transcript Workflow

**ID:** `youtube-to-transcript`

Composes YouTube source → speaker labeling + markdown render → Obsidian destination.

## Pipeline

1. **Source** — `getSource('youtube').fetch({ url, startTime, endTime })`
2. **Processor** — assign speaker labels, render quote-addressable markdown
3. **Destination** — `getDestination('obsidian').write(artifact, { vaultPath, transcriptFolder })`

## Input

| Field | Required | Description |
|-------|----------|-------------|
| `url` | yes | YouTube URL |
| `startTime` | no | Optional range start |
| `endTime` | no | Optional range end |
| `hostName` | no | Speaker label for alternating segments |
| `guestName` | no | Speaker label for alternating segments |
| `vaultPath` | yes | Obsidian vault path |
| `transcriptFolder` | yes | Output folder within vault |

## Output Format

```markdown
---
type: transcript
source: youtube
url: https://youtube.com/watch?v=...
video_title: Example Video
created: 2026-06-29
range: full
speaker_labels:
  speaker_1: Host
  speaker_2: Guest
---

# Example Video
## Transcript
[00:01:14] Host:
"Today we're going to look at why this linkage works."
```

## Speaker Label Limitation (v0)

True speaker diarization is **not implemented**.

- If Host and Guest are provided → labels **alternate by segment index**
- Otherwise → all segments labeled "Speaker 1" (or Host if only Host provided)

This limitation is returned in `meta.speakerLabelLimitation` and shown in the UI.

## API

```
POST /api/workflows/transcript
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=...",
  "hostName": "Host",
  "guestName": "Guest",
  "vaultPath": "/path/to/vault",
  "transcriptFolder": "Transcripts"
}
```