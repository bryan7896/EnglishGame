// mapa/map.js
// Mapa de 5 nodos principales (reparto equitativo, el residuo va al nodo 1)
// + 1 nodo especial de repaso (nodo 6) que se llena dinámicamente con los
// ejercicios de los nodos que no se aprueben con 80% o más.

export const MAP_CONFIG = {
  totalMainNodes: 7,
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

/**
 * Construye 6 nodos: 5 principales con reparto equitativo de todos los
 * ejercicios (si sobran ejercicios al dividir entre 5, el sobrante se suma
 * al nodo 1) y un 6to nodo de repaso que arranca vacío — se llena en
 * tiempo de ejecución (ver refreshRepasoNode en el motor principal) con
 * los ejercicios de nodos que no se aprobaron con 80% o más.
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

  const totalMainNodes = MAP_CONFIG.totalMainNodes;
  const total = allExercises.length;
  const base = Math.floor(total / totalMainNodes);
  const remainder = total % totalMainNodes;

  const shuffled = shuffleArray(allExercises);

  const nodes = [];
  let cursor = 0;
  for (let i = 0; i < totalMainNodes; i++) {
    const size = base + (i === 0 ? remainder : 0);
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

  // Nodo 6 — repaso: arranca vacío, se sincroniza dinámicamente con la
  // "pool" de repaso mientras el usuario juega (ver refreshRepasoNode()).
  nodes.push({
    id: totalMainNodes + 1,
    type: "repaso",
    totalExercises: 0,
    exercises: [],
  });

  return nodes;
}

export function validateInputData(data) {
  return { valid: true, errors: [] };
}

export function renderMap(nodes, progress, callbacks, practicaInicial) {
  const mapList = document.getElementById("mapList");
  if (!mapList) return;

  const mainNodes = nodes.slice(0, MAP_CONFIG.totalMainNodes);
  const repasoNode = nodes[MAP_CONFIG.totalMainNodes];
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

  let repasoHtml = '';
  if (repasoNode) {
    const idx = MAP_CONFIG.totalMainNodes;
    const prog = progress[idx] || { completed: true, exercisesDone: 0 };
    const total = repasoNode.exercises?.length || 0;
    const done = Math.min(prog.exercisesDone || 0, total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const isEmpty = total === 0;

    repasoHtml = `
      <div class="netflix-node repaso-node ${isEmpty ? 'empty' : ''} ${practicaPendiente ? 'practica-dim' : ''}" data-node="${idx}" style="${isEmpty || practicaPendiente ? 'pointer-events:none;' : ''}">
        <div class="repaso-node-icon">🧠</div>
        <div class="repaso-node-content">
          <div class="repaso-node-title">Nodo 6 · Repaso</div>
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
  }

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
      const isRepaso = idx === MAP_CONFIG.totalMainNodes;

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