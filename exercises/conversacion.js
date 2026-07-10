// exercises/conversacion.js
// Ejercicio de conversación con audio y completar espacios

const AVATARS = {
  default1: { emoji: '👩', color: '#f472b6' },
  default2: { emoji: '👨', color: '#60a5fa' },
  default3: { emoji: '👩‍🦰', color: '#fbbf24' },
  narrador: { emoji: '', color: '#94a3b8' }
};

let conversationState = {
  messages: [],
  currentIndex: 0,
  attempts: {},
  isPlaying: false,
  selectedOption: null
};

function speakText(text, onEnd) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  utterance.pitch = 1;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

function isAudioSelection(message) {
  return message.audioOptions && Array.isArray(message.audioOptions) && message.audioOptions.length === 3;
}

function needsCompletion(text) {
  return text.split(/\s+/).length >= 4;
}

function createCompletionText(text) {
  const words = text.split(/\s+/);
  const randomIndex = Math.floor(Math.random() * words.length);
  const removedWord = words[randomIndex];
  words[randomIndex] = '_____';
  return { displayText: words.join(' '), removedWord, removedIndex: randomIndex };
}

function getAvatar(message) {
  // Si es narrador (boolean true o string "narrador")
  if (message.isNarrador === true || (message.character || '').toLowerCase() === 'narrador') {
    return { ...AVATARS.narrador, nombre: 'Narrador' };
  }
  
  // Si tiene nombre personalizado
  const name = message.name || message.character || 'Persona';
  const color = message.color || AVATARS.default1.color;
  const emoji = message.avatar || AVATARS.default1.emoji;
  
  return { emoji, color, nombre: name };
}

export function renderConversacionExercise(exercise, container) {
  const messages = exercise.messages || exercise.conversacion || [];
  
  conversationState = {
    messages,
    currentIndex: 0,
    attempts: {},
    isPlaying: false,
    selectedOption: null
  };
  
  renderMessage(0, container, messages);
}

function renderMessage(index, container, messages) {
  if (index >= messages.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 20px;">
        <div style="font-size:4rem; margin-bottom:16px;">🎉</div>
        <h3 style="color:#4ade80; margin-bottom:8px;">¡Conversación completada!</h3>
        <p style="color:#94a3b8;">Has terminado todos los mensajes.</p>
        <button class="btn-action btn-continue" id="finishConvBtn" style="margin-top:16px; background:#4ade80; color:#064e3b; font-weight:700; width:100%;">
          ✅ Finalizar
        </button>
      </div>
    `;
    
    document.getElementById("finishConvBtn")?.addEventListener("click", () => {
      const event = new CustomEvent('conversacion-completed');
      container.dispatchEvent(event);
    });
    return;
  }
  
  const message = messages[index];
  const avatar = getAvatar(message);
  const isNarrador = message.isNarrador === true || (message.character || '').toLowerCase() === 'narrador';
  const needsComp = needsCompletion(message.text);
  const isAudioSel = isAudioSelection(message);
  
  let completionData = null;
  if (needsComp && !isAudioSel) {
    completionData = createCompletionText(message.text);
  }
  
  const isRetry = conversationState.attempts[index] >= 2;
  
  container.innerHTML = `
    <div class="conversation-container">
      <div class="conv-progress">
        <span class="conv-progress-text">Mensaje ${index + 1} de ${messages.length}</span>
        <div class="conv-progress-bar">
          <div class="conv-progress-fill" style="width:${((index + 1) / messages.length) * 100}%"></div>
        </div>
      </div>
      
      <div class="conv-message-wrapper ${isNarrador ? 'narrador' : ''}">
        ${!isNarrador ? `
          <div class="conv-avatar" style="background:${avatar.color}20; border:2px solid ${avatar.color};">
            <span class="conv-avatar-emoji">${avatar.emoji}</span>
          </div>
        ` : ''}
        
        <div class="conv-bubble ${isNarrador ? 'narrador-bubble' : ''}" style="${!isNarrador ? 'border-left:3px solid ' + avatar.color : ''}">
          <div class="conv-character-name" style="color:${avatar.color};">
            ${avatar.nombre}
          </div>
          
          ${isRetry ? '<div class="correction-notice" style="margin-bottom:8px;">⚠️ Se completó automáticamente después de 2 intentos</div>' : ''}
          
          <div class="conv-text">
            ${isAudioSel ? `
              <p style="color:#fde68a; margin-bottom:12px;">🎧 Escucha y selecciona la opción correcta:</p>
              <div class="conv-audio-options">
                ${message.audioOptions.map((opt, i) => `
                  <button class="conv-audio-btn ${conversationState.selectedOption === i ? 'selected' : ''}" 
                    data-option="${i}" style="border-color:${['#facc15','#60a5fa','#f472b6'][i]};">
                    <span class="conv-audio-icon">🔊</span>
                    <span class="conv-audio-label">Opción ${i + 1}</span>
                  </button>
                `).join('')}
              </div>
            ` : completionData && !isRetry ? `
              <div class="conv-completion-text">
                ${completionData.displayText.split(' ').map(word => {
                  if (word === '_____') {
                    return `<input type="text" class="completar-input conv-input" id="convCompleteInput" 
                      placeholder="?" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                      style="width:80px; display:inline-block;">`;
                  }
                  return `<span>${word}</span>`;
                }).join(' ')}
              </div>
            ` : `
              <p>${message.text}</p>
            `}
          </div>
          
          <button class="conv-play-btn" id="convPlayBtn" title="Reproducir audio">🔊 Reproducir</button>
        </div>
      </div>
      
      <button class="btn-action btn-continue" id="convContinueBtn" 
        style="width:100%; margin-top:16px; background:${isAudioSel && conversationState.selectedOption === null ? '#334155' : '#4ade80'}; color:#064e3b; font-weight:700;">
        ${index < messages.length - 1 ? '▶️ Continuar' : '✅ Terminar conversación'}
      </button>
    </div>
  `;
  
  setupConversacionListeners(message, index, container, messages, completionData, isAudioSel, isRetry);
}

function setupConversacionListeners(message, index, container, messages, completionData, isAudioSel, isRetry) {
  const playBtn = document.getElementById("convPlayBtn");
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (conversationState.isPlaying) {
        window.speechSynthesis.cancel();
        conversationState.isPlaying = false;
        playBtn.textContent = '🔊 Reproducir';
        playBtn.style.background = '';
        playBtn.style.color = '';
        return;
      }
      
      conversationState.isPlaying = true;
      playBtn.textContent = '⏹ Detener';
      playBtn.style.background = '#ef4444';
      playBtn.style.color = 'white';
      
      speakText(message.text, () => {
        conversationState.isPlaying = false;
        playBtn.textContent = '🔊 Reproducir';
        playBtn.style.background = '';
        playBtn.style.color = '';
      });
    });
  }
  
  if (isAudioSel) {
    const audioBtns = container.querySelectorAll('.conv-audio-btn');
    audioBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const optionIndex = parseInt(btn.dataset.option);
        conversationState.selectedOption = optionIndex;
        audioBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (message.audioOptions[optionIndex]) {
          speakText(message.audioOptions[optionIndex]);
        }
        const continueBtn = document.getElementById("convContinueBtn");
        if (continueBtn) continueBtn.style.background = '#4ade80';
      });
    });
  }
  
  const continueBtn = document.getElementById("convContinueBtn");
  if (continueBtn) {
    continueBtn.addEventListener("click", () => {
      if (isAudioSel && conversationState.selectedOption === null) {
        window._toast && window._toast("🎧 Selecciona una opción de audio primero");
        return;
      }
      
      if (completionData && !isRetry) {
        const input = document.getElementById("convCompleteInput");
        if (!input || !input.value.trim()) {
          window._toast && window._toast("✏️ Completa la palabra faltante");
          return;
        }
        
        const userAnswer = input.value.trim();
        const isCorrect = userAnswer.toLowerCase() === completionData.removedWord.toLowerCase();
        conversationState.attempts[index] = (conversationState.attempts[index] || 0) + 1;
        
        container.dispatchEvent(new CustomEvent('conversacion-answer', {
          detail: {
            messageIndex: index,
            messageText: message.text,
            removedWord: completionData.removedWord,
            userAnswer: userAnswer,
            isCorrect: isCorrect,
            attempts: conversationState.attempts[index]
          }
        }));
        
        if (!isCorrect && conversationState.attempts[index] < 2) {
          window._toast && window._toast("❌ Incorrecto. Intenta de nuevo.");
          renderMessage(index, container, messages);
          return;
        }
      }
      
      if (isAudioSel) {
        container.dispatchEvent(new CustomEvent('conversacion-answer', {
          detail: {
            messageIndex: index,
            messageText: message.text,
            selectedOption: conversationState.selectedOption,
            correctOption: message.correctOption || 0,
            isCorrect: conversationState.selectedOption === (message.correctOption || 0)
          }
        }));
      }
      
      conversationState.currentIndex = index + 1;
      conversationState.selectedOption = null;
      window.speechSynthesis.cancel();
      conversationState.isPlaying = false;
      
      if (index + 1 < messages.length) {
        renderMessage(index + 1, container, messages);
        setTimeout(() => {
          const nextPlayBtn = document.getElementById("convPlayBtn");
          if (nextPlayBtn && messages[index + 1]) nextPlayBtn.click();
        }, 500);
      } else {
        renderMessage(messages.length, container, messages);
      }
    });
  }
}

export function getConversacionReportEntry(messageData) {
  return {
    type: "conversacion",
    messageIndex: messageData.messageIndex,
    messageText: messageData.messageText,
    removedWord: messageData.removedWord || '',
    userAnswer: messageData.userAnswer || '',
    selectedOption: messageData.selectedOption,
    correctOption: messageData.correctOption,
    isCorrect: messageData.isCorrect,
    attempts: messageData.attempts || 1
  };
}