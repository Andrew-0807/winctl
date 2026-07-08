import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/ui';
import { useThemeStore } from '../stores/themes';
import Icon from './Icon';

const COLOR_KEYS = [
  'bg', 'surface', 'surface2', 'border', 'border2', 'text', 'text2', 'text3',
  'green', 'green-dim', 'red', 'red-dim', 'yellow', 'yellow-dim', 'blue', 'blue-dim',
  'accent', 'accent-glow',
];

const DEFAULT_COLORS: Record<string, string> = {
  bg: '#0d0f14', surface: '#1a1e28', surface2: '#252a38', border: '#2e3547',
  border2: '#3a4360', text: '#e4e6ed', text2: '#a0a5b5', text3: '#6b7280',
  green: '#2eea8a', 'green-dim': '#0a3d23',
  red: '#f05b5b', 'red-dim': '#3d1717',
  yellow: '#f0b429', 'yellow-dim': '#3d2e0a',
  blue: '#5e9eff', 'blue-dim': '#172a4d',
  accent: '#7b8ff5', 'accent-glow': '#1f2440',
};

const ThemeCreator: React.FC = () => {
  const themeCreatorOpen = useUIStore((s) => s.themeCreatorOpen);
  const closeThemeCreator = useUIStore((s) => s.closeThemeCreator);
  const toast = useUIStore((s) => s.toast);

  const [themeName, setThemeName] = useState('');
  const [author, setAuthor] = useState('');
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS });

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (themeCreatorOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [themeCreatorOpen]);

  const handleColorChange = (key: string, value: string) => {
    setColors({ ...colors, [key]: value });
  };

  const handleSave = async () => {
    if (!themeName.trim()) { toast('Theme name is required', 'error'); return; }
    const success = await useThemeStore.getState().saveCustomTheme(
      themeName, author, colors
    );
    if (success) {
      toast('Theme saved!', 'success');
      closeThemeCreator();
    } else {
      toast('Failed to save theme', 'error');
    }
  };

  return (
    <AnimatePresence>
      {themeCreatorOpen && (
        <div className="modal-backdrop open" id="theme-creator-modal" onClick={(e) => {
          if ((e.target as HTMLElement).classList.contains('modal-backdrop')) closeThemeCreator();
        }}>
          <motion.div className="modal max-w-[500px]" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', duration: 0.38, bounce: 0.12 }}>
            <div className="modal-header">
              <div className="modal-title">Create Theme</div>
              <button className="modal-close" onClick={closeThemeCreator}><Icon name="X" size={14} /></button>
            </div>
            <div className="modal-body" id="theme-creator-body">
              <div className="form-group">
                <label>Theme Name *</label>
                <input ref={nameInputRef} type="text" className="form-input" placeholder="My Theme" value={themeName} onChange={(e) => setThemeName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Author</label>
                <input type="text" className="form-input" placeholder="Your name" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              <div className="theme-colors-grid">
                {COLOR_KEYS.map((key) => (
                  <div key={key} className="theme-color-input">
                    <label>{key.replace(/-/g, ' ')}</label>
                    <input type="color" value={colors[key] || DEFAULT_COLORS[key]} onChange={(e) => handleColorChange(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeThemeCreator}>Cancel</button>
              <button className="btn-save" onClick={handleSave}>Save Theme</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ThemeCreator;
