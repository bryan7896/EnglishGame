// listening/exercises/listening-play.js
//
// Motor de juego del Nivel 0, para las dos mecánicas de los 7 bloques:
//
// - "seleccion" (Bloques 1-2, pares mínimos fonéticos): se reproduce el
//   audio y el usuario elige entre 3 opciones (el target + 2 distractores,
//   orden aleatorio).
// - "dictado_palabra" / "dictado_frase_corta" / "dictado_frase_media"
//   (Bloques 3-7): sin opciones — el usuario escribe lo que escucha y se
//   califica con la misma lógica de checkDictadoAnswer() que ya usa el
//   dictado del English Trainer (exercises/dictado.js, mismo scope de
//   módulo concatenado por build.py): exacto o ≥80% de palabras iguales
//   cuenta como acierto.
//
// En ambas, el audio tiene 3 voces disponibles, una por cada vez que se
// toca el botón "reproducir" (v1, luego v2, luego v3).

const LISTENING_DICTADO_FAMILIAS = ["dictado_palabra", "dictado_frase_corta", "dictado_frase_media"];

const ListeningPlaySession = {
  bloque: null,
  exercises: [],
  index: 0,
  correctCount: 0,
  categoriaStats: {}, // { [categoria]: { correct, total } }
  voiceTap: 0,
  answered: false,
};

function listeningAudioPathFor(ex, voiceKey) {
  const archivo = ex.audios && ex.audios[voiceKey];
  if (!archivo) return null;
  return `listening/audio/${ex.familia}/${ex.carpeta}/${archivo}`;
}

function shuffleListeningArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startListeningBlock(bloque) {
  const exercises = listeningExercisesByBloque(bloque);
  if (!exercises.length) {
    toast("⚠️ No hay ejercicios cargados para este bloque todavía");
    return;
  }
  ListeningPlaySession.bloque = bloque;
  ListeningPlaySession.exercises = exercises;
  ListeningPlaySession.voiceTap = 0;
  ListeningPlaySession.answered = false;

  // Si quedó un intento a medias de este mismo bloque (autoguardado tras
  // cada ejercicio contestado), se continúa justo ahí en vez de reiniciar
  // desde el ejercicio 1 -- así no hay que hacer los 100 de una sola vez.
  const saved = listeningInProgressFor(bloque);
  if (saved && saved.index > 0 && saved.index < exercises.length) {
    ListeningPlaySession.index = saved.index;
    ListeningPlaySession.correctCount = saved.correctCount || 0;
    ListeningPlaySession.categoriaStats = saved.categoriaStats || {};
    toast(`▶️ Continuando donde quedaste (ejercicio ${saved.index + 1}/${exercises.length})`);
  } else {
    ListeningPlaySession.index = 0;
    ListeningPlaySession.correctCount = 0;
    ListeningPlaySession.categoriaStats = {};
  }

  showMainView("listeningPlay");
  renderCurrentListeningExercise();
}

// Autoguardado: se llama justo después de calificar cada ejercicio (ya
// con sus stats actualizadas), guardando el ÍNDICE SIGUIENTE -- el que
// toca mostrar si el usuario vuelve más tarde -- junto con lo acumulado
// hasta ahora. Si el usuario sale antes de calificar el ejercicio actual,
// no hay nada nuevo que guardar: al volver se le muestra ese mismo
// ejercicio sin contestar todavía, nada se pierde.
function persistListeningSessionProgress() {
  const session = ListeningPlaySession;
  if (!session.bloque) return;
  saveListeningInProgress(session.bloque, {
    index: session.index + 1,
    correctCount: session.correctCount,
    categoriaStats: session.categoriaStats,
  });
}

// Markup + wiring del botón redondo de reproducir, compartido por ambas
// mecánicas (seleccion y dictado_*). Devuelve solo el HTML; wireListeningAudioPlayer()
// se encarga de enganchar los eventos una vez que ese HTML ya está en el DOM.
function listeningAudioPlayerHTML() {
  return `
    <div class="l0-play-audio-wrap">
      <button class="l0-play-audio-btn" id="l0PlayAudioBtn" aria-label="Reproducir audio" title="Reproducir audio">${ListeningIcons.listen()}</button>
      <span class="l0-play-audio-label" id="l0PlayAudioLabel">Toca para escuchar</span>
      <div class="l0-play-audio-dots" id="l0PlayAudioDots">
        <span data-voz="1"></span><span data-voz="2"></span><span data-voz="3"></span>
      </div>
    </div>
  `;
}

function wireListeningAudioPlayer(ex) {
  const session = ListeningPlaySession;
  const audioBtn = document.getElementById("l0PlayAudioBtn");
  const audioLabel = document.getElementById("l0PlayAudioLabel");
  const audioDots = document.getElementById("l0PlayAudioDots");
  if (!audioBtn) return;
  audioBtn.addEventListener("click", () => {
    session.voiceTap = Math.min(session.voiceTap + 1, 3);
    const voiceKey = "v" + session.voiceTap;
    const path = listeningAudioPathFor(ex, voiceKey);
    if (audioLabel) audioLabel.textContent = `Voz ${session.voiceTap}/3`;
    if (audioDots) {
      audioDots.querySelectorAll("span").forEach((dot) => {
        dot.classList.toggle("is-played", Number(dot.dataset.voz) <= session.voiceTap);
      });
    }
    audioBtn.classList.add("is-tapped");
    if (!path) return;
    try {
      const audio = new Audio(path);
      audio.play().catch(() => { /* el navegador puede bloquear autoplay sin gesto previo; el click ya cuenta como gesto */ });
    } catch (e) { /* noop */ }
  });
}

// Feedback físico (sacudida breve) cuando la respuesta es incorrecta, para
// no depender solo del color rojo. Se autolimpia con animationend por si
// el elemento se reutiliza antes de que termine.
function listeningShake(el) {
  if (!el) return;
  el.classList.remove("l0-shake");
  void el.offsetWidth;
  el.classList.add("l0-shake");
  el.addEventListener("animationend", () => el.classList.remove("l0-shake"), { once: true });
}

// Agrega el botón "Siguiente"/"Terminar bloque" al final del contenedor de
// juego, compartido por ambas mecánicas una vez que el ejercicio ya fue
// calificado.
function appendListeningContinueButton() {
  const session = ListeningPlaySession;
  const isLast = session.index + 1 >= session.exercises.length;
  const nextBtn = document.createElement("button");
  nextBtn.className = "fun-btn primary-btn full-width";
  nextBtn.style.width = "100%";
  nextBtn.style.marginTop = "14px";
  nextBtn.innerHTML = isLast
    ? `${ListeningIcons.finish()} Terminar bloque`
    : `${ListeningIcons.next()} Siguiente`;
  nextBtn.addEventListener("click", goToNextListeningExercise);
  document.getElementById("listeningPlayContainer").appendChild(nextBtn);
}

function renderCurrentListeningExercise() {
  const session = ListeningPlaySession;
  const ex = session.exercises[session.index];
  const container = document.getElementById("listeningPlayContainer");
  const bloqueTag = document.getElementById("l0PlayBloqueTag");
  const exTag = document.getElementById("l0PlayExTag");
  const categoriaTag = document.getElementById("l0PlayCategoriaTag");
  const resultLine = document.getElementById("l0PlayResultLine");
  const progressFill = document.getElementById("l0PlayProgressFill");
  if (!container) return;

  session.voiceTap = 0;
  session.answered = false;

  if (bloqueTag) bloqueTag.textContent = `Bloque ${session.bloque}`;
  if (exTag) exTag.textContent = `Ejercicio ${session.index + 1}/${session.exercises.length}`;
  if (categoriaTag) categoriaTag.textContent = ex.categoria;
  if (resultLine) resultLine.textContent = "🎧 Escucha y responde";
  if (progressFill) progressFill.style.width = `${Math.round((session.index / session.exercises.length) * 100)}%`;

  if (LISTENING_DICTADO_FAMILIAS.includes(ex.familia)) {
    renderListeningDictadoExercise(ex, container);
  } else {
    renderListeningSeleccionExercise(ex, container);
  }

  wireListeningAudioPlayer(ex);

  // Entrada suave del ejercicio nuevo; se reinicia la animación quitando
  // y volviendo a poner la clase (si ya estaba, un segundo "add" no
  // reinicia el keyframe en el mismo frame).
  container.classList.remove("l0-anim-in");
  void container.offsetWidth;
  container.classList.add("l0-anim-in");
}

function renderListeningSeleccionExercise(ex, container) {
  const options = shuffleListeningArray([
    ex.contenido_audio,
    ex.opcion_distractora,
    ex.opcion_distractora_2,
  ]);

  container.innerHTML = `
    ${listeningAudioPlayerHTML()}
    <div class="button-group" id="l0PlayOptions">
      ${options.map((opt) => `<button class="fun-btn full-width l0-play-option" data-value="${window._escHTML(opt)}" style="width:100%;margin-bottom:8px;">${window._escHTML(opt)}</button>`).join("")}
    </div>
    <button class="fun-btn primary-btn full-width" id="l0SeleccionCheckBtn" style="width:100%;" disabled>
      ${ListeningIcons.check()} Comprobar
    </button>
  `;

  const checkBtn = document.getElementById("l0SeleccionCheckBtn");

  // Primer tap: solo selecciona (resalta la opción, sin calificar todavía)
  // y habilita "Comprobar". Tocar otra opción antes de comprobar cambia la
  // selección libremente. La calificación real pasa a checkListeningSeleccionAnswer(),
  // que solo corre cuando se presiona "Comprobar" -- así correcto e
  // incorrecto siguen exactamente el mismo flujo de dos pasos.
  container.querySelectorAll(".l0-play-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (ListeningPlaySession.answered) return;
      container.querySelectorAll(".l0-play-option").forEach((b) => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      checkBtn.disabled = false;
    });
  });

  checkBtn.addEventListener("click", () => {
    const selectedBtn = container.querySelector(".l0-play-option.is-selected");
    if (!selectedBtn) return;
    checkListeningSeleccionAnswer(selectedBtn, ex);
  });
}

// Palabra suelta (dictado_palabra) vs frase (dictado_frase_corta/media):
// misma mecánica de input, solo cambia el placeholder para orientar al
// usuario sobre qué tan largo es lo que viene.
function listeningDictadoPlaceholder(familia) {
  if (familia === "dictado_palabra") return "Escribe la palabra que escuchaste...";
  return "Escribe la frase que escuchaste...";
}

function renderListeningDictadoExercise(ex, container) {
  container.innerHTML = `
    ${listeningAudioPlayerHTML()}
    <input
      type="text"
      class="answer-input"
      id="l0DictadoInput"
      style="width:100%;margin-bottom:12px;"
      placeholder="${listeningDictadoPlaceholder(ex.familia)}"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
    />
    <button class="fun-btn primary-btn full-width" id="l0DictadoCheckBtn" style="width:100%;">
      ${ListeningIcons.check()} Comprobar
    </button>
  `;

  const input = document.getElementById("l0DictadoInput");
  const checkBtn = document.getElementById("l0DictadoCheckBtn");
  const submit = () => checkListeningDictadoAnswer(ex, input.value);
  checkBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
  setTimeout(() => input.focus(), 50);
}

function checkListeningSeleccionAnswer(btn, ex) {
  const session = ListeningPlaySession;
  if (session.answered) return;
  session.answered = true;

  const selected = btn.dataset.value;
  const correct = selected === ex.contenido_audio;

  const stats = session.categoriaStats[ex.categoria] || { correct: 0, total: 0 };
  stats.total += 1;
  if (correct) { stats.correct += 1; session.correctCount += 1; }
  session.categoriaStats[ex.categoria] = stats;

  const resultLine = document.getElementById("l0PlayResultLine");
  const optionsEl = document.getElementById("l0PlayOptions");
  optionsEl.querySelectorAll(".l0-play-option").forEach((b) => {
    b.disabled = true;
    b.classList.remove("is-selected");
    if (b.dataset.value === ex.contenido_audio) {
      b.style.borderColor = "var(--good)";
      b.style.background = "var(--good-wash)";
    } else if (b === btn) {
      b.style.borderColor = "var(--bad)";
      b.style.background = "var(--bad-wash)";
    }
  });

  // El botón "Comprobar" ya cumplió su función; en su lugar entra el
  // "Siguiente"/"Terminar bloque" de appendListeningContinueButton().
  document.getElementById("l0SeleccionCheckBtn")?.remove();

  if (resultLine) {
    resultLine.innerHTML = correct
      ? `${ListeningIcons.check()} ¡Correcto!`
      : `Era "${window._escHTML(ex.contenido_audio)}"`;
  }

  if (correct) {
    listeningShowAchievement(btn);
  } else {
    listeningShake(optionsEl);
  }
  persistListeningSessionProgress();
  appendListeningContinueButton();
}

// Animación de logro al acertar: una insignia con check que aparece con
// un "pop" sobre la opción correcta y se disuelve sola. Separada de
// appendListeningContinueButton() porque es puramente decorativa -- si el
// DOM cambia antes de que termine, igual se autolimpia por su propio
// timeout y no deja nada huérfano.
function listeningShowAchievement(anchorEl) {
  const host = anchorEl && anchorEl.isConnected ? anchorEl : document.getElementById("listeningPlayContainer");
  if (!host) return;
  const badge = document.createElement("div");
  badge.className = "l0-achievement";
  badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>';
  host.style.position = host.style.position || "relative";
  host.appendChild(badge);
  setTimeout(() => badge.remove(), 900);
}

// Dictado (sin opciones): reutiliza checkDictadoAnswer() de exercises/dictado.js
// (mismo scope de módulo concatenado) para no reimplementar la lógica de
// normalización/precisión por palabra que ya usa el resto de la app. Se
// acepta como acierto lo mismo que ahí: exacto o ≥80% de palabras iguales.
function checkListeningDictadoAnswer(ex, userAnswer) {
  const session = ListeningPlaySession;
  if (session.answered) return;
  session.answered = true;

  const result = checkDictadoAnswer(ex.contenido_audio, userAnswer);
  const correct = result.passed;

  const stats = session.categoriaStats[ex.categoria] || { correct: 0, total: 0 };
  stats.total += 1;
  if (correct) { stats.correct += 1; session.correctCount += 1; }
  session.categoriaStats[ex.categoria] = stats;

  const input = document.getElementById("l0DictadoInput");
  const checkBtn = document.getElementById("l0DictadoCheckBtn");
  if (input) input.disabled = true;
  if (checkBtn) checkBtn.remove();

  const compHtml = result.comparison.map((c) => {
    if (!c.correct && !c.user) return "";
    return `<span class="${c.match ? "word-correct" : "word-error"}">${window._escHTML(c.user || "—")}</span>`;
  }).join(" ");

  const resultLine = document.getElementById("l0PlayResultLine");
  if (resultLine) {
    resultLine.innerHTML = result.isExact
      ? `${ListeningIcons.check()} ¡Perfecto!`
      : correct
        ? `${ListeningIcons.check()} ¡Aceptado! (${Math.round(result.accuracy * 100)}%)`
        : `Era "${window._escHTML(ex.contenido_audio)}" (${Math.round(result.accuracy * 100)}%)`;
  }

  const container = document.getElementById("listeningPlayContainer");
  const feedback = document.createElement("div");
  feedback.style.marginTop = "10px";
  feedback.style.display = "flex";
  feedback.style.flexWrap = "wrap";
  feedback.style.gap = "4px";
  feedback.innerHTML = compHtml;
  container.appendChild(feedback);

  if (correct) {
    listeningShowAchievement(input);
  } else {
    listeningShake(feedback);
  }
  persistListeningSessionProgress();
  appendListeningContinueButton();
}

function goToNextListeningExercise() {
  const session = ListeningPlaySession;
  if (session.index + 1 < session.exercises.length) {
    session.index += 1;
    renderCurrentListeningExercise();
  } else {
    finishListeningBlock();
  }
}

function finishListeningBlock() {
  const session = ListeningPlaySession;
  const total = session.exercises.length;
  const porcentaje = total ? Math.round((session.correctCount / total) * 1000) / 10 : 0;

  const progressFill = document.getElementById("l0PlayProgressFill");
  if (progressFill) progressFill.style.width = "100%";

  const prev = listeningBlockProgress(session.bloque);
  const isFirstTry = !prev.completed;
  ListeningState.progress[session.bloque] = {
    completed: true,
    bestScore: Math.max(prev.bestScore || 0, porcentaje),
    intentos: (prev.intentos || 0) + 1,
    // Guardado en localStorage (no depende del backend) para poder volver
    // a ver este desglose por categoría más tarde desde la pantalla de
    // Niveles, sin tener que rejugar el bloque. Se guarda el último
    // intento, que es el mismo que se acaba de mostrar aquí.
    lastPorcentaje: porcentaje,
    lastCategoriaStats: session.categoriaStats,
  };
  saveListeningProgress();

  postListeningBlockResults(session.bloque, session.categoriaStats);

  renderListeningResultScreen(session.bloque, porcentaje, session.categoriaStats, isFirstTry);
  showMainView("listeningResult");

  // Mismo umbral que el título "¡Excelente trabajo!" de la pantalla de
  // resultado: ahí sí vale la pena el confetti grande (burstConfetti, de
  // main_logic en build.py) -- por ejercicio sería demasiado, por bloque
  // completo es el momento real de celebrar.
  if (porcentaje >= 80 && typeof burstConfetti === "function") {
    burstConfetti();
  }
}

// Vuelve a mostrar el resultado de un bloque YA completado, usando lo
// guardado en localStorage (lastPorcentaje/lastCategoriaStats) -- no
// rejuega nada ni toca el contador de intentos. Se llama desde una level
// card ya marcada is-done en listening-map.js. ListeningPlaySession.bloque
// se deja apuntando a este bloque para que "Reintentar bloque" (desde esa
// misma pantalla de resultado) funcione igual que si se acabara de jugar.
function viewListeningBlockResult(bloque) {
  const prog = listeningBlockProgress(bloque);
  if (!prog.completed) return;
  ListeningPlaySession.bloque = bloque;
  ListeningPlaySession.exercises = listeningExercisesByBloque(bloque);
  const porcentaje = typeof prog.lastPorcentaje === "number" ? prog.lastPorcentaje : (prog.bestScore || 0);
  renderListeningResultScreen(bloque, porcentaje, prog.lastCategoriaStats || {}, false, true);
  showMainView("listeningResult");
}

// Anillo de progreso SVG (stroke-dasharray/offset) para el puntaje general
// del bloque. r=56 -> circunferencia ~351.86; dasharray fijo, dashoffset
// se calcula a partir del % para que se "llene" en sentido horario.
function listeningResultRingHTML(porcentaje) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, porcentaje)) / 100) * c;
  return `
    <div class="l0-result-ring-wrap">
      <div class="l0-result-ring">
        <svg viewBox="0 0 132 132">
          <circle class="l0-ring-track" cx="66" cy="66" r="${r}"></circle>
          <circle class="l0-ring-fill" cx="66" cy="66" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}" id="l0ResultRingFill"></circle>
        </svg>
        <span class="l0-result-ring-value">${porcentaje}%</span>
      </div>
    </div>
  `;
}

function renderListeningResultScreen(bloque, porcentaje, categoriaStats, isFirstTry, viewOnly) {
  const container = document.getElementById("listeningResultContainer");
  if (!container) return;

  const filas = Object.keys(categoriaStats).sort().map((categoria) => {
    const s = categoriaStats[categoria];
    const pct = s.total ? Math.round((s.correct / s.total) * 1000) / 10 : 0;
    return `
      <div class="l0-result-cat-row">
        <span class="l0-result-cat-name">${window._escHTML(categoria)}</span>
        <div class="l0-result-cat-track">
          <div class="l0-result-cat-fill" style="width:${pct}%;"></div>
        </div>
        <span class="l0-result-cat-pct">${pct}% (${s.correct}/${s.total})</span>
      </div>
    `;
  }).join("");

  // Si no hay categorías que mostrar (típico de un bloque que se completó
  // ANTES de que empezáramos a guardar el desglose por categoría en
  // localStorage), no dejamos la cuadrícula en blanco sin explicación --
  // mostramos un aviso breve en su lugar.
  const sinDesglose = viewOnly && !filas
    ? `
      <p class="sub-fun" style="text-align:center;margin:12px 0 0;opacity:.8;">
        Este resultado se guardó antes de que empezáramos a registrar el desglose por categoría.
        Vuelve a jugar este bloque para ver aquí las notas por categoría la próxima vez.
      </p>
    `
    : "";

  const titulo = porcentaje >= 80 ? "¡Excelente trabajo!" : porcentaje >= 50 ? "Bloque completado" : "Sigue practicando";
  const subtitulo = viewOnly
    ? `Bloque ${bloque} — último resultado guardado`
    : (isFirstTry ? `Bloque ${bloque} terminado` : `Bloque ${bloque} — nuevo intento`);

  container.innerHTML = `
    <div style="text-align:center;margin-bottom:4px;">
      <span class="l0-intro-icon" style="font-size:2rem;">${ListeningIcons.finish()}</span>
      <h2 style="margin:8px 0 2px;font-family:var(--font-display);color:var(--ink);">${titulo}</h2>
      <p class="sub-fun" style="margin:0;">${subtitulo}</p>
    </div>
    ${listeningResultRingHTML(porcentaje)}
    <div class="l0-result-cat-grid">
      ${filas}
    </div>
    ${sinDesglose}
  `;

  // Anima el anillo desde 0 hasta el % real en el siguiente frame (si se
  // pone el dashoffset final de una vez, nunca se ve la transición).
  requestAnimationFrame(() => {
    const ring = document.getElementById("l0ResultRingFill");
    if (!ring) return;
    const r = 56;
    const c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, porcentaje)) / 100) * c;
    ring.style.strokeDashoffset = String(offset);
  });
}
