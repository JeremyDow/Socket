import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('tool tabs validation correction', () => {
  it('submit handler validates before starting the transcript workflow', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    const submitBlock = appSrc.slice(appSrc.indexOf("form.addEventListener('submit'"));

    assert.match(appSrc, /function validateTranscriptForm\(/);
    assert.match(submitBlock, /if \(!validateTranscriptForm\(\)\)/);
    assert.match(submitBlock, /validateTranscriptForm\(\)[\s\S]*fetch\('\/api\/workflows\/transcript'/);
    assert.match(appSrc, /setActiveTool\(toolId\)/);
    assert.match(appSrc, /firstInvalid\.reportValidity\(\)/);
    assert.match(appSrc, /obsidian-validation/);
  });

  it('GET /api/tools does not expose manifestPath', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const toolsRoute = serverSrc.slice(
      serverSrc.indexOf("url.pathname === '/api/tools'"),
      serverSrc.indexOf("url.pathname === '/api/health'"),
    );

    assert.doesNotMatch(toolsRoute, /manifestPath/);
    assert.match(toolsRoute, /tools: manifest\.tools/);
  });

  it('index.html exposes inline Obsidian validation affordance', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    assert.match(html, /id="obsidian-validation"/);
    assert.match(html, /id="vaultPath"[^>]*required/);
    assert.match(html, /id="transcriptFolder"[^>]*required/);
  });
});