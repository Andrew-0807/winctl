import { Component, Show, createEffect, onMount, onCleanup } from 'solid-js';
import { 
  contextMenuOpen, 
  contextMenuPosition, 
  contextFolderId,
  hideContextMenu,
  openFolderModal 
} from '../stores/ui';
import Icon from './Icon';

const ContextMenu: Component = () => {
  let menuRef: HTMLDivElement | undefined;
  
  // Close on click outside or escape
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        hideContextMenu();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    });
  });
  
  const handleNewFolder = () => {
    openFolderModal();
    hideContextMenu();
  };
  
  const handleRename = () => {
    const folderId = contextFolderId();
    if (folderId) {
      openFolderModal(folderId);
    }
    hideContextMenu();
  };

  return (
    <div 
      class={`context-menu ${contextMenuOpen() ? 'open' : ''}`}
      id="context-menu"
      ref={menuRef}
      style={{
        left: `${contextMenuPosition().x}px`,
        top: `${contextMenuPosition().y}px`
      }}
    >
      <div class="ctx-item" onClick={handleNewFolder}>
        <Icon name="FolderPlus" size={10} />
        New Folder
      </div>
      
      <div class="ctx-divider"></div>
      
      <div class="ctx-item" onClick={handleRename}>
        <Icon name="Edit" size={10} />
        Rename
      </div>
    </div>
  );
};

export default ContextMenu;
