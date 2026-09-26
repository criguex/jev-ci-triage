import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { RunResult } from '../types.js';
import { parseJUnitXml } from './junit.js';
import { isPlaywrightJson, parsePlaywrightJson } from './playwright.js';

export function parseRun(path: string): RunResult {
  const raw = readFileSync(path, 'utf8');
  const source = basename(path);
  if (raw.trimStart().startsWith('<')) {
    return parseJUnitXml(raw, source);
  }
  const json: unknown = JSON.parse(raw);
  if (isPlaywrightJson(json)) {
    return parsePlaywrightJson(json, source);
  }
  throw new Error(`${path}: unsupported format (expected Playwright JSON or JUnit XML)`);
}

export function parseHistory(dir: string | undefined): RunResult[] {
  if (!dir) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => /\.(json|xml)$/i.test(name))
    .sort()
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile())
    .map(parseRun);
}
