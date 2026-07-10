// exercises/dictado.js
// Ejercicio de dictado: escuchar y escribir

const VOICES = [
  { name: "Google US English", lang: "en-US", rate: 0.75 },
  { name: "Google UK English Female", lang: "en-GB", rate: 0.75 },
  { name: "Google UK English Male", lang: "en-GB", rate: 0.75 },
  { name: "Samantha", lang: "en-US", rate: 0.8 },
  { name: "Daniel", lang: "en-GB", rate: 0.75 },
  { name: "Karen", lang: "en-AU", rate: 0.75 },
  { name: "Moira", lang: "en-IE", rate: 0.75 },
  { name: "Fiona", lang: "en-US", rate: 0.78 },
];

function getRandomVoice() {
  return VOICES[Math.floor(Math.random() * VOICES.length)];
}

function speakDictado(text, onEnd) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voiceConfig = getRandomVoice();
  
  utterance.lang = voiceConfig.lang;
  utterance.rate = voiceConfig.rate;
  utterance.pitch = 1;
  
  // Intentar encontrar una voz específica
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const matchingVoices = voices.filter(v => v.lang.startsWith('en'));
    if (matchingVoices.length > 0) {
      utterance.voice = matchingVoices[Math.floor(Math.random() * matchingVoices.length)];
    }
  }
  
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function renderDictadoExercise(exercise, container) {
  const text = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  
  container.innerHTML = `
    <div class="dictado-container">
      <div class="dictado-header">
        <p style="color:#94a3b8; margin-bottom:12px;">🎧 Escucha el audio y escribe lo que escuchas:</p>
        <button class="dictado-play-btn" id="dictadoPlayBtn">
          <span class="dictado-play-icon">🔊</span>
          Reproducir audio
        </button>
        <p style="color:#64748b; font-size:0.75rem; margin-top:6px;">Puedes reproducir el audio las veces que necesites</p>
      </div>
      
      <div class="input-area" style="margin-top:16px;">
        <textarea id="dictadoInput" class="answer-input" rows="3" 
          placeholder="Escribe aquí lo que escuchaste..." 
          style="font-size:1rem;"></textarea>
      </div>
      
      <div class="button-group" style="margin-top:16px;">
        <button class="btn-action btn-check" id="checkDictadoBtn">✅ Comprobar</button>
      </div>
      
      <div class="mood-card" style="margin-top:12px;">
        <div class="mood-emoji">🎧</div>
        <div>
          <strong>Dictado</strong><br>
          <span>Escucha atentamente y escribe la frase</span>
        </div>
      </div>
    </div>
  `;
  
  // Reproducir automáticamente al cargar
  setTimeout(() => speakDictado(text), 500);
  
  // Botón de play
  document.getElementById("dictadoPlayBtn")?.addEventListener("click", () => {
    speakDictado(text);
  });
  
  // Enter para comprobar
  document.getElementById("dictadoInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("checkDictadoBtn")?.click();
    }
  });
}

export function checkDictadoAnswer(exercise, userAnswer) {
  const correctText = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  
  const normalize = (str) => str.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"]/g, '')
    .trim();
  
  const isExact = normalize(userAnswer) === normalize(correctText);
  
  // Calcular precisión por palabras
  const correctWords = correctText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  const userWords = userAnswer.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  
  let matchedWords = 0;
  const maxLen = Math.max(correctWords.length, userWords.length);
  const comparison = [];
  
  for (let i = 0; i < maxLen; i++) {
    const cw = correctWords[i] || '';
    const uw = userWords[i] || '';
    const match = cw === uw && cw !== '';
    if (match) matchedWords++;
    comparison.push({ correct: cw, user: uw, match });
  }
  
  const accuracy = correctWords.length > 0 ? matchedWords / correctWords.length : 0;
  
  return { isExact, accuracy, matchedWords, totalWords: correctWords.length, comparison };
}

export function showDictadoModal(exercise, result, userAnswer, onContinue) {
  const correctText = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  const { isExact, accuracy, matchedWords, totalWords, comparison } = result;
  
  const comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const cls = c.match ? 'word-correct' : 'word-error';
    return `<span class="${cls}" style="margin:2px 3px;">${c.user || '—'}</span>`;
  }).join('');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${isExact ? '🎉 ¡Perfecto!' : '📝 Resultado del dictado'}</h3>
      <div class="comparison-text-block">
        <p><strong>🎧 Frase correcta:</strong><br>
          <span style="color:#4ade80; font-size:1.1rem;">${correctText}</span></p>
        <p><strong>✏️ Tu respuesta:</strong><br>
          <span style="color:${isExact ? '#4ade80' : '#fbbf24'};">${userAnswer}</span></p>
        <div style="margin-top:12px;">
          <strong>📊 Precisión: ${Math.round(accuracy * 100)}%</strong> (${matchedWords}/${totalWords} palabras)
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:8px;">
          ${comparisonHtml}
        </div>
      </div>
      <div class="doubt-field" style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea id="modalDoubtInput" class="answer-input" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("modalContinueBtn").addEventListener("click", () => {
    const duda = document.getElementById("modalDoubtInput")?.value?.trim() || '';
    modal.remove();
    if (onContinue) onContinue(duda);
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      const duda = document.getElementById("modalDoubtInput")?.value?.trim() || '';
      modal.remove();
      if (onContinue) onContinue(duda);
    }
  });
}

export function getDictadoReportEntry(exercise, userAnswer, duda) {
  const correctText = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  return {
    type: "dictado",
    original: correctText,
    userAnswer: userAnswer,
    duda: duda || ''
  };
}