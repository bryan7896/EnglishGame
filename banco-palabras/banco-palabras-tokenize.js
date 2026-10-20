// banco-palabras/banco-palabras-tokenize.js
//
// Parte el texto en español de un ejercicio en "tokens": letras seguidas
// (una palabra) o lo que haya entre medio (espacios, signos, ¿¡, etc.).
// Un token de letras es "clickeable" si tiene 3 letras o más — ÚNICO
// filtro, confirmado con el usuario (no se excluye nada de
// contracciones.json: ese archivo es solo de inglés y no aplica al texto
// en español).
//
// Se usa tanto para pintar el HTML (cada palabra clickeable envuelta en
// un <span>, SIN cambiar su apariencia — el estilo lo da el CSS, que la
// deja igual a texto normal) como para la navegación "palabra siguiente/
// anterior" dentro del modal (se mueve por los tokens clickeables, en el
// orden en que aparecen en ese mismo texto).

(function (global) {
  "use strict";

  const LETRA_RE = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;

  function escapeHTML(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Devuelve la lista de segmentos del texto, en orden:
  // { text, clickable, idx } — idx solo se asigna a los clickeables
  // (0, 1, 2… en el orden en que aparecen), para poder navegar entre ellos.
  function tokenizar(texto) {
    const segmentos = [];
    let last = 0;
    let idx = 0;
    const s = String(texto || "");
    let m;
    LETRA_RE.lastIndex = 0;
    while ((m = LETRA_RE.exec(s))) {
      if (m.index > last) segmentos.push({ text: s.slice(last, m.index), clickable: false });
      const palabra = m[0];
      const clickable = palabra.length >= 3;
      segmentos.push({ text: palabra, clickable, idx: clickable ? idx : undefined });
      if (clickable) idx++;
      last = m.index + palabra.length;
    }
    if (last < s.length) segmentos.push({ text: s.slice(last), clickable: false });
    return segmentos;
  }

  // HTML listo para insertar: palabras clickeables envueltas en
  // <span class="bp-word" data-bp-idx="N" data-bp-word="palabra">palabra</span>,
  // todo lo demás tal cual (escapado). data-bp-idx permite resaltar en
  // azul exactamente ese <span> mientras el modal está abierto.
  function renderHTML(texto) {
    return tokenizar(texto).map((seg) => {
      if (!seg.clickable) return escapeHTML(seg.text);
      return '<span class="bp-word" data-bp-idx="' + seg.idx + '" data-bp-word="' + escapeHTML(seg.text.toLowerCase()) + '">' + escapeHTML(seg.text) + "</span>";
    }).join("");
  }

  // Lista ordenada de las palabras clickeables (para la navegación
  // ‹ anterior / siguiente › dentro del modal de un mismo texto).
  function listaClickeables(texto) {
    return tokenizar(texto).filter((s) => s.clickable).map((s) => s.text);
  }

  global.BancoPalabrasTokenize = { tokenizar, renderHTML, listaClickeables, escapeHTML };
})(typeof window !== "undefined" ? window : globalThis);
