## Why

WinCTL's UI is functional but carries generic developer-dashboard visual patterns: a monospace font used for everything (including UI chrome), an "AI purple" accent color, heavy all-caps status badges, and no meaningful motion or hover states. Applying the taste-skill and redesign-skill design frameworks will elevate the dashboard from a serviceable tool to a polished, premium developer experience that matches the quality of tools like Linear and Vercel's dashboard.

## What Changes

- **Typography system**: Introduce Geist Sans for all UI chrome (labels, navigation, modal headers, metadata) while keeping 0xProto exclusively for service names, log output, PID/command data, and terminal content — establishing genuine typographic contrast
- **Accent color**: Replace `#5e72e4` (generic AI-purple) with a refined Electric Blue (`#2563eb` / Tailwind Blue-600 family) — high contrast, developer-native, neutral-compatible
- **Status badges**: Replace heavy `[RUNNING]` all-caps pill badges with a lighter, sentence-case or abbreviated form; let the animated status dot carry more semantic weight
- **Service card polish**: Stronger visual hierarchy (name dominant, meta subdued), hover state with subtle border highlight, improved spacing rhythm
- **Motion system**: Smooth height/opacity transitions on panel expand/collapse; breathing animation on the running-status dot; staggered card entrance on initial load
- **Interactive states**: Add proper `:hover` and `:active` feedback on all buttons and nav items; smooth 200ms transitions throughout

## Capabilities

### New Capabilities
- `typography-system`: Dual-font hierarchy — Geist Sans for UI chrome, 0xProto for terminal/data content; weight scale (400/500/600); letter-spacing rules per context
- `color-system`: Refined accent palette replacing AI-purple; tinted shadows; consistent gray family; status color adjustments
- `motion-system`: Panel expand/collapse transitions; status dot pulse animation; card entrance stagger; button press feedback
- `component-polish`: Service card hierarchy and hover states; status badge redesign; sidebar nav item states; button interactive feedback

### Modified Capabilities
<!-- No existing spec-level behavioral requirements are changing — this is a pure visual/UX upgrade -->

## Impact

- `SolidJS/src/styles/variables.css` — font variables, accent color, shadow tokens
- `SolidJS/src/styles/global.css` — typography rules, transition defaults, animation keyframes
- `SolidJS/src/components/ServiceCard.tsx` — card layout, badge markup, hover/active states
- `SolidJS/src/components/Sidebar.tsx` — nav item hover/active states
- `SolidJS/src/components/Header.tsx` — font application to logo and stat chips
- Font loading: Geist Sans added via Google Fonts or self-hosted in `index.html`
- No framework changes, no new runtime dependencies required (animations via CSS keyframes and transitions)
