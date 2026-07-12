import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { completeWithXai, xaiDefaults } from '../src/assistant/xai-chat.js';

describe('S5 hardcoded xAI completion path', () => {
  it('rejects missing API key with a clear code', async () => {
    await assert.rejects(
      () => completeWithXai([{ role: 'user', content: 'hi' }], { apiKey: '' }),
      (err) => err.code === 'MISSING_API_KEY',
    );
  });

  it('rejects invalid message payloads', async () => {
    await assert.rejects(
      () => completeWithXai([], { apiKey: 'test-key' }),
      (err) => err.code === 'INVALID_MESSAGES',
    );
    await assert.rejects(
      () => completeWithXai([{ role: 'system', content: 'nope' }], { apiKey: 'test-key' }),
      (err) => err.code === 'INVALID_MESSAGES',
    );
  });

  it('posts Socket message history to the chat completions endpoint', async () => {
    const fetchImpl = mock.fn(async (url, init) => {
      assert.equal(url, 'https://api.x.ai/v1/chat/completions');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, xaiDefaults.model);
      assert.equal(body.stream, false);
      assert.equal(body.messages[0].role, 'system');
      assert.deepEqual(body.messages.slice(1), [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Again' },
      ]);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            model: 'grok-4.5',
            choices: [{ message: { role: 'assistant', content: '  Real reply  ' } }],
          });
        },
      };
    });

    const result = await completeWithXai(
      [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Again' },
      ],
      { apiKey: 'test-key', fetchImpl },
    );

    assert.equal(result.role, 'assistant');
    assert.equal(result.content, 'Real reply');
    assert.equal(result.model, 'grok-4.5');
    assert.equal(fetchImpl.mock.callCount(), 1);
  });

  it('surfaces provider errors without inventing conversation ownership', async () => {
    const fetchImpl = mock.fn(async () => ({
      ok: false,
      status: 401,
      async text() {
        return JSON.stringify({ error: { message: 'Invalid API key' } });
      },
    }));

    await assert.rejects(
      () => completeWithXai([{ role: 'user', content: 'hi' }], { apiKey: 'bad', fetchImpl }),
      (err) => err.code === 'PROVIDER_ERROR' && /Invalid API key/.test(err.message),
    );
  });
});
