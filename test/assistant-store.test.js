import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createConversationStore } from '../public/assistant-store.js';

describe('Socket-owned assistant conversation store (S5)', () => {
  it('creates independent conversations and preserves messages when switching', () => {
    let t = 1000;
    let n = 0;
    const store = createConversationStore({
      now: () => ++t,
      idFactory: (prefix) => `${prefix}-${++n}`,
    });

    const first = store.createConversation();
    store.appendMessage(first.id, 'user', 'Hello from first');
    store.appendMessage(first.id, 'assistant', 'Reply in first');

    const second = store.createConversation();
    store.appendMessage(second.id, 'user', 'Hello from second');

    assert.equal(store.listConversations().length, 2);
    assert.equal(store.getActiveConversation().id, second.id);
    assert.equal(store.getConversation(first.id).messages.length, 2);

    store.setActiveConversation(first.id);
    const restored = store.getActiveConversation();
    assert.equal(restored.id, first.id);
    assert.equal(restored.messages[0].content, 'Hello from first');
    assert.equal(restored.messages[1].content, 'Reply in first');
    assert.equal(store.getConversation(second.id).messages.length, 1);
  });

  it('owns panel open state independently of conversations', () => {
    const store = createConversationStore();
    store.createConversation();
    assert.equal(store.isPanelOpen(), false);
    store.setPanelOpen(true);
    assert.equal(store.isPanelOpen(), true);
    store.setPanelOpen(false);
    assert.equal(store.isPanelOpen(), false);
    assert.equal(store.listConversations().length, 1);
  });

  it('titles the conversation from the first user message', () => {
    const store = createConversationStore();
    const conv = store.createConversation();
    store.appendMessage(conv.id, 'user', 'Summarize the transcript workflow');
    assert.equal(store.getConversation(conv.id).title, 'Summarize the transcript workflow');
  });

  it('exports provider-facing messages without Socket ids', () => {
    const store = createConversationStore();
    const conv = store.createConversation();
    store.appendMessage(conv.id, 'user', 'Ping');
    store.appendMessage(conv.id, 'assistant', 'Pong');
    assert.deepEqual(store.providerMessages(conv.id), [
      { role: 'user', content: 'Ping' },
      { role: 'assistant', content: 'Pong' },
    ]);
  });
});
