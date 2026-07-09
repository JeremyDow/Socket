import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('tool tabs accessibility', () => {
  it('index.html exposes tabpanel ids and hidden inactive surfaces', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const toolIds = ['youtube', 'transcriber', 'markdown', 'obsidian', 'browser', 'oracle'];

    assert.match(html, /id="tool-tabs"[^>]*role="tablist"/);
    for (const toolId of toolIds) {
      assert.match(html, new RegExp(`id="panel-${toolId}"`));
      assert.match(html, new RegExp(`data-tool-surface="${toolId}"[^>]*role="tabpanel"`));
    }
    assert.match(html, /id="panel-transcriber"[^>]*hidden/);
  });

  it('app.js wires aria-controls, roving tabindex, and keyboard navigation', () => {
    const appSrc = fs.readFileSync(path.join(ROOT, 'public/app.js'), 'utf8');

    assert.match(appSrc, /aria-controls/);
    assert.match(appSrc, /setAttribute\('tabindex'/);
    assert.match(appSrc, /handleToolTabKeydown/);
    assert.match(appSrc, /ArrowLeft/);
    assert.match(appSrc, /ArrowRight/);
    assert.match(appSrc, /surface\.hidden = !active/);
    assert.match(appSrc, /renderExternalAppPanels/);
    assert.match(appSrc, /role', 'tabpanel'/);
  });

  it('styles expose a visible focus state for tabs', () => {
    const css = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
    assert.match(css, /\.tool-tab:focus-visible/);
  });
});