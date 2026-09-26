import { readFileSync } from 'node:fs';
import type { TriageReport } from '../src/types.js';

interface Truth {
  expected: string;
  seeded: string;
}

const [reportPath = 'report/triage.json', truthPath = 'demo/scenario/ground-truth.json'] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, 'utf8')) as TriageReport;
const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as Record<string, Truth>;

let correct = 0;
let wrong = 0;
let deferred = 0;
const rows = report.classifications.map((entry) => {
  const expected = truth[entry.id]?.expected ?? '(no label)';
  const leaning = entry.jev && entry.class === 'unknown' ? ` (Jev leaned ${entry.jev.choice} ${entry.jev.confidence.toFixed(2)})` : '';
  let outcome: string;
  if (entry.class === expected) {
    correct += 1;
    outcome = 'correct';
  } else if (entry.class === 'unknown') {
    deferred += 1;
    outcome = 'sent to a human';
  } else {
    wrong += 1;
    outcome = 'WRONG';
  }
  return `| ${entry.title} | ${expected} | ${entry.class}${leaning} | ${entry.basis} | ${outcome} |`;
});

process.stdout.write(
  [
    '| Test | Seeded as | Tool said | Decided by | Outcome |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
    `correct ${correct} · sent to a human ${deferred} · wrong ${wrong} · of ${report.classifications.length} failures`,
    '',
  ].join('\n'),
);
process.exit(wrong > 0 ? 1 : 0);
