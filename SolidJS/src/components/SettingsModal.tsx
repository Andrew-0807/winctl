import { Component, createSignal, createEffect, For } from 'solid-js';
import { settings, updateSettings } from '../stores/services';
import { themes, applyTheme } from '../stores/themes';
import { settingsModalOpen, closeSettingsModal, openThemeCreator } from '../stores/ui';
import Icon from './Icon';

const SettingsModal: Component = () => {
  const [theme, setTheme] = createSignal(settings.theme || 'dark-default');
  const [folderStatePref, setFolderStatePref] = createSignal(settings.folderStatePreference || 'remember');
  const [showFolderCount, setShowFolderCount] = createSignal(settings.showFolderCount !== false);
  const [autoStart, setAutoStart] = createSignal(settings.autoStart || false);
  
  createEffect(() => {
    setTheme(settings.theme || 'dark-default');
    setFolderStatePref(settings.folderStatePreference || 'remember');
    setShowFolderCount(settings.showFolderCount !== false);
    setAutoStart(settings.autoStart || false);
  });
  
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeSettingsModal();
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

  return (
    <div 
      class={`modal-backdrop ${settingsModalOpen() ? 'open' : ''}`}
      id="settings-modal"
      onClick={handleBackdropClick}
    >
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">Settings</div>
          <button class="modal-close" onClick={closeSettingsModal}>
            <Icon name="X" size={14} />
          </button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>Theme</label>
            <select 
              class="theme-select" 
              id="theme-select"
              value={theme()}
              onChange={(e) => handleThemeChange(e.currentTarget.value)}
            >
              <For each={themes()}>
                {(themeOption) => (
                  <option value={themeOption.id}>{themeOption.name}</option>
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
        </div>
        
        <div class="modal-footer">
          <button class="btn-cancel" onClick={openThemeCreator}>Create Theme</button>
          <button class="btn-save" onClick={closeSettingsModal}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
