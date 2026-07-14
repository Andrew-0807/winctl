import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useServiceStore, type Service } from '../stores/services';
import { useUIStore } from '../stores/ui';
import ServiceCard from './ServiceCard';
import FolderCard from './FolderCard';
import SortableService from './SortableService';
import Icon from './Icon';

const byOrder = (a: Service, b: Service) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);

// Root (folder-less) drop target. `data.type: 'root'` — a service drag can
// land here to leave its folder; a folder drag never collides with it.
const RootDropZone: React.FC<{ children?: React.ReactNode; empty: boolean }> = ({ children, empty }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'root-drop-zone', data: { type: 'root' } });
  return (
    <div
      ref={setNodeRef}
      className={`drop-zone ${empty ? 'empty' : ''} ${isOver ? 'drag-over' : ''}`}
    >
      {children}
      {empty && <span className="drop-zone-hint">Drop here to remove from folder</span>}
    </div>
  );
};

const ServiceGrid: React.FC = () => {
  const services = useServiceStore((s) => s.services);
  const folders = useServiceStore((s) => s.folders);
  const reorderServices = useServiceStore((s) => s.reorderServices);
  const reorderFolders = useServiceStore((s) => s.reorderFolders);
  const moveServiceToFolder = useServiceStore((s) => s.moveServiceToFolder);
  const currentFilter = useUIStore((s) => s.currentFilter);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const settings = useServiceStore((s) => s.settings);

  const currentView = settings.currentView || 'list';

  // What's currently being dragged — drives the DragOverlay preview.
  const [active, setActive] = useState<{ id: string; type: 'service' | 'folder' } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredServices = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filter = currentFilter;
    return services.filter((s) => {
      const matchSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.command || '').toLowerCase().includes(query) ||
        (s.description || '').toLowerCase().includes(query);
      const matchFilter = filter === 'all' || s.status === filter;
      return matchSearch && matchFilter;
    });
  }, [services, searchQuery, currentFilter]);

  const rootServices = useMemo(
    () => filteredServices.filter((s) => !s.folderId).sort(byOrder),
    [filteredServices]
  );

  const folderMap = useMemo(() => {
    const map: Record<string, Service[]> = {};
    folders.forEach((f) => { map[f.id] = []; });
    filteredServices.forEach((s) => {
      if (s.folderId && map[s.folderId]) map[s.folderId].push(s);
    });
    Object.values(map).forEach((list) => list.sort(byOrder));
    return map;
  }, [filteredServices, folders]);

  const isEmpty = filteredServices.length === 0 && folders.length === 0;

  // Type-aware collision. This is the whole fix for the folder-drag bug:
  //  - dragging a FOLDER only ever collides with other folders (clean reorder).
  //  - dragging a SERVICE ignores the folder-card sortable itself, so it lands
  //    on the inner service or the folder's drop zone, never "on the folder".
  const collisionDetection: CollisionDetection = (args) => {
    const type = args.active.data.current?.type;
    const keep =
      type === 'folder'
        ? (c: { data: { current?: { type?: string } } }) => c.data.current?.type === 'folder'
        : (c: { data: { current?: { type?: string } } }) => c.data.current?.type !== 'folder';
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(keep),
    });
  };

  const handleDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as 'service' | 'folder' | undefined;
    if (type) setActive({ id: e.active.id as string, type });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const draggedId = a.id as string;
    const overId = over.id as string;

    // ── Folder reorder ──
    if (a.data.current?.type === 'folder') {
      const ids = folders.map((f) => f.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return;
      await reorderFolders(arrayMove(ids, from, to));
      return;
    }

    // ── Service move / reorder ──
    const dragged = services.find((s) => s.id === draggedId);
    if (!dragged) return;
    const fromCtx = dragged.folderId ?? null;

    // Resolve destination folder (null = root) and the service to insert before.
    let toCtx: string | null | undefined;
    let anchorId: string | null = null;
    if (overId.startsWith('folder-drop-')) {
      toCtx = overId.slice('folder-drop-'.length);
    } else if (overId === 'root-drop-zone') {
      toCtx = null;
    } else {
      const overSvc = services.find((s) => s.id === overId);
      if (!overSvc) return;
      toCtx = overSvc.folderId ?? null;
      anchorId = overId;
    }
    if (toCtx === undefined) return;

    // Final ordered ids for the destination, dragged item inserted at anchor.
    const destIds = services
      .filter((s) => (s.folderId ?? null) === toCtx && s.id !== draggedId)
      .sort(byOrder)
      .map((s) => s.id);
    const at = anchorId ? destIds.indexOf(anchorId) : -1;
    destIds.splice(at === -1 ? destIds.length : at, 0, draggedId);

    if (fromCtx !== toCtx) await moveServiceToFolder(draggedId, toCtx);
    await reorderServices(destIds);
  };

  const activeService = active?.type === 'service' ? services.find((s) => s.id === active.id) : null;
  const activeFolder = active?.type === 'folder' ? folders.find((f) => f.id === active.id) : null;

  const rootIds = rootServices.map((s) => s.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className={`services-grid view-${currentView}`} id="services-list">
        {isEmpty && (
          <div className="empty-state">
            <h3>No services found</h3>
            <p>Add a service using the button in the sidebar, or adjust your filter.</p>
          </div>
        )}

        {!isEmpty && (
          <>
            {folders.length > 0 && (
              <SortableContext items={folders.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {folders.map((folder, i) => (
                  <FolderCard key={folder.id} folder={folder} services={folderMap[folder.id] || []} index={i} />
                ))}
              </SortableContext>
            )}

            {rootServices.length > 0 && (
              <SortableContext items={rootIds} strategy={verticalListSortingStrategy}>
                <RootDropZone empty={false}>
                  {rootServices.map((service, i) => (
                    <SortableService key={service.id} service={service} inFolder={false} index={i} />
                  ))}
                </RootDropZone>
              </SortableContext>
            )}

            {folders.length > 0 && rootServices.length === 0 && <RootDropZone empty />}
          </>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeService && (
          <div className="svc-wrapper drag-overlay-card">
            <ServiceCard service={activeService} inFolder={!!activeService.folderId} isDragging={true} />
          </div>
        )}
        {activeFolder && (
          <div className="folder-card drag-overlay-card">
            <div className="folder-header">
              <span className="folder-chevron"><Icon name="ChevronRight" size={10} /></span>
              <span className="folder-icon"><Icon name="Folder" size={12} /></span>
              <span className="folder-name">{activeFolder.name}</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default ServiceGrid;
