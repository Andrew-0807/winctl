import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface ServiceStatus {
  id: string;
  name: string;
  command: string;
  args: string;
  cwd: string;
  port: string;
  description: string;
  autoRestart: boolean;
  autoStart: boolean;
  minimized: boolean;
  folderId: string | null;
  sortOrder: number;
  /** Lucide icon name OR a data: URI for an uploaded image. Empty = no icon. */
  icon?: string | null;
  /** Minutes to wait after WinCTL boot before auto-starting. 0 = immediate. */
  startDelayMins?: number;
  status: string;
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  recentLogs: Array<{ t: string; line: string }>;
  startupError: string | null;
  externallyOwned: boolean;
}

export interface Folder {
  id: string;
  name: string;
}

export interface Settings {
  theme: string;
  folderStatePreference: string;
  showFolderCount: boolean;
  autoStart: boolean;
  keepServicesOnExit: boolean;
  fetchTool?: string | null;
  customFont?: string | null;
  port?: number;
  onboarding_complete?: boolean;
  // UI-only state persisted in settings
  currentView?: string;
  sidebarCollapsed?: boolean;
  expandedFolders?: string[];
  clipboardAutoCopy?: boolean;
  trustedDevices?: Array<{ id: string; name: string; createdAt: number }>;
}

export interface SystemInfo {
  platform: string;
  hostname: string;
  cpuCount: number;
  totalMem: number;
  freeMem: number;
  cachedMem: number;
  uptime: number;
}

export interface ExecOutputEvent {
  type: 'exec-output';
  execId: string;
  stream: 'stdout' | 'stderr';
  line: string;
}

export interface ExecDoneEvent {
  type: 'exec-done';
  execId: string;
  exitCode: number | null;
}

export type ExecEvent = ExecOutputEvent | ExecDoneEvent;

export interface StatusPayload {
  services: ServiceStatus[];
  folders: Folder[];
  settings: Settings;
}

const TOKEN_KEY = 'winctl_token';

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getApiBase(): string {
  return isTauri() ? 'http://localhost:8888' : '';
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

let unlisten: UnlistenFn | null = null;
let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsReconnectDelay = 1000;   // ms, doubles on each failure, caps at 30 s
let wsPort = '8888';
let wsHandlers: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onStatus?: (payload: StatusPayload) => void;
  onAuthFail?: () => void;
  onExecOutput?: (data: ExecOutputEvent) => void;
  onExecDone?: (data: ExecDoneEvent) => void;
} = {};

function connectWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  const wsUrl = isTauri() ? 'ws://localhost:8888/api/ws' : '/api/ws';
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    wsReconnectDelay = 1000;  // reset backoff on successful connect
    wsHandlers.onConnect?.();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as { type?: string } & StatusPayload;
      if (data.type === 'status') {
        wsHandlers.onStatus?.(data);
      } else if (data.type === 'exec-output') {
        wsHandlers.onExecOutput?.(data as unknown as ExecOutputEvent);
      } else if (data.type === 'exec-done') {
        wsHandlers.onExecDone?.(data as unknown as ExecDoneEvent);
      } else if (data.type === 'exec-kill') {
      }
    } catch (e) {
      console.error('[WinCTL] WS message parse error:', e, event.data);
    }
  };

  ws.onerror = (err) => {
    console.warn('[WinCTL] WS error:', err);
  };

  ws.onclose = () => {
    wsHandlers.onDisconnect?.();
    // Reconnect with exponential backoff (1 s → 2 s → 4 s … → 30 s)
    if (!wsReconnectTimer) {
      wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        connectWebSocket();
      }, wsReconnectDelay);
      wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30_000);
    }
  };
}

export async function initSocket(handlers: {
  onConnect: () => void;
  onDisconnect: () => void;
  onAuthFail: () => void;
  onStatus: (payload: StatusPayload) => void;
  onExecOutput?: (data: ExecOutputEvent) => void;
  onExecDone?: (data: ExecDoneEvent) => void;
}): Promise<void> {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  wsHandlers = handlers;

  if (isTauri) {
    unlisten = await listen<StatusPayload>('status', (event) => {
      handlers.onStatus(event.payload);
    });
    handlers.onConnect();
  } else {
    console.warn('[WinCTL] Browser WS init — isTauri returned false, connecting via proxy');
    connectWebSocket();
  }
}

export function disconnectSocket(): void {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
  if (ws) {
    ws.onclose = null; // prevent reconnect loop on explicit disconnect
    ws.close();
    ws = null;
  }
}

export async function login(password: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Login failed');
  }
  const { token } = (await res.json()) as { token: string };
  storeToken(token);
}

export async function logoutSocket(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    console.warn('[WinCTL] logout endpoint error (non-fatal):', e);
  }
  clearToken();
  disconnectSocket();
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['x-winctl-token'] = token;

  const response = await fetch(`${getApiBase()}${url}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('winctl:auth-fail'));
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getStatus(): Promise<StatusPayload> {
  const [servicesResult, settings] = await Promise.all([
    apiFetch<{ services: ServiceStatus[]; folders: Folder[] }>('/api/services'),
    apiFetch<Settings>('/api/settings'),
  ]);
  return { services: servicesResult.services, folders: servicesResult.folders, settings };
}

export const startServiceAPI = (id: string) =>
  apiFetch<any>(`/api/services/${id}/start`, { method: 'POST' });

export const stopServiceAPI = (id: string) =>
  apiFetch<void>(`/api/services/${id}/stop`, { method: 'POST' });

export const restartServiceAPI = (id: string) =>
  apiFetch<void>(`/api/services/${id}/restart`, { method: 'POST' });

export const getSystemInfo = () => apiFetch<any>('/api/system');

export const flushMemoryAPI = () =>
  apiFetch<any>('/api/system/flush-memory', { method: 'POST' });

export const createServiceAPI = (service: any) =>
  apiFetch<any>('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service),
  });

export const updateServiceAPI = (service: any) =>
  apiFetch<any>(`/api/services/${service.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service),
  });

export const deleteServiceAPI = (id: string) =>
  apiFetch<void>(`/api/services/${id}`, { method: 'DELETE' });

export const reorderServicesAPI = (orderedIds: string[]) =>
  apiFetch<void>('/api/services/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderedIds),
  });

export const reorderFoldersAPI = (orderedIds: string[]) =>
  apiFetch<void>('/api/folders/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderedIds),
  });

export const createFolderAPI = (folder: any) =>
  apiFetch<any>('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder),
  });

export const updateFolderAPI = (folder: any) =>
  apiFetch<any>(`/api/folders/${folder.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder),
  });

export const deleteFolderAPI = (id: string) =>
  apiFetch<void>(`/api/folders/${id}`, { method: 'DELETE' });

export const getServiceLogs = (id: string) =>
  apiFetch<any[]>(`/api/services/${id}/logs`);

export const saveSettingsAPI = (settings: Settings) =>
  apiFetch<void>('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

export const shutdownDaemon = (keepServices = false) =>
  apiFetch<void>('/api/shutdown', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepServices }),
  });

export const getThemesAPI = () => apiFetch<any[]>('/api/themes');

export const postExec = (command: string, cwd?: string) =>
  apiFetch<{ execId: string }>('/api/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd }),
  });

export const killExecSession = (execId: string) =>
  apiFetch<void>(`/api/exec/${execId}/kill`, { method: 'POST' });

export const getInstalledFonts = () => apiFetch<string[]>('/api/fonts');

export const getAvailableTools = () => apiFetch<{ tools: string[] }>('/api/sysinfo/tools');

export const runFetchTool = () => apiFetch<{ output: string }>('/api/sysinfo/run', { method: 'POST' });

export const getSetupStatus = () =>
  apiFetch<{
    needs_setup: boolean;
    onboarding_complete: boolean;
    api_secret_set: boolean;
    open_access: boolean;
    bind_host: string;
  }>('/api/setup/status');

export const completeSetup = (data: { api_secret: string; open_access: boolean; bind_host: string }) =>
  apiFetch<{ ok: boolean }>('/api/setup/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

export const registerDeviceAPI = (deviceId: string, deviceName: string) =>
  apiFetch<{ device_id: string; token: string }>('/api/setup/device/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, device_name: deviceName }),
  });