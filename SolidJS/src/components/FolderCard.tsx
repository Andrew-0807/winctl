import { Component, For, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Service, Folder, settings, startService, stopService, moveServiceToFolder } from '../stores/services';
import {
  isFolderExpanded,
  toggleFolder,
  openFolderModal,
  draggedServiceId,
  setDraggedServiceId,
  showContextMenu,
  currentView
} from '../stores/ui';
import ServiceCard from './ServiceCard';
import LogViewer from './LogViewer';
import Icon from './Icon';

interface FolderCardProps {
  folder: Folder;
  services: Service[];
}

const FolderCard: Component<FolderCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isDragOver, setIsDragOver] = createSignal(false);
  // Track which service's log panel is open inside the folder overlay
  const [logService, setLogService] = createSignal<Service | null>(null);

  // Sync with store
  createEffect(() => {
    setIsExpanded(isFolderExpanded(props.folder.id));
  });

  // Close log panel when folder is closed
  createEffect(() => {
    if (!isExpanded()) setLogService(null);
  });

  createEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded() && currentView() === 'gallery') {
        if (logService()) {
          setLogService(null);
        } else {
          toggleFolder(props.folder.id);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  const handleToggle = () => {
    toggleFolder(props.folder.id);
  };

  const handleStartAll = async (e: MouseEvent) => {
    e.stopPropagation();
    for (const s of props.services.filter(s => s.status === 'stopped')) {
      await startService(s.id);
    }
  };

  const handleStopAll = async (e: MouseEvent) => {
    e.stopPropagation();
    for (const s of props.services.filter(s => s.status === 'running')) {
      await stopService(s.id);
    }
  };

  const handleRename = (e: MouseEvent) => {
    e.stopPropagation();
    openFolderModal(props.folder.id);
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, props.folder.id);
  };

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedId = draggedServiceId();
    if (draggedId) {
      await moveServiceToFolder(draggedId, props.folder.id);
    }
  };

  const serviceCount = () => props.services.length;
  const showCount = () => settings.showFolderCount !== false;

  // Called by ServiceCard when inside a folder in gallery view
  const handleLogToggle = (service: Service) => {
    setLogService(prev => prev?.id === service.id ? null : service);
  };

  // Get the latest service data reactively for the log panel
  const activeLogService = () => {
    const svc = logService();
    if (!svc) return null;
    return props.services.find(s => s.id === svc.id) ?? svc;
  };

  return (
    <div
      class={`folder-card ${isExpanded() && currentView() !== 'gallery' ? 'expanded' : ''} ${isDragOver() ? 'drag-over' : ''}`}
      id={`folder-${props.folder.id}`}
      data-folder-id={props.folder.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        class="folder-header"
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
      >
        <span class="folder-chevron">
          <Icon name="ChevronRight" size={10} />
        </span>
        <span class="folder-icon">
          <Icon name="Folder" size={12} />
        </span>
        <span class="folder-name">{props.folder.name}</span>

        <div class="folder-actions" onClick={(e) => e.stopPropagation()}>
          <button
            class="folder-action-btn start"
            title="Start All"
            onClick={handleStartAll}
          >
            <Icon name="Play" size={12} />
          </button>
          <button
            class="folder-action-btn stop"
            title="Stop All"
            onClick={handleStopAll}
          >
            <Icon name="Square" size={12} />
          </button>
          <button
            class="folder-action-btn edit"
            title="Rename"
            onClick={handleRename}
          >
            <Icon name="Edit" size={12} />
          </button>
        </div>

        <Show when={showCount()}>
          <span class={`folder-count ${!showCount() ? 'hidden' : ''}`}>
            {serviceCount()}
          </span>
        </Show>
      </div>

      <Show when={currentView() !== 'gallery'}>
        <div class="folder-body">
          <div class="folder-body-inner">
            <For each={props.services}>
              {(service) => <ServiceCard service={service} inFolder={true} />}
            </For>
            <Show when={props.services.length === 0}>
              <div style="color: var(--text3); font-size: 12px; padding: 8px; text-align: center;">
                Drag services here
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={isExpanded() && currentView() === 'gallery'}>
        <Portal>
          <div
            class="modal-backdrop open"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
                toggleFolder(props.folder.id);
              }
            }}
            style="z-index: 200;"
          >
            {/* Unified flex-row container: folder panel + log panel side by side */}
            <div
              class={`gallery-folder-overlay${activeLogService() ? ' show-log' : ''}`}
            >
              {/* Left: folder content panel */}
              <div class="gallery-folder-panel">
                <div class="modal-header" style="flex-shrink: 0;">
                  <div class="modal-title" style="display: flex; align-items: center; gap: 8px; font-size: 18px;">
                    <span style="color: var(--accent); display: flex;"><Icon name="Folder" size={18} /></span>
                    {props.folder.name}
                    <span class="folder-count" style="position: static; transform: none; display: inline-block;">
                      {serviceCount()}
                    </span>
                  </div>
                  <button class="modal-close" onClick={handleToggle}>
                    <Icon name="X" size={16} />
                  </button>
                </div>

                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 24px; background: var(--bg);">
                  <div class="services-grid view-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
                    <For each={props.services}>
                      {(service) => (
                        <div class="svc-wrapper" style="margin-bottom: 0;">
                          <ServiceCard
                            service={service}
                            inFolder={true}
                            onLogToggle={handleLogToggle}
                            activeLogServiceId={logService()?.id}
                          />
                        </div>
                      )}
                    </For>
                    <Show when={props.services.length === 0}>
                      <div style="color: var(--text3); font-size: 14px; text-align: center; grid-column: 1 / -1; padding: 40px; border: 2px dashed var(--border2); border-radius: 8px;">
                        This folder is empty. Drag services here in List View.
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              {/* Right: inline log panel */}
              <Show when={activeLogService()}>
                <div class="gallery-log-panel">
                  <div class="gallery-log-header">
                    <div class="gallery-log-title">
                      <span style="color: var(--accent); display: flex;"><Icon name="Terminal" size={14} /></span>
                      {activeLogService()!.name} — Logs
                    </div>
                    <button class="modal-close" onClick={() => setLogService(null)}>
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                  <div class="gallery-log-body">
                    <LogViewer
                      serviceId={activeLogService()!.id}
                      logs={activeLogService()!.recentLogs || []}
                    />
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </div>
  );
};

export default FolderCard;
