import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const TOOL_TYPES = new Set(['native-tool', 'external-app']);

const DEFAULT_LABELS = {
  youtube: 'YouTube',
  transcriber: 'Transcriber',
  markdown: 'Markdown',
  obsidian: 'Obsidian',
  browser: 'Browser',
  oracle: 'Oracle',
};

const UNAVAILABLE_REASONS = {
  disabled: 'This tool is disabled in the manifest.',
  'external-app': 'External application — connect through a governed adapter.',
  browser: 'Browser tool is not implemented yet.',
  oracle: 'Oracle is a separate application and remains disabled.',
};

export function defaultToolManifestPath(projectRoot = config.projectRoot) {
  return path.join(projectRoot, 'config', 'tools.json');
}

export function validateToolManifest(raw) {
  const errors = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  if (!Array.isArray(raw.tools)) {
    return { ok: false, errors: ['tools must be an array'] };
  }

  if (raw.tools.length === 0) {
    return { ok: false, errors: ['tools must not be empty'] };
  }

  const seen = new Set();

  for (const [index, tool] of raw.tools.entries()) {
    const prefix = `tools[${index}]`;

    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) {
      errors.push(`${prefix} must be an object`);
      continue;
    }

    if (typeof tool.id !== 'string' || !tool.id.trim()) {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (seen.has(tool.id)) {
      errors.push(`${prefix}.id duplicates earlier tool: ${tool.id}`);
    } else {
      seen.add(tool.id);
    }

    if (typeof tool.type !== 'string' || !TOOL_TYPES.has(tool.type)) {
      errors.push(`${prefix}.type must be native-tool or external-app`);
    }

    if (typeof tool.enabled !== 'boolean') {
      errors.push(`${prefix}.enabled must be a boolean`);
    }

    if (tool.label != null && (typeof tool.label !== 'string' || !tool.label.trim())) {
      errors.push(`${prefix}.label must be a non-empty string when provided`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, tools: raw.tools };
}

export function normalizeToolEntry(tool) {
  const label = (tool.label && tool.label.trim())
    || DEFAULT_LABELS[tool.id]
    || tool.id;

  const selectable = tool.enabled === true;
  let unavailableReason = null;

  if (!selectable) {
    unavailableReason = tool.id === 'oracle'
      ? UNAVAILABLE_REASONS.oracle
      : tool.id === 'browser'
        ? UNAVAILABLE_REASONS.browser
        : tool.type === 'external-app'
          ? UNAVAILABLE_REASONS['external-app']
          : UNAVAILABLE_REASONS.disabled;
  }

  return {
    id: tool.id,
    label,
    type: tool.type,
    enabled: tool.enabled,
    selectable,
    unavailableReason,
  };
}

export function loadToolManifest(manifestPath = defaultToolManifestPath()) {
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, errors: [`manifest not found: ${manifestPath}`] };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return { ok: false, errors: [`invalid JSON: ${err.message}`] };
  }

  const validated = validateToolManifest(parsed);
  if (!validated.ok) return validated;

  return {
    ok: true,
    path: manifestPath,
    tools: validated.tools.map(normalizeToolEntry),
  };
}