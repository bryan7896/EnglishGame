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
<div class="msec">Versión 1.0.3</div>
`);
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
    const ex = S.exercises, lv = S.levels, am = S.audioMode;
    S = defS(); 
    S.exercises = ex; 
    S.levels = lv; 
    S.audioMode = am;
    save(); 
    closeModal(); 
    toast('🔄 Progreso reiniciado');
    setTimeout(() => renderMap(), 400);
}
function confirmClear() {
    openModal(`<div class="mpill"></div><div class="mtitle">⚠️ ¿Cargar nuevos ejercicios?</div><p style="text-align:center;color:var(--muted);font-size:14px;font-weight:600;margin-bottom:18px">Se reemplazará todo el contenido.</p><button class="btn btn-red" style="margin-bottom:9px" onclick="doClear()">🗑️ Sí, reemplazar</button><button class="btn btn-s" onclick="openOptions()">← Cancelar</button>`);
}
function doClear() { 
    S = defS(); 
    save(); 
    closeModal(); 
    renderSetup(); 
}
function openStats() {
    const done = totalDone(), tot = S.exercises.length;
    let exRows = '';
    S.levels.forEach((ea, li) => {
        const t = S.levelTimes[li], c = ea.filter(i => S.responses[i] !== undefined).length;
        const ic = lvlDone(li) ? '✅' : c > 0 ? '🔄' : '🔒';
        exRows += `<div class="st-row"><span class="st-l">${ic} Nivel ${li + 1} (${c}/${ea.length})</span><span class="st-r">${t ? fmtMs(t) : '—'}</span></div>`;
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

// ════ COPY / EXPORT ════
function buildText(partial) {
    let txt = '';
    S.exercises.forEach((ph, i) => {
        const r = S.responses[i];
        if (partial && r === undefined) return;
        txt += `${i + 1}. ${ph}\nMi respuesta: ${r || '(sin respuesta)'}\n\n`;
    });
    if (!partial) {
        txt += `\n--- Estadísticas ---\nTiempo total: ${fmtMs(S.totalMs)}\nEjercicios: ${totalDone()} / ${S.exercises.length}\nTotal histórico: ${S.totalHistorical || 0}\n\n`;
        S.levels.forEach((ea, li) => { const t = S.levelTimes[li]; if (t) txt += `Nivel ${li + 1}: ${fmtMs(t)}\n`; });
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
    document.getElementById('app').innerHTML = `
<div class="screen active" id="scr-setup">
  <div class="hdr"><span class="logo">✨ LinguaQuest</span><div class="hdr-r"></div></div>
  <div class="setup-body sb">
    <div class="mascot" style="padding-top:6px"><span class="em ${mc.a}">${has ? '😄' : mc.e}</span>
    <div class="bubble">${has ? '¡Tienes ejercicios guardados! Continúa 🎯' : mc.m}</div></div>
    ${has ? `
      <div class="info-card show">
        <div class="info-row"><span>📚 Ejercicios totales</span><span class="info-v">${S.exercises.length}</span></div>
        <div class="info-row"><span>🎯 Niveles generados</span><span class="info-v">${S.levels.length}</span></div>
        <div class="info-row"><span>✅ Completados</span><span class="info-v">${totalDone()}</span></div>
      </div>
      <button class="btn btn-p" onclick="continueStudy()">▶️ Continuar estudio</button>
      <button class="btn btn-s" onclick="showNewJson()">📋 Cargar nuevos ejercicios</button>
    ` : `
      <div><div class="setup-h">¡Empieza a practicar!</div>
      <div class="setup-sub" style="margin-top:6px">Pega un array JSON con frases en español:</div></div>
      <textarea class="json-ta" id="json-in" placeholder='["Ella había elegido el vestido azul","Ellos han conducido por mucho tiempo"]' oninput="previewJson()"></textarea>
      <div class="err" id="json-err"></div>
      <div class="info-card" id="json-prev"></div>
      <button class="btn btn-p" onclick="loadJson()">🚀 Cargar ejercicios</button>
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
        const am = S.audioMode;
        S = defS(); 
        S.audioMode = am;
        S.exercises = p.map(String); 
        S.levels = buildLevels(S.exercises);
        save();
        toast(`¡${p.length} ejercicios cargados! 🎉`);
        setTimeout(() => renderMap(), 650);
    } catch (e) {
        const er = document.getElementById('json-err');
        if (er) { er.textContent = '⚠️ ' + e.message; er.classList.add('show'); }
    }
}
function continueStudy() { renderMap(); }

// ════ MAP SCREEN ════
function renderMap() {
    const nodes = buildNodes();
    const done = totalDone(), tot = S.exercises.length;
    const pct = tot > 0 ? Math.min(100, Math.round(done / tot * 100)) : 0;
    const mc = getMascot();
    const al = activeNodeIdx(nodes);
    
    let nodesH = '';
    
    nodes.forEach((node, ni) => {
        const isDone = nodeDone(node);
        const isOpen = nodeOpen(ni, nodes);
        const isAct = ni === al && !isDone;
        const isLocked = !isDone && !isOpen;
        
        let nodeIcon = '', nodeTitle = '', nodeSubtitle = '', nodeColor = '';
        
        if (node.type === 'ex') {
            const ea = S.levels[node.li];
            const c = ea.filter(i => S.responses[i] !== undefined).length;
            nodeIcon = isDone ? '🏆' : isAct ? '🎯' : isLocked ? '🔒' : '📚';
            nodeTitle = `Nivel ${node.li + 1}`;
            nodeSubtitle = isDone ? `${c}/${ea.length} completado` : (isAct ? 'En curso' : `${c}/${ea.length} ejercicios`);
            nodeColor = isDone ? 'var(--mint)' : isAct ? 'var(--pri)' : 'var(--muted)';
        }
        
        const canTap = isDone || isOpen;
        const onClick = canTap ? `startNode(${ni})` : '';
        
        nodesH += `
            <div class="map-node ${isDone ? 'done' : isAct ? 'active' : 'locked'}" 
                 style="animation-delay: ${ni * 0.05}s"
                 onclick="${onClick}">
                <div class="map-node-icon" style="background: ${nodeColor}20; border-color: ${nodeColor}">
                    <span class="map-node-emoji">${nodeIcon}</span>
                </div>
                <div class="map-node-content">
                    <div class="map-node-title" style="color: ${nodeColor}">${nodeTitle}</div>
                    <div class="map-node-subtitle">${nodeSubtitle}</div>
                </div>
                ${!isLocked ? `<div class="map-node-arrow">→</div>` : ''}
            </div>
        `;
        
        if (ni < nodes.length - 1) {
            nodesH += `<div class="map-connector ${isDone ? 'done' : ''}"></div>`;
        }
    });
    
    let emotionalMessage = '';
    let emotionalEmoji = '';
    if (done === 0) {
        emotionalMessage = '¡Comienza tu aventura! 🚀';
        emotionalEmoji = '🌱';
    } else if (done === tot) {
        emotionalMessage = '¡Eres una leyenda! ✨🎉';
        emotionalEmoji = '🏆';
    } else if (pct >= 75) {
        emotionalMessage = '¡Estás muy cerca! 💪🔥';
        emotionalEmoji = '🎯';
    } else if (pct >= 50) {
        emotionalMessage = '¡Vas excelente! Sigue así 🌟';
        emotionalEmoji = '⚡';
    } else if (pct >= 25) {
        emotionalMessage = 'Buen progreso, ¡no pares! 📈';
        emotionalEmoji = '💪';
    } else if (done > 0) {
        emotionalMessage = 'Cada paso cuenta, ¡sigue! 🦋';
        emotionalEmoji = '✨';
    }
    
    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-map">
            <div class="map-header">
                <div class="map-logo">
                    <span class="map-logo-icon">✨</span>
                    <span>LinguaQuest</span>
                </div>
                <button class="map-settings" onclick="openOptions()">⚙️</button>
            </div>
            
            <!-- STORY READER BUTTON - AGREGADO AQUÍ -->
            <div class="story-reader-btn-container">
                <button class="story-reader-btn" onclick="initStoryReader()">
                    <span class="story-reader-icon">📖</span>
                    <div class="story-reader-info">
                        <div class="story-reader-title">Story Reader</div>
                        <div class="story-reader-sub">Practica speaking & listening</div>
                    </div>
                    <span class="story-reader-arrow">→</span>
                </button>
            </div>
            
            <div class="map-mascot-card">
                <div class="map-mascot-emoji ${mc.a}">${mc.e}</div>
                <div class="map-mascot-bubble">
                    <span class="map-mascot-text">${mc.m}</span>
                    <span class="map-mascot-emoji-small">${emotionalEmoji}</span>
                </div>
            </div>
            
            ${emotionalMessage ? `<div class="map-emotional-msg">${emotionalMessage}</div>` : ''}
            
            <div class="map-progress">
                <div class="map-progress-header">
                    <span class="map-progress-label">🎯 Progreso total</span>
                    <span class="map-progress-value">${done}/${tot} · ${pct}%</span>
                </div>
                <div class="map-progress-bar">
                    <div class="map-progress-fill" style="width: ${pct}%">
                        <div class="map-progress-glint"></div>
                    </div>
                </div>
            </div>
            
            <div class="map-path-container">
                <div class="map-path">
                    ${nodesH}
                </div>
            </div>
        </div>
    `;
}
function startNode(ni) {
    const nodes = buildNodes(); 
    if (!nodes[ni]) return;
    const node = nodes[ni];
    if (!nodeOpen(ni, nodes) && !nodeDone(node)) { 
        toast('🔒 Completa el nivel anterior primero'); 
        return; 
    }
    if (node.type === 'ex') {
        startExercise(node.li, ni);
    }
}