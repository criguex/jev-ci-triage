export const FAILURE_CLASSES = ['regression', 'flaky', 'environment', 'test-data', 'unknown'] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];
export type DecidableClass = Exclude<FailureClass, 'unknown'>;

export type AttemptStatus = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';

export interface Attempt {
  status: AttemptStatus;
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface TestOutcome {
  id: string;
  title: string;
  file: string;
  attempts: Attempt[];
}

export interface RunResult {
  source: string;
  tests: TestOutcome[];
}

export type OutcomeVerdict = 'passed' | 'failed' | 'flaky' | 'skipped';

export interface HistoryStats {
  runs: number;
  passed: number;
  failed: number;
  flakyInRun: number;
  passRate: number | null;
  flips: number;
  sequence: OutcomeVerdict[];
}

export interface Signals {
  verdict: OutcomeVerdict;
  attempts: number;
  passedOnRetry: boolean;
  failedEveryAttempt: boolean;
  history: HistoryStats;
  environmentMarkers: string[];
  testDataMarkers: string[];
  assertionFailure: boolean;
  changedAppPaths: string[];
  changedTestPaths: string[];
}

export type Basis = 'deterministic' | 'jev' | 'jev-low-confidence' | 'unverified';

export interface JevEvidence {
  model: string;
  choice: DecidableClass;
  confidence: number;
  probabilities: Record<string, number>;
  retryWouldPass: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  costUsd: number | null;
}

export interface Classification {
  id: string;
  title: string;
  file: string;
  class: FailureClass;
  basis: Basis;
  reasons: string[];
  error: string;
  signals: Signals;
  jev?: JevEvidence;
  jevError?: string;
}

export interface TriageReport {
  generatedAt: string;
  source: string;
  jevMode: string;
  confidenceThreshold: number;
  totals: { tests: number; failing: number; byClass: Record<FailureClass, number>; byBasis: Record<Basis, number> };
  classifications: Classification[];
}
