import { Component } from 'solid-js';
import { currentFilter, setCurrentFilter, searchQuery, setSearchQuery, currentView, setCurrentView, runPanelOpen, toggleRunPanel } from '../stores/ui';
import Icon from './Icon';

const Toolbar: Component = () => {
  const handleSearchChange = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  };

  const handleFilterClick = (filter: 'all' | 'running' | 'stopped') => {
    setCurrentFilter(filter);
  };

  const handleViewToggle = (view: 'list' | 'gallery') => {
    setCurrentView(view);
  };

  return (
    <div class="toolbar">
      <input
        type="text"
        class="search-box"
        id="search"
        placeholder="Search services…"
        value={searchQuery()}
        onInput={handleSearchChange}
      />
      <button
        class={`filter-btn ${currentFilter() === 'all' ? 'active' : ''}`}
        data-filter="all"
        onClick={() => handleFilterClick('all')}
      >
        All
      </button>
      <button
        class={`filter-btn ${currentFilter() === 'running' ? 'active' : ''}`}
        data-filter="running"
        onClick={() => handleFilterClick('running')}
      >
        Running
      </button>
      <button
        class={`filter-btn ${currentFilter() === 'stopped' ? 'active' : ''}`}
        data-filter="stopped"
        onClick={() => handleFilterClick('stopped')}
      >
        Stopped
      </button>

      <div class="view-toggle" style="margin-left: auto; display: flex; gap: 4px;">
        <button
          class={`filter-btn ${currentView() === 'list' ? 'active' : ''}`}
          onClick={() => handleViewToggle('list')}
          title="List View"
        >
          <Icon name="List" size={14} />
        </button>
        <button
          class={`filter-btn ${currentView() === 'gallery' ? 'active' : ''}`}
          onClick={() => handleViewToggle('gallery')}
          title="Gallery View"
        >
          <Icon name="LayoutGrid" size={14} />
        </button>
        <button
          class={`filter-btn ${runPanelOpen() ? 'active' : ''}`}
          onClick={toggleRunPanel}
          title="Run Command"
          style="margin-left: 4px;"
        >
          <Icon name="Terminal" size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
