// exercises/informacion.js
//
// "Práctica inicial": lecciones especiales de refuerzo dirigido, ajenas al
// sistema de nodos y al informe de errores. Cada lección es un único scroll
// con: Introducción -> Ejercicio 1 (selección múltiple) -> Ejercicio 2
// (arrastrar/completar con reinicio total si falla algo en la pasada) ->
// Ejercicio 3 (traducir). Todo se revela progresivamente: cada paso que el
// usuario completa se colapsa (display:none) y habilita el siguiente, sin
// ocultar los encabezados generales de cada ejercicio.

// Construye la lista plana de "pasos" de una lección, en orden.
function buildSteps(leccion) {
  const steps = [{ kind: "intro" }];
  (leccion.ejercicio1?.preguntas || []).slice(0, 4).forEach((_, i) => steps.push({ kind: "ej1", idx: i }));
  if (leccion.ejercicio2) steps.push({ kind: "ej2" });
  (leccion.ejercicio3?.traducciones || []).slice(0, 3).forEach((_, i) => steps.push({ kind: "ej3", idx: i }));
  steps.push({ kind: "finalizar" });
  return steps;
}

function freshEj2State(leccion) {
  const frases = leccion.ejercicio2?.frases || [];
  return {
    banco: (leccion.ejercicio2?.banco || []).map((texto, i) => ({ id: "chip" + i, texto, used: false })),
    activeIdx: 0,
    results: frases.map(() => null), // null | 'correct' | 'wrong'
    failedThisPass: false,
    selectedChipId: null,
  };
}

// Estado por defecto de una lección (se guarda en AppState.practicaInicial).
export function freshLeccionState(leccion) {
  return {
    stepIndex: 0, // hasta qué índice de `buildSteps` está desbloqueado (inclusive)
    ej1: (leccion.ejercicio1?.preguntas || []).map(() => ({ answered: false, selectedIdx: null })),
    ej2: freshEj2State(leccion),
    ej3: (leccion.ejercicio3?.traducciones || []).map(() => ({ answered: false, userAnswer: "" })),
  };
}

function stepStatus(steps, state, i) {
  if (i < state.stepIndex) return "done";
  if (i === state.stepIndex) return "active";
  return "locked";
}

function renderEj1Question(leccion, state, qIdx, status) {
  const pregunta = leccion.ejercicio1.preguntas[qIdx];
  const answer = state.ej1[qIdx];
  const letras = "abcdef";
  const opcionesHtml = pregunta.opciones.map((op, i) => {
    const letra = letras[i] || (i + 1);
    const selected = answer.selectedIdx === i;
    let cls = "mc-option";
    let explHtml = "";
    if (answer.answered && selected) {
      cls += op.correcta ? " mc-correct" : " mc-incorrect";
      explHtml = `<div class="mc-explanation">${op.correcta ? "✅" : "❌"} ${window._escHTML(op.explicacion || "")}</div>`;
    } else if (answer.answered) {
      cls += " mc-dim";
    }
    return `
      <div class="${cls}" data-opt="${i}">
        <span class="mc-letter">${letra}</span>
        <span class="mc-text">${window._escHTML(op.texto)}</span>
      </div>
      ${explHtml}
    `;
  }).join("");

  return `
    <div class="info-step step-${status}" data-step-kind="ej1" data-step-idx="${qIdx}">
      <div class="mc-question-text">${window._escHTML(pregunta.texto)}</div>
      <div class="mc-options">${opcionesHtml}</div>
      ${answer.answered ? '<button class="fun-btn info-next-btn" data-action="ej1-next">Siguiente ▶</button>' : ''}
    </div>
  `;
}

function renderEj2(leccion, state, status) {
  const ej2 = leccion.ejercicio2;
  const s = state.ej2;
  const frases = ej2.frases || [];

  const bancoHtml = s.banco.map(chip => {
    const cls = "dnd-chip" + (chip.used ? " dnd-chip-used" : "") + (s.selectedChipId === chip.id ? " dnd-chip-selected" : "");
    return `<button type="button" class="${cls}" data-chip="${chip.id}" ${chip.used ? "disabled" : ""}>${window._escHTML(chip.texto)}</button>`;
  }).join("");

  const frasesHtml = frases.map((frase, i) => {
    const r = s.results[i];
    let blankCls = "dnd-blank";
    let blankLabel = "_____";
    let blankState = "locked";
    if (r === "correct") { blankCls += " dnd-blank-correct"; blankLabel = frase.respuesta; blankState = "done"; }
    else if (r === "wrong") { blankCls += " dnd-blank-wrong"; blankLabel = "✗"; blankState = "wrong"; }
    else if (i === s.activeIdx) { blankCls += " dnd-blank-active"; blankState = "active"; }
    const parts = frase.texto.split("___");
    const before = window._escHTML(parts[0] || "");
    const after = window._escHTML(parts[1] || "");
    return `
      <div class="dnd-frase" data-frase-idx="${i}" data-blank-state="${blankState}">
        <span class="dnd-num">${i + 1}.</span>
        <span>${before}<span class="${blankCls}" data-blank="${i}">${blankLabel}</span>${after}</span>
      </div>
    `;
  }).join("");

  const allDone = s.results.every(r => r === "correct");
  const failNotice = s.failedThisPass ? '<div class="dnd-fail-notice">↺ Fallaste una — reiniciando la ronda...</div>' : '';

  return `
    <div class="info-step step-${status}" data-step-kind="ej2">
      <div class="dnd-bank">${bancoHtml}</div>
      <div class="dnd-frases">${frasesHtml}</div>
      ${failNotice}
      ${allDone ? '<button class="fun-btn info-next-btn" data-action="ej2-next">Siguiente ▶</button>' : ''}
    </div>
  `;
}

function renderEj3Item(leccion, state, tIdx, status) {
  const item = leccion.ejercicio3.traducciones[tIdx];
  const answer = state.ej3[tIdx];
  const normalize = (s) => String(s || "").toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
  const isCorrect = answer.answered && normalize(answer.userAnswer) === normalize(item.englishWord);

  return `
    <div class="info-step step-${status}" data-step-kind="ej3" data-step-idx="${tIdx}">
      <div class="question-bubble">${window._escHTML(item.spanishWord)}</div>
      ${answer.answered ? `
        <div class="comparison-text-block" style="margin-top:10px;">
          <div class="comparison-row">
            <span class="comparison-row-label">✅ Correcto</span>
            <div class="comparison-row-text correct-highlight">${window._escHTML(item.englishWord)}</div>
          </div>
          <div class="comparison-row">
            <span class="comparison-row-label">✏️ Tu respuesta</span>
            <div class="comparison-row-text" style="${isCorrect ? '' : 'color:#fbbf24;'}">${window._escHTML(answer.userAnswer)}</div>
          </div>
        </div>
        <button class="fun-btn info-next-btn" data-action="ej3-next">Siguiente ▶</button>
      ` : `
        <textarea class="answer-input info-ej3-answer" rows="2" placeholder="Escribe tu traducción..."></textarea>
        <div class="button-group"><button class="btn-action btn-check" data-action="ej3-check">✅ Comprobar</button></div>
      `}
    </div>
  `;
}

export function renderLeccion(leccion, state) {
  const steps = buildSteps(leccion);
  const introStatus = state.stepIndex === 0 ? "active" : "done";

  let html = `
    <div class="info-lesson-header">
      <h2>💡 ${window._escHTML(leccion.titulo)}</h2>
    </div>
    <div class="info-step step-${introStatus}" data-step-kind="intro">
      <div class="info-intro-text">${window._escHTML(leccion.introduccion)}</div>
      ${state.stepIndex === 0 ? '<button class="fun-btn primary-btn info-next-btn" data-action="start">🚀 Iniciar ejercicios</button>' : ''}
    </div>
  `;

  if (leccion.ejercicio1?.preguntas?.length) {
    const groupUnlocked = steps.findIndex(s => s.kind === "ej1") <= state.stepIndex;
    html += `<div class="info-group ${groupUnlocked ? '' : 'step-locked'}"><h3>🔎 ${window._escHTML(leccion.ejercicio1.subtitulo || "Selecciona la respuesta correcta")}</h3></div>`;
    leccion.ejercicio1.preguntas.slice(0, 4).forEach((_, i) => {
      const globalIdx = steps.findIndex(s => s.kind === "ej1" && s.idx === i);
      html += renderEj1Question(leccion, state, i, stepStatus(steps, state, globalIdx));
    });
  }

  if (leccion.ejercicio2) {
    const ej2Idx = steps.findIndex(s => s.kind === "ej2");
    const groupUnlocked = ej2Idx <= state.stepIndex;
    html += `<div class="info-group ${groupUnlocked ? '' : 'step-locked'}"><h3>🧩 ${window._escHTML(leccion.ejercicio2.subtitulo || "Arrastra la palabra correcta")}</h3></div>`;
    html += renderEj2(leccion, state, stepStatus(steps, state, ej2Idx));
  }

  if (leccion.ejercicio3?.traducciones?.length) {
    const groupUnlocked = steps.findIndex(s => s.kind === "ej3") <= state.stepIndex;
    html += `<div class="info-group ${groupUnlocked ? '' : 'step-locked'}"><h3>✍️ ${window._escHTML(leccion.ejercicio3.subtitulo || "Traduce")}</h3>${leccion.ejercicio3.explicacion ? `<p class="info-ej3-tip">${window._escHTML(leccion.ejercicio3.explicacion)}</p>` : ''}</div>`;
    leccion.ejercicio3.traducciones.slice(0, 3).forEach((_, i) => {
      const globalIdx = steps.findIndex(s => s.kind === "ej3" && s.idx === i);
      html += renderEj3Item(leccion, state, i, stepStatus(steps, state, globalIdx));
    });
  }

  const finalIdx = steps.length - 1;
  const finalStatus = stepStatus(steps, state, finalIdx);
  html += `
    <div class="info-step step-${finalStatus}" data-step-kind="finalizar">
      <button class="fun-btn primary-btn full-width" data-action="finalizar">🏁 Finalizar y continuar</button>
    </div>
  `;

  return html;
}

function advanceStep(state, steps) {
  state.stepIndex = Math.min(state.stepIndex + 1, steps.length - 1);
}

export function wireLeccion(leccion, container, state, onChange, onLeccionDone) {
  const steps = buildSteps(leccion);

  container.querySelectorAll('[data-action="start"]').forEach(btn => {
    btn.onclick = () => { advanceStep(state, steps); onChange(); };
  });

  // Ejercicio 1: click en una opción -> revela SU explicación; el "Siguiente"
  // avanza sin importar si acertó.
  container.querySelectorAll('.info-step[data-step-kind="ej1"]').forEach(stepEl => {
    if (stepEl.classList.contains('step-locked') || stepEl.classList.contains('step-done')) return;
    const qIdx = parseInt(stepEl.dataset.stepIdx, 10);
    const answer = state.ej1[qIdx];
    if (!answer.answered) {
      stepEl.querySelectorAll('.mc-option').forEach(optEl => {
        optEl.onclick = () => {
          answer.answered = true;
          answer.selectedIdx = parseInt(optEl.dataset.opt, 10);
          onChange();
        };
      });
    }
    const nextBtn = stepEl.querySelector('[data-action="ej1-next"]');
    if (nextBtn) nextBtn.onclick = () => {
      const globalIdx = steps.findIndex(s => s.kind === "ej1" && s.idx === qIdx);
      state.stepIndex = Math.max(state.stepIndex, globalIdx);
      advanceStep(state, steps);
      onChange();
    };
  });

  // Ejercicio 2: tap-to-select chip + tap-to-place en el blanco activo.
  const ej2StepEl = container.querySelector('.info-step[data-step-kind="ej2"]');
  if (ej2StepEl && !ej2StepEl.classList.contains('step-locked') && !ej2StepEl.classList.contains('step-done')) {
    const s = state.ej2;
    const frases = leccion.ejercicio2.frases || [];

    ej2StepEl.querySelectorAll('.dnd-chip:not(.dnd-chip-used)').forEach(chipEl => {
      chipEl.onclick = () => {
        s.selectedChipId = (s.selectedChipId === chipEl.dataset.chip) ? null : chipEl.dataset.chip;
        onChange();
      };
    });

    const activeBlank = ej2StepEl.querySelector('.dnd-blank-active');
    if (activeBlank && s.selectedChipId) {
      activeBlank.onclick = () => {
        const chip = s.banco.find(c => c.id === s.selectedChipId);
        if (!chip) return;
        const frase = frases[s.activeIdx];
        const normalize = (t) => String(t || "").toLowerCase().trim();
        const correct = normalize(chip.texto) === normalize(frase.respuesta);
        s.results[s.activeIdx] = correct ? "correct" : "wrong";
        if (correct) chip.used = true;
        if (!correct) s.failedThisPass = true;
        s.selectedChipId = null;
        s.activeIdx++;

        if (s.activeIdx >= frases.length) {
          if (s.failedThisPass) {
            // Reinicia toda la ronda tras un breve instante para que el
            // usuario alcance a ver qué falló en rojo.
            onChange();
            setTimeout(() => {
              state.ej2 = freshEj2State(leccion);
              onChange();
            }, 1100);
            return;
          }
        }
        onChange();
      };
    } else if (activeBlank) {
      activeBlank.onclick = () => { /* sin ficha seleccionada aún */ };
    }

    const nextBtn = ej2StepEl.querySelector('[data-action="ej2-next"]');
    if (nextBtn) nextBtn.onclick = () => {
      const ej2Idx = steps.findIndex(st => st.kind === "ej2");
      state.stepIndex = Math.max(state.stepIndex, ej2Idx);
      advanceStep(state, steps);
      onChange();
    };
  }

  // Ejercicio 3: traducir con comprobación simple inline (sin modal).
  container.querySelectorAll('.info-step[data-step-kind="ej3"]').forEach(stepEl => {
    if (stepEl.classList.contains('step-locked') || stepEl.classList.contains('step-done')) return;
    const tIdx = parseInt(stepEl.dataset.stepIdx, 10);
    const answer = state.ej3[tIdx];
    const checkBtn = stepEl.querySelector('[data-action="ej3-check"]');
    const textarea = stepEl.querySelector('.info-ej3-answer');
    if (checkBtn && textarea) {
      checkBtn.onclick = () => {
        const val = textarea.value.trim();
        if (!val) return;
        answer.answered = true;
        answer.userAnswer = val;
        onChange();
      };
    }
    const nextBtn = stepEl.querySelector('[data-action="ej3-next"]');
    if (nextBtn) nextBtn.onclick = () => {
      const globalIdx = steps.findIndex(st => st.kind === "ej3" && st.idx === tIdx);
      state.stepIndex = Math.max(state.stepIndex, globalIdx);
      advanceStep(state, steps);
      onChange();
    };
  });

  const finalBtn = container.querySelector('[data-action="finalizar"]');
  if (finalBtn && !finalBtn.closest('.step-locked')) {
    finalBtn.onclick = () => onLeccionDone();
  }
}