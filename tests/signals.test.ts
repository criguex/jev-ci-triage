import { describe, expect, it } from 'vitest';
import { computeSignals, historyOf, verdictOf } from '../src/signals.js';
import { config, outcome, runs } from './helpers.js';

describe('verdictOf', () => {
  it('distinguishes passed, flaky, failed and skipped', () => {
    expect(verdictOf(outcome(['passed']))).toBe('passed');
    expect(verdictOf(outcome(['failed', 'passed']))).toBe('flaky');
    expect(verdictOf(outcome(['failed', 'timedOut']))).toBe('failed');
    expect(verdictOf(outcome(['skipped']))).toBe('skipped');
  });
});

describe('historyOf', () => {
  it('counts first-try pass rate and flips, ignoring skipped runs', () => {
    const stats = historyOf('a.spec.ts › works', runs([['passed'], ['failed', 'passed'], ['skipped'], ['passed'], ['failed', 'failed']]));
    expect(stats.runs).toBe(4);
    expect(stats.passRate).toBe(0.5);
    expect(stats.flakyInRun).toBe(1);
    expect(stats.flips).toBe(3);
  });

  it('reports no history for an unseen test', () => {
    expect(historyOf('new.spec.ts › x', runs([['passed']])).passRate).toBeNull();
  });
});

describe('computeSignals', () => {
  it('detects infrastructure markers in error text', () => {
    const test = outcome(['failed'], 'Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:9');
    expect(computeSignals(test, [], [], config).environmentMarkers).toEqual(['ECONNREFUSED']);
  });

  it('treats 502/503/504 as infrastructure but not a plain 500', () => {
    const gateway = outcome(['failed'], 'GET /api -> 503 Service Unavailable');
    const server = outcome(['failed'], 'GET /api -> 500 Internal Server Error');
    expect(computeSignals(gateway, [], [], config).environmentMarkers).toContain('HTTP 502/503/504');
    expect(computeSignals(server, [], [], config).environmentMarkers).toEqual([]);
  });

  it('scopes changed files to what the test owns', () => {
    const scoped = { ...config, testPaths: ['tests/**'], ownership: { 'a.spec.ts': ['src/a/**', 'tests/fixtures/a.json'] } };
    const changed = ['src/a/index.ts', 'src/b/index.ts', 'tests/fixtures/a.json', 'tests/fixtures/b.json'];
    const result = computeSignals(outcome(['failed']), [], changed, scoped);
    expect(result.changedAppPaths).toEqual(['src/a/index.ts']);
    expect(result.changedTestPaths).toEqual(['tests/fixtures/a.json']);
  });

  it('flags a change to the test file itself', () => {
    const result = computeSignals(outcome(['failed']), [], ['tests/a.spec.ts'], config);
    expect(result.changedTestPaths).toEqual(['tests/a.spec.ts']);
  });
});
