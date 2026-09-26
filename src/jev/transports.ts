import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Exchange, SystemOneRequest, SystemOneResponse, Transport } from './types.js';

export const GATEWAY_ENDPOINT = 'https://ai-gateway.vercel.sh/typesafe/v1/systemone';
export const DIRECT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export class JevUnavailableError extends Error {}

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

export interface LiveOptions {
  endpoint: string;
  apiKey: string;
  via: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

export function fingerprint(request: SystemOneRequest): string {
  return createHash('sha256').update(JSON.stringify(request)).digest('hex').slice(0, 16);
}

export class LiveTransport implements Transport {
  readonly name: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LiveOptions) {
    this.name = `live via ${options.via}`;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async send(request: SystemOneRequest): Promise<Exchange> {
    const maxAttempts = this.options.maxAttempts ?? 3;
    let lastError = 'no attempt made';
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = performance.now();
      try {
        const response = await this.fetchImpl(this.options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.options.apiKey}` },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
        });
        const body = await response.text();
        const latencyMs = Math.round(performance.now() - started);
        if (response.ok) {
          return { response: JSON.parse(body) as SystemOneResponse, latencyMs, recorded: false };
        }
        lastError = `HTTP ${response.status} via ${this.options.via}: ${body.slice(0, 500) || '(empty body)'}`;
        if (!RETRYABLE.has(response.status)) {
          break;
        }
      } catch (error) {
        lastError = `${error instanceof Error ? error.name : 'Error'}: ${String(error instanceof Error ? error.message : error)}`;
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, (this.options.backoffMs ?? 1000) * 2 ** (attempt - 1)));
      }
    }
    throw new JevUnavailableError(lastError);
  }
}

interface Fixture {
  request: SystemOneRequest;
  response: SystemOneResponse;
  latencyMs: number | null;
  recordedAt: string;
}

export class ReplayTransport implements Transport {
  readonly name = 'replay (recorded responses)';

  constructor(private readonly dir: string) {}

  async send(request: SystemOneRequest): Promise<Exchange> {
    const path = join(this.dir, `${fingerprint(request)}.json`);
    if (!existsSync(path)) {
      throw new JevUnavailableError(`no recorded response for request ${fingerprint(request)} in ${this.dir}`);
    }
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as Fixture;
    return { response: fixture.response, latencyMs: fixture.latencyMs, recorded: true };
  }
}

export class RecordingTransport implements Transport {
  readonly name: string;

  constructor(
    private readonly inner: Transport,
    private readonly dir: string,
  ) {
    this.name = `${inner.name}, recording`;
  }

  async send(request: SystemOneRequest): Promise<Exchange> {
    const exchange = await this.inner.send(request);
    mkdirSync(this.dir, { recursive: true });
    const { model, answers, usage, provider_metadata: metadata } = exchange.response;
    const cost = metadata?.gateway?.cost;
    const fixture: Fixture = {
      request,
      response: { model, answers, ...(usage ? { usage } : {}), ...(cost ? { provider_metadata: { gateway: { cost } } } : {}) },
      latencyMs: exchange.latencyMs,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(join(this.dir, `${fingerprint(request)}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
    return exchange;
  }
}

export class DisabledTransport implements Transport {
  readonly name = 'off';

  async send(): Promise<Exchange> {
    throw new JevUnavailableError('Jev disabled (--jev off or no API key)');
  }
}

export type JevMode = 'live' | 'record' | 'replay' | 'off' | 'auto';

export function liveFromEnv(
  env: NodeJS.ProcessEnv,
  tuning: Pick<LiveOptions, 'maxAttempts' | 'timeoutMs' | 'backoffMs'> = {},
): LiveTransport | null {
  if (env.TYPESAFE_API_KEY) {
    return new LiveTransport({ endpoint: DIRECT_ENDPOINT, apiKey: env.TYPESAFE_API_KEY, via: 'typesafe', ...tuning });
  }
  if (env.AI_GATEWAY_API_KEY) {
    return new LiveTransport({ endpoint: GATEWAY_ENDPOINT, apiKey: env.AI_GATEWAY_API_KEY, via: 'vercel-ai-gateway', ...tuning });
  }
  return null;
}

export function createTransport(mode: JevMode, fixturesDir: string, env: NodeJS.ProcessEnv): Transport {
  const live = liveFromEnv(env);
  switch (mode) {
    case 'off':
      return new DisabledTransport();
    case 'replay':
      return new ReplayTransport(fixturesDir);
    case 'live':
      return live ?? new DisabledTransport();
    case 'record':
      return live ? new RecordingTransport(live, fixturesDir) : new DisabledTransport();
    case 'auto':
      return live ?? (existsSync(fixturesDir) ? new ReplayTransport(fixturesDir) : new DisabledTransport());
  }
}
