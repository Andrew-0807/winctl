import { create } from 'zustand';
import type { ExecOutputEvent, ExecDoneEvent } from './socket';

// ── Exec Event Bus ────────────────────────────────────────────────────────────
// Using a custom typed event emitter wrapper for TypeScript compatibility
type ExecEventType = 'exec-output' | 'exec-done';
type ExecEventData = ExecOutputEvent | ExecDoneEvent;

interface TypedEventListener<T = ExecEventData> {
  (event: CustomEvent<T>): void;
}

interface TypedEventTarget {
  addEventListener(type: ExecEventType, listener: TypedEventListener, options?: AddEventListenerOptions): void;
  removeEventListener(type: ExecEventType, listener: TypedEventListener, options?: EventListenerOptions): void;
  dispatchEvent(event: CustomEvent<ExecEventData>): boolean;
}

const execEvents: TypedEventTarget = new EventTarget() as TypedEventTarget;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FilterType = 'all' | 'running' | 'stopped';
export type ViewType = 'list' | 'gallery';

export interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | '';
}

export interface ExecLine {
  stream: 'stdout' | 'stderr';
  line: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ExecState {
  command: string;
  execId: string | null;
  lines: ExecLine[];
  exitCode: number | null;
}

interface UIState {
  // Filter/View — synced from server settings
  currentFilter: FilterType;
  searchQuery: string;

  // Panel state
  openPanels: Record<string, boolean>;
  panelTabs: Record<string, string>;

  // Sidebar — synced from server settings
  sidebarOpen: boolean; // Mobile only (transient)

  // Modals
  modalOpen: boolean;
  modalEditId: string | null;
  folderModalOpen: boolean;
  folderModalEditId: string | null;
  settingsModalOpen: boolean;
  themeCreatorOpen: boolean;
  systemInfoModalOpen: boolean;

  // FAB
  fabOpen: boolean;

  // Drag
  draggedServiceId: string | null;
  dragOverServiceId: string | null;
  dragOverPosition: 'before' | 'after';

  // Toasts
  toasts: Toast[];

  // Confirm dialog
  confirmState: ConfirmOptions | null;

  // Context menu
  contextMenuOpen: boolean;
  contextMenuPosition: { x: number; y: number };
  contextFolderId: string | null;

  // Run Command Panel
  execState: ExecState;
  runPanelOpen: boolean;

  // Actions
  setCurrentFilter: (filter: FilterType) => void;
  setSearchQuery: (query: string) => void;
  togglePanel: (id: string) => void;
  isPanelOpen: (id: string) => boolean;
  setPanelTab: (id: string, tab: string) => void;
  getPanelTab: (id: string) => string;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarMobile: () => void;
  openServiceModal: (id?: string) => void;
  closeServiceModal: () => void;
  openFolderModal: (id?: string) => void;
  closeFolderModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openThemeCreator: () => void;
  closeThemeCreator: () => void;
  openSystemInfoModal: () => void;
  closeSystemInfoModal: () => void;
  toggleFab: () => void;
  showContextMenu: (x: number, y: number, folderId?: string) => void;
  hideContextMenu: () => void;
  toast: (msg: string, type?: '' | 'success' | 'error') => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
  handleKeyDown: (e: KeyboardEvent) => void;

  // Exec actions
  setExecCommand: (command: string) => void;
  setExecRunning: (execId: string) => void;
  appendExecLine: (execId: string, line: ExecLine) => void;
  setExecDone: (execId: string, exitCode: number | null) => void;
  clearExec: () => void;
  toggleRunPanel: () => void;
}

let toastId = 0;
let confirmResolver: ((result: boolean) => void) | null = null;

let lastKeydownTime = 0;
const KEYDOWN_DEBOUNCE_MS = 500;

export const useUIStore = create<UIState>((set, get) => ({
  currentFilter: 'all',
  searchQuery: '',
  openPanels: {},
  panelTabs: {},
  sidebarOpen: false,
  modalOpen: false,
  modalEditId: null,
  folderModalOpen: false,
  folderModalEditId: null,
  settingsModalOpen: false,
  themeCreatorOpen: false,
  systemInfoModalOpen: false,
  fabOpen: false,
  draggedServiceId: null,
  dragOverServiceId: null,
  dragOverPosition: 'before',
  toasts: [],
  contextMenuOpen: false,
  contextMenuPosition: { x: 0, y: 0 },
  contextFolderId: null,
  confirmState: null,
  execState: { command: '', execId: null, lines: [], exitCode: null },
  runPanelOpen: false,

  setCurrentFilter: (currentFilter) => set({ currentFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  togglePanel: (id) =>
    set((s) => ({
      openPanels: { ...s.openPanels, [id]: !s.openPanels[id] },
    })),

  isPanelOpen: (id) => !!get().openPanels[id],

  setPanelTab: (id, tab) =>
    set((s) => ({
      panelTabs: { ...s.panelTabs, [id]: tab },
    })),

  getPanelTab: (id) => get().panelTabs[id] ?? 'logs',

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebarMobile: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  openServiceModal: (id) => set({ modalOpen: true, modalEditId: id ?? null }),
  closeServiceModal: () => set({ modalOpen: false, modalEditId: null }),
  openFolderModal: (id) => set({ folderModalOpen: true, folderModalEditId: id ?? null }),
  closeFolderModal: () => set({ folderModalOpen: false, folderModalEditId: null }),
  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),
  openThemeCreator: () => set({ themeCreatorOpen: true }),
  closeThemeCreator: () => set({ themeCreatorOpen: false }),
  openSystemInfoModal: () => set({ systemInfoModalOpen: true }),
  closeSystemInfoModal: () => set({ systemInfoModalOpen: false }),
  toggleFab: () => set((s) => ({ fabOpen: !s.fabOpen })),

  showContextMenu: (x, y, folderId) =>
    set({
      contextMenuOpen: true,
      contextMenuPosition: { x, y },
      contextFolderId: folderId ?? null,
    }),

  hideContextMenu: () => set({ contextMenuOpen: false, contextFolderId: null }),

  toast: (msg, type = '') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },

  confirm: (opts) => {
    // ponytail: single outstanding confirm; opening a new one rejects the prior as cancelled
    confirmResolver?.(false);
    set({ confirmState: opts });
    return new Promise<boolean>((resolve) => { confirmResolver = resolve; });
  },

  resolveConfirm: (result) => {
    confirmResolver?.(result);
    confirmResolver = null;
    set({ confirmState: null });
  },

  handleKeyDown: (e: KeyboardEvent) => {
    const state = get();
    if (e.key === 'Escape') {
      if (get().confirmState) { state.resolveConfirm(false); return; }
      state.closeServiceModal();
      state.closeFolderModal();
      state.closeSettingsModal();
      state.closeThemeCreator();
      state.closeSystemInfoModal();
      state.hideContextMenu();
      return;
    }

    const now = Date.now();
    if (now - lastKeydownTime < KEYDOWN_DEBOUNCE_MS) return;
    lastKeydownTime = now;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('search')?.focus();
      return;
    }
    if (e.shiftKey && e.key === 'N') {
      e.preventDefault();
      state.openServiceModal();
      return;
    }
    if (e.shiftKey && e.key === 'F') {
      e.preventDefault();
      state.openFolderModal();
      return;
    }
    if (
      e.key === '?' &&
      !e.ctrlKey &&
      !e.metaKey &&
      document.activeElement?.tagName !== 'INPUT'
    ) {
      e.preventDefault();
      state.openSettingsModal();
      return;
    }
  },

  // Exec actions
  setExecCommand: (command) =>
    set((s) => ({ execState: { ...s.execState, command } })),

  setExecRunning: (execId) =>
    set((s) => ({ execState: { ...s.execState, execId, lines: [], exitCode: null } })),

  appendExecLine: (execId, line) =>
    set((s) => {
      if (s.execState.execId !== execId) return s;
      return { execState: { ...s.execState, lines: [...s.execState.lines, line] } };
    }),

  setExecDone: (execId, exitCode) =>
    set((s) => {
      if (s.execState.execId !== execId) return s;
      return { execState: { ...s.execState, execId: null, exitCode } };
    }),

  clearExec: () =>
    set((s) => ({
      execState: { ...s.execState, lines: [], exitCode: null, execId: null },
    })),

  toggleRunPanel: () => set((s) => ({ runPanelOpen: !s.runPanelOpen })),
}));

// Listen on execEvents and update the store
if (typeof window !== 'undefined') {
  execEvents.addEventListener('exec-output', ((e: CustomEvent<ExecOutputEvent>) => {
    const data = e.detail;
    useUIStore.getState().appendExecLine(data.execId, { stream: data.stream, line: data.line });
  }) as EventListener);

  execEvents.addEventListener('exec-done', ((e: CustomEvent<ExecDoneEvent>) => {
    const data = e.detail;
    useUIStore.getState().setExecDone(data.execId, data.exitCode);
  }) as EventListener);
}

export { execEvents };
