# Tasks: UI Polish

All tasks edit a single file: `SolidJS/src/styles/global.css`.
Apply in order. Each task is independently verifiable.

---

## ✓ Task 1 — Stopped service border color

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 504–506 (`.svc-card.stopped`)

Change:
```css
.svc-card.stopped {
  border-left: 3px solid var(--border);
}
```
To:
```css
.svc-card.stopped {
  border-left: 3px solid var(--red-dim);
}
```

**Verify**: A stopped service card should show a dark-red left border clearly distinct from the card's surrounding border. A running card should still show a green left border.

---

## ✓ Task 2 — Status dot opacity on hover

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 695–697 (`.svc-header:hover .svc-status-dot::before`)

Change:
```css
.svc-header:hover .svc-status-dot::before {
  opacity: 0.4;
}
```
To:
```css
.svc-header:hover .svc-status-dot::before {
  opacity: 1;
}
```

**Verify**: Hovering a service row should NOT dim the green/red status dot. Drag-handle hint (`::after`) should still appear on hover.

---

## ✓ Task 3A — Action button transition (pre-existing `transition: all 0.12s`)

**File**: `SolidJS/src/styles/global.css`
**Target**: `.ctrl-btn` rule (lines 794–807)

Add `transition` property to the existing `.ctrl-btn` rule:
```css
.ctrl-btn {
  /* existing properties ... */
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
}
```

**Verify**: Hovering start/stop/edit buttons should smoothly fade to their hover colors rather than snapping.

---

## ✓ Task 3B — Edit button hover to neutral

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 838–842 (`.ctrl-btn.edit:hover`)

Change:
```css
.ctrl-btn.edit:hover {
  background: var(--blue-dim);
  color: var(--blue);
  border-color: var(--blue);
}
```
To:
```css
.ctrl-btn.edit:hover {
  background: var(--surface2);
  color: var(--text);
  border-color: var(--border2);
}
```

**Verify**: Edit button hover should be a neutral lift (brighter surface, white text) — not blue. Start still goes green, stop still goes red.

---

## ✓ Task 4 — Gallery badge visibility

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 1863–1866 (`.services-grid.view-gallery .svc-card .svc-badge`)

Change:
```css
.services-grid.view-gallery .svc-card .svc-badge {
  display: none;
}
```
To:
```css
.services-grid.view-gallery .svc-card .svc-badge {
  display: inline-flex;
  font-size: 9px;
  padding: 1px 6px;
}
```

**Verify**: In gallery view, each service card should show a small RUNNING/STOPPED badge below the name. In list view, badge should be unchanged (full size).

---

## ✓ Task 5A — Stat card visual distinction

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 397–402 (`.sys-card`)

Change:
```css
.sys-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}
```
To:
```css
.sys-card {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-top: 2px solid var(--accent);
  border-radius: 6px;
  padding: 14px 16px;
}
```

**Verify**: The four stat cards (CPU Cores, Memory, Services, Uptime) should have a blue accent top-border and slightly darker background, visually distinguishing them from service cards below.

---

## ✓ Task 5B — Stat bar bottom separator

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 391–395 (`.sysbar`)

Add `border-bottom` and `padding-bottom` to the existing `.sysbar` rule:
```css
.sysbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}
```

**Verify**: A thin border should separate the stat strip from the toolbar below it.

---

## ✓ Task 6 — FAB hover label

**File**: `SolidJS/src/styles/global.css`
**Target**: after `.fab-btn.open` rule (after line 1545)

Add new rules after `.fab-btn.open`:
```css
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

**Verify**: Hovering the FAB button (when menu is closed) should reveal an "Add" label to its left. Opening the FAB menu should hide the label.

---

## ✓ Task 7A — Fix sidebar width mismatch + grid layout

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 26–32 (`.shell`) and lines 238–240 (`.shell.sidebar-collapsed`)

Change `.shell`:
```css
/* before */
.shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  --sidebar-width: 240px;
  grid-template-columns: var(--sidebar-width) 1fr;
  transition: grid-template-columns 0.2s ease;
}

/* after */
.shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  grid-template-columns: auto 1fr; /* aside width drives this column naturally */
}
```

Remove or comment out `.shell.sidebar-collapsed` entirely (lines 238–240):
```css
/* REMOVE this rule — no longer needed */
/* .shell.sidebar-collapsed { --sidebar-width: 48px; } */
```

---

## ✓ Task 7B — Fix aside base width + add overflow clip

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 198–210 (`aside`)

Change:
```css
/* before */
aside {
  /* ... */
  width: 220px;
  transition: width 0.2s ease;
}

/* after */
aside {
  /* ... */
  width: 240px;       /* was 220 — matches what the grid column expected */
  overflow: hidden;   /* clip content during width transition */
  transition: width 0.2s ease;
}
```

`aside.collapsed { width: 48px }` — no change needed here.

**Verify**: Collapsing the sidebar should animate the full content area smoothly in one motion. No 20px jump. No content overflowing during the slide.

---

## ✓ Task 7C — Fix chevron CSS target (i → svg)

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 270–278

Change:
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

**Why**: Lucide's `createIcons()` call replaces `<i data-lucide>` elements with `<svg>` at runtime. The `i` selector never matches the live DOM — the chevron never rotated. Targeting `svg` fixes the rotation.

**Verify**: Clicking the collapse button should smoothly rotate the chevron icon 180° (pointing right when collapsed, left when expanded).
