import type { DecidableClass, JevEvidence, Signals, TestOutcome } from '../types.js';
import { redact } from '../redact.js';
import { normalizeAnswers } from './normalize.js';
import type { ChoiceAnswer, NoulAnswer, Question, SystemOneRequest, SystemOneResponse, Transport } from './types.js';

export const MODEL = 'jev-latest';

export const CLASS_CRITERIA: Record<DecidableClass, string> = {
  regression:
    'The application under test changed behaviour: the test used to pass and now fails on a real functional difference, usually related to application code changed in this diff',
  flaky:
    'The test is nondeterministic: a race, a timing-dependent wait or order dependence, so the same code sometimes passes and sometimes fails',
  environment:
    'Infrastructure outside the code under test: network errors, a service or dependency down, DNS, runner resources, external timeouts',
  'test-data':
    "The test's own data is wrong: stale or edited fixtures, seed data missing or already consumed, expectations tied to data that changed",
};

export const QUESTIONS: Record<string, Question> = {
  cause: {
    type: 'choice',
    instructions: 'What is the most likely root cause of this CI test failure?',
    criteria: CLASS_CRITERIA,
  },
  retryWouldPass: {
    type: 'noul',
    instructions: 'Would this test most likely pass if it were re-run on the same commit without any change?',
  },
};

function topStack(stack: string | undefined): string[] {
  return (stack ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at ') && !line.includes('node_modules'))
    .slice(0, 4)
    .map(redact);
}

export function buildRequest(test: TestOutcome, signals: Signals): SystemOneRequest {
  const failure = test.attempts.find((attempt) => attempt.status !== 'passed' && attempt.status !== 'skipped');
  const { history } = signals;
  return {
    model: MODEL,
    state: {
      test: test.title,
      file: test.file,
      error: redact(failure?.error ?? 'no error message').slice(0, 1500),
      stack: topStack(failure?.stack),
      attemptsInThisRun: test.attempts.map((attempt) => attempt.status),
      history:
        history.runs === 0
          ? 'no prior runs recorded for this test'
          : `${history.passed} passed, ${history.failed} failed, ${history.flakyInRun} passed-on-retry out of ${history.runs} prior runs; ${history.flips} outcome flips; sequence oldest→newest: ${history.sequence.join(', ')}`,
      changedApplicationFiles: signals.changedAppPaths,
      changedTestFilesOrData: signals.changedTestPaths,
      infrastructureMarkers: signals.environmentMarkers,
      testDataMarkers: signals.testDataMarkers,
    },
    questions: QUESTIONS,
  };
}

function costOf(response: SystemOneResponse): number | null {
  const cost = Number(response.provider_metadata?.gateway?.cost);
  return Number.isFinite(cost) && cost > 0 ? cost : null;
}

export type JevOutcome = { ok: true; evidence: JevEvidence } | { ok: false; error: string };

export async function askJev(transport: Transport, test: TestOutcome, signals: Signals): Promise<JevOutcome> {
  const request = buildRequest(test, signals);
  try {
    const exchange = await transport.send(request);
    const answers = normalizeAnswers(exchange.response.answers ?? {}, request.questions);
    const cause = answers.cause as ChoiceAnswer;
    const retry = answers.retryWouldPass as NoulAnswer;
    return {
      ok: true,
      evidence: {
        model: `${exchange.response.model ?? MODEL}${exchange.recorded ? ', recorded' : ''}`,
        choice: cause.choice as DecidableClass,
        confidence: cause.confidence,
        probabilities: cause.probabilities,
        retryWouldPass: retry.probability,
        latencyMs: exchange.latencyMs,
        inputTokens: exchange.response.usage?.input_tokens ?? null,
        costUsd: costOf(exchange.response),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
