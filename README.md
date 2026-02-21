# WinCTL — Windows Process Manager

A lightweight, self-hosted web dashboard to manage Windows processes/services.
No Docker. No WSL. No Linux. Just Node.js.

---

## Requirements

- **Node.js 18+** → https://nodejs.org
- Windows 10/11

---

## Quick Start

1. Extract this folder anywhere (e.g. `C:\winctl`)
2. Double-click `start.bat`
3. Open `http://localhost:3500` in any browser
4. From your phone/tablet: `http://<your-pc-ip>:3500`

> Find your PC's local IP: run `ipconfig` in cmd, look for IPv4 Address

---

## Features

| Feature | Detail |
|---|---|
| Web UI | Mobile-friendly dashboard, works from any browser |
| Start/Stop/Restart | Per-service controls with live status |
| Real-time logs | Live streaming output per service |
| Auto-restart on crash | Exponential backoff (1s → 30s cap) |
| Auto-start at boot | Services start when WinCTL launches |
| Port links | Clickable links to open services in browser |
| Persistent config | All services saved to `services.json` |
| System stats | CPU, RAM, hostname, uptime |

---

## Adding a Service

Click **+ New Service** and fill in:

- **Name** — display name
- **Command** — executable path or command (e.g. `node`, `python`, `C:\myapp\app.exe`)
- **Arguments** — command-line args (e.g. `server.js --port 3000`)
- **Working Directory** — where the process runs from
- **Port** — optional, creates a clickable link to `localhost:PORT`
- **Auto-restart on crash** — re-launches if it exits with non-zero code
- **Start on WinCTL boot** — launches automatically when WinCTL starts

---

## Auto-start WinCTL itself at login

Run `install-startup.bat` **as Administrator** once.
This registers WinCTL in Task Scheduler to start at every login.

To remove: `schtasks /delete /tn "WinCTL" /f`

---

## Config file

`services.json` in the WinCTL folder — plain JSON, human-readable, safe to back up.

---

## Change the port

Set `PORT` environment variable before starting:

```bat
set PORT=8080 && node server.js
```

Or edit `start.bat` to add `set PORT=8080` at the top.

---

## Access from other devices (phone, tablet, etc.)

1. Make sure Windows Firewall allows inbound on port 3500
2. Find your IP: `ipconfig` → IPv4
3. Open `http://192.168.x.x:3500` on any device on the same network

To allow in firewall (run as Admin):
```
netsh advfirewall firewall add rule name="WinCTL" dir=in action=allow protocol=TCP localport=3500
```
