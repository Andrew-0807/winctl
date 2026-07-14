import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useUIStore } from '../stores/ui';
import Icon from './Icon';
import Toggle from './Toggle';
import IconPicker from './IconPicker';
import ServiceIcon from './ServiceIcon';
import { apiFetch, InstalledApp } from '../stores/socket';

const MODIFIER_CODES = [
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
];

// Display-only prettifier for the stored accelerator ("Control+Numpad2" -> "Ctrl + Num 2").
const prettyHotkey = (acc: string) =>
  acc
    .split('+')
    .map((p) =>
      p
        .replace(/^Key/, '')
        .replace(/^Digit/, '')
        .replace('Control', 'Ctrl')
        .replace('Super', 'Win')
        .replace('Numpad', 'Num ')
    )
    .join(' + ');

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
  const [hotkey, setHotkey] = useState('');
  const [hotkeyAction, setHotkeyAction] = useState('focus');
  const [hotkeyWhenActive, setHotkeyWhenActive] = useState('none');
  const [hotkeyMatchExe, setHotkeyMatchExe] = useState('');
  const [hotkeyHint, setHotkeyHint] = useState('');
  const [validationError, setValidationError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Run fn on Enter/Space for role="button" divs (installed-app row, icon-picker header).
  const clickOnKey = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

  const isEditing = !!modalEditId;
  const showMinimizedRow = useMemo(() => command.toLowerCase().endsWith('.exe'), [command]);

  const [showInstalledApps, setShowInstalledApps] = useState(false);
  const [iconPickerExpanded, setIconPickerExpanded] = useState(false);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState('');

  // Fetch installed apps when toggle is enabled
  useEffect(() => {
    if (showInstalledApps && installedApps.length === 0) {
      setLoadingApps(true);
      setAppsError('');
      apiFetch<InstalledApp[]>('/api/system/installed-apps')
        .then((data) => {
          setInstalledApps(data);
          setLoadingApps(false);
        })
        .catch((err) => {
          console.error(err);
          setAppsError('Failed to load installed apps');
          setLoadingApps(false);
        });
    }
  }, [showInstalledApps, installedApps.length]);

  // Memoized search filtering
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return installedApps;
    const q = searchQuery.toLowerCase();
    return installedApps.filter(
      (app) =>
        app.name.toLowerCase().includes(q) || app.path.toLowerCase().includes(q)
    );
  }, [installedApps, searchQuery]);

  useEffect(() => {
    if (modalOpen) {
      setConfirmingDelete(false);
      setIconPickerExpanded(false);
      setShowInstalledApps(false);
      setSearchQuery('');
      // Restore focus to whatever opened the modal (a card/toolbar button) on close.
      const prevFocus = document.activeElement as HTMLElement | null;
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
      return () => prevFocus?.focus?.();
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeServiceModal(); return; }
      // Focus trap: keep Tab cycling inside the modal so it can't reach the page behind.
      if (e.key === 'Tab' && modalRef.current) {
        const f = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (f.length === 0) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, closeServiceModal]);

  // Snapshot the service into the form once, when the modal opens or its edit
  // target changes. Intentionally NOT keyed on `services`: that array's ref
  // changes on every background "update" broadcast, and re-running here would
  // wipe whatever the user is typing/picking (new service or icon change).
  useEffect(() => {
    if (!modalOpen) return;
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
        setHotkey(service.hotkey || '');
        setHotkeyAction(service.hotkeyAction || 'focus');
        setHotkeyWhenActive(service.hotkeyWhenActive || 'none');
        setHotkeyMatchExe(service.hotkeyMatchExe || '');
      }
    } else {
      setName(''); setPort(''); setCommand(''); setArgs(''); setCwd('');
      setDescription(''); setAutoRestart(false); setAutoStart(false);
      setMinimized(false); setFolderId(null);
      setIcon(null); setStartDelayMins(0);
      setHotkey(''); setHotkeyAction('focus'); setHotkeyWhenActive('none'); setHotkeyMatchExe('');
    }
    setHotkeyHint('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalEditId, modalOpen]);

  // ponytail: only close when the press *starts* on the backdrop, so a drag-select
  // that starts in an input and releases on the backdrop doesn't close the modal.
  const pressedBackdrop = useRef(false);
  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    pressedBackdrop.current = (e.target as HTMLElement).classList.contains('modal-backdrop');
  };
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (pressedBackdrop.current && (e.target as HTMLElement).classList.contains('modal-backdrop')) closeServiceModal();
  };

  // Capture a shortcut from the raw keydown: modifiers + event.code (which are the
  // same UIEvents names the Rust side parses, e.g. "KeyE", "Numpad2", "F9").
  const captureHotkey = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') { setHotkey(''); setHotkeyHint(''); return; }
    if (MODIFIER_CODES.includes(e.code)) return;
    const mods: string[] = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Super');
    const isFn = /^F\d{1,2}$/.test(e.code);
    if (mods.length === 0 && !isFn) {
      setHotkeyHint('Add a modifier (Ctrl/Alt/Win). Bare keys would fire everywhere — only F-keys are safe alone.');
      return;
    }
    setHotkey([...mods, e.code].join('+'));
    setHotkeyHint('');
  };

  const handleSave = async () => {
    if (saving) return;
    setValidationError('');
    if (!name.trim()) { setValidationError('Service name is required'); return; }
    if (!command.trim()) { setValidationError('Executable / Command is required'); return; }

    const serviceData = {
      // id is ignored by the backend on create (it assigns a base-36 id); only
      // meaningful when editing. Avoids crypto.randomUUID, which throws in a
      // non-secure context (remote access over http by IP).
      id: modalEditId || '',
      name: name.trim(), command: command.trim(), args: args.trim(),
      cwd: cwd.trim(), port: port.trim(), description: description.trim(),
      autoRestart, autoStart, minimized, folderId,
      icon: icon || null, startDelayMins: autoStart ? startDelayMins : 0,
      hotkey: hotkey || null, hotkeyAction, hotkeyWhenActive,
      hotkeyMatchExe: hotkeyMatchExe.trim() || null,
    };

    setSaving(true);
    try {
      await saveService(serviceData, modalEditId || undefined);
      closeServiceModal();
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modalEditId && !saving) {
      setSaving(true);
      try {
        await deleteService(modalEditId);
        closeServiceModal();
      } catch (e) {
        setValidationError(e instanceof Error ? e.message : 'Failed to delete service');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <AnimatePresence>
      {modalOpen && (
        <div className="modal-backdrop open" id="modal" onMouseDown={handleBackdropMouseDown} onClick={handleBackdropClick}>
          <motion.div
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}
          >
            <div className="modal-header">
              <div className="modal-title" id="modal-title">{isEditing ? 'Edit Service' : 'New Service'}</div>
              <button className="modal-close" onClick={closeServiceModal} aria-label="Close">
                <Icon name="X" size={14} />
              </button>
            </div>

            <div className="modal-body modal-grid-layout">
              <div className="modal-col-left">
                <div className="form-section">
                  <div className="form-section-title">General</div>
                  <div className="form-row form-row-np">
                    <div className="form-group">
                      <label htmlFor="service-name">Service Name *</label>
                      <input id="service-name" ref={nameInputRef} type="text" className="form-input" placeholder="My App" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" maxLength={100} required aria-required="true" aria-invalid={!!validationError && !name.trim()} disabled={saving} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="service-port">Port</label>
                      <input id="service-port" type="text" className="form-input mono" placeholder="3000" value={port} onChange={(e) => setPort(e.target.value)} autoComplete="off" maxLength={10} disabled={saving} />
                    </div>
                  </div>

                  <div className="form-group full">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label htmlFor="service-command" style={{ margin: 0 }}>Executable / Command *</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 500 }}>Select from Apps</span>
                        <Toggle on={showInstalledApps} onChange={setShowInstalledApps} label="Select from Installed Apps" disabled={saving} />
                      </div>
                    </div>
                    
                    {showInstalledApps ? (
                      <div className="installed-apps-container" style={{ marginTop: 0 }}>
                        <input
                          type="text"
                          className="installed-apps-search"
                          placeholder="Search installed apps..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          autoComplete="off"
                          autoFocus
                          disabled={saving}
                        />

                        {loadingApps && (
                          <div className="flex items-center justify-center p-6 gap-2 text-xs" style={{ color: 'var(--text3)' }}>
                            <div className="spinner-pulse" />
                            <span>Scanning applications...</span>
                          </div>
                        )}

                        {appsError && (
                          <div className="text-red text-xs p-2 text-center">{appsError}</div>
                        )}

                        {!loadingApps && !appsError && (
                          <div className="installed-apps-list">
                            {filteredApps.length === 0 ? (
                              <div className="text-xs text-center p-6" style={{ color: 'var(--text3)' }}>
                                No matching applications found
                              </div>
                            ) : (
                              filteredApps.map((app) => {
                                const selectApp = () => {
                                  if (saving) return;
                                  setCommand(app.path);
                                  if (!name.trim()) setName(app.name);
                                  if (app.cwd) setCwd(app.cwd);
                                  if (app.args) setArgs(app.args);
                                  if (app.icon) setIcon(app.icon);
                                  setShowInstalledApps(false);
                                };
                                return (
                                <div
                                  key={app.path + '|||' + app.args}
                                  className="installed-app-item"
                                  role="button"
                                  tabIndex={0}
                                  onClick={selectApp}
                                  onKeyDown={clickOnKey(selectApp)}
                                >
                                  {app.icon ? (
                                    <img src={app.icon} alt="" className="installed-app-icon" />
                                  ) : (
                                    <div className="installed-app-icon-fallback">
                                      <Icon name="Play" size={12} />
                                    </div>
                                  )}
                                  <div className="installed-app-info">
                                    <span className="installed-app-name">{app.name}</span>
                                    <span className="installed-app-path" title={app.path}>{app.path}</span>
                                  </div>
                                </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input id="service-command" type="text" className="form-input mono" placeholder="C:\\path\\to\\app.exe  or  node" value={command} onChange={(e) => setCommand(e.target.value)} autoComplete="off" maxLength={260} required aria-required="true" aria-invalid={!!validationError && !command.trim()} disabled={saving} />
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="service-args">Arguments</label>
                      <input id="service-args" type="text" className="form-input mono" placeholder="server.js --port 3000" value={args} onChange={(e) => setArgs(e.target.value)} autoComplete="off" maxLength={1000} disabled={saving} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="service-cwd">Working Directory</label>
                      <input id="service-cwd" type="text" className="form-input mono" placeholder="C:\\myapp" value={cwd} onChange={(e) => setCwd(e.target.value)} autoComplete="off" maxLength={260} disabled={saving} />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <div className="form-section-title">Details</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="service-desc">Description</label>
                      <input id="service-desc" type="text" className="form-input" placeholder="What does this do?" value={description} onChange={(e) => setDescription(e.target.value)} autoComplete="off" maxLength={200} disabled={saving} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="service-folder">Folder</label>
                      <select
                        id="service-folder"
                        className="form-input"
                        value={folderId || ''}
                        onChange={(e) => setFolderId(e.target.value || null)}
                        disabled={saving}
                      >
                        <option value="">— No Folder —</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-col-right">
                <div className="form-section">
                  <div className="form-section-title">Behavior</div>
                  <div className="toggle-row">
                    <div>
                      <div className="toggle-label">Auto-restart on crash</div>
                      <div className="toggle-sub">Exponential backoff up to 30s</div>
                    </div>
                    <Toggle on={autoRestart} onChange={setAutoRestart} label="Auto-restart on crash" disabled={saving} />
                  </div>

                  <div className="toggle-row">
                    <div>
                      <div className="toggle-label">Start on WinCTL boot</div>
                      <div className="toggle-sub">Launch automatically when WinCTL starts</div>
                    </div>
                    <Toggle on={autoStart} onChange={setAutoStart} label="Start on WinCTL boot" disabled={saving} />
                  </div>

                  {autoStart && (
                    <div className="form-subfield form-group full">
                      <label htmlFor="service-delay">Delay start by (minutes)</label>
                      <input
                        id="service-delay"
                        type="number"
                        min={0}
                        max={9999}
                        className="form-input mono"
                        placeholder="0"
                        value={startDelayMins}
                        onChange={(e) => setStartDelayMins(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        autoComplete="off"
                        disabled={saving}
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
                      <Toggle on={minimized} onChange={setMinimized} label="Start minimized" disabled={saving} />
                    </div>
                  )}
                </div>

                <div className="form-section">
                  <div className="form-section-title">Hotkey</div>
                  <div className="toggle-sub mb-2">Global shortcut to launch, focus, or close this app. Runs as WinCTL, not AutoHotkey.</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="service-hotkey">Shortcut</label>
                      <input
                        id="service-hotkey"
                        type="text"
                        readOnly
                        className="form-input mono"
                        placeholder="Click, then press keys"
                        value={hotkey ? prettyHotkey(hotkey) : ''}
                        onKeyDown={captureHotkey}
                        autoComplete="off"
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="service-hotkey-action">Action</label>
                      <select
                        id="service-hotkey-action"
                        className="form-input"
                        value={hotkeyAction}
                        onChange={(e) => setHotkeyAction(e.target.value)}
                        disabled={saving}
                      >
                        <option value="focus">Launch / focus</option>
                        <option value="focus_center">Launch / focus + center window</option>
                        <option value="close">Close / kill (always)</option>
                      </select>
                    </div>
                  </div>

                  {hotkey && hotkeyAction !== 'close' && (
                    <div className="form-group full">
                      <label htmlFor="service-hotkey-active">When already focused</label>
                      <select
                        id="service-hotkey-active"
                        className="form-input"
                        value={hotkeyWhenActive}
                        onChange={(e) => setHotkeyWhenActive(e.target.value)}
                        disabled={saving}
                      >
                        <option value="none">Do nothing</option>
                        <option value="minimize">Minimize it</option>
                        <option value="close">Close / kill it</option>
                      </select>
                      <div className="toggle-sub mt-1">
                        Second press, while this app is the foreground window.
                      </div>
                    </div>
                  )}

                  {hotkey && (
                    <div className="form-group full">
                      <label htmlFor="service-hotkey-exe">Window process (optional)</label>
                      <input
                        id="service-hotkey-exe"
                        type="text"
                        className="form-input mono"
                        placeholder="e.g. SteelSeriesGGClient.exe — only if it differs from the command"
                        value={hotkeyMatchExe}
                        onChange={(e) => setHotkeyMatchExe(e.target.value)}
                        autoComplete="off"
                        maxLength={100}
                        disabled={saving}
                      />
                    </div>
                  )}

                  {hotkey && (
                    <button className="btn-cancel mt-1" onClick={() => { setHotkey(''); setHotkeyHint(''); }} disabled={saving}>
                      Clear hotkey
                    </button>
                  )}
                  {hotkeyHint && <div className="toggle-sub text-yellow mt-1">{hotkeyHint}</div>}
                </div>

                <div className="form-section">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={iconPickerExpanded}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      padding: '10px 0 4px 0',
                      marginTop: '12px'
                    }}
                    onClick={() => !saving && setIconPickerExpanded(!iconPickerExpanded)}
                    onKeyDown={clickOnKey(() => !saving && setIconPickerExpanded(!iconPickerExpanded))}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={iconPickerExpanded ? 'ChevronDown' : 'ChevronRight'} size={14} />
                      <span className="toggle-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>Service Icon</span>
                    </div>
                    <ServiceIcon icon={icon} size={14} />
                  </div>

                  <AnimatePresence>
                    {iconPickerExpanded && !saving && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <IconPicker value={icon} onChange={setIcon} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {validationError && (
                <div className="text-red text-xs" role="alert">{validationError}</div>
              )}
            </div>

            <div className="modal-footer">
              {isEditing && (
                confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red">Delete service?</span>
                    <button className="btn-delete" onClick={handleDelete} title="Confirm delete" disabled={saving}>
                      <Icon name="Check" size={14} />
                    </button>
                    <button className="btn-cancel" onClick={() => setConfirmingDelete(false)} title="Cancel delete" disabled={saving}>
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ) : (
                  <button className="btn-delete" onClick={() => setConfirmingDelete(true)} disabled={saving}>
                    <Icon name="Trash" size={14} /> Delete
                  </button>
                )
              )}
              <button className="btn-save ml-auto" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ServiceModal;