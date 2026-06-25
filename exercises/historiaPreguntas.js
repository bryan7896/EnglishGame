// exercises/historiaPreguntas.js
// Ejercicio de historia corta con preguntas abiertas

export function renderHistoriaPreguntasExercise(exercise, container) {
  const { shortStory, pregunta1, pregunta2 } = exercise;
  
  container.innerHTML = `
    <div class="story-content">
      <div class="story-title">📖 Historia corta</div>
      <div class="story-paragraph">${shortStory}</div>
    </div>
    
    <div style="margin-top:16px;">
      <p style="color:#fde68a; font-weight:600; margin-bottom:8px;">📝 Responde las siguientes preguntas:</p>
      
      <div style="margin-bottom:14px;">
        <label style="color:#94a3b8; font-size:0.85rem; display:block; margin-bottom:4px;">
          1️⃣ ${pregunta1}
        </label>
        <textarea id="answerInput1" class="answer-input" rows="2" 
          placeholder="Escribe tu respuesta aquí..."></textarea>
      </div>
      
      <div style="margin-bottom:14px;">
        <label style="color:#94a3b8; font-size:0.85rem; display:block; margin-bottom:4px;">
          2️⃣ ${pregunta2}
        </label>
        <textarea id="answerInput2" class="answer-input" rows="2" 
          placeholder="Escribe tu respuesta aquí..."></textarea>
      </div>
    </div>
    
    <div class="button-group">
      <button class="btn-action btn-continue" id="submitAnswersBtn" style="flex:1; background: #4ade80; color: #064e3b; font-weight:700;">
        ✅ Enviar respuestas
      </button>
    </div>
    
    <div class="mood-card">
      <div class="mood-emoji">🤔</div>
      <div>
        <strong>Comprensión lectora</strong><br>
        <span>Lee la historia y responde las preguntas con tus propias palabras</span>
      </div>
    </div>
    
    <!-- Campo de duda opcional -->
    <div class="doubt-section" id="doubtSectionHP" style="margin-top:12px;">
      <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">
        💭 ¿Tienes alguna duda sobre este ejercicio? (opcional)
      </label>
      <textarea id="doubtInputHP" class="answer-input" rows="2" 
        placeholder="Escribe tu duda o consulta aquí..." 
        style="font-size:0.85rem; min-height:50px;"></textarea>
    </div>
  `;
  
  document.getElementById("submitAnswersBtn")?.addEventListener("click", () => {
    const answer1 = document.getElementById("answerInput1").value.trim();
    const answer2 = document.getElementById("answerInput2").value.trim();
    
    if (!answer1 || !answer2) {
      const toast = document.getElementById("toastFun");
      if (toast) {
        toast.textContent = "📝 Responde ambas preguntas";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2000);
      }
      return;
    }
    
    const doubtInput = document.getElementById("doubtInputHP");
    const duda = doubtInput ? doubtInput.value.trim() : '';
    
    const event = new CustomEvent('historia-answered', { 
      detail: { 
        answer1, 
        answer2,
        duda 
      } 
    });
    container.dispatchEvent(event);
  });
}

export function showHistoriaPreguntasModal(exercise, answers, onContinue) {
  const { shortStory, pregunta1, pregunta2 } = exercise;
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>📋 Respuestas enviadas</h3>
      <div class="comparison-text-block">
        <p><strong>📖 Historia:</strong><br>
          <span style="color:#cbd5e1; font-size:0.9rem;">${shortStory.substring(0, 150)}...</span></p>
        <hr style="border-color:#334155; margin:12px 0;">
        <p><strong>1️⃣ ${pregunta1}</strong><br>
          <span style="color:#fde68a;">${answers.answer1}</span></p>
        <p><strong>2️⃣ ${pregunta2}</strong><br>
          <span style="color:#fde68a;">${answers.answer2}</span></p>
      </div>
      <p style="color:#94a3b8; font-size:0.8rem; margin-top:8px;">
        ✅ Tus respuestas han sido registradas para el reporte final.
      </p>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("modalContinueBtn").addEventListener("click", () => {
    modal.remove();
    if (onContinue) onContinue();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onContinue) onContinue();
    }
  });
}

export function getHistoriaPreguntasReportEntry(exercise, answers, duda) {
  return {
    type: "historia_preguntas",
    story: exercise.shortStory,
    pregunta1: exercise.pregunta1,
    respuesta1: answers.answer1,
    pregunta2: exercise.pregunta2,
    respuesta2: answers.answer2,
    duda: duda || ''
  };
}