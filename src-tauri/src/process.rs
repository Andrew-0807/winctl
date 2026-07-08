use crate::config::Service;
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock};
// use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::Threading::{OpenProcess, GetExitCodeProcess, PROCESS_QUERY_INFORMATION};
use windows::Win32::System::JobObjects::{
    CreateJobObjectW, SetInformationJobObject, AssignProcessToJobObject, TerminateJobObject,
    QueryInformationJobObject, JobObjectBasicAccountingInformation,
    JobObjectExtendedLimitInformation, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOBOBJECT_BASIC_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION,
};
use serde::{Serialize, Deserialize};

// STILL_ACTIVE is 259 (0x103) on Windows
const STILL_ACTIVE: u32 = 0x103;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub t: String,
    pub line: String,
}

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ServiceState {
    Starting,
    Running,
    Stopping,
    Stopped,
}

#[derive(Clone, Copy, Debug)]
pub struct SafeHandle(pub HANDLE);

unsafe impl Send for SafeHandle {}
unsafe impl Sync for SafeHandle {}

pub struct Process {
    pub child:           Option<tokio::process::Child>,
    pub pid:             Option<u32>,
    pub logs:            Arc<RwLock<VecDeque<LogEntry>>>,
    pub started_at:      Option<chrono::DateTime<chrono::Utc>>,
    pub restart_count:   u32,
    pub state:           ServiceState,
    pub startup_error:   Option<String>,
    pub externally_owned: bool,
    pub job_handle:      Option<SafeHandle>,
}

impl Drop for Process {
    fn drop(&mut self) {
        if let Some(sh) = self.job_handle.take() {
            let h = sh.0;
            unsafe {
                let _ = TerminateJobObject(h, 1);
                let _ = CloseHandle(h);
            }
        }
    }
}

impl Default for Process {
    fn default() -> Self {
        Process {
            child:           None,
            pid:             None,
            logs:            Arc::new(RwLock::new(VecDeque::with_capacity(500))),
            started_at:      None,
            restart_count:   0,
            state:           ServiceState::Stopped,
            startup_error:   None,
            externally_owned: false,
            job_handle:      None,
        }
    }
}

pub struct Manager {
    processes: RwLock<HashMap<String, Process>>,
}

impl Manager {
    pub fn new() -> Self {
        Manager { processes: RwLock::new(HashMap::new()) }
    }

    /// Atomically claim the slot (set state -> Starting) before spawning,
    /// eliminating the TOCTOU race between "is running?" check and insert.
    pub async fn spawn(&self, svc: &Service) -> Result<(), String> {
        let id = svc.id.clone();

        // Phase 1: claim the slot under write lock.
        // Any concurrent spawn() call for the same id will see Starting and return an error.
        let is_restart = {
            let mut map = self.processes.write()
                .map_err(|_| "process map lock poisoned".to_string())?;
            let already_existed = map.contains_key(&id);
            let proc = map.entry(id.clone()).or_default();
            match proc.state {
                ServiceState::Running | ServiceState::Starting => {
                    return Err(format!("Service '{}' is already running", svc.name));
                }
                _ => {
                    proc.state = ServiceState::Starting;
                    already_existed
                }
            }
        };

        // Phase 2: build and spawn the child process (outside the lock - can't hold
        // std::sync::RwLock across an .await point).
        let mut cmd = Command::new(&svc.command);
        if !svc.args.is_empty() {
            match shell_words::split(&svc.args) {
                Ok(args) => { cmd.args(args); }
                Err(e) => {
                    self.set_startup_error(&id, &format!("Invalid args for '{}': {}", svc.name, e));
                    self.reset_stopped(&id);
                    return Err(format!("Invalid args for '{}': {}", svc.name, e));
                }
            }
        }
        if !svc.cwd.is_empty() {
            cmd.current_dir(&svc.cwd);
        }
        if !svc.env.is_empty() {
            cmd.envs(&svc.env);
        }
        if svc.minimized {
            #[cfg(windows)]
            {
                cmd.creation_flags(CREATE_NO_WINDOW);
            }
        }
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.kill_on_drop(true);

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                self.set_startup_error(&id, &format!("Failed to spawn '{}': {}", svc.name, e));
                self.reset_stopped(&id);
                return Err(format!("Failed to spawn '{}': {}", svc.name, e));
            }
        };

        let pid  = child.id();

        // Create and configure Job Object on Windows
        let mut final_job_handle = None;
        if let Ok(job_handle) = unsafe { CreateJobObjectW(None, None) } {
            let mut basic_info = JOBOBJECT_BASIC_LIMIT_INFORMATION::default();
            basic_info.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let mut extended_info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            extended_info.BasicLimitInformation = basic_info;

            let info_set = unsafe {
                SetInformationJobObject(
                    job_handle,
                    JobObjectExtendedLimitInformation,
                    &extended_info as *const _ as *const _,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };

            if info_set.is_ok() {
                if let Some(raw_h) = child.raw_handle() {
                    let proc_h = HANDLE(raw_h as _);
                    unsafe {
                        match AssignProcessToJobObject(job_handle, proc_h) {
                            Ok(_) => {
                                final_job_handle = Some(SafeHandle(job_handle));
                            }
                            Err(e) => {
                                eprintln!("[winctl] Warning: Failed to assign process '{}' to Job Object: {}. Process tree killing may not work.", svc.name, e);
                                let _ = CloseHandle(job_handle);
                            }
                        }
                    }
                } else {
                    unsafe { let _ = CloseHandle(job_handle); }
                }
            } else {
                unsafe { let _ = CloseHandle(job_handle); }
            }
        }

        let logs = Arc::new(RwLock::new(VecDeque::<LogEntry>::with_capacity(500)));

        // Attach async log readers
        if let Some(stdout) = child.stdout.take() {
            let logs_clone = logs.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Ok(mut buf) = logs_clone.write() {
                        if buf.len() >= 500 { buf.pop_front(); }
                        let t = chrono::Utc::now().to_rfc3339();
                        buf.push_back(LogEntry { t, line });
                    }
                }
            });
        }
        if let Some(stderr) = child.stderr.take() {
            let logs_clone = logs.clone();
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    if let Ok(mut buf) = logs_clone.write() {
                        if buf.len() >= 500 { buf.pop_front(); }
                        let t = chrono::Utc::now().to_rfc3339();
                        buf.push_back(LogEntry { t, line });
                    }
                }
            });
        }

        // Phase 3: store the running process.
        let mut child_to_kill = None;
        {
            let mut map = self.processes.write()
                .map_err(|_| "process map lock poisoned on commit".to_string())?;
            let proc = map.entry(id).or_default();
            if proc.state == ServiceState::Starting {
                proc.child           = Some(child);
                proc.pid             = pid;
                proc.logs            = logs;
                proc.started_at      = Some(chrono::Utc::now());
                proc.state           = ServiceState::Running;
                proc.startup_error   = None;
                proc.externally_owned = false;
                proc.job_handle      = final_job_handle;
                if is_restart {
                    proc.restart_count += 1;
                }
            } else {
                // The service state was modified (e.g. stopped/killed) during spawn preparation
                child_to_kill = Some((child, final_job_handle));
            }
        }

        if let Some((mut c, jh)) = child_to_kill {
            if let Some(sh) = jh {
                let h = sh.0;
                unsafe {
                    let _ = TerminateJobObject(h, 1);
                    let _ = CloseHandle(h);
                }
            } else {
                let _ = c.kill().await;
            }
        }

        Ok(())
    }

    pub async fn kill(&self, id: &str) -> Result<(), String> {
        let (child, pid, is_external, job_handle) = {
            let mut map = self.processes.write()
                .map_err(|_| "process map lock poisoned".to_string())?;
            if let Some(proc) = map.get_mut(id) {
                proc.state = ServiceState::Stopping;
                (proc.child.take(), proc.pid, proc.externally_owned, proc.job_handle.take())
            } else {
                return Ok(());
            }
        };

        if let Some(sh) = job_handle {
            let job_h = sh.0;
            unsafe {
                let _ = TerminateJobObject(job_h, 1);
                let _ = CloseHandle(job_h);
            }
            if let Some(mut child) = child {
                let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
                loop {
                    match child.wait().await {
                        Ok(_) => break,
                        Err(_) => {
                            if tokio::time::Instant::now() >= deadline {
                                break;
                            }
                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                        }
                    }
                }
            }
        } else if let Some(mut child) = child {
            let _ = child.kill().await;
            let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(5);
            loop {
                match child.wait().await {
                    Ok(_) => break,
                    Err(_) => {
                        if tokio::time::Instant::now() >= deadline {
                            let _ = child.kill().await;
                            break;
                        }
                        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    }
                }
            }
        } else if is_external {
            if let Some(pid) = pid {
                let output = std::process::Command::new("taskkill")
                    .args(["/F", "/T", "/PID", &pid.to_string()])
                    .output()
                    .map_err(|e| format!("taskkill failed: {}", e))?;
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("[winctl] taskkill /T /F failed for PID {}: {}", pid, stderr);
                }
            }
        }

        if let Ok(mut map) = self.processes.write() {
            if let Some(proc) = map.get_mut(id) {
                proc.state = ServiceState::Stopped;
                proc.pid   = None;
            }
        }
        Ok(())
    }

    pub fn logs(&self, id: &str, max_lines: Option<usize>) -> Vec<LogEntry> {
        if let Ok(map) = self.processes.read() {
            if let Some(proc) = map.get(id) {
                if let Ok(buf) = proc.logs.read() {
                    let limit = max_lines.unwrap_or(usize::MAX);
                    let start = buf.len().saturating_sub(limit);
                    return buf.iter().skip(start).cloned().collect();
                }
            }
        }
        vec![]
    }

    fn set_startup_error(&self, id: &str, msg: &str) {
        if let Ok(mut map) = self.processes.write() {
            if let Some(proc) = map.get_mut(id) {
                proc.startup_error = Some(msg.to_string());
            }
        }
    }

    /// Supervise an externally-running process (not spawned by us) by PID.
    /// Does not kill or restart - only tracks it for kill/restart supervision.
    pub async fn supervise(&self, svc: &Service, pid: u32) -> Result<(), String> {
        let id = svc.id.clone();
        let mut map = self.processes.write()
            .map_err(|_| "process map lock poisoned".to_string())?;

        let proc = map.entry(id).or_default();
        proc.pid = Some(pid);
        proc.state = ServiceState::Running;
        proc.externally_owned = true;
        proc.startup_error = None;
        Ok(())
    }

    /// Reset a slot to Stopped - used when spawn preparation fails after claiming.
    fn reset_stopped(&self, id: &str) {
        if let Ok(mut map) = self.processes.write() {
            if let Some(proc) = map.get_mut(id) {
                proc.state = ServiceState::Stopped;
            }
        }
    }

    /// Check if a running process is still alive, reaping it if it has exited.
    /// Owned children are polled with `try_wait()` (non-blocking) — `child.id()`
    /// alone stays `Some` forever because nothing else reaps them, which would
    /// make auto-restart never fire. Externally-owned processes are checked via
    /// the Windows API on their stored PID.
    pub fn is_process_alive(&self, id: &str) -> bool {
        let mut map = match self.processes.write() {
            Ok(m) => m,
            Err(_) => return false,
        };
        let Some(proc) = map.get_mut(id) else { return false; };
        if proc.state != ServiceState::Running { return false; }

        if proc.externally_owned {
            let alive = proc.pid.map(|pid| unsafe {
                let handle = OpenProcess(PROCESS_QUERY_INFORMATION, false, pid);
                if let Ok(handle) = handle {
                    let mut exit_code: u32 = 0;
                    let a = GetExitCodeProcess(handle, &mut exit_code).is_ok()
                        && exit_code == STILL_ACTIVE;
                    let _ = CloseHandle(handle);
                    a
                } else {
                    false
                }
            }).unwrap_or(false);
            if !alive {
                proc.state = ServiceState::Stopped;
                proc.pid = None;
            }
            return alive;
        }

        // Owned child: check Job Object first if present
        if let Some(sh) = proc.job_handle {
            let job_h = sh.0;
            let mut info = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
            let res = unsafe {
                QueryInformationJobObject(
                    Some(job_h),
                    JobObjectBasicAccountingInformation,
                    &mut info as *mut _ as *mut _,
                    std::mem::size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
                    None,
                )
            };
            if res.is_ok() {
                if info.ActiveProcesses > 0 {
                    // There are still active processes in the job, so it's alive!
                    return true;
                } else {
                    // No active processes, so it's dead. Clean up the job handle.
                    if let Some(sh) = proc.job_handle.take() {
                        unsafe {
                            let _ = CloseHandle(sh.0);
                        }
                    }
                    proc.child = None;
                    proc.pid = None;
                    proc.state = ServiceState::Stopped;
                    return false;
                }
            }
        }

        // Fallback or if there's no job object: reap non-blocking. Ok(None) = still running.
        match proc.child.as_mut().map(|c| c.try_wait()) {
            Some(Ok(None)) => true,
            _ => {
                if let Some(sh) = proc.job_handle.take() {
                    unsafe {
                        let _ = CloseHandle(sh.0);
                    }
                }
                proc.child = None;
                proc.pid = None;
                proc.state = ServiceState::Stopped;
                false
            }
        }
    }

    pub fn get_pid(&self, id: &str) -> Option<u32> {
        self.processes.read().ok()
            .and_then(|map| map.get(id).and_then(|proc| proc.pid))
    }

    pub fn get_state(&self, id: &str) -> ServiceState {
        if let Ok(map) = self.processes.read() {
            if let Some(proc) = map.get(id) {
                return proc.state;
            }
        }
        ServiceState::Stopped
    }


    pub fn enrich_services(&self, services: &[crate::config::Service]) -> Vec<serde_json::Value> {
        let map = match self.processes.read() {
            Ok(map) => map,
            Err(e) => {
                eprintln!("enrich_services: poisoned RwLock: {}", e);
                return services.iter().map(|svc| {
                    let mut val = serde_json::to_value(svc).unwrap();
                    if let Some(obj) = val.as_object_mut() {
                        obj.insert("status".to_string(), serde_json::json!("stopped"));
                    }
                    val
                }).collect();
            }
        };
        services.iter().map(|svc| {
            let mut val = serde_json::to_value(svc).unwrap();
            if let Some(obj) = val.as_object_mut() {
                if let Some(proc) = map.get(&svc.id) {
                    let status_str = match proc.state {
                        ServiceState::Starting => "starting",
                        ServiceState::Running => "running",
                        ServiceState::Stopping => "stopping",
                        ServiceState::Stopped => "stopped",
                    };
                    obj.insert("status".to_string(), serde_json::json!(status_str));
                    obj.insert("pid".to_string(), serde_json::json!(proc.pid));
                    obj.insert("restartCount".to_string(), serde_json::json!(proc.restart_count));
                    obj.insert("startupError".to_string(), serde_json::json!(proc.startup_error));
                    obj.insert("externallyOwned".to_string(), serde_json::json!(proc.externally_owned));
                    if let Some(dt) = proc.started_at {
                        obj.insert("startedAt".to_string(), serde_json::json!(dt.to_rfc3339()));
                    }
                } else {
                    obj.insert("status".to_string(), serde_json::json!("stopped"));
                }
            }
            val
        }).collect()
    }
}

impl Default for Manager {
    fn default() -> Self { Manager::new() }
}

