# Obsidian Tool

**Owns:** Obsidian vault destination writes for generated Markdown artifacts.

**Listens for:** `markdown_created`, `destination_selected`, `artifact_write_requested`

**Emits:** `artifact_written`

**Approval required:** `write_to_obsidian`, `replace_existing_file`. Default
Obsidian destination configuration remains in `socket.config.json.example` and
operator-saved defaults — not in the tool manifest.