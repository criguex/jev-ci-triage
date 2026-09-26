import type { TriageConfig } from './config.js';
import type { DecidableClass, Signals } from './types.js';

export type DeterministicVerdict =
  | { decided: true; class: DecidableClass; reasons: string[] }
  | { decided: false; reasons: string[] };

const pct = (value: number | null): string => (value === null ? 'n/a' : `${Math.round(value * 100)}%`);

export function classifyDeterministically(signals: Signals, config: TriageConfig): DeterministicVerdict {
  const { history } = signals;
  const enoughHistory = history.runs >= config.minHistory;
  const context = [
    `history: ${history.runs} run(s), first-try pass rate ${pct(history.passRate)}, ${history.flips} flip(s)`,
  ];

  if (signals.passedOnRetry) {
    return {
      decided: true,
      class: 'flaky',
      reasons: [`failed then passed on retry within this run (${signals.attempts} attempts, same code)`, ...context],
    };
  }

  if (signals.environmentMarkers.length > 0 && signals.changedAppPaths.length === 0) {
    return {
      decided: true,
      class: 'environment',
      reasons: [`infrastructure marker(s): ${signals.environmentMarkers.join(', ')}`, 'no owned application code changed', ...context],
    };
  }

  if (enoughHistory && history.flips >= 2 && history.passRate !== null && history.passRate > 0 && history.passRate < 1) {
    return {
      decided: true,
      class: 'flaky',
      reasons: [`outcome flipped ${history.flips} times over ${history.runs} runs without being stable`, ...context],
    };
  }

  if (
    enoughHistory &&
    history.passRate === 1 &&
    signals.failedEveryAttempt &&
    signals.changedAppPaths.length > 0 &&
    signals.changedTestPaths.length === 0 &&
    signals.environmentMarkers.length === 0
  ) {
    return {
      decided: true,
      class: 'regression',
      reasons: [
        `stable before (${history.runs}/${history.runs} passed), fails on every attempt now`,
        `diff touches owned application code: ${signals.changedAppPaths.join(', ')}`,
        ...context,
      ],
    };
  }

  const hints: string[] = [];
  if (signals.environmentMarkers.length > 0) {
    hints.push(`infrastructure marker(s) ${signals.environmentMarkers.join(', ')} but application code also changed`);
  }
  if (!enoughHistory) {
    hints.push(`only ${history.runs} prior run(s), below the ${config.minHistory} needed to trust history`);
  }
  if (signals.changedAppPaths.length > 0) {
    hints.push(`diff touches owned application code: ${signals.changedAppPaths.join(', ')}`);
  }
  if (signals.changedTestPaths.length > 0) {
    hints.push(`diff touches test code or data: ${signals.changedTestPaths.join(', ')}`);
  }
  if (signals.testDataMarkers.length > 0) {
    hints.push(`test-data marker(s): ${signals.testDataMarkers.join(', ')}`);
  }
  return { decided: false, reasons: ['no deterministic rule fired', ...hints, ...context] };
}
