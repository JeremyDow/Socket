import { execSync } from 'node:child_process';
import { getYtDlpDiagnostics } from '../dropins/youtube/youtube-source.js';

function resolveBinary(cmd) {
  try {
    const resolved = execSync(`which ${cmd}`, { encoding: 'utf8' }).trim();
    return resolved ? { available: true, path: resolved } : { available: false, path: null };
  } catch {
    return { available: false, path: null };
  }
}

export function getRuntimeDiagnostics(_which = resolveBinary) {
  const ytDlp = getYtDlpDiagnostics();
  const ffmpeg = _which('ffmpeg');
  const whisper = _which('whisper');

  return {
    ytDlp: ytDlp.ytDlp,
    ffmpeg,
    whisper,
    platform: process.platform,
  };
}