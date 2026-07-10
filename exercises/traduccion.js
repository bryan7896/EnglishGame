// exercises/traduccion.js

export function normalizeWord(w) {
  return String(w || "").toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
}

export function alignWords(correct, user) {
  const correctWords = correct.split(/\s+/);
  const userWords = user.split(/\s+/);
  const n = correctWords.length, m = userWords.length;
  
  const dp = Array.from({length: n+1}, () => Array(m+1).fill(0));
  for (let i=1; i<=n; i++) {
    for (let j=1; j<=m; j++) {
      if (normalizeWord(correctWords[i-1]) === normalizeWord(userWords[j-1])) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }
  
  let i = n, j = m;
  const alignedCorrect = [], alignedUser = [];
  
  while (i > 0 || j > 0) {
    if (i>0 && j>0 && normalizeWord(correctWords[i-1]) === normalizeWord(userWords[j-1])) {
      alignedCorrect.unshift({word: correctWords[i-1], match: true});
      alignedUser.unshift({word: userWords[j-1], match: true});
      i--; j--;
    } else if (j>0 && (i===0 || dp[i][j-1] >= dp[i-1][j])) {
      alignedCorrect.unshift({word: '', placeholder: true});
      alignedUser.unshift({word: userWords[j-1], match: false});
      j--;
    } else {
      alignedCorrect.unshift({word: correctWords[i-1], match: false});
      alignedUser.unshift({word: '', placeholder: true});
      i--;
    }
  }
  
  return { alignedCorrect, alignedUser };
}

export function renderTraduccionExercise(exercise, container) {
  container.innerHTML = `
    <div class="question-bubble">${exercise.spanishWord || exercise.spanishWords}</div>
    <textarea class="answer-input traduccion-answer" rows="2" placeholder="Escribe tu traducción aquí..."></textarea>
    <div class="button-group">
      <button class="btn-action btn-check traduccion-check">✅ Comprobar</button>
    </div>
  `;
}

export function showComparativeModal(exercise, userAnswer, onContinue) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
  
  const correctText = exercise.englishWord || exercise.englishWords;
  const { alignedCorrect, alignedUser } = alignWords(correctText, userAnswer);
  
  let correctHtml = alignedCorrect.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return `<span class="${item.match ? 'word-correct' : 'word-error'}">${window._escHTML(item.word)}</span>`;
  }).join(' ');
  
  let userHtml = alignedUser.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return `<span class="${item.match ? 'word-correct' : 'word-error'}">${window._escHTML(item.word)}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>📊 Comparación</h3>
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>${window._escHTML(exercise.spanishWord || exercise.spanishWords)}</p>
        <div class="compare-line"><strong>✅ Correcto:</strong> ${correctHtml}</div>
        <div class="compare-line"><strong>✏️ Tu respuesta:</strong> ${userHtml}</div>
      </div>
      <div style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn modal-continue">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const close = () => {
    const duda = modal.querySelector('.modal-doubt')?.value?.trim() || '';
    modal.remove();
    if (onContinue) onContinue(duda);
  };
  
  modal.querySelector('.modal-continue').addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
}

export function getTraduccionReportEntry(exercise, userAnswer, duda) {
  return {
    type: "traduccion",
    original: exercise.spanishWord || exercise.spanishWords,
    expected: exercise.englishWord || exercise.englishWords,
    userAnswer: userAnswer,
    duda: duda || ''
  };
}