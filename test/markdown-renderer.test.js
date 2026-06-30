import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTranscriptMarkdown, describeRange } from '../src/workflows/transcript/markdown-renderer.js';

describe('markdown-renderer', () => {
  it('describeRange returns full when no bounds', () => {
    assert.equal(describeRange(), 'full');
    assert.equal(describeRange(null, null), 'full');
  });

  it('describeRange formats partial ranges', () => {
    assert.equal(describeRange('1:00', '5:00'), 'from 1:00 to 5:00');
  });

  it('renderTranscriptMarkdown produces frontmatter and quoted segments', () => {
    const md = renderTranscriptMarkdown({
      title: 'Example Video',
      url: 'https://youtube.com/watch?v=abc',
      segments: [
        { start: 74, speaker: 'Host', text: 'Hello there.' },
        { start: 82, speaker: 'Guest', text: 'Hi back.' },
      ],
      speakerLabels: { speaker_1: 'Host', speaker_2: 'Guest' },
      range: 'full',
      created: '2026-06-29',
      transcriptSource: 'captions',
    });

    assert.match(md, /^---\ntype: transcript/);
    assert.match(md, /transcript_source: captions/);
    assert.match(md, /video_title: Example Video/);
    assert.match(md, /speaker_1: Host/);
    assert.match(md, /# Example Video/);
    assert.match(md, /\[01:14\] Host:/);
    assert.match(md, /"Hello there\."/);
    assert.match(md, /\[01:22\] Guest:/);
    assert.doesNotMatch(md, /transcription_provider/);
  });

  it('renderTranscriptMarkdown includes audio transcription metadata', () => {
    const md = renderTranscriptMarkdown({
      title: 'Audio Video',
      url: 'https://youtube.com/watch?v=xyz',
      segments: [{ start: 60, speaker: 'Speaker 1', text: 'Transcribed.' }],
      speakerLabels: { speaker_1: 'Speaker 1' },
      transcriptSource: 'audio_transcription',
      transcriptionProvider: 'local_whisper',
      diarization: false,
    });

    assert.match(md, /transcript_source: audio_transcription/);
    assert.match(md, /transcription_provider: local_whisper/);
    assert.match(md, /diarization: false/);
  });
});