// motor/ajustes.js
//
// Modal de configuración (⚙️). Incluye:
//  - 🔍 Analizar: re-consulta TODOS los .json de datos/ (para cuando vas
//    agregando ejercicios poco a poco) y muestra cuántos nuevos encontró.
//  - Reiniciar el progreso de una sección puntual, o de todas.
//  - Exportar / importar el progreso completo como archivo .json.

// NOTA: sin `import` — este archivo se concatena al final de motor/ (ver
// MOTOR_JS_FILES en build.py), así que SECCIONES (temario.js), AppState,
// analizarTodo, reiniciarProgresoSeccion, reiniciarTodoElProgreso,
// exportarProgreso, importarProgreso (storage.js) y escHTML (mapa.js) ya
// existen en el mismo scope.

export function mostrarModalAjustes({ onCambios }) {
  const existente = document.querySelector(".modal-overlay");
  if (existente) existente.remove();

  const opcionesSecciones = SECCIONES.map((s) => `<option value="${s.id}">${s.id} · ${escHTML(s.titulo)}</option>`).join("");

  const modal = document.createElement("div");
  modal.className = "modal-overlay modal-activo";
  modal.innerHTML = `
    <div class="modal-tarjeta modal-ajustes">
      <div class="modal-ajustes-header">
        <h3>⚙️ Ajustes</h3>
        <button class="modal-cerrar" id="ajustesCerrar" aria-label="Cerrar">✕</button>
      </div>

      <div class="ajustes-seccion">
        <h4>Datos</h4>
        <button class="btn-ajustes" id="btnAnalizar">🔍 Analizar archivos de datos/</button>
        <p class="ajustes-nota" id="analizarResultado"></p>
      </div>

      <div class="ajustes-seccion">
        <h4>Progreso</h4>
        <div class="ajustes-fila">
          <select id="selectSeccionReset" class="select-ajustes">${opcionesSecciones}</select>
          <button class="btn-ajustes btn-peligro" id="btnResetSeccion">Reiniciar sección</button>
        </div>
        <button class="btn-ajustes btn-peligro full" id="btnResetTodo">🗑️ Reiniciar todo el progreso</button>
      </div>

      <div class="ajustes-seccion">
        <h4>Respaldo</h4>
        <div class="ajustes-fila">
          <button class="btn-ajustes" id="btnExportar">⬇️ Exportar progreso</button>
          <button class="btn-ajustes" id="btnImportar">⬆️ Importar progreso</button>
        </div>
        <input type="file" id="inputImportar" accept="application/json" style="display:none;">
      </div>

      <div class="ajustes-seccion">
        <h4>📱 Reels (English Trainer)</h4>
        <label class="ajustes-check"><input type="checkbox" id="rlAzConceptos"> Mostrar conceptos en Reels</label>
        <label class="ajustes-check"><input type="checkbox" id="rlAzSecciones"> Hacer las lecciones de una sección</label>
        <select id="rlAzSeccion" class="select-ajustes" style="width:100%;margin:2px 0 10px;">${opcionesSecciones}</select>
        <div class="ajustes-num"><span>Por tanda <small>(conceptos completos o ejercicios de lección)</small></span><input type="number" id="rlAzPorTanda" min="1" max="20"></div>
        <div class="ajustes-num"><span>Máximo de tandas por día</span><input type="number" id="rlAzMaxDia" min="1" max="50"></div>
        <div class="ajustes-num"><span>Sale cada cuántos ejercicios</span><input type="number" id="rlAzCada" min="2" max="50"></div>
        <p class="ajustes-nota" id="rlAzHoy"></p>
        <p class="ajustes-nota">Conceptos y secciones no pueden ir juntos. De las secciones solo entran las lecciones (con su reintento si no llegas al 90%); una sección aprobada ya no sale. Los simulacros nunca salen en Reels.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cerrar = () => modal.remove();
  cablearAjustesReels(modal);
  modal.querySelector("#ajustesCerrar").addEventListener("click", cerrar);
  modal.addEventListener("click", (e) => { if (e.target === modal) cerrar(); });

  modal.querySelector("#btnAnalizar").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "🔍 Analizando…";
    const resultados = await analizarTodo();
    btn.disabled = false;
    btn.textContent = "🔍 Analizar archivos de datos/";
    const totalNuevos = resultados.reduce((sum, r) => sum + Math.max(0, r.nuevos), 0);
    const resumen = resultados
      .filter((r) => r.total > 0)
      .map((r) => `${r.id}: ${r.total} ejercicio(s)${r.nuevos > 0 ? ` (+${r.nuevos} nuevos)` : ""}`)
      .join(" · ") || "Todos los archivos siguen vacíos.";
    document.getElementById("analizarResultado").textContent =
      totalNuevos > 0 ? `✅ ${resumen}` : resumen;
    onCambios?.();
  });

  modal.querySelector("#btnResetSeccion").addEventListener("click", () => {
    const id = document.getElementById("selectSeccionReset").value;
    if (confirm(`¿Reiniciar todo el progreso de ${id}? Esto no se puede deshacer.`)) {
      reiniciarProgresoSeccion(id);
      onCambios?.();
      cerrar();
    }
  });

  modal.querySelector("#btnResetTodo").addEventListener("click", () => {
    if (confirm("¿Reiniciar TODO el progreso de la app? Esto no se puede deshacer.")) {
      reiniciarTodoElProgreso();
      onCambios?.();
      cerrar();
    }
  });

  modal.querySelector("#btnExportar").addEventListener("click", () => {
    const contenido = exportarProgreso();
    const blob = new Blob([contenido], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai901-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const inputImportar = modal.querySelector("#inputImportar");
  modal.querySelector("#btnImportar").addEventListener("click", () => inputImportar.click());
  inputImportar.addEventListener("change", async () => {
    const file = inputImportar.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      importarProgreso(texto);
      onCambios?.();
      cerrar();
      window._toast?.("✅ Progreso importado");
    } catch (err) {
      window._toast?.("❌ Archivo inválido: " + err.message);
    }
  });
}
// escHTML ya está definida en mapa.js (mismo scope tras la concatenación).

// Ajustes de Reels: se guardan al cambiar cualquier campo. Conceptos y
// secciones son excluyentes: con conceptos activo, secciones queda bloqueado.
function cablearAjustesReels(modal) {
  const cfg = leerCfgReels();
  const q = (id) => modal.querySelector("#" + id);
  const chkC = q("rlAzConceptos"), chkS = q("rlAzSecciones"), sel = q("rlAzSeccion");
  const porTanda = q("rlAzPorTanda"), maxDia = q("rlAzMaxDia"), cada = q("rlAzCada"), hoy = q("rlAzHoy");
  chkC.checked = cfg.conceptos; chkS.checked = cfg.secciones; sel.value = cfg.seccionId;
  porTanda.value = cfg.porTanda; maxDia.value = cfg.maxDia; cada.value = cfg.cada;
  const pintar = () => {
    chkS.disabled = chkC.checked;
    if (chkC.checked) chkS.checked = false;
    sel.disabled = !chkS.checked;
    const c = leerCfgReels();
    hoy.textContent = "Hoy: " + leerDiaReels().n + "/" + c.maxDia + " tandas hechas (vuelve a 0 a medianoche).";
  };
  const guardarTodo = () => {
    guardarCfgReels({
      conceptos: chkC.checked, secciones: !chkC.checked && chkS.checked, seccionId: sel.value,
      porTanda: porTanda.value, maxDia: maxDia.value, cada: cada.value,
    });
    pintar();
  };
  [chkC, chkS, sel, porTanda, maxDia, cada].forEach((el) => el.addEventListener("change", guardarTodo));
  pintar();
}
