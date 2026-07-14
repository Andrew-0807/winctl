import { create } from 'zustand';
import * as api from './socket';
import type { ServiceStatus, Folder, Settings, SystemInfo, StatusPayload, ExecOutputEvent, ExecDoneEvent } from './socket';
import { execEvents } from './ui';
import { safeRandomUUID } from '../lib/utils';

// UI-only settings that persist locally but aren't sent to server
export interface UISettings {
  currentView: string;
  sidebarCollapsed: boolean;
  expandedFolders: string[];
  clipboardAutoCopy: boolean;
}

export type { ServiceStatus as Service, Folder, Settings, SystemInfo };

interface ServiceState {
  services: ServiceStatus[];
  folders: Folder[];
  settings: Settings;
  uiSettings: UISettings;
  systemInfo: SystemInfo | null;
  loading: boolean;
  error: string | null;
  isLoggedIn: boolean;
  connected: boolean;
  connecting: boolean;
  onboardingComplete: boolean | null;

  // Actions
  setServices: (services: ServiceStatus[]) => void;
  setFolders: (folders: Folder[]) => void;
  setSettings: (settings: Settings) => void;
  setUISettings: (settings: Partial<UISettings>) => void;
  setSystemInfo: (info: SystemInfo | null) => void;
  setLoggedIn: (v: boolean) => void;
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setOnboardingComplete: (v: boolean) => void;

  // API actions
  loadServices: () => Promise<void>;
  loadSystem: () => Promise<void>;
  startService: (id: string) => Promise<boolean>;
  stopService: (id: string) => Promise<boolean>;
  restartService: (id: string) => Promise<boolean>;
  saveService: (data: Partial<ServiceStatus>, id?: string) => Promise<boolean>;
  deleteService: (id: string) => Promise<boolean>;
  reorderServices: (orderedIds: string[]) => Promise<boolean>;
  startAll: () => Promise<number>;
  stopAll: () => Promise<number>;
  reorderFolders: (orderedIds: string[]) => Promise<boolean>;
  saveFolder: (name: string, id?: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  folderAction: (id: string, action: 'start' | 'stop') => Promise<number>;
  moveServiceToFolder: (serviceId: string, folderId: string | null) => Promise<boolean>;
  updateSettings: (newSettings: Partial<Settings>) => Promise<boolean>;
  toggleAutoStart: () => Promise<boolean>;
  dismissError: (id: string) => void;
  checkSetupStatus: () => Promise<boolean>;
  registerDevice: (deviceId: string, deviceName: string) => Promise<void>;

  // Derived
  getRunningCount: () => number;
  getStoppedCount: () => number;
  getServicesInFolder: (folderId: string) => ServiceStatus[];
  getRootServices: () => ServiceStatus[];

  // Socket integration
  handleStatusUpdate: (payload: StatusPayload) => void;
  initializeSocket: () => void;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_UI_SETTINGS: UISettings = {
  currentView: 'list',
  sidebarCollapsed: false,
  expandedFolders: [],
  clipboardAutoCopy: true,
};

export const useServiceStore = create<ServiceState>((set, get) => ({
  services: [],
  folders: [],
  settings: {
    theme: 'dark-default',
    folderStatePreference: 'remember',
    showFolderCount: true,
    autoStart: false,
    keepServicesOnExit: false,
    fetchTool: null,
    clipboardAutoCopy: true,
  },
  uiSettings: DEFAULT_UI_SETTINGS,
  systemInfo: null,
  loading: true,
  error: null,
  isLoggedIn: !!api.getStoredToken(),
  connected: false,
  connecting: !api.isTauri() && !!api.getStoredToken(),
  onboardingComplete: null,

  setServices: (services) => set({ services }),
  setFolders: (folders) => set({ folders }),
  setSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
  setUISettings: (uiSettings) => set((s) => ({ uiSettings: { ...s.uiSettings, ...uiSettings } })),
  setSystemInfo: (systemInfo) => set({ systemInfo }),
  setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),

  handleStatusUpdate: (payload) => {
    const services = Array.isArray(payload.services) ? payload.services : [];
    const folders = Array.isArray(payload.folders) ? payload.folders : [];
    set({
      services,
      folders,
      settings: { ...get().settings, ...payload.settings },
      loading: false,
    });
  },

  initializeSocket: () => {
    window.addEventListener('winctl:auth-fail', () => {
      set({ isLoggedIn: false, connected: false, connecting: false });
    });

    if (api.isTauri()) {
      set({ isLoggedIn: true });
    }

    api.initSocket({
      onConnect: () => {
        set({ connected: true, connecting: false, isLoggedIn: true });
      },
      onDisconnect: () => {
        set({ connected: false });
      },
      onAuthFail: () => {
        set({ isLoggedIn: false, connected: false, connecting: false });
      },
      onStatus: (payload) => {
        get().handleStatusUpdate(payload);
      },
      onExecOutput: (data) => {
        // Dispatch to execEvents EventTarget
        execEvents.dispatchEvent(new CustomEvent('exec-output', { detail: data as ExecOutputEvent }));
      },
      onExecDone: (data) => {
        // Dispatch to execEvents EventTarget
        execEvents.dispatchEvent(new CustomEvent('exec-done', { detail: data as ExecDoneEvent }));
      },
    });
  },

  login: async (password) => {
    await api.login(password);
    set({ isLoggedIn: true, connecting: true });
  },

  logout: async () => {
    await api.logoutSocket();
    set({ isLoggedIn: false, connected: false });
  },

  loadServices: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.getStatus();
      const services = Array.isArray(status.services) ? status.services : [];
      const folders = Array.isArray(status.folders) ? status.folders : [];
      set({
        services,
        folders,
        settings: { ...get().settings, ...status.settings },
        loading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Unknown error',
        loading: false,
      });
    }
  },

  loadSystem: async () => {
    try {
      const info = await api.getSystemInfo();
      set({ systemInfo: info });
    } catch (e) {
      console.error('Failed to load system info:', e);
    }
  },

  startService: async (id) => {
    try {
      await api.startServiceAPI(id);
      return true;
    } catch {
      return false;
    }
  },

  stopService: async (id) => {
    try {
      await api.stopServiceAPI(id);
      return true;
    } catch {
      return false;
    }
  },

  restartService: async (id) => {
    try {
      await api.restartServiceAPI(id);
      return true;
    } catch {
      return false;
    }
  },

  // Lets errors propagate so the modal can surface the real reason instead of
  // silently closing on failure. ServiceModal is the only caller.
  saveService: async (data, id) => {
    if (id) {
      const existing = get().services.find((s) => s.id === id);
      if (!existing) throw new Error('Service no longer exists');
      await api.updateServiceAPI({ ...existing, ...data });
    } else {
      await api.createServiceAPI(data as ServiceStatus);
    }
    return true;
  },

  deleteService: async (id) => {
    try {
      await api.deleteServiceAPI(id);
      return true;
    } catch {
      return false;
    }
  },

  reorderServices: async (orderedIds) => {
    const prev = get().services;
    const rank = new Map(orderedIds.map((id, i) => [id, i]));
    // Optimistic: apply new sortOrder locally so the card stays put instead of
    // snapping back to origin until the server broadcast lands.
    const next = prev.map((s) =>
      rank.has(s.id) ? { ...s, sortOrder: rank.get(s.id)! } : s
    );
    set({ services: next });
    try {
      await api.reorderServicesAPI(orderedIds);
      return true;
    } catch {
      set({ services: prev }); // rollback on failure
      return false;
    }
  },

  startAll: async () => {
    const stopped = get().services.filter((s) => s.status === 'stopped');
    const results = await Promise.all(stopped.map((s) => get().startService(s.id)));
    return results.filter(Boolean).length;
  },

  stopAll: async () => {
    const running = get().services.filter((s) => s.status === 'running');
    const results = await Promise.all(running.map((s) => get().stopService(s.id)));
    return results.filter(Boolean).length;
  },

  reorderFolders: async (orderedIds) => {
    const prev = get().folders;
    const byId = new Map(prev.map((f) => [f.id, f]));
    const next = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Folder[];
    for (const f of prev) if (!orderedIds.includes(f.id)) next.push(f);
    set({ folders: next }); // optimistic — server broadcast confirms
    try {
      await api.reorderFoldersAPI(orderedIds);
      return true;
    } catch {
      set({ folders: prev }); // rollback on failure
      return false;
    }
  },

  saveFolder: async (name, id) => {
    try {
      if (id) {
        await api.updateFolderAPI({ id, name });
      } else {
        await api.createFolderAPI({ id: safeRandomUUID(), name });
      }
      return true;
    } catch {
      return false;
    }
  },

  deleteFolder: async (id) => {
    const prevFolders = get().folders;
    const prevServices = get().services;
    set({
      folders: prevFolders.filter((f) => f.id !== id),
      services: prevServices.map((s) => (s.folderId === id ? { ...s, folderId: null } : s)),
    }); // optimistic — server broadcast confirms
    try {
      await api.deleteFolderAPI(id);
      return true;
    } catch {
      set({ folders: prevFolders, services: prevServices }); // rollback on failure
      return false;
    }
  },

  folderAction: async (id, action) => {
    const folderServices = get().services.filter((s) => s.folderId === id);
    let count = 0;
    for (const s of folderServices) {
      const success =
        action === 'start' ? await get().startService(s.id) : await get().stopService(s.id);
      if (success) count++;
    }
    return count;
  },

  moveServiceToFolder: async (serviceId, folderId) => {
    const prev = get().services;
    const service = prev.find((s) => s.id === serviceId);
    if (!service) return false;
    // Optimistic: reparent locally so the move is instant.
    set({ services: prev.map((s) => (s.id === serviceId ? { ...s, folderId } : s)) });
    try {
      await api.updateServiceAPI({ ...service, folderId });
      return true;
    } catch {
      set({ services: prev }); // rollback on failure
      return false;
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const updated = { ...get().settings, ...newSettings };
      // Send only the changed fields — the backend merges them server-side
      await api.saveSettingsAPI(newSettings as Settings);
      set({ settings: updated });
      return true;
    } catch {
      return false;
    }
  },

  toggleAutoStart: async () => {
    const newValue = !get().settings.autoStart;
    return get().updateSettings({ autoStart: newValue });
  },

  dismissError: (id) => set((s) => ({
    services: s.services.map((svc) =>
      svc.id === id ? { ...svc, startupError: null } : svc
    )
  })),

  checkSetupStatus: async () => {
    try {
      const status = await api.getSetupStatus();
      // Authoritative signal is whether the access-key secret exists, matching
      // the server's `needs_setup`. `onboarding_complete` can drift from it.
      const isComplete = status.api_secret_set === true;
      set({ onboardingComplete: isComplete });
      return isComplete;
    } catch {
      set({ onboardingComplete: false });
      return false;
    }
  },

  registerDevice: async (deviceId, deviceName) => {
    try {
      const result = await api.registerDeviceAPI(deviceId, deviceName);
      api.storeToken(result.token);
    } catch (e) {
      console.warn('Device registration failed:', e);
    }
  },

  getRunningCount: () => get().services.filter((s) => s.status === 'running').length,
  getStoppedCount: () => get().services.filter((s) => s.status === 'stopped').length,
  
  getServicesInFolder: (folderId: string) => get().services.filter((s) => s.folderId === folderId),
  
  getRootServices: () => get().services.filter((s) => !s.folderId),
}));