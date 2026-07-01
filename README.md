# System HUD

Iron Man style system monitor. PWA installable, reads real hardware stats (CPU, RAM, GPU, disk, network) via Python natively on Windows.

## Stack

- **Backend**: Python + Flask — serves system metrics via `/api/stats` every 1.5s
- **Frontend**: Vanilla HTML/CSS/JS — HUD aesthetic with neon glow, animated sparklines, per-core bars
- **PWA**: `manifest.json` + service worker — installable as a standalone app (no browser bar)

## Requirements

- Windows 10/11
- Python 3.10+ (Windows native, not WSL)
- NVIDIA GPU with drivers installed (optional, for GPU panel)

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Then open `http://localhost:5000` in your browser. To install as PWA: click the install icon (⊕) in the address bar.

## Auto-start with Windows

Create a file called `SystemHUD.vbs` in your Windows Startup folder (`Win + R` → `shell:startup`) with this content, replacing `YOUR_USERNAME` with your Windows username:

```vbscript
Dim wsh
Set wsh = CreateObject("WScript.Shell")
wsh.Run "pythonw C:\Users\YOUR_USERNAME\path\to\system-hud\app.py", 0, False
Set wsh = Nothing
```

This runs the server silently at login with no window. Open the PWA manually whenever you want.

## What it shows

| Panel | Metrics |
|-------|---------|
| CPU | Usage %, per-core bars, frequency, temp, model |
| Memory | Usage %, used/total/free GB |
| GPU | Usage %, VRAM used/total, temp, fan % |
| Storage | C: drive usage %, used/total GB |
| Network | Upload/download speed, total sent/received |

All panels include a 60-point sparkline history chart.
