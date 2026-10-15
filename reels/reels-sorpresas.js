  // ==================== REELS (sorpresas) ====================
  // 1 yt       → clip real de YouGlish (va aparte: cada 3-6 ejercicios, ver rlDecidirSiguiente)
  // Las demás salen cada 2-15 tarjetas. "Elige reglas" es obligatoria solo con
  // el banco por debajo de RL_MIN_OBLIGATORIO; si no, compite con peso bajo.
  // 2 pct      → 5 porcentajes (1 verde, 2 naranja, 2 rojo), solo para ver
  // 3 reglas   → elige X reglas: rellena el banco hasta RL_BANCO
  // 4 reporte  → copiar informe (cada 60-70 ejercicios) + agregar JSON
  // 5 historia → misma historia 4 veces (3 leyendo, la 4ª solo audio)
  // 6 listening → 3 ejercicios seguidos del Nivel 1 de Listening (mismo avance que el módulo)
  const RL_PESOS = { listening: 35, historia: 30, pct: 20, reglas: 10 };
  const RL_LISTENING_N = 3;
  const RL_APORTE = { bad: 10, warn: 7, good: 5 };

  function rlElegirSorpresa() {
    // El informe manda: si ya toca (o quedó pendiente) y hay algo listo.
    const listo = rlReporteListo().listos.length > 0;
    if (listo && (RL.reporte.pendiente || RL.cont.reporte >= RL.cont.proxReporte)) return "reporte";
    if (!listo && RL.cont.reporte >= RL.cont.proxReporte) RL.cont.proxReporte = RL.cont.reporte + 10;

    if (rlContarBanco() < RL_MIN_OBLIGATORIO && (rlReglasDisponibles().length || RL.reserva.length)) return "reglas";

    const cands = [];
    if (getTargetLanguage() === "en" && typeof n1ReelsDisponible === "function" && n1ReelsDisponible()) cands.push("listening");
    if (rlHistoriaSiguiente()) cands.push("historia");
    if (rlReglasConPct().length) cands.push("pct");
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

  // ---------- 2. Cinco porcentajes ----------
  function rlCincoPct() {
    const conPct = shuffleArray(rlReglasConPct());
    const by = { good: [], warn: [], bad: [] };
    conPct.forEach((r) => by[pctTier(r.porcentaje)].push(r));
    const elegidas = [].concat(by.good.slice(0, 1), by.warn.slice(0, 2), by.bad.slice(0, 2));
    conPct.forEach((r) => { if (elegidas.length < 5 && !elegidas.includes(r)) elegidas.push(r); });
    return elegidas.sort((a, b) => b.porcentaje - a.porcentaje);
  }

  function rlRenderPct(item, body) {
    if (!item.ids) { item.ids = rlCincoPct().map((r) => r.id); rlGuardar(); }
    const pintar = () => {
      const reglas = item.ids.map((id) => findRegla(id)).filter(Boolean);
      body.innerHTML = rlCabecera(["📊 Tu avance"]) + `
        <div class="rl-sorpresa rl-pct">
          <h2 class="rl-title">Así vas en algunas reglas</h2>
          <p class="rl-sub">Solo un vistazo. Para ver otras, sigue estudiando.</p>
          <div class="rules-select-list">
            ${reglas.map((r) => `<div class="rule-card tier-${pctTier(r.porcentaje)} percentages-row">${rlFilaRegla(r)}
              <button type="button" class="rule-stats-btn" data-id="${r.id}" title="Ver estadísticas">📊</button></div>`).join("")}
          </div>
          <button class="fun-btn primary-btn full-width rl-continuar">Continuar ⬆</button>
        </div>`;
      body.querySelectorAll(".rule-stats-btn").forEach((b) => b.onclick = () => showRuleStatsModal(parseInt(b.dataset.id, 10)));
      body.querySelector(".rl-continuar").onclick = () => rlSorpresaHecha(item);
    };
    pintar();
  }

  // ---------- 3. Elegir reglas (rellena el banco) ----------
  function rlReglasParaElegir() {
    const disp = rlReglasDisponibles();
    const conPct = disp.filter((r) => r.porcentaje > 0).sort((a, b) => a.porcentaje - b.porcentaje);
    const rojas = conPct.filter((r) => pctTier(r.porcentaje) === "bad");
    const naranjas = conPct.filter((r) => pctTier(r.porcentaje) === "warn");
    const verdes = shuffleArray(conPct.filter((r) => pctTier(r.porcentaje) === "good"));
    const nuevas = shuffleArray(disp.filter((r) => r.porcentaje <= 0));
    const lista = [];
    const meter = (arr, n) => arr.slice(0, n).forEach((r) => { if (!lista.includes(r) && lista.length < 7) lista.push(r); });
    meter(rojas, 4);
    meter(nuevas, 1);
    meter(naranjas, 2);
    meter(verdes, 1);
    // Completa hasta 5-7 con lo que haya (rojas, naranjas, verdes; las de 0 % al final).
    [rojas, naranjas, verdes, nuevas].forEach((arr) => { if (lista.length < 6) meter(arr, arr.length); });
    return lista.slice(0, 7);
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
      item.reglas = rlReglasParaElegir().map((r) => r.id);
      item.x = item.sistema > 0 ? Math.max(1, Math.min(item.reglas.length, Math.round(item.sistema / 8))) : 0;
      rlGuardar();
    }
    const sel = new Set();
    const reglas = item.reglas.map((id) => findRegla(id)).filter(Boolean);
    const vacio = !item.manual && !item.sistema;

    const titulo = item.x
      ? `Selecciona <b>${item.x}</b> regla${item.x === 1 ? "" : "s"}`
      : (item.manual ? "Entran ejercicios tuyos" : "Tu banco está lleno");
    const subt = [
      item.sistema ? `El sistema cargará <b>${item.sistema}</b> ejercicio${item.sistema === 1 ? "" : "s"} repartidos entre las que elijas.` : "",
      item.manual ? `<b>${item.manual}</b> ejercicio${item.manual === 1 ? "" : "s"} de tu reserva manual entran también.` : "",
      vacio ? (rlReglasDisponibles().length ? "No hace falta cargar nada por ahora." : "No hay ejercicios disponibles en el banco del sistema para este idioma. Agrega ejercicios desde el menú (📥).") : "",
    ].filter(Boolean).join(" ");

    body.innerHTML = rlCabecera(["🎯 Elige qué estudiar"]) + `
      <div class="rl-sorpresa rl-reglas">
        <h2 class="rl-title">${titulo}</h2>
        <p class="rl-sub">${subt}</p>
        ${item.x ? `<div class="rules-select-list">
          ${reglas.map((r) => {
            const tier = r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad";
            return `<label class="rule-card rule-select-row tier-${tier}">
              <input type="checkbox" class="rule-select-checkbox" data-id="${r.id}">
              <span class="rule-check" aria-hidden="true"></span>
              ${rlFilaRegla(r, `<span class="rule-card-bottom"><span class="rule-select-count">${r.porcentaje > 0 ? "" : "💡 Incluye lección de información · "}${rlEjerciciosDeRegla(r.id).length} ejercicios</span></span>`)}
            </label>`;
          }).join("")}
        </div>` : ""}
        <div class="rl-reglas-foot">
          ${item.x ? `<span class="rl-contador"><b class="rl-sel-n">0</b>/${item.x}</span>` : ""}
          <button class="fun-btn primary-btn rl-cargar" ${item.x ? "disabled" : ""}>${vacio ? "Continuar ⬆" : "➕ Cargar ejercicios"}</button>
        </div>
      </div>`;

    const btn = body.querySelector(".rl-cargar");
    body.querySelectorAll(".rule-select-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = parseInt(cb.dataset.id, 10);
        if (cb.checked) {
          if (sel.size >= item.x) { cb.checked = false; toast("Solo " + item.x + " regla" + (item.x === 1 ? "" : "s")); return; }
          sel.add(id);
        } else sel.delete(id);
        cb.closest(".rule-select-row")?.classList.toggle("rule-row-checked", cb.checked);
        body.querySelector(".rl-sel-n").textContent = sel.size;
        btn.disabled = sel.size !== item.x;
      });
    });
    btn.onclick = () => {
      if (item.x && sel.size !== item.x) return;
      const n = rlCargarBanco(item, Array.from(sel));
      if (n) { burstConfetti(); toast("➕ " + n + " ejercicios nuevos en tu banco"); }
      rlSorpresaHecha(item);
    };
  }

  // Reparte item.sistema entre las reglas elegidas según su color (mínimo 5 c/u).
  function rlCargarBanco(item, ids) {
    let total = 0;
    const nuevas = [];
    const frente = [];
    if (item.manual) {
      RL.reserva.splice(0, item.manual).forEach((e) => nuevas.push(rlItemEx(e, "man")));
      total += item.manual;
    }
    if (ids.length && item.sistema) {
      const reglas = ids.map((id) => findRegla(id)).filter(Boolean);
      const suma = reglas.reduce((s, r) => s + rlAporte(r), 0) || 1;
      const elegidos = new Set();
      reglas.forEach((r) => {
        const n = Math.max(RL_MIN_POR_REGLA, Math.round(item.sistema * rlAporte(r) / suma));
        const ejs = rlTomarDeRegla(r.id, n, elegidos);
        ejs.forEach((e) => nuevas.push(rlItemEx(e, "sys")));
        total += ejs.length;
        if (r.porcentaje <= 0) rlLeccionesDe(r.id).forEach((_, idx) => frente.push({ k: "info", uid: rlUid(), reglaId: r.id, idx }));
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
      cuenta: (n) => { item.restantes = Math.max(0, n); rlGuardar(); },
      bloque: (b, fase) => { if (chip) chip.textContent = "Bloque " + b + " · " + (N1_FASE_LABEL[fase] || fase); },
      fin: () => { RLV.limpiar = null; rlSorpresaHecha(item); },
    });
    if (!ok) { rlSorpresaHecha(item); return; }
    RLV.limpiar = () => n1ReelsSoltar();
    }, 0);
  }
