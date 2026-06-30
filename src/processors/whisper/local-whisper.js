import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createArtifact } from '../../core/artifact.js';

/**
 * Local Whisper Transcription Processor
 *
 * Uses the openai-whisper CLI (whisper command) for local transcription.
 * Diarization is NOT implemented — segments are returned without speaker separation.
 */

export const localWhisperProcessor = {
  id: 'local_whisper',
  name: 'Local Whisper',
  role: 'processor',

  /**
   * @param {object} audioArtifact - youtube.audio artifact
   * @param {object} [params]
   * @param {function} [params._execWhisper] - injectable for tests
   * @param {function} [params._checkWhisper] - injectable availability check
   */
  async transcribe(audioArtifact, params = {}) {
    const { _execWhisper, _checkWhisper } = params;
    const checkWhisper = _checkWhisper ?? defaultCheckWhisper;
    const execWhisper = _execWhisper ?? defaultExecWhisper;

    const { audioPath, rangeOffset = 0 } = audioArtifact.data;
    if (!audioPath) throw new Error('Audio artifact must contain audioPath');

    const available = await checkWhisper();
    if (!available) {
      throw new Error(
        'Audio transcription fallback unavailable: whisper CLI not installed. ' +
        'Install openai-whisper: pip install openai-whisper'
      );
    }

    const workDir = audioArtifact.meta?.workDir;
    const outputDir = workDir
      ? join(workDir, 'whisper-out')
      : join(audioPath, '..', 'whisper-out');
    mkdirSync(outputDir, { recursive: true });

    try {
      await execWhisper([
        audioPath,
        '--model', 'base',
        '--output_format', 'json',
        '--output_dir', outputDir,
        '--verbose', 'False',
      ]);

      const jsonFile = findWhisperJson(outputDir, audioPath);
      const raw = JSON.parse(readFileSync(jsonFile, 'utf8'));
      const segments = applyTimestampOffset(parseWhisperSegments(raw), rangeOffset);

      return createArtifact('transcript.segments', {
        segments,
        transcriptSource: 'audio_transcription',
        transcriptionProvider: 'local_whisper',
        diarization: false,
      }, {
        processor: 'local_whisper',
        transcribedAt: new Date().toISOString(),
      });
    } finally {
      try {
        rmSync(outputDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  },
};

export function parseWhisperSegments(whisperJson) {
  const segments = whisperJson.segments || [];
  return segments
    .map(seg => ({
      start: seg.start ?? 0,
      text: (seg.text || '').trim(),
    }))
    .filter(seg => seg.text);
}

export function applyTimestampOffset(segments, offset) {
  if (!offset) return segments;
  return segments.map(seg => ({
    ...seg,
    start: seg.start + offset,
  }));
}

function findWhisperJson(outputDir, audioPath) {
  const baseName = basename(audioPath).replace(/\.[^.]+$/, '');
  const candidates = readdirSync(outputDir).filter(f => f.endsWith('.json'));
  const match = candidates.find(f => f.startsWith(baseName)) || candidates[0];
  if (!match) throw new Error('Whisper produced no JSON output');
  return join(outputDir, match);
}

async function defaultCheckWhisper() {
  try {
    await defaultExecWhisper(['--help']);
    return true;
  } catch {
    return false;
  }
}

function defaultExecWhisper(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('whisper', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `whisper exited with code ${code}`));
    });
    proc.on('error', err => reject(err));
  });
}