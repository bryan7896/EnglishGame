  // ==================== REELS (núcleo) ====================
  // Secuencia infinita de ejercicios a pantalla completa. Reemplaza al mapa:
  // - Banco de estudio de RL_BANCO ejercicios (se rellena con la sorpresa
  //   "elige reglas", nunca solo).
  // - Cada 5-15 tarjetas aparece una sorpresa (reels-sorpresas.js).
  // - "Repasar luego" devuelve el ejercicio 3-8 tarjetas después.
  // - Estado propio por idioma en localStorage (rlKey()).
  const RL_BANCO = 50;
  const RL_MIN_OBLIGATORIO = 35;
  const RL_SORPRESA_MIN = 5, RL_SORPRESA_MAX = 15;
  const RL_REPORTE_MIN = 60, RL_REPORTE_MAX = 70;
  const RL_MIN_POR_REGLA = 5;
  const RL_PARTE_MANUAL = 0.6;               // 30 de cada 50
  const RL_REPASO_MIN = 3, RL_REPASO_MAX = 8; // "Repasar luego": vuelve N tarjetas después
  const RL_MAX_USADOS = 6000;

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
      cont: { sorpresa: 0, proxSorpresa: rlRand(RL_SORPRESA_MIN, RL_SORPRESA_MAX), reporte: 0, proxReporte: rlRand(RL_REPORTE_MIN, RL_REPORTE_MAX) },
      ultSorpresa: null,
      reporte: { entradas: [], mundo: [], ultimoTexto: "", pendiente: false },
      historias: { usadas: [], activa: null },
      yt: { usadas: [] },
      recientes: [],      // textos en el idioma objetivo de lo último que se hizo (para YouGlish)
      racha: 0,
      seq: 0,
    };
  }

  function rlCargar() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(rlKey()) || "null"); } catch (e) { d = null; }
    const base = rlNuevo();
    if (!d || d.v !== 1) { RL = base; return; }
    RL = Object.assign(base, d);
    RL.cont = Object.assign(base.cont, d.cont || {});
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

  function rlMezclarEnBanco(nuevas, alFrente) {
    const banco = RL.banco.slice();
    shuffleArray(nuevas).forEach((it) => {
      const pos = Math.floor(Math.random() * (banco.length + 1));
      banco.splice(pos, 0, it);
    });
    RL.banco = rlCorregirRachas(banco);
    if (alFrente && alFrente.length) RL.banco = alFrente.concat(RL.banco);
  }

  function rlItemEx(ex, src) { return { k: "ex", uid: rlUid(), ex, src: src || "sys", retry: false }; }

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
    RL.reporte.entradas.push(Object.assign({}, entrada, {
      rid: rlUid(),
      reglaIds: (item.ex && item.ex.reglaIds) || [],
      retry: !!item.retry,
      passed: !!passed,
      fecha: new Date().toISOString(),
    }));
  }

  function rlGrupoKey(e) { return (e.reglaIds || []).slice().sort((a, b) => a - b).join(",") || "none"; }

  // Grupos (por regla) que ya tienen al menos RL_MIN_POR_REGLA ejercicios
  // propios (sin contar los errores corregidos).
  function rlReporteListo() {
    const grupos = {};
    (RL.reporte.entradas || []).forEach((e) => {
      const k = rlGrupoKey(e);
      (grupos[k] = grupos[k] || { key: k, reglaIds: e.reglaIds || [], ej: [], err: [] });
      (e.retry ? grupos[k].err : grupos[k].ej).push(e);
    });
    const listos = Object.values(grupos).filter((g) => g.ej.length >= RL_MIN_POR_REGLA);
    return { listos, pendientes: Object.values(grupos).filter((g) => g.ej.length < RL_MIN_POR_REGLA) };
  }

  function rlConstruirReporte() {
    const { listos } = rlReporteListo();
    const lines = [];
    const hoy = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
    lines.push("📘 INFORME DE APRENDIZAJE (" + getTargetLangMeta().label + ")");
    lines.push("📅 " + hoy);
    lines.push("=".repeat(40));
    lines.push("");
    const counter = { n: 0 };
    listos.forEach((g) => {
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
    const mundo = RL.reporte.mundo || [];
    if (mundo.length) {
      lines.push("🌎 MUNDO REAL (clips de YouGlish)");
      lines.push("=".repeat(40));
      mundo.forEach((m, i) => {
        lines.push((i + 1) + ". " + (m.ok ? "✅" : "❌") + " Frase: \"" + m.frase + "\"");
        lines.push("   🎯 Palabra a reconocer: " + m.objetivo + " · ✏️ Elegiste: " + m.elegida + " · (búsqueda: " + m.palabra + ")");
      });
      lines.push("");
    }
    const aventura = buildAventuraReportLines();
    if (aventura.length) {
      lines.push("🎮 AVENTURA (juego de conversaciones por audio)");
      lines.push("=".repeat(40));
      lines.push(...aventura);
    }
    const rids = new Set();
    listos.forEach((g) => g.ej.concat(g.err).forEach((e) => rids.add(e.rid)));
    return { texto: lines.join("\n"), rids, grupos: listos.length, total: rids.size };
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
    const fs = document.documentElement.requestFullscreen?.bind(document.documentElement);
    if (fs) fs().then(() => { RLV.enPantallaCompleta = true; }).catch(() => { RLV.enPantallaCompleta = false; });
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
    RLV.abierto = false;
    rlLimpiarTarjeta();
    try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    const ov = document.getElementById("reelsOverlay");
    if (ov) ov.hidden = true;
    document.body.classList.remove("rl-open");
    const st = document.getElementById("rlStage");
    if (st) st.innerHTML = "";
    if (desdeEvento !== "fullscreen" && document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* nada */ } }
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
    return RL.banco.shift();
  }

  function rlMostrarActual(animar) {
    if (!RL.cur) { RL.cur = rlDecidirSiguiente(); rlGuardar(); }
    rlRenderTarjeta(RL.cur, animar);
  }

  function rlSiguiente() {
    rlLimpiarTarjeta();
    try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
    RL.cur = null;
    rlMostrarActual(true);
  }

  // Termina un ejercicio: cuenta para sorpresas y para el informe (los
  // reintentos también cuentan, si no el informe se retrasaría).
  function rlEjercicioTerminado(item, passed, decision, entrada, respuesta) {
    rlRegistrar(item, entrada, passed);
    RL.cont.sorpresa++;
    RL.cont.reporte++;
    RL.racha = passed ? (RL.racha || 0) + 1 : 0;
    const txt = rlTextoObjetivo(item.ex);
    if (txt) { RL.recientes.push(txt); if (RL.recientes.length > 40) RL.recientes = RL.recientes.slice(-40); }
    if (decision === "luego") rlReencolar(item, respuesta);
    rlGuardar();
    if (passed) rlRachaFx();
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

  function rlRachaFx() {
    const el = document.getElementById("rlRacha");
    if (!el) return;
    el.textContent = "🔥 " + RL.racha;
    el.classList.remove("rl-pop"); void el.offsetWidth; el.classList.add("rl-pop");
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

    const racha = document.getElementById("rlRacha");
    if (racha) racha.textContent = RL.racha ? "🔥 " + RL.racha : "";

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
  }

  function rlCabecera(chips) {
    return `<div class="rl-chips">${chips.filter(Boolean).map((c) => `<span class="rl-chip">${c}</span>`).join("")}</div>`;
  }

  function rlRenderEjercicio(item, body, isRetryLocal) {
    const ex = item.ex;
    body.innerHTML = rlCabecera([
      getExerciseTypeIcon(ex.type) + " " + getExerciseTypeName(ex.type),
      item.retry ? "🧠 Repaso" : "",
      item.src === "man" ? "📥 Tuyo" : "",
    ]) + `<div class="rl-ex exercise-area"><div class="rl-ex-container"></div></div>`;
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
      wireLeccion(leccion, c, st, pintar, () => { burstConfetti(); rlSiguiente(); });
      body.querySelector(".rl-skip-info").onclick = () => rlSiguiente();
    };
    pintar();
  }

  // ---------- Agregar JSON manual (menú y pantalla de informe) ----------
  function rlFormAgregarHTML() {
    return `
      <textarea class="answer-input rl-json-input" rows="6" placeholder='${rlEsc(IMPORT_EXAMPLE_JSON)}'></textarea>
      <button class="fun-btn primary-btn full-width rl-json-btn">📥 Agregar a la reserva</button>
      <p class="rl-mini rl-json-msg"></p>`;
  }

  function rlWireAgregar(root, alTerminar) {
    const btn = root.querySelector(".rl-json-btn");
    btn.onclick = () => {
      const raw = root.querySelector(".rl-json-input").value.trim();
      const msg = root.querySelector(".rl-json-msg");
      if (!raw) { toast("📝 Pega el JSON primero"); return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { toast("❌ JSON inválido: " + e.message); return; }
      const r = rlAgregarManual(parsed);
      const extra = r.descartados ? " · " + r.descartados + " de dictado descartados (inglés no usa dictado)" : "";
      msg.textContent = "✅ " + r.agregados + " ejercicio(s) agregados. En reserva: " + r.reserva + extra;
      root.querySelector(".rl-json-input").value = "";
      toast("📥 " + r.agregados + " ejercicio(s) a la reserva");
      if (alTerminar) alTerminar(r);
    };
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
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">Mismo formato de siempre (traducciones, completar, seleccionar, corregir${getTargetLanguage() === "it" ? ", dictado" : ""}) con sus <b>reglaIds</b>. Van a una reserva y entran al banco poco a poco: 30 tuyos por cada 20 del sistema.</p>
        <p class="rl-mini">En reserva ahora: <b>${RL.reserva.length}</b> · En el banco: <b>${rlContarBanco()}</b></p>
        <div class="rl-json-wrap">${rlFormAgregarHTML()}</div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    rlWireAgregar(modal.querySelector(".rl-json-wrap"));
  }

  function rlBorrarTodo() {
    try { localStorage.removeItem(rlKey()); } catch (e) { /* nada */ }
    RL = null;
  }

  function rlCambioDeIdioma() { RL = null; }

  function wireReels() {
    document.getElementById("rlCloseBtn")?.addEventListener("click", () => closeReels());
    document.getElementById("rlHelpBtn")?.addEventListener("click", () => showHelpModal());
    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && RLV.abierto && RLV.enPantallaCompleta) closeReels("fullscreen");
    });
    window.addEventListener("popstate", () => { if (RLV.abierto) closeReels("popstate"); });
  }
