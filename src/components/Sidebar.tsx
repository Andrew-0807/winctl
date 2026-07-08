import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import { apiFetch } from '../stores/socket';
import Icon from './Icon';

const Sidebar: React.FC = () => {
  const services = useServiceStore((s) => s.services);
  const startService = useServiceStore((s) => s.startService);
  const stopService = useServiceStore((s) => s.stopService);
  const startAll = useServiceStore((s) => s.startAll);
  const stopAll = useServiceStore((s) => s.stopAll);
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);
  const openSettingsModal = useUIStore((s) => s.openSettingsModal);
  const openSystemInfoModal = useUIStore((s) => s.openSystemInfoModal);
  const confirm = useUIStore((s) => s.confirm);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sidebarCollapsed = settings.sidebarCollapsed ?? false;

  const toggleSidebarCollapse = () => {
    updateSettings({ sidebarCollapsed: !sidebarCollapsed });
  };

  const pcAction = async (action: string) => {
    const confirmActions = ['shutdown', 'restart', 'sleep'];
    if (confirmActions.includes(action)) {
      const confirmed = await confirm({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} PC`,
        message: `Are you sure you want to trigger a system ${action}?`,
        confirmLabel: action.charAt(0).toUpperCase() + action.slice(1),
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await apiFetch(`/api/pc/${action}`, { method: 'POST' });
    } catch { /* ignore */ }
  };

  const renderNavItem = (item: { id: string; label: string; icon: string; action: () => void; index?: number; className?: string }) => {
    return (
      <div
        key={item.id}
        className={`nav-item ${item.className || ''}`}
        onClick={item.action}
        onMouseEnter={() => setHoveredId(item.id)}
        style={{ '--nav-index': item.index } as React.CSSProperties}
      >
        <Icon name={item.icon} size={12} />
        <span>{item.label}</span>
        {hoveredId === item.id && (
          <motion.div
            layoutId="sidebar-hover-pill"
            className="sidebar-hover-pill"
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 30,
            }}
          />
        )}
      </div>
    );
  };

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-backdrop"
            onClick={toggleSidebarMobile}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <aside
        id="sidebar"
        className={`${sidebarCollapsed ? 'collapsed' : ''} ${sidebarOpen ? 'open' : ''}`}
        onMouseLeave={() => setHoveredId(null)}
      >
        <div className="sidebar-header">
          <button className="sidebar-collapse-btn" onClick={toggleSidebarCollapse} title="Toggle sidebar">
            <Icon name="ChevronLeft" size={12} />
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-label" style={{ '--nav-index': 0 } as React.CSSProperties}>Actions</div>

          {renderNavItem({ id: 'start-all', label: 'Start All', icon: 'Play', action: startAll, index: 1 })}
          {renderNavItem({ id: 'stop-all', label: 'Stop All', icon: 'Square', action: stopAll, index: 2 })}
          {renderNavItem({ id: 'sys-info', label: 'System Info', icon: 'Laptop', action: openSystemInfoModal, index: 3 })}

          <div className="sidebar-label mt-4" style={{ '--nav-index': 4 } as React.CSSProperties}>Power</div>

          {renderNavItem({ id: 'display-off', label: 'Display Off', icon: 'Monitor', action: () => pcAction('display-off'), index: 5 })}
          {renderNavItem({ id: 'sleep', label: 'Sleep', icon: 'Moon', action: () => pcAction('sleep'), index: 6 })}
          {renderNavItem({ id: 'lock', label: 'Lock PC', icon: 'Shield', action: () => pcAction('lock'), index: 7 })}
          {renderNavItem({ id: 'restart', label: 'Restart', icon: 'RefreshCw', action: () => pcAction('restart'), index: 8 })}
          {renderNavItem({ id: 'shutdown', label: 'Shutdown', icon: 'Power', action: () => pcAction('shutdown'), index: 9 })}
        </div>

        <div className="mt-auto py-4">
          {renderNavItem({ id: 'settings', label: 'Settings', icon: 'Settings', action: openSettingsModal, className: 'hide-on-mobile' })}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
