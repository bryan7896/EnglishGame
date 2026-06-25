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
  const alignedCorrect = [];
  const alignedUser = [];
  
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
    <div class="question-bubble" id="spanishPrompt">${exercise.spanishWord || exercise.spanishWords}</div>
    <textarea id="answerInput" class="answer-input" rows="2" placeholder="Escribe tu traducción aquí..."></textarea>
    <div class="button-group">
      <button class="btn-action btn-check" id="checkBtn">✅ Comprobar</button>
      <button class="btn-action btn-continue" id="continueBtn" style="display: none;">➡️ Continuar</button>
    </div>
    <div class="mood-card">
      <div class="mood-emoji" id="exerciseEmoji">🧸</div>
      <div>
        <strong id="exerciseMoodTitle">¡A traducir!</strong><br>
        <span id="exerciseMoodText">Escribe y comprueba</span>
      </div>
    </div>
  `;
}

export function showComparativeModal(exercise, userAnswer, onContinue) {
  const correctWords = (exercise.englishWord || exercise.englishWords).split(/\s+/);
  const { alignedCorrect, alignedUser } = alignWords(exercise.englishWord || exercise.englishWords, userAnswer);
  
  let correctHtml = alignedCorrect.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return `<span class="${item.match ? 'word-correct' : 'word-error'}">${item.word}</span>`;
  }).join(' ');
  
  let userHtml = alignedUser.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return `<span class="${item.match ? 'word-correct' : 'word-error'}">${item.word}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-friend">
      <h3>📊 Comparación palabra por palabra</h3>
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>${exercise.spanishWord || exercise.spanishWords}</p>
        <div class="compare-line">
          <strong>✅ Correcto:</strong>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">${correctHtml}</div>
        </div>
        <div class="compare-line">
          <strong>✏️ Tu respuesta:</strong>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">${userHtml}</div>
        </div>
      </div>
      <div class="doubt-field" style="margin-top:12px; text-align:left;">
        <label style="color:#94a3b8; font-size:0.8rem; display:block; margin-bottom:4px;">
          💭 Consulta o duda sobre este ejercicio (opcional)
        </label>
        <textarea id="modalDoubtInput" class="answer-input" rows="2" 
          placeholder="Escribe tu consulta aquí..." 
          style="font-size:0.85rem; min-height:45px; width:100%;"></textarea>
      </div>
      <div class="modal-buttons">
        <button class="fun-btn primary-btn" id="modalContinueBtn" style="flex:1">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  document.getElementById("modalContinueBtn").addEventListener("click", () => {
    const duda = document.getElementById("modalDoubtInput").value.trim();
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

export function getTraduccionReportEntry(exercise, userAnswer, duda) {
  return {
    type: "traduccion",
    original: exercise.spanishWord || exercise.spanishWords,
    expected: exercise.englishWord || exercise.englishWords,
    userAnswer: userAnswer,
    duda: duda || ''
  };
}