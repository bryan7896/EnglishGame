// exercises/corregir.js

export function renderCorregirExercise(exercise, container, isRetry = false) {
  const { fraseConError, spanishPhrase } = exercise;
  
  container.innerHTML = `
    <div class="corregir-card">
      ${isRetry ? '<div class="corregir-correction-notice">⚠️ Corrección: intenta de nuevo</div>' : ''}
      
      ${spanishPhrase ? `
        <div class="corregir-spanish-section">
          <div class="corregir-eyebrow">🇪🇸 Frase en español</div>
          <div class="corregir-spanish-text">${window._escHTML(spanishPhrase)}</div>
        </div>
      ` : ''}
      
      <div class="corregir-error-section">
        <div class="corregir-eyebrow">🔍 Encuentra el error y corrige la frase en inglés</div>
        <div class="error-highlight">${window._escHTML(fraseConError)}</div>
      </div>
      
      <textarea class="answer-input corregir-answer" rows="2" placeholder="Escribe la frase corregida en inglés..."></textarea>
      <div class="button-group">
        <button class="btn-action btn-check corregir-check">✅ Comprobar</button>
      </div>
    </div>
  `;
}

export function checkCorregirAnswer(exercise, userAnswer) {
  const correctAnswer = exercise.fraseCorrecta.trim();
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '').trim();

  const isCorrect = normalize(userAnswer) === normalize(correctAnswer);

  const correctWords = correctAnswer.split(/\s+/);
  const userWords = userAnswer.split(/\s+/);
  const maxLen = Math.max(correctWords.length, userWords.length);
  const comparison = [];

  for (let i = 0; i < maxLen; i++) {
    const cw = correctWords[i] || '';
    const uw = userWords[i] || '';
    comparison.push({ correct: cw, user: uw, match: normalize(cw) === normalize(uw) && cw !== '' });
  }

  return { isCorrect, comparison };
}

export function showCorregirModal(exercise, result, userAnswer, onContinue, onRetry) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();

  const { fraseConError, fraseCorrecta, spanishPhrase } = exercise;
  const { isCorrect, comparison } = result;

  const comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const cls = c.match ? 'word-correct' : 'word-error';
    const icon = c.match ? '✓' : '✗';
    return `<span class="word-pill ${cls}">${icon} ${window._escHTML(c.user || '—')}</span>`;
  }).join('');

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${isCorrect ? '🎉 ¡Correcto!' : '📝 Revisa la corrección'}</h3>
      <div class="comparison-text-block">
        
        ${spanishPhrase ? `
          <div class="comparison-row">
            <span class="comparison-row-label">🇪🇸 Frase en español</span>
            <div class="comparison-row-text spanish-reference">${window._escHTML(spanishPhrase)}</div>
          </div>
        ` : ''}
        
        <div class="comparison-row">
          <span class="comparison-row-label">❌ Frase con error</span>
          <div class="comparison-row-text error-highlight">${window._escHTML(fraseConError)}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">✅ Frase correcta</span>
          <div class="comparison-row-text correct-highlight">${window._escHTML(fraseCorrecta)}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">✏️ Tu respuesta</span>
          <div class="comparison-row-text ${isCorrect ? 'correct-highlight' : ''}" style="${isCorrect ? '' : 'color:#fbbf24;'}">${window._escHTML(userAnswer) || '(vacío)'}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">🔍 Comparación palabra a palabra</span>
          <div class="word-diff-wrap">${comparisonHtml || '—'}</div>
        </div>
      </div>
      <div class="modal-doubt-wrap">
        <label class="modal-doubt-label">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..."></textarea>
      </div>
      <div class="modal-buttons">
        ${!isCorrect ? '<button class="fun-btn modal-retry" style="background:#f59e0b;color:#1a120b;">🔄 Reintentar</button>' : ''}
        <button class="fun-btn primary-btn modal-continue">▶️ Continuar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const getDuda = () => modal.querySelector('.modal-doubt')?.value?.trim() || '';

  modal.querySelector('.modal-continue').addEventListener("click", (e) => {
    e.stopPropagation();
    modal.remove();
    if (onContinue) onContinue(getDuda());
  });

  const retryBtn = modal.querySelector('.modal-retry');
  if (retryBtn) {
    retryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      modal.remove();
      if (onRetry) onRetry(getDuda());
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onContinue) onContinue(getDuda());
    }
  });
}

export function getCorregirReportEntry(exercise, userAnswer, duda) {
  return {
    type: "corregir",
    original: exercise.fraseConError,
    expected: exercise.fraseCorrecta,
    spanishPhrase: exercise.spanishPhrase || '',
    userAnswer: userAnswer,
    duda: duda || ''
  };
}