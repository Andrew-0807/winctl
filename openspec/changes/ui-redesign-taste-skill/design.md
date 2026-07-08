## Context

WinCTL's frontend is a SolidJS SPA styled with vanilla CSS (no Tailwind, no CSS-in-JS). The design language is fully controlled via two files: `variables.css` (tokens) and `global.css` (styles). Both `--font-mono` and `--font-sans` currently resolve to `0xProto`, a monospace programming font — this flattens all typographic hierarchy. The accent token is `#5e72e4`, which sits squarely in the "AI purple" range banned by taste-skill's Rule 2 (Color Calibration). Animations and transitions are sparse; the UI feels static. No hover/active feedback on cards.

The redesign applies the taste-skill and redesign-skill frameworks as a **targeted upgrade** — no framework migration, no new runtime dependencies, no Tailwind introduction. Everything ships via the existing vanilla CSS pipeline.

## Goals / Non-Goals

**Goals:**
- Establish a genuine dual-font system (Geist Sans for UI, 0xProto for data/terminal)
- Replace the purple accent with a high-contrast, developer-appropriate blue
- Add meaningful motion: panel transitions, status dot pulse, button feedback
- Improve service card visual hierarchy and hover states
- Make the interface feel "alive" and premium without changing any functionality

**Non-Goals:**
- Migrating to Tailwind, CSS Modules, or any new styling framework
- Restructuring component architecture
- Adding new features or changing business logic
- Changing the dark-only theme approach
- Introducing JS-based animation libraries (Framer Motion, GSAP)

## Decisions

### D1: Font Loading — Google Fonts CDN vs. Self-Hosted

**Decision:** Load Geist Sans via Google Fonts `@import` in `variables.css`.

**Rationale:** Geist is available on Google Fonts. A CDN import is zero-friction, no build step, no additional assets. The app already targets `localhost` use, so network latency is negligible. Self-hosting is the production-correct choice but adds maintenance overhead that isn't warranted for a local tool.

**Alternative:** Use the Vercel-hosted Geist NPM package (`@vercel/font`) — rejected because it's a React/Next.js integration, incompatible with this vanilla CSS pipeline.

---

### D2: Accent Color — Electric Blue vs. Teal vs. Emerald

**Decision:** Replace `#5e72e4` with `#3b82f6` (Tailwind Blue-500, electric blue family).

**Rationale:** Blue is developer-native (VS Code, Linear, GitHub all use blue as their primary interactive color). It pairs cleanly with the existing blue-gray surface palette without hue clash. Teal was considered but sits too close to the `--blue` status color (`#4d9de0`), creating ambiguity. Emerald was considered but reads more "success/health" — conflicting with the green status signal already used for RUNNING services.

**Glow token:** `--accent-glow` becomes `rgba(59, 130, 246, 0.25)` — desaturated to avoid neon feel.

---

### D3: Animation Approach — CSS Keyframes vs. JS Animation

**Decision:** Pure CSS: `transition` properties for interactive states, `@keyframes` for looping animations (status dot pulse), CSS `max-height` trick for panel expand/collapse with `overflow: hidden`.

**Rationale:** No JS animation dependency justified for this scope. The redesign-skill explicitly states "work with the existing tech stack." CSS transitions cover all required cases: hover states, button feedback, badge transitions. The panel expand/collapse via `max-height` transition is a known limitation (requires a large fixed max-height estimate) but is acceptable given panels have a predictable content range.

**Alternative:** SolidJS `classList` + CSS classes with `transition` on `height` via ResizeObserver — more accurate but significantly more complex. Deferred to a future motion-system improvement.

---

### D4: Status Badge Redesign — Text vs. Dot-Only

**Decision:** Keep text label but switch to sentence-case with reduced visual weight (smaller font, lower opacity for the stopped state). The status dot becomes the primary indicator; the badge becomes secondary confirmation.

**Rationale:** Dot-only would break accessibility for color-blind users. All-caps `RUNNING` is visually dominant and fights the service name for attention. Sentence-case at `text-xs` with `font-weight: 500` establishes clear hierarchy: name > badge > meta.

---

### D5: Stagger Entry — CSS Animation Delay vs. JS

**Decision:** CSS `animation-delay: calc(var(--card-index) * 60ms)` applied inline from the SolidJS template via `style` prop.

**Rationale:** Minimal JS involvement, no library needed. SolidJS reactivity makes setting inline `--card-index` trivial via the `index()` from `<For>`. This pattern is explicitly endorsed by taste-skill Section 4 as a `staggerChildren` CSS alternative.

## Risks / Trade-offs

- **`max-height` panel animation** → Panel transitions may feel slightly "elastic" at the end if content is much shorter than the max-height value. Mitigation: set `max-height` to `600px` which covers log viewer content without extreme overshoot.

- **Google Fonts CDN dependency** → If the machine has no internet or the CDN is blocked, Geist won't load and the fallback `system-ui, sans-serif` will kick in. Mitigation: the fallback is documented; add `system-ui` as explicit fallback in font stack so the UI degrades gracefully.

- **0xProto still used for service names** → Service names are the most prominent text in the UI and remain monospace. This is intentional (service names are often technical strings like `postgres-dev`, `webpack-hmr`) but means the "premium sans-serif" feel is only partially realized. Mitigation: correct for this by increasing service name `font-size` and `font-weight` so it reads as dominant even in mono.

- **CSS variable override in themes** → WinCTL supports custom themes via `~/.config/winctl/themes/` JSON files that override CSS variables. The new `--accent` value and any new tokens will need to be documented so custom themes don't unexpectedly inherit old purple values. Mitigation: update built-in theme files (`config.ts` writes them on startup) to include the new accent token.

## Migration Plan

1. Update `variables.css` — add Geist import, update font tokens, accent color, add new motion/shadow tokens
2. Update `global.css` — apply new fonts to UI chrome selectors, add transition defaults, add keyframe animations
3. Update `ServiceCard.tsx` — badge markup changes, card-index CSS var for stagger, hover class
4. Update `Sidebar.tsx` — nav item hover/active styles
5. Update `Header.tsx` — font application check
6. Update `config.ts` built-in theme tokens — new accent value
7. Manual smoke test: start/stop services, open log panel, resize window, check theme switching

Rollback: revert `variables.css` and `global.css` — all visual changes are isolated to these two files plus minor markup tweaks.

## Open Questions

- Should Geist be self-hosted for the `pkg`-bundled `.exe` release (where CDN access may not be guaranteed)? This could be addressed by inlining a base64 font or using system-ui fallback aggressively.
- Is there a preferred blue hue? `#3b82f6` (bright) vs `#2563eb` (deeper, more authoritative). Both are non-purple and developer-appropriate.
