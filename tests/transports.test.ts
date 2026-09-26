import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { JevUnavailableError, LiveTransport, RecordingTransport, ReplayTransport, createTransport } from '../src/jev/transports.js';
import type { SystemOneRequest } from '../src/jev/types.js';

const request: SystemOneRequest = {
  model: 'jev-latest',
  state: 'Error: connect ECONNREFUSED',
  questions: { retry: { type: 'noul', instructions: 'Would a retry pass?' } },
};

const ok = { model: 'jev-latest', answers: { retry: { type: 'noul', noul: 0.2 } } };

const live = (fetchImpl: typeof fetch) =>
  new LiveTransport({ endpoint: 'https://example.test', apiKey: 'k', via: 'test', fetchImpl, backoffMs: 1, maxAttempts: 3 });

describe('LiveTransport', () => {
  it('returns the parsed body on success', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }));
    const exchange = await live(fetchImpl).send(request);
    expect(exchange.response).toEqual(ok);
    expect(exchange.recorded).toBe(false);
  });

  it('does not retry a 403 and keeps the response body in the error', async () => {
    const fetchImpl = vi.fn(async () => new Response('{"error":"model not enabled for this team"}', { status: 403 }));
    await expect(live(fetchImpl).send(request)).rejects.toThrow(/403 via test: .*model not enabled/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries 429 and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ok), { status: 200 }));
    await expect(live(fetchImpl as unknown as typeof fetch).send(request)).resolves.toMatchObject({ response: ok });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('gives up with JevUnavailableError when the network keeps failing', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(live(fetchImpl).send(request)).rejects.toBeInstanceOf(JevUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('record and replay', () => {
  it('replays exactly what was recorded and nothing else', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jev-'));
    const inner = { name: 'fake', send: vi.fn(async () => ({ response: ok, latencyMs: 400, recorded: false })) };
    await new RecordingTransport(inner, dir).send(request);
    const replay = new ReplayTransport(dir);
    await expect(replay.send(request)).resolves.toMatchObject({ response: ok, latencyMs: 400, recorded: true });
    await expect(replay.send({ ...request, state: 'something else' })).rejects.toBeInstanceOf(JevUnavailableError);
  });
});

describe('createTransport', () => {
  it('is disabled in live mode without a key instead of inventing answers', async () => {
    const transport = createTransport('live', '/nonexistent', {});
    expect(transport.name).toBe('off');
    await expect(transport.send(request)).rejects.toBeInstanceOf(JevUnavailableError);
  });

  it('prefers a live key in auto mode', () => {
    expect(createTransport('auto', '/nonexistent', { AI_GATEWAY_API_KEY: 'x' }).name).toBe('live via vercel-ai-gateway');
  });
});
