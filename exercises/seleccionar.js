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
      <div class="selection-column">
        <h4 style="color:#60a5fa;text-align:center;margin-bottom:8px;">🇬🇧 Inglés</h4>
        ${shuffledEnglish.map(w => `
          <div class="selection-item english-item" data-id="${w.id}" data-word="${window._escHTML(w.word)}">
            ${window._escHTML(w.word)}
          </div>
        `).join('')}
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