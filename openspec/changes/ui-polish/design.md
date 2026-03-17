# Design: UI Polish

All changes are in `SolidJS/src/styles/global.css`. No JSX, no TypeScript, no server code.

---

## 1. Stopped Service Border (lines 504–506)

**Problem**: `.svc-card.stopped { border-left: 3px solid var(--border) }` — the border color is identical to the card's surrounding border. Stopped state is visually invisible.

**Root cause**: The token `--border: #252a38` is used for both the card border AND the stopped indicator. They're the same color.

**Fix**:
```css
/* before */
.svc-card.stopped {
  border-left: 3px solid var(--border);
}

/* after */
.svc-card.stopped {
  border-left: 3px solid var(--red-dim);
}
```

`--red-dim: #3d1f1d` is already in the token set. It reads as "not running" without triggering the alarm of full `--red`. The running state uses `--green`; symmetry dictates stopped uses `--red-dim`.

---

## 2. Status Dot Hover Opacity (lines 695–697)

**Problem**: `svc-header:hover .svc-status-dot::before { opacity: 0.4 }` — hovering the card dims the status dot, hiding running/stopped state at the moment of interaction.

**Root cause**: The hover rule was intended to reveal the drag-handle icon (`::after`) by shifting visual attention away from the dot, but `opacity: 0.4` is too aggressive and removes status legibility.

**Fix**:
```css
/* before */
.svc-header:hover .svc-status-dot::before {
  opacity: 0.4;
}

/* after */
.svc-header:hover .svc-status-dot::before {
  opacity: 1;
}
```

The drag handle (`::after`) still appears on hover through its own color transition. The status dot stays visible.

---

## 3. Action Button Transition + Edit Hover Color (lines 794–842)

**Problem A**: No `transition` on `.ctrl-btn` — hover color/bg changes snap instantly.

**Problem B**: `.ctrl-btn.edit:hover` uses `--blue`/`--blue-dim`, which reads as "link/info" rather than a neutral edit action. Running is green, stopping is red — edit should be a neutral lift, not a semantic color.

**Fix A** — add transition to base rule:
```css
/* add to .ctrl-btn */
transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
```

**Fix B** — change edit hover to neutral:
```css
/* before */
.ctrl-btn.edit:hover {
  background: var(--blue-dim);
  color: var(--blue);
  border-color: var(--blue);
}

/* after */
.ctrl-btn.edit:hover {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--border2);
}
```

This matches the generic `.ctrl-btn:hover` visual (slightly brighter surface, full text color) while still being distinct from the default resting state.

---

## 4. Gallery Card Badge (lines 1863–1866)

**Problem**: In gallery view, `.services-grid.view-gallery .svc-card .svc-badge { display: none }` hides the only text status indicator. Left-border at 3px is too subtle as the sole signal in a dense grid.

**Fix**:
```css
/* before */
.services-grid.view-gallery .svc-card .svc-badge {
  display: none;
}

/* after */
.services-grid.view-gallery .svc-card .svc-badge {
  display: inline-flex;
  font-size: 9px;
  padding: 1px 6px;
}
```

The badge already exists with correct tokens (`badge-running`: green-dim/green, `badge-stopped`: surface2/text3). This just makes it visible at slightly smaller sizing appropriate for card density.

> **Note**: For gallery folder cards, showing "X running / Y total" requires a computed value in `FolderCard.tsx` — that is a JSX change outside this style-only scope. The folder card's existing `.folder-count` badge already shows total; the running breakdown is a follow-on task.

---

## 5. Stat Card Visual Distinction (lines 397–425)

**Problem**: `.sys-card` is visually identical to `.svc-card` — same surface bg, border, and radius. The stat strip reads as another list of items rather than a summary header band.

**Fix A** — give sys-cards an accent top-border and a slightly different background:
```css
/* before */
.sys-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

/* after */
.sys-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-top: 2px solid var(--accent);
  border-radius: 6px;
  padding: 14px 16px;
}
```

**Fix B** — add a visual separator after the stat bar:
```css
/* add below .sysbar rule */
.sysbar {
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
```

`--surface2` is slightly darker than `--surface`, creating a tonal contrast. The `--accent` top-border (`#5e72e4`) creates a clear visual hierarchy: "this band is header info, not an interactive row."

---

## 6. FAB Hover Label (lines 1539–1545)

**Problem**: The FAB button is a bare `+` with no label. `transform: scale(1.05)` on hover provides no affordance about what the button does.

**Fix** — add a CSS `::after` tooltip appearing to the left of the button on hover:
```css
/* add after .fab-btn:hover rule */
.fab-btn::after {
  content: 'Add';
  position: absolute;
  right: calc(100% + 12px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--surface);
  border: 1px solid var(--border2);
  color: var(--text2);
  font-size: 11px;
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
  padding: 4px 10px;
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s;
}

.fab-btn:hover::after {
  opacity: 1;
}

.fab-btn.open::after {
  opacity: 0;
  pointer-events: none;
}
```

No JSX change. The `.fab-container` already has `position: fixed`, so the `::after` absolute positioning is relative to the button. The label disappears when the menu is open (`.open` class).

---

## 7. Sidebar Animation Fix (lines 26–32, 198–214, 270–278)

**Three compounding bugs:**

### Bug A — Width mismatch (20px)

```
aside {
  width: 220px;          ← actual element width
}
.shell {
  --sidebar-width: 240px; ← grid column width
}
```

The `aside` is 220px but its grid column is 240px, leaving a 20px gap. During the transition, the aside and the grid column animate from different starting values, causing the content area to shift non-uniformly.

### Bug B — CSS variable transition is unreliable

```css
.shell {
  grid-template-columns: var(--sidebar-width) 1fr;
  transition: grid-template-columns 0.2s ease;
}
```

Transitioning `grid-template-columns` when the value changes via a CSS custom property reassignment (`--sidebar-width`) is not spec-guaranteed to animate. The grid column may snap while the `aside` slides, producing jitter.

### Bug C — Chevron target is wrong

```css
.sidebar-collapse-btn i { transition: transform 0.2s; }
aside.collapsed .sidebar-collapse-btn i { transform: rotate(180deg); }
```

Lucide replaces `<i data-lucide>` elements with `<svg>` at runtime via `window.lucide.createIcons()`. The `i` selector no longer matches the rendered DOM — the chevron never rotates.

### Fix

**A. Switch grid to `auto 1fr`** — let the aside width drive the column naturally:
```css
/* before */
.shell {
  --sidebar-width: 240px;
  grid-template-columns: var(--sidebar-width) 1fr;
  transition: grid-template-columns 0.2s ease;
}
.shell.sidebar-collapsed {
  --sidebar-width: 48px;
}

/* after */
.shell {
  grid-template-columns: auto 1fr;
  /* no transition needed — grid tracks aside width automatically */
}
/* remove .shell.sidebar-collapsed entirely */
```

**B. Fix aside width + add overflow clip**:
```css
/* before */
aside {
  width: 220px;
  transition: width 0.2s ease;
}

/* after */
aside {
  width: 240px;        /* match what the grid expected; was 220 */
  overflow: hidden;    /* clip content during transition — prevents text overflow */
  transition: width 0.2s ease;
}
```

`aside.collapsed { width: 48px }` stays unchanged — this is the target of the transition.

**C. Fix chevron target from `i` to `svg`**:
```css
/* before */
.sidebar-collapse-btn i {
  width: 12px;
  height: 12px;
  transition: transform 0.2s;
}
aside.collapsed .sidebar-collapse-btn i {
  transform: rotate(180deg);
}

/* after */
.sidebar-collapse-btn svg {
  width: 12px;
  height: 12px;
  transition: transform 0.2s;
}
aside.collapsed .sidebar-collapse-btn svg {
  transform: rotate(180deg);
}
```

### Why `grid-template-columns: auto 1fr` works

With `auto 1fr`, the first column is sized to its content (the `aside`). Since `aside` has an explicit `width`, the grid column tracks that width. When `aside` transitions from 240px → 48px, the grid column recalculates on each frame via the layout engine — no CSS variable needed, no `grid-template-columns` transition needed. The `main` column gets `1fr` of the remaining space and expands naturally.

**Risk**: `grid-template-columns: auto 1fr` relies on the aside having an explicit `width`. It does. If aside width is ever removed or set to `auto`, the column would size to content. Mark this dependency in a comment.
