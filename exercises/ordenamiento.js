// exercises/ordenamiento.js
// ---------------------------------------------------------------------
// "Juego de ordenamiento": arrastrar palabras sueltas hasta armar la
// traducción correcta. Se genera automáticamente a partir de un ejercicio
// de traducción (misma frase español/inglés) — ver rlExpandirTraducciones
// en reels/reels-core.js, que mete 3 tarjetas de este tipo justo antes de
// cada tarjeta de traducción.
// ---------------------------------------------------------------------

// Limpia un texto en el idioma objetivo y lo separa en palabras sueltas,
// todas en minúscula y sin signos de puntuación en los bordes (sin punto
// final, sin mayúscula inicial), conservando apóstrofos internos
// ("she's", "don't").
export function tokenizeOrdenamiento(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/^[¿¡"'“‘(]+/, "").replace(/[.,!?;:"”’)]+$/, "").toLowerCase())
    .filter(Boolean);
}

// A partir de un ejercicio de traducción construye uno de ordenamiento con
// la misma frase. Frases de menos de 3 palabras no se arman (no tiene
// sentido "ordenar" 1-2 fichas), así que devuelve null en ese caso.
export function buildOrdenamientoFromTraduccion(traduccionEx) {
  if (!traduccionEx) return null;
  const spanish = traduccionEx.spanishWord || traduccionEx.spanishWords || "";
  const english = traduccionEx.englishWord || traduccionEx.englishWords || "";
  const tokens = tokenizeOrdenamiento(english);
  if (tokens.length < 3) return null;
  return {
    type: "ordenamiento",
    spanishWord: spanish,
    englishWord: tokens.join(" "),
    reglaIds: Array.isArray(traduccionEx.reglaIds) ? traduccionEx.reglaIds.slice() : [],
  };
}

function speakOrdenamientoText(text, rate) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getTargetLangMeta().ttsLang;
    utterance.rate = rate || 0.95;
    applyPreferredVoice(utterance, getTargetLangMeta().code);
    window.speechSynthesis.speak(utterance);
  }, 50);
}

// Renderiza el ejercicio dentro de `container` y conecta el arrastre.
// Cuando el usuario termina (acierta o presiona "Me rindo" y luego
// "Continuar") dispara un evento "ordenamiento-done" en `container` con
// detail: { passed }. Devuelve una función de limpieza (por si la tarjeta
// se cierra a mitad de un arrastre).
export function renderOrdenamientoExercise(exercise, container) {
  const spanish = exercise.spanishWord || exercise.spanishWords || "";
  const tokens = tokenizeOrdenamiento(exercise.englishWord || exercise.englishWords || "");
  const idsCorrectos = tokens.map((_, i) => i);

  let order = shuffleArray(idsCorrectos.slice());
  if (idsCorrectos.length > 1) {
    let intentos = 0;
    while (order.every((v, i) => v === idsCorrectos[i]) && intentos < 10) {
      order = shuffleArray(idsCorrectos.slice());
      intentos++;
    }
  }

  container.innerHTML = `
    <div class="question-bubble">Organiza la traducción de:<br><strong>${window._escHTML(spanish)}</strong></div>
    <div class="ord-row"></div>
    <div class="button-group"><button type="button" class="btn-action btn-check ord-giveup">Me rindo</button></div>
  `;
  const rowEl = container.querySelector(".ord-row");
  const giveupBtn = container.querySelector(".ord-giveup");

  let solved = false;
  let dragId = null;
  let ghost = null;
  let draggingEl = null;
  let offX = 0, offY = 0;

  function pintarFila() {
    rowEl.innerHTML = order
      .map((id) => `<button type="button" class="ord-pill" data-id="${id}">${window._escHTML(tokens[id])}</button>`)
      .join("");
    rowEl.querySelectorAll(".ord-pill").forEach((pill) => pill.addEventListener("pointerdown", onPointerDown));
  }

  function moverGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = (x - offX) + "px";
    ghost.style.top = (y - offY) + "px";
  }

  function pillsActuales() {
    return Array.from(rowEl.querySelectorAll(".ord-pill:not(.ord-pill-dragging):not(.ord-pill-fade-clone)"));
  }

  // Decide en qué hueco (0..N) caería la ficha soltada en (x,y), según qué
  // ficha está más cerca y si el cursor está en su mitad izquierda o derecha.
  function calcularIndiceInsercion(x, y, pills) {
    if (!pills.length) return 0;
    let mejorIdx = 0, mejorDist = Infinity, lado = 0;
    pills.forEach((p, idx) => {
      const r = p.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      const dist = dx * dx + dy * dy * 4; // más peso al eje Y: no saltar de fila
      if (dist < mejorDist) { mejorDist = dist; mejorIdx = idx; lado = x < cx ? 0 : 1; }
    });
    return mejorIdx + lado;
  }

  function marcarHover(x, y) {
    const pills = pillsActuales();
    pills.forEach((p) => p.classList.remove("ord-hover"));
    if (!pills.length) return;
    const idx = calcularIndiceInsercion(x, y, pills);
    if (pills[idx - 1]) pills[idx - 1].classList.add("ord-hover");
    if (pills[idx]) pills[idx].classList.add("ord-hover");
  }

  function limpiarHover() { pillsActuales().forEach((p) => p.classList.remove("ord-hover")); }

  function onPointerMove(e) {
    if (dragId === null) return;
    moverGhost(e.clientX, e.clientY);
    marcarHover(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (dragId === null) return;
    const pills = pillsActuales();
    const idx = calcularIndiceInsercion(e.clientX, e.clientY, pills);

    const draggedWord = tokens[dragId];
    const originalRect = draggingEl ? draggingEl.getBoundingClientRect() : null;
    const rowRect = rowEl.getBoundingClientRect();

    const orderWithoutDragged = order.filter((x) => x !== dragId);
    const clampedIdx = Math.max(0, Math.min(orderWithoutDragged.length, idx));
    orderWithoutDragged.splice(clampedIdx, 0, dragId);
    order = orderWithoutDragged;

    terminarDrag();
    pintarFila();

    if (originalRect) {
      const fadeClone = document.createElement("div");
      fadeClone.className = "ord-pill ord-pill-fade-clone";
      fadeClone.textContent = draggedWord;
      fadeClone.style.left = (originalRect.left - rowRect.left) + "px";
      fadeClone.style.top = (originalRect.top - rowRect.top) + "px";
      fadeClone.style.width = originalRect.width + "px";
      fadeClone.style.height = originalRect.height + "px";
      rowEl.appendChild(fadeClone);
      requestAnimationFrame(() => fadeClone.classList.add("ord-pill-fade-out"));
      setTimeout(() => fadeClone.remove(), 1050);
    }

    if (order.length === idsCorrectos.length && order.every((v, i) => v === idsCorrectos[i])) resolver(true);
  }

  function terminarDrag() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    if (ghost) { ghost.remove(); ghost = null; }
    if (draggingEl) { draggingEl.classList.remove("ord-pill-dragging"); draggingEl = null; }
    limpiarHover();
    dragId = null;
  }

  function onPointerDown(e) {
    if (solved || dragId !== null) return;
    const pill = e.currentTarget;
    const id = parseInt(pill.dataset.id, 10);
    e.preventDefault();
    const r = pill.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    dragId = id;
    draggingEl = pill;
    pill.classList.add("ord-pill-dragging"); // se vuelve transparente, pero sigue ocupando su lugar
    speakOrdenamientoText(tokens[id]);
    ghost = document.createElement("div");
    ghost.className = "ord-pill ord-ghost";
    ghost.style.width = r.width + "px";
    ghost.style.height = r.height + "px";
    ghost.textContent = tokens[id];
    document.body.appendChild(ghost);
    moverGhost(e.clientX, e.clientY);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }

  function resolver(porSuCuenta) {
    solved = true;
    rowEl.innerHTML = `<div class="ord-row-solved">${window._escHTML(tokens.join(" "))}</div>`;
    speakOrdenamientoText(tokens.join(" "), 0.85);
    giveupBtn.textContent = "Continuar";
    giveupBtn.dataset.solvedBySelf = porSuCuenta ? "1" : "0";
  }

  giveupBtn.addEventListener("click", () => {
    if (!solved) {
      terminarDrag();
      order = idsCorrectos.slice();
      resolver(false);
      return;
    }
    const passed = giveupBtn.dataset.solvedBySelf === "1";
    container.dispatchEvent(new CustomEvent("ordenamiento-done", { detail: { passed }, bubbles: true }));
  });

  pintarFila();

  return function limpiar() { terminarDrag(); };
}

export function getOrdenamientoReportEntry(exercise, solvedByUser) {
  return {
    type: "ordenamiento",
    original: exercise.spanishWord,
    expected: exercise.englishWord,
    userAnswer: solvedByUser ? exercise.englishWord : "(usó \"Me rindo\")",
    duda: "",
  };
}
