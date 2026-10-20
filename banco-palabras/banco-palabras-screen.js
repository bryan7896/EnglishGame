// banco-palabras/banco-palabras-screen.js
//
// Pantalla "Banco de palabras": la tabla con el listado de palabras
// guardadas (Palabra | #Data | VP | 🗑️ | ⏸️ | fecha) y el botón "key".
// Sigue EXACTAMENTE el mismo patrón que Irregulares (ver
// irregulares/irregulares.js → openIrregulares/closeIrregulares): un
// overlay propio (#bpOverlay) que se crea la primera vez y se
// muestra/oculta, en vez de un <div class="screen"> más del sistema de
// pantallas — así no hay que tocar ese sistema para nada.

(function (global) {
  "use strict";

  function fmtFecha(iso) {
    try {
      const d = new Date(iso + "T00:00:00");
      if (isNaN(d.getTime())) return iso || "—";
      return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
    } catch (e) { return iso || "—"; }
  }

  function esc(s) {
    return global.BancoPalabrasTokenize ? global.BancoPalabrasTokenize.escapeHTML(s) : String(s == null ? "" : s);
  }

  function filaHTML(entrada) {
    return `
      <tr data-bp-row="${esc(entrada.id)}" class="bp-tabla-fila" tabindex="0">
        <td class="bp-tabla-palabra">${esc(entrada.palabra)}</td>
        <td class="bp-tabla-num">${entrada.oraciones.length}</td>
        <td class="bp-tabla-num">${entrada.vp}</td>
        <td><button class="bp-tabla-borrar" data-bp-borrar="${esc(entrada.id)}" aria-label="Borrar ${esc(entrada.palabra)}">🗑️</button></td>
        <td><input type="checkbox" class="bp-tabla-activa" data-bp-pausar="${esc(entrada.id)}" ${entrada.pausado ? "" : "checked"} aria-label="Activa"></td>
        <td class="bp-tabla-fecha">${fmtFecha(entrada.fecha)}</td>
      </tr>`;
  }

  function filaOracionHTML(o) {
    return `
      <div class="bp-ejemplo" data-bp-oracion="${esc(o.id)}">
        <span class="bp-ejemplo-texto">“${esc(o.en)}” → ${esc(o.es)} <span class="bp-dim">(${esc(o.forma)} · ${o.origen === "mw" ? "diccionario" : "sistema"})</span></span>
        <button class="bp-tabla-borrar" data-bp-borrar-oracion="${esc(o.id)}" aria-label="Borrar oración">🗑️</button>
      </div>`;
  }

  // Modal "ver oraciones" de una palabra: se abre al tocar su fila en la
  // tabla (en cualquier parte que no sea 🗑️/⏸️, que ya tienen su propia
  // acción). Permite borrar oraciones sueltas y refresca la tabla de atrás
  // (el "#Data" cambia si se borra alguna).
  function abrirOracionesModal(id, containerTabla) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active bp-modal-overlay";
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

    function pintar() {
      const entrada = global.BancoPalabrasData.obtener(id);
      if (!entrada) { modal.remove(); return; }
      const oraciones = entrada.oraciones || [];
      modal.innerHTML = `
        <div class="modal-friend bp-aprender-card">
          <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
          <h3>${esc(entrada.palabra)}</h3>
          <p class="bp-dim">${oraciones.length} oración(es) guardada(s)</p>
          <div class="bp-aprender-scroll">
            <div class="bp-ejemplos-list">
              ${oraciones.length ? oraciones.map(filaOracionHTML).join("") : `<p class="bp-dim">Todavía no tiene oraciones guardadas.</p>`}
            </div>
          </div>
        </div>`;
      modal.querySelector("[data-bp-close]").addEventListener("click", () => modal.remove());
      modal.querySelectorAll("[data-bp-borrar-oracion]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          global.BancoPalabrasData.borrarOracion(id, btn.dataset.bpBorrarOracion);
          pintar();
          render(containerTabla); // refresca el #Data de la tabla de atrás
        });
      });
    }

    pintar();
  }

  function render(container) {
    const key = global.BancoPalabrasData.getApiKey();
    const entradas = global.BancoPalabrasData.listar();

    container.innerHTML = `
      <div class="bp-screen">
        <div class="bp-screen-head">
          <h2>Banco de palabras</h2>
          <button class="fun-btn bp-key-btn" data-bp-key>key${key ? " ✓" : ""}</button>
        </div>
        ${entradas.length ? `
          <table class="bp-tabla">
            <thead>
              <tr><th>Palabra</th><th>#Data</th><th>VP</th><th>🗑️</th><th>⏸️</th><th>fecha</th></tr>
            </thead>
            <tbody>${entradas.map(filaHTML).join("")}</tbody>
          </table>
        ` : `<p class="bp-dim">Todavía no has guardado palabras. Toca cualquier palabra en español (de 3+ letras) en un ejercicio de traducción, corrección o completar para empezar.</p>`}
      </div>
    `;

    container.querySelector("[data-bp-key]").addEventListener("click", () => abrirModalKey(container));
    container.querySelectorAll("[data-bp-borrar]").forEach((btn) => {
      btn.addEventListener("click", () => {
        global.BancoPalabrasData.borrarPalabra(btn.dataset.bpBorrar);
        render(container);
      });
    });
    container.querySelectorAll("[data-bp-pausar]").forEach((chk) => {
      chk.addEventListener("change", () => {
        global.BancoPalabrasData.setPausado(chk.dataset.bpPausar, !chk.checked);
      });
    });
    container.querySelectorAll("[data-bp-row]").forEach((tr) => {
      tr.addEventListener("click", (e) => {
        // 🗑️ y ⏸️ ya tienen su propia acción — no abrir el modal con esos clics.
        if (e.target.closest("[data-bp-borrar], [data-bp-pausar]")) return;
        abrirOracionesModal(tr.dataset.bpRow, container);
      });
    });
  }

  function abrirModalKey(container) {
    const actual = global.BancoPalabrasData.getApiKey();
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active bp-modal-overlay";
    modal.innerHTML = `
      <div class="modal-friend bp-key-card">
        <button class="bp-close" data-bp-close aria-label="Cerrar">✕</button>
        <h3>Key del diccionario</h3>
        <p class="bp-dim">Merriam-Webster Spanish-English Dictionary API. Plan gratis: 1000 consultas/día.</p>
        <input type="password" class="bp-key-input" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${esc(actual)}" autocomplete="off">
        <button class="fun-btn primary-btn bp-key-guardar">Guardar</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector("[data-bp-close]").addEventListener("click", () => modal.remove());
    modal.querySelector(".bp-key-guardar").addEventListener("click", () => {
      global.BancoPalabrasData.setApiKey(modal.querySelector(".bp-key-input").value);
      modal.remove();
      render(container);
    });
  }

  // ---------- overlay (igual patrón que #irrOverlay) ----------
  function abrir() {
    let ov = document.getElementById("bpOverlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "bpOverlay";
      ov.className = "bp-overlay";
      document.body.appendChild(ov);
    }
    ov.hidden = false;
    ov.innerHTML = `<button type="button" class="bp-overlay-cerrar" aria-label="Cerrar Banco de palabras">✕</button><div class="bp-overlay-scroll"></div>`;
    ov.querySelector(".bp-overlay-cerrar").onclick = cerrar;
    render(ov.querySelector(".bp-overlay-scroll"));
  }

  function cerrar() {
    const ov = document.getElementById("bpOverlay");
    if (ov) { ov.hidden = true; ov.innerHTML = ""; }
  }

  global.BancoPalabrasScreen = { render, abrir, cerrar };
})(typeof window !== "undefined" ? window : globalThis);
