import { readFileSync } from 'node:fs';

export interface TriageConfig {
  appPaths: string[];
  testPaths: string[];
  ownership: Record<string, string[]>;
  minHistory: number;
  confidenceThreshold: number;
}

export const DEFAULT_CONFIG: TriageConfig = {
  appPaths: ['src/**', 'app/**', 'lib/**'],
  testPaths: ['tests/**', 'e2e/**', '**/*.spec.*', '**/*.test.*', '**/fixtures/**'],
  ownership: {},
  minHistory: 5,
  confidenceThreshold: 0.75,
};

export function loadConfig(path: string | undefined): TriageConfig {
  if (!path) {
    return DEFAULT_CONFIG;
  }
  const overrides = JSON.parse(readFileSync(path, 'utf8')) as Partial<TriageConfig>;
  return { ...DEFAULT_CONFIG, ...overrides };
}
