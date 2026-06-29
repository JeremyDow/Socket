import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assignSpeakerLabels, SPEAKER_MODES } from '../src/workflows/transcript/speaker-labels.js';

describe('speaker-labels', () => {
  const segments = [
    { start: 0, text: 'A' },
    { start: 5, text: 'B' },
    { start: 10, text: 'C' },
  ];

  it('alternates Host/Guest when both provided', () => {
    const result = assignSpeakerLabels(segments, { hostName: 'Host', guestName: 'Guest' });
    assert.equal(result.mode, SPEAKER_MODES.ALTERNATING);
    assert.equal(result.segments[0].speaker, 'Host');
    assert.equal(result.segments[1].speaker, 'Guest');
    assert.equal(result.segments[2].speaker, 'Host');
    assert.match(result.limitation, /not available in v0/);
  });

  it('uses single speaker when only one name provided', () => {
    const result = assignSpeakerLabels(segments, { hostName: 'Narrator' });
    assert.equal(result.mode, SPEAKER_MODES.SINGLE);
    assert.equal(result.segments.every(s => s.speaker === 'Narrator'), true);
  });

  it('defaults to Speaker 1 when no names provided', () => {
    const result = assignSpeakerLabels(segments);
    assert.equal(result.segments[0].speaker, 'Speaker 1');
  });
});