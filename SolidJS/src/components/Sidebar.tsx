import { Component, For, Show } from 'solid-js';
import { services, startService, stopService, loadSystem } from '../stores/services';
import { 
  currentFilter, 
  setCurrentFilter, 
  sidebarCollapsed, 
  sidebarOpen,
  toggleSidebarCollapse, 
  openSettingsModal 
} from '../stores/ui';
import Icon from './Icon';

const Sidebar: Component = () => {
  const runningCount = () => services.filter(s => s.status === 'running').length;
  const stoppedCount = () => services.filter(s => s.status === 'stopped').length;
  const allCount = () => services.length;

  const handleFilterClick = (filter: 'all' | 'running' | 'stopped') => {
    setCurrentFilter(filter);
  };

  return (
    <aside 
      id="sidebar" 
      class={`${sidebarCollapsed() ? 'collapsed' : ''} ${sidebarOpen() ? 'open' : ''}`}
    >
      <div class="sidebar-header">
        <button class="sidebar-collapse-btn" onClick={() => toggleSidebarCollapse()} title="Toggle sidebar">
          <Icon name="ChevronLeft" size={12} />
        </button>
        <div class="sidebar-label">Views</div>
      </div>
      
      <div class="sidebar-content">
        <div 
          class={`nav-item ${currentFilter() === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterClick('all')}
        >
          <Icon name="LayoutGrid" size={12} />
          All Services 
          <span class="nav-badge">{allCount()}</span>
        </div>
        
        <div 
          class={`nav-item ${currentFilter() === 'running' ? 'active' : ''}`}
          onClick={() => handleFilterClick('running')}
        >
          <Icon name="Play" size={12} />
          Running 
          <span class="nav-badge">{runningCount()}</span>
        </div>
        
        <div 
          class={`nav-item ${currentFilter() === 'stopped' ? 'active' : ''}`}
          onClick={() => handleFilterClick('stopped')}
        >
          <Icon name="Square" size={12} />
          Stopped 
          <span class="nav-badge">{stoppedCount()}</span>
        </div>
        
        <div class="sidebar-label">Actions</div>
        
        <div class="nav-item" onClick={() => startAllServices()}>
          <Icon name="Play" size={12} />
          Start All
        </div>
        
        <div class="nav-item" onClick={() => stopAllServices()}>
          <Icon name="Square" size={12} />
          Stop All
        </div>
        
        <div class="nav-item" onClick={() => loadSystemInfo()}>
          <Icon name="Laptop" size={12} />
          System Info
        </div>
      </div>
      
        <div style="margin-top: auto; padding: 16px; padding-left: 0px; padding-right: 0px;">
        <div class="nav-item" onClick={() => openSettingsModal()}>
          <Icon name="Settings" size={12} />
          Settings
        </div>
      </div>
    </aside>
  );
};

// Helper functions for actions
async function startAllServices() {
  for (const s of services.filter(s => s.status === 'stopped')) {
    await startService(s.id);
  }
}

async function stopAllServices() {
  for (const s of services.filter(s => s.status === 'running')) {
    await stopService(s.id);
  }
}

async function loadSystemInfo() {
  await loadSystem();
}

export default Sidebar;
