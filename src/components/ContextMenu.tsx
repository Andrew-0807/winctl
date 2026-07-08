import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

const ContextMenu: React.FC = () => {
  const contextMenuOpen = useUIStore((s) => s.contextMenuOpen);
  const contextMenuPosition = useUIStore((s) => s.contextMenuPosition);
  const contextFolderId = useUIStore((s) => s.contextFolderId);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const openFolderModal = useUIStore((s) => s.openFolderModal);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) hideContextMenu();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu();
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenuOpen, hideContextMenu]);

  const handleNewFolder = () => { openFolderModal(); hideContextMenu(); };
  const handleRename = () => {
    if (contextFolderId) openFolderModal(contextFolderId);
    hideContextMenu();
  };

  return (
    <div
      className={`context-menu ${contextMenuOpen ? 'open' : ''}`}
      id="context-menu"
      ref={menuRef}
      style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
    >
      <div className="ctx-item" onClick={handleNewFolder}>
        <Icon name="FolderPlus" size={10} /> New Folder
      </div>
      <div className="ctx-divider"></div>
      <div className="ctx-item" onClick={handleRename}>
        <Icon name="Edit" size={10} /> Rename
      </div>
    </div>
  );
};

export default ContextMenu;
