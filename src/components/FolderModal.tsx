import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

const FolderModal: React.FC = () => {
  const folders = useServiceStore((s) => s.folders);
  const saveFolder = useServiceStore((s) => s.saveFolder);
  const deleteFolder = useServiceStore((s) => s.deleteFolder);
  const folderModalOpen = useUIStore((s) => s.folderModalOpen);
  const folderModalEditId = useUIStore((s) => s.folderModalEditId);
  const closeFolderModal = useUIStore((s) => s.closeFolderModal);
  const toast = useUIStore((s) => s.toast);

  const [folderName, setFolderName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isEditing = !!folderModalEditId;
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (folderModalOpen) {
      setConfirmingDelete(false);
      setTimeout(() => {
        folderInputRef.current?.focus();
      }, 50);
    }
  }, [folderModalOpen]);

  useEffect(() => {
    if (folderModalEditId) {
      const folder = folders.find((f) => f.id === folderModalEditId);
      if (folder) setFolderName(folder.name);
    } else {
      setFolderName('');
    }
  }, [folderModalEditId, folders]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeFolderModal();
  };

  const handleSave = async () => {
    if (!folderName.trim()) { toast('Folder name is required', 'error'); return; }
    if (isEditing) await saveFolder(folderName.trim(), folderModalEditId!);
    else await saveFolder(folderName.trim());
    closeFolderModal();
  };

  const handleDelete = async () => {
    if (folderModalEditId) {
      await deleteFolder(folderModalEditId);
      closeFolderModal();
    }
  };

  return (
    <AnimatePresence>
      {folderModalOpen && (
        <div className="modal-backdrop open" id="folder-modal" onClick={handleBackdropClick}>
          <motion.div
            className="modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}
          >
            <div className="modal-header">
              <div className="modal-title">{isEditing ? 'Edit Folder' : 'New Folder'}</div>
              <button className="modal-close" onClick={closeFolderModal}>
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Folder Name *</label>
                <input
                  ref={folderInputRef}
                  type="text" className="form-input" placeholder="My Folder"
                  value={folderName} onChange={(e) => setFolderName(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              {isEditing && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red">Delete folder?</span>
                    <button className="btn-cancel bg-red text-white" onClick={handleDelete} title="Confirm delete">
                      <Icon name="Check" size={14} />
                    </button>
                    <button className="btn-cancel" onClick={() => setConfirmingDelete(false)} title="Cancel delete">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ) : (
                  <button className="btn-cancel bg-red text-white" onClick={() => setConfirmingDelete(true)}>
                    Delete Folder
                  </button>
                )
              )}
              <button className="btn-save ml-auto" onClick={handleSave}>Save Folder</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FolderModal;
