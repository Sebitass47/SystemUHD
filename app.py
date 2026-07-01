from flask import Flask, render_template, jsonify
import psutil
import subprocess
import platform
import time

app = Flask(__name__)

_prev_net = None
_prev_net_time = time.time()


def get_gpu_info():
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,fan.speed",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=2,
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


def get_disk_info():
    # On Windows, find the system drive (C:) and any other physical drives
    disks = []
    seen = set()
    for part in psutil.disk_partitions(all=False):
        if part.fstype == "" or part.mountpoint in seen:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            seen.add(part.mountpoint)
            disks.append({
                "label": part.mountpoint.replace("\\", ""),
                "percent": round(usage.percent, 1),
                "used_gb": round(usage.used / (1024**3), 1),
                "total_gb": round(usage.total / (1024**3), 1),
            })
        except Exception:
            continue
    # Return C: drive preferentially
    c_drive = next((d for d in disks if d["label"].upper().startswith("C")), None)
    return c_drive or (disks[0] if disks else {
        "label": "C:", "percent": 0, "used_gb": 0, "total_gb": 0
    })


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/stats")
def stats():
    global _prev_net, _prev_net_time

    cpu_percent = psutil.cpu_percent(interval=0.1)
    cpu_per_core = psutil.cpu_percent(percpu=True, interval=None)
    cpu_freq = psutil.cpu_freq()
    cpu_count_logical = psutil.cpu_count(logical=True)
    cpu_count_physical = psutil.cpu_count(logical=False)

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

    uptime_seconds = int(time.time() - psutil.boot_time())
    hours, rem = divmod(uptime_seconds, 3600)
    minutes, seconds = divmod(rem, 60)

    cpu_model = platform.processor()
    # Try to get a cleaner name on Windows
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
                             r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        cpu_model = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
        winreg.CloseKey(key)
    except Exception:
        pass

    return jsonify(
        {
            "cpu": {
                "percent": round(cpu_percent, 1),
                "per_core": [round(p, 1) for p in cpu_per_core],
                "freq_current": round(cpu_freq.current, 0) if cpu_freq else None,
                "freq_max": round(cpu_freq.max, 0) if cpu_freq else None,
                "logical_cores": cpu_count_logical,
                "physical_cores": cpu_count_physical,
                "temperature": get_cpu_temp(),
                "model": cpu_model,
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
            "uptime": f"{hours:02d}:{minutes:02d}:{seconds:02d}",
            "hostname": platform.node(),
            "os": f"{platform.system()} {platform.release()}",
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
