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

function speakDictado(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voiceConfig = getRandomVoice();
  
  utterance.lang = voiceConfig.lang;
  utterance.rate = voiceConfig.rate;
  utterance.pitch = 1;
  utterance.volume = 1;
  
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
}

// Función auxiliar para obtener el texto del ejercicio
function getExerciseText(exercise) {
  if (typeof exercise === 'string') return exercise;
  if (exercise && exercise.text) return exercise.text;
  if (exercise && exercise.phrase) return exercise.phrase;
  if (exercise && exercise.original) return exercise.original;
  return '';
}

export function renderDictadoExercise(exercise, container) {
  const text = getExerciseText(exercise);
  
  container.innerHTML = `
    <div class="dictado-container">
      <div class="dictado-audio-area">
        <div class="dictado-audio-icon">🎧</div>
        <div class="dictado-audio-info">
          <div class="dictado-audio-title">Escucha y escribe</div>
          <div class="dictado-audio-subtitle">Reproduce el audio y escribe exactamente lo que escuchas</div>
        </div>
        <button class="dictado-play-btn" id="dictadoPlayBtn" title="Reproducir audio" type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <span>Reproducir</span>
        </button>
      </div>
      
      <div class="dictado-progress-bar">
        <div class="dictado-progress-fill" id="dictadoProgressFill"></div>
      </div>
      
      <div class="dictado-play-count">
        Reproducciones: <span id="dictadoPlayCountSpan">0</span>
      </div>
      
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
      
      <div class="dictado-actions">
        <button class="dictado-btn dictado-btn-outline" id="dictadoClearBtn" type="button">
          🗑️ Limpiar
        </button>
        <button class="dictado-btn dictado-btn-primary" id="checkDictadoBtn" type="button">
          ✅ Comprobar
        </button>
      </div>
    </div>
  `;
  
  let playCount = 0;
  const progressFill = document.getElementById("dictadoProgressFill");
  const playCountSpan = document.getElementById("dictadoPlayCountSpan");
  const playBtn = document.getElementById("dictadoPlayBtn");
  const textarea = document.getElementById("dictadoInput");
  const charCount = document.getElementById("dictadoCharCount");
  const checkBtn = document.getElementById("checkDictadoBtn");
  
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
  
  // Auto reproducir al cargar
  setTimeout(() => {
    speakDictado(text);
    playCount++;
    if (playCountSpan) playCountSpan.textContent = playCount;
    animateProgress();
  }, 600);
  
  // Botón de play
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      speakDictado(text);
      playCount++;
      if (playCountSpan) playCountSpan.textContent = playCount;
      animateProgress();
      playBtn.classList.add('playing');
      setTimeout(() => playBtn.classList.remove('playing'), 500);
    });
  }
  
  // Contador de caracteres
  if (textarea) {
    textarea.addEventListener("input", () => {
      if (charCount) charCount.textContent = textarea.value.length + " caracteres";
    });
  }
  
  // Botón limpiar
  document.getElementById("dictadoClearBtn")?.addEventListener("click", () => {
    if (textarea) {
      textarea.value = '';
      if (charCount) charCount.textContent = '0 caracteres';
      textarea.focus();
    }
  });
  
  // Enter para comprobar
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        checkBtn?.click();
      }
    });
  }
  
  // ============ COMPROBAR ============
  if (checkBtn) {
    checkBtn.onclick = function() {
      const userAnswer = textarea ? textarea.value.trim() : '';
      
      if (!userAnswer) {
        if (textarea) {
          textarea.style.borderColor = '#e50914';
          textarea.placeholder = '⚠️ Por favor escribe lo que escuchaste...';
          setTimeout(() => {
            if (textarea) {
              textarea.style.borderColor = '';
              textarea.placeholder = 'Escribe aquí lo que escuchaste...';
            }
          }, 2000);
        }
        return;
      }
      
      const result = checkDictadoAnswer(text, userAnswer);
      
      showDictadoModal(text, result, userAnswer, function(duda) {
        const event = new CustomEvent('dictado-done', {
          detail: { 
            originalText: text,
            userAnswer: userAnswer, 
            result: result, 
            duda: duda 
          }
        });
        container.dispatchEvent(event);
      });
    };
  }
  
  if (textarea) textarea.focus();
}

export function checkDictadoAnswer(correctText, userAnswer) {
  const normalize = (str) => String(str || '').toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"]/g, '')
    .trim();
  
  const normalizedCorrect = normalize(correctText);
  const normalizedUser = normalize(userAnswer);
  
  const isExact = normalizedUser === normalizedCorrect;
  
  const correctWords = correctText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  const userWords = userAnswer.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/);
  
  let matchedWords = 0;
  const comparison = [];
  const maxLen = Math.max(correctWords.length, userWords.length);
  
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

export function showDictadoModal(correctText, result, userAnswer, onContinue) {
  const { isExact, accuracy, matchedWords, totalWords, comparison } = result;
  
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
          <div class="dictado-modal-text correct-text">${escapeHTML(correctText)}</div>
        </div>
        
        <div class="dictado-modal-section user-section">
          <div class="dictado-modal-label">✏️ Tu respuesta</div>
          <div class="dictado-modal-text user-text">${escapeHTML(userAnswer) || '(vacío)'}</div>
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
        <button class="dictado-modal-btn" id="modalContinueBtn" type="button">▶️ Continuar</button>
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

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function getDictadoReportEntry(originalText, userAnswer, duda) {
  return {
    type: "dictado",
    original: originalText,
    userAnswer: userAnswer,
    duda: duda || ''
  };
}