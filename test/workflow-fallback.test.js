import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  _resetRegistry,
  registerSource,
  registerDestination,
  registerProcessor,
} from '../src/core/capability-registry.js';
import {
  youtubeToTranscriptWorkflow,
  TRANSCRIPT_SOURCE_STATUS,
} from '../src/workflows/transcript/youtube-to-transcript.js';
import { createArtifact } from '../src/core/artifact.js';

describe('workflow audio fallback', () => {
  let vaultDir;

  before(() => {
    _resetRegistry();
    vaultDir = mkdtempSync(path.join(tmpdir(), 'socket-fallback-'));

    registerSource('youtube', {
      id: 'youtube',
      async fetch(params) {
        if (params._forceCaptions) {
          return createArtifact('youtube.transcript', {
            url: 'https://youtube.com/watch?v=test',
            title: 'Caption Video',
            segments: [{ start: 10, text: 'From captions.' }],
            transcriptSource: 'captions',
          });
        }
        return createArtifact('youtube.audio', {
          url: 'https://youtube.com/watch?v=test',
          title: 'Audio Video',
          audioPath: '/tmp/fake-audio.wav',
          rangeOffset: 60,
          transcriptSource: 'audio_pending',
        }, { workDir: '/tmp/fake-work' });
      },
    });

    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe(audioArtifact) {
        return createArtifact('transcript.segments', {
          segments: [
            { start: 0, text: 'Transcribed first.' },
            { start: 4, text: 'Transcribed second.' },
          ],
          transcriptSource: 'audio_transcription',
          transcriptionProvider: 'local_whisper',
          diarization: false,
        });
      },
    });

    registerDestination('obsidian', {
      id: 'obsidian',
      async write(artifact, params) {
        const dir = path.join(params.vaultPath, params.transcriptFolder);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'output.md');
        fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');
        return createArtifact('obsidian.file', { path: filePath });
      },
    });
  });

  after(() => {
    rmSync(vaultDir, { recursive: true, force: true });
    _resetRegistry();
  });

  it('captions path still works', async () => {
    _resetRegistry();
    registerSource('youtube', {
      id: 'youtube',
      async fetch() {
        return createArtifact('youtube.transcript', {
          url: 'https://youtube.com/watch?v=test',
          title: 'Caption Video',
          segments: [{ start: 10, text: 'From captions.' }],
          transcriptSource: 'captions',
        });
      },
    });
    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe() {
        throw new Error('should not be called for captions path');
      },
    });
    registerDestination('obsidian', {
      id: 'obsidian',
      async write(artifact, params) {
        const dir = path.join(params.vaultPath, params.transcriptFolder);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'captions.md');
        fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');
        return createArtifact('obsidian.file', { path: filePath });
      },
    });

    const result = await youtubeToTranscriptWorkflow.run({
      url: 'https://youtube.com/watch?v=test',
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
    });

    assert.equal(result.meta.transcriptSource, 'captions');
    assert.equal(result.meta.transcriptSourceStatus, TRANSCRIPT_SOURCE_STATUS.CAPTIONS);
    assert.match(result.preview, /transcript_source: captions/);
    assert.doesNotMatch(result.preview, /transcription_provider/);
  });

  it('no captions triggers audio fallback via processor', async () => {
    _resetRegistry();
    registerSource('youtube', {
      id: 'youtube',
      async fetch() {
        return createArtifact('youtube.audio', {
          url: 'https://youtube.com/watch?v=test',
          title: 'Audio Video',
          audioPath: '/tmp/fake-audio.wav',
          rangeOffset: 60,
          transcriptSource: 'audio_pending',
        }, { workDir: '/tmp/fake-work' });
      },
    });
    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe() {
        return createArtifact('transcript.segments', {
          segments: [
            { start: 60, text: 'Transcribed first.' },
            { start: 64, text: 'Transcribed second.' },
          ],
          transcriptSource: 'audio_transcription',
          transcriptionProvider: 'local_whisper',
          diarization: false,
        });
      },
    });
    registerDestination('obsidian', {
      id: 'obsidian',
      async write(artifact, params) {
        const dir = path.join(params.vaultPath, params.transcriptFolder);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'audio.md');
        fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');
        return createArtifact('obsidian.file', { path: filePath });
      },
    });

    const result = await youtubeToTranscriptWorkflow.run({
      url: 'https://youtube.com/watch?v=test',
      startTime: '1:00',
      hostName: 'Host',
      guestName: 'Guest',
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
    });

    assert.equal(result.meta.transcriptSource, 'audio_transcription');
    assert.equal(result.meta.transcriptSourceStatus, TRANSCRIPT_SOURCE_STATUS.AUDIO_FALLBACK);
    assert.equal(result.meta.transcriptionProvider, 'local_whisper');
    assert.equal(result.meta.diarization, false);
    assert.match(result.preview, /transcript_source: audio_transcription/);
    assert.match(result.preview, /transcription_provider: local_whisper/);
    assert.match(result.preview, /diarization: false/);
  });

  it('audio fallback unavailable gives clear error', async () => {
    _resetRegistry();
    registerSource('youtube', {
      id: 'youtube',
      async fetch() {
        return createArtifact('youtube.audio', {
          url: 'https://youtube.com/watch?v=test',
          title: 'No Whisper',
          audioPath: '/tmp/fake.wav',
          rangeOffset: 0,
        }, { workDir: '/tmp' });
      },
    });
    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe() {
        throw new Error(
          'Audio transcription fallback unavailable: whisper CLI not installed. Install openai-whisper: pip install openai-whisper'
        );
      },
    });
    registerDestination('obsidian', {
      id: 'obsidian',
      async write() {
        return createArtifact('obsidian.file', { path: '/tmp/x.md' });
      },
    });

    try {
      await youtubeToTranscriptWorkflow.run({
        url: 'https://youtube.com/watch?v=test',
        vaultPath: vaultDir,
        transcriptFolder: 'Transcripts',
      });
      assert.fail('expected audio fallback to fail');
    } catch (err) {
      assert.match(err.message, /Audio transcription fallback unavailable/);
      assert.equal(err.transcriptSourceStatus, TRANSCRIPT_SOURCE_STATUS.AUDIO_UNAVAILABLE);
    }
  });

  it('timestamp offset is preserved for partial ranges in audio path', async () => {
    _resetRegistry();
    registerSource('youtube', {
      id: 'youtube',
      async fetch() {
        return createArtifact('youtube.audio', {
          url: 'https://youtube.com/watch?v=test',
          title: 'Offset Video',
          audioPath: '/tmp/fake.wav',
          rangeOffset: 90,
        }, { workDir: '/tmp' });
      },
    });
    registerProcessor('local_whisper', {
      id: 'local_whisper',
      async transcribe(audioArtifact) {
        const offset = audioArtifact.data.rangeOffset;
        return createArtifact('transcript.segments', {
          segments: [
            { start: 0 + offset, text: 'At offset.' },
            { start: 14 + offset, text: 'Later.' },
          ],
          transcriptSource: 'audio_transcription',
          transcriptionProvider: 'local_whisper',
          diarization: false,
        });
      },
    });
    registerDestination('obsidian', {
      id: 'obsidian',
      async write(artifact, params) {
        const dir = path.join(params.vaultPath, params.transcriptFolder);
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'offset.md');
        fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');
        return createArtifact('obsidian.file', { path: filePath });
      },
    });

    const result = await youtubeToTranscriptWorkflow.run({
      url: 'https://youtube.com/watch?v=test',
      startTime: '1:30',
      vaultPath: vaultDir,
      transcriptFolder: 'Transcripts',
    });

    assert.match(result.preview, /\[01:30\]/);
    assert.match(result.preview, /\[01:44\]/);
  });
});