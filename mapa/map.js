// mapa/map.js
// Mapa de nodos con distribución por porcentaje y diseño contemporáneo

export const MAP_CONFIG = {
  nodes: [
    { id: 1, percent: 40, type: "mixed" },
    { id: 2, percent: 20, type: "mixed" },
    { id: 3, percent: 5, type: "mixed" },
    { id: 4, percent: 10, type: "mixed" },
    { id: 5, percent: 20, type: "mixed" },
    { id: 6, percent: 5, type: "mixed" }
  ],
  // Imágenes de fondo estilo Netflix (unsplash random)
  // En MAP_CONFIG, reemplazar el array backgrounds:
  backgrounds: [
      "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop",  // código en pantalla
      "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=300&fit=crop",  // líneas de código
      "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&h=300&fit=crop",  // matrix código
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",  // pantalla con HTML
      "https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=400&h=300&fit=crop",  // setup desarrollo
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=300&fit=crop",  // laptop con código
      "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=400&h=300&fit=crop",  // código oscuro
      "https://images.unsplash.com/photo-1515879218367-8466d910auj7?w=400&h=300&fit=crop",  // terminal
      "https://images.unsplash.com/photo-1523800503107-5bc3ba2a6f81?w=400&h=300&fit=crop",  // escribiendo código
      "https://images.unsplash.com/photo-1534665482403-a909d0d97c67?w=400&h=300&fit=crop",  // desarrollador
      "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=400&h=300&fit=crop",  // pantallas
      "https://images.unsplash.com/photo-1504805572947-34fad45aed93?w=400&h=300&fit=crop",  // código colorido
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

export function createNodeStructure(userData) {
  const { traducciones, completar, seleccionar, corregir, dictado, conversacion } = userData;
  
  // Recolectar todos los ejercicios
  const allExercises = [
    ...(traducciones || []).map(e => ({ ...e, type: "traduccion" })),
    ...(completar || []).map(e => ({ ...e, type: "completar" })),
    ...(seleccionar || []).map(e => ({ pairs: e, type: "seleccionar" })),
    ...(corregir || []).map(e => ({ ...e, type: "corregir" })),
    ...(dictado || []).map(e => ({ text: typeof e === 'string' ? e : e.text || e, type: "dictado" })),
  ];
  
  // Mezclar aleatoriamente
  const shuffled = shuffleArray(allExercises);
  
  // Distribuir según porcentajes
  const nodes = MAP_CONFIG.nodes.map((config, idx) => {
    const totalExercises = shuffled.length;
    const nodeSize = Math.round(totalExercises * config.percent / 100);
    
    // Calcular inicio para este nodo
    let startIndex = 0;
    for (let i = 0; i < idx; i++) {
      startIndex += Math.round(totalExercises * MAP_CONFIG.nodes[i].percent / 100);
    }
    
    const nodeExercises = shuffled.slice(startIndex, startIndex + nodeSize);
    
    return {
      id: config.id,
      type: config.type,
      percent: config.percent,
      background: MAP_CONFIG.backgrounds[idx],
      totalExercises: nodeExercises.length,
      exercises: nodeExercises
    };
  });
  
  // Agregar conversación al último nodo si existe
  if (conversacion && conversacion.length > 0) {
    const conv = conversacion[0];
    nodes[nodes.length - 1].exercises.push({
      type: "conversacion",
      messages: conv.messages || conv
    });
    nodes[nodes.length - 1].totalExercises++;
  }
  
  return nodes;
}

export function validateInputData(data) {
  const errors = [];
  if (!data.traducciones?.length) errors.push("Traducciones: required");
  if (!data.completar?.length) errors.push("Completar: required");
  if (!data.seleccionar?.length) errors.push("Seleccionar: required");
  if (!data.corregir?.length) errors.push("Corregir: required");
  if (!data.dictado?.length) errors.push("Dictado: required");
  if (!data.conversacion?.length) errors.push("Conversación: required");
  return { valid: errors.length === 0, errors };
}

export function renderMap(nodes, progress, callbacks) {
  const mapList = document.getElementById("mapList");
  if (!mapList) return;
  
  if (!nodes?.length) {
    mapList.innerHTML = `<div style="text-align:center;padding:40px;color:#94a3b8;"><p>Carga tus ejercicios para ver el mapa</p></div>`;
    return;
  }
  
  let firstUnlocked = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (!progress[i]?.completed) { firstUnlocked = i; break; }
    firstUnlocked = i + 1;
  }
  
  mapList.innerHTML = nodes.map((node, idx) => {
    const prog = progress[idx] || { completed: false, exercisesDone: 0 };
    const total = node.totalExercises || node.exercises?.length || 1;
    const done = Math.min(prog.exercisesDone || 0, total);
    const pct = total ? Math.round(done / total * 100) : 0;
    const isDone = prog.completed || false;
    const isCur = idx === firstUnlocked && !isDone;
    const unlocked = idx <= firstUnlocked;
    
    return `
      <div class="netflix-node ${!unlocked ? 'locked' : ''} ${isCur ? 'current' : ''} ${isDone ? 'done' : ''}"
           data-node="${idx}" style="${!unlocked ? 'pointer-events:none;' : ''}">
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
            ${isDone ? '✅ COMPLETADO' : isCur ? '▶ REPRODUCIR' : unlocked ? '🔓 DISPONIBLE' : '🔒 BLOQUEADO'}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  mapList.querySelectorAll('.netflix-node[data-node]').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.node);
      if (idx <= firstUnlocked) callbacks.openNode(idx);
      else callbacks.showToast("Completa el nodo anterior");
    });
  });
}

export function getExerciseTypeIcon(type) {
  const i = { traduccion:"📝", completar:"✏️", seleccionar:"🎯", corregir:"🔍", dictado:"🎧", conversacion:"💬" };
  return i[type] || "📌";
}

export function getExerciseTypeName(type) {
  const n = { traduccion:"Traducción", completar:"Completar", seleccionar:"Emparejar", corregir:"Corregir", dictado:"Dictado", conversacion:"Conversación" };
  return n[type] || type;
}