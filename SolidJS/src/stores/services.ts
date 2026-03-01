import { createStore, produce } from 'solid-js/store';
import { createSignal } from 'solid-js';
import * as api from './socket';
import type { ServiceStatus as Service, Folder, Settings, SystemInfo } from './socket';
export type { Service, Folder, Settings, SystemInfo };

// Services store
const [services, setServices] = createStore<api.ServiceStatus[]>([]);
const [folders, setFolders] = createStore<api.Folder[]>([]);
const [settings, setSettings] = createStore<api.Settings>({
  theme: 'dark-default',
  folderStatePreference: 'remember',
  showFolderCount: true,
  autoStart: false,
});
const [systemInfo, setSystemInfo] = createSignal<api.SystemInfo | null>(null);
const [loading, setLoading] = createSignal(true);
const [error, setError] = createSignal<string | null>(null);

// Load initial data
export async function loadServices(): Promise<void> {
  setLoading(true);
  setError(null);

  try {
    const status = await api.getStatus();
    setServices(status.services);
    setFolders(status.folders);
    setSettings(status.settings);
    setLoading(false);
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Unknown error');
    setLoading(false);
  }
}

// Load system info
export async function loadSystem(): Promise<void> {
  try {
    const info = await api.getSystemInfo();
    setSystemInfo(info);
  } catch (e) {
    console.error('Failed to load system info:', e);
  }
}

// Start a service
export async function startService(id: string): Promise<boolean> {
  try {
    await api.startService(id);
    await loadServices(); // Refresh status
    return true;
  } catch (e) {
    console.error('Failed to start service:', e);
    return false;
  }
}

// Stop a service
export async function stopService(id: string): Promise<boolean> {
  try {
    await api.stopService(id);
    await loadServices(); // Refresh status
    return true;
  } catch (e) {
    console.error('Failed to stop service:', e);
    return false;
  }
}

// Restart a service
export async function restartService(id: string): Promise<boolean> {
  try {
    await api.restartService(id);
    await loadServices(); // Refresh status
    return true;
  } catch (e) {
    console.error('Failed to restart service:', e);
    return false;
  }
}

// Save a service (create or update)
export async function saveService(data: Partial<api.ServiceStatus>, id?: string): Promise<boolean> {
  try {
    if (id) {
      await api.updateService(data as api.ServiceStatus);
    } else {
      await api.createService(data as api.ServiceStatus);
    }
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to save service:', e);
    return false;
  }
}

// Delete a service
export async function deleteService(id: string): Promise<boolean> {
  try {
    await api.deleteService(id);
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to delete service:', e);
    return false;
  }
}

// Reorder services
export async function reorderServices(orderedIds: string[]): Promise<boolean> {
  try {
    await api.reorderServices(orderedIds);
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to reorder services:', e);
    return false;
  }
}

// Start all stopped services
export async function startAll(): Promise<number> {
  const stopped = services.filter(s => s.status === 'stopped');
  let count = 0;

  for (const s of stopped) {
    const success = await startService(s.id);
    if (success) count++;
  }

  return count;
}

// Stop all running services
export async function stopAll(): Promise<number> {
  const running = services.filter(s => s.status === 'running');
  let count = 0;

  for (const s of running) {
    const success = await stopService(s.id);
    if (success) count++;
  }

  return count;
}

// Create or update a folder
export async function saveFolder(name: string, id?: string): Promise<boolean> {
  try {
    if (id) {
      await api.updateFolder({ id, name });
    } else {
      await api.createFolder({ id: crypto.randomUUID(), name });
    }
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to save folder:', e);
    return false;
  }
}

// Delete a folder
export async function deleteFolder(id: string): Promise<boolean> {
  try {
    await api.deleteFolder(id);
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to delete folder:', e);
    return false;
  }
}

// Folder actions
export async function folderAction(id: string, action: 'start' | 'stop'): Promise<number> {
  const folderServices = services.filter(s => s.folderId === id);
  let count = 0;

  for (const s of folderServices) {
    const success = action === 'start' ? await startService(s.id) : await stopService(s.id);
    if (success) count++;
  }

  return count;
}

// Move a service to a folder
export async function moveServiceToFolder(serviceId: string, folderId: string | null): Promise<boolean> {
  try {
    const service = services.find(s => s.id === serviceId);
    if (!service) return false;

    await api.updateService({ ...service, folderId });
    await loadServices(); // Refresh
    return true;
  } catch (e) {
    console.error('Failed to move service to folder:', e);
    return false;
  }
}

// Update settings
export async function updateSettings(newSettings: Partial<api.Settings>): Promise<boolean> {
  try {
    const updated = { ...settings, ...newSettings };
    await api.saveSettings(updated);
    setSettings(updated);
    return true;
  } catch (e) {
    console.error('Failed to update settings:', e);
    return false;
  }
}

// Toggle WinCTL auto-start
export async function toggleAutoStart(): Promise<boolean> {
  const newValue = !settings.autoStart;
  return updateSettings({ autoStart: newValue });
}

// Derived State
export function getRunningCount(): number {
  return services.filter(s => s.status === 'running').length;
}

export function getStoppedCount(): number {
  return services.filter(s => s.status === 'stopped').length;
}

export function getServicesByStatus(status: 'running' | 'stopped' | 'all'): api.ServiceStatus[] {
  if (status === 'all') return [...services];
  return services.filter(s => s.status === status);
}

export function getServicesInFolder(folderId: string): api.ServiceStatus[] {
  return services.filter(s => s.folderId === folderId);
}

export function getRootServices(): api.ServiceStatus[] {
  return services.filter(s => !s.folderId);
}

// Export store
export {
  services,
  folders,
  settings,
  systemInfo,
  loading,
  error,
  setServices,
  setFolders,
  setSettings,
  setSystemInfo
};
