// canciones/canciones-core.js — "Aprender canción" (Parte 1: infraestructura)
//
// Esta sección NO reentrena un motor nuevo desde cero: la Parte 2 va a
// reutilizar reels-core.js (duplicado como reels/reels2.js) para la
// secuencia de tarjetas. Este archivo solo se encarga de:
//   1) descubrir qué canciones hay en tracklist/ (song_<lang>_<n>.*)
//   2) cargar y validar su song_<lang>_<n>.json
//   3) guardar/leer el progreso por canción (localStorage)
//   4) pintar la tarjeta "Aprender canción" del menú y la pantalla de lista
//
// El motor del juego (Parte 2 en adelante) se conecta sin tocar este
// archivo: ver setAbrirCancionHandler() más abajo.

const CANCIONES_NIVELES_TOTAL = 8; // ver tracklist/NOTAS.md — criterio del % de avance
// Desde este nivel se muestra el nombre real (ver flujo #3: "Finalizado y
// dominado todos los segmentos se empieza a mostrar el nombre..."). Se
// definió como un placeholder (5) en la Parte 1, antes de repartir qué
// hace cada nivel; ahora que la Parte 4 ya definió el Nivel 3 como la
// propia pantalla de felicitaciones (que revela el nombre), el desbloqueo
// pasa a 3: cancionNivelCompletado(id, 2) deja progreso.nivel en 3 justo
// antes de mostrar esa pantalla.
const CANCIONES_NIVEL_DESBLOQUEO = 3;
const CANCIONES_MAX_PROBE = 300; // tope de seguridad al descubrir song_<lang>_<n>

function cancionesBase() { return "./tracklist/"; }
function cancionesArchivo(lang, n, ext) { return cancionesBase() + "song_" + lang + "_" + n + "." + ext; }

// ---------- Descubrimiento de canciones disponibles ----------
// Prueba song_<lang>_1.json, _2.json... hasta el primer número que no
// exista (404 o error de red). Se cachea en memoria por idioma dentro de
// la sesión para no volver a golpear la red cada vez que se abre la
// pantalla (basta refrescar la página para que vuelva a probar).
const _cancionesCache = {}; // lang -> Promise<Array<{id, lang, json}>>

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

// Estado por defecto de una canción: nivel actual (1-8), si ya llegó al
// 100% final (fijo, ver tracklist/NOTAS.md) y qué frases ya se dominaron
// (para "frases repetidas" — lo usará el generador de ejercicios de la
// Parte 2, se deja ya aquí el lugar donde vive ese dato).
export function cancionProgresoNuevo() {
  return {
    v: 1,
    nivel: 1,
    nivelesCompletados: [], // qué niveles (1-8) ya se terminaron al 100%
    finalPct: null, // se fija la primera vez que el nivel 8 llega a 100% y ya no cambia
    frasesDominadas: [], // texto normalizado de originalPhrase/phrase ya superadas
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

// Marca una frase (texto normalizado de un originalPhrase o de un
// learn[].phrase, ver canciones-generador.js) como dominada para esta
// canción, si no lo estaba ya. La usa reels2.js (Parte 2) cuando se
// aprueban TODOS los ejercicios que dependían de esa frase. Devuelve true
// si de verdad agregó algo nuevo (para que quien llame sepa si vale la pena
// refrescar el % mostrado).
export function cancionMarcarFraseDominada(songId, frase) {
  if (!frase) return false;
  const progreso = cancionProgresoLeer(songId);
  progreso.frasesDominadas = progreso.frasesDominadas || [];
  if (progreso.frasesDominadas.includes(frase)) return false;
  progreso.frasesDominadas.push(frase);
  cancionProgresoGuardar(songId, progreso);
  return true;
}

// Marca un nivel (1-8) como terminado al 100% para esta canción — lo llama
// reels2.js (Parte 3) cuando el Nivel 1 ("Seleccionar") o el Nivel 2
// ("Completar" + flujo por segmento) se vacían por completo. También
// adelanta progreso.nivel, por si en el futuro se usa para saber "en qué
// nivel se quedó" sin tener que mirar nivelesCompletados.
export function cancionNivelCompletado(songId, nivel) {
  const progreso = cancionProgresoLeer(songId);
  progreso.nivelesCompletados = progreso.nivelesCompletados || [];
  if (!progreso.nivelesCompletados.includes(nivel)) progreso.nivelesCompletados.push(nivel);
  progreso.nivel = Math.max(progreso.nivel || 1, nivel + 1);
  cancionProgresoGuardar(songId, progreso);
}

// Fija el % final de la canción (Nivel 8, ver flujo #8 y tracklist/NOTAS.md
// Parte 4): una vez puesto, cancionAvancePct() lo devuelve siempre, sin
// volver a calcularlo por nivelesCompletados. No hay "des-fijar": es
// deliberadamente permanente, tal como pidió Bryan.
export function cancionFijarResultadoFinal(songId, pct) {
  const progreso = cancionProgresoLeer(songId);
  if (progreso.finalPct != null) return; // ya estaba fijado: no se pisa
  progreso.finalPct = Math.max(0, Math.min(100, Math.round(pct)));
  cancionProgresoGuardar(songId, progreso);
}

// % que se muestra en la tarjeta (ver criterio en tracklist/NOTAS.md).
export function cancionAvancePct(progreso) {
  if (progreso.finalPct != null) return progreso.finalPct;
  const n = new Set(progreso.nivelesCompletados || []).size;
  return Math.round((100 * n) / CANCIONES_NIVELES_TOTAL);
}

export function cancionDesbloqueada(progreso) {
  return (progreso.nivel || 1) >= CANCIONES_NIVEL_DESBLOQUEO || progreso.finalPct != null;
}

// ---------- Candado de Reels (Parte 5) ----------
// Mientras queden canciones sin terminar (sin finalPct) en el idioma
// objetivo actual, el usuario debe resolver CANCIONES_CANDADO_META "puntos"
// de ejercicios de "Aprender canción" por día antes de que Reels normal se
// abra (ver flujo #9 de Bryan). Un ejercicio corto vale 1 punto; los más
// largos valen más (ver rl2Peso() en reels2.js) — uno muy largo (la tarjeta
// final del Nivel 8, que es cantar la canción entera) directamente vale los
// CANCIONES_CANDADO_META puntos, es decir que por sí solo ya desbloquea el
// día, tal como pidió Bryan ("los ejercicios muy largos haz que cuenten
// como 15").
export const CANCIONES_CANDADO_META = 15;

function cancionesCandadoKey() { return "english_trainer_canciones_candado_v1_" + getTargetLanguage(); }
function cancionesHoyStr() { return new Date().toLocaleDateString("en-CA"); } // YYYY-MM-DD local, igual que rlHoyStr()

// progreso.cancionId ("la última que jugó", ver pedido de Bryan) se guarda
// SIN fecha: sobrevive al reset de medianoche, porque es solo "cuál abrir
// por defecto", no parte del conteo del día.
function cancionesCandadoNuevo(cancionIdPrevio) {
  return { v: 1, fecha: cancionesHoyStr(), puntos: 0, cancionId: cancionIdPrevio || null };
}

export function cancionesCandadoLeer() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(cancionesCandadoKey()) || "null"); } catch (e) { d = null; }
  if (!d || typeof d !== "object") return cancionesCandadoNuevo(null);
  if (d.fecha !== cancionesHoyStr()) return cancionesCandadoNuevo(d.cancionId); // medianoche: puntos a cero, se conserva cancionId
  return Object.assign(cancionesCandadoNuevo(d.cancionId), d);
}

function cancionesCandadoGuardar(estado) {
  try { localStorage.setItem(cancionesCandadoKey(), JSON.stringify(estado)); }
  catch (e) { /* almacenamiento lleno: se ignora, no es crítico */ }
}

// La llama reels2.js cada vez que se resuelve un ejercicio de "Aprender
// canción" (se haya acertado o no — lo que cuenta es el intento) y también
// cada vez que se abre una canción (así "la última que jugó" queda al día
// aunque hoy aún no resuelva ningún ejercicio en ella).
export function cancionesCandadoRegistrar(songId, puntos) {
  const estado = cancionesCandadoLeer();
  estado.cancionId = songId || estado.cancionId;
  if (puntos) estado.puntos += puntos;
  cancionesCandadoGuardar(estado);
  return estado;
}

export function cancionesCandadoFaltan(estado) {
  return Math.max(0, CANCIONES_CANDADO_META - (estado.puntos || 0));
}

// true si Reels normal debe quedar bloqueado hoy: hay al menos una canción
// de este idioma sin terminar y todavía no se llegó a la meta del día.
export async function cancionesCandadoActivo() {
  const lang = getTargetLanguage();
  const canciones = await cancionesDescubrir(lang);
  if (!canciones.length) return { bloquea: false };
  const pendientes = canciones.filter((c) => cancionProgresoLeer(c.id).finalPct == null);
  if (!pendientes.length) return { bloquea: false };
  const estado = cancionesCandadoLeer();
  if (cancionesCandadoFaltan(estado) <= 0) return { bloquea: false };
  return { bloquea: true, pendientes, estado };
}

// Elige qué canción abrir cuando se activa el candado: la última jugada si
// sigue pendiente, o la primera pendiente de la lista — pero el usuario
// siempre puede volver a la lista (botón "volver" de reels2.js) y elegir
// otra, tal como pidió Bryan ("puede elegir libremente cuál hacer").
export function cancionesCandadoElegirPendiente(pendientes, estado) {
  return pendientes.find((c) => c.id === estado.cancionId) || pendientes[0];
}

function cancionCandadoBannerHTML(estado, pendientes) {
  const faltan = cancionesCandadoFaltan(estado);
  if (faltan <= 0) return "";
  return `
    <div class="cancion-candado-banner">
      🔒 Te faltan <b>${faltan}</b> de ${CANCIONES_CANDADO_META} ejercicios de hoy para abrir Reels.
      ${pendientes && pendientes.length > 1 ? "Puedes elegir cualquier canción pendiente de la lista." : ""}
    </div>`;
}

async function cancionesCandadoPintarBanner() {
  const cont = document.getElementById("cancionCandadoBanner");
  if (!cont) return;
  const info = await cancionesCandadoActivo();
  cont.innerHTML = info.bloquea ? cancionCandadoBannerHTML(info.estado, info.pendientes) : "";
}

// ---------- Punto de conexión con el motor del juego (Parte 2+) ----------
// canciones-core.js solo pinta la lista; quien reproduce los ejercicios es
// reels2.js (se agrega en la Parte 2). Mientras tanto, tocar una tarjeta
// avisa que esa parte viene después, sin romper nada.
let _abrirCancionHandler = (cancion) => {
  toast("🎶 El modo de juego de \"Aprender canción\" llega en la próxima entrega");
};
export function setAbrirCancionHandler(fn) {
  if (typeof fn === "function") _abrirCancionHandler = fn;
}

// ---------- Pantalla de lista ----------
function cancionTituloMostrado(cancion, progreso) {
  if (cancionDesbloqueada(progreso)) return { titulo: cancion.json.songTitle, artista: cancion.json.artist };
  return { titulo: "Canción " + cancion.n, artista: "🔒 Domina el contenido para descubrirla" };
}

function cancionTarjetaHTML(cancion) {
  const progreso = cancionProgresoLeer(cancion.id);
  const pct = cancionAvancePct(progreso);
  const { titulo, artista } = cancionTituloMostrado(cancion, progreso);
  return `
    <button class="cancion-card" data-cancion-id="${window._escHTML(cancion.id)}">
      <div class="cancion-card-ico">${cancionDesbloqueada(progreso) ? "🎵" : "🔒"}</div>
      <div class="cancion-card-info">
        <b>${window._escHTML(titulo)}</b>
        <small>${window._escHTML(artista)}</small>
        <div class="cancion-progress-track"><div class="cancion-progress-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="cancion-card-pct">${pct}%</div>
    </button>`;
}

async function cancionesPintarLista() {
  const cont = document.getElementById("cancionListaContainer");
  if (!cont) return;
  cont.innerHTML = `<p class="sub-fun">Buscando canciones en tracklist/...</p>`;
  cancionesCandadoPintarBanner();
  const lang = getTargetLanguage();
  const canciones = await cancionesDescubrir(lang);
  if (!canciones.length) {
    cont.innerHTML = `<p class="sub-fun">Todavía no hay ninguna canción en <code>tracklist/</code> para ${window._escHTML(getTargetLangMeta().labelLower)}. Sube <code>song_${lang}_1.json</code> (+ .txt/.mp3/.lrc) para empezar.</p>`;
    return;
  }
  cont.innerHTML = canciones.map(cancionTarjetaHTML).join("");
  cont.querySelectorAll("[data-cancion-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cancion = canciones.find((c) => c.id === btn.dataset.cancionId);
      if (cancion) _abrirCancionHandler(cancion);
    });
  });
}

export function abrirCancionesHome() {
  showMainView("cancionHome");
  cancionesPintarLista();
}

// Refresca la lista si el usuario cambia el idioma objetivo estando en esta
// pantalla, igual que hacen otras secciones (ver updateHelpBtnVisibility()).
onTargetLanguageChange(() => {
  const screen = document.getElementById("cancionHomeScreen");
  if (screen && screen.classList.contains("active")) cancionesPintarLista();
});

export function wireCanciones() {
  document.getElementById("homeCancionBtn")?.addEventListener("click", abrirCancionesHome);
}

// ---------- Candado de Reels: punto de entrada único a Reels (Parte 5) ----------
// Reemplaza a openReels() en los dos lugares donde se abría Reels (botón del
// menú y el auto-abrir al iniciar sesión, ver build.py): si el candado está
// activo hoy, en vez de Reels se abre "Aprender canción" directo en la
// canción que toca; si no, abre Reels normal tal cual antes.
export async function abrirReelsConCandado() {
  const info = await cancionesCandadoActivo();
  if (!info.bloquea) { if (typeof openReels === "function") openReels(); return; }
  const cancion = cancionesCandadoElegirPendiente(info.pendientes, info.estado);
  toast("🔒 Te faltan " + cancionesCandadoFaltan(info.estado) + " ejercicios de \"Aprender canción\" hoy para abrir Reels");
  abrirCancionesHome();
  if (cancion) rl2AbrirCancion(cancion);
}
