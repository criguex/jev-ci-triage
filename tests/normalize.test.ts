import { describe, expect, it } from 'vitest';
import { MalformedAnswerError, normalizeAnswer, normalizeAnswers } from '../src/jev/normalize.js';
import type { ChoiceQuestion, NoulQuestion } from '../src/jev/types.js';

const noul: NoulQuestion = { type: 'noul', instructions: 'Would a retry pass?' };
const choice: ChoiceQuestion = { type: 'choice', instructions: 'Cause?', criteria: { regression: 'r', flaky: 'f' } };

describe('normalizeAnswer', () => {
  it('reads the native noul field', () => {
    expect(normalizeAnswer({ type: 'noul', noul: 0.41 }, noul)).toEqual({ type: 'noul', probability: 0.41 });
  });

  it('reads the gateway boolean/probability shape', () => {
    expect(normalizeAnswer({ type: 'boolean', probability: 0.9 }, noul)).toEqual({ type: 'noul', probability: 0.9 });
    expect(normalizeAnswer({ type: 'boolean', boolean: true }, noul)).toEqual({ type: 'noul', probability: 1 });
  });

  it('rejects probabilities outside 0..1', () => {
    expect(() => normalizeAnswer({ type: 'noul', noul: 1.4 }, noul)).toThrow(MalformedAnswerError);
    expect(() => normalizeAnswer({ type: 'noul' }, noul)).toThrow(MalformedAnswerError);
  });

  it('fills missing options with zero and keeps the reported confidence', () => {
    const answer = normalizeAnswer({ type: 'choice', choice: 'flaky', probabilities: { flaky: 0.8 }, confidence: 0.72 }, choice);
    expect(answer).toEqual({ type: 'choice', choice: 'flaky', probabilities: { regression: 0, flaky: 0.8 }, confidence: 0.72 });
  });

  it('falls back to the chosen probability when confidence is absent', () => {
    const answer = normalizeAnswer({ choice: 'regression', probabilities: { regression: 0.66, flaky: 0.34 } }, choice);
    expect(answer.type === 'choice' && answer.confidence).toBe(0.66);
  });

  it('rejects a choice that is not one of the offered options', () => {
    expect(() => normalizeAnswer({ type: 'choice', choice: 'bug', probabilities: {} }, choice)).toThrow(/not one of/);
  });

  it('rejects a type mismatch', () => {
    expect(() => normalizeAnswer({ type: 'score', score: 2 }, choice)).toThrow(MalformedAnswerError);
  });
});

describe('normalizeAnswers', () => {
  it('fails when a question has no answer', () => {
    expect(() => normalizeAnswers({ cause: { choice: 'flaky' } }, { cause: choice, retry: noul })).toThrow(/missing answer for "retry"/);
  });
});
