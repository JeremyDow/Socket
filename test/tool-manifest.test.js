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

  it('requires url for enabled external-app tools', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'pylon', type: 'external-app', enabled: true },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /url is required when external-app is enabled/);
  });

  it('rejects malformed external-app urls', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'pylon', type: 'external-app', enabled: true, url: 'not-a-url' },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /malformed/);
  });

  it('rejects non-http external-app urls', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'pylon', type: 'external-app', enabled: true, url: 'file:///tmp/pylon' },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /must use http: or https:/);
  });

  it('rejects credentials in external-app urls', () => {
    const result = validateToolManifest({
      tools: [
        {
          id: 'pylon',
          type: 'external-app',
          enabled: true,
          url: 'http://user:secret@127.0.0.1:4780',
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /must not include credentials/);
  });

  it('rejects url on native-tool entries', () => {
    const result = validateToolManifest({
      tools: [
        {
          id: 'youtube',
          type: 'native-tool',
          enabled: true,
          url: 'http://127.0.0.1:4780',
        },
      ],
    });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('; '), /must not be set on native-tool/);
  });

  it('allows disabled external-app entries without url', () => {
    const result = validateToolManifest({
      tools: [
        { id: 'oracle', type: 'external-app', enabled: false },
      ],
    });
    assert.equal(result.ok, true);
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

  it('normalizeToolEntry includes url for enabled external-app tools', () => {
    const pylon = normalizeToolEntry({
      id: 'pylon',
      label: 'Pylon',
      type: 'external-app',
      enabled: true,
      url: 'http://127.0.0.1:4780',
    });
    assert.equal(pylon.selectable, true);
    assert.equal(pylon.url, 'http://127.0.0.1:4780');
    assert.equal(pylon.unavailableReason, null);
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

  it('loadToolManifest accepts the repository default manifest', () => {
    const loaded = loadToolManifest();
    assert.equal(loaded.ok, true);
    const pylon = loaded.tools.find((tool) => tool.id === 'pylon');
    assert.equal(pylon.url, 'http://127.0.0.1:4780');
    assert.equal(pylon.selectable, true);
  });
});