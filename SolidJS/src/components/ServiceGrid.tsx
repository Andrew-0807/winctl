import { Component, For, Show, createMemo } from 'solid-js';
import { services, folders, moveServiceToFolder, reorderServices } from '../stores/services';
import { currentFilter, searchQuery, draggedServiceId } from '../stores/ui';
import ServiceCard from './ServiceCard';
import FolderCard from './FolderCard';

const ServiceGrid: Component = () => {
  // Filter services based on search query and current filter
  const filteredServices = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const filter = currentFilter();
    
    return services.filter(s => {
      // Search filter
      const matchSearch = !query || 
        s.name.toLowerCase().includes(query) || 
        (s.command || '').toLowerCase().includes(query) || 
        (s.description || '').toLowerCase().includes(query);
      
      // Status filter
      const matchFilter = filter === 'all' || s.status === filter;
      
      return matchSearch && matchFilter;
    });
  });
  
  // Separate root services and folder services
  const rootServices = createMemo(() => 
    filteredServices().filter(s => !s.folderId)
  );
  
  const folderMap = createMemo(() => {
    const map: Record<string, typeof services> = {};
    folders.forEach(f => { map[f.id] = []; });
    filteredServices().forEach(s => {
      if (s.folderId && map[s.folderId]) {
        map[s.folderId].push(s);
      }
    });
    return map;
  });
  
  // Check if empty
  const isEmpty = createMemo(() => 
    filteredServices().length === 0 && folders.length === 0
  );
  
  // Drag and drop handlers for root drop zone
  let rootDropZoneRef: HTMLDivElement | undefined;
  let dragOverServiceId: string | null = null;
  
  const handleRootDragOver = (e: DragEvent) => {
    e.preventDefault();
  };
  
  const handleRootDrop = async (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggedServiceId();
    if (draggedId) {
      // Move service to root (no folder)
      await moveServiceToFolder(draggedId, null);
    }
  };

  // Reordering handlers
  const handleDragStart = (e: DragEvent, serviceId: string) => {
    e.dataTransfer?.setData('text/plain', serviceId);
    e.dataTransfer!.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent, serviceId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (draggedId && draggedId !== serviceId) {
      dragOverServiceId = serviceId;
    }
  };

  const handleDrop = async (e: DragEvent, targetServiceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === targetServiceId) return;

    // Determine folder context
    const targetService = services.find(s => s.id === targetServiceId);
    if (!targetService) return;

    const targetFolderId = targetService.folderId;

    // Get services in the same folder (or root)
    const servicesInContext = services.filter(s => s.folderId === targetFolderId);
    
    // Find indices
    const draggedIndex = servicesInContext.findIndex(s => s.id === draggedId);
    const targetIndex = servicesInContext.findIndex(s => s.id === targetServiceId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder in array
    const reordered = [...servicesInContext];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Extract just the IDs for API
    const orderedIds = reordered.map(s => s.id);
    
    // Call API to persist reorder
    await reorderServices(orderedIds);
    
    dragOverServiceId = null;
  };

  const handleDragEnd = () => {
    dragOverServiceId = null;
  };

  return (
    <div class="services-grid" id="services-list">
      <Show when={isEmpty()}>
        <div class="empty-state">
          <h3>No services found</h3>
          <p>Add a service using the button in the sidebar, or adjust your filter.</p>
        </div>
      </Show>
      
      <Show when={!isEmpty()}>
        {/* Render folders */}
        <For each={folders}>
          {(folder) => (
            <FolderCard 
              folder={folder} 
              services={folderMap()[folder.id] || []} 
            />
          )}
        </For>
        
        {/* Render root services */}
        <Show when={rootServices().length > 0}>
          <div 
            class="drop-zone" 
            id="root-drop-zone"
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
          >
            <For each={rootServices()}>
              {(service) => (
                <div
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, service.id)}
                  onDragOver={(e) => handleDragOver(e, service.id)}
                  onDrop={(e) => handleDrop(e, service.id)}
                  onDragEnd={handleDragEnd}
                  style="cursor: grab;"
                >
                  <ServiceCard service={service} inFolder={false} />
                </div>
              )}
            </For>
          </div>
        </Show>
        
        <Show when={folders.length > 0 && rootServices().length === 0}>
          <div 
            class="drop-zone" 
            id="root-drop-zone"
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
            style="padding: 20px; text-align: center; color: var(--text3); font-size: 12px;"
          >
            Drop here to remove from folder
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default ServiceGrid;
