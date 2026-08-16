// ══════════════════════════════════════════════════════
//  AI MONITOR — Global Component (ai_monitor.js)
//  Works on ANY page. Auto-resumes if it was ON before.
// ══════════════════════════════════════════════════════

const MON_LIB_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
const MON_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
const MON_STATE_KEY = 'fy_monitor_enabled'; // localStorage key to persist ON/OFF

// ── STATE ──
let monEnabled = false, monCamOn = false, faceApiReady = false;
let monStream = null, monDetectLoop = null;
let monAwayS = 0, monFocusS = 0, monAlertCount = 0;
let monLastAlert = 0, monPhase = 'idle';
let alertFired10 = false, alertFired30 = false, alertFired60 = false;

// ── COACH MESSAGES ──
const COACH_MSGS = {
  welcome:      ['Monitoring activated! I\'m watching your focus! 👁️', 'AI coach is ready! Let\'s get focused! 🎯', 'I\'ll keep you on track like a real teacher! 🎓'],
  focused_5:    ['Great focus! 5 solid minutes! Keep it up! 🌟', 'Amazing! 5 minutes of pure concentration! 🔥', 'You\'re doing wonderfully! Stay in the zone! 🎯'],
  focused_10:   ['10 minutes of deep focus! You\'re crushing it! 🏆', 'Incredible! 10 minutes! Your brain is working hard! 🧠'],
  focused_25:   ['WOW! 25 full minutes! You\'re a focus LEGEND! 🏆🔥'],
  away_10:      ['No face detected! Come back to your desk! 👀', 'No face detected! Come back and focus! ⏰'],
  away_30:      ['⚠️ No face detected for 30s! Refocus NOW!', 'No face detected for 30s! Come back and focus! 📚'],
  away_60:      ['🚨 No face detected for over a minute! Sit down and start studying!', 'No face detected for over a minute! 🚨'],
  expr_sad:     ['You look a bit down. Remember: progress = success! 💪', 'Feeling tough? That means you\'re learning! Keep going! 🌸'],
  expr_angry:   ['Deep breath! Hard things make you stronger! 🧠', 'Frustrated? That\'s your brain growing! Push through! 💪'],
  expr_surprised:['Distracted by something? Refocus! 👀', 'Eyes back on the screen! Let\'s stay focused! 🎯'],
  page_change:  ['Welcome back! Still watching your focus! 👁️', 'I\'m here no matter which page you\'re on! 🎯'],
  disabled:     ['Monitoring disabled. Enable me to be your AI study coach! 🎓'],
};
function rMsg(k) { const a = COACH_MSGS[k] || ['Keep going! 💪']; return a[Math.floor(Math.random() * a.length)]; }

// ── UI HELPERS ──
function setMonMsg(txt) {
  const el = document.getElementById('monMsg');
  if (el) el.innerHTML = `<span class="mon-coach-label">🎓 Coach:</span> ${txt}`;
}

function setMonStatus(status, secVal) {
  const dot = document.getElementById('monDot');
  const stxt = document.getElementById('monStatusTxt');
  const timer = document.getElementById('monTimer');
  const badge = document.getElementById('monBadge');
  if (!dot) return;
  dot.className = 'mon-dot ' + status;
  const m = Math.floor(secVal / 60), s = Math.floor(secVal % 60);
  const ts = m > 0 ? `${m}m ${s}s` : `${s}s`;
  if (status === 'focused') {
    stxt.textContent = '✅ Focused'; stxt.style.color = '#27ae60';
    timer.textContent = 'Focus: ' + ts; badge.textContent = 'FOCUSED'; badge.style.background = 'rgba(39,174,96,.3)';
  } else if (status === 'away') {
    stxt.textContent = '👀 No face detected'; stxt.style.color = '#f39c12';
    timer.textContent = 'Away: ' + ts; badge.textContent = 'NO FACE'; badge.style.background = 'rgba(243,156,18,.3)';
  } else if (status === 'distracted') {
    stxt.textContent = '⚠️ Distracted (No Face)'; stxt.style.color = '#e74c3c';
    timer.textContent = 'Away: ' + ts; badge.textContent = 'DISTRACTED'; badge.style.background = 'rgba(231,76,60,.3)';
  } else {
    stxt.textContent = '⏳ Waiting…'; stxt.style.color = '#B0A0CC';
    timer.textContent = '—'; badge.textContent = 'STANDBY'; badge.style.background = 'rgba(255,255,255,.2)';
  }
  const mf = document.getElementById('msFocusSec');
  const ma = document.getElementById('msAwaySec');
  const mal = document.getElementById('msAlerts');
  if (mf) mf.textContent = Math.floor(monFocusS / 60) + 'm';
  if (ma) ma.textContent = monAwayS > 0 ? Math.floor(monAwayS) + 's' : '0s';
  if (mal) mal.textContent = monAlertCount;
}

// ── GLOBAL TOAST (works on every page) ──
function monShowToast(msg, emoji = '✨') {
  let c = document.getElementById('fyToastContainer');
  if (!c) {
    c = document.createElement('div');
    c.id = 'fyToastContainer';
    c.className = 'fy-toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = 'fy-toast';
  t.innerHTML = `${emoji} ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.4s'; setTimeout(() => t.remove(), 400); }, 3500);
}

function monPlayAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, start, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = "sine";
      g.gain.setValueAtTime(0.4, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.1);
    };
    play(880, 0, .2); play(880, .25, .2); play(1100, .5, .4);
  } catch (e) {
    console.warn('Audio alarm play failed:', e);
  }
}

// ── GLOBAL ALARM (works on every page) ──
function monTriggerAlarm(msg) {
  let b = document.getElementById('fyAlarmBanner');
  if (!b) {
    b = document.createElement('div');
    b.id = 'fyAlarmBanner';
    b.className = 'fy-alarm-banner';
    b.innerHTML = `<span id="fyAlarmMsg"></span><button onclick="monDismissAlarm()">✕ Dismiss</button>`;
    document.body.appendChild(b);
  }
  document.getElementById('fyAlarmMsg').textContent = '⏰ ' + msg;
  b.style.display = 'block';
  
  // Play synth alarm beep
  monPlayAlarm();
  
  // Browser notification
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('FocusYou ⏰', { 
      body: msg,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐰</text></svg>"
    });
  }
}
function monDismissAlarm() {
  const b = document.getElementById('fyAlarmBanner');
  if (b) b.style.display = 'none';
}

// ── PIXEL DETECTION (fallback, no AI needed) ──
function _pixelDetect() {
  const video = document.getElementById('monitorVideo');
  const canvas = document.getElementById('monitorCanvas');
  if (!video || !canvas || video.videoWidth === 0 || video.readyState < 2) return null;
  const W = video.videoWidth, H = video.videoHeight;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, W, H);
  const rx = Math.floor(W * 0.2), ry = Math.floor(H * 0.1);
  const rw = Math.floor(W * 0.6), rh = Math.floor(H * 0.75);
  const d = ctx.getImageData(rx, ry, rw, rh).data;
  let skin = 0, total = 0;
  for (let i = 0; i < d.length; i += 32) {
    const r = d[i], g = d[i + 1], b = d[i + 2]; total++;
    if (r > 60 && g > 40 && b > 20 && r > b && r >= g && (r - Math.min(g, b)) > 15 && r > 80) skin++;
  }
  const ratio = total > 0 ? skin / total : 0;
  const present = ratio > 0.05;
  ctx.strokeStyle = present ? '#2ecc71' : '#e74c3c';
  ctx.lineWidth = 2; ctx.strokeRect(rx, ry, rw, rh);
  ctx.fillStyle = present ? 'rgba(46,204,113,.85)' : 'rgba(231,76,60,.85)';
  ctx.font = 'bold 13px Nunito,sans-serif';
  const lbl = present ? '✓ Present' : '✗ Away';
  const tw = ctx.measureText(lbl).width;
  ctx.fillRect(rx, ry - 22, tw + 14, 20);
  ctx.fillStyle = 'white'; ctx.fillText(lbl, rx + 7, ry - 6);
  return present;
}

// ── FACE API LOADER ──
async function loadFaceApi() {
  if (faceApiReady) return true;
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = MON_LIB_URL;
    s.onload = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MON_MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MON_MODEL_URL);
        faceApiReady = true; res(true);
      } catch (e) { console.warn('face-api model load failed:', e); rej(e); }
    };
    s.onerror = (e) => { console.warn('face-api script load failed:', e); rej(e); };
    document.head.appendChild(s);
  });
}

// ── CAMERA ──
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const hint = location.protocol === 'http:'
      ? 'Open as <b>http://localhost:5000</b> or enable HTTPS.'
      : 'Camera API unavailable in this browser.';
    setMonMsg('❌ Camera not available. ' + hint);
    return false;
  }
  try {
    monStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
    const v = document.getElementById('monitorVideo');
    v.srcObject = monStream;
    await new Promise(r => { v.onloadedmetadata = () => r(); });
    await v.play().catch(() => {});
    monCamOn = true;
    return true;
  } catch (e) {
    const msg = (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
      ? '❌ Camera permission denied. Click the 🔒 lock icon and allow camera access, then try again.'
      : '❌ Camera error: ' + e.message;
    setMonMsg(msg);
    monShowToast('Camera permission denied — check browser settings', '⚠️');
    return false;
  }
}

function stopCamera() {
  if (monStream) { monStream.getTracks().forEach(t => t.stop()); monStream = null; }
  const v = document.getElementById('monitorVideo');
  if (v) v.srcObject = null;
  monCamOn = false;
  const ov = document.getElementById('noFaceOverlay');
  if (ov) ov.style.display = 'none';
  const c = document.getElementById('monitorCanvas');
  if (c) { const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height); }
}

// ── DETECTION LOOP ──
function startDetection() {
  if (monDetectLoop) return;
  monAwayS = 0; monFocusS = 0; monLastAlert = 0;
  monDetectLoop = setInterval(runDetection, 1500);
}
function stopDetection() {
  if (monDetectLoop) { clearInterval(monDetectLoop); monDetectLoop = null; }
}

async function runDetection() {
  if (!monCamOn) return;
  const video = document.getElementById('monitorVideo');
  const canvas = document.getElementById('monitorCanvas');
  if (!video || !canvas || video.videoWidth === 0) return;
  const noFace = document.getElementById('noFaceOverlay');
  const now = Date.now();

  let present = false;
  if (faceApiReady) {
    try {
      const opts = new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45, inputSize: 224 });
      const detections = await faceapi.detectAllFaces(video, opts).withFaceExpressions();
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!detections || detections.length === 0) {
        present = false;
      } else {
        present = true;
        const det = detections[0];
        const box = det.detection.box;
        const sx = canvas.width / video.videoWidth, sy = canvas.height / video.videoHeight;
        ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 2.5;
        ctx.strokeRect(box.x * sx, box.y * sy, box.width * sx, box.height * sy);
        const expr = det.expressions;
        const topExpr = Object.entries(expr).sort((a, b) => b[1] - a[1])[0];
           // Expression coaching
        if ((exprName === 'sad' || exprName === 'fearful') && exprConf > 40 && now - monLastAlert > 40000) {
          const msg = rMsg('expr_sad');
          setMonMsg(msg); monAlertCount++; monLastAlert = now;
          monShowToast(msg, '💪');
        } else if ((exprName === 'angry' || exprName === 'disgusted') && exprConf > 40 && now - monLastAlert > 40000) {
          const msg = rMsg('expr_angry');
          setMonMsg(msg); monAlertCount++; monLastAlert = now;
          monShowToast(msg, '💪');
        } else if (exprName === 'surprised' && exprConf > 50 && now - monLastAlert > 30000) {
          const msg = rMsg('expr_surprised');
          setMonMsg(msg); monAlertCount++; monLastAlert = now;
          monShowToast(msg, '👀');
          monTriggerAlarm(msg);
          if (typeof FocusVoice !== 'undefined') FocusVoice.speakDistracted();
        }
      }
    } catch (e) { console.warn('Detection err:', e); present = _pixelDetect() !== false; }
  } else {
    const r = _pixelDetect();
    present = (r === true);
  }

  if (!present) {
    monAwayS += 1.5; monFocusS = Math.max(0, monFocusS - 0.5);
    if (noFace) noFace.style.display = 'flex';
    const status = monAwayS >= 30 ? 'distracted' : 'away';
    setMonStatus(status, monAwayS);
    if (monAwayS >= 60) {
      if (!alertFired60) {
        const msg = rMsg('away_60');
        setMonMsg(msg); monAlertCount++; monLastAlert = now;
        monShowToast('🚨 No face detected for 60s! Come back!', '👀');
        monTriggerAlarm(msg);
        alertFired60 = true;
        if (typeof FocusVoice !== 'undefined') FocusVoice.speakDistracted();
      }
    } else if (monAwayS >= 30) {
      if (!alertFired30) {
        const msg = rMsg('away_30');
        setMonMsg(msg); monAlertCount++; monLastAlert = now;
        monShowToast('⚠️ No face detected for 30s! Please refocus!', '👀');
        monTriggerAlarm(msg);
        alertFired30 = true;
        if (typeof FocusVoice !== 'undefined') FocusVoice.speakDistracted();
      }
    } else if (monAwayS >= 10) {
      if (!alertFired10) {
        const msg = rMsg('away_10');
        setMonMsg(msg); monAlertCount++; monLastAlert = now;
        monShowToast('👀 No face detected! Come back!', '👀');
        monTriggerAlarm(msg);
        alertFired10 = true;
        if (typeof FocusVoice !== 'undefined') FocusVoice.speakNoFace();
      }
    }
  } else {
    monAwayS = 0; monFocusS += 1.5;
    alertFired10 = false; alertFired30 = false; alertFired60 = false;
    if (noFace) noFace.style.display = 'none';
    setMonStatus('focused', monFocusS);
    const focMin = Math.floor(monFocusS / 60);
    if (focMin > 0 && focMin % 5 === 0 && now - monLastAlert > 55000) {
      if (focMin >= 25) setMonMsg(rMsg('focused_25'));
      else if (focMin >= 10) setMonMsg(rMsg('focused_10'));
      else setMonMsg(rMsg('focused_5'));
      monLastAlert = now; monShowToast(`🌟 ${focMin} minutes focused!`, '✨');
    }
  }
}

// ── ENABLE / DISABLE ──
async function toggleMonitoring() {
  const btn = document.getElementById('monEnableBtn');
  if (!monEnabled) {
    btn.textContent = '⌛ Requesting camera…'; btn.disabled = true;
    
    // Request notification permission during user click gesture
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn('Notification permission request error:', e);
      }
    }
    
    const ok = await startCamera();
    if (!ok) { btn.textContent = '📷 Enable AI Monitoring'; btn.disabled = false; return; }
    monEnabled = true;
    localStorage.setItem(MON_STATE_KEY, 'true');
    btn.textContent = '🔴 Disable Monitoring'; btn.classList.add('on'); btn.disabled = false;
    const badge = document.getElementById('monBadge');
    if (badge) badge.textContent = 'ON';
    monAlertCount = 0; monFocusS = 0; monAwayS = 0;
    alertFired10 = false; alertFired30 = false; alertFired60 = false;
    const mf = document.getElementById('msFocusSec'); if (mf) mf.textContent = '0m';
    const ma = document.getElementById('msAwaySec'); if (ma) ma.textContent = '0s';
    const mal = document.getElementById('msAlerts'); if (mal) mal.textContent = '0';
    setMonStatus('idle', 0);
    const stxt = document.getElementById('monStatusTxt'); if (stxt) stxt.textContent = '⏳ Loading AI…';
    setMonMsg('📷 Camera active! Loading AI models in background…');
    monShowToast('Camera on! AI models loading…', '👁️');
    startDetection();
    loadFaceApi().then(() => {
      setMonMsg(rMsg('welcome'));
      const s = document.getElementById('monStatusTxt'); if (s) s.textContent = '✅ AI Ready';
      monShowToast('AI models loaded! Full face detection active ✨', '🤖');
    }).catch(() => {
      setMonMsg('📷 Camera active! Using motion detection. I\'m watching you!');
      const s = document.getElementById('monStatusTxt'); if (s) s.textContent = '📷 Basic mode active';
    });
  } else {
    stopDetection(); stopCamera(); monEnabled = false;
    localStorage.setItem(MON_STATE_KEY, 'false');
    btn.textContent = '📷 Enable AI Monitoring'; btn.classList.remove('on');
    const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'OFF';
    setMonMsg(rMsg('disabled'));
    const dot = document.getElementById('monDot'); if (dot) dot.className = 'mon-dot idle';
    const stxt = document.getElementById('monStatusTxt');
    if (stxt) { stxt.textContent = 'Camera Off'; stxt.style.color = '#B0A0CC'; }
    const t = document.getElementById('monTimer'); if (t) t.textContent = '—';
    const ov = document.getElementById('noFaceOverlay'); if (ov) ov.style.display = 'none';
  }
}

// ── FAB / PANEL TOGGLE ──
function toggleMonPanel() {
  const p = document.getElementById('monitorPanel');
  const fab = document.getElementById('monFab');
  if (!p) return;
  if (p.style.display === 'none' || p.style.display === '') {
    p.style.display = 'block'; fab.textContent = '✕ Close Monitor'; fab.classList.add('active');
  } else {
    p.style.display = 'none'; fab.textContent = '👁️ AI Monitor'; fab.classList.remove('active');
  }
}

function monMinimize() {
  const p = document.getElementById('monitorPanel');
  const btn = document.getElementById('monMinBtn');
  if (!p) return;
  p.classList.toggle('mon-mini');
  btn.textContent = p.classList.contains('mon-mini') ? '+' : '—';
}

// ── AUTO-RESUME on page load ──
// If user had monitoring ON before navigating, restart it automatically
window.addEventListener('DOMContentLoaded', () => {
  const wasEnabled = localStorage.getItem(MON_STATE_KEY) === 'true';
  if (wasEnabled) {
    // Small delay to let DOM settle, then auto-start
    setTimeout(async () => {
      const btn = document.getElementById('monEnableBtn');
      if (!btn) return;
      monShowToast('📷 Resuming AI monitoring from previous page…', '👁️');
      const ok = await startCamera();
      if (!ok) {
        localStorage.setItem(MON_STATE_KEY, 'false');
        return;
      }
      monEnabled = true;
      btn.textContent = '🔴 Disable Monitoring'; btn.classList.add('on');
      const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'ON';
      monAlertCount = 0; monFocusS = 0; monAwayS = 0;
      alertFired10 = false; alertFired30 = false; alertFired60 = false;
      setMonStatus('idle', 0);
      setMonMsg(rMsg('page_change'));
      startDetection();
      loadFaceApi().then(() => {
        const s = document.getElementById('monStatusTxt'); if (s) s.textContent = '✅ AI Ready';
      }).catch(() => {});
    }, 600);
  }

  // Request notification permission
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
});

// ── HOOKS for Timer page (called by timer.js if it exists) ──
function onMonStudyStart() {
  if (!monEnabled) return;
  monPhase = 'study'; monAwayS = 0; monFocusS = 0; monLastAlert = 0;
  if (!monCamOn) {
    startCamera().then(ok => { if (ok) { startDetection(); setMonMsg(rMsg('study_start') || '🎯 Study session started! I\'m watching!'); } });
  } else {
    startDetection(); setMonMsg('🎯 Timer started! Stay focused — I\'m watching! 👀');
  }
  const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'ON';
}
function onMonBreakStart() {
  if (!monEnabled) return;
  monPhase = 'break';
  stopDetection(); stopCamera();
  const dot = document.getElementById('monDot'); if (dot) dot.className = 'mon-dot idle';
  const stxt = document.getElementById('monStatusTxt');
  if (stxt) { stxt.textContent = '☕ On Break'; stxt.style.color = '#2193b0'; }
  const t = document.getElementById('monTimer'); if (t) t.textContent = '—';
  const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'BREAK';
  const ov = document.getElementById('noFaceOverlay'); if (ov) ov.style.display = 'none';
  setMonMsg('Great work! Enjoy your break — you earned it! ☕');
  monShowToast('📷 Camera off — enjoy your break!', '☕');
}
function onMonPause() {
  if (!monEnabled) return;
  stopDetection();
  setMonMsg('Timer paused. Take a breath and come back! ⏸️');
  const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'PAUSED';
}
function onMonTimerStop() {
  if (!monEnabled) return;
  monPhase = 'idle';
  stopDetection(); stopCamera();
  const dot = document.getElementById('monDot'); if (dot) dot.className = 'mon-dot idle';
  const stxt = document.getElementById('monStatusTxt');
  if (stxt) { stxt.textContent = '⏹️ Timer Stopped'; stxt.style.color = '#B0A0CC'; }
  const t = document.getElementById('monTimer'); if (t) t.textContent = '—';
  const badge = document.getElementById('monBadge'); if (badge) badge.textContent = 'OFF';
  const ov = document.getElementById('noFaceOverlay'); if (ov) ov.style.display = 'none';
  setMonMsg('Session complete! Well done today! 🌸');
}
