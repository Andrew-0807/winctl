import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore, type Service } from '../stores/services';
import { useUIStore } from '../stores/ui';
import LogViewer from './LogViewer';
import ServiceDetails from './ServiceDetails';
import Icon from './Icon';
import ServiceIcon from './ServiceIcon';

interface ServiceCardProps {
  service: Service;
  inFolder?: boolean;
  onLogToggle?: (service: Service) => void;
  activeLogServiceId?: string;
  dragHandleProps?: Record<string, any>;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  inFolder = false,
  onLogToggle,
  activeLogServiceId,
  dragHandleProps,
}) => {
  const [currentTab, setCurrentTab] = useState('logs');
  const folders = useServiceStore((s) => s.folders);
  const startService = useServiceStore((s) => s.startService);
  const stopService = useServiceStore((s) => s.stopService);
  const dismissError = useServiceStore((s) => s.dismissError);
  const settings = useServiceStore((s) => s.settings);
  const openPanels = useUIStore((s) => s.openPanels);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const openServiceModal = useUIStore((s) => s.openServiceModal);

  const currentView = settings.currentView || 'list';

  const isRunning = service.status === 'running';
  const isStarting = service.status === 'starting';
  const isStopping = service.status === 'stopping';
  const isTransitioning = isStarting || isStopping;
  const isExpanded = !!openPanels[service.id];

  // Pulse the status LED when a service settles into running/stopped. The CSS
  // (statusRipple) already existed but lost its trigger in the SolidJS→React move.
  const prevStatusRef = useRef(service.status);
  const [statusChanged, setStatusChanged] = useState(false);
  useEffect(() => {
    if (prevStatusRef.current !== service.status) {
      const settled = service.status === 'running' || service.status === 'stopped';
      prevStatusRef.current = service.status;
      if (settled) {
        setStatusChanged(true);
        const t = setTimeout(() => setStatusChanged(false), 500);
        return () => clearTimeout(t);
      }
    }
  }, [service.status]);

  const pid = service.pid ? `PID: ${service.pid}` : '';

  const timeAgo = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const uptime = service.startedAt ? `up ${timeAgo(service.startedAt)}` : '';
  const restarts = service.restartCount ? `↺ ${service.restartCount}` : '';
  const folder = service.folderId ? folders.find((f) => f.id === service.folderId) : null;

  const statusLabels: Record<string, string> = {
    running: 'Running',
    stopped: 'Stopped',
    starting: 'Starting…',
    stopping: 'Stopping…',
  };

  // Tint for a Lucide (monochrome) service icon; picture icons ignore it and
  // lean on the badge glow instead. Matches the LED status palette.
  const statusIconColor = isRunning
    ? 'var(--green)'
    : isStarting
    ? 'var(--accent)'
    : isStopping
    ? 'var(--yellow)'
    : 'var(--text3)';

  const getBadgeClass = () => {
    if (isRunning) return 'badge-running';
    if (isStarting) return 'badge-starting';
    if (isStopping) return 'badge-stopping';
    return 'badge-stopped';
  };

  const handleTogglePanel = () => {
    if (inFolder && currentView === 'gallery' && onLogToggle) {
      onLogToggle(service);
    } else {
      togglePanel(service.id);
    }
  };

  const handleControl = async (action: 'start' | 'stop') => {
    if (action === 'start') await startService(service.id);
    else await stopService(service.id);
  };

  const handleEdit = () => openServiceModal(service.id);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') {
      if (!isTransitioning) handleControl(isRunning ? 'stop' : 'start');
    } else if (e.key === 'e' || e.key === 'E') {
      if (!isTransitioning) handleEdit();
    }
  };

  const PanelContent = () => (
    <>
      <div className="panel-tabs">
        <div
          className={`panel-tab ${currentTab === 'logs' ? 'active' : ''}`}
          onClick={() => setCurrentTab('logs')}
        >
          Logs
        </div>
        <div
          className={`panel-tab ${currentTab === 'details' ? 'active' : ''}`}
          onClick={() => setCurrentTab('details')}
        >
          Details
        </div>
      </div>
      <div
        className="panel-body"
        id={`pbody-${service.id}`}
        style={currentView === 'gallery' ? { flex: 1, overflowY: 'auto' } : undefined}
      >
        {currentTab === 'logs' && (
          <LogViewer serviceId={service.id} logs={service.recentLogs || []} />
        )}
        {currentTab === 'details' && <ServiceDetails service={service} folders={folders} />}
      </div>
    </>
  );

  return (
    <div
      className={`svc-card ${service.status}`}
      id={`card-${service.id}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className={`svc-header status-${service.status}${statusChanged ? ' status-change' : ''}`} onClick={handleTogglePanel}>
        <div className="drag-handle" title="Drag to reorder" {...dragHandleProps}>
          <Icon name="GripVertical" size={14} />
        </div>
        {service.icon ? (
          <div
            className={`svc-icon-badge status-${service.status}${statusChanged ? ' status-change' : ''}`}
            title={statusLabels[service.status] || service.status}
          >
            <ServiceIcon icon={service.icon} size={18} color={statusIconColor} />
          </div>
        ) : (
          <div className="svc-status-dot" />
        )}
        <div className="svc-info">
          <div className="svc-name">
            {service.name}
            {service.port && (
              <span className="svc-port">
                <a
                  className="port-link"
                  href={`http://localhost:${service.port}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  :{service.port} ↗
                </a>
              </span>
            )}
            {folder && !inFolder && <span className="folder-badge">{folder.name}</span>}
          </div>
          <div className="svc-meta">
            {pid && <span>{pid}</span>}
            {uptime && <span>{uptime}</span>}
            {restarts && (
              <span className={service.restartCount > 3 ? 'warn' : ''}>{restarts}</span>
            )}
          </div>
        </div>
        {isTransitioning && (
          <span className={`svc-badge ${getBadgeClass()}`}>
            {statusLabels[service.status] || service.status.toUpperCase()}
          </span>
        )}
        {service.startupError && (
          <div
            className="startup-error-icon"
            data-tip={`${service.startupError}\n\nClick to copy · Right-click to dismiss`}
            title={`Start failed: ${service.startupError}`}
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(service.startupError!);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dismissError(service.id);
            }}
          >
            <Icon name="AlertTriangle" size={14} />
          </div>
        )}
        <div className="svc-controls" onClick={(e) => e.stopPropagation()}>
          {!isRunning && !isTransitioning && (
            <button className="ctrl-btn start" title="Start (S)" onClick={() => handleControl('start')}>
              <Icon name="Play" size={14} />
            </button>
          )}
          {isRunning && !isTransitioning && (
            <button className="ctrl-btn stop" title="Stop (S)" onClick={() => handleControl('stop')}>
              <Icon name="Square" size={14} />
            </button>
          )}
          {isTransitioning && (
            <button className="ctrl-btn loading" disabled>
              <span></span>
            </button>
          )}
          <button
            className="ctrl-btn edit"
            title="Edit (E)"
            onClick={handleEdit}
            disabled={isTransitioning}
            style={isTransitioning ? { opacity: 0.5 } : undefined}
          >
            <Icon name="Edit" size={14} />
          </button>
        </div>
      </div>

      {/* Gallery view standalone panel — Portal */}
      {currentView === 'gallery' && !inFolder && isExpanded &&
        createPortal(
          <div
            className="modal-backdrop open z-[200] flex items-center justify-start pl-6"
            onClick={(e) => {
              if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
                togglePanel(service.id);
              }
            }}
          >
            <motion.div
              className="modal custom-gallery-modal w-[400px] max-w-[40vw] h-[80vh] max-h-[800px] flex flex-col m-0 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="modal-header shrink-0 flex justify-between items-center py-3 px-4">
                <div className="modal-title flex items-center gap-2 text-[15px]">
                  <span className="text-accent flex"><Icon name="Terminal" size={16} /></span>
                  {service.name} Logs
                </div>
                <button className="modal-close" onClick={() => togglePanel(service.id)}>
                  <Icon name="X" size={14} />
                </button>
              </div>
              <div className="svc-panel open flex flex-col flex-1 border-none max-h-[none]" id={`panel-${service.id}`}>
                <PanelContent />
              </div>
            </motion.div>
          </div>,
          document.body
        )}

      {/* List view inline panel */}
      {currentView !== 'gallery' && (
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id={`panel-${service.id}`}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="svc-panel open overflow-hidden"
            >
              <PanelContent />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};

export default ServiceCard;
