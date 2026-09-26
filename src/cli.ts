#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { triage } from './engine.js';
import { createTransport, type JevMode } from './jev/transports.js';
import { parseHistory, parseRun } from './parsers/index.js';
import { renderHtml } from './report/html.js';
import { renderMarkdown } from './report/markdown.js';
import type { FailureClass } from './types.js';

const MODES: JevMode[] = ['auto', 'live', 'record', 'replay', 'off'];

const USAGE = `Usage: jev-ci-triage --results <report.json|junit.xml> [options]

  --results <path>         Current run: Playwright JSON or JUnit XML (required)
  --history <dir>          Directory of earlier runs, same formats, sorted by file name
  --changed-files <path>   Newline-separated list of files changed in this diff
  --config <path>          JSON config (appPaths, testPaths, ownership, minHistory, confidenceThreshold)
  --out <dir>              Output directory (default: triage-report)
  --jev <mode>             auto | live | record | replay | off (default: auto)
  --fixtures <dir>         Recorded Jev responses (default: <config dir>/jev-fixtures or jev-fixtures)
  --fail-on <classes>      Comma-separated classes that make the command exit 1 (e.g. regression,unknown)
`;

function loadEnvFile(): void {
  if (existsSync('.env')) {
    try {
      process.loadEnvFile('.env');
    } catch {
      return;
    }
  }
}

function readChangedFiles(path: string | undefined): string[] {
  if (!path) {
    return [];
  }
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      results: { type: 'string' },
      history: { type: 'string' },
      'changed-files': { type: 'string' },
      config: { type: 'string' },
      out: { type: 'string', default: 'triage-report' },
      jev: { type: 'string', default: 'auto' },
      fixtures: { type: 'string' },
      'fail-on': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !values.results) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 2;
  }
  const mode = values.jev as JevMode;
  if (!MODES.includes(mode)) {
    process.stderr.write(`Unknown --jev mode "${mode}"\n${USAGE}`);
    return 2;
  }
  loadEnvFile();
  const config = loadConfig(values.config);
  const fixtures = values.fixtures ?? (values.config ? join(values.config, '..', 'jev-fixtures') : 'jev-fixtures');
  const transport = createTransport(mode, fixtures, process.env);

  const report = await triage({
    current: parseRun(values.results),
    history: parseHistory(values.history),
    changedFiles: readChangedFiles(values['changed-files']),
    config,
    transport,
  });

  mkdirSync(values.out, { recursive: true });
  writeFileSync(join(values.out, 'triage.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(values.out, 'triage.md'), renderMarkdown(report));
  writeFileSync(join(values.out, 'index.html'), renderHtml(report));

  const summary = Object.entries(report.totals.byClass)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}=${count}`)
    .join(' ');
  process.stdout.write(
    `jev-ci-triage: ${report.totals.failing} failing of ${report.totals.tests} · ${summary || 'nothing to triage'} · Jev ${transport.name}\n` +
      `report: ${join(values.out, 'index.html')}\n`,
  );
  for (const entry of report.classifications.filter((item) => item.jevError)) {
    process.stderr.write(`  Jev error for "${entry.title}": ${entry.jevError}\n`);
  }

  const failOn = (values['fail-on'] ?? '').split(',').map((name) => name.trim()).filter(Boolean) as FailureClass[];
  return failOn.some((name) => report.totals.byClass[name] > 0) ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    process.stderr.write(`jev-ci-triage: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  },
);
