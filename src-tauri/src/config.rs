use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: String,
    #[serde(default)]
    pub cwd: String,
    #[serde(default)]
    pub port: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub auto_restart: bool,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub minimized: bool,
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub sort_order: i64,
    #[serde(default)]
    pub created_at: Option<String>,
    /// Lucide icon name shown on the card. None/empty = no icon.
    #[serde(default)]
    pub icon: Option<String>,
    /// Minutes to wait after WinCTL boot before auto-starting. 0 = immediate.
    #[serde(default)]
    pub start_delay_mins: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    #[serde(default)]
    pub services: Vec<Service>,
    #[serde(default)]
    pub folders: Vec<Folder>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustedDevice {
    pub id: String,
    pub name: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub folder_state_preference: String,
    #[serde(default)]
    pub show_folder_count: bool,
    #[serde(default)]
    pub auto_start: bool,
    #[serde(default)]
    pub keep_services_on_exit: bool,
    #[serde(default)]
    pub fetch_tool: Option<String>,
    #[serde(default)]
    pub custom_font: Option<String>,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub api_secret: Option<String>,
    #[serde(default = "default_clipboard_auto_copy")]
    pub clipboard_auto_copy: bool,
    // Onboarding & network
    #[serde(default)]
    pub onboarding_complete: bool,
    #[serde(default = "default_bind_host")]
    pub bind_host: String,
    /// When true, no password required for remote connections.
    #[serde(default)]
    pub open_access: bool,
    /// Persisted HMAC signing key — survives restarts so device tokens remain valid.
    #[serde(default)]
    pub signing_key: Option<String>,
    #[serde(default)]
    pub trusted_devices: Vec<TrustedDevice>,
    /// Whether the exec endpoint is enabled (default false for security).
    #[serde(default)]
    pub exec_enabled: bool,
    /// Allowlist of permitted command basenames for the exec endpoint.
    #[serde(default)]
    pub exec_allowlist: Vec<String>,
}

fn default_clipboard_auto_copy() -> bool {
    false
}

fn default_bind_host() -> String {
    "127.0.0.1".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: Some("winctl".to_string()),
            folder_state_preference: "remember".to_string(),
            show_folder_count: true,
            auto_start: false,
            keep_services_on_exit: false,
            fetch_tool: Some("fastfetch".to_string()),
            custom_font: None,
            port: 8888,
            api_secret: None,
            clipboard_auto_copy: false,
            onboarding_complete: false,
            bind_host: default_bind_host(),
            open_access: false,
            signing_key: None,
            trusted_devices: vec![],
            exec_enabled: false,
            exec_allowlist: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub bg: String,
    pub surface: String,
    pub surface2: String,
    pub border: String,
    pub border2: String,
    pub text: String,
    pub text2: String,
    pub text3: String,
    pub green: String,
    #[serde(rename = "green-dim")]
    pub green_dim: String,
    pub red: String,
    #[serde(rename = "red-dim")]
    pub red_dim: String,
    pub yellow: String,
    #[serde(rename = "yellow-dim")]
    pub yellow_dim: String,
    pub blue: String,
    #[serde(rename = "blue-dim")]
    pub blue_dim: String,
    pub accent: String,
    #[serde(rename = "accent-glow")]
    pub accent_glow: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub author: String,
    #[serde(default)]
    pub built_in: bool,
    pub colors: ThemeColors,
}

pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("winctl")
}

fn services_path() -> PathBuf {
    config_dir().join("services.json")
}

fn settings_path() -> PathBuf {
    config_dir().join("settings.json")
}

fn themes_dir() -> PathBuf {
    config_dir().join("themes")
}

struct Cache<T> {
    value: T,
    instant: Instant,
}

impl<T: Clone> Cache<T> {
    fn new(value: T) -> Self {
        Cache {
            value,
            instant: Instant::now(),
        }
    }

    fn is_expired(&self, ttl_secs: u64) -> bool {
        self.instant.elapsed().as_secs() > ttl_secs
    }
}

// Replace OnceLock with Mutex so the cache can be invalidated/updated
static SERVICES_CACHE: std::sync::Mutex<Option<Cache<ServiceConfig>>> = std::sync::Mutex::new(None);
static SETTINGS_CACHE: std::sync::Mutex<Option<Cache<Settings>>> = std::sync::Mutex::new(None);

const CACHE_TTL: u64 = 5;

pub fn ensure_config_dir() -> std::io::Result<()> {
    let dir = config_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    ensure_themes_dir()
}

pub fn ensure_themes_dir() -> std::io::Result<()> {
    let dir = themes_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    // Write any built-in themes that are missing (fresh install or upgrade adding new ones).
    // Existing files are left untouched so user edits to a theme id survive.
    // Write directly rather than via save_theme() to avoid re-entering ensure_config_dir.
    for theme in built_in_themes() {
        let path = dir.join(format!("{}.json", theme.id));
        if !path.exists() {
            let content = serde_json::to_string_pretty(&theme)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            fs::write(&path, &content)?;
        }
    }
    Ok(())
}

pub fn read_services() -> std::io::Result<ServiceConfig> {
    // Check if cached and not expired
    if let Ok(guard) = SERVICES_CACHE.lock() {
        if let Some(ref c) = *guard {
            if !c.is_expired(CACHE_TTL) {
                return Ok(c.value.clone());
            }
        }
    }

    let path = services_path();
    let config = if path.exists() {
        let content = fs::read_to_string(&path)?;
        serde_json::from_str(&content).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "services.json is corrupt ({}). Fix or delete it to reset.",
                    e
                ),
            )
        })?
    } else {
        ServiceConfig::default()
    };

    // Update cache
    if let Ok(mut guard) = SERVICES_CACHE.lock() {
        *guard = Some(Cache::new(config.clone()));
    }

    Ok(config)
}

/// Atomic write: serialize to `.tmp` sibling, then rename over target.
/// Falls back to direct write+flush if rename fails.
fn atomic_write(path: &std::path::Path, content: &str) -> std::io::Result<()> {
    use std::io::Write;
    let tmp_path = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp_path)?;
        f.write_all(content.as_bytes())?;
        f.sync_all()?;
    }
    if fs::rename(&tmp_path, path).is_err() {
        // Fallback: direct write (rename can fail across volumes on Windows)
        let mut f = fs::File::create(path)?;
        f.write_all(content.as_bytes())?;
        f.sync_all()?;
        let _ = fs::remove_file(&tmp_path);
    }
    Ok(())
}

pub fn write_services(config: &ServiceConfig) -> std::io::Result<()> {
    ensure_config_dir()?;
    let path = services_path();
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    atomic_write(&path, &content)?;

    // Update cache
    if let Ok(mut guard) = SERVICES_CACHE.lock() {
        *guard = Some(Cache::new(config.clone()));
    }

    Ok(())
}

pub fn read_settings() -> std::io::Result<Settings> {
    // Check if cached and not expired
    if let Ok(guard) = SETTINGS_CACHE.lock() {
        if let Some(ref c) = *guard {
            if !c.is_expired(CACHE_TTL) {
                return Ok(c.value.clone());
            }
        }
    }

    let path = settings_path();
    let settings = if path.exists() {
        let content = fs::read_to_string(&path)?;
        serde_json::from_str(&content).map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!(
                    "settings.json is corrupt ({}). Fix or delete it to reset.",
                    e
                ),
            )
        })?
    } else {
        Settings::default()
    };

    // Update cache
    if let Ok(mut guard) = SETTINGS_CACHE.lock() {
        *guard = Some(Cache::new(settings.clone()));
    }

    Ok(settings)
}

pub fn write_settings(settings: &Settings) -> std::io::Result<()> {
    ensure_config_dir()?;
    let path = settings_path();
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    atomic_write(&path, &content)?;

    // Update cache
    if let Ok(mut guard) = SETTINGS_CACHE.lock() {
        *guard = Some(Cache::new(settings.clone()));
    }

    Ok(())
}

pub fn read_themes() -> std::io::Result<Vec<Theme>> {
    let mut themes = vec![];
    let dir = themes_dir();

    if dir.exists() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if entry.path().extension().map_or(false, |e| e == "json") {
                let content = fs::read_to_string(entry.path())?;
                if let Ok(theme) = serde_json::from_str::<Theme>(&content) {
                    themes.push(theme);
                }
            }
        }
    }

    Ok(themes)
}

/// Reject theme IDs containing path separators or other traversal characters.
fn validate_theme_id(id: &str) -> std::io::Result<()> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!(
                "Invalid theme ID '{}': only [a-zA-Z0-9_-] allowed, max 64 chars",
                id
            ),
        ));
    }
    Ok(())
}

pub fn save_theme(theme: &Theme) -> std::io::Result<()> {
    validate_theme_id(&theme.id)?;
    ensure_config_dir()?;
    let path = themes_dir().join(format!("{}.json", theme.id));
    if path.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::AlreadyExists,
            "Theme already exists",
        ));
    }
    let content = serde_json::to_string_pretty(&theme)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    fs::write(&path, &content)
}

pub fn delete_theme(id: &str) -> std::io::Result<bool> {
    validate_theme_id(id)?;
    let path = themes_dir().join(format!("{}.json", id));
    if path.exists() {
        fs::remove_file(&path)?;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn built_in_themes() -> Vec<Theme> {
    let winctl_theme = Theme {
        id: "winctl".to_string(),
        name: "WinCTL Default".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#0a0a0b".to_string(),
            surface: "#141416".to_string(),
            surface2: "#1c1c1f".to_string(),
            border: "#2a2a2e".to_string(),
            border2: "#3a3a40".to_string(),
            text: "#e4e4e7".to_string(),
            text2: "#a1a1aa".to_string(),
            text3: "#71717a".to_string(),
            green: "#22c55e".to_string(),
            green_dim: "#14532d".to_string(),
            red: "#ef4444".to_string(),
            red_dim: "#450a0a".to_string(),
            yellow: "#eab308".to_string(),
            yellow_dim: "#422006".to_string(),
            blue: "#3b82f6".to_string(),
            blue_dim: "#172554".to_string(),
            accent: "#6366f1".to_string(),
            accent_glow: "#4338ca".to_string(),
        },
    };

    let dark_theme = Theme {
        id: "dark".to_string(),
        name: "Dark".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#09090b".to_string(),
            surface: "#18181b".to_string(),
            surface2: "#27272a".to_string(),
            border: "#3f3f46".to_string(),
            border2: "#52525b".to_string(),
            text: "#fafafa".to_string(),
            text2: "#a1a1aa".to_string(),
            text3: "#71717a".to_string(),
            green: "#22c55e".to_string(),
            green_dim: "#14532d".to_string(),
            red: "#ef4444".to_string(),
            red_dim: "#450a0a".to_string(),
            yellow: "#eab308".to_string(),
            yellow_dim: "#422006".to_string(),
            blue: "#3b82f6".to_string(),
            blue_dim: "#172554".to_string(),
            accent: "#8b5cf6".to_string(),
            accent_glow: "#5b21b6".to_string(),
        },
    };

    let void_neon_theme = Theme {
        id: "void-neon".to_string(),
        name: "Void Neon".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#0A0A0F".to_string(),
            surface: "#12121A".to_string(),
            surface2: "#1a1a24".to_string(),
            border: "#2d2d3a".to_string(),
            border2: "#3d3d4a".to_string(),
            text: "#E2E2F0".to_string(),
            text2: "#9090a8".to_string(),
            text3: "#606078".to_string(),
            green: "#7C3AED".to_string(),
            green_dim: "#4c1d95".to_string(),
            red: "#06B6D4".to_string(),
            red_dim: "#0e4a5a".to_string(),
            yellow: "#7C3AED".to_string(),
            yellow_dim: "#4c1d95".to_string(),
            blue: "#06B6D4".to_string(),
            blue_dim: "#0e4a5a".to_string(),
            accent: "#06B6D4".to_string(),
            accent_glow: "#0891b2".to_string(),
        },
    };

    let obsidian_ember_theme = Theme {
        id: "obsidian-ember".to_string(),
        name: "Obsidian Ember".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#0C0A09".to_string(),
            surface: "#1C1812".to_string(),
            surface2: "#252015".to_string(),
            border: "#3d3428".to_string(),
            border2: "#4d4438".to_string(),
            text: "#D6CFC8".to_string(),
            text2: "#a09890".to_string(),
            text3: "#706860".to_string(),
            green: "#F97316".to_string(),
            green_dim: "#7c2d12".to_string(),
            red: "#FBBF24".to_string(),
            red_dim: "#78350f".to_string(),
            yellow: "#F97316".to_string(),
            yellow_dim: "#7c2d12".to_string(),
            blue: "#FBBF24".to_string(),
            blue_dim: "#78350f".to_string(),
            accent: "#FBBF24".to_string(),
            accent_glow: "#b45309".to_string(),
        },
    };

    let arctic_glass_theme = Theme {
        id: "arctic-glass".to_string(),
        name: "Arctic Glass".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#F0F7FF".to_string(),
            surface: "#FFFFFF".to_string(),
            surface2: "#F8FAFC".to_string(),
            border: "#CBD5E1".to_string(),
            border2: "#E2E8F0".to_string(),
            text: "#0F172A".to_string(),
            text2: "#64748B".to_string(),
            text3: "#94A3B8".to_string(),
            green: "#0EA5E9".to_string(),
            green_dim: "#0369a1".to_string(),
            red: "#64748B".to_string(),
            red_dim: "#475569".to_string(),
            yellow: "#0EA5E9".to_string(),
            yellow_dim: "#0369a1".to_string(),
            blue: "#64748B".to_string(),
            blue_dim: "#475569".to_string(),
            accent: "#64748B".to_string(),
            accent_glow: "#475569".to_string(),
        },
    };

    let forest_noir_theme = Theme {
        id: "forest-noir".to_string(),
        name: "Forest Noir".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#080E0A".to_string(),
            surface: "#101A12".to_string(),
            surface2: "#182820".to_string(),
            border: "#2d3a2e".to_string(),
            border2: "#3d4a3e".to_string(),
            text: "#D1FAE5".to_string(),
            text2: "#90c8a8".to_string(),
            text3: "#609078".to_string(),
            green: "#22C55E".to_string(),
            green_dim: "#14532d".to_string(),
            red: "#86EFAC".to_string(),
            red_dim: "#166534".to_string(),
            yellow: "#22C55E".to_string(),
            yellow_dim: "#14532d".to_string(),
            blue: "#86EFAC".to_string(),
            blue_dim: "#166534".to_string(),
            accent: "#86EFAC".to_string(),
            accent_glow: "#22c55e".to_string(),
        },
    };

    let rose_dusk_theme = Theme {
        id: "rose-dusk".to_string(),
        name: "Rose Dusk".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#FFF5F7".to_string(),
            surface: "#FFFFFF".to_string(),
            surface2: "#FFF0F3".to_string(),
            border: "#FECDD3".to_string(),
            border2: "#FFE4E8".to_string(),
            text: "#4C0519".to_string(),
            text2: "#9F1239".to_string(),
            text3: "#BE123C".to_string(),
            green: "#E11D48".to_string(),
            green_dim: "#880f2e".to_string(),
            red: "#FDA4AF".to_string(),
            red_dim: "#9f1239".to_string(),
            yellow: "#E11D48".to_string(),
            yellow_dim: "#880f2e".to_string(),
            blue: "#FDA4AF".to_string(),
            blue_dim: "#9f1239".to_string(),
            accent: "#FDA4AF".to_string(),
            accent_glow: "#f43f5e".to_string(),
        },
    };

    let midnight_theme = Theme {
        id: "midnight".to_string(),
        name: "Midnight".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#0a0e1a".to_string(),
            surface: "#111726".to_string(),
            surface2: "#1a2234".to_string(),
            border: "#293449".to_string(),
            border2: "#39445a".to_string(),
            text: "#e6ecf7".to_string(),
            text2: "#9aa8c4".to_string(),
            text3: "#68758f".to_string(),
            green: "#34d399".to_string(),
            green_dim: "#064e3b".to_string(),
            red: "#f87171".to_string(),
            red_dim: "#450a0a".to_string(),
            yellow: "#fbbf24".to_string(),
            yellow_dim: "#422006".to_string(),
            blue: "#60a5fa".to_string(),
            blue_dim: "#172554".to_string(),
            accent: "#3b82f6".to_string(),
            accent_glow: "#1d4ed8".to_string(),
        },
    };

    let dracula_theme = Theme {
        id: "dracula".to_string(),
        name: "Dracula".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#1a1b26".to_string(),
            surface: "#232436".to_string(),
            surface2: "#2d2f44".to_string(),
            border: "#3d3f5a".to_string(),
            border2: "#4d4f6a".to_string(),
            text: "#f8f8f2".to_string(),
            text2: "#bd93f9".to_string(),
            text3: "#6272a4".to_string(),
            green: "#50fa7b".to_string(),
            green_dim: "#1a5e2e".to_string(),
            red: "#ff5555".to_string(),
            red_dim: "#5e1a1a".to_string(),
            yellow: "#f1fa8c".to_string(),
            yellow_dim: "#5e5a1a".to_string(),
            blue: "#8be9fd".to_string(),
            blue_dim: "#1a4a5e".to_string(),
            accent: "#bd93f9".to_string(),
            accent_glow: "#7c3aed".to_string(),
        },
    };

    let nord_theme = Theme {
        id: "nord".to_string(),
        name: "Nord".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#2e3440".to_string(),
            surface: "#3b4252".to_string(),
            surface2: "#434c5e".to_string(),
            border: "#4c566a".to_string(),
            border2: "#5c677a".to_string(),
            text: "#eceff4".to_string(),
            text2: "#d8dee9".to_string(),
            text3: "#9aa4b8".to_string(),
            green: "#a3be8c".to_string(),
            green_dim: "#3b4a2e".to_string(),
            red: "#bf616a".to_string(),
            red_dim: "#4a2226".to_string(),
            yellow: "#ebcb8b".to_string(),
            yellow_dim: "#4a3f22".to_string(),
            blue: "#81a1c1".to_string(),
            blue_dim: "#2e3d4a".to_string(),
            accent: "#88c0d0".to_string(),
            accent_glow: "#5e81ac".to_string(),
        },
    };

    let deep_ocean_theme = Theme {
        id: "deep-ocean".to_string(),
        name: "Deep Ocean".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#06121a".to_string(),
            surface: "#0c1c28".to_string(),
            surface2: "#132835".to_string(),
            border: "#1f3d4a".to_string(),
            border2: "#2f4d5a".to_string(),
            text: "#dbeef5".to_string(),
            text2: "#8fb3c0".to_string(),
            text3: "#5a7d8a".to_string(),
            green: "#2dd4bf".to_string(),
            green_dim: "#134e4a".to_string(),
            red: "#fb7185".to_string(),
            red_dim: "#4c0519".to_string(),
            yellow: "#fcd34d".to_string(),
            yellow_dim: "#422006".to_string(),
            blue: "#38bdf8".to_string(),
            blue_dim: "#0c4a6e".to_string(),
            accent: "#06b6d4".to_string(),
            accent_glow: "#0e7490".to_string(),
        },
    };

    let plum_theme = Theme {
        id: "plum".to_string(),
        name: "Plum".to_string(),
        author: "WinCTL".to_string(),
        built_in: true,
        colors: ThemeColors {
            bg: "#120a16".to_string(),
            surface: "#1c1022".to_string(),
            surface2: "#26172e".to_string(),
            border: "#3a2444".to_string(),
            border2: "#4a3454".to_string(),
            text: "#f0e6f5".to_string(),
            text2: "#b89ac4".to_string(),
            text3: "#7d6088".to_string(),
            green: "#4ade80".to_string(),
            green_dim: "#14532d".to_string(),
            red: "#fb7185".to_string(),
            red_dim: "#4c0519".to_string(),
            yellow: "#fbbf24".to_string(),
            yellow_dim: "#422006".to_string(),
            blue: "#c084fc".to_string(),
            blue_dim: "#3b0764".to_string(),
            accent: "#a855f7".to_string(),
            accent_glow: "#7e22ce".to_string(),
        },
    };

    vec![
        winctl_theme,
        dark_theme,
        void_neon_theme,
        obsidian_ember_theme,
        arctic_glass_theme,
        forest_noir_theme,
        rose_dusk_theme,
        midnight_theme,
        dracula_theme,
        nord_theme,
        deep_ocean_theme,
        plum_theme,
    ]
}

// Issue 4: Windows Autostart using winreg - consistent return pattern
pub fn is_autostart_enabled() -> bool {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run") {
            return key.get_value::<String, _>("WinCTL").is_ok();
        }
        return false;
    }
    #[cfg(not(windows))]
    return false;
}

pub fn enable_autostart() -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let (key, _) = hkcu.create_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Run")?;
        if let Ok(exe_path) = std::env::current_exe() {
            let cmd = format!("\"{}\" --headless", exe_path.to_string_lossy());
            key.set_value("WinCTL", &cmd)?;
        }
    }
    Ok(())
}

pub fn disable_autostart() {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey_with_flags(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Run",
            KEY_WRITE,
        ) {
            let _ = key.delete_value("WinCTL");
        }
    }
}