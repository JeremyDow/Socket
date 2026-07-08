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

  it('sanitizeFilename cleans awkward punctuation while preserving readable titles', () => {
    assert.equal(
      sanitizeFilename('Why This Works — Part 1: "Deep Dive" | Q&A'),
      'Why This Works - Part 1 Deep Dive Q&A'
    );
    assert.equal(sanitizeFilename('Episode #42...'), 'Episode 42');
  });

  it('sanitizeFilename preserves meaningful internal ampersands', () => {
    assert.equal(sanitizeFilename('Q&A Session'), 'Q&A Session');
    assert.equal(sanitizeFilename('R&D Notes'), 'R&D Notes');
    assert.equal(sanitizeFilename('AT&T Interview'), 'AT&T Interview');
  });

  it('sanitizeFilename removes isolated or awkward ampersands', () => {
    assert.equal(sanitizeFilename('Brand & Identity'), 'Brand Identity');
    assert.equal(sanitizeFilename('& Leading Topic'), 'Leading Topic');
    assert.equal(sanitizeFilename('Trailing &'), 'Trailing');
    assert.equal(sanitizeFilename('foo && bar'), 'foo bar');
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