import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWhisperSegments,
  applyTimestampOffset,
} from '../src/processors/whisper/local-whisper.js';

describe('local-whisper processor', () => {
  it('parseWhisperSegments extracts timed segments', () => {
    const segments = parseWhisperSegments({
      segments: [
        { start: 0.0, end: 2.5, text: ' Hello' },
        { start: 2.5, end: 5.0, text: ' world' },
        { start: 5.0, end: 5.5, text: '  ' },
      ],
    });

    assert.equal(segments.length, 2);
    assert.equal(segments[0].text, 'Hello');
    assert.equal(segments[1].start, 2.5);
  });

  it('applyTimestampOffset preserves range offset for partial clips', () => {
    const segments = [
      { start: 0, text: 'First' },
      { start: 5, text: 'Second' },
    ];
    const offset = applyTimestampOffset(segments, 60);

    assert.equal(offset[0].start, 60);
    assert.equal(offset[1].start, 65);
  });

  it('applyTimestampOffset is no-op when offset is zero', () => {
    const segments = [{ start: 10, text: 'A' }];
    const result = applyTimestampOffset(segments, 0);
    assert.equal(result[0].start, 10);
  });
});