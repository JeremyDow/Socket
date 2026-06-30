import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { _resetRegistry, registerSource, registerDestination, registerProcessor } from '../src/core/capability-registry.js';
import { youtubeToTranscriptWorkflow } from '../src/workflows/transcript/youtube-to-transcript.js';
import { createArtifact } from '../src/core/artifact.js';

const SAMPLE_VTT = `WEBVTT

00:01:14.000 --> 00:01:18.000
Today we're going to look at why this linkage works.

00:01:22.000 --> 00:01:26.000
The interesting part is the force path.
`;

describe('youtube-to-transcript workflow', () => {
  let vaultDir;

  before(() => {
    _resetRegistry();
    vaultDir = mkdtempSync(path.join(tmpdir(), 'socket-workflow-'));

    registerSource('youtube', {
      id: 'youtube',
      async fetch() {
        return createArtifact('youtube.transcript', {
          url: 'https://youtube.com/watch?v=test',
          title: 'Example Video',
          segments: [
            { start: 74, text: "Today we're going to look at why this linkage works." },
            { start: 82, text: 'The interesting part is the force path.' },
          ],
          transcriptSource: 'captions',
        });
      },
    });

    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe() {
        throw new Error('not used in captions test');
      },
    });

    registerDestination('obsidian', {
      id: 'obsidian',
      async write(artifact, params) {
        const dir = path.join(params.vaultPath, params.transcriptFolder);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'Example Video.md');
        fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');
        return createArtifact('obsidian.file', { path: filePath });
      },
    });
  });

  after(() => {
    rmSync(vaultDir, { recursive: true, force: true });
    _resetRegistry();
  });

  it('composes source → processor → destination drop-ins', async () => {
    const result = await youtubeToTranscriptWorkflow.run({
      url: 'https://youtube.com/watch?v=test',
      hostName: 'Host',
      guestName: 'Guest',
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
    });

    assert.ok(result.preview);
    assert.match(result.preview, /type: transcript/);
    assert.match(result.preview, /\[01:14\] Host:/);
    assert.match(result.preview, /\[01:22\] Guest:/);
    assert.ok(result.writtenPath);
    assert.equal(result.meta.speakerLabelMode, 'alternating');
    assert.equal(result.meta.transcriptSource, 'captions');
    assert.match(result.preview, /transcript_source: captions/);
  });
});