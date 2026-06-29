import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  sanitizeFilename,
  resolveWithinBase,
  uniqueFilePath,
} from '../src/core/safe-paths.js';

describe('safe-paths', () => {
  it('sanitizeFilename removes unsafe characters', () => {
    assert.equal(sanitizeFilename('Hello: World?'), 'Hello World');
    assert.equal(sanitizeFilename(''), 'untitled');
    assert.equal(sanitizeFilename('  '), 'untitled');
  });

  it('sanitizeFilename truncates long names', () => {
    const long = 'a'.repeat(300);
    assert.equal(sanitizeFilename(long).length, 200);
  });

  it('resolveWithinBase prevents path escape', () => {
    const base = '/tmp/vault';
    const resolved = resolveWithinBase(base, 'Transcripts', 'file.md');
    assert.equal(resolved, path.join(base, 'Transcripts', 'file.md'));
    assert.throws(() => resolveWithinBase(base, '..', 'etc', 'passwd'));
  });

  it('uniqueFilePath does not overwrite existing files', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'socket-test-'));
    try {
      const first = uniqueFilePath(dir, 'My Video', '.md');
      fs.writeFileSync(first, 'first');
      const second = uniqueFilePath(dir, 'My Video', '.md');
      assert.notEqual(first, second);
      assert.match(second, /My Video \(1\)\.md$/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});