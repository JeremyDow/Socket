import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createArtifact } from '../../core/artifact.js';

/**
 * YouTube Source Drop-in
 *
 * Fetches captions/subtitles via yt-dlp. Audio transcription fallback is NOT
 * implemented — if captions are unavailable, fetch() rejects with a clear error.
 */

export const youtubeSourceDropin = {
  id: 'youtube',
  name: 'YouTube',
  role: 'source',

  /**
   * @param {object} params
   * @param {string} params.url - YouTube video URL
   * @param {string} [params.startTime] - optional start timestamp (HH:MM:SS or seconds)
   * @param {string} [params.endTime] - optional end timestamp
   * @param {function} [params._execYtDlp] - injectable for tests
   */
  async fetch(params) {
    const { url, startTime, endTime, _execYtDlp } = params;
    if (!url) throw new Error('YouTube URL is required');

    const execYtDlp = _execYtDlp ?? defaultExecYtDlp;

    try {
      await execYtDlp(['--version']);
    } catch {
      throw new Error(
        'yt-dlp is not installed or not on PATH. Install it: https://github.com/yt-dlp/yt-dlp#installation'
      );
    }

    const info = await fetchVideoInfo(url, execYtDlp);
    const captions = await fetchCaptions(url, execYtDlp);

    if (!captions || !captions.raw) {
      throw new Error(
        'No captions/subtitles available for this video. Audio transcription fallback is not implemented yet.'
      );
    }

    const segments = parseVttOrJsonCaptions(captions);
    const filtered = filterByRange(segments, startTime, endTime);

    return createArtifact('youtube.transcript', {
      url,
      videoId: info.id,
      title: info.title,
      segments: filtered,
      captionFormat: captions.format,
    }, {
      source: 'youtube',
      fetchedAt: new Date().toISOString(),
    });
  },
};

async function fetchVideoInfo(url, execYtDlp) {
  const stdout = await execYtDlp([
    '--dump-json',
    '--no-download',
    '--no-warnings',
    url,
  ]);
  const info = JSON.parse(stdout);
  return {
    id: info.id,
    title: info.title || 'Untitled Video',
  };
}

async function fetchCaptions(url, execYtDlp) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'socket-ytdlp-'));
  try {
    await execYtDlp([
      '--skip-download',
      '--write-auto-sub',
      '--write-sub',
      '--sub-lang', 'en.*,en',
      '--sub-format', 'vtt',
      '--no-warnings',
      '-o', join(tmpDir, 'sub'),
      url,
    ]);

    const files = readdirSync(tmpDir).filter(f => f.endsWith('.vtt'));
    if (files.length === 0) return null;

    const content = readFileSync(join(tmpDir, files[0]), 'utf8');
    return { raw: content, format: 'vtt' };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Parse VTT caption content into timestamped segments.
 */
export function parseVttOrJsonCaptions(captions) {
  const raw = typeof captions === 'string' ? captions : captions.raw;
  if (!raw) return [];

  if (captions.format === 'json' || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
    return parseJsonCaptions(raw);
  }
  return parseVtt(raw);
}

export function parseVtt(vtt) {
  const segments = [];
  const blocks = vtt.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;

    const [startRaw] = timeLine.split('-->').map(s => s.trim());
    const start = parseTimestamp(startRaw.replace(',', '.'));

    const textLines = lines.filter(
      l =>
        !l.includes('-->') &&
        !/^\d+$/.test(l.trim()) &&
        !l.startsWith('WEBVTT') &&
        !l.startsWith('Kind:') &&
        !l.startsWith('Language:') &&
        !l.startsWith('NOTE')
    );
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;

    segments.push({ start, text });
  }

  return segments;
}

function parseJsonCaptions(json) {
  const data = JSON.parse(json);
  const events = data.events || data;
  if (!Array.isArray(events)) return [];

  return events
    .filter(e => e.segs || e.t)
    .map(e => ({
      start: (e.tStartMs ?? e.t ?? 0) / 1000,
      text: (e.segs || []).map(s => s.utf8 || '').join('').trim(),
    }))
    .filter(s => s.text);
}

/**
 * Parse timestamp string to seconds.
 * Accepts: "74", "1:14", "01:14", "1:01:14", "01:01:14"
 */
export function parseTimestamp(ts) {
  if (ts == null || ts === '') return 0;
  if (typeof ts === 'number') return ts;

  const str = String(ts).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);

  const parts = str.split(':').map(Number);
  if (parts.some(isNaN)) throw new Error(`Invalid timestamp: ${ts}`);

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0];
}

/**
 * Format seconds as [HH:MM:SS] or [MM:SS]
 */
export function formatTimestamp(seconds) {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `[${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
  }
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

/**
 * Filter segments by optional start/end range.
 */
export function filterByRange(segments, startTime, endTime) {
  const start = startTime ? parseTimestamp(startTime) : 0;
  const end = endTime ? parseTimestamp(endTime) : Infinity;

  return segments.filter(seg => seg.start >= start && seg.start <= end);
}

function defaultExecYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
    proc.on('error', err => reject(err));
  });
}