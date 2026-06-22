// mapa/map.js
// Estructura y configuración del mapa de nodos con diseño minimalista

export const MAP_CONFIG = {
  nodes: [
    {
      id: 1,
      lessons: 5,
      exercisesPerLesson: 10,
      totalExercises: 50,
      type: "mixed",
      color: "#facc15",
      icon: "🌟"
    },
    {
      id: 2,
      lessons: 5,
      exercisesPerLesson: 8,
      totalExercises: 40,
      type: "mixed",
      color: "#60a5fa",
      icon: "💎"
    },
    {
      id: 3,
      lessons: 1,
      exercisesPerLesson: 1,
      totalExercises: 1,
      type: "story",
      color: "#f472b6",
      icon: "📖"
    },
    {
      id: 4,
      lessons: 2,
      exercisesPerLesson: 7,
      totalExercises: 14,
      type: "mixed",
      color: "#a78bfa",
      icon: "🔮"
    },
    {
      id: 5,
      lessons: 1,
      exercisesPerLesson: 1,
      totalExercises: 1,
      type: "story",
      color: "#f472b6",
      icon: "📚"
    },
    {
      id: 6,
      lessons: 1,
      exercisesPerLesson: 12,
      totalExercises: 12,
      type: "mixed",
      color: "#34d399",
      icon: "🏆"
    }
  ],

  validation: {
    traduccion: 71,
    completar: 32,
    seleccionar: 13,
    historia: 2
  }
};

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function interleaveExercises(traducciones, completar, seleccionar) {
  const allExercises = [
    ...traducciones.map(e => ({ ...e, type: "traduccion" })),
    ...completar.map(e => ({ ...e, type: "completar" })),
    ...seleccionar.map(e => ({ pairs: e, type: "seleccionar" }))
  ];
  return shuffleArray(allExercises);
}

export function createNodeStructure(userData) {
  const { traducciones, completar, seleccionar, historias } = userData;

  let tradIndex = 0;
  let compIndex = 0;
  let selIndex = 0;
  let histIndex = 0;

  const nodes = MAP_CONFIG.nodes.map(nodeConfig => {
    const nodeExercises = [];

    if (nodeConfig.type === "story") {
      const story = historias[histIndex];
      if (story) {
        nodeExercises.push({
          type: "historia",
          title: story.title,
          content: story.content,
          paragraphs: story.paragraphs
        });
        histIndex++;
      }
    } else {
      const totalPerLesson = nodeConfig.exercisesPerLesson;
      const totalLessons = nodeConfig.lessons;

      const tradPerLesson = Math.round(totalPerLesson * 0.6);
      const compPerLesson = Math.round(totalPerLesson * 0.25);
      const selPerLesson = totalPerLesson - tradPerLesson - compPerLesson;

      for (let lesson = 0; lesson < totalLessons; lesson++) {
        const lessonTrad = traducciones.slice(tradIndex, tradIndex + tradPerLesson);
        const lessonComp = completar.slice(compIndex, compIndex + compPerLesson);
        const lessonSel = seleccionar.slice(selIndex, selIndex + selPerLesson);

        const mixedExercises = interleaveExercises(lessonTrad, lessonComp, lessonSel);
        nodeExercises.push(...mixedExercises);

        tradIndex += tradPerLesson;
        compIndex += compPerLesson;
        selIndex += selPerLesson;
      }

      while (tradIndex < traducciones.length && nodeExercises.length < nodeConfig.totalExercises) {
        nodeExercises.push({ type: "traduccion", ...traducciones[tradIndex] });
        tradIndex++;
      }
      while (compIndex < completar.length && nodeExercises.length < nodeConfig.totalExercises) {
        nodeExercises.push({ type: "completar", ...completar[compIndex] });
        compIndex++;
      }
      while (selIndex < seleccionar.length && nodeExercises.length < nodeConfig.totalExercises) {
        nodeExercises.push({ type: "seleccionar", pairs: seleccionar[selIndex] });
        selIndex++;
      }
    }

    return {
      id: nodeConfig.id,
      type: nodeConfig.type,
      lessons: nodeConfig.lessons,
      exercisesPerLesson: nodeConfig.exercisesPerLesson,
      color: nodeConfig.color,
      icon: nodeConfig.icon,
      totalExercises: nodeConfig.totalExercises,
      exercises: nodeExercises
    };
  });

  return nodes;
}

export function validateInputData(data) {
  const errors = [];
  const { traducciones, completar, seleccionar, historias } = data;

  if (!traducciones || traducciones.length !== MAP_CONFIG.validation.traduccion) {
    errors.push(`Traducciones: ${MAP_CONFIG.validation.traduccion} requeridas (${traducciones?.length || 0} recibidas)`);
  }
  if (!completar || completar.length !== MAP_CONFIG.validation.completar) {
    errors.push(`Completar: ${MAP_CONFIG.validation.completar} requeridas (${completar?.length || 0} recibidas)`);
  }
  if (!seleccionar || seleccionar.length !== MAP_CONFIG.validation.seleccionar) {
    errors.push(`Seleccionar: ${MAP_CONFIG.validation.seleccionar} requeridas (${seleccionar?.length || 0} recibidas)`);
  }
  if (!historias || historias.length !== MAP_CONFIG.validation.historia) {
    errors.push(`Historias: ${MAP_CONFIG.validation.historia} requeridas (${historias?.length || 0} recibidas)`);
  }

  return { valid: errors.length === 0, errors };
}

function createNodeSVG(node, progress) {
  const configNode = MAP_CONFIG.nodes.find(n => n.id === node.id) || node;
  const nodeColor = node.color || configNode.color || '#facc15';
  const nodeIcon = node.icon || configNode.icon || '📌';
  const totalLessons = node.lessons || configNode.lessons || 1;
  const totalExercises = (node.exercises && node.exercises.length) || node.totalExercises || 1;
  const exercisesPerLesson = node.exercisesPerLesson || configNode.exercisesPerLesson || 1;
  const exercisesDone = progress.exercisesDone || 0;
  const isCompleted = progress.completed || false;

  const size = 120;
  const strokeWidth = 5;
  const radius = (size / 2) - strokeWidth - 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Si solo 1 lección, anillo simple
  if (totalLessons === 1) {
    const percent = totalExercises ? (exercisesDone / totalExercises) : 0;
    const dashOffset = circumference - (percent * circumference);
    const ringColor = isCompleted ? '#4ade80' : nodeColor;

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="node-ring-svg">
        <circle cx="${center}" cy="${center}" r="${radius}" 
          fill="rgba(15,20,34,0.8)" stroke="#1e293b" stroke-width="${strokeWidth}" />
        <circle cx="${center}" cy="${center}" r="${radius}" 
          fill="none" stroke="${ringColor}" stroke-width="${strokeWidth + 1}" 
          stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
          stroke-linecap="round" class="ring-fill" 
          style="filter: drop-shadow(0 0 4px ${ringColor}40);" />
        <text x="${center}" y="${center + 2}" text-anchor="middle" 
          dominant-baseline="central" font-size="32" 
          style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${nodeIcon}</text>
        <text x="${center}" y="${center + 30}" text-anchor="middle" 
          fill="${isCompleted ? '#4ade80' : '#94a3b8'}" font-size="9" font-weight="600">
          ${exercisesDone}/${totalExercises}
        </text>
      </svg>
    `;
  }

  // Múltiples lecciones: anillo segmentado
  const gapAngle = 5;
  const totalGapAngle = gapAngle * totalLessons;
  const availableAngle = 360 - totalGapAngle;
  const segmentAngle = availableAngle / totalLessons;

  // Calcular segmentos
  const segments = [];
  for (let i = 0; i < totalLessons; i++) {
    const lessonStart = i * exercisesPerLesson;
    const lessonEnd = Math.min((i + 1) * exercisesPerLesson, totalExercises);
    const results = progress.exerciseResults || [];
    const lessonDone = results.slice(lessonStart, lessonEnd).filter(r => r).length;
    const lessonTotal = lessonEnd - lessonStart;
    segments.push({
      done: lessonDone,
      total: lessonTotal,
      percent: lessonTotal ? (lessonDone / lessonTotal) : 0,
      completed: lessonDone >= lessonTotal && lessonTotal > 0
    });
  }

  let segmentsSvg = '';
  let baseSvg = '';
  let currentAngle = -90;

  segments.forEach((seg, i) => {
    const startAngle = currentAngle + (gapAngle / 2);
    const endAngle = startAngle + segmentAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);
    const largeArc = segmentAngle > 180 ? 1 : 0;

    // Base gris
    baseSvg += `
      <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}"
        fill="none" stroke="#1e293b" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.6" />
    `;

    // Segmento de progreso
    if (seg.percent > 0) {
      const segArcLength = seg.percent * segmentAngle;
      const segEndAngle = startAngle + segArcLength;
      const segEndRad = (segEndAngle * Math.PI) / 180;
      const sx2 = center + radius * Math.cos(segEndRad);
      const sy2 = center + radius * Math.sin(segEndRad);
      const segLargeArc = segArcLength > 180 ? 1 : 0;

      const segColor = seg.completed ? '#4ade80' : nodeColor;

      segmentsSvg += `
        <path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 ${segLargeArc} 1 ${sx2.toFixed(1)} ${sy2.toFixed(1)}"
          fill="none" stroke="${segColor}" stroke-width="${strokeWidth + 1}" 
          stroke-linecap="round" style="filter: drop-shadow(0 0 3px ${segColor}40);" />
      `;
    }

    currentAngle = startAngle + segmentAngle + gapAngle;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="node-ring-svg">
      <circle cx="${center}" cy="${center}" r="${radius - 1}" fill="rgba(15,20,34,0.9)" />
      ${baseSvg}
      ${segmentsSvg}
      <text x="${center}" y="${center + 2}" text-anchor="middle" 
        dominant-baseline="central" font-size="30" 
        style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">${nodeIcon}</text>
      <text x="${center}" y="${center + 28}" text-anchor="middle" 
        fill="${isCompleted ? '#4ade80' : '#94a3b8'}" font-size="9" font-weight="600">
        ${exercisesDone}/${totalExercises}
      </text>
    </svg>
  `;
}

export function renderMap(nodes, progress, callbacks) {
  const mapList = document.getElementById("mapList");
  if (!mapList) return;

  if (!nodes || nodes.length === 0) {
    mapList.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
        <div style="font-size:3rem; margin-bottom:12px;">🗺️</div>
        <p style="font-size:0.9rem;">Aún no hay ejercicios.<br>Importa tu lista para empezar</p>
      </div>`;
    return;
  }

  let firstUnlocked = 0;
  for (let i = 0; i < nodes.length; i++) {
    const nodeProgress = progress[i];
    if (!nodeProgress || !nodeProgress.completed) {
      firstUnlocked = i;
      break;
    }
    firstUnlocked = i + 1;
  }

  mapList.innerHTML = `
    <div class="map-path">
      ${nodes.map((node, idx) => {
        const nodeProgress = progress[idx] || { completed: false, exercisesDone: 0, exerciseResults: [] };
        const configNode = MAP_CONFIG.nodes.find(n => n.id === node.id) || {};
        const nodeColor = node.color || configNode.color || '#facc15';
        const nodeType = node.type || configNode.type || 'mixed';
        const totalLessons = node.lessons || configNode.lessons || 1;
        const isCompleted = nodeProgress.completed || false;
        const isCurrent = idx === firstUnlocked && !isCompleted;
        const unlocked = idx <= firstUnlocked;
        const exercisesDone = nodeProgress.exercisesDone || 0;
        const totalExercises = (node.exercises && node.exercises.length) || node.totalExercises || 0;

        const nodeSvg = createNodeSVG(node, nodeProgress);

        // Posición en zigzag estilo Duolingo (offset horizontal alternante + ondulación)
        const zigzagPattern = [0, 1, 2, 1, 0, -1, -2, -1];
        const offsetUnit = zigzagPattern[idx % zigzagPattern.length];
        const horizontalOffset = offsetUnit * 46; // px de desplazamiento lateral

        // Determinar color del icono (sólido)
        let iconColor = '#475569'; // gris por defecto (bloqueado)
        if (isCompleted) iconColor = '#4ade80';
        else if (isCurrent) iconColor = nodeColor;
        else if (unlocked) iconColor = nodeColor + '99'; // con opacidad

        // Calcular color del borde de la tarjeta
        let cardBorderColor = '#1e293b';
        if (isCompleted) cardBorderColor = '#4ade8040';
        else if (isCurrent) cardBorderColor = nodeColor + '60';
        else if (unlocked && exercisesDone > 0) cardBorderColor = nodeColor + '30';

        // Tipo de ejercicio
        const typeLabel = nodeType === 'story' ? 'Lectura' :
                          totalLessons > 1 ? `${totalLessons} lecciones` :
                          `${totalExercises} ejercicios`;

        // Mini dots de lecciones
        let lessonsDots = '';
        if (totalLessons > 1) {
          lessonsDots = `
            <div class="node-lessons-row">
              ${Array.from({length: totalLessons}, (_, i) => {
                const lessonStart = i * (node.exercisesPerLesson || 1);
                const lessonEnd = Math.min((i + 1) * (node.exercisesPerLesson || 1), totalExercises);
                const results = nodeProgress.exerciseResults || [];
                const lessonDone = results.slice(lessonStart, lessonEnd).filter(r => r).length;
                const lessonTotal = lessonEnd - lessonStart;
                const lessonCompleted = lessonDone >= lessonTotal && lessonTotal > 0;
                return `
                  <div class="node-lesson-dot ${lessonCompleted ? 'done' : lessonDone > 0 ? 'progress' : ''}"
                       style="${lessonCompleted ? 'background:#4ade80;box-shadow:0 0 6px #4ade8060;' :
                              lessonDone > 0 ? 'background:' + nodeColor + ';box-shadow:0 0 6px ' + nodeColor + '40;' : ''}">
                  </div>`;
              }).join('')}
            </div>`;
        }

        const nodeTitle = nodeType === 'story' ? '📖 Historia ' + node.id :
              totalLessons > 1 ? 'Lecciones ' + node.id :
              'Ejercicios ' + node.id;

        return `
          <div class="map-node-wrapper ${!unlocked ? 'locked' : ''} ${isCurrent ? 'is-current' : ''}"
               style="--node-offset: ${horizontalOffset}px; --node-color: ${nodeColor};">

            <!-- Línea conectora tipo sendero -->
            ${idx > 0 ? `<div class="map-connector ${progress[idx-1]?.completed ? 'done' : ''}"></div>` : ''}

            ${isCurrent ? '<div class="current-node-badge">¡EMPIEZA AQUÍ!</div>' : ''}

            <!-- Nodo circular estilo Duolingo -->
            <button type="button"
                 class="map-node-card ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${!unlocked ? 'disabled' : ''}"
                 data-node="${idx}"
                 aria-label="${nodeTitle}"
                 style="border-color: ${cardBorderColor};">

              <span class="map-node-pulse" style="background:${nodeColor};"></span>

              <div class="map-node-svg" style="color: ${iconColor};">
                ${nodeSvg}
              </div>

              <span class="node-status-badge">
                ${isCompleted ? '<span class="node-check">✅</span>' :
                  isCurrent ? '<span class="node-arrow">▶</span>' :
                  unlocked ? '' : '<span class="node-lock">🔒</span>'}
              </span>
            </button>

            <!-- Info debajo del nodo -->
            <div class="map-node-info">
              <span class="map-node-title" style="color: ${iconColor};">${nodeTitle}</span>
              <span class="map-node-meta">${typeLabel}</span>
              ${lessonsDots}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Event listeners
  mapList.querySelectorAll('.map-node-card[data-node]').forEach(card => {
    const nodeIdx = parseInt(card.dataset.node);
    card.addEventListener('click', () => {
      if (nodeIdx <= firstUnlocked) {
        callbacks.openNode(nodeIdx);
      } else {
        callbacks.showToast("🔓 Completa el nodo anterior primero");
      }
    });
  });
}

export function getExerciseTypeIcon(type) {
  const icons = {
    "traduccion": "📝",
    "completar": "✏️",
    "seleccionar": "🎯",
    "historia": "📖"
  };
  return icons[type] || "📌";
}

export function getExerciseTypeName(type) {
  const names = {
    "traduccion": "Traducción",
    "completar": "Completar",
    "seleccionar": "Emparejar",
    "historia": "Lectura"
  };
  return names[type] || type;
}