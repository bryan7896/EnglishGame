// ==================== REELS (sorpresa: Tatoeba) ====================
// Feature 5: escuchar una frase corta real (audio humano de Tatoeba) y
// reconstruirla tocando sus palabras en orden, igual en estilo visual que
// exercises/ordenamiento.js (reutiliza sus clases .ord-row/.ord-pill), pero
// con interacción más simple: tocar una palabra del banco la manda al final
// de la respuesta; tocar una palabra de la respuesta la devuelve al banco.
// Cuando el banco queda vacío se revela la traducción al español — no hay
// calificación de "correcto/incorrecto" más allá de eso (fuera de alcance
// según el pedido original).
//
// Caché diaria (independiente por idioma objetivo): un lote de 30 frases se
// trae una sola vez al día y se consume en orden (índice 0, 1, 2…, 29); si
// el índice llega a 30 antes de que cambie el día, Tatoeba no tiene más
// contenido por hoy (ver rlTatoebaAgotadaHoy, usado por Feature 4 para el
// tope diario de este tipo).

// Nota: el host "dev" (api.dev.tatoeba.org) devuelve 0 resultados para
// italiano (lang=ita) aunque sí tiene datos de inglés; el host de
// producción (api.tatoeba.org) sí trae frases italianas con audio, así
// que usamos este último para ambos idiomas.
const RL_TATOEBA_API = "https://api.tatoeba.org/unstable";
const RL_TATOEBA_API_V1 = "https://api.tatoeba.org/v1";
const RL_TATOEBA_KEY = "english_trainer_tatoeba_v1";

function rlTatoebaHoyStr() { return new Date().toLocaleDateString("en-CA"); }
function rlTatoebaLang() { return (typeof getTargetLanguage === "function" && getTargetLanguage() === "it") ? "it" : "en"; }

function rlTatoebaLeerTodo() {
  try { return JSON.parse(localStorage.getItem(RL_TATOEBA_KEY) || "{}") || {}; }
  catch (e) { return {}; }
}
function rlTatoebaGuardarTodo(d) {
  try { localStorage.setItem(RL_TATOEBA_KEY, JSON.stringify(d)); } catch (e) { /* nada */ }
}

// Registro de hoy para el idioma objetivo actual, o null si todavía no se
// pidió nada hoy (en ese caso se asume que SÍ se puede, ver rlTatoebaDisponible).
function rlTatoebaEstadoHoy() {
  const d = rlTatoebaLeerTodo();
  const reg = d[rlTatoebaLang()];
  return reg && reg.fecha === rlTatoebaHoyStr() ? reg : null;
}

// ¿Queda alguna frase sin usar hoy? (o aún no se sabe: se intentará buscar).
function rlTatoebaDisponible() {
  const reg = rlTatoebaEstadoHoy();
  if (!reg) return true;
  return (reg.idx || 0) < (reg.items || []).length;
}

// ¿Ya se acabaron las de hoy? (cero disponibles Y ya se cargó el lote de hoy).
function rlTatoebaAgotadaHoy() {
  const reg = rlTatoebaEstadoHoy();
  return !!reg && (reg.idx || 0) >= (reg.items || []).length;
}

async function rlTatoebaBuscarLote() {
  const lang = rlTatoebaLang() === "it" ? "ita" : "eng";
  const params = new URLSearchParams();
  params.set("lang", lang);
  params.set("sort", "random");
  params.set("word_count", "4-6");
  params.set("has_audio", "yes");
  params.set("limit", "30");
  params.set("include", "audios");
  params.set("showtrans", "all");
  params.append("trans:lang", "spa");
  const url = RL_TATOEBA_API + "/sentences?" + params.toString();
  const res = await fetch(url, { method: "GET", mode: "cors", credentials: "omit", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return (data && data.data) || [];
}

function rlTatoebaAudioUrl(audio) {
  // Preferimos la URL que la propia API ya trae en cada audio (más
  // confiable que construirla a mano); si no viene, caemos a la ruta
  // conocida del servicio v1 por id.
  return audio.download_url || (RL_TATOEBA_API_V1 + "/audios/" + audio.id + "/file");
}

function rlTatoebaTraduccion(sentence) {
  const t = (sentence.translations || []).find((x) => x.lang === "spa");
  return t ? t.text : "";
}

// Trae (cacheando si hace falta) y consume la siguiente frase del día.
// Devuelve null si hoy ya no quedan.
async function rlTatoebaSiguiente() {
  let reg = rlTatoebaEstadoHoy();
  if (!reg) {
    const items = await rlTatoebaBuscarLote();
    reg = { fecha: rlTatoebaHoyStr(), items, idx: 0 };
  }
  if ((reg.idx || 0) >= (reg.items || []).length) {
    const d = rlTatoebaLeerTodo();
    d[rlTatoebaLang()] = reg;
    rlTatoebaGuardarTodo(d);
    return null;
  }
  const pick = reg.items[reg.idx];
  reg.idx = (reg.idx || 0) + 1;
  const d = rlTatoebaLeerTodo();
  d[rlTatoebaLang()] = reg;
  rlTatoebaGuardarTodo(d);
  return pick;
}

// ---------- Render (invocado por el sorteo de "espacio" de Feature 4) ----------
function rlRenderTatoeba(item, body) {
  body.innerHTML = rlCabecera(["🐢 Tatoeba"]) + `
    <div class="rl-sorpresa rl-tatoeba">
      <h2 class="rl-title">Escucha y ordena la frase</h2>
      <p class="rl-sub rl-tatoeba-estado">Buscando una frase…</p>
      <div class="rl-tatoeba-body" hidden>
        <button type="button" class="fun-btn primary-btn rl-tatoeba-play">🔊 Escuchar</button>
        <h3 style="margin:14px 0 6px;">Tu respuesta</h3>
        <div class="ord-row rl-tatoeba-answer"></div>
        <p class="rl-mini rl-tatoeba-feedback" hidden></p>
        <h3 style="margin:14px 0 6px;" class="rl-tatoeba-bank-label">Banco de palabras</h3>
        <div class="ord-row rl-tatoeba-bank"></div>
      </div>
      <div class="rl-hist-foot">
        <button class="fun-btn rl-omitir">⏭ Omitir</button>
        <button class="fun-btn primary-btn rl-continuar" hidden>Continuar ⬆</button>
      </div>
    </div>`;
  const estado = body.querySelector(".rl-tatoeba-estado");
  const wrap = body.querySelector(".rl-tatoeba-body");
  const omitirBtn = body.querySelector(".rl-omitir");
  const continuarBtn = body.querySelector(".rl-continuar");

  let vivo = true;
  RLV.limpiar = () => { vivo = false; };

  const fin = () => rlSorpresaHecha(item);
  omitirBtn.onclick = fin;
  continuarBtn.onclick = fin;

  const sinContenido = (msg) => {
    if (!vivo) return;
    estado.textContent = msg;
    omitirBtn.hidden = true;
    continuarBtn.hidden = false;
  };

  rlTatoebaSiguiente().then((pick) => {
    if (!vivo) return;
    if (!pick) { sinContenido("No hay más frases de Tatoeba por hoy."); return; }
    estado.hidden = true;
    wrap.hidden = false;

    const words = String(pick.text || "").replace(/[?!.¿¡]+$/, "").split(/\s+/).filter(Boolean);
    let bank = shuffleArray(words.map((w, i) => ({ w, i })));
    let answer = [];
    const bankEl = wrap.querySelector(".rl-tatoeba-bank");
    const ansEl = wrap.querySelector(".rl-tatoeba-answer");
    const bankLabel = wrap.querySelector(".rl-tatoeba-bank-label");
    const feedback = wrap.querySelector(".rl-tatoeba-feedback");
    let terminado = false;

    const playAudio = () => {
      const audios = pick.audios || [];
      if (!audios.length) { toast("🔇 Esta frase no tiene audio"); return; }
      try {
        const audio = new Audio(rlTatoebaAudioUrl(audios[0]));
        audio.play().catch((err) => console.warn("Tatoeba: no se pudo reproducir el audio", err));
      } catch (e) { console.warn("Tatoeba: error creando el audio", e); }
    };

    // Al acertar (orden exacto de las palabras originales): suena la frase
    // de nuevo y, donde iba el banco de palabras, aparece la traducción.
    const terminar = () => {
      if (terminado) return;
      terminado = true;
      rlSumarDia("tatoeba");
      feedback.hidden = true;
      playAudio();
      if (bankLabel) bankLabel.textContent = "Traducción";
      const trad = rlTatoebaTraduccion(pick);
      bankEl.innerHTML = trad ? rlEsc(trad) : '<span class="rl-mini">Sin traducción disponible.</span>';
      omitirBtn.hidden = true;
      continuarBtn.hidden = false;
    };

    const pintar = () => {
      bankEl.innerHTML = bank.map((o) => `<button type="button" class="ord-pill" data-i="${o.i}">${rlEsc(o.w)}</button>`).join("");
      ansEl.innerHTML = answer.map((o) => `<button type="button" class="ord-pill" data-i="${o.i}">${rlEsc(o.w)}</button>`).join("");
      bankEl.querySelectorAll(".ord-pill").forEach((b) => {
        b.onclick = () => {
          if (terminado) return;
          const i = parseInt(b.dataset.i, 10);
          const idx = bank.findIndex((o) => o.i === i);
          if (idx < 0) return;
          answer.push(bank[idx]);
          bank.splice(idx, 1);
          pintar();
          if (!bank.length) {
            const esCorrecto = answer.every((o, pos) => o.i === pos);
            if (esCorrecto) {
              terminar();
            } else {
              feedback.hidden = false;
              feedback.textContent = "❌ Ese orden no es correcto. Toca las palabras de tu respuesta para devolverlas y reordenar.";
            }
          } else {
            feedback.hidden = true;
          }
        };
      });
      ansEl.querySelectorAll(".ord-pill").forEach((b) => {
        b.onclick = () => {
          if (terminado) return;
          const i = parseInt(b.dataset.i, 10);
          const idx = answer.findIndex((o) => o.i === i);
          if (idx < 0) return;
          bank.push(answer[idx]);
          answer.splice(idx, 1);
          feedback.hidden = true;
          pintar();
        };
      });
    };
    pintar();

    wrap.querySelector(".rl-tatoeba-play").onclick = playAudio;
    setTimeout(() => { if (vivo) playAudio(); }, 300);
  }).catch((e) => {
    sinContenido("No se pudo cargar Tatoeba (¿sin conexión?).");
    console.warn("Tatoeba error:", e);
  });
}
