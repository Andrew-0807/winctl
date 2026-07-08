# Workflow Graph View — Design

## Context

WinCTL's daemon (`server/`) already manages service lifecycle via `process-manager.ts`. The frontend is a SolidJS SPA with two view modes (list/gallery) toggled via `currentView()` in `stores/ui.ts`. Config is persisted in `~/.config/winctl/services.json` and `~/.config/winctl/settings.json`.

This design adds a third view mode — a full graph canvas — and a backend execution engine that processes workflow DAGs. The design follows existing patterns: REST for CRUD, Socket.IO for real-time state, SolidJS stores for frontend reactivity.

## Goals / Non-Goals

**Goals:**
- Visual canvas editor for creating workflow DAGs with multiple node types
- Full orchestration: parallel branches, join/sync, conditions, manual gates, delays
- Per-edge timeout, retry, and delay configuration
- Real-time execution status per node via Socket.IO
- Persist workflows in `~/.config/winctl/workflows.json`

**Non-Goals:**
- Sub-workflows / workflow composition (no nesting)
- Scheduled/cron execution (trigger is manual only)
- Version history for workflows
- Undo/redo on the canvas (save frequently instead)

---

## Decisions

### 1. Data Model

```ts
// --- Workflow ---
interface Workflow {
  id: string;               // base-36 timestamp, same as services
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
}

// --- Node Types ---
type NodeType = 'service_start' | 'service_stop' | 'delay' | 'condition' | 'manual_gate' | 'join';

interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;            // auto-generated or user-chosen
  position: { x: number; y: number };
  config: NodeConfig;
}

type NodeConfig =
  | { type: 'service_start'; serviceId: string }
  | { type: 'service_stop'; serviceId: string }
  | { type: 'delay'; seconds: number }
  | { type: 'condition'; conditionType: 'service_running' | 'service_stopped'; serviceId: string }
  | { type: 'manual_gate'; prompt: string }            // user must click "approve" in UI
  | { type: 'join'; joinType: 'all' | 'any' };         // wait for all / any incoming edges

// --- Edge ---
interface WorkflowEdge {
  id: string;
  source: string;           // source node ID
  target: string;           // target node ID
  sourcePort: 'default' | 'true' | 'false';  // 'true'/'false' for condition nodes
  config: EdgeConfig;
}

interface EdgeConfig {
  timeout: number;          // seconds, 0 = no timeout (edge fires immediately when source completes)
  retryCount: number;       // 0 = no retry
  retryDelay: number;       // seconds between retries
}

// --- Execution State ---
type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'stopped';
type NodeExecStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval' | 'timed_out';

interface WorkflowExecution {
  workflowId: string;
  executionId: string;      // unique per run
  status: WorkflowStatus;
  startedAt: string;
  finishedAt: string | null;
  nodeStates: Record<string, NodeExecutionState>;
}

interface NodeExecutionState {
  nodeId: string;
  status: NodeExecStatus;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  retryAttempt: number;
}
```

**Why base-36 timestamps for IDs?** Consistent with existing service IDs in the codebase.

**Why three port types on edges?** Condition nodes branch on true/false. All other node types use 'default'. Join nodes don't have outgoing port distinctions — they fire when their condition is met.

### 2. Config Persistence

New file: `~/.config/winctl/workflows.json`

```json
{
  "workflows": [
    {
      "id": "m1abc",
      "name": "Full Stack Startup",
      "description": "Start DB → API → Frontend with delays",
      "nodes": [...],
      "edges": [...],
      "createdAt": "2026-03-20T..."
    }
  ]
}
```

New file: `server/workflow-config.ts` — same pattern as `config.ts`:
- `loadWorkflows()` / `saveWorkflows()` with 5s TTL cache
- `getWorkflowById(id)` / `createWorkflow()` / `updateWorkflow()` / `deleteWorkflow()`
- Path: `path.join(os.homedir(), '.config', 'winctl', 'workflows.json')`

### 3. REST API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/workflows` | List all workflows |
| GET | `/api/workflows/:id` | Get single workflow |
| POST | `/api/workflows` | Create workflow |
| PUT | `/api/workflows/:id` | Update workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/workflows/:id/execute` | Start execution |
| POST | `/api/workflows/:id/stop` | Stop execution |
| GET | `/api/workflows/:id/execution` | Get current execution state |
| POST | `/api/workflows/:id/approve/:nodeId` | Approve a manual gate node |

Register before `/api/services/:id` catch-all in `routes.ts`.

### 4. Execution Engine — `server/workflow-engine.ts`

```
WorkflowEngine class:
  - Map<string, WorkflowExecution> activeExecutions
  - executeWorkflow(workflow: Workflow): string  → returns executionId
  - stopExecution(workflowId: string): void
  - approveGate(workflowId: string, nodeId: string): void
  
Execution flow:
  1. Parse DAG → build adjacency list (incoming/outgoing edges per node)
  2. Find "root nodes" (no incoming edges) → mark them as entry points
  3. Start all root nodes in parallel
  4. For each node completion:
     a. Check outgoing edges
     b. For condition nodes: evaluate condition → route to 'true' or 'false' port
     c. For all target nodes: check if all incoming edges are satisfied
        - Regular nodes: need exactly 1 incoming edge completed
        - Join (all): need ALL incoming edges completed
        - Join (any): need ANY incoming edge completed
     d. If satisfied → start target node (with edge delay if configured)
     e. If edge has timeout → start timer, fail edge if timeout exceeded
     f. If edge has retry → retry up to N times with delay between
  5. Node execution:
     - service_start: call startService() from process-manager.ts
     - service_stop: call stopService() from process-manager.ts
     - delay: setTimeout for N seconds
     - condition: check service state from process-manager registry
     - manual_gate: set status 'waiting_approval', wait for approveGate()
     - join: wait for incoming edge conditions (handled in step 4c)
  6. When all nodes complete → workflow status = 'completed'
  7. If any node fails → workflow status = 'failed' (unless error handling configured)
  8. Broadcast status via Socket.IO 'workflow:status' event on every state change
```

**Socket.IO events:**

```ts
// Server → all clients, on any node state change:
io.emit('workflow:status', {
  executionId: string,
  workflowId: string,
  status: WorkflowStatus,
  nodeStates: Record<string, NodeExecutionState>,
  startedAt: string,
  finishedAt: string | null
});
```

### 5. Canvas Architecture

**Approach: SVG edges + absolutely-positioned HTML node divs inside a zoomable/pannable container.**

```
<div class="workflow-canvas-wrapper"          ← overflow: hidden, captures wheel/pan events
  <div class="workflow-canvas-transform"      ← CSS transform: translate + scale
    <svg class="workflow-edges-svg">          ← SVG layer for edges (below nodes)
      <path class="edge-path" />              ← Bezier curves
      <circle class="edge-handle" />          ← connection handles on hover
    </svg>
    <div class="workflow-nodes-layer">        ← HTML layer for nodes
      <WorkflowNode />                        ← absolutely positioned per node.position
    </div>
    <div class="workflow-grid-bg" />          ← optional dot grid background
  </div>
  <WorkflowMinimap />                         ← fixed position, bottom-right
  <WorkflowNodePalette />                     ← fixed position, left sidebar
  <WorkflowToolbar />                         ← fixed position, top of canvas
</div>
```

**Pan/Zoom:**
- `zoom` signal (0.25–3.0, default 1.0)
- `panOffset` signal ({ x, y })
- Mouse wheel → adjust zoom (centered on cursor)
- Middle-click drag or Space+drag → pan
- CSS: `transform: translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`

**Node Drag:**
- On mousedown on a node → start tracking
- On mousemove → update node.position (snapped to 20px grid)
- On mouseup → save to backend
- Uses native mouse events (not HTML5 drag API) for smoother canvas feel

**Edge Creation:**
- Each node has input/output port circles (small dots on left/right edges)
- Dragging from an output port to an input port creates an edge
- While dragging, a temporary SVG line follows the cursor
- On drop on a valid input port → create edge via API

**Bezier Curve Calculation:**
```ts
function getEdgePath(source: Position, target: Position): string {
  const dx = Math.abs(target.x - source.x) * 0.5;
  return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
}
```

**Snap-to-Grid:**
- Grid size: 20px
- `snap(value) = Math.round(value / 20) * 20`
- Applied on node drop (not during drag for smooth feel)

### 6. Node Palette (left side)

A vertical panel listing available node types, each as a draggable item:

| Node | Icon | Config |
|------|------|--------|
| Start Service | `Play` | Pick service from dropdown |
| Stop Service | `Square` | Pick service from dropdown |
| Delay | `Clock` | Seconds input |
| Condition | `GitBranch` | Service + running/stopped |
| Manual Gate | `Lock` | Prompt text |
| Join | `Merge` | All / Any |

Drag from palette onto canvas → creates a new node at the drop position.

### 7. Properties Panel (right side)

When a node or edge is selected, show a side panel with editable properties:

- **Node selected**: type-specific config fields (service picker, seconds input, etc.), label, position (read-only)
- **Edge selected**: timeout, retry count, retry delay, source port (for condition nodes)

The panel uses the same modal/panel styling as existing ServiceDetails.

### 8. Minimap

A small scaled-down view of the entire canvas (bottom-right corner, ~200x150px):
- Renders miniature nodes as colored rectangles
- Shows viewport rectangle (the visible area)
- Click/drag on minimap → pan canvas to that area
- Auto-updates as nodes move

Implementation: duplicate node positions at 0.05 scale inside a fixed-size container.

### 9. View Toggle Integration

Add a third button to the Toolbar's view toggle:

```
[ List ]  [ Grid ]  [ Workflow ]   ... [ Run Command ]
```

`currentView` type expands from `'list' | 'gallery'` to `'list' | 'gallery' | 'workflow'`.

When `workflow` is selected:
- The main content area shows the `WorkflowView` canvas instead of `ServiceGrid`
- A workflow selector dropdown appears (or "New Workflow" button)
- The SystemStats bar remains visible
- Toolbar filters (All/Running/Stopped) are hidden (not applicable to workflows)

### 10. Workflow Execution UI

During execution, the canvas shows live status per node:

| Status | Visual |
|--------|--------|
| `pending` | Gray border, muted |
| `running` | Blue pulsing border, spinning icon |
| `completed` | Green border, checkmark |
| `failed` | Red border, error icon |
| `waiting_approval` | Yellow border, lock icon pulsing |
| `skipped` | Gray dashed border |
| `timed_out` | Orange border, clock icon |

A floating execution status bar shows:
- Workflow name, elapsed time
- "Running" / "Completed" / "Failed" badge
- Stop button (while running)
- Per-node progress (X/Y completed)

---

## Risks / Trade-offs

- **Canvas complexity**: Building a full canvas editor from scratch is substantial work. Mitigates by using HTML+SVG hybrid (no heavy canvas library needed) and reusing existing SolidJS patterns.
- **Cycle detection**: No DAG validation at save time. A user could create a cycle. Mitigates by adding a topological sort check on save and showing an error.
- **Manual gates require active UI**: If no browser is open, manual gate nodes will block forever. Acceptable for a self-hosted dashboard — the user is expected to have the UI open during workflow execution.
- **No sub-workflows**: Keeps the engine simple. Users can create multiple workflows and trigger them sequentially via the API if needed.
- **Edge retries spawn new service processes**: Retrying a `service_start` node will call `startService()` again, which handles "already running" gracefully.
