import { classifyDeterministically } from './classifier.js';
import type { TriageConfig } from './config.js';
import { askJev } from './jev/triage.js';
import type { Transport } from './jev/types.js';
import { redact } from './redact.js';
import { computeSignals } from './signals.js';
import { summarizeError } from './summarize.js';
import type { Basis, Classification, FailureClass, RunResult, TestOutcome, TriageReport } from './types.js';
import { FAILURE_CLASSES } from './types.js';

export interface TriageInput {
  current: RunResult;
  history: RunResult[];
  changedFiles: string[];
  config: TriageConfig;
  transport: Transport;
  now?: Date;
}

function headline(test: TestOutcome): string {
  const failure = test.attempts.find((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped');
  return redact(summarizeError(failure?.error ?? failure?.status));
}

async function classify(test: TestOutcome, input: TriageInput): Promise<Classification> {
  const signals = computeSignals(test, input.history, input.changedFiles, input.config);
  const base = { id: test.id, title: test.title, file: test.file, error: headline(test), signals };
  const verdict = classifyDeterministically(signals, input.config);
  if (verdict.decided) {
    return { ...base, class: verdict.class, basis: 'deterministic', reasons: verdict.reasons };
  }
  const jev = await askJev(input.transport, test, signals);
  if (!jev.ok) {
    return {
      ...base,
      class: 'unknown',
      basis: 'unverified',
      reasons: [...verdict.reasons, 'Jev unavailable, so this failure is left unclassified instead of guessed'],
      jevError: jev.error,
    };
  }
  const { evidence } = jev;
  const confident = evidence.confidence >= input.config.confidenceThreshold;
  const verdictReason = confident
    ? `Jev: ${evidence.choice} with confidence ${evidence.confidence.toFixed(2)} (threshold ${input.config.confidenceThreshold})`
    : `Jev leaned ${evidence.choice} but confidence ${evidence.confidence.toFixed(2)} is below ${input.config.confidenceThreshold}; routed to a human`;
  return {
    ...base,
    class: confident ? evidence.choice : 'unknown',
    basis: confident ? 'jev' : 'jev-low-confidence',
    reasons: [...verdict.reasons, verdictReason],
    jev: evidence,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function tally<K extends string>(keys: readonly K[], values: K[]): Record<K, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}

const BASES: Basis[] = ['deterministic', 'jev', 'jev-low-confidence', 'unverified'];
const ORDER: FailureClass[] = ['regression', 'unknown', 'test-data', 'environment', 'flaky'];

export async function triage(input: TriageInput): Promise<TriageReport> {
  const failing = input.current.tests.filter((test) => {
    const statuses = test.attempts.map((attempt) => attempt.status);
    return statuses.some((status) => status === 'failed' || status === 'timedOut' || status === 'interrupted');
  });
  const classifications = (await mapLimit(failing, 4, (test) => classify(test, input))).sort(
    (a, b) => ORDER.indexOf(a.class) - ORDER.indexOf(b.class) || a.id.localeCompare(b.id),
  );
  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    source: input.current.source,
    jevMode: input.transport.name,
    confidenceThreshold: input.config.confidenceThreshold,
    totals: {
      tests: input.current.tests.length,
      failing: classifications.length,
      byClass: tally(FAILURE_CLASSES, classifications.map((entry) => entry.class)),
      byBasis: tally(BASES, classifications.map((entry) => entry.basis)),
    },
    classifications,
  };
}
