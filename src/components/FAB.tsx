import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';

const FAB: React.FC = () => {
  const fabOpen = useUIStore((s) => s.fabOpen);
  const toggleFab = useUIStore((s) => s.toggleFab);
  const openServiceModal = useUIStore((s) => s.openServiceModal);
  const openFolderModal = useUIStore((s) => s.openFolderModal);
  const fabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node) && fabOpen) {
        toggleFab();
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [fabOpen, toggleFab]);

  const handleNewService = () => { openServiceModal(); toggleFab(); };
  const handleNewFolder = () => { openFolderModal(); toggleFab(); };

  return (
    <div className="fab-container" ref={fabRef}>
      <AnimatePresence>
        {fabOpen && (
          <motion.div
            className="fab-menu open origin-bottom-right"
            initial={{ scale: 0.8, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.18 }}
          >
            <div className="fab-item" onClick={handleNewFolder}>
              <Icon name="FolderPlus" size={12} />
              <span>New Folder</span>
            </div>
            <div className="fab-item" onClick={handleNewService}>
              <Icon name="Plus" size={12} />
              <span>New Service</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        className={`fab-btn ${fabOpen ? 'open' : ''}`}
        onClick={(e) => { e.stopPropagation(); toggleFab(); }}
      >
        <Icon name="Plus" size={14} />
      </button>
    </div>
  );
};

export default FAB;
