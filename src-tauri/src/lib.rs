mod config;
mod process;

use std::sync::{Arc, RwLock};
use std::net::{SocketAddr, IpAddr};
use std::str::FromStr;
use dashmap::DashMap;
use tokio::sync::Mutex as AsyncMutex;
use tokio::process::Child;
use tower_http::services::ServeDir;
use axum::{
    routing::{get, post, put, delete},
    Router, extract::{State, ConnectInfo}, Json, http::StatusCode, extract::Path,
    http::{Method, header::{HeaderName}},
    middleware::Next,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, Emitter,
};
use serde::{Serialize, Deserialize};
use tokio::sync::broadcast;
use tokio::sync::broadcast::error::RecvError;
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
};
use futures::{StreamExt, SinkExt};
use uuid::Uuid;
use axum::{
    body::Body,
    http::Request,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;
use reqwest::header::AUTHORIZATION;
use argon2::Argon2;
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng};

type HmacSha256 = Hmac<Sha256>;

const TOKEN_EXPIRY_SECS: u64 = 30 * 24 * 3600;
const DEVICE_TOKEN_EXPIRY_SECS: u64 = 365 * 24 * 3600;

const HWND_BROADCAST: u32 = 0xFFFF;
const WM_SYSCOMMAND: u32 = 0x0112;
const SC_MONITORPOWER: u32 = 0xF170;
const MONITOR_OFF: u32 = 2;

const DEFAULT_PORT: u16 = 8888;

const VALID_FETCH_TOOLS: &[&str] = &["fastfetch", "neofetch", "winfetch"];

/// Generate a token that expires at `absolute_expiry` (Unix seconds).
fn generate_token(secret: &str, absolute_expiry: u64) -> String {
    let ts = absolute_expiry.to_string();
    let data = format!("{}:{}", ts, secret);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(data.as_bytes());
    let sig = BASE64.encode(mac.finalize().into_bytes());
    format!("{}:{}", ts, sig)
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Validate a token where the embedded timestamp IS the absolute expiry time.
fn validate_token(token: &str, secret: &str) -> bool {
    let parts: Vec<&str> = token.splitn(2, ':').collect();
    if parts.len() != 2 { return false; }
    let Ok(expiry) = parts[0].parse::<u64>() else { return false; };
    if now_secs() > expiry { return false; }
    let expected = generate_token(secret, expiry);
    expected.as_bytes().ct_eq(token.as_bytes()).into()
}

#[derive(Clone)]
struct AppState {
    services: Arc<RwLock<config::ServiceConfig>>,
    settings: Arc<RwLock<config::Settings>>,
    process_manager: Arc<process::Manager>,
    tx: broadcast::Sender<String>,
    auth_key: String,
    exec_children: Arc<DashMap<String, Arc<AsyncMutex<Option<Child>>>>>,
    ws_connections: Arc<DashMap<String, Vec<String>>>,
    ws_conn_counter: Arc<std::sync::atomic::AtomicU64>,
    open_access: Arc<std::sync::atomic::AtomicBool>,
    shutdown_tx: tokio::sync::watch::Sender<bool>,
    restart_locks: Arc<DashMap<String, Arc<AsyncMutex<()>>>>,
}

#[derive(Serialize, Clone)]
struct OkResponse { ok: bool }

#[derive(Serialize, Clone)]
struct AutostartResponse { enabled: bool }

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SystemInfoResponse {
    hostname: String,
    platform: String,
    cpu_count: usize,
    total_mem: u64,
    free_mem: u64,
    cached_mem: u64,
    uptime: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FlushMemoryResponse { free_mem: u64, cached_mem: u64 }

#[derive(Serialize)]
#[allow(non_snake_case)]
struct ExecResponse { execId: String }

#[derive(Serialize)]
struct ToolsResponse { tools: Vec<String> }

#[derive(Serialize)]
struct FetchToolResponse { output: String }

#[derive(Deserialize)]
struct ExecRequest {
    command: String,
    cwd: Option<String>,
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// Convert a poisoned RwLock into a 500.
fn lock_err() -> StatusCode { StatusCode::INTERNAL_SERVER_ERROR }

/// Convert a config write error into a (500, JSON error) tuple.
fn config_write_err() -> (StatusCode, Json<ErrorResponse>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Failed to save configuration".to_string() }))
}

/// Hash a plaintext password with argon2id.
fn hash_password(plaintext: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2.hash_password(plaintext.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Failed to hash password: {}", e))
}

/// Verify a plaintext password against an argon2 hash.
fn verify_password(plaintext: &str, hash: &str) -> bool {
    let Ok(parsed) = PasswordHash::new(hash) else { return false };
    Argon2::default().verify_password(plaintext.as_bytes(), &parsed).is_ok()
}

fn copy_password_to_clipboard() -> Result<(), String> {
    let settings = config::read_settings().map_err(|e| e.to_string())?;

    if !settings.clipboard_auto_copy {
        println!("Clipboard copy is disabled in settings.");
        return Ok(());
    }

    let secret = settings.api_secret
        .ok_or_else(|| "No password configured. Run winctl init first.".to_string())?;

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Failed to access clipboard: {}", e))?;
    clipboard.set_text(secret)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

    println!("Password copied to clipboard!");
    Ok(())
}

fn log_audit(msg: &str) {
    if let Err(e) = config::ensure_config_dir() {
        eprintln!("[winctl] audit log: failed to ensure config dir: {}", e);
        return;
    }
    let log_path = config::config_dir().join("audit.log");
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let line = format!("[{}] {}\n", timestamp, msg);
    
    use std::io::Write;
    let mut file = match std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        Ok(f) => f,
        Err(e) => {
            eprintln!("[winctl] audit log: failed to open {}: {}", log_path.display(), e);
            return;
        }
    };
    if let Err(e) = file.write_all(line.as_bytes()) {
        eprintln!("[winctl] audit log: failed to write: {}", e);
    }
}
// ── process finder (for supervising externally-started services) ─────────────────

/// Find all running processes on Windows, returning a map of PID -> (exe_name, command_line).
fn find_all_running_processes() -> std::collections::HashMap<u32, (String, String)> {
    let mut map = std::collections::HashMap::new();
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", "Get-CimInstance Win32_Process | ForEach-Object { \"{0}|{1}|{2}\" -f $_.ProcessId, $_.Name, $_.CommandLine }"])
        .output();
    
    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let parts: Vec<&str> = line.splitn(3, '|').collect();
            if parts.len() >= 2 {
                if let Ok(pid) = parts[0].trim().parse::<u32>() {
                    let name = parts[1].to_string();
                    let cmdline = if parts.len() == 3 { parts[2].trim().to_string() } else { String::new() };
                    map.insert(pid, (name, cmdline));
                }
            }
        }
    }
    map
}

/// Match a command and arguments against the map of running processes to find a PID.
fn find_process_in_map(processes: &std::collections::HashMap<u32, (String, String)>, command: &str, args: &str) -> Option<u32> {
    let exe_name = std::path::Path::new(command)
        .file_name()
        .and_then(|n| n.to_str())?
        .to_lowercase();
    
    let args_lower = args.to_lowercase();
    
    for (&pid, (name, cmdline)) in processes {
        let name_lower = name.to_lowercase();
        // Match name with or without .exe suffix
        let name_match = name_lower == exe_name 
            || name_lower.strip_suffix(".exe").unwrap_or(&name_lower) == exe_name.strip_suffix(".exe").unwrap_or(&exe_name);
            
        if name_match {
            if args_lower.is_empty() {
                return Some(pid);
            } else if cmdline.to_lowercase().contains(&args_lower) {
                return Some(pid);
            }
        }
    }
    None
}

/// Find a running process PID by matching its command line AND args.
fn find_process_by_command(command: &str, args: &str) -> Option<u32> {
    let running = find_all_running_processes();
    find_process_in_map(&running, command, args)
}



// ── auth handlers ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct LoginRequest { password: Option<String> }

#[derive(Serialize)]
struct LoginResponse { token: String }

#[derive(Serialize)]
struct ErrorResponse { error: String }

async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, (StatusCode, Json<ErrorResponse>)> {
    let password = req.password.unwrap_or_default();
    let ip = addr.ip();
    if password.is_empty() {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Access key is required".to_string() })));
    }
    let settings = match state.settings.read() {
        Ok(s) => s,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Server error".to_string() }))),
    };
    let secret = match settings.api_secret.clone() {
        Some(s) => s,
        None => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Server configuration error".to_string() }))),
    };
    drop(settings);
    let password_valid = if secret.starts_with("$argon2") {
        verify_password(&password, &secret)
    } else {
        // Legacy plaintext comparison (pre-migration)
        password == secret
    };
    if !password_valid {
        log_audit(&format!("FAILED login attempt from IP: {}", ip));
        return Err((StatusCode::UNAUTHORIZED, Json(ErrorResponse { error: "Invalid access key".to_string() })));
    }
    log_audit(&format!("Successful login from IP: {}", ip));
    let token = generate_token(&state.auth_key, now_secs() + TOKEN_EXPIRY_SECS);
    Ok(Json(LoginResponse { token }))
}

async fn logout() -> Json<OkResponse> {
    Json(OkResponse { ok: true })
}

// ── setup handlers ────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct SetupStatusResponse {
    needs_setup: bool,
    onboarding_complete: bool,
    api_secret_set: bool,
    open_access: bool,
    bind_host: String,
}

async fn get_setup_status(State(state): State<Arc<AppState>>) -> Result<Json<SetupStatusResponse>, StatusCode> {
    let settings = state.settings.read().map_err(|_| lock_err())?;
    let api_secret_set = settings.api_secret.is_some();
    let open_access = settings.open_access;
    let bind_host = settings.bind_host.clone();
    let onboarding_complete = settings.onboarding_complete;
    drop(settings);

    let needs_setup = !api_secret_set;
    Ok(Json(SetupStatusResponse {
        needs_setup,
        onboarding_complete,
        api_secret_set,
        open_access,
        bind_host,
    }))
}

#[derive(Deserialize)]
struct CompleteSetupRequest {
    api_secret: String,
    open_access: bool,
    bind_host: String,
    port: Option<u16>,
}

async fn complete_setup(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CompleteSetupRequest>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ErrorResponse>)> {
    if req.api_secret.len() < 4 {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Access key must be at least 4 characters".to_string() })));
    }

    let mut settings = state.settings.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;

    // Idempotency guard: reject if setup already completed
    if settings.onboarding_complete {
        return Err((StatusCode::CONFLICT, Json(ErrorResponse { error: "Setup already completed".to_string() })));
    }
    let hashed = hash_password(&req.api_secret)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: e })))?;
    settings.api_secret = Some(hashed);
    settings.open_access = req.open_access;
    settings.bind_host = req.bind_host;
    if let Some(port) = req.port {
        settings.port = port;
    }
    settings.onboarding_complete = true;

    let key = Uuid::new_v4().simple().to_string();
    settings.signing_key = Some(key);

    state.open_access.store(settings.open_access, std::sync::atomic::Ordering::Relaxed);

    config::write_settings(&settings).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Failed to save settings".to_string() })))?;
    log_audit(&format!("Setup completed successfully. Server bind: {}:{}", settings.bind_host, settings.port));

    Ok(Json(OkResponse { ok: true }))
}

#[derive(Deserialize)]
struct RegisterDeviceRequest {
    device_id: String,
    device_name: String,
}

#[derive(Serialize)]
struct RegisterDeviceResponse {
    device_id: String,
    token: String,
}

async fn register_device(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    Json(req): Json<RegisterDeviceRequest>,
) -> Result<Json<RegisterDeviceResponse>, (StatusCode, Json<ErrorResponse>)> {
    if state.open_access.load(std::sync::atomic::Ordering::Relaxed) {
        return Err((StatusCode::FORBIDDEN, Json(ErrorResponse { error: "Device registration not needed when open access is enabled".to_string() })));
    }

    let is_onboarded = {
        let settings = state.settings.read().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
        settings.onboarding_complete
    };

    if is_onboarded {
        // Require valid token
        let token = headers.get("x-winctl-token")
            .and_then(|v| v.to_str().ok())
            .or_else(|| {
                headers.get(AUTHORIZATION)
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.strip_prefix("Bearer "))
            });
        
        let token_valid = token.map(|t| validate_token(t, &state.auth_key)).unwrap_or(false);
        if !token_valid {
            log_audit(&format!("Unauthorized attempt to register device '{}' from IP: {}", req.device_name, addr.ip()));
            return Err((StatusCode::UNAUTHORIZED, Json(ErrorResponse { error: "Authentication required to register devices after setup".to_string() })));
        }
    }

    let device_id = Uuid::new_v4().simple().to_string();

    let expiry = now_secs() + DEVICE_TOKEN_EXPIRY_SECS;
    let token = generate_token(&state.auth_key, expiry);

    let mut settings = state.settings.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;

    // Remove existing device with same name to prevent unbounded accumulation
    settings.trusted_devices.retain(|d| d.name != req.device_name);

    settings.trusted_devices.push(config::TrustedDevice {
        id: device_id.clone(),
        name: req.device_name.clone(),
        created_at: now_secs(),
    });

    config::write_settings(&settings).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Failed to save settings".to_string() })))?;

    log_audit(&format!("Device '{}' registered from IP: {}. ID: {}", req.device_name, addr.ip(), device_id));

    Ok(Json(RegisterDeviceResponse { device_id, token }))
}

// ── service handlers ─────────────────────────────────────────────────────────

async fn get_services(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state.services.read().map_err(|_| lock_err())?;
    let enriched = state.process_manager.enrich_services(&services.services);
    Ok(Json(serde_json::json!({
        "services": enriched,
        "folders": services.folders,
    })))
}

async fn create_service(
    State(state): State<Arc<AppState>>,
    Json(svc): Json<config::Service>,
) -> Result<Json<config::Service>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let new_service = config::Service {
        id: radix_fmt::radix(ts, 36).to_string(),
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        ..svc
    };
    services.services.push(new_service.clone());
    if let Err(_) = config::write_services(&services) {
        services.services.pop();
        return Err(config_write_err());
    }
    drop(services);
    let _ = state.tx.send("update".to_string());
    Ok(Json(new_service))
}

async fn update_service(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(svc): Json<config::Service>,
) -> Result<Json<config::Service>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    if let Some(idx) = services.services.iter().position(|s| s.id == id) {
        let old = services.services[idx].clone();
        services.services[idx] = svc.clone();
        if let Err(_) = config::write_services(&services) {
            services.services[idx] = old;
            return Err(config_write_err());
        }
        drop(services);
        let _ = state.tx.send("update".to_string());
        Ok(Json(svc))
    } else {
        Err((StatusCode::NOT_FOUND, Json(ErrorResponse { error: "Service not found".to_string() })))
    }
}

async fn delete_service(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Kill the service process first to prevent orphaned background processes
    let _ = state.process_manager.kill(&id).await;

    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let snapshot = services.services.clone();
    services.services.retain(|s| s.id != id);
    if let Err(_) = config::write_services(&services) {
        services.services = snapshot;
        return Err(config_write_err());
    }
    drop(services);
    let _ = state.tx.send("update".to_string());
    Ok(Json(OkResponse { ok: true }))
}

async fn reorder_services(
    State(state): State<Arc<AppState>>,
    Json(ids): Json<Vec<String>>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let snapshot = services.services.clone();
    for (idx, id) in ids.iter().enumerate() {
        if let Some(svc) = services.services.iter_mut().find(|s| s.id == *id) {
            svc.sort_order = idx as i64;
        }
    }
    if let Err(_) = config::write_services(&services) {
        services.services = snapshot;
        return Err(config_write_err());
    }
    Ok(Json(OkResponse { ok: true }))
}

/// PUT /api/folders/reorder — reorder the folders vec to match the given id
/// order. Folders carry no sort field; their vec order IS the display order.
async fn reorder_folders(
    State(state): State<Arc<AppState>>,
    Json(ids): Json<Vec<String>>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let snapshot = services.folders.clone();

    let mut reordered: Vec<config::Folder> = Vec::with_capacity(services.folders.len());
    for id in &ids {
        if let Some(pos) = services.folders.iter().position(|f| f.id == *id) {
            reordered.push(services.folders[pos].clone());
        }
    }
    // Keep any folders the client didn't list (safety against races).
    for f in &services.folders {
        if !ids.contains(&f.id) {
            reordered.push(f.clone());
        }
    }
    services.folders = reordered;

    if let Err(_) = config::write_services(&services) {
        services.folders = snapshot;
        return Err(config_write_err());
    }
    drop(services);
    let _ = state.tx.send("update".to_string());
    Ok(Json(OkResponse { ok: true }))
}

// ── settings handlers ────────────────────────────────────────────────────────

async fn get_settings(State(state): State<Arc<AppState>>) -> Result<Json<config::Settings>, StatusCode> {
    let settings = state.settings.read().map_err(|_| lock_err())?;
    Ok(Json(settings.clone()))
}

async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(new_settings): Json<serde_json::Value>,
) -> Result<Json<config::Settings>, (StatusCode, Json<ErrorResponse>)> {
    let mut settings = state.settings.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let snapshot = settings.clone();

    let mut current_val = serde_json::to_value(&*settings).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Server error".to_string() })))?;

    if let (Some(curr_obj), Some(new_obj)) = (current_val.as_object_mut(), new_settings.as_object()) {
        for (k, v) in new_obj {
            curr_obj.insert(k.clone(), v.clone());
        }
    }

    let merged_settings: config::Settings = serde_json::from_value(current_val).map_err(|_| (StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Invalid settings".to_string() })))?;

    let preserved_secret = settings.api_secret.clone();
    let preserved_signing_key = settings.signing_key.clone();
    let new_trusted_devices = merged_settings.trusted_devices.clone();
    let new_open_access = merged_settings.open_access;

    *settings = merged_settings;
    settings.api_secret = preserved_secret;
    settings.signing_key = preserved_signing_key;
    settings.trusted_devices = new_trusted_devices;

    if let Err(_) = config::write_settings(&settings) {
        *settings = snapshot;
        return Err(config_write_err());
    }

    log_audit("System settings updated");

    state.open_access.store(new_open_access, std::sync::atomic::Ordering::SeqCst);
    Ok(Json(settings.clone()))
}

// ── folder handlers ──────────────────────────────────────────────────────────

async fn folders_get(State(state): State<Arc<AppState>>) -> Result<Json<Vec<config::Folder>>, StatusCode> {
    let services = state.services.read().map_err(|_| lock_err())?;
    Ok(Json(services.folders.clone()))
}

async fn folders_create(
    State(state): State<Arc<AppState>>,
    Json(folder): Json<config::Folder>,
) -> Result<Json<config::Folder>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    let new_folder = config::Folder {
        id: radix_fmt::radix(ts, 36).to_string(),
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        ..folder
    };
    services.folders.push(new_folder.clone());
    if let Err(_) = config::write_services(&services) {
        services.folders.pop();
        return Err(config_write_err());
    }
    Ok(Json(new_folder))
}

async fn folders_update(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(folder): Json<config::Folder>,
) -> Result<Json<config::Folder>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    if let Some(idx) = services.folders.iter().position(|f| f.id == id) {
        let old = services.folders[idx].clone();
        services.folders[idx] = folder.clone();
        if let Err(_) = config::write_services(&services) {
            services.folders[idx] = old;
            return Err(config_write_err());
        }
        Ok(Json(folder))
    } else {
        Err((StatusCode::NOT_FOUND, Json(ErrorResponse { error: "Folder not found".to_string() })))
    }
}

async fn folders_delete(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, (StatusCode, Json<ErrorResponse>)> {
    let mut services = state.services.write().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
    let snapshot_folders = services.folders.clone();
    let snapshot_services = services.services.clone();
    services.folders.retain(|f| f.id != id);
    for svc in &mut services.services {
        if svc.folder_id.as_deref() == Some(id.as_str()) {
            svc.folder_id = None;
        }
    }
    if let Err(_) = config::write_services(&services) {
        services.folders = snapshot_folders;
        services.services = snapshot_services;
        return Err(config_write_err());
    }
    Ok(Json(OkResponse { ok: true }))
}

// ── theme handlers ───────────────────────────────────────────────────────────

async fn themes_get() -> Result<Json<Vec<config::Theme>>, StatusCode> {
    let _ = config::ensure_themes_dir();
    config::read_themes().map(Json).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn themes_create(Json(theme): Json<config::Theme>) -> Result<Json<config::Theme>, StatusCode> {
    match config::save_theme(&theme) {
        Ok(_) => Ok(Json(theme)),
        Err(e) if e.kind() == std::io::ErrorKind::InvalidInput => Err(StatusCode::BAD_REQUEST),
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Err(StatusCode::CONFLICT),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn themes_delete(Path(id): Path<String>) -> Result<Json<OkResponse>, StatusCode> {
    match config::delete_theme(&id) {
        Ok(true) => Ok(Json(OkResponse { ok: true })),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) if e.kind() == std::io::ErrorKind::InvalidInput => Err(StatusCode::BAD_REQUEST),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ── autostart handlers ───────────────────────────────────────────────────────

async fn autostart_get() -> Json<AutostartResponse> {
    Json(AutostartResponse { enabled: config::is_autostart_enabled() })
}

async fn autostart_enable() -> Result<Json<OkResponse>, StatusCode> {
    config::enable_autostart().map(|_| Json(OkResponse { ok: true }))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn autostart_disable() -> Json<OkResponse> {
    config::disable_autostart();
    Json(OkResponse { ok: true })
}

// ── process control handlers ─────────────────────────────────────────────────

fn find_service<'a>(services: &'a config::ServiceConfig, id_or_name: &str) -> Option<&'a config::Service> {
    let id_or_name_lower = id_or_name.to_lowercase();
    services.services.iter().find(|s| {
        s.id == id_or_name || s.name.to_lowercase() == id_or_name_lower
    })
}

async fn service_start(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, StatusCode> {
    let svc = {
        let services = state.services.read().map_err(|_| lock_err())?;
        find_service(&services, &id).cloned()
    };
    let s = svc.ok_or(StatusCode::NOT_FOUND)?;
    let pm = state.process_manager.clone();

    log_audit(&format!("Service '{}' ({}) start requested from IP: {}", s.name, s.id, addr.ip()));

    // Check if the service is already running on Windows (e.g. started from outside)
    if pm.get_state(&s.id) == process::ServiceState::Stopped {
        if let Some(pid) = find_process_by_command(&s.command, &s.args) {
            eprintln!("[winctl] start requested: service '{}' is already running outside (PID {}). Adopting it.", s.name, pid);
            let _ = pm.supervise(&s, pid).await;
            let _ = state.tx.send("update".to_string());
            return Ok(Json(OkResponse { ok: true }));
        }
    }

    pm.spawn(&s).await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let _ = state.tx.send("update".to_string());
    Ok(Json(OkResponse { ok: true }))
}

async fn service_stop(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, StatusCode> {
    let svc = {
        let services = state.services.read().map_err(|_| lock_err())?;
        find_service(&services, &id).cloned()
    };
    let s = svc.ok_or(StatusCode::NOT_FOUND)?;
    let pm = state.process_manager.clone();

    log_audit(&format!("Service '{}' ({}) stop requested from IP: {}", s.name, s.id, addr.ip()));

    pm.kill(&s.id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let _ = state.tx.send("update".to_string());
    Ok(Json(OkResponse { ok: true }))
}

async fn service_restart(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>, StatusCode> {
    let svc = {
        let services = state.services.read().map_err(|_| lock_err())?;
        find_service(&services, &id).cloned()
    };
    let s = svc.ok_or(StatusCode::NOT_FOUND)?;

    log_audit(&format!("Service '{}' ({}) restart requested from IP: {}", s.name, s.id, addr.ip()));

    // Acquire per-service restart lock to prevent races with supervision loop
    let lock = state.restart_locks
        .entry(s.id.clone())
        .or_insert_with(|| Arc::new(AsyncMutex::new(())))
        .clone();
    let _guard = lock.lock().await;

    let pm = state.process_manager.clone();
    let sid = s.id.clone();
    pm.kill(&sid).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    pm.spawn(&s).await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let _ = state.tx.send("update".to_string());
    Ok(Json(OkResponse { ok: true }))
}

async fn service_logs(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<process::LogEntry>>, StatusCode> {
    let sid = {
        let services = state.services.read().map_err(|_| lock_err())?;
        find_service(&services, &id).map(|s| s.id.clone())
    };
    let sid = sid.ok_or(StatusCode::NOT_FOUND)?;
    Ok(Json(state.process_manager.logs(&sid, None)))
}

async fn get_status(State(state): State<Arc<AppState>>) -> Result<Json<OkResponse>, StatusCode> {
    drop(state.services.read().map_err(|_| lock_err())?);
    drop(state.settings.read().map_err(|_| lock_err())?);
    Ok(Json(OkResponse { ok: true }))
}

// Native memory info + standby-list purge. Replaces the `sys-info` crate (which
// returned 0 for available memory on this box) and the external
// EmptyStandbyList.exe (usually not installed, so flushing did nothing).
#[cfg(windows)]
mod meminfo {
    use core::ffi::c_void;
    use core::mem::size_of;
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

    const SYSTEM_MEMORY_LIST_INFORMATION: u32 = 80;
    const MEMORY_PURGE_STANDBY_LIST: u32 = 4;

    #[link(name = "ntdll")]
    extern "system" {
        fn NtQuerySystemInformation(class: u32, info: *mut c_void, len: u32, ret: *mut u32) -> i32;
        fn NtSetSystemInformation(class: u32, info: *mut c_void, len: u32) -> i32;
    }

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct MemListInfo {
        zero: usize,
        free: usize,
        modified: usize,
        modified_no_write: usize,
        bad: usize,
        standby_by_priority: [usize; 8],
        repurposed_by_priority: [usize; 8],
        modified_pagefile: usize,
    }

    /// (total_bytes, avail_bytes, standby_bytes). standby = reclaimable cache.
    pub fn read() -> (u64, u64, u64) {
        let mut ms = MEMORYSTATUSEX { dwLength: size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
        let (total, avail) = unsafe {
            if GlobalMemoryStatusEx(&mut ms).is_ok() { (ms.ullTotalPhys, ms.ullAvailPhys) } else { (0, 0) }
        };
        (total, avail, standby_bytes())
    }

    fn standby_bytes() -> u64 {
        let mut info = MemListInfo::default();
        let mut ret = 0u32;
        let status = unsafe {
            NtQuerySystemInformation(
                SYSTEM_MEMORY_LIST_INFORMATION,
                &mut info as *mut _ as *mut c_void,
                size_of::<MemListInfo>() as u32,
                &mut ret,
            )
        };
        if status < 0 { return 0; }
        let pages: usize = info.standby_by_priority.iter().sum();
        pages as u64 * 4096
    }

    /// Purge the standby list. Needs elevation + SeProfileSingleProcessPrivilege.
    /// ponytail: silently no-ops without admin — same ceiling as the old exe.
    pub fn purge_standby() -> bool {
        enable_privilege();
        let mut cmd = MEMORY_PURGE_STANDBY_LIST;
        let status = unsafe {
            NtSetSystemInformation(
                SYSTEM_MEMORY_LIST_INFORMATION,
                &mut cmd as *mut _ as *mut c_void,
                size_of::<u32>() as u32,
            )
        };
        status >= 0
    }

    fn enable_privilege() {
        use windows::core::w;
        use windows::Win32::Foundation::{CloseHandle, HANDLE, LUID};
        use windows::Win32::Security::{
            AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
            TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
        };
        use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
        unsafe {
            let mut token = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &mut token).is_err() {
                return;
            }
            let mut luid = LUID::default();
            if LookupPrivilegeValueW(None, w!("SeProfileSingleProcessPrivilege"), &mut luid).is_ok() {
                let tp = TOKEN_PRIVILEGES {
                    PrivilegeCount: 1,
                    Privileges: [LUID_AND_ATTRIBUTES { Luid: luid, Attributes: SE_PRIVILEGE_ENABLED }],
                };
                let _ = AdjustTokenPrivileges(token, false, Some(&tp), 0, None, None);
            }
            let _ = CloseHandle(token);
        }
    }
}

async fn get_system_info() -> Json<SystemInfoResponse> {
    #[cfg(windows)] {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().into_owned())
            .unwrap_or_else(|_| "unknown".to_string());
        let cpu_count = num_cpus::get();
        let (total_mem, free_mem, cached_mem) = meminfo::read();
        // GetTickCount64 = ms since boot; no process spawn, unlike the old
        // per-call PowerShell invocation.
        let uptime = unsafe { windows::Win32::System::SystemInformation::GetTickCount64() } / 1000;
        Json(SystemInfoResponse { hostname, platform: "windows".to_string(), cpu_count, total_mem, free_mem, cached_mem, uptime })
    }
    #[cfg(not(windows))] {
        Json(SystemInfoResponse {
            hostname: "unknown".to_string(),
            platform: "unknown".to_string(),
            cpu_count: 1,
            total_mem: 0,
            free_mem: 0,
            cached_mem: 0,
            uptime: 0,
        })
    }
}

async fn flush_memory() -> Json<FlushMemoryResponse> {
    #[cfg(windows)] {
        meminfo::purge_standby();
        let (_, free_mem, cached_mem) = meminfo::read();
        return Json(FlushMemoryResponse { free_mem, cached_mem });
    }
    #[cfg(not(windows))]
    Json(FlushMemoryResponse { free_mem: 0, cached_mem: 0 })
}

async fn exec_command(State(state): State<Arc<AppState>>, Json(req): Json<ExecRequest>) -> Result<Json<ExecResponse>, (StatusCode, Json<ErrorResponse>)> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use std::process::Stdio;

    // Check if exec endpoint is enabled
    {
        let settings = state.settings.read().map_err(|_| (lock_err(), Json(ErrorResponse { error: "Server error".to_string() })))?;
        if !settings.exec_enabled {
            return Err((StatusCode::FORBIDDEN, Json(ErrorResponse { error: "Exec endpoint is disabled".to_string() })));
        }

        // Validate command against allowlist
        let cmd_basename = req.command.split_whitespace().next().unwrap_or("");
        let cmd_basename = std::path::Path::new(cmd_basename)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(cmd_basename);
        if !settings.exec_allowlist.iter().any(|a| a.eq_ignore_ascii_case(cmd_basename)) {
            return Err((StatusCode::FORBIDDEN, Json(ErrorResponse { error: "Command not in allowlist".to_string() })));
        }
    }

    // Reject shell metacharacters — the command runs through `cmd.exe /C`, so
    // without this, `echo x & evil.exe` passes the allowlist (basename "echo")
    // yet still runs `evil.exe`.
    if req.command.contains(|c: char| matches!(c, '&' | '|' | '<' | '>' | '^' | '\n' | '\r')) {
        return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "Command contains disallowed shell characters".to_string() })));
    }

    // Validate cwd
    if let Some(ref cwd) = req.cwd {
        if !cwd.is_empty() {
            let cwd_path = std::path::Path::new(cwd);
            if !cwd_path.is_absolute() {
                return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "cwd must be an absolute path".to_string() })));
            }
            if !cwd_path.exists() {
                return Err((StatusCode::BAD_REQUEST, Json(ErrorResponse { error: "cwd path does not exist".to_string() })));
            }
        }
    }

    let exec_id = Uuid::new_v4().simple().to_string();

    let mut child = tokio::process::Command::new("cmd.exe")
        .args(["/C", &req.command])
        .current_dir(req.cwd.as_deref().filter(|s| !s.is_empty()).unwrap_or("."))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(ErrorResponse { error: "Failed to spawn command".to_string() })))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    state.exec_children.insert(exec_id.clone(), Arc::new(AsyncMutex::new(Some(child))));

    let id = exec_id.clone();
    let tx = state.tx.clone();
    let exec_children = state.exec_children.clone();

    tokio::spawn(async move {
        // Stream stdout
        let tx_out = tx.clone();
        let id_out = id.clone();
        let stdout_task = tokio::spawn(async move {
            if let Some(stdout) = stdout {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = tx_out.send(serde_json::json!({
                        "type": "exec-output",
                        "execId": id_out,
                        "stream": "stdout",
                        "line": line,
                    }).to_string());
                }
            }
        });

        // Stream stderr
        let tx_err = tx.clone();
        let id_err = id.clone();
        let stderr_task = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = tx_err.send(serde_json::json!({
                        "type": "exec-output",
                        "execId": id_err,
                        "stream": "stderr",
                        "line": line,
                    }).to_string());
                }
            }
        });

        let _ = stdout_task.await;
        let _ = stderr_task.await;

        // Wait for exit code
        let exit_code = {
            if let Some((_, child_arc)) = exec_children.remove(&id) {
                let mut guard = child_arc.lock().await;
                if let Some(mut c) = guard.take() {
                    c.wait().await.map(|s| s.code().unwrap_or(-1)).unwrap_or(-1)
                } else { -1 }
            } else { -1 }
        };

        let _ = tx.send(serde_json::json!({
            "type": "exec-done",
            "execId": id,
            "exitCode": exit_code,
        }).to_string());
    });

    Ok(Json(ExecResponse { execId: exec_id }))
}

async fn kill_exec_session(State(state): State<Arc<AppState>>, Path(exec_id): Path<String>) -> Result<Json<OkResponse>, StatusCode> {
    if let Some((_, child_arc)) = state.exec_children.remove(&exec_id) {
        let mut child_guard = child_arc.lock().await;
        if let Some(mut child) = (*child_guard).take() {
            let _ = child.kill().await;
        }
    }
    Ok(Json(OkResponse { ok: true }))
}

static FONTS_CACHE: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();

fn load_fonts() -> Vec<String> {
    #[cfg(windows)] {
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "[System.Reflection.Assembly]::LoadWithPartialName('System.Drawing') | Out-Null; (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }"])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();
        output.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    }
    #[cfg(not(windows))] { Vec::new() }
}

async fn get_fonts() -> Json<Vec<String>> {
    // Behind auth + cached: the font list never changes at runtime, so the
    // slow blocking PowerShell enumeration runs at most once per process.
    Json(FONTS_CACHE.get_or_init(load_fonts).clone())
}

async fn get_sysinfo_tools() -> Json<ToolsResponse> {
    let mut tools = vec![];
    #[cfg(windows)] {
        let check = |cmd: &str| {
            std::process::Command::new("cmd.exe")
                .args(["/C", "where", cmd])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        };
        if check("fastfetch") { tools.push("fastfetch".to_string()); }
        if check("neofetch") { tools.push("neofetch".to_string()); }
        if check("winfetch") { tools.push("winfetch".to_string()); }
    }
    Json(ToolsResponse { tools })
}

async fn run_fetch_tool(State(state): State<Arc<AppState>>) -> Result<Json<FetchToolResponse>, StatusCode> {
    let tool = {
        let settings = state.settings.read().map_err(|_| lock_err())?;
        settings.fetch_tool.clone()
    };
    let tool = tool.as_deref().unwrap_or("fastfetch");

    if !VALID_FETCH_TOOLS.contains(&tool) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let output = std::process::Command::new("cmd.exe")
        .args(["/C", tool])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let _ = state.tx.send(serde_json::json!({
        "type": "fetch-output",
        "tool": tool,
        "output": output.clone(),
    }).to_string());

    Ok(Json(FetchToolResponse { output }))
}

/// POST /api/shutdown — graceful shutdown via watch channel
async fn shutdown_handler(State(state): State<Arc<AppState>>) -> Json<OkResponse> {
    let keep_services = {
        let settings = state.settings.read().ok();
        settings.map(|s| s.keep_services_on_exit).unwrap_or(false)
    };

    tokio::spawn(async move {
        if !keep_services {
            kill_all_managed(&state).await;
        }
        // Give time for the response to flush
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let _ = state.shutdown_tx.send(true);
    });
    Json(OkResponse { ok: true })
}

/// POST /api/restart — spawn new instance, then graceful shutdown
async fn restart_handler(State(state): State<Arc<AppState>>) -> Json<OkResponse> {
    let keep_services = {
        let settings = state.settings.read().ok();
        settings.map(|s| s.keep_services_on_exit).unwrap_or(false)
    };

    tokio::spawn(async move {
        // Spawn replacement before shutting down
        if let Ok(exe) = std::env::current_exe() {
            let _ = std::process::Command::new(&exe).spawn();
        }
        if !keep_services {
            kill_all_managed(&state).await;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        let _ = state.shutdown_tx.send(true);
    });
    Json(OkResponse { ok: true })
}

/// Kill all managed processes with a 5-second timeout, then force-kill stragglers.
async fn kill_all_managed(state: &AppState) {
    let ids = if let Ok(services) = state.services.read() {
        services.services.iter().map(|s| s.id.clone()).collect::<Vec<_>>()
    } else {
        Vec::new()
    };
    for id in &ids {
        let _ = state.process_manager.kill(id).await;
    }
    // Wait up to 5s for processes to die, then force-kill any stragglers
    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    for id in &ids {
        if state.process_manager.is_process_alive(id) {
            if let Some(pid) = state.process_manager.get_pid(id) {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output();
            }
        }
    }
}

// ── power control ───────────────────────────────────────────────────────────────

async fn power_control(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(action): Path<String>,
) -> Result<Json<OkResponse>, StatusCode> {
    log_audit(&format!("System power action '{}' triggered from IP: {}", action, addr.ip()));
    #[cfg(windows)] {
            match action.as_str() {
            "display-off" => {
                let ps = format!(
                    "$HWND = [IntPtr]0x{:X}; $WM_SYSCOMMAND = 0x{:X}; $SC_MONITORPOWER = 0x{:X}; Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);' -Name 'Win32' -Namespace 'Win32Functions' -PassThru; [Win32Functions.Win32]::SendMessage($HWND, $WM_SYSCOMMAND, $SC_MONITORPOWER, {})",
                    HWND_BROADCAST, WM_SYSCOMMAND, SC_MONITORPOWER, MONITOR_OFF
                );
                std::process::Command::new("powershell")
                    .args(["-NoProfile", "-Command", &ps])
                    .spawn()
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Ok(Json(OkResponse { ok: true }));
            }
            "sleep" => {
                std::process::Command::new("rundll32.exe")
                    .args(["powrprof.dll,SetSuspendState", "0", "1", "1"])
                    .spawn()
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            }
            "lock" => {
                std::process::Command::new("rundll32.exe")
                    .args(["user32.dll,LockWorkStation"])
                    .spawn()
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            }
            "restart" => {
                std::process::Command::new("shutdown")
                    .args(["/r", "/t", "30", "/c", "WinCTL remote restart"])
                    .spawn()
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Ok(Json(OkResponse { ok: true }));
            }
            "shutdown" => {
                std::process::Command::new("shutdown")
                    .args(["/s", "/t", "30", "/c", "WinCTL remote shutdown"])
                    .spawn()
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Ok(Json(OkResponse { ok: true }));
            }
            _ => return Err(StatusCode::NOT_FOUND),
        };
        Ok(Json(OkResponse { ok: true }))
    }
    #[cfg(not(windows))] {
        Err(StatusCode::NOT_FOUND)
    }
}

// ── router ───────────────────────────────────────────────────────────────────

fn get_dist_dir() -> String {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let p = dir.join("dist");
            if p.exists() { return p.to_string_lossy().into_owned(); }
            let p2 = dir.join("..").join("dist").join("dist");
            if p2.exists() { return p2.to_string_lossy().into_owned(); }
        }
    }
    "dist".to_string()
}

fn create_router(state: AppState, _server_port: u16) -> Router {
    let shared_state = Arc::new(state);
    let auth_key = Arc::new(shared_state.auth_key.clone());
    let open_access = shared_state.open_access.clone();

    let cors_layer = tower_http::cors::CorsLayer::new()
        .allow_origin(tower_http::cors::AllowOrigin::any())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("x-winctl-token"),
            HeaderName::from_static("authorization"),
        ])
        .expose_headers([HeaderName::from_static("x-winctl-token")]);

    let auth_layer = axum::middleware::from_fn_with_state(
        shared_state.clone(),
        move |request: Request<Body>, next: Next| {
            let auth_key = auth_key.clone();
            let open_access = open_access.clone();
            async move {
                let is_local = request.extensions()
                    .get::<ConnectInfo<SocketAddr>>()
                    .map(|ci| ci.0.ip().is_loopback())
                    .unwrap_or(false);

                if is_local {
                    // CSRF protection: if Origin header is present, validate it
                    if let Some(origin) = request.headers()
                        .get("origin")
                        .and_then(|v| v.to_str().ok())
                    {
                        // Allow localhost requests from any port (for Vite dev server)
                        let is_localhost = origin.starts_with("http://localhost:")
                            || origin.starts_with("http://127.0.0.1:")
                            || origin == "https://tauri.localhost"
                            || origin == "tauri://localhost";
                        if !is_localhost {
                            return axum::response::Response::builder()
                                .status(StatusCode::FORBIDDEN)
                                .body(Body::empty())
                                .unwrap();
                        }
                    }
                    // No Origin header = non-browser client (CLI, curl) — allow through
                    return next.run(request).await;
                }

                if open_access.load(std::sync::atomic::Ordering::Relaxed) {
                    return next.run(request).await;
                }

                let token = request.headers()
                    .get("x-winctl-token")
                    .and_then(|v| v.to_str().ok())
                    .or_else(|| {
                        request.headers()
                            .get(AUTHORIZATION)
                            .and_then(|v| v.to_str().ok())
                            .and_then(|v| v.strip_prefix("Bearer "))
                    });

                if token.map(|t| validate_token(t, &auth_key)).unwrap_or(false) {
                    return next.run(request).await;
                }
                axum::response::Response::builder()
                    .status(StatusCode::UNAUTHORIZED)
                    .body(Body::empty())
                    .unwrap()
            }
        },
    );

    // Setup routes must never be reachable cross-origin: before onboarding
    // completes, a webpage the user visits could otherwise POST /api/setup/complete
    // and hijack the instance. Restrict to loopback + trusted origins.
    let setup_routes = Router::new()
        .route("/api/setup/status", get(get_setup_status))
        .route("/api/setup/complete", post(complete_setup))
        .route("/api/setup/device/register", post(register_device))
        .route_layer(axum::middleware::from_fn(setup_guard))
        .with_state(shared_state.clone());

    let public_routes = Router::new()
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/ws", get(ws_handler))
        .route("/api/themes", get(themes_get))
        .route("/api/themes/{id}", delete(themes_delete))
        .fallback_service(ServeDir::new(get_dist_dir()))
        .with_state(shared_state.clone());

    let protected_routes = Router::new()
        .route("/api/fonts", get(get_fonts))
        .route("/api/services/reorder", put(reorder_services))
        .route("/api/services", get(get_services).post(create_service))
        .route("/api/services/{id}/start",   post(service_start))
        .route("/api/services/{id}/stop",    post(service_stop))
        .route("/api/services/{id}/restart", post(service_restart))
        .route("/api/services/{id}/logs",    get(service_logs))
        .route("/api/services/{id}",         put(update_service).delete(delete_service))
        .route("/api/folders/reorder", put(reorder_folders))
        .route("/api/folders",    get(folders_get).post(folders_create))
        .route("/api/folders/{id}", put(folders_update).delete(folders_delete))
        .route("/api/settings",   get(get_settings).put(update_settings))
        .route("/api/status",     get(get_status))
        .route("/api/themes",     post(themes_create))
        .route("/api/autostart",         get(autostart_get))
        .route("/api/autostart/enable",  post(autostart_enable))
        .route("/api/autostart/disable", post(autostart_disable))
        .route("/api/shutdown", post(shutdown_handler))
        .route("/api/restart", post(restart_handler))
        .route("/api/pc/{action}", post(power_control))
        .route("/api/system", get(get_system_info))
        .route("/api/system/flush-memory", post(flush_memory))
        .route("/api/exec", post(exec_command))
        .route("/api/exec/{execId}/kill", post(kill_exec_session))
        .route("/api/sysinfo/tools", get(get_sysinfo_tools))
        .route("/api/sysinfo/run", post(run_fetch_tool))
        .route_layer(auth_layer)
        .with_state(shared_state.clone());

    Router::new()
        .merge(setup_routes)
        .merge(public_routes)
        .merge(protected_routes)
        .layer(cors_layer)
}

fn forbidden() -> axum::response::Response {
    axum::response::Response::builder()
        .status(StatusCode::FORBIDDEN)
        .body(Body::empty())
        .unwrap()
}

/// Allow setup only from loopback with a trusted (or absent) Origin. Blocks a
/// malicious website from hijacking pre-onboarding setup via the user's browser.
async fn setup_guard(request: Request<Body>, next: Next) -> axum::response::Response {
    let is_local = request.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ci| ci.0.ip().is_loopback())
        .unwrap_or(false);
    if !is_local {
        return forbidden();
    }
    if let Some(origin) = request.headers().get("origin").and_then(|v| v.to_str().ok()) {
        let ok = origin.starts_with("http://localhost:")
            || origin.starts_with("http://127.0.0.1:")
            || origin == "https://tauri.localhost"
            || origin == "tauri://localhost";
        if !ok {
            return forbidden();
        }
    }
    next.run(request).await
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

async fn ws_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: axum::http::HeaderMap,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let origin = headers
        .get("origin")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let is_local = addr.ip().is_loopback();
    let port = state.settings.read().map(|s| s.port).unwrap_or(DEFAULT_PORT);
    let auth_key = state.auth_key.clone();

    // Determine if this connection needs auth
    let needs_auth = if is_local {
        // Localhost with valid or no Origin = exempt
        if let Some(ref o) = origin {
            let allowed = [
                format!("http://localhost:{}", port),
                format!("http://127.0.0.1:{}", port),
                "https://tauri.localhost".to_string(),
                "tauri://localhost".to_string(),
            ];
            !allowed.iter().any(|a| a == o)
        } else {
            false
        }
    } else {
        true
    };

    ws.on_upgrade(move |socket| handle_ws(socket, state, needs_auth, auth_key))
}

async fn handle_ws(socket: WebSocket, state: Arc<AppState>, needs_auth: bool, auth_key: String) {
    let (mut sender, mut receiver) = socket.split();

    // WebSocket authentication: wait up to 5s for auth message
    if needs_auth {
        let auth_result = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            async {
                while let Some(msg) = receiver.next().await {
                    if let Ok(Message::Text(text)) = msg {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                            if val.get("type").and_then(|t| t.as_str()) == Some("auth") {
                                if let Some(token) = val.get("token").and_then(|t| t.as_str()) {
                                    return validate_token(token, &auth_key);
                                }
                            }
                        }
                    }
                    return false;
                }
                false
            }
        ).await;

        match auth_result {
            Ok(true) => {} // authenticated
            _ => {
                let _ = sender.send(Message::Close(Some(axum::extract::ws::CloseFrame {
                    code: 4001,
                    reason: "Authentication required".into(),
                }))).await;
                return;
            }
        }
    }

    let mut rx = state.tx.subscribe();

    // Generate connection ID and register
    let conn_id = state.ws_conn_counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst).to_string();
    state.ws_connections.insert(conn_id.clone(), Vec::new());

    let drain = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            if matches!(msg, Ok(Message::Close(_))) { break; }
        }
    });

    loop {
        match rx.recv().await {
            Ok(msg) => {
                let payload = if msg == "update" {
                    let services = state.services.read().map(|s| s.clone()).ok();
                    let settings = state.settings.read().map(|s| s.clone()).ok();
                    let enriched = services.as_ref().map(|s| state.process_manager.enrich_services(&s.services));
                    serde_json::json!({
                        "type": "status",
                        "services": enriched,
                        "folders": services.as_ref().map(|s| &s.folders),
                        "settings": settings,
                    })
                } else {
                    serde_json::Value::from_str(&msg).unwrap_or_else(|_| serde_json::json!({ "type": "unknown" }))
                };
                if sender.send(Message::Text(payload.to_string().into())).await.is_err() {
                    break;
                }
            }
            Err(RecvError::Lagged(_)) => {
                let services = state.services.read().map(|s| s.clone()).ok();
                let settings = state.settings.read().map(|s| s.clone()).ok();
                if let Some(svc) = services {
                    let payload = serde_json::json!({
                        "type": "status",
                        "services": state.process_manager.enrich_services(&svc.services),
                        "folders":  svc.folders,
                        "settings": settings.unwrap_or_default(),
                    });
                    if sender.send(Message::Text(payload.to_string().into())).await.is_err() {
                        break;
                    }
                }
            }
            Err(RecvError::Closed) => break,
        }
    }
    drain.abort();

    // Clean up exec sessions for this connection
    if let Some((_, exec_ids)) = state.ws_connections.remove(&conn_id) {
        for exec_id in exec_ids {
            if let Some((_, child_arc)) = state.exec_children.remove(&exec_id) {
                let mut child_guard = child_arc.lock().await;
                if let Some(mut child) = child_guard.take() {
                    let _ = child.kill().await;
                }
            }
        }
    }
}

// ── Auto-start & supervision ──────────────────────────────────────────────────

/// Spawn auto-start services as a tokio task on the current runtime.
fn spawn_auto_start_services(state: &AppState) {
    let svcs = state.services.read().map(|s| s.services.clone()).unwrap_or_default();
    let global_auto_start = state.settings.read().map(|s| s.auto_start).unwrap_or(false);
    if !global_auto_start { return; }
    let pm = state.process_manager.clone();
    let tx = state.tx.clone();
    tokio::spawn(async move {
        for svc in svcs.iter().filter(|s| s.auto_start) {
            let pm = pm.clone();
            let tx = tx.clone();
            let s = svc.clone();
            tokio::spawn(async move {
                if s.start_delay_mins > 0 {
                    eprintln!("[winctl] '{}' auto-start delayed {} min", s.name, s.start_delay_mins);
                    tokio::time::sleep(std::time::Duration::from_secs(s.start_delay_mins as u64 * 60)).await;
                }
                match pm.spawn(&s).await {
                    Ok(()) => {
                        eprintln!("[winctl] started '{}'", s.name);
                        let _ = tx.send("update".to_string());
                    }
                    Err(e) if e.contains("already running") => {
                        eprintln!("[winctl] '{}' already running — supervising", s.name);
                        if let Some(pid) = find_process_by_command(&s.command, &s.args) {
                            if pm.supervise(&s, pid).await.is_ok() {
                                eprintln!("[winctl] supervising '{}' (PID {})", s.name, pid);
                                let _ = tx.send("update".to_string());
                            }
                        }
                    }
                    Err(e) => eprintln!("[winctl] auto-start failed for '{}': {}", s.name, e),
                }
            });
        }
    });
}

/// Spawn supervision loop as a tokio task on the current runtime.
fn spawn_supervision_loop(state: &AppState) {
    let pm = state.process_manager.clone();
    let services_arc = state.services.clone();
    let restart_locks = state.restart_locks.clone();
    let tx = state.tx.clone();
    tokio::spawn(async move {
        let restart_attempts = Arc::new(std::sync::Mutex::new(std::collections::HashMap::new()));

        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;

            let (svcs_to_check, stopped_svcs) = {
                if let Ok(services) = services_arc.read() {
                    let mut auto_restart = vec![];
                    let mut stopped = vec![];
                    for s in &services.services {
                        if s.auto_restart {
                            auto_restart.push(s.clone());
                        }
                        if pm.get_state(&s.id) == process::ServiceState::Stopped {
                            stopped.push(s.clone());
                        }
                    }
                    (auto_restart, stopped)
                } else {
                    (vec![], vec![])
                }
            };

            // Periodically check for processes that were started from outside
            if !stopped_svcs.is_empty() {
                let running_procs = find_all_running_processes();
                let mut updated = false;
                for svc in &stopped_svcs {
                    if let Some(pid) = find_process_in_map(&running_procs, &svc.command, &svc.args) {
                        if pm.supervise(svc, pid).await.is_ok() {
                            eprintln!("[winctl] picked up externally started service '{}' (PID {})", svc.name, pid);
                            updated = true;
                        }
                    }
                }
                if updated {
                    let _ = tx.send("update".to_string());
                }
            }

            for svc in svcs_to_check {
                if pm.is_process_alive(&svc.id) {
                    if let Ok(mut attempts) = restart_attempts.lock() {
                        attempts.remove(&svc.id);
                    }
                    continue;
                }

                // Skip if an explicit restart is in progress (non-blocking try_lock)
                let lock = restart_locks
                    .entry(svc.id.clone())
                    .or_insert_with(|| Arc::new(AsyncMutex::new(())))
                    .clone();
                let Ok(_guard) = lock.try_lock() else {
                    continue; // explicit restart holds the lock — skip this cycle
                };

                let delay_secs = {
                    if let Ok(mut attempts) = restart_attempts.lock() {
                        let attempt = attempts.get(&svc.id).copied().unwrap_or(0);
                        let delay = (2_u64.pow(attempt)).min(30);
                        attempts.insert(svc.id.clone(), attempt + 1);
                        delay
                    } else {
                        1
                    }
                };

                let pm_clone = pm.clone();
                let svc_clone = svc.clone();
                let attempts_clone = restart_attempts.clone();
                tokio::spawn(async move {
                    eprintln!("[winctl] '{}' died unexpectedly, restarting in {}s", svc_clone.name, delay_secs);
                    tokio::time::sleep(std::time::Duration::from_secs(delay_secs)).await;
                    if let Err(e) = pm_clone.spawn(&svc_clone).await {
                        eprintln!("[winctl] restart failed for '{}': {}", svc_clone.name, e);
                    } else {
                        eprintln!("[winctl] restarted '{}'", svc_clone.name);
                        if let Ok(mut attempts) = attempts_clone.lock() {
                            attempts.remove(&svc_clone.id);
                        }
                    }
                });
            }
        }
    });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

/// Start the HTTP server, auto-start services, and supervision loop on a single Tokio runtime.
fn start_server(state: AppState) {
    let mut shutdown_rx = state.shutdown_tx.subscribe();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
        rt.block_on(async {
            // Spawn auto-start and supervision as tasks on this single runtime
            spawn_auto_start_services(&state);
            spawn_supervision_loop(&state);

            // Initial process discovery
            {
                let pm = state.process_manager.clone();
                let svcs = state.services.read().map(|s| s.services.clone()).unwrap_or_default();
                let tx = state.tx.clone();
                tokio::spawn(async move {
                    let running_procs = find_all_running_processes();
                    let mut updated = false;
                    for svc in svcs {
                        if let Some(pid) = find_process_in_map(&running_procs, &svc.command, &svc.args) {
                            if pm.supervise(&svc, pid).await.is_ok() {
                                eprintln!("[winctl] initial scan: supervising '{}' (PID {})", svc.name, pid);
                                updated = true;
                            }
                        }
                    }
                    if updated {
                        let _ = tx.send("update".to_string());
                    }
                });
            }

            let (port, bind_host) = {
                let settings = state.settings.read().ok();
                let port: u16 = settings.as_ref()
                    .map(|s| s.port)
                    .filter(|&p| p > 0)
                    .or_else(|| std::env::var("WINCTL_PORT").ok().and_then(|p| p.parse().ok()))
                    .unwrap_or(DEFAULT_PORT);
                let bind_host = settings
                    .map(|s| s.bind_host.clone())
                    .unwrap_or_else(|| "127.0.0.1".to_string());
                (port, bind_host)
            };
            let ip = IpAddr::from_str(&bind_host).unwrap_or(IpAddr::from([127, 0, 0, 1]));
            let addr = SocketAddr::from((ip, port));
            let app = create_router(state, port);
            eprintln!("WinCTL HTTP server on http://{}:{}", bind_host, port);
            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => {
                    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
                        .with_graceful_shutdown(async move {
                            let _ = shutdown_rx.changed().await;
                        })
                        .await
                        .ok();
                }
                Err(e) => {
                    eprintln!("Cannot bind port {}: {}. Try WINCTL_PORT=<other>.", port, e);
                }
            }
        });
    });
}

fn create_app_state() -> AppState {
    let services = config::read_services().unwrap_or_default();
    let mut settings = config::read_settings().unwrap_or_default();
    let (tx, _rx) = broadcast::channel::<String>(100);

    // Migrate plaintext api_secret to argon2 hash
    if let Some(ref secret) = settings.api_secret {
        if !secret.starts_with("$argon2") {
            match hash_password(secret) {
                Ok(hashed) => {
                    settings.api_secret = Some(hashed);
                    if let Err(e) = config::write_settings(&settings) {
                        eprintln!("[winctl] warning: failed to migrate password hash: {}", e);
                    } else {
                        eprintln!("[winctl] migrated api_secret to argon2 hash");
                    }
                }
                Err(e) => eprintln!("[winctl] warning: password hash migration failed: {}", e),
            }
        }
    }

    // Persist default settings on first run so trusted_devices and signing_key survive restarts
    if settings.api_secret.is_none() {
        let _ = config::write_settings(&settings);
    }

    let settings = settings; // reborrow for later use
    let signing_key = settings.signing_key.clone().unwrap_or_else(|| {
        let key = Uuid::new_v4().simple().to_string();
        let mut updated_settings = settings.clone();
        updated_settings.signing_key = Some(key.clone());
        let _ = config::write_settings(&updated_settings);
        key
    });

    let open_access = settings.open_access;

    let pm = Arc::new(process::Manager::new());

    let (shutdown_tx, _shutdown_rx) = tokio::sync::watch::channel(false);

    AppState {
        services: Arc::new(RwLock::new(services)),
        settings: Arc::new(RwLock::new(settings)),
        process_manager: pm,
        tx,
        auth_key: signing_key,
        exec_children: Arc::new(DashMap::new()),
        open_access: Arc::new(std::sync::atomic::AtomicBool::new(open_access)),
        ws_connections: Arc::new(DashMap::new()),
        ws_conn_counter: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        shutdown_tx,
        restart_locks: Arc::new(DashMap::new()),
    }
}

// ── entry point ───────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 {
        match args[1].as_str() {
            "init" => {
                let exe_path = match std::env::current_exe() {
                    Ok(p) => p,
                    Err(e) => {
                        eprintln!("Cannot find executable: {}", e);
                        std::process::exit(1);
                    }
                };

                if let Err(e) = config::ensure_config_dir() {
                    eprintln!("Failed to create config dir: {}", e);
                    std::process::exit(1);
                }
                if let Err(e) = config::ensure_themes_dir() {
                    eprintln!("Failed to create themes dir: {}", e);
                    std::process::exit(1);
                }

                let dest_exe = config::config_dir().join("winctl.exe");
                if !dest_exe.exists() {
                    if let Err(e) = std::fs::copy(&exe_path, &dest_exe) {
                        eprintln!("Failed to install winctl: {}", e);
                        std::process::exit(1);
                    }
                }

                let fw_output = std::process::Command::new("netsh")
                    .args(["advfirewall", "firewall", "add", "rule", "name=WinCTL", "dir=in", "action=allow", "profile=private,domain", &format!("program={}", dest_exe.to_string_lossy()), "enable=yes"])
                    .output();

                match fw_output {
                    Ok(output) => {
                        if output.status.success() {
                            println!("Firewall rule 'WinCTL' added.");
                        } else {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            eprintln!("Warning: Could not add firewall rule: {}", stderr);
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Could not add firewall rule: {}", e);
                    }
                }

                let config_path = config::config_dir().to_string_lossy().to_string();
                let current_path = std::env::var("PATH").unwrap_or_default();
                let new_path = format!("{};{}", config_path, current_path);
                let setx_output = std::process::Command::new("setx")
                    .args(["PATH", &new_path])
                    .output();

                match setx_output {
                    Ok(output) => {
                        if output.status.success() {
                            println!("WinCTL installed to {}", config_path);
                            println!("Restart your terminal to use 'winctl' from anywhere.");
                        } else {
                            let stderr = String::from_utf8_lossy(&output.stderr);
                            println!("WinCTL installed to {}", config_path);
                            eprintln!("Warning: Could not update PATH automatically: {}", stderr);
                            eprintln!("Please add '{}' to your PATH manually.", config_path);
                        }
                    }
                    Err(_e) => {
                        println!("WinCTL installed to {}", config_path);
                        eprintln!("Warning: Could not update PATH automatically.");
                        eprintln!("Please add '{}' to your PATH manually.", config_path);
                    }
                }
                return;
            }
            "start" | "stop" | "restart" | "status" | "services" | "setup-firewall"
            | "start-svc" | "stop-svc" | "restart-svc" | "logs" | "open" => {
                run_cli(&args[1..]);
                return;
            }
            "--pass" => {
                if let Err(e) = copy_password_to_clipboard() {
                    eprintln!("{}", e);
                    std::process::exit(1);
                }
                return;
            }
            _ => {}
        }
    }

    let headless     = args.iter().any(|a| a == "--headless");
    let service_mode = args.iter().any(|a| a == "--service");

    let _ = config::ensure_config_dir();
    let _ = config::ensure_themes_dir();

    let state           = create_app_state();
    let state_for_tauri = state.clone();

    if service_mode {
        start_server(state.clone());
        let _ = state_for_tauri.tx.send("update".to_string());
    } else {
        let _ = state_for_tauri.tx.send("update".to_string());
        start_server(state_for_tauri.clone());
    }

    if headless {
        run_headless_with_state(state_for_tauri);
    } else {
        run_gui_with_state(state_for_tauri);
    }
}

// ── Tauri GUI / headless modes ────────────────────────────────────────────────

fn broadcast_listener(
    tx: broadcast::Sender<String>,
    state: AppState,
    handle: tauri::AppHandle,
) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all().build().expect("event-forward runtime");
        rt.block_on(async {
            let mut rx = tx.subscribe();
            loop {
                match rx.recv().await {
                    Ok(msg) => {
                        // Forward non-status messages (exec-output, exec-done) directly
                        if msg != "update" {
                            if let Ok(parsed) = serde_json::Value::from_str(&msg) {
                                let _ = handle.emit("ws-message", parsed);
                            }
                            continue;
                        }
                        let services = state.services.read().map(|s| s.clone()).ok();
                        let settings = state.settings.read().map(|s| s.clone()).ok();
                        if let Some(svc) = services {
                            let enriched = state.process_manager.enrich_services(&svc.services);
                            let _ = handle.emit("status", serde_json::json!({
                                "type": "status",
                                "services": enriched,
                                "folders":  svc.folders,
                                "settings": settings.unwrap_or_default(),
                            }));
                        }
                    }
                    Err(RecvError::Lagged(_)) => {
                        let services = state.services.read().map(|s| s.clone()).ok();
                        let settings = state.settings.read().map(|s| s.clone()).ok();
                        if let Some(svc) = services {
                            let enriched = state.process_manager.enrich_services(&svc.services);
                            let _ = handle.emit("status", serde_json::json!({
                                "type": "status",
                                "services": enriched,
                                "folders":  svc.folders,
                                "settings": settings.unwrap_or_default(),
                            }));
                        }
                    }
                    Err(RecvError::Closed) => break,
                }
            }
        });
    });
}

fn run_gui_with_state(state: AppState) {
    // HTTP server already started by run() — don't start again
    let state_clone = state.clone();
    tauri::Builder::default()
        .setup(move |app| {
            let open_item = MenuItem::with_id(app, "open",  "Open WinCTL",  true, None::<&str>)?;
            let show_item = MenuItem::with_id(app, "show",  "Show Window",  true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide",  "Hide Window",  true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit",  "Quit",         true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &show_item, &hide_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("WinCTL - Service Manager")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" | "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show(); let _ = w.set_focus();
                        }
                    }
                    "hide" => { if let Some(w) = app.get_webview_window("main") { let _ = w.hide(); } }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .build(app)?;

            let handle = app.handle().clone();
            if let Ok(svc) = state_clone.services.read() {
                let settings = state_clone.settings.read().map(|s| s.clone()).ok();
                let enriched = state_clone.process_manager.enrich_services(&svc.services);
                let _ = handle.emit("status", serde_json::json!({
                    "type": "status",
                    "services": enriched,
                    "folders":  svc.folders,
                    "settings": settings.unwrap_or_default(),
                }));
            }

            broadcast_listener(state_clone.tx.clone(), state_clone.clone(), app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn run_headless_with_state(state: AppState) {
    let port: u16 = std::env::var("WINCTL_PORT")
        .ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);
    let state_clone = state.clone();

    tauri::Builder::default()
        .setup(move |app| {
            let open_item = MenuItem::with_id(app, "open", "Open Browser", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit",         true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("WinCTL (Headless)")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => { let _ = open::that(format!("http://localhost:{}", port)); }
                    "quit" => { app.exit(0); }
                    _ => {}
                })
                .build(app)?;

            broadcast_listener(state_clone.tx.clone(), state_clone.clone(), app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


fn run_cli(args: &[String]) {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all().build().expect("cli runtime");
    if let Err(e) = rt.block_on(run_cli_async(args)) {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}

async fn run_cli_async(args: &[String]) -> Result<(), String> {
    let port: u16 = std::env::var("WINCTL_PORT")
        .ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT);
    let raw_cmd = args.first().map(|s| s.as_str()).unwrap_or("");
    let is_svc = matches!(raw_cmd, "start-svc" | "stop-svc" | "restart-svc");
    let has_target = args.get(1).map(|s| !s.is_empty()).unwrap_or(false);
    // Map svc subcommands to their base counterparts
    let cmd = match raw_cmd {
        "start-svc" => "start",
        "stop-svc" => "stop",
        "restart-svc" => "restart",
        other => other,
    };
    // Bare start/stop/restart with no service target act on the daemon itself.
    let daemon_level = matches!(cmd, "start" | "stop" | "restart") && !is_svc && !has_target;
    let base = format!("http://127.0.0.1:{}", port);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let no_server = |e: reqwest::Error| -> String {
        if e.is_connect() || e.is_timeout() {
            format!("WinCTL server is not running on port {}. Start with 'winctl start'.", port)
        } else {
            format!("Request failed: {}", e)
        }
    };

    if daemon_level {
        match cmd {
            "start" => {
                let running = client.get(format!("{}/api/status", base))
                    .send().await.map(|r| r.status().is_success()).unwrap_or(false);
                if running {
                    println!("WinCTL is already running on port {}.", port);
                } else {
                    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
                    std::process::Command::new(exe).arg("--headless").spawn()
                        .map_err(|e| format!("Failed to start WinCTL: {}", e))?;
                    println!("WinCTL started on port {}.", port);
                }
            }
            "stop" => {
                client.post(format!("{}/api/shutdown", base)).send().await.map_err(no_server)?;
                println!("WinCTL stopped.");
            }
            "restart" => {
                client.post(format!("{}/api/restart", base)).send().await.map_err(no_server)?;
                println!("WinCTL restarting…");
            }
            _ => {}
        }
        return Ok(());
    }

    match cmd {
        "start" => {
            let id = args.get(1).cloned().unwrap_or_default();
            let resp = client.post(format!("{}/api/services/{}/start", base, id))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                println!("Service started");
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "stop" => {
            let id = args.get(1).cloned().unwrap_or_default();
            let resp = client.post(format!("{}/api/services/{}/stop", base, id))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                println!("Service stopped");
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "restart" => {
            let id = args.get(1).cloned().unwrap_or_default();
            let resp = client.post(format!("{}/api/services/{}/restart", base, id))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                println!("Service restarted");
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "status" => {
            let resp = client.get(format!("{}/api/services", base))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                let parsed: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                if let Some(arr) = parsed.get("services") {
                    println!("{}", serde_json::to_string_pretty(arr).unwrap_or_default());
                } else {
                    println!("{}", serde_json::to_string_pretty(&parsed).unwrap_or_default());
                }
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "services" => {
            let resp = client.get(format!("{}/api/services", base))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                let parsed: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
                if let Some(arr) = parsed.get("services") {
                    println!("{}", serde_json::to_string_pretty(arr).unwrap_or_default());
                } else {
                    println!("{}", serde_json::to_string_pretty(&parsed).unwrap_or_default());
                }
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "logs" => {
            let id = args.get(1).cloned().unwrap_or_default();
            let resp = client.get(format!("{}/api/services/{}/logs", base, id))
                .send().await
                .map_err(no_server)?;
            if resp.status().is_success() {
                let logs: Vec<process::LogEntry> = resp.json().await.map_err(|e| e.to_string())?;
                for entry in logs {
                    println!("[{}] {}", &entry.t[11..19.min(entry.t.len())], entry.line);
                }
            } else {
                eprintln!("Error: {}", resp.status());
            }
        }
        "open" => {
            open::that(format!("http://localhost:{}", port)).map_err(|e| e.to_string())?;
        }
        "setup-firewall" => {
            let dest_exe = config::config_dir().join("winctl.exe");
            let fw_output = std::process::Command::new("netsh")
                .args(["advfirewall", "firewall", "add", "rule", "name=WinCTL", "dir=in", "action=allow", "profile=private,domain", &format!("program={}", dest_exe.to_string_lossy()), "enable=yes"])
                .output()
                .map_err(|e| e.to_string())?;
            if fw_output.status.success() {
                println!("Firewall rule 'WinCTL' added.");
            } else {
                eprintln!("Failed to add firewall rule");
            }
        }
        _ => {
            eprintln!("Unknown command: {}", cmd);
            eprintln!("Usage: winctl <start|stop|restart|status|services|logs|open|setup-firewall> [service-id]");
        }
    }
    Ok(())
}
