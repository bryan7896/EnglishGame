// ==================== REELS (sorpresas) ====================
  // 1 yt       → clip real de YouGlish (va aparte: cada 3-6 ejercicios, ver rlDecidirSiguiente)
  // Las demás salen cada 2-15 tarjetas. "Elige reglas" es obligatoria solo con
  // el banco por debajo de RL_MIN_OBLIGATORIO; si no, compite con peso bajo.
  // 2 pct      → todas las reglas con su % y botón de estadística, más la tabla de irregulares
  // 3 reglas   → elige X reglas: rellena el banco hasta RL_BANCO
  // 4 reporte  → copiar informe (cada 60-70 ejercicios) + agregar JSON
  // 5 historia → misma historia 4 veces (3 leyendo, la 4ª solo audio)
  // 6 listening → 3 ejercicios seguidos del Nivel 1 de Listening (mismo avance que el módulo)
  // 8 irr      → partes de la sesión de Irregulares (no compite: sale por sus contadores,
  //              ver irrDecidirSorpresa en irregulares/irregulares.js)
  const RL_PESOS = { listening: 35, historia: 30, pct: 20, reglas: 10 };
  const RL_LISTENING_N = 3;
  const RL_APORTE = { bad: 10, warn: 7, good: 5 };
  const RL_MAX_VOTOS_REGLA = 3; // tope de casillas marcables por regla en "Elige qué estudiar"

  function rlElegirSorpresa() {
    // El informe manda: si ya toca (o quedó pendiente) y hay algo listo.
    const listo = rlReporteListo().listos.length > 0;
    if (listo && (RL.reporte.pendiente || RL.cont.reporte >= RL.cont.proxReporte)) return "reporte";
    if (!listo && RL.cont.reporte >= RL.cont.proxReporte) RL.cont.proxReporte = RL.cont.reporte + 10;

    if (rlContarBanco() < RL_MIN_OBLIGATORIO && (rlReglasDisponibles().length || RL.reserva.length)) return "reglas";

    const cands = [];
    if (getTargetLanguage() === "en" && typeof n1ReelsDisponible === "function" && n1ReelsDisponible()) cands.push("listening");
    if (rlHistoriaSiguiente()) cands.push("historia");
    if (AppRules.length) cands.push("pct");
    if (rlContarBanco() < RL_BANCO && (rlReglasDisponibles().length || RL.reserva.length)) cands.push("reglas");
    let lista = cands.filter((t) => t !== RL.ultSorpresa);
    if (!lista.length) lista = cands;
    if (!lista.length) return null;
    const total = lista.reduce((s, t) => s + RL_PESOS[t], 0);
    let r = Math.random() * total;
    for (const t of lista) { r -= RL_PESOS[t]; if (r <= 0) return t; }
    return lista[lista.length - 1];
  }

  function rlSorpresaHecha(item) {
    RL.ultSorpresa = item.tipo;
    rlGuardar();
    rlSiguiente();
  }

  function rlRenderSorpresa(item, body) {
    switch (item.tipo) {
      case "reglas": return rlRenderReglas(item, body);
      case "pct": return rlRenderPct(item, body);
      case "reporte": return rlRenderReporte(item, body);
      case "historia": return rlRenderHistoria(item, body);
      case "yt": return rlRenderYT(item, body);
      case "listening": return rlRenderListening(item, body);
      case "azure": return rlRenderAzure(item, body);
      case "irr": return irrRenderSorpresaReels(item, body);
      default: setTimeout(rlSiguiente, 0);
    }
  }

  // ---------- Reglas (para 2 y 3) ----------
  function rlReglasConPct() { return AppRules.filter((r) => r.porcentaje > 0); }
  function rlReglasDisponibles() { return AppRules.filter((r) => rlEjerciciosDeRegla(r.id).length > 0); }

  function rlFilaRegla(r, extra) {
    const tier = r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad";
    return `
      <span class="rule-card-body">
        <span class="rule-card-top">
          <span class="rule-select-text">${rlEsc(r.regla)}</span>
          <span class="rule-pct-badge tier-${tier}">${r.porcentaje > 0 ? r.porcentaje + "%" : "Nueva"}</span>
        </span>
        <span class="rule-pct-bar" role="presentation"><span class="rule-pct-bar-fill tier-${tier}" style="width:${r.porcentaje}%"></span></span>
        ${extra || ""}
      </span>`;
  }

  // ---------- 2. Porcentajes: TODAS las reglas + tabla de irregulares ----------
  // Lista completa (de mayor a menor %, las que aún no tienen registro al final)
  // con el botón 📊 de estadística en cada una. Debajo, en inglés, la tabla de
  // veces que se ha estudiado cada verbo irregular.
  function rlTodasConOrden() {
    return AppRules.slice().sort((a, b) => (b.porcentaje || 0) - (a.porcentaje || 0) || a.id - b.id);
  }

  function rlRenderPct(item, body) {
    const pintar = () => {
      const reglas = rlTodasConOrden();
      const cuenta = { good: 0, warn: 0, bad: 0, nueva: 0 };
      reglas.forEach((r) => { if (r.porcentaje > 0) cuenta[pctTier(r.porcentaje)]++; else cuenta.nueva++; });
      const fila = (r) => `<div class="rule-card tier-${r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad"} percentages-row">${rlFilaRegla(r)}
              <button type="button" class="rule-stats-btn" data-id="${r.id}" title="Ver estadísticas">📊</button></div>`;
      const conPct = reglas.filter((r) => r.porcentaje > 0);
      const sinPct = reglas.filter((r) => !(r.porcentaje > 0));
      body.innerHTML = rlCabecera(["📊 Tu avance", reglas.length + " reglas"]) + `
        <div class="rl-sorpresa rl-pct rl-pct-todas">
          <h2 class="rl-title">Así vas en tus reglas</h2>
          <div class="rl-pct-resumen">
            <span class="tier-good">● ${cuenta.good} verdes</span>
            <span class="tier-warn">● ${cuenta.warn} naranjas</span>
            <span class="tier-bad">● ${cuenta.bad} rojas</span>
            ${cuenta.nueva ? `<span>○ ${cuenta.nueva} sin registro</span>` : ""}
          </div>
          <div class="rules-select-list">
            ${conPct.map(fila).join("")}
            ${sinPct.length ? `<p class="rl-pct-sep">Sin registro todavía</p>` + sinPct.map(fila).join("") : ""}
          </div>
          ${typeof irrDisponible === "function" && irrDisponible() ? irrTablaHTML() : ""}
          <button class="fun-btn primary-btn full-width rl-continuar">Continuar ⬆</button>
        </div>`;
      body.querySelectorAll(".rule-stats-btn").forEach((b) => b.onclick = () => showRuleStatsModal(parseInt(b.dataset.id, 10)));
      body.querySelector(".rl-continuar").onclick = () => rlSorpresaHecha(item);
    };
    pintar();
    // Si los % todavía se están consultando, se repinta cuando lleguen.
    if (!RLV.syncListo && RLV.sync) RLV.sync.then(() => { if (RL.cur === item && body.isConnected) pintar(); });
  }

  // ---------- 3. Elegir reglas (rellena el banco) ----------
  // Reglas del día: qué se mostró y qué se eligió hoy (se reinicia a medianoche).
  function rlReglasDia() {
    const hoy = new Date().toLocaleDateString("en-CA");
    if (!RL.reglasDia || RL.reglasDia.fecha !== hoy) RL.reglasDia = { fecha: hoy, veces: 0, mostradas: [], elegidas: [] };
    RL.reglasEstudio = RL.reglasEstudio || {};
    RL.reglasDia.elegidas.forEach((id) => { if (!RL.reglasEstudio[id]) RL.reglasEstudio[id] = RL.reglasDia.fecha; });
    return RL.reglasDia;
  }

  // Qué reglas ofrecer (todas las que cumplan, ordenadas rojas → naranjas → verdes → 0 %):
  //  - Solo reglas que NO se estudiaron (eligieron) en los últimos 3 días: hoy,
  //    ayer y anteayer. Así tampoco se repite lo que ya estudiaste hoy.
  //  - Las que se mostraron y no elegiste pueden volver a salir más tarde.
  //  - En el día: máximo 1 regla en 0 % y 2 verdes en total.
  //  - Si así no alcanza para lo que hay que elegir, se completa con las que
  //    se estudiaron hace más tiempo.
  function rlFechaMenosDias(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("en-CA"); }
  function rlEstudiadaReciente(id) {
    const f = (RL.reglasEstudio || {})[id];
    return !!f && f >= rlFechaMenosDias(2);
  }
  function rlReglasParaElegir() {
    const disp = rlReglasDisponibles();
    const conPct = disp.filter((r) => r.porcentaje > 0).sort((a, b) => a.porcentaje - b.porcentaje);
    const rojas = conPct.filter((r) => pctTier(r.porcentaje) === "bad");
    const naranjas = conPct.filter((r) => pctTier(r.porcentaje) === "warn");
    const verdes = conPct.filter((r) => pctTier(r.porcentaje) === "good");
    const nuevas = disp.filter((r) => r.porcentaje <= 0);
    return [].concat(rojas, naranjas, verdes, nuevas);
  }

  function rlAporte(r) { return RL_APORTE[r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad"]; }

  function rlRenderReglas(item, body) {
    if (item.manual == null && !RLV.syncListo && RLV.sync) {
      body.innerHTML = rlCabecera(["🎯 Elige qué estudiar"]) + `<p class="rl-sub" style="margin-top:30vh;text-align:center;">Consultando tus porcentajes…</p>`;
      RLV.sync.then(() => { if (RL.cur === item && body.isConnected) rlRenderReglas(item, body); });
      return;
    }
    const deficit = Math.max(0, RL_BANCO - rlContarBanco());
    if (item.manual == null) {
      const reglas = rlReglasDisponibles();
      let m = 0;
      if (RL.reserva.length && deficit > 0) {
        m = reglas.length ? Math.min(RL.reserva.length, Math.max(1, Math.round(deficit * RL_PARTE_MANUAL))) : Math.min(RL.reserva.length, deficit);
      }
      item.manual = m;
      item.sistema = reglas.length ? Math.max(0, deficit - m) : 0;
      // Irregulares: el 25 % de lo que se carga sale del banco de irregulares del
      // paquete del día (de las reglas que elijas). Se descuenta de la parte del sistema.
      item.irr = typeof irrCupoRecarga === "function" ? Math.min(item.sistema, irrCupoRecarga(item.manual + item.sistema)) : 0;
      const xDeseado = item.sistema > 0 ? Math.max(1, Math.round(item.sistema / 8)) : 0;
      item.reglas = rlReglasParaElegir().map((r) => r.id);
      item.x = xDeseado ? Math.min(item.reglas.length * RL_MAX_VOTOS_REGLA, xDeseado) : 0;
      if (item.reglas.length) {
        const dia = rlReglasDia();
        dia.veces += 1;
        item.reglas.forEach((id) => {
          if (dia.mostradas.includes(id)) return;
          dia.mostradas.push(id);
          const r = findRegla(id);
          if (r && r.porcentaje <= 0) dia.ceros = (dia.ceros || 0) + 1;
          else if (r && pctTier(r.porcentaje) === "good") dia.verdes = (dia.verdes || 0) + 1;
        });
      }
      rlGuardar();
    }
    const sel = new Map(); // reglaId -> casillas marcadas (1..RL_MAX_VOTOS_REGLA)
    const totalSel = () => { let t = 0; sel.forEach((n) => (t += n)); return t; };
    const reglas = item.reglas.map((id) => findRegla(id)).filter(Boolean);
    const vacio = !item.manual && !item.sistema;

    const titulo = item.x
      ? `Selecciona <b>${item.x}</b> regla${item.x === 1 ? "" : "s"}`
      : (item.manual ? "Entran ejercicios tuyos" : "Tu banco está lleno");
    const subt = [
      item.sistema ? `El sistema cargará <b>${item.sistema}</b> ejercicio${item.sistema === 1 ? "" : "s"} repartidos entre las que elijas${item.irr ? ` (<b>${item.irr}</b> con verbos irregulares del paquete ${irrEstado().paquete})` : ""}.` : "",
      item.manual ? `<b>${item.manual}</b> ejercicio${item.manual === 1 ? "" : "s"} de tu reserva manual entran también.` : "",
      item.x ? `Marca hasta ${RL_MAX_VOTOS_REGLA} casillas en una misma regla para que reciba más de esos ejercicios.` : "",
      vacio ? (rlReglasDisponibles().length ? "No hace falta cargar nada por ahora." : "No hay ejercicios disponibles en el banco del sistema para este idioma. Agrega ejercicios desde el menú (📥).") : "",
    ].filter(Boolean).join(" ");

    body.innerHTML = rlCabecera(["🎯 Elige qué estudiar"]) + `
      <div class="rl-sorpresa rl-reglas">
        <h2 class="rl-title">${titulo}</h2>
        <p class="rl-sub">${subt}</p>
        ${item.x ? `<div class="rules-select-list">
          ${reglas.map((r) => {
            const tier = r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad";
            return `<div class="rule-card rule-select-row tier-${tier}" data-id="${r.id}">
              <div class="rule-check-group" role="group" aria-label="Cantidad de ejercicios para ${rlEsc(r.regla)}">
                ${[1, 2, 3].map((n) => `<label class="rule-check-item"><input type="checkbox" class="rule-select-checkbox" data-id="${r.id}" data-n="${n}"><span class="rule-check" aria-hidden="true">${n}</span></label>`).join("")}
              </div>
              ${rlFilaRegla(r, `<span class="rule-card-bottom"><span class="rule-select-count">${r.porcentaje > 0 ? "" : "💡 Incluye lección de información · "}${rlEjerciciosDeRegla(r.id).length} ejercicios</span></span>`)}
            </div>`;
          }).join("")}
        </div>` : ""}
        <div class="rl-reglas-foot">
          ${item.x ? `<span class="rl-contador"><b class="rl-sel-n">0</b>/${item.x}</span>` : ""}
          <button class="fun-btn primary-btn rl-cargar" ${item.x ? "disabled" : ""}>${vacio ? "Continuar ⬆" : "➕ Cargar ejercicios"}</button>
        </div>
      </div>`;

    const btn = body.querySelector(".rl-cargar");
    const actualizarUI = () => {
      body.querySelectorAll(".rule-select-row").forEach((row) => {
        const id = parseInt(row.dataset.id, 10);
        row.classList.toggle("rule-row-checked", (sel.get(id) || 0) > 0);
      });
      const t = totalSel();
      body.querySelector(".rl-sel-n").textContent = t;
      btn.disabled = t !== item.x;
    };
    body.querySelectorAll(".rule-select-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = parseInt(cb.dataset.id, 10);
        const n = parseInt(cb.dataset.n, 10);
        const actual = sel.get(id) || 0;
        // Checkboxes tipo "rating": marcar la casilla N sube el nivel de esa regla a
        // N; desmarcarla lo baja a N-1. Siempre se sincronizan las 3 casillas de la fila.
        const nuevo = cb.checked ? n : n - 1;
        const delta = nuevo - actual;
        if (delta > 0 && totalSel() + delta > item.x) {
          cb.checked = actual >= n;
          toast("Solo " + item.x + " regla" + (item.x === 1 ? "" : "s") + " en total");
          return;
        }
        if (nuevo > 0) sel.set(id, nuevo); else sel.delete(id);
        body.querySelectorAll(`.rule-select-checkbox[data-id="${id}"]`).forEach((otra) => {
          otra.checked = parseInt(otra.dataset.n, 10) <= nuevo;
        });
        actualizarUI();
      });
    });
    btn.onclick = () => {
      if (item.x && totalSel() !== item.x) return;
      const dia = rlReglasDia();
      RL.reglasEstudio = RL.reglasEstudio || {};
      sel.forEach((n, id) => { if (!dia.elegidas.includes(id)) dia.elegidas.push(id); RL.reglasEstudio[id] = rlReglasDia().fecha; });
      const n = rlCargarBanco(item, Array.from(sel, ([id, n]) => ({ id, n })));
      if (n) { burstConfetti(); toast("➕ " + n + " ejercicios nuevos en tu banco"); }
      rlSorpresaHecha(item);
    };
  }

  // Reparte item.sistema entre las reglas elegidas según su color y la cantidad de
  // casillas marcadas en cada una (1-3: más casillas = más peso), mínimo 5 c/u.
  function rlCargarBanco(item, selecciones) {
    let total = 0;
    const nuevas = [];
    const frente = [];
    if (item.manual) {
      RL.reserva.splice(0, item.manual).forEach((e) => nuevas.push(rlItemEx(e, "man")));
      total += item.manual;
    }
    const ids = selecciones.map((s) => s.id);
    let irrN = 0;
    if (item.irr && typeof irrTomarParaRecarga === "function") {
      const irrEjs = irrTomarParaRecarga(item.irr, ids);
      irrEjs.forEach((e) => nuevas.push(rlItemEx(e, "irr")));
      irrN = irrEjs.length;
      total += irrN;
    }
    const sistema = Math.max(0, (item.sistema || 0) - irrN);
    if (selecciones.length && sistema) {
      const entradas = selecciones.map(({ id, n }) => ({ r: findRegla(id), n: Math.max(1, n || 1) })).filter((e) => e.r);
      const suma = entradas.reduce((s, e) => s + rlAporte(e.r) * e.n, 0) || 1;
      const elegidos = new Set();
      const infoHecha = new Set();
      entradas.forEach(({ r, n }) => {
        const cant = Math.max(RL_MIN_POR_REGLA, Math.round(sistema * rlAporte(r) * n / suma));
        const ejs = rlTomarDeRegla(r.id, cant, elegidos);
        ejs.forEach((e) => nuevas.push(rlItemEx(e, "sys")));
        total += ejs.length;
        if (r.porcentaje <= 0 && !infoHecha.has(r.id)) { infoHecha.add(r.id); rlLeccionesDe(r.id).forEach((_, idx) => frente.push({ k: "info", uid: rlUid(), reglaId: r.id, idx })); }
      });
    }
    rlMezclarEnBanco(nuevas, frente);
    rlGuardar();
    return total;
  }

  // ---------- 4. Informe ----------
  function rlRenderReporte(item, body) {
    const rep = rlConstruirReporte();
    const pend = rlReporteListo().pendientes;
    body.innerHTML = rlCabecera(["📋 Informe"]) + `
      <div class="rl-sorpresa rl-reporte">
        <h2 class="rl-title">Hora de tu informe</h2>
        <p class="rl-sub"><b>${rep.total}</b> ejercicios en <b>${rep.grupos}</b> regla${rep.grupos === 1 ? "" : "s"} (mínimo ${RL_MIN_POR_REGLA} por regla). ${pend.length ? pend.length + " regla(s) con menos de " + RL_MIN_POR_REGLA + " quedan para el próximo." : ""}</p>
        <textarea class="report rl-report-text" rows="9" readonly></textarea>
        <div class="rl-rep-btns">
          <button class="fun-btn primary-btn rl-copiar">📋 Copiar reporte</button>
          <button class="fun-btn rl-pegado" disabled>✅ Ya lo pegué</button>
        </div>
        <button class="fun-btn full-width rl-luego">⏭ Más tarde</button>
        ${RL.reporte.ultimoTexto ? `<button class="fun-btn full-width rl-ultimo">📄 Copiar el informe anterior</button>` : ""}
        <details class="rl-json-details">
          <summary>📥 Agregar ejercicios propios (JSON)</summary>
          <p class="rl-mini">En reserva: <b class="rl-res-n">${RL.reserva.length}</b>. Entran 30 tuyos por cada 20 del sistema.</p>
          <div class="rl-json-wrap">${rlFormAgregarHTML()}</div>
        </details>
      </div>`;
    body.querySelector(".rl-report-text").value = rep.texto;
    const copiar = (txt) => {
      const ok = () => toast("📋 Informe copiado");
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => { rlCopiaManual(body, txt); });
      else rlCopiaManual(body, txt);
    };
    body.querySelector(".rl-copiar").onclick = () => { copiar(rep.texto); body.querySelector(".rl-pegado").disabled = false; };
    body.querySelector(".rl-pegado").onclick = () => {
      rlReporteConfirmado(rep.rids, rep.texto);
      burstConfetti();
      toast("🧹 Informe entregado. ¡A seguir!");
      rlSorpresaHecha(item);
    };
    body.querySelector(".rl-luego").onclick = () => { RL.reporte.pendiente = true; rlSorpresaHecha(item); };
    body.querySelector(".rl-ultimo")?.addEventListener("click", () => copiar(RL.reporte.ultimoTexto));
    rlWireAgregar(body.querySelector(".rl-json-wrap"), (r) => { const n = body.querySelector(".rl-res-n"); if (n) n.textContent = r.reserva; });
  }

  function rlCopiaManual(body, txt) {
    const ta = body.querySelector(".rl-report-text");
    try { ta.value = txt; ta.removeAttribute("readonly"); ta.select(); document.execCommand("copy"); ta.setAttribute("readonly", ""); toast("📋 Informe copiado"); }
    catch (e) { toast("📋 Cópialo a mano desde el cuadro"); }
  }

  // ---------- 5. Historias ----------
  function rlHistorias() { return (HISTORIAS_BY_LANG[getTargetLanguage()] || []).filter((h) => h && h.id && Array.isArray(h.preguntas) && h.preguntas.length >= 4); }

  function rlHistoriaSiguiente() {
    const todas = rlHistorias();
    if (RL.historias.activa) {
      const h = todas.find((x) => x.id === RL.historias.activa.id);
      if (h) return { h, lectura: RL.historias.activa.lectura };
      RL.historias.activa = null;
    }
    const libres = todas.filter((h) => !RL.historias.usadas.includes(h.id));
    if (!libres.length) return null;
    return { h: libres[0], lectura: 0 };
  }

  function rlRenderHistoria(item, body) {
    const sig = rlHistoriaSiguiente();
    if (!sig) { setTimeout(() => rlSorpresaHecha(item), 0); return; }
    const { h, lectura } = sig;
    if (!RL.historias.activa) { RL.historias.activa = { id: h.id, lectura: 0 }; rlGuardar(); }
    const p = h.preguntas[lectura];
    const soloAudio = lectura === 3;
    const parrafos = String(h.story || "").split(/\n+/).filter(Boolean).map((t) => `<p>${rlEsc(t)}</p>`).join("");
    const letras = ["a", "b", "c", "d"];
    body.innerHTML = rlCabecera(["📖 " + rlEsc(h.id), "Lectura " + (lectura + 1) + "/4"]) + `
      <div class="rl-sorpresa rl-historia">
        ${h.titulo ? `<h2 class="rl-title">${rlEsc(h.titulo)}</h2>` : ""}
        ${soloAudio
          ? `<div class="rl-hist-audio"><p class="rl-sub">Esta vez no hay texto: escucha la historia.</p>
               <button class="fun-btn primary-btn rl-hist-play">🔊 Escuchar historia</button>
               <button class="fun-btn rl-hist-stop">⏹ Parar</button></div>`
          : `<div class="rl-hist-texto">${parrafos}</div>`}
        <div class="rl-hist-q">${rlEsc(p.q)}</div>
        <div class="rl-hist-ops">
          ${p.opciones.map((o, i) => `<button class="rl-op" data-i="${i}"><span class="rl-op-l">${letras[i]}</span> ${rlEsc(o)}</button>`).join("")}
        </div>
        <div class="rl-hist-foot">
          <button class="fun-btn rl-omitir">⏭ Omitir</button>
          <button class="fun-btn primary-btn rl-continuar" hidden>Continuar ⬆</button>
        </div>
      </div>`;
    if (soloAudio) {
      const play = () => speakDictado(h.story);
      body.querySelector(".rl-hist-play").onclick = play;
      body.querySelector(".rl-hist-stop").onclick = () => window.speechSynthesis?.cancel();
      setTimeout(play, 400);
      RLV.limpiar = () => window.speechSynthesis?.cancel();
    }
    let respondida = false;
    body.querySelectorAll(".rl-op").forEach((b) => {
      b.onclick = () => {
        if (respondida) return;
        respondida = true;
        const i = parseInt(b.dataset.i, 10);
        const ok = i === p.correcta;
        body.querySelectorAll(".rl-op").forEach((x) => {
          const xi = parseInt(x.dataset.i, 10);
          if (xi === p.correcta) x.classList.add("rl-op-ok");
          else if (xi === i) x.classList.add("rl-op-bad");
          x.disabled = true;
        });
        toast(ok ? "🎉 ¡Correcto!" : "👀 Era la " + letras[p.correcta]);
        if (ok) burstConfetti();
        RL.historias.activa.lectura = lectura + 1;
        if (RL.historias.activa.lectura >= 4) {
          RL.historias.usadas.push(h.id);
          RL.historias.activa = null;
        }
        rlGuardar();
        body.querySelector(".rl-omitir").hidden = true;
        body.querySelector(".rl-continuar").hidden = false;
      };
    });
    body.querySelector(".rl-omitir").onclick = () => rlSorpresaHecha(item);
    body.querySelector(".rl-continuar").onclick = () => rlSorpresaHecha(item);
  }

  // ---------- 6. Listening (Nivel 1) ----------
  function rlRenderListening(item, body) {
    if (item.restantes == null) { item.restantes = RL_LISTENING_N; rlGuardar(); }
    body.innerHTML = rlCabecera(["🎧 Listening", `<span class="rl-l-bloque"></span>`]) +
      `<div class="rl-listening"><div class="rl-listen-host"></div></div>`;
    const chip = body.querySelector(".rl-l-bloque");
    // El motor de Listening usa ids del documento: se arranca cuando la tarjeta ya está en pantalla.
    setTimeout(() => {
    if (!body.isConnected || RL.cur !== item) return;
    const ok = n1ReelsIniciar(body.querySelector(".rl-listen-host"), item.restantes, {
      cuenta: (n) => { item.restantes = Math.max(0, n); rlSumarDia("listening"); rlGuardar(); },
      bloque: (b, fase) => { if (chip) chip.textContent = "Bloque " + b + " · " + (N1_FASE_LABEL[fase] || fase); },
      fin: () => { RLV.limpiar = null; rlSorpresaHecha(item); },
    });
    if (!ok) { rlSorpresaHecha(item); return; }
    RLV.limpiar = () => n1ReelsSoltar();
    }, 0);
  }

  // ---------- 7. Azure (curso AI-901 en azure/) ----------
  // Los ajustes y el contador del día los comparte con el curso (mismo origen):
  // ai901_reels_cfg (se edita en ⚙️ Ajustes del curso) y ai901_reels_dia.
  const RL_AZ_DEF = { conceptos: true, secciones: false, seccionId: "1.1", porTanda: 3, maxDia: 8, cada: 8 };
  function rlAzureCfg() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem("ai901_reels_cfg") || "{}") || {}; } catch (e) { c = {}; }
    const cfg = Object.assign({}, RL_AZ_DEF, c);
    const ent = (v, d, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d; };
    cfg.porTanda = ent(cfg.porTanda, 3, 1, 20);
    cfg.maxDia = ent(cfg.maxDia, 8, 1, 50);
    cfg.cada = ent(cfg.cada, 8, 2, 50);
    cfg.conceptos = !!cfg.conceptos;
    cfg.secciones = !cfg.conceptos && !!cfg.secciones;
    return cfg;
  }
  function rlAzureDia() {
    const hoy = new Date().toLocaleDateString("en-CA");
    let d = null;
    try { d = JSON.parse(localStorage.getItem("ai901_reels_dia") || "null"); } catch (e) { d = null; }
    return d && d.fecha === hoy ? d : { fecha: hoy, n: 0 };
  }
  function rlAzureSumarDia() {
    const d = rlAzureDia();
    d.n += 1;
    try { localStorage.setItem("ai901_reels_dia", JSON.stringify(d)); } catch (e) { /* nada */ }
    return d;
  }

  function rlRenderAzure(item, body) {
    if (!item.restantes || item.restantes < 1) item.restantes = rlAzureCfg().porTanda;
    const cfg = rlAzureCfg();
    const inicio = item.restantes;
    body.innerHTML = rlCabecera(["☁️ Azure", (cfg.conceptos ? "Conceptos" : "Sección " + cfg.seccionId) + " · tanda " + Math.min(cfg.maxDia, rlAzureDia().n + 1) + "/" + cfg.maxDia]) +
      `<iframe class="rl-az-frame" title="Azure" src="./azure/index.html?reels=1&n=${inicio}"></iframe>`;
    RLV.azHandler = (d) => {
      if (RL.cur !== item) return;
      if (d.tipo === "progreso") {
        item.restantes = Math.max(0, inicio - (d.hechos || 0));
        rlGuardar();
      } else if (d.tipo === "fin") {
        if (!item.contado) { item.contado = true; rlAzureSumarDia(); }
        RLV.azHandler = null;
        setTimeout(() => rlSorpresaHecha(item), 900);
      } else if (d.tipo === "vacio") {
        RL.azVacioHasta = Date.now() + 20 * 60 * 1000;   // nada pendiente: no se vuelve a intentar en 20 min
        RLV.azHandler = null;
        rlAnotar(item, "nada pendiente");
        setTimeout(() => rlSorpresaHecha(item), 900);
      }
    };
    RLV.limpiar = () => { RLV.azHandler = null; };
  }