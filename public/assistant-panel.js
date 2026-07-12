/**
 * Socket-native assistant panel UI (S5).
 * Renders Socket-owned conversations; never embeds a provider web chat.
 */

import { createConversationStore } from './assistant-store.js';

const store = createConversationStore();

export function initAssistantPanel() {
  const root = document.getElementById('assistant-root');
  if (!root) return;

  const toggleBtn = document.getElementById('assistant-toggle');
  const closeBtn = document.getElementById('assistant-close');
  const newBtn = document.getElementById('assistant-new');
  const listEl = document.getElementById('assistant-conversation-list');
  const messagesEl = document.getElementById('assistant-messages');
  const form = document.getElementById('assistant-form');
  const input = document.getElementById('assistant-input');
  const sendBtn = document.getElementById('assistant-send');
  const statusEl = document.getElementById('assistant-status');
  const workspace = document.querySelector('.app');

  if (!toggleBtn || !form || !input || !messagesEl || !listEl) return;

  store.createConversation();
  render();

  toggleBtn.addEventListener('click', () => {
    store.setPanelOpen(!store.isPanelOpen());
    render();
    if (store.isPanelOpen()) {
      input.focus();
    }
  });

  closeBtn?.addEventListener('click', () => {
    store.setPanelOpen(false);
    render();
    toggleBtn.focus();
  });

  newBtn?.addEventListener('click', () => {
    store.createConversation();
    store.setPanelOpen(true);
    render();
    input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const conversation = store.ensureActive();
    store.appendMessage(conversation.id, 'user', text);
    input.value = '';
    autoResize(input);
    setSending(true, 'Waiting for assistant…');
    render();

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: store.providerMessages(conversation.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Assistant request failed (${res.status})`);
      }
      const content = data.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Assistant returned an empty response');
      }
      store.appendMessage(conversation.id, 'assistant', content);
      setSending(false, '');
      render();
    } catch (err) {
      setSending(false, err.message || String(err), true);
      render();
    }
  });

  input.addEventListener('input', () => autoResize(input));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  function setSending(busy, message, isError = false) {
    sendBtn.disabled = busy;
    input.disabled = busy;
    if (!statusEl) return;
    if (!message) {
      statusEl.textContent = '';
      statusEl.className = 'assistant-status hidden';
      return;
    }
    statusEl.textContent = message;
    statusEl.className = isError ? 'assistant-status error' : 'assistant-status';
  }

  function render() {
    const open = store.isPanelOpen();
    root.classList.toggle('open', open);
    root.setAttribute('aria-hidden', open ? 'false' : 'true');
    // Closed panel must not remain in the keyboard tab order (S4.1 / a11y).
    // inert is the reliable control for that; CSS visibility is delayed for animation.
    if ('inert' in root) {
      root.inert = !open;
    }
    workspace?.classList.toggle('assistant-open', open);
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggleBtn.classList.toggle('active', open);

    const active = store.getActiveConversation();
    const conversations = store.listConversations();

    listEl.innerHTML = '';
    for (const conversation of conversations) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className =
        'assistant-conversation-item' +
        (conversation.id === active?.id ? ' active' : '');
      item.dataset.conversationId = conversation.id;
      item.textContent = conversation.title;
      item.title = conversation.title;
      item.addEventListener('click', () => {
        store.setActiveConversation(conversation.id);
        render();
        input.focus();
      });
      listEl.appendChild(item);
    }

    messagesEl.innerHTML = '';
    if (!active || active.messages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'assistant-empty';
      empty.textContent =
        'Start a conversation. Socket owns this thread; the provider only replies.';
      messagesEl.appendChild(empty);
    } else {
      for (const message of active.messages) {
        const bubble = document.createElement('div');
        bubble.className = `assistant-message ${message.role}`;
        const label = document.createElement('div');
        label.className = 'assistant-message-role';
        label.textContent = message.role === 'user' ? 'You' : 'Assistant';
        const body = document.createElement('div');
        body.className = 'assistant-message-body';
        body.textContent = message.content;
        bubble.appendChild(label);
        bubble.appendChild(body);
        messagesEl.appendChild(bubble);
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
}

// Allow non-module tests / optional manual bootstrap
if (typeof window !== 'undefined') {
  window.__socketAssistantStore = store;
}
