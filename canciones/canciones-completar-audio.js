// canciones/canciones-completar-audio.js — "Aprender canción" (Parte 4)
//
// Ejercicio nuevo "completarCancion": como el "completar" de siempre
// (exercises/completar.js) pero con VARIAS líneas a la vez (una estrofa
// entera en el Nivel 6, la canción completa en el Nivel 8) y, si ya hay
// .lrc, un botón de reproducir que suena el tramo real del mp3 y va
// marcando "estilo karaoke" la línea que está sonando (ver
// canciones-lrc.js: cancionAudioReproducirTramo / cancionKaraokeActivar).
//
// Reutiliza el mismo CSS de .completar-sentence/.completar-input (ver
// styles/main.css) para que los huecos se vean igual que en el resto de la
// app, y usa las mismas clases (.completar-input/.completar-check) para que
// `checkCompletarAnswers`/`isCompletarPassed` de exercises/completar.js
// funcionen tal cual, sin adaptador — solo el render y el modal son propios
// (una sola tarjeta con varias líneas no entra en el modal genérico de
// "completar").
//
// exercise: { spanishWord, prompt, lineas: [{idPlano,text,t0,t1}], options,
//             audio: {lang,n,t0,t1} | null, karaoke: bool }

export function renderCancionCompletarExercise(exercise, container) {
  const { spanishWord, prompt, lineas, audio, karaoke } = exercise;

  let inputIndex = 0;
  const lineasHtml = (lineas || []).map((l) => {
    const html = String(l.text || "").replace(/___/g, () => {
      const input = `<input type="text" class="completar-input" data-idx="${inputIndex}" placeholder="?" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">`;
      inputIndex++;
      return input;
    });
    return `<div class="cancion-karaoke-line" data-karaoke-id="${window._escHTML(l.idPlano)}">${html || "&nbsp;"}</div>`;
  }).join("");

  container.innerHTML = `
    <div class="cca-wrap">
      ${spanishWord ? `<div class="question-bubble">${window._escHTML(spanishWord)}</div>` : ""}
      <p class="sub-fun">${window._escHTML(prompt || "")}</p>
      ${audio ? `<div class="cas-audio-row"><button type="button" class="cca-play fun-btn primary-btn">🔊 Reproducir</button></div>` : ""}
      <div class="cancion-karaoke-box completar-sentence">${lineasHtml}</div>
    </div>
    <div class="button-group">
      <button class="btn-action btn-check completar-check">Comprobar</button>
    </div>
  `;

  if (audio) {
    const cancion = { lang: audio.lang, n: audio.n, id: audio.lang + "_" + audio.n };
    const playBtn = container.querySelector(".cca-play");
    const play = () => {
      if (container._ccaKaraokeDetener) { container._ccaKaraokeDetener(); container._ccaKaraokeDetener = null; }
      const { audio: audioEl, detener } = cancionAudioReproducirTramo(cancion, audio.t0, audio.t1);
      container._ccaAudioDetener = detener;
      if (karaoke) {
        const lineasTiempos = (lineas || []).filter((l) => l.t0 != null).map((l) => ({ idPlano: l.idPlano, t0: l.t0, t1: l.t1 }));
        if (lineasTiempos.length) container._ccaKaraokeDetener = cancionKaraokeActivar(container, lineasTiempos, audioEl);
      }
    };
    playBtn.onclick = play;
    const autoPlayTimer = setTimeout(() => { if (document.body.contains(container)) play(); }, 500);
    container._ccaAutoPlayTimer = autoPlayTimer;
  }

  const inputs = container.querySelectorAll(".completar-input");
  inputs.forEach((input, idx) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (idx < inputs.length - 1) inputs[idx + 1].focus();
        else container.querySelector(".completar-check")?.click();
      }
    });
  });
}

// Llamar al salir de la tarjeta (cambio de ejercicio o cierre de la
// sección) para no dejar el audio sonando ni el listener de karaoke vivo.
export function cancionCompletarAudioLimpiar(container) {
  if (!container) return;
  if (container._ccaAutoPlayTimer) clearTimeout(container._ccaAutoPlayTimer);
  if (container._ccaAudioDetener) container._ccaAudioDetener();
  if (container._ccaKaraokeDetener) container._ccaKaraokeDetener();
}

// Mismo criterio de aprobación que isCompletarPassed (exercises/completar.js):
// 100% o al menos 80% de los huecos. Se deja una copia acá (en vez de
// importar) porque ambos archivos viven en el mismo scope de módulo del
// build y no hace falta: se usa la función tal cual la define completar.js.

export function showCancionCompletarModal(exercise, results, onContinue) {
  const existente = document.querySelector(".modal-overlay");
  if (existente) existente.remove();

  const passed = isCompletarPassed(results);
  const okCount = results.filter((r) => r.isCorrect).length;
  const accuracyPct = results.length ? Math.round((okCount / results.length) * 100) : 100;

  const resultsHtml = results.map((r, idx) => {
    const status = r.isCorrect ? "✅" : "❌";
    const color = r.isCorrect ? "#4ade80" : "#f87171";
    return `<div style="color:${color};margin:4px 0;">${status} Hueco ${idx + 1}: "${window._escHTML(r.userAnswer) || "(vacío)"}" → "${window._escHTML(r.correctAnswer)}"</div>`;
  }).join("");

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-active";
  modal.innerHTML = `
    <div class="modal-friend">
      <div class="comparison-text-block">
        ${exercise.spanishWord ? `<p><strong>🇪🇸 Español:</strong><br>${window._escHTML(exercise.spanishWord)}</p>` : ""}
        <p><strong>📊 Resultados:</strong></p>${resultsHtml}
        <div class="comparison-row">
          <span class="comparison-row-label"></span>
          <div class="word-diff-wrap">
            <span class="word-pill ${passed ? "word-correct" : "word-error"}">${accuracyPct}% · ${okCount}/${results.length} huecos</span>
          </div>
        </div>
      </div>
      ${reviewButtonsHTML()}
      <div class="modal-buttons">
        <button class="fun-btn primary-btn modal-continue">Continuar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = (decision) => {
    modal.remove();
    if (onContinue) onContinue(passed, decision || null);
  };
  modal.querySelector(".modal-continue").addEventListener("click", () => close());
  wireReviewButtons(modal, close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
}
