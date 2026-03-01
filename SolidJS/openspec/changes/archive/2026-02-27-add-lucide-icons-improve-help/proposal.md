## Why

The current winctl UI uses basic Feather-style inline SVG icons which look dated. Lucide icons offer a more modern, consistent design language with better visual appeal. Additionally, the CLI help command can be improved with better formatting, examples, and shell integration.

## What Changes

- Replace all inline Feather SVG icons with Lucide icons across the SolidJS UI components
- Add lucide-solid as a dependency for type-safe icon components
- Create a centralized icon system for consistent icon usage
- Improve the winctl help command with better formatting, examples, and shell integration

## Capabilities

### New Capabilities
- icon-system: Centralized Lucide icon integration for the SolidJS UI
- help-command: Enhanced CLI help command with improved formatting and usability

### Modified Capabilities
- None - this is a pure enhancement with no existing spec changes

## Impact

- UI Components: Sidebar, Toolbar, ServiceCard, FolderCard, LogViewer, FAB, Header, modals, and context menus will receive updated icons
- CLI: The help command in cli/index.ts will be enhanced
- Dependencies: Add lucide-solid package for icon components
