import { Component, Show } from 'solid-js';
import { Service, Folder } from '../stores/services';

interface ServiceDetailsProps {
  service: Service;
  folders: Folder[];
}

const ServiceDetails: Component<ServiceDetailsProps> = (props) => {
  const folder = () => props.service.folderId 
    ? props.folders.find(f => f.id === props.service.folderId) 
    : null;
  
  const formatStartedAt = (date: string | null): string => {
    if (!date) return '—';
    return date;
  };

  return (
    <div class="detail-grid">
      <div class="detail-item">
        <label>Command</label>
        <div class="val">{props.service.command}</div>
      </div>
      <div class="detail-item">
        <label>Arguments</label>
        <div class="val">{props.service.args || '—'}</div>
      </div>
      <div class="detail-item">
        <label>Working Dir</label>
        <div class="val">{props.service.cwd || '(default)'}</div>
      </div>
      <div class="detail-item">
        <label>Port</label>
        <div class="val">
          <Show 
            when={props.service.port}
            fallback="—"
          >
            <a 
              class="port-link" 
              href={`http://localhost:${props.service.port}`} 
              target="_blank"
            >
              :{props.service.port} ↗
            </a>
          </Show>
        </div>
      </div>
      <div class="detail-item">
        <label>Folder</label>
        <div class="val">
          <Show when={folder()} fallback="—">
            {folder()!.name}
          </Show>
        </div>
      </div>
      <div class="detail-item">
        <label>Auto-restart</label>
        <div class="val">
          {props.service.autoRestart ? '✓ Enabled' : '✕ Disabled'}
        </div>
      </div>
      <div class="detail-item">
        <label>Process ID</label>
        <div class="val">{props.service.pid || '—'}</div>
      </div>
      <div class="detail-item">
        <label>Restart Count</label>
        <div class="val">{props.service.restartCount || 0}</div>
      </div>
      <div class="detail-item">
        <label>Started At</label>
        <div class="val">{formatStartedAt(props.service.startedAt)}</div>
      </div>
      <div class="detail-item">
        <label>Description</label>
        <div class="val">{props.service.description || '—'}</div>
      </div>
    </div>
  );
};

export default ServiceDetails;
