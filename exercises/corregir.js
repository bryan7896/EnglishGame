// exercises/corregir.js

export function renderCorregirExercise(exercise, container, isRetry = false) {
  const { fraseConError } = exercise;
  
  container.innerHTML = `
    ${isRetry ? '<div class="correction-notice">⚠️ Corrección: intenta de nuevo</div>' : ''}
    <div class="question-bubble">
      <span style="font-size:0.85rem;color:#94a3b8;">🔍 Corrige la frase:</span><br>
      <span style="color:#f87171;text-decoration:line-through;">${fraseConError}</span>
    </div>
    <textarea class="answer-input corregir-answer" rows="2" placeholder="Escribe la frase corregida..."></textarea>
    <div class="button-group">
      <button class="btn-action btn-check corregir-check">✅ Comprobar</button>
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
  
  const { fraseConError, fraseCorrecta } = exercise;
  const { isCorrect, comparison } = result;
  
  let comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const cls = c.match ? 'word-correct' : 'word-error';
    return `<span class="${cls}" style="font-size:0.85rem;">${window._escHTML(c.user || '—')}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${isCorrect ? '🎉 ¡Correcto!' : '📝 Revisa'}</h3>
      <div class="comparison-text-block">
        <p><strong>❌ Frase error:</strong><br><span style="color:#f87171;text-decoration:line-through;">${fraseConError}</span></p>
        <p><strong>✅ Correcta:</strong><br><span style="color:#4ade80;">${fraseCorrecta}</span></p>
        <p><strong>✏️ Tu respuesta:</strong><br><span style="color:${isCorrect?'#4ade80':'#fbbf24'};">${window._escHTML(userAnswer)}</span></p>
        <div style="margin-top:12px;"><strong>🔍 Comparación:</strong> ${comparisonHtml}</div>
      </div>
      <div style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      <div class="modal-buttons">
        ${!isCorrect ? '<button class="fun-btn modal-retry" style="background:#f59e0b;color:#1a120b;">🔄 Reintentar</button>' : ''}
        <button class="fun-btn primary-btn modal-continue">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const getDuda = () => modal.querySelector('.modal-doubt')?.value?.trim() || '';
  
  modal.querySelector('.modal-continue').addEventListener("click", () => {
    modal.remove();
    if (onContinue) onContinue(getDuda());
  });
  
  const retryBtn = modal.querySelector('.modal-retry');
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
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
    userAnswer: userAnswer,
    duda: duda || ''
  };
}