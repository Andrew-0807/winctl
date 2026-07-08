import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';
import Toggle from './Toggle';
import IconPicker from './IconPicker';

const ServiceModal: React.FC = () => {
  const services = useServiceStore((s) => s.services);
  const folders = useServiceStore((s) => s.folders);
  const saveService = useServiceStore((s) => s.saveService);
  const deleteService = useServiceStore((s) => s.deleteService);
  const modalOpen = useUIStore((s) => s.modalOpen);
  const modalEditId = useUIStore((s) => s.modalEditId);
  const closeServiceModal = useUIStore((s) => s.closeServiceModal);

  const [name, setName] = useState('');
  const [port, setPort] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [cwd, setCwd] = useState('');
  const [description, setDescription] = useState('');
  const [autoRestart, setAutoRestart] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [startDelayMins, setStartDelayMins] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!modalEditId;
  const showMinimizedRow = useMemo(() => command.toLowerCase().endsWith('.exe'), [command]);

  useEffect(() => {
    if (modalOpen) {
      setConfirmingDelete(false);
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (modalEditId) {
      const service = services.find((s) => s.id === modalEditId);
      if (service) {
        setName(service.name);
        setPort(service.port || '');
        setCommand(service.command);
        setArgs(service.args || '');
        setCwd(service.cwd || '');
        setDescription(service.description || '');
        setAutoRestart(service.autoRestart);
        setAutoStart(service.autoStart);
        setMinimized(service.minimized);
        setFolderId(service.folderId || null);
        setIcon(service.icon || null);
        setStartDelayMins(service.startDelayMins || 0);
      }
    } else {
      setName(''); setPort(''); setCommand(''); setArgs(''); setCwd('');
      setDescription(''); setAutoRestart(false); setAutoStart(false);
      setMinimized(false); setFolderId(null);
      setIcon(null); setStartDelayMins(0);
    }
  }, [modalEditId, services]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeServiceModal();
  };

  const handleSave = async () => {
    setValidationError('');
    if (!name.trim()) { setValidationError('Service name is required'); return; }
    if (!command.trim()) { setValidationError('Executable / Command is required'); return; }

    const serviceData = {
      id: modalEditId || crypto.randomUUID(),
      name: name.trim(), command: command.trim(), args: args.trim(),
      cwd: cwd.trim(), port: port.trim(), description: description.trim(),
      autoRestart, autoStart, minimized, folderId,
      icon: icon || null, startDelayMins: autoStart ? startDelayMins : 0,
    };

    if (isEditing) await saveService(serviceData, modalEditId!);
    else await saveService(serviceData);
    closeServiceModal();
  };

  const handleDelete = async () => {
    if (modalEditId) {
      await deleteService(modalEditId);
      closeServiceModal();
    }
  };

  return (
    <AnimatePresence>
      {modalOpen && (
        <div className="modal-backdrop open" id="modal" onClick={handleBackdropClick}>
          <motion.div
            className="modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}
          >
            <div className="modal-header">
              <div className="modal-title">{isEditing ? 'Edit Service' : 'New Service'}</div>
              <button className="modal-close" onClick={closeServiceModal}>
                <Icon name="X" size={14} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <div className="form-section-title">General</div>
                <div className="form-row form-row-np">
                  <div className="form-group">
                    <label htmlFor="service-name">Service Name *</label>
                    <input id="service-name" ref={nameInputRef} type="text" className="form-input" placeholder="My App" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="service-port">Port</label>
                    <input id="service-port" type="text" className="form-input mono" placeholder="3000" value={port} onChange={(e) => setPort(e.target.value)} autoComplete="off" />
                  </div>
                </div>

                <div className="form-group full">
                  <label htmlFor="service-command">Executable / Command *</label>
                  <input id="service-command" type="text" className="form-input mono" placeholder="C:\\path\\to\\app.exe  or  node" value={command} onChange={(e) => setCommand(e.target.value)} autoComplete="off" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="service-args">Arguments</label>
                    <input id="service-args" type="text" className="form-input mono" placeholder="server.js --port 3000" value={args} onChange={(e) => setArgs(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="service-cwd">Working Directory</label>
                    <input id="service-cwd" type="text" className="form-input mono" placeholder="C:\\myapp" value={cwd} onChange={(e) => setCwd(e.target.value)} autoComplete="off" />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">Details</div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="service-desc">Description</label>
                    <input id="service-desc" type="text" className="form-input" placeholder="What does this do?" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="service-folder">Folder</label>
                    <select
                      id="service-folder"
                      className="form-input"
                      value={folderId || ''}
                      onChange={(e) => setFolderId(e.target.value || null)}
                    >
                      <option value="">— No Folder —</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <IconPicker value={icon} onChange={setIcon} />
              </div>

              <div className="form-section">
                <div className="form-section-title">Behavior</div>
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Auto-restart on crash</div>
                    <div className="toggle-sub">Exponential backoff up to 30s</div>
                  </div>
                  <Toggle on={autoRestart} onChange={setAutoRestart} label="Auto-restart on crash" />
                </div>

                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Start on WinCTL boot</div>
                    <div className="toggle-sub">Launch automatically when WinCTL starts</div>
                  </div>
                  <Toggle on={autoStart} onChange={setAutoStart} label="Start on WinCTL boot" />
                </div>

                {autoStart && (
                  <div className="form-subfield form-group full">
                    <label htmlFor="service-delay">Delay start by (minutes)</label>
                    <input
                      id="service-delay"
                      type="number"
                      min={0}
                      className="form-input mono"
                      placeholder="0"
                      value={startDelayMins}
                      onChange={(e) => setStartDelayMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      autoComplete="off"
                    />
                    <div className="toggle-sub mt-1">
                      {startDelayMins > 0
                        ? `Starts ${startDelayMins} min after WinCTL launches.`
                        : 'Starts immediately when WinCTL launches.'}
                    </div>
                  </div>
                )}

                {showMinimizedRow && (
                  <div className="toggle-row">
                    <div>
                      <div className="toggle-label">Start minimized</div>
                      <div className="toggle-sub">Launch application minimized to taskbar</div>
                    </div>
                    <Toggle on={minimized} onChange={setMinimized} label="Start minimized" />
                  </div>
                )}
              </div>

              {validationError && (
                <div className="text-red text-xs">{validationError}</div>
              )}
            </div>

            <div className="modal-footer">
              {isEditing && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red">Delete service?</span>
                    <button className="btn-delete" onClick={handleDelete} title="Confirm delete">
                      <Icon name="Check" size={14} />
                    </button>
                    <button className="btn-cancel" onClick={() => setConfirmingDelete(false)} title="Cancel delete">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ) : (
                  <button className="btn-delete" onClick={() => setConfirmingDelete(true)}>
                    <Icon name="Trash" size={14} /> Delete
                  </button>
                )
              )}
              <button className="btn-save ml-auto" onClick={handleSave}>Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ServiceModal;