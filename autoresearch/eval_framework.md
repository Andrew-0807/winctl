# Eval Framework — WinCTL Daemon Startup Time

## Primary Metric
`startup` timer (ms) — from `console.time('startup')` at top of `main()` to `console.timeEnd('startup')` inside `httpServer.listen()` callback.

## Baseline
19.5 ms (measured 2026-04-07, node dist-server/index.js on Windows 11)

## Measurement Protocol
```bash
node E:/Programming/winctl/dist-server/index.js > E:/Programming/winctl/autoresearch/run.log 2>&1 &
PID=$!
sleep 5
kill $PID 2>/dev/null
grep -E "startup:" E:/Programming/winctl/autoresearch/run.log
```
Run 3x, take median.

## Scoring
- Score = baseline_ms / measured_ms  (>1.0 = improvement)
- Keep if score >= 1.05 (5% improvement threshold)
- Keep if score >= 0.99 AND code is simpler (simplicity criterion)
- Discard if score < 0.99 (regression)
- Crash = process exits before printing "WinCTL running"

## Eval Questions
1. Does the server still start successfully?
2. Does "WinCTL running" appear in output?
3. Is the startup time lower than baseline?
4. Is functional behavior preserved (config loads, routes available)?
