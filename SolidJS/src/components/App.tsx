import { Component, onMount, onCleanup, createEffect } from 'solid-js';
import { loadThemes, applyTheme } from '../stores/themes';
import { sidebarCollapsed, handleKeyDown } from '../stores/ui';
import { loadSystem, loadServices } from '../stores/services';

// Import all components
import Header from './Header';
import Sidebar from './Sidebar';
import SystemStats from './SystemStats';
import Toolbar from './Toolbar';
import ServiceGrid from './ServiceGrid';
import ServiceModal from './ServiceModal';
import FolderModal from './FolderModal';
import SettingsModal from './SettingsModal';
import ThemeCreator from './ThemeCreator';
import FAB from './FAB';
import ContextMenu from './ContextMenu';
import Toast from './Toast';

const App: Component = () => {
  // Declare at component scope so onCleanup can reference it
  let systemInterval: ReturnType<typeof setInterval>;

  // Cleanup runs when the component unmounts — MUST be at top level, not inside async callbacks
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
    clearInterval(systemInterval);
  });

  // Initialize app on mount
  onMount(async () => {
    // Load services, folders, and settings
    await loadServices();

    // Load themes
    loadThemes();

    // Load initial system info
    await loadSystem();

    // Poll system info every 10 seconds
    systemInterval = setInterval(() => {
      loadSystem();
    }, 10000);

    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);

    // Initialize lucide icons after DOM is ready
    setTimeout(() => {
      // @ts-ignore - lucide is loaded from CDN
      if (window.lucide) {
        // @ts-ignore
        window.lucide.createIcons();
      }
    }, 100);
  });

  return (
    <div class={`shell ${sidebarCollapsed() ? 'sidebar-collapsed' : ''}`}>
      <Header />
      <Sidebar />
      <main>
        <SystemStats />
        <Toolbar />
        <ServiceGrid />
      </main>

      {/* Modals and overlays */}
      <Toast />
      <FAB />
      <ContextMenu />
      <ServiceModal />
      <FolderModal />
      <SettingsModal />
      <ThemeCreator />
    </div>
  );
};

export default App;
