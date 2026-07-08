import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServiceStore } from '../stores/services';
import { useThemeStore, applyTheme, applyFont } from '../stores/themes';
import { useUIStore } from '../stores/ui';
import { shutdownDaemon, getInstalledFonts } from '../stores/socket';
import Icon from './Icon';
import Toggle from './Toggle';

const SettingsModal: React.FC = () => {
  const settings = useServiceStore((s) => s.settings);
  const updateSettings = useServiceStore((s) => s.updateSettings);
  const themes = useThemeStore((s) => s.themes);
  const settingsModalOpen = useUIStore((s) => s.settingsModalOpen);
  const closeSettingsModal = useUIStore((s) => s.closeSettingsModal);
  const openThemeCreator = useUIStore((s) => s.openThemeCreator);
  const confirm = useUIStore((s) => s.confirm);
  const selectTheme = useThemeStore((s) => s.selectTheme);

  // Port input is local-only (string) while settings.port is number|undefined
  const [portInput, setPortInput] = useState(String(settings.port ?? ''));
  const [portError, setPortError] = useState('');
  const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);

  // Font picker
  const [fontSearch, setFontSearch] = useState('');
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [allFonts, setAllFonts] = useState<string[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);

  const filteredFonts = fontSearch
    ? allFonts.filter((f) => f.toLowerCase().includes(fontSearch.toLowerCase()))
    : allFonts;

  const handleFontInputFocus = async () => {
    setFontDropdownOpen(true);
    if (allFonts.length === 0 && !fontsLoading) {
      setFontsLoading(true);
      try { setAllFonts(await getInstalledFonts()); } catch { useUIStore.getState().toast('Failed to load fonts', 'error'); }
      setFontsLoading(false);
    }
  };

  const handleFontSelect = (fontName: string) => {
    setFontSearch('');
    setFontDropdownOpen(false);
    applyFont(fontName);
    updateSettings({ customFont: fontName });
  };

  const handleFontReset = () => {
    setFontSearch('');
    setFontDropdownOpen(false);
    applyFont(null);
    updateSettings({ customFont: null });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node) &&
        fontInputRef.current && !fontInputRef.current.contains(e.target as Node)
      ) {
        setFontDropdownOpen(false);
        setFontSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync port input when settings.port changes from server
  useEffect(() => {
    setPortInput(String(settings.port ?? ''));
  }, [settings.port]);

  const handleThemeChange = (value: string) => {
    selectTheme(value);
  };

  const handlePortChange = (value: string) => {
    setPortInput(value);
    setPortError('');
    if (value === '') {
      updateSettings({ port: undefined });
      return;
    }
    const portNum = parseInt(value, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setPortError('Port must be between 1 and 65535');
      return;
    }
    updateSettings({ port: portNum });
  };

  const handleShutdown = async () => {
    setShuttingDown(true);
    try {
      await shutdownDaemon(settings.keepServicesOnExit);
      setShowShutdownConfirm(false);
      closeSettingsModal();
    } catch {
      // Keep modal open on error - user can retry or cancel
    } finally {
      setShuttingDown(false);
    }
  };

  const handleClose = () => { setShowShutdownConfirm(false); closeSettingsModal(); };

  return (
    <AnimatePresence>
      {settingsModalOpen && (
        <div className="modal-backdrop open" id="settings-modal" onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('modal-backdrop')) handleClose();
        }}>
          <motion.div className="modal" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}>
            <div className="modal-header">
              <div className="modal-title">Settings</div>
              <button className="modal-close" onClick={handleClose}><Icon name="X" size={14} /></button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Theme</label>
                <select className="theme-select" value={settings.theme} onChange={(e) => handleThemeChange(e.target.value)}>
                  {themes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Port</label>
                <input type="number" className="theme-select w-[100px]" placeholder="8888" value={portInput} min={1} max={65535} onChange={(e) => handlePortChange(e.target.value)} />
                {portError ? (
                  <div className="text-[11px] text-red mt-1">{portError}</div>
                ) : (
                  <div className="text-[11px] text-text3 mt-1">Port change requires daemon restart to take effect</div>
                )}
              </div>

              <div className="form-group relative">
                <label>Font</label>
                <div className="relative">
                  <div className="flex gap-1.5 items-center">
                    <input
                      ref={fontInputRef} type="text" className="theme-select"
                      placeholder={settings.customFont || 'Search or select a font…'}
                      value={fontSearch}
                      style={settings.customFont && !fontSearch ? { fontFamily: `'${settings.customFont}', system-ui, sans-serif`, color: 'var(--text)' } : undefined}
                      onChange={(e) => setFontSearch(e.target.value)}
                      onFocus={handleFontInputFocus} autoComplete="off" spellCheck={false}
                    />
                    {settings.customFont && (
                      <button title="Reset to default font" className="shrink-0 py-[5px] px-2 bg-surface2 border border-border rounded-md text-text2 cursor-pointer text-[11px] whitespace-nowrap" onClick={handleFontReset}>
                        Reset
                      </button>
                    )}
                  </div>
                  {fontDropdownOpen && (
                    <div ref={fontDropdownRef} className="absolute top-[calc(100%+4px)] left-0 right-0 bg-surface border border-border2 rounded-lg max-h-[220px] overflow-y-auto z-[300] shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                      {fontsLoading && <div className="py-3 px-3.5 text-xs text-text3">Loading fonts…</div>}
                      {!fontsLoading && filteredFonts.length === 0 && <div className="py-3 px-3.5 text-xs text-text3">No fonts found</div>}
                      {filteredFonts.map((font) => (
                        <div
                          key={font}
                          style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontFamily: `'${font}', system-ui, sans-serif`, color: settings.customFont === font ? 'var(--accent)' : 'var(--text)', background: settings.customFont === font ? 'var(--surface2)' : 'transparent', borderLeft: `2px solid ${settings.customFont === font ? 'var(--accent)' : 'transparent'}` }}
                          onMouseDown={(e) => { e.preventDefault(); handleFontSelect(font); }}
                        >
                          {font}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {settings.customFont && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                    Active font: <span style={{ fontFamily: `'${settings.customFont}', system-ui, sans-serif`, color: 'var(--text2)' }}>{settings.customFont}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Folder Default State</label>
                <div className="sidebar-settings-row">
                  {(['remember', 'collapsed', 'expanded'] as const).map((val) => (
                    <button key={val} className={`sidebar-opt ${settings.folderStatePreference === val ? 'active' : ''}`} onClick={() => updateSettings({ folderStatePreference: val })}>
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-text3 mt-1.5">How folders should appear when loaded</div>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Show folder count</div>
                  <div className="toggle-sub">Display number of items in each folder</div>
                </div>
                <Toggle on={settings.showFolderCount !== false} onChange={(v) => updateSettings({ showFolderCount: v })} label="Show folder count" />
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">WinCTL Auto-start</div>
                  <div className="toggle-sub">Start WinCTL with Windows</div>
                </div>
                <Toggle on={!!settings.autoStart} onChange={(v) => updateSettings({ autoStart: v })} label="WinCTL Auto-start" />
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Keep services on exit</div>
                  <div className="toggle-sub">When WinCTL stops, leave managed services running</div>
                </div>
                <Toggle on={!!settings.keepServicesOnExit} onChange={(v) => updateSettings({ keepServicesOnExit: v })} label="Keep services on exit" />
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">CLI --pass auto-copy</div>
                  <div className="toggle-sub">Automatically copy password to clipboard when running winctl --pass</div>
                </div>
                <Toggle on={settings.clipboardAutoCopy !== false} onChange={(v) => updateSettings({ clipboardAutoCopy: v })} label="CLI --pass auto-copy" />
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[11px] text-text3 mb-2">Keyboard Shortcuts</div>
                <div className="text-[11px] text-text2 grid grid-cols-2 gap-1">
                  <span><kbd className="bg-surface2 py-px px-1 rounded-[3px]">Ctrl+K</kbd> Search</span>
                  <span><kbd className="bg-surface2 py-px px-1 rounded-[3px]">Shift+N</kbd> New service</span>
                  <span><kbd className="bg-surface2 py-px px-1 rounded-[3px]">Shift+F</kbd> New folder</span>
                  <span><kbd className="bg-surface2 py-px px-1 rounded-[3px]">Esc</kbd> Close modal</span>
                  <span><kbd className="bg-surface2 py-px px-1 rounded-[3px]">?</kbd> Settings</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[11px] text-text3 mb-2">Trusted Devices</div>
                {(!settings.trustedDevices || settings.trustedDevices.length === 0) ? (
                  <div className="text-xs text-text2 py-1">No registered devices.</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {settings.trustedDevices.map((dev) => (
                      <div key={dev.id} className="flex justify-between items-center bg-surface2 rounded-md py-1.5 px-2.5">
                        <div>
                          <div className="text-[13px] text-text">{dev.name}</div>
                          <div className="text-[10px] text-text3">
                            Registered {new Date(dev.createdAt * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          className="bg-transparent border-none text-red text-xs cursor-pointer py-1 px-2"
                          onClick={async () => {
                            if (await confirm({
                              title: 'Revoke Device',
                              message: `Revoke trust for device '${dev.name}'?`,
                              confirmLabel: 'Revoke',
                              danger: true,
                            })) {
                              const updated = settings.trustedDevices?.filter((d) => d.id !== dev.id);
                              updateSettings({ trustedDevices: updated });
                            }
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-[11px] text-text3 mb-2">Danger Zone</div>
                {!showShutdownConfirm ? (
                  <button className="w-full p-2 bg-transparent border border-red text-red rounded-md cursor-pointer text-[13px]" onClick={() => setShowShutdownConfirm(true)}>
                    Stop WinCTL
                  </button>
                ) : (
                  <div className="bg-surface2 rounded-md py-2.5 px-3">
                    <div className="text-[13px] text-text mb-1">Stop WinCTL?</div>
                    <div className="text-[11px] text-text2 mb-2.5">
                      {settings.keepServicesOnExit ? 'WinCTL will exit. Your services will keep running.' : 'WinCTL will exit and stop all managed services.'}
                    </div>
                    <div className="flex gap-2 justify-end items-center">
                      <span className="text-xs text-text2 cursor-pointer" onClick={() => setShowShutdownConfirm(false)}>Cancel</span>
                      <button
                        className={`py-[5px] px-3 bg-red border-none text-white rounded-[5px] text-xs ${shuttingDown ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        onClick={handleShutdown}
                        disabled={shuttingDown}
                      >
                        {shuttingDown ? 'Stopping...' : 'Confirm Stop'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-cancel" onClick={openThemeCreator}>Create Theme</button>
              <button className="btn-save" onClick={handleClose}>Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;