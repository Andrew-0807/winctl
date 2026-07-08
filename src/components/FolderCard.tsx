import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useServiceStore, type Service, type Folder } from '../stores/services';
import { useUIStore } from '../stores/ui';
import SortableService from './SortableService';
import LogViewer from './LogViewer';
import Icon from './Icon';

interface FolderCardProps {
  folder: Folder;
  services: Service[];
}

const FolderCard: React.FC<FolderCardProps> = ({ folder, services }) => {
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const startService = useServiceStore((s) => s.startService);
  const stopService = useServiceStore((s) => s.stopService);
  const openFolderModal = useUIStore((s) => s.openFolderModal);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const expandedFolders = settings.expandedFolders || [];
  const currentView = settings.currentView || 'list';
  const showCount = settings.showFolderCount !== false;

  const isExpanded = expandedFolders.includes(folder.id);
  const [logService, setLogService] = useState<Service | null>(null);

  useEffect(() => {
    if (!isExpanded) setLogService(null);
  }, [isExpanded]);

  const toggleFolder = () => {
    const next = isExpanded
      ? expandedFolders.filter((id) => id !== folder.id)
      : [...expandedFolders, folder.id];
    updateSettings({ expandedFolders: next });
  };

  const handleStartAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const s of services.filter((s) => s.status === 'stopped')) {
      await startService(s.id);
    }
  };

  const handleStopAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const s of services.filter((s) => s.status === 'running')) {
      await stopService(s.id);
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    openFolderModal(folder.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, folder.id);
  };

  const handleLogToggle = (service: Service) => {
    setLogService((prev) => (prev?.id === service.id ? null : service));
  };

  const activeLogService = logService
    ? services.find((s) => s.id === logService.id) ?? logService
    : null;

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [services]
  );

  const serviceIds = sortedServices.map((s) => s.id);

  // Drop target for moving a service INTO this folder. Distinct type from the
  // folder sortable so a folder-drag never targets it.
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder-dropzone', folderId: folder.id }
  });

  // Makes the folder itself a sortable item (drag handle in the header).
  const {
    attributes,
    listeners,
    setNodeRef: setSortNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id, data: { type: 'folder' } });

  // One element is both the service drop target and the sortable folder node.
  const setRefs = (el: HTMLElement | null) => {
    setDropNodeRef(el);
    setSortNodeRef(el);
  };

  const sortStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      className={`folder-card ${isExpanded && currentView !== 'gallery' ? 'expanded' : ''} ${isOver ? 'drag-over' : ''} ${isDragging ? 'dragging' : ''}`}
      id={`folder-${folder.id}`}
      data-folder-id={folder.id}
      ref={setRefs}
      style={sortStyle}
    >
      <div className="folder-header" onClick={toggleFolder} onContextMenu={handleContextMenu}>
        <span
          className="folder-drag-handle"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <Icon name="GripVertical" size={12} />
        </span>
        <span className="folder-chevron">
          <Icon name="ChevronRight" size={10} />
        </span>
        <span className="folder-icon">
          <Icon name="Folder" size={12} />
        </span>
        <span className="folder-name">{folder.name}</span>

        <div className="folder-actions" onClick={(e) => e.stopPropagation()}>
          <button className="folder-action-btn start" title="Start All" onClick={handleStartAll}>
            <Icon name="Play" size={12} />
          </button>
          <button className="folder-action-btn stop" title="Stop All" onClick={handleStopAll}>
            <Icon name="Square" size={12} />
          </button>
          <button className="folder-action-btn edit" title="Rename" onClick={handleRename}>
            <Icon name="Edit" size={12} />
          </button>
        </div>

        {showCount && (
          <span className="folder-count">{services.length}</span>
        )}
      </div>

      {/* List view body */}
      {currentView !== 'gallery' && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="folder-body overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className="folder-body-inner min-h-10"
                style={{ outline: isOver && services.length === 0 ? '2px dashed var(--accent)' : 'none' }}
              >
                <SortableContext items={serviceIds} strategy={verticalListSortingStrategy}>
                  {sortedServices.map((service, i) => (
                    <SortableService key={service.id} service={service} inFolder index={i} />
                  ))}
                </SortableContext>
                {services.length === 0 && (
                  <div className="text-text3 text-xs p-2 text-center">
                    Drag services here
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Gallery view overlay — Portal */}
      {isExpanded && currentView === 'gallery' &&
        createPortal(
          <div
            className="modal-backdrop open z-[200]"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('modal-backdrop')) toggleFolder();
            }}
          >
            <motion.div
              className={`gallery-folder-overlay${activeLogService ? ' show-log' : ''}`}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="gallery-folder-panel">
                <div className="modal-header shrink-0">
                  <div className="modal-title flex items-center gap-2 text-lg">
                    <span className="text-accent flex">
                      <Icon name="Folder" size={18} />
                    </span>
                    {folder.name}
                    <span className="folder-count static transform-none inline-block">
                      {services.length}
                    </span>
                  </div>
                  <button className="modal-close" onClick={toggleFolder}>
                    <Icon name="X" size={16} />
                  </button>
                </div>

                <div className="modal-body flex-1 overflow-y-auto p-6 bg-bg">
                  <div
                    className="services-grid view-gallery grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 min-h-20"
                    style={{ outline: isOver && services.length === 0 ? '2px dashed var(--accent)' : 'none' }}
                  >
                    <SortableContext items={serviceIds} strategy={verticalListSortingStrategy}>
                      {sortedServices.map((service, i) => (
                        <SortableService
                          key={service.id}
                          service={service}
                          inFolder
                          index={i}
                          onLogToggle={handleLogToggle}
                          activeLogServiceId={logService?.id}
                        />
                      ))}
                    </SortableContext>
                    {services.length === 0 && (
                      <div className="text-text3 text-sm text-center col-span-full p-10 border-2 border-dashed border-border2 rounded-lg">
                        This folder is empty. Drag services here in List View.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {activeLogService && (
                <div className="gallery-log-panel">
                  <div className="gallery-log-header">
                    <div className="gallery-log-title">
                      <span className="text-accent flex">
                        <Icon name="Terminal" size={14} />
                      </span>
                      {activeLogService.name} — Logs
                    </div>
                    <button className="modal-close" onClick={() => setLogService(null)}>
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                  <div className="gallery-log-body">
                    <LogViewer
                      serviceId={activeLogService.id}
                      logs={activeLogService.recentLogs || []}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default FolderCard;