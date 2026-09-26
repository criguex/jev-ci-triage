import type { Classification, TriageReport } from '../types.js';
import { BASIS_LABEL, CLASS_ACTION, CLASS_LABEL, CLASS_ORDER } from './guidance.js';

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function row(entry: Classification): string {
  const jev = entry.jev ? `${entry.jev.choice} ${entry.jev.confidence.toFixed(2)}` : entry.jevError ? 'unavailable' : '—';
  return `| ${cell(entry.title)} | ${cell(entry.file)} | ${BASIS_LABEL[entry.basis]} | ${jev} | ${cell(entry.error)} |`;
}

export function renderMarkdown(report: TriageReport): string {
  const { totals } = report;
  const lines = [
    '# CI failure triage',
    '',
    `**${totals.failing}** failing of ${totals.tests} tests in \`${report.source}\`. ` +
      `Decided by rules: ${totals.byBasis.deterministic}; by Jev: ${totals.byBasis.jev}; ` +
      `left for a human: ${totals.byBasis['jev-low-confidence'] + totals.byBasis.unverified}.`,
    '',
    '| Class | Count | What to do |',
    '| --- | ---: | --- |',
    ...CLASS_ORDER.map((name) => `| ${CLASS_LABEL[name]} | ${totals.byClass[name]} | ${CLASS_ACTION[name]} |`),
    '',
  ];
  for (const name of CLASS_ORDER) {
    const entries = report.classifications.filter((entry) => entry.class === name);
    if (entries.length === 0) {
      continue;
    }
    lines.push(`## ${CLASS_LABEL[name]} (${entries.length})`, '', '| Test | File | Decided by | Jev | Error |', '| --- | --- | --- | --- | --- |');
    lines.push(...entries.map(row), '');
    for (const entry of entries) {
      lines.push(`<details><summary>${cell(entry.title)}</summary>`, '', ...entry.reasons.map((reason) => `- ${reason}`));
      if (entry.jevError) {
        lines.push(`- Jev error: \`${cell(entry.jevError.slice(0, 300))}\``);
      }
      lines.push('', '</details>', '');
    }
  }
  lines.push(
    '---',
    `Jev mode: ${report.jevMode} · confidence threshold ${report.confidenceThreshold} · generated ${report.generatedAt}. ` +
      'Failures are never re-run or hidden by this tool.',
    '',
  );
  return lines.join('\n');
}
