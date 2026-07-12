# Socket S5 — Assistant Workspace Cornerstone

## Purpose

Build the first version of the Socket Assistant Workspace.

This milestone establishes the first inhabitable interior of Socket: a native
assistant side panel where the operator can hold multiple independent
conversations while continuing to work inside Socket.

**Socket is the workspace.**

Oracle, Pylon, and future departments are tools and institutions that live
inside Socket. They are not Socket itself.

The assistant is also a participant inside Socket. It should feel like part of
the workspace, not like an external website embedded into the page.

---

## Long-Term Architectural Intent

Record these goals so they are not forgotten or displaced by short-term
implementation work.

**These are architectural intentions, not S5 implementation requirements.**

Potential future capabilities include:

- a permanent AI side panel that becomes a natural part of the Socket workspace
- multiple independent conversations
- conversations that belong to Socket rather than any specific AI provider
- multiple AI providers participating within the same workspace
- user-approved contextual awareness across tools
- Oracle integration
- Pylon integration
- workspace search
- conversation retrieval and relevance
- pinned conversations
- long-term memory
- shared research instruments
- future research departments, including potentially physics, mathematics,
  engineering, economics, and others as the campus grows

Preserve these directions unless there is a deliberate architectural decision
to change them.

Do **not** implement these future capabilities in S5 unless explicitly required
by the S5 scope below.

---

## S5 Scope

Build the first usable Socket-owned assistant workspace.

Implement a right-side slide-out assistant panel that:

- opens and closes smoothly
- lives beside the active Socket tool
- can remain available while the operator continues working in another Socket tool
- supports multiple independent conversations
- allows the operator to create a new conversation
- allows the operator to switch between conversations
- allows the operator to send a message in a conversation
- returns a response from a real AI provider
- preserves conversations during the current Socket session
- feels native to Socket rather than like an embedded provider website

For S5, a single directly integrated provider is acceptable.

Provider abstraction is **not** required.

A hardcoded provider path is acceptable if it keeps the implementation small.

However, the conversation record must belong to Socket.

At minimum, Socket should own the in-session conversation structure:
conversation IDs, titles or labels if present, message lists, active
conversation selection, and panel state.

The provider may generate assistant responses, but the provider must not own
the workspace or the conversation UI.

### S5 implementation notes (this build)

- Conversation state lives in Socket client memory for the running browser
  session (panel close/reopen and tool switching preserve it).
- Conversations may be lost when Socket restarts or the page is reloaded.
- Provider path: xAI Chat Completions (`XAI_API_KEY`, model `grok-4.5`) via
  `POST /api/assistant/chat`. Hardcoded; not an abstraction layer.
- UI is Socket-native components only — no iframe / embedded provider chat.

---

## Explicit Non-Scope

S5 does not require:

- persistent storage across Socket restarts
- long-term memory
- pinned conversations
- provider switching
- multi-provider orchestration
- semantic retrieval
- workspace-wide search
- Oracle-specific behavior
- Pylon-specific behavior
- cross-tool contextual awareness
- autonomous agent behavior
- background task execution
- conversation export
- authentication redesign
- a full chat product

---

## Native Workspace Constraint

Do not satisfy S5 by embedding an external provider chat UI.

The assistant panel should be Socket UI.

The panel may call a provider API or local provider endpoint, but it should
render conversations through Socket-owned components and maintain Socket-owned
in-session conversation state.

This is the minimum down payment on the long-term rule:

> Socket owns the workspace. Conversations belong to Socket.
> AI providers are participants, not the architecture.

---

## Design Principles

- Socket owns the workspace.
- Conversations belong to Socket.
- AI providers participate in Socket rather than defining it.
- Preserve future architectural flexibility.
- Respect existing authority boundaries.
- Build the smallest coherent implementation.
- Do not allow convenience dependencies to silently become architecture.
- Do not build the campus today.
- Do not erase the campus while building today’s room.

---

## Success Criteria

By the end of S5, the operator should be able to:

1. Launch Socket.
2. Open the assistant side panel.
3. Create a new conversation.
4. Send a message and receive an assistant response from a real provider.
5. Create a second conversation.
6. Switch between conversations.
7. Return to the first conversation and see its prior messages still present.
8. Continue working in another Socket tool without losing the active assistant conversation.
9. Close and reopen the assistant panel without losing the current session’s conversations.
10. Experience the assistant as part of Socket, not as a separate website embedded inside Socket.

If this makes Socket somewhere the operator naturally wants to leave open while
working for hours, the milestone succeeds.

---

## Review Checklist

When the S5 patch returns, review it against these questions:

1. Does the assistant panel open and close smoothly?
2. Does the panel live beside the active Socket tool rather than replacing the workspace?
3. Can the operator create multiple conversations?
4. Can the operator switch between conversations?
5. Can the operator send a message and receive a real assistant response?
6. Are conversations preserved during the current running Socket session?
7. Does Socket own the conversation state, at least in memory?
8. Is the UI rendered as Socket-native UI rather than an embedded provider website?
9. Did the implementation avoid unnecessary provider abstraction?
10. Did the implementation avoid building future features from the Architectural Intent section?
11. Did the implementation preserve future compatibility with provider-independent Socket conversations?
12. Did the implementation avoid crossing Oracle, Pylon, governance, memory, retrieval, or long-term persistence boundaries?

---

## Guiding Rule

**Preserve the destination. Limit the implementation.**

Never allow today’s implementation scope to erase tomorrow’s architectural
intent.

Record long-term goals so they remain visible.

Build only the smallest coherent slice needed for the current milestone.
