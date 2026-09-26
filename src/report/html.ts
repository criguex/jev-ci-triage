import type { Classification, FailureClass, TriageReport } from '../types.js';
import { BASIS_LABEL, CLASS_ACTION, CLASS_LABEL, CLASS_ORDER } from './guidance.js';

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TOKEN: Record<FailureClass, string> = {
  regression: 'var(--c-regression)',
  unknown: 'var(--c-unknown)',
  'test-data': 'var(--c-data)',
  environment: 'var(--c-env)',
  flaky: 'var(--c-flaky)',
};

function distribution(entry: Classification): string {
  if (!entry.jev) {
    return entry.jevError
      ? `<p class="muted">Jev unavailable: <code>${escape(entry.jevError.slice(0, 280))}</code></p>`
      : '';
  }
  const bars = Object.entries(entry.jev.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(
      ([name, value]) =>
        `<div class="dist-row"><span>${escape(name)}</span><span class="track"><span class="fill" style="width:${(value * 100).toFixed(1)}%;background:${TOKEN[name as FailureClass] ?? 'var(--muted)'}"></span></span><span class="num">${value.toFixed(2)}</span></div>`,
    )
    .join('');
  const retry = entry.jev.retryWouldPass === null ? '' : ` · P(pass if re-run) ${entry.jev.retryWouldPass.toFixed(2)}`;
  const latency = entry.jev.latencyMs === null ? '' : ` · ${entry.jev.latencyMs} ms`;
  return `<div class="dist"><p class="muted">Jev (${escape(entry.jev.model)}) confidence ${entry.jev.confidence.toFixed(2)}${retry}${latency}</p>${bars}</div>`;
}

function card(entry: Classification): string {
  return `<article class="card" style="--accent:${TOKEN[entry.class]}">
  <header><h3>${escape(entry.title)}</h3><span class="chip">${escape(BASIS_LABEL[entry.basis])}</span></header>
  <p class="file">${escape(entry.file)}</p>
  <pre>${escape(entry.error)}</pre>
  <details><summary>Why</summary><ul>${entry.reasons.map((reason) => `<li>${escape(reason)}</li>`).join('')}</ul>${distribution(entry)}</details>
</article>`;
}

export function renderHtml(report: TriageReport): string {
  const { totals } = report;
  const human = totals.byBasis['jev-low-confidence'] + totals.byBasis.unverified;
  const stack = CLASS_ORDER.filter((name) => totals.byClass[name] > 0)
    .map(
      (name) =>
        `<span style="flex:${totals.byClass[name]};background:${TOKEN[name]}" title="${CLASS_LABEL[name]}: ${totals.byClass[name]}"></span>`,
    )
    .join('');
  const tiles = CLASS_ORDER.map(
    (name) => `<div class="tile" style="--accent:${TOKEN[name]}"><div class="count">${totals.byClass[name]}</div><div class="label">${CLASS_LABEL[name]}</div><p>${escape(CLASS_ACTION[name])}</p></div>`,
  ).join('');
  const sections = CLASS_ORDER.map((name) => {
    const entries = report.classifications.filter((entry) => entry.class === name);
    return entries.length === 0 ? '' : `<section><h2>${CLASS_LABEL[name]} <span class="muted">${entries.length}</span></h2>${entries.map(card).join('')}</section>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CI Failure Triage</title>
<style>
:root{--bg:#f7f7f5;--surface:#fff;--text:#1c1d1f;--muted:#62656b;--line:#e3e3df;--c-regression:#c43d2f;--c-unknown:#8a6d1f;--c-data:#7a4fb5;--c-env:#2f6fb3;--c-flaky:#3e8a5a;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141517;--surface:#1d1f22;--text:#ececea;--muted:#a1a4aa;--line:#303236;--c-regression:#ef6a5b;--c-unknown:#d6b04e;--c-data:#b18ae6;--c-env:#6fa8e8;--c-flaky:#6cc18b;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#141517;--surface:#1d1f22;--text:#ececea;--muted:#a1a4aa;--line:#303236;--c-regression:#ef6a5b;--c-unknown:#d6b04e;--c-data:#b18ae6;--c-env:#6fa8e8;--c-flaky:#6cc18b;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:26px;margin:0 0 4px;letter-spacing:-.01em}
h2{font-size:18px;margin:36px 0 12px}
h3{font-size:15px;margin:0;font-weight:600}
.muted{color:var(--muted);font-weight:400}
.lead{font-size:17px;margin:12px 0 20px}
.stack{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px;margin-bottom:20px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}
.tile{background:var(--surface);border:1px solid var(--line);border-top:3px solid var(--accent);border-radius:8px;padding:14px}
.tile .count{font-size:30px;font-weight:650;color:var(--accent);line-height:1}
.tile .label{font-weight:600;margin:6px 0 4px}
.tile p{margin:0;color:var(--muted);font-size:13px}
.card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:8px;padding:14px 16px;margin-bottom:10px}
.card header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.chip{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 9px;white-space:nowrap;color:var(--muted)}
.file{margin:2px 0 8px;color:var(--muted);font-size:13px}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font:12.5px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--bg);border-radius:6px;padding:8px 10px}
code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-word}
details{margin-top:10px}
summary{cursor:pointer;color:var(--muted);font-size:13px}
ul{margin:8px 0;padding-left:20px}
.dist{margin-top:8px}
.dist p{margin:0 0 6px;font-size:13px}
.dist-row{display:grid;grid-template-columns:90px 1fr 40px;gap:8px;align-items:center;font-size:12.5px;margin:3px 0}
.track{background:var(--bg);border-radius:4px;height:8px;overflow:hidden}
.fill{display:block;height:100%}
.num{text-align:right;font-variant-numeric:tabular-nums}
footer{margin-top:40px;color:var(--muted);font-size:13px;border-top:1px solid var(--line);padding-top:14px}
</style>
</head>
<body>
<main>
<h1>CI failure triage</h1>
<p class="muted">${escape(report.source)} · ${escape(report.generatedAt)}</p>
<p class="lead"><strong>${totals.failing}</strong> of ${totals.tests} tests failed. ${totals.byBasis.deterministic} were decided by deterministic rules, ${totals.byBasis.jev} by Jev, and ${human} are left for a person.</p>
<div class="stack">${stack}</div>
<div class="tiles">${tiles}</div>
${sections}
<footer>Jev mode: ${escape(report.jevMode)} · confidence threshold ${report.confidenceThreshold}. Nothing was re-run, skipped or hidden: every failure above is still a failure in CI. Jev confidence is used only to decide what goes to a human.</footer>
</main>
</body>
</html>
`;
}
