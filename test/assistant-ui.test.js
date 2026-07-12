import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('S5 assistant workspace UI shell', () => {
  it('exposes a Socket-native assistant panel (not an iframe provider chat)', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    assert.match(html, /id="assistant-root"/);
    assert.match(html, /id="assistant-toggle"/);
    assert.match(html, /id="assistant-conversation-list"/);
    assert.match(html, /id="assistant-messages"/);
    assert.match(html, /id="assistant-form"/);
    assert.match(html, /id="assistant-input"/);
    assert.match(html, /assistant-panel\.js/);
    assert.doesNotMatch(html, /iframe[^>]+assistant/i);
    assert.doesNotMatch(html, /chat\.openai|claude\.ai|grok\.x\.ai|chatgpt/i);
  });

  it('wires a server completion route without conversation persistence APIs', () => {
    const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    assert.match(serverSrc, /\/api\/assistant\/chat/);
    assert.match(serverSrc, /completeWithXai/);
    assert.doesNotMatch(serverSrc, /\/api\/assistant\/conversations/);
    assert.doesNotMatch(serverSrc, /long-term memory|pinned conversation/i);
  });

  it('keeps conversation ownership in the Socket client store', () => {
    const storeSrc = fs.readFileSync(path.join(ROOT, 'public/assistant-store.js'), 'utf8');
    const panelSrc = fs.readFileSync(path.join(ROOT, 'public/assistant-panel.js'), 'utf8');
    assert.match(storeSrc, /createConversationStore/);
    assert.match(storeSrc, /appendMessage/);
    assert.match(storeSrc, /setActiveConversation/);
    assert.match(panelSrc, /createConversationStore/);
    assert.match(panelSrc, /\/api\/assistant\/chat/);
    assert.doesNotMatch(panelSrc, /iframe/);
  });

  it('closes the panel out of the keyboard tab order (visibility + inert)', () => {
    const css = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8');
    const panelSrc = fs.readFileSync(path.join(ROOT, 'public/assistant-panel.js'), 'utf8');

    assert.match(css, /\.assistant-panel\[aria-hidden="true"\]\s*\{[^}]*visibility:\s*hidden/s);
    assert.match(css, /visibility\s+0s\s+linear\s+0\.28s/);
    assert.match(panelSrc, /root\.inert\s*=\s*!open/);
  });
});
