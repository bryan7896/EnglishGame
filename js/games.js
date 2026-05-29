// ════════════════════════════════════════════
//  AUDIO / TTS
// ════════════════════════════════════════════

function speakLang(text, lang, onend) {
    if (!window.speechSynthesis) { if (onend) onend(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang || 'es-MX';
    utt.rate = 0.85;
    utt.onend = utt.onerror = () => { if (onend) onend(); };
    const go = () => {
        const vs = window.speechSynthesis.getVoices();
        const v = vs.find(x => x.lang === lang) || vs.find(x => x.lang.startsWith((lang || 'es').split('-')[0])) || null;
        if (v) utt.voice = v;
        window.speechSynthesis.speak(utt);
    };
    window.speechSynthesis.getVoices().length ? go() : (window.speechSynthesis.onvoiceschanged = go);
}

function playBeep(cb) {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'square';
        o.frequency.value = 440;
        g.gain.setValueAtTime(0.08, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
        o.start();
        o.stop(c.currentTime + 0.35);
        o.onended = () => { c.close(); if (cb) cb(); };
    } catch (e) { if (cb) cb(); }
}

function speakTranslation(text) {
    const btn = document.getElementById('spk-btn');
    if (btn) btn.classList.add('going');
    speakLang(text, 'es-MX', () => {
        const b = document.getElementById('spk-btn');
        if (b) b.classList.remove('going');
    });
}

function revealText() {
    const d = document.getElementById('revealed'), b = document.getElementById('reveal-btn');
    if (d) d.style.display = 'block';
    if (b) b.style.display = 'none';
}

function playPing() {
    try {
        const c = new (window.AudioContext || window.webkitAudioContext)();
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(540, c.currentTime);
        o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.12);
        g.gain.setValueAtTime(0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
        o.start();
        o.stop(c.currentTime + 0.32);
    } catch (e) { }
}

// ════════════════════════════════════════════
//  GAME SYSTEM
// ════════════════════════════════════════════

function startGame(si, ni) {
    gStoryIdx = si;
    gNodeIdx = ni;
    gStory = S.storyData[si];
    if (!gStory) return;
    if (!S.gameProgress[si]) S.gameProgress[si] = { answers: {}, correct: {}, timeMs: 0 };
    S.gameProgress[si].startTime = Date.now();
    S.lastActivity = Date.now();
    
    // Find first unanswered exercise
    let start = 0, allAns = true;
    for (let i = 0; i < gStory.exercises.length; i++) {
        if (S.gameProgress[si].answers[i] === undefined) {
            start = i;
            allAns = false;
            break;
        }
    }
    if (allAns) {
        renderGameComplete();
        return;
    }
    gExIdx = start;
    save();
    renderGameEx();
}

function playGameTTS(ex) {
    const btn = document.getElementById('tts-g-btn');
    if (btn) {
        btn.classList.add('speaking');
        btn.textContent = '🔊 Escuchando...';
    }

    const done = () => {
        const b = document.getElementById('tts-g-btn');
        if (b) {
            b.classList.remove('speaking');
            b.textContent = '🔊 Escuchar';
        }
    };

    const { tts, sentence } = ex;

    if (!tts?.enabled) {
        done();
        return;
    }

    if (ex.type === 'scramble' && tts.textToRead) {
        speakLang(tts.textToRead, 'en-US', done);
        return;
    }

    if (tts.readFullSentence) {
        const txt = (sentence || '').replace(/_{2,}(\s*\([^)]+\))?/g, tts.blankReplacement || 'blank');
        speakLang(txt, 'en-US', done);
        return;
    }

    // fill_audio: split and beep
    const parts = (sentence || '').split('___');
    if (parts.length >= 2) {
        speakLang(parts[0].trim(), 'en-US', () => {
            playBeep(() => {
                const rest = parts[1].trim();
                if (rest) speakLang(rest, 'en-US', done);
                else done();
            });
        });
    } else {
        speakLang(sentence || '', 'en-US', done);
    }
}

function renderGameEx() {
    if (!gStory) return;
    const ex = gStory.exercises[gExIdx];
    const total = gStory.exercises.length;
    const mc = getMascot();
    gSelected = null;

    const dotsH = gStory.exercises.map((_, i) => {
        let c = 'gdot';
        const p = S.gameProgress[gStoryIdx];
        if (p?.answers[i] !== undefined) c += ' done';
        else if (i === gExIdx) c += ' cur';
        return `<div class="${c}"></div>`;
    }).join('');

    let typeLabel = '', typeCls = '', innerH = '';

    // Store current exercise reference for the button
    const exSerialized = encodeURIComponent(JSON.stringify(ex));

    if (ex.type === 'fill_choice') {
        typeLabel = 'Opción múltiple';
        typeCls = 'gtb-fc';
        innerH = renderFillChoice(ex);
    } else if (ex.type === 'fill_audio') {
        typeLabel = 'Audio + elección';
        typeCls = 'gtb-fa';
        innerH = renderFillAudio(ex, exSerialized);
    } else if (ex.type === 'scramble') {
        typeLabel = 'Ordenar palabras';
        typeCls = 'gtb-sc';
        innerH = renderScramble(ex, exSerialized);
    } else if (ex.type === 'fill_write') {
        typeLabel = 'Completar escrita';
        typeCls = 'gtb-fw';
        innerH = renderFillWrite(ex, exSerialized);
    }

    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-game">
    <div class="hdr"><button class="back" onclick="renderMap()">←</button>
        <span style="font-size:11px;font-weight:800;color:var(--muted)">${esc(gStory.title || '')} · ${gExIdx + 1}/${total}</span>
        <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
    <div class="game-body sb">
        <div class="gdots">${dotsH}</div>
        <div style="text-align:center;margin-bottom:2px"><span class="g-type-badge ${typeCls}">${typeLabel}</span></div>
        ${innerH}
        ${ex.hint ? `<button class="hint-btn" onclick="toggleHint()">💡 Ver pista</button>
        <div class="hint-box" id="hint-box">${esc(ex.hint)}</div>` : ''}
        <div class="ex-meta">${gStory.title || ''} · Historia</div>
    </div>
</div>`;

    // Auto-play for fill_audio
    if (ex.type === 'fill_audio') {
        setTimeout(() => {
            playGameTTS(ex);
        }, 600);
    }
}

function renderFillChoice(ex) {
    const parts = (ex.sentence || '').split('___');
    const sentH = parts.length >= 2 ? `${esc(parts[0])}<span class="blank-w">___</span>${esc(parts[1])}` : esc(ex.sentence || '');
    const choicesH = (ex.alternatives || []).map((alt, i) => `<button class="choice" data-val="${esc(alt)}" onclick="selectChoice(this)">${esc(alt)}</button>`).join('');
    return `<div class="game-card">
        ${ex.tts?.enabled ? `<div class="tts-row"><button class="tts-g" id="tts-g-btn" onclick="playGameTTS(${JSON.stringify(ex).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;')})">🔊 Escuchar</button></div>` : ''}
        <div class="game-sentence">${sentH}</div>
    </div>
    <div class="choices" id="choices">${choicesH}</div>
    <button class="btn btn-p" id="game-check-btn" onclick="checkChoice()" disabled>Verificar respuesta</button>`;
}

function renderFillAudio(ex, serialized) {
    const parts = (ex.sentence || '').split('___');
    const sentH = parts.length >= 2 ? `${esc(parts[0])}<span class="blank-w">___</span>${esc(parts[1])}` : esc(ex.sentence || '');
    const choicesH = (ex.alternatives || []).map((alt) => `<button class="choice" data-val="${esc(alt)}" onclick="selectChoice(this)">${esc(alt)}</button>`).join('');
    
    return `<div class="game-card">
        <div class="tts-row"><button class="tts-g" id="tts-g-btn" data-ex='${serialized}' onclick="playGameTTSFromAttr(this)">🔊 Escuchar frase</button></div>
        <div class="game-sentence" style="font-size:14px;color:var(--muted)">${sentH}</div>
    </div>
    <div class="choices" id="choices">${choicesH}</div>
    <button class="btn btn-p" id="game-check-btn" onclick="checkChoice()" disabled>Verificar respuesta</button>`;
}

function renderScramble(ex, serialized) {
    gWords = (ex.words || []).map((w, i) => ({ id: i, word: w, used: false }));
    // Shuffle words
    for (let i = gWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gWords[i], gWords[j]] = [gWords[j], gWords[i]];
    }
    gPlaced = [];
    const poolH = gWords.map(w => `<div class="wchip" data-id="${w.id}" onclick="pickWord(${w.id})">${esc(w.word)}</div>`).join('');
    
    return `<div class="game-card">
        ${ex.tts?.enabled ? `<div class="tts-row"><button class="tts-g" id="tts-g-btn" data-ex='${serialized}' onclick="playGameTTSFromAttr(this)">🔊 Escuchar frase</button></div>` : ''}
        <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px">Ordena las palabras para formar la oración:</div>
        <div class="scr-ans" id="scr-ans"><span class="scr-empty">Toca las palabras para ordenarlas</span></div>
    </div>
    <div class="scr-pool" id="scr-pool">${poolH}</div>
    <button class="btn btn-p" id="game-check-btn" onclick="checkScramble()" disabled>Verificar orden</button>`;
}

function renderFillWrite(ex, serialized) {
    const displaySent = (ex.sentence || '').replace(/_{2,}(\s*\([^)]+\))?/, '<span class="blank-w">_______</span>');
    
    return `<div class="game-card">
        ${ex.tts?.enabled ? `<div class="tts-row"><button class="tts-g" id="tts-g-btn" data-ex='${serialized}' onclick="playGameTTSFromAttr(this)">🔊 Escuchar</button></div>` : ''}
        <div class="game-sentence">${displaySent}</div>
    </div>
    <div class="ans-lbl" style="margin-bottom:8px">✏️ Escribe la forma correcta</div>
    <div class="chat-wrap" style="border-color:var(--pink)">
        <textarea class="chat-ta" id="game-ans" placeholder="Escribe aquí..." oninput="autoR(this)" style="min-height:44px"></textarea>
        <button class="chat-send" style="background:linear-gradient(135deg,var(--pink),#c2185b)" onclick="checkWrite()">▶</button>
    </div>`;
}

function playGameTTSFromAttr(btn) {
    const exData = btn.getAttribute('data-ex');
    if (exData) {
        const ex = JSON.parse(decodeURIComponent(exData));
        playGameTTS(ex);
    }
}

// ════ GAME INTERACTIONS ════
function selectChoice(btn) {
    document.querySelectorAll('.choice').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    gSelected = btn.dataset.val;
    const cb = document.getElementById('game-check-btn');
    if (cb) cb.disabled = false;
}

function checkChoice() {
    if (!gSelected) return;
    const ex = gStory.exercises[gExIdx];
    const correct = gSelected === ex.correct;
    document.querySelectorAll('.choice').forEach(b => {
        if (b.dataset.val === ex.correct) b.classList.add('ok');
        else if (b.dataset.val === gSelected && !correct) b.classList.add('no');
    });
    const cb = document.getElementById('game-check-btn');
    if (cb) cb.disabled = true;
    showFeedback(correct, ex.correct, () => saveGameAnswer(gSelected, correct));
}

function pickWord(id) {
    const w = gWords.find(x => x.id === id);
    if (!w || w.used) return;
    w.used = true;
    gPlaced.push(id);
    updateScramble();
}

function unpickWord(idx) {
    const id = gPlaced[idx];
    gPlaced.splice(idx, 1);
    const w = gWords.find(x => x.id === id);
    if (w) w.used = false;
    updateScramble();
}

function updateScramble() {
    const ans = document.getElementById('scr-ans'), pool = document.getElementById('scr-pool');
    if (!ans || !pool) return;
    
    ans.innerHTML = gPlaced.length === 0 ? '<span class="scr-empty">Toca las palabras para ordenarlas</span>'
        : gPlaced.map((id, i) => {
            const w = gWords.find(x => x.id === id);
            return `<div class="wchip placed" onclick="unpickWord(${i})">${esc(w?.word || '')}</div>`;
        }).join('');
    
    pool.innerHTML = gWords.filter(w => !w.used).map(w => `<div class="wchip" data-id="${w.id}" onclick="pickWord(${w.id})">${esc(w.word)}</div>`).join('');
    
    const cb = document.getElementById('game-check-btn');
    if (cb) cb.disabled = gPlaced.length !== gWords.length;
}

function checkScramble() {
    const ex = gStory.exercises[gExIdx];
    const answer = gPlaced.map(id => gWords.find(x => x.id === id)?.word || '').join(' ');
    const correct = norm(answer) === norm(ex.correctOrder || '');
    showFeedback(correct, ex.correctOrder, () => saveGameAnswer(answer, correct));
}

function checkWrite() {
    const inp = document.getElementById('game-ans');
    const ans = (inp?.value || '').trim();
    if (!ans) {
        toast('✏️ Escribe tu respuesta');
        inp?.focus();
        return;
    }
    const ex = gStory.exercises[gExIdx];
    const correct = norm(ans) === norm(ex.correct || '');
    showFeedback(correct, ex.correct, () => saveGameAnswer(ans, correct));
}

function toggleHint() {
    const hb = document.getElementById('hint-box');
    if (hb) hb.classList.toggle('show');
}

// ════ FEEDBACK ════
function showFeedback(correct, correctAns, cb) {
    if (correct) playPing();
    if (navigator.vibrate) navigator.vibrate(correct ? [40] : [80, 40, 80]);
    
    const card = document.querySelector('.game-card');
    if (!card) {
        if (cb) cb();
        return;
    }
    
    const fb = document.createElement('div');
    fb.className = 'fb-ov ' + (correct ? 'ok' : 'bad');
    fb.innerHTML = `<div class="fb-em">${correct ? '✅' : '❌'}</div>
        <div class="fb-title ${correct ? 'fb-ok' : 'fb-bad'}">${correct ? '¡Correcto!' : 'Incorrecto'}</div>
        ${!correct ? `<div class="fb-ans">La respuesta correcta es:<br><strong>${esc(correctAns || '')}</strong></div>` : ''}`;
    card.appendChild(fb);
    
    const delay = correct ? 1600 : 2600;
    setTimeout(() => {
        if (cb) cb();
    }, delay);
}

function saveGameAnswer(answer, correct) {
    const p = S.gameProgress[gStoryIdx];
    if (!p) return;
    p.answers[gExIdx] = answer;
    p.correct[gExIdx] = correct;
    save();
    
    // Next exercise
    let next = gExIdx + 1;
    while (next < gStory.exercises.length && p.answers[next] !== undefined) next++;
    
    if (next < gStory.exercises.length) {
        gExIdx = next;
        setTimeout(() => renderGameEx(), 300);
    } else {
        if (p.startTime) {
            p.timeMs = (p.timeMs || 0) + (Date.now() - p.startTime);
            p.startTime = null;
        }
        save();
        setTimeout(() => renderGameComplete(), 300);
    }
}

// ════ GAME COMPLETE ════
function renderGameComplete() {
    const p = S.gameProgress[gStoryIdx];
    const total = gStory?.exercises?.length || 0;
    const corr = p ? Object.values(p.correct || {}).filter(Boolean).length : 0;
    const allCorrect = corr === total;
    
    if (allCorrect) confetti(40);
    else if (corr > total / 2) confetti(20);
    
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-gc">
    <div class="hdr"><button class="back" onclick="renderMap()">←</button>
        <span class="logo" style="color:var(--pink)">${esc(gStory?.title || 'Historia')}</span>
        <div class="hdr-r"></div></div>
    <div class="cmp-body sb">
        <span class="em dance" style="font-size:68px">${allCorrect ? '🥳' : '😊'}</span>
        <div class="au"><h2 class="cmp-title">${allCorrect ? '¡Historia completa! 🎉' : 'Historia terminada'}</h2>
        <p class="cmp-sub">${allCorrect ? '¡Respuestas perfectas!' : 'Buen intento, sigue practicando 💪'}</p></div>
        <div class="sgrid au" style="animation-delay:.08s">
            <div class="sc"><span class="sv">${corr}/${total}</span><span class="sl">Correctas</span></div>
            <div class="sc"><span class="sv">${Math.round(corr / total * 100)}%</span><span class="sl">Precisión</span></div>
            <div class="sc"><span class="sv">⏱ ${fmtMs(p?.timeMs)}</span><span class="sl">Tiempo</span></div>
            <div class="sc"><span class="sv">🎮</span><span class="sl">Historia</span></div>
        </div>
        ${_nextGameNode() !== null ? `<button class="btn btn-pink au" style="animation-delay:.15s" onclick="startNode(${_nextGameNode()})">▶️ Siguiente nodo</button>` : ''}
        <button class="btn btn-s au" style="animation-delay:.22s" onclick="renderMap()">🗺️ Ver mapa</button>
    </div>
</div>`;
}

function _nextGameNode() {
    const nodes = buildNodes();
    for (let i = 0; i < nodes.length; i++) {
        if (!nodeDone(nodes[i]) && nodeOpen(i, nodes)) return i;
    }
    return null;
}