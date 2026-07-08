import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  validateToolManifest,
  normalizeToolEntry,
  loadToolManifest,
} from '../src/core/tool-manifest.js';

describe('tool-manifest', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'socket-manifest-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('validateToolManifest accepts the default Socket manifest shape', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'youtube', label: 'YouTube', type: 'native-tool', enabled: true },
        { id: 'oracle', label: 'Oracle', type: 'external-app', enabled: false },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.tools.length, 2);
  });

  it('validateToolManifest rejects invalid entries', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'youtube', type: 'native-tool', enabled: true },
        { id: 'youtube', type: 'native-tool', enabled: true },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /duplicates earlier tool/);
  });

  it('normalizeToolEntry marks disabled tools unavailable', () => {
    const oracle = normalizeToolEntry({
      id: 'oracle',
      type: 'external-app',
      enabled: false,
    });
    assert.equal(oracle.selectable, false);
    assert.match(oracle.unavailableReason, /separate application/i);

    const browser = normalizeToolEntry({
      id: 'browser',
      type: 'native-tool',
      enabled: false,
    });
    assert.equal(browser.selectable, false);
    assert.match(browser.unavailableReason, /not implemented/i);
  });

  it('loadToolManifest reads and normalizes config/tools.json', () => {
    const manifestPath = path.join(tempDir, 'tools.json');
    writeFileSync(manifestPath, JSON.stringify({
      tools: [
        { id: 'markdown', type: 'native-tool', enabled: true },
      ],
    }), 'utf8');

    const loaded = loadToolManifest(manifestPath);
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.tools[0], {
      id: 'markdown',
      label: 'Markdown',
      type: 'native-tool',
      enabled: true,
      selectable: true,
      unavailableReason: null,
    });
  });
});