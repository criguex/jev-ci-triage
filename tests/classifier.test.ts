import { describe, expect, it } from 'vitest';
import { classifyDeterministically } from '../src/classifier.js';
import { config, signals } from './helpers.js';

const classOf = (overrides: Parameters<typeof signals>[0]) => {
  const verdict = classifyDeterministically(signals(overrides), config);
  return verdict.decided ? verdict.class : 'ambiguous';
};

describe('classifyDeterministically', () => {
  it('calls a test that passed on a retry within the same run flaky', () => {
    expect(classOf({ verdict: 'flaky', passedOnRetry: true, failedEveryAttempt: false })).toBe('flaky');
  });

  it('calls infrastructure markers environment when no owned app code changed', () => {
    expect(classOf({ environmentMarkers: ['ECONNREFUSED'] })).toBe('environment');
  });

  it('does not blame the environment when owned app code also changed', () => {
    expect(classOf({ environmentMarkers: ['ECONNREFUSED'], changedAppPaths: ['src/api.ts'] })).toBe('ambiguous');
  });

  it('calls a test with repeated flips in history flaky', () => {
    const history = { runs: 8, passed: 5, failed: 3, flakyInRun: 0, passRate: 5 / 8, flips: 4, sequence: [] };
    expect(classOf({ history })).toBe('flaky');
  });

  it('needs at least minHistory runs before trusting flips', () => {
    const history = { runs: 3, passed: 2, failed: 1, flakyInRun: 0, passRate: 2 / 3, flips: 2, sequence: [] };
    expect(classOf({ history })).toBe('ambiguous');
  });

  it('calls a stable test that now fails every attempt with an owned code change a regression', () => {
    expect(classOf({ changedAppPaths: ['src/filters.ts'] })).toBe('regression');
  });

  it('refuses to call it a regression when the diff also touches the test or its data', () => {
    expect(classOf({ changedAppPaths: ['src/filters.ts'], changedTestPaths: ['tests/fixtures/users.json'] })).toBe('ambiguous');
  });

  it('refuses to call it a regression without a related code change', () => {
    expect(classOf({})).toBe('ambiguous');
  });

  it('never decides test-data deterministically and explains why it deferred', () => {
    const verdict = classifyDeterministically(
      signals({ testDataMarkers: ['uniqueness conflict'], changedTestPaths: ['tests/fixtures/users.json'] }),
      config,
    );
    expect(verdict.decided).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/test-data marker/);
    expect(verdict.reasons.join(' ')).toMatch(/tests\/fixtures\/users.json/);
  });
});
