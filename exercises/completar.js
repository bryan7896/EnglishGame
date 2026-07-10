// exercises/completar.js

export function renderCompletarExercise(exercise, container, isRetry = false) {
  const { spanishWord, englishSentence, options } = exercise;
  
  let html = englishSentence;
  let inputIndex = 0;
  
  html = html.replace(/_____/g, () => {
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
      ${options.length > 0 ? `<p style="color:#64748b;font-size:0.8rem;margin-top:8px;">Palabras: ${options.join(', ')}</p>` : ''}
    </div>
    <div class="button-group">
      <button class="btn-action btn-check completar-check">✅ Comprobar</button>
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
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    
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

export function showCompletarModal(exercise, results, onContinue, onRetry) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
  
  const { spanishWord, englishSentence } = exercise;
  const allCorrect = results.every(r => r.isCorrect);
  
  let resultsHtml = results.map((r, idx) => {
    const status = r.isCorrect ? '✅' : '❌';
    const color = r.isCorrect ? '#4ade80' : '#f87171';
    return `<div style="color:${color};margin:4px 0;">${status} Espacio ${idx+1}: "${r.userAnswer||'(vacío)'}" → "${r.correctAnswer}"</div>`;
  }).join('');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${allCorrect ? '🎉 ¡Perfecto!' : '📝 Resultados'}</h3>
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>${spanishWord}</p>
        <p><strong>🇬🇧 Frase:</strong><br>${englishSentence}</p>
        <p><strong>📊 Resultados:</strong></p>${resultsHtml}
      </div>
      <div style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      <div class="modal-buttons">
        ${!allCorrect ? '<button class="fun-btn modal-retry" style="background:#f59e0b;color:#1a120b;">🔄 Reintentar</button>' : ''}
        <button class="fun-btn primary-btn modal-continue">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const doubtInput = modal.querySelector('.modal-doubt');
  const getDuda = () => doubtInput?.value?.trim() || '';
  
  modal.querySelector('.modal-continue').addEventListener("click", () => {
    modal.remove();
    if (onContinue) onContinue(allCorrect, getDuda());
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
      if (onContinue) onContinue(allCorrect, getDuda());
    }
  });
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