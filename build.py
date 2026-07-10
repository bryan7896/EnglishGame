#!/usr/bin/env python3
# build.py - Script para generar index.html

import os
import sys
from datetime import datetime

# ==================== CONFIGURACIÓN ====================
VERSION = "6.0 - Local Storage"
LS_KEY = "english_trainer_v6"

# Tipos de datos de entrada
INPUT_TYPES = [
    {"id": "traducciones", "label": "📝 Traducciones", "placeholder": '[{"spanishWord": "...", "englishWord": "..."}]'},
    {"id": "completar", "label": "✏️ Completar palabras", "placeholder": '[{"spanishWord": "...", "englishSentence": "... _____ ...", "options": ["word1"]}]'},
    {"id": "seleccionar", "label": "🎯 Seleccionar palabras", "placeholder": '[[{"englishWord": "...", "spanishWord": "..."}]]'},
    {"id": "corregir", "label": "🔍 Corregir frases", "placeholder": '[{"fraseConError": "...", "fraseCorrecta": "..."}]'},
    {"id": "dictado", "label": "🎧 Dictado (frases en inglés)", "placeholder": '["The cat is on the table", "She goes to school every day"]'},
    {"id": "conversacion", "label": "💬 Conversación", "placeholder": '[{"messages":[{"name":"Ana","avatar":"👩","color":"#f472b6","text":"Hello!"}]}]'},
]

# Archivos de ejercicios
EXERCISE_FILES = {
    "exercises/traduccion.js": "__TRADUCCION_JS__",
    "exercises/completar.js": "__COMPLETAR_JS__",
    "exercises/seleccionar.js": "__SELECCIONAR_JS__",
    "exercises/corregir.js": "__CORREGIR_JS__",
    "exercises/dictado.js": "__DICTADO_JS__",
    "exercises/conversacion.js": "__CONVERSACION_JS__",
}


# ==================== FUNCIONES ====================

def read_file(filepath):
    """Lee un archivo y devuelve su contenido"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ No encontrado: {filepath}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error al leer {filepath}: {e}")
        sys.exit(1)


def build_import_fields():
    """Genera los campos de importación dinámicamente"""
    fields = []
    for t in INPUT_TYPES:
        fields.append(f'        <div class="multi-input-section">\n')
        fields.append(f'          <h4>{t["label"]}</h4>\n')
        fields.append(f'          <textarea id="{t["id"]}Input" class="answer-input" rows="3" placeholder=\'{t["placeholder"]}\'></textarea>\n')
        fields.append(f'        </div>\n')
    return ''.join(fields)


def build_load_data_fields():
    """Genera las líneas de carga de datos para el script"""
    lines = []
    for t in INPUT_TYPES:
        lines.append(f'const {t["id"]} = JSON.parse(document.getElementById("{t["id"]}Input").value.trim() || \'[]\');')
    return '\n      '.join(lines)


def build_validation_args():
    """Genera los argumentos de validación"""
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def build_create_node_args():
    """Genera los argumentos para createNodeStructure"""
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def get_html_template():
    """Template HTML completo"""
    return '''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <title>English Trainer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
  <style>__STYLES__</style>
</head>
<body>
<div class="app-container">

  <!-- LOGIN -->
  <div id="loginScreen" class="screen active">
    <div class="login-card">
      <div class="login-logo">EN</div>
      <h1>English Trainer</h1>
      <p>Mejora tu inglés con práctica diaria</p>
      <input type="text" id="usernameInput" class="username-input" placeholder="Nombre de usuario" maxlength="30" autocomplete="off">
      <button id="loginBtn" class="login-btn">Comenzar</button>
    </div>
  </div>

  <!-- MAIN -->
  <div id="mainScreen" class="screen">
    <!-- TOPBAR -->
    <div class="play-topbar">
      <div class="brand-mini">
        <div class="title-fun">English Trainer</div>
        <div class="sub-fun">__VERSION__</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="user-info" id="userInfo">
          <span class="user-name" id="userNameDisplay"></span>
          <button id="logoutBtn" class="logout-btn">Salir</button>
        </div>
        <button class="menu-btn" id="toggleMenuBtn">☰</button>
      </div>
    </div>
    
    <!-- MENU EXPAND -->
    <div class="topbar-expand" id="menuExpand">
      <div class="action-buttons">
        <button class="fun-btn" id="backToMapBtn">🗺️ Mapa</button>
        <button class="fun-btn" id="copyReportBtn">📋 Copiar informe</button>
        <button class="fun-btn" id="replaceListBtn">📥 Nueva tanda</button>
        <button class="fun-btn danger-btn" id="resetAllBtn">🗑️ Borrar todo</button>
      </div>
    </div>

    <!-- IMPORT -->
    <div id="importScreen" class="screen active">
      <div class="magic-card">
        <h2>📚 ¡Hola <span id="welcomeUsername"></span>!</h2>
        <p>Ingresa los datos para cada tipo de ejercicio:</p>
        __IMPORT_FIELDS__
        <div class="button-group">
          <button class="btn-action btn-check" id="loadBtn">✨ Construir mapa</button>
        </div>
      </div>
    </div>

    <!-- MAP -->
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

    <!-- EXERCISE -->
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
  </div>
</div>

<div id="toastFun" class="toast-fun"></div>

<script type="module">
  // ==================== MAPA ====================
  __MAP_JS__

  // ==================== EJERCICIOS ====================
  __TRADUCCION_JS__

  __COMPLETAR_JS__

  __SELECCIONAR_JS__

  __CORREGIR_JS__

  __DICTADO_JS__

  __CONVERSACION_JS__

  // ==================== LÓGICA PRINCIPAL ====================
  __MAIN_LOGIC__
</script>
</body>
</html>'''


def get_main_logic():
    """Lógica principal de la aplicación"""
    return '''
  // ==================== STORAGE ====================
  const STORAGE_KEY = "__LS_KEY__";
  
  function saveToStorage() {
    const data = {
      username: currentUser,
      nodes: AppState.nodes,
      progress: AppState.progress,
      activeNodeIndex: AppState.activeNodeIndex,
      activeExerciseIndex: AppState.activeExerciseIndex,
      reportEntries: AppState.reportEntries,
      lastUpdated: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch(e) {
      console.error("Error guardando:", e);
    }
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
      return AppState.nodes.length > 0;
    } catch(e) {
      console.error("Error cargando:", e);
      return false;
    }
  }

  // ==================== APP STATE ====================
  let currentUser = null;
  
  const AppState = {
    nodes: [],
    progress: {},
    activeNodeIndex: 0,
    activeExerciseIndex: 0,
    failedExercises: [],
    reportEntries: []
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
  
  function debounceSave() {
    clearTimeout(window._saveTimeout);
    window._saveTimeout = setTimeout(() => saveToStorage(), 500);
  }

  // ==================== SCREENS ====================
  const mainScreens = {
    import: document.getElementById("importScreen"),
    map: document.getElementById("mapScreen"),
    exercise: document.getElementById("exerciseScreen")
  };
  
  function showMainView(name) {
    Object.keys(mainScreens).forEach(k => {
      if(mainScreens[k]) mainScreens[k].classList.toggle("active", k === name);
    });
  }

  // ==================== LOAD DATA ====================
  function loadAllData() {
    try {
      __LOAD_DATA_FIELDS__
      
      const validation = validateInputData(__VALIDATION_ARGS__);
      
      if (!validation.valid) {
        toast("❌ " + validation.errors.join(" | "));
        return;
      }
      
      AppState.nodes = createNodeStructure(__CREATE_NODE_ARGS__);
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      
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
      toast("🎒 " + totalEj + " ejercicios en " + AppState.nodes.length + " nodos");
    } catch(e) {
      toast("❌ JSON inválido: " + e.message);
      console.error(e);
    }
  }

  // ==================== MAP ====================
  function renderMapView() {
    renderMap(AppState.nodes, AppState.progress, { openNode, showToast: toast });
  }

  function openNode(nodeIndex) {
    if (!AppState.nodes[nodeIndex]?.exercises?.length) return;
    AppState.activeNodeIndex = nodeIndex;
    AppState.activeExerciseIndex = 0;
    AppState.failedExercises = [];
    
    const prog = AppState.progress[nodeIndex] || { exerciseResults: [] };
    const results = prog.exerciseResults || [];
    for (let i = 0; i < AppState.nodes[nodeIndex].exercises.length; i++) {
      if (!results[i]) { AppState.activeExerciseIndex = i; break; }
    }
    
    saveToStorage();
    renderExercise();
    showMainView("exercise");
  }

  // ==================== EXERCISE ====================
  function renderExercise() {
    const node = AppState.nodes[AppState.activeNodeIndex];
    if (!node?.exercises?.length) { showMainView("map"); return; }
    
    const exIndex = AppState.activeExerciseIndex;
    if (exIndex >= node.exercises.length) {
      AppState.progress[AppState.activeNodeIndex].completed = true;
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
      case "traduccion": renderTraduccionExercise(exercise, container); setupTraduccionListeners(exercise); break;
      case "completar": renderCompletarExercise(exercise, container, isRetry); setupCompletarListeners(exercise); break;
      case "seleccionar": renderSeleccionarExercise(exercise, container); setupSeleccionarListeners(exercise); break;
      case "corregir": renderCorregirExercise(exercise, container, isRetry); setupCorregirListeners(exercise); break;
      case "dictado": renderDictadoExercise(exercise, container); setupDictadoListeners(exercise); break;
      case "conversacion": renderConversacionExercise(exercise, container); setupConversacionMainListeners(); break;
    }
    
    document.getElementById("resultLine").innerHTML = isRetry ? "⚠️ Corrección de error" : "✏️ Tu turno";
  }

  // ==================== LISTENERS ====================
  function setupTraduccionListeners(exercise) {
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.onclick = () => {
        const answerInput = document.getElementById("answerInput");
        if (!answerInput) return;
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) { toast("📝 Escribe algo"); return; }
        showComparativeModal(exercise, userAnswer, (duda) => {
          AppState.reportEntries.push(getTraduccionReportEntry(exercise, userAnswer, duda));
          advanceExercise();
        });
      };
    }
    const answerInput = document.getElementById("answerInput");
    if (answerInput) {
      answerInput.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); document.getElementById("checkBtn")?.click(); } };
    }
  }

  function setupCompletarListeners(exercise) {
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.onclick = () => {
        const container = document.getElementById("exerciseContainer");
        const result = checkCompletarAnswers(exercise, container);
        const { allCorrect, userAnswers, results } = result;
        showCompletarModal(exercise, results, 
          (success, duda) => { 
            AppState.reportEntries.push(getCompletarReportEntry(exercise, userAnswers, duda)); 
            advanceExercise(); 
          },
          (duda) => { 
            AppState.reportEntries.push(getCompletarReportEntry(exercise, userAnswers, duda)); 
            if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
              AppState.failedExercises.push(AppState.activeExerciseIndex);
            }
            renderExercise(); 
          }
        );
        if (allCorrect) { 
          document.getElementById("checkBtn").style.display = "none"; 
          const cb = document.getElementById("continueBtn"); 
          if (cb) cb.style.display = "flex"; 
        }
      };
    }
    const cb = document.getElementById("continueBtn"); 
    if (cb) cb.onclick = () => advanceExercise();
  }

  function setupCorregirListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.addEventListener("corregir-checked", (e) => {
      const { userAnswer, exercise: ex } = e.detail;
      const result = checkCorregirAnswer(ex, userAnswer);
      showCorregirModal(ex, result, userAnswer, 
        (duda) => { 
          AppState.reportEntries.push(getCorregirReportEntry(ex, userAnswer, duda)); 
          advanceExercise(); 
        },
        (duda) => { 
          AppState.reportEntries.push(getCorregirReportEntry(ex, userAnswer, duda)); 
          if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
            AppState.failedExercises.push(AppState.activeExerciseIndex);
          }
          renderExercise(); 
        }
      );
      if (result.isCorrect) { 
        document.getElementById("checkBtn").style.display = "none"; 
        const cb = document.getElementById("continueBtn"); 
        if (cb) cb.style.display = "flex"; 
      }
    });
  }

  function setupSeleccionarListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (container) {
      container.addEventListener("all-matched", () => { 
        showSeleccionarCompleteModal(exercise.pairs, () => advanceExercise()); 
      });
    }
  }

  // En get_main_logic(), reemplazar setupDictadoListeners:
  function setupDictadoListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    
    container.addEventListener("dictado-checked", (e) => {
      const { exercise: ex, userAnswer, result } = e.detail;
      showDictadoModal(ex, result, userAnswer, (duda) => {
        AppState.reportEntries.push(getDictadoReportEntry(ex, userAnswer, duda));
        advanceExercise();
      });
    });
  }

  function setupConversacionMainListeners() {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.addEventListener("conversacion-answer", (e) => { 
      AppState.reportEntries.push(getConversacionReportEntry(e.detail)); 
    });
    container.addEventListener("conversacion-completed", () => advanceExercise());
  }

  // ==================== ADVANCE ====================
  function advanceExercise() {
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    
    if (!AppState.progress[AppState.activeNodeIndex]) {
      AppState.progress[AppState.activeNodeIndex] = { 
        completed: false, 
        exercisesDone: 0, 
        exerciseResults: Array(node.exercises.length).fill(false) 
      };
    }
    
    if (!AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex]) {
      AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex] = true;
      AppState.progress[AppState.activeNodeIndex].exercisesDone = 
        (AppState.progress[AppState.activeNodeIndex].exercisesDone || 0) + 1;
    }
    
    AppState.failedExercises = AppState.failedExercises.filter(i => i !== exIndex);
    AppState.activeExerciseIndex = AppState.failedExercises.length > 0 
      ? AppState.failedExercises[0] 
      : AppState.activeExerciseIndex + 1;
    
    saveToStorage();
    renderExercise();
  }

  // ==================== REPORT ====================
  function buildReport() {
    let lines = [];
    lines.push("📘 INFORME DE APRENDIZAJE");
    lines.push("=".repeat(40));
    lines.push("");
    
    if (AppState.reportEntries.length === 0) {
      lines.push("🌟 Intenta algunos ejercicios para ver tu informe");
      return lines.join("\\n");
    }
    
    // Agrupar por tipo
    const byType = {};
    AppState.reportEntries.forEach(entry => {
      if (!byType[entry.type]) byType[entry.type] = [];
      byType[entry.type].push(entry);
    });
    
    let counter = 0;
    const typeNames = {
      traduccion: "TRADUCCIÓN", completar: "COMPLETAR", seleccionar: "EMPAREJAR",
      corregir: "CORREGIR", dictado: "DICTADO", conversacion: "CONVERSACIÓN"
    };
    
    Object.keys(typeNames).forEach(type => {
      const entries = byType[type] || [];
      if (entries.length === 0) return;
      
      lines.push("📌 " + typeNames[type] + " (" + entries.length + " ejercicios)");
      lines.push("-".repeat(30));
      
      entries.forEach(entry => {
        counter++;
        lines.push(counter + ". " + (entry.type === "dictado" ? "🎧 " : "") + (entry.original || entry.messageText || "").substring(0, 80));
        
        if (entry.type === "traduccion") {
          lines.push("   ✅ Esperado: " + entry.expected);
          lines.push("   ✏️ Usuario: " + entry.userAnswer);
        } else if (entry.type === "completar") {
          lines.push("   ✅ Frase: " + entry.expected);
          lines.push("   ✏️ Respuestas: " + (entry.userAnswers || []).join(", "));
        } else if (entry.type === "corregir") {
          lines.push("   ❌ Error: " + entry.original);
          lines.push("   ✅ Correcto: " + entry.expected);
          lines.push("   ✏️ Usuario: " + entry.userAnswer);
        } else if (entry.type === "dictado") {
          lines.push("   🎧 Correcto: " + entry.original);
          lines.push("   ✏️ Usuario: " + entry.userAnswer);
        } else if (entry.type === "conversacion") {
          if (entry.removedWord) {
            lines.push("   🔤 Falta: " + entry.removedWord);
            lines.push("   ✏️ Usuario: " + entry.userAnswer);
          }
          if (entry.selectedOption !== undefined) {
            lines.push("   🎧 Opción: " + (entry.selectedOption + 1) + "/3");
          }
        }
        
        if (entry.duda) {
          lines.push("   💭 Consulta: " + entry.duda);
        }
        lines.push("");
      });
      lines.push("");
    });
    
    return lines.join("\\n");
  }

  function copyReport() {
    const report = buildReport();
    const reportArea = document.getElementById("reportArea");
    if (reportArea) { 
      reportArea.style.display = "block"; 
      reportArea.value = report; 
    }
    navigator.clipboard?.writeText(report)
      .then(() => toast("📋 Informe copiado al portapapeles"))
      .catch(() => toast("📋 Copia manualmente el informe"));
  }

  // ==================== UTILS ====================
  function burstConfetti() {
    const colors = ["#e50914", "#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff"];
    for(let i = 0; i < 40; i++) {
      const c = document.createElement("div"); 
      c.classList.add("confetti");
      c.style.left = Math.random() * 100 + "vw";
      c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      c.style.width = (5 + Math.random() * 8) + "px";
      c.style.height = (8 + Math.random() * 10) + "px";
      c.style.animationDuration = (1 + Math.random() * 2) + "s";
      document.body.appendChild(c); 
      setTimeout(() => c.remove(), 3000);
    }
  }

  // ==================== AUTH ====================
  function login(username) {
    if(!username || !username.trim()) { 
      toast("Por favor ingresa un nombre"); 
      return false; 
    }
    
    username = username.trim().toLowerCase();
    currentUser = username;
    localStorage.setItem("__LS_KEY___user", username);
    
    document.getElementById("userNameDisplay").innerText = username;
    document.getElementById("welcomeUsername").innerText = username;
    
    const hasData = loadFromStorage(username);
    if (!hasData) {
      AppState.nodes = []; 
      AppState.progress = {}; 
      AppState.activeNodeIndex = 0; 
      AppState.activeExerciseIndex = 0; 
      AppState.reportEntries = [];
    }
    
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
    toast("👋 Sesión cerrada");
  }

  async function resetAll() {
    if(confirm("¿Borrar todo el progreso? Esta acción no se puede deshacer.")) {
      AppState.nodes = []; 
      AppState.progress = {}; 
      AppState.activeNodeIndex = 0; 
      AppState.activeExerciseIndex = 0; 
      AppState.failedExercises = []; 
      AppState.reportEntries = [];
      saveToStorage(); 
      renderMapView(); 
      showMainView("import"); 
      toast("🗑️ Todo borrado");
    }
  }

  // ==================== INIT ====================
  function init() {
    const savedUser = localStorage.getItem("__LS_KEY___user");
    if(savedUser) login(savedUser);
    
    document.getElementById("loginBtn")?.addEventListener("click", () => 
      login(document.getElementById("usernameInput").value)
    );
    document.getElementById("usernameInput")?.addEventListener("keypress", (e) => { 
      if(e.key === "Enter") login(document.getElementById("usernameInput").value); 
    });
    
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("loadBtn")?.addEventListener("click", loadAllData);
    document.getElementById("resetAllBtn")?.addEventListener("click", resetAll);
    document.getElementById("replaceListBtn")?.addEventListener("click", () => { 
      showMainView("import"); 
      toast("📥 Ingresa nuevos datos"); 
    });
    document.getElementById("copyReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("copyFinalReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("openReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("backToMapBtn")?.addEventListener("click", () => { 
      renderMapView(); 
      showMainView("map"); 
    });
    document.getElementById("toggleMenuBtn")?.addEventListener("click", () => { 
      document.getElementById("menuExpand").classList.toggle("open"); 
    });
  }
  
  init();
'''


def build_html():
    """Construye el HTML completo"""
    print("📂 Leyendo archivos...")
    
    styles = read_file('styles/main.css')
    map_js = read_file('mapa/map.js')
    
    exercise_modules = {}
    for filepath, marker in EXERCISE_FILES.items():
        content = read_file(filepath)
        exercise_modules[marker] = content
        print(f"  ✅ {filepath} -> {marker} ({len(content):,} bytes)")
    
    template = get_html_template()
    
    # Reemplazar marcadores en template
    html = template.replace('__STYLES__', styles)
    html = html.replace('__VERSION__', VERSION)
    html = html.replace('__IMPORT_FIELDS__', build_import_fields())
    html = html.replace('__MAP_JS__', map_js)
    
    for marker, content in exercise_modules.items():
        html = html.replace(marker, content)
    
    # Insertar lógica principal
    main_logic = get_main_logic()
    main_logic = main_logic.replace('__LS_KEY__', LS_KEY)
    main_logic = main_logic.replace('__LOAD_DATA_FIELDS__', build_load_data_fields())
    main_logic = main_logic.replace('__VALIDATION_ARGS__', build_validation_args())
    main_logic = main_logic.replace('__CREATE_NODE_ARGS__', build_create_node_args())
    
    html = html.replace('__MAIN_LOGIC__', main_logic)
    
    # Verificar marcadores sin reemplazar
    remaining = []
    for line in html.split('\n'):
        if '__' in line and '___' not in line and '_____' not in line:
            stripped = line.strip()
            if stripped and not stripped.startswith('//') and not stripped.startswith('/*'):
                remaining.append(stripped[:100])
    
    if remaining:
        print(f"\n⚠️  Quedaron {len(remaining)} marcadores sin reemplazar:")
        for r in remaining[:5]:
            print(f"    {r}")
    
    return html


def main():
    print("=" * 60)
    print("🔨 English Trainer Builder")
    print(f"📦 Versión: {VERSION}")
    print("=" * 60)
    
    # Verificar archivos necesarios
    required_files = ['styles/main.css', 'mapa/map.js'] + list(EXERCISE_FILES.keys())
    missing = [f for f in required_files if not os.path.exists(f)]
    if missing:
        print("❌ Faltan archivos:")
        for f in missing:
            print(f"   - {f}")
        sys.exit(1)
    
    print(f"✅ {len(required_files)} archivos encontrados")
    print()
    
    # Construir HTML
    html = build_html()
    
    # Guardar archivo
    output_path = 'index.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    file_size = os.path.getsize(output_path)
    
    print("\n" + "=" * 60)
    print(f"✅ Archivo generado: {output_path}")
    print(f"📦 Tamaño: {file_size:,} bytes")
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print("🎉 ¡Build completado exitosamente!")
    print(f"\n🌐 Para probar, usa un servidor local:")
    print(f"   python -m http.server 8000")
    print(f"   Luego abre: http://localhost:8000")


if __name__ == "__main__":
    main()