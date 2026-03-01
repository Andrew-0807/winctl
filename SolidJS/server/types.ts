import type { ChildProcess } from 'child_process';

// ── Service & Folder types ──────────────────────────────────────────────────

export interface Service {
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
  env: Record<string, string>;
  tags: string[];
  sortOrder: number;
  createdAt?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt?: string;
}

// ── Config types ────────────────────────────────────────────────────────────

export interface ServiceConfig {
  services: Service[];
  folders: Folder[];
}

export interface Settings {
  theme?: string;
  folderStatePreference: 'remember' | 'open' | 'closed';
  showFolderCount: boolean;
  autoStart: boolean;
}

// ── Runtime registry types ──────────────────────────────────────────────────

export type ServiceState = 'starting' | 'running' | 'stopping' | 'stopped';

export interface LogEntry {
  t: string;
  line: string;
}

export interface MockProcess {
  pid: number | null;
  killed: boolean;
  exitCode: number | null;
  kill: (signal?: string) => void;
}

export interface ServiceEntry {
  process: ChildProcess | MockProcess | null;
  logs: LogEntry[];
  startedAt: string | null;
  restartCount: number;
  state: ServiceState;
  stateReason: string;
  actualPid?: number | null;
}

// ── Theme types ─────────────────────────────────────────────────────────────

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  border2: string;
  text: string;
  text2: string;
  text3: string;
  green: string;
  'green-dim': string;
  red: string;
  'red-dim': string;
  yellow: string;
  'yellow-dim': string;
  blue: string;
  'blue-dim': string;
  accent: string;
  'accent-glow': string;
}

export interface Theme {
  id: string;
  name: string;
  author: string;
  builtIn: boolean;
  colors: ThemeColors;
}

// ── System info ─────────────────────────────────────────────────────────────

export interface SystemInfo {
  hostname: string;
  platform: string;
  arch: string;
  uptime: number;
  totalMem: number;
  freeMem: number;
  cpus: number;
  loadavg: number[];
}

// ── Validation types ────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized: Omit<Service, 'createdAt'>;
}

// ── API response types ──────────────────────────────────────────────────────

export interface ServiceWithStatus extends Service {
  status: string;
  stateReason: string | null;
  pid: number | null;
  startedAt: string | null;
  restartCount: number;
  recentLogs: LogEntry[];
}

export interface StatusPayload {
  services: ServiceWithStatus[];
  folders: Folder[];
  settings: Settings;
}
