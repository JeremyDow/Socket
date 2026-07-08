# YouTube Tool

**Owns:** source selection and metadata fetch for YouTube URLs.

**Listens for:** `source_selected`, `video_selected`

**Emits:** `source_selected`, `video_selected`, `transcription_requested`

**Approval required:** none for read-only source inspection; transcription start
requires an explicit operator-selected video (automatic after selection).