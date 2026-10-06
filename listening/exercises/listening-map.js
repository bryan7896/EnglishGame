// listening/exercises/listening-map.js
//
// Pintor de la pantalla de inicio del Nivel 0 (#listeningHomeScreen).
// Entrega 1: solo lectura — muestra las 7 level cards con su estado
// (bloqueado/actual/completado) y un resumen arriba. Ninguna card lleva a
// un ejercicio real todavía (eso llega en la entrega 2); por ahora, tocar
// un bloque desbloqueado solo avisa que el motor de ejercicios está en
// camino, para que quede claro qué sí existe hoy y qué no.
//
// La pantalla tiene dos partes: el Nivel 0 (colapsado por defecto, se
// expande tocando la tarjeta de intro) y, debajo, un espacio reservado
// para los Niveles 1-4 — deshabilitados a propósito, solo para que la
// estructura final (varios niveles, no solo Nivel 0) ya se vea desde
// ahora aunque por ahora solo trabajemos el Nivel 0.

// Metadata de los niveles futuros. Sin contenido real todavía — solo el
// espacio reservado que pidió Bryan. Cuando se diseñe cada nivel, esto se
// reemplaza por su propia lista de bloques/lecciones, igual que
// LISTENING_BLOQUES_META hace con el Nivel 0.
const LISTENING_NIVELES_FUTUROS = [
  { nivel: 1, titulo: "Nivel 1", descripcion: "Próximamente" },
  { nivel: 2, titulo: "Nivel 2", descripcion: "Próximamente" },
  { nivel: 3, titulo: "Nivel 3", descripcion: "Próximamente" },
  { nivel: 4, titulo: "Nivel 4", descripcion: "Próximamente" },
];

function renderListeningHome() {
  loadListeningProgress();
  renderListeningNivel0();
  renderListeningFutureLevels();
  wireListeningNivel0Toggle();
}

function renderListeningNivel0() {
  const listEl = document.getElementById("listeningMapList");
  const summaryEl = document.getElementById("listeningSummaryRow");
  if (!listEl) return;

  const summary = listeningOverallSummary();
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="l0-summary-stat">
        <span class="l0-stat-value">${summary.bloquesCompletados}/${summary.totalBloques}</span>
        <span class="l0-stat-label">Bloques</span>
      </div>
      <div class="l0-summary-stat">
        <span class="l0-stat-value">${summary.totalEjercicios}</span>
        <span class="l0-stat-label">Ejercicios</span>
      </div>
      <div class="l0-summary-stat">
        <span class="l0-stat-value">4</span>
        <span class="l0-stat-label">Voces por audio</span>
      </div>
    `;
  }

  const current = currentListeningBlock();

  listEl.innerHTML = LISTENING_BLOQUES_META.map((meta) => {
    const bloque = meta.bloque;
    const unlocked = isListeningBlockUnlocked(bloque);
    const prog = listeningBlockProgress(bloque);
    const isCurrent = unlocked && !prog.completed && bloque === current;
    const isDone = !!prog.completed;

    const stateClass = !unlocked ? "is-locked" : isDone ? "is-done" : isCurrent ? "is-current" : "";
    const statusIcon = !unlocked ? ListeningIcons.lock() : isDone ? ListeningIcons.check() : ListeningIcons.play();

    const ejerciciosEnBloque = listeningExercisesByBloque(bloque).length || 100;
    const progressPct = isDone ? 100 : 0;
    const scoreLabel = isDone && typeof prog.bestScore === "number"
      ? `${prog.bestScore}%`
      : (unlocked ? `0/${ejerciciosEnBloque}` : "");
    // Botón "ver resultado": solo en bloques ya completados, para repasar
    // el desglose por categoría guardado en localStorage sin tener que
    // rejugar el bloque entero. Lleva su propio data-bloque y se wirea
    // aparte del click de la card (con stopPropagation) para no disparar
    // un replay accidental.
    const verResultadoBtn = isDone
      ? `<button class="l0-level-view-btn" data-ver-bloque="${bloque}" aria-label="Ver resultado" title="Ver resultado">${ListeningIcons.eye()}</button>`
      : "";

    return `
      <div class="l0-level-card ${stateClass}" data-bloque="${bloque}" data-unlocked="${unlocked ? "1" : "0"}">
        <div class="l0-level-badge">
          <span class="l0-level-icon">${meta.icono}</span>
          <span class="l0-level-num">Bloque ${bloque}</span>
        </div>
        <div class="l0-level-body">
          <div class="l0-level-title">${window._escHTML(meta.titulo)}</div>
          <div class="l0-level-desc">${window._escHTML(meta.descripcion)}</div>
          <div class="l0-level-meta">
            <div class="l0-level-progress-track">
              <div class="l0-level-progress-fill" style="width:${progressPct}%;"></div>
            </div>
            <span class="l0-level-score">${scoreLabel}</span>
            ${verResultadoBtn}
          </div>
        </div>
        <div class="l0-level-status">${statusIcon}</div>
      </div>
    `;
  }).join("");

  // Familias que ya tienen motor de juego real (listening-play.js).
  const FAMILIAS_CON_MOTOR = ["seleccion", "dictado_palabra", "dictado_frase_corta", "dictado_frase_media"];

  listEl.querySelectorAll(".l0-level-view-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      viewListeningBlockResult(Number(btn.dataset.verBloque));
    });
  });

  listEl.querySelectorAll(".l0-level-card").forEach((card) => {
    card.addEventListener("click", () => {
      const bloque = Number(card.dataset.bloque);
      const unlocked = card.dataset.unlocked === "1";
      if (!unlocked) {
        toast("🔒 Completa el bloque anterior para desbloquear este");
        return;
      }
      const ejercicios = listeningExercisesByBloque(bloque);
      const familia = ejercicios[0] && ejercicios[0].familia;
      if (!FAMILIAS_CON_MOTOR.includes(familia)) {
        toast(`🚧 Bloque ${bloque} listo — su modo de juego (${familia}) llega en la próxima entrega`);
        return;
      }
      startListeningBlock(bloque);
    });
  });
}

// Nivel 0 arranca colapsado (solo se ve la tarjeta de intro); tocarla
// expande/colapsa el bloque con los 7 niveles. El estado vive solo en el
// DOM (no se persiste) — cada vez que se entra a la pantalla arranca
// colapsado de nuevo, a propósito, para que la vista inicial sea siempre
// la misma.
function wireListeningNivel0Toggle() {
  const toggle = document.getElementById("listeningNivel0Toggle");
  const body = document.getElementById("listeningNivel0Body");
  const chevron = document.getElementById("listeningNivel0Chevron");
  if (!toggle || !body || toggle._wired) return;
  toggle._wired = true;

  const setExpanded = (expanded) => {
    body.classList.toggle("is-collapsed", !expanded);
    // display inline, además de la clase: así el colapso no depende de
    // que listening.css haya cargado/estado presente en el build — si el
    // CSS falla por cualquier motivo, esto solo sigue funcionando.
    body.style.display = expanded ? "" : "none";
    if (chevron) chevron.textContent = expanded ? "▾" : "▸";
    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    setExpanded(body.classList.contains("is-collapsed"));
  });
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded(body.classList.contains("is-collapsed"));
    }
  });

  // Estado inicial forzado (colapsado) sin depender de que el CSS haya
  // cargado a tiempo.
  setExpanded(false);
}

// Espacio reservado para los Niveles 1-4: cards deshabilitadas, sin
// click, solo para que la estructura final de "varios niveles" ya se vea
// aunque hoy solo exista contenido real en el Nivel 0.
function renderListeningFutureLevels() {
  const el = document.getElementById("listeningFutureLevels");
  if (!el) return;

  el.innerHTML = LISTENING_NIVELES_FUTUROS.map((n) => `
    <div class="l0-level-card is-locked l0-future-level-card">
      <div class="l0-level-badge">
        <span class="l0-level-icon">${ListeningIcons.lock()}</span>
        <span class="l0-level-num">Nivel ${n.nivel}</span>
      </div>
      <div class="l0-level-body">
        <div class="l0-level-title">${window._escHTML(n.titulo)}</div>
        <div class="l0-level-desc">${window._escHTML(n.descripcion)}</div>
      </div>
      <div class="l0-level-status">${ListeningIcons.lock()}</div>
    </div>
  `).join("");
}

// ==================== REPORTE (historial remoto) ====================
// A diferencia de las level cards (que solo muestran el mejor puntaje
// guardado en ESTE dispositivo via localStorage), este reporte trae el
// historial completo desde la hoja "Listening" del Sheet -- útil para ver
// progreso entre sesiones/dispositivos o simplemente revisar intentos
// pasados. Es un GET puro (igual que Porcentajes): el cliente ya calculó
// y subió cada score al terminar un bloque; aquí solo se lee y se agrupa.
async function openListeningReportScreen() {
  showMainView("listeningReport");
  const container = document.getElementById("listeningReportContainer");
  if (container) {
    container.innerHTML = `<p class="sub-fun" style="text-align:center;">Cargando historial...</p>`;
  }
  try {
    const res = await fetch(API_URL + "?sheet=listening");
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Error desconocido");
    renderListeningReportScreen(json.data || []);
  } catch (e) {
    if (container) {
      container.innerHTML = `
        <p class="sub-fun" style="text-align:center;">⚠️ No se pudo cargar el historial remoto.</p>
        <p class="sub-fun" style="text-align:center;">Puede ser que no haya conexión, o que falte crear la hoja "Listening" en el Sheet. Mientras tanto tu mejor puntaje por bloque sigue disponible en la pantalla de Niveles.</p>
      `;
    }
  }
}

function renderListeningReportScreen(data) {
  const container = document.getElementById("listeningReportContainer");
  if (!container) return;

  if (!data.length) {
    container.innerHTML = `<p class="sub-fun" style="text-align:center;">Todavía no hay historial registrado. Termina un bloque para que aparezca aquí.</p>`;
    return;
  }

  // Agrupar por bloque: mejor % visto, cantidad de registros subidos y
  // última fecha; dentro de cada bloque, por categoría se muestra el
  // valor del registro más reciente (no un promedio histórico).
  const porBloque = {};
  data.forEach((row) => {
    const bloque = Number(row.bloque);
    if (!bloque) return;
    if (!porBloque[bloque]) porBloque[bloque] = { intentos: 0, mejor: 0, ultimaFecha: null, categorias: {} };
    const g = porBloque[bloque];
    g.intentos += 1;
    const pct = Number(row.porcentaje) || 0;
    if (pct > g.mejor) g.mejor = pct;
    const fecha = new Date(row.fecha);
    const valida = !Number.isNaN(fecha.getTime());
    if (valida && (!g.ultimaFecha || fecha > g.ultimaFecha)) g.ultimaFecha = fecha;
    const categoria = row.categoria || "—";
    if (!g.categorias[categoria]) g.categorias[categoria] = [];
    g.categorias[categoria].push({ pct, fecha: valida ? fecha : new Date(0) });
  });

  const bloques = Object.keys(porBloque).map(Number).sort((a, b) => a - b);

  container.innerHTML = bloques.map((bloque) => {
    const g = porBloque[bloque];
    const meta = listeningBloqueMeta(bloque);

    const catsHtml = Object.keys(g.categorias).sort().map((categoria) => {
      const entries = g.categorias[categoria].sort((a, b) => a.fecha - b.fecha);
      const last = entries[entries.length - 1];
      return `
        <div class="l0-result-cat-row">
          <span class="l0-result-cat-name">${window._escHTML(categoria)}</span>
          <div class="l0-result-cat-track"><div class="l0-result-cat-fill" style="width:${last.pct}%;"></div></div>
          <span class="l0-result-cat-pct">${last.pct}%</span>
        </div>
      `;
    }).join("");

    const fechaLabel = g.ultimaFecha ? g.ultimaFecha.toLocaleDateString() : "—";

    return `
      <div class="l0-level-card" style="margin-bottom:12px;cursor:default;align-items:flex-start;">
        <div class="l0-level-badge">
          <span class="l0-level-icon">${meta ? meta.icono : "🔊"}</span>
          <span class="l0-level-num">Bloque ${bloque}</span>
        </div>
        <div class="l0-level-body" style="padding-bottom:12px;">
          <div class="l0-level-title">${meta ? window._escHTML(meta.titulo) : "Bloque " + bloque}</div>
          <div class="l0-level-desc">Mejor: <strong style="color:var(--brand-light);">${g.mejor}%</strong> · ${g.intentos} registro(s) · último: ${fechaLabel}</div>
          <div class="l0-result-cat-grid" style="margin-top:8px;">${catsHtml}</div>
        </div>
      </div>
    `;
  }).join("");
}
