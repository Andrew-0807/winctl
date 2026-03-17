import { Component, Show, createSignal, createEffect, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import { Service, folders, startService, stopService } from '../stores/services';
import {
  isPanelOpen,
  togglePanel,
  setPanelTab,
  draggedServiceId,
  setDraggedServiceId,
  showContextMenu,
  openServiceModal,
  currentView
} from '../stores/ui';
import LogViewer from './LogViewer';
import ServiceDetails from './ServiceDetails';
import Icon from './Icon';

interface ServiceCardProps {
  service: Service;
  inFolder?: boolean;
  /** Called when user clicks terminal toggle while inside a folder in gallery view */
  onLogToggle?: (service: Service) => void;
  /** ID of the service whose log is currently shown in the parent folder overlay */
  activeLogServiceId?: string;
}

const ServiceCard: Component<ServiceCardProps> = (props) => {
  const [currentTab, setCurrentTab] = createSignal('logs');

  const isRunning = () => props.service.status === 'running';
  const isStarting = () => props.service.status === 'starting';
  const isStopping = () => props.service.status === 'stopping';
  const isTransitioning = () => isStarting() || isStopping();

  // Direct reactive access to panel state
  const isExpanded = () => isPanelOpen(props.service.id);

  const pid = () => props.service.pid ? `PID: ${props.service.pid}` : '';

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const uptime = () => props.service.startedAt ? `up ${timeAgo(props.service.startedAt)}` : '';
  const restarts = () => props.service.restartCount ? `↺ ${props.service.restartCount}` : '';

  const folder = () => props.service.folderId
    ? folders.find(f => f.id === props.service.folderId)
    : null;

  const statusLabels: Record<string, string> = {
    running: 'RUNNING',
    stopped: 'STOPPED',
    starting: 'STARTING...',
    stopping: 'STOPPING...'
  };

  const getBadgeClass = () => {
    if (isRunning()) return 'badge-running';
    if (isStarting()) return 'badge-starting';
    if (isStopping()) return 'badge-stopping';
    return 'badge-stopped';
  };

  const handleTogglePanel = () => {
    // When inside a folder in gallery view, delegate log display to the parent FolderCard
    if (props.inFolder && currentView() === 'gallery' && props.onLogToggle) {
      props.onLogToggle(props.service);
    } else {
      togglePanel(props.service.id);
    }
  };

  // Whether this card's log is active in the parent folder overlay
  const isLogActive = () =>
    props.inFolder && currentView() === 'gallery'
      ? props.activeLogServiceId === props.service.id
      : isPanelOpen(props.service.id);

  const handleTabClick = (tab: string) => {
    setCurrentTab(tab);
    setPanelTab(props.service.id, tab);
  };

  const handleControl = async (action: 'start' | 'stop') => {
    if (action === 'start') {
      await startService(props.service.id);
    } else {
      await stopService(props.service.id);
    }
  };

  const handleEdit = () => {
    openServiceModal(props.service.id);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') {
      if (!isTransitioning()) {
        handleControl(isRunning() ? 'stop' : 'start');
      }
    } else if (e.key === 'e' || e.key === 'E') {
      if (!isTransitioning()) {
        handleEdit();
      }
    }
  };

  // Drag handlers
  const handleDragStart = (e: DragEvent) => {
    setDraggedServiceId(props.service.id);
    e.dataTransfer?.setData('text/plain', props.service.id);
    (e.target as HTMLElement).closest('.svc-card')?.classList.add('dragging');
  };

  const handleDragEnd = (e: DragEvent) => {
    setDraggedServiceId(null);
    (e.target as HTMLElement).closest('.svc-card')?.classList.remove('dragging');
  };

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  const PanelContent = () => (
    <>
      <div class="panel-tabs">
        <div
          class={`panel-tab ${currentTab() === 'logs' ? 'active' : ''}`}
          data-tab={`${props.service.id}-logs`}
          onClick={() => handleTabClick('logs')}
        >
          Logs
        </div>
        <div
          class={`panel-tab ${currentTab() === 'details' ? 'active' : ''}`}
          data-tab={`${props.service.id}-details`}
          onClick={() => handleTabClick('details')}
        >
          Details
        </div>
      </div>

      <div
        class="panel-body"
        id={`pbody-${props.service.id}`}
        style={currentView() === 'gallery' ? "flex: 1; overflow-y: auto;" : ""}
      >
        <Show when={currentTab() === 'logs'}>
          <LogViewer
            serviceId={props.service.id}
            logs={props.service.recentLogs || []}
          />
        </Show>
        <Show when={currentTab() === 'details'}>
          <ServiceDetails
            service={props.service}
            folders={folders}
          />
        </Show>
      </div>
    </>
  );

  return (
    <div
      class={`svc-card ${props.service.status}`}
      id={`card-${props.service.id}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        class={`svc-header status-${props.service.status}`}
        onClick={handleTogglePanel}
      >
        <div
          class="svc-status-dot"
          draggable={true}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="Drag to move"
        />

        <div class="svc-info">
          <div class="svc-name">
            {props.service.name}
            <Show when={props.service.port}>
              <span class="svc-port">
                <a
                  class="port-link"
                  href={`http://localhost:${props.service.port}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  :{props.service.port} ↗
                </a>
              </span>
            </Show>
            <Show when={folder() && !props.inFolder}>
              <span class="folder-badge">{folder()!.name}</span>
            </Show>
          </div>

          <div class="svc-meta">
            <Show when={pid()}>
              <span>{pid()}</span>
            </Show>
            <Show when={uptime()}>
              <span>{uptime()}</span>
            </Show>
            <Show when={restarts()}>
              <span class={props.service.restartCount > 3 ? 'warn' : ''}>
                {restarts()}
              </span>
            </Show>
          </div>
        </div>

        <span class={`svc-badge ${getBadgeClass()}`}>
          {statusLabels[props.service.status] || props.service.status.toUpperCase()}
        </span>

        <div class="svc-controls" onClick={(e) => e.stopPropagation()}>
          <Show when={!isRunning() && !isTransitioning()}>
            <button
              class="ctrl-btn start"
              title="Start (S)"
              onClick={() => handleControl('start')}
            >
              <Icon name="Play" size={14} />
            </button>
          </Show>

          <Show when={isRunning() && !isTransitioning()}>
            <button
              class="ctrl-btn stop"
              title="Stop (S)"
              onClick={() => handleControl('stop')}
            >
              <Icon name="Square" size={14} />
            </button>
          </Show>

          <Show when={isTransitioning()}>
            <button class="ctrl-btn loading" disabled>
              <span></span>
            </button>
          </Show>

          <button
            class="ctrl-btn edit"
            title="Edit (E)"
            onClick={handleEdit}
            disabled={isTransitioning()}
            style={isTransitioning() ? 'opacity: 0.5' : ''}
          >
            <Icon name="Edit" size={14} />
          </button>
        </div>
      </div>

      {/* Standalone (non-folder) item in gallery view: show a side panel Portal at z-index 200 */}
      <Show when={currentView() === 'gallery' && !props.inFolder && isExpanded()}>
        <Portal>
          <div
            class="modal-backdrop open"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
                togglePanel(props.service.id);
              }
            }}
            style="z-index: 200; display: flex; align-items: center; justify-content: flex-start; padding-left: 24px;"
          >
            <div
              class="modal custom-gallery-modal"
              style="width: 400px; max-width: 40vw; height: 80vh; max-height: 800px; display: flex; flex-direction: column; margin: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.6);"
            >
              <div class="modal-header" style="flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;">
                <div class="modal-title" style="display: flex; align-items: center; gap: 8px; font-size: 15px;">
                  <span style="color: var(--accent); display: flex;"><Icon name="Terminal" size={16} /></span>
                  {props.service.name} Logs
                </div>
                <button class="modal-close" onClick={() => togglePanel(props.service.id)}>
                  <Icon name="X" size={14} />
                </button>
              </div>
              <div class="svc-panel open" style="display: flex; flex-direction: column; flex: 1; border: none; max-height: none;" id={`panel-${props.service.id}`}>
                <PanelContent />
              </div>
            </div>
          </div>
        </Portal>
      </Show>

      <Show when={currentView() !== 'gallery'}>
        <div class={`svc-panel ${isExpanded() ? 'open' : ''}`} id={`panel-${props.service.id}`}>
          <PanelContent />
        </div>
      </Show>
    </div>
  );
};

export default ServiceCard;
