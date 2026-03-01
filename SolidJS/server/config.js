"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THEMES = exports.LOG_FILE = exports.THEMES_DIR = exports.SETTINGS_FILE = exports.CONFIG_FILE = exports.CONFIG_DIR = void 0;
exports.ensureConfigDirs = ensureConfigDirs;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.loadSettings = loadSettings;
exports.saveSettings = saveSettings;
exports.migrateSettings = migrateSettings;
exports.loadThemes = loadThemes;
exports.saveCustomTheme = saveCustomTheme;
exports.deleteCustomTheme = deleteCustomTheme;
exports.getThemeById = getThemeById;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
// ── Paths ───────────────────────────────────────────────────────────────────
exports.CONFIG_DIR = path_1.default.join(os_1.default.homedir(), '.winctl');
exports.CONFIG_FILE = path_1.default.join(exports.CONFIG_DIR, 'services.json');
exports.SETTINGS_FILE = path_1.default.join(exports.CONFIG_DIR, 'settings.json');
exports.THEMES_DIR = path_1.default.join(exports.CONFIG_DIR, 'themes');
exports.LOG_FILE = path_1.default.join(exports.CONFIG_DIR, 'winctl.log');
// ── Cache ───────────────────────────────────────────────────────────────────
let configCache = { services: [], folders: [] };
let configCacheTime = 0;
let settingsCache = null;
let settingsCacheTime = 0;
const CONFIG_CACHE_TTL = 5000; // 5 seconds
const SETTINGS_CACHE_TTL = 5000; // 5 seconds
// ── Built-in themes ─────────────────────────────────────────────────────────
exports.DEFAULT_THEMES = {
    'dark-default': {
        name: 'Dark Default',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#0d0f14',
            surface: '#13161d',
            surface2: '#1a1e28',
            border: '#252a38',
            border2: '#2e3547',
            text: '#e8ecf5',
            text2: '#8892a8',
            text3: '#505870',
            green: '#22d47a',
            'green-dim': '#1a4a32',
            red: '#f5524a',
            'red-dim': '#3d1f1d',
            yellow: '#f0b429',
            'yellow-dim': '#3d2f10',
            blue: '#4d9de0',
            'blue-dim': '#1a2d47',
            accent: '#5e72e4',
            'accent-glow': 'rgba(94,114,228,0.3)'
        }
    },
    'light-default': {
        name: 'Light Default',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#f8f9fc',
            surface: '#ffffff',
            surface2: '#f0f2f5',
            border: '#e2e5eb',
            border2: '#d1d5dc',
            text: '#1a1e28',
            text2: '#5a6072',
            text3: '#949cad',
            green: '#1db954',
            'green-dim': '#d4f5e0',
            red: '#e53935',
            'red-dim': '#ffe5e5',
            yellow: '#ff9800',
            'yellow-dim': '#fff4e0',
            blue: '#2196f3',
            'blue-dim': '#e3f2fd',
            accent: '#5e72e4',
            'accent-glow': 'rgba(94,114,228,0.2)'
        }
    },
    'midnight-blue': {
        name: 'Midnight Blue',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#0a0e1a',
            surface: '#0d1224',
            surface2: '#131929',
            border: '#1e2a45',
            border2: '#263352',
            text: '#d0d8f0',
            text2: '#7a8ab0',
            text3: '#3d4d70',
            green: '#00e5a0',
            'green-dim': '#003d2a',
            red: '#ff4d6a',
            'red-dim': '#3d0f1a',
            yellow: '#ffd166',
            'yellow-dim': '#3d2f00',
            blue: '#4da6ff',
            'blue-dim': '#0a2040',
            accent: '#7b8cde',
            'accent-glow': 'rgba(123,140,222,0.3)'
        }
    },
    'forest-green': {
        name: 'Forest Green',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#0d1a0f',
            surface: '#111f13',
            surface2: '#162619',
            border: '#1e3322',
            border2: '#264030',
            text: '#d0e8d4',
            text2: '#7aaa82',
            text3: '#3d6645',
            green: '#4caf50',
            'green-dim': '#1a3d1c',
            red: '#ef5350',
            'red-dim': '#3d1a1a',
            yellow: '#ffca28',
            'yellow-dim': '#3d3000',
            blue: '#42a5f5',
            'blue-dim': '#0a2040',
            accent: '#66bb6a',
            'accent-glow': 'rgba(102,187,106,0.3)'
        }
    },
    'sunset-warm': {
        name: 'Sunset Warm',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#1a0f0a',
            surface: '#241510',
            surface2: '#2e1c14',
            border: '#3d2518',
            border2: '#4d2e1e',
            text: '#f0e0d0',
            text2: '#b08060',
            text3: '#6d4a30',
            green: '#8bc34a',
            'green-dim': '#2a3d10',
            red: '#ff5722',
            'red-dim': '#3d1a0a',
            yellow: '#ffc107',
            'yellow-dim': '#3d2d00',
            blue: '#29b6f6',
            'blue-dim': '#0a2030',
            accent: '#ff7043',
            'accent-glow': 'rgba(255,112,67,0.3)'
        }
    },
    'nord': {
        name: 'Nord',
        author: 'Arctic Ice Studio',
        builtIn: true,
        colors: {
            bg: '#2e3440',
            surface: '#242933',
            surface2: '#3b4252',
            border: '#4c566a',
            border2: '#576079',
            text: '#eceff4',
            text2: '#d8dee9',
            text3: '#7b88a1',
            green: '#a3be8c',
            'green-dim': '#3e4a3a',
            red: '#bf616a',
            'red-dim': '#4a3a3e',
            yellow: '#ebcb8b',
            'yellow-dim': '#4a453a',
            blue: '#81a1c1',
            'blue-dim': '#3a4a5a',
            accent: '#88c0d0',
            'accent-glow': 'rgba(136,192,208,0.3)'
        }
    },
    'dracula': {
        name: 'Dracula',
        author: 'Dracula Theme',
        builtIn: true,
        colors: {
            bg: '#282a36',
            surface: '#21222c',
            surface2: '#343746',
            border: '#44475a',
            border2: '#6272a4',
            text: '#f8f8f2',
            text2: '#bfbfbf',
            text3: '#6272a4',
            green: '#50fa7b',
            'green-dim': '#2d4a2d',
            red: '#ff5555',
            'red-dim': '#4a2d2d',
            yellow: '#f1fa8c',
            'yellow-dim': '#4a4a2d',
            blue: '#8be9fd',
            'blue-dim': '#2d4a5a',
            accent: '#bd93f9',
            'accent-glow': 'rgba(189,147,249,0.3)'
        }
    },
    'solarized-dark': {
        name: 'Solarized Dark',
        author: 'Ethan Schoonover',
        builtIn: true,
        colors: {
            bg: '#002b36',
            surface: '#073642',
            surface2: '#0d4a5a',
            border: '#1a5a6a',
            border2: '#2a6a7a',
            text: '#fdf6e3',
            text2: '#93a1a1',
            text3: '#586e75',
            green: '#859900',
            'green-dim': '#2a3000',
            red: '#dc322f',
            'red-dim': '#3d1a1a',
            yellow: '#b58900',
            'yellow-dim': '#3d2d00',
            blue: '#268bd2',
            'blue-dim': '#0a2040',
            accent: '#2aa198',
            'accent-glow': 'rgba(42,161,152,0.3)'
        }
    },
    'monokai': {
        name: 'Monokai',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#272822',
            surface: '#1e1f1a',
            surface2: '#3e3d32',
            border: '#49483e',
            border2: '#5a594d',
            text: '#f8f8f2',
            text2: '#b8b8a5',
            text3: '#75715e',
            green: '#a6e22e',
            'green-dim': '#3d4a1a',
            red: '#f92672',
            'red-dim': '#4a1a2d',
            yellow: '#e6db74',
            'yellow-dim': '#4a4620',
            blue: '#66d9ef',
            'blue-dim': '#1a3d4a',
            accent: '#ae81ff',
            'accent-glow': 'rgba(174,129,255,0.3)'
        }
    },
    'cyberpunk': {
        name: 'Cyberpunk',
        author: 'WinCTL',
        builtIn: true,
        colors: {
            bg: '#0a0a0f',
            surface: '#0d0d1a',
            surface2: '#131320',
            border: '#1a1a2e',
            border2: '#22223d',
            text: '#e0e0ff',
            text2: '#8080c0',
            text3: '#404080',
            green: '#00ff9f',
            'green-dim': '#003d2a',
            red: '#ff003c',
            'red-dim': '#3d000f',
            yellow: '#ffe600',
            'yellow-dim': '#3d3600',
            blue: '#00b4ff',
            'blue-dim': '#002a3d',
            accent: '#ff00ff',
            'accent-glow': 'rgba(255,0,255,0.3)'
        }
    },
    'catppuccin-mocha': {
        name: 'Catppuccin Mocha',
        author: 'Catppuccin',
        builtIn: true,
        colors: {
            bg: '#1e1e2e',
            surface: '#181825',
            surface2: '#313244',
            border: '#45475a',
            border2: '#585b70',
            text: '#cdd6f4',
            text2: '#bac2de',
            text3: '#6c7086',
            green: '#a6e3a1',
            'green-dim': '#2d3a2d',
            red: '#f38ba8',
            'red-dim': '#4a2d3a',
            yellow: '#f9e2af',
            'yellow-dim': '#4a4230',
            blue: '#89b4fa',
            'blue-dim': '#2d3a5a',
            accent: '#cba6f7',
            'accent-glow': 'rgba(203,166,247,0.3)'
        }
    },
    'gruvbox-dark': {
        name: 'Gruvbox Dark',
        author: 'morhetz',
        builtIn: true,
        colors: {
            bg: '#282828',
            surface: '#1d2021',
            surface2: '#3c3836',
            border: '#504945',
            border2: '#665c54',
            text: '#ebdbb2',
            text2: '#d5c4a1',
            text3: '#928374',
            green: '#b8bb26',
            'green-dim': '#3d4010',
            red: '#fb4934',
            'red-dim': '#4a1a10',
            yellow: '#fabd2f',
            'yellow-dim': '#4a3a10',
            blue: '#83a598',
            'blue-dim': '#2a3a38',
            accent: '#d3869b',
            'accent-glow': 'rgba(211,134,155,0.3)'
        }
    },
    'tokyo-night': {
        name: 'Tokyo Night',
        author: 'Enkia',
        builtIn: true,
        colors: {
            bg: '#1a1b26',
            surface: '#16161e',
            surface2: '#24283b',
            border: '#3b4261',
            border2: '#4f5779',
            text: '#c0caf5',
            text2: '#9aa5ce',
            text3: '#565f89',
            green: '#9ece6a',
            'green-dim': '#2d3a2d',
            red: '#f7768e',
            'red-dim': '#4a2d3a',
            yellow: '#e0af68',
            'yellow-dim': '#4a3a2d',
            blue: '#7aa2f7',
            'blue-dim': '#2d3a5a',
            accent: '#bb9af7',
            'accent-glow': 'rgba(187,154,247,0.3)'
        }
    },
    'rose-pine': {
        name: 'Rosé Pine',
        author: 'Rosé Pine',
        builtIn: true,
        colors: {
            bg: '#191724',
            surface: '#1f1d2e',
            surface2: '#26233a',
            border: '#403d52',
            border2: '#524f67',
            text: '#e0def4',
            text2: '#908caa',
            text3: '#6e6a86',
            green: '#31748f',
            'green-dim': '#1a2d35',
            red: '#eb6f92',
            'red-dim': '#4a2d3a',
            yellow: '#f6c177',
            'yellow-dim': '#4a3a20',
            blue: '#9ccfd8',
            'blue-dim': '#2d3a40',
            accent: '#c4a7e7',
            'accent-glow': 'rgba(196,167,231,0.3)'
        }
    },
    'everforest': {
        name: 'Everforest',
        author: 'sainnhe',
        builtIn: true,
        colors: {
            bg: '#2d353b',
            surface: '#272e33',
            surface2: '#3d484d',
            border: '#475258',
            border2: '#56635f',
            text: '#d3c6aa',
            text2: '#9da9a0',
            text3: '#7a8478',
            green: '#a7c080',
            'green-dim': '#3a4a30',
            red: '#e67e80',
            'red-dim': '#4a2d2d',
            yellow: '#dbbc7f',
            'yellow-dim': '#4a3a20',
            blue: '#7fbbb3',
            'blue-dim': '#2d3a40',
            accent: '#d699b6',
            'accent-glow': 'rgba(214,153,182,0.3)'
        }
    }
};
// ── Directory initialization ─────────────────────────────────────────────────
function ensureConfigDirs() {
    if (!fs_1.default.existsSync(exports.CONFIG_DIR)) {
        fs_1.default.mkdirSync(exports.CONFIG_DIR, { recursive: true });
    }
    if (!fs_1.default.existsSync(exports.THEMES_DIR)) {
        fs_1.default.mkdirSync(exports.THEMES_DIR, { recursive: true });
    }
    // Write default themes if they don't exist
    for (const [id, theme] of Object.entries(exports.DEFAULT_THEMES)) {
        const themePath = path_1.default.join(exports.THEMES_DIR, `${id}.json`);
        if (!fs_1.default.existsSync(themePath)) {
            fs_1.default.writeFileSync(themePath, JSON.stringify(theme, null, 2));
        }
    }
}
// ── Config load/save ─────────────────────────────────────────────────────────
function loadConfig() {
    const now = Date.now();
    if (configCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
        return configCache;
    }
    let services = [];
    let folders = [];
    if (fs_1.default.existsSync(exports.CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs_1.default.readFileSync(exports.CONFIG_FILE, 'utf8'));
            services = data.services || [];
            folders = data.folders || [];
        }
        catch { /* ignore */ }
    }
    configCache = { services, folders };
    configCacheTime = now;
    return configCache;
}
function saveConfig(data) {
    fs_1.default.writeFileSync(exports.CONFIG_FILE, JSON.stringify(data, null, 2));
    configCache = data;
    configCacheTime = Date.now();
}
// ── Settings load/save ───────────────────────────────────────────────────────
function loadSettings() {
    const now = Date.now();
    if (settingsCache && (now - settingsCacheTime) < SETTINGS_CACHE_TTL) {
        return settingsCache;
    }
    const defaultSettings = {
        folderStatePreference: 'remember',
        showFolderCount: true,
        autoStart: false
    };
    if (!fs_1.default.existsSync(exports.SETTINGS_FILE)) {
        fs_1.default.writeFileSync(exports.SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
        settingsCache = defaultSettings;
        settingsCacheTime = now;
        return defaultSettings;
    }
    try {
        settingsCache = JSON.parse(fs_1.default.readFileSync(exports.SETTINGS_FILE, 'utf8'));
        settingsCacheTime = now;
        return settingsCache;
    }
    catch {
        settingsCache = defaultSettings;
        settingsCacheTime = now;
        return settingsCache;
    }
}
function saveSettings(settings) {
    fs_1.default.writeFileSync(exports.SETTINGS_FILE, JSON.stringify(settings, null, 2));
    settingsCache = settings;
    settingsCacheTime = Date.now();
}
// ── Settings migration ───────────────────────────────────────────────────────
function migrateSettings() {
    if (!fs_1.default.existsSync(exports.SETTINGS_FILE) && fs_1.default.existsSync(exports.CONFIG_FILE)) {
        try {
            const data = JSON.parse(fs_1.default.readFileSync(exports.CONFIG_FILE, 'utf8'));
            if (data.settings) {
                console.log('Migrating settings from services.json to settings.json');
                saveSettings(data.settings);
            }
        }
        catch (error) {
            console.log('Error migrating settings:', error.message);
        }
    }
}
// ── Theme load/save ──────────────────────────────────────────────────────────
function loadThemes() {
    const themes = [];
    const files = fs_1.default.existsSync(exports.THEMES_DIR) ? fs_1.default.readdirSync(exports.THEMES_DIR) : [];
    for (const file of files) {
        if (file.endsWith('.json')) {
            try {
                const themePath = path_1.default.join(exports.THEMES_DIR, file);
                const theme = JSON.parse(fs_1.default.readFileSync(themePath, 'utf8'));
                themes.push({ id: file.replace('.json', ''), ...theme });
            }
            catch { /* ignore invalid theme files */ }
        }
    }
    return themes;
}
function saveCustomTheme(id, theme) {
    const safeId = id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const themePath = path_1.default.join(exports.THEMES_DIR, `${safeId}.json`);
    fs_1.default.writeFileSync(themePath, JSON.stringify(theme, null, 2));
    return { id: safeId, ...theme };
}
function deleteCustomTheme(id) {
    const themePath = path_1.default.join(exports.THEMES_DIR, `${id}.json`);
    if (!fs_1.default.existsSync(themePath)) {
        return { ok: false, error: 'Theme not found' };
    }
    try {
        const theme = JSON.parse(fs_1.default.readFileSync(themePath, 'utf8'));
        if (theme.builtIn) {
            return { ok: false, error: 'Cannot delete built-in theme' };
        }
    }
    catch { /* ignore */ }
    fs_1.default.unlinkSync(themePath);
    return { ok: true };
}
function getThemeById(id) {
    const themePath = path_1.default.join(exports.THEMES_DIR, `${id}.json`);
    if (!fs_1.default.existsSync(themePath))
        return null;
    try {
        const theme = JSON.parse(fs_1.default.readFileSync(themePath, 'utf8'));
        return { id, ...theme };
    }
    catch {
        return null;
    }
}
