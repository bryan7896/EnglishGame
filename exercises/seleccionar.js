// exercises/seleccionar.js

// ---- Voz: precarga del motor + selección con variedad ----
// El retraso de ~2-3s que se siente al tocar una palabra la primera vez no lo
// causa nuestro código: lo causa el motor de speechSynthesis del navegador,
// que "despierta" recién con su primera utterance. Por eso, apenas se abre
// este ejercicio (antes de que el usuario llegue a tocar nada), disparamos
// una utterance silenciosa que fuerza esa inicialización de una vez.
let speechWarmedUp = false;
let cachedEnglishVoices = [];
let lastSeleccionarVoiceURI = null;

// Igual que en dictado.js: restringirnos a una sola voz "en-US" es lo que
// hacía que siempre sonara la misma voz en muchos navegadores (Chrome sin
// paquetes de idioma extra solo trae "Google US English" como en-US). Si
// hay 2+ voces en-US las usamos (mantiene el acento consistente); si no,
// ampliamos a cualquier voz en inglés para poder variar de verdad.
function refreshVoiceCache() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const usVoices = voices.filter(v => v.lang === 'en-US' || v.lang === 'en_US');
  cachedEnglishVoices = usVoices.length >= 2 ? usVoices : voices.filter(v => /^en/i.test(v.lang));
}

function warmUpSpeech() {
  if (!('speechSynthesis' in window)) return;

  refreshVoiceCache();

  if (!window._seleccionarVoicesHandlerAttached) {
    window.speechSynthesis.addEventListener('voiceschanged', refreshVoiceCache);
    window._seleccionarVoicesHandlerAttached = true;
  }

  if (speechWarmedUp) return;
  speechWarmedUp = true;

  try {
    const warm = new SpeechSynthesisUtterance(' ');
    warm.volume = 0; // inaudible, solo "despierta" el motor
    warm.rate = 10;
    window.speechSynthesis.speak(warm);
  } catch (e) { /* noop */ }
}

// Elige una voz en inglés distinta a la última usada (si hay más de una
// candidata disponible), para que cada reproducción -incluso de la misma
// palabra, incluso presionando "escuchar" varias veces seguidas- suene con
// una voz diferente.
function pickVariedVoice() {
  if (!cachedEnglishVoices.length) refreshVoiceCache();
  if (!cachedEnglishVoices.length) return null;

  let candidates = cachedEnglishVoices.filter(v => v.voiceURI !== lastSeleccionarVoiceURI);
  if (candidates.length === 0) candidates = cachedEnglishVoices;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastSeleccionarVoiceURI = chosen.voiceURI;
  return chosen;
}

function speakSeleccionarWord(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.95;
  const voice = pickVariedVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

// Nombre propio (no "shuffleArray") a propósito: build.py/build_template.py
// concatenan todos los archivos de exercises/ y mapa/map.js dentro de un
// único <script type="module">, y map.js ya define su propio shuffleArray
// en ese mismo scope. Redeclarar el mismo nombre ahí sería un
// "Identifier already declared" que rompe TODO el script.
function shuffleSeleccionarList(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ---- Punto de entrada ----
// Antes de mostrar el juego de emparejar de siempre, se toman hasta 3
// palabras al azar del set y se ponen a practicar por oído (escuchar +
// escribir, 2 intentos). Esas 3 palabras luego aparecen en el juego de
// emparejar SIN texto visible (solo el botón de audio), para forzar a que
// el usuario las reconozca por sonido.
export function renderSeleccionarExercise(exercise, container) {
  warmUpSpeech();

  const pairs = exercise.pairs || [];
  const practiceCount = Math.min(3, pairs.length);

  if (container._seleccionarAutoPlayTimer) {
    clearTimeout(container._seleccionarAutoPlayTimer);
    container._seleccionarAutoPlayTimer = null;
  }

  if (practiceCount > 0) {
    const practicePairs = shuffleSeleccionarList(pairs).slice(0, practiceCount);
    renderListeningPractice(practicePairs, container, () => {
      const hiddenWords = new Set(practicePairs.map(p => p.englishWord));
      renderMatchingGame(exercise, container, hiddenWords);
    });
  } else {
    renderMatchingGame(exercise, container, new Set());
  }
}

// ---- Fase 1: práctica de escucha ----
function renderListeningPractice(practicePairs, container, onDone) {
  const state = practicePairs.map(() => ({ attempts: 0, done: false }));

  container.innerHTML = `
    <div class="mini-listen-wrap">
      <div class="question-bubble">🎧 Escribe la palabra que escuchas</div>
      <p style="color:#94a3b8;margin:6px 0 4px;font-size:0.82rem;">
        Antes de emparejar, practica el oído: reproduce el audio y escribe cada palabra (2 intentos por palabra).
      </p>
      <div class="mini-listen-row">
        ${practicePairs.map((p, idx) => `
          <div class="mini-listen-item" data-idx="${idx}">
            <button class="mini-listen-play" type="button" data-idx="${idx}" title="Reproducir">🔊</button>
            <input type="text" class="mini-listen-input" data-idx="${idx}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="?">
            <button class="mini-listen-submit" type="button" data-idx="${idx}" title="Comprobar">➤</button>
          </div>
        `).join('')}
      </div>
      <div class="mini-listen-footer">
        <button class="fun-btn primary-btn mini-listen-continue" type="button" disabled>▶️ Continuar</button>
      </div>
    </div>
  `;

  const items = container.querySelectorAll('.mini-listen-item');
  const continueBtn = container.querySelector('.mini-listen-continue');

  function updateContinueState() {
    if (continueBtn) continueBtn.disabled = !state.every(s => s.done);
  }

  function playWord(idx) {
    speakSeleccionarWord(practicePairs[idx].englishWord);
  }

  items.forEach((item) => {
    const idx = parseInt(item.dataset.idx, 10);
    const playBtn = item.querySelector('.mini-listen-play');
    const input = item.querySelector('.mini-listen-input');
    const submitBtn = item.querySelector('.mini-listen-submit');

    const lockItem = (correct) => {
      input.readOnly = true;
      playBtn.disabled = true;
      submitBtn.disabled = true;
      item.classList.add(correct ? 'mini-listen-correct' : 'mini-listen-revealed');
    };

    const submit = () => {
      if (state[idx].done) return;
      const userVal = input.value.trim();
      const correctVal = practicePairs[idx].englishWord;
      const isCorrect = userVal.toLowerCase() === correctVal.toLowerCase();

      if (isCorrect) {
        state[idx].done = true;
        lockItem(true);
      } else {
        state[idx].attempts++;
        if (state[idx].attempts >= 2) {
          state[idx].done = true;
          input.value = correctVal;
          lockItem(false);
        } else {
          item.classList.add('mini-listen-wrong');
          setTimeout(() => item.classList.remove('mini-listen-wrong'), 450);
          input.value = '';
          input.focus();
        }
      }
      updateContinueState();
    };

    playBtn.addEventListener('click', () => playWord(idx));
    submitBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    });
  });

  // Reproduce automáticamente la primera palabra al entrar (igual que en dictado)
  container._seleccionarAutoPlayTimer = setTimeout(() => {
    if (document.body.contains(container)) playWord(0);
  }, 500);

  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      if (continueBtn.disabled) return;
      window.speechSynthesis?.cancel();
      onDone();
    });
  }
}

// ---- Fase 2: emparejar (juego original) ----
// hiddenWords: Set de englishWord que deben mostrarse sin texto (solo audio)
// porque el usuario ya las practicó en la fase de escucha.
function renderMatchingGame(exercise, container, hiddenWords) {
  const pairs = exercise.pairs || [];
  
  const englishWords = pairs.map(p => ({ word: p.englishWord, id: `en-${p.englishWord.replace(/\s+/g, '-')}` }));
  const spanishWords = pairs.map(p => ({ word: p.spanishWord, id: `es-${p.spanishWord.replace(/\s+/g, '-')}` }));
  
  const shuffledEnglish = [...englishWords].sort(() => Math.random() - 0.5);
  const shuffledSpanish = [...spanishWords].sort(() => Math.random() - 0.5);
  
  container.innerHTML = `
    <div class="question-bubble">🎯 Empareja las palabras correctas</div>
    <div class="selection-columns">
      <div class="selection-column">
        <h4 style="color:#60a5fa;text-align:center;margin-bottom:8px;">🇬🇧 Inglés</h4>
        ${shuffledEnglish.map(w => {
          const isHidden = hiddenWords && hiddenWords.has(w.word);
          return `
          <div class="selection-item english-item${isHidden ? ' audio-only-item' : ''}" data-id="${w.id}" data-word="${window._escHTML(w.word)}">
            ${isHidden ? '<span class="audio-only-icon">🔊 Escuchar</span>' : window._escHTML(w.word)}
          </div>
        `;}).join('')}
      </div>
      <div class="selection-column">
        <h4 style="color:#f59e0b;text-align:center;margin-bottom:8px;">🇪🇸 Español</h4>
        ${shuffledSpanish.map(w => `
          <div class="selection-item spanish-item" data-id="${w.id}" data-word="${window._escHTML(w.word)}">
            ${window._escHTML(w.word)}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="mood-card">
      <div class="mood-emoji">🎯</div>
      <div>
        <strong>Selecciona los pares</strong><br>
        <span>Haz clic en una palabra de cada columna</span>
      </div>
    </div>
    <div class="selection-feedback" style="text-align:center;min-height:24px;margin-top:8px;"></div>
  `;
  
  let selectedEnglish = null;
  let selectedSpanish = null;
  const matchedPairs = new Set();
  
  const englishItems = container.querySelectorAll('.english-item');
  const spanishItems = container.querySelectorAll('.spanish-item');
  const feedbackEl = container.querySelector('.selection-feedback');
  
  function resetSelection() {
    if (selectedEnglish) { selectedEnglish.classList.remove('selected'); selectedEnglish = null; }
    if (selectedSpanish) { selectedSpanish.classList.remove('selected'); selectedSpanish = null; }
  }
  
  englishItems.forEach(item => {
    item.addEventListener('click', () => {
      speakSeleccionarWord(item.dataset.word);
      if (item.classList.contains('matched')) return;
      
      if (selectedEnglish && selectedEnglish !== item) selectedEnglish.classList.remove('selected');
      
      if (selectedEnglish === item) {
        item.classList.remove('selected');
        selectedEnglish = null;
      } else {
        item.classList.add('selected');
        selectedEnglish = item;
      }
      
      if (selectedEnglish && selectedSpanish) {
        checkPair(selectedEnglish, selectedSpanish, pairs, matchedPairs, container, feedbackEl, resetSelection);
      }
    });
  });
  
  spanishItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;
      
      if (selectedSpanish && selectedSpanish !== item) selectedSpanish.classList.remove('selected');
      
      if (selectedSpanish === item) {
        item.classList.remove('selected');
        selectedSpanish = null;
      } else {
        item.classList.add('selected');
        selectedSpanish = item;
      }
      
      if (selectedEnglish && selectedSpanish) {
        checkPair(selectedEnglish, selectedSpanish, pairs, matchedPairs, container, feedbackEl, resetSelection);
      }
    });
  });
}

function checkPair(englishEl, spanishEl, pairs, matchedPairs, container, feedbackEl, resetSelection) {
  const englishWord = englishEl.dataset.word;
  const spanishWord = spanishEl.dataset.word;
  
  const isCorrectPair = pairs.some(p => 
    p.englishWord === englishWord && p.spanishWord === spanishWord
  );
  
  if (isCorrectPair) {
    englishEl.classList.add('matched');
    spanishEl.classList.add('matched');
    englishEl.classList.remove('selected');
    spanishEl.classList.remove('selected');
    
    matchedPairs.add(englishWord + '|||' + spanishWord);
    
    if (feedbackEl) {
      feedbackEl.innerHTML = '<span style="color:#4ade80;">✅ ¡Par correcto!</span>';
      setTimeout(() => { feedbackEl.innerHTML = ''; }, 1500);
    }
    
    resetSelection();
    
    if (matchedPairs.size === pairs.length) {
      setTimeout(() => {
        container.dispatchEvent(new CustomEvent('all-matched'));
      }, 300);
    }
  } else {
    englishEl.classList.add('wrong');
    spanishEl.classList.add('wrong');
    
    if (feedbackEl) {
      feedbackEl.innerHTML = '<span style="color:#f87171;">❌ Par incorrecto</span>';
      setTimeout(() => { feedbackEl.innerHTML = ''; }, 2000);
    }
    
    setTimeout(() => {
      englishEl.classList.remove('wrong', 'selected');
      spanishEl.classList.remove('wrong', 'selected');
      resetSelection();
    }, 600);
  }
}

export function showSeleccionarCompleteModal(pairs, onContinue) {
  // Eliminar cualquier modal existente primero
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  window.speechSynthesis?.cancel();
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>🎉 ¡Todos los pares correctos!</h3>
      <div class="comparison-text-block">
        <p><strong>Pares emparejados:</strong></p>
        ${pairs.map(p => `
          <div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0;padding:8px 12px;background:rgba(74,222,128,0.1);border-radius:8px;">
            <span style="color:#60a5fa;font-weight:600;">${window._escHTML(p.englishWord)}</span>
            <span style="font-size:1.2rem;">↔️</span>
            <span style="color:#f59e0b;font-weight:600;">${window._escHTML(p.spanishWord)}</span>
          </div>
        `).join('')}
      </div>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn seleccionar-continue">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Usar clase en lugar de ID, y querySelector dentro del modal
  const continueBtn = modal.querySelector('.seleccionar-continue');
  
  const close = () => {
    modal.remove();
    if (onContinue) onContinue();
  };
  
  continueBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Evitar que el click se propague al overlay
    close();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}