import React from 'react';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

const Toolbar: React.FC = () => {
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const currentFilter = useUIStore((s) => s.currentFilter);
  const setCurrentFilter = useUIStore((s) => s.setCurrentFilter);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const runPanelOpen = useUIStore((s) => s.runPanelOpen);
  const toggleRunPanel = useUIStore((s) => s.toggleRunPanel);

  const currentView = settings.currentView || 'list';

  return (
    <div className="toolbar">
      <input
        type="text"
        className="search-box"
        id="search"
        placeholder="Search services…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <button
        className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
        data-filter="all"
        onClick={() => setCurrentFilter('all')}
      >
        All
      </button>
      <button
        className={`filter-btn ${currentFilter === 'running' ? 'active' : ''}`}
        data-filter="running"
        onClick={() => setCurrentFilter('running')}
      >
        Running
      </button>
      <button
        className={`filter-btn ${currentFilter === 'stopped' ? 'active' : ''}`}
        data-filter="stopped"
        onClick={() => setCurrentFilter('stopped')}
      >
        Stopped
      </button>

      <div className="view-toggle ml-auto flex gap-1">
        <button
          className={`filter-btn ${currentView === 'list' ? 'active' : ''}`}
          onClick={() => updateSettings({ currentView: 'list' })}
          title="List View"
        >
          <Icon name="List" size={14} />
        </button>
        <button
          className={`filter-btn ${currentView === 'gallery' ? 'active' : ''}`}
          onClick={() => updateSettings({ currentView: 'gallery' })}
          title="Gallery View"
        >
          <Icon name="LayoutGrid" size={14} />
        </button>
        <button
          className={`filter-btn ml-1 ${runPanelOpen ? 'active' : ''}`}
          onClick={toggleRunPanel}
          title="Run Command"
        >
          <Icon name="Terminal" size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;