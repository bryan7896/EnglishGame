// exercises/completar.js
// NOTA: normalizeWord se importa desde traduccion.js en el build

export function renderCompletarExercise(exercise, container, isRetry = false) {
  const { spanishWord, englishSentence, options } = exercise;
  
  let html = englishSentence;
  let inputIndex = 0;
  
  html = html.replace(/_____/g, () => {
    const input = `<input type="text" class="completar-input" data-index="${inputIndex}" placeholder="${options[inputIndex]?.charAt(0) || ''}..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
    inputIndex++;
    return input;
  });
  
  container.innerHTML = `
    ${isRetry ? '<div class="correction-notice">⚠️ Corrección: intenta de nuevo las palabras incorrectas</div>' : ''}
    <div class="question-bubble">${spanishWord}</div>
    <div class="input-area">
      <div class="completar-sentence">${html}</div>
    </div>
    <div class="button-group">
      <button class="btn-action btn-check" id="checkBtn">✅ Comprobar</button>
      <button class="btn-action btn-continue" id="continueBtn" style="display: none;">➡️ Continuar</button>
    </div>
    <div class="mood-card">
      <div class="mood-emoji" id="exerciseEmoji">✏️</div>
      <div>
        <strong id="exerciseMoodTitle">Completa las palabras</strong><br>
        <span id="exerciseMoodText">Escribe la palabra correcta en cada espacio</span>
      </div>
    </div>
  `;
  
  const inputs = container.querySelectorAll('.completar-input');
  inputs.forEach((input, idx) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        } else {
          document.getElementById('checkBtn')?.click();
        }
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
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
    results.push({
      index: idx,
      userAnswer,
      correctAnswer,
      isCorrect
    });
    
    if (isCorrect) {
      input.classList.add('correct');
      input.classList.remove('incorrect');
      input.style.backgroundColor = 'rgba(74,222,128,0.1)';
      input.readOnly = true;
    } else {
      input.classList.add('incorrect');
      input.classList.remove('correct');
      input.style.backgroundColor = 'rgba(248,113,113,0.1)';
      allCorrect = false;
    }
  });
  
  return { allCorrect, userAnswers, results };
}

export function showCompletarModal(exercise, results, onContinue, onRetry) {
  const { spanishWord, englishSentence, options } = exercise;
  
  let resultsHtml = results.map((r, idx) => {
    const status = r.isCorrect ? '✅' : '❌';
    const color = r.isCorrect ? '#4ade80' : '#f87171';
    return `<div style="color:${color}; margin:4px 0;">
      ${status} Espacio ${idx + 1}: Escribiste "${r.userAnswer || '(vacío)'}" | Correcto: "${r.correctAnswer}"
    </div>`;
  }).join('');
  
  const allCorrect = results.every(r => r.isCorrect);
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${allCorrect ? '🎉 ¡Perfecto!' : '📝 Resultados'}</h3>
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>${spanishWord}</p>
        <p><strong>🇬🇧 Frase:</strong><br>${englishSentence}</p>
        <p><strong>📊 Resultados:</strong></p>
        ${resultsHtml}
      </div>
      <div class="modal-buttons">
        ${!allCorrect ? `<button class="fun-btn" id="modalRetryBtn" style="background:#f59e0b; color:#1a120b;">🔄 Reintentar</button>` : ''}
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("modalContinueBtn").addEventListener("click", () => {
    modal.remove();
    if (onContinue) onContinue(allCorrect);
  });
  
  if (!allCorrect) {
    document.getElementById("modalRetryBtn").addEventListener("click", () => {
      modal.remove();
      if (onRetry) onRetry();
    });
  }
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onContinue) onContinue(allCorrect);
    }
  });
}

export function getCompletarReportEntry(exercise, userAnswers) {
  return {
    type: "completar",
    original: exercise.spanishWord,
    expected: exercise.englishSentence,
    options: exercise.options,
    userAnswers: userAnswers
  };
}