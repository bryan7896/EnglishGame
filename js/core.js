// ════ STATE ════
const SK = 'lq_v5';
function defS() {
    return {
        exercises: [], levels: [], responses: {},
        storyData: [], gameProgress: {},
        currentLevel: 0, currentExInLevel: 0,
        levelTimes: {}, totalMs: 0,
        streak: 0, lastStudyDate: null,
        dailyCount: 0, dailyDate: null,
        totalHistorical: 0, lastActivity: null,
        audioMode: false
    };
}
let S = defS(), lastMsg = -1;

// Game ephemeral state
let gStory = null, gStoryIdx = -1, gExIdx = 0, gNodeIdx = -1, gGameStart = null;
let gWords = [], gPlaced = [];
let gSelected = null;

const MSGS = ['¡Vas increíble! 🔥', 'Ya estás dominando esto 💪', '¡No te rindas! 😄',
    'Tu inglés está mejorando mucho ✨', '¡Un ejercicio más! 💪', 'Excelente consistencia 🌟',
    '¡Eso es! ¡Sigue así! 🎯', 'Cada respuesta te hace más fluido 🌊',
    '¡Eres imparable! ⚡', 'Tu esfuerzo vale la pena 💎', '¡Fantástico! 🚀',
    '¡Sigue brillando! 🌈', 'Tu cerebro lo está asimilando 🧠',
];
const MASCOTS = {
    idle: { e: '😊', a: '', m: '¡Listo para estudiar! 🚀' },
    happy: { e: '😄', a: 'bounce', m: '¡Excelente trabajo! 👏' },
    cool: { e: '😎', a: '', m: '¡Qué consistencia tan increíble!' },
    sad: { e: '😢', a: 'sad', m: 'Te extrañé... ¡Vuelve a estudiar!' },
    sleep: { e: '😴', a: 'sleep', m: 'Zzz... despiértame cuando estudies!' },
    party: { e: '🥳', a: 'dance', m: '¡Meta cumplida! 🎉' },
    push: { e: '💪', a: 'pulse', m: '¡Tú puedes! ¡Sigue adelante!' },
};

// ════ STORAGE ════
function save() { try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) { } }
function load() { try { const r = localStorage.getItem(SK); if (r) S = { ...defS(), ...JSON.parse(r) }; } catch (e) { S = defS(); } }

// ════ STREAK & LEVELS ════
function checkStreak() {
    const today = new Date().toDateString();
    if (S.dailyDate !== today) {
        const yest = new Date(Date.now() - 86400000).toDateString();
        if (S.lastStudyDate === yest) S.streak = (S.streak || 0) + 1;
        else if (S.lastStudyDate !== today) S.streak = 1;
        S.dailyDate = today; S.dailyCount = 0;
    }
    S.lastStudyDate = today; save();
}
function buildLevels(arr) { const r = []; for (let i = 0; i < arr.length; i += 3) r.push(arr.slice(i, i + 3).map((_, j) => i + j)); return r; }
function lvlDone(li) { return S.levels[li]?.every(i => S.responses[i] !== undefined) ?? false; }
function storyDone(si) {
    const st = S.storyData[si]; const p = S.gameProgress[si];
    if (!st || !p) return false;
    return st.exercises.every((_, i) => p.answers && p.answers[i] !== undefined);
}
function totalDone() { return Object.keys(S.responses).length; }
function allExDone() { return S.exercises.length > 0 && totalDone() >= S.exercises.length; }

// ════ MAP NODES ════
function buildNodes() {
    const nodes = [];
    let ei = 0, gi = 0, vi = 0;
    let lastWasVerbGame = false;
    let verbGamesCount = 0;
    
    // Contar cuántos juegos de verbos hay
    const verbGames = S.verbGamesData || [];
    
    while (ei < S.levels.length || gi < S.storyData.length || vi < verbGames.length) {
        // Insertar juego de verbos cada 2 nodos (si hay disponibles)
        if (verbGamesCount < verbGames.length && (nodes.length % 3 === 2 || (S.levels.length === 0 && S.storyData.length === 0))) {
            nodes.push({ type: 'verbGame', vi: verbGamesCount++ });
        }
        // Insertar niveles de traducción
        else if (ei < S.levels.length) {
            nodes.push({ type: 'ex', li: ei++ });
        }
        // Insertar juegos de historia existentes
        else if (gi < S.storyData.length) {
            nodes.push({ type: 'game', si: gi++ });
        }
        // Si solo hay juegos de verbos
        else if (vi < verbGames.length) {
            nodes.push({ type: 'verbGame', vi: vi++ });
        }
    }
    
    return nodes;
}
function nodeDone(n) {
    if (n.type === 'ex') return lvlDone(n.li);
    if (n.type === 'game') return storyDone(n.si);
    if (n.type === 'verbGame') {
        const verbData = S.verbGamesData?.[n.vi];
        if (!verbData) return false;
        const verbGameId = `verb_${verbData.spanishWord}`;
        return S.gameProgress[verbGameId]?.answers?.completed === true;
    }
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
    if (S.streak >= 7) return MASCOTS.cool;
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

function isVerbGameNode(node) {
    return node.type === 'verbGame';
}

function getVerbGameData(verbId) {
    return S.verbGamesData?.find(v => v.spanishWord === verbId) || null;
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

// ════ TIMERS FOR EXERCISES ════
let lvlStart = null, exStart = null;