// banco-palabras/banco-palabras-tatoeba.js
//
// Búsqueda alterna al diccionario: en vez de Merriam-Webster, consulta
// directo Tatoeba por oraciones en inglés que contengan la palabra
// buscada (tal como se escribió/editó en el input del modal), junto con
// sus traducciones al español. Pensado para cuando el diccionario no
// trae la palabra, o cuando se prefieren ejemplos "naturales" de Tatoeba
// en vez de los del diccionario.
//
// Pedido explícito del usuario: esta consulta exacta —
//   GET https://api.dev.tatoeba.org/v1/sentences
//     ?lang=eng&q=<palabra>&word_count=4-6&origin=original
//     &trans:lang=spa&sort=random&limit=30
// (nota: reels/reels-tatoeba.js usa api.tatoeba.org/unstable + v1 para su
// propia sorpresa, con una nota de que el host "dev" no le daba resultados
// en italiano/audio — esto es aparte, el usuario pidió explícitamente este
// endpoint "dev" para Banco de palabras y dio un ejemplo real de respuesta
// en inglés/español que SÍ trae datos, así que se usa tal cual se pidió.)

(function (global) {
  "use strict";

  const BASE = "https://api.dev.tatoeba.org/v1/sentences";

  // Idioma/word_count según el idioma de estudio activo. getTargetLanguage()
  // es una declaración de nivel superior del MISMO módulo (ver nota de
  // scope en banco-palabras-ui.js) — se referencia "a pelo" y con
  // try/catch por si se usa este archivo suelto (fuera del build real).
  function bpTatoebaLang() {
    try { return getTargetLanguage() === "it" ? "ita" : "eng"; } catch (e) { /* noop */ }
    return "eng";
  }

  function bpTatoebaWordCount() {
    try { return getTargetLanguage() === "it" ? "3-4" : "4-6"; } catch (e) { /* noop */ }
    return "4-6";
  }

  function buildUrl(palabra) {
    return (
      BASE +
      "?lang=" + bpTatoebaLang() + "&q=" + encodeURIComponent(palabra) +
      "&word_count=" + bpTatoebaWordCount() + "&origin=original&trans%3Alang=spa&sort=random&limit=30"
    );
  }

  // Devuelve: { found, examples: [{en, es}], total }
  // examples trae UNA fila por cada traducción al español de cada oración
  // (una oración puede tener varias traducciones válidas — se ofrecen todas
  // por separado para que el usuario elija cuál(es) guardar).
  async function buscar(palabra) {
    const p = String(palabra || "").trim();
    if (!p) return { found: false, examples: [], total: 0 };

    let res;
    try {
      res = await fetch(buildUrl(p), {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        headers: { accept: "application/json" },
      });
    } catch (e) {
      const err = new Error("No se pudo conectar con Tatoeba.");
      err.code = "NETWORK";
      throw err;
    }

    if (!res.ok) {
      const err = new Error("Tatoeba respondió " + res.status);
      err.code = "HTTP_" + res.status;
      throw err;
    }

    const json = await res.json();
    const examples = [];
    (json.data || []).forEach((s) => {
      (s.translations || []).forEach((t) => {
        if (t && t.lang === "spa" && t.text) {
          examples.push({ en: s.text, es: t.text });
        }
      });
    });

    return {
      found: examples.length > 0,
      examples,
      total: (json.paging && json.paging.total) || examples.length,
    };
  }

  global.BancoPalabrasTatoeba = { buscar };
})(typeof window !== "undefined" ? window : globalThis);
