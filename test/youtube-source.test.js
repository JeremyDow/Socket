import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestamp,
  formatTimestamp,
  filterByRange,
  parseVtt,
} from '../src/dropins/youtube/youtube-source.js';

const SAMPLE_VTT = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:05.000
Hello and welcome.

00:01:14.000 --> 00:01:18.000
Today we're going to look at why this linkage works.

00:01:22.000 --> 00:01:26.000
The interesting part is the force path.

00:01:31.000 --> 00:01:35.000
So the geometry is doing some of the work.
`;

describe('youtube-source', () => {
  it('parseTimestamp handles seconds, MM:SS, and HH:MM:SS', () => {
    assert.equal(parseTimestamp('74'), 74);
    assert.equal(parseTimestamp('1:14'), 74);
    assert.equal(parseTimestamp('01:14'), 74);
    assert.equal(parseTimestamp('1:01:14'), 3674);
    assert.throws(() => parseTimestamp('bad'));
  });

  it('formatTimestamp renders bracketed timestamps', () => {
    assert.equal(formatTimestamp(74), '[01:14]');
    assert.equal(formatTimestamp(3674), '[01:01:14]');
  });

  it('parseVtt extracts segments with timestamps', () => {
    const segments = parseVtt(SAMPLE_VTT);
    assert.equal(segments.length, 4);
    assert.equal(segments[0].text, 'Hello and welcome.');
    assert.equal(segments[1].start, 74);
    assert.equal(segments[1].text, "Today we're going to look at why this linkage works.");
  });

  it('filterByRange respects start and end', () => {
    const segments = parseVtt(SAMPLE_VTT);
    const filtered = filterByRange(segments, '1:10', '1:25');
    assert.equal(filtered.length, 2);
    assert.equal(filtered[0].start, 74);
    assert.equal(filtered[1].start, 82);
  });
});