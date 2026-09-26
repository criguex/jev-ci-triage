import type { Attempt, AttemptStatus, RunResult, TestOutcome } from '../types.js';

interface PwResult {
  status: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  errors?: { message?: string; stack?: string }[];
}

interface PwTest {
  projectName?: string;
  results: PwResult[];
}

interface PwSpec {
  title: string;
  file: string;
  tests: PwTest[];
}

interface PwSuite {
  title: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}

export interface PlaywrightJson {
  suites: PwSuite[];
}

const STATUSES: AttemptStatus[] = ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'];

function toStatus(raw: string): AttemptStatus {
  return (STATUSES as string[]).includes(raw) ? (raw as AttemptStatus) : 'failed';
}

function toAttempt(result: PwResult): Attempt {
  const errors = result.errors?.length ? result.errors : result.error ? [result.error] : [];
  const message = errors.map((error) => error.message ?? '').filter(Boolean).join('\n\n');
  const stack = result.error?.stack ?? errors.find((error) => error.stack)?.stack;
  return {
    status: toStatus(result.status),
    durationMs: result.duration ?? 0,
    ...(message ? { error: stripAnsi(message) } : {}),
    ...(stack ? { stack: stripAnsi(stack) } : {}),
  };
}

export function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function collect(suite: PwSuite, trail: string[], out: TestOutcome[]): void {
  const path = suite.title && suite.title !== suite.file ? [...trail, suite.title] : trail;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      const titleParts = [...path, spec.title];
      const project = test.projectName ? `[${test.projectName}] ` : '';
      out.push({
        id: `${spec.file} › ${project}${titleParts.join(' › ')}`,
        title: titleParts.join(' › '),
        file: spec.file,
        attempts: test.results.map(toAttempt),
      });
    }
  }
  for (const child of suite.suites ?? []) {
    collect(child, path, out);
  }
}

export function isPlaywrightJson(value: unknown): value is PlaywrightJson {
  return typeof value === 'object' && value !== null && Array.isArray((value as PlaywrightJson).suites);
}

export function parsePlaywrightJson(report: PlaywrightJson, source: string): RunResult {
  const tests: TestOutcome[] = [];
  for (const suite of report.suites) {
    collect(suite, [], tests);
  }
  return { source, tests };
}
