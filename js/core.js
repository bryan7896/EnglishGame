// ════ STATE ════
const SK = 'lq_v5';
function defS() {
    return {
        exercises: [], levels: [], responses: {},
        currentLevel: 0, currentExInLevel: 0,
        levelTimes: {}, totalMs: 0,
        dailyCount: 0, dailyDate: null,
        totalHistorical: 0, lastActivity: null,
        audioMode: false
    };
}
let S = defS(), lastMsg = -1;

const MSGS = ['¡Vas increíble! 🔥', 'Ya estás dominando esto 💪', '¡No te rindas! 😄',
    'Tu inglés está mejorando mucho ✨', '¡Un ejercicio más! 💪', 'Excelente consistencia 🌟',
    '¡Eso es! ¡Sigue así! 🎯', 'Cada respuesta te hace más fluido 🌊',
    '¡Eres imparable! ⚡', 'Tu esfuerzo vale la pena 💎', '¡Fantástico! 🚀',
    '¡Sigue brillando! 🌈', 'Tu cerebro lo está asimilando 🧠',
];
const MASCOTS = {
    idle: { e: '😊', a: '', m: '¡Listo para estudiar! 🚀' },
    happy: { e: '😄', a: 'bounce', m: '¡Excelente trabajo! 👏' },
    cool: { e: '😎', a: '', m: '¡Qué bien estás progresando!' },
    sad: { e: '😢', a: 'sad', m: 'Te extrañé... ¡Vuelve a estudiar!' },
    sleep: { e: '😴', a: 'sleep', m: 'Zzz... despiértame cuando estudies!' },
    party: { e: '🥳', a: 'dance', m: '¡Meta cumplida! 🎉' },
    push: { e: '💪', a: 'pulse', m: '¡Tú puedes! ¡Sigue adelante!' },
};

// ════ STORAGE ════
function save() { try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) { } }
function load() { try { const r = localStorage.getItem(SK); if (r) S = { ...defS(), ...JSON.parse(r) }; } catch (e) { S = defS(); } }

// ════ LEVELS ════
function buildLevels(arr) { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i + 3).map((_, j) => i + j)); return r; }
function lvlDone(li) { return S.levels[li]?.every(i => S.responses[i] !== undefined) ?? false; }
function totalDone() { return Object.keys(S.responses).length; }
function allExDone() { return S.exercises.length > 0 && totalDone() >= S.exercises.length; }

// ════ MAP NODES ════
function buildNodes() {
    const nodes = [];
    for (let li = 0; li < S.levels.length; li++) {
        nodes.push({ type: 'ex', li: li });
    }
    return nodes;
}

function nodeDone(n) {
    if (n.type === 'ex') return lvlDone(n.li);
    return false;
}

function nodeOpen(ni, nodes) { return ni === 0 || nodeDone(nodes[ni - 1]); }

function activeNodeIdx(nodes) {
    for (let i = 0; i < nodes.length; i++) if (!nodeDone(nodes[i]) && nodeOpen(i, nodes)) return i;
    return Math.max(0, nodes.length - 1);
}

// ════ MASCOT ════
function getMascot() {
    const last = S.lastActivity, now = Date.now();
    if (last) { const d = (now - last) / 60000; if (d > 180) return MASCOTS.sleep; if (d > 60) return MASCOTS.sad; }
    const nodes = buildNodes();
    if (nodes.every(n => nodeDone(n)) && nodes.length > 0) return MASCOTS.party;
    if (totalDone() === 0) return MASCOTS.idle;
    return totalDone() < 5 ? MASCOTS.push : MASCOTS.happy;
}
function randMsg() {
    let i; do { i = Math.floor(Math.random() * MSGS.length); } while (i === lastMsg && MSGS.length > 1);
    lastMsg = i; return MSGS[i];
}

// ════ TIME ════
function fmtMs(ms) {
    if (!ms || ms < 0) return '—';
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    return Math.floor(ms / 60000) + 'm ' + Math.round((ms % 60000) / 1000) + 's';
}
function fmtAvg(ms, n) { return (!n || !ms) ? '—' : fmtMs(ms / n); }

// ════ SOUND / CONFETTI / TOAST / HELPERS ════
const CC = ['#8b7cf8', '#f06292', '#f9ca74', '#55efc4', '#74b9ff', '#fd79a8', '#a29bfe'];
function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function norm(s) { return (s || '').toLowerCase().trim().replace(/\s+/g, ' '); }

let toastT;
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2700);
}

function confetti(n) {
    const ck = document.getElementById('ck'); ck.innerHTML = '';
    for (let i = 0; i < n; i++) {
        const p = document.createElement('div'); p.className = 'cp';
        p.style.left = Math.random() * 100 + '%'; p.style.top = '-15px';
        p.style.background = CC[Math.floor(Math.random() * CC.length)];
        const sz = 7 + Math.random() * 10; p.style.width = sz + 'px'; p.style.height = sz + 'px';
        p.style.borderRadius = Math.random() > .5 ? '50%' : '3px';
        p.style.animationDuration = (1.6 + Math.random() * 2) + 's';
        p.style.animationDelay = (Math.random() * .8) + 's';
        ck.appendChild(p);
    }
    setTimeout(() => ck.innerHTML = '', 4800);
}

// ════ SOUND EFFECTS ════
function playPing() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.2;
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
        
        setTimeout(() => audioContext.close(), 500);
    } catch (e) {}
}

// ════ TIMERS FOR EXERCISES ════
let lvlStart = null, exStart = null;