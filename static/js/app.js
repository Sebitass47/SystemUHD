const COLORS = {
  cyan: '#00f5ff',
  green: '#00ff88',
  purple: '#bf5fff',
  orange: '#ff9500',
  red: '#ff3a3a',
  dimCyan: 'rgba(0,245,255,0.15)',
  dimGreen: 'rgba(0,255,136,0.15)',
  dimPurple: 'rgba(191,95,255,0.15)',
  dimOrange: 'rgba(255,149,0,0.15)',
};

const HISTORY_LEN = 60;
const history = {
  cpu: new Array(HISTORY_LEN).fill(0),
  ram: new Array(HISTORY_LEN).fill(0),
  gpu: new Array(HISTORY_LEN).fill(0),
  netUp: new Array(HISTORY_LEN).fill(0),
  netDown: new Array(HISTORY_LEN).fill(0),
};

function sparklineChart(canvas, data, color, fillColor) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }));

  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fillColor);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.stroke();
}

function formatBytes(bps) {
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

function setColor(el, value, warnAt = 70, critAt = 90) {
  el.classList.remove('warn', 'crit');
  if (value >= critAt) el.classList.add('crit');
  else if (value >= warnAt) el.classList.add('warn');
}

function setBarColor(fill, value, warnAt = 70, critAt = 90, baseClass = '') {
  fill.className = 'bar-fill' + (baseClass ? ` ${baseClass}` : '');
  if (value >= critAt) fill.classList.add('red');
  else if (value >= warnAt) fill.classList.add('orange');
}

let coreBarEls = [];

function updateCoreGrid(cores) {
  const grid = document.getElementById('core-grid');
  if (coreBarEls.length !== cores.length) {
    grid.innerHTML = '';
    coreBarEls = cores.map(() => {
      const wrap = document.createElement('div');
      wrap.className = 'core-bar';
      const fill = document.createElement('div');
      fill.className = 'core-bar-fill';
      wrap.appendChild(fill);
      grid.appendChild(wrap);
      return fill;
    });
  }
  cores.forEach((pct, i) => {
    coreBarEls[i].style.height = `${pct}%`;
  });
}

function updateDiskVisual(percent) {
  const visual = document.getElementById('disk-visual');
  const total = 50;
  const used = Math.round((percent / 100) * total);
  if (visual.children.length !== total) {
    visual.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const b = document.createElement('div');
      b.className = 'disk-block';
      visual.appendChild(b);
    }
  }
  Array.from(visual.children).forEach((b, i) => {
    b.classList.toggle('used', i < used);
  });
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const d = await res.json();
    const { cpu, memory, disk, network, gpu, uptime, hostname, os } = d;

    // Header
    document.getElementById('hostname').textContent = hostname.toUpperCase();
    document.getElementById('uptime').textContent = uptime;
    document.getElementById('os').textContent = os.replace('Linux', 'LNX').substring(0, 20);

    // CPU
    const cpuPct = cpu.percent;
    const cpuEl = document.getElementById('cpu-percent');
    cpuEl.textContent = cpuPct.toFixed(1);
    setColor(cpuEl, cpuPct);
    document.getElementById('cpu-bar-fill').style.width = `${cpuPct}%`;
    setBarColor(document.getElementById('cpu-bar-fill'), cpuPct);
    document.getElementById('cpu-freq').textContent = cpu.freq_current ? Math.round(cpu.freq_current) : '—';
    document.getElementById('cpu-cores').textContent = `${cpu.physical_cores}C/${cpu.logical_cores}T`;
    const cpuTempEl = document.getElementById('cpu-temp');
    if (cpu.temperature != null) {
      cpuTempEl.textContent = cpu.temperature;
      setColor(cpuTempEl, cpu.temperature, 75, 90);
    } else {
      cpuTempEl.textContent = '—';
    }
    const cpuModelShort = cpu.model.replace(/\(.*?\)/g, '').trim().substring(0, 30);
    document.getElementById('cpu-model').textContent = cpuModelShort || '—';
    if (cpu.per_core) updateCoreGrid(cpu.per_core);
    history.cpu.push(cpuPct); history.cpu.shift();
    sparklineChart(document.getElementById('cpu-chart'), history.cpu, COLORS.cyan, COLORS.dimCyan);

    // RAM
    const ramPct = memory.percent;
    const ramEl = document.getElementById('ram-percent');
    ramEl.textContent = ramPct.toFixed(1);
    setColor(ramEl, ramPct);
    document.getElementById('ram-bar-fill').style.width = `${ramPct}%`;
    document.getElementById('ram-used').textContent = memory.used_gb;
    document.getElementById('ram-total').textContent = memory.total_gb;
    document.getElementById('ram-free').textContent = memory.available_gb;
    history.ram.push(ramPct); history.ram.shift();
    sparklineChart(document.getElementById('ram-chart'), history.ram, COLORS.green, COLORS.dimGreen);

    // GPU
    if (gpu) {
      document.getElementById('gpu-model').textContent = gpu.name.substring(0, 28);
      const gpuPct = gpu.utilization;
      const gpuEl = document.getElementById('gpu-percent');
      gpuEl.textContent = gpuPct;
      setColor(gpuEl, gpuPct);
      document.getElementById('gpu-bar-fill').style.width = `${gpuPct}%`;
      document.getElementById('gpu-vram-used').textContent = gpu.memory_used;
      document.getElementById('gpu-vram-total').textContent = gpu.memory_total;
      const gpuTempEl = document.getElementById('gpu-temp');
      gpuTempEl.textContent = gpu.temperature;
      setColor(gpuTempEl, gpu.temperature, 75, 90);
      document.getElementById('gpu-fan').textContent = gpu.fan_speed != null ? gpu.fan_speed : '—';
      history.gpu.push(gpuPct); history.gpu.shift();
    } else {
      document.getElementById('gpu-percent').textContent = '—';
      history.gpu.push(0); history.gpu.shift();
    }
    sparklineChart(document.getElementById('gpu-chart'), history.gpu, COLORS.purple, COLORS.dimPurple);

    // Disk
    const diskPct = disk.percent;
    const diskEl = document.getElementById('disk-percent');
    diskEl.textContent = diskPct.toFixed(1);
    setColor(diskEl, diskPct, 75, 90);
    document.getElementById('disk-bar-fill').style.width = `${diskPct}%`;
    document.getElementById('disk-used').textContent = disk.used_gb;
    document.getElementById('disk-total').textContent = disk.total_gb;
    const diskLabelEl = document.getElementById('disk-label');
    if (diskLabelEl) diskLabelEl.textContent = disk.label || '/';
    updateDiskVisual(diskPct);

    // Network
    const up = network.upload_bps;
    const down = network.download_bps;
    document.getElementById('net-up').textContent = formatBytes(up);
    document.getElementById('net-down').textContent = formatBytes(down);
    document.getElementById('net-sent').textContent = network.total_sent_gb;
    document.getElementById('net-recv').textContent = network.total_recv_gb;
    const maxNet = Math.max(...history.netUp, ...history.netDown, up, down, 1);
    history.netUp.push(up); history.netUp.shift();
    history.netDown.push(down); history.netDown.shift();

    const netCanvas = document.getElementById('net-chart');
    const ctx = netCanvas.getContext('2d');
    netCanvas.width = netCanvas.offsetWidth;
    ctx.clearRect(0, 0, netCanvas.width, netCanvas.height);

    function drawNetLine(data, color, fillColor) {
      const w = netCanvas.width, h = netCanvas.height;
      const pts = data.map((v, i) => ({
        x: (i / (data.length - 1)) * w,
        y: h - (v / maxNet) * (h - 4) - 2,
      }));
      ctx.beginPath();
      ctx.moveTo(pts[0].x, h);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.stroke();
    }
    drawNetLine(history.netDown, COLORS.cyan, COLORS.dimCyan);
    drawNetLine(history.netUp, COLORS.green, COLORS.dimGreen);

  } catch (e) {
    console.error('Stats fetch failed:', e);
  }
}

// PWA install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.createElement('button');
  btn.textContent = '⊕ INSTALL';
  btn.style.cssText = 'position:fixed;bottom:40px;right:12px;background:rgba(0,20,35,0.95);color:#00f5ff;border:1px solid #00f5ff;padding:6px 12px;font-family:Orbitron,sans-serif;font-size:0.6rem;letter-spacing:.1em;cursor:pointer;z-index:1000;';
  btn.onclick = () => { deferredPrompt.prompt(); deferredPrompt = null; btn.remove(); };
  document.body.appendChild(btn);
});

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js').catch(console.warn);
}

fetchStats();
setInterval(fetchStats, 1500);
