# build_template.py
# Template HTML - Cambios poco frecuentes

def get_html_template():
    """Retorna el template HTML completo con marcadores para reemplazar"""
    
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
    template += '          <div class="sub-fun">__VERSION__</div>\n'
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
    template += '        <p>Ingresa los __NUM_TYPES__ tipos de datos requeridos:</p>\n'
    template += '        __IMPORT_FIELDS__\n'
    template += '        <div class="button-group">\n'
    template += '          <button class="btn-action btn-check" id="loadBtn">✨ Construir mapa ✨</button>\n'
    template += '        </div>\n'
    template += '        <p class="sub-fun" style="text-align:center; margin-top: 8px;">⭐ __NUM_NODES__ nodos: __NODE_DESCRIPTION__ ⭐</p>\n'
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
    template += '  const firebaseConfig = __FIREBASE_CONFIG__;\n'
    template += '\n'
    template += '  const app = initializeApp(firebaseConfig);\n'
    template += '  const db = getFirestore(app);\n'
    template += '  \n'
    template += '  // ==================== MÓDULO DE MAPA ====================\n'
    template += '__MAP_JS__\n'
    template += '  \n'
    template += '  // ==================== EJERCICIOS ====================\n'
    # Insertar cada módulo individualmente
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
    template += '__HISTORIAPREGUNTAS_JS__\n'
    template += '  \n'
    template += '__CONVERSACION_JS__\n'
    template += '  \n'
    template += '  // ==================== LÓGICA PRINCIPAL ====================\n'
    template += '__MAIN_LOGIC__\n'
    template += '</script>\n'
    template += '</body>\n'
    template += '</html>'
    
    return template


def get_main_logic():
    """Retorna la lógica principal de la aplicación"""
    
    return '''
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
      const userDoc = doc(db, "__FB_COLLECTION__", username);
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
      
      debounceSave();
      renderMapView();
      showMainView("map");
      toast("🎒 " + AppState.nodes.length + " nodos creados exitosamente");
    } catch(e) {
      toast("❌ JSON inválido: " + e.message);
    }
  }

  function renderMapView() {
    const callbacks = { openNode: openNode, showToast: toast };
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
      if (!results[i]) { AppState.activeExerciseIndex = i; break; }
    }
    
    debounceSave();
    renderExercise();
    showMainView("exercise");
    const node = AppState.nodes[nodeIndex];
    const nodeName = node.type === 'story' ? 'Historia ' + node.id : node.type === 'conversacion' ? 'Conversación' : 'Nodo ' + node.id;
    toast("📖 " + nodeName + " abierto");
  }

  function renderExercise() {
    const node = AppState.nodes[AppState.activeNodeIndex];
    if (!node?.exercises?.length) { showMainView("map"); return; }
    
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
    
    const nodeName = node.type === 'story' ? 'Historia ' + node.id : node.type === 'conversacion' ? 'Conversación' : 'Nodo ' + node.id;
    document.getElementById("nodeTag").innerHTML = "📌 " + nodeName;
    document.getElementById("exTag").innerHTML = "📝 " + (exIndex + 1) + "/" + node.exercises.length;
    document.getElementById("exTypeTag").innerHTML = getExerciseTypeIcon(exercise.type) + " " + getExerciseTypeName(exercise.type);
    
    const isRetry = AppState.failedExercises.includes(exIndex);
    
    switch(exercise.type) {
      case "traduccion": renderTraduccionExercise(exercise, container); setupTraduccionListeners(exercise); break;
      case "completar": renderCompletarExercise(exercise, container, isRetry); setupCompletarListeners(exercise); break;
      case "seleccionar": renderSeleccionarExercise(exercise, container); setupSeleccionarListeners(exercise); break;
      case "corregir": renderCorregirExercise(exercise, container, isRetry); setupCorregirListeners(exercise); break;
      case "historia": renderHistoriaExercise(exercise, container); setupHistoriaListeners(); break;
      case "historia_preguntas": renderHistoriaPreguntasExercise(exercise, container); setupHistoriaPreguntasListeners(); break;
      case "conversacion": renderConversacionExercise(exercise, container); setupConversacionMainListeners(); break;
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
          (success, duda) => { AppState.reportEntries.push(getCompletarReportEntry(exercise, userAnswers, duda)); advanceExercise(); },
          (duda) => { AppState.reportEntries.push(getCompletarReportEntry(exercise, userAnswers, duda)); if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) AppState.failedExercises.push(AppState.activeExerciseIndex); renderExercise(); }
        );
        if (allCorrect) { document.getElementById("checkBtn").style.display = "none"; const cb = document.getElementById("continueBtn"); if (cb) cb.style.display = "flex"; }
      };
    }
    const continueBtn = document.getElementById("continueBtn");
    if (continueBtn) continueBtn.onclick = () => advanceExercise();
  }

  function setupCorregirListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.addEventListener("corregir-checked", (e) => {
      const { userAnswer, exercise: ex } = e.detail;
      const result = checkCorregirAnswer(ex, userAnswer);
      showCorregirModal(ex, result, userAnswer, 
        (duda) => { AppState.reportEntries.push(getCorregirReportEntry(ex, userAnswer, duda)); advanceExercise(); },
        (duda) => { AppState.reportEntries.push(getCorregirReportEntry(ex, userAnswer, duda)); if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) AppState.failedExercises.push(AppState.activeExerciseIndex); renderExercise(); }
      );
      if (result.isCorrect) { document.getElementById("checkBtn").style.display = "none"; const cb = document.getElementById("continueBtn"); if (cb) cb.style.display = "flex"; }
    });
  }

  function setupSeleccionarListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (container) container.addEventListener("all-matched", () => { showSeleccionarCompleteModal(exercise.pairs, () => advanceExercise()); });
  }

  function setupHistoriaListeners() {
    const container = document.getElementById("exerciseContainer");
    if (container) container.addEventListener("story-read", () => advanceExercise());
  }

  function setupHistoriaPreguntasListeners() {
    const container = document.getElementById("exerciseContainer");
    if (container) {
      container.addEventListener("historia-answered", (e) => {
        const { answer1, answer2, duda } = e.detail;
        const exercise = AppState.nodes[AppState.activeNodeIndex].exercises[AppState.activeExerciseIndex];
        AppState.reportEntries.push(getHistoriaPreguntasReportEntry(exercise, { answer1, answer2 }, duda));
        showHistoriaPreguntasModal(exercise, { answer1, answer2 }, () => advanceExercise());
      });
    }
  }

  function setupConversacionMainListeners() {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.addEventListener("conversacion-answer", (e) => { AppState.reportEntries.push(getConversacionReportEntry(e.detail)); });
    container.addEventListener("conversacion-completed", () => advanceExercise());
  }

  function advanceExercise() {
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
    debounceSave();
    renderExercise();
  }

  function buildReport() {
    let lines = ["📘 INFORME DE APRENDIZAJE\\n" + "=".repeat(50) + "\\n"];
    AppState.reportEntries.forEach((entry, idx) => {
      const num = idx + 1;
      if (entry.type === "traduccion") { lines.push(num + ". [Traducción] " + entry.original); lines.push("   ✅ Esperado: " + entry.expected); lines.push("   ✏️ Usuario: " + entry.userAnswer); }
      else if (entry.type === "completar") { lines.push(num + ". [Completar] " + entry.original); lines.push("   ✅ Frase: " + entry.expected); lines.push("   ✏️ Respuestas: " + (entry.userAnswers || []).join(", ")); }
      else if (entry.type === "corregir") { lines.push(num + ". [Corregir]"); lines.push("   ❌ Frase error: " + entry.original); lines.push("   ✅ Correcto: " + entry.expected); lines.push("   ✏️ Usuario: " + entry.userAnswer); }
      else if (entry.type === "historia_preguntas") { lines.push(num + ". [Comprensión]"); lines.push("   📖 Historia: " + (entry.story || '').substring(0, 100) + "..."); lines.push("   1️⃣ " + entry.pregunta1); lines.push("   ✏️ " + entry.respuesta1); lines.push("   2️⃣ " + entry.pregunta2); lines.push("   ✏️ " + entry.respuesta2); }
      else if (entry.type === "conversacion") { lines.push(num + ". [Conversación] Msg " + (entry.messageIndex + 1)); lines.push("   📝 " + (entry.messageText || '').substring(0, 80) + "..."); if (entry.removedWord) { lines.push("   🔤 Falta: " + entry.removedWord); lines.push("   ✏️ Usuario: " + entry.userAnswer); } if (entry.selectedOption !== undefined) lines.push("   🎧 Opción: " + (entry.selectedOption + 1) + "/3"); }
      if (entry.duda) lines.push("   💭 Consulta: " + entry.duda);
      lines.push("");
    });
    if (AppState.reportEntries.length === 0) lines.push("🌟 Intenta algunos ejercicios para ver tu informe");
    return lines.join("\\n");
  }

  function copyReport() {
    const report = buildReport();
    const reportArea = document.getElementById("reportArea");
    if (reportArea) { reportArea.style.display = "block"; reportArea.value = report; }
    navigator.clipboard?.writeText(report).then(() => toast("📋 Informe copiado al portapapeles")).catch(() => toast("📋 Informe generado (copia manualmente)"));
  }

  function burstConfetti() {
    for(let i = 0; i < 50; i++) {
      const c = document.createElement("div"); c.classList.add("confetti");
      c.style.left = Math.random() * 100 + "vw"; c.style.backgroundColor = "hsl(" + (Math.random() * 360) + ", 70%, 60%)";
      c.style.width = (6 + Math.random() * 10) + "px"; c.style.height = (10 + Math.random() * 12) + "px";
      document.body.appendChild(c); setTimeout(() => c.remove(), 1400);
    }
  }

  async function login(username) {
    if(!username || username.trim() === "") { toast("Por favor ingresa un nombre"); return false; }
    username = username.trim().toLowerCase();
    currentUser = username;
    userDocRef = doc(db, "__FB_COLLECTION__", username);
    localStorage.setItem("__LS_KEY__", username);
    document.getElementById("userNameDisplay").innerText = username;
    document.getElementById("userAvatar").innerHTML = username.charAt(0).toUpperCase();
    document.getElementById("welcomeUsername").innerText = username;
    const hasData = await loadFromFirebase(username);
    if (!hasData) { AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.reportEntries = []; }
    renderMapView(); setupRealtimeSync();
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("mainScreen").classList.add("active");
    showMainView(AppState.nodes.length ? "map" : "import");
    toast("✨ Bienvenido " + username + "!");
    return true;
  }

  function logout() {
    if(unsubscribeSnapshot) unsubscribeSnapshot();
    currentUser = null; userDocRef = null;
    localStorage.removeItem("__LS_KEY__");
    document.getElementById("loginScreen").classList.add("active");
    document.getElementById("mainScreen").classList.remove("active");
    toast("👋 Sesión cerrada");
  }

  async function resetAll() {
    if(confirm("¿Borrar todo el progreso?")) {
      AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.failedExercises = []; AppState.reportEntries = [];
      await saveToFirebase(); renderMapView(); showMainView("import"); toast("🗑️ Todo borrado");
    }
  }

  function init() {
    const savedUser = localStorage.getItem("__LS_KEY__");
    if(savedUser) login(savedUser);
    document.getElementById("loginBtn")?.addEventListener("click", () => login(document.getElementById("usernameInput").value));
    document.getElementById("usernameInput")?.addEventListener("keypress", (e) => { if(e.key === "Enter") login(document.getElementById("usernameInput").value); });
    document.getElementById("logoutBtn")?.addEventListener("click", logout);
    document.getElementById("loadBtn")?.addEventListener("click", loadAllData);
    document.getElementById("resetAllBtn")?.addEventListener("click", resetAll);
    document.getElementById("replaceListBtn")?.addEventListener("click", () => { showMainView("import"); toast("📥 Ingresa nuevos datos"); });
    document.getElementById("copyReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("copyFinalReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("openReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("backToMapBtn")?.addEventListener("click", () => { renderMapView(); showMainView("map"); });
    document.getElementById("toggleMenuBtn")?.addEventListener("click", () => { document.getElementById("menuExpand").classList.toggle("open"); });
  }
  
  init();
'''