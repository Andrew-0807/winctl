import React from 'react';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

const Header: React.FC = () => {
  const connected = useServiceStore((s) => s.connected);
  const connecting = useServiceStore((s) => s.connecting);
  const services = useServiceStore((s) => s.services);
  const systemInfo = useServiceStore((s) => s.systemInfo);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);
  const openSettingsModal = useUIStore((s) => s.openSettingsModal);

  const runningCount = services.filter((s) => s.status === 'running').length;
  const stoppedCount = services.filter((s) => s.status === 'stopped').length;
  const hostname = systemInfo?.hostname || '—';

  return (
    <header>
      <button className="menu-toggle" onClick={toggleSidebarMobile}>
        <Icon name="Menu" size={20} />
      </button>

      <div className="logo">
        <div className="logo-icon">
          <svg width="48" height="48" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1a1e28" />
                <stop offset="100%" stopColor="#0d0f14" />
              </linearGradient>
              <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7b8ff5" />
                <stop offset="100%" stopColor="#5e72e4" />
              </linearGradient>
              <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2eea8a" />
                <stop offset="100%" stopColor="#22d47a" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="96" fill="url(#bgGrad)" />
            <circle cx="256" cy="256" r="200" fill="none" stroke="#252a38" strokeWidth="6" />
            <circle cx="256" cy="256" r="160" fill="none" stroke="#1e2333" strokeWidth="4" />
            <circle cx="256" cy="248" r="100" fill="none" stroke="#252a38" strokeWidth="16" />
            <path d="M 256 148 A 100 100 0 1 1 256 348" fill="none" stroke="url(#accentGrad)" strokeWidth="10" strokeLinecap="round" />
            <rect x="240" y="188" width="32" height="90" rx="16" fill="url(#accentGrad)" />
            <circle cx="380" cy="150" r="18" fill="#0d0f14" stroke="#1a1e28" strokeWidth="3" />
            <circle cx="380" cy="150" r="12" fill="url(#greenGrad)" />
          </svg>
        </div>
        WinCTL
      </div>

      <div className="header-stats">
        <div className={`connection-status ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`}>
          <span className="dot"></span>
          <span className="label">
            {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
        <div className="stat-chip">
          <span className="dot dot-green"></span>
          <span>{runningCount}</span>
          <span className="chip-label"> running</span>
        </div>
        <div className="stat-chip">
          <span className="dot dot-red"></span>
          <span>{stoppedCount}</span>
          <span className="chip-label"> stopped</span>
        </div>
        <div className="stat-chip hostname">{hostname}</div>
      </div>

      <button className="mobile-settings-btn" onClick={openSettingsModal} title="Settings">
        <Icon name="Settings" size={20} />
      </button>
    </header>
  );
};

export default Header;
