## Context

The winctl application has two main interfaces: a SolidJS web UI and a Node.js CLI. Both currently use basic inline Feather SVG icons. The UI also lacks a centralized icon system, making icon management inconsistent across components.

## Goals / Non-Goals

**Goals:**
- Replace all Feather icons with Lucide icons in the SolidJS web UI
- Add lucide-solid package for type-safe icon components
- Create a centralized Icon component for consistent usage
- Improve the CLI help command with better formatting

**Non-Goals:**
- Modify the daemon server code
- Change any API endpoints
- Add new service management capabilities
- Redesign the UI layout (only icons change)

## Decisions

1. **Use lucide-solid over lucide-react or plain Lucide**
   - Rationale: Native SolidJS integration with proper reactivity
   - Alternative: Use lucide with JSX pragma - less type-safe

2. **Create a centralized Icon component**
   - Rationale: Consistent sizing, coloring, and easy theme integration
   - Alternative: Import individual icons directly - harder to maintain

3. **Keep CLI help as built-in (no external help system)**
   - Rationale: Simpler distribution, no extra dependencies
   - Alternative: Use blessed or inky - adds dependency weight

4. **Map Feather icons to equivalent Lucide icons**
   - Use icon name mapping table for direct replacements
   - Rationale: Minimal visual change, only improving icon style

## Risks / Trade-offs

- **Risk**: lucide-solid package compatibility with SolidJS 1.9
  - **Mitigation**: Test after install, fallback to plain lucide if issues

- **Risk**: Icon size/alignment differences between Feather and Lucide
  - **Mitigation**: Create wrapper component with consistent sizing

- **Risk**: Help command changes might affect existing scripts
  - **Mitigation**: Keep command signatures identical, only improve output format
