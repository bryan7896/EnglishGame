#!/usr/bin/env python3
# build.py - Script para generar index.html (con PWA)

import os
import sys
import json
from datetime import datetime

# ==================== CONFIGURACIÓN ====================
VERSION = "9.4 (24-08-2026)"
LS_KEY = "english_trainer_v6"

ICON_URL = "https://cdn-icons-png.flaticon.com/512/3898/3898082.png"

INPUT_TYPES = [
    {"id": "traducciones", "label": "📝 Traducciones (opcional)", "placeholder": '[{"spanishWord": "...", "englishWord": "..."}]'},
    {"id": "completar", "label": "✏️ Completar palabras (opcional)", "placeholder": '[{"spanishWord": "...", "englishSentence": "... _____ ...", "options": ["word1"]}]'},
    {"id": "seleccionar", "label": "🎯 Seleccionar palabras (opcional)", "placeholder": '[[{"englishWord": "...", "spanishWord": "..."}]]'},
    {"id": "corregir", "label": "🔍 Corregir frases (opcional)", "placeholder": '[{"fraseConError": "...", "fraseCorrecta": "..."}]'},
    {"id": "dictado", "label": "🎧 Dictado - frases en inglés (opcional)", "placeholder": '["The cat is on the table", "She goes to school every day"]'},
    {"id": "informacion", "label": "💡 Práctica inicial (opcional)", "placeholder": '[{"titulo": "...", "introduccion": "...", "ejercicio1": {"subtitulo": "...", "preguntas": [{"texto": "...", "opciones": [{"texto": "...", "correcta": true, "explicacion": "..."}]}]}, "ejercicio2": {"subtitulo": "...", "banco": ["..."], "frases": [{"texto": "... ___ ...", "respuesta": "..."}]}, "ejercicio3": {"subtitulo": "...", "explicacion": "...", "traducciones": [{"spanishWord": "...", "englishWord": "..."}]}}]'},
]

EXERCISE_FILES = {
    # idioma.js y contracciones.js van primero: definen helpers compartidos
    # (getTargetLangMeta/toggleTargetLanguage y normalizeContractions/
    # contractionAwareEquals) que usan los demás módulos de ejercicios.
    # informacion.js NO usa contracciones.js a propósito (debe seguir
    # validando de forma estricta, sin tolerar contracciones).
    "exercises/idioma.js": "__IDIOMA_JS__",
    "exercises/contracciones.js": "__CONTRACCIONES_JS__",
    "exercises/traduccion.js": "__TRADUCCION_JS__",
    "exercises/completar.js": "__COMPLETAR_JS__",
    "exercises/seleccionar.js": "__SELECCIONAR_JS__",
    "exercises/corregir.js": "__CORREGIR_JS__",
    "exercises/dictado.js": "__DICTADO_JS__",
    "exercises/informacion.js": "__INFORMACION_JS__",
}


def read_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ No encontrado: {filepath}")
        sys.exit(1)


def build_import_fields():
    # Un único textarea: se pega el array completo en un solo JSON con las
    # 5 claves (traducciones, completar, seleccionar, corregir, dictado).
    # Cualquier clave ausente se trata como vacía. Junto al textarea va el
    # botón "Copiar prompt", que copia el contenido de prompt.txt (archivo
    # externo y editable, no se genera desde este script) al portapapeles
    # para pegarlo directo en la IA que construye la tanda de ejercicios.
    example = json.dumps({t["id"]: json.loads(t["placeholder"]) for t in INPUT_TYPES}, ensure_ascii=False)
    return (
        '        <div class="multi-input-section">\n'
        '          <div class="import-fields-header">\n'
        '            <h4>📦 Array completo (JSON)</h4>\n'
        '            <button type="button" class="fun-btn" id="copyPromptBtn">📋 Copiar prompt para la IA</button>\n'
        '          </div>\n'
        f'          <textarea id="fullDataInput" class="answer-input" rows="10" placeholder=\'{example}\'></textarea>\n'
        '        </div>\n'
    )


def build_load_data_fields():
    ids = [t["id"] for t in INPUT_TYPES]
    lines = [
        'const __rawFullData = document.getElementById("fullDataInput").value.trim();',
        'const __parsedFullData = __rawFullData ? JSON.parse(__rawFullData) : {};',
    ]
    for _id in ids:
        lines.append(f'const {_id} = __parsedFullData.{_id} || [];')
    return '\n      '.join(lines)


def build_validation_args():
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def build_create_node_args():
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def create_manifest():
    manifest = {
        "name": "English Trainer",
        "short_name": "EnglishTrainer",
        "description": "Mejora tu inglés con práctica diaria",
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": "#0a0a0a",
        "theme_color": "#e50914",
        "orientation": "portrait-primary",
        "icons": [
            {"src": ICON_URL, "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": ICON_URL, "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
        ]
    }
    with open('manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"  ✅ manifest.json creado")


def create_service_worker():
    sw_code = '''// service-worker.js
const CACHE_NAME = 'english-trainer-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './prompt.txt',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap',
  'https://cdn-icons-png.flaticon.com/512/3898/3898082.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
'''
    with open('service-worker.js', 'w', encoding='utf-8') as f:
        f.write(sw_code)
    print(f"  ✅ service-worker.js creado")


def get_html_template():
    return '''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="English Trainer" />
  <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" />
  <link rel="manifest" href="./manifest.json" />
  <title>English Trainer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>__STYLES__</style>
</head>
<body>
<div class="app-container">
  <div id="loginScreen" class="screen active">
    <div class="login-card">
      <div class="login-logo">EN</div>
      <h1>English Trainer</h1>
      <p>Mejora tu inglés con práctica diaria</p>
      <input type="text" id="usernameInput" class="username-input" placeholder="Nombre de usuario" maxlength="30" autocomplete="off">
      <button id="loginBtn" class="login-btn">Comenzar</button>
      <p class="pwa-hint">📱 También funciona sin conexión</p>
    </div>
  </div>

  <div id="mainScreen" class="screen">
    <div class="play-topbar">
      <div class="brand-mini">
        <div class="title-fun">English Trainer</div>
      </div>
      <button class="menu-btn" id="toggleMenuBtn">☰</button>
    </div>

    <div id="importScreen" class="screen active">
      <div class="magic-card">
        <h2>📚 ¡Hola <span id="welcomeUsername"></span>!</h2>
        <p>Pega aquí el JSON completo con tu tanda de ejercicios (usa el botón para copiar el prompt y pedírselo a la IA):</p>
        __IMPORT_FIELDS__
        <div class="button-group">
          <button class="btn-action btn-check" id="loadBtn">✨ Construir mapa</button>
        </div>
      </div>
    </div>

    <div id="mapScreen" class="screen">
      <div class="magic-card">
        <div id="mapList" class="adventure-map"></div>
      </div>
      <div class="magic-card" style="padding:14px 18px;">
        <button class="fun-btn full-width" id="openReportBtn" style="width:100%;">📄 Ver informe completo</button>
        <textarea id="reportArea" class="report" rows="4" readonly style="display:none;"></textarea>
        <button class="copy-report-btn" id="copyFinalReportBtn">📋 Copiar reporte</button>
      </div>
    </div>

    <div id="exerciseScreen" class="screen">
      <div class="exercise-area">
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <span class="pill-status" id="nodeTag">Nodo 1</span>
          <span class="pill-status" id="exTag">Ejercicio 1/1</span>
          <span class="pill-status" id="exTypeTag">📝</span>
        </div>
        <div id="exerciseContainer"></div>
        <div id="resultLine" class="sub-fun" style="text-align:center;">✏️ Tu turno</div>
      </div>
    </div>

    <div id="infoScreen" class="screen">
      <div class="exercise-area info-scroll">
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <span class="pill-status info-pill" id="infoTag">💡 Lección 1/1</span>
        </div>
        <div id="infoContainer"></div>
      </div>
    </div>
  </div>
</div>

<div id="toastFun" class="toast-fun"></div>

<script type="module">
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => console.log('✅ SW registrado:', reg.scope))
        .catch((err) => console.log('⚠️ SW falló:', err));
    });
  }

  __MAP_JS__
  __IDIOMA_JS__
  __CONTRACCIONES_JS__
  __TRADUCCION_JS__
  __COMPLETAR_JS__
  __SELECCIONAR_JS__
  __CORREGIR_JS__
  __DICTADO_JS__
  __INFORMACION_JS__
  __MAIN_LOGIC__
</script>
</body>
</html>'''


def get_main_logic():
    return r'''
  const STORAGE_KEY = "__LS_KEY__";
  
  function saveToStorage() {
    const data = {
      username: currentUser,
      nodes: AppState.nodes,
      progress: AppState.progress,
      activeNodeIndex: AppState.activeNodeIndex,
      activeExerciseIndex: AppState.activeExerciseIndex,
      reportEntries: AppState.reportEntries,
      reviewPool: AppState.reviewPool,
      // "Práctica inicial" vive fuera del array de nodos (ver map.js /
      // createPracticaInicial). Se persiste completa (incluye las
      // lecciones) para que un reload no la pierda; solo el progreso
      // DENTRO de la lección activa se reinicia si hay un reload (es
      // intencional, ver informacion.js).
      practicaInicial: AppState.practicaInicial || null,
      // Se persisten también las respuestas/resultados "de sesión". Antes
      // vivían solo en memoria: si la página se recargaba a mitad de un
      // nodo (muy común en PWA/móvil), se perdían, y al cerrar el nodo los
      // ejercicios fallados ANTES del reload quedaban sin userAnswer
      // registrada — eso hacía que el error mandado al nodo 6 cayera en un
      // fallback incorrecto (mostraba el texto en español en vez del error
      // real del usuario). Persistir esto soluciona ese bug de raíz.
      sessionCorrectness: AppState.sessionCorrectness,
      sessionAnswers: AppState.sessionAnswers,
      lastUpdated: new Date().toISOString()
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  }
  
  function loadFromStorage(username) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.username !== username) return false;
      AppState.nodes = data.nodes || [];
      AppState.progress = data.progress || {};
      AppState.activeNodeIndex = data.activeNodeIndex || 0;
      AppState.activeExerciseIndex = data.activeExerciseIndex || 0;
      AppState.reportEntries = data.reportEntries || [];
      AppState.reviewPool = data.reviewPool || [];
      AppState.sessionCorrectness = data.sessionCorrectness || {};
      AppState.sessionAnswers = data.sessionAnswers || {};
      AppState.practicaInicial = data.practicaInicial || null;
      return AppState.nodes.length > 0;
    } catch(e) { return false; }
  }

  let currentUser = null;
  
  const AppState = {
    nodes: [],
    progress: {},
    activeNodeIndex: 0,
    activeExerciseIndex: 0,
    failedExercises: [],
    reportEntries: [],
    reviewPool: [],
    sessionCorrectness: {},
    sessionAnswers: {},
    practicaInicial: null,
  };

  function toast(msg) {
    const t = document.getElementById("toastFun");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window._tt);
    window._tt = setTimeout(() => t.classList.remove("show"), 2500);
  }
  window._toast = toast;
  
  window._escHTML = function(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  };
  
  function cleanupAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    const exContainer = document.getElementById("exerciseContainer");
    if (exContainer && exContainer._corregirCarouselTimer) {
      clearInterval(exContainer._corregirCarouselTimer);
      exContainer._corregirCarouselTimer = null;
    }
  }
  
  function debounceSave() {
    clearTimeout(window._saveTimeout);
    window._saveTimeout = setTimeout(() => saveToStorage(), 500);
  }

  const mainScreens = {
    import: document.getElementById("importScreen"),
    map: document.getElementById("mapScreen"),
    exercise: document.getElementById("exerciseScreen"),
    info: document.getElementById("infoScreen")
  };
  
  function showMainView(name) {
    Object.keys(mainScreens).forEach(k => {
      if(mainScreens[k]) mainScreens[k].classList.toggle("active", k === name);
    });
  }

  function loadAllData() {
    try {
      __LOAD_DATA_FIELDS__
      
      // Sin validación - todo es opcional
      AppState.nodes = createNodeStructure(__CREATE_NODE_ARGS__);
      AppState.practicaInicial = createPracticaInicial(informacion);
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      AppState.reviewPool = [];
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};
      
      AppState.nodes.forEach((node, idx) => {
        AppState.progress[idx] = {
          completed: false,
          exercisesDone: 0,
          exerciseResults: Array(node.exercises.length).fill(false)
        };
      });
      
      saveToStorage();
      renderMapView();
      showMainView("map");
      const totalEj = AppState.nodes.reduce((sum, n) => sum + n.exercises.length, 0);
      const leccionesCount = AppState.practicaInicial?.lecciones?.length || 0;
      if (totalEj > 0 || leccionesCount > 0) {
        const leccionesMsg = leccionesCount > 0 ? (" + " + leccionesCount + " lección(es) de práctica inicial") : "";
        toast("🎒 " + totalEj + " ejercicios en " + AppState.nodes.length + " nodos" + leccionesMsg);
      } else {
        toast("⚠️ No se encontraron ejercicios. Agrega al menos uno.");
      }
    } catch(e) {
      toast("❌ JSON invalido: " + e.message);
      console.error(e);
    }
  }

  function renderMapView() {
    cleanupAudio();
    renderMap(AppState.nodes, AppState.progress, { openNode, openPracticaInicial, showToast: toast }, AppState.practicaInicial);
  }

  const REPASO_NODE_INDEX = 7;
  const PASS_THRESHOLD = 0.8;

  function refreshRepasoNode() {
    const node = AppState.nodes[REPASO_NODE_INDEX];
    if (!node || node.type !== 'repaso') return;
    node.exercises = AppState.reviewPool.slice();
    node.totalExercises = node.exercises.length;
    AppState.progress[REPASO_NODE_INDEX] = {
      completed: node.exercises.length === 0,
      exercisesDone: 0,
      exerciseResults: Array(node.exercises.length).fill(false)
    };
  }

  // ---- Análisis de diferencia palabra a palabra ----
  // Separa puntuación final (.,!?;:) de una palabra para poder dejarla fuera
  // del hueco de "completar" (así el hueco pide solo la palabra, no la
  // puntuación pegada al final).
  function splitTrailingPunct(word) {
    const m = String(word || "").match(/^(.*?)([.,!?;:]*)$/);
    return { core: m ? m[1] : word, punct: m ? m[2] : "" };
  }

  // Compara la respuesta correcta contra lo que escribió el usuario,
  // palabra por palabra. Solo se considera un "error de 1-2 palabras" (near
  // miss) cuando ambas frases tienen la MISMA cantidad de palabras — si
  // sobran o faltan palabras, el error es estructural y no un simple
  // "me equivoqué en una palabra", así que se trata como error mayor.
  function analyzeWordDiff(correctText, userAnswer) {
    const correctWords = String(correctText || "").trim().split(/\s+/).filter(Boolean);
    const userWords = String(userAnswer || "").trim().split(/\s+/).filter(Boolean);
    if (!correctWords.length || correctWords.length !== userWords.length) {
      return { sameLength: false, diffIndexes: [], correctWords, userWords };
    }
    const diffIndexes = [];
    correctWords.forEach((w, i) => {
      if (normalizeWord(w) !== normalizeWord(userWords[i])) diffIndexes.push(i);
    });
    return { sameLength: true, diffIndexes, correctWords, userWords };
  }

  // Construye un ejercicio de tipo "completar" a partir de la frase correcta
  // y los índices de las 1-2 palabras que el usuario falló, dejando esas
  // palabras como huecos ("_____") y el resto de la frase intacta.
  function buildCompletarFromDiff(spanishPrompt, correctWords, diffIndexes) {
    const options = [];
    const sentenceWords = correctWords.map((w, i) => {
      if (!diffIndexes.includes(i)) return w;
      const { core, punct } = splitTrailingPunct(w);
      options.push(core || w);
      return "___" + punct;
    });
    return {
      type: "completar",
      spanishWord: spanishPrompt || "✏️ Completa la(s) palabra(s) correcta(s):",
      englishSentence: sentenceWords.join(" "),
      options
    };
  }

  // Convierte un ejercicio fallado (de un nodo principal) en la forma en la
  // que debe aparecer dentro del nodo 6 (repaso).
  //
  //  - Si el error del usuario es de 1 o 2 palabras (misma cantidad de
  //    palabras que la frase correcta, pero 1-2 distintas), se convierte en
  //    un ejercicio de "completar" con esas palabras como huecos.
  //  - En cualquier otro caso, Traducción y Corregir se convierten en
  //    ejercicios de tipo "corregir":
  //     · Traducción: "spanishWord/spanishWords" pasa a mostrarse arriba
  //       como "spanishPhrase" (🇪🇸 Frase en español), "englishWord/
  //       englishWords" pasa a ser "fraseCorrecta", y la tarjeta de error
  //       ("fraseConError") muestra lo que el propio usuario escribió mal.
  //     · Corregir: se conserva igual, pero "fraseConError" se reemplaza
  //       por el error que el propio usuario escribió al fallar.
  //    En ambos casos se inicia un historial "wrongAttempts" (máx. 3) con
  //    los intentos fallidos del usuario, para mostrarlos en la tarjeta
  //    rotativa de errores si vuelve a fallar en el nodo 6.
  //  - El resto de tipos (completar, seleccionar, dictado) entran sin
  //    cambios.
  function buildRepasoExercise(ex, userAnswer) {
    if (!ex.__repasoId) {
      AppState._repasoSeq = (AppState._repasoSeq || 0) + 1;
      ex.__repasoId = "rp" + AppState._repasoSeq;
    }
    const cleanAnswer = (userAnswer && userAnswer.trim()) ? userAnswer.trim() : "";

    let converted;
    if (ex.type === "traduccion" || ex.type === "corregir") {
      const spanishPrompt = ex.type === "traduccion"
        ? (ex.spanishWord || ex.spanishWords || "")
        : (ex.spanishPhrase || "");
      const correctText = ex.type === "traduccion"
        ? (ex.englishWord || ex.englishWords || "")
        : (ex.fraseCorrecta || "");

      const diff = cleanAnswer ? analyzeWordDiff(correctText, cleanAnswer) : { sameLength: false, diffIndexes: [] };
      const isNearMiss = diff.sameLength && diff.diffIndexes.length >= 1 && diff.diffIndexes.length <= 2;

      if (isNearMiss) {
        converted = buildCompletarFromDiff(spanishPrompt, diff.correctWords, diff.diffIndexes);
      } else {
        // Nunca cae de vuelta al texto en español: si por algún motivo no
        // hay respuesta del usuario registrada, se usa un texto neutro que
        // no se pueda confundir con la frase en español.
        const errorText = cleanAnswer || "(respuesta no registrada)";
        converted = {
          type: "corregir",
          spanishPhrase: spanishPrompt,
          fraseConError: errorText,
          fraseCorrecta: correctText,
          wrongAttempts: cleanAnswer ? [cleanAnswer] : []
        };
      }
    } else {
      converted = { ...ex };
    }
    converted.__repasoId = ex.__repasoId;
    converted.__originType = ex.type;
    return converted;
  }

  // Marca cada entrada del informe según si sucedió dentro del nodo 6
  // (repaso) o en un nodo principal, para poder agruparlas por separado.
  function tagOrigin(entry) {
    const node = AppState.nodes[AppState.activeNodeIndex];
    entry.origin = (node && node.type === "repaso") ? "repaso" : "main";
    return entry;
  }

  function recordExerciseResult(isCorrect) {
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    AppState.sessionCorrectness[exIndex] = !!isCorrect;

    if (node && node.type === "repaso") {
      const current = node.exercises[exIndex];
      if (!current) return;
      if (isCorrect) {
        // Aprobado de verdad: sale definitivamente de la pool de repaso
        if (current.__repasoId) {
          AppState.reviewPool = AppState.reviewPool.filter(p => p.__repasoId !== current.__repasoId);
        }
      } else {
        // Sigue sin superar el 80%: se reencola al FINAL del nodo 6,
        // refrescando el error con la última respuesta del usuario, hasta
        // que realmente lo apruebe.
        const clone = { ...current };
        const userAnswer = AppState.sessionAnswers[exIndex];
        if (clone.type === "corregir" && userAnswer && userAnswer.trim()) {
          const attempt = userAnswer.trim();
          clone.fraseConError = attempt;
          // Acumula el historial de intentos fallidos (máx. 3, el más
          // reciente al final) para la tarjeta rotativa de errores.
          const history = Array.isArray(current.wrongAttempts) ? current.wrongAttempts.slice() : (current.fraseConError ? [current.fraseConError] : []);
          if (history[history.length - 1] !== attempt) history.push(attempt);
          clone.wrongAttempts = history.slice(-3);
        }
        node.exercises.push(clone);
      }
    }
  }

  // ==================== PRÁCTICA INICIAL ====================
  // Nodo especial, obligatorio, previo al Nodo 1. Vive fuera del array de
  // 6 nodos y NO alimenta el informe de errores (ver informacion.js).
  let practicaLeccionState = null;

  function openPracticaInicial() {
    cleanupAudio();
    const p = AppState.practicaInicial;
    if (!p || p.completed || !p.lecciones?.length) { renderMapView(); showMainView("map"); return; }
    if (p.leccionIndex >= p.lecciones.length) {
      p.completed = true;
      saveToStorage();
      renderMapView();
      showMainView("map");
      return;
    }
    practicaLeccionState = freshLeccionState(p.lecciones[p.leccionIndex]);
    renderPracticaInicialScreen();
    showMainView("info");
  }

  function renderPracticaInicialScreen() {
    const p = AppState.practicaInicial;
    const leccion = p.lecciones[p.leccionIndex];
    const container = document.getElementById("infoContainer");
    // Cada interacción vuelve a renderizar todo el scroll (más simple y
    // robusto que parchear el DOM a mano). Sin esto, cada tap reseteaba el
    // scroll al tope de la lección — muy molesto en ejercicio 2, donde el
    // usuario ya bajó varias líneas.
    const preservedScroll = window.scrollY;
    document.getElementById("infoTag").innerHTML = "💡 Lección " + (p.leccionIndex + 1) + "/" + p.lecciones.length;
    container.innerHTML = renderLeccion(leccion, practicaLeccionState);
    wireLeccion(leccion, container, practicaLeccionState, renderPracticaInicialScreen, () => {
      p.leccionIndex++;
      saveToStorage();
      if (p.leccionIndex >= p.lecciones.length) {
        p.completed = true;
        saveToStorage();
        renderMapView();
        showMainView("map");
        burstConfetti();
        toast("🎉 ¡Práctica inicial completada!");
      } else {
        practicaLeccionState = freshLeccionState(p.lecciones[p.leccionIndex]);
        renderPracticaInicialScreen();
      }
    });
    window.scrollTo(0, preservedScroll);
  }

  function openNode(nodeIndex) {
    cleanupAudio();
    if (!AppState.nodes[nodeIndex]?.exercises?.length) {
      toast(nodeIndex === REPASO_NODE_INDEX ? "🎉 No tienes ejercicios pendientes de repaso" : "📭 Este nodo está vacío");
      return;
    }
    AppState.activeNodeIndex = nodeIndex;
    AppState.activeExerciseIndex = 0;
    AppState.failedExercises = [];
    AppState.sessionCorrectness = {};
    AppState.sessionAnswers = {};
    
    const prog = AppState.progress[nodeIndex] || { exerciseResults: [] };
    const results = prog.exerciseResults || [];
    for (let i = 0; i < AppState.nodes[nodeIndex].exercises.length; i++) {
      if (!results[i]) { AppState.activeExerciseIndex = i; break; }
    }
    
    saveToStorage();
    renderExercise();
    showMainView("exercise");
  }

  function renderExercise() {
    cleanupAudio();
    
    const node = AppState.nodes[AppState.activeNodeIndex];
    if (!node?.exercises?.length) { showMainView("map"); return; }
    
    const exIndex = AppState.activeExerciseIndex;
    if (exIndex >= node.exercises.length) {
      AppState.progress[AppState.activeNodeIndex].completed = true;

      if (node.type !== 'repaso') {
        // El nodo 6 resuelve su propia pool ejercicio a ejercicio (ver
        // recordExerciseResult), así que aquí solo evaluamos nodos principales.
        const total = node.exercises.length;
        let correctCount = 0;
        node.exercises.forEach((ex, i) => { if (AppState.sessionCorrectness[i]) correctCount++; });
        const score = total ? correctCount / total : 1;
        if (score < PASS_THRESHOLD) {
          node.exercises.forEach((ex, i) => {
            if (!AppState.sessionCorrectness[i]) {
              const alreadyQueued = ex.__repasoId && AppState.reviewPool.some(p => p.__repasoId === ex.__repasoId);
              if (!alreadyQueued) {
                AppState.reviewPool.push(buildRepasoExercise(ex, AppState.sessionAnswers[i]));
              }
            }
          });
        }
      }
      refreshRepasoNode();
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};

      saveToStorage();
      renderMapView();
      showMainView("map");
      burstConfetti();
      toast("🎉 Nodo " + (AppState.activeNodeIndex + 1) + " completado!");
      return;
    }
    
    const exercise = node.exercises[exIndex];
    const container = document.getElementById("exerciseContainer");
    
    document.getElementById("nodeTag").innerHTML = "📌 Nodo " + (AppState.activeNodeIndex + 1);
    document.getElementById("exTag").innerHTML = "📝 " + (exIndex + 1) + "/" + node.exercises.length;
    document.getElementById("exTypeTag").innerHTML = getExerciseTypeIcon(exercise.type) + " " + getExerciseTypeName(exercise.type);
    
    const isRetry = AppState.failedExercises.includes(exIndex);
    
    switch(exercise.type) {
      case "traduccion": renderTraduccionExercise(exercise, container); setupTraduccionListeners(exercise, container); break;
      case "completar": renderCompletarExercise(exercise, container, isRetry); setupCompletarListeners(exercise, container); break;
      case "seleccionar": renderSeleccionarExercise(exercise, container); setupSeleccionarListeners(exercise); break;
      case "corregir": renderCorregirExercise(exercise, container, isRetry); setupCorregirListeners(exercise, container); break;
      case "dictado": renderDictadoExercise(exercise, container); setupDictadoListeners(exercise, container); break;
    }
    
    document.getElementById("resultLine").innerHTML = isRetry ? "⚠️ Correccion de error" : "✏️ Tu turno";
  }

  function setupTraduccionListeners(exercise, container) {
    const checkBtn = container.querySelector('.traduccion-check');
    const answerInput = container.querySelector('.traduccion-answer');
    if (checkBtn && answerInput) {
      checkBtn.onclick = () => {
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) { toast("📝 Escribe algo"); return; }
        showComparativeModal(exercise, userAnswer, (duda, passed) => {
          AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
          recordExerciseResult(passed);
          AppState.reportEntries.push(tagOrigin(getTraduccionReportEntry(exercise, userAnswer, duda)));
          advanceExercise();
        });
      };
    }
  }

  function setupCompletarListeners(exercise, container) {
    const checkBtn = container.querySelector('.completar-check');
    if (checkBtn) {
      checkBtn.onclick = () => {
        const result = checkCompletarAnswers(exercise, container);
        const { allCorrect, userAnswers, results } = result;
        showCompletarModal(exercise, results, 
          (success, duda) => { 
            recordExerciseResult(success);
            AppState.reportEntries.push(tagOrigin(getCompletarReportEntry(exercise, userAnswers, duda))); 
            advanceExercise(); 
          },
          (duda) => { 
            if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
              AppState.failedExercises.push(AppState.activeExerciseIndex);
            }
            renderExercise(); 
          }
        );
      };
    }
  }

  function setupCorregirListeners(exercise, container) {
    const checkBtn = container.querySelector('.corregir-check');
    const answerInput = container.querySelector('.corregir-answer');
    if (checkBtn && answerInput) {
      checkBtn.onclick = () => {
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) { toast("📝 Escribe algo"); return; }
        AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
        const result = checkCorregirAnswer(exercise, userAnswer);
        showCorregirModal(exercise, result, userAnswer, 
          (duda) => { recordExerciseResult(result.passed); AppState.reportEntries.push(tagOrigin(getCorregirReportEntry(exercise, userAnswer, duda))); advanceExercise(); },
          (duda) => { AppState.reportEntries.push(tagOrigin(getCorregirReportEntry(exercise, userAnswer, duda))); if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) AppState.failedExercises.push(AppState.activeExerciseIndex); renderExercise(); }
        );
      };
    }
  }

  function setupSeleccionarListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (container) container.addEventListener("all-matched", () => { showSeleccionarCompleteModal(exercise.pairs, () => { recordExerciseResult(true); advanceExercise(); }); });
  }

  function setupDictadoListeners(exercise, container) {
    // Guardar referencia en el container para poder removerla después
    if (container._dictadoHandler) {
      container.removeEventListener("dictado-done", container._dictadoHandler);
    }
    
    const handler = function(e) {
      cleanupAudio();
      const { originalText, userAnswer, result, duda } = e.detail;
      AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
      recordExerciseResult(!!result?.passed);
      AppState.reportEntries.push(tagOrigin(getDictadoReportEntry(originalText, userAnswer, duda)));
      advanceExercise();
    };
    
    container._dictadoHandler = handler;
    container.addEventListener("dictado-done", handler);
  }

  function advanceExercise() {
    cleanupAudio();
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    if (!AppState.progress[AppState.activeNodeIndex]) {
      AppState.progress[AppState.activeNodeIndex] = { completed: false, exercisesDone: 0, exerciseResults: Array(node.exercises.length).fill(false) };
    }
    if (!AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex]) {
      AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex] = true;
      AppState.progress[AppState.activeNodeIndex].exercisesDone = (AppState.progress[AppState.activeNodeIndex].exercisesDone || 0) + 1;
    }
    AppState.failedExercises = AppState.failedExercises.filter(i => i !== exIndex);
    AppState.activeExerciseIndex = AppState.failedExercises.length > 0 ? AppState.failedExercises[0] : AppState.activeExerciseIndex + 1;
    saveToStorage();
    renderExercise();
  }

  // Formatea una sola entrada del informe (usado tanto en las secciones
  // por tipo como en la sección de repaso).
  function formatReportEntryLines(counter, entry) {
    const lines = [];
    lines.push(counter + ". " + (entry.original || entry.messageText || "").substring(0, 80));
    if (entry.type === "traduccion") { 
      lines.push("   ✅ Esperado: " + entry.expected); 
      lines.push("   ✏️ Usuario: " + entry.userAnswer); 
    }
    else if (entry.type === "completar") { 
      lines.push("   ✅ Frase: " + entry.expected); 
      lines.push("   ✏️ Respuestas: " + (entry.userAnswers || []).join(", ")); 
    }
    else if (entry.type === "corregir") { 
      lines.push("   ❌ Error: " + entry.original); 
      lines.push("   ✅ Correcto: " + entry.expected); 
      lines.push("   ✏️ Usuario: " + entry.userAnswer); 
    }
    else if (entry.type === "dictado") { 
      lines.push("   🎧 Correcto: " + entry.original); 
      lines.push("   ✏️ Usuario: " + entry.userAnswer); 
    }
    if (entry.duda) lines.push("   💭 Consulta: " + entry.duda);
    lines.push("");
    return lines;
  }

  function buildReport() {
    let lines = [];
    lines.push("📘 INFORME DE APRENDIZAJE");
    lines.push("=".repeat(40));
    lines.push("");
    
    if (AppState.reportEntries.length === 0) { 
      lines.push("🌟 Intenta algunos ejercicios para ver tu informe"); 
      return lines.join("\n");
    }
    
    // Todo lo ocurrido dentro del nodo 6 (repaso) se separa del resto para
    // que quede claro en el informe que esa parte fue donde el usuario
    // estuvo practicando hasta lograr superar su error.
    const mainEntries = AppState.reportEntries.filter(e => e.origin !== "repaso");
    const repasoEntries = AppState.reportEntries.filter(e => e.origin === "repaso");

    const byType = {};
    mainEntries.forEach(entry => {
      if (!byType[entry.type]) byType[entry.type] = [];
      byType[entry.type].push(entry);
    });
    
    let counter = 0;
    const typeNames = { 
      traduccion:"TRADUCCIÓN", 
      completar:"COMPLETAR", 
      seleccionar:"EMPAREJAR", 
      corregir:"CORREGIR", 
      dictado:"DICTADO" 
    };
    
    Object.keys(typeNames).forEach(type => {
      const entries = byType[type] || [];
      if (entries.length === 0) return;
      lines.push("📌 " + typeNames[type] + " (" + entries.length + " ejercicios)");
      lines.push("-".repeat(30));
      entries.forEach(entry => {
        counter++;
        lines.push(...formatReportEntryLines(counter, entry));
      });
      lines.push("");
    });

    if (repasoEntries.length > 0) {
      lines.push("🔁 SECCIÓN DE REPASO — Practicando hasta superar tus errores");
      lines.push("=".repeat(40));
      lines.push("Aquí queda registrado todo lo ocurrido en el Nodo 6 (repaso),");
      lines.push("donde cada ejercicio fallado se repite hasta que se aprueba de verdad.");
      lines.push("-".repeat(30));
      repasoEntries.forEach(entry => {
        counter++;
        lines.push(...formatReportEntryLines(counter, entry));
      });
      lines.push("");
    }
    
    return lines.join("\n");
  }

  function copyReport() {
    const report = buildReport();
    const reportArea = document.getElementById("reportArea");
    if (reportArea) { reportArea.style.display = "block"; reportArea.value = report; }
    navigator.clipboard?.writeText(report).then(() => toast("📋 Informe copiado")).catch(() => toast("📋 Copia manualmente"));
  }

  // prompt.txt vive como archivo aparte (no se genera desde build.py) para
  // que se pueda editar en cualquier momento sin tener que reconstruir el
  // proyecto. Este botón simplemente lo lee y lo copia al portapapeles.
  async function copyPromptFromFile() {
    try {
      const res = await fetch('./prompt.txt', { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast("📋 Prompt copiado");
    } catch (e) {
      console.error(e);
      toast("❌ No se pudo leer prompt.txt");
    }
  }

  function burstConfetti() {
    const colors = ["#e50914", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"];
    for(let i = 0; i < 40; i++) {
      const c = document.createElement("div"); c.classList.add("confetti");
      c.style.left = Math.random() * 100 + "vw"; c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      c.style.width = (5 + Math.random() * 8) + "px"; c.style.height = (8 + Math.random() * 10) + "px";
      c.style.animationDuration = (1 + Math.random() * 2) + "s";
      document.body.appendChild(c); setTimeout(() => c.remove(), 3000);
    }
  }

  function login(username) {
    if(!username || !username.trim()) { toast("Por favor ingresa un nombre"); return false; }
    username = username.trim().toLowerCase();
    currentUser = username;
    localStorage.setItem("__LS_KEY___user", username);
    document.getElementById("welcomeUsername").innerText = username;
    const hasData = loadFromStorage(username);
    if (!hasData) { AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.reportEntries = []; AppState.practicaInicial = null; }
    renderMapView();
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("mainScreen").classList.add("active");
    showMainView(AppState.nodes.length ? "map" : "import");
    toast("✨ Bienvenido " + username + "!");
    return true;
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem("__LS_KEY___user");
    document.getElementById("loginScreen").classList.add("active");
    document.getElementById("mainScreen").classList.remove("active");
    toast("👋 Sesion cerrada");
  }

  async function resetAll() {
    if(confirm("¿Borrar todo el progreso?")) {
      AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.failedExercises = []; AppState.reportEntries = []; AppState.reviewPool = []; AppState.sessionCorrectness = {}; AppState.sessionAnswers = {}; AppState.practicaInicial = null;
      saveToStorage(); renderMapView(); showMainView("import"); toast("🗑️ Todo borrado");
    }
  }

  // El header quedó reducido a una barra angosta (título + botón ☰). Todo lo
  // que antes vivía ahí (usuario, salir, mapa, copiar informe, nueva tanda,
  // borrar todo) ahora vive en este modal bajo demanda, para no robarle
  // altura permanente a la pantalla.
  // Vuelve a renderizar lo que esté visible en pantalla en este momento,
  // para que las etiquetas/banderas del idioma objetivo se actualicen sin
  // necesidad de recargar ni perder el progreso.
  function refreshCurrentScreenForLanguage() {
    if (document.getElementById("exerciseScreen")?.classList.contains("active")) {
      renderExercise();
    } else if (document.getElementById("infoScreen")?.classList.contains("active")) {
      renderPracticaInicialScreen();
    } else {
      renderMapView();
    }
  }

  function showMenuModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>☰ Menú</h3>
          <button class="menu-modal-close" id="menuModalClose" aria-label="Cerrar">✕</button>
        </div>
        <div class="menu-modal-user">
          <span class="user-name">${window._escHTML(currentUser || '')}</span>
          <button id="menuLogoutBtn" class="logout-btn">Salir</button>
        </div>
        <div class="sub-fun" style="text-align:center;margin-bottom:14px;">__VERSION__</div>
        <div class="action-buttons">
          <button class="fun-btn" id="menuBackToMapBtn">🗺️ Mapa</button>
          <button class="fun-btn" id="menuToggleLangBtn">${getTargetLangMeta().flag} Idioma: ${getTargetLangMeta().label}</button>
          <button class="fun-btn" id="menuVoicePickerBtn">🎙️ Elegir voz</button>
          <button class="fun-btn" id="menuCopyReportBtn">📋 Copiar informe</button>
          <button class="fun-btn" id="menuReplaceListBtn">📥 Nueva tanda</button>
          <button class="fun-btn danger-btn" id="menuResetAllBtn">🗑️ Borrar todo</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#menuModalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#menuLogoutBtn').addEventListener('click', () => { close(); logout(); });
    modal.querySelector('#menuBackToMapBtn').addEventListener('click', () => { close(); renderMapView(); showMainView("map"); });
    modal.querySelector('#menuToggleLangBtn').addEventListener('click', () => {
      toggleTargetLanguage();
      close();
      refreshCurrentScreenForLanguage();
      toast(getTargetLangMeta().flag + " Ahora practicando " + getTargetLangMeta().labelLower);
    });
    modal.querySelector('#menuVoicePickerBtn').addEventListener('click', () => { close(); showVoicePickerModal(); });
    modal.querySelector('#menuCopyReportBtn').addEventListener('click', () => { close(); copyReport(); });
    modal.querySelector('#menuReplaceListBtn').addEventListener('click', () => { close(); showMainView("import"); toast("📥 Ingresa nuevos datos"); });
    modal.querySelector('#menuResetAllBtn').addEventListener('click', () => { close(); resetAll(); });
  }

  // Deja al usuario escuchar ("▶️ Probar") y elegir a mano UNA voz fija
  // para el idioma objetivo actual. Esa elección queda guardada y a partir
  // de ahí gana siempre por sobre la selección automática de
  // dictado.js/seleccionar.js/traduccion.js/corregir.js — es la única
  // forma de garantizar al 100% que nunca suene otra voz distinta a la
  // elegida, sin importar cuántas voces reporte el dispositivo.
  function showVoicePickerModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    window.speechSynthesis?.cancel();

    const langMeta = getTargetLangMeta();
    const voices = listVoicesForLanguage(langMeta.code);
    const currentPreferred = getPreferredVoiceURI(langMeta.code);
    const sampleText = langMeta.code === "it"
      ? "Ciao, come stai? Questo è un esempio di voce."
      : "Hello, how are you? This is a voice sample.";

    const rowStyle = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:#151515;";
    const rowActiveStyle = rowStyle + "border:1px solid #e50914;";

    const autoRow = `
      <div style="${!currentPreferred ? rowActiveStyle : rowStyle}">
        <span>🔀 Automática (recomendado por la app)</span>
        <button type="button" class="fun-btn voice-select-btn" data-voice-uri="" style="white-space:nowrap;">Usar esta</button>
      </div>
    `;
    const voiceRows = voices.map((v) => `
      <div style="${currentPreferred === v.voiceURI ? rowActiveStyle : rowStyle}">
        <span style="overflow:hidden;text-overflow:ellipsis;">${window._escHTML(v.name)} <small style="color:#94a3b8;">(${window._escHTML(v.lang)})</small></span>
        <span style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="fun-btn voice-preview-btn" data-voice-uri="${window._escHTML(v.voiceURI)}">▶️</button>
          <button type="button" class="fun-btn voice-select-btn" data-voice-uri="${window._escHTML(v.voiceURI)}" style="white-space:nowrap;">Usar esta</button>
        </span>
      </div>
    `).join("");

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>🎙️ Voz de ${langMeta.label}</h3>
          <button class="menu-modal-close" id="voicePickerClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:12px;">
          Elige la voz que se usará SIEMPRE para ${langMeta.labelLower} en toda la app.
          Toca ▶️ para escucharla antes de elegir.
        </p>
        ${voices.length === 0 ? `<p style="color:#f59e0b;margin-bottom:10px;">No se encontró ninguna voz de ${langMeta.labelLower} instalada en este dispositivo/navegador todavía. Si acabas de abrir la app, espera unos segundos y vuelve a intentar.</p>` : ""}
        <div>${autoRow}${voiceRows}</div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { window.speechSynthesis?.cancel(); modal.remove(); };
    modal.querySelector("#voicePickerClose").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    modal.querySelectorAll(".voice-preview-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uri = btn.dataset.voiceUri;
        const voice = voices.find((v) => v.voiceURI === uri);
        if (!voice) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sampleText);
        u.lang = langMeta.ttsLang;
        u.voice = voice;
        window.speechSynthesis.speak(u);
      });
    });

    modal.querySelectorAll(".voice-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uri = btn.dataset.voiceUri || null;
        setPreferredVoiceURI(langMeta.code, uri);
        close();
        toast(uri ? "🎙️ Voz guardada — se usará siempre" : "🔀 Volviendo a selección automática");
      });
    });
  }

  function init() {
    const savedUser = localStorage.getItem("__LS_KEY___user");
    if(savedUser) login(savedUser);
    document.getElementById("loginBtn")?.addEventListener("click", () => login(document.getElementById("usernameInput").value));
    document.getElementById("usernameInput")?.addEventListener("keypress", (e) => { if(e.key === "Enter") login(document.getElementById("usernameInput").value); });
    document.getElementById("loadBtn")?.addEventListener("click", loadAllData);
    document.getElementById("copyPromptBtn")?.addEventListener("click", copyPromptFromFile);
    document.getElementById("copyFinalReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("openReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("toggleMenuBtn")?.addEventListener("click", showMenuModal);
  }
  
  init();
'''


def build_html():
    print("📂 Leyendo archivos...")
    styles = read_file('styles/main.css')
    map_js = read_file('mapa/map.js')
    
    exercise_modules = {}
    for filepath, marker in EXERCISE_FILES.items():
        content = read_file(filepath)
        exercise_modules[marker] = content
        print(f"  ✅ {filepath} -> {marker} ({len(content):,} bytes)")
    
    template = get_html_template()
    html = template.replace('__STYLES__', styles)
    html = html.replace('__VERSION__', VERSION)
    html = html.replace('__IMPORT_FIELDS__', build_import_fields())
    html = html.replace('__MAP_JS__', map_js)
    
    for marker, content in exercise_modules.items():
        html = html.replace(marker, content)
    
    main_logic = get_main_logic()
    main_logic = main_logic.replace('__LS_KEY__', LS_KEY)
    main_logic = main_logic.replace('__VERSION__', VERSION)
    main_logic = main_logic.replace('__LOAD_DATA_FIELDS__', build_load_data_fields())
    main_logic = main_logic.replace('__VALIDATION_ARGS__', build_validation_args())
    main_logic = main_logic.replace('__CREATE_NODE_ARGS__', build_create_node_args())
    html = html.replace('__MAIN_LOGIC__', main_logic)
    
    return html


def main():
    print("=" * 60)
    print("🔨 English Trainer Builder (PWA)")
    print(f"📦 Version: {VERSION}")
    print("=" * 60)
    
    required_files = ['styles/main.css', 'mapa/map.js'] + list(EXERCISE_FILES.keys())
    missing = [f for f in required_files if not os.path.exists(f)]
    if missing:
        print("❌ Faltan archivos:")
        for f in missing: print(f"   - {f}")
        sys.exit(1)
    
    print(f"✅ {len(required_files)} archivos encontrados\n")
    print("📱 Creando archivos PWA...")
    create_manifest()
    create_service_worker()
    print()
    
    html = build_html()
    output_path = 'index.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    file_size = os.path.getsize(output_path)
    print("\n" + "=" * 60)
    print(f"✅ Archivo generado: {output_path}")
    print(f"📦 Tamano: {file_size:,} bytes")
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print("🎉 ¡Build PWA completado!")
    print(f"\n📱 Archivos generados:")
    print(f"   - index.html")
    print(f"   - manifest.json")
    print(f"   - service-worker.js")
    print(f"\n🌐 python -m http.server 8000")
    print(f"📲 Abre en Chrome Android y usa 'Agregar a pantalla de inicio'")


if __name__ == "__main__":
    main()