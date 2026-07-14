import React, { useState, useEffect, useRef } from 'react';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

interface ScrambledTextProps {
  text: string;
  trigger: boolean;
}

const ScrambledText: React.FC<ScrambledTextProps> = ({ text, trigger }) => {
  const [displayText, setDisplayText] = useState(trigger ? '' : text);
  const intervalRef = useRef<number | null>(null);
  const chars = '0123456789%@#$?!<>{}[]*+=';

  useEffect(() => {
    if (!trigger) {
      setDisplayText(text);
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
      iteration += 1 / 3; // Reveals 1 character every 3 ticks (~75ms) for a gradual decrypt
    }, 25);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, trigger]);

  return <span>{displayText}</span>;
};

interface AnimatedToolbarButtonProps {
  onClick: () => void;
  icon: string;
  label: string;
  active?: boolean;
  className?: string;
  title?: string;
  iconColor?: string;
}

const AnimatedToolbarButton: React.FC<AnimatedToolbarButtonProps> = ({
  onClick,
  icon,
  label,
  active = false,
  className = '',
  title,
  iconColor,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      className={`toolbar-anim-btn ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      title={title}
    >
      <span className="btn-icon-flex flex items-center justify-center">
        <Icon name={icon} size={14} color={iconColor} />
      </span>
      <span className="btn-label-wrap">
        <ScrambledText text={label} trigger={isHovered} />
      </span>
    </button>
  );
};

const Toolbar: React.FC = () => {
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const currentFilter = useUIStore((s) => s.currentFilter);
  const setCurrentFilter = useUIStore((s) => s.setCurrentFilter);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const runPanelOpen = useUIStore((s) => s.runPanelOpen);
  const toggleRunPanel = useUIStore((s) => s.toggleRunPanel);
  const openServiceModal = useUIStore((s) => s.openServiceModal);
  const openFolderModal = useUIStore((s) => s.openFolderModal);

  const currentView = settings.currentView || 'list';

  return (
    <div className="toolbar">
      <div className="toolbar-btn-group">
        {/* All Filter */}
        <AnimatedToolbarButton
          onClick={() => setCurrentFilter('all')}
          icon="Filter"
          label="All"
          active={currentFilter === 'all'}
          title="Show all services"
        />
        {/* Running Filter */}
        <AnimatedToolbarButton
          onClick={() => setCurrentFilter('running')}
          icon="Activity"
          label="Running"
          active={currentFilter === 'running'}
          title="Show running services"
          iconColor={currentFilter === 'running' ? 'var(--green)' : undefined}
        />
        {/* Stopped Filter */}
        <AnimatedToolbarButton
          onClick={() => setCurrentFilter('stopped')}
          icon="Square"
          label="Stopped"
          active={currentFilter === 'stopped'}
          title="Show stopped services"
          iconColor={currentFilter === 'stopped' ? 'var(--red)' : undefined}
        />

        <div className="toolbar-divider" />

        {/* New Service Action */}
        <AnimatedToolbarButton
          onClick={() => openServiceModal()}
          icon="Plus"
          label="New Service"
          className="btn-accent-hover"
          title="Add a new service"
        />
        {/* New Folder Action */}
        <AnimatedToolbarButton
          onClick={() => openFolderModal()}
          icon="FolderPlus"
          label="New Folder"
          className="btn-secondary-hover"
          title="Add a new folder"
        />
      </div>

      <input
        type="text"
        className="search-box"
        id="search"
        placeholder="Search services…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className="view-toggle ml-auto flex gap-1.5 items-center">
        <AnimatedToolbarButton
          onClick={() => updateSettings({ currentView: 'list' })}
          icon="List"
          label="List View"
          active={currentView === 'list'}
          title="List View"
        />
        <AnimatedToolbarButton
          onClick={() => updateSettings({ currentView: 'gallery' })}
          icon="LayoutGrid"
          label="Gallery View"
          active={currentView === 'gallery'}
          title="Gallery View"
        />
        <AnimatedToolbarButton
          onClick={toggleRunPanel}
          icon="Terminal"
          label="Run Command"
          active={runPanelOpen}
          title="Run Command"
        />
      </div>
    </div>
  );
};

export default Toolbar;