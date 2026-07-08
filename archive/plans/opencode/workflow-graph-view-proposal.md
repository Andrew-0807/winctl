# Workflow Graph View — Proposal

## Why

WinCTL currently manages individual services in isolation — you start them, stop them, and group them into folders. But real-world workflows are **sequential and interdependent**: a database must be running before the API server starts, a cache layer must come up before the app, and shutting down should happen in reverse order. Today there's no way to express these patterns.

A **Workflow Graph View** fills this gap. It lets users visually design DAGs (directed acyclic graphs) where nodes represent service actions (start, stop) and control flow elements (delays, conditions, manual gates, parallel joins). The daemon executes these workflows step-by-step, respecting dependencies, parallel branches, timeouts, and retries.

This transforms WinCTL from a service dashboard into a lightweight **local orchestration platform**.

## What Changes

- New **Workflow View** in the UI alongside existing List and Gallery views — a full canvas editor with zoom/pan, minimap, and snap-to-grid
- New **node types**: `service_start`, `service_stop`, `delay`, `condition`, `manual_gate`, `join`
- **Edge model** with configurable timeout, retry count, and delay-before-execution
- **Workflow execution engine** in the daemon that processes the DAG, tracks per-node state, handles parallel branches and join/sync, broadcasts live status via Socket.IO
- **New config file**: `~/.config/winctl/workflows.json` — persisted separately from services
- **New REST API** endpoints for workflow CRUD, execution start/stop, and execution status
- **Socket.IO events** for real-time node-level execution status updates

## Capabilities

### New Capabilities
- `workflow-orchestration`: Visually design and execute multi-service workflows with dependencies, parallelism, conditions, and retries
- `workflow-canvas`: Interactive graph editor for creating workflow DAGs — drag nodes, connect edges, configure properties

### Modified Capabilities
- `view-toggle`: View type expands from `list | gallery` to `list | gallery | workflow`
- `config-management`: New `workflows.json` config file alongside existing `services.json`

## Impact

- **Server**: `server/types.ts` — new types: `Workflow`, `WorkflowNode`, `WorkflowEdge`, `WorkflowExecution`, `NodeExecutionState`
- **Server**: `server/workflow-config.ts` — load/save `~/.config/winctl/workflows.json` with same cache pattern as existing config
- **Server**: `server/workflow-engine.ts` — DAG execution engine: state machine, parallel branches, join/sync, conditions, retry, timeout
- **Server**: `server/routes.ts` — new workflow REST endpoints
- **Server**: `server/index.ts` — initialize workflow engine, new Socket.IO events
- **Frontend**: `src/components/WorkflowView.tsx` — main canvas component with SVG edges + HTML nodes
- **Frontend**: `src/components/WorkflowToolbar.tsx` — workflow actions (run, stop, new, auto-layout)
- **Frontend**: `src/components/WorkflowNode.tsx` — individual node rendering on canvas
- **Frontend**: `src/components/WorkflowEdge.tsx` — SVG edge rendering with Bezier curves
- **Frontend**: `src/components/WorkflowProperties.tsx` — side panel for editing node/edge properties
- **Frontend**: `src/components/WorkflowMinimap.tsx` — minimap overview
- **Frontend**: `src/components/WorkflowNodePalette.tsx` — drag-to-add node palette
- **Frontend**: `src/stores/workflows.ts` — SolidJS store for workflows, canvas state, execution state
- **Frontend**: `src/stores/socket.ts` — subscribe to `workflow:status` Socket.IO events
- **Frontend**: `src/styles/global.css` — canvas, node, edge, minimap styles