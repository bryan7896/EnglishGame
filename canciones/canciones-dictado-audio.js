// canciones/canciones-dictado-audio.js — "Aprender canción" (Parte 4, Nivel 7)
//
// Igual que exercises/dictado.js pero reproduciendo el tramo REAL del mp3
// (si ya hay .lrc) en vez de la voz del dispositivo. Se hace como
// componente propio (en vez de tocar dictado.js, que usa el resto de la
// app) para no arriesgar nada ahí — reutiliza tal cual
// checkDictadoAnswer()/showDictadoModal() de dictado.js (ya son genéricas:
// solo comparan texto y muestran un modal, no saben nada de audio), así que
// el criterio de aprobación (80%, ver dictado.js) es exactamente el mismo.
//
// exercise: { text, audio: {lang,n,t0,t1} | null }
// Dispara "dictado-done" con el mismo detalle que renderDictadoExercise,
// para que reels2.js lo enchufe con el mismo tipo de listener.

export function renderCancionDictadoExercise(exercise, container) {
  window.speechSynthesis?.cancel();
  const { text, audio } = exercise;

  container.innerHTML = `
    <div class="dictado-container">
      <div class="dictado-audio-area">
        <div class="dictado-audio-icon">🎧</div>
        <div class="dictado-audio-info">
          <div class="dictado-audio-title">Escucha y escribe</div>
          <div class="dictado-audio-subtitle">${audio ? "Es el audio real de la canción" : "Reproduce el audio y escribe lo que escuchas"}</div>
        </div>
        <button class="dictado-play-btn cda-play" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span>Reproducir</span>
        </button>
      </div>
      <div class="dictado-progress-bar"><div class="dictado-progress-fill cda-progress"></div></div>
      <div class="dictado-play-count">Reproducciones: <span class="cda-count">0</span></div>
      <textarea class="dictado-textarea cda-input" rows="3" placeholder="Escribe aquí lo que escuchaste..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea>
      <div class="dictado-input-footer"><span class="cda-chars">0 caracteres</span></div>
      <div class="dictado-actions">
        <button class="dictado-btn dictado-btn-outline cda-clear" type="button">🗑️ Limpiar</button>
        <button class="dictado-btn dictado-btn-primary cda-check" type="button">Comprobar</button>
      </div>
    </div>
  `;

  let playCount = 0;
  const progressBar = container.querySelector(".cda-progress");
  const countSpan = container.querySelector(".cda-count");
  const textarea = container.querySelector(".cda-input");
  const charSpan = container.querySelector(".cda-chars");
  const playBtn = container.querySelector(".cda-play");
  const clearBtn = container.querySelector(".cda-clear");
  const checkBtn = container.querySelector(".cda-check");

  function animate() {
    if (!progressBar) return;
    progressBar.style.transition = "none";
    progressBar.style.width = "0%";
    setTimeout(() => {
      if (progressBar) { progressBar.style.transition = "width 2s ease"; progressBar.style.width = "100%"; }
    }, 50);
  }

  function reproducir() {
    if (audio) {
      const cancion = { lang: audio.lang, n: audio.n, id: audio.lang + "_" + audio.n };
      const { detener } = cancionAudioReproducirTramo(cancion, audio.t0, audio.t1);
      container._cdaAudioDetener = detener;
    } else {
      speakDictado(text);
    }
    playCount++;
    if (countSpan) countSpan.textContent = playCount;
    animate();
  }

  const autoPlayTimer = setTimeout(() => { if (document.body.contains(container)) reproducir(); }, 600);
  container._cdaAutoPlayTimer = autoPlayTimer;

  playBtn?.addEventListener("click", reproducir);

  textarea?.addEventListener("input", () => {
    if (charSpan) charSpan.textContent = textarea.value.length + " caracteres";
  });

  clearBtn?.addEventListener("click", () => {
    if (textarea) { textarea.value = ""; if (charSpan) charSpan.textContent = "0 caracteres"; textarea.focus(); }
  });

  const checkHandler = () => {
    const userAnswer = textarea ? textarea.value.trim() : "";
    if (!userAnswer) {
      if (textarea) {
        textarea.style.borderColor = "#e50914";
        textarea.placeholder = "⚠️ Por favor escribe lo que escuchaste...";
        setTimeout(() => {
          if (textarea) { textarea.style.borderColor = ""; textarea.placeholder = "Escribe aquí lo que escuchaste..."; }
        }, 2000);
      }
      return;
    }
    if (container._cdaAudioDetener) container._cdaAudioDetener();
    window.speechSynthesis?.cancel();
    const result = checkDictadoAnswer(text, userAnswer);
    showDictadoModal(text, result, userAnswer, (duda, decision) => {
      if (container._cdaAutoPlayTimer) clearTimeout(container._cdaAutoPlayTimer);
      container.dispatchEvent(new CustomEvent("dictado-done", { detail: { originalText: text, userAnswer, result, duda, decision } }));
    });
  };
  checkBtn?.addEventListener("click", checkHandler);

  textarea?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); checkBtn?.click(); }
  });

  setTimeout(() => textarea?.focus(), 200);
}

export function cancionDictadoAudioLimpiar(container) {
  if (!container) return;
  if (container._cdaAutoPlayTimer) clearTimeout(container._cdaAutoPlayTimer);
  if (container._cdaAudioDetener) container._cdaAudioDetener();
}
