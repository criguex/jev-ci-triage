#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
RUNS="${RUNS:-8}"
OUT=demo/runs
mkdir -p "$OUT/history"

sanitize() {
  node -e '
    const fs = require("fs");
    const [file, root] = process.argv.slice(1);
    const text = fs.readFileSync(file, "utf8").split(root + "/").join("").split(root).join(".");
    fs.writeFileSync(file, text);
  ' "$1" "$ROOT"
}

for i in $(seq 1 "$RUNS"); do
  n=$(printf '%02d' "$i")
  DEMO_SCENARIO=baseline DEMO_RUN="$i" \
    DEMO_JSON_OUT="$ROOT/$OUT/history/run-$n.json" DEMO_JUNIT_OUT="$ROOT/demo/.results/run-$n.xml" \
    npx playwright test --config demo/playwright.config.ts >/dev/null 2>&1
  sanitize "$OUT/history/run-$n.json"
  echo "baseline run $n recorded"
done

for attempt in 1 2 3 4 5 6; do
  DEMO_SCENARIO=candidate DEMO_RUN=$((RUNS + 1)) SYNC_API_URL=http://127.0.0.1:9 \
    DEMO_JSON_OUT="$ROOT/$OUT/current.json" DEMO_JUNIT_OUT="$ROOT/$OUT/current.xml" \
    npx playwright test --config demo/playwright.config.ts >/dev/null 2>&1
  if node -e '
    const report = require(process.argv[1]);
    const specs = [];
    const walk = (suite) => { specs.push(...(suite.specs ?? [])); (suite.suites ?? []).forEach(walk); };
    report.suites.forEach(walk);
    const counter = specs.find((spec) => spec.title.startsWith("counter reflects"));
    process.exit(counter?.tests[0]?.results[0]?.status === "failed" ? 0 : 1);
  ' "$ROOT/$OUT/current.json"; then
    break
  fi
  echo "candidate attempt $attempt: flaky test happened to pass first try, recording again"
done
sanitize "$OUT/current.json"
sanitize "$OUT/current.xml"
echo "candidate run recorded"
