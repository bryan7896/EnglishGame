// banco-palabras/banco-palabras-data.js
//
// Capa de datos del "Banco de palabras". SOLO para inglés (no aplica a
// italiano) — sigue el mismo criterio de módulo independiente que el
// Listening Trainer: su propia llave de localStorage, su propio esquema,
// sin tocar currentStorageKey()/BASE_STORAGE_KEY de los ejercicios
// normales ni el progreso de reglas gramaticales.
//
// Esquema de una entrada (una palabra guardada):
// {
//   id: "change",                 // = palabra en minúsculas, sin acentos raros; clave única
//   palabra: "change",            // palabra tal como la devolvió el diccionario (headword en inglés)
//   formas: ["change","changed","changing"], // "Formas" que trajo el API (incluye siempre la propia palabra)
//   fechaAgregado: "2026-10-20",  // ISO (solo fecha), cuándo se guardó por primera vez
//   fecha: "2026-10-20",          // ISO (solo fecha), última vez que se practicó (ordena la tabla: más vieja primero)
//   vp: 0,                        // "Veces practicado": ejercicios de esta palabra ya resueltos en Reels
//   pausado: false,               // checkbox ⏸️: si está en true, no entra a la rotación de Reels
//   oraciones: [
//     {
//       id: "o1",
//       en: "he changed the subject",
//       es: "cambió de tema",
//       forma: "changed",         // cuál de "formas" aparece en esta oración (decide qué palabra se tapa en completar.js)
//       origen: "mw",             // "mw" = seleccionada a mano del diccionario | "sistema" = encontrada en data-en
//       editado: false,           // true si el usuario la modificó con el lápiz ✏️
//       fuenteId: null            // id del ejercicio original en data-en (solo origen:"sistema"), para no duplicar si se vuelve a buscar
//     }
//   ]
// }
//
// "#Data" (columna de la tabla) = oraciones.length de esa entrada.
//
// Regla de borrado automático: cualquier entrada con vp > 50 se elimina
// sola (ver purgarPracticadas()). Index.js/reels deben llamar esa función
// cada vez que suman un vp, justo después de guardar.

(function (global) {
  "use strict";

  const LS_KEY = "englishTrainerBancoPalabras_v1";
  const LS_API_KEY = "englishTrainerBancoPalabras_mwKey_v1";
  // Tope total de oraciones por palabra (seleccionadas a mano + "sistema").
  // banco-palabras-ui.js ya recorta "en sistema" antes de llegar aquí —
  // esto es una segunda red de seguridad por si una palabra ya tenía
  // oraciones guardadas de una búsqueda anterior y la suma se pasa.
  const MAX_ORACIONES_POR_PALABRA = 50;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function slugify(palabra) {
    return String(palabra || "").trim().toLowerCase();
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(map) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(map));
      return true;
    } catch (e) {
      return false;
    }
  }

  function listar() {
    const map = loadAll();
    // Orden por defecto: fecha de última práctica más antigua primero
    // (las nunca practicadas, sin "fecha" de práctica real, usan
    // fechaAgregado como si fuera su "última práctica" para no saltar
    // siempre al frente ni siempre al final de forma arbitraria).
    return Object.values(map).sort((a, b) => {
      const fa = a.fecha || a.fechaAgregado || "0000-00-00";
      const fb = b.fecha || b.fechaAgregado || "0000-00-00";
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });
  }

  function obtener(palabra) {
    const map = loadAll();
    return map[slugify(palabra)] || null;
  }

  function activas() {
    return listar().filter((e) => !e.pausado && (e.oraciones || []).length > 0);
  }

  let _oracionSeq = 0;
  function nuevoIdOracion() {
    _oracionSeq += 1;
    return "o" + Date.now().toString(36) + _oracionSeq;
  }

  // oracionesNuevas: [{en, es, forma, origen, fuenteId}]
  function guardarPalabra(palabra, formas, oracionesNuevas) {
    const id = slugify(palabra);
    if (!id) return null;
    const map = loadAll();
    const existente = map[id];
    const oraciones = existente ? existente.oraciones.slice() : [];

    (oracionesNuevas || []).forEach((o) => {
      if (oraciones.length >= MAX_ORACIONES_POR_PALABRA) return;
      // Evita duplicar una oración "de sistema" que ya se había traído antes.
      const yaExiste = o.fuenteId
        ? oraciones.some((x) => x.fuenteId === o.fuenteId)
        : oraciones.some((x) => x.en === o.en && x.es === o.es);
      if (yaExiste) return;
      oraciones.push({
        id: nuevoIdOracion(),
        en: o.en,
        es: o.es,
        forma: o.forma || palabra,
        origen: o.origen || "mw",
        editado: false,
        fuenteId: o.fuenteId || null,
      });
    });

    map[id] = {
      id,
      palabra: existente ? existente.palabra : palabra,
      formas: Array.from(new Set((formas && formas.length ? formas : [palabra]).map((f) => String(f).toLowerCase()))),
      fechaAgregado: existente ? existente.fechaAgregado : todayISO(),
      fecha: existente ? existente.fecha : todayISO(),
      vp: existente ? existente.vp : 0,
      pausado: existente ? existente.pausado : false,
      oraciones,
    };
    saveAll(map);
    return map[id];
  }

  function editarOracion(palabra, oracionId, nuevoEn, nuevoEs) {
    const map = loadAll();
    const entrada = map[slugify(palabra)];
    if (!entrada) return false;
    const o = entrada.oraciones.find((x) => x.id === oracionId);
    if (!o) return false;
    o.en = nuevoEn;
    o.es = nuevoEs;
    o.editado = true;
    saveAll(map);
    return true;
  }

  function borrarOracion(palabra, oracionId) {
    const map = loadAll();
    const entrada = map[slugify(palabra)];
    if (!entrada) return false;
    entrada.oraciones = entrada.oraciones.filter((x) => x.id !== oracionId);
    saveAll(map);
    return true;
  }

  function setPausado(palabra, pausado) {
    const map = loadAll();
    const entrada = map[slugify(palabra)];
    if (!entrada) return false;
    entrada.pausado = !!pausado;
    saveAll(map);
    return true;
  }

  function borrarPalabra(palabra) {
    const map = loadAll();
    delete map[slugify(palabra)];
    saveAll(map);
  }

  // Llamar cada vez que una tanda de ejercicios de Banco de palabras
  // (de esta palabra) se completa en Reels. Si al sumar supera 50, la
  // palabra se elimina automáticamente (regla pedida por el usuario).
  function registrarPractica(palabra, cuantos) {
    const map = loadAll();
    const entrada = map[slugify(palabra)];
    if (!entrada) return;
    entrada.vp = (entrada.vp || 0) + (cuantos || 1);
    entrada.fecha = todayISO();
    if (entrada.vp > 50) {
      delete map[slugify(palabra)];
    } else {
      map[slugify(palabra)] = entrada;
    }
    saveAll(map);
  }

  // ---------- key del API (botón "key" de la sección) ----------
  function getApiKey() {
    try { return (localStorage.getItem(LS_API_KEY) || "").trim(); } catch (e) { return ""; }
  }
  function setApiKey(key) {
    try { localStorage.setItem(LS_API_KEY, String(key || "").trim()); return true; } catch (e) { return false; }
  }

  global.BancoPalabrasData = {
    listar,
    obtener,
    activas,
    guardarPalabra,
    editarOracion,
    borrarOracion,
    setPausado,
    borrarPalabra,
    registrarPractica,
    getApiKey,
    setApiKey,
    slugify,
  };
})(typeof window !== "undefined" ? window : globalThis);
