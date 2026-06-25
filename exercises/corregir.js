// exercises/corregir.js
// Ejercicio de corregir frase con error

export function renderCorregirExercise(exercise, container, isRetry = false) {
  const { fraseConError, fraseCorrecta } = exercise;
  
  container.innerHTML = `
    ${isRetry ? '<div class="correction-notice">⚠️ Corrección: intenta escribir la frase correcta</div>' : ''}
    <div class="question-bubble">
      <span style="font-size:0.85rem; color:#94a3b8; display:block; margin-bottom:6px;">🔍 Encuentra el error y corrige la frase:</span>
      <span style="color:#f87171; text-decoration:line-through; text-decoration-color:#f87171; margin-right:8px;">${fraseConError}</span>
    </div>
    <div class="input-area">
      <p style="color:#94a3b8; margin-bottom:8px;">✏️ Escribe la frase corregida:</p>
      <textarea id="answerInput" class="answer-input" rows="2" placeholder="Escribe la frase correcta aquí..."></textarea>
    </div>
    <div class="button-group">
      <button class="btn-action btn-check" id="checkBtn">✅ Comprobar</button>
      <button class="btn-action btn-continue" id="continueBtn" style="display: none;">➡️ Continuar</button>
    </div>
    <div class="mood-card">
      <div class="mood-emoji" id="exerciseEmoji">🔍</div>
      <div>
        <strong id="exerciseMoodTitle">Corrige la frase</strong><br>
        <span id="exerciseMoodText">Encuentra el error y escribe la versión correcta</span>
      </div>
    </div>
    <!-- Campo de duda opcional -->
    <div class="doubt-section" id="doubtSection" style="margin-top:12px; display:none;">
      <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">
        💭 ¿Tienes alguna duda sobre este ejercicio? (opcional)
      </label>
      <textarea id="doubtInput" class="answer-input" rows="2" 
        placeholder="Escribe tu duda o consulta aquí..." 
        style="font-size:0.85rem; min-height:50px;"></textarea>
    </div>
  `;
  
  // Eventos
  document.getElementById("checkBtn")?.addEventListener("click", () => {
    const userAnswer = document.getElementById("answerInput").value.trim();
    if (!userAnswer) {
      // Mostrar toast
      const toast = document.getElementById("toastFun");
      if (toast) {
        toast.textContent = "📝 Escribe una respuesta";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
      }
      return;
    }
    
    // Mostrar sección de duda después de comprobar
    const doubtSection = document.getElementById("doubtSection");
    if (doubtSection) doubtSection.style.display = "block";
    
    const container = document.getElementById("exerciseContainer");
    const event = new CustomEvent('corregir-checked', { 
      detail: { userAnswer, exercise } 
    });
    container.dispatchEvent(event);
  });
  
  document.getElementById("continueBtn")?.addEventListener("click", () => {
    const container = document.getElementById("exerciseContainer");
    const doubtInput = document.getElementById("doubtInput");
    const duda = doubtInput ? doubtInput.value.trim() : '';
    const event = new CustomEvent('corregir-continue', { detail: { duda } });
    container.dispatchEvent(event);
  });
  
  document.getElementById("answerInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("checkBtn")?.click();
    }
  });
}

export function checkCorregirAnswer(exercise, userAnswer) {
  const correctAnswer = exercise.fraseCorrecta.trim();
  const userClean = userAnswer.trim();
  
  // Comparar normalizando espacios y puntuación
  const normalize = (str) => str.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]/g, '')
    .trim();
  
  const isCorrect = normalize(userClean) === normalize(correctAnswer);
  
  // Encontrar diferencias palabra por palabra
  const correctWords = correctAnswer.split(/\s+/);
  const userWords = userClean.split(/\s+/);
  const maxLen = Math.max(correctWords.length, userWords.length);
  
  const comparison = [];
  for (let i = 0; i < maxLen; i++) {
    const cw = correctWords[i] || '';
    const uw = userWords[i] || '';
    const cwClean = normalize(cw);
    const uwClean = normalize(uw);
    
    comparison.push({
      correct: cw,
      user: uw,
      match: cwClean === uwClean && cwClean !== ''
    });
  }
  
  return { isCorrect, comparison };
}

export function showCorregirModal(exercise, result, userAnswer, onContinue, onRetry) {
  const { fraseConError, fraseCorrecta } = exercise;
  const { isCorrect, comparison } = result;
  
  // Construir visualización de comparación
  let comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const correctClass = c.match ? 'word-correct' : 'word-error';
    const userClass = c.match ? 'word-correct' : 'word-error';
    return `
      <div style="display:inline-flex; flex-direction:column; align-items:center; margin:2px 4px;">
        <span class="${userClass}" style="font-size:0.85rem;">${c.user || '—'}</span>
        ${!c.match ? `<span class="${correctClass}" style="font-size:0.75rem; opacity:0.8;">${c.correct || '—'}</span>` : ''}
      </div>
    `;
  }).join('');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${isCorrect ? '🎉 ¡Correcto!' : '📝 Revisa la diferencia'}</h3>
      <div class="comparison-text-block">
        <p><strong>❌ Frase con error:</strong><br>
          <span style="color:#f87171; text-decoration:line-through;">${fraseConError}</span></p>
        <p><strong>✅ Frase correcta:</strong><br>
          <span style="color:#4ade80;">${fraseCorrecta}</span></p>
        <p><strong>✏️ Tu respuesta:</strong><br>
          <span style="color:${isCorrect ? '#4ade80' : '#fbbf24'};">${userAnswer}</span></p>
        <div class="compare-line" style="margin-top:12px;">
          <strong>🔍 Comparación:</strong>
          <div style="display:flex; flex-wrap:wrap; align-items:flex-end; gap:2px; margin-top:6px;">
            ${comparisonHtml}
          </div>
        </div>
        <div style="margin-top:12px; color:#fbbf24; font-size:0.8rem;">
          💡 <strong>Diferencia:</strong> Las palabras en <span style="color:#f87171;">rojo</span> son incorrectas, 
          las palabras en <span style="color:#4ade80;">verde</span> son correctas.
        </div>
      </div>
      <div class="modal-buttons">
        ${!isCorrect ? `<button class="fun-btn" id="modalRetryBtn" style="background:#f59e0b; color:#1a120b;">🔄 Reintentar</button>` : ''}
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("modalContinueBtn").addEventListener("click", () => {
    modal.remove();
    if (onContinue) onContinue();
  });
  
  if (!isCorrect) {
    document.getElementById("modalRetryBtn").addEventListener("click", () => {
      modal.remove();
      if (onRetry) onRetry();
    });
  }
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onContinue) onContinue();
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