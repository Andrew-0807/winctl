import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Service } from '../stores/services';
import ServiceCard from './ServiceCard';

interface Props {
  service: Service;
  inFolder: boolean;
  index?: number;
  onLogToggle?: (service: Service) => void;
  activeLogServiceId?: string;
}

// One sortable service row. `data.type: 'service'` is what the grid's
// collision detection keys on to keep folder-drags from targeting services.
const SortableService: React.FC<Props> = ({
  service,
  inFolder,
  index = 0,
  onLogToggle,
  activeLogServiceId,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: service.id,
    data: { type: 'service', folderId: service.folderId ?? null },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The DragOverlay renders the real preview; the original just leaves a gap.
    opacity: isDragging ? 0.3 : 1,
    '--card-index': index,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} className="svc-wrapper" {...attributes}>
      <ServiceCard
        service={service}
        inFolder={inFolder}
        onLogToggle={onLogToggle}
        activeLogServiceId={activeLogServiceId}
        dragHandleProps={listeners}
        isDragging={isDragging}
      />
    </div>
  );
};

export default SortableService;
