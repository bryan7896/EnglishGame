// banco-palabras/banco-palabras-api.js
//
// Cliente del Spanish-English Dictionary API de Merriam-Webster, pero en
// la DIRECCIÓN INVERSA a la prueba de concepto (dictionaryapi.html): ahí
// se consultaba una palabra en INGLÉS y se devolvía su traducción al
// español; acá se hace click sobre una palabra en ESPAÑOL (dentro de los
// ejercicios de Traducción/Corrección/Completar) y se consulta tal cual
// ese texto en español, directo contra el mismo endpoint.
//
// normalizeReverse() ya está verificado contra una respuesta REAL del API
// (consulta "cambiar", devuelta por el usuario) — no es un supuesto. De esa
// respuesta real salieron 2 ajustes importantes frente al primer borrador:
//   1. "shortdef" (p.ej. ["to change", "to exchange, to trade"]) es la
//      fuente más limpia para resolver la palabra en inglés, mejor que
//      armarla desde dt/text — pero hay que quitarle el "to " de
//      infinitivo y cualquier paréntesis ("to change (money)" → "change").
//   2. En "vis" (ejemplos), en esta dirección "t" es la frase en ESPAÑOL y
//      "tr" es su traducción al INGLÉS (al revés que en la consulta en
//      inglés, donde "t" es la frase en inglés). readDt() ya guarda ambos
//      sin asumir cuál es cuál, así que normalizeReverse() es el único que
//      sabe que debe leer "tr" como inglés.
// Si alguna palabra sale rara igual, usa
// BancoPalabrasAPI.debugRaw(palabra) para ver el JSON crudo y lo ajusto.
//
// Límite del plan gratis: 1000 consultas/día. Cachea igual que la POC
// (cada palabra se consulta una sola vez por navegador).

(function (global) {
  "use strict";

  const MW_DIRECT = "https://www.dictionaryapi.com/api/v3/references/spanish/json/";
  const LS_CACHE = "englishTrainerBancoPalabras_cache_v1";

  function lsGet(k, d) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* noop */ }
  }
  const cache = lsGet(LS_CACHE, {});
  function saveCache() { lsSet(LS_CACHE, cache); }

  function fetchWithTimeout(url, ms) {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).finally(() => { if (t) clearTimeout(t); });
  }

  // ---------- mismas utilidades de parseo que la prueba de concepto ----------
  function mwClean(s) {
    return String(s || "")
      .replace(/\{bc\}/g, " ")
      .replace(/\{(?:a_link|d_link|i_link|et_link|mat|dxt|sx)\|([^|}]*)[^}]*\}/g, "$1")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,;.:)!?])/g, "$1")
      .replace(/\(\s+/g, "(")
      .trim()
      .replace(/^[,;:\s]+|[,;:\s]+$/g, "");
  }
  function splitText(raw) {
    const hints = [];
    String(raw || "").replace(/\{sx\|([^|}]*)/g, (m, w) => { hints.push(w); return m; });
    const main = mwClean(String(raw || "").replace(/\{sx\|[^}]*\}/g, ""));
    return { main, hints };
  }
  const headOf = (e) => String((e.hwi && e.hwi.hw) || (e.meta && e.meta.id) || "").split(":")[0].replace(/\*/g, "").toLowerCase().trim();
  function walkSseq(sseq, cb) {
    const visit = (item) => {
      if (!Array.isArray(item)) return;
      const tag = item[0], val = item[1];
      if (tag === "sense" || tag === "sdsense") cb(val || {});
      else if (tag === "bs" && val && val.sense) cb(val.sense);
      else if (tag === "pseq" && Array.isArray(val)) val.forEach(visit);
    };
    (sseq || []).forEach((group) => (group || []).forEach(visit));
  }
  function readDt(dt, out) {
    (dt || []).forEach((part) => {
      if (!Array.isArray(part)) return;
      const tag = part[0], val = part[1];
      if (tag === "text") out.texts.push(val);
      else if (tag === "vis") (val || []).forEach((v) => { if (v && v.t) out.vis.push({ t: mwClean(v.t), tr: mwClean(v.tr || "") }); });
      else if (tag === "uns") (val || []).forEach((u) => readDt(u, out));
    });
  }
  const uniq = (a) => Array.from(new Set(a));

  // "to change (money)" → "change" · "to exchange, to trade" → "exchange"
  function toEnglishHeadword(s) {
    return String(s || "")
      .split(/[,;]/)[0]
      .replace(/\([^)]*\)/g, "")
      .replace(/^\s*to\s+/i, "")
      .trim()
      .toLowerCase();
  }

  // Consulta normal (palabra en INGLÉS → traducción en español). Es la
  // misma lógica de la prueba de concepto; se deja disponible porque la
  // usamos como SEGUNDO paso para traer el detalle completo ("Aprender")
  // del headword en inglés que resulte de la búsqueda en español.
  function normalizeForward(word, raw) {
    const base = { word, found: false, suggestions: [], ipa: "", audio: "", pos: [], senses: [], examples: [], phrases: [], forms: [], short: [] };
    if (!Array.isArray(raw) || !raw.length) return base;
    if (raw.every((x) => typeof x === "string")) { base.suggestions = raw.slice(0, 12); return base; }

    let entries = raw.filter((e) => e && typeof e === "object" && e.meta && e.meta.lang === "en");
    let head = entries.filter((e) => headOf(e) === word && Array.isArray(e.def));
    if (!head.length) {
      const xref = entries.find((e) => headOf(e) === word && e.xrs);
      const target = xref ? JSON.stringify(xref.xrs).match(/"xref":"([^":]+)/) : null;
      const via = target ? target[1].toLowerCase() : null;
      head = entries.filter((e) => Array.isArray(e.def) && (via ? headOf(e) === via : (e.meta.stems || []).map((s) => s.toLowerCase()).includes(word)));
      if (head.length) base.seeAlso = headOf(head[0]);
    }
    if (!head.length) return base;
    base.found = true;

    head.forEach((e) => {
      const fl = e.fl || "";
      if (fl) base.pos.push(fl);
      (e.hwi.prs || []).forEach((p) => {
        if (!base.ipa && p.mw) base.ipa = p.mw;
        if (!base.audio && p.sound && p.sound.audio) base.audio = p.sound.audio;
      });
      (e.ins || []).forEach((inf) => {
        const form = String(inf.if || "").replace(/\*/g, "");
        if (!form) return;
        const p = (inf.prs || [])[0] || {};
        base.forms.push({ form, label: inf.il || "", pron: p.mw || "", audio: (p.sound && p.sound.audio) || "" });
      });
      (e.shortdef || []).forEach((s) => base.short.push(s));
      (e.def || []).forEach((block) => {
        walkSseq(block.sseq, (sense) => {
          const out = { texts: [], vis: [] };
          readDt(sense.dt, out);
          const joined = splitText(out.texts.join(" "));
          const phrase = sense.vrs && sense.vrs[0] && sense.vrs[0].va ? mwClean(sense.vrs[0].va) : "";
          const s = { pos: fl, vd: block.vd || "", es: joined.main, hints: joined.hints, phrase, vis: out.vis.map((v) => ({ en: v.t, es: v.tr })) };
          base.senses.push(s);
          s.vis.forEach((v) => base.examples.push(Object.assign({ phrase }, v)));
          if (phrase && joined.main) base.phrases.push({ en: phrase, es: joined.main });
        });
      });
    });
    base.pos = uniq(base.pos);
    base.mainSenses = base.senses.filter((s) => !s.phrase && s.es);
    return base;
  }

  // Consulta en ESPAÑOL. headOf(e) debe calzar con la palabra en español
  // tecleada; se toman las entradas marcadas como lang "es" (ver nota al
  // inicio del archivo sobre la incertidumbre de este supuesto).
  // El resultado trae, además de lo propio, "englishHeadword": el
  // headword en inglés que la entrada en español apunta/traduce, que es
  // lo que luego se usa para pedir el detalle rico con normalizeForward().
  function normalizeReverse(wordEs, raw) {
    const base = { wordEs, found: false, suggestions: [], englishHeadword: "", englishForms: [], mainTranslation: "", short: [] };
    if (!Array.isArray(raw) || !raw.length) return base;
    if (raw.every((x) => typeof x === "string")) { base.suggestions = raw.slice(0, 12); return base; }

    const entries = raw.filter((e) => e && typeof e === "object" && e.meta && e.meta.lang === "es");
    const head = entries.filter((e) => headOf(e) === wordEs && Array.isArray(e.def));
    if (!head.length) return base;
    base.found = true;

    const candidatosEN = [];
    head.forEach((e) => {
      // "ins" casi nunca trae nada en las entradas en español (ahí viven
      // las conjugaciones en "suppl.cjts", que son en español y no sirven
      // para armar "Formas" en inglés) — se deja por si alguna entrada sí
      // lo trae, pero la lista real de formas la completa normalizeForward().
      (e.ins || []).forEach((inf) => {
        const form = String(inf.if || "").replace(/\*/g, "");
        if (form) base.englishForms.push(form);
      });
      (e.shortdef || []).forEach((s) => base.short.push(s));
      (e.def || []).forEach((block) => {
        walkSseq(block.sseq, (sense) => {
          const out = { texts: [], vis: [] };
          readDt(sense.dt, out);
          const joined = splitText(out.texts.join(" "));
          // "text" en esta dirección ya es el inglés (lo confirma la
          // respuesta real de "cambiar": "{bc}to {a_link|change} " →
          // "to change"), y "vis.tr" también es inglés (ver nota arriba).
          if (joined.main) candidatosEN.push(toEnglishHeadword(joined.main));
          out.vis.forEach((v) => { if (v.tr) candidatosEN.push(toEnglishHeadword(v.tr)); });
        });
      });
    });
    // shortdef es la fuente más limpia (pensada por MW como resumen),
    // así que manda; el resto queda de respaldo si no hay shortdef.
    const desdeShort = base.short.map(toEnglishHeadword).filter(Boolean);
    base.mainTranslation = desdeShort[0] || candidatosEN[0] || "";
    base.englishHeadword = (base.englishForms[0] || desdeShort[0] || candidatosEN[0] || "").toLowerCase();
    return base;
  }

  async function fetchRaw(word, key) {
    const url = MW_DIRECT + encodeURIComponent(word) + "?key=" + encodeURIComponent(key);
    const r = await fetchWithTimeout(url, 12000);
    const text = await r.text();
    if (!r.ok) {
      const err = new Error("HTTP " + r.status);
      err.status = r.status;
      err.body = text.slice(0, 200);
      throw err;
    }
    return JSON.parse(text);
  }

  // ---------- API pública ----------

  // Devuelve el JSON crudo de la consulta, sin parsear. Útil para que el
  // usuario lo revise/comparta si normalizeReverse() no acierta.
  async function debugRaw(wordEs) {
    const key = global.BancoPalabrasData.getApiKey();
    if (!key) throw new Error("Falta configurar la key del diccionario (botón 'key').");
    return fetchRaw(String(wordEs || "").trim().toLowerCase(), key);
  }

  // Flujo completo al hacer click + confirmar en una palabra en español:
  // 1) consulta la palabra en español → resuelve el headword en inglés
  // 2) si lo encuentra, pide el detalle normal (inglés→español) de ESE
  //    headword, que es el que alimenta el modal "Aprender" con sentidos,
  //    ejemplos y expresiones (igual que en la prueba de concepto).
  async function buscarDesdeEspanol(wordEs) {
    wordEs = String(wordEs || "").trim().toLowerCase();
    if (!wordEs) return { found: false };
    if (cache[wordEs]) return cache[wordEs];

    const key = global.BancoPalabrasData.getApiKey();
    if (!key) {
      const err = new Error("Falta configurar la key del diccionario (botón 'key').");
      err.code = "NO_KEY";
      throw err;
    }

    const raw = await fetchRaw(wordEs, key);
    const reverso = normalizeReverse(wordEs, raw);
    let detalle = null;
    if (reverso.found && reverso.englishHeadword) {
      // Si la misma respuesta ya trae entradas en inglés (raw puede venir
      // mixto), se intenta parsear directo antes de gastar otra consulta.
      detalle = normalizeForward(reverso.englishHeadword, raw);
      if (!detalle.found) {
        const rawEn = await fetchRaw(reverso.englishHeadword, key);
        detalle = normalizeForward(reverso.englishHeadword, rawEn);
      }
    }

    const resultado = {
      found: !!(reverso.found && detalle && detalle.found),
      wordEs,
      suggestions: reverso.suggestions,
      englishWord: detalle ? detalle.word : reverso.englishHeadword,
      forms: detalle && detalle.forms.length ? uniq([detalle.word].concat(detalle.forms.map((f) => f.form.toLowerCase()))) : (reverso.englishForms.length ? uniq([reverso.englishHeadword].concat(reverso.englishForms.map((f) => f.toLowerCase()))) : [reverso.englishHeadword]),
      mainTranslation: reverso.mainTranslation,
      detalle, // objeto completo de normalizeForward(): pos, senses, examples, phrases, forms, audio, ipa...
    };
    cache[wordEs] = resultado;
    saveCache();
    return resultado;
  }

  global.BancoPalabrasAPI = {
    buscarDesdeEspanol,
    debugRaw,
    _normalizeForward: normalizeForward,
    _normalizeReverse: normalizeReverse,
  };
})(typeof window !== "undefined" ? window : globalThis);
