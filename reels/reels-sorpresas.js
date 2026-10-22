// ==================== REELS (sorpresas) ====================
  // Las de este ciclo general salen cada 2-15 tarjetas. "Elige reglas" es
  // obligatoria solo con el banco por debajo de RL_MIN_OBLIGATORIO; si no,
  // compite con peso bajo.
  // 2 pct      → todas las reglas con su % y botón de estadística, más la tabla de irregulares
  // 3 reglas   → elige X reglas: rellena el banco hasta RL_BANCO
  // 4 reporte  → copiar informe (cada 60-70 ejercicios) + agregar JSON
  // 5 historia → misma historia 4 veces (3 leyendo, la 4ª solo audio)
  // (Listening/Azure/Irregulares/Ordenamiento/YouGlish/Tatoeba salieron de
  // este ciclo: desde Feature 4 compiten entre sí en el sorteo de "espacio",
  // ver más abajo y ⚙️ Configurar reels en el menú.)
  const RL_PESOS = { historia: 30, pct: 20, reglas: 10 };
  const RL_LISTENING_N = 3;
  const RL_APORTE = { bad: 10, warn: 7, good: 5 };
  const RL_MAX_VOTOS_REGLA = 3; // tope de casillas marcables por regla en "Elige qué estudiar"

  function rlElegirSorpresa() {
    // El informe de ejercicios manuales manda primero: entrega única (todo
    // junto, sin mínimo por regla) en cuanto ya no queda nada cargado a
    // mano pendiente (ver rlReporteManualListo en reels-core.js).
    if (rlReporteManualListo()) return "reporteManual";

    // El informe de reglas gramaticales manda después: si ya toca (o quedó
    // pendiente), se intenta entregar COMPLETO. Antes de disparar, si hay
    // reglas por debajo del mínimo pero con más ejercicios disponibles en
    // el banco del sistema, se refuerzan en silencio (sin mostrar nada esta
    // vuelta) para que, al momento de la entrega, no quede nada pendiente.
    const tocaInforme = RL.reporte.pendiente || RL.cont.reporte >= RL.cont.proxReporte;
    if (tocaInforme) {
      const { listos, pendientes } = rlReporteListo();
      if (pendientes.length && !RL.reporte.refuerzoHecho && rlReforzarReglasDeficitarias(pendientes)) {
        RL.cont.proxReporte = RL.cont.reporte + 10; // dar tiempo a que se resuelvan antes de volver a intentar
      } else if (listos.length) {
        return "reporte";
      } else {
        RL.cont.proxReporte = RL.cont.reporte + 10;
      }
    }

    if (rlContarBanco() < RL_MIN_OBLIGATORIO && (rlReglasDisponibles().length || RL.reserva.length)) return "reglas";

    const cands = [];
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

  // Intenta completar (con ejercicios del sistema) las reglas que todavía
  // están por debajo de RL_MIN_POR_REGLA para que el informe se pueda
  // entregar completo. Solo cuenta como reforzable una regla si de verdad
  // hay más ejercicios suyos disponibles (si no, se deja pendiente para el
  // próximo informe, como antes). No se repite más de una vez por ciclo de
  // informe (RL.reporte.refuerzoHecho) para no insistir sin fin cuando una
  // regla ya se quedó sin más contenido.
  function rlReforzarReglasDeficitarias(pendientes) {
    const candidatas = pendientes.filter((g) => g.reglaIds.length && g.reglaIds.some((id) => rlEjerciciosDeRegla(id).length > 0));
    if (!candidatas.length) return false;
    const elegidos = new Set();
    const nuevas = [];
    candidatas.forEach((g) => {
      const faltan = Math.max(0, RL_MIN_POR_REGLA - g.ej.length);
      if (!faltan) return;
      g.reglaIds.forEach((id) => {
        rlTomarDeRegla(id, faltan, elegidos).forEach((e) => nuevas.push(rlItemEx(e, "sys")));
      });
    });
    if (!nuevas.length) return false;
    rlSumarDia("cargadosSistema", nuevas.length);
    rlMezclarEnBanco(nuevas);
    RL.reporte.refuerzoHecho = true;
    rlGuardar();
    return true;
  }

  // ==================== FEATURE 4: "espacio" (scheduler unificado) ====================
  // 6 tipos configurables desde ⚙️ Configurar reels (menú): cada uno tiene un
  // interruptor on/off y hasta 4 casillas de "nivel". Cada 2-5 ejercicios
  // principales se abre un "espacio" en el nivel actual (1→2→3→4→1…) y se
  // sortea, con probabilidad uniforme, UNO entre los tipos que estén
  // habilitados, tengan ese nivel marcado y no estén en su tope diario ni
  // sin contenido disponible en este momento. Si no queda ninguno, el
  // espacio no produce nada y se sigue de largo (como con cualquier banco
  // vacío) — exactamente igual que el caso "ordenamiento sin candidatas"
  // de Feature 3.
  const RL_ESPACIO_TIPOS = ["listening", "azure", "irregulares", "ordenamiento", "youglish", "tatoeba", "banco"];
  const RL_ESPACIO_TIPO_LABEL = { listening: "🎧 Listening", azure: "☁️ Azure", irregulares: "🔁 Irregulares", ordenamiento: "🔤 Ordenamiento", youglish: "🌎 YouGlish", tatoeba: "🐢 Tatoeba", banco: "📚 Banco de palabras" };
  // tipo de config -> item.tipo que entiende rlRenderSorpresa (ordenamiento e
  // irregulares no usan esta tabla: se resuelven aparte, ver rlEspacioSiToca).
  const RL_ESPACIO_TIPO_RENDER = { listening: "listening", azure: "azure", youglish: "yt", tatoeba: "tatoeba", banco: "banco" };

  const RL_CONFIG_KEY = "english_trainer_reels_config_v1";
  function rlConfigDefault() {
    const o = {};
    RL_ESPACIO_TIPOS.forEach((t) => { o[t] = { enabled: true, levels: [1, 2, 3, 4] }; });
    return o;
  }
  function rlConfigLeer() {
    let c = null;
    try { c = JSON.parse(localStorage.getItem(RL_CONFIG_KEY) || "null"); } catch (e) { c = null; }
    const def = rlConfigDefault();
    const out = {};
    RL_ESPACIO_TIPOS.forEach((t) => {
      const v = (c && c[t]) || {};
      const niveles = Array.isArray(v.levels) ? v.levels.filter((n) => [1, 2, 3, 4].includes(n)) : null;
      out[t] = { enabled: v.enabled !== false, levels: niveles && niveles.length ? niveles : (niveles ? [] : def[t].levels.slice()) };
    });
    return out;
  }
  function rlConfigGuardar(cfg) { try { localStorage.setItem(RL_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) { /* nada */ } }

  // ¿Este tipo ya tocó su tope de HOY? (se usa para apagarlo gris en el
  // modal de configuración y para excluirlo del sorteo durante todo el día).
  function rlEspacioLimiteHoy(tipo) {
    if (tipo === "azure") {
      if (getTargetLanguage() !== "en") return true;
      const az = rlAzureCfg();
      if (!(az.conceptos || az.secciones)) return true;
      if (rlAzureDia().n >= az.maxDia) return true;
      if ((RL.azVacioHasta || 0) > Date.now()) return true;
      return false;
    }
    if (tipo === "irregulares") return !(typeof irrDisponible === "function" && irrDisponible()) || (typeof irrHechaHoy === "function" && irrHechaHoy());
    if (tipo === "tatoeba") return typeof rlTatoebaAgotadaHoy === "function" && rlTatoebaAgotadaHoy();
    // listening, ordenamiento, youglish: sin tope diario conocido en el código
    // original (ver "Supuestos" en CAMBIOS.md para listening en particular).
    return false;
  }

  // Contenido disponible AHORA MISMO para este tipo (no es un tope diario:
  // es "¿hay algo que mostrar en este instante?", igual que antes de
  // Feature 4 cada sorpresa comprobaba su propia condición puntual).
  function rlEspacioDisponibleAhora(tipo) {
    switch (tipo) {
      case "listening": return getTargetLanguage() === "en" && typeof n1ReelsDisponible === "function" && n1ReelsDisponible();
      case "azure": return true;
      case "irregulares": return typeof irrDecidirSorpresa === "function" && !!irrDecidirSorpresa();
      case "ordenamiento": return rlOrdenamientoCandidatosEnBanco().length > 0;
      case "youglish": return !!rlPalabraParaYT();
      case "tatoeba": return typeof rlTatoebaDisponible === "function" ? rlTatoebaDisponible() : true;
      case "banco": return typeof BancoPalabrasData !== "undefined" && BancoPalabrasData.activas().length > 0;
      default: return false;
    }
  }

  function rlEspacioCandidatos(nivel) {
    const cfg = rlConfigLeer();
    const out = [];
    RL_ESPACIO_TIPOS.forEach((t) => {
      const c = cfg[t];
      if (!c || !c.enabled) return;
      if (!c.levels.includes(nivel)) return;
      if (rlEspacioLimiteHoy(t)) return;
      if (!rlEspacioDisponibleAhora(t)) return;
      out.push(t);
    });
    return out;
  }

  function rlEspacioElegirTipo(nivel) {
    const cands = rlEspacioCandidatos(nivel);
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // Llamada desde rlDecidirSiguiente en cada tarjeta. Devuelve un item
  // {k:"sorpresa",...} a mostrar, o null si no toca espacio todavía o si
  // tocó pero no había ninguna candidata (o ganó "ordenamiento", que no
  // muestra nada: solo convierte una tarjeta en el banco, ver Feature 3).
  function rlEspacioSiToca() {
    if ((RL.cont.espacioCont || 0) < (RL.cont.espacioN || 0)) return null;
    const nivel = RL.cont.espacioNivel || 1;
    RL.cont.espacioCont = 0;
    RL.cont.espacioNivel = nivel >= 4 ? 1 : nivel + 1;
    RL.cont.espacioN = rlRand(RL_ESPACIO_MIN, RL_ESPACIO_MAX);
    const ganador = rlEspacioElegirTipo(nivel);
    if (!ganador) return null;
    if (ganador === "ordenamiento") { rlConvertirTraduccionAOrdenamiento(); return null; }
    if (ganador === "irregulares") return irrDecidirSorpresa();
    return { k: "sorpresa", tipo: RL_ESPACIO_TIPO_RENDER[ganador], uid: rlUid() };
  }

  // ---------- Modal "⚙️ Configurar reels" ----------
  function rlModalConfigurarReels() {
    document.querySelectorAll(".modal-overlay").forEach((m) => m.remove());
    rlEstado();
    const cfg = rlConfigLeer();
    const filaTipo = (t) => {
      const limite = rlEspacioLimiteHoy(t);
      const c = cfg[t];
      return `
        <div class="rule-card tier-${limite ? "bad" : "good"}" style="${limite ? "opacity:.55;" : ""}" data-t="${t}">
          <span class="rule-card-body">
            <span class="rule-card-top">
              <label class="rule-config-info-toggle">
                <input type="checkbox" class="rl-cfg-enabled" data-t="${t}" ${c.enabled ? "checked" : ""}>
                <span class="rule-config-switch"></span>
                <span class="rule-select-text">${RL_ESPACIO_TIPO_LABEL[t] || t}</span>
              </label>
            </span>
            ${limite ? `<span class="rl-mini" style="color:var(--bad);">⏸ Límite diario alcanzado hoy</span>` : ""}
            <span class="rule-card-bottom" style="margin-top:4px;">
              <span class="rule-select-count" style="margin-right:8px;">Niveles:</span>
              <span class="rule-check-group" role="group" aria-label="Niveles de ${rlEsc(RL_ESPACIO_TIPO_LABEL[t] || t)}">
                ${[1, 2, 3, 4].map((n) => `<label class="rule-check-item"><input type="checkbox" class="rl-cfg-nivel rule-select-checkbox" data-t="${t}" data-n="${n}" ${c.levels.includes(n) ? "checked" : ""}><span class="rule-check" aria-hidden="true">${n}</span></label>`).join("")}
              </span>
            </span>
          </span>
        </div>`;
    };
    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>⚙️ Configurar reels</h3>
          <button class="menu-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">Cada tipo puede prenderse/apagarse y elegir en qué nivel(es) puede salir (los niveles van rotando 1→2→3→4→1… cada 2-5 ejercicios; en cada nivel se sortea 1 tipo al azar entre los que cumplan). Sin niveles marcados, ese tipo nunca sale aunque esté prendido.</p>
        <div class="rules-select-list">${RL_ESPACIO_TIPOS.map(filaTipo).join("")}</div>
      </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector(".menu-modal-close").onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    modal.querySelectorAll(".rl-cfg-enabled").forEach((cb) => {
      cb.addEventListener("change", () => { cfg[cb.dataset.t].enabled = cb.checked; rlConfigGuardar(cfg); });
    });
    modal.querySelectorAll(".rl-cfg-nivel").forEach((cb) => {
      cb.addEventListener("change", () => {
        const t = cb.dataset.t, n = parseInt(cb.dataset.n, 10);
        const set = new Set(cfg[t].levels);
        if (cb.checked) set.add(n); else set.delete(n);
        cfg[t].levels = Array.from(set).sort((a, b) => a - b);
        rlConfigGuardar(cfg);
      });
    });
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
      case "reporteManual": return rlRenderReporteManual(item, body);
      case "historia": return rlRenderHistoria(item, body);
      case "yt": return rlRenderYT(item, body);
      case "listening": return rlRenderListening(item, body);
      case "azure": return rlRenderAzure(item, body);
      case "irr": return irrRenderSorpresaReels(item, body);
      case "tatoeba": return rlRenderTatoeba(item, body);
      case "banco": return rlRenderBanco(item, body);
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

  // Mini-gráfica de LÍNEAS (del historial de %, ya cacheado — ver
  // historialReglaCache) que reemplaza al botón "📊 Ver estadísticas" +
  // modal de antes: ahora el historial se ve directo en la fila de cada
  // regla, sin tocar nada. Muestra 2 series — el resultado real de cada
  // registro y su tendencia EMA (media móvil exponencial, α=0.30), que
  // suaviza el ruido y refleja mejor "para dónde va" el dominio de la
  // regla que el promedio plano de toda la historia. Puntos bien
  // espaciados (40px c/u) porque la gráfica es scrolleable horizontalmente
  // sin restricción — no hace falta comprimirla para que "quepa".
  const RL_EMA_ALPHA = 0.30;

  // E_0 = 0; E_t = α·X_t + (1-α)·E_(t-1). Devuelve un array paralelo a
  // "puntos" con el valor de la EMA en cada posición.
  function rlCalcularEMA(puntosPct) {
    let ema = 0;
    return puntosPct.map((pct) => {
      ema = RL_EMA_ALPHA * pct + (1 - RL_EMA_ALPHA) * ema;
      return ema;
    });
  }

  function rlMiniGrafica(reglaId) {
    const historial = historialReglaCache(reglaId);
    if (!historial.length) return "";
    const puntosPct = historial.map((h) => Math.max(0, Math.min(100, Number(h.porcentaje) || 0)));
    const emaSerie = rlCalcularEMA(puntosPct);
    const emaFinal = Math.round(emaSerie[emaSerie.length - 1]);

    const STEP = 40;   // espacio horizontal entre puntos (antes ~11px de barra+gap)
    const ALTO = 72;
    const PAD_TOP = 13; // aire arriba para que el valor no se corte
    const PAD_BOT = 6;
    const w = Math.max(STEP, puntosPct.length * STEP);
    const x = (i) => Math.round(i * STEP + STEP / 2);
    const y = (pct) => Math.round(PAD_TOP + (ALTO - PAD_TOP - PAD_BOT) * (1 - pct / 100));

    const lineaReal = puntosPct.map((pct, i) => x(i) + "," + y(pct)).join(" ");
    const lineaEma = emaSerie.map((v, i) => x(i) + "," + y(v)).join(" ");
    const puntosReal = puntosPct.map((pct, i) => `<circle cx="${x(i)}" cy="${y(pct)}" r="2.2" class="rl-ema-dot tier-${pctTier(pct)}"></circle>`).join("");
    const puntosEma = emaSerie.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="2" class="rl-ema-dot-ema"></circle>`).join("");
    const etiquetasReal = puntosPct.map((pct, i) => `<text x="${x(i)}" y="${y(pct) - 4}" text-anchor="middle" class="rl-ema-label tier-${pctTier(pct)}">${Math.round(pct)}</text>`).join("");

    return `
      <div class="rule-avance-wrap">
        <div class="rule-avance-leyenda">
          <span class="rl-ema-leg rl-ema-leg-real">● Real</span>
          <span class="rl-ema-leg rl-ema-leg-ema">— Tendencia EMA · ${emaFinal}%</span>
        </div>
        <div class="rule-avance-chart">
          <svg class="rl-ema-svg" width="${w}" height="${ALTO}" viewBox="0 0 ${w} ${ALTO}" preserveAspectRatio="xMinYMid meet">
            <polyline points="${lineaEma}" class="rl-ema-line-ema"></polyline>
            <polyline points="${lineaReal}" class="rl-ema-line-real"></polyline>
            ${puntosEma}
            ${puntosReal}
            ${etiquetasReal}
          </svg>
        </div>
      </div>`;
  }

  function rlRenderPct(item, body) {
    const pintar = () => {
      const reglas = rlTodasConOrden();
      const cuenta = { good: 0, warn: 0, bad: 0, nueva: 0 };
      reglas.forEach((r) => { if (r.porcentaje > 0) cuenta[pctTier(r.porcentaje)]++; else cuenta.nueva++; });
      const fila = (r) => {
        const tier = r.porcentaje > 0 ? pctTier(r.porcentaje) : "bad";
        const puntos = historialReglaCache(r.id);
        return `
          <div class="rule-card tier-${tier} percentages-row">
            <div class="rule-card-body">
              <span class="rule-card-top">
                <span class="rule-select-text">${rlEsc(r.regla)}</span>
                <span class="rule-avance-badges">
                  <span class="rule-pct-badge tier-${tier}">${r.porcentaje > 0 ? r.porcentaje + "%" : "Nueva"}</span>
                  <span class="rule-avance-n" title="Cantidad de registros">n ${puntos.length}</span>
                </span>
              </span>
              ${rlMiniGrafica(r.id)}
            </div>
          </div>`;
      };
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
      body.querySelector(".rl-continuar").onclick = () => rlSorpresaHecha(item);
    };
    pintar();
    // Si los % (y el historial) todavía se están consultando, se repinta
    // cuando lleguen, para que la mini-gráfica aparezca sin tener que
    // salir y volver a entrar a esta pantalla.
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
              ${rlFilaRegla(r, `<span class="rule-card-bottom"><span class="rule-select-count">${r.porcentaje > 0 ? "" : "💡 Incluye lección de información · "}${rlEjerciciosDeRegla(r.id).length} ejercicios</span></span>${rlMiniGrafica(r.id)}`)}
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
    let sysN = 0;
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
        sysN += ejs.length;
        if (r.porcentaje <= 0 && !infoHecha.has(r.id)) { infoHecha.add(r.id); rlLeccionesDe(r.id).forEach((_, idx) => frente.push({ k: "info", uid: rlUid(), reglaId: r.id, idx })); }
      });
    }
    if (sysN) rlSumarDia("cargadosSistema", sysN);
    rlMezclarEnBanco(nuevas, frente);
    rlGuardar();
    return total;
  }

  // ---------- 4. Informe ----------
  function rlRenderReporte(item, body) {
    const rep = rlConstruirReporte();
    const pend = rlReporteListo().pendientes;
    // Cantidad de ejercicios (no de reglas) que quedan guardados en el
    // informe sin poder entregarse todavía (reglas que, aun después de
    // intentar reforzarlas, siguen con menos de RL_MIN_POR_REGLA).
    const pendEj = pend.reduce((s, g) => s + g.ej.length + g.err.length, 0);
    body.innerHTML = rlCabecera(["📋 Informe"]) + `
      <div class="rl-sorpresa rl-reporte">
        <p class="rl-sub"><b>${rep.total}</b> ejercicios en <b>${rep.grupos}</b> regla${rep.grupos === 1 ? "" : "s"} (mínimo ${RL_MIN_POR_REGLA} por regla). ${pend.length ? pend.length + " regla(s) con menos de " + RL_MIN_POR_REGLA + " quedan para el próximo." : ""}</p>
        ${pendEj ? `<p class="rl-sub rl-pend-ej">📦 ${pendEj} ejercicio${pendEj === 1 ? "" : "s"} guardado${pendEj === 1 ? "" : "s"} sin entregar todavía.</p>` : ""}
        <textarea class="report rl-report-text" rows="9" readonly></textarea>
        <div class="rl-rep-btns">
          <button class="fun-btn primary-btn rl-copiar">📋 Copiar reporte</button>
          <button class="fun-btn rl-pegado" disabled>✅ Ya lo pegué</button>
        </div>
        <button class="fun-btn full-width rl-luego">⏭ Más tarde</button>
        ${RL.reporte.ultimoTexto ? `<button class="fun-btn full-width rl-ultimo">📄 Copiar el informe anterior</button>` : ""}
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
  }

  // ---------- 4b. Informe manual (entrega única, sin mínimo por regla) ----------
  function rlRenderReporteManual(item, body) {
    const rep = rlConstruirReporteManual();
    body.innerHTML = rlCabecera(["📋 Informe (manual)"]) + `
      <div class="rl-sorpresa rl-reporte">
        <p class="rl-sub">Ya resolviste todos tus <b>${rep.total}</b> ejercicios cargados a mano. Aquí va el informe completo, de una sola entrega.</p>
        <textarea class="report rl-report-text" rows="9" readonly></textarea>
        <div class="rl-rep-btns">
          <button class="fun-btn primary-btn rl-copiar">📋 Copiar reporte</button>
          <button class="fun-btn rl-pegado" disabled>✅ Ya lo pegué</button>
        </div>
        <button class="fun-btn full-width rl-luego">⏭ Más tarde</button>
      </div>`;
    body.querySelector(".rl-report-text").value = rep.texto;
    const copiar = (txt) => {
      const ok = () => toast("📋 Informe copiado");
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(ok).catch(() => { rlCopiaManual(body, txt); });
      else rlCopiaManual(body, txt);
    };
    body.querySelector(".rl-copiar").onclick = () => { copiar(rep.texto); body.querySelector(".rl-pegado").disabled = false; };
    body.querySelector(".rl-pegado").onclick = () => {
      rlReporteManualConfirmado(rep.rids);
      burstConfetti();
      toast("🧹 Informe manual entregado y borrado. ¡A seguir!");
      rlSorpresaHecha(item);
    };
    body.querySelector(".rl-luego").onclick = () => rlSorpresaHecha(item);
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

  // ---------- 8. Banco de palabras ----------
  // Cada vez que toca este espacio se hacen 4 ejercicios (completar,
  // traducir, completar, traducir — ese orden fijo). Cada uno sortea una
  // palabra activa al azar (si solo hay una palabra en el banco, las 4
  // caen en esa misma, que es justo lo que se pidió) y una de sus
  // oraciones guardadas. Se reusan renderCompletarExercise/
  // renderTraduccionExercise (y sus modales de resultado) tal cual las usa
  // el resto del juego — lo único que cambia es la capa de color rosa
  // (.bp-reels-exercise, en banco-palabras.css).
  const RL_BANCO_PATRON = ["completar", "traducir", "completar", "traducir"];

  function rlBancoPalabraAleatoria() {
    const activas = (typeof BancoPalabrasData !== "undefined" ? BancoPalabrasData.activas() : []);
    if (!activas.length) return null;
    return activas[Math.floor(Math.random() * activas.length)];
  }

  function rlBancoGenerarPaso(tipo) {
    const palabra = rlBancoPalabraAleatoria();
    if (!palabra || !palabra.oraciones.length) return null;
    const oracion = palabra.oraciones[Math.floor(Math.random() * palabra.oraciones.length)];
    if (tipo === "completar") {
      const re = new RegExp("\\b" + String(oracion.forma || palabra.palabra).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (!re.test(oracion.en)) return null; // no debería pasar: se guarda junto con la forma que calza
      return { tipo: "completar", palabra: palabra.id, exercise: { spanishWord: oracion.es, englishSentence: oracion.en.replace(re, "___"), options: [oracion.forma || palabra.palabra] } };
    }
    return { tipo: "traducir", palabra: palabra.id, exercise: { spanishWord: oracion.es, englishWord: oracion.en } };
  }

  function rlBancoElegirPlan() {
    return RL_BANCO_PATRON.map(rlBancoGenerarPaso).filter(Boolean);
  }

  function rlRenderBanco(item, body) {
    if (!item.plan) {
      item.plan = rlBancoElegirPlan();
      item.paso = 0;
      rlGuardar();
    }
    if (!item.plan.length || item.paso >= item.plan.length) { rlSorpresaHecha(item); return; }

    const paso = item.plan[item.paso];
    body.innerHTML = rlCabecera(["📚 Banco de palabras", (item.paso + 1) + "/" + item.plan.length]) +
      `<div class="rl-sorpresa bp-reels-exercise"><div class="rl-banco-host"></div></div>`;
    const host = body.querySelector(".rl-banco-host");

    // decision: null (Continuar) | "luego" (🧠 Repasar luego → se repite
    // más adelante EN ESTE MISMO espacio, como un 5to/6to ejercicio, no en
    // la cola principal de Reels — así lo pidió el usuario).
    const avanzar = (duda, passed, decision) => {
      if (decision === "luego") item.plan.push(paso);
      if (typeof BancoPalabrasData !== "undefined") BancoPalabrasData.registrarPractica(paso.palabra, 1);
      item.paso += 1;
      rlGuardar();
      rlRenderBanco(item, body);
    };

    if (paso.tipo === "completar") {
      renderCompletarExercise(paso.exercise, host);
      host.querySelector(".completar-check").addEventListener("click", () => {
        const { results } = checkCompletarAnswers(paso.exercise, host);
        showCompletarModal(paso.exercise, results, avanzar);
      });
    } else {
      renderTraduccionExercise(paso.exercise, host);
      host.querySelector(".traduccion-check").addEventListener("click", () => {
        const userAnswer = host.querySelector(".traduccion-answer").value;
        showComparativeModal(paso.exercise, userAnswer, avanzar);
      });
    }
  }