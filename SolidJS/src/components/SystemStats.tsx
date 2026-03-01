import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { systemInfo, services, loadSystem } from '../stores/services';

const SystemStats: Component = () => {
  const [refreshKey, setRefreshKey] = createSignal(0);
  
  // Auto-refresh system info every 10 seconds
  onMount(() => {
    // Initial load
    loadSystem();
    
    const interval = setInterval(() => {
      loadSystem();
      setRefreshKey(k => k + 1);
    }, 10000);
    
    onCleanup(() => clearInterval(interval));
  });
  
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };
  
  const formatMem = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };
  
  const cpuCores = () => systemInfo()?.cpus || '—';
  const hostname = () => systemInfo()?.hostname || '—';
  const memTotal = () => systemInfo() ? formatMem(systemInfo()!.totalMem) : '—';
  const memFree = () => systemInfo() ? formatMem(systemInfo()!.freeMem) : '—';
  const uptime = () => systemInfo() ? formatUptime(systemInfo()!.uptime) : '—';
  const serviceCount = () => services.length;

  return (
    <div class="sysbar" id="sysbar">
      <div class="sys-card">
        <div class="sys-label">CPU Cores</div>
        <div class="sys-value">{cpuCores()}</div>
        <div class="sys-sub">{hostname()}</div>
      </div>
      <div class="sys-card">
        <div class="sys-label">Memory</div>
        <div class="sys-value">{memTotal()}</div>
        <div class="sys-sub">{memFree()} free</div>
      </div>
      <div class="sys-card">
        <div class="sys-label">Services</div>
        <div class="sys-value">{serviceCount()}</div>
        <div class="sys-sub">total registered</div>
      </div>
      <div class="sys-card">
        <div class="sys-label">Uptime</div>
        <div class="sys-value">{uptime()}</div>
        <div class="sys-sub">system uptime</div>
      </div>
    </div>
  );
};

export default SystemStats;
