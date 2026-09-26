import { describe, expect, it } from 'vitest';
import { triage } from '../src/engine.js';
import { JevUnavailableError } from '../src/jev/transports.js';
import type { Exchange, Transport } from '../src/jev/types.js';
import { config, outcome } from './helpers.js';

const ambiguous = { source: 'current', tests: [outcome(['failed', 'failed'], 'Error: expect(locator).toHaveText(expected) failed', 'data.spec.ts › seeded list')] };

function answering(choice: string, confidence: number): Transport {
  return {
    name: 'fake',
    send: async (): Promise<Exchange> => ({
      response: {
        model: 'jev-test',
        answers: {
          cause: { type: 'choice', choice, confidence, probabilities: { [choice]: confidence } },
          retryWouldPass: { type: 'noul', noul: 0.3 },
        },
      },
      latencyMs: 400,
      recorded: false,
    }),
  };
}

const run = (transport: Transport) => triage({ current: ambiguous, history: [], changedFiles: [], config, transport });

describe('triage', () => {
  it('accepts a confident Jev answer for an ambiguous failure', async () => {
    const [entry] = (await run(answering('test-data', 0.97))).classifications;
    expect(entry).toMatchObject({ class: 'test-data', basis: 'jev' });
  });

  it('routes a low-confidence Jev answer to a human as unknown, keeping the lean', async () => {
    const [entry] = (await run(answering('regression', 0.61))).classifications;
    expect(entry).toMatchObject({ class: 'unknown', basis: 'jev-low-confidence' });
    expect(entry?.jev?.choice).toBe('regression');
  });

  it('fails open: Jev down means unknown/unverified, never a guess', async () => {
    const down: Transport = {
      name: 'down',
      send: async () => {
        throw new JevUnavailableError('HTTP 529 via test: overloaded');
      },
    };
    const report = await run(down);
    expect(report.classifications[0]).toMatchObject({ class: 'unknown', basis: 'unverified', jevError: 'HTTP 529 via test: overloaded' });
    expect(report.totals.byBasis.unverified).toBe(1);
  });

  it('treats a malformed Jev answer as unverified', async () => {
    const [entry] = (await run(answering('bug', 0.99))).classifications;
    expect(entry).toMatchObject({ class: 'unknown', basis: 'unverified' });
    expect(entry?.jevError).toMatch(/not one of/);
  });

  it('never calls Jev when a rule decides', async () => {
    let calls = 0;
    const counting: Transport = {
      name: 'counting',
      send: async () => {
        calls += 1;
        throw new Error('should not be called');
      },
    };
    const current = { source: 'current', tests: [outcome(['failed', 'passed'])] };
    const report = await triage({ current, history: [], changedFiles: [], config, transport: counting });
    expect(report.classifications[0]).toMatchObject({ class: 'flaky', basis: 'deterministic' });
    expect(calls).toBe(0);
  });

  it('ignores passing and skipped tests', async () => {
    const current = { source: 'current', tests: [outcome(['passed']), outcome(['skipped'], '', 'b.spec.ts › skip')] };
    const report = await triage({ current, history: [], changedFiles: [], config, transport: answering('flaky', 1) });
    expect(report.totals).toMatchObject({ tests: 2, failing: 0 });
  });
});
