// ════ MODAL ════
function openModal(html) {
    document.getElementById('modal').innerHTML = html;
    document.getElementById('modal').classList.add('show');
    document.getElementById('overlay').classList.add('show');
}
function closeModal() {
    document.getElementById('modal').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
}
function openOptions() {
    const done = totalDone(), tot = S.exercises.length;
    const stCount = S.storyData.length;
    const vgCount = S.verbGamesData?.length || 0;
    openModal(`
<div class="mpill"></div><div class="mtitle">⚙️ Opciones</div>
<div class="msec">MODO DE PRÁCTICA</div>
<button class="mact ${S.audioMode ? 'ton' : ''}" onclick="toggleAudio()">
  <span class="mact-ic">${S.audioMode ? '🔊' : '📝'}</span>
  <span class="mact-t">Modo audio<span class="mact-sub">Escucha la frase en vez de leerla</span></span>
  <span class="tbadge ${S.audioMode ? 'on' : 'off'}">${S.audioMode ? 'ON' : 'OFF'}</span>
</button>
<div class="msec">PROGRESO</div>
${done > 0 ? `<button class="mact acc" onclick="closeModal();copyPartial()">
  <span class="mact-ic">📋</span>
  <span class="mact-t">Copiar avances<span class="mact-sub">${done} de ${tot} respuestas</span></span>
</button>` : ''}
<button class="mact sc" onclick="closeModal();openAddModal()">
  <span class="mact-ic">➕</span>
  <span class="mact-t">Agregar ejercicios<span class="mact-sub">Concatenar sin perder progreso</span></span>
</button>
<button class="mact pnk" onclick="closeModal();openStoriesModal()">
  <span class="mact-ic">🎮</span>
  <span class="mact-t">Cargar juegos de historia<span class="mact-sub">${stCount > 0 ? stCount + ' historias cargadas' : 'Sin historias aún'}</span></span>
</button>
<button class="mact" onclick="closeModal();openVerbGamesModal()">
  <span class="mact-ic">📖</span>
  <span class="mact-t">Cargar Verb Quest<span class="mact-sub">${vgCount > 0 ? vgCount + ' verbos cargados' : 'Sin juegos de verbos'}</span></span>
</button>
<button class="mact" onclick="closeModal();openStats()">
  <span class="mact-ic">📊</span>
  <span class="mact-t">Estadísticas<span class="mact-sub">Tiempo por nivel y totales</span></span>
</button>
<div class="msec">ZONA PELIGROSA</div>
<button class="mact danger" onclick="confirmReset()">
  <span class="mact-ic">🔄</span>
  <span class="mact-t">Reiniciar progreso<span class="mact-sub">Borra respuestas y estadísticas</span></span>
</button>
<button class="mact danger" onclick="confirmClear()">
  <span class="mact-ic">🗑️</span>
  <span class="mact-t">Cargar nuevos ejercicios<span class="mact-sub">Reemplaza todo</span></span>
</button>
`);
}
function openVerbGamesModal() {
    const has = S.verbGamesData?.length > 0;
    openModal(`<div class="mpill"></div><div class="mtitle">📖 Verb Quest · Juegos de Verbos</div>
${has ? `<div class="info-card show" style="background:rgba(139,124,248,.07);border-color:rgba(139,124,248,.25);margin-bottom:12px">
  <div class="info-row"><span>📚 Verbos cargados</span><span class="info-v" style="color:var(--pri)">${S.verbGamesData.length}</span></div>
  <div class="info-row"><span>🎯 Verbos completados</span><span class="info-v" style="color:var(--mint)">${Object.keys(S.gameProgress).filter(k => k.startsWith('verb_') && S.gameProgress[k]?.answers?.completed).length}</span></div>
</div>` : ''}
<p style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:11px;text-align:center">Pega un array de verbos irregulares con sus formas y oraciones</p>
<textarea class="json-ta" id="verbgames-json" placeholder='[
  {
    "spanishWord": "romper",
    "verb": "break",
    "past": "broke",
    "participle": "broken",
    "verbSentenceEnglish": "I always break the chocolate in half.",
    "verbSentenceSpanish": "Siempre rompo el chocolate por la mitad.",
    "pastSentenceEnglish": "He broke his favorite mug yesterday.",
    "pastSentenceSpanish": "Él rompió su taza favorita ayer.",
    "participleSentenceEnglish": "The window is broken.",
    "participleSentenceSpanish": "La ventana está rota."
  }
]' oninput="prevVerbGames()" style="min-height:180px;margin-bottom:9px"></textarea>
<div class="err" id="verbgames-err"></div>
<div class="info-card" id="verbgames-prev" style="margin-bottom:9px"></div>
<button class="btn btn-p" style="margin-bottom:8px" onclick="doLoadVerbGames()">📖 ${has ? 'Reemplazar juegos de verbos' : 'Cargar juegos de verbos'}</button>
<button class="btn btn-s" onclick="closeModal()">Cancelar</button>`);
}

function prevVerbGames() {
    const v = (document.getElementById('verbgames-json') || {}).value || '';
    const pv = document.getElementById('verbgames-prev'), er = document.getElementById('verbgames-err');
    if (!v.trim()) { pv?.classList.remove('show'); er?.classList.remove('show'); return; }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Debe ser un array no vacío');
        // Validar estructura de cada verbo
        for (let i = 0; i < p.length; i++) {
            const verb = p[i];
            if (!verb.spanishWord || !verb.verb || !verb.past || !verb.participle) {
                throw new Error(`Verbo ${i + 1}: faltan campos requeridos (spanishWord, verb, past, participle)`);
            }
        }
        if (pv) {
            pv.innerHTML = `<div class="info-row"><span>📖 Verbos</span><span class="info-v" style="color:var(--pri)">${p.length}</span></div>
                           <div class="info-row"><span>📝 Ejemplos</span><span class="info-v">${p.reduce((a, v) => a + 3, 0)} oraciones</span></div>`;
            pv.classList.add('show');
        }
        if (er) er.classList.remove('show');
    } catch (e) {
        if (pv) pv.classList.remove('show');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}

function doLoadVerbGames() {
    const v = (document.getElementById('verbgames-json') || {}).value || '';
    if (!v.trim()) {
        const er = document.getElementById('verbgames-err');
        if (er) { er.textContent = '⚠️ Por favor pega un array de verbos'; er.classList.add('show'); }
        return;
    }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Array inválido');
        // Validar estructura
        for (let i = 0; i < p.length; i++) {
            const verb = p[i];
            if (!verb.spanishWord || !verb.verb || !verb.past || !verb.participle) {
                throw new Error(`Verbo ${i + 1}: faltan campos requeridos`);
            }
        }
        loadVerbGames(p);
        closeModal();
        toast(`✅ ${p.length} juego(s) de verbos cargados`);
    } catch (e) {
        const er = document.getElementById('verbgames-err');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function toggleAudio() {
    S.audioMode = !S.audioMode; save(); closeModal();
    toast(S.audioMode ? '🔊 Modo audio activado' : '📝 Modo texto activado');
    if (document.getElementById('scr-ex')) renderExercise();
}
function confirmReset() {
    openModal(`<div class="mpill"></div><div class="mtitle">⚠️ ¿Reiniciar progreso?</div><p style="text-align:center;color:var(--muted);font-size:14px;font-weight:600;margin-bottom:18px">Se borrarán respuestas y estadísticas.</p><button class="btn btn-red" style="margin-bottom:9px" onclick="doReset()">🔄 Sí, reiniciar</button><button class="btn btn-s" onclick="openOptions()">← Cancelar</button>`);
}
function doReset() {
    const ex = S.exercises, lv = S.levels, sd = S.storyData, am = S.audioMode, st = S.streak;
    S = defS(); S.exercises = ex; S.levels = lv; S.storyData = sd; S.audioMode = am; S.streak = st;
    save(); closeModal(); toast('🔄 Progreso reiniciado');
    setTimeout(() => renderMap(), 400);
}
function confirmClear() {
    openModal(`<div class="mpill"></div><div class="mtitle">⚠️ ¿Cargar nuevos ejercicios?</div><p style="text-align:center;color:var(--muted);font-size:14px;font-weight:600;margin-bottom:18px">Se reemplazará todo el contenido.</p><button class="btn btn-red" style="margin-bottom:9px" onclick="doClear()">🗑️ Sí, reemplazar</button><button class="btn btn-s" onclick="openOptions()">← Cancelar</button>`);
}
function doClear() { S = defS(); save(); closeModal(); renderSetup(); }
function openStats() {
    const done = totalDone(), tot = S.exercises.length;
    let exRows = '';
    S.levels.forEach((ea, li) => {
        const t = S.levelTimes[li], c = ea.filter(i => S.responses[i] !== undefined).length;
        const ic = lvlDone(li) ? '✅' : c > 0 ? '🔄' : '🔒';
        exRows += `<div class="st-row"><span class="st-l">${ic} Nivel ${li + 1} (${c}/${ea.length})</span><span class="st-r">${t ? fmtMs(t) : '—'}</span></div>`;
    });
    let gRows = '';
    S.storyData.forEach((st, si) => {
        const p = S.gameProgress[si];
        const total = st.exercises.length;
        const c = p ? Object.keys(p.answers || {}).length : 0;
        const corr = p ? Object.values(p.correct || {}).filter(Boolean).length : 0;
        const ic = storyDone(si) ? '⭐' : c > 0 ? '🔄' : '🔒';
        gRows += `<div class="st-row"><span class="st-l">${ic} ${esc(st.title || 'Historia ' + (si + 1))} (${corr}✅/${c})</span><span class="st-r">${p?.timeMs ? fmtMs(p.timeMs) : '—'}</span></div>`;
    });
    openModal(`
<div class="mpill"></div><div class="mtitle">📊 Estadísticas</div>
<div class="st-total"><span class="st-l">⏱ Tiempo total</span><span class="st-r">${fmtMs(S.totalMs)}</span></div>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rxs);padding:10px;text-align:center">
    <div style="font-size:17px;font-weight:900;color:var(--mint)">${done}/${tot}</div>
    <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;margin-top:2px">Traducción</div>
  </div>
  <div style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--rxs);padding:10px;text-align:center">
    <div style="font-size:17px;font-weight:900;color:var(--pri)">${fmtAvg(S.totalMs, done)}</div>
    <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;margin-top:2px">Prom/ejercicio</div>
  </div>
</div>
${exRows ? `<div class="msec">NIVELES DE TRADUCCIÓN</div><div class="stats-list">${exRows}</div>` : ''}
${gRows ? `<div class="msec" style="margin-top:10px">HISTORIAS</div><div class="stats-list">${gRows}</div>` : ''}
<button class="btn btn-s" style="margin-top:13px" onclick="closeModal()">Cerrar</button>
`);
}
function openAddModal() {
    openModal(`<div class="mpill"></div><div class="mtitle">➕ Agregar ejercicios</div>
<p style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:11px;text-align:center">Se concatenarán al final sin afectar el progreso</p>
<textarea class="json-ta" id="add-json" placeholder='["Nueva frase 1","Nueva frase 2"]' oninput="prevAdd()" style="min-height:110px;margin-bottom:9px"></textarea>
<div class="err" id="add-err"></div>
<div class="info-card" id="add-prev" style="margin-bottom:9px"></div>
<button class="btn btn-g" style="margin-bottom:8px" onclick="doAdd()">➕ Agregar</button>
<button class="btn btn-s" onclick="closeModal()">Cancelar</button>`);
}
function prevAdd() {
    const v = (document.getElementById('add-json') || {}).value || '';
    const pv = document.getElementById('add-prev'), er = document.getElementById('add-err');
    if (!v.trim()) { pv?.classList.remove('show'); er?.classList.remove('show'); return; }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Debe ser un array no vacío');
        if (pv) {
            pv.innerHTML = `<div class="info-row"><span>📚 Nuevos</span><span class="info-v">+${p.length}</span></div><div class="info-row"><span>🎯 Total resultante</span><span class="info-v">${S.exercises.length + p.length}</span></div>`;
            pv.classList.add('show');
        }
        if (er) er.classList.remove('show');
    } catch (e) {
        if (pv) pv.classList.remove('show');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function doAdd() {
    const v = (document.getElementById('add-json') || {}).value || '';
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Array inválido');
        S.exercises = [...S.exercises, ...p.map(String)];
        S.levels = buildLevels(S.exercises);
        save(); closeModal(); toast(`✅ +${p.length} ejercicios agregados`);
        setTimeout(() => renderMap(), 500);
    } catch (e) {
        const er = document.getElementById('add-err');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function openStoriesModal() {
    const has = S.storyData.length > 0;
    openModal(`<div class="mpill"></div><div class="mtitle">🎮 Juegos de Historia</div>
${has ? `<div class="info-card show" style="background:rgba(240,114,182,.07);border-color:rgba(240,114,182,.25);margin-bottom:12px">
  <div class="info-row"><span>📖 Historias cargadas</span><span class="info-v" style="color:var(--pink)">${S.storyData.length}</span></div>
  <div class="info-row"><span>🎯 Ejercicios de juego</span><span class="info-v" style="color:var(--pink)">${S.storyData.reduce((a, s) => a + s.exercises.length, 0)}</span></div>
</div>` : ''}
<p style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:11px;text-align:center">Pega un array de objetos de historia con ejercicios interactivos</p>
<textarea class="json-ta" id="story-json" placeholder='[{"storyId":1,"title":"...","exercises":[...]}]' oninput="prevStory()" style="min-height:120px;margin-bottom:9px"></textarea>
<div class="err" id="story-err"></div>
<div class="info-card" id="story-prev" style="margin-bottom:9px"></div>
<button class="btn btn-pink" style="margin-bottom:8px" onclick="doLoadStories()">🎮 ${has ? 'Reemplazar historias' : 'Cargar historias'}</button>
<button class="btn btn-s" onclick="closeModal()">Cancelar</button>`);
}
function prevStory() {
    const v = (document.getElementById('story-json') || {}).value || '';
    const pv = document.getElementById('story-prev'), er = document.getElementById('story-err');
    if (!v.trim()) { pv?.classList.remove('show'); er?.classList.remove('show'); return; }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Debe ser un array');
        const exTotal = p.reduce((a, s) => a + (s.exercises?.length || 0), 0);
        if (pv) {
            pv.innerHTML = `<div class="info-row"><span>📖 Historias</span><span class="info-v" style="color:var(--pink)">${p.length}</span></div><div class="info-row"><span>🎯 Ejercicios de juego</span><span class="info-v" style="color:var(--pink)">${exTotal}</span></div>`;
            pv.classList.add('show');
        }
        if (er) er.classList.remove('show');
    } catch (e) {
        if (pv) pv.classList.remove('show');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function doLoadStories() {
    const v = (document.getElementById('story-json') || {}).value || '';
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Array inválido');
        S.storyData = p; S.gameProgress = {};
        save(); closeModal(); toast(`🎮 ${p.length} historia(s) cargada(s)!`);
        setTimeout(() => renderMap(), 500);
    } catch (e) {
        const er = document.getElementById('story-err');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}

// ════ COPY / EXPORT ════
function buildText(partial) {
    let txt = '';
    S.exercises.forEach((ph, i) => {
        const r = S.responses[i];
        if (partial && r === undefined) return;
        txt += `${i + 1}. ${ph}\nMi respuesta: ${r || '(sin respuesta)'}\n\n`;
    });
    if (!partial) {
        S.storyData.forEach((st, si) => {
            const p = S.gameProgress[si]; if (!p?.answers) return;
            txt += `\n--- Historia ${si + 1}: ${st.title} ---\n`;
            st.exercises.forEach((ex, ei) => {
                const a = p.answers[ei];
                if (a !== undefined) txt += `Ej.${ei + 1} (${ex.type}): ${a} ${p.correct?.[ei] ? '✅' : '❌'}\n`;
            });
        });
        txt += `\n--- Estadísticas ---\nTiempo total: ${fmtMs(S.totalMs)}\nEjercicios: ${totalDone()} / ${S.exercises.length}\nRacha: ${S.streak} días\n\n`;
        S.levels.forEach((ea, li) => { const t = S.levelTimes[li]; if (t) txt += `Nivel ${li + 1}: ${fmtMs(t)}\n`; });
        S.storyData.forEach((st, si) => {
            const p = S.gameProgress[si];
            if (p?.timeMs) {
                const c = Object.values(p.correct || {}).filter(Boolean).length;
                txt += `Historia "${st.title}": ${fmtMs(p.timeMs)} — ${c}/${st.exercises.length} correctas\n`;
            }
        });
    }
    return txt.trim();
}
function clip(txt, msg) {
    navigator.clipboard?.writeText(txt).then(() => toast(msg)).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); toast(msg);
    });
}
function copyPartial() { const txt = buildText(true); if (!txt) { toast('⚠️ No hay respuestas aún'); return; } clip(txt, `✅ ${totalDone()} respuestas copiadas`); }
function copyAnswers() { clip(buildText(false), '✅ Respuestas y estadísticas copiadas!'); }

// ════ SETUP SCREEN ════
function renderSetup() {
    const has = S.exercises.length > 0, mc = getMascot();
    const stInfo = S.storyData.length > 0 ?
        `<div class="info-card show" style="background:rgba(240,114,182,.07);border-color:rgba(240,114,182,.25)">
    <div class="info-row"><span>🎮 Juegos cargados</span><span class="info-v" style="color:var(--pink)">${S.storyData.length} historias</span></div></div>`
        : `<button class="btn btn-s" style="border-color:rgba(240,114,182,.4);color:var(--pink)" onclick="openStoriesModal()">🎮 Cargar juegos (opcional)</button>`;
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-setup">
  <div class="hdr"><span class="logo">✨ LinguaQuest</span><div class="hdr-r">${S.streak > 0 ? `<span class="badge">🔥 ${S.streak}</span>` : ''}</div></div>
  <div class="setup-body sb">
    <div class="mascot" style="padding-top:6px"><span class="em ${mc.a}">${has ? '😄' : mc.e}</span>
    <div class="bubble">${has ? '¡Tienes ejercicios guardados! Continúa 🎯' : mc.m}</div></div>
    ${has ? `
      <div class="info-card show">
        <div class="info-row"><span>📚 Ejercicios totales</span><span class="info-v">${S.exercises.length}</span></div>
        <div class="info-row"><span>🎯 Niveles generados</span><span class="info-v">${S.levels.length}</span></div>
        <div class="info-row"><span>✅ Completados</span><span class="info-v">${totalDone()}</span></div>
        <div class="info-row"><span>🔥 Racha</span><span class="info-v">${S.streak} días</span></div>
      </div>
      ${stInfo}
      <button class="btn btn-p" onclick="continueStudy()">▶️ Continuar estudio</button>
      <button class="btn btn-s" onclick="showNewJson()">📋 Cargar nuevos ejercicios</button>
    ` : `
      <div><div class="setup-h">¡Empieza a practicar!</div>
      <div class="setup-sub" style="margin-top:6px">Pega un array JSON con frases en español:</div></div>
      <textarea class="json-ta" id="json-in" placeholder='["Ella había elegido el vestido azul","Ellos han conducido por mucho tiempo"]' oninput="previewJson()"></textarea>
      <div class="err" id="json-err"></div>
      <div class="info-card" id="json-prev"></div>
      <button class="btn btn-p" onclick="loadJson()">🚀 Cargar ejercicios</button>
      ${stInfo}
    `}
  </div>
</div>`;
}
function showNewJson() {
    document.querySelector('.setup-body').innerHTML = `
  <div><div class="setup-h">Nuevos ejercicios</div><div class="setup-sub" style="margin-top:6px">Pega un nuevo array JSON:</div></div>
  <textarea class="json-ta" id="json-in" placeholder='["Ella había elegido el vestido azul"]' oninput="previewJson()"></textarea>
  <div class="err" id="json-err"></div><div class="info-card" id="json-prev"></div>
  <button class="btn btn-p" onclick="loadJson()">🚀 Cargar</button>
  <button class="btn btn-s" onclick="renderSetup()">← Volver</button>`;
}
function previewJson() {
    const v = (document.getElementById('json-in') || {}).value || '';
    const pv = document.getElementById('json-prev'), er = document.getElementById('json-err');
    if (!v.trim()) { pv?.classList.remove('show'); er?.classList.remove('show'); return; }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Array no válido');
        if (pv) {
            pv.innerHTML = `<div class="info-row"><span>📚 Ejercicios</span><span class="info-v">${p.length}</span></div><div class="info-row"><span>🎯 Niveles</span><span class="info-v">${Math.ceil(p.length / 3)}</span></div>`;
            pv.classList.add('show');
        }
        if (er) er.classList.remove('show');
    } catch (e) {
        if (pv) pv.classList.remove('show');
        if (er) { er.textContent = '⚠️ JSON inválido: ' + e.message; er.classList.add('show'); }
    }
}
function loadJson() {
    const v = (document.getElementById('json-in') || {}).value || '';
    if (!v.trim()) { const er = document.getElementById('json-err'); if (er) { er.textContent = '⚠️ Por favor pega un JSON'; er.classList.add('show'); } return; }
    try {
        const p = JSON.parse(v);
        if (!Array.isArray(p) || p.length === 0) throw new Error('Array inválido');
        const am = S.audioMode, sd = S.storyData;
        S = defS(); S.audioMode = am; S.storyData = sd;
        S.exercises = p.map(String); S.levels = buildLevels(S.exercises);
        checkStreak(); save();
        toast(`¡${p.length} ejercicios cargados! 🎉`);
        setTimeout(() => renderMap(), 650);
    } catch (e) {
        const er = document.getElementById('json-err');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function continueStudy() { checkStreak(); renderMap(); }

// ════ MAP SCREEN ════
function renderMap() {
    checkStreak();
    const nodes = buildNodes();
    const done = totalDone(), tot = S.exercises.length;
    const pct = tot > 0 ? Math.min(100, Math.round(done / tot * 100)) : 0;
    const mc = getMascot(), al = activeNodeIdx(nodes);
    const ALIGNS = ['margin-left:auto', 'margin:0 auto', 'margin-right:auto', 'margin:0 auto'];
    let nodesH = '';

    nodes.forEach((node, ni) => {
        const isDone = nodeDone(node), isOpen = nodeOpen(ni, nodes), isAct = ni === al && !isDone;
        // Determinar clases adicionales según el tipo de nodo
        let additionalClass = '';
        if (node.type === 'game') additionalClass = ' gnode';
        if (node.type === 'verbGame') additionalClass = ' gnode';
        const cls = (isDone ? 'done' : isAct ? 'cur' : 'locked') + additionalClass;
        const canTap = isDone || isOpen;
        const clk = canTap ? `startNode(${ni})` : '';

        if (node.type === 'ex') {
            const ea = S.levels[node.li]; const c = ea.filter(i => S.responses[i] !== undefined).length;
            const icon = isDone ? '✅' : isAct ? '🎯' : isOpen ? '🎯' : '🔒';
            const timeStr = isDone && S.levelTimes[node.li] ? ' · ' + fmtMs(S.levelTimes[node.li]) : '';
            nodesH += `<div class="lv-card ${cls}" style="${ALIGNS[ni % ALIGNS.length]}" onclick="${clk}">
        <div class="lv-icon">${icon}</div>
        <div class="lv-info"><div class="lv-title">Nivel ${node.li + 1}</div>
        <div class="lv-sub">${c}/${ea.length} ejercicios${timeStr}</div></div></div>`;
        }
        else if (node.type === 'game') {
            const st = S.storyData[node.si]; const p = S.gameProgress[node.si];
            const doneEx = p ? Object.keys(p.answers || {}).length : 0; const totalEx = st?.exercises?.length || 0;
            const corrEx = p ? Object.values(p.correct || {}).filter(Boolean).length : 0;
            const icon = isDone ? '⭐' : isAct ? '🎮' : isOpen ? '🎮' : '🔒';
            const timeStr = isDone && p?.timeMs ? ' · ' + fmtMs(p.timeMs) : '';
            const subtitle = isDone ? `${corrEx}/${totalEx} correctas${timeStr}` : isOpen ? `${doneEx}/${totalEx} completados` : 'Completa el anterior';
            nodesH += `<div class="lv-card ${cls}" style="${ALIGNS[ni % ALIGNS.length]}" onclick="${clk}">
        <div class="lv-icon">${icon}</div>
        <div class="lv-info"><div class="lv-title">${esc(st?.title || 'Historia')}</div>
        <div class="lv-sub">${subtitle}</div></div></div>`;
        }
        else if (node.type === 'verbGame') {
            const verbData = S.verbGamesData?.[node.vi];
            const verbGameId = `verb_${verbData?.spanishWord}`;
            const p = S.gameProgress[verbGameId];
            const icon = isDone ? '🏆' : isAct ? '🎮' : isOpen ? '🎮' : '🔒';
            const timeStr = isDone && p?.timeMs ? ' · ' + fmtMs(p.timeMs) : '';
            nodesH += `<div class="lv-card ${cls}" style="${ALIGNS[ni % ALIGNS.length]}" onclick="${clk}">
        <div class="lv-icon">${icon}</div>
        <div class="lv-info"><div class="lv-title">📖 Verb Quest: ${esc(verbData?.spanishWord || 'Verbo')}</div>
        <div class="lv-sub">Domina las 3 formas verbales${timeStr}</div></div></div>`;
        }

        if (ni < nodes.length - 1) nodesH += `<div class="connector${isDone ? ' done' : ''}"></div>`;
    });

    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-map">
  <div class="hdr"><span class="logo">✨ LinguaQuest</span>
    <div class="hdr-r">${S.streak > 0 ? `<span class="badge">🔥 ${S.streak}</span>` : ''}<span class="badge">✅ ${done}/${tot}</span></div>
  </div>
  <div class="mascot"><span class="em ${mc.a}">${mc.e}</span><div class="bubble">${mc.m}</div></div>
  ${S.streak >= 2 ? `<div class="streak-banner">🔥 ¡${S.streak} días seguidos estudiando!</div>` : ''}
  <div class="prog-bar">
    <div class="prog-hdr"><span class="prog-lbl">🎯 Progreso de traducción</span><span class="prog-cnt">${done} / ${tot} · ${pct}%</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
  </div>
  <div class="map-body"><div class="map-path">${nodesH}</div></div>
</div>
<button class="fab" onclick="openOptions()">⚙️</button>`;
}
function startNode(ni) {
    const nodes = buildNodes(); if (!nodes[ni]) return;
    const node = nodes[ni];
    if (!nodeOpen(ni, nodes) && !nodeDone(node)) { toast('🔒 Completa el nivel anterior primero'); return; }
    if (node.type === 'ex') startExercise(node.li, ni);
    else if (node.type === 'game') startGame(node.si, ni);
    else if (node.type === 'verbGame') {
        const verbData = S.verbGamesData?.[node.vi];
        if (verbData) startVerbGame(verbData, ni);
        else toast('⚠️ Error al cargar el juego');
    }
}
function loadVerbGames(verbDataArray) {
    // Preservar progreso de juegos de verbos ya completados
    const existingProgress = {};
    if (S.verbGamesData && S.gameProgress) {
        S.verbGamesData.forEach((oldVerb, idx) => {
            const oldId = `verb_${oldVerb.spanishWord}`;
            if (S.gameProgress[oldId]?.answers?.completed) {
                existingProgress[oldId] = S.gameProgress[oldId];
            }
        });
    }
    
    S.verbGamesData = verbDataArray;
    
    // Restaurar progreso para verbos que ya existían
    verbDataArray.forEach(verb => {
        const verbId = `verb_${verb.spanishWord}`;
        if (existingProgress[verbId]) {
            S.gameProgress[verbId] = existingProgress[verbId];
        }
    });
    
    save();
    renderMap();
    toast(`✅ ${verbDataArray.length} juegos de verbos cargados`);
}