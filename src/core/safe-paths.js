import path from 'node:path';
import fs from 'node:fs';

const UNSAFE_CHARS = /[<>:"|?*\x00-\x1f]/g;
const MAX_FILENAME_LENGTH = 200;

/**
 * Sanitize a string for use as a filename component.
 */
export function sanitizeFilename(name) {
  if (!name || typeof name !== 'string') return 'untitled';
  let safe = name
    .replace(UNSAFE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
  if (!safe) safe = 'untitled';
  if (safe.length > MAX_FILENAME_LENGTH) {
    safe = safe.slice(0, MAX_FILENAME_LENGTH);
  }
  return safe;
}

/**
 * Resolve a path and ensure it stays within the allowed base directory.
 */
export function resolveWithinBase(baseDir, ...segments) {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(resolvedBase, ...segments);
  if (!resolved.startsWith(resolvedBase + path.sep) && resolved !== resolvedBase) {
    throw new Error(`Path escapes allowed directory: ${resolved}`);
  }
  return resolved;
}

/**
 * Generate a unique file path without overwriting existing files.
 */
export function uniqueFilePath(dir, baseName, ext = '.md') {
  const safeBase = sanitizeFilename(baseName);
  let candidate = path.join(dir, `${safeBase}${ext}`);
  if (!fs.existsSync(candidate)) return candidate;

  let counter = 1;
  while (counter < 10000) {
    candidate = path.join(dir, `${safeBase} (${counter})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    counter++;
  }
  throw new Error(`Could not generate unique filename for: ${baseName}`);
}

/**
 * Ensure a directory exists (creates if missing).
 */
export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}