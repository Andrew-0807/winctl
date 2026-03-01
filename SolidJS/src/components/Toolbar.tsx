import { Component } from 'solid-js';
import { currentFilter, setCurrentFilter, searchQuery, setSearchQuery } from '../stores/ui';

const Toolbar: Component = () => {
  const handleSearchChange = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  };
  
  const handleFilterClick = (filter: 'all' | 'running' | 'stopped') => {
    setCurrentFilter(filter);
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
    </div>
  );
};

export default Toolbar;
