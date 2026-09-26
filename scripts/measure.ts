import { mkdirSync, writeFileSync } from 'node:fs';
import { classifyDeterministically } from '../src/classifier.js';
import { loadConfig } from '../src/config.js';
import { buildRequest } from '../src/jev/triage.js';
import { normalizeAnswers } from '../src/jev/normalize.js';
import { liveFromEnv } from '../src/jev/transports.js';
import type { ChoiceAnswer, SystemOneRequest } from '../src/jev/types.js';
import { parseHistory, parseRun } from '../src/parsers/index.js';
import { computeSignals } from '../src/signals.js';
import { readFileSync } from 'node:fs';

const REPEATS = Number(process.env.REPEATS ?? 10);

process.loadEnvFile('.env');
const transport = liveFromEnv(process.env, { maxAttempts: 1 });
const PAUSE_MS = Number(process.env.PAUSE_MS ?? 1500);
const MAX_TRIES = Number(process.env.MAX_TRIES ?? 8);
if (!transport) {
  throw new Error('No AI_GATEWAY_API_KEY or TYPESAFE_API_KEY in the environment');
}

const config = loadConfig('demo/jev-triage.config.json');
const current = parseRun('demo/runs/current.json');
const history = parseHistory('demo/runs/history');
const changed = readFileSync('demo/scenario/changed-files.txt', 'utf8').split('\n').filter(Boolean);
const truth = JSON.parse(readFileSync('demo/scenario/ground-truth.json', 'utf8')) as Record<string, { expected: string }>;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function sendPatiently(request: SystemOneRequest, onCall: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    await sleep(attempt === 0 ? PAUSE_MS : PAUSE_MS * 2 ** attempt);
    onCall();
    try {
      return await transport!.send(request);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const quantile = (values: number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? NaN;
};

const failing = current.tests.filter((test) => test.attempts.some((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped'));
const results = [];
for (const test of failing) {
  const signals = computeSignals(test, history, changed, config);
  const rule = classifyDeterministically(signals, config);
  const request = buildRequest(test, signals);
  const samples: { choice: string; confidence: number; latencyMs: number; tokens: number | null; cost: number | null }[] = [];
  const failures: string[] = [];
  let rawCalls = 0;
  for (let i = 0; i < REPEATS; i += 1) {
    try {
      const exchange = await sendPatiently(request, () => {
        rawCalls += 1;
      });
      const cause = normalizeAnswers(exchange.response.answers, request.questions).cause as ChoiceAnswer;
      samples.push({
        choice: cause.choice,
        confidence: cause.confidence,
        latencyMs: exchange.latencyMs ?? NaN,
        tokens: exchange.response.usage?.input_tokens ?? null,
        cost: Number(exchange.response.provider_metadata?.gateway?.cost) || null,
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message.slice(0, 200) : String(error));
    }
  }
  const counts = samples.reduce<Record<string, number>>((acc, sample) => ({ ...acc, [sample.choice]: (acc[sample.choice] ?? 0) + 1 }), {});
  const confidences = samples.map((sample) => sample.confidence);
  results.push({
    id: test.id,
    seededAs: truth[test.id]?.expected ?? null,
    ruleVerdict: rule.decided ? rule.class : null,
    jevChoices: counts,
    confidence: { min: Math.min(...confidences), median: quantile(confidences, 0.5), max: Math.max(...confidences) },
    latencyMs: { median: quantile(samples.map((s) => s.latencyMs), 0.5), p90: quantile(samples.map((s) => s.latencyMs), 0.9) },
    inputTokens: samples[0]?.tokens ?? null,
    costUsdPerCall: samples[0]?.cost ?? null,
    successfulCalls: samples.length,
    httpCalls: rawCalls,
    failedCalls: failures.length,
    errors: [...new Set(failures)],
  });
  process.stdout.write(`${test.id}: ${JSON.stringify(counts)} (${samples.length}/${REPEATS} ok)\n`);
}

const latencies = results.map((result) => result.latencyMs.median);
const totals = results.reduce((acc, result) => ({ ok: acc.ok + result.successfulCalls, http: acc.http + result.httpCalls }), { ok: 0, http: 0 });
const summary = { firstTryAvailability: `${totals.ok}/${totals.http} HTTP calls succeeded`, measuredAt: new Date().toISOString(), transport: transport.name, repeats: REPEATS, results, medianOfMedianLatencyMs: quantile(latencies, 0.5) };
mkdirSync('demo/measurements', { recursive: true });
writeFileSync('demo/measurements/jev-repeatability.json', `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write('written demo/measurements/jev-repeatability.json\n');
