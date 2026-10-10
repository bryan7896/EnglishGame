// listening/exercises/listening-core.js
//
// Capa base del módulo de Listening (Nivel 0). No toca nada de
// English Trainer existente: su propia llave de localStorage, su propia
// fuente de datos (NIVEL0_EXERCISES, inyectada por build.py desde
// listening/data/nivel0.json), su propio estado en memoria.
//
// Por ahora (entrega 1) solo expone lo que listening-map.js necesita para
// pintar las 7 level cards: metadata de bloques, progreso guardado y
// cálculo de desbloqueo secuencial. El motor de ejercicios (reproducir
// audio, calificar, guardar resultados reales) llega en las próximas
// entregas — hoy el progreso siempre arranca vacío.

const LISTENING_STORAGE_KEY = "listening_nivel0_v1";
const LISTENING_TOTAL_BLOQUES = 7;
const LISTENING_EJERCICIOS_POR_BLOQUE = 100;

// Versión del sistema de calificación de los bloques 4-7 (dictado de frases).
// v2 = calificación por "objetivo" (la contracción / la forma completa / el
// posesivo / el número / el homófono según la categoría) en vez de la frase
// completa. Un intento a medias guardado con otra versión no se puede
// mezclar con el nuevo criterio, así que se descarta (ver
// loadListeningProgress). Los bloques 1-3 NO cambian de criterio, por eso
// su progreso y sus resultados no se tocan nunca.
const LISTENING_SCORING_VERSION = 2;
const LISTENING_SCORING_FROM_BLOQUE = 4;

// Metadata fija de los 7 bloques del Nivel 0 — nombre corto, ícono y
// descripción de qué mide cada uno, para que la pantalla de inicio sea
// informativa sin depender de una imagen de fondo.
const LISTENING_BLOQUES_META = [
  { bloque: 1, icono: "🔊", titulo: "Vocales", descripcion: "Pares mínimos vocálicos (ship/sheep, cat/cut...)" },
  { bloque: 2, icono: "👄", titulo: "Consonantes", descripcion: "Pares mínimos consonánticos (think/sink, berry/very...)" },
  { bloque: 3, icono: "🧠", titulo: "Reconocimiento libre", descripcion: "Palabra completa sin opciones, incluye reducción vocálica (schwa)" },
  { bloque: 4, icono: "💬", titulo: "Contracciones", descripcion: "Formas reducidas afirmativas y negativas en frases cortas" },
  { bloque: 5, icono: "🧩", titulo: "Morfología", descripcion: "Variantes fonéticas de -ed, -s y posesivo" },
  { bloque: 6, icono: "🌊", titulo: "Habla conectada", descripcion: "Linking, elision, asimilación y frases de distinta longitud" },
  { bloque: 7, icono: "🔢", titulo: "Control final", descripcion: "Números, fechas, precios, homófonos y control holístico" },
];

function listeningBloqueMeta(bloque) {
  return LISTENING_BLOQUES_META.find((b) => b.bloque === bloque) || null;
}

// Iconos SVG inline (sustituyen los emoji ▶️/✅/🔒/➡️/🏁 en todo el módulo
// de Listening). Cada función devuelve un <span class="l0-icon">...</span>
// listo para insertar via innerHTML; usan currentColor así heredan el
// color del elemento que los contiene (ver .l0-icon en listening.css).
const ListeningIcons = {
  play() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';
  },
  check() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>';
  },
  lock() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3z"/></svg></span>';
  },
  next() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M4 11v2h12l-5.5 5.5 1.4 1.4L20.3 12l-8.4-8-1.4 1.4L16 11z"/></svg></span>';
  },
  finish() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M6 2v20h2v-7h3l1 2h6V4h-6l-1-2z"/></svg></span>';
  },
  eye() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-2.3a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z"/></svg></span>';
  },
  copy() {
    return '<span class="l0-icon"><svg viewBox="0 0 24 24"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg></span>';
  },
  listen() {
    return '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-9 9v6a2 2 0 0 0 2 2h2v-7H5v-1a7 7 0 0 1 14 0v1h-2v7h2a2 2 0 0 0 2-2v-6a9 9 0 0 0-9-9z"/></svg>';
  },
};

// ==================== ESTADO EN MEMORIA ====================

const ListeningState = {
  exercises: (typeof NIVEL0_EXERCISES !== "undefined" ? NIVEL0_EXERCISES : []),
  progress: {}, // { [bloque]: { completed, bestScore, intentos, lastPorcentaje, lastCategoriaStats, lastRespuestas, enCurso } }
  reiniciados: [], // bloques cuyo intento a medias se descartó al migrar el criterio (se avisa una vez en la pantalla de inicio)
};

function listeningExercisesByBloque(bloque) {
  return ListeningState.exercises.filter((ex) => ex.bloque === bloque);
}

function loadListeningProgress() {
  try {
    const raw = localStorage.getItem(LISTENING_STORAGE_KEY);
    ListeningState.progress = raw ? JSON.parse(raw) || {} : {};
  } catch (e) {
    ListeningState.progress = {};
  }

  // Migración del criterio de calificación: un intento a medias (enCurso)
  // de los bloques 4-7 hecho con el criterio anterior se descarta -- el
  // contador de ese bloque vuelve a 0. completed / bestScore / intentos y
  // los resultados ya cerrados NO se tocan, y los bloques 1-3 tampoco.
  let migrado = false;
  Object.keys(ListeningState.progress).forEach((k) => {
    const bloque = Number(k);
    const prog = ListeningState.progress[k];
    if (
      bloque >= LISTENING_SCORING_FROM_BLOQUE &&
      prog && prog.enCurso &&
      prog.enCurso.scoringVersion !== LISTENING_SCORING_VERSION
    ) {
      delete prog.enCurso;
      ListeningState.reiniciados.push(bloque);
      migrado = true;
    }
  });
  if (migrado) saveListeningProgress();
  return ListeningState.progress;
}

function saveListeningProgress() {
  try {
    localStorage.setItem(LISTENING_STORAGE_KEY, JSON.stringify(ListeningState.progress));
  } catch (e) { /* noop */ }
}

function listeningBlockProgress(bloque) {
  return ListeningState.progress[bloque] || { completed: false, bestScore: null, intentos: 0 };
}

// ============== PROGRESO A MITAD DE BLOQUE (autoguardado) ==============
// Antes, salir de un bloque a mitad de camino perdía todo: había que
// hacer los 100 ejercicios de una sola sentada. Esto guarda en qué
// ejercicio va el usuario (y lo que ya acertó/falló) cada vez que
// contesta uno, para poder continuar justo ahí la próxima vez que entre
// a ese bloque — sin tocar "completed"/"bestScore", que solo se escriben
// cuando el bloque se termina de verdad.
function listeningInProgressFor(bloque) {
  const prog = ListeningState.progress[bloque];
  const en = prog && prog.enCurso;
  if (!en) return null;
  if (bloque >= LISTENING_SCORING_FROM_BLOQUE && en.scoringVersion !== LISTENING_SCORING_VERSION) return null;
  return en;
}

function saveListeningInProgress(bloque, enCurso) {
  const prog = ListeningState.progress[bloque] || { completed: false, bestScore: null, intentos: 0 };
  prog.enCurso = enCurso;
  ListeningState.progress[bloque] = prog;
  saveListeningProgress();
}

// Se usa al terminar el bloque de verdad: finishListeningBlock() ya
// reemplaza por completo ListeningState.progress[bloque] con el resumen
// final (sin campo enCurso), así que normalmente no hace falta llamar
// esto aparte — queda disponible para el caso de "empezar de nuevo"
// explícito.
function clearListeningInProgress(bloque) {
  const prog = ListeningState.progress[bloque];
  if (prog && prog.enCurso) {
    delete prog.enCurso;
    saveListeningProgress();
  }
}

// Desbloqueo secuencial: el bloque 1 siempre disponible; el bloque N+1 se
// habilita solo cuando el bloque N está marcado completed. Vive en una
// función propia para poder cambiar la regla después (p. ej. acceso
// libre) sin tocar el resto de listening-map.js.
function isListeningBlockUnlocked(bloque) {
  if (bloque <= 1) return true;
  return !!listeningBlockProgress(bloque - 1).completed;
}

// El bloque "actual" es el primer bloque desbloqueado y no completado.
function currentListeningBlock() {
  for (let b = 1; b <= LISTENING_TOTAL_BLOQUES; b++) {
    if (!listeningBlockProgress(b).completed) return b;
  }
  return LISTENING_TOTAL_BLOQUES;
}

// Sube al backend (hoja "Listening" del mismo Apps Script, ver
// postPorcentajes/API_URL en main_logic) el resultado por categoría al
// cerrar un bloque. Es un log append-only, igual que Porcentajes: el
// score ya se calculó aquí (en el cliente) y guardó en localStorage —
// esto solo sube el historial, best-effort. Si falla (sin conexión), el
// progreso local ya quedó guardado y el bloque sigue marcado como
// completado; simplemente no queda registro remoto de este intento.
async function postListeningBlockResults(bloque, categoriaStats) {
  try {
    const ejemplo = listeningExercisesByBloque(bloque)[0];
    const familia = ejemplo ? ejemplo.familia : "";
    const registros = Object.keys(categoriaStats).map((categoria) => {
      const s = categoriaStats[categoria];
      const porcentaje = s.total ? Math.round((s.correct / s.total) * 1000) / 10 : 0;
      return { bloque, categoria, familia, porcentaje, intentos: 1 };
    });
    if (!registros.length) return;
    await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ sheet: "listening", action: "add", registros }),
    });
  } catch (e) { /* noop: best-effort, ver comentario arriba */ }
}

function listeningOverallSummary() {
  const totalEjercicios = LISTENING_TOTAL_BLOQUES * LISTENING_EJERCICIOS_POR_BLOQUE;
  let bloquesCompletados = 0;
  for (let b = 1; b <= LISTENING_TOTAL_BLOQUES; b++) {
    if (listeningBlockProgress(b).completed) bloquesCompletados++;
  }
  return {
    bloquesCompletados,
    totalBloques: LISTENING_TOTAL_BLOQUES,
    totalEjercicios,
  };
}

// ============== DETALLE DE RESPUESTAS (para copiar y analizar) ==============
// Cada ejercicio contestado deja un registro { id, categoria, palabra,
// usuario, correcto, ... } (lo arma listening-play.js). Al terminar el
// bloque queda guardado en progress[bloque].lastRespuestas; este helper lo
// devuelve como un arreglo JSON con un objeto por línea, listo para pegar
// en el chat y analizar dónde están las mayores falencias.
function listeningRespuestasJSON(bloque) {
  const lista = listeningBlockProgress(bloque).lastRespuestas;
  if (!Array.isArray(lista) || !lista.length) return "";
  return "[\n" + lista.map((r) => "  " + JSON.stringify(r)).join(",\n") + "\n]";
}

async function copyListeningRespuestas(bloque) {
  const texto = listeningRespuestasJSON(bloque);
  if (!texto) {
    toast("⚠️ Este bloque todavía no tiene detalle guardado");
    return false;
  }
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
      ok = true;
    }
  } catch (e) { /* cae al plan B */ }
  if (!ok) {
    // Plan B (contextos sin Clipboard API, p. ej. http o webviews viejos).
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch (e) { ok = false; }
  }
  toast(ok ? "📋 Respuestas copiadas — pégalas en el chat" : "⚠️ No se pudo copiar automáticamente");
  return ok;
}
