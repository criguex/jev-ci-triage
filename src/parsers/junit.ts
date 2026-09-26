import { XMLParser } from 'fast-xml-parser';
import type { Attempt, RunResult, TestOutcome } from '../types.js';

type Node = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  isArray: (name) => ['testsuite', 'testcase', 'failure', 'error', 'flakyFailure', 'flakyError', 'rerunFailure', 'rerunError'].includes(name),
});

function text(node: Node): string {
  const message = typeof node.message === 'string' ? node.message : '';
  const body = typeof node['#text'] === 'string' ? node['#text'] : '';
  return [message, body].filter(Boolean).join('\n');
}

function list(node: Node, key: string): Node[] {
  return (node[key] as Node[] | undefined) ?? [];
}

function suitesOf(root: Node): Node[] {
  const container = (root.testsuites as Node | undefined) ?? root;
  return list(container, 'testsuite').flatMap((suite) => [suite, ...suitesOf(suite)]);
}

function toOutcome(testcase: Node, suiteName: string): TestOutcome {
  const name = String(testcase.name ?? 'unnamed');
  const file = String(testcase.file ?? testcase.classname ?? suiteName);
  const durationMs = Math.round(Number(testcase.time ?? 0) * 1000);
  const failure = [...list(testcase, 'failure'), ...list(testcase, 'error')][0];
  const retries = [
    ...list(testcase, 'flakyFailure'),
    ...list(testcase, 'flakyError'),
    ...list(testcase, 'rerunFailure'),
    ...list(testcase, 'rerunError'),
  ];
  const earlier: Attempt[] = retries.map((node) => ({ status: 'failed', durationMs: 0, error: text(node) }));
  const final: Attempt = failure
    ? { status: 'failed', durationMs, error: text(failure) }
    : testcase.skipped !== undefined
      ? { status: 'skipped', durationMs }
      : { status: 'passed', durationMs };
  return {
    id: `${file} › ${name}`,
    title: name,
    file,
    attempts: [...earlier, final],
  };
}

export function parseJUnitXml(xml: string, source: string): RunResult {
  const root = parser.parse(xml) as Node;
  const tests = suitesOf(root).flatMap((suite) =>
    list(suite, 'testcase').map((testcase) => toOutcome(testcase, String(suite.name ?? ''))),
  );
  return { source, tests };
}
