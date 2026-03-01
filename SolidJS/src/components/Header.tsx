import { Component, Show } from 'solid-js';
import { connected, connecting } from '../stores/socket';
import { getRunningCount, getStoppedCount, systemInfo } from '../stores/services';
import { toggleSidebarMobile } from '../stores/ui';
import Icon from './Icon';

const Header: Component = () => {
  const runningCount = () => getRunningCount();
  const stoppedCount = () => getStoppedCount();
  const hostname = () => systemInfo()?.hostname || '—';

  return (
    <header>
      <button class="menu-toggle" onClick={() => toggleSidebarMobile()}>
        <Icon name="Menu" size={20} />
      </button>
      
      <div class="logo">
        <div class="logo-icon">
          <svg width="48" height="48" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1a1e28"/>
                <stop offset="100%" style="stop-color:#0d0f14"/>
              </linearGradient>
              <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#7b8ff5"/>
                <stop offset="100%" style="stop-color:#5e72e4"/>
              </linearGradient>
              <linearGradient id="greenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#2eea8a"/>
                <stop offset="100%" style="stop-color:#22d47a"/>
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="96" fill="url(#bgGrad)"/>
            <circle cx="256" cy="256" r="200" fill="none" stroke="#252a38" stroke-width="6"/>
            <circle cx="256" cy="256" r="160" fill="none" stroke="#1e2333" stroke-width="4"/>
            <circle cx="256" cy="248" r="100" fill="none" stroke="#252a38" stroke-width="16"/>
            <path d="M 256 148 A 100 100 0 1 1 256 348" fill="none" stroke="url(#accentGrad)" stroke-width="10" stroke-linecap="round"/>
            <rect x="240" y="188" width="32" height="90" rx="16" fill="url(#accentGrad)"/>
            <circle cx="380" cy="150" r="18" fill="#0d0f14" stroke="#1a1e28" stroke-width="3"/>
            <circle cx="380" cy="150" r="12" fill="url(#greenGrad)"/>
          </svg>
        </div>
        WinCTL
      </div>
      
      <div class="header-stats">
        <div class={`connection-status ${connected() ? 'connected' : connecting() ? 'connecting' : 'disconnected'}`}>
          <span class="dot"></span>
          <span class="label">
            <Show when={connected()} fallback={connecting() ? 'Connecting...' : 'Disconnected'}>
              Connected
            </Show>
          </span>
        </div>
        <div class="stat-chip">
          <span class="dot dot-green"></span>
          <span>{runningCount()}</span> running
        </div>
        <div class="stat-chip">
          <span class="dot dot-red"></span>
          <span>{stoppedCount()}</span> stopped
        </div>
        <div class="stat-chip">
          {hostname()}
        </div>
      </div>
    </header>
  );
};

export default Header;
