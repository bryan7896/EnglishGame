// ==================== IRREGULARES ====================
  // Sección de verbos irregulares (solo inglés americano). 100 verbos en 10
  // paquetes de 10; cada sesión completada estudia UN paquete y el siguiente
  // queda para otro día. Tras el paquete 10 vuelve al 1 (ciclo de 10 días).
  //
  // Una sesión tiene 3 partes que salen como sorpresas dentro de Reels
  // (contando los ejercicios normales que se hacen entre una y otra):
  //   · Reconocimiento  → a los 10 ejercicios: 30 formas × 2 = 60 parejas
  //   · Seleccionar     → 10 ejercicios después: 3 tandas de 5 (cada 5 ejercicios)
  //   · Completar       → 15 ejercicios después: 2 tandas de 5 grupos de 3 (cada 5 ejercicios)
  // También se puede hacer seguida desde el menú (botón Irregulares); es la
  // misma sesión. Terminar el último Completar cierra el día: ese día ya no
  // salen más irregulares ni el 25 % de irregulares en la recarga del banco.
  //
  // El banco (traducción + completar, ~8.550 ejercicios con reglaIds [regla, 19])
  // NO vive en el banco general: entra solo como el 25 % de cada recarga, con
  // ejercicios del paquete que toca y de las reglas elegidas en esa recarga.
  const IRR_KEY = "english_trainer_irregulares_v1";
  const IRR_PASOS = { rec: 10, sel1: 10, sel: 5, comp1: 15, comp: 5 };
  const IRR_SEL_TANDAS = 3, IRR_SEL_POR = 5;
  const IRR_COMP_TANDAS = 2, IRR_COMP_POR = 5;
  const IRR_REC_REPS = 2, IRR_REC_FILAS = 5, IRR_REC_LOTE = 3;
  const IRR_PCT_RECARGA = 0.25;
  const IRR_FORMA_NOMBRE = ["Base", "Pasado", "Participio"];
  const IRR_FORMA_CLASE = ["irr-f-b", "irr-f-p", "irr-f-pp"];

  let IRR = null;
  const IRRV = { overlay: null, limpiar: null };

  // ---------- Datos ----------
  function irrData() { return (typeof IRREGULARES_DATA !== "undefined" && IRREGULARES_DATA) || { verbos: [], seccion: {}, banco: {} }; }
  let _irrIdx = null;
  function irrIdx() {
    if (_irrIdx) return _irrIdx;
    const verbos = {}, formas = {};
    irrData().verbos.forEach((v) => {
      verbos[v.id] = v;
      v.f.forEach((f, i) => { formas[f.id] = Object.assign({ v: v.id, i }, f); });
    });
    _irrIdx = { verbos, formas };
    return _irrIdx;
  }
  function irrVerbo(id) { return irrIdx().verbos[id] || null; }
  function irrForma(id) { return irrIdx().formas[id] || null; }
  function irrVerbosDe(pkg) { return irrData().verbos.filter((v) => v.p === pkg).sort((a, b) => a.o - b.o); }
  function irrSeccionDe(pkg) { return (irrData().seccion || {})[String(pkg)] || { sel: [], comp: [] }; }
  function irrBancoDe(pkg) { return (irrData().banco || {})[String(pkg)] || []; }
  function irrHay() { return irrData().verbos.length > 0; }

  // Solo existe en inglés.
  function irrDisponible() { return irrHay() && typeof getTargetLanguage === "function" && getTargetLanguage() === "en"; }

  // ---------- Estado ----------
  function irrHoy() { return new Date().toLocaleDateString("en-CA"); }
  function irrNuevo() { return { v: 1, paquete: 1, ciclo: 1, ses: null, hecha: null, sesiones: 0, verbos: {}, usados: {}, log: [] }; }
  function irrCargar() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(IRR_KEY) || "null"); } catch (e) { d = null; }
    IRR = Object.assign(irrNuevo(), d && d.v === 1 ? d : {});
    IRR.verbos = IRR.verbos || {};
    IRR.usados = IRR.usados || {};
    IRR.log = IRR.log || [];
    if (!(IRR.paquete >= 1 && IRR.paquete <= 10)) IRR.paquete = 1;
  }
  function irrEstado() { if (!IRR) irrCargar(); return IRR; }
  function irrGuardar() {
    if (!IRR) return;
    try { localStorage.setItem(IRR_KEY, JSON.stringify(IRR)); } catch (e) { /* almacenamiento lleno: se sigue en memoria */ }
  }
  function irrStat(vid) { const s = irrEstado(); return (s.verbos[vid] = s.verbos[vid] || { veces: 0, banco: 0, err: 0 }); }

  function irrHechaHoy() { return irrEstado().hecha === irrHoy(); }

  // Sesión en curso (o una nueva si hoy todavía no se completó ninguna).
  function irrSesion(crear) {
    const s = irrEstado();
    if (!s.ses && crear !== false && !irrHechaHoy() && irrDisponible()) {
      s.ses = { paquete: s.paquete, ciclo: s.ciclo, fase: "rec", tanda: 0, cont: 0, listo: false, inicio: irrHoy(), rec: null, sel: null, comp: null };
      irrGuardar();
    }
    return s.ses;
  }

  // Ejercicios normales que faltan para la próxima parte.
  function irrUmbral(ses) {
    if (ses.fase === "rec") return IRR_PASOS.rec;
    if (ses.fase === "sel") return ses.tanda === 0 ? IRR_PASOS.sel1 : IRR_PASOS.sel;
    return ses.tanda === 0 ? IRR_PASOS.comp1 : IRR_PASOS.comp;
  }

  // Ítems de seleccionar de esta sesión: 15 de los 30 (la otra mitad sale en el
  // siguiente ciclo). Cada verbo aporta 1 o 2 formas según la paridad.
  function irrSelDeSesion(pkg, ciclo) {
    const sec = irrSeccionDe(pkg);
    const lista = sec.sel.filter((it) => {
      const f = irrForma(it.f), v = irrVerbo(it.v);
      return f && v && (v.o + f.i + ciclo) % 2 === 0;
    });
    lista.sort((a, b) => (irrVerbo(a.v).o - irrVerbo(b.v).o) || (irrForma(a.f).i - irrForma(b.f).i));
    // Mezcla manteniendo el orden por tandas razonable: se baraja todo.
    return shuffleArray(lista).map((it) => it.f);
  }
  function irrSelItem(pkg, fid) { return irrSeccionDe(pkg).sel.find((it) => it.f === fid) || null; }
  function irrCompItem(pkg, fid) { return irrSeccionDe(pkg).comp.find((it) => it.f === fid) || null; }

  // Grupos de completar: un grupo por verbo (sus 3 formas), en orden del paquete.
  function irrGruposComp(pkg) {
    return irrVerbosDe(pkg).map((v) => v.f.map((f) => f.id).filter((fid) => irrCompItem(pkg, fid))).filter((g) => g.length);
  }

  // Lo que muestra el resumen ("Seleccionar 2/3", etc.)
  function irrFaseTexto(ses) {
    if (!ses) return irrHechaHoy() ? "Sesión de hoy completada" : "Sin empezar";
    if (ses.fase === "rec") return "Reconocimiento";
    if (ses.fase === "sel") return "Seleccionar · tanda " + (ses.tanda + 1) + "/" + IRR_SEL_TANDAS;
    return "Completar · tanda " + (ses.tanda + 1) + "/" + IRR_COMP_TANDAS;
  }

  // ---------- Integración con Reels ----------
  // Se llama por cada ejercicio terminado en Reels.
  function irrContarEjercicio(item) {
    if (!irrDisponible()) return;
    const s = irrEstado();
    if (item && item.ex && item.ex.irr && Array.isArray(item.ex.irr.v)) {
      item.ex.irr.v.forEach((vid) => { irrStat(vid).banco += 1; });
    }
    const ses = irrSesion();
    if (ses && !ses.listo) {
      ses.cont = (ses.cont || 0) + 1;
      if (ses.cont >= irrUmbral(ses)) ses.listo = true;
    }
    irrGuardar();
  }

  // ¿Toca una parte de irregulares ahora? (desde rlDecidirSiguiente)
  function irrDecidirSorpresa() {
    if (!irrDisponible()) return null;
    const ses = irrSesion();
    if (!ses || !ses.listo) return null;
    return { k: "sorpresa", tipo: "irr", fase: ses.fase, tanda: ses.tanda, paquete: ses.paquete, uid: rlUid() };
  }

  function irrRenderSorpresaReels(item, body) {
    const ses = irrSesion(false);
    // Si esa parte ya se hizo (por ejemplo desde el menú), se sigue de largo.
    if (!ses || ses.paquete !== item.paquete || ses.fase !== item.fase || ses.tanda !== item.tanda) {
      setTimeout(() => rlSorpresaHecha(item), 0);
      return;
    }
    const card = body.closest(".rl-card");
    if (card) card.classList.add("irr-card");
    body.classList.add("irr-theme", "irr-in-reels");
    irrCorrerParte(body, {
      reels: true,
      alTerminar: (resultado) => {
        if (card) card.classList.remove("irr-card");
        rlSorpresaHecha(item);
      },
    });
    RLV.limpiar = () => { irrLimpiar(); if (card) card.classList.remove("irr-card"); };
  }

  // Cuántos irregulares lleva una recarga de n ejercicios (0 si hoy ya se completó).
  function irrCupoRecarga(n) {
    if (!irrDisponible() || irrHechaHoy() || n <= 0) return 0;
    return Math.min(n, Math.ceil(n * IRR_PCT_RECARGA));
  }

  // Toma n ejercicios del banco de irregulares del paquete que toca, primero de
  // las reglas elegidas y, si no alcanzan, de las demás reglas del paquete.
  function irrTomarParaRecarga(n, reglaIds) {
    if (!irrDisponible() || n <= 0) return [];
    const s = irrEstado();
    const pkg = s.paquete;
    const todos = irrBancoDe(pkg);
    if (!todos.length) return [];
    const usadosArr = s.usados[pkg] = s.usados[pkg] || [];
    let usados = new Set(usadosArr);
    const enBanco = new Set(((typeof RL !== "undefined" && RL && RL.banco) || []).filter((it) => it.k === "ex" && it.ex && it.ex.id).map((it) => it.ex.id));
    const elegidas = new Set(reglaIds || []);
    const libre = (it) => !usados.has(it[0]) && !enBanco.has(it[0]);
    let primero = shuffleArray(todos.filter((it) => elegidas.has(it[1]) && libre(it)));
    if (primero.length < n && elegidas.size) {
      // Se agotaron los de las reglas elegidas en este paquete: se reciclan.
      const ids = new Set(todos.filter((it) => elegidas.has(it[1])).map((it) => it[0]));
      s.usados[pkg] = usadosArr.filter((id) => !ids.has(id));
      usados = new Set(s.usados[pkg]);
      primero = shuffleArray(todos.filter((it) => elegidas.has(it[1]) && libre(it)));
    }
    let lista = primero.slice(0, n);
    if (lista.length < n) {
      const ya = new Set(lista.map((it) => it[0]));
      let resto = shuffleArray(todos.filter((it) => !elegidas.has(it[1]) && libre(it) && !ya.has(it[0])));
      if (resto.length < n - lista.length) {
        s.usados[pkg] = (s.usados[pkg] || []).filter((id) => elegidas.has((todos.find((t) => t[0] === id) || [])[1]));
        usados = new Set(s.usados[pkg]);
        resto = shuffleArray(todos.filter((it) => !elegidas.has(it[1]) && libre(it) && !ya.has(it[0])));
      }
      lista = lista.concat(resto.slice(0, n - lista.length));
    }
    lista.forEach((it) => s.usados[pkg].push(it[0]));
    irrGuardar();
    return lista.map(irrAEjercicio);
  }

  // [id, regla, "t"|"c", español, inglés con [formas], [verbos]] -> ejercicio de la app
  function irrAEjercicio(it) {
    const [id, regla, tipo, es, en, vids] = it;
    const reglaIds = regla === 19 ? [19] : [regla, 19];
    const irr = { p: irrVerbo(vids[0]) ? irrVerbo(vids[0]).p : null, v: vids.slice() };
    if (tipo === "c") {
      const options = [];
      const englishSentence = en.replace(/\[([^\[\]]+)\]/g, (_, w) => { options.push(w); return "___"; });
      return { type: "completar", id, spanishWord: es, englishSentence, options, reglaIds, irr };
    }
    return { type: "traduccion", id, spanishWord: es, englishWord: en.replace(/\[([^\[\]]+)\]/g, "$1"), reglaIds, irr };
  }

  // Al cerrar el día se quitan del banco los irregulares que quedaban pendientes.
  function irrQuitarPendientesDelBanco() {
    if (typeof RL === "undefined" || !RL || !Array.isArray(RL.banco)) return 0;
    const antes = RL.banco.length;
    RL.banco = RL.banco.filter((it) => !(it.k === "ex" && it.ex && it.ex.irr));
    const n = antes - RL.banco.length;
    if (n && typeof rlGuardar === "function") rlGuardar();
    return n;
  }

  // ---------- Avance de la sesión ----------
  function irrParteTerminada() {
    const s = irrEstado();
    const ses = s.ses;
    if (!ses) return { fin: false };
    ses.cont = 0;
    ses.listo = false;
    if (ses.fase === "rec") {
      ses.fase = "sel"; ses.tanda = 0; ses.rec = null;
    } else if (ses.fase === "sel") {
      ses.tanda += 1;
      if (ses.tanda >= IRR_SEL_TANDAS) { ses.fase = "comp"; ses.tanda = 0; ses.sel = null; }
    } else {
      ses.tanda += 1;
      if (ses.tanda >= IRR_COMP_TANDAS) return irrSesionCompleta();
    }
    irrGuardar();
    return { fin: false };
  }

  function irrSesionCompleta() {
    const s = irrEstado();
    const ses = s.ses;
    const pkg = ses ? ses.paquete : s.paquete;
    irrVerbosDe(pkg).forEach((v) => { irrStat(v.id).veces += 1; });
    s.sesiones = (s.sesiones || 0) + 1;
    s.hecha = irrHoy();
    s.log.push({ f: new Date().toISOString(), p: pkg, c: s.ciclo });
    if (s.log.length > 120) s.log = s.log.slice(-120);
    s.paquete = pkg % 10 + 1;
    if (pkg === 10) s.ciclo += 1;
    s.ses = null;
    irrGuardar();
    irrQuitarPendientesDelBanco();
    return { fin: true, paquete: pkg };
  }

  // ---------- Motor de una "parte" (la que toca de la sesión) ----------
  // ctx: { reels, practica, alTerminar(resultado) }
  function irrCorrerParte(root, ctx) {
    const ses = ctx.practica ? ctx.practica : irrSesion(false);
    if (!ses) { ctx.alTerminar({ vacio: true }); return; }
    const guardar = () => { if (!ctx.practica) irrGuardar(); };
    const terminar = () => {
      const r = ctx.practica ? irrPracticaAvanzar(ses) : irrParteTerminada();
      ctx.alTerminar(r);
    };
    if (ses.fase === "rec") irrJugarReconocimiento(root, ses, guardar, terminar, ctx);
    else if (ses.fase === "sel") irrJugarSeleccionar(root, ses, guardar, terminar, ctx);
    else irrJugarCompletar(root, ses, guardar, terminar, ctx);
  }

  function irrLimpiar() {
    if (typeof IRRV.limpiar === "function") { try { IRRV.limpiar(); } catch (e) { /* nada */ } }
    IRRV.limpiar = null;
    try { window.speechSynthesis?.cancel(); } catch (e) { /* nada */ }
  }

  function irrEsc(s) { return window._escHTML(s); }
  function irrNegritas(s) { return irrEsc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function irrNorm(s) { return String(s || "").trim().toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ").replace(/[.!?,;:]+$/, ""); }
  function irrHablar(t) { try { if (typeof speakDictado === "function") speakDictado(t); } catch (e) { /* sin voz */ } }

  function irrCabecera(titulo, sub, progreso) {
    return `
      <header class="irr-head">
        <div class="irr-logo" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="irr-head-txt">
          <span class="irr-kicker">Irregulares · ${irrEsc(sub || "")}</span>
          <h2 class="irr-h">${titulo}</h2>
        </div>
      </header>
      ${progreso != null ? `<div class="irr-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progreso)}"><span style="width:${Math.max(0, Math.min(100, progreso))}%"></span></div>` : ""}`;
  }

  // ---------- 1. Reconocimiento ----------
  function irrNuevaCola(pkg) {
    const ids = [];
    irrVerbosDe(pkg).forEach((v) => v.f.forEach((f) => ids.push(f.id)));
    // 2 vueltas barajadas por separado: así una forma no sale dos veces seguidas.
    let cola = [];
    for (let r = 0; r < IRR_REC_REPS; r++) cola = cola.concat(shuffleArray(ids));
    return cola;
  }

  function irrEtiquetaEs(f) {
    return irrEsc(f.es) + (f.badge ? ` <em class="irr-badge">${f.i === 1 ? "P" : f.i === 2 ? "PP" : ""}</em>` : "");
  }

  function irrJugarReconocimiento(root, ses, guardar, terminar, ctx) {
    if (!ses.rec) {
      const cola = irrNuevaCola(ses.paquete);
      ses.rec = { cola, izq: [], der: [], hechos: 0, total: cola.length, err: 0, pendIzq: [], pendDer: [] };
      // Primer tablero
      for (let i = 0; i < IRR_REC_FILAS && ses.rec.cola.length; i++) {
        const id = irrSacarDeCola(ses.rec, ses.rec.izq);
        ses.rec.izq.push(id); ses.rec.der.push(id);
      }
      ses.rec.der = shuffleArray(ses.rec.der);
      guardar();
    }
    const R = ses.rec;
    R.pendIzq = R.pendIzq || [];
    R.pendDer = R.pendDer || [];
    const pkg = ses.paquete;
    let sel = null;           // { lado: "izq"|"der", i }
    let ocupado = false;
    // pointerdown con preventDefault: evita que el navegador enfoque el botón
    // y arrastre/desplace la columna al tocar; el "click" normal sigue intacto.
    const irrEnganchar = (b) => {
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("click", () => tocar(b));
    };
    const pintar = () => {
      const pct = R.total ? (R.hechos / R.total) * 100 : 0;
      root.innerHTML = irrCabecera("Reconocimiento", "Paquete " + pkg + (ctx.practica ? " · práctica" : ""), pct) + `
        <p class="irr-lead">Toca una palabra en inglés y luego su traducción. Si fallas, esa pareja vuelve a salir.</p>
        <div class="irr-rec">
          <div class="irr-rec-col" data-lado="izq">${R.izq.map((id, i) => irrCelda("izq", i, id)).join("")}</div>
          <div class="irr-rec-col" data-lado="der">${R.der.map((id, i) => irrCelda("der", i, id)).join("")}</div>
        </div>
        <div class="irr-rec-foot"><span class="irr-count"><b class="irr-hechos">${R.hechos}</b> / <span class="irr-total">${R.total}</span></span>
        ${R.err ? `<span class="irr-err">✕ ${R.err}</span>` : `<span class="irr-err" hidden></span>`}</div>`;
      root.querySelectorAll(".irr-tile").forEach((b) => irrEnganchar(b));
    };
    const celdaDe = (lado, i) => root.querySelector(`.irr-tile[data-lado="${lado}"][data-i="${i}"]`);
    const actualizarPie = () => {
      const h = root.querySelector(".irr-hechos"); if (h) h.textContent = R.hechos;
      const t = root.querySelector(".irr-total"); if (t) t.textContent = R.total;
      const e = root.querySelector(".irr-err"); if (e) { e.hidden = !R.err; e.textContent = "✕ " + R.err; }
      const bar = root.querySelector(".irr-prog > span"); if (bar) bar.style.width = (R.total ? (R.hechos / R.total) * 100 : 0) + "%";
    };
    const enDe = (id) => irrNorm((irrForma(id) || {}).en);
    // Repone hasta IRR_REC_LOTE casillas vacías a la vez, siempre en su mismo
    // lugar (nada se reordena ni se mueve). Si ya no quedan palabras en la
    // cola, esas casillas se quedan vacías.
    const recargarLote = () => {
      const tantos = Math.min(IRR_REC_LOTE, R.pendIzq.length);
      if (!tantos) return;
      const posIzq = R.pendIzq.splice(0, tantos);
      const posDer = R.pendDer.splice(0, tantos);
      for (let k = 0; k < tantos; k++) {
        const id = irrSacarDeCola(R, R.izq.concat(R.der));
        if (id == null) continue; // no hay más para cargar: se queda vacía
        R.izq[posIzq[k]] = id; R.der[posDer[k]] = id;
      }
      guardar();
      [["izq", posIzq], ["der", posDer]].forEach(([l, pos]) => pos.forEach((k) => {
        const viejo = celdaDe(l, k);
        if (!viejo) return;
        const id = l === "izq" ? R.izq[k] : R.der[k];
        const tmp = document.createElement("div");
        tmp.innerHTML = irrCelda(l, k, id, !!id);
        const nueva = tmp.firstElementChild;
        irrEnganchar(nueva);
        viejo.replaceWith(nueva);
        if (id) setTimeout(() => nueva.classList.remove("irr-aparece"), 1000);
      }));
    };
    const tocar = (b) => {
      if (ocupado || b.classList.contains("irr-aparece") || b.classList.contains("irr-vacia")) return;
      const lado = b.dataset.lado, i = parseInt(b.dataset.i, 10);
      const fTocada = irrForma(lado === "izq" ? R.izq[i] : R.der[i]);
      if (fTocada) irrHablar(fTocada.en);
      if (sel && sel.lado === lado) {
        celdaDe(sel.lado, sel.i)?.classList.remove("irr-sel");
        if (sel.i === i) { sel = null; return; }
        sel = { lado, i }; b.classList.add("irr-sel"); return;
      }
      if (!sel) { sel = { lado, i }; b.classList.add("irr-sel"); return; }
      // Segunda elección (del otro lado): se compara por el texto en inglés.
      const iz = sel.lado === "izq" ? sel.i : i;
      const de = sel.lado === "der" ? sel.i : i;
      const bIz = celdaDe("izq", iz), bDe = celdaDe("der", de);
      sel = null;
      if (enDe(R.izq[iz]) === enDe(R.der[de])) {
        ocupado = true;
        R.hechos += 1;
        bIz.classList.remove("irr-sel"); bDe.classList.remove("irr-sel");
        irrExplotar(bIz); irrExplotar(bDe);
        R.izq[iz] = null; R.der[de] = null;
        R.pendIzq.push(iz); R.pendDer.push(de);
        guardar();
        actualizarPie();
        setTimeout(() => {
          ocupado = false;
          if (!root.isConnected) return;
          [["izq", iz], ["der", de]].forEach(([l, k]) => {
            const viejo = celdaDe(l, k);
            if (!viejo) return;
            const tmp = document.createElement("div");
            tmp.innerHTML = irrCelda(l, k, null);
            const nueva = tmp.firstElementChild;
            irrEnganchar(nueva);
            viejo.replaceWith(nueva);
          });
          // Recién al juntar 4 parejas vacías (o si ya no queda nada en la
          // cola) se cargan nuevas palabras, siempre en los mismos huecos.
          if (R.pendIzq.length >= IRR_REC_LOTE || !R.cola.length) recargarLote();
          if (R.izq.every((x) => !x) && !R.cola.length) {
            setTimeout(() => irrRecTerminado(root, R, terminar, ctx), 450);
          }
        }, 380);
      } else {
        R.err += 1;
        R.total += 1;
        const fid = R.izq[iz];
        const f = irrForma(fid);
        if (f && !ctx.practica) irrStat(f.v).err += 1;
        R.cola.push(fid);
        guardar();
        [bIz, bDe].forEach((x) => { x.classList.remove("irr-sel"); x.classList.add("irr-mal"); });
        try { navigator.vibrate?.(60); } catch (e) { /* nada */ }
        setTimeout(() => [bIz, bDe].forEach((x) => x && x.classList.remove("irr-mal")), 520);
        actualizarPie();
      }
    };
    const irrCelda = (lado, i, id, aparece) => {
      if (!id) return `<button type="button" class="irr-tile irr-vacia" data-lado="${lado}" data-i="${i}" tabindex="-1" aria-hidden="true"></button>`;
      const f = irrForma(id);
      const txt = lado === "izq" ? `<span class="irr-en">${irrEsc(f.en)}</span>` : `<span class="irr-es">${irrEtiquetaEs(f)}</span>`;
      return `<button type="button" class="irr-tile${aparece ? " irr-aparece" : ""}" data-lado="${lado}" data-i="${i}">${txt}</button>`;
    };
    pintar();
    IRRV.limpiar = null;
  }

  // Saca la siguiente forma de la cola, evitando (si se puede) una que ya esté en el tablero.
  function irrSacarDeCola(R, enTablero) {
    if (!R.cola.length) return null;
    const ocupadas = new Set((enTablero || []).filter(Boolean).map((id) => irrNorm((irrForma(id) || {}).en)));
    let k = R.cola.findIndex((id) => !ocupadas.has(irrNorm((irrForma(id) || {}).en)));
    if (k < 0) k = 0;
    return R.cola.splice(k, 1)[0];
  }

  function irrExplotar(el) {
    if (!el) return;
    el.classList.add("irr-boom");
    const r = el.getBoundingClientRect();
    const host = document.body;
    const colores = ["#34d6a8", "#ff6f59", "#ffc65c", "#a99bff", "#fbf3e4"];
    for (let k = 0; k < 14; k++) {
      const p = document.createElement("span");
      p.className = "irr-chispa";
      const ang = (Math.PI * 2 * k) / 14 + Math.random() * 0.4;
      const dist = 40 + Math.random() * 46;
      p.style.left = (r.left + r.width / 2) + "px";
      p.style.top = (r.top + r.height / 2) + "px";
      p.style.background = colores[k % colores.length];
      p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
      p.style.setProperty("--dy", Math.sin(ang) * dist + "px");
      host.appendChild(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  function irrRecTerminado(root, R, terminar, ctx) {
    const precision = R.total ? Math.round(((R.total - R.err) / R.total) * 100) : 100;
    irrPantallaListo(root, {
      titulo: "¡Reconociste todo!",
      texto: `${R.total - R.err} parejas a la primera · ${R.err} ${R.err === 1 ? "repetida" : "repetidas"} · precisión ${precision}`,
      boton: ctx.reels ? "Seguir con Reels ⬆" : "Continuar",
      alTocar: terminar,
    });
  }

  function irrPantallaListo(root, o) {
    root.innerHTML = `
      <div class="irr-listo">
        <div class="irr-sello" aria-hidden="true"><i></i><i></i><i></i><b>✓</b></div>
        <h2 class="irr-h irr-h-xl">${o.titulo}</h2>
        <p class="irr-lead">${o.texto}</p>
        ${o.extra || ""}
        <button type="button" class="irr-btn irr-btn-main irr-listo-btn">${o.boton}</button>
      </div>`;
    if (typeof burstConfetti === "function") burstConfetti();
    root.querySelector(".irr-listo-btn").onclick = () => o.alTocar();
  }

  // ---------- 2. Seleccionar ----------
  function irrJugarSeleccionar(root, ses, guardar, terminar, ctx) {
    if (!ses.sel || !Array.isArray(ses.sel.items)) {
      ses.sel = { items: irrSelDeSesion(ses.paquete, ses.ciclo), idx: 0, ok: 0 };
      guardar();
    }
    const S = ses.sel;
    const pkg = ses.paquete;
    const desde = ses.tanda * IRR_SEL_POR;
    const hasta = Math.min(S.items.length, desde + IRR_SEL_POR);
    if (S.idx < desde) S.idx = desde;
    const pintar = () => {
      if (S.idx >= hasta) {
        const quedan = IRR_SEL_TANDAS - ses.tanda - 1;
        irrPantallaListo(root, {
          titulo: quedan ? "Tanda lista" : "¡Seleccionar completo!",
          texto: quedan
            ? `Llevas ${hasta} de ${S.items.length}. ${ctx.reels ? "La próxima tanda sale en 5 ejercicios." : "Faltan " + quedan + " tanda" + (quedan === 1 ? "" : "s") + "."}`
            : `Acertaste ${S.ok} de ${S.items.length}. ${ctx.reels ? "Completar llega en 15 ejercicios." : "Sigue Completar."}`,
          boton: ctx.reels ? "Seguir con Reels ⬆" : "Continuar",
          alTocar: terminar,
        });
        return;
      }
      const fid = S.items[S.idx];
      const it = irrSelItem(pkg, fid);
      if (!it) { S.idx += 1; guardar(); pintar(); return; }
      const f = irrForma(fid);
      const ops = shuffleArray(it.op);
      const n = S.idx - desde + 1;
      const enHTML = irrEsc(it.en).replace(/\[([^\[\]]+)\]/, `<span class="irr-hueco">&nbsp;</span>`);
      root.innerHTML = irrCabecera("Seleccionar", "Paquete " + pkg + " · " + (ses.tanda + 1) + "/" + IRR_SEL_TANDAS, ((n - 1) / (hasta - desde)) * 100) + `
        <div class="irr-sel-wrap">
          <div class="irr-paper">
            <span class="irr-step">${n} de ${hasta - desde}</span>
            <p class="irr-es-frase">${irrNegritas(it.es)}</p>
            <p class="irr-en-frase">${enHTML}</p>
          </div>
          <div class="irr-ops">${ops.map((o) => `<button type="button" class="irr-op" data-w="${irrEsc(o)}">${irrEsc(o)}</button>`).join("")}</div>
          <div class="irr-sel-foot" hidden>
            <span class="irr-forma ${IRR_FORMA_CLASE[f.i]}">${IRR_FORMA_NOMBRE[f.i]} de <b>${irrEsc(irrVerbo(f.v).f[0].en)}</b></span>
            <button type="button" class="irr-btn irr-ghost irr-oir" aria-label="Escuchar la frase">🔊</button>
            <button type="button" class="irr-btn irr-btn-main irr-sig">Siguiente →</button>
          </div>
        </div>`;
      const correcta = it.op[0];
      let respondida = false;
      root.querySelectorAll(".irr-op").forEach((b) => {
        b.onclick = () => {
          if (respondida) return;
          respondida = true;
          const ok = irrNorm(b.dataset.w) === irrNorm(correcta);
          root.querySelectorAll(".irr-op").forEach((x) => {
            if (irrNorm(x.dataset.w) === irrNorm(correcta)) x.classList.add("irr-op-ok");
            else if (x === b) x.classList.add("irr-op-mal");
            x.disabled = true;
          });
          const hueco = root.querySelector(".irr-hueco");
          if (hueco) { hueco.textContent = correcta; hueco.classList.add(ok ? "irr-hueco-ok" : "irr-hueco-mal"); }
          if (ok) S.ok += 1; else if (!ctx.practica) irrStat(f.v).err += 1;
          S.idx += 1;
          guardar();
          const foot = root.querySelector(".irr-sel-foot");
          foot.hidden = false;
          root.querySelector(".irr-oir").onclick = () => irrHablar(it.en.replace(/\[([^\[\]]+)\]/g, "$1"));
          root.querySelector(".irr-sig").onclick = pintar;
        };
      });
    };
    pintar();
  }

  // ---------- 3. Completar ----------
  function irrJugarCompletar(root, ses, guardar, terminar, ctx) {
    const grupos = irrGruposComp(ses.paquete);
    if (!ses.comp || typeof ses.comp.idx !== "number") { ses.comp = { idx: 0, ok: 0, total: 0 }; guardar(); }
    const C = ses.comp;
    const pkg = ses.paquete;
    const desde = ses.tanda * IRR_COMP_POR;
    const hasta = Math.min(grupos.length, desde + IRR_COMP_POR);
    if (C.idx < desde) C.idx = desde;
    const pintar = () => {
      if (C.idx >= hasta) {
        const ultima = ses.tanda + 1 >= IRR_COMP_TANDAS;
        if (ultima && !ctx.practica) {
          const pct = C.total ? Math.round((C.ok / C.total) * 100) : 100;
          const sig = pkg % 10 + 1;
          irrPantallaListo(root, {
            titulo: `¡Paquete ${pkg} completado!`,
            texto: `Completar: ${C.ok} de ${C.total} (${pct}). Por hoy no salen más irregulares. Mañana sigue el paquete ${sig}.`,
            extra: irrChipsVerbos(pkg),
            boton: ctx.reels ? "Seguir con Reels ⬆" : "Terminar",
            alTocar: terminar,
          });
        } else {
          irrPantallaListo(root, {
            titulo: ultima ? "¡Completar listo!" : "Tanda lista",
            texto: ultima ? "Práctica terminada." : (ctx.reels ? "La última tanda de Completar sale en 5 ejercicios." : "Falta 1 tanda."),
            boton: ctx.reels ? "Seguir con Reels ⬆" : "Continuar",
            alTocar: terminar,
          });
        }
        return;
      }
      const grupo = grupos[C.idx];
      const items = grupo.map((fid) => irrCompItem(pkg, fid)).filter(Boolean);
      const n = C.idx - desde + 1;
      root.innerHTML = irrCabecera("Completar", "Paquete " + pkg + " · " + (ses.tanda + 1) + "/" + IRR_COMP_TANDAS, ((n - 1) / (hasta - desde)) * 100) + `
        <p class="irr-lead">Escribe la forma correcta del verbo en cada frase.</p>
        <div class="irr-comp">
          ${items.map((it, k) => {
            const partes = it.en.split(/\[[^\[\]]+\]/);
            return `<div class="irr-paper irr-comp-row">
              <span class="irr-step">${k + 1}</span>
              <p class="irr-es-frase">${irrEsc(it.es)}</p>
              <p class="irr-en-frase">${irrEsc(partes[0])}<input class="irr-input" data-k="${k}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Verbo">${irrEsc(partes[1] || "")}</p>
              <p class="irr-correccion" hidden></p>
            </div>`;
          }).join("")}
        </div>
        <div class="irr-comp-foot">
          <span class="irr-step-big">${n}/${hasta - desde}</span>
          <button type="button" class="irr-btn irr-btn-main irr-check" disabled>Comprobar</button>
        </div>`;
      const inputs = Array.from(root.querySelectorAll(".irr-input"));
      const btn = root.querySelector(".irr-check");
      const ajustar = (inp) => { inp.style.width = Math.max(4, (inp.value || "").length + 1.5) + "ch"; };
      inputs.forEach((inp, k) => {
        ajustar(inp);
        inp.addEventListener("input", () => { ajustar(inp); btn.disabled = !inputs.every((x) => x.value.trim()); });
        inp.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (k < inputs.length - 1) inputs[k + 1].focus(); else if (!btn.disabled) btn.click();
        });
      });
      let revisado = false;
      btn.onclick = () => {
        if (revisado) { C.idx += 1; guardar(); pintar(); return; }
        revisado = true;
        let todos = true;
        items.forEach((it, k) => {
          const esperado = (it.en.match(/\[([^\[\]]+)\]/) || [])[1] || "";
          const inp = inputs[k];
          const ok = irrNorm(inp.value) === irrNorm(esperado);
          C.total += 1;
          if (ok) C.ok += 1; else { todos = false; if (!ctx.practica) irrStat(it.v).err += 1; }
          inp.readOnly = true;
          inp.classList.add(ok ? "irr-input-ok" : "irr-input-mal");
          const corr = root.querySelectorAll(".irr-correccion")[k];
          if (!ok) { corr.hidden = false; corr.innerHTML = `Era <b>${irrEsc(esperado)}</b> · ${irrEsc(it.en.replace(/\[([^\[\]]+)\]/g, "$1"))}`; }
        });
        guardar();
        btn.textContent = todos ? "¡Perfecto! Siguiente →" : "Siguiente →";
        btn.classList.toggle("irr-btn-ok", todos);
        if (todos) try { navigator.vibrate?.(30); } catch (e) { /* nada */ }
      };
      setTimeout(() => { if (inputs[0] && root.isConnected) inputs[0].focus({ preventScroll: true }); }, 120);
    };
    pintar();
  }

  function irrChipsVerbos(pkg) {
    return `<div class="irr-chips">${irrVerbosDe(pkg).map((v) => `<span class="irr-chip-v"><b>${irrEsc(v.f[0].en)}</b><i>${irrEsc(v.f[1].en)}</i><u>${irrEsc(v.f[2].en)}</u></span>`).join("")}</div>`;
  }

  // ---------- Práctica libre (no cuenta para la sesión) ----------
  function irrPracticaNueva(pkg, fase) {
    const s = irrEstado();
    return { paquete: pkg, ciclo: s.ciclo, fase, tanda: 0, practica: true, rec: null, sel: null, comp: null };
  }
  function irrPracticaAvanzar(p) {
    if (p.fase === "sel") { p.tanda += 1; if (p.tanda >= IRR_SEL_TANDAS) return { fin: true, practica: true }; return { fin: false }; }
    if (p.fase === "comp") { p.tanda += 1; if (p.tanda >= IRR_COMP_TANDAS) return { fin: true, practica: true }; return { fin: false }; }
    return { fin: true, practica: true };
  }

  // ---------- Tabla de veces estudiado ----------
  function irrTablaHTML(opts) {
    opts = opts || {};
    const s = irrEstado();
    const ses = s.ses;
    const filas = irrData().verbos.slice().sort((a, b) => a.rank - b.rank).map((v) => {
      const st = s.verbos[v.id] || { veces: 0, banco: 0, err: 0 };
      const actual = v.p === s.paquete;
      return `<tr class="${actual ? "irr-tr-hoy" : ""}">
        <td class="irr-td-p">${v.p}</td>
        <td class="irr-td-v"><b>${irrEsc(v.f[0].en)}</b> · <i>${irrEsc(v.f[1].en)}</i> · <u>${irrEsc(v.f[2].en)}</u></td>
        <td class="irr-td-n">${st.veces}</td>
        <td class="irr-td-n">${st.banco}</td>
        <td class="irr-td-n ${st.err ? "irr-td-err" : ""}">${st.err}</td>
      </tr>`;
    }).join("");
    return `
      <section class="irr-theme irr-tabla-box">
        <div class="irr-tabla-head">
          <div class="irr-logo irr-logo-sm" aria-hidden="true"><i></i><i></i><i></i></div>
          <div>
            <h3 class="irr-h irr-h-sm">Verbos irregulares</h3>
            <p class="irr-tabla-sub">Paquete ${s.paquete} de 10 · ciclo ${s.ciclo} · ${irrEsc(irrFaseTexto(ses))} · ${s.sesiones || 0} ${(s.sesiones || 0) === 1 ? "sesión" : "sesiones"}</p>
          </div>
        </div>
        <div class="irr-tabla-scroll${opts.alta ? " irr-tabla-alta" : ""}">
          <table class="irr-tabla">
            <thead><tr><th>Paq</th><th>Verbo</th><th title="Sesiones completadas">Veces</th><th title="Ejercicios del banco hechos">Banco</th><th title="Errores en la sección">Err</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <p class="irr-tabla-nota">Veces = sesiones completadas del paquete · Banco = traducciones/completar del 25 % · Err = fallos en reconocimiento, seleccionar y completar.</p>
      </section>`;
  }

  // ---------- Pantalla de la sección (menú / inicio) ----------
  function openIrregulares() {
    if (!irrDisponible()) { toast("🔁 Irregulares solo está disponible en inglés"); return; }
    let ov = document.getElementById("irrOverlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "irrOverlay";
      ov.className = "irr-overlay irr-theme";
      document.body.appendChild(ov);
    }
    ov.hidden = false;
    document.body.classList.add("irr-open");
    irrPintarInicio(ov);
  }

  function closeIrregulares() {
    const ov = document.getElementById("irrOverlay");
    irrLimpiar();
    if (ov) { ov.hidden = true; ov.innerHTML = ""; }
    document.body.classList.remove("irr-open");
  }

  function irrMarco(ov, contenido) {
    ov.innerHTML = `
      <div class="irr-bg-deco" aria-hidden="true"><span></span><span></span><span></span></div>
      <button type="button" class="irr-cerrar" aria-label="Cerrar Irregulares">✕</button>
      <div class="irr-scroll"><div class="irr-wrap">${contenido}</div></div>`;
    ov.querySelector(".irr-cerrar").onclick = closeIrregulares;
    return ov.querySelector(".irr-wrap");
  }

  function irrPintarInicio(ov) {
    irrLimpiar();
    const s = irrEstado();
    const hecha = irrHechaHoy();
    const ses = irrSesion(false);
    const pkg = ses ? ses.paquete : s.paquete;
    const pasos = [
      { k: "rec", t: "Reconocimiento", d: "60 parejas · inglés ↔ español" },
      { k: "sel", t: "Seleccionar", d: "15 frases · 3 tandas" },
      { k: "comp", t: "Completar", d: "30 frases · 10 grupos de 3" },
    ];
    const orden = { rec: 0, sel: 1, comp: 2 };
    const actual = ses ? orden[ses.fase] : (hecha ? 3 : 0);
    const detalle = (k) => {
      if (!ses || orden[ses.fase] !== orden[k]) return "";
      if (k === "sel") return ` · tanda ${ses.tanda + 1}/${IRR_SEL_TANDAS}`;
      if (k === "comp") return ` · tanda ${ses.tanda + 1}/${IRR_COMP_TANDAS}`;
      return ses.rec ? ` · ${ses.rec.hechos}/${ses.rec.total}` : "";
    };
    const proxReels = ses && !ses.listo ? Math.max(0, irrUmbral(ses) - (ses.cont || 0)) : 0;
    const wrap = irrMarco(ov, `
      <header class="irr-hero">
        <div class="irr-logo irr-logo-xl" aria-hidden="true"><i></i><i></i><i></i></div>
        <p class="irr-kicker">Verbos irregulares · inglés americano</p>
        <h1 class="irr-title">Irregulares</h1>
        <p class="irr-hero-sub">${hecha ? "Hoy ya cumpliste. Mañana toca el paquete " + s.paquete + "." : "Paquete " + pkg + " de 10 · ciclo " + s.ciclo}</p>
      </header>
      <section class="irr-panel">
        <div class="irr-panel-head"><span class="irr-kicker">${hecha ? "Mañana" : "Hoy"}</span><b>Paquete ${hecha ? s.paquete : pkg}</b></div>
        ${irrChipsVerbos(hecha ? s.paquete : pkg)}
      </section>
      <ol class="irr-path">
        ${pasos.map((p, i) => `<li class="irr-path-step ${i < actual ? "is-done" : i === actual ? "is-now" : ""}">
            <span class="irr-path-dot">${i < actual ? "✓" : i + 1}</span>
            <span class="irr-path-txt"><b>${p.t}</b><small>${p.d}${detalle(p.k)}</small></span>
          </li>`).join("")}
      </ol>
      ${hecha
        ? `<div class="irr-done-note">✓ Sesión de hoy completada</div>
           <button type="button" class="irr-btn irr-btn-alt irr-practicar">Practicar el paquete ${s.log.length ? s.log[s.log.length - 1].p : pkg} (no cuenta)</button>`
        : `<button type="button" class="irr-btn irr-btn-main irr-go">${ses && (ses.fase !== "rec" || ses.rec) ? "Continuar sesión" : "Empezar sesión"} →</button>
           <p class="irr-hint">${ses && proxReels ? "En Reels, la próxima parte sale en " + proxReels + " ejercicio" + (proxReels === 1 ? "" : "s") + ". Aquí la puedes hacer ya." : "Lo que hagas aquí cuenta igual que en Reels."}</p>`}
      ${irrTablaHTML({ alta: true })}
    `);
    wrap.querySelector(".irr-go")?.addEventListener("click", () => { irrSesion(); irrJugarEnOverlay(ov); });
    wrap.querySelector(".irr-practicar")?.addEventListener("click", () => {
      const p = s.log.length ? s.log[s.log.length - 1].p : pkg;
      irrPracticaMenu(ov, p);
    });
  }

  function irrJugarEnOverlay(ov) {
    irrLimpiar();
    const wrap = irrMarco(ov, `<div class="irr-juego"></div>`);
    const host = wrap.querySelector(".irr-juego");
    ov.querySelector(".irr-scroll").scrollTop = 0;
    irrCorrerParte(host, {
      reels: false,
      alTerminar: (r) => {
        if (r && r.fin) { irrPintarInicio(ov); toast("🎉 Paquete " + r.paquete + " completado"); return; }
        if (r && r.vacio) { irrPintarInicio(ov); return; }
        irrJugarEnOverlay(ov);
      },
    });
  }

  function irrPracticaMenu(ov, pkg) {
    const wrap = irrMarco(ov, `
      ${irrCabecera("Práctica libre", "Paquete " + pkg)}
      <p class="irr-lead">No cuenta para la sesión ni para la tabla. Elige qué repasar:</p>
      <div class="irr-practica-ops">
        <button type="button" class="irr-btn irr-btn-alt" data-f="rec">Reconocimiento</button>
        <button type="button" class="irr-btn irr-btn-alt" data-f="sel">Seleccionar</button>
        <button type="button" class="irr-btn irr-btn-alt" data-f="comp">Completar</button>
      </div>
      <button type="button" class="irr-btn irr-ghost irr-volver">← Volver</button>`);
    wrap.querySelector(".irr-volver").onclick = () => irrPintarInicio(ov);
    wrap.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => {
      const p = irrPracticaNueva(pkg, b.dataset.f);
      const correr = () => {
        const w = irrMarco(ov, `<div class="irr-juego"></div>`);
        irrCorrerParte(w.querySelector(".irr-juego"), {
          practica: p, reels: false,
          alTerminar: (r) => { if (r && r.fin) irrPracticaMenu(ov, pkg); else correr(); },
        });
      };
      correr();
    });
  }

  function irrCambioDeIdioma() {
    const ov = document.getElementById("irrOverlay");
    if (ov && !ov.hidden) closeIrregulares();
  }