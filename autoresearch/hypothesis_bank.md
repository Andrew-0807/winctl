# Hypothesis Bank

Priority order (highest first). Move completed hypotheses to bottom with result.

## Active

### H1 [HIGH] — Defer loadSettings() from module level to inside main()
`server/index.ts` line 56 calls `loadSettings()` at module top-level before main() starts, 
causing a synchronous FS read during module evaluation. Move it inside main() so it runs 
after the timer starts and can be measured. But more importantly: the module-level call 
happens BEFORE `console.time('startup')` so it's unmeasured overhead. Moving it inside 
main() + combining with ensureConfigDirs/migrateSettings could reduce total FS ops.

### H2 [HIGH] — Parallelize sequential startup FS calls
`ensureConfigDirs()`, `migrateSettings()`, `ensureApiSecret()`, `loadSessions()` run 
sequentially. `ensureConfigDirs` + `migrateSettings` are independent. Use Promise.all 
with async versions or reorder to overlap FS work.

### H3 [HIGH] — Skip existsSync checks in ensureConfigDirs for already-existing dirs
On every startup, `ensureConfigDirs()` calls `fs.existsSync()` for CONFIG_DIR, THEMES_DIR, 
and up to 15 theme JSON files. On a warm system these all exist. Use a module-level 
`initialized` flag to skip after first call, or use mkdirSync with `{recursive:true}` 
and catch EEXIST, skipping the existsSync overhead.

### H4 [MEDIUM] — Lazy-require systray (already at module level via require())
`require('systray')` at line 103 runs synchronously at module load. Move it inside 
`initTray()` which is called via `setTimeout(initTray, 500)` — after listen. This removes 
the require cost from the critical path.

### H5 [MEDIUM] — Skip writing default themes that already exist with a fast stat check
`ensureConfigDirs()` calls `fs.existsSync(themePath)` for each of 15 themes on every 
startup. Replace with a single directory read (`fs.readdirSync`) to get all existing files, 
then only write missing ones — 1 syscall instead of 15+.

### H6 [MEDIUM] — Avoid redundant loadSettings() calls during startup
`main()` calls: `loadSettings()` at module level (line 56), then `ensureApiSecret()` 
calls `loadSettings()` again. With the 5s cache this is fast but still two calls. 
The cache handles it but the first call at module level is pre-timer.

### H7 [LOW] — Reduce static path resolution fs.existsSync loop
4 `existsSync` calls in the static candidates loop. Can be reduced by checking exe path 
once and building smarter candidates, or caching the result.

### H8 [LOW] — Move global error handler registration after timer start
`process.on('uncaughtException')` and `process.on('unhandledRejection')` run at module 
load. Not measurable by timer but reducing module-level work could marginally help.

### H9 [LOW] — Use fs.promises for config dir creation (async mkdir)
Convert `ensureConfigDirs()` to async using `fs.promises.mkdir` with recursive, 
allowing non-blocking execution.

### H10 [SPECULATIVE] — Reduce theme count written at startup
15 built-in themes are checked/written every startup. Move to lazy initialization 
(write on first access) to skip all theme FS work on startup.

## Completed
(none yet)
