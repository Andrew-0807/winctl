import React, { useState, useEffect, useRef } from 'react';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

interface ScrambledTextProps {
  text: string;
  trigger: boolean;
}

const ScrambledText: React.FC<ScrambledTextProps> = ({ text, trigger }) => {
  const [displayText, setDisplayText] = useState('');
  const intervalRef = useRef<number | null>(null);
  const chars = '0123456789%@#$?!<>{}[]*+=';

  useEffect(() => {
    if (!trigger) {
      setDisplayText('');
      return;
    }

    let iteration = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setDisplayText(() => {
        return text
          .split('')
          .map((char, index) => {
            if (index < iteration) {
              return text[index];
            }
            if (char === ' ') return ' ';
            return chars[Math.floor(Math.random() * chars.length)];
          })
          .join('');
      });

      if (iteration >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
      iteration += 1 / 3; // Reveals 1 character every 3 ticks (~75ms)
    }, 25);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, trigger]);

  return <span>{displayText}</span>;
};

interface HeaderStatChipProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  className?: string;
}

const HeaderStatChip: React.FC<HeaderStatChipProps> = ({
  icon,
  label,
  count,
  className = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`header-anim-chip ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >{icon}{count !== undefined && <span className="stat-count">{count}</span>}<span className="chip-label-wrap"><ScrambledText text={label} trigger={isHovered} /></span></div>
  );
};

const Header: React.FC = () => {
  const connected = useServiceStore((s) => s.connected);
  const connecting = useServiceStore((s) => s.connecting);
  const services = useServiceStore((s) => s.services);
  const toggleSidebarMobile = useUIStore((s) => s.toggleSidebarMobile);
  const openSettingsModal = useUIStore((s) => s.openSettingsModal);

  const runningCount = services.filter((s) => s.status === 'running').length;
  const stoppedCount = services.filter((s) => s.status === 'stopped').length;

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
        <HeaderStatChip
          className={`conn-chip ${connected ? 'connected' : connecting ? 'connecting' : 'disconnected'}`}
          icon={<span className="dot"></span>}
          label={connected ? 'Connected' : connecting ? 'Connecting' : 'Disconnected'}
        />
        <HeaderStatChip
          className="stat-chip-anim"
          icon={<span className="dot dot-green"></span>}
          count={runningCount}
          label="running"
        />
        <HeaderStatChip
          className="stat-chip-anim"
          icon={<span className="dot dot-red"></span>}
          count={stoppedCount}
          label="stopped"
        />
      </div>

      <button className="mobile-settings-btn" onClick={openSettingsModal} title="Settings">
        <Icon name="Settings" size={20} />
      </button>
    </header>
  );
};

export default Header;
