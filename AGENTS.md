# WinCTL Agent Instructions

## Project Overview
WinCTL is a Tauri 2 app (Rust + React/TypeScript) for managing Windows processes and services via a web UI.

### Architecture
- **Backend**: Rust with Tauri 2 (src-tauri/)
- **Frontend**: React 19 + TypeScript + Vite (src/)
- **State**: Zustand (frontend), tokio + axum (backend)
- **Build**: `npm run tauri build` → MSI/NSIS installers

### Tech Stack
- React 19, TypeScript, Vite 6
- Tauri 2 (tray-icon, shell plugin)
- Zustand 5, Framer Motion 12, dnd-kit
- Rust: tokio, axum, tower-http

## Build Commands
```bash
npm run dev          # Dev mode (Vite + Tauri)
npm run build        # Frontend only (vite build)
npm run tauri build  # Full build (frontend + Rust) → MSI/NSIS
npm run typecheck    # TypeScript check (tsc --noEmit)
```

## Context-Mode Rules (MANDATORY)

### BLOCKED Commands
- **curl/wget** — Use `context-mode_ctx_fetch_and_index()` or sandbox fetch
- **Inline HTTP** — Use `context-mode_ctx_execute()` sandbox

### REDIRECTED Tools
- **Shell (>20 lines)**: Use `context-mode_ctx_batch_execute()` or `context-mode_ctx_execute()`
- **File reading (analysis)**: Use `context-mode_ctx_execute_file()` — only summary enters context
- **File reading (editing)**: Use `read` tool — content needed for edits
- **Large searches**: Use `context-mode_ctx_execute()` with grep — only summary enters context

### Tool Hierarchy
1. `context-mode_ctx_batch_execute()` — primary gather tool
2. `context-mode_ctx_search()` — query indexed content
3. `context-mode_ctx_execute()` / `context-mode_ctx_execute_file()` — sandbox execution
4. `context-mode_ctx_fetch_and_index()` — web fetch + index

## Rust Development

### Cargo Target
The project uses MSVC target: `x86_64-pc-windows-msvc`
- Config: `src-tauri/.cargo/config.toml`
- If build fails with GNU target errors, verify this setting

### Key Crates
- `tauri` — app framework
- `tokio` — async runtime
- `axum` — HTTP server
- `winreg` — Windows registry
- `sys-info` — system info

### Rust Build Notes
- Run `cargo check` in `src-tauri/` for fast validation
- Full build: `npm run tauri build` (includes frontend)
- Rust toolchain: stable-x86_64-pc-windows-msvc

## File Locations
- Config: `%APPDATA%/winctl/` (services.json, settings.json, themes/)
- Logs: `%LOCALAPPDATA%/winctl/logs/`
- Bundle output: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`

## Code Conventions
- TypeScript: snake_case for fields, camelCase for methods
- Rust: snake_case convention
- After editing `.ts`/`.tsx`: run `npx tsc --noEmit`
- After editing `.rs`: the build command handles checking

## ctx Commands
| Command | Action |
|---------|--------|
| `ctx stats` | Context-mode token stats |
| `ctx doctor` | Run context-mode diagnostics |
| `ctx upgrade` | Update context-mode |

## Session Workflow
1. Start: Check CLAUDE.md for project context
2. Edit: Follow conventions above
3. Verify: Run typecheck/lint if available
4. End: Update session notes if significant changes made
