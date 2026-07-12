/**
 * Socket-owned in-session conversation store (S5).
 *
 * Conversations belong to Socket. The provider only supplies assistant text.
 * State is in-memory for the current browser session; page reload loses it.
 */

export function createConversationStore(options = {}) {
  const idFactory = options.idFactory || defaultId;
  const now = options.now || (() => Date.now());

  /** @type {Map<string, object>} */
  const conversations = new Map();
  let activeConversationId = null;
  let panelOpen = false;
  let seq = 0;

  function defaultId(prefix) {
    seq += 1;
    return `${prefix}-${now().toString(36)}-${seq.toString(36)}`;
  }

  function ensureActive() {
    if (activeConversationId && conversations.has(activeConversationId)) {
      return conversations.get(activeConversationId);
    }
    return createConversation();
  }

  function createConversation(title) {
    const id = idFactory('conv');
    const createdAt = now();
    const conversation = {
      id,
      title: title || `Conversation ${conversations.size + 1}`,
      messages: [],
      createdAt,
      updatedAt: createdAt,
    };
    conversations.set(id, conversation);
    activeConversationId = id;
    return conversation;
  }

  function listConversations() {
    return Array.from(conversations.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function getConversation(id) {
    return conversations.get(id) || null;
  }

  function getActiveConversation() {
    if (!activeConversationId) return null;
    return conversations.get(activeConversationId) || null;
  }

  function setActiveConversation(id) {
    if (!conversations.has(id)) {
      throw new Error(`Unknown conversation: ${id}`);
    }
    activeConversationId = id;
    return conversations.get(id);
  }

  function appendMessage(conversationId, role, content) {
    const conversation = conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Unknown conversation: ${conversationId}`);
    }
    const trimmed = typeof content === 'string' ? content.trim() : '';
    if (!trimmed) {
      throw new Error('Message content is required');
    }
    if (role !== 'user' && role !== 'assistant') {
      throw new Error('Message role must be user or assistant');
    }

    const message = {
      id: idFactory('msg'),
      role,
      content: trimmed,
      createdAt: now(),
    };
    conversation.messages.push(message);
    conversation.updatedAt = message.createdAt;

    if (
      role === 'user' &&
      conversation.messages.filter((m) => m.role === 'user').length === 1 &&
      conversation.title.startsWith('Conversation ')
    ) {
      conversation.title = titleFromUserMessage(trimmed);
    }

    return message;
  }

  function providerMessages(conversationId) {
    const conversation = conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Unknown conversation: ${conversationId}`);
    }
    return conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  function setPanelOpen(open) {
    panelOpen = Boolean(open);
    return panelOpen;
  }

  function isPanelOpen() {
    return panelOpen;
  }

  function snapshot() {
    return {
      panelOpen,
      activeConversationId,
      conversations: listConversations().map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messages: c.messages.map((m) => ({ ...m })),
      })),
    };
  }

  return {
    createConversation,
    ensureActive,
    listConversations,
    getConversation,
    getActiveConversation,
    setActiveConversation,
    appendMessage,
    providerMessages,
    setPanelOpen,
    isPanelOpen,
    snapshot,
  };
}

function titleFromUserMessage(text) {
  const single = text.replace(/\s+/g, ' ').trim();
  if (single.length <= 42) return single;
  return `${single.slice(0, 39)}…`;
}
