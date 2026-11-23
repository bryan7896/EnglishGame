// canciones/canciones-core.js — "Aprender canción" (infraestructura)
//
// Ya no hay pantalla ni botón propios: las canciones se practican
// integradas dentro de Reels, como un tipo más del sorteo de "espacio" (ver
// ⚙️ Configurar reels en reels-sorpresas.js) — se activa/desactiva con el
// interruptor "🎵 Practicar canción" y, cuando sale, muestra UN ejercicio
// de los Niveles 4 a 8 (audio real de la canción, nunca con voz del
// sistema — ver reels/reels2.js, que es quien arma y resuelve esos
// ejercicios). Este archivo solo se encarga de:
//   1) descubrir qué canciones hay en tracklist/ (song_<lang>_<n>.*)
//   2) cargar y validar su song_<lang>_<n>.json
//   3) guardar/leer el progreso por canción (localStorage)
//   4) mantener, para Reels, la lista de canciones pendientes del idioma
//      activo y cuál es "la activa" (la última jugada, si sigue pendiente)

const CANCIONES_NIVELES_TOTAL = 5; // Niveles 4,5,6,7,8 — ver cancionAvancePct()
const CANCIONES_MAX_PROBE = 300; // tope de seguridad al descubrir song_<lang>_<n>

function cancionesBase() { return "./tracklist/"; }
function cancionesArchivo(lang, n, ext) { return cancionesBase() + "song_" + lang + "_" + n + "." + ext; }

// ---------- Descubrimiento de canciones disponibles ----------
// Prueba song_<lang>_1.json, _2.json... hasta el primer número que no
// exista (404 o error de red). Se cachea en memoria por idioma dentro de
// la sesión para no volver a golpear la red cada vez. "forzar" (ignorar
// caché) se usa al refrescar tras cambiar de idioma.
const _cancionesCache = {}; // lang -> Promise<Array<{id, lang, n, json}>>

async function cancionJSONExiste(lang, n) {
  try {
    const res = await fetch(cancionesArchivo(lang, n, "json"), { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch (e) {
    return null;
  }
}

// Valida lo mínimo para no romper el resto de la app si el JSON viene
// incompleto (Bryan todavía lo está armando a mano): songTitle/artist
// como texto y segments como array de objetos con "text" y "content".
function cancionJSONValido(json) {
  if (!json || typeof json !== "object") return false;
  if (typeof json.songTitle !== "string" || !json.songTitle.trim()) return false;
  if (typeof json.artist !== "string" || !json.artist.trim()) return false;
  if (!Array.isArray(json.segments) || !json.segments.length) return false;
  return json.segments.every((seg) => seg && typeof seg.text === "string" && Array.isArray(seg.content));
}

async function cancionesDescubrirSinCache(lang) {
  const out = [];
  for (let n = 1; n <= CANCIONES_MAX_PROBE; n++) {
    const json = await cancionJSONExiste(lang, n);
    if (!json) break; // números no son "huecos": se para en el primero que falte
    if (!cancionJSONValido(json)) {
      console.warn("⚠️ tracklist/song_" + lang + "_" + n + ".json no tiene el esquema esperado (ver tracklist/NOTAS.md) — se omite");
      continue;
    }
    out.push({ id: lang + "_" + n, lang, n, json });
  }
  return out;
}

// forzar=true ignora la caché en memoria (por ejemplo tras subir una canción nueva).
export function cancionesDescubrir(lang, forzar) {
  if (forzar || !_cancionesCache[lang]) _cancionesCache[lang] = cancionesDescubrirSinCache(lang);
  return _cancionesCache[lang];
}

// ---------- Progreso por canción (localStorage) ----------
// Una llave por idioma objetivo, igual que el resto de la app (reels,
// progreso del mapa, etc. — ver rlKey() en reels-core.js).
function cancionesProgresoKey() { return "english_trainer_canciones_v1_" + getTargetLanguage(); }

function cancionesProgresoLeerTodo() {
  try { return JSON.parse(localStorage.getItem(cancionesProgresoKey()) || "{}") || {}; }
  catch (e) { return {}; }
}

function cancionesProgresoGuardarTodo(todo) {
  try { localStorage.setItem(cancionesProgresoKey(), JSON.stringify(todo)); }
  catch (e) { /* almacenamiento lleno: se ignora, no es crítico */ }
}

// Estado por defecto de una canción: qué niveles (4-8) ya se terminaron al
// 100% y si ya llegó al final fijo (Nivel 8, ver cancionFijarResultadoFinal).
export function cancionProgresoNuevo() {
  return {
    v: 2,
    nivelesCompletados: [], // subconjunto de [4,5,6,7,8] ya terminados
    finalPct: null, // se fija la primera vez que el Nivel 8 se resuelve y ya no cambia
  };
}

export function cancionProgresoLeer(songId) {
  const todo = cancionesProgresoLeerTodo();
  return Object.assign(cancionProgresoNuevo(), todo[songId] || {});
}

export function cancionProgresoGuardar(songId, progreso) {
  const todo = cancionesProgresoLeerTodo();
  todo[songId] = progreso;
  cancionesProgresoGuardarTodo(todo);
}

// Marca un nivel (4-8) como terminado al 100% para esta canción (lo llama
// reels2.js cuando esa cola se vacía por completo).
export function cancionNivelCompletado(songId, nivel) {
  const progreso = cancionProgresoLeer(songId);
  progreso.nivelesCompletados = progreso.nivelesCompletados || [];
  if (!progreso.nivelesCompletados.includes(nivel)) progreso.nivelesCompletados.push(nivel);
  cancionProgresoGuardar(songId, progreso);
}

// Fija el % final de la canción (Nivel 8): una vez puesto, cancionAvancePct()
// lo devuelve siempre, sin volver a calcularlo por nivelesCompletados. No hay
// "des-fijar": es deliberadamente permanente.
export function cancionFijarResultadoFinal(songId, pct) {
  const progreso = cancionProgresoLeer(songId);
  if (progreso.finalPct != null) return; // ya estaba fijado: no se pisa
  progreso.finalPct = Math.max(0, Math.min(100, Math.round(pct)));
  cancionProgresoGuardar(songId, progreso);
}

// % de avance de una canción (solo informativo por ahora: ya no hay
// pantalla de lista que lo muestre, pero queda disponible si se necesita).
export function cancionAvancePct(progreso) {
  if (progreso.finalPct != null) return progreso.finalPct;
  const n = new Set(progreso.nivelesCompletados || []).size;
  return Math.round((100 * n) / CANCIONES_NIVELES_TOTAL);
}

// ---------- Integración con Reels: canciones pendientes del idioma activo ----------
// Caché en memoria (se repuebla al cambiar de idioma y cada vez que una
// canción termina su Nivel 8) para que la disponibilidad se pueda consultar
// de forma SÍNCRONA desde el sorteo de "espacio" (rlEspacioDisponibleAhora
// en reels-sorpresas.js) — el descubrimiento en sí (fetch de los JSON) sigue
// siendo async, igual que siempre.
let _cancionReelsCache = { lang: null, todas: [], pendientes: [] };

export function cancionReelsRefrescar() {
  const lang = getTargetLanguage();
  cancionesDescubrir(lang).then((lista) => {
    _cancionReelsCache = {
      lang,
      todas: lista,
      pendientes: lista.filter((c) => cancionProgresoLeer(c.id).finalPct == null),
    };
  });
}

// Se llama cuando una canción termina (Nivel 8 resuelto) para que deje de
// contar como pendiente de inmediato, sin esperar el próximo cambio de idioma.
export function cancionReelsNotificarCambio() {
  cancionReelsRefrescar();
}

export function cancionReelsDisponible() {
  return _cancionReelsCache.lang === getTargetLanguage() && _cancionReelsCache.pendientes.length > 0;
}

function cancionReelsListaPendientes() {
  return _cancionReelsCache.lang === getTargetLanguage() ? _cancionReelsCache.pendientes : [];
}

export function cancionReelsBuscarPorId(id) {
  return (_cancionReelsCache.todas || []).find((c) => c.id === id) || null;
}

function cancionReelsUltimaKey() { return "english_trainer_cancion_reels_ultima_v1_" + getTargetLanguage(); }
function cancionReelsUltimaLeer() {
  try { return localStorage.getItem(cancionReelsUltimaKey()); } catch (e) { return null; }
}
export function cancionReelsUltimaGuardar(id) {
  try { localStorage.setItem(cancionReelsUltimaKey(), id); } catch (e) { /* nada */ }
}

// La última jugada, si sigue pendiente; si no, la primera pendiente de la
// lista (mismo criterio que antes tenía el candado).
export function cancionReelsElegirActiva() {
  const pend = cancionReelsListaPendientes();
  if (!pend.length) return null;
  const ult = cancionReelsUltimaLeer();
  return pend.find((c) => c.id === ult) || pend[0];
}

cancionReelsRefrescar();
onTargetLanguageChange(() => cancionReelsRefrescar());
