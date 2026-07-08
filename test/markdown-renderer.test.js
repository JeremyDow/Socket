import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderTranscriptMarkdown,
  describeRange,
  quoteClipHeading,
  extractQuoteBlocks,
} from '../src/workflows/transcript/markdown-renderer.js';

describe('markdown-renderer', () => {
  it('describeRange returns full when no bounds', () => {
    assert.equal(describeRange(), 'full');
    assert.equal(describeRange(null, null), 'full');
  });

  it('describeRange formats clip range as HH:MM:SS-HH:MM:SS', () => {
    assert.equal(describeRange('1:00', '5:00'), '00:01:00-00:05:00');
    assert.equal(describeRange('00:01:00', '00:05:00'), '00:01:00-00:05:00');
  });

  it('quoteClipHeading uses en-dash between timestamps', () => {
    assert.equal(quoteClipHeading('1:00', '5:00'), '## Quote Clip: 00:01:00–00:05:00');
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
    assert.match(md, /range: full/);
    assert.match(md, /# Example Video/);
    assert.match(md, /## Transcript/);
    assert.match(md, /\[01:14\] Host:/);
    assert.doesNotMatch(md, /Quote Clip/);
  });

  it('renderTranscriptMarkdown uses quote clip heading and range frontmatter', () => {
    const md = renderTranscriptMarkdown({
      title: 'Clip Video',
      url: 'https://youtube.com/watch?v=abc',
      segments: [{ start: 60, speaker: 'Host', text: 'Clip line.' }],
      speakerLabels: { speaker_1: 'Host' },
      startTime: '1:00',
      endTime: '5:00',
      transcriptSource: 'audio_transcription',
      transcriptionProvider: 'local_whisper',
      diarization: false,
    });

    assert.match(md, /range: 00:01:00-00:05:00/);
    assert.match(md, /## Quote Clip: 00:01:00–00:05:00/);
    assert.doesNotMatch(md, /## Transcript/);
  });

  it('extractQuoteBlocks returns body without frontmatter or title', () => {
    const md = renderTranscriptMarkdown({
      title: 'Test',
      url: 'https://youtube.com/watch?v=x',
      segments: [{ start: 0, speaker: 'Host', text: 'Quote here.' }],
      speakerLabels: { speaker_1: 'Host' },
      startTime: '0:00',
      endTime: '1:00',
    });

    const quotes = extractQuoteBlocks(md);
    assert.match(quotes, /Quote Clip/);
    assert.match(quotes, /\[00:00\] Host:/);
    assert.match(quotes, /"Quote here\."/);
    assert.doesNotMatch(quotes, /^---/);
    assert.doesNotMatch(quotes, /^# Test/);
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