import { create } from 'zustand';
import { apiFetch } from './socket';
import { useServiceStore } from './services';
import type { Settings } from './socket';

export interface Theme {
  id: string;
  name: string;
  author: string;
  built_in: boolean;
  colors: Record<string, string>;
}

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  green: string;
  red: string;
  yellow: string;
  blue: string;
  accent: string;
}

interface ThemeState {
  themes: Theme[];
  currentTheme: string;
  themesLoading: boolean;

  loadThemes: () => Promise<void>;
  selectTheme: (id: string) => Promise<void>;
  getCurrentTheme: () => Theme | undefined;
  getSortedThemes: () => Theme[];
  saveCustomTheme: (name: string, author: string, colors: Partial<ThemeColors>) => Promise<boolean>;
  deleteCustomTheme: (id: string) => Promise<boolean>;
  getDefaultColors: () => Partial<ThemeColors>;
}

const COLOR_KEYS: (keyof ThemeColors)[] = [
  'bg', 'surface', 'surface2', 'border', 'text', 'text2',
  'green', 'red', 'yellow', 'blue', 'accent',
];

export { COLOR_KEYS };

// ── CSS application helpers ─────────────────────────────────────────────────

function addAlpha(color: string, alpha: string): string {
  if (color.startsWith('#')) {
    const hexAlpha = alpha.padStart(2, '0');
    return color + hexAlpha;
  }
  return color;
}

export function applyTheme(colors: Record<string, string>): void {
  const root = document.documentElement;
  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
  if (!colors['border2']) root.style.setProperty('--border2', colors['border'] || '#2e3547');
  if (!colors['text3']) root.style.setProperty('--text3', colors['text2'] || '#505870');
  if (!colors['green-dim']) root.style.setProperty('--green-dim', addAlpha(colors['green'] || '#22d47a', '33'));
  if (!colors['red-dim']) root.style.setProperty('--red-dim', addAlpha(colors['red'] || '#f5524a', '33'));
  if (!colors['yellow-dim']) root.style.setProperty('--yellow-dim', addAlpha(colors['yellow'] || '#f0b429', '33'));
  if (!colors['blue-dim']) root.style.setProperty('--blue-dim', addAlpha(colors['blue'] || '#4d9de0', '33'));
  if (!colors['accent-glow']) root.style.setProperty('--accent-glow', addAlpha(colors['accent'] || '#5e72e4', '4d'));
}

export function applyFont(fontName: string | null | undefined): void {
  const root = document.documentElement;
  if (fontName) {
    root.style.setProperty('--font-sans', `'${fontName}', system-ui, sans-serif`);
    root.style.setProperty('--font-mono', `'${fontName}', monospace`);
  } else {
    root.style.removeProperty('--font-sans');
    root.style.removeProperty('--font-mono');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themes: [],
  currentTheme: 'winctl',
  themesLoading: false,

  loadThemes: async () => {
    set({ themesLoading: true });
    try {
      const data = await apiFetch<Theme[]>('/api/themes');
      set({ themes: data });

      const settings = useServiceStore.getState().settings;
      const themeId = settings.theme || localStorage.getItem('winctl_theme_cache');
      
      if (themeId) {
        set({ currentTheme: themeId });
        const theme = data.find((t) => t.id === themeId);
        if (theme) {
          applyTheme(theme.colors);
          localStorage.setItem('winctl_theme_cache', theme.id);
        }
      }
      
      const font = settings.customFont || localStorage.getItem('winctl_font_cache');
      if (font) {
        applyFont(font);
        localStorage.setItem('winctl_font_cache', font);
      }
    } catch (e) {
      console.error('Failed to load themes:', e);
    } finally {
      set({ themesLoading: false });
    }
  },

  selectTheme: async (id) => {
    const theme = get().themes.find((t) => t.id === id);
    if (!theme) return;
    set({ currentTheme: id });
    applyTheme(theme.colors);
    localStorage.setItem('winctl_theme_cache', id);
    await useServiceStore.getState().updateSettings({ theme: id });
  },

  getCurrentTheme: () => get().themes.find((t) => t.id === get().currentTheme),

  getSortedThemes: () =>
    [...get().themes].sort((a, b) => {
      if (a.built_in && !b.built_in) return -1;
      if (!a.built_in && b.built_in) return 1;
      return a.name.localeCompare(b.name);
    }),

  saveCustomTheme: async (name, author, colors) => {
    if (!name.trim()) return false;
    const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fullColors: Record<string, string> = {
      bg: colors.bg || '#0d0f14',
      surface: colors.surface || '#13161d',
      surface2: colors.surface2 || '#1a1e28',
      border: colors.border || '#252a38',
      text: colors.text || '#e8ecf5',
      text2: colors.text2 || '#8892a8',
      green: colors.green || '#22d47a',
      red: colors.red || '#f5524a',
      yellow: colors.yellow || '#f0b429',
      blue: colors.blue || '#4d9de0',
      accent: colors.accent || '#5e72e4',
      border2: colors.border || '#2e3547',
      text3: colors.text2 || '#505870',
    };
    fullColors['green-dim'] = addAlpha(fullColors.green, '33');
    fullColors['red-dim'] = addAlpha(fullColors.red, '33');
    fullColors['yellow-dim'] = addAlpha(fullColors.yellow, '33');
    fullColors['blue-dim'] = addAlpha(fullColors.blue, '33');
    fullColors['accent-glow'] = addAlpha(fullColors.accent, '4d');

    // Try creating with the base ID, and retry with numeric suffix on 409
    let id = baseId;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await apiFetch<any>('/api/themes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name, author: author || 'User', colors: fullColors }),
        });
        await get().loadThemes();
        await get().selectTheme(id);
        return true;
      } catch (e: any) {
        // If 409 Conflict, try with a numeric suffix
        if (e?.status === 409 && attempt < 4) {
          id = `${baseId}-${attempt + 2}`;
          continue;
        }
        return false;
      }
    }
    return false;
  },

  deleteCustomTheme: async (id) => {
    const theme = get().themes.find((t) => t.id === id);
    if (!theme || theme.built_in) return false;
    try {
      await apiFetch<void>(`/api/themes/${id}`, { method: 'DELETE' });
      await get().loadThemes();
      if (get().currentTheme === id) {
        await get().selectTheme('winctl');
      }
      return true;
    } catch {
      return false;
    }
  },

  getDefaultColors: () => {
    const defaultTheme = get().themes.find((t) => t.id === 'winctl');
    if (!defaultTheme) {
      return {
        bg: '#0d0f14', surface: '#13161d', surface2: '#1a1e28', border: '#252a38',
        text: '#e8ecf5', text2: '#8892a8', green: '#22d47a', red: '#f5524a',
        yellow: '#f0b429', blue: '#4d9de0', accent: '#5e72e4',
      };
    }
    return {
      bg: defaultTheme.colors.bg, surface: defaultTheme.colors.surface,
      surface2: defaultTheme.colors.surface2, border: defaultTheme.colors.border,
      text: defaultTheme.colors.text, text2: defaultTheme.colors.text2,
      green: defaultTheme.colors.green, red: defaultTheme.colors.red,
      yellow: defaultTheme.colors.yellow, blue: defaultTheme.colors.blue,
      accent: defaultTheme.colors.accent,
    };
  },
}));
