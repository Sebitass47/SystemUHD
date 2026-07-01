from flask import Flask, render_template, jsonify
import psutil
import subprocess
import platform
import time
import json
import winreg
from datetime import datetime

app = Flask(__name__)

_prev_net = None
_prev_net_time = time.time()


def get_gpu_info():
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,"
                "temperature.gpu,fan.speed,clocks.current.graphics",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode == 0:
            parts = [p.strip() for p in result.stdout.strip().split(",")]
            return {
                "name": parts[0],
                "utilization": int(parts[1]),
                "memory_used": int(parts[2]),
                "memory_total": int(parts[3]),
                "temperature": int(parts[4]),
                "fan_speed": int(parts[5]) if parts[5] not in ("[N/A]", "N/A") else None,
                "clock_mhz": int(parts[6]) if parts[6] not in ("[N/A]", "N/A") else None,
            }
    except Exception:
        pass
    return None


def get_cpu_temp():
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for key in ["coretemp", "cpu_thermal", "k10temp", "acpitz", "zenpower"]:
                if key in temps and temps[key]:
                    return round(temps[key][0].current, 1)
    except Exception:
        pass
    return None


def get_cpu_model():
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                             r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        name = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
        winreg.CloseKey(key)
        return name
    except Exception:
        return platform.processor() or "CPU"


def get_disk_info():
    for part in psutil.disk_partitions(all=False):
        if part.fstype == "" or not part.mountpoint.upper().startswith("C"):
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            return {
                "label": "C:",
                "percent": round(usage.percent, 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "total_gb": round(usage.total / (1024**3), 1),
            }
        except Exception:
            continue
    d = psutil.disk_usage("/")
    return {"label": "/", "percent": round(d.percent, 1),
            "used_gb": round(d.used / (1024**3), 1),
            "total_gb": round(d.total / (1024**3), 1)}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stats")
def stats():
    global _prev_net, _prev_net_time

    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_per_core = psutil.cpu_percent(percpu=True, interval=None)
    cpu_freq = psutil.cpu_freq()

    mem = psutil.virtual_memory()
    disk = get_disk_info()

    now = time.time()
    dt = now - _prev_net_time
    net = psutil.net_io_counters()
    if _prev_net is not None and dt > 0:
        net_up = max(0, (net.bytes_sent - _prev_net.bytes_sent) / dt)
        net_down = max(0, (net.bytes_recv - _prev_net.bytes_recv) / dt)
    else:
        net_up = net_down = 0
    _prev_net = net
    _prev_net_time = now

    uptime_s = int(time.time() - psutil.boot_time())
    h, rem = divmod(uptime_s, 3600)
    m, s = divmod(rem, 60)

    return jsonify({
        "cpu": {
            "percent": round(cpu_percent, 1),
            "per_core": [round(p, 1) for p in cpu_per_core],
            "freq_current": round(cpu_freq.current, 0) if cpu_freq else None,
            "freq_max": round(cpu_freq.max, 0) if cpu_freq else None,
            "logical_cores": psutil.cpu_count(logical=True),
            "physical_cores": psutil.cpu_count(logical=False),
            "temperature": get_cpu_temp(),
            "model": get_cpu_model(),
        },
        "memory": {
            "percent": round(mem.percent, 1),
            "used_gb": round(mem.used / (1024**3), 2),
            "total_gb": round(mem.total / (1024**3), 1),
            "available_gb": round(mem.available / (1024**3), 2),
        },
        "disk": disk,
        "network": {
            "upload_bps": round(net_up, 0),
            "download_bps": round(net_down, 0),
            "total_sent_gb": round(net.bytes_sent / (1024**3), 2),
            "total_recv_gb": round(net.bytes_recv / (1024**3), 2),
        },
        "gpu": get_gpu_info(),
        "uptime": f"{h:02d}:{m:02d}:{s:02d}",
        "hostname": platform.node(),
        "os": f"Windows {platform.version().split('.')[2] if platform.system()=='Windows' else platform.release()}",
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
