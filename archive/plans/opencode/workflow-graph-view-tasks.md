# Workflow Graph View — Tasks

## Phase 1: Backend Foundation

### 1.1 Types
- [ ] Add `Workflow`, `WorkflowNode`, `WorkflowEdge`, `NodeConfig`, `EdgeConfig` interfaces to `server/types.ts`
- [ ] Add `WorkflowExecution`, `NodeExecutionState`, `WorkflowStatus`, `NodeExecStatus` types to `server/types.ts`
- [ ] Add `WorkflowsFile` type: `{ workflows: Workflow[] }`

### 1.2 Config — `server/workflow-config.ts` (new file)
- [ ] Create `server/workflow-config.ts` with same pattern as `server/config.ts` (5s TTL cache)
- [ ] Implement `loadWorkflows(): WorkflowsFile` — read `~/.config/winctl/workflows.json`, create with empty array if missing
- [ ] Implement `saveWorkflows(data: WorkflowsFile): void` — write to disk, update cache
- [ ] Implement `getWorkflows(): Workflow[]`, `getWorkflow(id): Workflow | undefined`
- [ ] Implement `createWorkflow(data): Workflow` — generate base-36 ID, set createdAt
- [ ] Implement `updateWorkflow(id, data): Workflow | undefined`
- [ ] Implement `deleteWorkflow(id): boolean`
- [ ] Add `validateDAG(nodes, edges): string | null` — topological sort check, returns error message or null

### 1.3 Execution Engine — `server/workflow-engine.ts` (new file)
- [ ] Create `WorkflowEngine` class with `Map<string, WorkflowExecution>` for active executions
- [ ] Implement `executeWorkflow(workflow, io): string` — build adjacency list, find roots, start parallel execution
- [ ] Implement `stopExecution(workflowId): void` — stop all running nodes, set status to 'stopped'
- [ ] Implement `approveGate(workflowId, nodeId): void` — resolve manual gate promise
- [ ] Implement `getExecution(workflowId): WorkflowExecution | undefined`
- [ ] Implement private `executeNode(execution, node, workflow, io)` — dispatch by node type:
  - `service_start`: call `startService()` from process-manager
  - `service_stop`: call `stopService()` from process-manager
  - `delay`: `setTimeout` for N seconds
  - `condition`: check service state from process-manager registry
  - `manual_gate`: create `Promise` stored in a Map, wait for `approveGate()`
  - `join`: wait for all/any incoming edges to complete
- [ ] Implement private `processCompletedNode(execution, node, workflow, io)` — check outgoing edges, evaluate conditions, fire target nodes with edge delay/retry/timeout
- [ ] Implement edge retry logic: on failure, retry up to `retryCount` times with `retryDelay` between
- [ ] Implement edge timeout logic: `Promise.race` with timeout timer
- [ ] Implement `broadcastStatus(io, execution)` — emit `workflow:status` Socket.IO event

### 1.4 Routes — additions to `server/routes.ts`
- [ ] Add `GET /api/workflows` — list all workflows
- [ ] Add `GET /api/workflows/:id` — get single workflow (404 if not found)
- [ ] Add `POST /api/workflows` — create workflow (validate DAG, save)
- [ ] Add `PUT /api/workflows/:id` — update workflow (validate DAG, save)
- [ ] Add `DELETE /api/workflows/:id` — delete workflow (stop if running)
- [ ] Add `POST /api/workflows/:id/execute` — start execution via engine
- [ ] Add `POST /api/workflows/:id/stop` — stop execution via engine
- [ ] Add `GET /api/workflows/:id/execution` — get current execution state
- [ ] Add `POST /api/workflows/:id/approve/:nodeId` — approve manual gate
- [ ] Register all workflow routes BEFORE `/api/services/:id` catch-all
- [ ] Add input validation: workflow name (required, max 100 chars), nodes array (max 50), edges array (max 100)

### 1.5 Daemon Integration — `server/index.ts`
- [ ] Import `WorkflowEngine` and `loadWorkflows` in `server/index.ts`
- [ ] Create engine instance, pass `io` to it
- [ ] Pass engine to `setupRoutes()` alongside existing params

---

## Phase 2: Frontend Store

### 2.1 Workflow Store — `src/stores/workflows.ts` (new file)
- [ ] Create `workflows` SolidJS store: `{ workflows: Workflow[], activeWorkflowId: string | null, execution: WorkflowExecution | null, loading: boolean }`
- [ ] Add `loadWorkflows()` — fetch `GET /api/workflows`
- [ ] Add `loadWorkflow(id)` — fetch `GET /api/workflows/:id`, set `activeWorkflowId`
- [ ] Add `saveWorkflow(workflow)` — `PUT /api/workflows/:id` or `POST /api/workflows` if new
- [ ] Add `deleteWorkflow(id)` — `DELETE /api/workflows/:id`
- [ ] Add `executeWorkflow(id)` — `POST /api/workflows/:id/execute`
- [ ] Add `stopWorkflow(id)` — `POST /api/workflows/:id/stop`
- [ ] Add `approveGate(workflowId, nodeId)` — `POST /api/workflows/:id/approve/:nodeId`
- [ ] Add canvas state signals: `zoom`, `panOffset`, `selectedNodeId`, `selectedEdgeId`, `dragState`
- [ ] Add `addNode(type, position, config)` — add to active workflow's nodes array, save
- [ ] Add `updateNode(nodeId, updates)` — update node in array, save
- [ ] Add `deleteNode(nodeId)` — remove node + connected edges, save
- [ ] Add `addEdge(source, target, sourcePort, config)` — add to edges, save
- [ ] Add `updateEdge(edgeId, updates)` — update edge, save
- [ ] Add `deleteEdge(edgeId)` — remove edge, save
- [ ] Add `moveNode(nodeId, position)` — update position (called on drag end)

### 2.2 Socket Integration — `src/stores/socket.ts`
- [ ] Add `workflow:status` Socket.IO listener — updates `workflows.execution` store
- [ ] Add API wrappers: `getWorkflows()`, `getWorkflow(id)`, `createWorkflow(data)`, `updateWorkflow(id, data)`, `deleteWorkflow(id)`, `executeWorkflow(id)`, `stopWorkflow(id)`, `approveGate(workflowId, nodeId)`

### 2.3 UI Store Updates — `src/stores/ui.ts`
- [ ] Expand `ViewType` from `'list' | 'gallery'` to `'list' | 'gallery' | 'workflow'`
- [ ] Add `workflowPaletteOpen` signal (boolean, default true)
- [ ] Add `workflowPropertiesOpen` signal (boolean)

---

## Phase 3: Canvas Components

### 3.1 WorkflowView — `src/components/WorkflowView.tsx` (new file)
- [ ] Main canvas wrapper: `<div class="workflow-canvas-wrapper">` with wheel event for zoom, mousedown for pan
- [ ] Transform layer: `<div class="workflow-canvas-transform">` with CSS `transform: translate() scale()`
- [ ] SVG layer for edges (below nodes)
- [ ] HTML layer for nodes (absolutely positioned)
- [ ] Dot grid background pattern (CSS background-image on transform layer)
- [ ] Handle node selection (click), edge selection (click on path), canvas click (deselect)
- [ ] Handle keyboard: Delete to remove selected node/edge, Escape to deselect

### 3.2 WorkflowNode — `src/components/WorkflowNode.tsx` (new file)
- [ ] Render node as `<div class="workflow-node" style="left: Xpx; top: Ypx">` with type-specific icon and label
- [ ] Input port circle (left side) and output port circle (right side) for edge connections
- [ ] Condition nodes have two output ports: 'true' (green) and 'false' (red)
- [ ] Drag-to-move: mousedown starts tracking, mousemove updates position (visual only), mouseup saves
- [ ] Status overlay during execution: colored border + status icon based on `NodeExecStatus`
- [ ] Right-click context menu: Edit, Duplicate, Delete

### 3.3 WorkflowEdge — `src/components/WorkflowEdge.tsx` (new file)
- [ ] Render SVG `<path>` with Bezier curve between source output port and target input port
- [ ] Calculate port positions based on source/target node positions and dimensions
- [ ] Edge label showing timeout/retry config (small text near midpoint)
- [ ] Click to select edge, highlighted when selected
- [ ] Temporary edge line during connection drag (dashed, follows cursor)
- [ ] Condition edge coloring: green for 'true' port, red for 'false' port

### 3.4 WorkflowMinimap — `src/components/WorkflowMinimap.tsx` (new file)
- [ ] Fixed-position container (~200x150px) at bottom-right of canvas
- [ ] Render miniature node rectangles at scaled-down positions
- [ ] Render viewport rectangle showing current visible area
- [ ] Click/drag on minimap → pan canvas to corresponding position

### 3.5 WorkflowNodePalette — `src/components/WorkflowNodePalette.tsx` (new file)
- [ ] Left sidebar panel with node type list
- [ ] Each item: icon + label, draggable onto canvas
- [ ] On drop: calculate canvas position from drop coordinates, create node via store
- [ ] Collapsible (toggle button)

### 3.6 WorkflowProperties — `src/components/WorkflowProperties.tsx` (new file)
- [ ] Right side panel, shown when a node or edge is selected
- [ ] Node selected: type label, editable label, type-specific config fields:
  - `service_start` / `service_stop`: service dropdown (from services store)
  - `delay`: number input (seconds)
  - `condition`: service dropdown + running/stopped toggle
  - `manual_gate`: text input (prompt message)
  - `join`: radio (all / any)
- [ ] Edge selected: timeout (number), retry count (number), retry delay (number), source port (for conditions)
- [ ] Save button (or auto-save on change with debounce)

### 3.7 WorkflowToolbar — additions to `src/components/Toolbar.tsx`
- [ ] Add "Workflow" button to view toggle (alongside List and Grid)
- [ ] When workflow view active: show workflow selector dropdown + "New Workflow" button
- [ ] Show Run/Stop buttons for active workflow execution
- [ ] Hide search box and status filters (not applicable to workflow view)
- [ ] Add auto-layout button (distribute nodes evenly)

---

## Phase 4: Styling

### 4.1 CSS — additions to `src/styles/global.css`
- [ ] `.workflow-canvas-wrapper` — full-size container, overflow hidden, cursor styles
- [ ] `.workflow-canvas-transform` — transform-origin 0 0, transition for smooth zoom
- [ ] `.workflow-nodes-layer` — position relative, full size
- [ ] `.workflow-node` — absolute position, card-like styling with border-radius, shadow, type-specific accent colors
- [ ] `.workflow-node.running` — blue pulsing border animation
- [ ] `.workflow-node.completed` — green border
- [ ] `.workflow-node.failed` — red border
- [ ] `.workflow-node.waiting_approval` — yellow pulsing border
- [ ] `.workflow-port` — small circle (12px), hover scale, type-specific colors
- [ ] `.workflow-edges-svg` — absolute position, full size, pointer-events none on container, pointer-events stroke on paths
- [ ] `.workflow-edge-path` — stroke using `--text2`, hover highlight, selected uses `--accent`
- [ ] `.workflow-edge-path.true-port` — green stroke
- [ ] `.workflow-edge-path.false-port` — red stroke
- [ ] `.workflow-minimap` — fixed bottom-right, background `--surface`, border `--border`, border-radius, shadow
- [ ] `.workflow-palette` — left sidebar, width 200px, background `--surface`, collapsible
- [ ] `.workflow-properties` — right sidebar, width 280px, background `--surface`, form fields
- [ ] `.workflow-grid-bg` — CSS radial-gradient dot pattern
- [ ] `.workflow-toolbar` — row above canvas with workflow selector, run/stop, auto-layout
- [ ] `.workflow-execution-bar` — floating bar showing execution status, elapsed time, progress

---

## Phase 5: Integration & Polish

### 5.1 Workflow Selector
- [ ] When entering workflow view: show dropdown of existing workflows or "Create New"
- [ ] "Create New" opens inline form (name + description) then creates empty workflow and loads canvas
- [ ] Deleting a workflow from the dropdown prompts confirmation

### 5.2 Auto-Layout (stretch goal)
- [ ] Implement simple topological layout: assign layers based on longest path from root
- [ ] Position nodes in columns by layer, distribute vertically
- [ ] Triggered by "Auto Layout" button in toolbar

### 5.3 DAG Validation
- [ ] On save: run topological sort, detect cycles
- [ ] Show error toast if cycle detected, prevent save
- [ ] On load: validate, show warning badge if invalid

### 5.4 Execution Feedback
- [ ] During execution: broadcast `workflow:status` on every node state change
- [ ] Frontend subscribes and reactively updates node borders/icons
- [ ] Manual gate nodes: show approve button inline on the node when `waiting_approval`
- [ ] Execution completion: toast notification (success/failure)

---

## Verification

- [ ] Build server: `cd SolidJS && npm run build:server`
- [ ] Build client: `cd SolidJS && npm run build:client`
- [ ] Create a workflow with 3 nodes (start A → delay 2s → start B) via the canvas
- [ ] Verify edges render as Bezier curves between nodes
- [ ] Execute the workflow — verify A starts, delay waits 2s, then B starts
- [ ] Verify real-time node status updates on canvas during execution
- [ ] Test condition node: if A running → start B, else start C
- [ ] Test manual gate: workflow pauses, click approve, continues
- [ ] Test join node: two parallel branches converge at a join
- [ ] Test edge retry: make a service fail to start, verify retry kicks in
- [ ] Test edge timeout: set 1s timeout on a long delay, verify edge fails
- [ ] Test stop execution: mid-run, click stop, verify all running nodes stop
- [ ] Test cycle detection: create A→B→A, verify save is rejected with error
- [ ] Test minimap: verify nodes appear, viewport rect follows pan/zoom
- [ ] Test zoom: scroll wheel zooms in/out centered on cursor
- [ ] Test pan: Space+drag or middle-click drag pans the canvas
- [ ] Test snap-to-grid: drag node, verify it snaps to 20px grid on release
- [ ] Test node palette: drag "Start Service" from palette onto canvas, verify node created
- [ ] Test properties panel: click node, edit config, verify save
