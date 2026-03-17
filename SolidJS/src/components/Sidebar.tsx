import { Component, For, Show } from 'solid-js';
import { services, startService, stopService } from '../stores/services';
import {
  sidebarCollapsed,
  sidebarOpen,
  toggleSidebarCollapse,
  openSettingsModal,
  openSystemInfoModal
} from '../stores/ui';
import Icon from './Icon';

const Sidebar: Component = () => {
  return (
    <aside
      id="sidebar"
      class={`${sidebarCollapsed() ? 'collapsed' : ''} ${sidebarOpen() ? 'open' : ''}`}
    >
      <div class="sidebar-header">
        <button class="sidebar-collapse-btn" onClick={() => toggleSidebarCollapse()} title="Toggle sidebar">
          <Icon name="ChevronLeft" size={12} />
        </button>
      </div>

      <div class="sidebar-content">
        <div class="sidebar-label">Actions</div>

        <div class="nav-item" onClick={() => startAllServices()}>
          <Icon name="Play" size={12} />
          Start All
        </div>

        <div class="nav-item" onClick={() => stopAllServices()}>
          <Icon name="Square" size={12} />
          Stop All
        </div>

        <div class="nav-item" onClick={() => openSystemInfoModal()}>
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

export default Sidebar;
