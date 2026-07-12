import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { completeWithOpenAI, openaiDefaults } from '../src/assistant/openai-chat.js';

describe('S5 hardcoded OpenAI Responses completion path', () => {
  it('rejects missing API key with a clear code mentioning OPENAI_API_KEY', async () => {
    await assert.rejects(
      () => completeWithOpenAI([{ role: 'user', content: 'hi' }], { apiKey: '' }),
      (err) => err.code === 'MISSING_API_KEY' && /OPENAI_API_KEY/.test(err.message),
    );
  });

  it('rejects invalid message payloads', async () => {
    await assert.rejects(
      () => completeWithOpenAI([], { apiKey: 'test-key' }),
      (err) => err.code === 'INVALID_MESSAGES',
    );
    await assert.rejects(
      () => completeWithOpenAI([{ role: 'system', content: 'nope' }], { apiKey: 'test-key' }),
      (err) => err.code === 'INVALID_MESSAGES',
    );
  });

  it('posts Socket message history to the OpenAI Responses endpoint', async () => {
    const fetchImpl = mock.fn(async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.method, 'POST');
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, openaiDefaults.model);
      assert.equal(body.instructions, openaiDefaults.systemPrompt);
      assert.deepEqual(body.input, [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Again' },
      ]);
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            model: 'gpt-4.1-mini',
            output_text: '  Real reply  ',
          });
        },
      };
    });

    const result = await completeWithOpenAI(
      [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Again' },
      ],
      { apiKey: 'test-key', fetchImpl },
    );

    assert.equal(result.role, 'assistant');
    assert.equal(result.content, 'Real reply');
    assert.equal(result.model, 'gpt-4.1-mini');
    assert.equal(fetchImpl.mock.callCount(), 1);
  });

  it('extracts text from structured Responses output when output_text is absent', async () => {
    const fetchImpl = mock.fn(async () => ({
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          model: 'gpt-4.1-mini',
          output: [
            {
              type: 'message',
              content: [{ type: 'output_text', text: ' Structured reply ' }],
            },
          ],
        });
      },
    }));

    const result = await completeWithOpenAI(
      [{ role: 'user', content: 'hi' }],
      { apiKey: 'test-key', fetchImpl },
    );
    assert.equal(result.content, 'Structured reply');
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
      () => completeWithOpenAI([{ role: 'user', content: 'hi' }], { apiKey: 'bad', fetchImpl }),
      (err) => err.code === 'PROVIDER_ERROR' && /Invalid API key/.test(err.message),
    );
  });
});
