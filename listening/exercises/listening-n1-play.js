// listening/exercises/listening-n1-play.js
//
// Interfaz y motor de juego del Nivel 1 de Listening: lista de bloques en
// la pantalla de inicio, hub de cada bloque (fases, ronda, estadísticas),
// las fases (Descubre, Distingue, Completa, Escribe, Examen), el modal de
// error, los botones de borrar audio roto / omitir y el registro al Sheet.
// La lógica de datos, calificación y planes vive en listening-n1-core.js.

const N1S = {
  b: null,
  fase: null,
  cola: [],
  i: 0,
  respondido: false,
  plays: 0,
  lento: false,
  porCat: {},
  ort: { exactas: 0, total: 0 },
  racha: 0,
  malRacha: 0,
  ult: [],
  mini: false,          // Distingue de rescate (no cierra la fase)
  rescateEn: -99,
  odd: null,
};

// ==================== AUDIO ====================
// Las palabras sueltas (1 palabra) se leen con la voz del sistema (la misma que
// usa el dictado del English Trainer, respetando la voz elegida en "Elegir voz");
// las frases de 2+ palabras y los audios motivacionales usan sus mp3.
const N1Audio = { el: null, tok: 0 };
function n1Parar() {
  N1Audio.tok += 1;
  try {
    if (N1Audio.el) { N1Audio.el.pause(); N1Audio.el.onended = null; N1Audio.el = null; }
  } catch (e) { /* noop */ }
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
}

async function n1Hablar(texto, lento) {
  const tok = N1Audio.tok;
  if (!("speechSynthesis" in window)) { toast("⚠️ Este navegador no tiene voz del sistema"); return false; }
  let voices = [];
  try { voices = await waitForVoices(); } catch (e) { voices = window.speechSynthesis.getVoices() || []; }
  if (tok !== N1Audio.tok) return false;           // otra reproducción o un cancelar se coló
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "en-US";
      u.rate = lento ? 0.55 : (typeof DICTADO_RATE === "number" ? DICTADO_RATE : 0.73);
      u.pitch = 1; u.volume = 1;
      const v = pickVoiceForLang(voices, "en");
      try { if (v) u.voice = v; } catch (e) { /* voz no asignable: se usa la predeterminada */ }
      let hecho = false;
      const fin = (ok) => { if (!hecho) { hecho = true; resolve(ok); } };
      u.onend = () => fin(true);
      u.onerror = () => fin(false);
      setTimeout(() => fin(true), 6000);
      setTimeout(() => { if (tok === N1Audio.tok) window.speechSynthesis.speak(u); else fin(false); }, 100);
    } catch (e) { console.warn("n1Hablar", e); resolve(false); }
  });
}

function n1Reproducir(it, opts) {
  opts = opts || {};
  n1Parar();
  if (n1UsaTTS(it)) return n1Hablar(it.audio, !!opts.lento);
  return new Promise((resolve) => {
    try {
      const a = new Audio(n1AudioPath(it));
      N1Audio.el = a;
      a.playbackRate = opts.lento ? 0.75 : 1;
      if ("preservesPitch" in a) a.preservesPitch = true;
      a.onended = () => resolve(true);
      a.onerror = () => {
        N1S.audioError = it.id;
        toast("⚠️ No se encontró el audio. Puedes descartarlo con 🗑");
        resolve(false);
      };
      const p = a.play();
      if (p && p.catch) p.catch(() => resolve(false));
    } catch (e) { resolve(false); }
  });
}

// ==================== PANTALLA DE INICIO: LISTA DE BLOQUES ====================
function renderListeningNivel1() {
  n1Load();
  const listEl = document.getElementById("listeningN1List");
  const sumEl = document.getElementById("listeningN1Summary");
  if (!listEl) return;
  const r = n1Resumen();
  if (sumEl) {
    sumEl.innerHTML = `
      <div class="l0-summary-stat"><span class="l0-stat-value">${r.aprobados}/${r.total}</span><span class="l0-stat-label">Bloques</span></div>
      <div class="l0-summary-stat"><span class="l0-stat-value">${r.audios}</span><span class="l0-stat-label">Audios listos</span></div>
      <div class="l0-summary-stat"><span class="l0-stat-value">70</span><span class="l0-stat-label">Para aprobar</span></div>`;
  }
  const actual = n1ActualBloque();
  listEl.innerHTML = N1_BLOQUES_META.map((m) => {
    const b = m.bloque;
    const info = n1BlockInfo(b);
    const p = N1State.prog.bloques[b];
    const aprobado = !!(p && p.aprobado);
    const desbloqueado = n1Unlocked(b);
    const enCurso = !!(p && p.estado === "curso") && !aprobado;
    const sinAudios = !info.jugable;
    const cls = !desbloqueado ? "is-locked" : aprobado ? "is-done" : enCurso ? "is-inprogress" : b === actual ? "is-current" : "";
    const icono = !desbloqueado ? ListeningIcons.lock() : aprobado ? ListeningIcons.check() : ListeningIcons.play();
    let linea;
    if (aprobado) linea = `Aprobado · mejor ${p.mejor}%`;
    else if (!desbloqueado) linea = "Aprueba el bloque anterior";
    else if (sinAudios) linea = `Faltan audios (${info.train}/${info.planTrain} · examen ${info.exam}/${info.planExam})`;
    else if (enCurso) {
      const fa = n1FaseActual(p);
      linea = `Ronda ${p.ronda}${fa ? " · " + N1_FASE_LABEL[fa] : ""}`;
    } else linea = `${info.train} ejercicios · examen ${info.exam}`;
    const pct = aprobado ? 100 : enCurso ? Math.round((N1_FASES.filter((f) => p.faseEstado && (p.faseEstado[f] === "hecha" || p.faseEstado[f] === "omitida")).length / N1_FASES.length) * 100) : 0;
    return `
      <div class="l0-level-card ${cls}" data-n1-bloque="${b}" data-n1-ok="${desbloqueado && !sinAudios ? "1" : "0"}" data-n1-lock="${desbloqueado ? "0" : "1"}">
        <div class="l0-level-badge"><span class="l0-level-icon">${m.icono}</span><span class="l0-level-num">Bloque ${b}</span></div>
        <div class="l0-level-body">
          <div class="l0-level-title">${window._escHTML(m.titulo)}</div>
          <div class="l0-level-desc">${window._escHTML(m.descripcion)}</div>
          <div class="l0-level-meta">
            <div class="l0-level-progress-track"><div class="l0-level-progress-fill" style="width:${pct}%;"></div></div>
            <span class="l0-level-score">${window._escHTML(linea)}</span>
          </div>
        </div>
        <div class="l0-level-status">${icono}</div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".l0-level-card").forEach((card) => {
    card.addEventListener("click", () => {
      const b = Number(card.dataset.n1Bloque);
      if (card.dataset.n1Lock === "1") { toast("🔒 Aprueba el bloque anterior para desbloquear este"); return; }
      if (card.dataset.n1Ok !== "1") { toast("🎧 Este bloque todavía no tiene sus audios en listening/nivel1/bloque" + b); return; }
      n1OpenBlock(b);
    });
  });

  const retest = document.getElementById("listeningN1Retest");
  if (retest) {
    retest.style.display = n1TodoAprobado() ? "" : "none";
  }
}

function wireListeningNivel1Toggle() {
  const toggle = document.getElementById("listeningNivel1Toggle");
  const body = document.getElementById("listeningNivel1Body");
  const chevron = document.getElementById("listeningNivel1Chevron");
  if (!toggle || !body || toggle._wired) return;
  toggle._wired = true;
  const setExpanded = (exp) => {
    body.classList.toggle("is-collapsed", !exp);
    body.style.display = exp ? "" : "none";
    if (chevron) chevron.textContent = exp ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", exp ? "true" : "false");
  };
  toggle.addEventListener("click", () => setExpanded(body.classList.contains("is-collapsed")));
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(body.classList.contains("is-collapsed")); }
  });
  setExpanded(true);
}

// ==================== HUB DE UN BLOQUE ====================
function n1OpenBlock(b) {
  n1Load();
  const prog = n1Prog(b);
  if (!prog.plan) {
    n1MakePlan(b, prog);
    prog.estado = "curso";
    n1Save();
  }
  N1S.b = b;
  n1RenderHub(b);
  showMainView("listeningN1Hub");
}

function n1RenderHub(b) {
  if (N1R.activo) { n1ReelsContinuar(); return; }
  const cont = document.getElementById("n1HubContainer");
  if (!cont) return;
  const prog = n1Prog(b);
  const meta = n1Meta(b);
  const info = n1BlockInfo(b);
  const aprobado = prog.estado === "aprobado";
  const actual = n1FaseActual(prog);

  const filas = N1_FASES.map((f) => {
    const st = prog.faseEstado[f] || "pendiente";
    if (st === "omitida" && f !== "entrada" && !(prog.plan && prog.plan[f === "escribe" ? "escribe" : f])) {
      // fase sin material: se muestra apagada
    }
    const icono = st === "hecha" ? "✓" : st === "omitida" ? "–" : f === actual ? "▶" : "○";
    const clase = st === "hecha" ? "is-done" : st === "omitida" ? "is-skip" : f === actual ? "is-now" : "";
    let extra = "";
    if (f === "escribe" && st !== "omitida") {
      const hechos = new Set(prog.hechos.escribe);
      const rest = n1PlanIds(prog, "escribe").filter((it) => !hechos.has(it.id)).length;
      extra = ` · quedan ${rest}`;
    }
    if (f === "completa" && st !== "omitida") {
      const hechos = new Set(prog.hechos.completa);
      extra = ` · quedan ${n1PlanIds(prog, "completa").filter((it) => !hechos.has(it.id)).length}`;
    }
    const saltar = (f === "descubre" || f === "distingue") && f === actual
      ? `<button class="l0-link-btn" data-n1-saltar="${f}">saltar</button>` : "";
    return `<div class="n1-fase ${clase}"><span class="n1-fase-ico">${icono}</span>
      <div class="n1-fase-txt"><div class="n1-fase-nom">${N1_FASE_LABEL[f]}${st === "omitida" ? " <small>(no aplica)</small>" : ""}${extra}</div>
      <div class="n1-fase-desc">${N1_FASE_DESC[f]}</div></div>${saltar}</div>`;
  }).join("");

  const hoy = n1Hoy();
  const tandasHoy = prog.tandas.fecha === hoy ? prog.tandas.n : 0;
  const vencidos = n1SrsVencidos(prog, 99).length;
  const debiles = (prog.debil || []).map((c) => `<span class="n1-chip n1-chip-bad">${window._escHTML(n1CatNombre(c))}</span>`).join("");
  const cats = Object.keys(prog.statsCat || {}).sort().map((c) => {
    const s = prog.statsCat[c];
    const pct = s.total ? Math.round((s.ok / s.total) * 100) : 0;
    return `<div class="l0-result-cat-row"><span class="l0-result-cat-name">${window._escHTML(n1CatNombre(c))}</span>
      <div class="l0-result-cat-track"><div class="l0-result-cat-fill" style="width:${pct}%;"></div></div>
      <span class="l0-result-cat-pct">${pct}% (${s.ok}/${s.total})</span></div>`;
  }).join("");
  const ult = prog.examenes.length ? prog.examenes[prog.examenes.length - 1] : null;
  const fallos = prog.examenes.filter((e) => e.pct < N1_UMBRAL).length;

  let accion;
  if (aprobado) {
    accion = `<button class="fun-btn primary-btn full-width" id="n1NuevaRondaBtn" style="width:100%;">🔁 Practicar otra ronda</button>`;
  } else if (actual) {
    const verbo = prog.sesion && prog.sesion.fase === actual ? "Continuar" : "Empezar";
    accion = `<button class="fun-btn primary-btn full-width" id="n1StartBtn" style="width:100%;">${ListeningIcons.play()} ${verbo}: ${N1_FASE_LABEL[actual]}</button>`;
  } else {
    accion = `<p class="sub-fun">Ronda completa.</p>`;
  }

  cont.innerHTML = `
    <div class="n1-hub-head">
      <button class="l0-play-exit-btn" id="n1HubBackBtn" aria-label="Volver" title="Volver"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 13.8 6 8 12l5.8 6 1.4-1.4L10.8 12z"/></svg></button>
      <div><div class="n1-hub-title">${meta.icono} Bloque ${b} — ${window._escHTML(meta.titulo)}</div>
      <div class="sub-fun" style="margin:0;text-align:left;text-transform:none;">${window._escHTML(meta.descripcion)}</div></div>
    </div>
    <div class="n1-hub-stats">
      <span class="pill-status">Ronda ${prog.ronda}</span>
      ${prog.aprobado ? `<span class="pill-status n1-pill-ok">Aprobado · mejor ${prog.mejor}%</span>` : ""}
      ${ult ? `<span class="pill-status">Último examen ${ult.pct}%</span>` : ""}
      <span class="pill-status">${tandasHoy}/3 tandas hoy</span>
      ${vencidos ? `<span class="pill-status">${vencidos} repasos</span>` : ""}
    </div>
    ${debiles ? `<div class="n1-weak"><div class="n1-sub">Patrones a reforzar</div>${debiles}</div>` : ""}
    <div class="n1-fases">${filas}</div>
    ${accion}
    ${fallos >= 3 && !aprobado ? `<div class="n1-aviso">Llevas ${fallos} exámenes sin aprobar. Copia el informe de errores y lo revisamos juntos para ajustar el bloque.</div>` : ""}
    ${cats ? `<div class="n1-sub" style="margin-top:16px;">Tu oído por patrón (Escribe)</div><div class="l0-result-cat-grid">${cats}</div>` : ""}
    <div class="n1-hub-tools">
      <button class="fun-btn full-width" id="n1CopyBtn" style="width:100%;margin-top:14px;">${ListeningIcons.copy()} Copiar informe de errores</button>
      <label class="n1-toggle"><input type="checkbox" id="n1MotivChk" ${N1State.prog.meta.motivacion ? "checked" : ""}/> Audios motivacionales</label>
      <button class="l0-link-btn" id="n1ResetBtn">Reiniciar este bloque</button>
    </div>
    <p class="sub-fun" style="font-size:.74rem;margin-top:10px;text-transform:none;">Audios descartados en total: ${N1State.prog.meta.descartados.length} · Disponibles en este bloque: ${info.train} de entrenamiento y ${info.exam} de examen.</p>`;

  document.getElementById("n1HubBackBtn")?.addEventListener("click", () => { n1Parar(); renderListeningHome(); showMainView("listeningHome"); });
  document.getElementById("n1StartBtn")?.addEventListener("click", () => n1StartFase(b, actual));
  document.getElementById("n1NuevaRondaBtn")?.addEventListener("click", () => {
    prog.ronda += 1;
    prog.estado = "curso";
    n1MakePlan(b, prog);
    n1Save();
    n1RenderHub(b);
  });
  document.getElementById("n1CopyBtn")?.addEventListener("click", () => n1CopiarTexto(n1ReporteErrores(b), "📋 Informe copiado — pégalo en el chat"));
  document.getElementById("n1MotivChk")?.addEventListener("change", (e) => { N1State.prog.meta.motivacion = !!e.target.checked; n1Save(); });
  document.getElementById("n1ResetBtn")?.addEventListener("click", () => {
    n1Confirmar("Reiniciar el bloque", "Se borra el avance, las rondas y los repasos de este bloque. Los audios descartados se conservan.", "Reiniciar", () => {
      delete N1State.prog.bloques[b];
      n1Save();
      n1OpenBlock(b);
    });
  });
  cont.querySelectorAll("[data-n1-saltar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      prog.faseEstado[btn.dataset.n1Saltar] = "omitida";
      n1Save();
      n1RenderHub(b);
    });
  });
}

// ==================== MODALES ====================
function n1Modal(html, onClose) {
  const m = document.createElement("div");
  m.className = "modal-overlay modal-active n1-modal";
  m.innerHTML = `<div class="modal-friend menu-modal n1-modal-box">${html}</div>`;
  document.body.appendChild(m);
  m._close = () => { n1Parar(); m.remove(); if (onClose) onClose(); };
  return m;
}
function n1Confirmar(titulo, texto, etiqueta, onOk) {
  const m = n1Modal(`
    <h3>${window._escHTML(titulo)}</h3>
    <p class="sub-fun" style="text-align:left;margin:8px 0 14px;">${window._escHTML(texto)}</p>
    <div class="button-group">
      <button class="fun-btn danger-btn full-width" id="n1ConfOk" style="width:100%;margin-bottom:8px;">${window._escHTML(etiqueta)}</button>
      <button class="fun-btn full-width" id="n1ConfNo" style="width:100%;">Cancelar</button>
    </div>`);
  m.querySelector("#n1ConfNo").addEventListener("click", () => m._close());
  m.querySelector("#n1ConfOk").addEventListener("click", () => { m.remove(); onOk(); });
}

// ==================== ARRANQUE DE FASES ====================
function n1StartFase(b, fase, opts) {
  opts = opts || {};
  const prog = n1Prog(b);
  N1S.b = b;
  N1S.fase = fase;
  N1S.mini = !!opts.mini;
  N1S.i = 0;
  N1S.respondido = false;
  N1S.porCat = {};
  N1S.ort = { exactas: 0, total: 0 };
  N1S.racha = 0; N1S.malRacha = 0; N1S.ult = []; N1S.rescateEn = -99;
  N1S.sesionOk = 0; N1S.sesionTot = 0;
  showMainView("listeningN1Play");

  if (fase === "descubre") { n1RenderDescubre(b); return; }
  if (fase === "distingue") {
    const sv = !opts.mini && prog.sesion && prog.sesion.fase === "distingue" ? prog.sesion : null;
    if (sv && sv.i < sv.cola.length) {
      N1S.cola = sv.cola; N1S.i = sv.i; N1S.sesionOk = sv.ok || 0; N1S.sesionTot = sv.tot || 0;
    } else {
      N1S.cola = n1ConstruirOddities(b, prog, opts.mini ? 6 : (prog.ronda === 1 ? 18 : 8));
      if (!opts.mini) n1GuardarSesion(0);
    }
    if (!N1S.cola.length) { toast("No hay material para Distingue"); n1TerminarFase(b, fase); return; }
    n1RenderTrial();
    return;
  }

  const saved = prog.sesion && prog.sesion.fase === fase ? prog.sesion : null;
  if (saved && saved.i < saved.cola.length) {
    N1S.cola = saved.cola;
    N1S.i = saved.i;
    N1S.porCat = saved.porCat || {};
    N1S.ort = saved.ort || { exactas: 0, total: 0 };
    N1S.sesionOk = saved.ok || 0; N1S.sesionTot = saved.tot || 0;
    toast("▶️ Continuando donde quedaste");
    n1RenderTrial();
    return;
  }

  N1S.cola = n1ConstruirCola(b, prog, fase);
  if (!N1S.cola.length) {
    toast("Esta fase no tiene ejercicios pendientes");
    n1TerminarFase(b, fase);
    return;
  }
  prog.sesion = { fase, cola: N1S.cola, i: 0, porCat: {}, ort: N1S.ort, ok: 0, tot: 0 };
  n1Save();
  // Interludio motivacional al arrancar la tanda.
  const m = !N1R.activo && (fase === "escribe" || fase === "entrada") ? n1ElegirMotivacion("inicio_tanda") : null;
  if (m) n1RenderInterludio(m, () => n1RenderTrial());
  else n1RenderTrial();
}

function n1ConstruirCola(b, prog, fase) {
  if (fase === "entrada") {
    const hechos = new Set(prog.hechos.entrada);
    return n1PlanIds(prog, "entrada").filter((it) => !hechos.has(it.id)).map((it) => ({ id: it.id }));
  }
  if (fase === "completa") {
    const hechos = new Set(prog.hechos.completa);
    return n1Shuffle(n1PlanIds(prog, "completa").filter((it) => !hechos.has(it.id))).map((it) => ({ id: it.id }));
  }
  if (fase === "examen") {
    const version = ((prog.ronda - 1) % 3) + 1;
    let ex = n1Exam(b, version);
    if (ex.length < 10) ex = n1Items(b).filter((it) => it.tipo === "examen");
    return n1MezclarSinRepetir(ex).map((it) => ({ id: it.id }));
  }
  // escribe: una tanda
  const size = n1TamanoTanda(b);
  const hechos = new Set(prog.hechos.escribe);
  const restantes = n1PlanIds(prog, "escribe").filter((it) => !hechos.has(it.id));
  const debil = new Set(prog.debil || []);
  const porCat = n1GroupBy(n1Shuffle(restantes), (it) => it.categoria);
  const cats = Object.keys(porCat);
  const orden = [];
  let guard = 0;
  while (orden.length < size && cats.some((c) => porCat[c].length) && guard++ < 5000) {
    n1Shuffle(cats).forEach((c) => {
      const n = debil.has(c) ? 2 : 1;
      for (let k = 0; k < n && porCat[c].length && orden.length < size; k++) orden.push(porCat[c].shift());
    });
  }
  const nuevos = n1MezclarSinRepetir(orden).map((it) => ({ id: it.id }));
  const rep = n1SrsVencidos(prog, Math.max(3, Math.ceil(size * 0.2))).map((id) => ({ id, rep: true }));
  const yaEn = new Set(nuevos.map((t) => t.id));
  return rep.filter((t) => !yaEn.has(t.id)).concat(nuevos);
}

// Evita dos ítems seguidos de la misma categoría cuando se puede.
function n1MezclarSinRepetir(items) {
  const a = n1Shuffle(items);
  for (let i = 1; i < a.length; i++) {
    if (a[i].categoria === a[i - 1].categoria) {
      for (let j = i + 1; j < a.length; j++) {
        if (a[j].categoria !== a[i - 1].categoria && (i + 1 >= a.length || a[j].categoria !== (a[i + 1] || {}).categoria)) {
          [a[i], a[j]] = [a[j], a[i]];
          break;
        }
      }
    }
  }
  return a;
}

// ==================== PLANTILLA DEL JUEGO ====================
function n1Chrome() {
  const b = N1S.b;
  const bl = document.getElementById("n1PlayBloqueTag");
  const fa = document.getElementById("n1PlayFaseTag");
  const ct = document.getElementById("n1PlayCatTag");
  const ex = document.getElementById("n1PlayExTag");
  const fill = document.getElementById("n1PlayProgressFill");
  if (bl) bl.textContent = "Bloque " + b;
  if (fa) fa.textContent = N1_FASE_LABEL[N1S.fase] + (N1S.mini ? " (rescate)" : "");
  if (ex) ex.textContent = N1S.cola.length ? `${Math.min(N1S.i + 1, N1S.cola.length)}/${N1S.cola.length}` : "";
  if (ct) {
    const t = N1S.cola[N1S.i];
    const it = t && t.id ? N1State.byId[t.id] : null;
    // En escribe/examen no se muestra el patrón: sería una pista.
    ct.textContent = it && (N1S.fase === "completa") ? n1CatNombre(it.categoria) : "";
    ct.style.display = ct.textContent ? "" : "none";
  }
  if (fill) fill.style.width = N1S.cola.length ? Math.round((N1S.i / N1S.cola.length) * 100) + "%" : "0%";
  const res = document.getElementById("n1PlayResultLine");
  if (res) res.textContent = "🎧 Escucha con atención";
  const mb = document.getElementById("n1MotivBanner");
  if (mb) mb.innerHTML = "";
}

function n1RenderTrial() {
  const t = N1S.cola[N1S.i];
  if (!t) { n1FinSesion(); return; }
  N1S.respondido = false;
  N1S.plays = 0;
  N1S.lento = false;
  N1S.audioError = null;
  n1Chrome();
  if (N1S.fase === "distingue") { n1RenderOddity(t); return; }
  const it = N1State.byId[t.id];
  if (!it || n1Descartado(it.id)) { N1S.i += 1; n1RenderTrial(); return; }
  if (N1S.fase === "completa") n1RenderCompleta(it, t);
  else n1RenderEscribe(it, t);
  const cont = document.getElementById("n1PlayContainer");
  cont.classList.remove("l0-anim-in"); void cont.offsetWidth; cont.classList.add("l0-anim-in");
}

function n1PlayerHTML(it) {
  return `
    <div class="l0-play-audio-wrap">
      <button class="l0-play-audio-btn" id="n1PlayBtn" aria-label="Reproducir" title="Reproducir">${ListeningIcons.listen()}</button>
      <span class="l0-play-audio-label" id="n1PlayLabel">Toca para escuchar</span>
      <div class="n1-audio-tools">
        <button class="l0-link-btn" id="n1SlowBtn">🐢 Más lento</button>
        <button class="l0-link-btn" id="n1BadAudioBtn" aria-label="Descartar audio" title="Descartar este audio">🗑 Descartar audio</button>
      </div>
    </div>`;
}
function n1WirePlayer(it, autoplay) {
  const label = document.getElementById("n1PlayLabel");
  const play = (lento) => {
    N1S.plays += 1;
    if (lento) N1S.lento = true;
    if (label) label.textContent = `Reproducido ${N1S.plays} ${N1S.plays === 1 ? "vez" : "veces"}`;
    document.getElementById("n1PlayBtn")?.classList.add("is-tapped");
    n1Reproducir(it, { lento });
  };
  document.getElementById("n1PlayBtn")?.addEventListener("click", () => play(false));
  document.getElementById("n1SlowBtn")?.addEventListener("click", () => play(true));
  document.getElementById("n1BadAudioBtn")?.addEventListener("click", () => {
    n1Confirmar("Descartar este audio", "Si el audio suena roto, se descarta y no vuelve a aparecer en ningún ejercicio. No se puede deshacer.", "Descartar", () => {
      n1Parar();
      n1Descartar(it.id);
      toast("🗑 Audio descartado");
      N1S.cola.splice(N1S.i, 1);
      n1GuardarSesion();
      n1RenderTrial();
    });
  });
  if (autoplay) setTimeout(() => play(false), 150);
}

function n1GuardarSesion(idx) {
  const prog = n1Prog(N1S.b);
  if (N1S.fase === "descubre") { prog.sesion = { fase: "descubre", cola: [], i: (idx == null ? N1S.i : idx) }; n1Save(); return; }
  if (N1S.fase === "distingue" && N1S.mini) return;
  if (!["entrada", "completa", "escribe", "examen", "distingue"].includes(N1S.fase)) return;
  prog.sesion = { fase: N1S.fase, cola: N1S.cola, i: (idx == null ? N1S.i : idx), porCat: N1S.porCat, ort: N1S.ort, ok: N1S.sesionOk, tot: N1S.sesionTot };
  n1Save();
}

// ==================== COMPLETA ====================
function n1RenderCompleta(it, t) {
  const cont = document.getElementById("n1PlayContainer");
  cont.innerHTML = `
    ${n1PlayerHTML(it)}
    <div class="n1-mask">${window._escHTML(it.mascara).replace(/__/g, '<span class="n1-gap">＿＿</span>')}</div>
    <input type="text" class="answer-input" id="n1Input" style="width:100%;margin-bottom:12px;text-align:center;" placeholder="Letras que faltan…"
      autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"/>
    <button class="fun-btn primary-btn full-width" id="n1CheckBtn" style="width:100%;">${ListeningIcons.check()} Comprobar</button>
    <button class="l0-link-btn n1-skip" id="n1SkipBtn">No conozco la palabra · omitir</button>`;
  n1WirePlayer(it, true);
  const input = document.getElementById("n1Input");
  const go = () => n1ResponderCompleta(it, t, input.value, false);
  document.getElementById("n1CheckBtn").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  document.getElementById("n1SkipBtn").addEventListener("click", () => n1ResponderCompleta(it, t, "", true));
  setTimeout(() => input.focus(), 250);
}

function n1ResponderCompleta(it, t, typed, omitida) {
  if (N1S.respondido) return;
  N1S.respondido = true;
  const prog = n1Prog(N1S.b);
  const u = n1Norm(typed, false), h = n1Norm(it.hueco, false), w = n1Norm(it.audio, false);
  const alt = n1Alternativas(it);
  const ok = !omitida && (u === h || u === w || alt.indexOf(u) >= 0 || n1Collapse(u) === n1Collapse(h));
  if (!omitida) {
    const s = N1S.porCat[it.categoria] || { ok: 0, total: 0 };
    s.total += 1; if (ok) s.ok += 1;
    N1S.porCat[it.categoria] = s;
    N1S.sesionTot += 1; if (ok) N1S.sesionOk += 1;
    if (ok) N1S.racha += 1; else N1S.racha = 0;
  }
  prog.hechos.completa.push(it.id);
  if (!ok && !omitida) { if (prog.fallados.indexOf(it.id) < 0) prog.fallados.push(it.id); }
  n1RegistrarRespuesta(prog, it, { fase: "completa", escrito: String(typed || "").trim(), oido: ok, omitida: !!omitida });
  document.getElementById("n1Input")?.setAttribute("disabled", "");
  document.getElementById("n1CheckBtn")?.remove();
  document.getElementById("n1SkipBtn")?.remove();
  const res = document.getElementById("n1PlayResultLine");
  if (res) res.innerHTML = omitida ? `Era «${window._escHTML(it.audio)}» (omitida, no cuenta)` : ok ? `${ListeningIcons.check()} ¡Correcto!` : `Era «${window._escHTML(it.audio)}»`;
  const cont = document.getElementById("n1PlayContainer");
  if (!ok) { listeningShake(cont); n1Reproducir(it, { lento: true }); }
  n1GuardarSesion(N1S.i + 1);
  n1BotonSiguiente();
}

// ==================== ESCRIBE / ENTRADA / EXAMEN ====================
function n1RenderEscribe(it, t) {
  const cont = document.getElementById("n1PlayContainer");
  const examen = N1S.fase === "examen";
  const ph = it.n_palabras <= 1 ? "Escribe la palabra que escuchaste…" : "Escribe lo que escuchaste…";
  cont.innerHTML = `
    ${n1PlayerHTML(it)}
    ${t.rep ? '<div class="n1-tag-rep">Repaso espaciado</div>' : ""}
    ${t.sib ? '<div class="n1-tag-rep">Palabra parecida a la que fallaste</div>' : ""}
    <input type="text" class="answer-input" id="n1Input" style="width:100%;margin-bottom:12px;" placeholder="${ph}"
      autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"/>
    <button class="fun-btn primary-btn full-width" id="n1CheckBtn" style="width:100%;">${ListeningIcons.check()} Comprobar</button>
    <button class="l0-link-btn n1-skip" id="n1SkipBtn">${examen ? "No lo sé (cuenta como error)" : "No conozco la palabra · omitir (no cuenta)"}</button>`;
  n1WirePlayer(it, true);
  const input = document.getElementById("n1Input");
  const go = () => n1ResponderEscribe(it, t, input.value, false);
  document.getElementById("n1CheckBtn").addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  document.getElementById("n1SkipBtn").addEventListener("click", () => n1ResponderEscribe(it, t, "", true));
  setTimeout(() => input.focus(), 250);
}

function n1RegistrarRespuesta(prog, it, extra) {
  const r = Object.assign({
    id: it.id, bloque: it.bloque, ronda: prog.ronda, categoria: it.categoria, correcto: it.audio,
    voz: it.voz, rep: N1S.plays, lento: N1S.lento, fecha: n1Hoy(),
  }, extra);
  prog.respuestas.push(r);
  if (prog.respuestas.length > 700) prog.respuestas.splice(0, prog.respuestas.length - 700);
}

function n1ResponderEscribe(it, t, typed, omitida) {
  if (N1S.respondido) return;
  N1S.respondido = true;
  n1Parar();
  const b = N1S.b;
  const prog = n1Prog(b);
  const fase = N1S.fase;
  const examen = fase === "examen";
  const g = omitida ? { exacta: false, oido: false, ortografia: false, clase: "omitida", filas: [], vacia: true } : n1Grade(it, typed);
  const cuenta = !omitida || examen;           // omitir no cuenta salvo en examen
  const oido = !!g.oido;

  if (cuenta) {
    const s = N1S.porCat[it.categoria] || { ok: 0, total: 0 };
    s.total += 1; if (oido) s.ok += 1;
    N1S.porCat[it.categoria] = s;
    N1S.sesionTot += 1; if (oido) N1S.sesionOk += 1;
    if (oido) { N1S.ort.total += 1; if (g.exacta) N1S.ort.exactas += 1; }
    if (fase === "escribe") {
      const sc = prog.statsCat[it.categoria] || { ok: 0, total: 0 };
      sc.total += 1; if (oido) sc.ok += 1;
      prog.statsCat[it.categoria] = sc;
    }
    N1S.ult.push(oido ? 1 : 0);
    if (N1S.ult.length > 10) N1S.ult.shift();
  }
  const huboRachaMala = N1S.malRacha;
  if (cuenta) {
    if (oido) { N1S.racha += 1; N1S.malRacha = 0; } else { N1S.racha = 0; N1S.malRacha += 1; }
  }

  // Errores: matriz de confusión + repaso espaciado + reintento en la tanda.
  if (!oido && cuenta && !examen) {
    if (prog.fallados.indexOf(it.id) < 0) prog.fallados.push(it.id);
    n1SrsFallo(prog, it.id);
  }
  if (oido && t.rep) n1SrsAcierto(prog, it.id);
  if (!oido && !omitida) {
    if (g.confKey) prog.confusiones[g.confKey] = (prog.confusiones[g.confKey] || 0) + 1;
    if (g.confSon) prog.confSonidos[g.confSon] = (prog.confSonidos[g.confSon] || 0) + 1;
  }
  if (fase === "escribe" && !t.rep && !t.reint && !t.sib) prog.hechos.escribe.push(it.id);
  if (fase === "entrada") prog.hechos.entrada.push(it.id);
  if (fase === "escribe" && (omitida || !oido) && !t.reint && !t.rep && !t.sib) {
    // El ítem vuelve en la misma tanda; si falló, además entra una palabra parecida.
    const pos = Math.min(N1S.cola.length, N1S.i + 5);
    N1S.cola.splice(pos, 0, { id: it.id, reint: true });
    if (!omitida && fase === "escribe") {
      const excluir = new Set(N1S.cola.map((x) => x.id));
      const h = n1HermanoDe(b, it, excluir);
      if (h) {
        N1S.cola.splice(Math.min(N1S.cola.length, N1S.i + 8), 0, { id: h.id, sib: true });
        if (prog.usados.indexOf(h.id) < 0) prog.usados.push(h.id);
      }
    }
  }
  n1RegistrarRespuesta(prog, it, {
    fase, escrito: String(typed || "").trim(), oido, exacta: !!g.exacta, ort: !!g.ortografia, clase: g.clase,
    omitida: !!omitida,
  });
  n1GuardarSesion(N1S.i + 1);

  // ---- feedback visual ----
  const input = document.getElementById("n1Input");
  if (input) input.disabled = true;
  document.getElementById("n1CheckBtn")?.remove();
  document.getElementById("n1SkipBtn")?.remove();
  const res = document.getElementById("n1PlayResultLine");
  const cont = document.getElementById("n1PlayContainer");

  const modalError = !examen && fase === "escribe" && !omitida && !oido && it.n_palabras <= 2;
  if (res) {
    if (omitida) res.innerHTML = `Era «${window._escHTML(it.audio)}»${examen ? "" : " (omitida, no cuenta)"}`;
    else if (oido && g.exacta) res.innerHTML = `${ListeningIcons.check()} ¡Perfecto!`;
    else if (oido && g.ortografia) res.innerHTML = `${ListeningIcons.check()} Oído correcto · ojo con la ortografía: «${window._escHTML(it.audio)}»`;
    else if (oido) res.innerHTML = `${ListeningIcons.check()} Aceptada · «${window._escHTML(it.audio)}»`;
    else res.innerHTML = `Era «${window._escHTML(it.audio)}»`;
  }
  if (oido) listeningShowAchievement(input); else if (!omitida) listeningShake(cont);

  if (!oido && !modalError) {
    cont.appendChild(n1FeedbackCard(it, g, omitida));
    const rb = document.createElement("button");
    rb.className = "fun-btn full-width"; rb.style.cssText = "width:100%;margin-top:10px;";
    rb.textContent = "🐢 Escuchar de nuevo, más lento";
    rb.addEventListener("click", () => n1Reproducir(it, { lento: true }));
    cont.appendChild(rb);
  } else if (oido && g.ortografia) {
    cont.appendChild(n1FeedbackCard(it, g, false));
  }

  // ---- motivación (no en examen: no interrumpir) ----
  let m = null;
  if (!examen && oido) {
    if (huboRachaMala >= 3) m = n1MotivarSi("recuperacion");
    else if (N1S.racha > 0 && N1S.racha % 5 === 0) m = n1MotivarSi("racha");
  }

  // ---- rescate: últimos 10 por debajo de 30% ----
  const rescate = fase === "escribe" && N1S.ult.length >= 10 && N1S.ult.reduce((a, c) => a + c, 0) / N1S.ult.length < 0.3 && N1S.i - N1S.rescateEn >= 10;

  if (modalError) {
    n1ModalError(it, g, typed, () => {
      if (rescate) n1Rescate(); else n1Siguiente();
    });
  } else if (rescate) {
    n1BotonSiguiente(() => n1Rescate());
  } else {
    n1BotonSiguiente();
  }
}

function n1MotivarSi(evento) {
  const ahora = Date.now();
  if (ahora - N1Motiv.ultima < 25000) return null;
  const m = n1ElegirMotivacion(evento);
  if (!m) return null;
  N1Motiv.ultima = ahora;
  const mb = document.getElementById("n1MotivBanner");
  if (mb) {
    mb.innerHTML = `<div class="n1-motiv"><span>🔊</span><div><div class="n1-motiv-en">${window._escHTML(m.audio)}</div><div class="n1-motiv-es">${window._escHTML(m.texto_es || "")}</div></div></div>`;
    setTimeout(() => { if (mb) mb.innerHTML = ""; }, 7000);
  }
  setTimeout(() => n1Reproducir(m, {}), 700);
  return m;
}

function n1FeedbackCard(it, g, omitida) {
  const d = document.createElement("div");
  d.className = "n1-feed";
  if (omitida || !g.filas || !g.filas.length) {
    d.innerHTML = `<div class="n1-feed-line">Era: <strong>${window._escHTML(it.audio)}</strong></div>`;
    return d;
  }
  const chips = g.filas.map((f) => {
    if (f.e === "ok") return `<span class="word-correct">${window._escHTML(f.t)}</span>`;
    if (f.e === "near") return `<span class="word-correct n1-near" title="${window._escHTML(f.t)}">${window._escHTML(f.u)}</span>`;
    if (f.e === "mal") return `<span class="word-error">${window._escHTML(f.u)}</span><span class="n1-fix">${window._escHTML(f.t)}</span>`;
    if (f.e === "falta") return `<span class="word-error">—</span><span class="n1-fix">${window._escHTML(f.t)}</span>`;
    return `<span class="word-error n1-extra">${window._escHTML(f.u)}</span>`;
  }).join(" ");
  d.innerHTML = `<div class="n1-feed-sub">Tu respuesta → lo correcto</div><div class="n1-feed-chips">${chips}</div>
    <div class="n1-feed-line">Era: <strong>${window._escHTML(it.audio)}</strong></div>
    <div class="n1-feed-hint">${window._escHTML(n1Pista(it))}</div>`;
  return d;
}

function n1BotonSiguiente(antes) {
  const cont = document.getElementById("n1PlayContainer");
  const ultimo = N1S.i + 1 >= N1S.cola.length;
  const btn = document.createElement("button");
  btn.className = "fun-btn primary-btn full-width";
  btn.style.cssText = "width:100%;margin-top:14px;";
  btn.innerHTML = ultimo ? `${ListeningIcons.finish()} Terminar` : `${ListeningIcons.next()} Siguiente`;
  btn.addEventListener("click", () => { if (antes) antes(); else n1Siguiente(); });
  cont.appendChild(btn);
}

function n1Siguiente() {
  n1Parar();
  N1S.i += 1;
  n1GuardarSesion();
  const corta = n1ReelsContar();
  if (N1S.i >= N1S.cola.length) n1FinSesion();
  else if (corta) n1ReelsTerminar();
  else n1RenderTrial();
}

// ==================== RESCATE ====================
function n1Rescate() {
  const b = N1S.b;
  const prog = n1Prog(b);
  N1S.rescateEn = N1S.i;
  const hayOdd = n1OddityDisponible(b, prog);
  const m = n1Modal(`
    <h3>Vamos más despacio</h3>
    <p class="sub-fun" style="text-align:left;margin:8px 0 14px;">Tus últimos 10 intentos salieron por debajo de 30%. ${hayOdd ? "Te propongo 6 ejercicios cortos de Distingue (solo oído, sin texto) y luego seguimos." : "Respira un momento y sigue con calma; puedes usar «Más lento»."}</p>
    <div class="button-group">
      ${hayOdd ? '<button class="fun-btn primary-btn full-width" id="n1RescOk" style="width:100%;margin-bottom:8px;">Hacer Distingue (6)</button>' : ""}
      <button class="fun-btn full-width" id="n1RescNo" style="width:100%;">Seguir con Escribe</button>
    </div>`);
  m.querySelector("#n1RescNo").addEventListener("click", () => { m.remove(); N1S.ult = []; n1Siguiente(); });
  m.querySelector("#n1RescOk")?.addEventListener("click", () => {
    m.remove();
    N1S.ult = [];
    N1S.i += 1;
    n1GuardarSesion();
    n1StartFase(b, "distingue", { mini: true });
  });
}

// ==================== MODAL DE ERROR (1–2 palabras) ====================
function n1ModalError(it, g, typed, onClose) {
  const par = it.par || (it.pares && it.pares[0]) || "";
  const parIt = n1ParItem(it);
  const est = n1EsEstricto(it);
  const m = n1Modal(`
    <h3>Mira la diferencia</h3>
    <div class="n1-err-row"><div><div class="n1-sub">Escribiste</div><div class="n1-err-w n1-err-bad">${window._escHTML(String(typed || "").trim() || "—")}</div></div>
      <div><div class="n1-sub">Era</div><div class="n1-err-w n1-err-ok">${window._escHTML(it.audio)}</div></div></div>
    <div class="n1-err-play">
      <button class="fun-btn" id="n1ErrPlay">▶ Escuchar (lento y normal)</button>
      ${parIt ? `<button class="fun-btn" id="n1ErrPar">▶ «${window._escHTML(parIt.audio)}»</button>` : ""}
    </div>
    ${par ? `<p class="n1-err-par">Se confunde con: <strong>${window._escHTML(par)}</strong></p>` : ""}
    <p class="n1-err-hint">${window._escHTML(n1Pista(it))}</p>
    <button class="fun-btn full-width" id="n1ErrSay" style="width:100%;margin-bottom:10px;">🗣 Repítelo en voz alta</button>
    ${parIt ? `<div id="n1ErrVs"></div>` : ""}
    <button class="fun-btn primary-btn full-width" id="n1ErrOk" style="width:100%;margin-top:6px;" disabled>Entendido, seguir</button>`, onClose);
  const secuencia = async () => {
    await n1Reproducir(it, { lento: true });
    await new Promise((r) => setTimeout(r, 350));
    await n1Reproducir(it, {});
  };
  m.querySelector("#n1ErrPlay").addEventListener("click", secuencia);
  m.querySelector("#n1ErrPar")?.addEventListener("click", () => n1Reproducir(parIt, {}));
  const ok = m.querySelector("#n1ErrOk");
  const say = m.querySelector("#n1ErrSay");
  say.addEventListener("click", () => { say.textContent = "✔ Lo repetí"; say.classList.add("is-on"); ok.disabled = false; });
  ok.addEventListener("click", () => m._close());
  setTimeout(secuencia, 250);

  if (parIt) {
    // Dos mini ejercicios "vs": suena una de las dos, eliges cuál.
    const vs = m.querySelector("#n1ErrVs");
    let ronda = 0;
    const siguiente = () => {
      if (ronda >= 2) { vs.innerHTML = `<p class="sub-fun" style="margin:6px 0;">Mini práctica lista ✔</p>`; return; }
      ronda += 1;
      const suena = Math.random() < 0.5 ? it : parIt;
      const op = n1Shuffle([it, parIt]);
      vs.innerHTML = `<div class="n1-sub">Mini práctica ${ronda}/2 — ¿cuál escuchas?</div>
        <div class="n1-vs-row"><button class="fun-btn" id="n1VsPlay">▶</button>
        ${op.map((o) => `<button class="fun-btn n1-vs-opt" data-id="${o.id}">${window._escHTML(o.audio)}</button>`).join("")}</div>`;
      vs.querySelector("#n1VsPlay").addEventListener("click", () => n1Reproducir(suena, {}));
      setTimeout(() => n1Reproducir(suena, {}), 400);
      vs.querySelectorAll(".n1-vs-opt").forEach((btn) => {
        btn.addEventListener("click", () => {
          const bien = btn.dataset.id === suena.id;
          btn.classList.add(bien ? "is-ok" : "is-bad");
          vs.querySelectorAll(".n1-vs-opt").forEach((x) => { x.disabled = true; if (x.dataset.id === suena.id) x.classList.add("is-ok"); });
          setTimeout(siguiente, 900);
        });
      });
    };
    siguiente();
  }
}

// ==================== INTERLUDIO MOTIVACIONAL ====================
function n1RenderInterludio(m, despues) {
  n1Chrome();
  const cont = document.getElementById("n1PlayContainer");
  cont.innerHTML = `
    <div class="n1-interludio">
      <div class="n1-inter-ico">🎧</div>
      <div class="n1-motiv-en" style="font-size:1.05rem;">${window._escHTML(m.audio)}</div>
      <div class="n1-motiv-es">${window._escHTML(m.texto_es || "")}</div>
      <button class="fun-btn primary-btn full-width" id="n1InterOk" style="width:100%;margin-top:18px;">${ListeningIcons.play()} Empezar</button>
    </div>`;
  N1Motiv.ultima = Date.now();
  n1Reproducir(m, {});
  document.getElementById("n1InterOk").addEventListener("click", () => { n1Parar(); despues(); });
}

// ==================== DESCUBRE ====================
function n1RenderDescubre(b) {
  const prog = n1Prog(b);
  const cats = n1DescubreCategorias(b, prog);
  N1S.cola = cats.map((c) => ({ cat: c.categoria }));
  N1S.descubre = cats;
  const sv = prog.sesion && prog.sesion.fase === "descubre" ? prog.sesion : null;
  N1S.i = sv && sv.i < cats.length ? sv.i : 0;
  if (!cats.length) { n1TerminarFase(b, "descubre"); return; }
  n1MostrarDescubre();
}
function n1MostrarDescubre() {
  const c = N1S.descubre[N1S.i];
  n1Chrome();
  const cont = document.getElementById("n1PlayContainer");
  const ejemplos = c.items.slice(0, 5);
  const ult = N1S.i + 1 >= N1S.descubre.length;
  const sonido = ejemplos[0] && ejemplos[0].sonido && ejemplos[0].sonido !== "forma débil" ? ejemplos[0].sonido : "";
  cont.innerHTML = `
    <div class="n1-desc">
      <div class="n1-desc-cat">${window._escHTML(n1CatNombre(c.categoria))}</div>
      ${sonido ? `<div class="n1-desc-son">${window._escHTML([...new Set(ejemplos.map((e) => e.sonido).filter(Boolean))].join("  ·  "))}</div>` : ""}
      <p class="n1-desc-txt">${window._escHTML(n1Pista(ejemplos[0]))}</p>
      <div class="n1-desc-list">
        ${ejemplos.map((e) => `<button class="fun-btn n1-desc-row" data-id="${e.id}">▶ <span>${window._escHTML(e.audio)}</span>${e.sonido ? `<small>${window._escHTML(e.sonido)}</small>` : ""}</button>`).join("")}
      </div>
      <p class="sub-fun" style="font-size:.76rem;">Solo escucha y repite en voz alta. Aquí no se califica.</p>
      <button class="fun-btn primary-btn full-width" id="n1DescNext" style="width:100%;">${ult ? "Terminar Descubre" : "Siguiente patrón"}</button>
    </div>`;
  const fill = document.getElementById("n1PlayProgressFill");
  if (fill) fill.style.width = Math.round((N1S.i / N1S.descubre.length) * 100) + "%";
  const ex = document.getElementById("n1PlayExTag");
  if (ex) ex.textContent = `${N1S.i + 1}/${N1S.descubre.length}`;
  cont.querySelectorAll(".n1-desc-row").forEach((btn) => {
    btn.addEventListener("click", () => n1Reproducir(N1State.byId[btn.dataset.id], {}));
  });
  document.getElementById("n1DescNext").addEventListener("click", () => {
    n1Parar();
    const corta = n1ReelsContar();
    if (ult) n1TerminarFase(N1S.b, "descubre");
    else {
      N1S.i += 1;
      n1GuardarSesion();
      if (corta) n1ReelsTerminar(); else n1MostrarDescubre();
    }
  });
}

// ==================== DISTINGUE (¿cuál suena distinto?) ====================
function n1ConstruirOddities(b, prog, n) {
  const pool = n1OddityPool(b, prog);
  const grupos = n1OddityGroups(pool);
  const sonidos = Object.keys(grupos);
  if (!sonidos.length) return [];
  const debil = new Set(prog.debil || []);
  const trials = [];
  let guard = 0;
  while (trials.length < n && guard++ < 400) {
    const pesos = sonidos.filter((s) => grupos[s].some((it) => debil.has(it.categoria)));
    const S = (pesos.length && Math.random() < 0.5) ? pesos[n1Rand(pesos.length)] : sonidos[n1Rand(sonidos.length)];
    const g = n1Shuffle(grupos[S]);
    const a = g[0];
    const b2 = g.find((x) => x.id !== a.id && x.audio.toLowerCase() !== a.audio.toLowerCase());
    const otros = pool.filter((x) => x.sonido !== S && x.audio.toLowerCase() !== a.audio.toLowerCase());
    if (!b2 || !otros.length) continue;
    const mismo = otros.filter((x) => x.categoria === a.categoria);
    const x = (mismo.length ? mismo : otros)[n1Rand((mismo.length ? mismo : otros).length)];
    const orden = n1Shuffle([a.id, b2.id, x.id]);
    trials.push({ ids: orden, impar: orden.indexOf(x.id), sonidoComun: S });
  }
  return trials;
}

function n1RenderOddity(t) {
  const cont = document.getElementById("n1PlayContainer");
  cont.innerHTML = `
    <p class="n1-odd-q">Dos palabras comparten el mismo sonido y una es distinta. Escucha las tres y marca la distinta.</p>
    <div class="n1-odd-grid">
      ${t.ids.map((id, k) => `<div class="n1-odd-col"><button class="l0-play-audio-btn n1-odd-play" data-k="${k}" aria-label="Audio ${k + 1}">${ListeningIcons.listen()}</button>
        <button class="fun-btn n1-odd-pick" data-k="${k}">Es la ${k + 1}</button><div class="n1-odd-word" id="n1OddW${k}"></div></div>`).join("")}
    </div>
    <p class="sub-fun" style="font-size:.76rem;">Práctica sin texto: no entra en tu nota.</p>`;
  const res = document.getElementById("n1PlayResultLine");
  if (res) res.textContent = "🎧 ¿Cuál suena distinto?";
  cont.querySelectorAll(".n1-odd-play").forEach((btn) => {
    btn.addEventListener("click", () => n1Reproducir(N1State.byId[t.ids[Number(btn.dataset.k)]], {}));
  });
  cont.querySelectorAll(".n1-odd-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (N1S.respondido) return;
      N1S.respondido = true;
      const k = Number(btn.dataset.k);
      const bien = k === t.impar;
      N1S.sesionTot += 1; if (bien) N1S.sesionOk += 1;
      t.ids.forEach((id, j) => {
        const it = N1State.byId[id];
        const w = document.getElementById("n1OddW" + j);
        if (w) w.innerHTML = `${window._escHTML(it.audio)}<small>${window._escHTML(it.sonido || "")}</small>`;
      });
      cont.querySelectorAll(".n1-odd-pick").forEach((x) => {
        x.disabled = true;
        if (Number(x.dataset.k) === t.impar) x.classList.add("is-ok");
      });
      if (!bien) btn.classList.add("is-bad");
      if (res) res.innerHTML = bien ? `${ListeningIcons.check()} ¡Bien oído!` : `La distinta era la ${t.impar + 1}`;
      const prev = document.createElement("button");
      prev.className = "fun-btn primary-btn full-width";
      prev.style.cssText = "width:100%;margin-top:14px;";
      prev.innerHTML = N1S.i + 1 >= N1S.cola.length ? `${ListeningIcons.finish()} Terminar` : `${ListeningIcons.next()} Siguiente`;
      prev.addEventListener("click", () => {
        n1Parar();
        N1S.i += 1;
        n1GuardarSesion();
        const corta = n1ReelsContar();
        if (N1S.i >= N1S.cola.length) n1FinSesion();
        else if (corta) n1ReelsTerminar();
        else n1RenderTrial();
      });
      cont.appendChild(prev);
    });
  });
  // Reproduce las tres en orden al empezar.
  (async () => {
    const mi = N1S.i;
    for (let k = 0; k < t.ids.length; k++) {
      if (N1S.i !== mi || N1S.respondido) return;
      await n1Reproducir(N1State.byId[t.ids[k]], {});
      await new Promise((r) => setTimeout(r, 450));
    }
  })();
}

// ==================== FIN DE SESIÓN / FASE ====================
function n1TerminarFase(b, fase) {
  const prog = n1Prog(b);
  prog.faseEstado[fase] = "hecha";
  prog.sesion = null;
  n1Save();
  if (N1R.activo) { n1ReelsContinuar(); return; }
  n1RenderHub(b);
  showMainView("listeningN1Hub");
}

function n1ResumenHTML(titulo, sub, pct, porCat, extra) {
  const filas = Object.keys(porCat).sort().map((c) => {
    const s = porCat[c];
    const p = s.total ? Math.round((s.ok / s.total) * 100) : 0;
    return `<div class="l0-result-cat-row"><span class="l0-result-cat-name">${window._escHTML(n1CatNombre(c))}</span>
      <div class="l0-result-cat-track"><div class="l0-result-cat-fill" style="width:${p}%;"></div></div>
      <span class="l0-result-cat-pct">${p}% (${s.ok}/${s.total})</span></div>`;
  }).join("");
  const r = 56, c = 2 * Math.PI * r;
  return `
    <div style="text-align:center;margin-bottom:4px;">
      <span class="l0-intro-icon" style="font-size:2rem;">${ListeningIcons.finish()}</span>
      <h2 style="margin:8px 0 2px;font-family:var(--font-display);color:var(--ink);">${titulo}</h2>
      <p class="sub-fun" style="margin:0;">${sub}</p>
    </div>
    ${pct == null ? "" : `<div class="l0-result-ring-wrap"><div class="l0-result-ring"><svg viewBox="0 0 132 132">
      <circle class="l0-ring-track" cx="66" cy="66" r="${r}"></circle>
      <circle class="l0-ring-fill" cx="66" cy="66" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" id="n1RingFill"></circle>
      </svg><span class="l0-result-ring-value">${pct}%</span></div></div>`}
    <div class="l0-result-cat-grid">${filas}</div>
    ${extra || ""}`;
}
function n1AnimarAnillo(pct) {
  requestAnimationFrame(() => {
    const ring = document.getElementById("n1RingFill");
    if (!ring) return;
    const c = 2 * Math.PI * 56;
    ring.style.strokeDashoffset = String(c - (Math.min(100, Math.max(0, pct)) / 100) * c);
  });
}

function n1MostrarEnHub(html, wire) {
  if (N1R.activo) {
    const pc = document.getElementById("n1PlayContainer");
    pc.innerHTML = `<div class="n1-reels-resumen">${html}</div>`;
    const res = document.getElementById("n1PlayResultLine");
    if (res) res.textContent = "";
    if (wire) wire(pc);
    return;
  }
  const cont = document.getElementById("n1HubContainer");
  cont.innerHTML = html;
  showMainView("listeningN1Hub");
  if (wire) wire(cont);
}

function n1FinSesion() {
  n1Parar();
  const b = N1S.b;
  const prog = n1Prog(b);
  const fase = N1S.fase;

  if (fase === "distingue") {
    const tot = N1S.sesionTot, ok = N1S.sesionOk;
    if (N1S.mini) {
      toast(`Rescate hecho: ${ok}/${tot}. Volvemos a Escribe`);
      N1S.mini = false;
      n1StartFase(b, "escribe");
      return;
    }
    n1MostrarEnHub(`
      <div style="text-align:center;"><span class="l0-intro-icon" style="font-size:2rem;">${ListeningIcons.finish()}</span>
      <h2 style="margin:8px 0 2px;font-family:var(--font-display);color:var(--ink);">Distingue terminado</h2>
      <p class="sub-fun">Acertaste ${ok} de ${tot}. Esta práctica no cuenta en tu nota.</p></div>
      <button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">Continuar</button>`,
      (c) => c.querySelector("#n1ResBack").addEventListener("click", () => n1TerminarFase(b, "distingue")));
    return;
  }

  const total = Object.keys(N1S.porCat).reduce((a, c) => a + N1S.porCat[c].total, 0);
  const oks = Object.keys(N1S.porCat).reduce((a, c) => a + N1S.porCat[c].ok, 0);
  const pct = total ? Math.round((oks / total) * 100) : 0;
  n1PostResultados(b, fase, N1S.porCat, prog.ronda, N1S.ort);

  if (fase === "entrada") {
    const debil = Object.keys(N1S.porCat).filter((c) => N1S.porCat[c].total >= 1 && N1S.porCat[c].ok / N1S.porCat[c].total < 0.7);
    prog.debil = debil;
    prog.faseEstado.entrada = "hecha";
    prog.sesion = null;
    n1Save();
    const m = n1ElegirMotivacion("cierre_tanda");
    n1MostrarEnHub(n1ResumenHTML("Chequeo de entrada", "Así llegas a este bloque", pct, N1S.porCat,
      `<p class="sub-fun" style="margin-top:12px;">${debil.length ? "Vamos a reforzar más: " + debil.map((c) => "<strong>" + window._escHTML(n1CatNombre(c)) + "</strong>").join(", ") + "." : "Llegas bien en todos los patrones. Igual practicaremos los de siempre."}</p>
       <button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">Continuar</button>`),
      (c) => c.querySelector("#n1ResBack").addEventListener("click", () => n1RenderHub(b)));
    n1AnimarAnillo(pct);
    if (m) n1Reproducir(m, {});
    return;
  }

  if (fase === "completa") {
    const hechos = new Set(prog.hechos.completa);
    const quedan = n1PlanIds(prog, "completa").filter((it) => !hechos.has(it.id)).length;
    prog.sesion = null;
    if (!quedan) prog.faseEstado.completa = "hecha";
    n1Save();
    n1MostrarEnHub(n1ResumenHTML("Completa", quedan ? "Sesión terminada" : "Fase terminada", pct, N1S.porCat,
      `<button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">Continuar</button>`),
      (c) => c.querySelector("#n1ResBack").addEventListener("click", () => n1RenderHub(b)));
    n1AnimarAnillo(pct);
    return;
  }

  if (fase === "escribe") {
    const hoy = n1Hoy();
    if (prog.tandas.fecha !== hoy) prog.tandas = { fecha: hoy, n: 0 };
    prog.tandas.n += 1;
    const hechos = new Set(prog.hechos.escribe);
    const quedan = n1PlanIds(prog, "escribe").filter((it) => !hechos.has(it.id)).length;
    prog.sesion = null;
    if (!quedan) prog.faseEstado.escribe = "hecha";
    // Los patrones por debajo de 70% pasan a la lista de refuerzo.
    const debil = Object.keys(prog.statsCat).filter((c) => prog.statsCat[c].total >= 5 && prog.statsCat[c].ok / prog.statsCat[c].total < 0.7);
    prog.debil = Array.from(new Set((prog.debil || []).filter((c) => !prog.statsCat[c] || prog.statsCat[c].total < 5 || prog.statsCat[c].ok / prog.statsCat[c].total < 0.8).concat(debil)));
    n1Save();
    const m = n1ElegirMotivacion("cierre_tanda");
    const ortTxt = N1S.ort.total ? `<p class="sub-fun" style="margin-top:10px;">Ortografía exacta cuando el oído estuvo bien: ${Math.round((N1S.ort.exactas / N1S.ort.total) * 100)}%</p>` : "";
    const meta = prog.tandas.n >= 3 ? "¡Meta del día cumplida! (3 tandas)" : `Tanda ${prog.tandas.n}/3 de hoy`;
    n1MostrarEnHub(n1ResumenHTML("Tanda terminada", meta + (quedan ? ` · quedan ${quedan} ejercicios en Escribe` : " · Escribe completo"), pct, N1S.porCat,
      `${ortTxt}<button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">Continuar</button>`),
      (c) => c.querySelector("#n1ResBack").addEventListener("click", () => n1RenderHub(b)));
    n1AnimarAnillo(pct);
    if (m) n1Reproducir(m, {});
    return;
  }

  if (fase === "examen") { n1FinExamen(b, prog, pct); return; }
}

function n1FinExamen(b, prog, pct) {
  const version = ((prog.ronda - 1) % 3) + 1;
  const registro = { ronda: prog.ronda, version, pct, fecha: n1Hoy(), porCat: N1S.porCat };
  prog.examenes.push(registro);
  prog.sesion = null;
  prog.faseEstado.examen = "hecha";
  const aprobado = pct >= N1_UMBRAL;
  if (prog.mejor == null || pct > prog.mejor) prog.mejor = pct;
  const resumen = n1ResumenHTML(aprobado ? "¡Bloque aprobado!" : "Aún no llegas a 70", `Examen · ronda ${prog.ronda} · versión ${version}`, pct, N1S.porCat, "");

  if (aprobado) {
    prog.estado = "aprobado";
    prog.aprobado = true;
    n1Save();
    const m = n1ElegirMotivacion("examen_aprobado");
    const todo = n1TodoAprobado();
    n1MostrarEnHub(resumen + `
      ${todo ? '<div class="n1-aviso">🏁 ¡Terminaste los 12 bloques del Nivel 1! El siguiente paso es el re-test del Nivel 0 (con palabras nuevas) antes de abrir el Nivel 2.</div>' : ""}
      <button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">${N1R.activo ? "Continuar" : "Volver a Listening"}</button>
      <button class="fun-btn full-width" id="n1ResCopy" style="width:100%;margin-top:8px;">${ListeningIcons.copy()} Copiar informe</button>`,
      (c) => {
        c.querySelector("#n1ResBack").addEventListener("click", () => {
          if (N1R.activo) { n1ReelsContinuar(); return; }
          renderListeningHome(); showMainView("listeningHome");
        });
        c.querySelector("#n1ResCopy").addEventListener("click", () => n1CopiarTexto(n1ReporteErrores(b), "📋 Informe copiado"));
      });
    n1AnimarAnillo(pct);
    if (typeof burstConfetti === "function") burstConfetti();
    if (m) n1Reproducir(m, {});
  } else {
    // Patrones débiles del examen + los que ya venían flojos; ronda nueva con la mitad de ejercicios.
    const debilEx = Object.keys(N1S.porCat).filter((c) => N1S.porCat[c].total && N1S.porCat[c].ok / N1S.porCat[c].total < 0.7);
    prog.debil = Array.from(new Set(debilEx.concat((prog.debil || []))));
    prog.ronda += 1;
    prog.estado = "curso";
    n1MakePlan(b, prog);
    n1Save();
    const fallos = prog.examenes.filter((e) => e.pct < N1_UMBRAL).length;
    n1MostrarEnHub(resumen + `
      <p class="sub-fun" style="margin-top:12px;">Nueva ronda ${prog.ronda}: la mitad de ejercicios por fase, con palabras nuevas, centrada en ${prog.debil.length ? prog.debil.map((c) => "<strong>" + window._escHTML(n1CatNombre(c)) + "</strong>").join(", ") : "todo el bloque"}.</p>
      ${fallos >= 3 ? '<div class="n1-aviso">Ya van 3 exámenes sin aprobar. Copia el informe de errores y lo revisamos juntos.</div>' : ""}
      <button class="fun-btn primary-btn full-width" id="n1ResBack" style="width:100%;margin-top:14px;">Empezar ronda ${prog.ronda}</button>
      <button class="fun-btn full-width" id="n1ResCopy" style="width:100%;margin-top:8px;">${ListeningIcons.copy()} Copiar informe de errores</button>`,
      (c) => {
        c.querySelector("#n1ResBack").addEventListener("click", () => n1RenderHub(b));
        c.querySelector("#n1ResCopy").addEventListener("click", () => n1CopiarTexto(n1ReporteErrores(b), "📋 Informe copiado — pégalo en el chat"));
      });
    n1AnimarAnillo(pct);
  }
}

// Salir a mitad de camino: el avance ya está guardado en cada respuesta.
function n1SalirDelJuego() {
  n1Parar();
  if (N1R.activo) { n1ReelsTerminar(); return; }
  if (N1S.b) { n1RenderHub(N1S.b); showMainView("listeningN1Hub"); }
  else { renderListeningHome(); showMainView("listeningHome"); }
}

// ==================== MODO REELS ====================
// Reels toma prestada la pantalla de juego del Nivel 1 (la mueve dentro de su
// tarjeta) para hacer N ejercicios seguidos del bloque y la fase en curso. El
// avance es el mismo del módulo de Listening (se guarda en cada respuesta), así
// que se puede seguir en cualquiera de los dos lados. Si en Reels se termina una
// fase, se muestra su resumen y se sigue con la siguiente; si se termina el
// bloque (examen), se envía al Sheet como siempre y se sigue con el siguiente
// bloque o con la nueva ronda, según el resultado.
const N1R = { activo: false, restantes: 0, area: null, casa: null, cb: null };

function n1ReelsBloque() {
  n1Load();
  if (n1TodoAprobado()) return null;
  const b = n1ActualBloque();
  return n1BlockInfo(b).jugable ? b : null;
}

function n1ReelsDisponible() { return !!n1ReelsBloque(); }

function n1ReelsIniciar(host, n, cb) {
  n1Load();
  const area = document.querySelector("#listeningN1PlayScreen .exercise-area");
  if (!area || !host) return false;
  N1R.activo = true;
  N1R.restantes = Math.max(1, n || 3);
  N1R.cb = cb || {};
  N1R.area = area;
  N1R.casa = area.parentNode;
  host.appendChild(area);
  n1ReelsContinuar();
  return true;
}

// true si ya se hicieron los ejercicios que tocaban en esta pasada.
function n1ReelsContar() {
  if (!N1R.activo) return false;
  N1R.restantes -= 1;
  if (N1R.cb && N1R.cb.cuenta) { try { N1R.cb.cuenta(N1R.restantes); } catch (e) { /* nada */ } }
  return N1R.restantes <= 0;
}

function n1ReelsContinuar() {
  if (!N1R.activo) return;
  if (N1R.restantes <= 0) { n1ReelsTerminar(); return; }
  const b = n1ReelsBloque();
  if (!b) { n1ReelsTerminar(); return; }
  const prog = n1Prog(b);
  if (!prog.plan) { n1MakePlan(b, prog); prog.estado = "curso"; n1Save(); }
  const fase = n1FaseActual(prog);
  if (!fase) { n1ReelsTerminar(); return; }
  if (N1R.cb && N1R.cb.bloque) { try { N1R.cb.bloque(b, fase); } catch (e) { /* nada */ } }
  n1StartFase(b, fase);
}

// Devuelve la pantalla de juego a su lugar sin cerrar nada (al salir de Reels).
function n1ReelsSoltar() {
  n1Parar();
  document.querySelectorAll(".n1-modal").forEach((m) => m.remove());
  if (N1R.area && N1R.casa) N1R.casa.appendChild(N1R.area);
  N1R.activo = false;
}

function n1ReelsTerminar() {
  const cb = N1R.cb;
  n1ReelsSoltar();
  N1R.cb = null;
  if (cb && cb.fin) cb.fin();
}
