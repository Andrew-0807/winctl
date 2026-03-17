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

Already present — `.ctrl-btn` has `transition: all 0.12s` covering all hover color properties.

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

Added `border-bottom`, `padding-bottom`, and `margin-bottom` to the `.sysbar` rule.

**Verify**: A thin border should separate the stat strip from the toolbar below it.

---

## ✓ Task 6 — FAB hover label

**File**: `SolidJS/src/styles/global.css`
**Target**: after `.fab-btn.open` rule

Added `.fab-btn::after`, `.fab-btn:hover::after`, and `.fab-btn.open::after` rules.

**Verify**: Hovering the FAB button (when menu is closed) should reveal an "Add" label to its left. Opening the FAB menu should hide the label.

---

## ✓ Task 7A — Fix sidebar width mismatch + grid layout

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 26–32 (`.shell`) and lines 238–240 (`.shell.sidebar-collapsed`)

Changed `.shell` to use `grid-template-columns: auto 1fr`. Commented out `.shell.sidebar-collapsed`.

---

## ✓ Task 7B — Fix aside base width + add overflow clip

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 198–210 (`aside`)

Changed `width: 220px` → `240px`, added `overflow: hidden`.

---

## ✓ Task 7C — Fix chevron CSS target (i → svg)

**File**: `SolidJS/src/styles/global.css`
**Target**: lines 270–278

Changed `.sidebar-collapse-btn i` → `.sidebar-collapse-btn svg` in both the transition and rotate rules.

**Verify**: Clicking the collapse button should smoothly rotate the chevron icon 180°.
