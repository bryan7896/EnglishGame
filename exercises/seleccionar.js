// exercises/seleccionar.js

export function renderSeleccionarExercise(exercise, container) {
  const pairs = exercise.pairs || [];
  
  const englishWords = pairs.map(p => ({ word: p.englishWord, id: `en-${p.englishWord.replace(/\s+/g, '-')}` }));
  const spanishWords = pairs.map(p => ({ word: p.spanishWord, id: `es-${p.spanishWord.replace(/\s+/g, '-')}` }));
  
  const shuffledEnglish = [...englishWords].sort(() => Math.random() - 0.5);
  const shuffledSpanish = [...spanishWords].sort(() => Math.random() - 0.5);
  
  container.innerHTML = `
    <div class="question-bubble">🎯 Empareja las palabras correctas</div>
    <div class="selection-columns">
      <div class="selection-column" id="englishColumn">
        <h4 style="color:#60a5fa; text-align:center; margin-bottom:8px;">🇬🇧 Inglés</h4>
        ${shuffledEnglish.map(w => `
          <div class="selection-item english-item" data-id="${w.id}" data-word="${escapeHtml(w.word)}">
            ${escapeHtml(w.word)}
          </div>
        `).join('')}
      </div>
      <div class="selection-column" id="spanishColumn">
        <h4 style="color:#f59e0b; text-align:center; margin-bottom:8px;">🇪🇸 Español</h4>
        ${shuffledSpanish.map(w => `
          <div class="selection-item spanish-item" data-id="${w.id}" data-word="${escapeHtml(w.word)}">
            ${escapeHtml(w.word)}
          </div>
        `).join('')}
      </div>
    </div>
    <div class="mood-card">
      <div class="mood-emoji" id="exerciseEmoji">🎯</div>
      <div>
        <strong id="exerciseMoodTitle">Selecciona los pares</strong><br>
        <span id="exerciseMoodText">Haz clic en una palabra de cada columna</span>
      </div>
    </div>
    <div id="selectionFeedback" style="text-align:center; min-height:24px; margin-top:8px;"></div>
  `;
  
  // Estado de selección
  let selectedEnglish = null;
  let selectedSpanish = null;
  const matchedPairs = new Set();
  
  const englishItems = container.querySelectorAll('.english-item');
  const spanishItems = container.querySelectorAll('.spanish-item');
  const feedbackEl = container.querySelector('#selectionFeedback');
  
  function resetSelection() {
    if (selectedEnglish) {
      selectedEnglish.classList.remove('selected');
      selectedEnglish = null;
    }
    if (selectedSpanish) {
      selectedSpanish.classList.remove('selected');
      selectedSpanish = null;
    }
  }
  
  englishItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;
      
      // Si ya hay un inglés seleccionado, desseleccionarlo
      if (selectedEnglish && selectedEnglish !== item) {
        selectedEnglish.classList.remove('selected');
      }
      
      // Toggle selección
      if (selectedEnglish === item) {
        item.classList.remove('selected');
        selectedEnglish = null;
      } else {
        item.classList.add('selected');
        selectedEnglish = item;
      }
      
      // Si ambos están seleccionados, verificar par
      if (selectedEnglish && selectedSpanish) {
        checkPair(selectedEnglish, selectedSpanish, pairs, matchedPairs, container, feedbackEl, resetSelection);
      }
    });
  });
  
  spanishItems.forEach(item => {
    item.addEventListener('click', () => {
      if (item.classList.contains('matched')) return;
      
      // Si ya hay un español seleccionado, desseleccionarlo
      if (selectedSpanish && selectedSpanish !== item) {
        selectedSpanish.classList.remove('selected');
      }
      
      // Toggle selección
      if (selectedSpanish === item) {
        item.classList.remove('selected');
        selectedSpanish = null;
      } else {
        item.classList.add('selected');
        selectedSpanish = item;
      }
      
      // Si ambos están seleccionados, verificar par
      if (selectedEnglish && selectedSpanish) {
        checkPair(selectedEnglish, selectedSpanish, pairs, matchedPairs, container, feedbackEl, resetSelection);
      }
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function checkPair(englishEl, spanishEl, pairs, matchedPairs, container, feedbackEl, resetSelection) {
  const englishWord = englishEl.dataset.word;
  const spanishWord = spanishEl.dataset.word;
  
  const isCorrectPair = pairs.some(p => 
    p.englishWord === englishWord && p.spanishWord === spanishWord
  );
  
  if (isCorrectPair) {
    // Marcar como emparejado
    englishEl.classList.add('matched');
    spanishEl.classList.add('matched');
    englishEl.classList.remove('selected');
    spanishEl.classList.remove('selected');
    
    matchedPairs.add(englishWord + '|||' + spanishWord);
    
    // Feedback positivo
    if (feedbackEl) {
      feedbackEl.innerHTML = '<span style="color:#4ade80;">✅ ¡Par correcto!</span>';
      setTimeout(() => { feedbackEl.innerHTML = ''; }, 1500);
    }
    
    // Resetear selección
    resetSelection();
    
    // Verificar si todos están emparejados
    if (matchedPairs.size === pairs.length) {
      setTimeout(() => {
        const event = new CustomEvent('all-matched');
        container.dispatchEvent(event);
      }, 300);
    }
  } else {
    // Marcar error temporalmente
    englishEl.classList.add('wrong');
    spanishEl.classList.add('wrong');
    
    // Feedback negativo
    if (feedbackEl) {
      feedbackEl.innerHTML = '<span style="color:#f87171;">❌ Par incorrecto, intenta de nuevo</span>';
      setTimeout(() => { feedbackEl.innerHTML = ''; }, 2000);
    }
    
    // Remover después de un tiempo y resetear selección
    setTimeout(() => {
      englishEl.classList.remove('wrong', 'selected');
      spanishEl.classList.remove('wrong', 'selected');
      resetSelection();
    }, 600);
  }
}

export function showSeleccionarCompleteModal(pairs, onContinue) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>🎉 ¡Todos los pares correctos!</h3>
      <div class="comparison-text-block">
        <p><strong>Pares emparejados:</strong></p>
        ${pairs.map(p => `
          <div style="display:flex; justify-content:space-between; align-items:center; margin:6px 0; padding:8px 12px; background:rgba(74,222,128,0.1); border-radius:8px;">
            <span style="color:#60a5fa; font-weight:600;">${escapeHtml(p.englishWord)}</span>
            <span style="font-size:1.2rem;">↔️</span>
            <span style="color:#f59e0b; font-weight:600;">${escapeHtml(p.spanishWord)}</span>
          </div>
        `).join('')}
      </div>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const continueHandler = () => {
    modal.remove();
    if (onContinue) onContinue();
  };
  
  document.getElementById("modalContinueBtn").addEventListener("click", continueHandler);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) continueHandler();
  });
}