import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config } from './config.js';

const USER_CONFIG_DIR = '.socket';
const USER_CONFIG_FILENAME = 'config.json';
const LEGACY_CONFIG_FILENAME = 'socket.config.json';

export const EMPTY_DEFAULTS = {
  destination: 'obsidian',
  obsidian: {
    vaultPath: '',
    transcriptFolder: '',
  },
};

function resolveHome(homeDir) {
  return path.resolve(homeDir ?? process.env.HOME ?? os.homedir());
}

function resolveProjectRoot(projectRoot) {
  return path.resolve(projectRoot ?? config.projectRoot);
}

/**
 * Per-user config directory: ~/.socket
 */
export function getUserConfigDir(homeDir) {
  return path.join(resolveHome(homeDir), USER_CONFIG_DIR);
}

/**
 * Per-user config file: ~/.socket/config.json
 */
export function getUserConfigPath(homeDir) {
  return path.join(getUserConfigDir(homeDir), USER_CONFIG_FILENAME);
}

/**
 * Legacy project-root config (S2.1) — read-only fallback, never written.
 */
export function getLegacyConfigPath(projectRoot) {
  return path.join(resolveProjectRoot(projectRoot), LEGACY_CONFIG_FILENAME);
}

export function ensureUserConfigDir(homeDir) {
  const dir = getUserConfigDir(homeDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function normalizeDefaults(raw = {}) {
  return {
    destination: raw.destination || EMPTY_DEFAULTS.destination,
    obsidian: {
      vaultPath: String(raw.obsidian?.vaultPath ?? '').trim(),
      transcriptFolder: String(raw.obsidian?.transcriptFolder ?? '').trim(),
    },
  };
}

function readConfigFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return normalizeDefaults(raw.defaults);
}

function hasUsableDefaults(defaults) {
  return Boolean(defaults.obsidian.vaultPath && defaults.obsidian.transcriptFolder);
}

/**
 * Migrate legacy project-root socket.config.json to ~/.socket/config.json.
 * Returns migration metadata when a migration occurs.
 */
export function migrateLegacyConfig({ homeDir, projectRoot } = {}) {
  const userPath = getUserConfigPath(homeDir);
  const legacyPath = getLegacyConfigPath(projectRoot);

  if (fs.existsSync(userPath) || !fs.existsSync(legacyPath)) {
    return null;
  }

  const defaults = readConfigFile(legacyPath);
  if (!hasUsableDefaults(defaults)) {
    return {
      migrated: false,
      warning: `Legacy config found at ${legacyPath} but contains no usable defaults`,
      legacyPath,
    };
  }

  ensureUserConfigDir(homeDir);
  fs.writeFileSync(userPath, JSON.stringify({ defaults }, null, 2) + '\n', 'utf8');

  return {
    migrated: true,
    from: legacyPath,
    to: userPath,
    message: 'Defaults migrated from project socket.config.json to ~/.socket/config.json',
  };
}

/**
 * Load user defaults.
 * Precedence: ~/.socket/config.json → legacy project socket.config.json (with migration).
 */
export function loadUserConfig({ homeDir, projectRoot } = {}) {
  const userPath = getUserConfigPath(homeDir);

  if (fs.existsSync(userPath)) {
    return {
      defaults: readConfigFile(userPath),
      exists: true,
      path: userPath,
      source: 'user',
    };
  }

  const migration = migrateLegacyConfig({ homeDir, projectRoot });
  if (migration?.migrated && fs.existsSync(userPath)) {
    return {
      defaults: readConfigFile(userPath),
      exists: true,
      path: userPath,
      source: 'user',
      migration,
    };
  }

  const legacyPath = getLegacyConfigPath(projectRoot);
  if (fs.existsSync(legacyPath)) {
    const defaults = readConfigFile(legacyPath);
    if (hasUsableDefaults(defaults)) {
      return {
        defaults,
        exists: true,
        path: legacyPath,
        source: 'legacy',
        migration: migration ?? {
          migrated: false,
          warning: 'Using legacy project socket.config.json — save defaults to migrate to ~/.socket/config.json',
          legacyPath,
        },
      };
    }
  }

  return {
    defaults: normalizeDefaults(),
    exists: false,
    path: userPath,
    source: 'none',
    migration: migration ?? null,
  };
}

/**
 * Save destination defaults to ~/.socket/config.json.
 */
export function saveUserDefaults(input, { homeDir } = {}) {
  const defaults = normalizeDefaults(input);

  if (!defaults.obsidian.vaultPath) {
    throw new Error('vaultPath is required to save defaults');
  }
  if (!defaults.obsidian.transcriptFolder) {
    throw new Error('transcriptFolder is required to save defaults');
  }

  ensureUserConfigDir(homeDir);
  const configPath = getUserConfigPath(homeDir);
  const payload = { defaults };
  fs.writeFileSync(configPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  return { defaults, path: configPath };
}

/**
 * Apply saved defaults to workflow input only when fields are omitted.
 * Submitted form values always take precedence for a single run.
 */
export function applyDefaultsToInput(input, defaults) {
  const normalized = normalizeDefaults(defaults);
  return {
    ...input,
    vaultPath: input.vaultPath?.trim() || normalized.obsidian.vaultPath,
    transcriptFolder: input.transcriptFolder?.trim() || normalized.obsidian.transcriptFolder,
  };
}