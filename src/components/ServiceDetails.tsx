import React from 'react';
import type { Service, Folder } from '../stores/services';

interface ServiceDetailsProps {
  service: Service;
  folders: Folder[];
}

const ServiceDetails: React.FC<ServiceDetailsProps> = ({ service, folders }) => {
  const folder = service.folderId ? folders.find((f) => f.id === service.folderId) : null;

  return (
    <div className="detail-grid">
      <div className="detail-item">
        <label>Command</label>
        <div className="val">{service.command}</div>
      </div>
      <div className="detail-item">
        <label>Arguments</label>
        <div className="val">{service.args || '—'}</div>
      </div>
      <div className="detail-item">
        <label>Working Dir</label>
        <div className="val">{service.cwd || '(default)'}</div>
      </div>
      <div className="detail-item">
        <label>Port</label>
        <div className="val">
          {service.port ? (
            <a className="port-link" href={`http://localhost:${service.port}`} target="_blank" rel="noreferrer">
              :{service.port} ↗
            </a>
          ) : '—'}
        </div>
      </div>
      <div className="detail-item">
        <label>Folder</label>
        <div className="val">{folder ? folder.name : '—'}</div>
      </div>
      <div className="detail-item">
        <label>Auto-restart</label>
        <div className="val">{service.autoRestart ? '✓ Enabled' : '✕ Disabled'}</div>
      </div>
      <div className="detail-item">
        <label>Process ID</label>
        <div className="val">{service.pid || '—'}</div>
      </div>
      <div className="detail-item">
        <label>Restart Count</label>
        <div className="val">{service.restartCount ?? 0}</div>
      </div>
      <div className="detail-item">
        <label>Started At</label>
        <div className="val">{service.startedAt || '—'}</div>
      </div>
      <div className="detail-item">
        <label>Description</label>
        <div className="val">{service.description || '—'}</div>
      </div>
    </div>
  );
};

export default ServiceDetails;
