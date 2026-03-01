import { createSignal } from 'solid-js';

// Connection state signals
const [connected, setConnected] = createSignal(true);
const [connecting, setConnecting] = createSignal(false);

// Types
interface ServiceStatus {
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
  status: string;
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  recentLogs: Array<{ t: string; line: string }>;
}

interface Folder {
  id: string;
  name: string;
}

interface Settings {
  theme: string;
  folderStatePreference: string;
  showFolderCount: boolean;
  autoStart: boolean;
}

interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  totalMem: number;
  freeMem: number;
  cpus: number;
}

interface StatusPayload {
  services: ServiceStatus[];
  folders: Folder[];
  settings: Settings;
}

interface Theme {
  id: string;
  name: string;
  author: string;
  builtIn: boolean;
  colors: Record<string, string>;
}

// Helper for fetch
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// API functions using fetch
async function getStatus(): Promise<StatusPayload> {
  const [services, folders, settings] = await Promise.all([
    apiFetch<ServiceStatus[]>('/api/services'),
    apiFetch<Folder[]>('/api/folders'),
    apiFetch<Settings>('/api/settings')
  ]);
  return { services, folders, settings };
}

async function startService(id: string): Promise<number | any> {
  return apiFetch<any>(`/api/services/${id}/start`, { method: 'POST' });
}

async function stopService(id: string): Promise<void> {
  return apiFetch<void>(`/api/services/${id}/stop`, { method: 'POST' });
}

async function restartService(id: string): Promise<void> {
  return apiFetch<void>(`/api/services/${id}/restart`, { method: 'POST' });
}

async function getSystemInfo(): Promise<SystemInfo> {
  return apiFetch<SystemInfo>('/api/system');
}

async function getServices(): Promise<ServiceStatus[]> {
  return apiFetch<ServiceStatus[]>('/api/services');
}

async function getFolders(): Promise<Folder[]> {
  return apiFetch<Folder[]>('/api/folders');
}

async function getSettings(): Promise<Settings> {
  return apiFetch<Settings>('/api/settings');
}

async function saveConfig(config: {
  services: ServiceStatus[];
  folders: Folder[];
  settings: Settings;
}): Promise<void> {
  // Not used directly anymore, we update parts
  await apiFetch<void>('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.settings)
  });
}

async function createService(service: any): Promise<ServiceStatus> {
  return apiFetch<ServiceStatus>('/api/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service)
  });
}

async function updateService(service: any): Promise<ServiceStatus> {
  return apiFetch<ServiceStatus>(`/api/services/${service.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service)
  });
}

async function deleteService(id: string): Promise<void> {
  return apiFetch<void>(`/api/services/${id}`, { method: 'DELETE' });
}

async function reorderServices(orderedIds: string[]): Promise<void> {
  return apiFetch<void>('/api/services/reorder', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderedIds)
  });
}

async function createFolder(folder: any): Promise<Folder> {
  return apiFetch<Folder>('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder)
  });
}

async function updateFolder(folder: any): Promise<Folder> {
  return apiFetch<Folder>(`/api/folders/${folder.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder)
  });
}

async function deleteFolder(id: string): Promise<void> {
  return apiFetch<void>(`/api/folders/${id}`, { method: 'DELETE' });
}

async function getServiceLogs(id: string): Promise<Array<{ t: string; line: string }>> {
  return apiFetch<Array<{ t: string; line: string }>>(`/api/services/${id}/logs`);
}


async function saveSettings(settings: Settings): Promise<void> {
  return apiFetch<void>('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
}

async function getThemes(): Promise<Theme[]> {
  return apiFetch<Theme[]>('/api/themes');
}

// Export everything
export {
  connected,
  connecting,
  setConnected,
  setConnecting,
  getStatus,
  startService,
  stopService,
  restartService,
  getSystemInfo,
  getServices,
  getFolders,
  getSettings,
  saveConfig,
  createService,
  updateService,
  deleteService,
  reorderServices,
  createFolder,
  updateFolder,
  deleteFolder,
  getServiceLogs,
  saveSettings,
  getThemes,
};

export type {
  ServiceStatus,
  Folder,
  Settings,
  SystemInfo,
  Theme,
  StatusPayload,
};
