# Autoresearch Operating Manual

## Goal
Reduce WinCTL daemon startup time (time from `node dist-server/index.js` invocation to "WinCTL running" log line).

## Metric
`startup` timer in milliseconds — added via `console.time('startup')` / `console.timeEnd('startup')` instrumentation.

## Build command
`cd E:/Programming/winctl ; npm run build:server`

## Measure command (PowerShell 7)
Run node, capture stdout lines containing "startup:", kill after 5s:
```powershell
$job = Start-Job { node E:/Programming/winctl/dist-server/index.js 2>&1 }
Start-Sleep -Seconds 4
$out = Receive-Job $job
Stop-Job $job; Remove-Job $job
$out | Select-String "startup:"
```

## Scope
Only modify: `server/index.ts`, `server/config.ts`, `server/process-manager.ts`

## Rules
- One hypothesis per commit
- Revert if metric regresses or crashes
- Simplicity criterion: equal metric + less code = keep
