import { Component, Show, createSignal, createEffect, onMount, createMemo } from 'solid-js';
import { Service, saveService, deleteService, services } from '../stores/services';
import { modalOpen, modalEditId, closeServiceModal } from '../stores/ui';
import Icon from './Icon';

const ServiceModal: Component = () => {
  const [name, setName] = createSignal('');
  const [port, setPort] = createSignal('');
  const [command, setCommand] = createSignal('');
  const [args, setArgs] = createSignal('');
  const [cwd, setCwd] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [autoRestart, setAutoRestart] = createSignal(false);
  const [autoStart, setAutoStart] = createSignal(false);
  const [minimized, setMinimized] = createSignal(false);
  const [folderId, setFolderId] = createSignal<string | null>(null);

  const isEditing = () => !!modalEditId();
  // Reactive: show minimized row only when command ends with .exe
  const showMinimizedRow = createMemo(() => command().toLowerCase().endsWith('.exe'));

  // Load service data when editing
  createEffect(() => {
    if (modalEditId()) {
      const service = services.find((s: Service) => s.id === modalEditId());
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
      }
    } else {
      // Reset form for new service
      setName('');
      setPort('');
      setCommand('');
      setArgs('');
      setCwd('');
      setDescription('');
      setAutoRestart(false);
      setAutoStart(false);
      setMinimized(false);
      setFolderId(null);
    }
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeServiceModal();
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name().trim()) {
      alert('Service name is required');
      return;
    }
    if (!command().trim()) {
      alert('Executable / Command is required');
      return;
    }

    const serviceData = {
      id: modalEditId() || crypto.randomUUID(),
      name: name().trim(),
      command: command().trim(),
      args: args().trim() || '',
      cwd: cwd().trim() || '',
      port: port().trim() || '',
      description: description().trim() || '',
      autoRestart: autoRestart(),
      autoStart: autoStart(),
      minimized: minimized(),
      folderId: folderId(),
      status: 'stopped',
      pid: null,
      startedAt: null,
      restartCount: 0,
      recentLogs: []
    };

    if (isEditing()) {
      await saveService(serviceData, modalEditId()!);
    } else {
      await saveService(serviceData);
    }

    closeServiceModal();
  };

  const handleDelete = async () => {
    if (modalEditId() && confirm('Are you sure you want to delete this service?')) {
      await deleteService(modalEditId()!);
      closeServiceModal();
    }
  };

  const handleCancel = () => {
    closeServiceModal();
  };

  const handleCommandChange = (value: string) => {
    setCommand(value);
    // showMinimizedRow memo updates automatically when command() changes
  };

  return (
    <div
      class={`modal-backdrop ${modalOpen() ? 'open' : ''}`}
      id="modal"
      onClick={handleBackdropClick}
    >
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title" id="modal-title">
            {isEditing() ? 'Edit Service' : 'New Service'}
          </div>
          <button class="modal-close" onClick={handleCancel}>
            <Icon name="X" size={14} />
          </button>
        </div>

        <div class="modal-body">
          <input type="hidden" id="edit-id" value={modalEditId() || ''} />

          <div class="form-row">
            <div class="form-group">
              <label>Service Name *</label>
              <input
                type="text"
                class="form-input"
                id="f-name"
                placeholder="My App"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label>Port</label>
              <input
                type="text"
                class="form-input mono"
                id="f-port"
                placeholder="3000"
                value={port()}
                onInput={(e) => setPort(e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="form-group full">
            <label>Executable / Command *</label>
            <input
              type="text"
              class="form-input mono"
              id="f-command"
              placeholder="C:\path\to\app.exe  or  node"
              value={command()}
              onInput={(e) => handleCommandChange(e.currentTarget.value)}
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Arguments</label>
              <input
                type="text"
                class="form-input mono"
                id="f-args"
                placeholder="server.js --port 3000"
                value={args()}
                onInput={(e) => setArgs(e.currentTarget.value)}
              />
            </div>
            <div class="form-group">
              <label>Working Directory</label>
              <input
                type="text"
                class="form-input mono"
                id="f-cwd"
                placeholder="C:\myapp"
                value={cwd()}
                onInput={(e) => setCwd(e.currentTarget.value)}
              />
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <input
              type="text"
              class="form-input"
              id="f-desc"
              placeholder="What does this do?"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
            />
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Auto-restart on crash</div>
              <div class="toggle-sub">Exponential backoff up to 30s</div>
            </div>
            <div
              class={`toggle ${autoRestart() ? 'on' : ''}`}
              id="toggle-autorestart"
              onClick={() => setAutoRestart(!autoRestart())}
            ></div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Start on WinCTL boot</div>
              <div class="toggle-sub">Launch automatically when WinCTL starts</div>
            </div>
            <div
              class={`toggle ${autoStart() ? 'on' : ''}`}
              id="toggle-autostart"
              onClick={() => setAutoStart(!autoStart())}
            ></div>
          </div>

          <Show when={showMinimizedRow()}>
            <div class="toggle-row" id="minimized-row">
              <div>
                <div class="toggle-label">Start minimized</div>
                <div class="toggle-sub">Launch application minimized to taskbar</div>
              </div>
              <div
                class={`toggle ${minimized() ? 'on' : ''}`}
                id="toggle-minimized"
                onClick={() => setMinimized(!minimized())}
              ></div>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <Show when={isEditing()}>
            <button class="btn-delete" id="service-delete-btn" onClick={handleDelete}>
              <Icon name="Trash" size={14} />
              Delete
            </button>
          </Show>
          <div class="modal-footer-right">
            <button class="btn-cancel" onClick={handleCancel}>Cancel</button>
            <button class="btn-save" onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceModal;
