import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('tool tabs UI shell', () => {
  it('index.html exposes manifest-driven tab surfaces for each tool', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const requiredSurfaces = ['youtube', 'transcriber', 'markdown', 'obsidian', 'browser', 'oracle'];

    assert.match(html, /id="tool-tabs"/);
    assert.match(html, /id="active-tool-status"/);
    for (const toolId of requiredSurfaces) {
      assert.match(html, new RegExp(`data-tool-surface="${toolId}"`));
    }
    assert.match(html, /id="transcript-form"/);
    assert.doesNotMatch(html, /oracle.*submit/i);
  });

  it('app.js loads the manifest and manages active tool state', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');
    assert.match(appSrc, /\/api\/tools/);
    assert.match(appSrc, /renderToolTabs/);
    assert.match(appSrc, /setActiveTool/);
    assert.match(appSrc, /activeToolId/);
    assert.match(appSrc, /tool\.selectable/);
    assert.match(appSrc, /unavailableReason/);
  });

  it('server exposes a read-only tools endpoint', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    const toolsRoute = serverSrc.slice(
      serverSrc.indexOf("url.pathname === '/api/tools'"),
      serverSrc.indexOf("url.pathname === '/api/health'"),
    );

    assert.match(serverSrc, /\/api\/tools/);
    assert.match(serverSrc, /loadToolManifest/);
    assert.doesNotMatch(toolsRoute, /manifestPath/);
    assert.doesNotMatch(serverSrc, /oracle.*workflow/i);
  });
});