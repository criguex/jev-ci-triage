import type { TriageConfig } from './config.js';
import { matches, matchesAny } from './glob.js';
import type { HistoryStats, OutcomeVerdict, RunResult, Signals, TestOutcome } from './types.js';

const ENVIRONMENT_MARKERS: [string, RegExp][] = [
  ['ECONNRESET', /\bECONNRESET\b/],
  ['ECONNREFUSED', /\bECONNREFUSED\b/],
  ['ENOTFOUND', /\bENOTFOUND\b|\bEAI_AGAIN\b|getaddrinfo/],
  ['ETIMEDOUT', /\bETIMEDOUT\b|\bESOCKETTIMEDOUT\b/],
  ['socket hang up', /socket hang up|\bEPIPE\b/i],
  ['browser network error', /net::ERR_[A-Z_]+/],
  ['HTTP 502/503/504', /\b50[234]\b[^\n]{0,40}(Bad Gateway|Service Unavailable|Gateway Time-?out)|(Bad Gateway|Service Unavailable|Gateway Time-?out)/i],
  ['browser crashed', /Target crashed|browser has been closed|Browser closed unexpectedly/i],
  ['runner resources', /\bENOSPC\b|\bENOMEM\b|out of memory|JavaScript heap/i],
  ['navigation timeout', /page\.goto: Timeout|navigation timeout/i],
];

const TEST_DATA_MARKERS: [string, RegExp][] = [
  ['fixture/seed reference', /\b(fixture|seed(ed)?|test data|dataset)\b/i],
  ['uniqueness conflict', /duplicate key|already exists|unique constraint|409 Conflict/i],
  ['missing record', /\b(record|user|account|entity) not found\b|no such (user|record|account)/i],
  ['expired credentials', /expired (token|credential|password|session)/i],
];

const ASSERTION = /\bexpect\(|\bExpected\b|\bReceived\b|AssertionError|toBe|toEqual|toHave[A-Z]\w*/;

export function verdictOf(test: TestOutcome): OutcomeVerdict {
  const statuses = test.attempts.map((attempt) => attempt.status);
  const last = statuses.at(-1);
  if (!last || statuses.every((status) => status === 'skipped')) {
    return 'skipped';
  }
  if (last === 'passed') {
    return statuses.length > 1 && statuses.slice(0, -1).some((status) => status !== 'passed') ? 'flaky' : 'passed';
  }
  return 'failed';
}

export function historyOf(id: string, history: RunResult[]): HistoryStats {
  const sequence = history
    .map((run) => run.tests.find((test) => test.id === id))
    .filter((test): test is TestOutcome => test !== undefined)
    .map(verdictOf)
    .filter((verdict) => verdict !== 'skipped');
  const passed = sequence.filter((verdict) => verdict === 'passed').length;
  const failed = sequence.filter((verdict) => verdict === 'failed').length;
  const flakyInRun = sequence.filter((verdict) => verdict === 'flaky').length;
  let flips = 0;
  for (let i = 1; i < sequence.length; i += 1) {
    const previous = sequence[i - 1] === 'passed';
    const current = sequence[i] === 'passed';
    if (previous !== current) {
      flips += 1;
    }
  }
  return {
    runs: sequence.length,
    passed,
    failed,
    flakyInRun,
    passRate: sequence.length === 0 ? null : passed / sequence.length,
    flips,
    sequence,
  };
}

function found(markers: [string, RegExp][], text: string): string[] {
  return markers.filter(([, regex]) => regex.test(text)).map(([name]) => name);
}

function ownedPaths(testFile: string, config: TriageConfig): string[] {
  const owned = Object.entries(config.ownership)
    .filter(([testGlob]) => matches(testFile, testGlob) || testFile.endsWith(testGlob))
    .flatMap(([, globs]) => globs);
  return owned.length > 0 ? owned : [...config.appPaths, ...config.testPaths];
}

export function computeSignals(
  test: TestOutcome,
  history: RunResult[],
  changedFiles: string[],
  config: TriageConfig,
): Signals {
  const verdict = verdictOf(test);
  const failures = test.attempts.filter((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped');
  const errorText = failures.map((attempt) => `${attempt.error ?? ''}\n${attempt.stack ?? ''}`).join('\n');
  const owned = changedFiles.filter((file) => matchesAny(file, ownedPaths(test.file, config)));
  return {
    verdict,
    attempts: test.attempts.length,
    passedOnRetry: verdict === 'flaky',
    failedEveryAttempt: failures.length === test.attempts.length && failures.length > 0,
    history: historyOf(test.id, history),
    environmentMarkers: found(ENVIRONMENT_MARKERS, errorText),
    testDataMarkers: found(TEST_DATA_MARKERS, errorText),
    assertionFailure: ASSERTION.test(errorText),
    changedAppPaths: owned.filter((file) => !matchesAny(file, config.testPaths)),
    changedTestPaths: changedFiles.filter(
      (file) => file.endsWith(test.file) || (owned.includes(file) && matchesAny(file, config.testPaths)),
    ),
  };
}
