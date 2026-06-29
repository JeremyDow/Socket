import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createArtifact } from '../src/core/artifact.js';
import { obsidianDestinationDropin } from '../src/dropins/obsidian/obsidian-destination.js';

describe('obsidian-destination', () => {
  let vaultDir;

  before(() => {
    vaultDir = mkdtempSync(path.join(tmpdir(), 'socket-vault-'));
  });

  after(() => {
    rmSync(vaultDir, { recursive: true, force: true });
  });

  it('writes markdown to vault folder without overwrite', async () => {
    const artifact = createArtifact('transcript.markdown', {
      title: 'Test Video',
      markdown: '# Test\n\nContent here.',
    });

    const result = await obsidianDestinationDropin.write(artifact, {
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
      filename: 'Test Video',
    });

    assert.ok(fs.existsSync(result.data.path));
    assert.equal(fs.readFileSync(result.data.path, 'utf8'), '# Test\n\nContent here.');

    const second = await obsidianDestinationDropin.write(artifact, {
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
      filename: 'Test Video',
    });

    assert.notEqual(result.data.path, second.data.path);
  });

  it('rejects path escape attempts', async () => {
    const artifact = createArtifact('transcript.markdown', {
      markdown: 'x',
    });

    await assert.rejects(
      () =>
        obsidianDestinationDropin.write(artifact, {
          vaultPath: vaultDir,
          transcriptFolder: '../../outside',
        }),
      /escapes allowed directory/
    );
  });

  it('creates transcript folder if missing', async () => {
    const artifact = createArtifact('transcript.markdown', {
      markdown: '# New folder test',
    });

    const result = await obsidianDestinationDropin.write(artifact, {
      vaultPath: vaultDir,
      transcriptFolder: 'NewFolder/Deep',
      filename: 'nested',
    });

    assert.ok(fs.existsSync(result.data.path));
    assert.match(result.data.path, /NewFolder\/Deep/);
  });
});