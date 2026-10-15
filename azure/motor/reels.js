// motor/reels.js
//
// Puente con los Reels del English Trainer (la app madre carga este curso en
// azure/ y lo abre dentro de una tarjeta de Reels con ?reels=1&n=N).
//
//  - Ajustes (los edita ⚙️ Ajustes → "Reels"): se guardan en localStorage
//    REELS_CFG_KEY y los lee también el English Trainer (mismo origen).
//  - Contador del día (REELS_DIA_KEY): cuántas tandas se han hecho hoy; lo
//    escribe el English Trainer y aquí solo se muestra. Vuelve a 0 a medianoche.
//  - Modo Reels: muestra solo la pantalla de ejercicio y hace UNA tanda:
//      · conceptos → N conceptos COMPLETOS (todos sus ejercicios) de los de hoy
//      · secciones → N ejercicios de las lecciones de la sección elegida,
//        respetando la secuencia de siempre (lección por lección, reintento
//        con los fallados cuando el intento no llega al 90%). Una sección
//        aprobada ya no sale. Los simulacros nunca entran.
//    Al terminar avisa a la app madre con postMessage({azureReels, tipo}).

const REELS_CFG_KEY = "ai901_reels_cfg";
const REELS_DIA_KEY = "ai901_reels_dia";
const REELS_CFG_DEF = { conceptos: true, secciones: false, seccionId: "1.1", porTanda: 3, maxDia: 8, cada: 8 };

function reelsHoy() { return new Date().toLocaleDateString("en-CA"); }

function leerCfgReels() {
  let c = {};
  try { c = JSON.parse(localStorage.getItem(REELS_CFG_KEY) || "{}") || {}; } catch (e) { c = {}; }
  const cfg = Object.assign({}, REELS_CFG_DEF, c);
  const ent = (v, d, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
  cfg.porTanda = ent(cfg.porTanda, REELS_CFG_DEF.porTanda, 1, 20);
  cfg.maxDia = ent(cfg.maxDia, REELS_CFG_DEF.maxDia, 1, 50);
  cfg.cada = ent(cfg.cada, REELS_CFG_DEF.cada, 2, 50);
  cfg.conceptos = !!cfg.conceptos;
  cfg.secciones = !cfg.conceptos && !!cfg.secciones;   // conceptos manda: no pueden ir juntos
  if (!SECCIONES.some((s) => s.id === cfg.seccionId)) cfg.seccionId = SECCIONES[0].id;
  return cfg;
}

function guardarCfgReels(cfg) {
  try { localStorage.setItem(REELS_CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* nada */ }
}

function leerDiaReels() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(REELS_DIA_KEY) || "null"); } catch (e) { d = null; }
  if (!d || d.fecha !== reelsHoy()) d = { fecha: reelsHoy(), n: 0 };
  return d;
}

// ==================== MODO REELS ====================
const REELS = { modo: null, objetivo: 3, hechos: 0, seccionId: null, conceptoId: null, terminado: false };

function reelsAvisar(tipo, extra) {
  try { window.parent.postMessage(Object.assign({ azureReels: true, tipo }, extra || {}), window.location.origin); } catch (e) { /* nada */ }
}

function reelsTag(texto) {
  const tagEl = document.getElementById("ejercicioTag");
  if (tagEl) tagEl.textContent = texto;
}

function reelsMostrarFin(msg) {
  REELS.terminado = true;
  const cont = document.getElementById("ejercicioContainer");
  const def = document.getElementById("ejercicioDefinicion");
  if (def) { def.style.display = "none"; def.textContent = ""; }
  reelsTag("☁️ Azure");
  if (cont) cont.innerHTML = `<div class="reels-fin"><div class="reels-fin-ico">✅</div><p>${msg}</p></div>`;
}

function reelsTerminar() {
  if (REELS.terminado) return;
  guardar();
  const msg = REELS.modo === "conceptos"
    ? `Listo: ${REELS.hechos} concepto${REELS.hechos === 1 ? "" : "s"} repasado${REELS.hechos === 1 ? "" : "s"}.`
    : `Listo: ${REELS.hechos} ejercicio${REELS.hechos === 1 ? "" : "s"} de la sección ${REELS.seccionId}.`;
  reelsMostrarFin(msg);
  reelsAvisar("fin", { hechos: REELS.hechos });
}

function reelsVacio(msg) {
  guardar();
  reelsMostrarFin(msg || "No hay nada pendiente por ahora.");
  reelsAvisar(REELS.hechos ? "fin" : "vacio", { hechos: REELS.hechos });
}

async function iniciarModoReels(params) {
  document.body.classList.add("modo-reels");
  Object.entries(pantallas).forEach(([k, el]) => { if (el) el.classList.toggle("active", k === "ejercicio"); });
  reelsTag("☁️ Azure · cargando…");
  cargarDeStorage();
  const cfg = leerCfgReels();
  REELS.objetivo = Math.max(1, parseInt(params.get("n"), 10) || cfg.porTanda);
  REELS.hechos = 0;
  REELS.modo = cfg.conceptos ? "conceptos" : cfg.secciones ? "secciones" : null;
  REELS.seccionId = cfg.seccionId;
  if (!REELS.modo) { reelsVacio("Reels está desactivado en los ajustes del curso."); return; }
  try { await sincronizarBancos(); } catch (e) { /* sigue con lo que haya */ }
  if (REELS.modo === "conceptos") {
    await asegurarCatalogoConceptos();
    reelsSiguienteConcepto();
  } else {
    await asegurarDatosSeccion(REELS.seccionId);
    reelsSiguienteEjercicioSeccion();
  }
}

// ---------- Conceptos: N conceptos completos ----------
function reelsElegirConcepto() {
  const catalogo = AppState.conceptosCatalogo || [];
  // Primero uno que haya quedado a medias (por ejemplo si se cerró la app).
  const aMedias = catalogo.find((c) => {
    const r = getConceptoState(c.id).repasoActual;
    return r && r.indiceActual > 0 && r.indiceActual < r.cola.length;
  });
  if (aMedias) return aMedias.id;
  const { lista } = conceptosDeHoy();
  return lista.length ? lista[0].id : null;
}

function reelsSiguienteConcepto() {
  if (REELS.hechos >= REELS.objetivo) { reelsTerminar(); return; }
  const id = reelsElegirConcepto();
  if (!id) { reelsVacio("No tienes conceptos pendientes para hoy. ✅"); return; }
  REELS.conceptoId = id;
  AppState.conceptoActivoId = id;
  iniciarRepasoConcepto(id);
  reelsMostrarItemConcepto();
}

function reelsMostrarItemConcepto() {
  const id = REELS.conceptoId;
  const actual = obtenerItemRepasoConcepto(id);
  if (!actual) { reelsSiguienteConcepto(); return; }
  const concepto = (AppState.conceptosCatalogo || []).find((c) => c.id === id);
  const repaso = getConceptoState(id).repasoActual;
  reelsTag(`☁️ Concepto ${REELS.hechos + 1}/${REELS.objetivo} · ${concepto ? concepto.termino : id} · ${actual.posicion + 1}/${repaso.cola.length}${actual.esRepaso ? " · repaso" : ""}`);
  const esPrimeraVez = getConceptoState(id).historial.length === 0 && actual.posicion === 0 && !actual.esRepaso;
  const defEl = document.getElementById("ejercicioDefinicion");
  if (defEl) {
    if (esPrimeraVez && concepto?.definicion) {
      defEl.style.display = "block";
      defEl.innerHTML = "💡 <strong>" + (concepto.nombreCompleto || concepto.termino) + ":</strong> " + concepto.definicion;
    } else { defEl.style.display = "none"; defEl.textContent = ""; }
  }
  const cont = document.getElementById("ejercicioContainer");
  renderEjercicio(actual.exercise, cont, (respuesta) => {
    const pendiente = procesarRespuestaConcepto(id, respuesta);
    if (!pendiente) return;
    mostrarModalFeedback({
      exercise: pendiente.exercise,
      correcto: pendiente.correcto,
      esReflexion: pendiente.esReflexion,
      autoevaluado: pendiente.autoevaluado,
      respuestaUsuario: respuesta,
      onContinuar: () => reelsAvanceConcepto(confirmarContinuarConcepto(id, pendiente)),
      onRepasar: () => reelsAvanceConcepto(confirmarRepasarConcepto(id, pendiente)),
    });
  });
  window.scrollTo(0, 0);
}

function reelsAvanceConcepto(r) {
  if (r && r.cierre) {
    REELS.hechos += 1;
    toast("📈 Nivel " + r.cierre.nivel + "/10 — " + r.cierre.aciertos + "/" + r.cierre.total + " correctas");
    reelsAvisar("progreso", { hechos: REELS.hechos });
    reelsSiguienteConcepto();
  } else {
    reelsMostrarItemConcepto();
  }
}

// ---------- Secciones: N ejercicios de las lecciones ----------
function reelsSiguienteEjercicioSeccion() {
  if (REELS.hechos >= REELS.objetivo) { reelsTerminar(); return; }
  const id = REELS.seccionId;
  if (!seccionTieneDatos(id)) { reelsVacio("La sección " + id + " no tiene ejercicios cargados."); return; }
  const estado = getSeccionState(id);
  if (estado.progreso.estado === "aprobado") { reelsVacio("La sección " + id + " ya está aprobada. ✅"); return; }
  let intento = obtenerIntentoActual(id);
  // Intento cerrado sin llegar al 90%: el siguiente paso es el reintento (fallados + refuerzo).
  if (estado.progreso.estado === "requiere-reintento" && intento.lecciones.every((l) => l.completada)) {
    intento = generarReintento(id);
    toast("🔁 Reintento de la sección " + id + " generado");
  }
  const leccionIndex = intento.lecciones.findIndex((l) => !l.completada);
  if (leccionIndex < 0) { reelsVacio(); return; }
  AppState.seccionActivaId = id;
  AppState.leccionActivaIndex = leccionIndex;
  const actual = obtenerItemActual(id, leccionIndex);
  if (!actual) { reelsVacio(); return; }
  const def = document.getElementById("ejercicioDefinicion");
  if (def) { def.style.display = "none"; def.textContent = ""; }
  reelsTag(`☁️ Sección ${id} · Lección ${leccionIndex + 1}${intento.esReintento ? " (reintento)" : ""} · ${REELS.hechos + 1}/${REELS.objetivo}${actual.esRepaso ? " · repaso" : ""}`);
  const cont = document.getElementById("ejercicioContainer");
  renderEjercicio(actual.exercise, cont, (respuesta) => {
    const pendiente = procesarRespuesta(id, leccionIndex, respuesta);
    if (!pendiente) return;
    mostrarModalFeedback({
      exercise: pendiente.exercise,
      correcto: pendiente.correcto,
      respuestaUsuario: pendiente.respuestaUsuario,
      onContinuar: () => reelsAvanceSeccion(confirmarContinuar(id, leccionIndex, pendiente)),
      onRepasar: () => reelsAvanceSeccion(confirmarRepasar(id, leccionIndex, pendiente)),
    });
  });
  window.scrollTo(0, 0);
}

function reelsAvanceSeccion(r) {
  REELS.hechos += 1;
  reelsAvisar("progreso", { hechos: REELS.hechos });
  if (r && r.cierre) {
    toast(r.cierre.aprobado ? ("🎉 ¡Sección aprobada con " + r.cierre.pct + "%!") : ("🔁 Obtuviste " + r.cierre.pct + "%. Sigue el reintento."));
    if (r.cierre.aprobado) { reelsTerminar(); return; }
  } else if (r && r.terminoLeccion) {
    toast("✅ Lección completada");
  }
  reelsSiguienteEjercicioSeccion();
}

// ---------- Modo "incrustado" (abierto desde el inicio del English Trainer) ----------
function iniciarModoEmbebido() {
  document.body.classList.add("modo-embebido");
  const top = document.querySelector(".topbar");
  if (!top || document.getElementById("btnSalirEmbed")) return;
  const b = document.createElement("button");
  b.className = "btn-icono";
  b.id = "btnSalirEmbed";
  b.setAttribute("aria-label", "Volver al English Trainer");
  b.textContent = "✕";
  b.addEventListener("click", () => {
    try { window.parent.postMessage({ azure: true, tipo: "salir" }, window.location.origin); } catch (e) { /* nada */ }
  });
  top.insertBefore(b, top.firstChild);
}
