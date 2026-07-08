import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignSpeakerLabels,
  SPEAKER_MODES,
  SPEAKER_WARNING,
} from '../src/workflows/transcript/speaker-labels.js';

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
    assert.match(result.limitation, new RegExp(SPEAKER_WARNING));
    assert.match(result.limitation, /alternate by segment/);
  });

  it('labels all as Host when only Host provided', () => {
    const result = assignSpeakerLabels(segments, { hostName: 'Host' });
    assert.equal(result.mode, SPEAKER_MODES.SINGLE);
    assert.equal(result.segments.every(s => s.speaker === 'Host'), true);
    assert.match(result.limitation, new RegExp(SPEAKER_WARNING));
    assert.match(result.limitation, /labeled as Host/);
  });

  it('defaults to Speaker 1 when no names provided', () => {
    const result = assignSpeakerLabels(segments);
    assert.equal(result.segments.every(s => s.speaker === 'Speaker 1'), true);
    assert.match(result.limitation, new RegExp(SPEAKER_WARNING));
    assert.match(result.limitation, /Speaker 1/);
  });
});