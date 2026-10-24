// canciones/canciones-audio-seleccion.js — "Aprender canción" (Parte 3)
//
// Ejercicio nuevo que pidió Bryan: suena una frase en el idioma objetivo y
// abajo aparecen 4 opciones en español — el usuario toca la traducción
// correcta. Mismo contrato de evento que dictado.js (self-contained, dispara
// un CustomEvent al terminar) para que reels2.js lo enchufe sin adaptador.
//
// Audio: en los Niveles 1-2 (antes de la pantalla de felicitaciones) se usa
// la voz del dispositivo (speechSynthesis), igual que como ya se reproducen
// los ejercicios de traducción al acertar — así lo pidió Bryan explícitamente
// ("previo a las felicitaciones... los textos los leerá el propio
// dispositivo"). Desde la Parte 4, si el ejercicio trae `exercise.audio`
// ({lang, n, t0, t1} — ver canciones-generador.js Niveles 4/5 y canciones-
// lrc.js) se reproduce el tramo real del mp3 en su lugar; si no lo trae (no
// hay .lrc todavía, o el ejercicio es de los Niveles 1-2), cae solo a la voz
// del dispositivo — mismo criterio permisivo del resto de la sección.

function casShuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function casSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = getTargetLangMeta().ttsLang;
    u.rate = 0.85;
    applyPreferredVoice(u, getTargetLangMeta().code);
    window.speechSynthesis.speak(u);
  }, 100);
}

// exercise: { audioText, correct, distractors, audio? } (ver canciones-generador.js;
// `audio` es opcional, desde la Parte 4)
export function renderAudioSeleccionExercise(exercise, container) {
  const { audioText, correct, distractors, audio } = exercise;

  // Hasta 4 opciones (correcta + hasta 3 distractores); si el JSON trae
  // menos de 3 distractores, el ejercicio igual funciona con las que haya
  // (mínimo 2: la correcta + 1), mismo criterio permisivo del resto de la
  // sección.
  const opciones = casShuffle([correct, ...(distractors || [])]);

  container.innerHTML = `
    <div class="cas-wrap">
      <div class="question-bubble">🎧 Escucha y elige la traducción correcta</div>
      <div class="cas-audio-row">
        <button type="button" class="cas-play fun-btn primary-btn">🔊 Reproducir</button>
      </div>
      <div class="cas-options">
        ${opciones.map((o, i) => `<button type="button" class="cas-opt" data-i="${i}">${window._escHTML(o)}</button>`).join("")}
      </div>
    </div>
  `;

  const playBtn = container.querySelector(".cas-play");
  const play = () => {
    if (audio && typeof cancionAudioReproducirTramo === "function") {
      const cancion = { lang: audio.lang, n: audio.n, id: audio.lang + "_" + audio.n };
      const { detener } = cancionAudioReproducirTramo(cancion, audio.t0, audio.t1);
      container._casAudioDetener = detener;
    } else {
      casSpeak(audioText);
    }
  };
  playBtn.onclick = play;
  const autoPlayTimer = setTimeout(() => { if (document.body.contains(container)) play(); }, 400);
  container._casAutoPlayTimer = autoPlayTimer;

  let resuelto = false;
  container.querySelectorAll(".cas-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (resuelto) return;
      resuelto = true;
      const ok = btn.textContent === correct;
      container.querySelectorAll(".cas-opt").forEach((b) => { b.disabled = true; });
      btn.classList.add(ok ? "cas-opt-ok" : "cas-opt-bad");
      if (!ok) {
        const correctBtn = Array.from(container.querySelectorAll(".cas-opt")).find((b) => b.textContent === correct);
        if (correctBtn) correctBtn.classList.add("cas-opt-ok");
      }
      window.speechSynthesis?.cancel();
      if (container._casAudioDetener) container._casAudioDetener();
      setTimeout(() => {
        container.dispatchEvent(new CustomEvent("audioseleccion-done", { detail: { passed: ok } }));
      }, ok ? 650 : 1300);
    });
  });
}
