// banco-palabras/banco-palabras-buscar-sistema.js
//
// "Oraciones en sistema": busca, entre los ejercicios YA EMBEBIDOS en el
// build (currentStudyExercises(), ver build.py → __STUDY_EXERCISES_JSON__),
// todas las oraciones de tipo "traduccion" y "completar" (así lo pidió el
// usuario explícitamente: no corregir ni dictado) que contengan alguna de
// las "Formas" de la palabra (change, changed, changing...).
//
// No hace falta ningún índice/archivo aparte ni fetch extra: todo el
// banco de ejercicios de inglés ya vive en memoria una vez cargado
// index.html, así que esto es una sola pasada en JS puro sobre ese array.
//
// También busca en IRREGULARES_DATA.banco (data-en/irregulares/banco/
// paquete-NN.txt, ya parseado por irregulares/compilar.py y embebido como
// const IRREGULARES_DATA en el mismo script). Cada item es
// [id, reglaId, "t"|"c", es, en-con-[formas]-marcadas, [verbIdA, verbIdB]]
// — el inglés trae las 2 formas que se evalúan ahí marcadas entre
// corchetes, p. ej. "...finally [got] on the bus and [went] home.". Para
// "Oraciones en sistema" no hace falta diferenciar "t" de "c": en ambos
// casos mostramos la frase completa (quitando los corchetes), igual que
// reconstruirCompletar() ya hace para los "completar" normales.

(function (global) {
  "use strict";

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function wordRegexFor(forma) {
    return new RegExp("\\b" + escapeRegExp(forma) + "\\b", "i");
  }

  const BRACKET_RE = /\[([^\]]+)\]/g;

  // Quita los corchetes del banco de irregulares, dejando la frase llana:
  // "...finally [got] on the bus" -> "...finally got on the bus".
  function irrPlanoText(en) {
    return String(en || "").replace(BRACKET_RE, (m, w) => w);
  }

  // Busca, en IRREGULARES_DATA.banco (todos los paquetes), oraciones cuyas
  // palabras marcadas entre [corchetes] calcen con alguna forma. Devuelve
  // resultados con la misma forma que buscarEnSistema().
  function buscarEnIrregularesBanco(formasOrdenadas, formaQueCalza) {
    const resultados = [];
    // IRREGULARES_DATA es un "const" de nivel superior del MISMO
    // <script type="module"> (no una propiedad de window) — se referencia
    // a pelo, no como "global.IRREGULARES_DATA" (eso siempre da undefined,
    // aunque el const exista y funcione bien referenciado así desde código
    // que vive en ese mismo script). Fuera del build real no existe, así
    // que el ReferenceError cae al catch sin romper.
    let datos;
    try { datos = IRREGULARES_DATA; } catch (e) { datos = undefined; }
    const banco = datos && datos.banco;
    if (!banco) return resultados;

    Object.keys(banco).forEach((pkg) => {
      (banco[pkg] || []).forEach((item) => {
        // item: [id, reglaId, "t"|"c", es, en, [verbIdA, verbIdB]]
        const id = item[0];
        const tipo = item[2];
        const es = item[3];
        const en = item[4];
        if (!en) return;
        const marcas = en.match(BRACKET_RE);
        if (!marcas) return;
        let forma = null;
        for (const m of marcas) {
          const palabra = m.slice(1, -1);
          const calzo = formaQueCalza(palabra);
          if (calzo) { forma = calzo; break; }
        }
        if (!forma) return;
        resultados.push({
          en: irrPlanoText(en),
          es: es || "",
          forma,
          origen: "sistema",
          fuenteId: id,
          tipoOriginal: tipo === "c" ? "completar" : "traduccion",
        });
      });
    });

    return resultados;
  }

  // Reconstruye el englishSentence de un ejercicio "completar" (que trae
  // huecos "___") usando sus "options" en orden, para poder buscar la
  // forma dentro de la frase completa.
  function reconstruirCompletar(ex) {
    const opts = Array.isArray(ex.options) ? ex.options.slice() : [];
    let i = 0;
    return String(ex.englishSentence || "").replace(/_{2,}/g, () => {
      const v = opts[i] != null ? opts[i] : "___";
      i++;
      return v;
    });
  }

  // formas: ["change","changed","changing"]
  // exercises: array de currentStudyExercises() (type "traduccion"/"completar"/...)
  // Devuelve: [{ en, es, forma, origen:"sistema", fuenteId, tipoOriginal }]
  function buscarEnSistema(exercises, formas) {
    const resultados = [];
    const vistos = new Set();
    const formasOrdenadas = (formas || []).slice().sort((a, b) => b.length - a.length);

    function formaQueCalza(texto) {
      for (const f of formasOrdenadas) {
        if (wordRegexFor(f).test(texto)) return f;
      }
      return null;
    }

    (exercises || []).forEach((ex) => {
      if (ex.type === "traduccion") {
        const en = ex.englishWord || "";
        const forma = formaQueCalza(en);
        if (forma && !vistos.has(ex.id)) {
          vistos.add(ex.id);
          resultados.push({ en, es: ex.spanishWord || "", forma, origen: "sistema", fuenteId: ex.id, tipoOriginal: "traduccion" });
        }
      } else if (ex.type === "completar") {
        const en = reconstruirCompletar(ex);
        const forma = formaQueCalza(en);
        if (forma && !vistos.has(ex.id)) {
          vistos.add(ex.id);
          resultados.push({ en, es: ex.spanishWord || "", forma, origen: "sistema", fuenteId: ex.id, tipoOriginal: "completar" });
        }
      }
    });

    // + IRREGULARES_DATA.banco (paquete-NN.txt): mismo criterio de "forma
    // que calza", dedupe por fuenteId junto con lo anterior.
    buscarEnIrregularesBanco(formasOrdenadas, formaQueCalza).forEach((r) => {
      if (!vistos.has(r.fuenteId)) {
        vistos.add(r.fuenteId);
        resultados.push(r);
      }
    });

    return resultados;
  }

  // Helper de diagnóstico: igual que buscarEnSistema(), pero toma
  // currentStudyExercises() él mismo (referenciada "a pelo" — por eso esto
  // SÍ funciona pegado directo en la consola del navegador, a diferencia
  // de escribir "currentStudyExercises()" ahí: esta función ya quedó
  // "cerrada" sobre el scope real del módulo al cargarse, así que
  // encuentra la variable sin problema aunque la LLAMES desde la consola).
  // Uso en consola: BancoPalabrasBuscarSistema.probar(["get","got"])
  function probar(formas) {
    let exercises = [];
    try { exercises = currentStudyExercises(); } catch (e) { /* noop */ }
    const resultados = buscarEnSistema(exercises, formas);
    console.log(`[banco-palabras] "${(formas || []).join("/")}" -> ${resultados.length} oración(es) en sistema`);
    console.table(resultados.map((r) => ({ forma: r.forma, en: r.en, es: r.es, origen: r.tipoOriginal, fuenteId: r.fuenteId })));
    return resultados;
  }

  global.BancoPalabrasBuscarSistema = { buscarEnSistema, probar };
})(typeof window !== "undefined" ? window : globalThis);
