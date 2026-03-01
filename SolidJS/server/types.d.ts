import type { ChildProcess } from 'child_process';
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
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitized: Omit<Service, 'createdAt'>;
}
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
