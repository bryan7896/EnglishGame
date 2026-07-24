// exercises/dictado.js

const DICTADO_LANG = "en-US";
const DICTADO_RATE = 0.73;

// Mapa "best-effort" nombre de voz -> género. El navegador no expone un
// campo de género real (SpeechSynthesisVoice no lo tiene), así que
// detectamos por el nombre. Cubre las voces en-US más comunes de Chrome,
// Edge/Windows y Safari/macOS. Si una voz no matchea, se trata como
// "unknown" y simplemente entra al pool general.
const VOICE_GENDER_MAP = [
  // típicamente femeninas
  { match: /samantha/i, gender: "female" },
  { match: /victoria/i, gender: "female" },
  { match: /susan/i, gender: "female" },
  { match: /zira/i, gender: "female" },
  { match: /aria/i, gender: "female" },
  { match: /jenny/i, gender: "female" },
  { match: /allison/i, gender: "female" },
  { match: /^google us english$/i, gender: "female" }, // voz por defecto en Chrome
  // típicamente masculinas
  { match: /alex/i, gender: "male" },
  { match: /fred/i, gender: "male" },
  { match: /david/i, gender: "male" },
  { match: /guy/i, gender: "male" },
  { match: /mark/i, gender: "male" },
  { match: /tom/i, gender: "male" },
  { match: /eric/i, gender: "male" },
];

function classifyVoiceGender(voice) {
  const found = VOICE_GENDER_MAP.find((v) => v.match.test(voice.name));
  return found ? found.gender : "unknown";
}

let currentUtterance = null; // Para tracking
let lastVoiceURI = null; // Evita repetir literalmente la misma voz
let lastGender = null; // Para alternar género cuando hay ambos disponibles

// Pre-cargar la lista de voces del sistema apenas se pueda. En Chrome,
// getVoices() suele devolver [] hasta que dispara "voiceschanged".
if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    window.speechSynthesis.getVoices();
  });
}

/**
 * Elige una voz en inglés estadounidense (en-US), alternando entre
 * masculina y femenina cuando el sistema tiene ambas disponibles, y
 * evitando repetir la misma voz dos veces seguidas.
 *
 * Se restringe a en-US (en vez de mezclar en-GB/en-AU/en-IE) porque el
 * objetivo es practicar específicamente la pronunciación estadounidense:
 * mezclar acentos es variedad, pero no ayuda a fijar el oído en un
 * único estándar mientras se está aprendiendo.
 */
function pickUSVoice() {
  const voices = window.speechSynthesis.getVoices();
  const usVoices = voices.filter((v) => v.lang === "en-US" || v.lang === "en_US");
  if (usVoices.length === 0) return null;

  const classified = usVoices.map((v) => ({ voice: v, gender: classifyVoiceGender(v) }));
  const females = classified.filter((v) => v.gender === "female");
  const males = classified.filter((v) => v.gender === "male");

  let pool = classified;
  if (females.length && males.length) {
    // Alterna respecto al género anterior; si no sabemos el anterior, usa todo el pool
    if (lastGender === "female") pool = males;
    else if (lastGender === "male") pool = females;
  }

  let candidates = pool.filter((v) => v.voice.voiceURI !== lastVoiceURI);
  if (candidates.length === 0) candidates = pool.length ? pool : classified;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastVoiceURI = chosen.voice.voiceURI;
  if (chosen.gender !== "unknown") lastGender = chosen.gender;
  return chosen.voice;
}

function speakDictado(text) {
  if (!("speechSynthesis" in window)) return;

  // Cancelar cualquier audio previo
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  currentUtterance = u;

  u.lang = DICTADO_LANG;
  u.rate = DICTADO_RATE;
  u.pitch = 1;
  u.volume = 1;

  // Pequeño delay para asegurar que el cancel se procesó
  setTimeout(() => {
    const voice = pickUSVoice();
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }, 100);
}

function getText(ex) {
  if (typeof ex === 'string') return ex;
  return ex?.text || ex?.phrase || ex?.original || '';
}

export function renderDictadoExercise(exercise, container) {
  // Cancelar audio previo
  window.speechSynthesis.cancel();
  
  const text = getText(exercise);
  
  container.innerHTML = `
    <div class="dictado-container">
      <div class="dictado-audio-area">
        <div class="dictado-audio-icon">🎧</div>
        <div class="dictado-audio-info">
          <div class="dictado-audio-title">Escucha y escribe</div>
          <div class="dictado-audio-subtitle">Reproduce el audio y escribe lo que escuchas</div>
        </div>
        <button class="dictado-play-btn dictado-play" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span>Reproducir</span>
        </button>
      </div>
      <div class="dictado-progress-bar"><div class="dictado-progress-fill dictado-progress"></div></div>
      <div class="dictado-play-count">Reproducciones: <span class="dictado-count">0</span></div>
      <textarea class="dictado-textarea dictado-input" rows="3" placeholder="Escribe aquí lo que escuchaste..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="dictado-input-footer"><span class="dictado-chars">0 caracteres</span></div>
      <div class="dictado-actions">
        <button class="dictado-btn dictado-btn-outline dictado-clear" type="button">🗑️ Limpiar</button>
        <button class="dictado-btn dictado-btn-primary dictado-check" type="button">✅ Comprobar</button>
      </div>
    </div>
  `;
  
  let playCount = 0;
  let autoPlayTimer = null;
  
  const progressBar = container.querySelector('.dictado-progress');
  const countSpan = container.querySelector('.dictado-count');
  const textarea = container.querySelector('.dictado-input');
  const charSpan = container.querySelector('.dictado-chars');
  const playBtn = container.querySelector('.dictado-play');
  const clearBtn = container.querySelector('.dictado-clear');
  const checkBtn = container.querySelector('.dictado-check');
  
  function animate() {
    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      setTimeout(() => {
        if (progressBar) {
          progressBar.style.transition = 'width 2s ease';
          progressBar.style.width = '100%';
        }
      }, 50);
    }
  }
  
  // Auto reproducir con delay (guardar referencia para posible cancelación)
  autoPlayTimer = setTimeout(() => {
    if (document.body.contains(container)) { // Verificar que el container sigue en el DOM
      speakDictado(text);
      playCount++;
      if (countSpan) countSpan.textContent = playCount;
      animate();
    }
  }, 600);
  
  // Guardar el timer para limpiarlo si es necesario
  container._autoPlayTimer = autoPlayTimer;
  
  // Botón de play
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      speakDictado(text);
      playCount++;
      if (countSpan) countSpan.textContent = playCount;
      animate();
    });
  }
  
  // Contador de caracteres
  if (textarea) {
    textarea.addEventListener("input", () => {
      if (charSpan) charSpan.textContent = textarea.value.length + " caracteres";
    });
  }
  
  // Botón limpiar
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (textarea) {
        textarea.value = '';
        if (charSpan) charSpan.textContent = '0 caracteres';
        textarea.focus();
      }
    });
  }
  
  // Comprobar - handler NOMBRADO para poder removerlo
  const checkHandler = function() {
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
    
    // Cancelar audio al comprobar
    window.speechSynthesis.cancel();
    
    const result = checkDictadoAnswer(text, userAnswer);
    showDictadoModal(text, result, userAnswer, (duda) => {
      // Limpiar timer antes de avanzar
      if (container._autoPlayTimer) clearTimeout(container._autoPlayTimer);
      container.dispatchEvent(new CustomEvent('dictado-done', { 
        detail: { originalText: text, userAnswer, result, duda } 
      }));
    });
  };
  
  if (checkBtn) {
    checkBtn.addEventListener("click", checkHandler);
    container._checkHandler = checkHandler;
  }
  
  // Enter para comprobar
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        checkBtn?.click();
      }
    });
  }
  
  // Focus en el textarea
  setTimeout(() => textarea?.focus(), 200);
}

export function checkDictadoAnswer(correctText, userAnswer) {
  const norm = (s) => String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[.,!?;:'"]/g,'').trim();
  const isExact = norm(userAnswer) === norm(correctText);
  const cw = correctText.toLowerCase().replace(/[.,!?;:'"]/g,'').split(/\s+/);
  const uw = userAnswer.toLowerCase().replace(/[.,!?;:'"]/g,'').split(/\s+/);
  let matched = 0;
  const comp = [];
  for (let i=0; i<Math.max(cw.length, uw.length); i++) {
    const c = cw[i]||'', u = uw[i]||'';
    const m = c===u && c!=='';
    if (m) matched++;
    comp.push({correct:c, user:u, match:m});
  }
  return { isExact, accuracy: cw.length ? matched/cw.length : 0, matchedWords: matched, totalWords: cw.length, comparison: comp };
}

export function showDictadoModal(correctText, result, userAnswer, onContinue) {
  // Cancelar audio
  window.speechSynthesis.cancel();
  
  // Eliminar modal existente
  const existing = document.querySelector('.modal-overlay');
  if (existing) existing.remove();
  
  const { isExact, accuracy, matchedWords, totalWords, comparison } = result;
  const accColor = accuracy >= 0.9 ? '#2ecc71' : accuracy >= 0.7 ? '#f39c12' : '#e50914';
  
  const compHtml = comparison.map(c => {
    if (!c.correct && !c.user) return '';
    return `<span class="${c.match?'word-correct':'word-error'}">${window._escHTML(c.user||'—')}</span>`;
  }).join(' ');
  
  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend dictado-modal" style="padding:0;overflow:hidden;">
      <div style="padding:20px 24px;background:${accColor};color:#fff;display:flex;align-items:center;gap:12px;">
        <span style="font-size:2rem;">${isExact?'🏆':accuracy>=0.7?'📝':'🎧'}</span>
        <h3 style="color:#fff;margin:0;">${isExact?'¡Perfecto!':'Resultado'}</h3>
      </div>
      <div style="padding:20px 24px;">
        <div style="background:#111;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="color:#888;font-size:0.75rem;margin-bottom:4px;">✅ Frase correcta</div>
          <div style="color:#2ecc71;font-size:1rem;">${window._escHTML(correctText)}</div>
        </div>
        <div style="background:#111;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="color:#888;font-size:0.75rem;margin-bottom:4px;">✏️ Tu respuesta</div>
          <div style="color:#fbbf24;font-size:1rem;">${window._escHTML(userAnswer)||'(vacío)'}</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex:1;background:#111;border:1px solid ${accColor};border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.3rem;font-weight:700;color:${accColor};">${Math.round(accuracy*100)}%</div>
            <div style="font-size:0.65rem;color:#666;">Precisión</div>
          </div>
          <div style="flex:1;background:#111;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.3rem;font-weight:700;color:#fff;">${matchedWords}</div>
            <div style="font-size:0.65rem;color:#666;">Aciertos</div>
          </div>
          <div style="flex:1;background:#111;border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:1.3rem;font-weight:700;color:#fff;">${totalWords}</div>
            <div style="font-size:0.65rem;color:#666;">Palabras</div>
          </div>
        </div>
        <div style="background:#111;border-radius:8px;padding:14px;margin-bottom:12px;">
          <div style="color:#888;font-size:0.75rem;margin-bottom:6px;">🔍 Comparación</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">${compHtml}</div>
        </div>
        <div style="background:#111;border-radius:8px;padding:14px;margin-bottom:12px;">
          <label style="color:#888;font-size:0.8rem;">💭 Consulta (opcional)</label>
          <textarea class="answer-input dictado-modal-doubt" rows="2" placeholder="Tu consulta..." style="font-size:0.85rem;min-height:45px;width:100%;"></textarea>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;">
        <button class="dictado-modal-btn dictado-modal-continue" style="width:100%;background:#e50914;color:#fff;border:none;border-radius:8px;padding:14px;font-size:0.9rem;font-weight:600;cursor:pointer;">▶️ Continuar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const continueBtn = modal.querySelector('.dictado-modal-continue');
  const doubtInput = modal.querySelector('.dictado-modal-doubt');
  
  const close = () => {
    const duda = doubtInput?.value?.trim() || '';
    modal.remove();
    window.speechSynthesis.cancel(); // Cancelar audio al cerrar
    if (onContinue) onContinue(duda);
  };
  
  continueBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
}

export function getDictadoReportEntry(originalText, userAnswer, duda) {
  return { type:"dictado", original:originalText, userAnswer, duda:duda||'' };
}