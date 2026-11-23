// ==================== REELS2 — "Practicar canción" dentro de Reels ====================
// Motor de los Niveles 4 a 8 de "Aprender canción" (audio REAL del mp3 +
// karaoke — nunca voz del sistema). Ya no tiene pantalla ni overlay propios:
// cuando el sorteo de "espacio" de reels-sorpresas.js elige el tipo
// "cancion", este archivo arma y resuelve UN ejercicio a la vez, pintado
// dentro de la misma tarjeta de Reels (ver cancionRenderSorpresaReels más
// abajo), exactamente igual que hace irregulares.js con "irr".
//
// Flujo por NIVELES (igual que antes, solo que ahora arranca directo en el
// Nivel 4 — los antiguos Niveles 1-3, que usaban voz del sistema y una
// pantalla de felicitaciones, se eliminaron por completo):
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

let RL2 = null;              // estado persistido de la canción activa en este momento
let RL2_SEQ = 0;              // contador de uids, independiente de RL2

function rl2Key(cancionId) { return "english_trainer_cancion2_v1_" + getTargetLanguage() + "_" + cancionId; }

function rl2Uid() { RL2_SEQ += 1; return "c2" + Date.now().toString(36) + RL2_SEQ; }

function rl2Item(ex, esFinal) { return { uid: rl2Uid(), ex, retry: false, esFinal: !!esFinal }; }

// ---------- Carga / guardado del estado de UNA canción ----------
function rl2Nuevo(cancion) {
  RL2 = { v: 4, cancionId: cancion.id, fase: "nivel4", nivel4: null, nivel5: null, nivel6: null, nivel7: null, nivel8: null, resultadoFinal: null };
}

// Migración: si había progreso viejo (v3, de cuando existían los Niveles
// 1-3) y ya había avanzado más allá de esos niveles, se conserva el avance
// real de los Niveles 4-8; si se había quedado a mitad de los Niveles 1-3
// (que ya no existen), se arranca de cero en el Nivel 4 sin problema — esos
// niveles no aportaban nada al resultado final de la canción.
function rl2Cargar(cancion) {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(rl2Key(cancion.id)) || "null"); } catch (e) { d = null; }
  if (d && d.cancionId === cancion.id) {
    if (d.v === 4) { RL2 = d; return; }
    if (d.v === 3 && ["nivel4", "nivel5", "nivel6", "nivel7", "nivel8", "fin"].includes(d.fase)) {
      RL2 = { v: 4, cancionId: cancion.id, fase: d.fase, nivel4: d.nivel4, nivel5: d.nivel5, nivel6: d.nivel6, nivel7: d.nivel7, nivel8: d.nivel8, resultadoFinal: d.resultadoFinal };
      rl2Guardar();
      return;
    }
  }
  rl2Nuevo(cancion);
  rl2Guardar();
}

function rl2Guardar() {
  if (!RL2) return;
  try { localStorage.setItem(rl2Key(RL2.cancionId), JSON.stringify(RL2)); }
  catch (e) { toast("⚠️ No se pudo guardar el avance de la canción (almacenamiento lleno)"); }
}

// ---------- Siguiente ejercicio a mostrar (recorre niveles vacíos) ----------
// Devuelve { cardItem, nivel } con el siguiente ejercicio de la canción
// activa, o null si la canción ya está terminada (fase "fin").
async function rl2SiguienteItem(cancion) {
  rl2Cargar(cancion);
  const tiempos = await cancionTiemposCargar(cancion).catch(() => null);
  while (true) {
    if (RL2.fase === "fin") return null;
    const nivel = parseInt(RL2.fase.replace("nivel", ""), 10);

    if (nivel === 8) {
      if (!RL2.nivel8) {
        RL2.nivel8 = { item: rl2Item(cancionGenerarNivel8(cancion, tiempos), true) };
        rl2Guardar();
      }
      return { cardItem: RL2.nivel8.item, nivel: 8 };
    }

    const key = "nivel" + nivel;
    if (!RL2[key]) {
      let ejercicios;
      if (nivel === 4) ejercicios = cancionGenerarNivel4(cancion, tiempos);
      else if (nivel === 5) ejercicios = cancionGenerarNivel5(cancion, tiempos);
      else if (nivel === 6) ejercicios = cancionGenerarNivel6(cancion, tiempos).map((t) => t.ejercicio);
      else ejercicios = cancionGenerarNivel7(cancion, tiempos);
      RL2[key] = { banco: ejercicios.map((ex) => rl2Item(ex, false)), cur: null };
      rl2Guardar();
    }

    const estado = RL2[key];
    if (estado.cur) return { cardItem: estado.cur, nivel };
    if (estado.banco.length) {
      estado.cur = estado.banco.shift();
      rl2Guardar();
      return { cardItem: estado.cur, nivel };
    }
    // Nivel vacío (sin nada que practicar, o ya se resolvió todo): se marca
    // terminado y se pasa al siguiente en el mismo recorrido.
    cancionNivelCompletado(cancion.id, nivel);
    RL2.fase = "nivel" + (nivel + 1);
    rl2Guardar();
  }
}

// ---------- Resolver el ejercicio actual (acertado o no) ----------
// resultadosNivel8 solo aplica cuando nivel === 8 (resultados de
// checkCompletarAnswers, para fijar el % final y definitivo).
function rl2ResolverActual(cancion, cardItem, nivel, passed, resultadosNivel8) {
  rl2Cargar(cancion);
  if (nivel === 8) {
    const okCount = (resultadosNivel8 || []).filter((r) => r.isCorrect).length;
    const total = (resultadosNivel8 || []).length;
    const pct = total ? Math.round((okCount / total) * 100) : 100;
    cancionFijarResultadoFinal(cancion.id, pct);
    cancionNivelCompletado(cancion.id, 8);
    RL2.resultadoFinal = { aciertos: okCount, total, pct: cancionAvancePct(cancionProgresoLeer(cancion.id)) };
    RL2.fase = "fin";
    rl2Guardar();
    cancionReelsNotificarCambio(); // esta canción deja de estar pendiente
    if (typeof burstConfetti === "function") burstConfetti();
    toast("🏆 ¡Terminaste \"" + cancion.json.songTitle + "\"! Resultado final: " + RL2.resultadoFinal.pct + "%");
    return;
  }
  const key = "nivel" + nivel;
  RL2[key].cur = null;
  if (!passed) { cardItem.retry = true; RL2[key].banco.push(cardItem); }
  if (typeof rlSumarDia === "function") rlSumarDia("cancionEjercicios", 1);
  rl2Guardar();
}

// ---------- Render de UN ejercicio dentro de la tarjeta de Reels ----------
// Mismo contrato que usa reels-core.js (rlRenderEjercicio): pinta en `body`
// y llama onDone(passed, resultadosNivel8?) cuando el usuario termina.
function rl2RenderEjercicioEnReels(cardItem, nivel, body, onDone) {
  const ex = cardItem.ex;
  body.innerHTML = `<div class="rl-ex exercise-area"><div class="rl-ex-container"></div></div>`;
  const c = body.querySelector(".rl-ex-container");

  switch (ex.type) {
    case "audioSeleccion": {
      renderAudioSeleccionExercise(ex, c);
      c.addEventListener("audioseleccion-done", (e) => onDone(!!(e.detail && e.detail.passed)));
      RLV.limpiar = () => {
        if (c._casAutoPlayTimer) { clearTimeout(c._casAutoPlayTimer); c._casAutoPlayTimer = null; }
        if (c._casAudioDetener) c._casAudioDetener();
      };
      break;
    }
    // Nivel 6 ("completar" de una estrofa) y Nivel 8 (la canción completa):
    // misma tarjeta multilínea con audio real + karaoke. cardItem.esFinal
    // distingue el caso del Nivel 8 (sin reintento, fija el % final) del
    // Nivel 6 (reintento normal, vuelve al final de su cola si falla).
    case "completarCancion": {
      renderCancionCompletarExercise(ex, c);
      c.querySelector(".completar-check").onclick = () => {
        const { results } = checkCompletarAnswers(ex, c);
        showCancionCompletarModal(ex, results, (passed) => {
          if (cardItem.esFinal) onDone(true, results);
          else onDone(passed);
        });
      };
      RLV.limpiar = () => cancionCompletarAudioLimpiar(c);
      break;
    }
    case "dictadoCancion": {
      renderCancionDictadoExercise(ex, c);
      c.addEventListener("dictado-done", (e) => {
        const { result } = e.detail;
        onDone(!!(result && result.passed));
      });
      RLV.limpiar = () => cancionDictadoAudioLimpiar(c);
      break;
    }
    default: {
      c.innerHTML = `<p class="sub-fun">Tipo de ejercicio desconocido.</p>`;
      setTimeout(() => onDone(true), 0);
    }
  }
}

// ---------- Punto de entrada desde reels-sorpresas.js ----------
// Elige la canción activa de forma SÍNCRONA (ver cancionReelsElegirActiva en
// canciones-core.js) y devuelve el item de sorpresa de inmediato; el
// ejercicio en sí se arma de forma asíncrona dentro de
// cancionRenderSorpresaReels (igual patrón que "azure"/"reglas" cuando
// todavía no hay datos listos).
function cancionDecidirSorpresa() {
  if (typeof cancionReelsDisponible !== "function" || !cancionReelsDisponible()) return null;
  const cancion = cancionReelsElegirActiva();
  if (!cancion) return null;
  cancionReelsUltimaGuardar(cancion.id);
  return { k: "sorpresa", tipo: "cancion", uid: rlUid(), cancionId: cancion.id };
}

function cancionRenderSorpresaReels(item, body) {
  const cancion = cancionReelsBuscarPorId(item.cancionId);
  if (!cancion) { setTimeout(() => rlSorpresaHecha(item), 0); return; }
  body.innerHTML = `<p class="rl-sub" style="margin-top:30vh;text-align:center;">🎵 Cargando canción…</p>`;
  rl2SiguienteItem(cancion).then((resultado) => {
    if (!RLV.abierto || RL.cur !== item || !body.isConnected) return; // la tarjeta ya cambió
    if (!resultado) { rlSorpresaHecha(item); return; }
    const { cardItem, nivel } = resultado;
    rl2RenderEjercicioEnReels(cardItem, nivel, body, (passed, resultadosNivel8) => {
      rl2ResolverActual(cancion, cardItem, nivel, passed, resultadosNivel8);
      rlSorpresaHecha(item);
    });
  });
}
