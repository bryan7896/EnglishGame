// exercises/traduccion.js

export function normalizeWord(w) {
  // a-z + acentos españoles (á é í ó ú) Y los graves del italiano
  // (à è ì ò ù, MUY comunes: "è", "città", "però") — antes solo se
  // aceptaban los agudos, así que estas letras se recortaban mal en el
  // resaltado palabra-por-palabra y en el % de precisión de las frases
  // en italiano.
  return String(w || "").toLowerCase().replace(/[^a-zàèìòùáéíóúüñ]/g, '');
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

// Igual que alignWords, pero una contracción equivale a sus dos palabras
// ("She's" = "She has", "don't" = "do not"), en cualquiera de los dos lados.
// Así el resaltado no pinta de rojo una contracción que sí se acepta.
function _caStrip(w) { return normalizeQuotes(String(w || "")).replace(/[.,!?;:"()¿¡]/g, ""); }
function _caEq(corto, w1, w2, ctx) {
  if (!/'/.test(normalizeQuotes(corto))) return false;
  const c = ctx ? " " + _caStrip(ctx) : "";
  return contractionAwareEquals(_caStrip(corto) + c, _caStrip(w1) + " " + _caStrip(w2) + c);
}
export function alignWordsContracciones(correct, user) {
  const C = String(correct || "").trim().split(/\s+/).filter(Boolean);
  const U = String(user || "").trim().split(/\s+/).filter(Boolean);
  const n = C.length, m = U.length;
  const eq = (i, j) => normalizeWord(C[i]) === normalizeWord(U[j]);
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let v = Math.max(dp[i - 1][j], dp[i][j - 1]);
      if (eq(i - 1, j - 1)) v = Math.max(v, dp[i - 1][j - 1] + 1);
      if (i >= 2 && _caEq(U[j - 1], C[i - 2], C[i - 1], C[i])) v = Math.max(v, dp[i - 2][j - 1] + 2);
      if (j >= 2 && _caEq(C[i - 1], U[j - 2], U[j - 1], U[j])) v = Math.max(v, dp[i - 1][j - 2] + 2);
      dp[i][j] = v;
    }
  }
  const ac = [], au = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && eq(i - 1, j - 1) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ac.unshift({ word: C[i - 1], match: true }); au.unshift({ word: U[j - 1], match: true }); i--; j--;
    } else if (i >= 2 && j > 0 && _caEq(U[j - 1], C[i - 2], C[i - 1], C[i]) && dp[i][j] === dp[i - 2][j - 1] + 2) {
      ac.unshift({ word: C[i - 2], match: true }, { word: C[i - 1], match: true }); au.unshift({ word: U[j - 1], match: true }); i -= 2; j--;
    } else if (j >= 2 && i > 0 && _caEq(C[i - 1], U[j - 2], U[j - 1], U[j]) && dp[i][j] === dp[i - 1][j - 2] + 2) {
      ac.unshift({ word: C[i - 1], match: true }); au.unshift({ word: U[j - 2], match: true }, { word: U[j - 1], match: true }); i--; j -= 2;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ac.unshift({ word: "", placeholder: true }); au.unshift({ word: U[j - 1], match: false }); j--;
    } else {
      ac.unshift({ word: C[i - 1], match: false }); au.unshift({ word: "", placeholder: true }); i--;
    }
  }
  return { alignedCorrect: ac, alignedUser: au };
}

// ---------------------------------------------------------------------
// Tarjeta simple (usada por traducción Y ordenamiento, ver ordenamiento.js):
// la frase en español arriba y, justo debajo, la actividad. Sin volteo ni
// textos de ayuda — el usuario ya sabe cómo funciona.
// ---------------------------------------------------------------------
export function renderTraduccionExercise(exercise, container) {
  const spanish = exercise.spanishWord || exercise.spanishWords || "";
  // Banco de palabras: en inglés, las palabras de 3+ letras del texto en
  // español quedan clickeables (sin cambiar su apariencia); en italiano
  // (o si el módulo no está cargado) se comporta como antes.
  const spanishHtml = (typeof BancoPalabrasUI !== "undefined") ? BancoPalabrasUI.html(spanish) : window._escHTML(spanish);
  container.innerHTML = `
    <div class="question-bubble">${spanishHtml}</div>
    <textarea class="answer-input traduccion-answer" rows="2" placeholder="Escribe tu traducción aquí..."></textarea>
    <div class="button-group">
      <button class="btn-action btn-check traduccion-check">Comprobar</button>
    </div>
  `;
  if (typeof BancoPalabrasUI !== "undefined") BancoPalabrasUI.activar(container.querySelector(".question-bubble"));
}

function normalizeFullAnswer(str) {
  return normalizeContractions(String(str || ""))
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFullyCorrectAnswer(correctText, userAnswer) {
  return normalizeFullAnswer(correctText) === normalizeFullAnswer(userAnswer);
}

// % de acierto palabra a palabra (a partir del alineamiento tipo diff).
// Igual que en corregir/dictado: se acepta la respuesta aunque no sea
// 100% exacta si la precisión llega al 80%.
function computeAccuracy(alignedCorrect) {
  const realWords = alignedCorrect.filter(item => !item.placeholder);
  if (realWords.length === 0) return 0;
  const matched = realWords.filter(item => item.match).length;
  return matched / realWords.length;
}

function speakTraduccionText(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getTargetLangMeta().ttsLang;
    utterance.rate = 0.9;
    applyPreferredVoice(utterance, getTargetLangMeta().code);
    window.speechSynthesis.speak(utterance);
  }, 100);
}

// ---------------------------------------------------------------------
// Botón "Repasar luego" (compartido por los modales de resultado de
// traducción, completar, corrección y dictado). Siempre visible, sin
// importar el puntaje (0% a 100%): es el usuario quien decide.
//   - "luego": en Reels, el ejercicio vuelve a salir 3-8 tarjetas después.
// La decisión llega al motor principal como último argumento de onContinue.
// ---------------------------------------------------------------------
export function reviewButtonsHTML() {
  return `
    <div class="modal-review-buttons">
      <button type="button" class="fun-btn review-btn review-btn-later" data-review="luego">
        <span>🧠 Repasar luego</span><span class="review-btn-sub">vuelve en unos ejercicios</span>
      </button>
    </div>
  `;
}

export function wireReviewButtons(modal, done) {
  modal.querySelectorAll('[data-review]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      done(btn.dataset.review);
    });
  });
}

// Palabra de la frase "Esperado" (inglés o italiano, según el idioma
// activo) lista para precargarla en el mini-modal de Tatoeba. Se recorta la
// puntuación de los extremos (el diff la deja pegada, p.ej. "taxi." o
// "day.") y solo se hace clickeable si queda con 3+ letras — mismo criterio
// que el Banco de palabras usa del lado español.
function targetWordSpan(word, cls) {
  const escaped = window._escHTML(word);
  if (typeof BancoPalabrasUI === "undefined") return `<span class="${cls}">${escaped}</span>`;
  const limpio = String(word || "").replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, "");
  if (limpio.length < 3) return `<span class="${cls}">${escaped}</span>`;
  return `<span class="${cls} bp-target-word" data-bp-word="${window._escHTML(limpio.toLowerCase())}">${escaped}</span>`;
}

export function showComparativeModal(exercise, userAnswer, onContinue) {
  const existingModal = document.querySelector('.modal-overlay');
  if (existingModal) existingModal.remove();
  window.speechSynthesis?.cancel();
  
  const correctText = exercise.englishWord || exercise.englishWords;
  const isCorrect = isFullyCorrectAnswer(correctText, userAnswer);
  // Para MOSTRAR el diff se usa el texto tal cual (sin tocar lo que el
  // usuario escribió). Para CALCULAR la precisión se usa una versión con
  // las contracciones normalizadas, así "i have" vs "i've" no penaliza el
  // puntaje aunque en el diff visual se vean como palabras distintas.
  const { alignedCorrect, alignedUser } = alignWordsContracciones(correctText, userAnswer);
  const { alignedCorrect: matchAlignedCorrect } = alignWords(
    normalizeContractions(correctText),
    normalizeContractions(userAnswer)
  );
  const accuracy = Math.min(1, Math.max(computeAccuracy(alignedCorrect), computeAccuracy(matchAlignedCorrect)));
  const accuracyPct = Math.round(accuracy * 100);
  const passed = isCorrect || accuracy >= 0.8;
  
  let correctHtml = alignedCorrect.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return targetWordSpan(item.word, item.match ? 'word-correct' : 'word-error');
  }).join(' ');
  
  let userHtml = alignedUser.map(item => {
    if (item.placeholder) return `<span class="word-placeholder">-</span>`;
    return `<span class="${item.match ? 'word-correct' : 'word-error'}">${window._escHTML(item.word)}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      ${passed ? '<span class="tts-live-badge"><span class="tts-dot"></span>Escuchando la pronunciación</span>' : ''}
      <div class="comparison-text-block">
        <p><strong>🇪🇸 Español:</strong><br>🎯 ${window._escHTML(exercise.spanishWord || exercise.spanishWords)}</p>
        <div class="compare-line compare-line-esperado"><strong>✅ Esperado:</strong> ${correctHtml}</div>
        <div class="compare-line"><strong>✏️ Tu respuesta:</strong> ${userHtml}</div>
        <div class="comparison-row">
          <span class="comparison-row-label"></span>
          <div class="word-diff-wrap">
            <span class="word-pill ${passed ? 'word-correct' : 'word-error'}">${accuracyPct}%</span>
          </div>
        </div>
      </div>
      <div style="margin-top:12px;text-align:left;">
        <label style="color:#94a3b8;font-size:0.8rem;">💭 Consulta (opcional)</label>
        <textarea class="answer-input modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
      </div>
      ${reviewButtonsHTML()}
      <div class="modal-buttons">
        <button class="fun-btn primary-btn modal-continue">Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  if (typeof BancoPalabrasUI !== "undefined") BancoPalabrasUI.activarEsperado(modal.querySelector(".compare-line-esperado"));

  if (passed) {
    speakTraduccionText(correctText);
  }
  
  // decision: undefined (solo continuar) | "repasar" | "luego"
  const close = (decision) => {
    const duda = modal.querySelector('.modal-doubt')?.value?.trim() || '';
    window.speechSynthesis?.cancel();
    modal.remove();
    if (onContinue) onContinue(duda, passed, decision || null);
  };
  
  modal.querySelector('.modal-continue').addEventListener("click", () => close());
  wireReviewButtons(modal, close);
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