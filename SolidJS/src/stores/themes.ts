import { createSignal } from 'solid-js';
import { settings, updateSettings } from './services';

// Theme interface
export interface Theme {
  id: string;
  name: string;
  author: string;
  builtIn: boolean;
  colors: Record<string, string>;
}

// Theme colors that can be customized
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

// Default color keys
const COLOR_KEYS: (keyof ThemeColors)[] = [
  'bg', 'surface', 'surface2', 'border', 'text', 'text2',
  'green', 'red', 'yellow', 'blue', 'accent'
];

// Themes state
const [themes, setThemes] = createSignal<Theme[]>([]);
const [currentTheme, setCurrentTheme] = createSignal<string>('dark-default');
const [themesLoading, setThemesLoading] = createSignal(false);

/**
 * Load themes from the server
 */
export async function loadThemes(): Promise<void> {
  setThemesLoading(true);

  try {
    const res = await fetch('/api/themes');
    if (!res.ok) throw new Error('Failed to fetch themes');
    const data = await res.json();
    setThemes(data);

    // Apply current theme from settings
    if (settings.theme) {
      setCurrentTheme(settings.theme);
      const theme = data.find((t: Theme) => t.id === settings.theme);
      if (theme) {
        applyTheme(theme.colors);
      }
    }
  } catch (e) {
    console.error('Failed to load themes:', e);
  } finally {
    setThemesLoading(false);
  }
}

/**
 * Apply theme colors to CSS custom properties
 */
export function applyTheme(colors: Record<string, string>): void {
  const root = document.documentElement;

  Object.entries(colors).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  // Derive additional colors if not present
  if (!colors['border2']) {
    root.style.setProperty('--border2', colors['border'] || '#2e3547');
  }
  if (!colors['text3']) {
    root.style.setProperty('--text3', colors['text2'] || '#505870');
  }
  if (!colors['green-dim']) {
    const green = colors['green'] || '#22d47a';
    root.style.setProperty('--green-dim', green + '33');
  }
  if (!colors['red-dim']) {
    const red = colors['red'] || '#f5524a';
    root.style.setProperty('--red-dim', red + '33');
  }
  if (!colors['yellow-dim']) {
    const yellow = colors['yellow'] || '#f0b429';
    root.style.setProperty('--yellow-dim', yellow + '33');
  }
  if (!colors['blue-dim']) {
    const blue = colors['blue'] || '#4d9de0';
    root.style.setProperty('--blue-dim', blue + '33');
  }
  if (!colors['accent-glow']) {
    const accent = colors['accent'] || '#5e72e4';
    root.style.setProperty('--accent-glow', accent + '4d');
  }
}

/**
 * Select a theme and apply it
 */
export async function selectTheme(id: string): Promise<void> {
  const theme = themes().find(t => t.id === id);
  if (!theme) return;

  setCurrentTheme(id);
  applyTheme(theme.colors);

  // Save to settings
  await updateSettings({ theme: id });
}

/**
 * Get the current theme object
 */
export function getCurrentTheme(): Theme | undefined {
  return themes().find(t => t.id === currentTheme());
}

/**
 * Get sorted themes (built-in first, then custom)
 */
export function getSortedThemes(): Theme[] {
  return [...themes()].sort((a, b) => {
    if (a.builtIn && !b.builtIn) return -1;
    if (!a.builtIn && b.builtIn) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Save a custom theme
 */
export async function saveCustomTheme(
  name: string,
  author: string,
  colors: Partial<ThemeColors>
): Promise<boolean> {
  if (!name.trim()) return false;

  // Generate ID from name
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Derive additional colors
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

  // Add derived colors with alpha
  const green = fullColors.green;
  const red = fullColors.red;
  const yellow = fullColors.yellow;
  const blue = fullColors.blue;
  const accent = fullColors.accent;

  fullColors['green-dim'] = green + '33';
  fullColors['red-dim'] = red + '33';
  fullColors['yellow-dim'] = yellow + '33';
  fullColors['blue-dim'] = blue + '33';
  fullColors['accent-glow'] = accent + '4d';

  try {
    const res = await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        author: author || 'User',
        colors: fullColors
      })
    });

    if (res.ok) {
      // Reload themes and select the new one
      await loadThemes();
      await selectTheme(id);
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to save custom theme:', e);
    return false;
  }
}

/**
 * Delete a custom theme
 */
export async function deleteCustomTheme(id: string): Promise<boolean> {
  // Cannot delete built-in themes
  const theme = themes().find(t => t.id === id);
  if (!theme || theme.builtIn) return false;

  try {
    const res = await fetch(`/api/themes/${id}`, { method: 'DELETE' });

    if (res.ok) {
      // Reload themes
      await loadThemes();

      // If deleted theme was active, switch to default
      if (currentTheme() === id) {
        await selectTheme('dark-default');
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to delete custom theme:', e);
    return false;
  }
}

/**
 * Get default colors for theme creator
 */
export function getDefaultColors(): Partial<ThemeColors> {
  const defaultTheme = themes().find(t => t.id === 'dark-default');
  if (!defaultTheme) {
    return {
      bg: '#0d0f14',
      surface: '#13161d',
      surface2: '#1a1e28',
      border: '#252a38',
      text: '#e8ecf5',
      text2: '#8892a8',
      green: '#22d47a',
      red: '#f5524a',
      yellow: '#f0b429',
      blue: '#4d9de0',
      accent: '#5e72e4',
    };
  }

  return {
    bg: defaultTheme.colors.bg,
    surface: defaultTheme.colors.surface,
    surface2: defaultTheme.colors.surface2,
    border: defaultTheme.colors.border,
    text: defaultTheme.colors.text,
    text2: defaultTheme.colors.text2,
    green: defaultTheme.colors.green,
    red: defaultTheme.colors.red,
    yellow: defaultTheme.colors.yellow,
    blue: defaultTheme.colors.blue,
    accent: defaultTheme.colors.accent,
  };
}

/**
 * Convert RGB hex to full hex (helper for theme creator)
 */
export function rgbToHexTheme(color: string): string {
  if (color.startsWith('#')) return color.slice(0, 7);
  return '#000000';
}

export { COLOR_KEYS };
export { themes, currentTheme, themesLoading, setThemes, setCurrentTheme };
