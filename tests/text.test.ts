import { describe, expect, it } from 'vitest';
import { matches } from '../src/glob.js';
import { redact } from '../src/redact.js';
import { summarizeError } from '../src/summarize.js';

describe('summarizeError', () => {
  it('keeps the useful part of a Playwright array diff', () => {
    const message = [
      'Error: expect(locator).toHaveText(expected) failed',
      '',
      '  Array [',
      '-   "Milk",',
      '+   "Oat milk",',
      '    "Eggs",',
      '  ]',
      '',
      '> 14 |   await expect(list).toHaveText([...]);',
    ].join('\n');
    expect(summarizeError(message)).toBe('Error: expect(locator).toHaveText(expected) failed · missing Milk; unexpected Oat milk');
  });

  it('prefers the specific action error over the generic timeout line', () => {
    const message = "Test timeout of 8000ms exceeded.\n\nError: locator.check: Test timeout of 8000ms exceeded.\nCall log:\n  - waiting for getByLabel('Mark all')";
    expect(summarizeError(message)).toBe("Error: locator.check: Test timeout of 8000ms exceeded. · waiting for getByLabel('Mark all')");
  });
});

describe('redact', () => {
  it('removes credentials, emails, card-like numbers and home paths before anything leaves the machine', () => {
    const text = 'Authorization: Bearer abc.def.ghijklmnop user=ana@example.com card 4111 1111 1111 1111 at /Users/ana/app/x.ts token=s3cr3tvalue';
    const clean = redact(text);
    expect(clean).not.toMatch(/abc\.def|ana@example|4111|\/Users\/ana|s3cr3tvalue/);
  });
});

describe('glob', () => {
  it('supports ** and *', () => {
    expect(matches('src/a/b/c.ts', 'src/**')).toBe(true);
    expect(matches('tests/x.spec.ts', '**/*.spec.*')).toBe(true);
    expect(matches('src/a.ts', 'src/*.js')).toBe(false);
  });
});
