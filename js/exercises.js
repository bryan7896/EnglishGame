// ════ EXERCISE SCREEN ════
function startExercise(li, ni) {
    S.currentLevel = li;
    const ea = S.levels[li];
    let start = 0, allAns = true;
    for (let i = 0; i < ea.length; i++) {
        if (S.responses[ea[i]] === undefined) {
            start = i;
            allAns = false;
            break;
        }
    }
    if (allAns) {
        renderLvlComplete(li, false);
        return;
    }
    S.currentExInLevel = start;
    lvlStart = Date.now();
    exStart = Date.now();
    S.lastActivity = Date.now();
    save();
    renderExercise();
}

function renderExercise() {
    const li = S.currentLevel, ea = S.levels[li], ei = S.currentExInLevel, gi = ea[ei];
    const phrase = S.exercises[gi], existing = S.responses[gi] || '';
    const mc = getMascot();
    
    const dotsH = ea.map((gIdx, i) => {
        let c = 'dot';
        if (S.responses[gIdx] !== undefined) c += ' done';
        else if (i === ei) c += ' cur';
        return `<div class="${c}"></div>`;
    }).join('');
    
    const cardH = S.audioMode ? `<div class="audio-card">
        <div class="audio-tag">🔊 Modo Audio · Nivel ${li + 1}</div>
        <button class="spk-btn" id="spk-btn" onclick="speakTranslation('${esc(phrase)}')">🔊</button>
        <div class="audio-hint">Toca para escuchar la frase en español</div>
        <div id="revealed" style="display:none"><p class="revealed-t">${esc(phrase)}</p></div>
        <button class="reveal-btn" id="reveal-btn" onclick="revealText()">👁 Ver texto</button>
    </div>` : `<div class="ex-card">
        <div class="ex-tag">🌎 Traduce al inglés</div>
        <div class="ex-phrase">${esc(phrase)}</div>
        <div class="ex-hint">Escribe tu mejor traducción</div>
    </div>`;
    
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-ex">
    <div class="hdr"><button class="back" onclick="renderMap()">←</button>
        <span style="font-size:12px;font-weight:800;color:var(--muted)">Nivel ${li + 1} · ${ei + 1}/${ea.length}</span>
        <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
    <div class="mascot" style="padding:11px 20px 6px"><span class="em ${mc.a}" style="font-size:42px">${mc.e}</span><div class="bubble">${mc.m}</div></div>
    <div class="ex-body sb">
        <div class="dots">${dotsH}</div>
        ${cardH}
        <div><div class="ans-lbl" style="margin-bottom:8px">✏️ Tu traducción al inglés</div>
            <div class="chat-wrap"><textarea class="chat-ta" id="ans" placeholder="Type your English translation..." oninput="autoR(this)">${esc(existing)}</textarea>
            <button class="chat-send" onclick="saveAns()">▶</button></div></div>
        <div class="ex-meta">Total: ${totalDone()} / ${S.exercises.length}</div>
    </div>
</div>`;
    
    setTimeout(() => {
        const ta = document.getElementById('ans');
        if (ta) {
            autoR(ta);
            if (!existing) ta.focus();
        }
    }, 380);
}

function autoR(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
}

function saveAns() {
    const inp = document.getElementById('ans');
    const ans = (inp?.value || '').trim();
    if (!ans) {
        toast('✏️ Escribe tu respuesta primero');
        inp?.focus();
        return;
    }
    
    const li = S.currentLevel, ea = S.levels[li], ei = S.currentExInLevel, gi = ea[ei];
    const isNew = S.responses[gi] === undefined;
    
    S.responses[gi] = ans;
    S.lastActivity = Date.now();
    
    if (isNew) {
        S.dailyCount = (S.dailyCount || 0) + 1;
        S.totalHistorical = (S.totalHistorical || 0) + 1;
        if (exStart) S.totalMs = (S.totalMs || 0) + (Date.now() - exStart);
    }
    exStart = Date.now();
    if (navigator.vibrate) navigator.vibrate(40);
    playPing();
    save();
    
    const done_ = ea.every(i => S.responses[i] !== undefined);
    if (done_) {
        if (lvlStart) S.levelTimes[li] = Date.now() - lvlStart;
        save();
        toast(randMsg());
        setTimeout(() => renderLvlComplete(li, true), 620);
    } else {
        let next = ei + 1;
        while (next < ea.length && S.responses[ea[next]] !== undefined) next++;
        S.currentExInLevel = next < ea.length ? next : ei;
        save();
        toast(randMsg());
        setTimeout(() => renderExercise(), 500);
    }
}

// ════ LEVEL COMPLETE ════
function renderLvlComplete(li, animated) {
    if (animated) confetti(35);
    const ea = S.levels[li], t = S.levelTimes[li] || 0;
    const done = totalDone(), tot = S.exercises.length;
    const nodes = buildNodes();
    const nextNodeIdx = getNextNodeIndex();
    const hasNext = nextNodeIdx !== null && nextNodeIdx < nodes.length;
    
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-lc">
    <div class="hdr"><button class="back" onclick="renderMap()">←</button>
        <span class="logo">Nivel ${li + 1} ✓</span><div class="hdr-r"></div></div>
    <div class="cmp-body sb">
        <span class="em dance" style="font-size:68px">🥳</span>
        <div class="au"><h2 class="cmp-title">¡Nivel ${li + 1} completado!</h2>
        <p class="cmp-sub">${randMsg()}</p></div>
        <div class="sgrid au" style="animation-delay:.08s">
            <div class="sc"><span class="sv">⏱ ${fmtMs(t)}</span><span class="sl">Tiempo</span></div>
            <div class="sc"><span class="sv">${ea.length}</span><span class="sl">Ejercicios</span></div>
            <div class="sc"><span class="sv">${done}</span><span class="sl">Total completados</span></div>
            <div class="sc"><span class="sv">${Math.round(done / tot * 100)}%</span><span class="sl">Progreso</span></div>
        </div>
        ${hasNext ? `<button class="btn btn-p au" style="animation-delay:.15s" onclick="startNode(${nextNodeIdx})">▶️ Siguiente nivel</button>` : ''}
        <button class="btn btn-s au" style="animation-delay:.22s" onclick="renderMap()">🗺️ Ver mapa</button>
    </div>
</div>`;
}

// ════ ALL COMPLETE ════
function renderAllComplete() {
    confetti(90);
    const done = totalDone(), tot = S.exercises.length;
    const exRows = S.levels.map((ea, li) => `<div class="time-row"><span>Nivel ${li + 1}</span><span style="color:var(--pri)">${S.levelTimes[li] ? fmtMs(S.levelTimes[li]) : '—'}</span></div>`).join('');
    
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-all">
    <div class="hdr"><span class="logo">✨ LinguaQuest</span><div class="hdr-r"></div></div>
    <div class="cmp-body sb">
        <span class="final-em">🥳</span>
        <h2 class="cmp-title au">¡Increíble trabajo! 🎉</h2>
        <p class="final-msg au" style="animation-delay:.08s">Hoy entrenaste tu inglés como un campeón.<br>Tu constancia construye fluidez real 💪<br><span style="color:var(--pri);font-weight:800">¡Eres imparable!</span></p>
        <div class="sgrid au" style="animation-delay:.14s">
            <div class="sc"><span class="sv">${done}</span><span class="sl">Traducciones</span></div>
            <div class="sc"><span class="sv">📚 ${S.totalHistorical || 0}</span><span class="sl">Total histórico</span></div>
            <div class="sc"><span class="sv">${fmtMs(S.totalMs)}</span><span class="sl">Tiempo total</span></div>
            <div class="sc"><span class="sv">${fmtAvg(S.totalMs, done)}</span><span class="sl">Prom/ejercicio</span></div>
        </div>
        ${exRows ? `<div class="time-table au" style="animation-delay:.2s;width:100%"><div class="time-table-h">📚 Niveles de traducción</div>${exRows}</div>` : ''}
        <button class="btn btn-g au" style="animation-delay:.27s" onclick="copyAnswers()">📋 Copiar respuestas + estadísticas</button>
        <button class="btn btn-p au" style="animation-delay:.31s" onclick="renderMap()">🗺️ Ver mapa</button>
    </div>
</div>`;
}

// ════ HELPER: Get next node index ════
function getNextNodeIndex() {
    const nodes = buildNodes();
    for (let i = 0; i < nodes.length; i++) {
        if (!nodeDone(nodes[i])) {
            return i;
        }
    }
    return null;
}