import { Component, createSignal, createEffect, For } from 'solid-js';
import { settings, updateSettings } from '../stores/services';
import { themes, applyTheme } from '../stores/themes';
import { settingsModalOpen, closeSettingsModal, openThemeCreator } from '../stores/ui';
import { shutdownDaemon } from '../stores/socket';
import Icon from './Icon';

const SettingsModal: Component = () => {
  const [theme, setTheme] = createSignal(settings.theme || 'dark-default');
  const [folderStatePref, setFolderStatePref] = createSignal(settings.folderStatePreference || 'remember');
  const [showFolderCount, setShowFolderCount] = createSignal(settings.showFolderCount !== false);
  const [autoStart, setAutoStart] = createSignal(settings.autoStart || false);
  const [keepServicesOnExit, setKeepServicesOnExit] = createSignal(settings.keepServicesOnExit || false);
  const [showShutdownConfirm, setShowShutdownConfirm] = createSignal(false);

  createEffect(() => {
    setTheme(settings.theme || 'dark-default');
    setFolderStatePref(settings.folderStatePreference || 'remember');
    setShowFolderCount(settings.showFolderCount !== false);
    setAutoStart(settings.autoStart || false);
    setKeepServicesOnExit(settings.keepServicesOnExit || false);
  });

  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      handleClose();
    }
  };

  const handleThemeChange = (value: string) => {
    setTheme(value);
    updateSettings({ theme: value });
    // Apply theme
    const selectedTheme = themes().find(t => t.id === value);
    if (selectedTheme) {
      applyTheme(selectedTheme.colors);
    }
  };

  const setFolderStatePreference = (value: 'remember' | 'collapsed' | 'expanded') => {
    setFolderStatePref(value);
    updateSettings({ folderStatePreference: value });
  };

  const toggleFolderCount = () => {
    const newValue = !showFolderCount();
    setShowFolderCount(newValue);
    updateSettings({ showFolderCount: newValue });
  };

  const toggleAutoStart = () => {
    const newValue = !autoStart();
    setAutoStart(newValue);
    updateSettings({ autoStart: newValue });
  };

  const toggleKeepServicesOnExit = () => {
    const newValue = !keepServicesOnExit();
    setKeepServicesOnExit(newValue);
    updateSettings({ keepServicesOnExit: newValue });
  };

  const handleClose = () => {
    setShowShutdownConfirm(false);
    closeSettingsModal();
  };

  return (
    <div
      class={`modal-backdrop ${settingsModalOpen() ? 'open' : ''}`}
      id="settings-modal"
      onClick={handleBackdropClick}
    >
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">Settings</div>
          <button class="modal-close" onClick={handleClose}>
            <Icon name="X" size={14} />
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Theme</label>
            <select
              class="theme-select"
              id="theme-select"
              onChange={(e) => handleThemeChange(e.currentTarget.value)}
            >
              <For each={themes()}>
                {(themeOption) => (
                  <option value={themeOption.id} selected={theme() === themeOption.id}>
                    {themeOption.name}
                  </option>
                )}
              </For>
            </select>
          </div>

          <div class="form-group">
            <label>Folder Default State</label>
            <div class="sidebar-settings-row">
              <button
                class={`sidebar-opt ${folderStatePref() === 'remember' ? 'active' : ''}`}
                data-value="remember"
                onClick={() => setFolderStatePreference('remember')}
              >
                Remember
              </button>
              <button
                class={`sidebar-opt ${folderStatePref() === 'collapsed' ? 'active' : ''}`}
                data-value="collapsed"
                onClick={() => setFolderStatePreference('collapsed')}
              >
                Collapsed
              </button>
              <button
                class={`sidebar-opt ${folderStatePref() === 'expanded' ? 'active' : ''}`}
                data-value="expanded"
                onClick={() => setFolderStatePreference('expanded')}
              >
                Expanded
              </button>
            </div>
            <div style="font-size: 11px; color: var(--text3); margin-top: 6px;">
              How folders should appear when loaded
            </div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Show folder count</div>
              <div class="toggle-sub">Display number of items in each folder</div>
            </div>
            <div
              class={`toggle ${showFolderCount() ? 'on' : ''}`}
              onClick={toggleFolderCount}
            ></div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">WinCTL Auto-start</div>
              <div class="toggle-sub">Start WinCTL with Windows</div>
            </div>
            <div
              class={`toggle ${autoStart() ? 'on' : ''}`}
              onClick={toggleAutoStart}
            ></div>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">Keep services on exit</div>
              <div class="toggle-sub">When WinCTL stops, leave managed services running</div>
            </div>
            <div
              class={`toggle ${keepServicesOnExit() ? 'on' : ''}`}
              onClick={toggleKeepServicesOnExit}
            ></div>
          </div>

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
            <div style="font-size: 11px; color: var(--text3); margin-bottom: 8px;">Keyboard Shortcuts</div>
            <div style="font-size: 11px; color: var(--text2); display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
              <span><kbd style="background: var(--surface2); padding: 1px 4px; border-radius: 3px;">Ctrl+K</kbd> Search</span>
              <span><kbd style="background: var(--surface2); padding: 1px 4px; border-radius: 3px;">Shift+N</kbd> New service</span>
              <span><kbd style="background: var(--surface2); padding: 1px 4px; border-radius: 3px;">Shift+F</kbd> New folder</span>
              <span><kbd style="background: var(--surface2); padding: 1px 4px; border-radius: 3px;">Esc</kbd> Close modal</span>
              <span><kbd style="background: var(--surface2); padding: 1px 4px; border-radius: 3px;">?</kbd> Settings</span>
            </div>
          </div>

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
            <div style="font-size: 11px; color: var(--text3); margin-bottom: 8px;">Danger Zone</div>
            {!showShutdownConfirm() ? (
              <button
                style="width: 100%; padding: 8px; background: transparent; border: 1px solid var(--red, #f5524a); color: var(--red, #f5524a); border-radius: 6px; cursor: pointer; font-size: 13px;"
                onClick={() => setShowShutdownConfirm(true)}
              >
                Stop WinCTL
              </button>
            ) : (
              <div style="background: var(--surface2); border-radius: 6px; padding: 10px 12px;">
                <div style="font-size: 13px; color: var(--text); margin-bottom: 4px;">Stop WinCTL?</div>
                <div style="font-size: 11px; color: var(--text2); margin-bottom: 10px;">
                  {keepServicesOnExit()
                    ? 'WinCTL will exit. Your services will keep running.'
                    : 'WinCTL will exit and stop all managed services.'}
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                  <span
                    style="font-size: 12px; color: var(--text2); cursor: pointer;"
                    onClick={() => setShowShutdownConfirm(false)}
                  >
                    Cancel
                  </span>
                  <button
                    style="padding: 5px 12px; background: var(--red, #f5524a); border: none; color: #fff; border-radius: 5px; cursor: pointer; font-size: 12px;"
                    onClick={() => shutdownDaemon(keepServicesOnExit())}
                  >
                    Confirm Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" onClick={openThemeCreator}>Create Theme</button>
          <button class="btn-save" onClick={handleClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
