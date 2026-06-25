#!/usr/bin/env python3
# build.py - Script para generar index.html

import os
import sys
from datetime import datetime

def read_file(filepath):
    """Lee un archivo y devuelve su contenido"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo {filepath}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error al leer {filepath}: {e}")
        sys.exit(1)

def build_html(styles, map_js, traduccion_js, completar_js, seleccionar_js, historia_js, corregir_js, historia_preguntas_js):
    """Construye el HTML completo usando reemplazo de marcadores"""
    
    template = '<!DOCTYPE html>\n'
    template += '<html lang="es">\n'
    template += '<head>\n'
    template += '  <meta charset="utf-8" />\n'
    template += '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />\n'
    template += '  <title>English Trainer - Aventura de Traducción</title>\n'
    template += '  <style>\n'
    template += '__STYLES__\n'
    template += '  </style>\n'
    template += '</head>\n'
    template += '<body>\n'
    template += '<div class="cloud cloud1"></div><div class="cloud cloud2"></div><div class="cloud cloud3"></div>\n'
    template += '<div class="star" style="top: 8%; left: 85%;">⭐</div>\n'
    template += '<div class="star" style="top: 22%; left: 5%;">✨</div>\n'
    template += '<div class="star" style="bottom: 18%; right: 8%;">🌟</div>\n'
    template += '\n'
    template += '<div class="app-container">\n'
    template += '  <div id="loginScreen" class="screen active">\n'
    template += '    <div class="login-card">\n'
    template += '      <div class="badge-fun" style="margin: 0 auto 20px; width: 70px; height: 70px; font-size: 2.5rem;">🐣</div>\n'
    template += '      <h1>English Trainer</h1>\n'
    template += '      <p>Aventura de traducción</p>\n'
    template += '      <input type="text" id="usernameInput" class="username-input" placeholder="Escribe tu nombre de usuario" maxlength="30" autocomplete="off">\n'
    template += '      <button id="loginBtn" class="login-btn">🚀 Comenzar aventura</button>\n'
    template += '      <p style="font-size: 0.75rem; margin-top: 16px; color: #64748b;">Tu progreso se guardará en la nube</p>\n'
    template += '    </div>\n'
    template += '  </div>\n'
    template += '\n'
    template += '  <div id="mainScreen" class="screen">\n'
    template += '    <div class="play-topbar">\n'
    template += '      <div class="brand-mini">\n'
    template += '        <div class="badge-fun">🐣</div>\n'
    template += '        <div>\n'
    template += '          <div class="title-fun">English Trainer</div>\n'
    template += '          <div class="sub-fun">Version 4.0 - Firebase</div>\n'
    template += '        </div>\n'
    template += '      </div>\n'
    template += '      <div style="display: flex; align-items: center; gap: 8px;">\n'
    template += '        <div class="user-info" id="userInfo">\n'
    template += '          <div class="user-avatar" id="userAvatar">👤</div>\n'
    template += '          <span class="user-name" id="userNameDisplay"></span>\n'
    template += '          <button id="logoutBtn" class="logout-btn" title="Cerrar sesión">🚪</button>\n'
    template += '        </div>\n'
    template += '        <button class="menu-btn" id="toggleMenuBtn">☁️</button>\n'
    template += '      </div>\n'
    template += '    </div>\n'
    template += '    \n'
    template += '    <div class="topbar-expand" id="menuExpand">\n'
    template += '      <div class="action-buttons">\n'
    template += '        <button class="fun-btn" id="backToMapBtn">🗺️ Mapa</button>\n'
    template += '        <button class="fun-btn" id="copyReportBtn">📋 Copiar informe</button>\n'
    template += '        <button class="fun-btn" id="replaceListBtn">📥 Nueva tanda</button>\n'
    template += '        <button class="fun-btn danger-btn" id="resetAllBtn">🗑️ Borrar todo</button>\n'
    template += '      </div>\n'
    template += '    </div>\n'
    template += '\n'
    template += '    <div id="importScreen" class="screen active">\n'
    template += '      <div class="magic-card">\n'
    template += '        <h2>📚 ¡Hola <span id="welcomeUsername"></span>!</h2>\n'
    template += '        <p>Ingresa los 6 tipos de datos requeridos:</p>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>📝 Traducciones (71 ejercicios requeridos)</h4>\n'
    template += '          <textarea id="traduccionesInput" class="answer-input" rows="3" placeholder=\'[{"spanishWord": "...", "englishWord": "..."}]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>✏️ Completar palabras (32 ejercicios requeridos)</h4>\n'
    template += '          <textarea id="completarInput" class="answer-input" rows="3" placeholder=\'[{"spanishWord": "...", "englishSentence": "There is _____ ...", "options": ["word1", "word2"]}]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>🎯 Seleccionar palabras (13 ejercicios requeridos)</h4>\n'
    template += '          <textarea id="seleccionarInput" class="answer-input" rows="3" placeholder=\'[[{"englishWord": "...", "spanishWord": "..."}]]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>🔍 Corregir frases (50 ejercicios requeridos)</h4>\n'
    template += '          <textarea id="corregirInput" class="answer-input" rows="3" placeholder=\'[{"fraseConError": "She go to school", "fraseCorrecta": "She goes to school"}]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>📖 Historias de lectura (2 historias requeridas)</h4>\n'
    template += '          <textarea id="historiasInput" class="answer-input" rows="3" placeholder=\'[{"title": "...", "paragraphs": ["..."]}]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="multi-input-section">\n'
    template += '          <h4>🤔 Historias con preguntas (4 ejercicios requeridos)</h4>\n'
    template += '          <textarea id="historiaPreguntasInput" class="answer-input" rows="3" placeholder=\'[{"shortStory": "...", "pregunta1": "...", "pregunta2": "..."}]\'></textarea>\n'
    template += '        </div>\n'
    template += '        \n'
    template += '        <div class="button-group">\n'
    template += '          <button class="btn-action btn-check" id="loadBtn">✨ Construir mapa ✨</button>\n'
    template += '        </div>\n'
    template += '        <p class="sub-fun" style="text-align:center; margin-top: 8px;">⭐ 6 nodos: 2 de historia, 4 de ejercicios mixtos ⭐</p>\n'
    template += '      </div>\n'
    template += '    </div>\n'
    template += '\n'
    template += '    <div id="mapScreen" class="screen">\n'
    template += '      <div class="magic-card">\n'
    template += '        <h2>🗺️ Mapa de la aventura</h2>\n'
    template += '        <div id="mapList" class="adventure-map"></div>\n'
    template += '      </div>\n'
    template += '      <div class="magic-card" style="padding: 14px 18px;">\n'
    template += '        <button class="fun-btn full-width" id="openReportBtn" style="width:100%;">📄 Ver informe completo</button>\n'
    template += '        <textarea id="reportArea" class="report" rows="4" readonly placeholder="Aquí verás tu progreso..." style="display:none;"></textarea>\n'
    template += '        <button class="copy-report-btn" id="copyFinalReportBtn">📋 Copiar reporte final</button>\n'
    template += '      </div>\n'
    template += '    </div>\n'
    template += '\n'
    template += '    <div id="exerciseScreen" class="screen">\n'
    template += '      <div class="exercise-area">\n'
    template += '        <div style="display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;">\n'
    template += '          <span class="pill-status" id="nodeTag">Nodo 1</span>\n'
    template += '          <span class="pill-status" id="exTag">Ejercicio 1/1</span>\n'
    template += '          <span class="pill-status" id="exTypeTag">📝 Traducción</span>\n'
    template += '        </div>\n'
    template += '        <div id="exerciseContainer"></div>\n'
    template += '        <div id="resultLine" class="sub-fun" style="text-align:center;">✏️ Tu turno</div>\n'
    template += '      </div>\n'
    template += '    </div>\n'
    template += '  </div>\n'
    template += '</div>\n'
    template += '\n'
    template += '<div id="toastFun" class="toast-fun"></div>\n'
    template += '<div id="loadingIndicator" class="loading">✨ Conectando...</div>\n'
    template += '\n'
    template += '<script type="module">\n'
    template += '  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";\n'
    template += '  import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";\n'
    template += '\n'
    template += '  const firebaseConfig = {\n'
    template += '    apiKey: "AIzaSyDMkONDffOyVBC4JGccnoLzZIRnsMzTXa4",\n'
    template += '    authDomain: "englishgame-13038.firebaseapp.com",\n'
    template += '    projectId: "englishgame-13038",\n'
    template += '    storageBucket: "englishgame-13038.firebasestorage.app",\n'
    template += '    messagingSenderId: "1035150507706",\n'
    template += '    appId: "1:1035150507706:web:9f30bdf7b5ac5ed5ea4c83"\n'
    template += '  };\n'
    template += '\n'
    template += '  const app = initializeApp(firebaseConfig);\n'
    template += '  const db = getFirestore(app);\n'
    template += '  \n'
    template += '  // ==================== MÓDULO DE MAPA ====================\n'
    template += '__MAP_JS__\n'
    template += '  \n'
    template += '  // ==================== EJERCICIOS ====================\n'
    template += '__TRADUCCION_JS__\n'
    template += '  \n'
    template += '__COMPLETAR_JS__\n'
    template += '  \n'
    template += '__SELECCIONAR_JS__\n'
    template += '  \n'
    template += '__CORREGIR_JS__\n'
    template += '  \n'
    template += '__HISTORIA_JS__\n'
    template += '  \n'
    template += '__HISTORIA_PREGUNTAS_JS__\n'
    template += '  \n'
    template += '  // ==================== LÓGICA PRINCIPAL ====================\n'
    template += '  \n'
    
    js_code = '''
  let currentUser = null;
  let userDocRef = null;
  let unsubscribeSnapshot = null;
  let saveTimeout = null;
  
  const AppState = {
    nodes: [],
    progress: {},
    activeNodeIndex: 0,
    activeExerciseIndex: 0,
    failedExercises: [],
    isSyncing: false,
    reportEntries: []
  };

  function toast(msg) {
    const t = document.getElementById("toastFun");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window._tt);
    window._tt = setTimeout(() => t.classList.remove("show"), 2000);
  }
  
  function showLoading(show, msg = "✨ Guardando...") {
    const loader = document.getElementById("loadingIndicator");
    if(loader) {
      if(show) { loader.textContent = msg; loader.classList.add("show"); }
      else loader.classList.remove("show");
    }
  }

  async function saveToFirebase() {
    if(AppState.isSyncing || !currentUser) return;
    AppState.isSyncing = true;
    try {
      await setDoc(userDocRef, {
        username: currentUser,
        nodes: JSON.stringify(AppState.nodes),
        progress: JSON.stringify(AppState.progress),
        activeNodeIndex: AppState.activeNodeIndex,
        activeExerciseIndex: AppState.activeExerciseIndex,
        reportEntries: JSON.stringify(AppState.reportEntries),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error guardando:", error);
      toast("⚠️ Error al guardar");
    } finally {
      AppState.isSyncing = false;
    }
  }

  async function loadFromFirebase(username) {
    showLoading(true, "🌐 Cargando datos...");
    try {
      const userDoc = doc(db, "english_trainer_users_v4", username);
      const docSnap = await getDoc(userDoc);
      if (docSnap.exists()) {
        const data = docSnap.data();
        AppState.nodes = JSON.parse(data.nodes || '[]');
        AppState.progress = JSON.parse(data.progress || '{}');
        AppState.activeNodeIndex = data.activeNodeIndex || 0;
        AppState.activeExerciseIndex = data.activeExerciseIndex || 0;
        AppState.reportEntries = JSON.parse(data.reportEntries || '[]');
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error cargando:", error);
      return false;
    } finally {
      showLoading(false);
    }
  }

  function setupRealtimeSync() {
    if(unsubscribeSnapshot) unsubscribeSnapshot();
    if(!userDocRef) return;
    
    unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists() && !AppState.isSyncing && currentUser) {
        const data = docSnap.data();
        const remoteNodes = JSON.parse(data.nodes || '[]');
        if (JSON.stringify(remoteNodes) !== JSON.stringify(AppState.nodes)) {
          AppState.nodes = remoteNodes;
          AppState.progress = JSON.parse(data.progress || '{}');
          AppState.activeNodeIndex = data.activeNodeIndex || 0;
          AppState.activeExerciseIndex = data.activeExerciseIndex || 0;
          renderMapView();
        }
      }
    });
  }

  function debounceSave() {
    if(saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveToFirebase(), 800);
  }

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

  function loadAllData() {
    try {
      const traducciones = JSON.parse(document.getElementById("traduccionesInput").value.trim() || '[]');
      const completar = JSON.parse(document.getElementById("completarInput").value.trim() || '[]');
      const seleccionar = JSON.parse(document.getElementById("seleccionarInput").value.trim() || '[]');
      const corregir = JSON.parse(document.getElementById("corregirInput").value.trim() || '[]');
      const historias = JSON.parse(document.getElementById("historiasInput").value.trim() || '[]');
      const historiaPreguntas = JSON.parse(document.getElementById("historiaPreguntasInput").value.trim() || '[]');
      
      const validation = validateInputData({ 
        traducciones, completar, seleccionar, corregir, historias, historiaPreguntas 
      });
      
      if (!validation.valid) {
        toast("❌ " + validation.errors.join(" | "));
        return;
      }
      
      AppState.nodes = createNodeStructure({ 
        traducciones, completar, seleccionar, corregir, historias, historiaPreguntas 
      });
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      
      AppState.nodes.forEach((node, idx) => {
        AppState.progress[idx] = {
          completed: false,
          exercisesDone: 0,
          exerciseResults: []
        };
      });
      
      debounceSave();
      renderMapView();
      showMainView("map");
      toast("🎒 " + AppState.nodes.length + " nodos creados exitosamente");
    } catch(e) {
      toast("❌ JSON inválido: " + e.message);
    }
  }

  function renderMapView() {
    const callbacks = {
      openNode: openNode,
      showToast: toast
    };
    renderMap(AppState.nodes, AppState.progress, callbacks);
  }

  function openNode(nodeIndex) {
    if (!AppState.nodes[nodeIndex]?.exercises?.length) return;
    
    AppState.activeNodeIndex = nodeIndex;
    AppState.activeExerciseIndex = 0;
    AppState.failedExercises = [];
    
    const nodeProgress = AppState.progress[nodeIndex] || { exercisesDone: 0, exerciseResults: [] };
    const results = nodeProgress.exerciseResults || [];
    
    for (let i = 0; i < AppState.nodes[nodeIndex].exercises.length; i++) {
      if (!results[i]) {
        AppState.activeExerciseIndex = i;
        break;
      }
    }
    
    debounceSave();
    renderExercise();
    showMainView("exercise");
    toast("📖 " + (AppState.nodes[nodeIndex].id ? "Nodo " + AppState.nodes[nodeIndex].id : "") + " abierto");
  }

  function renderExercise() {
    const node = AppState.nodes[AppState.activeNodeIndex];
    if (!node?.exercises?.length) {
      showMainView("map");
      return;
    }
    
    const exIndex = AppState.activeExerciseIndex;
    if (exIndex >= node.exercises.length) {
      AppState.progress[AppState.activeNodeIndex].completed = true;
      debounceSave();
      renderMapView();
      showMainView("map");
      burstConfetti();
      toast("🎉 Nodo completado!");
      return;
    }
    
    const exercise = node.exercises[exIndex];
    const container = document.getElementById("exerciseContainer");
    
    document.getElementById("nodeTag").innerHTML = "📌 Nodo " + (node.id || (AppState.activeNodeIndex + 1));
    document.getElementById("exTag").innerHTML = "📝 " + (exIndex + 1) + "/" + node.exercises.length;
    document.getElementById("exTypeTag").innerHTML = getExerciseTypeIcon(exercise.type) + " " + getExerciseTypeName(exercise.type);
    
    const isRetry = AppState.failedExercises.includes(exIndex);
    
    switch(exercise.type) {
      case "traduccion":
        renderTraduccionExercise(exercise, container);
        setupTraduccionListeners(exercise);
        break;
      case "completar":
        renderCompletarExercise(exercise, container, isRetry);
        setupCompletarListeners(exercise);
        break;
      case "seleccionar":
        renderSeleccionarExercise(exercise, container);
        setupSeleccionarListeners(exercise);
        break;
      case "corregir":
        renderCorregirExercise(exercise, container, isRetry);
        setupCorregirListeners(exercise);
        break;
      case "historia":
        renderHistoriaExercise(exercise, container);
        setupHistoriaListeners();
        break;
      case "historia_preguntas":
        renderHistoriaPreguntasExercise(exercise, container);
        setupHistoriaPreguntasListeners();
        break;
    }
    
    document.getElementById("resultLine").innerHTML = isRetry ? "⚠️ Corrección de error" : "✏️ Tu turno";
  }

  function setupTraduccionListeners(exercise) {
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.onclick = () => {
        const answerInput = document.getElementById("answerInput");
        if (!answerInput) return;
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) {
          toast("📝 Escribe algo");
          return;
        }
        
        const doubtInput = document.getElementById("doubtInputTra");
        const duda = doubtInput ? doubtInput.value.trim() : '';
        
        AppState.reportEntries.push(getTraduccionReportEntry(exercise, userAnswer, duda));
        
        showComparativeModal(exercise, userAnswer, () => {
          advanceExercise();
        });
      };
    }
    
    const answerInput = document.getElementById("answerInput");
    if (answerInput) {
      answerInput.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          document.getElementById("checkBtn")?.click();
        }
      };
    }
  }

  function setupCompletarListeners(exercise) {
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.onclick = () => {
        const container = document.getElementById("exerciseContainer");
        const result = checkCompletarAnswers(exercise, container);
        const { allCorrect, userAnswers, results } = result;
        
        const doubtInput = document.getElementById("doubtInputCom");
        const duda = doubtInput ? doubtInput.value.trim() : '';
        
        AppState.reportEntries.push(getCompletarReportEntry(exercise, userAnswers, duda));
        
        showCompletarModal(exercise, results, 
          (success) => {
            advanceExercise();
          },
          () => {
            if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
              AppState.failedExercises.push(AppState.activeExerciseIndex);
            }
            renderExercise();
          }
        );
        
        if (allCorrect) {
          document.getElementById("checkBtn").style.display = "none";
          const continueBtn = document.getElementById("continueBtn");
          if (continueBtn) continueBtn.style.display = "flex";
        }
      };
    }
    
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) {
      continueBtn.onclick = () => {
        advanceExercise();
      };
    }
  }

  function setupSeleccionarListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (container) {
      container.addEventListener("all-matched", () => {
        showSeleccionarCompleteModal(exercise.pairs, () => {
          advanceExercise();
        });
      });
    }
  }

  function setupCorregirListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    
    container.addEventListener("corregir-checked", (e) => {
      const { userAnswer, exercise: ex } = e.detail;
      const result = checkCorregirAnswer(ex, userAnswer);
      
      showCorregirModal(ex, result, userAnswer, 
        () => {
          const doubtInput = document.getElementById("doubtInput");
          const duda = doubtInput ? doubtInput.value.trim() : '';
          AppState.reportEntries.push(getCorregirReportEntry(ex, userAnswer, duda));
          advanceExercise();
        },
        () => {
          if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
            AppState.failedExercises.push(AppState.activeExerciseIndex);
          }
          renderExercise();
        }
      );
      
      if (result.isCorrect) {
        document.getElementById("checkBtn").style.display = "none";
        const continueBtn = document.getElementById("continueBtn");
        if (continueBtn) continueBtn.style.display = "flex";
      }
    });
    
    container.addEventListener("corregir-continue", (e) => {
      const { duda } = e.detail;
      const userAnswer = document.getElementById("answerInput")?.value.trim() || '';
      AppState.reportEntries.push(getCorregirReportEntry(exercise, userAnswer, duda));
      advanceExercise();
    });
  }

  function setupHistoriaListeners() {
    const container = document.getElementById("exerciseContainer");
    if (container) {
      container.addEventListener("story-read", () => {
        advanceExercise();
      });
    }
  }

  function setupHistoriaPreguntasListeners() {
    const container = document.getElementById("exerciseContainer");
    if (container) {
      container.addEventListener("historia-answered", (e) => {
        const { answer1, answer2, duda } = e.detail;
        const exercise = AppState.nodes[AppState.activeNodeIndex].exercises[AppState.activeExerciseIndex];
        
        AppState.reportEntries.push(getHistoriaPreguntasReportEntry(exercise, { answer1, answer2 }, duda));
        
        showHistoriaPreguntasModal(exercise, { answer1, answer2 }, () => {
          advanceExercise();
        });
      });
    }
  }

  function advanceExercise() {
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    
    if (!AppState.progress[AppState.activeNodeIndex]) {
      AppState.progress[AppState.activeNodeIndex] = { completed: false, exercisesDone: 0, exerciseResults: [] };
    }
    
    if (!AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex]) {
      AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex] = true;
      AppState.progress[AppState.activeNodeIndex].exercisesDone = 
        (AppState.progress[AppState.activeNodeIndex].exercisesDone || 0) + 1;
    }
    
    AppState.failedExercises = AppState.failedExercises.filter(i => i !== exIndex);
    
    if (AppState.failedExercises.length > 0) {
      AppState.activeExerciseIndex = AppState.failedExercises[0];
    } else {
      AppState.activeExerciseIndex++;
    }
    
    debounceSave();
    renderExercise();
  }

  function buildReport() {
    let lines = ["📘 INFORME DE APRENDIZAJE\\n" + "=".repeat(50) + "\\n"];
    
    AppState.reportEntries.forEach((entry, idx) => {
      const num = idx + 1;
      
      if (entry.type === "traduccion") {
        lines.push(num + ". [Traducción] " + entry.original);
        lines.push("   ✅ Esperado: " + entry.expected);
        lines.push("   ✏️ Usuario: " + entry.userAnswer);
      } else if (entry.type === "completar") {
        lines.push(num + ". [Completar] " + entry.original);
        lines.push("   ✅ Frase: " + entry.expected);
        lines.push("   ✏️ Respuestas: " + (entry.userAnswers || []).join(", "));
      } else if (entry.type === "corregir") {
        lines.push(num + ". [Corregir]");
        lines.push("   ❌ Frase error: " + entry.original);
        lines.push("   ✅ Correcto: " + entry.expected);
        lines.push("   ✏️ Usuario: " + entry.userAnswer);
      } else if (entry.type === "historia_preguntas") {
        lines.push(num + ". [Comprensión]");
        lines.push("   📖 Historia: " + (entry.story || '').substring(0, 100) + "...");
        lines.push("   1️⃣ " + entry.pregunta1);
        lines.push("   ✏️ " + entry.respuesta1);
        lines.push("   2️⃣ " + entry.pregunta2);
        lines.push("   ✏️ " + entry.respuesta2);
      }
      
      if (entry.duda) {
        lines.push("   💭 Duda del usuario: " + entry.duda);
      }
      
      lines.push("");
    });
    
    if (AppState.reportEntries.length === 0) {
      lines.push("🌟 Intenta algunos ejercicios para ver tu informe");
    }
    
    return lines.join("\\n");
  }

  function copyReport() {
    const report = buildReport();
    const reportArea = document.getElementById("reportArea");
    if (reportArea) {
      reportArea.style.display = "block";
      reportArea.value = report;
    }
    
    navigator.clipboard?.writeText(report).then(() => {
      toast("📋 Informe copiado al portapapeles");
    }).catch(() => {
      toast("📋 Informe generado (copia manualmente)");
    });
  }

  function burstConfetti() {
    for(let i = 0; i < 50; i++) {
      const c = document.createElement("div");
      c.classList.add("confetti");
      c.style.left = Math.random() * 100 + "vw";
      c.style.backgroundColor = "hsl(" + (Math.random() * 360) + ", 70%, 60%)";
      c.style.width = (6 + Math.random() * 10) + "px";
      c.style.height = (10 + Math.random() * 12) + "px";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 1400);
    }
  }

  async function login(username) {
    if(!username || username.trim() === "") {
      toast("Por favor ingresa un nombre");
      return false;
    }
    
    username = username.trim().toLowerCase();
    currentUser = username;
    userDocRef = doc(db, "english_trainer_users_v4", username);
    
    localStorage.setItem("english_trainer_user_v4", username);
    document.getElementById("userNameDisplay").innerText = username;
    document.getElementById("userAvatar").innerHTML = username.charAt(0).toUpperCase();
    document.getElementById("welcomeUsername").innerText = username;
    
    const hasData = await loadFromFirebase(username);
    if (!hasData) {
      AppState.nodes = [];
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.reportEntries = [];
    }
    
    renderMapView();
    setupRealtimeSync();
    
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("mainScreen").classList.add("active");
    showMainView(AppState.nodes.length ? "map" : "import");
    toast("✨ Bienvenido " + username + "!");
    return true;
  }

  function logout() {
    if(unsubscribeSnapshot) unsubscribeSnapshot();
    currentUser = null;
    userDocRef = null;
    localStorage.removeItem("english_trainer_user_v4");
    document.getElementById("loginScreen").classList.add("active");
    document.getElementById("mainScreen").classList.remove("active");
    toast("👋 Sesión cerrada");
  }

  async function resetAll() {
    if(confirm("¿Borrar todo el progreso?")) {
      AppState.nodes = [];
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      await saveToFirebase();
      renderMapView();
      showMainView("import");
      toast("🗑️ Todo borrado");
    }
  }

  function init() {
    const savedUser = localStorage.getItem("english_trainer_user_v4");
    if(savedUser) {
      login(savedUser);
    }
    
    document.getElementById("loginBtn")?.addEventListener("click", () => {
      const username = document.getElementById("usernameInput").value;
      login(username);
    });
    
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
    
    template += js_code
    template += '</script>\n'
    template += '</body>\n'
    template += '</html>'
    
    # Reemplazar los marcadores
    html = template.replace('__STYLES__', styles)
    html = html.replace('__MAP_JS__', map_js)
    html = html.replace('__TRADUCCION_JS__', traduccion_js)
    html = html.replace('__COMPLETAR_JS__', completar_js)
    html = html.replace('__SELECCIONAR_JS__', seleccionar_js)
    html = html.replace('__CORREGIR_JS__', corregir_js)
    html = html.replace('__HISTORIA_JS__', historia_js)
    html = html.replace('__HISTORIA_PREGUNTAS_JS__', historia_preguntas_js)
    
    return html

def main():
    print("🔨 Construyendo English Trainer v4...")
    print("=" * 50)
    
    # Leer todos los componentes
    styles = read_file('styles/main.css')
    map_js = read_file('mapa/map.js')
    traduccion_js = read_file('exercises/traduccion.js')
    completar_js = read_file('exercises/completar.js')
    seleccionar_js = read_file('exercises/seleccionar.js')
    corregir_js = read_file('exercises/corregir.js')
    historia_js = read_file('exercises/historia.js')
    historia_preguntas_js = read_file('exercises/historiaPreguntas.js')
    
    # Construir el HTML
    html = build_html(styles, map_js, traduccion_js, completar_js, seleccionar_js, historia_js, corregir_js, historia_preguntas_js)
    
    # Guardar el archivo
    output_path = 'index.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    file_size = os.path.getsize(output_path)
    print(f"✅ Archivo generado: {output_path}")
    print(f"📦 Tamaño: {file_size:,} bytes")
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    print("🎉 ¡Build completado exitosamente!")
    print(f"🌐 Abre el archivo: index.html")

if __name__ == "__main__":
    main()