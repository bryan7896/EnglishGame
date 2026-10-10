// exercises/completar.js

export function renderCompletarExercise(exercise, container, isRetry = false) {
  const { spanishWord, englishSentence, options } = exercise;
  
  let html = englishSentence;
  let inputIndex = 0;
  
  html = html.replace(/___/g, () => {
    const input = `<input type="text" class="completar-input" data-idx="${inputIndex}" placeholder="?" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
    inputIndex++;
    return input;
  });
  
  container.innerHTML = `
    ${isRetry ? '<div class="correction-notice">⚠️ Corrección: intenta de nuevo</div>' : ''}
    <div class="question-bubble">${spanishWord}</div>
    <div class="input-area">
      <p style="color:#94a3b8;margin-bottom:12px;">Completa la frase:</p>
      <div class="completar-sentence">${html}</div>
    </div>
    <div class="button-group">
      <button class="btn-action btn-check completar-check">Comprobar</button>
    </div>
  `;
  
  const inputs = container.querySelectorAll('.completar-input');
  inputs.forEach((input, idx) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else container.querySelector('.completar-check')?.click();
      }
    });
  });
}

export function checkCompletarAnswers(exercise, container) {
  const { options } = exercise;
  const inputs = container.querySelectorAll('.completar-input');
  let allCorrect = true;
  const userAnswers = [];
  const results = [];
  
  inputs.forEach((input, idx) => {
    const userAnswer = input.value.trim();
    const correctAnswer = options[idx] || '';
    const isCorrect = contractionAwareEquals(userAnswer, correctAnswer);
    
    userAnswers.push(userAnswer);
    results.push({ index: idx, userAnswer, correctAnswer, isCorrect });
    
    if (isCorrect) {
      input.style.backgroundColor = 'rgba(74,222,128,0.1)';
      input.style.borderColor = '#4ade80';
      input.readOnly = true;
    } else {
      input.style.backgroundColor = 'rgba(248,113,113,0.1)';
      input.style.borderColor = '#f87171';
      allCorrect = false;
    }
  });
  
  return { allCorrect, userAnswers, results };
}

// Rellena los huecos "___" de la frase con las respuestas del usuario (o con
// las correctas si se le pasa exercise.options). Se usa para el informe y
// para la entrada manual cuando el usuario elige [Repasar].
export function fillCompletarBlanks(sentence, answers) {
  let i = 0;
  return String(sentence || '').replace(/___/g, () => {
    const a = (answers && answers[i] !== undefined && String(answers[i]).trim() !== '') ? answers[i] : '___';
    i++;
    return a;
  });
}

// Mismo criterio que traducción: se aprueba con 100% o con una precisión
// (huecos correctos / huecos totales) de al menos 80%.
export function isCompletarPassed(results) {
  if (!results.length) return true;
  const ok = results.filter(r => r.isCorrect).length;
  return ok === results.length || (ok / results.length) >= 0.8;
}

// onContinue(duda, passed, decision)
//   decision: null (solo continuar) | "repasar" (final del nodo) | "luego" (sección de repaso)
// Igual que showComparativeModal de traducción: ya no hay botón "Reintentar".
export function showCompletarModal(exercise, results, onContinue) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();

  const { spanishWord, englishSentence } = exercise;
  const allCorrect = results.every(r => r.isCorrect);
  const passed = isCompletarPassed(results);
  const okCount = results.filter(r => r.isCorrect).length;
  const accuracyPct = results.length ? Math.round((okCount / results.length) * 100) : 100;

  let resultsHtml = results.map((r, idx) => {
    const status = r.isCorrect ? '✅' : '❌';
    const color = r.isCorrect ? '#4ade80' : '#f87171';
    return `<div style="color:${color};margin:4px 0;">${status} Espacio ${idx+1}: "${window._escHTML(r.userAnswer) || '(vacío)'}" → "${window._escHTML(r.correctAnswer)}"</div>`;
  }).join('');

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${allCorrect ? '🎉 ¡Perfecto!' : passed ? '✅ ¡Aceptado!' : '📝 Resultados'}</h3>
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>${window._escHTML(spanishWord)}</p>
        <p><strong>${getTargetLangMeta().flag} Frase:</strong><br>${window._escHTML(englishSentence)}</p>
        <p><strong>📊 Resultados:</strong></p>${resultsHtml}
        <div class="comparison-row">
          <span class="comparison-row-label">🎯 Precisión (mínimo 80% para aprobar)</span>
          <div class="word-diff-wrap">
            <span class="word-pill ${passed ? 'word-correct' : 'word-error'}">${accuracyPct}% · ${okCount}/${results.length} espacios</span>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      ${reviewButtonsHTML()}
      <div class="modal-buttons">
        <button class="fun-btn primary-btn modal-continue">Continuar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // decision: undefined (solo continuar) | "repasar" | "luego"
  const close = (decision) => {
    const duda = modal.querySelector('.modal-doubt')?.value?.trim() || '';
    modal.remove();
    if (onContinue) onContinue(duda, passed, decision || null);
  };

  modal.querySelector('.modal-continue').addEventListener("click", () => close());
  wireReviewButtons(modal, close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
}

export function getCompletarReportEntry(exercise, userAnswers, duda) {
  return {
    type: "completar",
    original: exercise.spanishWord,
    expected: exercise.englishSentence,
    options: exercise.options,
    userAnswers: userAnswers,
    duda: duda || ''
  };
}