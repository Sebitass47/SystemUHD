# System HUD — AI Context

## What this is

A PWA system monitor dashboard with an Iron Man / sci-fi HUD aesthetic. Flask backend serves real-time hardware stats; vanilla JS frontend polls `/api/stats` every 1.5 seconds and renders them with neon-glow CSS and canvas sparklines.

## Architecture

```
app.py                  Flask backend — single /api/stats JSON endpoint
templates/index.html    Single-page app shell, all panels declared here
static/css/style.css    All styling — CSS variables drive the color themes
static/js/app.js        Polling loop, DOM updates, sparkline rendering
static/manifest.json    PWA manifest (display: standalone, landscape)
static/sw.js            Service worker — caches app shell, skips /api/stats
static/icons/           SVG icons for PWA install
```

## Key decisions

- **Windows native Python, not WSL**: `psutil` inside WSL2 reads the VM's hardware (e.g. 30 GB RAM instead of 64 GB). Running `pythonw app.py` on Windows gives access to real hardware via psutil natively.
- **No framework**: Vanilla JS with `fetch` polling. No React/Vue — the app is a single static page with no build step.
- **Canvas sparklines**: Hand-drawn with the 2D canvas API, no charting library. Each metric keeps a 60-point rolling history array.
- **Color system via CSS variables**: All panel colors (`--cyan`, `--green`, `--purple`, `--orange`) are defined in `:root`. Changing a theme means swapping these variables.
- **GPU via nvidia-smi**: `psutil` doesn't expose GPU stats. The backend shells out to `nvidia-smi --query-gpu=... --format=csv` on each request. Gracefully returns `null` if not available.
- **CPU model name via winreg**: `platform.processor()` returns a generic string on Windows. The backend reads `HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0\ProcessorNameString` for the real name.

## Adding a new theme

Themes are planned as CSS variable overrides. The pattern to follow:
1. Add a `data-theme="name"` attribute on `<body>`
2. In `style.css`, add a `[data-theme="name"] { --cyan: ...; --green: ...; }` block that overrides the root variables
3. In `app.js`, add a toggle button that sets `document.body.dataset.theme`

## API response shape

```json
{
  "cpu": { "percent": 4.6, "per_core": [...], "freq_current": 4701, "freq_max": 4701,
           "logical_cores": 24, "physical_cores": 12, "temperature": null, "model": "AMD Ryzen 9 7900X..." },
  "memory": { "percent": 29.5, "used_gb": 18.61, "total_gb": 63.1, "available_gb": 44.54 },
  "disk": { "label": "C:", "percent": 63.1, "used_gb": 1174.1, "total_gb": 1862.0 },
  "network": { "upload_bps": 521, "download_bps": 723, "total_sent_gb": 1.04, "total_recv_gb": 3.46 },
  "gpu": { "name": "NVIDIA GeForce RTX 5070 Ti", "utilization": 10, "memory_used": 1762,
           "memory_total": 16303, "temperature": 38, "fan_speed": 32 },
  "uptime": "192:23:21",
  "hostname": "SAITAMA",
  "os": "Windows 11"
}
```

`gpu` is `null` if nvidia-smi is not available or fails.
