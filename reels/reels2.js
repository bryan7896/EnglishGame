// ==================== REELS2 — "Aprender canción" (Partes 2, 3 y 4) ====================
// Duplicado ENFOCADO de reels/reels-core.js, a propósito (ver el pedido de
// Bryan: "puedes duplicar líneas de código, hacer reels2.js"). Diferencias
// con el motor original:
//   - Sin reglas gramaticales, sin sorpresas, sin YouGlish/Tatoeba/Azure/
//     historias/temporizador/informe: nada de eso aplica aquí.
//   - El banco NO es el banco global de reels: es el banco propio de UNA
//     canción, generado por canciones-generador.js a partir de su JSON.
//   - Estado propio en localStorage, una llave por canción (no por idioma
//     global como rlKey()).
//
// Lo que SÍ se reutiliza tal cual (mismo contrato que usa reels-core.js):
//   renderSeleccionarExercise / renderCompletarExercise+checkCompletarAnswers
//   /showCompletarModal / renderTraduccionExercise+showComparativeModal /
//   renderDictadoExercise (autocontenido, dispara "dictado-done") /
//   renderAudioSeleccionExercise (Parte 3, dispara "audioseleccion-done" —
//   ahora también sabe tocar audio real, ver canciones-audio-seleccion.js) /
//   renderCancionCompletarExercise + showCancionCompletarModal (Parte 4,
//   Niveles 6 y 8 — ver canciones-completar-audio.js) /
//   renderCancionDictadoExercise (Parte 4, Nivel 7 — ver
//   canciones-dictado-audio.js), el CSS de reels.css (misma clase
//   .rl-overlay/.rl-stage/.rl-card) y shuffleArray() de mapa/map.js.
//
// ---------------------------------------------------------------------
// Flujo completo por NIVELES (ver tracklist/NOTAS.md):
//   Nivel 1 "Seleccionar": TODOS los bloques de 5 pares learn[] de la
//     canción completa. Si falla una tarjeta, ese bloque va al final de la
//     cola — el nivel termina cuando la cola queda vacía.
//   Nivel 2 "Completar" + resto: por cada segments[n] (estrofa), 1) todos
//     los "completar" de ese segmento al 100%, 2) traducción + dictado +
//     audioSeleccion + seleccionar de ESE segmento al 100%, y recién ahí se
//     pasa al segmento siguiente. Frases ya dominadas no repiten ejercicio.
//   Nivel 3 "Felicitaciones": pantalla única que revela nombre/artista y un
//     resumen de lo aprendido (Parte 4 — ver rl2RenderFelicitaciones).
//   Nivel 4 "Calentamiento": ronda corta de audio+selección con el audio
//     REAL del mp3 (si ya hay .lrc), de puente antes de los Niveles 5-8.
//   Nivel 5 "Seleccionar con audio real": TODA la canción en orden, audio
//     real línea por línea.
//   Nivel 6 "Completar con audio real": una tarjeta por estrofa, con 1-2
//     huecos por línea y karaoke mientras suena esa estrofa.
//   Nivel 7 "Dictado con audio real": TODA la canción en orden, se aprueba
//     cada línea al 80% (igual que el dictado normal).
//   Nivel 8 "Canción completa": UNA tarjeta con toda la letra (un hueco por
//     estrofa) mientras suena el mp3 entero con karaoke — el resultado de
//     ESTA tarjeta es el % final y fijo de la canción (sin reintento).
// A partir de acá (15 ejercicios/día antes de abrir Reels normal) es la
// Parte 5.

let RL2 = null;              // estado persistido de la canción abierta
let RL2V = { abierto: false, cancion: null, limpiar: null, tiemposPromise: null };
let RL2_SEQ = 0;              // contador de uids, independiente de RL2 (ver nota en rl2Uid)

function rl2Key(cancionId) { return "english_trainer_cancion2_v1_" + getTargetLanguage() + "_" + cancionId; }

// Nota: antes este contador vivía en RL2.seq, pero eso obligaba a que RL2
// ya existiera ANTES de construir el primer banco (y el primer banco se
// arma, con sus uids, mientras se está construyendo el objeto que se le
// va a asignar a RL2) — un contador aparte evita esa dependencia circular.
function rl2Uid() { RL2_SEQ += 1; return "c2" + Date.now().toString(36) + RL2_SEQ; }

function rl2ItemEx(ex, frase) { return { k: "ex", uid: rl2Uid(), ex, _frase: frase || null, retry: false }; }
// Niveles 4-8: no hay "frases repetidas" que trackear (ver canciones-
// generador.js — recorren TODA la canción sin filtrar por frasesDominadas),
// así que estos items no cargan _frase. `esFinal` marca la única tarjeta
// del Nivel 8, que no vuelve a la cola si falla (ver rl2EjercicioTerminado).
function rl2ItemSimple(ex, esFinal) { return { k: "ex", uid: rl2Uid(), ex, retry: false, esFinal: !!esFinal }; }

// Baraja y corrige rachas de 3+ tarjetas seguidas del MISMO tipo de
// ejercicio (versión simplificada de rlCorregirRachas: aquí no hay reglaIds
// que agrupar, solo el tipo).
function rl2EvitarRachas(items) {
  const arr = shuffleArray(items);
  const malo = (a, i) => i >= 2 && a[i].ex.type === a[i - 1].ex.type && a[i].ex.type === a[i - 2].ex.type;
  for (let pasada = 0; pasada < 3; pasada++) {
    let cambio = false;
    for (let i = 2; i < arr.length; i++) {
      if (malo(arr, i)) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[j].ex.type !== arr[i].ex.type) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; cambio = true; break; }
        }
      }
    }
    if (!cambio) break;
  }
  return arr;
}

// ejercicios: [{ex,_frase}] (lo que devuelven los cancionGenerarNivel*).
// evitarRachas=true cuando el banco mezcla varios tipos de ejercicio
// (Nivel 2 / "resto"); el Nivel 1 y el "completar" del Nivel 2 son
// homogéneos (un solo tipo), así que ahí basta con barajar.
function rl2PrepararBanco(ejercicios, evitarRachas) {
  const items = (ejercicios || []).map((e) => rl2ItemEx(e.ex, e._frase));
  return evitarRachas ? rl2EvitarRachas(items) : shuffleArray(items);
}

// Niveles 4-8: NUNCA se baraja (ver flujo #5 — "primera línea... luego la
// segunda... así hasta que termine": es "escuchar la canción en orden").
// Si un ejercicio falla, rl2EjercicioTerminado lo vuelve a meter al final,
// así que el orden de lo que queda siempre respeta el orden de la canción.
function rl2PrepararBancoEnOrden(ejercicios, esFinal) {
  return (ejercicios || []).map((ex) => rl2ItemSimple(ex, esFinal));
}

// ---------- Carga / guardado del estado de UNA canción ----------
// v3 (Parte 4): agrega los Niveles 3-8 encima del v2 (Parte 3, solo
// Niveles 1-2). Si había un progreso v2 guardado y ya estaba en fase "fin"
// (= Niveles 1-2 completos bajo el motor viejo), se migra directo a
// "nivel3" sin perder nada — el Nivel 1/2 ya quedaron marcados en
// progreso.nivelesCompletados desde entonces. Si el v2 estaba a mitad de
// camino (fase "nivel1"/"nivel2"), se reinicia esa sesión desde cero, igual
// que ya pasaba entre la Parte 2 y la Parte 3 (progreso.frasesDominadas y
// el % de nivel no se pierden, viven aparte).
function rl2Nuevo(cancion) {
  const progreso = cancionProgresoLeer(cancion.id);
  const n1 = cancionGenerarNivel1(cancion.json, progreso.frasesDominadas);
  RL2 = {
    v: 3,
    cancionId: cancion.id,
    fase: "nivel1", // "nivel1".."nivel8" | "fin"
    nivel1: {
      banco: rl2PrepararBanco(n1.ejercicios, false),
      cur: null,
      total: n1.ejercicios.length, // para la barra de avance (ver rl2PintarSeleccionarProgress)
      totalPorFrase: n1.totalPorFrase,
      aprobadasPorFrase: {},
    },
    nivel2: null, // se arma con rl2IniciarNivel2() al terminar el Nivel 1
    nivel4: null, nivel5: null, nivel6: null, nivel7: null, nivel8: null,
    resultadoFinal: null,
  };
  if (!RL2.nivel1.banco.length) {
    // Canción sin pares learn[] pendientes: el Nivel 1 queda "vacío" y se
    // completa solo, sin mostrar ninguna tarjeta.
    cancionNivelCompletado(cancion.id, 1);
    rl2IniciarNivel2();
  }
}

function rl2EstadoVacioNivelesAltos() {
  return { nivel4: null, nivel5: null, nivel6: null, nivel7: null, nivel8: null, resultadoFinal: null };
}

function rl2Cargar(cancion) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(rl2Key(cancion.id)) || "null"); } catch (e) { d = null; }

  if (d && d.v === 3 && d.cancionId === cancion.id) { RL2 = d; return; }

  if (d && d.v === 2 && d.cancionId === cancion.id && d.fase === "fin") {
    // Migración: Niveles 1-2 ya estaban completos bajo el motor de la Parte
    // 3 (que terminaba ahí). cancionNivelCompletado(1/2) ya se había
    // llamado en su momento, así que el % y frasesDominadas siguen bien —
    // solo hace falta arrancar desde el Nivel 3 en el formato nuevo.
    RL2 = { v: 3, cancionId: cancion.id, fase: "nivel3", nivel1: d.nivel1, nivel2: d.nivel2, ...rl2EstadoVacioNivelesAltos() };
    rl2Guardar();
    return;
  }

  // Cualquier otro caso (sin progreso guardado, o v2 a mitad del Nivel 1/2):
  // se arranca de cero — frasesDominadas/nivelesCompletados viven aparte en
  // cancionProgresoLeer() y no se pierden.
  rl2Nuevo(cancion);
  rl2Guardar();
}

function rl2Guardar() {
  if (!RL2) return;
  try { localStorage.setItem(rl2Key(RL2.cancionId), JSON.stringify(RL2)); }
  catch (e) { toast("⚠️ No se pudo guardar el avance de la canción (almacenamiento lleno)"); }
}

// Reinicia el banco de ESTA canción desde cero (vuelve a generar, contando
// lo ya dominado hasta ahora). Pensado para cuando se sube un JSON nuevo o
// más completo de una canción que ya se estaba jugando.
export function rl2ReiniciarBanco(cancionId) {
  try { localStorage.removeItem(rl2Key(cancionId)); } catch (e) { /* nada */ }
  if (RL2 && RL2.cancionId === cancionId) RL2 = null;
}

// ---------- Tiempos del .lrc (Parte 4) ----------
// Se piden en segundo plano apenas se abre la canción (no hace falta
// esperar: niveles 1-3 tardan un buen rato en jugarse, así que para cuando
// el usuario llega al Nivel 4 ya casi siempre está resuelto). Quien
// necesite el resultado hace `await RL2V.tiemposPromise`.
function rl2PedirTiempos(cancion) {
  RL2V.tiemposPromise = cancionTiemposCargar(cancion).catch(() => null);
}

// ---------- Parte 5: peso de cada ejercicio para el candado diario ----------
// "Hecho" = resuelto, acertado o no (lo que importa es el intento, no es
// calificable para el candado). Los tipos "Cancion" (audio real + karaoke,
// Niveles 6-8) pesan más por ser más largos; el del Nivel 8 (toda la
// canción con una tarjeta final sin reintento) vale la meta completa, tal
// como pidió Bryan ("los ejercicios muy largos... que cuenten como 15").
function rl2Peso(item) {
  const ex = item.ex;
  if (ex.type === "completarCancion") return item.esFinal ? CANCIONES_CANDADO_META : 5;
  if (ex.type === "dictadoCancion") return 3;
  if (ex.type === "seleccionar") return 3; // bloque de 5 pares
  if (ex.type === "completar" || ex.type === "traduccion" || ex.type === "dictado") return 2;
  return 1; // audioSeleccion y cualquier otro: tarjeta rápida
}

function rl2RegistrarCandado(item) {
  cancionesCandadoRegistrar(RL2V.cancion.id, rl2Peso(item));
  rl2PintarCandadoBadge();
}

// Insignia visible DENTRO de "Aprender canción" con el avance del candado
// diario (ver Parte 5 en canciones-core.js). Antes esto solo se mostraba
// en la pantalla de lista (cancionCandadoBannerHTML), así que mientras se
// jugaba no había forma de saber cuántos puntos llevaba el día ni cuántos
// faltaban — esta insignia resuelve eso, actualizándose después de cada
// ejercicio (ver rl2RegistrarCandado) y al abrir la canción.
function rl2PintarCandadoBadge() {
  const badge = document.getElementById("rl2CandadoBadge");
  if (!badge) return;
  const estado = cancionesCandadoLeer();
  const faltan = cancionesCandadoFaltan(estado);
  const puntos = Math.min(estado.puntos || 0, CANCIONES_CANDADO_META);
  if (faltan <= 0) {
    badge.textContent = "🔓 Reels desbloqueado por hoy";
    badge.classList.add("rl2-candado-badge-ok");
  } else {
    badge.textContent = `🔒 ${puntos}/${CANCIONES_CANDADO_META} ejercicios de hoy (te faltan ${faltan})`;
    badge.classList.remove("rl2-candado-badge-ok");
  }
  badge.hidden = false;
}

// Barra de avance del Nivel 1 "Seleccionar" (pedido de Bryan: mientras se
// están resolviendo los bloques de "seleccionar", ver cuánto falta para
// terminarlos todos — antes eso solo se sabía al volver a la lista, por el
// % general de la canción). El Nivel 1 es homogéneo (solo bloques de
// "seleccionar"), así que basta con su propia cola: lo que resta es
// banco.length + 1 si hay una tarjeta en curso, y lo hecho es total - resta
// (los bloques que fallan vuelven a la cola, así que no se "pierden" del
// conteo; solo se restan los que ya se aprobaron de verdad).
function rl2PintarSeleccionarProgress() {
  const cont = document.getElementById("rl2SeleccionarProgress");
  if (!cont) return;
  const n1 = RL2 && RL2.fase === "nivel1" ? RL2.nivel1 : null;
  if (!n1) { cont.hidden = true; return; }

  const restante = (n1.banco ? n1.banco.length : 0) + (n1.cur ? 1 : 0);
  // n1.total se guarda al armar el banco (rl2Nuevo). Progreso guardado ANTES
  // de este cambio no lo trae: se usa lo que queda ahora mismo como total de
  // partida (la barra arranca en 0% esa sesión puntual, pero queda bien
  // calculada desde el siguiente bloque en adelante).
  const total = n1.total || restante || 1;
  const hecho = Math.max(0, total - restante);
  const pct = total ? Math.round((100 * hecho) / total) : 100;

  cont.hidden = false;
  const fill = document.getElementById("rl2SeleccionarProgressFill");
  if (fill) fill.style.width = pct + "%";
  const text = document.getElementById("rl2SeleccionarProgressText");
  if (text) text.textContent = `🧩 Seleccionar: ${hecho}/${total}`;
}

// ---------- Apertura / cierre ----------
export function rl2AbrirCancion(cancion) {
  RL2V.cancion = cancion;
  cancionesCandadoRegistrar(cancion.id, 0); // "última que jugó", sin sumar puntos todavía
  rl2PedirTiempos(cancion);
  rl2Cargar(cancion);
  const ov = document.getElementById("reels2Overlay");
  if (!ov) return;
  ov.hidden = false;
  RL2V.abierto = true;
  document.body.classList.add("rl-open");
  try { history.pushState({ reels2: true }, ""); } catch (e) { /* nada */ }
  document.getElementById("rl2Stage").innerHTML = "";
  rl2PintarCandadoBadge();
  rl2MostrarActual(false);
}

function rl2Cerrar(desdeEvento) {
  if (!RL2V.abierto) return;
  RL2V.abierto = false;
  rl2LimpiarTarjeta();
  try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
  cancionAudioDetener();
  document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
  const ov = document.getElementById("reels2Overlay");
  if (ov) ov.hidden = true;
  document.body.classList.remove("rl-open");
  const st = document.getElementById("rl2Stage");
  if (st) st.innerHTML = "";
  if (desdeEvento !== "popstate" && history.state && history.state.reels2) { try { history.back(); } catch (e) { /* nada */ } }
  rl2Guardar();
  // La pantalla de debajo sigue siendo la lista de canciones (se abrió desde
  // ahí): solo hace falta refrescarla para que se vea el % actualizado.
  if (typeof cancionesPintarLista === "function") cancionesPintarLista();
}

function rl2LimpiarTarjeta() {
  if (typeof RL2V.limpiar === "function") { try { RL2V.limpiar(); } catch (e) { /* nada */ } }
  RL2V.limpiar = null;
}

// ---------- Nivel 2: arranque + avance entre tareas/segmentos ----------
// Se arma recién cuando el Nivel 1 ya terminó, leyendo progreso.frasesDominadas
// DE NUEVO (ya incluye lo que el Nivel 1 acaba de dominar), para que el
// Nivel 2 no repita esos mismos pares (ver canciones-generador.js).
function rl2IniciarNivel2() {
  const progreso = cancionProgresoLeer(RL2V.cancion.id);
  const { tareas, totalPorFrase } = cancionGenerarNivel2(RL2V.cancion.json, progreso.frasesDominadas);
  RL2.nivel2 = {
    tareas: tareas.map((t) => ({
      segIndex: t.segIndex,
      sub: t.sub, // "completar" | "resto"
      banco: rl2PrepararBanco(t.banco, t.sub === "resto"),
    })),
    tareaIdx: 0,
    cur: null,
    totalPorFrase,
    aprobadasPorFrase: {},
  };
  RL2.fase = "nivel2";
  rl2AvanzarNivel2SiVacio();
}

// Salta tareas sin ejercicios (no debería pasar — cancionGenerarNivel2 ya
// las omite — pero es la misma red de seguridad permisiva del resto de la
// sección) y, si ya no quedan tareas, pasa a la pantalla de felicitaciones
// (Nivel 3, Parte 4 — antes esto era directo "fin").
function rl2AvanzarNivel2SiVacio() {
  const n2 = RL2.nivel2;
  if (!n2) return;
  while (n2.tareaIdx < n2.tareas.length && !n2.tareas[n2.tareaIdx].banco.length && !n2.cur) {
    n2.tareaIdx++;
  }
  if (n2.tareaIdx >= n2.tareas.length) {
    cancionNivelCompletado(RL2V.cancion.id, 2);
    RL2.fase = "nivel3";
  }
}

// ---------- Nivel 3: felicitaciones (Parte 4) ----------
// No es una cola de ejercicios: es una sola pantalla informativa. Se marca
// "completada" (y se arranca el Nivel 4) cuando el usuario toca Continuar —
// ver rl2RenderFelicitaciones().
function rl2ContinuarDesdeFelicitaciones() {
  cancionNivelCompletado(RL2V.cancion.id, 3);
  rl2IniciarNivel4();
}

// ---------- Niveles 4, 5 y 7: colas simples en orden de canción ----------
async function rl2IniciarNivel4() {
  const tiempos = await RL2V.tiemposPromise;
  const ejercicios = cancionGenerarNivel4(RL2V.cancion, tiempos);
  RL2.nivel4 = { banco: rl2PrepararBancoEnOrden(ejercicios, false), cur: null };
  RL2.fase = "nivel4";
  if (!RL2.nivel4.banco.length) { cancionNivelCompletado(RL2V.cancion.id, 4); await rl2IniciarNivel5(); }
  rl2Guardar();
  rl2MostrarActual(true);
}

async function rl2IniciarNivel5() {
  const tiempos = await RL2V.tiemposPromise;
  const ejercicios = cancionGenerarNivel5(RL2V.cancion, tiempos);
  RL2.nivel5 = { banco: rl2PrepararBancoEnOrden(ejercicios, false), cur: null };
  RL2.fase = "nivel5";
  if (!RL2.nivel5.banco.length) { cancionNivelCompletado(RL2V.cancion.id, 5); await rl2IniciarNivel6(); }
}

async function rl2IniciarNivel6() {
  const tiempos = await RL2V.tiemposPromise;
  const tareas = cancionGenerarNivel6(RL2V.cancion, tiempos);
  const ejercicios = tareas.map((t) => t.ejercicio);
  RL2.nivel6 = { banco: rl2PrepararBancoEnOrden(ejercicios, false), cur: null };
  RL2.fase = "nivel6";
  if (!RL2.nivel6.banco.length) { cancionNivelCompletado(RL2V.cancion.id, 6); await rl2IniciarNivel7(); }
}

async function rl2IniciarNivel7() {
  const tiempos = await RL2V.tiemposPromise;
  const ejercicios = cancionGenerarNivel7(RL2V.cancion, tiempos);
  RL2.nivel7 = { banco: rl2PrepararBancoEnOrden(ejercicios, false), cur: null };
  RL2.fase = "nivel7";
  if (!RL2.nivel7.banco.length) { cancionNivelCompletado(RL2V.cancion.id, 7); await rl2IniciarNivel8(); }
}

// ---------- Nivel 8: la tarjeta definitiva (Parte 4) ----------
async function rl2IniciarNivel8() {
  const tiempos = await RL2V.tiemposPromise;
  const ejercicio = cancionGenerarNivel8(RL2V.cancion, tiempos);
  RL2.nivel8 = { item: rl2ItemSimple(ejercicio, true) };
  RL2.fase = "nivel8";
}

// ---------- Secuencia ----------
function rl2Siguiente() {
  rl2LimpiarTarjeta();
  try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
  cancionAudioDetener();
  rl2Guardar();
  rl2MostrarActual(true);
}

// Avanza colas simples (Niveles 4/5/6/7): si el banco se vació, marca el
// nivel y arranca el siguiente (async porque puede necesitar los tiempos
// del .lrc) y vuelve a llamarse a sí mismo para mostrar lo que corresponda.
async function rl2AvanzarColaSimple(nombreNivel, numeroNivel, siguienteFn) {
  const estado = RL2[nombreNivel];
  if (estado.cur) return;
  if (!estado.banco.length) {
    cancionNivelCompletado(RL2V.cancion.id, numeroNivel);
    await siguienteFn();
    rl2Guardar();
    rl2MostrarActual(true);
    return;
  }
  estado.cur = estado.banco.shift();
  rl2Guardar();
  rl2RenderTarjeta(estado.cur, true);
}

function rl2MostrarActual(animar) {
  rl2PintarSeleccionarProgress();
  if (RL2.fase === "nivel1") {
    const n1 = RL2.nivel1;
    if (!n1.cur) {
      if (!n1.banco.length) {
        cancionNivelCompletado(RL2V.cancion.id, 1);
        rl2IniciarNivel2();
        rl2Guardar();
        rl2MostrarActual(animar);
        return;
      }
      n1.cur = n1.banco.shift();
      rl2Guardar();
    }
    rl2RenderTarjeta(n1.cur, animar);
    return;
  }

  if (RL2.fase === "nivel2") {
    rl2AvanzarNivel2SiVacio();
    if (RL2.fase !== "nivel2") { rl2Guardar(); rl2MostrarActual(animar); return; }
    const n2 = RL2.nivel2;
    const tarea = n2.tareas[n2.tareaIdx];
    if (!n2.cur) {
      n2.cur = tarea.banco.shift();
      rl2Guardar();
    }
    rl2RenderTarjeta(n2.cur, animar);
    return;
  }

  if (RL2.fase === "nivel3") { rl2RenderFelicitaciones(animar); return; }

  if (RL2.fase === "nivel4") {
    if (!RL2.nivel4.cur && !RL2.nivel4.banco.length) { rl2AvanzarColaSimple("nivel4", 4, rl2IniciarNivel5); return; }
    if (!RL2.nivel4.cur) { RL2.nivel4.cur = RL2.nivel4.banco.shift(); rl2Guardar(); }
    rl2RenderTarjeta(RL2.nivel4.cur, animar);
    return;
  }
  if (RL2.fase === "nivel5") {
    if (!RL2.nivel5.cur && !RL2.nivel5.banco.length) { rl2AvanzarColaSimple("nivel5", 5, rl2IniciarNivel6); return; }
    if (!RL2.nivel5.cur) { RL2.nivel5.cur = RL2.nivel5.banco.shift(); rl2Guardar(); }
    rl2RenderTarjeta(RL2.nivel5.cur, animar);
    return;
  }
  if (RL2.fase === "nivel6") {
    if (!RL2.nivel6.cur && !RL2.nivel6.banco.length) { rl2AvanzarColaSimple("nivel6", 6, rl2IniciarNivel7); return; }
    if (!RL2.nivel6.cur) { RL2.nivel6.cur = RL2.nivel6.banco.shift(); rl2Guardar(); }
    rl2RenderTarjeta(RL2.nivel6.cur, animar);
    return;
  }
  if (RL2.fase === "nivel7") {
    if (!RL2.nivel7.cur && !RL2.nivel7.banco.length) { rl2AvanzarColaSimple("nivel7", 7, rl2IniciarNivel8); return; }
    if (!RL2.nivel7.cur) { RL2.nivel7.cur = RL2.nivel7.banco.shift(); rl2Guardar(); }
    rl2RenderTarjeta(RL2.nivel7.cur, animar);
    return;
  }
  if (RL2.fase === "nivel8") {
    if (!RL2.nivel8) { rl2IniciarNivel8().then(() => { rl2Guardar(); rl2MostrarActual(animar); }); return; }
    rl2RenderTarjeta(RL2.nivel8.item, animar);
    return;
  }

  // fase === "fin"
  rl2RenderFinal(animar);
}

// Una frase (originalPhrase o learn[].phrase) queda "dominada" solo cuando
// se aprobaron TODOS los ejercicios que la usan (puede repartirse entre
// varios tipos: traducción + completar + dictado + audioSeleccion de la
// misma línea, o entre varias frases de un mismo bloque de "seleccionar").
// Solo aplica a los Niveles 1-2 (los únicos que trackean _frase).
function rl2MarcarFrasesAprobadas(frase) {
  const frases = Array.isArray(frase) ? frase : (frase ? [frase] : []);
  if (!frases.length) return;
  const estado = RL2.fase === "nivel1" ? RL2.nivel1 : (RL2.fase === "nivel2" ? RL2.nivel2 : null);
  if (!estado) return;
  let huboNueva = false;
  frases.forEach((f) => {
    estado.aprobadasPorFrase[f] = (estado.aprobadasPorFrase[f] || 0) + 1;
    const total = estado.totalPorFrase[f] || 1;
    if (estado.aprobadasPorFrase[f] >= total) {
      if (cancionMarcarFraseDominada(RL2V.cancion.id, f)) huboNueva = true;
    }
  });
  if (huboNueva) rl2Guardar(); // por si cambia el % mostrado al volver a la lista
}

// Termina un ejercicio. Niveles 1/2/4/5/6/7: si falla, el bloque vuelve AL
// FINAL de la cola correspondiente (tal como describió Bryan). Nivel 8: es
// la tarjeta definitiva, no hay cola a la que volver — la resuelve
// rl2TerminarNivel8() directamente, así que esta función no se usa ahí.
function rl2EjercicioTerminado(item, passed) {
  let banco = null;
  if (RL2.fase === "nivel1") { banco = RL2.nivel1.banco; RL2.nivel1.cur = null; }
  else if (RL2.fase === "nivel2") { banco = RL2.nivel2.tareas[RL2.nivel2.tareaIdx].banco; RL2.nivel2.cur = null; }
  else if (RL2.fase === "nivel4") { banco = RL2.nivel4.banco; RL2.nivel4.cur = null; }
  else if (RL2.fase === "nivel5") { banco = RL2.nivel5.banco; RL2.nivel5.cur = null; }
  else if (RL2.fase === "nivel6") { banco = RL2.nivel6.banco; RL2.nivel6.cur = null; }
  else if (RL2.fase === "nivel7") { banco = RL2.nivel7.banco; RL2.nivel7.cur = null; }

  rl2RegistrarCandado(item);
  if (!passed) {
    item.retry = true;
    if (banco) banco.push(item);
  } else {
    rl2MarcarFrasesAprobadas(item._frase);
  }
  rl2Siguiente();
}

// ---------- Render ----------
function rl2RenderFelicitaciones(animar) {
  const stage = document.getElementById("rl2Stage");
  if (!stage) return;
  const cancion = RL2V.cancion;
  const progreso = cancionProgresoLeer(cancion.id);
  const nFrases = (progreso.frasesDominadas || []).length;
  const nEstrofas = (cancion.json.segments || []).length;

  const card = document.createElement("div");
  card.className = "rl-card";
  card.innerHTML = `
    <div class="rl-card-body">
      <div class="cancion-felicitaciones">
        <div class="cancion-felicitaciones-ico">🎉</div>
        <h2>¡Felicitaciones!</h2>
        <p class="sub-fun">Ya dominaste todo el vocabulario y las frases nuevas de esta canción.</p>
        <div class="cancion-felicitaciones-stats">
          <div><b>${nFrases}</b><small>frases/expresiones dominadas</small></div>
          <div><b>${nEstrofas}</b><small>estrofas</small></div>
        </div>
        <div class="cancion-felicitaciones-reveal">
          <div class="cancion-felicitaciones-titulo">${window._escHTML(cancion.json.songTitle)}</div>
          <div class="cancion-felicitaciones-artista">${window._escHTML(cancion.json.artist)}</div>
        </div>
        <p class="sub-fun">Esta es la canción que estuviste aprendiendo. A partir de ahora la vas a ir escuchando de verdad — con su audio real — hasta que te la sepas de principio a fin. ¡Lo que sigue te va a encantar!</p>
      </div>
      <div class="button-group">
        <button class="fun-btn primary-btn rl2-continuar-felicitaciones">Seguir con la canción real 🎧</button>
      </div>
    </div>`;

  const viejas = Array.from(stage.querySelectorAll(".rl-card"));
  if (animar && viejas.length) {
    card.classList.add("rl-enter");
    stage.appendChild(card);
    void card.offsetWidth;
    viejas.forEach((v) => v.classList.add("rl-leave"));
    card.classList.remove("rl-enter");
    setTimeout(() => viejas.forEach((v) => v.remove()), 480);
  } else {
    viejas.forEach((v) => v.remove());
    stage.appendChild(card);
  }
  // rl2ContinuarDesdeFelicitaciones() -> rl2IniciarNivel4() es async y ya se
  // encarga de guardar y mostrar la siguiente tarjeta cuando termina (puede
  // encadenar directo hasta el Nivel 5 si el Nivel 4 queda vacío) — no hay
  // que duplicar ese guardar/mostrar acá, o se alcanza a repintar esta misma
  // pantalla de felicitaciones un instante antes de que resuelva.
  card.querySelector(".rl2-continuar-felicitaciones").onclick = () => rl2ContinuarDesdeFelicitaciones();
}

function rl2RenderFinal(animar) {
  const stage = document.getElementById("rl2Stage");
  if (!stage) return;
  const cancion = RL2V.cancion;
  const res = RL2.resultadoFinal || { pct: cancionAvancePct(cancionProgresoLeer(cancion.id)) };

  const card = document.createElement("div");
  card.className = "rl-card";
  card.innerHTML = `
    <div class="rl-card-body">
      <div class="rl-empty">
        🏆 ¡Terminaste "${window._escHTML(cancion.json.songTitle)}"!<br>
        <div class="cancion-final-pct">${res.pct}%</div>
        <small style="opacity:.8;">Este es tu resultado final y definitivo para esta canción.</small>
      </div>
      <div class="button-group">
        <button class="fun-btn primary-btn rl2-volver">⬅️ Volver a la lista</button>
      </div>
    </div>`;

  const viejas = Array.from(stage.querySelectorAll(".rl-card"));
  if (animar && viejas.length) {
    card.classList.add("rl-enter");
    stage.appendChild(card);
    void card.offsetWidth;
    viejas.forEach((v) => v.classList.add("rl-leave"));
    card.classList.remove("rl-enter");
    setTimeout(() => viejas.forEach((v) => v.remove()), 480);
  } else {
    viejas.forEach((v) => v.remove());
    stage.appendChild(card);
  }
  card.querySelector(".rl2-volver").onclick = () => rl2Cerrar();
}

function rl2RenderTarjeta(item, animar) {
  const stage = document.getElementById("rl2Stage");
  if (!stage) return;
  const card = document.createElement("div");
  card.className = "rl-card";
  const body = document.createElement("div");
  body.className = "rl-card-body";
  card.appendChild(body);

  rl2RenderEjercicio(item, body);

  const viejas = Array.from(stage.querySelectorAll(".rl-card"));
  if (animar && viejas.length) {
    card.classList.add("rl-enter");
    stage.appendChild(card);
    void card.offsetWidth;
    viejas.forEach((v) => v.classList.add("rl-leave"));
    card.classList.remove("rl-enter");
    setTimeout(() => viejas.forEach((v) => v.remove()), 480);
  } else {
    viejas.forEach((v) => v.remove());
    stage.appendChild(card);
  }
  card.scrollTop = 0;
}

// Resuelve la tarjeta ÚNICA y definitiva del Nivel 8: a diferencia de todo
// lo demás, no hay cola a la que volver si falla — el resultado de este
// intento (aciertos/total de los huecos) es directo el % final y fijo de
// la canción (ver flujo #8 de Bryan y cancionFijarResultadoFinal).
function rl2TerminarNivel8(results) {
  const okCount = results.filter((r) => r.isCorrect).length;
  const total = results.length;
  const pct = total ? Math.round((okCount / total) * 100) : 100;
  rl2RegistrarCandado(RL2.nivel8.item);
  cancionFijarResultadoFinal(RL2V.cancion.id, pct);
  cancionNivelCompletado(RL2V.cancion.id, 8);
  RL2.resultadoFinal = { aciertos: okCount, total, pct: cancionAvancePct(cancionProgresoLeer(RL2V.cancion.id)) };
  RL2.fase = "fin";
  rl2LimpiarTarjeta();
  rl2Guardar();
  rl2RenderFinal(true);
}

// Mismo switch que rlRenderEjercicio en reels-core.js, pero solo con los
// tipos que genera canciones-generador.js (sin ordenamiento/corregir, que
// son del banco de reglas gramaticales) + los nuevos de las Partes 3 y 4.
function rl2RenderEjercicio(item, body) {
  const ex = item.ex;
  body.innerHTML = `<div class="rl-ex exercise-area"><div class="rl-ex-container"></div></div>`;
  const c = body.querySelector(".rl-ex-container");

  switch (ex.type) {
    case "traduccion": {
      renderTraduccionExercise(ex, c);
      const btn = c.querySelector(".traduccion-check");
      const inp = c.querySelector(".traduccion-answer");
      btn.onclick = () => {
        const ans = inp.value.trim();
        if (!ans) { toast("📝 Escribe algo"); return; }
        showComparativeModal(ex, ans, (duda, passed) => rl2EjercicioTerminado(item, passed));
      };
      break;
    }
    case "completar": {
      renderCompletarExercise(ex, c, !!item.retry);
      c.querySelector(".completar-check").onclick = () => {
        const { results } = checkCompletarAnswers(ex, c);
        showCompletarModal(ex, results, (duda, passed) => rl2EjercicioTerminado(item, passed));
      };
      break;
    }
    // Nivel 6 ("completar" de una estrofa) y Nivel 8 (la canción completa):
    // misma tarjeta multilínea con audio real + karaoke (ver canciones-
    // completar-audio.js). item.esFinal distingue el caso del Nivel 8 (sin
    // reintento, fija el % final) del Nivel 6 (reintento normal al final).
    case "completarCancion": {
      renderCancionCompletarExercise(ex, c);
      c.querySelector(".completar-check").onclick = () => {
        const { results } = checkCompletarAnswers(ex, c);
        showCancionCompletarModal(ex, results, (passed, decision) => {
          if (item.esFinal) rl2TerminarNivel8(results);
          else rl2EjercicioTerminado(item, passed);
        });
      };
      RL2V.limpiar = () => cancionCompletarAudioLimpiar(c);
      break;
    }
    case "seleccionar": {
      renderSeleccionarExercise(ex, c);
      c.addEventListener("all-matched", () => {
        showSeleccionarCompleteModal(ex.pairs, () => rl2EjercicioTerminado(item, true));
      });
      RL2V.limpiar = () => { if (c._seleccionarAutoPlayTimer) { clearTimeout(c._seleccionarAutoPlayTimer); c._seleccionarAutoPlayTimer = null; } };
      break;
    }
    case "dictado": {
      renderDictadoExercise(ex, c);
      c.addEventListener("dictado-done", (e) => {
        const { result } = e.detail;
        rl2EjercicioTerminado(item, !!(result && result.passed));
      });
      break;
    }
    // Nivel 7: dictado con el audio real de la canción (ver canciones-
    // dictado-audio.js). Mismo evento "dictado-done" que el dictado normal.
    case "dictadoCancion": {
      renderCancionDictadoExercise(ex, c);
      c.addEventListener("dictado-done", (e) => {
        const { result } = e.detail;
        rl2EjercicioTerminado(item, !!(result && result.passed));
      });
      RL2V.limpiar = () => cancionDictadoAudioLimpiar(c);
      break;
    }
    case "audioSeleccion": {
      renderAudioSeleccionExercise(ex, c);
      c.addEventListener("audioseleccion-done", (e) => {
        rl2EjercicioTerminado(item, !!(e.detail && e.detail.passed));
      });
      RL2V.limpiar = () => {
        if (c._casAutoPlayTimer) { clearTimeout(c._casAutoPlayTimer); c._casAutoPlayTimer = null; }
        if (c._casAudioDetener) c._casAudioDetener();
      };
      break;
    }
    default: {
      c.innerHTML = `<p class="sub-fun">Tipo de ejercicio desconocido.</p><button class="fun-btn primary-btn rl2-skip">Continuar</button>`;
      c.querySelector(".rl2-skip").onclick = () => rl2EjercicioTerminado(item, true);
    }
  }
}

// ---------- Arranque ----------
// Se engancha a canciones-core.js (setAbrirCancionHandler), que hasta la
// Parte 1 solo mostraba el aviso de "próxima entrega" al tocar una tarjeta.
export function wireReels2() {
  document.getElementById("rl2CloseBtn")?.addEventListener("click", () => rl2Cerrar());
  window.addEventListener("popstate", () => { if (RL2V.abierto) rl2Cerrar("popstate"); });
  setAbrirCancionHandler(rl2AbrirCancion);
}
