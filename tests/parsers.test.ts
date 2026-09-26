import { describe, expect, it } from 'vitest';
import { parseRun } from '../src/parsers/index.js';
import { parseJUnitXml } from '../src/parsers/junit.js';
import { verdictOf } from '../src/signals.js';

describe('Playwright JSON parser', () => {
  it('reads every test with all its attempts from the recorded demo run', () => {
    const run = parseRun('demo/runs/current.json');
    expect(run.tests).toHaveLength(11);
    const failing = run.tests.filter((test) => verdictOf(test) !== 'passed' && verdictOf(test) !== 'skipped');
    expect(failing.length).toBeGreaterThanOrEqual(5);
    const sync = run.tests.find((test) => test.file === 'sync.spec.ts');
    expect(sync?.attempts).toHaveLength(2);
    expect(sync?.attempts[0]?.error).toMatch(/ECONNREFUSED/);
    expect(sync?.attempts[0]?.error).not.toMatch(/\u001b\[/);
  });
});

describe('JUnit XML parser', () => {
  it('reads the same demo run exported as JUnit', () => {
    const run = parseRun('demo/runs/current.xml');
    expect(run.tests).toHaveLength(11);
    expect(run.tests.find((test) => test.title.includes('backup service'))?.attempts.at(-1)?.error).toMatch(/ECONNREFUSED/);
  });

  it('turns surefire-style flakyFailure elements into earlier attempts', () => {
    const xml = `<testsuites><testsuite name="s">
      <testcase name="retry me" classname="Suite" time="0.5"><flakyFailure message="boom">stack</flakyFailure></testcase>
      <testcase name="broken" classname="Suite" time="0.1"><failure message="expected 1">trace</failure></testcase>
      <testcase name="off" classname="Suite"><skipped/></testcase>
    </testsuite></testsuites>`;
    const [retry, broken, off] = parseJUnitXml(xml, 'x.xml').tests;
    expect(verdictOf(retry!)).toBe('flaky');
    expect(verdictOf(broken!)).toBe('failed');
    expect(broken!.attempts[0]!.error).toBe('expected 1\ntrace');
    expect(verdictOf(off!)).toBe('skipped');
  });
});
