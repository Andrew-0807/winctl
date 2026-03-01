import { Component, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { fabOpen, toggleFab, openServiceModal, openFolderModal } from '../stores/ui';
import Icon from './Icon';

const FAB: Component = () => {
  let fabRef: HTMLDivElement | undefined;
  
  // Close FAB when clicking outside
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef && !fabRef.contains(e.target as Node)) {
        if (fabOpen()) {
          toggleFab();
        }
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
    });
  });
  
  const handleNewService = () => {
    openServiceModal();
    toggleFab();
  };
  
  const handleNewFolder = () => {
    openFolderModal();
    toggleFab();
  };

  return (
    <div class="fab-container" ref={fabRef}>
      <div class={`fab-menu ${fabOpen() ? 'open' : ''}`} id="fab-menu">
        <div class="fab-item" onClick={handleNewFolder}>
          <Icon name="FolderPlus" size={12} />
          <span>New Folder</span>
        </div>
        <div class="fab-item" onClick={handleNewService}>
          <Icon name="Plus" size={12} />
          <span>New Service</span>
        </div>
      </div>
      <button 
        class={`fab-btn ${fabOpen() ? 'open' : ''}`} 
        id="fab-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleFab();
        }}
      >
        <Icon name="Plus" size={14} />
      </button>
    </div>
  );
};

export default FAB;
