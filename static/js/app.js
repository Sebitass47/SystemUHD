// ═══════════════════════════════════════════
//  SYSTEM HUD — app.js
// ═══════════════════════════════════════════

const THEMES = ['cyber', 'synthwave', 'terminal', 'clean', 'cyberpunk'];
const THEME_LABELS = { cyber:'CYBER', synthwave:'SYNTHWAVE', terminal:'TERMINAL', clean:'CLEAN', cyberpunk:'CYBERPUNK' };

// Theme colors for canvas sparklines (resolved per theme)
const THEME_COLORS = {
  cyber:     { cpu:'#00f5ff', ram:'#00ff88', gpu:'#bf5fff', disk:'#ff9500', net:'#ff2d78', netUp:'#00ff88', bg:'rgba(0,245,255,0.12)' },
  synthwave: { cpu:'#ff6a00', ram:'#ff6a00', gpu:'#ff6a00', disk:'#ff6a00', net:'#ff2d9e', netUp:'#ffd700', bg:'rgba(255,106,0,0.12)' },
  terminal:  { cpu:'#00ff41', ram:'#00ff41', gpu:'#00ff41', disk:'#00ff41', net:'#00ff41', netUp:'#00ff41', bg:'rgba(0,255,65,0.1)' },
  clean:     { cpu:'#3b82f6', ram:'#10b981', gpu:'#8b5cf6', disk:'#f59e0b', net:'#06b6d4', netUp:'#10b981', bg:'rgba(59,130,246,0.1)' },
  cyberpunk: { cpu:'#00e5cc', ram:'#ff2d9e', gpu:'#ffaa00', disk:'#ffaa00', net:'#00e5cc', netUp:'#ff2d9e', bg:'rgba(0,229,204,0.1)' },
};

const HISTORY_LEN = 60;
const history = {
  cpu:     new Array(HISTORY_LEN).fill(0),
  ram:     new Array(HISTORY_LEN).fill(0),
  gpu:     new Array(HISTORY_LEN).fill(0),
  netUp:   new Array(HISTORY_LEN).fill(0),
  netDown: new Array(HISTORY_LEN).fill(0),
};

// ── Theme management ──────────────────────
let currentTheme = localStorage.getItem('syshud-theme') || 'cyber';

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-name').textContent = THEME_LABELS[theme];
  localStorage.setItem('syshud-theme', theme);
}

document.getElementById('theme-btn').addEventListener('click', () => {
  const idx = THEMES.indexOf(currentTheme);
  applyTheme(THEMES[(idx + 1) % THEMES.length]);
});

applyTheme(currentTheme);

// ── Clock ─────────────────────────────────
function updateClock() {
  const now = new Date();
  const t = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
  document.getElementById('current-time').textContent = t;
}
updateClock();
setInterval(updateClock, 1000);

// ── Sparkline ─────────────────────────────
function sparkline(canvas, data, color, fillColor) {
  if (!canvas) return;
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
  ctx.shadowBlur = currentTheme === 'clean' ? 0 : 4;
  ctx.stroke();
}

// ── Circular gauge ─────────────────────────
const CIRC = 2 * Math.PI * 38; // circumference for r=38
function updateGauge(fillEl, valEl, subEl, pct, subText) {
  if (!fillEl) return;
  const offset = CIRC - (pct / 100) * CIRC;
  fillEl.style.strokeDashoffset = offset;
  if (valEl) valEl.textContent = Math.round(pct);
  if (subEl && subText !== undefined) subEl.textContent = subText;
}

// ── Core bars ────────────────────────────
let coreEls = [];
function updateCoreGrid(cores) {
  const grid = document.getElementById('core-grid');
  if (coreEls.length !== cores.length) {
    grid.innerHTML = '';
    coreEls = cores.map(() => {
      const wrap = document.createElement('div'); wrap.className = 'core-bar';
      const fill = document.createElement('div'); fill.className = 'core-bar-fill';
      wrap.appendChild(fill); grid.appendChild(wrap);
      return fill;
    });
  }
  cores.forEach((pct, i) => { coreEls[i].style.height = `${pct}%`; });
}

// ── Disk blocks ──────────────────────────
function updateDiskBlocks(pct) {
  const el = document.getElementById('disk-visual');
  const total = 48;
  const used = Math.round((pct / 100) * total);
  if (el.children.length !== total) {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const b = document.createElement('div'); b.className = 'disk-block';
      el.appendChild(b);
    }
  }
  Array.from(el.children).forEach((b, i) => b.classList.toggle('used', i < used));
}

// ── Format bytes/s ───────────────────────
function fmt(bps) {
  if (bps < 1024)       return `${Math.round(bps)} B/s`;
  if (bps < 1048576)    return `${(bps/1024).toFixed(1)} KB/s`;
  return `${(bps/1048576).toFixed(2)} MB/s`;
}

// ── Alert colors ─────────────────────────
function alert(el, val, w = 70, c = 90) {
  el.classList.remove('warn','crit');
  if (val >= c) el.classList.add('crit');
  else if (val >= w) el.classList.add('warn');
}

// ── Terminal progress bar ────────────────
function termBar(pct, len = 18) {
  const filled = Math.round((pct / 100) * len);
  return '[' + '█'.repeat(filled) + '░'.repeat(len - filled) + ']';
}

// ── Network dual sparkline ────────────────
function netChart(canvas, upData, downData, colUp, colDown) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const max = Math.max(...upData, ...downData, 1);
  function drawLine(data, color, fill) {
    const pts = data.map((v, i) => ({ x: (i/(data.length-1))*w, y: h-(v/max)*(h-4)-2 }));
    ctx.beginPath();
    ctx.moveTo(pts[0].x, h);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length-1].x, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, fill); g.addColorStop(1,'transparent');
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath();
    pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.shadowColor = color; ctx.shadowBlur = currentTheme==='clean' ? 0 : 4;
    ctx.stroke();
  }
  drawLine(downData, colDown, colDown.replace(')',',0.12)').replace('rgb(','rgba(').replace('#', 'rgba(').replace(/rgba\(([\da-f]{2})([\da-f]{2})([\da-f]{2})/i, (_,r,g,b)=>`rgba(${parseInt(r,16)},${parseInt(g,16)},${parseInt(b,16)}`));
  drawLine(upData,   colUp,   colUp.replace(')',',0.12)').replace('rgb(','rgba('));
}

// ── Main fetch loop ───────────────────────
async function fetchStats() {
  try {
    const d = await fetch('/api/stats').then(r => r.json());
    const tc = THEME_COLORS[currentTheme];

    // Header
    document.getElementById('hostname').textContent = d.hostname.toUpperCase();
    document.getElementById('os').textContent = d.os;
    document.getElementById('header-os').textContent = `· ${d.os}`;
    document.getElementById('uptime').textContent = d.uptime;

    // Avatar (cyberpunk)
    document.getElementById('avatar-name').textContent = d.hostname.toUpperCase();
    document.getElementById('avatar-initial').textContent = d.hostname[0].toUpperCase();
    const cpuShort = d.cpu.model.replace(/\(.*?\)/g,'').replace(/\s+/g,' ').trim().substring(0,22);
    document.getElementById('avatar-cpu-model').textContent = cpuShort;
    if (d.gpu) document.getElementById('avatar-gpu-name').textContent = d.gpu.name.replace('NVIDIA ','').substring(0,22);
    document.getElementById('avatar-ram').textContent = `${d.memory.total_gb} GB DDR5`;

    // ── CPU ──
    const cpuPct = d.cpu.percent;
    const cpuEl = document.getElementById('cpu-percent'); cpuEl.textContent = cpuPct.toFixed(1); alert(cpuEl, cpuPct);
    document.getElementById('cpu-bar-fill').style.width = `${cpuPct}%`;
    document.getElementById('cpu-freq').textContent = d.cpu.freq_current ? Math.round(d.cpu.freq_current) : '—';
    document.getElementById('cpu-cores').textContent = `${d.cpu.physical_cores}C/${d.cpu.logical_cores}T`;
    const cpuTempEl = document.getElementById('cpu-temp');
    const cpuTempVal = d.cpu.temperature;
    cpuTempEl.textContent = cpuTempVal != null ? cpuTempVal : '—'; if (cpuTempVal) alert(cpuTempEl, cpuTempVal, 75, 90);
    document.getElementById('cpu-model').textContent = cpuShort;
    if (d.cpu.per_core) updateCoreGrid(d.cpu.per_core);
    updateGauge(
      document.getElementById('cpu-gauge-fill'),
      document.getElementById('cpu-gauge-val'),
      document.getElementById('cpu-gauge-sub'),
      cpuPct, cpuTempVal != null ? `${cpuTempVal}°C` : `${Math.round(d.cpu.freq_current||0)}MHz`
    );
    history.cpu.push(cpuPct); history.cpu.shift();
    sparkline(document.getElementById('cpu-chart'), history.cpu, tc.cpu, tc.bg);
    sparkline(document.getElementById('cpu-history-chart'), history.cpu, tc.cpu, tc.bg);

    // ── RAM ──
    const ramPct = d.memory.percent;
    const ramEl = document.getElementById('ram-percent'); ramEl.textContent = ramPct.toFixed(1); alert(ramEl, ramPct);
    document.getElementById('ram-bar-fill').style.width = `${ramPct}%`;
    document.getElementById('ram-used').textContent = d.memory.used_gb;
    document.getElementById('ram-free').textContent = d.memory.available_gb;
    document.getElementById('ram-total').textContent = d.memory.total_gb;
    updateGauge(
      document.getElementById('ram-gauge-fill'),
      document.getElementById('ram-gauge-val'),
      document.getElementById('ram-gauge-sub'),
      ramPct, `${d.memory.used_gb}GB`
    );
    history.ram.push(ramPct); history.ram.shift();
    sparkline(document.getElementById('ram-chart'), history.ram, tc.ram, tc.bg.replace(tc.cpu, tc.ram));

    // ── GPU ──
    const gpuPct = d.gpu ? d.gpu.utilization : 0;
    const gpuEl = document.getElementById('gpu-percent'); gpuEl.textContent = d.gpu ? gpuPct : '—'; if (d.gpu) alert(gpuEl, gpuPct);
    document.getElementById('gpu-bar-fill').style.width = `${gpuPct}%`;
    document.getElementById('gpu-model').textContent = d.gpu ? d.gpu.name.substring(0,26) : 'NO GPU';
    document.getElementById('gpu-vram-used').textContent = d.gpu ? d.gpu.memory_used : '—';
    document.getElementById('gpu-clock').textContent = d.gpu?.clock_mhz ?? '—';
    const gpuTempEl = document.getElementById('gpu-temp');
    gpuTempEl.textContent = d.gpu ? d.gpu.temperature : '—'; if (d.gpu) alert(gpuTempEl, d.gpu.temperature, 75, 90);
    document.getElementById('gpu-fan').textContent = d.gpu?.fan_speed ?? '—';
    if (d.gpu) document.getElementById('avatar-gpu-name').textContent = d.gpu.name.replace('NVIDIA ','').substring(0,22);
    updateGauge(
      document.getElementById('gpu-gauge-fill'),
      document.getElementById('gpu-gauge-val'),
      document.getElementById('gpu-gauge-sub'),
      gpuPct, d.gpu ? `${d.gpu.temperature}°C` : '—'
    );
    history.gpu.push(gpuPct); history.gpu.shift();
    sparkline(document.getElementById('gpu-chart'), history.gpu, tc.gpu, tc.bg.replace(tc.cpu, tc.gpu));

    // ── Disk ──
    const diskPct = d.disk.percent;
    const diskEl = document.getElementById('disk-percent'); diskEl.textContent = diskPct.toFixed(1); alert(diskEl, diskPct, 75, 90);
    document.getElementById('disk-bar-fill').style.width = `${diskPct}%`;
    document.getElementById('disk-label').textContent = d.disk.label;
    document.getElementById('disk-used').textContent = d.disk.used_gb;
    document.getElementById('disk-total').textContent = d.disk.total_gb;
    updateDiskBlocks(diskPct);

    // ── Network ──
    const up = d.network.upload_bps, dn = d.network.download_bps;
    document.getElementById('net-up').textContent = fmt(up);
    document.getElementById('net-down').textContent = fmt(dn);
    document.getElementById('net-sent').textContent = d.network.total_sent_gb;
    document.getElementById('net-recv').textContent = d.network.total_recv_gb;
    history.netUp.push(up);   history.netUp.shift();
    history.netDown.push(dn); history.netDown.shift();
    netChart(document.getElementById('net-chart'), history.netUp, history.netDown, tc.netUp, tc.net);

    // Terminal bar overlays (hidden in other themes via CSS, but we still update data-bar)
    if (currentTheme === 'terminal') {
      document.getElementById('cpu-bar-fill').style.background = 'none';
      document.getElementById('cpu-bar-fill').style.boxShadow = 'none';
      document.getElementById('cpu-bar-fill').parentElement.setAttribute('data-bar', termBar(cpuPct));
    }

  } catch(e) {
    console.warn('Stats error:', e);
  }
}

// ── PWA install prompt ───────────────────
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  const btn = document.createElement('button');
  btn.textContent = '⊕ INSTALAR APP';
  btn.style.cssText = 'position:fixed;bottom:68px;right:10px;background:var(--panel-bg);color:var(--accent);border:1px solid var(--accent);padding:5px 10px;font-family:var(--font-hud);font-size:.58rem;letter-spacing:.1em;cursor:pointer;z-index:100;border-radius:var(--radius)';
  btn.onclick = () => { deferredPrompt.prompt(); deferredPrompt = null; btn.remove(); };
  document.body.appendChild(btn);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js').catch(() => {});
}

fetchStats();
setInterval(fetchStats, 1500);
