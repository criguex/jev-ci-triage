import type { Answer, ChoiceQuestion, Question } from './types.js';

export class MalformedAnswerError extends Error {}

function probability(value: unknown, field: string): number {
  const number = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) {
    throw new MalformedAnswerError(`${field} is not a probability: ${JSON.stringify(value)}`);
  }
  return number;
}

function normalizeChoice(raw: Record<string, unknown>, question: ChoiceQuestion): Answer {
  const options = Object.keys(question.criteria);
  const choice = raw.choice;
  if (typeof choice !== 'string' || !options.includes(choice)) {
    throw new MalformedAnswerError(`choice ${JSON.stringify(choice)} is not one of ${options.join('|')}`);
  }
  const rawProbabilities = (raw.probabilities ?? {}) as Record<string, unknown>;
  const probabilities = Object.fromEntries(
    options.map((option) => [option, probability(rawProbabilities[option] ?? 0, `probabilities.${option}`)]),
  );
  const confidence = raw.confidence === undefined ? probabilities[choice]! : probability(raw.confidence, 'confidence');
  return { type: 'choice', choice, probabilities, confidence };
}

export function normalizeAnswer(raw: unknown, question: Question): Answer {
  if (typeof raw !== 'object' || raw === null) {
    throw new MalformedAnswerError(`answer is not an object: ${JSON.stringify(raw)}`);
  }
  const answer = raw as Record<string, unknown>;
  if (question.type === 'noul') {
    if (answer.type !== undefined && answer.type !== 'noul' && answer.type !== 'boolean') {
      throw new MalformedAnswerError(`expected noul/boolean, got ${String(answer.type)}`);
    }
    const value = answer.noul ?? answer.probability ?? answer.boolean;
    return { type: 'noul', probability: probability(value, 'noul') };
  }
  if (answer.type !== undefined && answer.type !== 'choice') {
    throw new MalformedAnswerError(`expected choice, got ${String(answer.type)}`);
  }
  return normalizeChoice(answer, question);
}

export function normalizeAnswers(
  answers: Record<string, unknown>,
  questions: Record<string, Question>,
): Record<string, Answer> {
  return Object.fromEntries(
    Object.entries(questions).map(([key, question]) => {
      if (!(key in answers)) {
        throw new MalformedAnswerError(`missing answer for "${key}"`);
      }
      return [key, normalizeAnswer(answers[key], question)];
    }),
  );
}
