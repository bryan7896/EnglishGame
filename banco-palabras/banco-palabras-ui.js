// banco-palabras/banco-palabras-ui.js
//
// Capa visual: palabras clickeables dentro del texto en español + el
// flujo completo de modales (confirmar → resultado → Aprender → guardar).
// Depende de (deben cargarse antes): banco-palabras-tokenize.js,
// banco-palabras-data.js, banco-palabras-api.js, banco-palabras-buscar-
// sistema.js, banco-palabras-tatoeba.js. Una vez integrado al build, también usa getTargetLangMeta()
// (idioma.js) y currentStudyExercises() (definidas en index.html) — si no
// existen (como en esta entrega suelta, antes de integrarlo), se degrada
// sin romper: trata el idioma como "no inglés" y "0 oraciones en sistema".
//
// Integración en traduccion.js / completar.js / corregir.js (3 archivos,
// 1 línea cada uno):
//   ANTES:  `${window._escHTML(spanish)}`               (traduccion.js)
//   AHORA:  `${BancoPalabrasUI.html(spanish)}`
//   ... e inmediatamente después de container.innerHTML = `...`:
//   BancoPalabrasUI.activar(container);
// (completar.js no escapaba spanishWord — igual aplica BancoPalabrasUI.html,
// que sí escapa.)

(function (global) {
  "use strict";

  // IMPORTANTE: currentStudyExercises()/getTargetLangMeta() son
  // declaraciones de nivel superior dentro del MISMO <script type="module">
  // (no propiedades de window) — hay que referenciarlas "a pelo" (tal
  // cual, sin "global." ni "window." delante) para que el motor las
  // resuelva por scope del módulo. "global.currentStudyExercises" siempre
  // da undefined aunque la función exista y funcione bien llamada así.
  // Fuera del build real (pruebas sueltas, sin esas funciones declaradas)
  // el ReferenceError cae al catch y se degrada sin romper.
  function targetIsEnglish() {
    try {
      return getTargetLangMeta().code === "en";
    } catch (e) { /* noop */ }
    return true; // fuera del build real (pruebas sueltas) se asume inglés
  }

  // Para italiano no hay diccionario (Merriam-Webster es inglés-español),
  // así que solo se ofrece la búsqueda con Tatoeba.
  function targetIsItalian() {
    try {
      return getTargetLangMeta().code === "it";
    } catch (e) { /* noop */ }
    return false;
  }

  function studyExercisesSafe() {
    try {
      return currentStudyExercises();
    } catch (e) { /* noop */ }
    return [];
  }

  // ---------- HTML de entrada (reemplaza a window._escHTML en los 3 render) ----------
  // Palabras clickeables tanto en inglés (diccionario + Tatoeba) como en
  // italiano (solo Tatoeba, ver botonesBuscarHTML). Para cualquier otro
  // caso (pruebas sueltas sin idioma definido) se deja el texto plano.
  function html(texto) {
    const T = global.BancoPalabrasTokenize;
    if (targetIsEnglish() || targetIsItalian()) return T.renderHTML(texto);
    return T.escapeHTML(texto);
  }

  // ---------- activación de los clicks dentro de un contenedor ----------
  function activar(container) {
    if (!container || container._bpActivado) return;
    container._bpActivado = true;
    container.addEventListener("click", (e) => {
      const span = e.target.closest(".bp-word");
      if (!span || !container.contains(span)) return;
      e.stopPropagation();
      abrirModalPalabra(container, Number(span.dataset.bpIdx));
    });
  }

  // ---------- estado del modal activo (uno a la vez) ----------
  let estado = null; // { container, spans, idx, modal }

  function limpiarResalte() {
    if (estado && estado.spans[estado.idx]) estado.spans[estado.idx].classList.remove("bp-word-active");
  }
  function ponerResalte() {
    if (estado && estado.spans[estado.idx]) estado.spans[estado.idx].classList.add("bp-word-active");
  }

  function cerrarModal() {
    if (!estado) return;
    limpiarResalte();
    if (estado.modal) estado.modal.remove();
    estado = null;
  }

  function abrirModalPalabra(container, idx) {
    cerrarModal();
    const spans = Array.from(container.querySelectorAll(".bp-word")).sort(
      (a, b) => Number(a.dataset.bpIdx) - Number(b.dataset.bpIdx)
    );
    estado = { container, spans, idx, modal: null };
    ponerResalte();
    renderConfirmacion();
  }

  function palabraActual() {
    return estado.spans[estado.idx].dataset.bpWord;
  }

  function montarModal(innerHTML) {
    if (estado.modal) estado.modal.remove();
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active bp-modal-overlay";
    modal.innerHTML = innerHTML;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) cerrarModal(); });
    const x = modal.querySelector("[data-bp-close]");
    if (x) x.addEventListener("click", () => cerrarModal());
    estado.modal = modal;
    return modal;
  }

  // Conecta los 2 botones de búsqueda ("Con Tatoeba" / "En diccionario")
  // y el Enter del input a los flujos correspondientes, siempre leyendo
  // la palabra TAL COMO QUEDÓ EN EL INPUT (puede que el usuario la haya
  // editado antes de buscar). Se reutiliza en el paso 1 (confirmación) y
  // en cualquier pantalla de "no encontrado"/error con reintento.
  function wireBotonesBuscar(modal, inputSelector) {
    const input = modal.querySelector(inputSelector);
    const dicBtn = modal.querySelector(".bp-buscar-dic");
    const tatoebaBtn = modal.querySelector(".bp-buscar-tatoeba");
    if (dicBtn) dicBtn.addEventListener("click", () => buscarPalabra(input.value.trim()));
    if (tatoebaBtn) tatoebaBtn.addEventListener("click", () => buscarTatoeba(input.value.trim()));
    if (input) input.addEventListener("keypress", (e) => {
      if (e.key !== "Enter") return;
      // En italiano no hay botón de diccionario: Enter busca con Tatoeba.
      if (dicBtn) buscarPalabra(input.value.trim());
      else buscarTatoeba(input.value.trim());
    });
    return input;
  }

  // Botones de búsqueda: en italiano solo "Con Tatoeba" (no hay
  // diccionario inglés-español disponible para italiano).
  function botonesBuscarHTML() {
    if (targetIsItalian()) {
      return `
        <div class="bp-confirm-botones">
          <button class="fun-btn primary-btn bp-buscar-tatoeba full-width">Con Tatoeba</button>
        </div>`;
    }
    return `
      <div class="bp-confirm-botones">
        <button class="fun-btn bp-buscar-tatoeba">Con Tatoeba</button>
        <button class="fun-btn primary-btn bp-buscar-dic">En diccionario</button>
      </div>`;
  }

  // ---------- paso 1: confirmación ----------
  function renderConfirmacion() {
    const T = global.BancoPalabrasTokenize;
    const palabra = palabraActual();
    const esItaliano = targetIsItalian();
    const modal = montarModal(`
      <div class="modal-friend bp-confirm">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <div class="bp-confirm-row">
          <button class="bp-nav" data-bp-prev aria-label="Palabra anterior">‹</button>
          <input type="text" class="bp-confirm-input" value="${esItaliano ? "" : T.escapeHTML(palabra)}" placeholder="${esItaliano ? "Escribe la palabra en italiano" : ""}" autocomplete="off">
          <button class="bp-nav" data-bp-next aria-label="Palabra siguiente">›</button>
        </div>
        ${botonesBuscarHTML()}
      </div>
    `);
    const prevBtn = modal.querySelector("[data-bp-prev]");
    const nextBtn = modal.querySelector("[data-bp-next]");
    prevBtn.disabled = estado.idx <= 0;
    nextBtn.disabled = estado.idx >= estado.spans.length - 1;
    prevBtn.addEventListener("click", () => moverPalabra(-1));
    nextBtn.addEventListener("click", () => moverPalabra(1));
    wireBotonesBuscar(modal, ".bp-confirm-input");
  }

  function moverPalabra(delta) {
    const nuevo = estado.idx + delta;
    if (nuevo < 0 || nuevo >= estado.spans.length) return;
    limpiarResalte();
    estado.idx = nuevo;
    ponerResalte();
    renderConfirmacion();
  }

  // ---------- paso 2: buscar + resultado (diccionario) ----------
  // Recibe una palabra explícita (del input, que puede haber sido editado)
  // en vez de depender de la palabra originalmente tocada en el texto.
  async function buscarPalabra(palabra) {
    montarModalMantenerNav(`<div class="modal-friend bp-loading">Buscando «${global.BancoPalabrasTokenize.escapeHTML(palabra)}»…</div>`);
    try {
      const r = await global.BancoPalabrasAPI.buscarDesdeEspanol(palabra);
      if (!estado) return; // se cerró mientras buscaba
      if (!r.found) {
        renderNoEncontrado(r);
        return;
      }
      renderResultado(r);
    } catch (err) {
      if (!estado) return;
      renderError(err);
    }
  }

  function montarModalMantenerNav(innerHTML) {
    // igual que montarModal, pero sin volver a montar los botones de
    // navegación (se usa para los pasos intermedios de carga/resultado).
    montarModal(innerHTML);
  }

  function renderError(err) {
    const esSinKey = err && err.code === "NO_KEY";
    montarModal(`
      <div class="modal-friend bp-error">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>${esSinKey ? "Falta configurar la key del diccionario. Ábrela desde el botón <b>key</b> en Banco de palabras." : "No se pudo consultar el diccionario: " + global.BancoPalabrasTokenize.escapeHTML(err.message || String(err))}</p>
      </div>
    `);
  }

  function renderNoEncontrado(r) {
    const T = global.BancoPalabrasTokenize;
    const sugerencias = (r.suggestions || []).slice(0, 5);
    const modal = montarModal(`
      <div class="modal-friend bp-error">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>«${T.escapeHTML(r.wordEs)}» no está en el diccionario.</p>
        ${sugerencias.length ? `
          <p class="bp-dim">¿Quisiste decir: ${sugerencias.map((s) => `<button type="button" class="bp-sugerencia" data-bp-sugerencia="${T.escapeHTML(s)}">${T.escapeHTML(s)}</button>`).join(", ")}?</p>
        ` : ""}
        <label class="bp-reintentar-label">Buscar otra palabra
          <input type="text" class="bp-reintentar-input" value="${T.escapeHTML(r.wordEs)}" autocomplete="off">
        </label>
        ${botonesBuscarHTML()}
      </div>
    `);

    const input = wireBotonesBuscar(modal, ".bp-reintentar-input");
    input.focus();
    input.select();

    modal.querySelectorAll("[data-bp-sugerencia]").forEach((btn) => {
      btn.addEventListener("click", () => {
        input.value = btn.dataset.bpSugerencia;
        buscarPalabra(input.value.trim());
      });
    });
  }

  function renderResultado(r) {
    const T = global.BancoPalabrasTokenize;
    const modal = montarModal(`
      <div class="modal-friend bp-resultado">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>Texto en inglés: <b>${T.escapeHTML(r.englishWord)}</b></p>
        <p>Formas: ${r.forms.map((f) => T.escapeHTML(f)).join(", ")}</p>
        <p>Traducción principal: ${T.escapeHTML(r.mainTranslation || "—")}</p>
        <button class="fun-btn primary-btn bp-aprender">Aprender</button>
      </div>
    `);
    modal.querySelector(".bp-aprender").addEventListener("click", () => renderAprender(r));
  }

  // ---------- paso 2b: buscar + resultado (Tatoeba) ----------
  // Ruta alterna al diccionario: busca oraciones en inglés que contengan
  // la palabra (tal cual se escribió/editó en el input — con Tatoeba
  // normalmente se busca la palabra en INGLÉS, a diferencia del
  // diccionario que recibe la palabra en español) y sus traducciones al
  // español. No trae "Formas" (no hay dato de diccionario) y por pedido
  // explícito del usuario NO se cargan "oraciones en sistema" aquí.
  async function buscarTatoeba(palabra) {
    const p = String(palabra || "").trim();
    if (!p) return;
    montarModalMantenerNav(`<div class="modal-friend bp-loading">Buscando «${global.BancoPalabrasTokenize.escapeHTML(p)}» en Tatoeba…</div>`);
    try {
      const r = await global.BancoPalabrasTatoeba.buscar(p);
      if (!estado) return; // se cerró mientras buscaba
      if (!r.found) {
        renderTatoebaNoEncontrado(p);
        return;
      }
      renderTatoebaResultado(p, r);
    } catch (err) {
      if (!estado) return;
      renderTatoebaError(err, p);
    }
  }

  function renderTatoebaNoEncontrado(palabra) {
    const T = global.BancoPalabrasTokenize;
    const modal = montarModal(`
      <div class="modal-friend bp-error">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>Tatoeba no encontró oraciones con «${T.escapeHTML(palabra)}».</p>
        <label class="bp-reintentar-label">Buscar otra palabra
          <input type="text" class="bp-reintentar-input" value="${T.escapeHTML(palabra)}" autocomplete="off">
        </label>
        ${botonesBuscarHTML()}
      </div>
    `);
    const input = wireBotonesBuscar(modal, ".bp-reintentar-input");
    input.focus();
    input.select();
  }

  function renderTatoebaError(err, palabra) {
    const T = global.BancoPalabrasTokenize;
    const modal = montarModal(`
      <div class="modal-friend bp-error">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>No se pudo consultar Tatoeba: ${T.escapeHTML(err && err.message ? err.message : String(err))}</p>
        <label class="bp-reintentar-label">Buscar otra palabra
          <input type="text" class="bp-reintentar-input" value="${T.escapeHTML(palabra)}" autocomplete="off">
        </label>
        ${botonesBuscarHTML()}
      </div>
    `);
    wireBotonesBuscar(modal, ".bp-reintentar-input");
  }

  // Lista de oraciones de Tatoeba, seleccionables + editables (✏️), igual
  // en espíritu a la lista de ejemplos de "Aprender" pero sin grupos de
  // sentido/Formas y SIN mezclar oraciones del sistema (pedido explícito).
  function renderTatoebaResultado(palabra, r) {
    const T = global.BancoPalabrasTokenize;
    const examples = r.examples;
    const seleccion = new Set();
    const ediciones = {}; // idx -> {en, es}

    function filaEjemplo(ex, idx) {
      const en = (ediciones[idx] && ediciones[idx].en) || ex.en;
      const es = (ediciones[idx] && ediciones[idx].es) || ex.es;
      return `
        <div class="bp-ejemplo${seleccion.has(idx) ? " bp-ejemplo-sel" : ""}" data-bp-ex="${idx}">
          <span class="bp-ejemplo-texto">“${T.escapeHTML(en)}” → ${T.escapeHTML(es)}</span>
          <button class="bp-pencil" data-bp-editar="${idx}" aria-label="Editar">✏️</button>
        </div>`;
    }

    const ejemplosHTML = examples.map((ex, idx) => filaEjemplo(ex, idx)).join("");

    const modal = montarModal(`
      <div class="modal-friend bp-aprender-card">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <p>Resultados de Tatoeba para «${T.escapeHTML(palabra)}»</p>
        <div class="bp-aprender-scroll">
          <div class="bp-ejemplos-list">${ejemplosHTML || `<p class="bp-dim">Sin oraciones.</p>`}</div>
        </div>
        <div class="bp-contadores">
          <span>Oraciones seleccionadas [<b data-bp-count-sel>0</b>]</span>
        </div>
        <button class="fun-btn primary-btn bp-guardar">Almacenar en Banco de palabras</button>
      </div>
    `);

    function refrescarContador() {
      modal.querySelector("[data-bp-count-sel]").textContent = String(seleccion.size);
    }

    function refrescarFila(idx) {
      const el = modal.querySelector(`[data-bp-ex="${idx}"]`);
      if (el) el.outerHTML = filaEjemplo(examples[idx], idx);
      wireFila(idx);
    }

    function wireFila(idx) {
      const el = modal.querySelector(`[data-bp-ex="${idx}"]`);
      if (!el) return;
      el.querySelector(".bp-ejemplo-texto").addEventListener("click", () => {
        if (seleccion.has(idx)) seleccion.delete(idx); else seleccion.add(idx);
        refrescarFila(idx);
        refrescarContador();
      });
      el.querySelector(".bp-pencil").addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEdicion(idx);
      });
    }

    examples.forEach((_, idx) => wireFila(idx));

    function abrirEdicion(idx) {
      const en = (ediciones[idx] && ediciones[idx].en) || examples[idx].en;
      const es = (ediciones[idx] && ediciones[idx].es) || examples[idx].es;
      const sub = document.createElement("div");
      sub.className = "modal-overlay modal-active bp-modal-overlay bp-sub-overlay";
      sub.innerHTML = `
        <div class="modal-friend bp-editar-card">
          <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
          <label>Inglés<textarea class="bp-edit-en">${T.escapeHTML(en)}</textarea></label>
          <label>Español<textarea class="bp-edit-es">${T.escapeHTML(es)}</textarea></label>
          <button class="fun-btn primary-btn bp-guardar-edicion">Guardar</button>
        </div>`;
      document.body.appendChild(sub);
      sub.addEventListener("click", (e) => { if (e.target === sub) sub.remove(); });
      sub.querySelector("[data-bp-close]").addEventListener("click", () => sub.remove());
      sub.querySelector(".bp-guardar-edicion").addEventListener("click", () => {
        ediciones[idx] = {
          en: sub.querySelector(".bp-edit-en").value.trim(),
          es: sub.querySelector(".bp-edit-es").value.trim(),
        };
        seleccion.add(idx); // editar implica que la quiere usar
        refrescarFila(idx);
        refrescarContador();
        sub.remove();
      });
    }

    modal.querySelector(".bp-guardar").addEventListener("click", () => {
      const palabraId = palabra.toLowerCase();
      const seleccionadas = Array.from(seleccion).map((idx) => {
        const base = examples[idx];
        const edit = ediciones[idx];
        return {
          en: edit ? edit.en : base.en,
          es: edit ? edit.es : base.es,
          forma: palabraId,
          origen: "tatoeba",
        };
      });
      global.BancoPalabrasData.guardarPalabra(palabraId, [palabraId], seleccionadas);
      modal.querySelector(".bp-aprender-card").innerHTML = `<p class="bp-guardado-ok">✅ Guardado en Banco de palabras</p>`;
      setTimeout(cerrarModal, 1200);
    });
  }

  // ---------- paso 3: "Aprender" (detalle + selección de oraciones) ----------
  const POS_ES = { noun: "sustantivo", verb: "verbo", adjective: "adjetivo", adverb: "adverbio", preposition: "preposición", conjunction: "conjunción", pronoun: "pronombre", interjection: "interjección" };

  // Tope total de oraciones por palabra en el Banco (seleccionadas a mano +
  // encontradas en el sistema). Si "en sistema" trae de sobra (puede
  // devolver cientos), solo se ofrecen/guardan las necesarias para no
  // pasar de este tope — nunca se recorta lo que el usuario seleccionó
  // a mano, solo el relleno automático de "sistema".
  const MAX_ORACIONES_POR_PALABRA = 50;

  function agruparSenses(senses) {
    // [{ pos, vd, items:[sense,...] }], en el orden en que aparecen
    const grupos = [];
    (senses || []).forEach((s) => {
      let g = grupos.find((x) => x.pos === s.pos && x.vd === s.vd);
      if (!g) { g = { pos: s.pos, vd: s.vd, items: [] }; grupos.push(g); }
      g.items.push(s);
    });
    return grupos;
  }

  function renderAprender(r) {
    const T = global.BancoPalabrasTokenize;
    const detalle = r.detalle || { senses: [], examples: [], phrases: [] };
    const enSistemaTotal = global.BancoPalabrasBuscarSistema
      ? global.BancoPalabrasBuscarSistema.buscarEnSistema(studyExercisesSafe(), r.forms)
      : [];
    // Cuántas de "en sistema" entran según lo ya seleccionado a mano, sin
    // pasar el tope total de la palabra.
    function enSistemaIncluidas() {
      const cupo = Math.max(0, MAX_ORACIONES_POR_PALABRA - seleccion.size);
      return enSistemaTotal.slice(0, cupo);
    }
    const seleccion = new Set();
    const ediciones = {}; // idx -> {en, es}
    const examples = detalle.examples || [];

    const gruposHTML = agruparSenses(detalle.senses).map((g) => {
      const header = g.vd ? `${g.pos} · ${g.vd}` : g.pos;
      const items = g.items.map((s, i) => `
        <li>
          ${i + 1} ${T.escapeHTML(s.es)}${s.hints && s.hints.length ? ` <span class="bp-dim">(en el sentido de: ${s.hints.map((h) => T.escapeHTML(h)).join(", ")})</span>` : ""}
        </li>`).join("");
      return `<div class="bp-sense-group"><h4>${T.escapeHTML(header)}</h4><ol>${items}</ol></div>`;
    }).join("");

    function filaEjemplo(ex, idx) {
      const en = (ediciones[idx] && ediciones[idx].en) || ex.en;
      const es = (ediciones[idx] && ediciones[idx].es) || ex.es;
      return `
        <div class="bp-ejemplo${seleccion.has(idx) ? " bp-ejemplo-sel" : ""}" data-bp-ex="${idx}">
          <span class="bp-ejemplo-texto">“${T.escapeHTML(en)}” → ${T.escapeHTML(es)}</span>
          <button class="bp-pencil" data-bp-editar="${idx}" aria-label="Editar">✏️</button>
        </div>`;
    }

    const ejemplosHTML = examples.map((ex, idx) => filaEjemplo(ex, idx)).join("");

    const modal = montarModal(`
      <div class="modal-friend bp-aprender-card">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <div class="bp-aprender-scroll">
          ${gruposHTML}
          <div class="bp-ejemplos-list">${ejemplosHTML}</div>
        </div>
        <div class="bp-contadores">
          <span>Oraciones seleccionadas [<b data-bp-count-sel>0</b>]</span>
          <span>Oraciones en sistema [<b data-bp-count-sistema>${enSistemaIncluidas().length}</b>]${enSistemaTotal.length > MAX_ORACIONES_POR_PALABRA ? ` <span class="bp-dim">(de ${enSistemaTotal.length} encontradas)</span>` : ""}</span>
        </div>
        <button class="fun-btn primary-btn bp-guardar">Almacenar en Banco de palabras</button>
      </div>
    `);

    function refrescarContador() {
      modal.querySelector("[data-bp-count-sel]").textContent = String(seleccion.size);
      const spanSistema = modal.querySelector("[data-bp-count-sistema]");
      if (spanSistema) spanSistema.textContent = String(enSistemaIncluidas().length);
    }

    function refrescarFila(idx) {
      const el = modal.querySelector(`[data-bp-ex="${idx}"]`);
      if (el) el.outerHTML = filaEjemplo(examples[idx], idx);
      wireFila(idx);
    }

    function wireFila(idx) {
      const el = modal.querySelector(`[data-bp-ex="${idx}"]`);
      if (!el) return;
      el.querySelector(".bp-ejemplo-texto").addEventListener("click", () => {
        if (seleccion.has(idx)) seleccion.delete(idx); else seleccion.add(idx);
        refrescarFila(idx);
        refrescarContador();
      });
      el.querySelector(".bp-pencil").addEventListener("click", (e) => {
        e.stopPropagation();
        abrirEdicion(idx);
      });
    }

    examples.forEach((_, idx) => wireFila(idx));

    function abrirEdicion(idx) {
      const en = (ediciones[idx] && ediciones[idx].en) || examples[idx].en;
      const es = (ediciones[idx] && ediciones[idx].es) || examples[idx].es;
      const sub = document.createElement("div");
      sub.className = "modal-overlay modal-active bp-modal-overlay bp-sub-overlay";
      sub.innerHTML = `
        <div class="modal-friend bp-editar-card">
          <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
          <label>Inglés<textarea class="bp-edit-en">${T.escapeHTML(en)}</textarea></label>
          <label>Español<textarea class="bp-edit-es">${T.escapeHTML(es)}</textarea></label>
          <button class="fun-btn primary-btn bp-guardar-edicion">Guardar</button>
        </div>`;
      document.body.appendChild(sub);
      sub.addEventListener("click", (e) => { if (e.target === sub) sub.remove(); });
      sub.querySelector("[data-bp-close]").addEventListener("click", () => sub.remove());
      sub.querySelector(".bp-guardar-edicion").addEventListener("click", () => {
        ediciones[idx] = {
          en: sub.querySelector(".bp-edit-en").value.trim(),
          es: sub.querySelector(".bp-edit-es").value.trim(),
        };
        seleccion.add(idx); // editar implica que la quiere usar
        refrescarFila(idx);
        refrescarContador();
        sub.remove();
      });
    }

    modal.querySelector(".bp-guardar").addEventListener("click", () => {
      const seleccionadas = Array.from(seleccion).map((idx) => {
        const base = examples[idx];
        const edit = ediciones[idx];
        return {
          en: edit ? edit.en : base.en,
          es: edit ? edit.es : base.es,
          forma: r.englishWord,
          origen: "mw",
        };
      });
      const todas = seleccionadas.concat(enSistemaIncluidas());
      global.BancoPalabrasData.guardarPalabra(r.englishWord, r.forms, todas);
      modal.querySelector(".bp-aprender-card").innerHTML = `<p class="bp-guardado-ok">✅ Guardado en Banco de palabras</p>`;
      setTimeout(cerrarModal, 1200);
    });
  }

  global.BancoPalabrasUI = { html, activar };
})(typeof window !== "undefined" ? window : globalThis);
