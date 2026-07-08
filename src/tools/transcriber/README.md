# Transcriber Tool

**Owns:** local speech-to-text processing for a user-selected source clip.

**Listens for:** `transcription_requested`, `video_selected`

**Emits:** `transcription_started`, `transcription_completed`

**Approval required:** transcription runs only after the operator selects a video
(automatic once selected). External paid transcription providers would require
operator approval if added later.