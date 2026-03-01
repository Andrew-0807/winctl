import type { Server } from 'socket.io';
import type { Service, ServiceEntry } from './types.js';
export declare function initProcessManager(io: Server): void;
export declare function getRegistry(): Map<string, ServiceEntry>;
export declare function getStatus(id: string): string;
export declare function broadcastStatus(): void;
export declare function checkPort(port: string): Promise<boolean>;
export declare function getPidOnPort(port: string): Promise<number | null>;
export declare function getPidFromPort(port: string): Promise<number | null>;
export declare function killProcessOnPort(port: string): Promise<{
    ok: boolean;
    msg: string;
}>;
export declare function getPidByProcessName(name: string): Promise<number | null>;
export declare function killApplicationProcesses(command: string): Promise<{
    ok: boolean;
    msg: string;
}>;
export declare function startService(service: Service, autoRestart?: boolean): Promise<{
    ok: boolean;
    msg?: string;
    pid?: number | null;
}>;
export declare function stopService(id: string): Promise<{
    ok: boolean;
    msg?: string;
}>;
export declare function detectRunningProcesses(): Promise<void>;
