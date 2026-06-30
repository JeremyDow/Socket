import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createArtifact } from '../../core/artifact.js';
import { config } from '../../core/config.js';

export const AUDIO_FORMAT_SELECTOR = 'bestaudio/best';

/**
 * YouTube Source Drop-in
 *
 * Fetches captions/subtitles via yt-dlp when available.
 * Falls back to audio extraction when captions are unavailable.
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
   * @param {function} [params.onProgress] - progress callback (stage, message)
   */
  async fetch(params) {
    const { url, startTime, endTime, _execYtDlp, onProgress } = params;
    if (!url) throw new Error('YouTube URL is required');

    const execYtDlp = _execYtDlp ?? defaultExecYtDlp;

    try {
      await execYtDlp(['--version']);
    } catch {
      throw new Error(
        'yt-dlp is not installed or not on PATH. Install it: https://github.com/yt-dlp/yt-dlp#installation'
      );
    }

    onProgress?.('resolving_video', 'Resolving video metadata');
    const info = await fetchVideoInfo(url, execYtDlp);

    onProgress?.('resolving_video', 'Checking for captions');
    const captions = await fetchCaptions(url, execYtDlp);

    if (captions?.raw) {
      const segments = parseVttOrJsonCaptions(captions);
      const filtered = filterByRange(segments, startTime, endTime);

      return createArtifact('youtube.transcript', {
        url,
        videoId: info.id,
        title: info.title,
        segments: filtered,
        captionFormat: captions.format,
        transcriptSource: 'captions',
      }, {
        source: 'youtube',
        fetchedAt: new Date().toISOString(),
      });
    }

    onProgress?.('extracting_audio', 'No captions found, extracting audio');
    const audio = await extractAudio(url, { startTime, endTime, execYtDlp });

    return createArtifact('youtube.audio', {
      url,
      videoId: info.id,
      title: info.title,
      audioPath: audio.path,
      rangeOffset: audio.rangeOffset,
      transcriptSource: 'audio_pending',
    }, {
      source: 'youtube',
      workDir: audio.workDir,
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
  const tmpDir = mkdtempSync(join(tmpdir(), 'socket-ytdlp-subs-'));
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
  } catch {
    return null;
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Build yt-dlp args for audio extraction fallback.
 */
export function buildAudioExtractionArgs(url, { startTime, endTime, outputPath }) {
  const args = [
    '-f', AUDIO_FORMAT_SELECTOR,
    '-x',
    '--audio-format', 'mp3',
    '--no-warnings',
    '-o', outputPath,
  ];

  const section = buildDownloadSection(startTime, endTime);
  if (section) {
    args.push('--download-sections', section);
  }

  args.push(url);
  return args;
}

/**
 * Resolve yt-dlp binary from PATH.
 */
export function resolveYtDlpPath(_which = defaultWhich) {
  try {
    const resolved = _which('yt-dlp');
    return resolved || null;
  } catch {
    return null;
  }
}

export function getYtDlpDiagnostics(_which = defaultWhich) {
  const ytDlpPath = resolveYtDlpPath(_which);
  let ffmpegPath = null;
  try {
    ffmpegPath = _which('ffmpeg');
  } catch {
    // ffmpeg optional for diagnostics display
  }

  return {
    ytDlp: ytDlpPath
      ? { available: true, path: ytDlpPath }
      : { available: false, path: null },
    ffmpeg: ffmpegPath
      ? { available: true, path: ffmpegPath }
      : { available: false, path: null },
  };
}

function defaultWhich(cmd) {
  return execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
}

/**
 * Extract audio via yt-dlp. Writes to config.tmpDir only.
 */
export async function extractAudio(url, { startTime, endTime, execYtDlp }) {
  const workDir = mkdtempSync(join(config.tmpDir, 'socket-audio-'));
  const rangeOffset = startTime ? parseTimestamp(startTime) : 0;

  const args = buildAudioExtractionArgs(url, {
    startTime,
    endTime,
    outputPath: join(workDir, 'audio.%(ext)s'),
  });

  await execYtDlp(args);

  const files = readdirSync(workDir).filter(f =>
    /\.(wav|mp3|m4a|opus|ogg|webm)$/i.test(f)
  );
  if (files.length === 0) {
    rmSync(workDir, { recursive: true, force: true });
    throw new Error('Audio extraction failed: no audio file produced');
  }

  return {
    path: join(workDir, files[0]),
    workDir,
    rangeOffset,
  };
}

export function buildDownloadSection(startTime, endTime) {
  if (!startTime && !endTime) return null;

  const start = startTime ? formatSectionTime(startTime) : '0:00';
  const end = endTime ? formatSectionTime(endTime) : 'inf';
  return `*${start}-${end}`;
}

function formatSectionTime(ts) {
  const seconds = parseTimestamp(ts);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
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
  const binary = resolveYtDlpPath() || 'yt-dlp';
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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