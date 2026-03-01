import { Component, createSignal, For } from 'solid-js';
import { themeCreatorOpen, closeThemeCreator, toast } from '../stores/ui';
import Icon from './Icon';

const COLOR_KEYS = [
  'bg', 'surface', 'surface2', 'border', 'border2', 'text', 'text2', 'text3',
  'green', 'green-dim', 'red', 'red-dim', 'yellow', 'yellow-dim', 'blue', 'blue-dim',
  'accent', 'accent-glow'
];

const DEFAULT_COLORS: Record<string, string> = {
  bg: '#0d0f14',
  surface: '#1a1e28',
  surface2: '#252a38',
  border: '#2e3547',
  border2: '#3a4360',
  text: '#e4e6ed',
  text2: '#a0a5b5',
  text3: '#6b7280',
  green: '#2eea8a',
  'green-dim': 'rgba(46, 234, 138, 0.15)',
  red: '#f05b5b',
  'red-dim': 'rgba(240, 91, 91, 0.15)',
  yellow: '#f0b429',
  'yellow-dim': 'rgba(240, 180, 41, 0.15)',
  blue: '#5e9eff',
  'blue-dim': 'rgba(94, 158, 255, 0.15)',
  accent: '#7b8ff5',
  'accent-glow': 'rgba(123, 143, 245, 0.15)'
};

const ThemeCreator: Component = () => {
  const [themeName, setThemeName] = createSignal('');
  const [author, setAuthor] = createSignal('');
  const [colors, setColors] = createSignal<Record<string, string>>({ ...DEFAULT_COLORS });
  
  const handleBackdropClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      closeThemeCreator();
    }
  };
  
  const handleColorChange = (key: string, value: string) => {
    setColors({ ...colors(), [key]: value });
  };
  
  const handleSave = () => {
    if (!themeName().trim()) {
      alert('Theme name is required');
      return;
    }
    
    const themeData = {
      id: themeName().toLowerCase().replace(/\s+/g, '-'),
      name: themeName().trim(),
      author: author().trim() || 'Unknown',
      builtIn: false,
      colors: colors()
    };
    
    // Save to localStorage for now
    const saved = JSON.parse(localStorage.getItem('customThemes') || '[]');
    saved.push(themeData);
    localStorage.setItem('customThemes', JSON.stringify(saved));
    
    toast('Theme saved!', 'success');
    closeThemeCreator();
  };
  
  const handleCancel = () => {
    closeThemeCreator();
  };

  return (
    <div 
      class={`modal-backdrop ${themeCreatorOpen() ? 'open' : ''}`}
      id="theme-creator-modal"
      onClick={handleBackdropClick}
    >
      <div class="modal" style="max-width: 500px;">
        <div class="modal-header">
          <div class="modal-title">Create Theme</div>
          <button class="modal-close" onClick={handleCancel}>
            <Icon name="X" size={14} />
          </button>
        </div>
        
        <div class="modal-body" id="theme-creator-body">
          <div class="form-group">
            <label>Theme Name *</label>
            <input 
              type="text" 
              class="form-input" 
              id="theme-name" 
              placeholder="My Theme"
              value={themeName()}
              onInput={(e) => setThemeName(e.currentTarget.value)}
            />
          </div>
          
          <div class="form-group">
            <label>Author</label>
            <input 
              type="text" 
              class="form-input" 
              id="theme-author" 
              placeholder="Your name"
              value={author()}
              onInput={(e) => setAuthor(e.currentTarget.value)}
            />
          </div>
          
          <div class="theme-colors-grid">
            <For each={COLOR_KEYS}>
              {(colorKey) => (
                <div class="theme-color-input">
                  <label>{colorKey.replace(/-/g, ' ')}</label>
                  <input 
                    type="color" 
                    value={colors()[colorKey] || DEFAULT_COLORS[colorKey]}
                    onInput={(e) => handleColorChange(colorKey, e.currentTarget.value)}
                  />
                </div>
              )}
            </For>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button class="btn-save" onClick={handleSave}>Save Theme</button>
        </div>
      </div>
    </div>
  );
};

export default ThemeCreator;
