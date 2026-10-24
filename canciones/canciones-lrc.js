// canciones/canciones-lrc.js — "Aprender canción" (Parte 4: audio real + karaoke)
//
// Este archivo se encarga de TODO lo que depende del audio real del mp3
// (en vez de la voz del dispositivo que se usa hasta el final del Nivel 2):
//   1) parsear el .lrc que Bryan genera con syncalong (ver tracklist/NOTAS.md)
//   2) emparejar cada línea del .lrc con su content[] correspondiente en el
//      JSON, para saber en qué segundo del mp3 empieza y termina cada frase
//   3) reproducir un TRAMO puntual del mp3 (una frase, una estrofa, o la
//      canción completa) con un <audio> reutilizado
//   4) el efecto "karaoke": resaltar la línea que está sonando en ese momento
//
// Si el .lrc no existe todavía, o no calza en cantidad de líneas con el
// JSON, NO se rompe nada: se devuelve null y quien llama (canciones-
// generador.js) simplemente no agrega el campo `audio` a los ejercicios —
// esos ejercicios caen solos al modo con voz del dispositivo (mismo
// mecanismo que ya usa canciones-audio-seleccion.js desde la Parte 3), tal
// como prometía tracklist/NOTAS.md desde la Parte 1: "mientras no exista
// [el .lrc], la canción funciona igual pero sin karaoke".

// ---------- Parseo de .lrc ----------
// Formato estándar LRC: "[mm:ss.xx]Texto de la línea", puede traer varias
// marcas de tiempo por línea (no debería pasar en un .lrc de una sola voz,
// pero no rompe nada si pasa). Las líneas de metadata ([ar:],[ti:],[by:]...)
// no tienen dígitos después del "[" así que el regex no las matchea y se
// ignoran solas.
function cancionLrcParsear(lrcTexto) {
  const reTiempo = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
  const out = [];
  String(lrcTexto || "").split(/\r?\n/).forEach((linea) => {
    const marcas = [...linea.matchAll(reTiempo)];
    if (!marcas.length) return;
    const texto = linea.replace(reTiempo, "").trim();
    marcas.forEach((m) => {
      const min = parseInt(m[1], 10) || 0;
      const seg = parseFloat(String(m[2]).replace(":", ".")) || 0;
      out.push({ time: min * 60 + seg, text: texto });
    });
  });
  out.sort((a, b) => a.time - b.time);
  return out;
}

async function cancionLrcCargar(lang, n) {
  try {
    const res = await fetch(cancionesArchivo(lang, n, "lrc"), { cache: "no-store" });
    if (!res.ok) return null;
    const texto = await res.text();
    const lineas = cancionLrcParsear(texto);
    return lineas.length ? lineas : null;
  } catch (e) {
    return null; // sin .lrc todavía: no es un error, es el estado normal de una canción recién subida
  }
}

// ---------- Emparejar líneas del .lrc con content[] del JSON ----------
// Recorre el JSON en el MISMO orden en que Bryan escribió el .txt que le
// dio a syncalong (segments en orden, content[] en orden dentro de cada
// segmento) — por eso basta con emparejar por POSICIÓN, no por texto: el
// `.txt`/`.lrc` y el `content[].originalPhrase` nacen de la misma fuente.
function cancionAplanarContenido(json) {
  const out = [];
  (json.segments || []).forEach((seg, segIndex) => {
    (seg.content || []).forEach((item, idx) => out.push({ segIndex, idx, item }));
  });
  return out;
}

// Devuelve { porLinea: {"segIndex:idx": {t0,t1}}, porSegmento: {segIndex: {t0,t1}} }
// o null si no hay .lrc o si la cantidad de líneas no calza con el JSON (se
// prefiere no adivinar un emparejamiento incorrecto a medias — eso sería
// peor que no tener audio real).
export function cancionTiemposDesdeLrc(json, lrcLineas) {
  if (!lrcLineas || !lrcLineas.length) return null;
  const plano = cancionAplanarContenido(json);
  if (!plano.length || lrcLineas.length !== plano.length) {
    console.warn(
      "⚠️ Aprender canción: el .lrc tiene " + (lrcLineas ? lrcLineas.length : 0) +
      " líneas y el JSON tiene " + plano.length + " — no calzan 1 a 1, así que " +
      "los Niveles 4-8 seguirán con la voz del dispositivo en vez del audio real " +
      "(revisa que el .txt que generó el .lrc tenga exactamente una línea por cada originalPhrase)."
    );
    return null;
  }

  const porLinea = {};
  plano.forEach((f, i) => {
    const t0 = lrcLineas[i].time;
    const t1 = lrcLineas[i + 1] ? lrcLineas[i + 1].time : null; // null = hasta que termine el audio
    porLinea[f.segIndex + ":" + f.idx] = { t0, t1 };
  });

  const porSegmento = {};
  (json.segments || []).forEach((seg, segIndex) => {
    const idxs = plano.filter((f) => f.segIndex === segIndex).map((f) => f.idx);
    if (!idxs.length) return;
    const t0 = porLinea[segIndex + ":" + Math.min(...idxs)].t0;
    const t1 = porLinea[segIndex + ":" + Math.max(...idxs)].t1;
    porSegmento[segIndex] = { t0, t1 };
  });

  return { porLinea, porSegmento };
}

// Carga el .lrc y arma los tiempos para UNA canción (cancion = {lang, n, json}).
// Se cachea en memoria por songId dentro de la sesión (no cambia entre
// recargas de la misma canción); forzar=true la vuelve a pedir.
const _cancionTiemposCache = {};
export async function cancionTiemposCargar(cancion, forzar) {
  if (!forzar && Object.prototype.hasOwnProperty.call(_cancionTiemposCache, cancion.id)) {
    return _cancionTiemposCache[cancion.id];
  }
  const lineas = await cancionLrcCargar(cancion.lang, cancion.n);
  const tiempos = cancionTiemposDesdeLrc(cancion.json, lineas);
  _cancionTiemposCache[cancion.id] = tiempos;
  return tiempos;
}

// ---------- Reproducción del mp3 real ----------
// Un solo <audio> reutilizado por canción abierta (no hace falta más: solo
// suena un tramo a la vez). Si cambia de canción, se descarta el anterior.
let _cancionAudioEl = null;
let _cancionAudioId = null;

function cancionAudioElemento(cancion) {
  if (_cancionAudioEl && _cancionAudioId === cancion.id) return _cancionAudioEl;
  if (_cancionAudioEl) { try { _cancionAudioEl.pause(); } catch (e) { /* nada */ } }
  const a = new Audio(cancionesArchivo(cancion.lang, cancion.n, "mp3"));
  a.preload = "auto";
  _cancionAudioEl = a;
  _cancionAudioId = cancion.id;
  return a;
}

export function cancionAudioDetener() {
  if (_cancionAudioEl) { try { _cancionAudioEl.pause(); } catch (e) { /* nada */ } }
}

// Reproduce desde t0 hasta t1 (o hasta que termine el audio si t1 es null/
// undefined). onFinish se llama una sola vez, tanto si terminó solo como si
// se cortó porque se pasó de t1, como si hubo un error cargando el mp3 (en
// ese caso simplemente no suena nada, pero el ejercicio sigue funcionando —
// mismo criterio permisivo del resto de la sección).
// Devuelve { audio, detener } para poder cortar manualmente (al salir de la
// tarjeta antes de que termine).
export function cancionAudioReproducirTramo(cancion, t0, t1, onFinish) {
  const a = cancionAudioElemento(cancion);
  let terminado = false;

  const limpiar = () => {
    a.removeEventListener("timeupdate", onTime);
    a.removeEventListener("ended", onEnded);
    a.removeEventListener("error", onError);
  };
  const acabar = () => {
    if (terminado) return;
    terminado = true;
    try { a.pause(); } catch (e) { /* nada */ }
    limpiar();
    if (onFinish) onFinish();
  };
  const onTime = () => { if (t1 != null && a.currentTime >= t1) acabar(); };
  const onEnded = () => acabar();
  const onError = () => acabar();

  a.addEventListener("timeupdate", onTime);
  a.addEventListener("ended", onEnded);
  a.addEventListener("error", onError);

  try {
    a.currentTime = t0 || 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => acabar());
  } catch (e) {
    acabar();
  }

  return { audio: a, detener: acabar };
}

// ---------- Karaoke: resaltar la línea activa mientras suena ----------
// `lineas` = [{ idPlano: "segIndex:idx", t0, t1 }] en el orden en que se
// pintaron en el DOM. Busca en el container elementos con
// [data-karaoke-id="segIndex:idx"] y les agrega/quita ".cancion-karaoke-activa"
// según el currentTime del audio. Devuelve una función para desconectar el
// listener (llamarla al salir de la tarjeta).
export function cancionKaraokeActivar(container, lineas, audio) {
  const marcar = () => {
    const t = audio.currentTime;
    let activaId = null;
    for (let i = 0; i < lineas.length; i++) {
      const l = lineas[i];
      if (t >= l.t0 && (l.t1 == null || t < l.t1)) { activaId = l.idPlano; break; }
    }
    container.querySelectorAll("[data-karaoke-id]").forEach((el) => {
      const activa = el.dataset.karaokeId === activaId;
      el.classList.toggle("cancion-karaoke-activa", activa);
      if (activa) el.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };
  audio.addEventListener("timeupdate", marcar);
  marcar();
  return () => audio.removeEventListener("timeupdate", marcar);
}
