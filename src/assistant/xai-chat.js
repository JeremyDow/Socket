/**
 * S5 hardcoded provider path: xAI Chat Completions.
 *
 * This is intentionally not a provider abstraction. Socket owns conversation
 * structure elsewhere; this module only requests an assistant completion.
 */

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-4.5';

const SYSTEM_PROMPT =
  'You are the Socket assistant — a participant inside the Socket workspace. ' +
  'Be concise, practical, and helpful while the operator works with Socket tools.';

/**
 * @param {Array<{ role: string, content: string }>} messages Socket-owned message history
 * @param {{ apiKey?: string, baseUrl?: string, model?: string, fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<{ role: 'assistant', content: string, model: string }>}
 */
export async function completeWithXai(messages, options = {}) {
  const apiKey = options.apiKey ?? process.env.XAI_API_KEY;
  if (!apiKey) {
    const err = new Error(
      'XAI_API_KEY is not set. Export it before starting Socket to enable the assistant.',
    );
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('messages must be a non-empty array');
    err.code = 'INVALID_MESSAGES';
    throw err;
  }

  for (const message of messages) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
      const err = new Error('each message must have role "user" or "assistant"');
      err.code = 'INVALID_MESSAGES';
      throw err;
    }
    if (typeof message.content !== 'string' || !message.content.trim()) {
      const err = new Error('each message must have non-empty string content');
      err.code = 'INVALID_MESSAGES';
      throw err;
    }
  }

  const baseUrl = (options.baseUrl || process.env.XAI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = options.model || process.env.XAI_MODEL || DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    const err = new Error('fetch is not available in this runtime');
    err.code = 'FETCH_UNAVAILABLE';
    throw err;
  }

  const body = {
    model,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    const err = new Error(`Provider returned non-JSON response (HTTP ${response.status})`);
    err.code = 'PROVIDER_ERROR';
    err.status = response.status;
    throw err;
  }

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      rawText ||
      `HTTP ${response.status}`;
    const err = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    err.code = 'PROVIDER_ERROR';
    err.status = response.status;
    throw err;
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    const err = new Error('Provider response missing assistant content');
    err.code = 'PROVIDER_ERROR';
    throw err;
  }

  return {
    role: 'assistant',
    content: content.trim(),
    model: payload.model || model,
  };
}

export const xaiDefaults = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  systemPrompt: SYSTEM_PROMPT,
};
