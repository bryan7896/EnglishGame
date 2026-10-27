// ==================== REELS (núcleo) ====================
  // Secuencia infinita de ejercicios a pantalla completa. Reemplaza al mapa:
  // - Banco de estudio de RL_BANCO ejercicios (se rellena con la sorpresa
  //   "elige reglas", nunca solo).
  // - Cada 5-15 tarjetas aparece una sorpresa (reels-sorpresas.js).
  // - "Repasar luego" devuelve el ejercicio 3-8 tarjetas después.
  // - Estado propio por idioma en localStorage (rlKey()).
  const RL_BANCO = 70;
  const RL_VERSION = "reels 19.0";
  const RL_MIN_OBLIGATORIO = 20;              // por debajo de esto, "elige reglas" es obligatoria
  const RL_SORPRESA_MIN = 2, RL_SORPRESA_MAX = 15;
  const RL_MAX_HISTORIAL = 600;
  const RL_REPORTE_MIN = 65, RL_REPORTE_MAX = 70;
  const RL_MIN_POR_REGLA = 5;
  const RL_PARTE_MANUAL = 0.6;               // 30 de cada 50
  const RL_REPASO_MIN = 3, RL_REPASO_MAX = 8; // "Repasar luego": vuelve N tarjetas después
  const RL_MAX_USADOS = 6000;
  const RL_YT_MIN = 3, RL_YT_MAX = 6;          // YouGlish va aparte: cada 3-6 ejercicios (ciclo viejo, ver nota Feature 4 abajo)
  const RL_ESPACIO_MIN = 2, RL_ESPACIO_MAX = 3; // "espacio" (Feature 4): cada 2-3 ejercicios principales se sortea un tipo

  let RL = null;           // estado persistido
  let RLV = { abierto: false, enPantallaCompleta: false, limpiar: null, sync: null, syncListo: false };

  function rlRand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function rlEsc(s) { return window._escHTML(s); }
  function rlKey() { return "english_trainer_reels_v1_" + getTargetLanguage(); }

  function rlNuevo() {
    return {
      v: 1,
      banco: [],          // tarjetas pendientes (ejercicios e info)
      cur: null,          // tarjeta en pantalla (para retomar)
      reserva: [],        // ejercicios manuales en espera
      usados: [],         // ids del banco del sistema ya usados (no repetir)
      cont: {
        sorpresa: 0, proxSorpresa: rlRand(RL_SORPRESA_MIN, RL_SORPRESA_MAX),
        reporte: 0, proxReporte: rlRand(RL_REPORTE_MIN, RL_REPORTE_MAX),
        yt: 0, proxYt: rlRand(RL_YT_MIN, RL_YT_MAX), az: 0,
        // Feature 4: contador/objetivo/nivel del sorteo unificado de "espacio"
        // (listening/azure/irregulares/ordenamiento/youglish/tatoeba).
        espacioCont: 0, espacioN: rlRand(RL_ESPACIO_MIN, RL_ESPACIO_MAX), espacioNivel: 1,
      },
      ultSorpresa: null,
      // Ya NO se refuerza nada en automático: el usuario decide qué cargar
      // desde la pantalla de selección del informe (botón "Completar a 5").
      reporte: { entradas: [], mundo: [], ultimoTexto: "", pendiente: false },
      historias: { usadas: [], activa: null },
      yt: { usadas: [] },
      recientes: [],      // textos en el idioma objetivo de lo último que se hizo (para YouGlish)
      borrador: null,
      historial: [],      // qué tarjeta salió y cuándo (botón "Copiar historia" del menú)     // lo escrito en la tarjeta actual (por si el sistema cierra la app)
      seq: 0,
    };
  }

  function rlCargar() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(rlKey()) || "null"); } catch (e) { d = null; }
    const base = rlNuevo();
    if (!d || d.v !== 1) { RL = base; return; }
    RL = Object.assign(base, d);
    // Ojo: tras Object.assign(base, d), base.cont ya ES d.cont; los valores por
    // defecto salen de un estado nuevo (así una partida vieja recibe yt/proxYt).
    const def = rlNuevo().cont;
    RL.cont = Object.assign({}, def, d.cont || {});
    Object.keys(def).forEach((k) => { if (typeof def[k] === "number" && !Number.isFinite(RL.cont[k])) RL.cont[k] = def[k]; });
    delete RL.cont.ordPend; // ya no se persiste: ordPend ahora es local a cada rlMezclarEnBanco
    RL.reporte = Object.assign(rlNuevo().reporte, d.reporte || {});
    RL.historias = Object.assign(rlNuevo().historias, d.historias || {});
    RL.yt = Object.assign(rlNuevo().yt, d.yt || {});
  }

  function rlGuardar() {
    if (!RL) return;
    if (RL.usados.length > RL_MAX_USADOS) RL.usados = RL.usados.slice(-RL_MAX_USADOS);
    try { localStorage.setItem(rlKey(), JSON.stringify(RL)); }
    catch (e) { toast("⚠️ No se pudo guardar el avance (almacenamiento lleno)"); }
  }

  function rlEstado() { if (!RL) rlCargar(); return RL; }
  function rlUid() { RL.seq = (RL.seq || 0) + 1; return "c" + Date.now().toString(36) + RL.seq; }

  // Inglés no usa dictado (lo cubre Listening); italiano sí.
  function rlTipoPermitido(type) { return !(type === "dictado" && getTargetLanguage() === "en"); }

  function rlContarBanco() { return RL.banco.filter((it) => it.k === "ex").length; }

  // Texto en el idioma objetivo de un ejercicio (para buscar en YouGlish y para distractores).
  function rlTextoObjetivo(ex) {
    if (!ex) return "";
    switch (ex.type) {
      case "traduccion": return ex.englishWord || ex.englishWords || "";
      case "ordenamiento": return ex.englishWord || "";
      case "completar": try { return fillCompletarBlanks(ex.englishSentence || "", ex.options || []); } catch (e) { return ""; }
      case "corregir": return ex.fraseCorrecta || "";
      case "dictado": return ex.text || "";
      case "seleccionar": return (ex.pairs || []).map((p) => p.englishWord).join(" ");
      default: return "";
    }
  }

  // ---------- Mezcla del banco ----------
  // Inserta tarjetas nuevas en posiciones al azar y luego corrige rachas de
  // más de 2 tarjetas seguidas con la misma regla o el mismo tipo.
  function rlClaveRegla(it) { return it.k === "ex" ? ((it.ex.reglaIds || []).slice().sort((a, b) => a - b).join(",") || "-") : "info"; }
  function rlTipo(it) { return it.k === "ex" ? it.ex.type : "info"; }

  function rlCorregirRachas(arr) {
    const malo = (a, i, f) => i >= 2 && f(a[i]) === f(a[i - 1]) && f(a[i]) === f(a[i - 2]);
    for (let pasada = 0; pasada < 3; pasada++) {
      let cambio = false;
      for (let i = 2; i < arr.length; i++) {
        if (arr[i].retry || arr[i].k === "info") continue;
        if (malo(arr, i, rlClaveRegla) || malo(arr, i, rlTipo)) {
          for (let j = i + 1; j < arr.length; j++) {
            if (arr[j].retry || arr[j].k === "info") continue;
            if (rlClaveRegla(arr[j]) !== rlClaveRegla(arr[i]) && rlTipo(arr[j]) !== rlTipo(arr[i])) {
              const t = arr[i]; arr[i] = arr[j]; arr[j] = t; cambio = true; break;
            }
          }
        }
      }
      if (!cambio) break;
    }
    return arr;
  }

  // Inserta `it` en `banco` en una posición al azar (uniforme entre 0 y el
  // largo actual) y devuelve esa posición.
  function rlInsertarAlAzar(banco, it) {
    const pos = Math.floor(Math.random() * (banco.length + 1));
    banco.splice(pos, 0, it);
    return pos;
  }

  // Ordenamiento ya NO se autogenera aquí (Feature 3): solo aparece cuando
  // el sorteo de "espacio" de Feature 4 lo escoge, convirtiendo en el
  // momento una traducción pendiente más adelante en el banco (ver
  // rlConvertirTraduccionAOrdenamiento en reels-sorpresas.js).
  function rlMezclarEnBanco(nuevas, alFrente) {
    const banco = RL.banco.slice();
    shuffleArray(nuevas).forEach((it) => rlInsertarAlAzar(banco, it));
    RL.banco = rlCorregirRachas(banco);
    if (alFrente && alFrente.length) RL.banco = alFrente.concat(RL.banco);
  }

  function rlItemEx(ex, src) { return { k: "ex", uid: rlUid(), ex, src: src || "sys", retry: false }; }

  // ---------- Ordenamiento (Feature 4: "espacio" lo activa, ver reels-sorpresas.js) ----------
  // Candidatas: cualquier tarjeta de traducción TODAVÍA en el banco (no
  // mostrada aún — RL.banco es justo la cola pendiente) cuya frase tenga
  // al menos 3 palabras (si no, buildOrdenamientoFromTraduccion no la
  // puede convertir). Las ya convertidas quedan con type "ordenamiento" y
  // quedan fuera del filtro por su cuenta.
  function rlOrdenamientoCandidatosEnBanco() {
    const out = [];
    RL.banco.forEach((it, idx) => {
      if (it.k !== "ex" || !it.ex || it.ex.type !== "traduccion") return;
      if (tokenizeOrdenamiento(it.ex.englishWord || it.ex.englishWords || "").length >= 3) out.push(idx);
    });
    return out;
  }

  // Convierte EN SU LUGAR (mismo índice del banco) una traducción pendiente
  // elegida al azar a ordenamiento. No inserta ni borra nada: es un efecto
  // de programación invisible (no se muestra nada en el espacio que lo activó).
  // Devuelve true si se pudo convertir, false si no había ninguna candidata.
  function rlConvertirTraduccionAOrdenamiento() {
    const idxs = rlOrdenamientoCandidatosEnBanco();
    if (!idxs.length) return false;
    const idx = idxs[Math.floor(Math.random() * idxs.length)];
    const item = RL.banco[idx];
    const base = buildOrdenamientoFromTraduccion(item.ex);
    if (!base) return false;
    const nuevoEx = Object.assign({}, base, { id: item.ex.id });
    RL.banco[idx] = Object.assign({}, item, { ex: nuevoEx });
    return true;
  }

  // ---------- Toma de ejercicios del banco del sistema ----------
  function rlEjerciciosDeRegla(reglaId) {
    return currentStudyExercises().filter((e) => (e.reglaIds || []).includes(reglaId) && rlTipoPermitido(e.type));
  }

  function rlTomarDeRegla(reglaId, n, yaElegidos) {
    const enBanco = new Set(RL.banco.filter((it) => it.k === "ex").map((it) => it.ex.id).filter(Boolean));
    const usados = new Set(RL.usados);
    const todos = rlEjerciciosDeRegla(reglaId).filter((e) => !enBanco.has(e.id) && !yaElegidos.has(e.id));
    let pool = todos.filter((e) => !usados.has(e.id));
    if (pool.length < n) {
      // Se agotaron: se reciclan los de esta regla.
      const ids = new Set(rlEjerciciosDeRegla(reglaId).map((e) => e.id));
      RL.usados = RL.usados.filter((id) => !ids.has(id));
      const recicl = shuffleArray(todos.filter((e) => !pool.includes(e)));
      pool = pool.concat(recicl);
    } else {
      pool = shuffleArray(pool);
    }
    const take = pool.slice(0, n);
    take.forEach((e) => { yaElegidos.add(e.id); RL.usados.push(e.id); });
    return take.map((e) => JSON.parse(JSON.stringify(e)));
  }

  // Lecciones de "información" de una regla (solo se cargan cuando la regla está en 0%).
  function rlLeccionesDe(reglaId) {
    const por = currentInformacionPorRegla();
    return por[reglaId] || por[String(reglaId)] || [];
  }

  // ---------- Reserva manual ----------
  function rlAgregarManual(parsed) {
    const lista = rawDataToExerciseList(parsed || {});
    let descartados = 0;
    const ok = [];
    lista.forEach((e, i) => {
      if (!rlTipoPermitido(e.type)) { descartados++; return; }
      e.reglaIds = Array.isArray(e.reglaIds) ? e.reglaIds : [];
      e.id = e.id || ("man_" + Date.now().toString(36) + "_" + i);
      ok.push(e);
    });
    rlEstado();
    if (ok.length) rlSumarDia("cargadosManual", ok.length);
    RL.reserva = RL.reserva.concat(shuffleArray(ok));
    // Si el banco está vacío, se usa ya la parte manual (30 de 50).
    if (!rlContarBanco() && RL.reserva.length) {
      const n = Math.min(RL.reserva.length, Math.round(RL_BANCO * RL_PARTE_MANUAL));
      rlMezclarEnBanco(RL.reserva.splice(0, n).map((e) => rlItemEx(e, "man")));
    }
    rlGuardar();
    return { agregados: ok.length, descartados, reserva: RL.reserva.length };
  }

  // ---------- Informe ----------
  function rlRegistrar(item, entrada, passed) {
      if (!entrada) return;
      if (item.ex && item.ex.type === "ordenamiento") return; // no entra al informe
      RL.reporte.entradas.push(Object.assign({}, entrada, {
        rid: rlUid(),
        reglaIds: (item.ex && item.ex.reglaIds) || [],
        src: item.src || "sys",
        retry: !!item.retry,
        passed: !!passed,
        fecha: new Date().toISOString(),
      }));
  }

  function rlGrupoKey(e) { return (e.reglaIds || []).slice().sort((a, b) => a - b).join(",") || "none"; }

  // Todos los grupos (por regla) con al menos 1 ejercicio propio registrado
  // (sin contar los errores corregidos). Los cargados a mano (src "man") NO
  // entran aquí: tienen su propio informe aparte (ver más abajo). Ya NO se
  // filtra por un mínimo: la pantalla de selección del informe (📋 Elige qué
  // entra al informe) es la que decide qué se entrega — el usuario marca lo
  // que quiere, aunque sea una sola regla con un solo ejercicio.
  function rlGruposConDatos() {
      const grupos = {};
      (RL.reporte.entradas || []).filter((e) => e.type !== "ordenamiento" && e.src !== "man").forEach((e) => {
        const k = rlGrupoKey(e);
        (grupos[k] = grupos[k] || { key: k, reglaIds: e.reglaIds || [], ej: [], err: [] });
        (e.retry ? grupos[k].err : grupos[k].ej).push(e);
      });
      return Object.values(grupos).filter((g) => g.ej.length > 0).sort((a, b) => b.ej.length - a.ej.length);
  }

  // ---------- Informe manual (ejercicios cargados a mano) ----------
  // Aparte del informe por reglas gramaticales: junta TODO lo cargado desde
  // la reserva manual (src "man"), sin exigir ningún mínimo por regla, y se
  // entrega de una sola vez cuando ya no queda nada cargado a mano (ni en la
  // reserva ni todavía en el banco esperando turno). Al confirmar la
  // entrega se borra ese registro por completo (no ocupa espacio después).
  function rlManualPendiente() {
      if (RL.reserva.length) return true;
      return RL.banco.some((it) => it.k === "ex" && it.src === "man");
  }

  function rlEntradasManual() {
      return (RL.reporte.entradas || []).filter((e) => e.type !== "ordenamiento" && e.src === "man");
  }

  function rlReporteManualListo() {
      return rlEntradasManual().length > 0 && !rlManualPendiente();
  }

  function rlConstruirReporteManual() {
      const entradas = rlEntradasManual();
      const lines = [];
      const hoy = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
      lines.push("📘 INFORME DE EJERCICIOS MANUALES (" + getTargetLangMeta().label + ")");
      lines.push("📅 " + hoy);
      lines.push("=".repeat(40));
      lines.push("");
      const counter = { n: 0 };
      const ej = entradas.filter((e) => !e.retry);
      const err = entradas.filter((e) => e.retry);
      lines.push("📝 Ejercicios realizados (" + ej.length + ")");
      ej.forEach((e) => { counter.n++; formatReportEntryLines(counter.n, e).forEach((l) => lines.push(l)); });
      if (err.length) {
        lines.push("");
        lines.push("🔧 Errores corregidos (" + err.length + ")");
        err.forEach((e) => { counter.n++; formatReportEntryLines(counter.n, e).forEach((l) => lines.push(l)); });
      }
      const rids = new Set(entradas.map((e) => e.rid));
      return { texto: lines.join("\n"), rids, total: rids.size };
  }

  function rlReporteManualConfirmado(rids) {
      RL.reporte.entradas = RL.reporte.entradas.filter((e) => !rids.has(e.rid));
      rlGuardar();
  }

  // `grupos`: los que el usuario marcó en la pantalla de selección (ver
  // rlRenderReporteSeleccion en reels-sorpresas.js). Ya no se arma solo con
  // los que llegan a RL_MIN_POR_REGLA: es exactamente lo que se seleccionó.
  function rlConstruirReporte(grupos) {
    const seleccionados = grupos || [];
    const lines = [];
    const hoy = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
    lines.push("📘 INFORME DE APRENDIZAJE (" + getTargetLangMeta().label + ")");
    lines.push("📅 " + hoy);
    lines.push("=".repeat(40));
    lines.push("");
    const counter = { n: 0 };
    seleccionados.forEach((g) => {
      lines.push(reglaGroupLabel(g.reglaIds));
      lines.push("-".repeat(30));
      lines.push("  📝 Ejercicios realizados (" + g.ej.length + ")");
      g.ej.forEach((e) => { counter.n++; formatReportEntryLines(counter.n, e).forEach((l) => lines.push(l ? "  " + l : l)); });
      if (g.err.length) {
        lines.push("  🔧 Errores corregidos (" + g.err.length + ")");
        g.err.forEach((e) => { counter.n++; formatReportEntryLines(counter.n, e).forEach((l) => lines.push(l ? "  " + l : l)); });
      }
      lines.push("");
    });
    const aventura = buildAventuraReportLines();
    if (aventura.length) {
      lines.push("🎮 AVENTURA (juego de conversaciones por audio)");
      lines.push("=".repeat(40));
      lines.push(...aventura);
    }
    const rids = new Set();
    seleccionados.forEach((g) => g.ej.concat(g.err).forEach((e) => rids.add(e.rid)));
    return { texto: lines.join("\n"), rids, grupos: seleccionados.length, total: rids.size };
  }

  function rlReporteConfirmado(rids, texto) {
    RL.reporte.entradas = RL.reporte.entradas.filter((e) => !rids.has(e.rid));
    RL.reporte.mundo = [];
    RL.reporte.ultimoTexto = texto;
    RL.reporte.pendiente = false;
    RL.cont.reporte = 0;
    RL.cont.proxReporte = rlRand(RL_REPORTE_MIN, RL_REPORTE_MAX);
    rlGuardar();
  }

  // ---------- Apertura / cierre ----------
  function openReels() {
    rlEstado();
    const ov = document.getElementById("reelsOverlay");
    if (!ov) return;
    ov.hidden = false;
    RLV.abierto = true;
    document.body.classList.add("rl-open");
    document.getElementById("rlHelpBtn").style.display = getTargetLanguage() === "en" ? "flex" : "none";
    // Sin la API de pantalla completa del navegador: Reels ocupa toda la pantalla de la app.
    try { history.pushState({ reels: true }, ""); } catch (e) { /* nada */ }
    document.getElementById("rlStage").innerHTML = "";
    // Los % vienen de la tabla: se piden al abrir; la sorpresa de reglas los espera (máx. 4 s).
    RLV.sync = Promise.race([
      syncLatestPercentagesFromBackend().catch(() => false),
      new Promise((r) => setTimeout(r, 4000)),
    ]).then(() => { RLV.syncListo = true; });
    rlMostrarActual(false);
  }

  function closeReels(desdeEvento) {
    if (!RLV.abierto) return;
    rlGuardarBorrador();
    RLV.abierto = false;
    rlLimpiarTarjeta();
    try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    const ov = document.getElementById("reelsOverlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("rl-open");
    const st = document.getElementById("rlStage");
    if (st) st.innerHTML = "";
    RLV.enPantallaCompleta = false;
    if (desdeEvento !== "popstate" && history.state && history.state.reels) { try { history.back(); } catch (e) { /* nada */ } }
    rlGuardar();
    showMainView("home");
  }

  function rlLimpiarTarjeta() {
    if (typeof RLV.limpiar === "function") { try { RLV.limpiar(); } catch (e) { /* nada */ } }
    RLV.limpiar = null;
  }

  // ---------- Siguiente tarjeta ----------
  // Feature 4 (rewrite): se quitó de aquí la prioridad incondicional de
  // irregulares, el umbral fijo de YouGlish y la cadencia fija de Azure —
  // esos 4 tipos (+ ordenamiento y tatoeba) ahora compiten entre sí en el
  // sorteo de "espacio" (rlEspacioSiToca, reels-sorpresas.js), configurable
  // desde ⚙️ Configurar reels. El ciclo general de abajo (reglas/historia/
  // pct/reporte) es ORTOGONAL a Feature 4 y se deja exactamente como
  // estaba (solo "listening" salió de su lista de candidatos, ver
  // rlElegirSorpresa en reels-sorpresas.js) — en particular la cadencia
  // del informe (RL_REPORTE_MIN/MAX, RL.cont.reporte) sigue intacta.
  function rlDecidirSiguiente() {
    if (!rlContarBanco() && !RL.banco.length) {
      return { k: "sorpresa", tipo: "reglas", uid: rlUid(), forzada: true };
    }
    if (RL.cont.sorpresa >= RL.cont.proxSorpresa) {
      RL.cont.sorpresa = 0;
      RL.cont.proxSorpresa = rlRand(RL_SORPRESA_MIN, RL_SORPRESA_MAX);
      const tipo = rlElegirSorpresa();
      if (tipo) return { k: "sorpresa", tipo, uid: rlUid() };
    }
    const espacio = rlEspacioSiToca();
    if (espacio) return espacio;
    return RL.banco.shift();
  }

  function rlMostrarActual(animar) {
    if (!RL.cur) { RL.cur = rlDecidirSiguiente(); rlAnotar(RL.cur); rlGuardar(); }
    rlRenderTarjeta(RL.cur, animar);
  }

  function rlSiguiente() {
    rlLimpiarTarjeta();
    try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
    RL.cur = null;
    RL.borrador = null;
    rlMostrarActual(true);
  }

  // Termina un ejercicio: cuenta para sorpresas y para el informe (los
  // reintentos también cuentan, si no el informe se retrasaría).
  function rlEjercicioTerminado(item, passed, decision, entrada, respuesta) {
    rlRegistrar(item, entrada, passed);
    if (getTargetLanguage() === "en") rlSumarDia("ingles");
    // Historial (menú ⚙️): desglose por tipo FINAL del ejercicio (si una
    // traducción terminó convertida en ordenamiento por Feature 4, cuenta
    // como "Ordenar", no como "traduccion").
    if (item && item.ex) {
      const tipoHist = { corregir: "corregir", traduccion: "traduccion", completar: "completar", ordenamiento: "ordenar" }[item.ex.type];
      if (tipoHist) rlSumarDia(tipoHist);
    }
    if (typeof irrContarEjercicio === "function") irrContarEjercicio(item);
    RL.cont.sorpresa++;
    RL.cont.reporte++;
    // Feature 4: cuenta para el próximo sorteo de "espacio" cualquier
    // tarjeta principal (todo lo que sale de RL.banco.shift(), incluida
    // una ordenamiento ya convertida — ver rlEspacioSiToca).
    RL.cont.espacioCont = (RL.cont.espacioCont || 0) + 1;
    const txt = rlTextoObjetivo(item.ex);
    if (txt) { RL.recientes.push(txt); if (RL.recientes.length > 40) RL.recientes = RL.recientes.slice(-40); }
    if (decision === "luego") rlReencolar(item, respuesta);
    rlGuardar();
    rlSiguiente();
  }

  function rlReencolar(item, respuesta) {
    let conv;
    try { conv = buildRepasoExercise(JSON.parse(JSON.stringify(item.ex)), respuesta || ""); }
    catch (e) { conv = JSON.parse(JSON.stringify(item.ex)); }
    conv.reglaIds = item.ex.reglaIds || [];
    conv.id = item.ex.id;
    const nuevo = { k: "ex", uid: rlUid(), ex: conv, src: item.src, retry: true };
    const pos = Math.min(RL.banco.length, rlRand(RL_REPASO_MIN, RL_REPASO_MAX) - 1);
    RL.banco.splice(pos, 0, nuevo);
    toast("🧠 Volverá en unos ejercicios");
  }

  // ---------- Render de tarjetas ----------
  function rlRenderTarjeta(item, animar) {
    const stage = document.getElementById("rlStage");
    if (!stage) return;
    const card = document.createElement("div");
    card.className = "rl-card";
    const body = document.createElement("div");
    body.className = "rl-card-body";
    card.appendChild(body);


    if (!item) {
      body.innerHTML = `<div class="rl-empty">📭 No hay nada por ahora.</div>`;
    } else if (item.k === "ex") {
      rlRenderEjercicio(item, body);
    } else if (item.k === "info") {
      rlRenderInfo(item, body);
    } else if (item.k === "sorpresa") {
      rlRenderSorpresa(item, body);
    }

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
    rlRestaurarBorrador(card, item);
  }

  // ---------- Historia de estudio ----------
  const RL_NOMBRE_SORPRESA = { azure: "azure", yt: "youglish", historia: "historia", pct: "porcentajes", reglas: "elegir reglas (agregar ejercicios)", reporte: "reporte", reporteSeleccion: "reporte (elegir)", reporteManual: "reporte manual", listening: "listening", irr: "irregulares", tatoeba: "tatoeba" };
  function rlAnotar(item, nota) {
    if (!RL) return;
    let tipo = "—";
    if (item && item.k === "ex") tipo = (item.ex.type === "traduccion" ? "traduccion" : item.ex.type === "seleccionar" ? "emparejar" : item.ex.type) + (item.retry ? " (repaso)" : "") + (item.src === "man" ? " (tuyo)" : "") + (item.ex.irr ? " (irregulares)" : "");
    else if (item && item.k === "info") tipo = "lección de información";
    else if (item && item.k === "sorpresa") tipo = (RL_NOMBRE_SORPRESA[item.tipo] || item.tipo) + (item.tipo === "irr" ? " (" + item.fase + ")" : "");
    RL.historial = RL.historial || [];
    RL.historial.push({ f: new Date().toISOString(), t: tipo + (nota ? " · " + nota : "") });
    if (RL.historial.length > RL_MAX_HISTORIAL) RL.historial = RL.historial.slice(-RL_MAX_HISTORIAL);
  }

  // ---------- Resumen del día (botón "Copiar historia" del menú) ----------
  // Cuántos ejercicios se hicieron HOY dentro de Reels, por tipo. Es global
  // (no por idioma) y guarda solo los últimos días.
  const RL_DIA_KEY = "english_trainer_reels_dia_v1";
  // Campos por día. "ingles" se conserva por compatibilidad con datos viejos
  // (ya no se usa para el informe: la cifra de "estudio de inglés" del
  // modal de Historial sale de sumar corregir+traduccion+completar+informacion).
  function rlDiaDefault() {
    return {
      ingles: 0, listening: 0, azure: 0, youglish: 0,
      corregir: 0, traduccion: 0, completar: 0, informacion: 0, ordenar: 0, tatoeba: 0,
      irregularesCargados: 0, cargadosManual: 0, cargadosSistema: 0,
      cancionEjercicios: 0, // "Aprender canción": cuenta cada ejercicio resuelto (ver rl2RegistrarCandado en reels2.js)
    };
  }
  function rlHoyStr() { return new Date().toLocaleDateString("en-CA"); }
  function rlAyerStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toLocaleDateString("en-CA");
  }
  function rlSumarDia(campo, n) {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(RL_DIA_KEY) || "{}") || {}; } catch (e) { d = {}; }
    const hoy = rlHoyStr();
    const reg = Object.assign(rlDiaDefault(), d[hoy] || {});
    reg[campo] = (reg[campo] || 0) + (n || 1);
    d[hoy] = reg;
    Object.keys(d).sort().slice(0, -30).forEach((k) => delete d[k]);
    try { localStorage.setItem(RL_DIA_KEY, JSON.stringify(d)); } catch (e) { /* nada */ }
  }
  function rlDiaLeer(fechaStr) {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(RL_DIA_KEY) || "{}") || {}; } catch (e) { d = {}; }
    return Object.assign(rlDiaDefault(), d[fechaStr] || {});
  }

  // ---------- Modal "Historial" (reemplaza el antiguo botón de copiar) ----------
  const RL_MES_ES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  function rlFechaLabel(fechaStr) {
    // fechaStr viene en formato en-CA: "YYYY-MM-DD".
    const partes = String(fechaStr || "").split("-");
    const dia = parseInt(partes[2], 10);
    const mes = RL_MES_ES[parseInt(partes[1], 10) - 1] || "";
    return (Number.isFinite(dia) ? dia : "?") + " - " + mes;
  }
  function rlBloqueReporteDia(fechaStr) {
    const r = rlDiaLeer(fechaStr);
    const ingles = r.corregir + r.traduccion + r.completar + r.informacion;
    const total = ingles + r.ordenar + r.listening + r.azure + r.youglish + r.tatoeba;
    return [
      "Reporte del día " + rlFechaLabel(fechaStr) + ":",
      ingles + " de estudio de inglés",
      "     " + r.corregir + " corregir",
      "     " + r.traduccion + " traduccion",
      "     " + r.completar + " completar",
      "     " + r.informacion + " informacion",
      r.ordenar + " Ordenar",
      r.listening + " de listening",
      r.azure + " de azure",
      r.youglish + " de YouGlish",
      r.tatoeba + " de Tatoeba",
      "---",
      "total: " + total,
      "Aprender canción: " + r.cancionEjercicios,
      "Cargados irregulares: " + r.irregularesCargados,
      "Cargados por json manual: " + r.cargadosManual,
      "Cargados del sistema: " + r.cargadosSistema,
    ].join("\n");
  }

  // ---------- Detalle de "Cargados del sistema" por regla (botón 👁 Ver) ----------
  // No es un conteo diario (como RL_DIA_KEY): es acumulado por idioma, porque
  // el objetivo es informativo — entender de un vistazo por qué el sistema ha
  // ido agregando ejercicios de cada regla gramatical, no solo lo de hoy.
  // Dos motivos posibles:
  //  - "reparto": el usuario eligió esa regla en "Elige qué estudiar" y el
  //    sistema repartió item.sistema entre las reglas elegidas (ver
  //    rlCargarBanco en reels-sorpresas.js).
  //  - "refuerzo": el usuario tocó "➕ Completar a 5" para esa regla en la
  //    pantalla de selección del informe (ver rlCompletarAMinimo en
  //    reels-sorpresas.js) — ya NO ocurre en automático/silencio.
  function rlSistemaKey() { return "english_trainer_reels_sistema_regla_v1_" + getTargetLanguage(); }
  const RL_SISTEMA_MOTIVO_LABEL = { reparto: "elegida en \"Elige qué estudiar\"", refuerzo: "refuerzo para completar el informe" };
  function rlSistemaLeer() {
    try { return JSON.parse(localStorage.getItem(rlSistemaKey()) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function rlSistemaGuardar(d) {
    try { localStorage.setItem(rlSistemaKey(), JSON.stringify(d)); } catch (e) { /* nada */ }
  }
  // La llaman rlCargarBanco y rlCompletarAMinimo (reels-sorpresas.js) cada
  // vez que se agregan ejercicios de una regla al banco (por reparto al
  // elegir qué estudiar, o porque el usuario tocó "Completar a 5").
  function rlSistemaRegistrar(reglaId, motivo, n) {
    if (!reglaId || !n) return;
    const d = rlSistemaLeer();
    d[reglaId] = d[reglaId] || {};
    d[reglaId][motivo] = (d[reglaId][motivo] || 0) + n;
    rlSistemaGuardar(d);
  }
  function rlSistemaResumenHTML() {
    const d = rlSistemaLeer();
    const filas = Object.keys(d).map((id) => {
      const motivos = d[id];
      const total = Object.values(motivos).reduce((s, n) => s + n, 0);
      // localStorage solo guarda claves de objeto como texto: reglaId vuelve
      // como string aquí aunque se haya guardado como número (ver AppRules).
      const regla = (typeof findRegla === "function" && findRegla(Number(id))) || null;
      const nombre = regla ? regla.regla : "Regla #" + id + " (ya no existe)";
      const porMotivo = Object.keys(motivos)
        .map((m) => (RL_SISTEMA_MOTIVO_LABEL[m] || m) + ": " + motivos[m])
        .join(" · ");
      return { id, total, nombre, porMotivo };
    }).sort((a, b) => b.total - a.total);
    if (!filas.length) return `<p class="rl-sub" style="text-align:center;">Todavía no hay ejercicios cargados por el sistema para este idioma.</p>`;
    return `<ul class="rl-sistema-lista">` + filas.map((f) => `
      <li class="rl-sistema-fila">
        <div class="rl-sistema-fila-top"><b>${rlEsc(f.nombre)}</b><span>${f.total} ejercicio${f.total === 1 ? "" : "s"}</span></div>
        <div class="rl-sistema-fila-sub">${rlEsc(f.porMotivo)}</div>
      </li>`).join("") + `</ul>`;
  }
  function rlMostrarSistemaDetalleModal() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>⚙️ Cargados del sistema, por regla</h3>
          <button class="menu-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <p class="rl-sub" style="text-align:center;">Cuántos ejercicios ha agregado el sistema de cada regla gramatical, y por qué (acumulado, no solo de hoy).</p>
        ${rlSistemaResumenHTML()}
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  }

  function rlMostrarHistorialModal() {
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    rlEstado();
    const faltan = Math.max(0, RL.cont.proxReporte - RL.cont.reporte);
    const txtHoy = rlBloqueReporteDia(rlHoyStr());
    const txtAyer = rlBloqueReporteDia(rlAyerStr());
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>📜 Historial</h3>
          <button class="menu-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <pre class="rl-historial-bloque">${rlEsc(txtHoy)}</pre>
        <pre class="rl-historial-bloque">${rlEsc(txtAyer)}</pre>
        <pre class="rl-historial-bloque rl-historial-live">${rlEsc("Banco de reels: " + rlContarBanco() + " ejercicios\nFaltan " + faltan + " para el reporte")}</pre>
        <button class="fun-btn full-width rl-ver-sistema">👁 Ver cargados del sistema por regla</button>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelector(".rl-ver-sistema").onclick = () => rlMostrarSistemaDetalleModal();
  }

  // Alias por compatibilidad con llamadas antiguas al botón de "Copiar historia".
  function rlCopiarHistoria() { rlMostrarHistorialModal(); }

  // ---------- Borradores: lo escrito sobrevive a segundo plano / cierre ----------
  const RL_CAMPOS = "textarea, input[type=text], input:not([type])";
  function rlRestaurarBorrador(card, item) {
    const b = RL.borrador;
    if (!b || !item || b.uid !== item.uid) return;
    setTimeout(() => {
      const campos = Array.from(card.querySelectorAll(RL_CAMPOS)).filter((c) => !c.closest(".rl-json-wrap"));
      (b.valores || []).forEach((v, i) => { if (campos[i] && v && !campos[i].value && !campos[i].disabled) campos[i].value = v; });
    }, 60);
  }
  function rlGuardarBorrador() {
    if (!RL || !RL.cur || !RLV.abierto) return;
    const card = document.querySelector("#rlStage .rl-card:last-child");
    if (!card) return;
    const campos = Array.from(card.querySelectorAll(RL_CAMPOS)).filter((c) => !c.closest(".rl-json-wrap"));
    const valores = campos.map((c) => c.value || "");
    RL.borrador = valores.some(Boolean) ? { uid: RL.cur.uid, valores } : null;
    rlGuardar();
  }

  function rlCabecera(chips) {
    return `<div class="rl-chips">${chips.filter(Boolean).map((c) => `<span class="rl-chip">${c}</span>`).join("")}</div>`;
  }

  function rlRenderEjercicio(item, body, isRetryLocal) {
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
          showComparativeModal(ex, ans, (duda, passed, decision) => {
            rlEjercicioTerminado(item, passed, decision, getTraduccionReportEntry(ex, ans, duda), ans);
          });
        };
        break;
      }
      case "ordenamiento": {
        const limpiarOrdenamiento = renderOrdenamientoExercise(ex, c);
        c.addEventListener("ordenamiento-done", (e) => {
          const { passed } = e.detail;
          rlEjercicioTerminado(item, passed, null, getOrdenamientoReportEntry(ex, passed), ex.englishWord);
        });
        RLV.limpiar = limpiarOrdenamiento || null;
        break;
      }
      case "completar": {
        renderCompletarExercise(ex, c, !!isRetryLocal);
        c.querySelector(".completar-check").onclick = () => {
          const { userAnswers, results } = checkCompletarAnswers(ex, c);
          const filled = fillCompletarBlanks(ex.englishSentence, userAnswers);
          showCompletarModal(ex, results, (duda, passed, decision) => {
            rlEjercicioTerminado(item, passed, decision, getCompletarReportEntry(ex, userAnswers, duda), filled);
          });
        };
        break;
      }
      case "corregir": {
        renderCorregirExercise(ex, c, !!isRetryLocal);
        const btn = c.querySelector(".corregir-check");
        const inp = c.querySelector(".corregir-answer");
        btn.onclick = () => {
          const ans = inp.value.trim();
          if (!ans) { toast("📝 Escribe algo"); return; }
          const result = checkCorregirAnswer(ex, ans);
          showCorregirModal(ex, result, ans,
            (duda, decision) => rlEjercicioTerminado(item, result.passed, decision, getCorregirReportEntry(ex, ans, duda), ans),
            (duda) => {
              // Reintentar en el momento: el intento fallido queda como error corregido.
              rlRegistrar(Object.assign({}, item, { retry: true }), getCorregirReportEntry(ex, ans, duda), false);
              rlGuardar();
              rlLimpiarTarjeta();
              rlRenderEjercicio(item, body, true);
            });
        };
        RLV.limpiar = () => { if (c._corregirCarouselTimer) { clearInterval(c._corregirCarouselTimer); c._corregirCarouselTimer = null; } };
        break;
      }
      case "seleccionar": {
        renderSeleccionarExercise(ex, c);
        c.addEventListener("all-matched", () => {
          showSeleccionarCompleteModal(ex.pairs, () => {
            const entrada = { type: "seleccionar", original: "Emparejar: " + (ex.pairs || []).map((p) => p.englishWord + " = " + p.spanishWord).join(" · "), duda: "" };
            rlEjercicioTerminado(item, true, null, entrada, "");
          });
        });
        RLV.limpiar = () => { if (c._seleccionarAutoPlayTimer) { clearTimeout(c._seleccionarAutoPlayTimer); c._seleccionarAutoPlayTimer = null; } };
        break;
      }
      case "dictado": {
        renderDictadoExercise(ex, c);
        c.addEventListener("dictado-done", (e) => {
          const { originalText, userAnswer, result, duda, decision } = e.detail;
          rlEjercicioTerminado(item, !!(result && result.passed), decision, getDictadoReportEntry(originalText, userAnswer, duda), userAnswer);
        });
        break;
      }
      default:
        c.innerHTML = `<p class="sub-fun">Tipo de ejercicio desconocido.</p><button class="fun-btn primary-btn rl-skip">Continuar</button>`;
        c.querySelector(".rl-skip").onclick = () => rlSiguiente();
    }
  }

  // ---------- Lección de información (reglas en 0 %) ----------
  function rlRenderInfo(item, body) {
    const lecciones = rlLeccionesDe(item.reglaId);
    const leccion = lecciones[item.idx || 0];
    if (!leccion) { setTimeout(rlSiguiente, 0); return; }
    const st = freshLeccionState(leccion);
    const regla = findRegla(item.reglaId);
    const pintar = () => {
      body.innerHTML = rlCabecera(["💡 Nueva regla", regla ? rlEsc(regla.regla) : ""]) +
        `<div class="rl-info info-scroll"><div class="rl-info-container"></div>
         <button class="fun-btn rl-skip-info">⏭ Saltar lección</button></div>`;
      const c = body.querySelector(".rl-info-container");
      c.innerHTML = renderLeccion(leccion, st);
      wireLeccion(leccion, c, st, pintar, () => { rlSumarDia("informacion"); RL.cont.espacioCont = (RL.cont.espacioCont || 0) + 1; rlGuardar(); burstConfetti(); rlSiguiente(); });
      body.querySelector(".rl-skip-info").onclick = () => rlSiguiente();
    };
    pintar();
  }

  // ---------- Agregar JSON manual (menú): tandas guardadas con título ----------
  // Ya no se agrega directo a la reserva al pegar el JSON (eso vivía
  // también en la pantalla de Informe — se quitó de ahí por pedido
  // explícito del usuario). Ahora cada tanda (título + JSON) se guarda
  // en una lista propia en localStorage para poder reutilizarla más
  // adelante: se marca su casilla y "Cargar al juego" es lo que
  // realmente la manda a la reserva (rlAgregarManual), tantas veces como
  // se quiera. Un 🗑️ por fila la borra de la lista guardada.
  function rlManualLotesKey() { return "english_trainer_reels_manual_lotes_v1_" + getTargetLanguage(); }

  function rlManualLotesLeer() {
    try { return JSON.parse(localStorage.getItem(rlManualLotesKey()) || "[]"); } catch (e) { return []; }
  }

  function rlManualLotesGuardar(lista) {
    try { localStorage.setItem(rlManualLotesKey(), JSON.stringify(lista)); } catch (e) { /* nada */ }
  }

  function rlManualLoteAgregar(titulo, json) {
    const lista = rlManualLotesLeer();
    lista.push({
      id: "lote_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1000),
      titulo,
      json,
      fecha: new Date().toISOString(),
    });
    rlManualLotesGuardar(lista);
    return lista;
  }

  function rlManualLoteBorrar(id) {
    const lista = rlManualLotesLeer().filter((l) => l.id !== id);
    rlManualLotesGuardar(lista);
    return lista;
  }

  function rlFilaLoteHTML(lote) {
    return `
      <div class="rl-lote-row" data-rl-lote="${rlEsc(lote.id)}">
        <input type="checkbox" class="rl-lote-check" data-rl-lote-check="${rlEsc(lote.id)}" aria-label="Seleccionar ${rlEsc(lote.titulo)}">
        <span class="rl-lote-titulo">${rlEsc(lote.titulo)}</span>
        <button class="rl-lote-borrar" data-rl-lote-borrar="${rlEsc(lote.id)}" aria-label="Eliminar ${rlEsc(lote.titulo)}">🗑️</button>
      </div>`;
  }

  function rlModalAgregarJSON() {
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    rlEstado();
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>📥 Agregar ejercicios</h3>
          <button class="menu-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">Mismo formato de siempre (traducciones, completar, seleccionar, corregir${getTargetLanguage() === "it" ? ", dictado" : ""}) con sus <b>reglaIds</b>. Guarda tandas con un título para reutilizarlas cuando quieras — solo entran a la reserva (30 tuyos por cada 20 del sistema) cuando las marcas y le das "Cargar al juego".</p>

        <label class="rl-lote-label" for="rlLoteTituloInput">Título de la tanda</label>
        <input type="text" id="rlLoteTituloInput" class="answer-input rl-lote-titulo-input" placeholder="Ej: Verbos modales — tanda 3">
        <textarea class="answer-input rl-json-input" rows="6" placeholder='${rlEsc(IMPORT_EXAMPLE_JSON)}'></textarea>
        <button class="fun-btn primary-btn full-width rl-lote-guardar">💾 Guardar tanda</button>
        <p class="rl-mini rl-json-msg"></p>

        <h4 class="rl-lote-list-titulo">Tandas guardadas</h4>
        <div class="rl-lote-list"></div>
        <button class="fun-btn full-width rl-lote-cargar">📥 Cargar al juego</button>
        <p class="rl-mini">En reserva ahora: <b class="rl-res-n">${RL.reserva.length}</b> · En el banco: <b class="rl-banco-n">${rlContarBanco()}</b></p>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    function pintarLotes() {
      const lotes = rlManualLotesLeer();
      const cont = modal.querySelector(".rl-lote-list");
      cont.innerHTML = lotes.length
        ? lotes.map(rlFilaLoteHTML).join("")
        : `<p class="rl-mini">Todavía no has guardado ninguna tanda.</p>`;
      cont.querySelectorAll("[data-rl-lote-borrar]").forEach((btn) => {
        btn.addEventListener("click", () => {
          rlManualLoteBorrar(btn.dataset.rlLoteBorrar);
          pintarLotes();
        });
      });
    }
    pintarLotes();

    modal.querySelector(".rl-lote-guardar").addEventListener("click", () => {
      const tituloInput = modal.querySelector(".rl-lote-titulo-input");
      const jsonInput = modal.querySelector(".rl-json-input");
      const msg = modal.querySelector(".rl-json-msg");
      const titulo = tituloInput.value.trim();
      const raw = jsonInput.value.trim();
      if (!titulo) { toast("📝 Ponle un título a la tanda"); return; }
      if (!raw) { toast("📝 Pega el JSON primero"); return; }
      try { JSON.parse(raw); } catch (e) { toast("❌ JSON inválido: " + e.message); return; }
      rlManualLoteAgregar(titulo, raw);
      tituloInput.value = "";
      jsonInput.value = "";
      msg.textContent = "✅ Tanda guardada. Márcala en la lista y toca \"Cargar al juego\" cuando quieras usarla.";
      toast("💾 Tanda guardada");
      pintarLotes();
    });

    modal.querySelector(".rl-lote-cargar").addEventListener("click", () => {
      const lotes = rlManualLotesLeer();
      const marcados = Array.from(modal.querySelectorAll("[data-rl-lote-check]:checked")).map((c) => c.dataset.rlLoteCheck);
      if (!marcados.length) { toast("☑️ Marca al menos una tanda guardada"); return; }
      let totalAgregados = 0, totalDescartados = 0;
      marcados.forEach((id) => {
        const lote = lotes.find((l) => l.id === id);
        if (!lote) return;
        let parsed;
        try { parsed = JSON.parse(lote.json); } catch (e) { return; }
        const r = rlAgregarManual(parsed);
        totalAgregados += r.agregados;
        totalDescartados += r.descartados;
      });
      const n = modal.querySelector(".rl-res-n");
      if (n) n.textContent = String(RL.reserva.length);
      const nb = modal.querySelector(".rl-banco-n");
      if (nb) nb.textContent = String(rlContarBanco());
      const extra = totalDescartados ? " · " + totalDescartados + " de dictado descartados" : "";
      toast("📥 " + totalAgregados + " ejercicio(s) cargados al juego" + extra);
    });
  }

  function rlBorrarTodo() {
    try { localStorage.removeItem(rlKey()); } catch (e) { /* nada */ }
    RL = null;
  }

  function rlCambioDeIdioma() { RL = null; }

  // ---------- Temporizador (botón ▶ arriba al centro) ----------
  // Cuenta regresiva de N minutos (N se cambia en el menú). Guarda la hora de
  // fin en localStorage, así sigue contando aunque la app vaya a segundo plano.
  const RL_TIMER_KEY = "english_trainer_timer_v1";
  const RL_TIMER_MIN_KEY = "english_trainer_timer_min";
  function rlTimerMin() {
    const n = parseInt(localStorage.getItem(RL_TIMER_MIN_KEY) || "10", 10);
    return Number.isFinite(n) && n > 0 ? Math.min(180, n) : 10;
  }
  function rlTimerSetMin(n) { try { localStorage.setItem(RL_TIMER_MIN_KEY, String(n)); } catch (e) { /* nada */ } }
  function rlTimerLeer() { try { return JSON.parse(localStorage.getItem(RL_TIMER_KEY) || "null"); } catch (e) { return null; } }
  function rlTimerGuardar(t) { try { if (t) localStorage.setItem(RL_TIMER_KEY, JSON.stringify(t)); else localStorage.removeItem(RL_TIMER_KEY); } catch (e) { /* nada */ } }

  // Apagado: ▶ lo enciende. Encendido: tocarlo abre un modal para desactivarlo.
  function rlTimerToque() {
    const t = rlTimerLeer();
    if (!t) { rlTimerGuardar({ fin: Date.now() + rlTimerMin() * 60000 }); rlTimerPintar(); return; }
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    const resta = Math.max(0, (t.pausa != null ? t.pausa : t.fin - Date.now()));
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <h3>⏱️ Temporizador</h3>
        <p class="sub-fun" style="margin:8px 0 16px;text-transform:none;font-size:.95rem;">Quedan ${Math.ceil(resta / 60000)} min. ¿Lo desactivas?</p>
        <div class="action-buttons" style="display:flex;gap:10px;">
          <button class="fun-btn rl-tm-no" style="flex:1;">Seguir</button>
          <button class="fun-btn danger-btn rl-tm-off" style="flex:1;">⏹ Desactivar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelector(".rl-tm-no").onclick = close;
    modal.querySelector(".rl-tm-off").onclick = () => { rlTimerGuardar(null); close(); rlTimerPintar(); toast("⏹ Temporizador desactivado"); };
  }

  function rlTimerFin() {
    rlTimerGuardar(null);
    toast("⏰ ¡Se acabó el tiempo!");
    try { navigator.vibrate?.([300, 150, 300]); } catch (e) { /* nada */ }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      [0, 0.35, 0.7].forEach((t0) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t0);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + 0.3);
        o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + 0.3);
      });
    } catch (e) { /* sin sonido */ }
  }

  function rlTimerPintar() {
    const btn = document.getElementById("rlTimerBtn");
    if (!btn) return;
    const t = rlTimerLeer();
    if (!t) { btn.className = "rl-timer"; btn.innerHTML = "▶"; btn.title = "Iniciar temporizador de " + rlTimerMin() + " min"; return; }
    const resta = t.pausa != null ? t.pausa : t.fin - Date.now();
    if (resta <= 0) { rlTimerFin(); rlTimerPintar(); return; }
    const min = Math.ceil(resta / 60000);
    btn.className = "rl-timer rl-timer-on" + (t.pausa != null ? " rl-timer-pausa" : "");
    btn.innerHTML = `<span class="rl-timer-num">${min}</span><span class="rl-timer-dot"></span>`;
    btn.title = "Toca para desactivar";
  }

  function rlModalTimer() {
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>⏱️ Temporizador</h3>
          <button class="menu-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:12px;">Minutos de la cuenta regresiva del botón ▶ de Reels.</p>
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0 16px;">
          <button type="button" class="fun-btn rl-tm-menos" style="width:52px;height:52px;font-size:1.5rem;">−</button>
          <span class="rl-tm-val" style="font-size:2rem;font-weight:900;min-width:64px;text-align:center;">${rlTimerMin()}</span>
          <button type="button" class="fun-btn rl-tm-mas" style="width:52px;height:52px;font-size:1.5rem;">+</button>
        </div>
        <div class="action-buttons"><button class="fun-btn primary-btn rl-tm-ok">✅ Guardar</button></div>
      </div>`;
    document.body.appendChild(modal);
    let v = rlTimerMin();
    const val = modal.querySelector(".rl-tm-val");
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelector(".rl-tm-menos").onclick = () => { v = Math.max(1, v - (v > 10 ? 5 : 1)); val.textContent = v; };
    modal.querySelector(".rl-tm-mas").onclick = () => { v = Math.min(180, v + (v >= 10 ? 5 : 1)); val.textContent = v; };
    modal.querySelector(".rl-tm-ok").onclick = () => { rlTimerSetMin(v); close(); rlTimerPintar(); toast("⏱️ Temporizador: " + v + " min"); };
  }

  function wireReels() {
    document.getElementById("rlTimerBtn")?.addEventListener("click", rlTimerToque);
    setInterval(rlTimerPintar, 1000);
    rlTimerPintar();
    document.getElementById("rlCloseBtn")?.addEventListener("click", () => closeReels());
    document.getElementById("rlHelpBtn")?.addEventListener("click", () => showHelpModal());
    let tBorr = null;
    document.getElementById("rlStage")?.addEventListener("input", () => { clearTimeout(tBorr); tBorr = setTimeout(rlGuardarBorrador, 300); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) rlGuardarBorrador(); });
    window.addEventListener("pagehide", rlGuardarBorrador);
    window.addEventListener("message", (ev) => {
      const d = ev.data;
      if (!d || d.azureReels !== true || ev.origin !== window.location.origin) return;
      if (d.tipo === "ejercicio") rlSumarDia("azure");
      if (typeof RLV.azHandler === "function") RLV.azHandler(d);
    });
    window.addEventListener("popstate", () => { if (RLV.abierto) closeReels("popstate"); });
  }