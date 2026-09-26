export interface NoulQuestion {
  type: 'noul';
  instructions: string;
  criteria?: { true: string; false: string };
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export type Question = NoulQuestion | ChoiceQuestion;

export interface SystemOneRequest {
  model: string;
  state: string | Record<string, unknown>;
  questions: Record<string, Question>;
}

export interface NoulAnswer {
  type: 'noul';
  probability: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer;

export interface SystemOneResponse {
  model: string;
  answers: Record<string, unknown>;
  usage?: { input_tokens?: number; output_tokens?: number };
  provider_metadata?: { gateway?: { cost?: string } };
}

export interface Exchange {
  response: SystemOneResponse;
  latencyMs: number | null;
  recorded: boolean;
}

export interface Transport {
  readonly name: string;
  send(request: SystemOneRequest): Promise<Exchange>;
}
