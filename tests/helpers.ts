import { DEFAULT_CONFIG, type TriageConfig } from '../src/config.js';
import type { AttemptStatus, HistoryStats, RunResult, Signals, TestOutcome } from '../src/types.js';

export const config: TriageConfig = { ...DEFAULT_CONFIG, minHistory: 5, confidenceThreshold: 0.75 };

export function outcome(statuses: AttemptStatus[], error = 'Error: expect(received).toBe(expected)', id = 'a.spec.ts › works'): TestOutcome {
  return {
    id,
    title: id.split(' › ').slice(1).join(' › '),
    file: id.split(' › ')[0]!,
    attempts: statuses.map((status) => ({ status, durationMs: 10, ...(status === 'passed' ? {} : { error }) })),
  };
}

export function runs(sequence: AttemptStatus[][], id = 'a.spec.ts › works'): RunResult[] {
  return sequence.map((statuses, index) => ({ source: `run-${index}`, tests: [outcome(statuses, undefined, id)] }));
}

const stableHistory: HistoryStats = {
  runs: 8,
  passed: 8,
  failed: 0,
  flakyInRun: 0,
  passRate: 1,
  flips: 0,
  sequence: Array(8).fill('passed'),
};

export function signals(overrides: Partial<Signals> = {}): Signals {
  return {
    verdict: 'failed',
    attempts: 2,
    passedOnRetry: false,
    failedEveryAttempt: true,
    history: stableHistory,
    environmentMarkers: [],
    testDataMarkers: [],
    assertionFailure: true,
    changedAppPaths: [],
    changedTestPaths: [],
    ...overrides,
  };
}
