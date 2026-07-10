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

let lastVoiceIndex = -1;

function getRandomVoice() {
  let index;
  do {
    index = Math.floor(Math.random() * VOICES.length);
  } while (index === lastVoiceIndex && VOICES.length > 1);
  lastVoiceIndex = index;
  return VOICES[index];
}

function speakDictado(text, onEnd) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voiceConfig = getRandomVoice();
  
  utterance.lang = voiceConfig.lang;
  utterance.rate = voiceConfig.rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  // Cargar voces si es necesario
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      const updatedVoices = window.speechSynthesis.getVoices();
      const matchingVoices = updatedVoices.filter(v => v.lang.startsWith('en'));
      if (matchingVoices.length > 0) {
        utterance.voice = matchingVoices[Math.floor(Math.random() * matchingVoices.length)];
      }
      window.speechSynthesis.speak(utterance);
    };
  } else {
    const matchingVoices = voices.filter(v => v.lang.startsWith('en'));
    if (matchingVoices.length > 0) {
      utterance.voice = matchingVoices[Math.floor(Math.random() * matchingVoices.length)];
    }
    window.speechSynthesis.speak(utterance);
  }
  
  if (onEnd) utterance.onend = onEnd;
  
  return utterance;
}

export function renderDictadoExercise(exercise, container) {
  const text = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  
  container.innerHTML = `
    <div class="dictado-container">
      <!-- Área de audio mejorada -->
      <div class="dictado-audio-area">
        <div class="dictado-audio-icon">🎧</div>
        <div class="dictado-audio-info">
          <div class="dictado-audio-title">Escucha y escribe</div>
          <div class="dictado-audio-subtitle">Reproduce el audio y escribe exactamente lo que escuchas</div>
        </div>
        <button class="dictado-play-btn" id="dictadoPlayBtn" title="Reproducir audio">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>Reproducir</span>
        </button>
      </div>
      
      <!-- Barra de progreso del audio -->
      <div class="dictado-progress-bar" id="dictadoProgressBar">
        <div class="dictado-progress-fill" id="dictadoProgressFill"></div>
      </div>
      
      <!-- Contador de reproducciones -->
      <div class="dictado-play-count" id="dictadoPlayCount">
        Reproducciones: <span>0</span>
      </div>
      
      <!-- Área de escritura -->
      <div class="dictado-input-area">
        <textarea 
          id="dictadoInput" 
          class="dictado-textarea" 
          rows="3" 
          placeholder="Escribe aquí lo que escuchaste..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        ></textarea>
        <div class="dictado-input-footer">
          <span class="dictado-char-count" id="dictadoCharCount">0 caracteres</span>
        </div>
      </div>
      
      <!-- Botones de acción -->
      <div class="dictado-actions">
        <button class="dictado-btn dictado-btn-outline" id="dictadoClearBtn">
          🗑️ Limpiar
        </button>
        <button class="dictado-btn dictado-btn-primary" id="checkDictadoBtn">
          ✅ Comprobar
        </button>
      </div>
    </div>
  `;
  
  let playCount = 0;
  const progressFill = document.getElementById("dictadoProgressFill");
  const playCountEl = document.getElementById("dictadoPlayCount").querySelector("span");
  const playBtn = document.getElementById("dictadoPlayBtn");
  const textarea = document.getElementById("dictadoInput");
  const charCount = document.getElementById("dictadoCharCount");
  
  // Auto reproducir al cargar
  setTimeout(() => {
    speakDictado(text);
    playCount++;
    playCountEl.textContent = playCount;
    animateProgress();
  }, 600);
  
  function animateProgress() {
    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '0%';
      setTimeout(() => {
        progressFill.style.transition = 'width 2s ease';
        progressFill.style.width = '100%';
      }, 50);
    }
  }
  
  // Botón de play
  playBtn?.addEventListener("click", () => {
    speakDictado(text);
    playCount++;
    playCountEl.textContent = playCount;
    animateProgress();
    
    // Efecto visual en el botón
    playBtn.classList.add('playing');
    setTimeout(() => playBtn.classList.remove('playing'), 500);
  });
  
  // Contador de caracteres
  textarea?.addEventListener("input", () => {
    charCount.textContent = textarea.value.length + " caracteres";
  });
  
  // Botón limpiar
  document.getElementById("dictadoClearBtn")?.addEventListener("click", () => {
    textarea.value = '';
    charCount.textContent = '0 caracteres';
    textarea.focus();
  });
  
  // Enter para comprobar
  textarea?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.getElementById("checkDictadoBtn")?.click();
    }
  });
  
  // Comprobar respuesta
  document.getElementById("checkDictadoBtn")?.addEventListener("click", () => {
    const userAnswer = textarea?.value?.trim() || '';
    if (!userAnswer) {
      // Mostrar mini toast en el textarea
      textarea.style.borderColor = '#e50914';
      textarea.placeholder = 'Por favor escribe lo que escuchaste...';
      setTimeout(() => {
        textarea.style.borderColor = '';
        textarea.placeholder = 'Escribe aquí lo que escuchaste...';
      }, 2000);
      return;
    }
    
    const result = checkDictadoAnswer(exercise, userAnswer);
    
    // Despachar evento para que la lógica principal lo maneje
    const event = new CustomEvent('dictado-checked', {
      detail: { exercise, userAnswer, result }
    });
    container.dispatchEvent(event);
  });
  
  textarea?.focus();
}

export function checkDictadoAnswer(exercise, userAnswer) {
  const correctText = typeof exercise === 'string' ? exercise : exercise.text || exercise.phrase || '';
  
  const normalize = (str) => str.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"]/g, '')
    .trim();
  
  const isExact = normalize(userAnswer) === normalize(correctText);
  
  const correctWords = correctText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  const userWords = userAnswer.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  
  let matchedWords = 0;
  const comparison = [];
  
  for (let i = 0; i < Math.max(correctWords.length, userWords.length); i++) {
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
  
  // Determinar color según precisión
  let accuracyColor = '#e50914';
  if (accuracy >= 0.9) accuracyColor = '#2ecc71';
  else if (accuracy >= 0.7) accuracyColor = '#f39c12';
  
  const comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const cls = c.match ? 'word-correct' : 'word-error';
    return `<span class="${cls}">${c.user || '—'}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend dictado-modal">
      <div class="dictado-modal-header" style="background:${accuracyColor}">
        <span class="dictado-modal-icon">${isExact ? '🏆' : accuracy >= 0.7 ? '📝' : '🎧'}</span>
        <h3>${isExact ? '¡Perfecto!' : 'Resultado del dictado'}</h3>
      </div>
      
      <div class="dictado-modal-body">
        <div class="dictado-modal-section correct-section">
          <div class="dictado-modal-label">✅ Frase correcta</div>
          <div class="dictado-modal-text correct-text">${correctText}</div>
        </div>
        
        <div class="dictado-modal-section user-section">
          <div class="dictado-modal-label">✏️ Tu respuesta</div>
          <div class="dictado-modal-text user-text">${userAnswer || '(vacío)'}</div>
        </div>
        
        <div class="dictado-modal-stats">
          <div class="dictado-stat" style="border-color:${accuracyColor}">
            <div class="dictado-stat-value" style="color:${accuracyColor}">${Math.round(accuracy * 100)}%</div>
            <div class="dictado-stat-label">Precisión</div>
          </div>
          <div class="dictado-stat">
            <div class="dictado-stat-value">${matchedWords}</div>
            <div class="dictado-stat-label">Aciertos</div>
          </div>
          <div class="dictado-stat">
            <div class="dictado-stat-value">${totalWords}</div>
            <div class="dictado-stat-label">Palabras</div>
          </div>
        </div>
        
        <div class="dictado-modal-comparison">
          <div class="dictado-modal-label">🔍 Comparación palabra por palabra</div>
          <div class="dictado-comparison-words">${comparisonHtml}</div>
        </div>
        
        <div class="dictado-modal-doubt">
          <label>💭 Consulta o duda (opcional)</label>
          <textarea id="modalDoubtInput" rows="2" placeholder="Anota tu consulta sobre este ejercicio..."></textarea>
        </div>
      </div>
      
      <div class="dictado-modal-footer">
        <button class="dictado-modal-btn" id="modalContinueBtn">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const continueHandler = () => {
    const duda = document.getElementById("modalDoubtInput")?.value?.trim() || '';
    modal.remove();
    if (onContinue) onContinue(duda);
  };
  
  document.getElementById("modalContinueBtn").addEventListener("click", continueHandler);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) continueHandler();
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