import { Component, For, Show, createSignal, createEffect } from 'solid-js';
import { Service, Folder, settings, startService, stopService, moveServiceToFolder } from '../stores/services';
import { 
  isFolderExpanded, 
  toggleFolder, 
  openFolderModal,
  draggedServiceId,
  setDraggedServiceId,
  showContextMenu
} from '../stores/ui';
import ServiceCard from './ServiceCard';
import Icon from './Icon';

interface FolderCardProps {
  folder: Folder;
  services: Service[];
}

const FolderCard: Component<FolderCardProps> = (props) => {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [isDragOver, setIsDragOver] = createSignal(false);
  
  // Sync with store
  createEffect(() => {
    setIsExpanded(isFolderExpanded(props.folder.id));
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

  return (
    <div 
      class={`folder-card ${isExpanded() ? 'expanded' : ''} ${isDragOver() ? 'drag-over' : ''}`}
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
    </div>
  );
};

export default FolderCard;
