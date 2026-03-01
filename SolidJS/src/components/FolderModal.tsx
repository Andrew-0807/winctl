import { Component, Show, createSignal, createEffect } from 'solid-js';
import { folders, saveFolder, deleteFolder } from '../stores/services';
import { folderModalOpen, folderModalEditId, closeFolderModal } from '../stores/ui';
import Icon from './Icon';

const FolderModal: Component = () => {
  const [folderName, setFolderName] = createSignal('');
  
  const isEditing = () => !!folderModalEditId();
  
  // Load folder data when editing
  createEffect(() => {
    if (folderModalEditId()) {
      const folder = folders.find(f => f.id === folderModalEditId());
      if (folder) {
        setFolderName(folder.name);
      }
    } else {
      setFolderName('');
    }
  });
  
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeFolderModal();
    }
  };
  
  const handleSave = async () => {
    if (!folderName().trim()) {
      alert('Folder name is required');
      return;
    }
    
    const folderData = {
      id: folderModalEditId() || undefined,
      name: folderName().trim()
    };
    
    if (isEditing()) {
      await saveFolder(folderData.name, folderData.id);
    } else {
      await saveFolder(folderData.name);
    }
    
    closeFolderModal();
  };
  
  const handleDelete = async () => {
    if (folderModalEditId() && confirm('Are you sure you want to delete this folder? Services will be moved to root.')) {
      await deleteFolder(folderModalEditId()!);
      closeFolderModal();
    }
  };
  
  const handleCancel = () => {
    closeFolderModal();
  };

  return (
    <div 
      class={`modal-backdrop ${folderModalOpen() ? 'open' : ''}`}
      id="folder-modal"
      onClick={handleBackdropClick}
    >
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title" id="folder-modal-title">
            {isEditing() ? 'Edit Folder' : 'New Folder'}
          </div>
          <button class="modal-close" onClick={handleCancel}>
            <Icon name="X" size={14} />
          </button>
        </div>
        
        <div class="modal-body">
          <input type="hidden" id="folder-edit-id" value={folderModalEditId() || ''} />
          
          <div class="form-group">
            <label>Folder Name *</label>
            <input 
              type="text" 
              class="form-input" 
              id="folder-name" 
              placeholder="My Folder"
              value={folderName()}
              onInput={(e) => setFolderName(e.currentTarget.value)}
            />
          </div>
        </div>
        
        <div class="modal-footer">
          <Show when={isEditing()}>
            <button 
              class="btn-cancel" 
              id="folder-delete-btn" 
              style="background: var(--red); color: white; display: none;"
              onClick={handleDelete}
            >
              Delete Folder
            </button>
          </Show>
          <div style="margin-left: auto;">
            <button class="btn-cancel" onClick={handleCancel}>Cancel</button>
            <button class="btn-save" onClick={handleSave}>Save Folder</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FolderModal;
