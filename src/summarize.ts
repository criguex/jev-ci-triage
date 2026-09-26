const CODE_FRAME = /^\s*>?\s*\d+\s*\|/;
const GENERIC = /^Test timeout of \d+ms exceeded\.?$/;

function unquote(text: string): string {
  return text.trim().replace(/,$/, '').replace(/^"(.*)"$/, '$1');
}

export function summarizeError(message: string | undefined, max = 240): string {
  if (!message) {
    return 'no error message';
  }
  const lines = message.split('\n');
  const cut = lines.findIndex((line) => CODE_FRAME.test(line));
  const body = (cut === -1 ? lines : lines.slice(0, cut)).map((line) => line.trimEnd());
  const headlines = body.filter((line) => /^\w*Error\b|^\w+\.\w+:|^Test timeout/.test(line.trim()));
  const head = headlines.find((line) => !GENERIC.test(line.trim())) ?? headlines[0] ?? body.find((line) => line.trim()) ?? '';
  const details: string[] = [];
  const expected = body.find((line) => /^Expected:/.test(line.trim()));
  const received = body.find((line) => /^Received:/.test(line.trim()));
  if (expected && received) {
    details.push(`${expected.trim()}, ${received.trim()}`);
  }
  const missing = body.filter((line) => /^-\s{2,}\S/.test(line.trim())).map((line) => unquote(line.trim().slice(1)));
  const extra = body.filter((line) => /^\+\s{2,}\S/.test(line.trim())).map((line) => unquote(line.trim().slice(1)));
  if (missing.length > 0 || extra.length > 0) {
    details.push([missing.length ? `missing ${missing.join(', ')}` : '', extra.length ? `unexpected ${extra.join(', ')}` : ''].filter(Boolean).join('; '));
  }
  const waiting = body.find((line) => /waiting for /.test(line));
  if (waiting && !head.includes('toHaveText')) {
    details.push(waiting.trim().replace(/^- /, ''));
  }
  const summary = [head.trim(), ...details].filter(Boolean).join(' · ');
  return summary.length > max ? `${summary.slice(0, max - 1)}…` : summary;
}
