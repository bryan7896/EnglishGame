// mapa/map.js
// Mapa de 10 nodos principales (el nodo 1 recibe una porción extra: un
// ejercicio adicional por cada nodo existente, es decir +totalMainNodes
// ejercicios sobre su reparto base; el resto del total se reparte lo más
// parejo posible entre los 9 nodos restantes, y el residuo de esa segunda
// división cae en el primero de esos 9)
// + uno o más nodos especiales de repaso (a partir del nodo
// totalMainNodes+1) que se llenan dinámicamente con los ejercicios de los
// nodos que no se aprueben con 80% o más. Igual que los nodos principales,
// si la pool de repaso crece se reparte en varios nodos del mismo tamaño
// típico en vez de amontonarse en uno solo (ver buildRepasoNodes()).

export const MAP_CONFIG = {
  totalMainNodes: 10,
  // Imágenes de fondo estilo "carátula de episodio" para los nodos principales
  backgrounds: [
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&h=300&fit=crop",
  ],
};

// =========================================================================
// Cantidad de nodos principales — configurable por el usuario
// =========================================================================
// Antes era un valor fijo (MAP_CONFIG.totalMainNodes). Ahora el usuario
// puede definirla libremente (con +/- desde el modal del menú) y queda
// guardada en localStorage, igual que el idioma objetivo en idioma.js.
const NODE_COUNT_STORAGE_KEY = "englishTrainerTotalMainNodes";
export const MIN_MAIN_NODES = 3;
export const MAX_MAIN_NODES = 60;

let _totalMainNodes = MAP_CONFIG.totalMainNodes;
try {
  const saved = parseInt(window.localStorage?.getItem(NODE_COUNT_STORAGE_KEY), 10);
  if (!isNaN(saved) && saved >= MIN_MAIN_NODES && saved <= MAX_MAIN_NODES) _totalMainNodes = saved;
} catch (e) { /* localStorage no disponible */ }

export function getTotalMainNodes() {
  return _totalMainNodes;
}

// Guarda la nueva cantidad (siempre dentro de los límites) y la persiste.
// No toca AppState.nodes/progress por sí sola — eso lo hace
// redistributeMainNodes() cuando ya hay ejercicios cargados.
export function setTotalMainNodes(n) {
  const clamped = Math.max(MIN_MAIN_NODES, Math.min(MAX_MAIN_NODES, Math.round(n) || MIN_MAIN_NODES));
  _totalMainNodes = clamped;
  try { window.localStorage?.setItem(NODE_COUNT_STORAGE_KEY, String(clamped)); } catch (e) { /* noop */ }
  return _totalMainNodes;
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Ícono "i" de información en SVG, azul oscuro, para el nodo "Práctica inicial".
const INFO_ICON_SVG = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" fill="#1e3a8a"/>
  <rect x="10.9" y="10.2" width="2.2" height="7" rx="1.1" fill="#fff"/>
  <circle cx="12" cy="7.3" r="1.35" fill="#fff"/>
</svg>`;

/**
 * Construye el estado inicial del nodo especial "Práctica inicial" a partir
 * del array `informacion` del JSON del usuario. Vive FUERA del array de 6
 * nodos (main + repaso): no cuenta para el informe de errores ni para el
 * sistema de repaso por 80%. Devuelve null si no hay lecciones.
 */
export function createPracticaInicial(informacion) {
  const lecciones = informacion || [];
  if (!lecciones.length) return null;
  return {
    lecciones,
    leccionIndex: 0,
    completed: false,
  };
}


// =========================================================================
// Reparto del nodo de repaso en varios nodos — igual que los principales
// =========================================================================
// Antes el repaso era SIEMPRE un único nodo (por grande que fuera su pool).
// Ahora, igual que los nodos principales se reparten con computeNodeSizes(),
// la pool de repaso (AppState.reviewPool) se reparte en tantos nodos de
// repaso como haga falta, del mismo tamaño "típico" que tiene un nodo
// principal — así un repaso con muchos ejercicios pendientes también queda
// dividido en tandas manejables en vez de amontonarse en un solo nodo.

// Tamaño "típico" de un nodo principal (promedio, redondeado hacia arriba),
// usado como tamaño de cada trozo de repaso. Si todavía no hay nodos
// principales con ejercicios, se usa un tamaño por defecto razonable.
export function computeRepasoChunkSize(mainNodes) {
  // Solo cuentan los ejercicios "originales" del nodo: las copias que el
  // usuario manda con [Repasar] al final de su nodo (__requeue) no deben
  // inflar el tamaño típico de un nodo de repaso.
  const originalCount = (n) => Array.isArray(n.exercises)
    ? n.exercises.filter((e) => !e.__requeue).length
    : (n.totalExercises || 0);
  const withExercises = (mainNodes || []).filter((n) => originalCount(n) > 0);
  if (!withExercises.length) return 10;
  const totalMain = withExercises.reduce((sum, n) => sum + originalCount(n), 0);
  return Math.max(1, Math.ceil(totalMain / withExercises.length));
}

/**
 * Reparte un array plano de ejercicios de repaso en tantos nodos de tipo
 * "repaso" como haga falta, de tamaño `chunkSize` cada uno (el último puede
 * quedar más chico). Si la pool está vacía, igual devuelve UN nodo vacío,
 * para que el mapa siempre tenga al menos un nodo de repaso que mostrar.
 * `startId` es el id (1-based) que le corresponde al primer nodo de repaso,
 * es decir totalMainNodes + 1.
 */
export function buildRepasoNodes(reviewPool, chunkSize, startId) {
  const pool = reviewPool || [];
  const size = Math.max(1, chunkSize || 10);
  const chunkCount = pool.length ? Math.ceil(pool.length / size) : 1;

  const nodes = [];
  for (let i = 0; i < chunkCount; i++) {
    const exercises = pool.slice(i * size, (i + 1) * size);
    nodes.push({
      id: startId + i,
      type: "repaso",
      repasoIndex: i,
      repasoCount: chunkCount,
      totalExercises: exercises.length,
      exercises,
    });
  }
  return nodes;
}

function computeNodeSizes(total, totalMainNodes) {
  const base = Math.floor(total / totalMainNodes);
  const remainder = total % totalMainNodes;

  const sizes = [];
  for (let i = 0; i < totalMainNodes; i++) {
    sizes.push(base + (i < remainder ? 1 : 0));
  }
  return sizes;
}

/**
 * Construye los nodos principales con el reparto de computeNodeSizes()
 * (nodo 1 con porción extra, ver arriba) más uno o más nodos extra de
 * repaso que arrancan vacíos — se llenan en tiempo de ejecución (ver
 * refreshRepasoNode en el motor principal) con los ejercicios de nodos
 * que no se aprobaron con 80% o más, repartiéndose en varios nodos si la
 * pool crece (ver buildRepasoNodes()).
 */
export function createNodeStructure(userData) {
  const { traducciones, completar, seleccionar, corregir, dictado } = userData;

  const allExercises = [
    ...(traducciones || []).map(e => ({ ...e, type: "traduccion" })),
    ...(completar || []).map(e => ({ ...e, type: "completar" })),
    ...(seleccionar || []).map(e => ({ pairs: e, type: "seleccionar" })),
    ...(corregir || []).map(e => ({ ...e, type: "corregir" })),
    ...(dictado || []).map(e => ({ text: typeof e === 'string' ? e : e.text || e, type: "dictado" })),
  ];

  const totalMainNodes = getTotalMainNodes();
  const total = allExercises.length;
  const sizes = computeNodeSizes(total, totalMainNodes);

  const shuffled = shuffleArray(allExercises);

  const nodes = [];
  let cursor = 0;
  for (let i = 0; i < totalMainNodes; i++) {
    const size = sizes[i] || 0;
    const nodeExercises = shuffled.slice(cursor, cursor + size);
    cursor += size;
    nodes.push({
      id: i + 1,
      type: "main",
      background: MAP_CONFIG.backgrounds[i % MAP_CONFIG.backgrounds.length],
      totalExercises: nodeExercises.length,
      exercises: nodeExercises,
    });
  }

  // Nodo(s) de repaso: arrancan vacíos (un único nodo vacío), se
  // sincronizan dinámicamente con la "pool" de repaso mientras el usuario
  // juega, repartiéndose en varios nodos si hace falta (ver
  // refreshRepasoNode() / buildRepasoNodes()).
  nodes.push(...buildRepasoNodes([], computeRepasoChunkSize(nodes), totalMainNodes + 1));

  return nodes;
}

/**
 * Cambia la cantidad de nodos principales de forma libre (usada por el
 * modal de +/- del menú), SIN afectar el progreso ya guardado: cada
 * ejercicio conserva su estado (hecho/pendiente) sin importar en qué nodo
 * termine cayendo tras el cambio.
 *
 * Cómo lo logra: en vez de tocar cada ejercicio, se "aplanan" todos los
 * ejercicios principales anotando junto a cada uno si su casillero en
 * `progress` ya estaba marcado como resuelto; luego se vuelven a repartir
 * con computeNodeSizes() usando la nueva cantidad de nodos, y el progreso
 * de cada nodo nuevo se recalcula a partir de esas anotaciones. El nodo de
 * repaso (siempre el último del array) se conserva tal cual, con su propio
 * progreso intacto.
 *
 * `nodes` y `progress` son los AppState.nodes/AppState.progress actuales.
 * Devuelve { nodes, progress } listos para reemplazarlos.
 */
export function redistributeMainNodes(nodes, progress, newTotalMainNodes) {
  // El primer nodo de tipo "repaso" marca dónde terminan los principales
  // (puede haber uno o varios nodos de repaso a continuación).
  const firstRepasoIdx = nodes.findIndex((n) => n.type === "repaso");
  const oldTotalMainNodes = firstRepasoIdx === -1 ? nodes.length : firstRepasoIdx;
  const clamped = setTotalMainNodes(newTotalMainNodes);

  const mainNodes = nodes.slice(0, oldTotalMainNodes);
  const oldRepasoNodes = nodes.slice(oldTotalMainNodes);

  // Aplanamos todos los ejercicios principales, recordando si cada uno ya
  // estaba resuelto (según el progreso viejo), para que ese dato viaje con
  // el ejercicio sin importar en qué nodo nuevo caiga.
  //
  // Excepción: las copias que el usuario mandó con [Repasar] al final de su
  // nodo (marcadas con __requeue) NO entran al reparto automático. Se
  // apartan y, tras repartir los ejercicios originales, se vuelven a poner
  // al FINAL del mismo nodo donde estaban (o del último nodo, si el nuevo
  // total de nodos es menor). Así el reparto automático no las mueve de
  // sitio ni altera el tamaño de los nodos.
  const flat = [];
  const requeued = [];
  mainNodes.forEach((node, idx) => {
    const prog = progress[idx] || {};
    const results = prog.exerciseResults || [];
    (node.exercises || []).forEach((ex, i) => {
      const done = !!results[i];
      if (ex && ex.__requeue) requeued.push({ exercise: ex, done, home: idx });
      else flat.push({ exercise: ex, done });
    });
  });

  const total = flat.length;
  const sizes = computeNodeSizes(total, clamped);

  const newMainNodes = [];
  const newProgress = {};
  let cursor = 0;
  for (let i = 0; i < clamped; i++) {
    const size = sizes[i] || 0;
    const slice = flat.slice(cursor, cursor + size);
    cursor += size;

    // Las copias de [Repasar] vuelven al final de su nodo de origen.
    const extras = requeued.filter((r) => Math.min(r.home, clamped - 1) === i);
    const withExtras = [...slice, ...extras];

    const exercises = withExtras.map(item => item.exercise);
    const exerciseResults = withExtras.map(item => item.done);
    const exercisesDone = exerciseResults.filter(Boolean).length;

    newMainNodes.push({
      id: i + 1,
      type: "main",
      background: MAP_CONFIG.backgrounds[i % MAP_CONFIG.backgrounds.length],
      totalExercises: exercises.length,
      exercises,
    });
    newProgress[i] = {
      completed: exercises.length > 0 && exercisesDone === exercises.length,
      exercisesDone,
      exerciseResults,
    };
  }

  // Los nodos de repaso (puede haber uno o varios) se conservan tal cual
  // estaban — esto solo redistribuye los PRINCIPALES — únicamente se les
  // renumera el id y se remapea su progreso a la nueva posición dentro del
  // array. Si por algún motivo no había ninguno, se crea uno vacío.
  const repasoSource = oldRepasoNodes.length
    ? oldRepasoNodes
    : [{ type: "repaso", totalExercises: 0, exercises: [] }];

  const repasoNodes = repasoSource.map((node, i) => ({
    ...node,
    id: clamped + i + 1,
    type: "repaso",
  }));

  const newNodes = [...newMainNodes, ...repasoNodes];

  repasoNodes.forEach((node, i) => {
    const oldIdx = oldTotalMainNodes + i;
    const exercisesLen = (node.exercises || []).length;
    newProgress[clamped + i] = progress[oldIdx] || {
      completed: exercisesLen === 0,
      exercisesDone: 0,
      exerciseResults: Array(exercisesLen).fill(false),
    };
  });

  return { nodes: newNodes, progress: newProgress };
}

export function validateInputData(data) {
  return { valid: true, errors: [] };
}

export function renderMap(nodes, progress, callbacks, practicaInicial) {
  const mapList = document.getElementById("mapList");
  if (!mapList) return;

  // Se deriva del tipo de cada nodo (y no de la longitud del array) para
  // que el mapa funcione igual sin importar cuántos nodos principales haya
  // elegido el usuario NI cuántos nodos de repaso hayan salido de repartir
  // la pool (ahora puede ser más de uno, ver buildRepasoNodes()).
  const mainNodes = nodes.filter(n => n.type !== "repaso");
  const repasoNodes = nodes.filter(n => n.type === "repaso");
  const totalMainNodes = mainNodes.length;
  const hasAnyMain = mainNodes.some(n => (n.exercises?.length || 0) > 0);
  const hasPractica = !!(practicaInicial && practicaInicial.lecciones?.length);

  if (!nodes?.length || (!hasAnyMain && !hasPractica)) {
    mapList.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><p>Carga tus ejercicios para ver el mapa</p></div>`;
    return;
  }

  // La "Práctica inicial" es obligatoria: mientras tenga lecciones pendientes,
  // bloquea visualmente TODO lo demás (nodos principales y repaso) y
  // desaparece por completo al terminarse.
  const practicaPendiente = !!(practicaInicial && !practicaInicial.completed && practicaInicial.lecciones?.length);
  let practicaHtml = '';
  if (practicaPendiente) {
    const total = practicaInicial.lecciones.length;
    practicaHtml = `
      <div class="netflix-node practica-inicial-node" data-practica-inicial="1">
        <div class="practica-inicial-icon">${INFO_ICON_SVG}</div>
        <div class="practica-inicial-content">
          <div class="practica-inicial-title">Práctica inicial</div>
          <div class="practica-inicial-desc">${total} ${total === 1 ? 'lección' : 'lecciones'} de refuerzo antes de continuar</div>
          <div class="practica-inicial-status">▶ OBLIGATORIO · TOCA PARA EMPEZAR</div>
        </div>
      </div>
    `;
  }

  let firstUnlocked = 0;
  for (let i = 0; i < mainNodes.length; i++) {
    if (!progress[i]?.completed) { firstUnlocked = i; break; }
    firstUnlocked = i + 1;
  }

  const mainNodesHtml = mainNodes.map((node, idx) => {
    const prog = progress[idx] || { completed: false, exercisesDone: 0 };
    const total = node.totalExercises || node.exercises?.length || 1;
    const done = Math.min(prog.exercisesDone || 0, total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const isDone = prog.completed || false;
    const isCur = idx === firstUnlocked && !isDone;
    const unlocked = idx <= firstUnlocked;
    const isEmpty = (node.exercises?.length || 0) === 0;
    const blocked = !unlocked || isEmpty || practicaPendiente;

    return `
      <div class="netflix-node ${blocked ? 'locked' : ''} ${isCur ? 'current' : ''} ${isDone ? 'done' : ''} ${isEmpty ? 'empty' : ''} ${practicaPendiente ? 'practica-dim' : ''}"
           data-node="${idx}" style="${blocked ? 'pointer-events:none;' : ''}">
        <div class="netflix-node-bg" style="background-image:url('${node.background}')">
          <div class="netflix-node-overlay"></div>
        </div>
        <div class="netflix-node-content">
          <div class="netflix-node-number">${String(idx + 1).padStart(2, '0')}</div>
          <div class="netflix-node-title">Nodo ${idx + 1}</div>
          <div class="netflix-node-progress">
            <div class="netflix-progress-bar">
              <div class="netflix-progress-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="netflix-node-status">
            ${isEmpty ? '📭 SIN EJERCICIOS' : isDone ? '✅ COMPLETADO' : isCur ? '▶ REPRODUCIR' : unlocked ? '🔓 DISPONIBLE' : '🔒 BLOQUEADO'}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const repasoHtml = repasoNodes.map((repasoNode, rIdx) => {
    const idx = totalMainNodes + rIdx;
    const prog = progress[idx] || { completed: true, exercisesDone: 0 };
    const total = repasoNode.exercises?.length || 0;
    const done = Math.min(prog.exercisesDone || 0, total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const isEmpty = total === 0;
    // Solo se numeran los repasos entre sí ("Repaso 1", "Repaso 2"...)
    // cuando hay más de uno; con uno solo se ve igual que antes.
    const repasoLabel = repasoNodes.length > 1 ? `Repaso ${rIdx + 1}/${repasoNodes.length}` : 'Repaso';

    return `
      <div class="netflix-node repaso-node ${isEmpty ? 'empty' : ''} ${practicaPendiente ? 'practica-dim' : ''}" data-node="${idx}" style="${isEmpty || practicaPendiente ? 'pointer-events:none;' : ''}">
        <div class="repaso-node-icon">🧠</div>
        <div class="repaso-node-content">
          <div class="repaso-node-title">Nodo ${idx + 1} · ${repasoLabel}</div>
          <div class="repaso-node-desc">
            ${isEmpty ? '🎉 No tienes ejercicios pendientes' : total + (total === 1 ? ' ejercicio por repasar' : ' ejercicios por repasar')}
          </div>
          ${!isEmpty ? `
            <div class="netflix-node-progress">
              <div class="netflix-progress-bar">
                <div class="netflix-progress-fill" style="width:${pct}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  mapList.innerHTML = practicaHtml + mainNodesHtml + repasoHtml;

  const practicaEl = mapList.querySelector('[data-practica-inicial]');
  if (practicaEl) {
    practicaEl.addEventListener('click', () => callbacks.openPracticaInicial());
  }

  mapList.querySelectorAll('.netflix-node[data-node]').forEach(card => {
    card.addEventListener('click', () => {
      if (practicaPendiente) { callbacks.showToast("📌 Termina la práctica inicial primero"); return; }
      const idx = parseInt(card.dataset.node);
      const node = nodes[idx];
      const isRepaso = node?.type === "repaso";

      if (!node || !node.exercises || node.exercises.length === 0) {
        callbacks.showToast(isRepaso ? "🎉 No tienes ejercicios pendientes de repaso" : "📭 Este nodo no tiene ejercicios");
        return;
      }
      if (isRepaso) { callbacks.openNode(idx); return; }
      if (idx <= firstUnlocked) callbacks.openNode(idx);
      else callbacks.showToast("Completa el nodo anterior");
    });
  });
}

export function getExerciseTypeIcon(type) {
  const i = { traduccion: "📝", completar: "✏️", seleccionar: "🎯", corregir: "🔍", dictado: "🎧" };
  return i[type] || "📌";
}

export function getExerciseTypeName(type) {
  const n = { traduccion: "Traducción", completar: "Completar", seleccionar: "Emparejar", corregir: "Corregir", dictado: "Dictado" };
  return n[type] || type;
}