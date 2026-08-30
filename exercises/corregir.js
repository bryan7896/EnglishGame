// exercises/corregir.js

// Cuando un ejercicio de repaso (nodo 6) ha sido fallado más de una vez, el
// exercise trae "wrongAttempts": un historial (máx. 3, el más reciente al
// final) con lo que el usuario fue escribiendo mal cada vez. En ese caso, en
// vez de una tarjeta fija con un solo error, se muestra una tarjeta
// ROTATIVA que va pasando por cada intento fallido para que el usuario vea
// su patrón de error.
function buildCorregirBackFace(exercise) {
  const attempts = (Array.isArray(exercise.wrongAttempts) && exercise.wrongAttempts.length)
    ? exercise.wrongAttempts
    : [exercise.fraseConError];

  if (attempts.length <= 1) {
    return {
      html: `<div class="corregir-flipcard-face corregir-flipcard-back">
        <div class="error-highlight">${window._escHTML(attempts[0])}</div>
      </div>`,
      attempts
    };
  }

  const slides = attempts.map((a, i) => `
    <div class="corregir-attempt-slide${i === attempts.length - 1 ? ' active' : ''}" data-idx="${i}">
      <div class="corregir-attempt-label">Intento ${i + 1} de ${attempts.length}</div>
      <div class="error-highlight">${window._escHTML(a)}</div>
    </div>
  `).join('');

  const dots = attempts.map((_, i) => `
    <span class="corregir-dot${i === attempts.length - 1 ? ' active' : ''}" data-idx="${i}"></span>
  `).join('');

  return {
    html: `<div class="corregir-flipcard-face corregir-flipcard-back corregir-flipcard-carousel">
      <div class="corregir-attempts-stack">${slides}</div>
      <div class="corregir-attempt-dots">${dots}</div>
    </div>`,
    attempts
  };
}

function wireCorregirCarousel(container, attemptsCount) {
  if (attemptsCount <= 1) return;
  const stack = container.querySelector('.corregir-attempts-stack');
  const dotsWrap = container.querySelector('.corregir-attempt-dots');
  if (!stack || !dotsWrap) return;

  const slides = Array.from(stack.querySelectorAll('.corregir-attempt-slide'));
  const dots = Array.from(dotsWrap.querySelectorAll('.corregir-dot'));
  let activeIdx = slides.findIndex((s) => s.classList.contains('active'));
  if (activeIdx < 0) activeIdx = slides.length - 1;

  function goTo(idx) {
    activeIdx = (idx + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === activeIdx));
    dots.forEach((d, i) => d.classList.toggle('active', i === activeIdx));
  }

  dots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goTo(parseInt(dot.dataset.idx, 10));
    });
  });

  if (container._corregirCarouselTimer) clearInterval(container._corregirCarouselTimer);
  container._corregirCarouselTimer = setInterval(() => goTo(activeIdx + 1), 2600);
}

export function renderCorregirExercise(exercise, container, isRetry = false) {
  const { spanishPhrase } = exercise;

  if (container._corregirCarouselTimer) {
    clearInterval(container._corregirCarouselTimer);
    container._corregirCarouselTimer = null;
  }

  const backFace = buildCorregirBackFace(exercise);
  const hasHistory = backFace.attempts.length > 1;

  container.innerHTML = `
    <div class="corregir-card">
      ${isRetry ? '<div class="corregir-correction-notice">⚠️ Corrección: intenta de nuevo</div>' : ''}
      
      ${spanishPhrase ? `
        <div class="corregir-spanish-section">
          <div class="corregir-eyebrow">🇪🇸 Frase en español</div>
          <div class="corregir-spanish-text">${window._escHTML(spanishPhrase)}</div>
        </div>
      ` : ''}
      
      <div class="corregir-error-section">
        <div class="corregir-eyebrow">🔍 ${hasHistory ? 'Tus intentos anteriores (encuentra el error y corrige)' : 'Encuentra el error y corrige la frase en inglés'}</div>
        <div class="corregir-flipcard" tabindex="0" role="button" aria-pressed="false" aria-label="Toca para revelar la frase con error">
          <div class="corregir-flipcard-inner">
            <div class="corregir-flipcard-face corregir-flipcard-front">
              <span class="corregir-flipcard-icon">🃏</span>
              <span class="corregir-flipcard-hint">Toca para revelar</span>
            </div>
            ${backFace.html}
          </div>
        </div>
      </div>
      
      <textarea class="answer-input corregir-answer" rows="2" placeholder="Escribe la frase corregida en inglés..."></textarea>
      <div class="button-group">
        <button class="btn-action btn-check corregir-check">✅ Comprobar</button>
      </div>
    </div>
  `;
  
  const flipCard = container.querySelector('.corregir-flipcard');
  if (flipCard) {
    const toggleFlip = () => {
      const flipped = flipCard.classList.toggle('is-flipped');
      flipCard.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    };
    flipCard.addEventListener('click', toggleFlip);
    flipCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleFlip();
      }
    });
  }

  wireCorregirCarousel(container, backFace.attempts.length);
}

export function checkCorregirAnswer(exercise, userAnswer) {
  const correctAnswer = exercise.fraseCorrecta.trim();
  // Normalizamos contracciones ("i have" <-> "i've") ANTES de comparar y de
  // partir en palabras, para que "i have" y "i've" cuenten como la misma
  // palabra tanto en el match completo como en la comparación palabra a
  // palabra (evita que se desalineen por tener distinta cantidad de
  // palabras). El texto que se le muestra al usuario (fraseCorrecta,
  // fraseConError, userAnswer tal cual) no se toca en ningún lado.
  const normalize = (str) => normalizeContractions(str).toLowerCase().replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '').trim();

  const isCorrect = normalize(userAnswer) === normalize(correctAnswer);

  const correctWords = normalizeContractions(correctAnswer).split(/\s+/);
  const userWords = normalizeContractions(userAnswer).split(/\s+/);
  const maxLen = Math.max(correctWords.length, userWords.length);
  const comparison = [];

  for (let i = 0; i < maxLen; i++) {
    const cw = correctWords[i] || '';
    const uw = userWords[i] || '';
    comparison.push({ correct: cw, user: uw, match: normalize(cw) === normalize(uw) && cw !== '' });
  }

  const matchedWords = comparison.filter(c => c.match).length;
  const totalWords = correctWords.length;
  // % de acierto palabra a palabra. Igual que en dictado: se acepta la
  // respuesta (aunque no sea 100% exacta) si la precisión llega al 80%.
  const accuracy = totalWords ? matchedWords / totalWords : 0;
  const passed = isCorrect || accuracy >= 0.8;

  return { isCorrect, accuracy, matchedWords, totalWords, passed, comparison };
}

function speakCorregirText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, 100);
}

export function showCorregirModal(exercise, result, userAnswer, onContinue, onRetry) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
  window.speechSynthesis?.cancel();

  const { fraseConError, fraseCorrecta, spanishPhrase } = exercise;
  const { isCorrect, accuracy, matchedWords, totalWords, passed, comparison } = result;
  const accuracyPct = Math.round((accuracy || 0) * 100);

  const comparisonHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    const cls = c.match ? 'word-correct' : 'word-error';
    const icon = c.match ? '✓' : '✗';
    return `<span class="word-pill ${cls}">${icon} ${window._escHTML(c.user || '—')}</span>`;
  }).join('');

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>${isCorrect ? '🎉 ¡Perfecto!' : passed ? '✅ ¡Aceptado!' : '📝 Revisa la corrección'}</h3>
      ${passed ? '<span class="tts-live-badge"><span class="tts-dot"></span>Escuchando la pronunciación</span>' : ''}
      <div class="comparison-text-block">
        
        ${spanishPhrase ? `
          <div class="comparison-row">
            <span class="comparison-row-label">🇪🇸 Frase en español</span>
            <div class="comparison-row-text spanish-reference">${window._escHTML(spanishPhrase)}</div>
          </div>
        ` : ''}
        
        <div class="comparison-row">
          <span class="comparison-row-label">❌ Frase con error</span>
          <div class="comparison-row-text error-highlight">${window._escHTML(fraseConError)}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">✅ Frase correcta</span>
          <div class="comparison-row-text correct-highlight">${window._escHTML(fraseCorrecta)}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">✏️ Tu respuesta</span>
          <div class="comparison-row-text ${isCorrect ? 'correct-highlight' : ''}" style="${isCorrect ? '' : 'color:#fbbf24;'}">${window._escHTML(userAnswer) || '(vacío)'}</div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">🎯 Precisión (mínimo 80% para aprobar)</span>
          <div class="word-diff-wrap">
            <span class="word-pill ${passed ? 'word-correct' : 'word-error'}">${accuracyPct}% · ${matchedWords}/${totalWords} palabras</span>
          </div>
        </div>
        <div class="comparison-row">
          <span class="comparison-row-label">🔍 Comparación palabra a palabra</span>
          <div class="word-diff-wrap">${comparisonHtml || '—'}</div>
        </div>
      </div>
      <div class="modal-doubt-wrap">
        <label class="modal-doubt-label">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..."></textarea>
      </div>
      <div class="modal-buttons">
        ${!passed ? '<button class="fun-btn modal-retry" style="background:#f59e0b;color:#1a120b;">🔄 Reintentar</button>' : ''}
        <button class="fun-btn primary-btn modal-continue">▶️ Continuar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (passed) {
    speakCorregirText(fraseCorrecta);
  }

  const getDuda = () => modal.querySelector('.modal-doubt')?.value?.trim() || '';

  const closeModal = () => {
    window.speechSynthesis?.cancel();
    modal.remove();
  };

  modal.querySelector('.modal-continue').addEventListener("click", (e) => {
    e.stopPropagation();
    closeModal();
    if (onContinue) onContinue(getDuda());
  });

  const retryBtn = modal.querySelector('.modal-retry');
  if (retryBtn) {
    retryBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeModal();
      if (onRetry) onRetry(getDuda());
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
      if (onContinue) onContinue(getDuda());
    }
  });
}

export function getCorregirReportEntry(exercise, userAnswer, duda) {
  return {
    type: "corregir",
    original: exercise.fraseConError,
    expected: exercise.fraseCorrecta,
    spanishPhrase: exercise.spanishPhrase || '',
    userAnswer: userAnswer,
    duda: duda || ''
  };
}