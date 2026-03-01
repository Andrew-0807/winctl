import { createSignal, createEffect, on } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

// ── Filter/View State ────────────────────────────────────────────────────────

export type FilterType = 'all' | 'running' | 'stopped';

const [currentFilter, setCurrentFilter] = createSignal<FilterType>('all');
const [currentView, setCurrentView] = createSignal<FilterType>('all');
const [searchQuery, setSearchQuery] = createSignal('');

// ── Panel State ────────────────────────────────────────────────────────────────
// Using Map for better reactivity
const [openPanelsMap, setOpenPanelsMap] = createSignal<Map<string, boolean>>(new Map());
const [panelTabsMap, setPanelTabsMap] = createSignal<Map<string, string>>(new Map());

// Helper to get/set panel state
function getPanelOpen(id: string): boolean {
  return openPanelsMap().get(id) ?? false;
}

function setPanelOpen(id: string, open: boolean): void {
  console.log('[ui] setPanelOpen', id, open);
  const newMap = new Map(openPanelsMap());
  if (open) {
    newMap.set(id, true);
  } else {
    newMap.delete(id);
  }
  setOpenPanelsMap(newMap);
  console.log('[ui] openPanelsMap now:', [...newMap.entries()]);
}

function getPanelTab(id: string): string {
  return panelTabsMap().get(id) ?? 'logs';
}

function setPanelTabValue(id: string, tab: string): void {
  const newMap = new Map(panelTabsMap());
  newMap.set(id, tab);
  setPanelTabsMap(newMap);
}

// ── Folder State ──────────────────────────────────────────────────────────────

function loadExpandedFolders(): Set<string> {
  try {
    const stored = localStorage.getItem('expandedFolders');
    return new Set(stored ? JSON.parse(stored) : []);
  } catch {
    return new Set();
  }
}

const [expandedFolders, setExpandedFolders] = createSignal<Set<string>>(loadExpandedFolders());

function saveExpandedFolders(folders: Set<string>): void {
  localStorage.setItem('expandedFolders', JSON.stringify([...folders]));
}

// ── Sidebar State ─────────────────────────────────────────────────────────────

function loadSidebarCollapsed(): boolean {
  return localStorage.getItem('sidebarCollapsed') === 'true';
}

const [sidebarCollapsed, setSidebarCollapsed] = createSignal(loadSidebarCollapsed());
const [sidebarOpen, setSidebarOpen] = createSignal(false); // Mobile

function saveSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem('sidebarCollapsed', String(collapsed));
}

// ── Modal State ────────────────────────────────────────────────────────────────

const [modalOpen, setModalOpen] = createSignal(false);
const [modalEditId, setModalEditId] = createSignal<string | null>(null);
const [folderModalOpen, setFolderModalOpen] = createSignal(false);
const [folderModalEditId, setFolderModalEditId] = createSignal<string | null>(null);
const [settingsModalOpen, setSettingsModalOpen] = createSignal(false);
const [themeCreatorOpen, setThemeCreatorOpen] = createSignal(false);

// ── FAB State ────────────────────────────────────────────────────────────────

const [fabOpen, setFabOpen] = createSignal(false);

// ── Drag State ───────────────────────────────────────────────────────────────

const [draggedServiceId, setDraggedServiceId] = createSignal<string | null>(null);

// ── Toast State ──────────────────────────────────────────────────────────────

export interface Toast {
  id: number;
  msg: string;
  type: 'success' | 'error' | '';
}

const [toasts, setToasts] = createSignal<Toast[]>([]);
let toastId = 0;

/**
 * Show a toast notification
 */
export function toast(msg: string, type: '' | 'success' | 'error' = ''): void {
  const id = ++toastId;
  setToasts(produce((prev) => [...prev, { id, msg, type }]));
  
  setTimeout(() => {
    setToasts(produce((prev) => prev.filter((t) => t.id !== id)));
  }, 3200);
}

// ── Context Menu State ──────────────────────────────────────────────────────

const [contextMenuOpen, setContextMenuOpen] = createSignal(false);
const [contextMenuPosition, setContextMenuPosition] = createSignal({ x: 0, y: 0 });
const [contextFolderId, setContextFolderId] = createSignal<string | null>(null);

// ── Toggle Helpers ───────────────────────────────────────────────────────────

/**
 * Toggle a service panel open/closed
 */
export function togglePanel(id: string): void {
  const current = getPanelOpen(id);
  setPanelOpen(id, !current);
}

/**
 * Check if a panel is open
 */
export function isPanelOpen(id: string): boolean {
  const result = getPanelOpen(id);
  console.log('[ui] isPanelOpen', id, result);
  return result;
}

/**
 * Set panel tab
 */
export function setPanelTab(id: string, tab: string): void {
  setPanelTabValue(id, tab);
}

/**
 * Get current panel tab
 */
export function getPanelTabValue(id: string): string {
  return getPanelTab(id);
}

/**
 * Toggle folder expanded state
 */
export function toggleFolder(id: string): void {
  const current = expandedFolders();
  const next = new Set(current);
  
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  
  setExpandedFolders(next);
  saveExpandedFolders(next);
}

/**
 * Check if folder is expanded
 */
export function isFolderExpanded(id: string): boolean {
  return expandedFolders().has(id);
}

/**
 * Expand all folders
 * Note: This requires the services store to be imported. 
 * Call this after importing folders from the services store.
 */
export function expandAllFoldersWithIds(folderIds: string[]): void {
  const next = new Set<string>(folderIds);
  setExpandedFolders(next);
  saveExpandedFolders(next);
}

/**
 * Collapse all folders
 */
export function collapseAllFolders(): void {
  setExpandedFolders(new Set<string>());
  saveExpandedFolders(new Set<string>());
}

/**
 * Toggle sidebar collapsed state
 */
export function toggleSidebarCollapse(): void {
  const current = sidebarCollapsed();
  setSidebarCollapsed(!current);
  saveSidebarCollapsed(!current);
}

/**
 * Toggle sidebar mobile open state
 */
export function toggleSidebarMobile(): void {
  setSidebarOpen(!sidebarOpen());
}

/**
 * Open service modal for editing
 */
export function openServiceModal(id?: string): void {
  setModalEditId(id || null);
  setModalOpen(true);
}

/**
 * Close service modal
 */
export function closeServiceModal(): void {
  setModalOpen(false);
  setModalEditId(null);
}

/**
 * Open folder modal for editing
 */
export function openFolderModal(id?: string): void {
  setFolderModalEditId(id || null);
  setFolderModalOpen(true);
}

/**
 * Close folder modal
 */
export function closeFolderModal(): void {
  setFolderModalOpen(false);
  setFolderModalEditId(null);
}

/**
 * Open settings modal
 */
export function openSettingsModal(): void {
  setSettingsModalOpen(true);
}

/**
 * Close settings modal
 */
export function closeSettingsModal(): void {
  setSettingsModalOpen(false);
}

/**
 * Open theme creator modal
 */
export function openThemeCreator(): void {
  setThemeCreatorOpen(true);
}

/**
 * Close theme creator modal
 */
export function closeThemeCreator(): void {
  setThemeCreatorOpen(false);
}

/**
 * Toggle FAB menu
 */
export function toggleFab(): void {
  setFabOpen(!fabOpen());
}

// ── Context Menu Helpers ───────────────────────────────────────────────────

/**
 * Show context menu at position
 */
export function showContextMenu(x: number, y: number, folderId?: string): void {
  setContextMenuPosition({ x, y });
  setContextFolderId(folderId || null);
  setContextMenuOpen(true);
}

/**
 * Hide context menu
 */
export function hideContextMenu(): void {
  setContextMenuOpen(false);
  setContextFolderId(null);
}

// ── Keyboard Shortcuts Handler ───────────────────────────────────────────────

/**
 * Handle keyboard shortcuts
 */
export function handleKeyDown(e: KeyboardEvent): void {
  // Escape - close all modals
  if (e.key === 'Escape') {
    closeServiceModal();
    closeFolderModal();
    closeSettingsModal();
    closeThemeCreator();
    hideContextMenu();
    return;
  }
  
  // Ctrl/Cmd + K - focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchEl = document.getElementById('search');
    searchEl?.focus();
    return;
  }
  
  // Shift + N - new service
  if (e.shiftKey && e.key === 'N') {
    e.preventDefault();
    openServiceModal();
    return;
  }
  
  // Shift + F - new folder
  if (e.shiftKey && e.key === 'F') {
    e.preventDefault();
    openFolderModal();
    return;
  }
  
  // ? - open settings (when not in input)
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && 
      document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    openSettingsModal();
    return;
  }
}

// ── Export all state ─────────────────────────────────────────────────────────

export {
  currentFilter,
  setCurrentFilter,
  currentView,
  setCurrentView,
  searchQuery,
  setSearchQuery,
  expandedFolders,
  setExpandedFolders,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarOpen,
  setSidebarOpen,
  modalOpen,
  setModalOpen,
  modalEditId,
  setModalEditId,
  folderModalOpen,
  setFolderModalOpen,
  folderModalEditId,
  setFolderModalEditId,
  settingsModalOpen,
  setSettingsModalOpen,
  themeCreatorOpen,
  setThemeCreatorOpen,
  fabOpen,
  setFabOpen,
  draggedServiceId,
  setDraggedServiceId,
  toasts,
  setToasts,
  contextMenuOpen,
  contextMenuPosition,
  contextFolderId
};
