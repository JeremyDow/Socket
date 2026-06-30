import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDownloadSection,
  buildAudioExtractionArgs,
  AUDIO_FORMAT_SELECTOR,
  resolveYtDlpPath,
} from '../src/dropins/youtube/youtube-source.js';

describe('youtube audio fallback', () => {
  it('buildDownloadSection formats start/end for yt-dlp', () => {
    assert.equal(buildDownloadSection('1:00', '5:00'), '*1:00-5:00');
    assert.equal(buildDownloadSection('60', '300'), '*1:00-5:00');
    assert.equal(buildDownloadSection(null, null), null);
    assert.equal(buildDownloadSection('1:00', null), '*1:00-inf');
  });

  it('buildAudioExtractionArgs uses bestaudio/best format selector', () => {
    const args = buildAudioExtractionArgs('https://youtu.be/test', {
      startTime: '1:00',
      endTime: '2:00',
      outputPath: '/tmp/socket-test.%(ext)s',
    });

    assert.equal(args[0], '-f');
    assert.equal(args[1], AUDIO_FORMAT_SELECTOR);
    assert.equal(args[1], 'bestaudio/best');
    assert.ok(args.includes('-x'));
    assert.ok(args.includes('--audio-format'));
    assert.ok(args.includes('mp3'));
    assert.ok(args.includes('--download-sections'));
    assert.ok(args.includes('*1:00-2:00'));
    assert.equal(args.at(-1), 'https://youtu.be/test');
  });

  it('buildAudioExtractionArgs omits download-sections for full video', () => {
    const args = buildAudioExtractionArgs('https://youtu.be/test', {
      outputPath: '/data/tmp/audio.%(ext)s',
    });

    assert.equal(args[1], 'bestaudio/best');
    assert.ok(!args.includes('--download-sections'));
  });

  it('resolveYtDlpPath uses PATH lookup', () => {
    const path = resolveYtDlpPath((cmd) => {
      if (cmd === 'yt-dlp') return '/opt/homebrew/bin/yt-dlp';
      throw new Error('not found');
    });
    assert.equal(path, '/opt/homebrew/bin/yt-dlp');
  });
});