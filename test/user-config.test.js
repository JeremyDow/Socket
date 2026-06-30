import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  loadUserConfig,
  saveUserDefaults,
  applyDefaultsToInput,
  getUserConfigPath,
  getLegacyConfigPath,
  migrateLegacyConfig,
  EMPTY_DEFAULTS,
} from '../src/core/user-config.js';

describe('user-config', () => {
  let fakeHome;
  let projectRoot;

  beforeEach(() => {
    fakeHome = mkdtempSync(path.join(tmpdir(), 'socket-home-'));
    projectRoot = mkdtempSync(path.join(tmpdir(), 'socket-project-'));
  });

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const ctx = () => ({ homeDir: fakeHome, projectRoot });

  it('loadUserConfig returns empty defaults when no config exists', () => {
    const result = loadUserConfig(ctx());
    assert.equal(result.exists, false);
    assert.equal(result.source, 'none');
    assert.deepEqual(result.defaults, EMPTY_DEFAULTS);
    assert.equal(result.path, getUserConfigPath(fakeHome));
  });

  it('saveUserDefaults writes to ~/.socket/config.json', () => {
    const saved = saveUserDefaults({
      destination: 'obsidian',
      obsidian: {
        vaultPath: '/tmp/my-vault',
        transcriptFolder: 'Socket/Transcripts/YouTube',
      },
    }, ctx());

    const configPath = getUserConfigPath(fakeHome);
    assert.equal(saved.path, configPath);
    assert.ok(fs.existsSync(configPath));
    assert.ok(configPath.startsWith(fakeHome));

    const loaded = loadUserConfig(ctx());
    assert.equal(loaded.exists, true);
    assert.equal(loaded.source, 'user');
    assert.equal(loaded.defaults.obsidian.vaultPath, '/tmp/my-vault');
    assert.equal(loaded.defaults.obsidian.transcriptFolder, 'Socket/Transcripts/YouTube');
  });

  it('applyDefaultsToInput preserves user override for a single run', () => {
    const defaults = {
      destination: 'obsidian',
      obsidian: {
        vaultPath: '/default/vault',
        transcriptFolder: 'Default/Folder',
      },
    };

    const withOverride = applyDefaultsToInput({
      url: 'https://youtu.be/test',
      vaultPath: '/override/vault',
      transcriptFolder: 'Override/Folder',
    }, defaults);

    assert.equal(withOverride.vaultPath, '/override/vault');
    assert.equal(withOverride.transcriptFolder, 'Override/Folder');

    const withDefaults = applyDefaultsToInput({
      url: 'https://youtu.be/test',
      vaultPath: '',
      transcriptFolder: '',
    }, defaults);

    assert.equal(withDefaults.vaultPath, '/default/vault');
    assert.equal(withDefaults.transcriptFolder, 'Default/Folder');
  });

  it('migrates legacy project-root socket.config.json to user config on load', () => {
    const legacyPath = getLegacyConfigPath(projectRoot);
    fs.writeFileSync(legacyPath, JSON.stringify({
      defaults: {
        destination: 'obsidian',
        obsidian: {
          vaultPath: '/legacy/vault',
          transcriptFolder: 'Legacy/Folder',
        },
      },
    }, null, 2));

    const loaded = loadUserConfig(ctx());
    assert.equal(loaded.source, 'user');
    assert.equal(loaded.defaults.obsidian.vaultPath, '/legacy/vault');
    assert.equal(loaded.migration?.migrated, true);
    assert.ok(fs.existsSync(getUserConfigPath(fakeHome)));
  });

  it('user config takes precedence over legacy project config', () => {
    saveUserDefaults({
      obsidian: {
        vaultPath: '/user/vault',
        transcriptFolder: 'User/Folder',
      },
    }, ctx());

    const legacyPath = getLegacyConfigPath(projectRoot);
    fs.writeFileSync(legacyPath, JSON.stringify({
      defaults: {
        obsidian: { vaultPath: '/legacy/vault', transcriptFolder: 'Legacy/Folder' },
      },
    }, null, 2));

    const loaded = loadUserConfig(ctx());
    assert.equal(loaded.defaults.obsidian.vaultPath, '/user/vault');
    assert.equal(loaded.source, 'user');
  });

  it('saveUserDefaults rejects missing required fields', () => {
    assert.throws(
      () => saveUserDefaults({ obsidian: { vaultPath: '', transcriptFolder: 'x' } }, ctx()),
      /vaultPath is required/
    );
  });

  it('does not write config to project root', () => {
    saveUserDefaults({
      obsidian: {
        vaultPath: '/vault',
        transcriptFolder: 'Folder',
      },
    }, ctx());

    const projectConfig = getLegacyConfigPath(projectRoot);
    assert.ok(!fs.existsSync(projectConfig));
    assert.ok(fs.existsSync(getUserConfigPath(fakeHome)));
  });

  it('migrateLegacyConfig is idempotent when user config already exists', () => {
    saveUserDefaults({
      obsidian: { vaultPath: '/user/vault', transcriptFolder: 'User/Folder' },
    }, ctx());

    const legacyPath = getLegacyConfigPath(projectRoot);
    fs.writeFileSync(legacyPath, JSON.stringify({
      defaults: {
        obsidian: { vaultPath: '/legacy/vault', transcriptFolder: 'Legacy/Folder' },
      },
    }, null, 2));

    const migration = migrateLegacyConfig(ctx());
    assert.equal(migration, null);

    const loaded = loadUserConfig(ctx());
    assert.equal(loaded.defaults.obsidian.vaultPath, '/user/vault');
  });
});