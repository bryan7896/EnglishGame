/* MOTOR DEL JUEGO DE AVENTURA (conversaciones por audio).
 * Lee una mision compilada (data/compilado/<id>.json) + su layout (data/layouts/<id>.json).
 * Para jugar:  python -m http.server  y abrir  http://localhost:8000/jugar.html?m=m001
 * Sin ?m se muestra la lista de historias (data/catalogo_misiones.json).
 * Parametros: ?m=ID de mision | ?rapido (sin esperar audios, para pruebas) | ?debug (marca la respuesta correcta). */
(() => {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const P = new URLSearchParams(location.search);
  const MID = P.get('m');
  const RAPIDO = P.has('rapido'), DEBUG = P.has('debug');
  const CLAVE = 'aventura_v1';
  const EMBED = P.has('embed');   // dentro de English Trainer (iframe): boton de salida y avisos al padre
  const avisar = msg => { try { if (EMBED && window.parent !== window) window.parent.postMessage(Object.assign({ aventura: true }, msg), '*'); } catch (e) { /* sin padre */ } };
  const sleep = ms => new Promise(r => setTimeout(r, RAPIDO ? Math.min(ms, 15) : ms));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const barajar = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  let M, L, E;            // mision, layout, estado
  let ocupado = false;    // hay una accion en curso (no se aceptan toques)
  let idleTimer = null;

  function estadoNuevo() {
    return {
      escena: null, escenaDef: null, luz: 0.3, errores: 0, erroresSeguidos: 0, dialogosHechos: 0, turnos: 0,
      puntos: 0, monedas: 0, contadores: {}, flags: new Set(), habilitados: new Set(), bloqueados: new Set(),
      disparados: new Set(), log: [], repaso: [], reglas: {}, x: {}, jugadorX: 0, terminado: false, ultimaActividad: Date.now()
    };
  }

  /* ------------------------------------------------------------------ utilidades de datos */
  const url = f => (M.audio_dir || 'audio/') + f;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const personaje = id => M.elenco[id];
  // frases del elenco: las generales + las del contexto de la mision (p. ej. "errores_fiesta" solo en m001, con "contexto": "fiesta")
  const lineas = (id, tipo) => { const p = M.elenco[id] || {}; return (p[tipo] || []).concat(M.contexto ? (p[tipo + '_' + M.contexto] || []) : []); };
  function resolver(paso) {
    if (paso.ref === 'saludo') { const p = personaje(paso.quien); return Object.assign({}, paso, p.saludos[0]); }
    return paso;
  }

  function guardar(resultado) {
    try {
      const db = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      const prev = db[M.id] || { intentos: 0, mejorEstrellas: 0 };
      const historial = (prev.historial || []).concat([resultado]).slice(-30);
      db[M.id] = { intentos: prev.intentos + 1, mejorEstrellas: Math.max(prev.mejorEstrellas, resultado.estrellas), ultima: resultado, historial };
      db.monedas = (db.monedas || 0) + resultado.monedas;
      localStorage.setItem(CLAVE, JSON.stringify(db));
    } catch (e) { /* sin almacenamiento: el juego sigue */ }
  }

  /* ------------------------------------------------------------------ escenario */
  function medir() {
    const hud = $('#hud').offsetHeight;
    const lado = window.innerHeight <= 520 ? 56 : 72;   // columnas laterales: repetir (izq.) y respuestas (der.) no tapan el escenario
    const w = Math.min(window.innerWidth - 2 * lado, (window.innerHeight - hud - 12) * 16 / 9);
    const esc = $('#escenario');
    esc.style.width = w + 'px'; esc.style.height = (w * 9 / 16) + 'px';
    esc.style.setProperty('--u', (w / 100) + 'px');
    document.documentElement.style.setProperty('--u', (w / 100) + 'px');
  }

  function pj(id) { return $(`#capa-personajes [data-id="${id}"]`); }
  function ob(id) { return $(`#capa-objetos [data-id="${id}"]`); }
  function colocar(e, x, y) { e.style.left = x + '%'; e.style.top = y + '%'; e.style.zIndex = Math.round(y * 10); }

  function crearPersonaje(id, x, y, extra) {
    const c = personaje(id);
    const e = el('div', 'pj', ARTE.personaje(c));
    e.dataset.id = id;
    colocar(e, x, y);
    E.x[id] = x;
    $('#capa-personajes').appendChild(e);
    if (extra && extra.interactivo) e.addEventListener('click', () => alTocarPersonaje(id));
    return e;
  }

  const ALTO_U = 56.25;   // alto del escenario en unidades (16:9)
  function crearObjeto(o, pos) {
    const capa = pos.capa || 'fondo';
    let x = pos.x, y = pos.y, w = pos.s, hU = pos.h;
    if (pos.sobre) {   // zona tocable anclada a un punto de otro objeto (ej. la puerta de la casa)
      const padre = E.escenaDef.objetos.find(t => t.id === pos.sobre), pp = L[E.escena].objetos[pos.sobre], m = ARTE.meta(padre.svg);
      const pt = m && m.puntos && m.puntos[pos.punto];
      if (!pt) { console.warn('punto de anclaje no encontrado', pos); return null; }
      const Hu = pp.s * m.vb[1] / m.vb[0];
      x = pp.x + (pt.x - 0.5) * pp.s; y = pp.y - (1 - pt.y) * Hu / ALTO_U * 100;
      w = pt.w * pp.s; hU = pt.h * Hu;
    }
    const e = el('div', 'obj ' + capa, capa === 'hotspot' ? '' : ARTE.objeto(o.svg, o.variante, capa));
    e.dataset.id = o.id;
    e.style.width = `calc(var(--u) * ${w})`;
    if (hU) e.style.height = `calc(var(--u) * ${hU})`;
    colocar(e, x, y);
    if (capa === 'cielo' || capa === 'pared' || capa === 'suelo') e.style.zIndex = 1;
    if (capa === 'hotspot' && !pos.sobre) e.style.zIndex = 1;
    if (o.inicia_deshabilitado) e.classList.add('off');
    e.addEventListener('click', () => alTocarObjeto(o.id));
    $('#capa-objetos').appendChild(e);
    return e;
  }

  function actualizarLuz() {
    const op = Math.max(0, Math.min(0.78, 0.8 * (1 - E.luz)));
    const bx = (E.jugadorX || 50) + '%';
    $('#oscuridad').style.background =
      `radial-gradient(circle at ${bx} 70%, rgba(0,0,25,0) calc(var(--u)*7), rgba(0,0,25,${op.toFixed(2)}) calc(var(--u)*24))`;
  }

  function moverJugador(x, y, rapido) {
    const b = pj('bryan'); if (!b) return Promise.resolve();
    const dx = x - E.jugadorX;
    b.classList.toggle('izq', dx < 0);
    const dist = Math.abs(dx);
    const t = RAPIDO || rapido ? 0 : Math.max(0.25, dist / 45);
    b.style.setProperty('--camino', t + 's');
    const s = E.sigue ? pj(E.sigue) : null;   // quien acompana al jugador (Sara en m001)
    if (s) { s.style.setProperty('--camino', (t + 0.25) + 's'); s.classList.toggle('izq', dx < 0); }
    if (t) { b.classList.add('camina'); if (s) s.classList.add('camina'); }
    colocar(b, x, y != null ? y : parseFloat(b.style.top));
    if (s) { const sx = x + (dx < 0 ? 5 : -5); colocar(s, Math.max(3, Math.min(97, sx)), parseFloat(b.style.top)); E.x[E.sigue] = sx; }
    E.jugadorX = x;
    actualizarLuz();
    return sleep(t * 1000 + (t ? 320 : 0)).then(() => { b.classList.remove('camina'); if (s) s.classList.remove('camina'); });
  }

  async function caminarHasta(id) {
    const x = E.x[id]; if (x == null) return;
    const lado = E.jugadorX <= x ? -1 : 1;
    let destino = x + lado * 6.5;
    if (destino < 4 || destino > 96) destino = x - lado * 6.5;
    await moverJugador(destino);
    pj('bryan').classList.toggle('izq', x < E.jugadorX);
    const e = pj(id); if (e) e.classList.toggle('izq', x > E.jugadorX);
  }

  /* ------------------------------------------------------------------ voz + burbujas */
  let ultima = null, hablando = 0;
  function actualizarRepetir() { const b = $('#repetir'); if (b) b.disabled = hablando > 0; }
  // Repite lo ultimo que dijo un personaje (no el jugador). Se bloquea mientras el juego habla para no cortar el dialogo.
  function repetirUltima() {
    if (!ultima || hablando > 0) return;
    SONIDO.sfx.toque();
    SONIDO.decir(url(ultima.file), { pan: ultima.pan });
  }

  async function decir(quien, linea, opc) {
    opc = opc || {};
    const cont = opc.sobre ? (pj(opc.sobre) || ob(opc.sobre)) : (pj(quien) || ob(quien));
    let b = null;
    if (cont) { b = el('div', 'burbuja ' + (quien === 'bryan' ? 'bryan' : ''), `<span class="onda">${quien === 'bryan' ? '🎙️' : '🔊'}</span>`); cont.appendChild(b); cont.classList.add('habla'); }
    E.log.push({ quien, texto: linea.texto, mal: !!opc.mal, escena: E.escena });
    if (opc.cara && cont) ARTE.setCara(cont, opc.cara);
    if (quien !== 'bryan') { ultima = { file: linea.file, pan: opc.pan }; $('#repetir').hidden = false; }
    hablando++; actualizarRepetir();
    await SONIDO.decir(url(linea.file), { pan: opc.pan });
    hablando--; actualizarRepetir();
    if (cont) { cont.classList.remove('habla'); if (b) b.remove(); const c0 = personaje(quien); if (opc.cara && c0) ARTE.setCara(cont, c0.cara_base); }
    await sleep(160);
  }

  /* ------------------------------------------------------------------ hoja de respuestas */
  function mostrarHoja(ops, estado, naranja) {
    return new Promise(resolve => {
      const hoja = $('#hoja');
      hoja.hidden = false; hoja.className = naranja ? 'naranja' : '';
      let sel = null;
      const render = () => {
        hoja.innerHTML = '';
        const fila = el('div', 'fila'), cont = el('div', 'ops');
        ops.forEach((o, i) => {
          const b = el('button', 'op' + (sel === o ? ' sel' : '') + (estado.malas.has(o.file) ? ' mal' : ''),
            `<span class="mic">🎙️</span>` +
            (estado.reveladas.has(o.file) ? `<span class="txt">${o.texto}</span>` : ''));
          if (DEBUG && o.ok) b.dataset.ok = '1';
          b.dataset.i = i; b.setAttribute('aria-label', 'Option ' + 'ABC'[i]);
          b.addEventListener('click', () => {
            SONIDO.sfx.toque();
            const n = (estado.pulsaciones[o.file] = (estado.pulsaciones[o.file] || 0) + 1);
            if (n >= 3 && !estado.reveladas.has(o.file)) { estado.reveladas.add(o.file); estado.textoUsado = true; }
            sel = o; render();
            SONIDO.decir(url(o.file));
          });
          cont.appendChild(b);
        });
        const env = el('button', '', '›'); env.id = 'enviar'; env.disabled = !sel; env.setAttribute('aria-label', 'Send');
        env.addEventListener('click', () => { if (!sel) return; SONIDO.detener(); hoja.hidden = true; medir(); resolve(sel); });
        fila.appendChild(cont); fila.appendChild(env); hoja.appendChild(fila);
        medir();
      };
      render();
    });
  }

  async function turnoJugador(paso, duenio, ctxDialogo) {
    const todas = barajar(paso.opciones);
    const correcta = todas.find(o => o.ok);
    const estado = { pulsaciones: {}, reveladas: new Set(), malas: new Set(), textoUsado: false };
    let errores = 0, ops = todas, naranja = false, reveladaPorErrores = false;
    E.turnos++;
    for (;;) {
      const elegido = await mostrarHoja(ops, estado, naranja);
      if (elegido.ok) { await decir('bryan', elegido); break; }
      errores++; E.errores++; E.erroresSeguidos++;
      estado.malas.add(elegido.file);
      await decir('bryan', elegido, { mal: true });
      SONIDO.sfx.error();
      const npc = personaje(duenio);
      const errs = lineas(duenio, 'errores');
      if (errs.length) await decir(duenio, rnd(errs), { mal: true, cara: '😕' });
      if (errores >= 3) {
        // tercer error: se revela la respuesta correcta, sin puntos, y va a repaso
        reveladaPorErrores = true; estado.reveladas.add(correcta.file);
        await decir('bryan', correcta);
        break;
      }
      if (!naranja) { naranja = true; ops = barajar([correcta, rnd(todas.filter(o => !o.ok && !estado.malas.has(o.file)))]); }
    }
    let pts = errores === 0 ? 1 : (errores < 3 ? 0.5 : 0);
    if (estado.textoUsado) pts = Math.max(0, pts - 0.5);
    E.puntos += pts;
    if (errores === 0) { E.monedas += 2; SONIDO.sfx.moneda(); $('#hud-monedas').textContent = '🪙 ' + E.monedas; E.erroresSeguidos = 0; }
    else { E.erroresSeguidos = reveladaPorErrores ? E.erroresSeguidos : 0; SONIDO.sfx.ok(); }
    if (errores > 0 || estado.textoUsado) {
      E.repaso.push({ escena: E.escena, texto: correcta.texto, reglaIds: paso.reglaIds || [], errores, texto_revelado: estado.textoUsado });
    }
    (paso.reglaIds || []).forEach(r => { const o = (E.reglas[r] = E.reglas[r] || { turnos: 0, limpios: 0 }); o.turnos++; if (errores === 0 && !estado.textoUsado) o.limpios++; });
    E.ultimaActividad = Date.now();
  }

  /* ------------------------------------------------------------------ efectos */
  async function efectos(lista, ctx) {
    for (const f of lista || []) {
      if (f.bloquear) { E.bloqueados.add(ctx.duenio); const e = pj(ctx.duenio); if (e) e.classList.add('bloqueado'); }
      else if (f.contador) E.contadores[f.contador] = (E.contadores[f.contador] || 0) + (f.suma || 1);
      else if (f.flag) E.flags.add(f.flag);
      else if (f.luz != null) { E.luz = Math.min(1, E.luz + f.luz); actualizarLuz(); }
      else if (f.habilita) { E.habilitados.add(f.habilita); const o = ob(f.habilita); if (o) { o.classList.remove('off'); o.classList.add('activa'); } SONIDO.sfx.pop(); }
      else if (f.desaparece) { await desaparecer(f.desaparece); }
      else if (f.sacudir) { const s = $('#escenario'); s.classList.add('sacudir'); setTimeout(() => s.classList.remove('sacudir'), 1600); }
      else if (f.musica_rapida != null) SONIDO.musicaRapida(!!f.musica_rapida);
      else if (f.ir_escena) { await irEscena(f.ir_escena); return 'cambio'; }
      else if (f.fin_mision) { await finMision(); return 'fin'; }
      else if (f.llamada) { await llamada(f.llamada); }
    }
    return null;
  }

  async function desaparecer(d) {
    const ids = [].concat(d.id);
    if (d.sonido === 'motor') SONIDO.sfx.motor();
    ids.forEach(id => { const e = ob(id) || pj(id); if (e) e.classList.add('sacar'); });
    await sleep(1300);
    ids.forEach(id => { const e = ob(id) || pj(id); if (e) e.remove(); delete E.x[id]; });
  }

  async function llamada(c) {
    const x = E.x[c.quien] != null ? E.x[c.quien] : 50;
    const pan = c.pan === 'segun_posicion' ? Math.max(-1, Math.min(1, (x - 50) / 50)) : 0;
    SONIDO.sfx.pop();
    const e = pj(c.quien); if (e) e.classList.add('resalta');
    await decir(c.quien, c.linea, { pan });
    if (e) setTimeout(() => e.classList.remove('resalta'), 1800);
  }

  function pistas(clave) {
    if (!clave) return;
    const marcar = e => { if (e) { e.classList.add('pista'); setTimeout(() => e.classList.remove('pista'), 6000); } };
    if (typeof clave === 'object') { marcar(pj(clave.marca) || ob(clave.marca)); return; }   // generico: {"marca": "id"}
    if (clave === 'chaqueta_roja') marcar(pj('sara'));
    else if (clave === 'junto_a_max') marcar(pj('max'));
    else if (clave === 'cerca_musica') marcar(ob('speaker'));
  }

  function cond(c) {
    const cmp = (v, t) => { const m = /^(>=|<=|>|<|==)?\s*(\d+)$/.exec(String(t)); const n = +m[2]; switch (m[1] || '==') { case '>=': return v >= n; case '<=': return v <= n; case '>': return v > n; case '<': return v < n; default: return v === n; } };
    if (c.cualquiera) return c.cualquiera.some(cond);
    if (c.todas) return c.todas.every(cond);
    if (c.errores_seguidos != null) return cmp(E.erroresSeguidos, c.errores_seguidos);
    if (c.interacciones != null) return cmp(E.dialogosHechos, c.interacciones);
    if (c.contador) return Object.entries(c.contador).every(([k, v]) => cmp(E.contadores[k] || 0, v));
    if (c.flag) return E.flags.has(c.flag);
    return false;
  }
  async function disparadores() {
    for (const d of (E.escenaDef.disparadores || [])) {
      if (E.disparados.has(d.id) && d.una_vez) continue;
      if (cond(d.cuando)) {
        E.disparados.add(d.id);
        const r = await efectos(d.efectos, { duenio: null });
        if (r) return r;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ dialogos */
  async function correrDialogo(duenio, dialogo) {
    for (const p of dialogo.pasos) {
      if (p.opciones) await turnoJugador(p, duenio);
      else {
        const l = resolver(p);
        await decir(l.quien, l);
        if (l.efectos) { const r = await efectos(l.efectos, { duenio }); if (r) return r; }
      }
    }
    E.flags.add(duenio + '_hablado');
    E.habladosEscena.add(duenio);   // para no repetir su dialogo en ESTA escena (en otra escena puede tener uno nuevo)
    E.dialogosHechos++;
    E.ultimaActividad = Date.now();
    return null;
  }

  function defPersonaje(id) { return E.escenaDef.personajes.find(p => p.id === id); }
  function defObjeto(id) { return (E.escenaDef.objetos || []).find(o => o.id === id); }
  const cumple = req => !req || E.flags.has(req) || E.habilitados.has(req);

  async function iniciarDialogoDe(def, dialogo) {
    const d = dialogo || def.dialogo;
    await caminarHasta(def.id);
    let r = await correrDialogo(def.id, d);
    if (r) return;
    pistas(def.pista);
    r = await efectos(d.al_terminar, { duenio: def.id });
    if (r) return;
    await disparadores();
  }

  /* ------------------------------------------------------------------ toques */
  async function ejecutar(fn) {
    if (ocupado || E.terminado) return;
    ocupado = true;
    try { await fn(); } catch (err) { console.error(err); } finally { ocupado = false; E.ultimaActividad = Date.now(); }
  }

  function alTocarPersonaje(id) {
    ejecutar(async () => {
      const def = defPersonaje(id);
      if (!def || id === 'bryan') return;
      if (def.rol === 'guia' || id === E.sigue) { const l = def.frases_loop && rnd(def.frases_loop); if (l) await decir(id, l); return; }
      // ya hablo (bloqueado, o su dialogo ya se hizo): responde con una frase corta de "ocupado" (la de la escena o la del elenco)
      const yaHablo = E.bloqueados.has(id) || (E.habladosEscena.has(id) && def.dialogo && !def.repetible);
      if (yaHablo) { const lista = def.ocupado || lineas(id, 'ocupado'); if (lista.length) { await caminarHasta(id); await decir(id, rnd(lista)); } return; }
      if (def.dialogo && !cumple(def.dialogo.requiere)) {
        // aun no le toca: dice su frase de "antes" (o una de ocupado del elenco); si no tiene, el nombre de su objeto
        const p = personaje(id), occ = def.ocupado || lineas(id, 'ocupado'), antes = def.antes || (occ.length && rnd(occ));
        if (antes) { await caminarHasta(id); await decir(id, antes); return; }
        const o = def.objeto_asociado && ob(def.objeto_asociado); if (o) await nombreObjeto(def.objeto_asociado);
        return;
      }
      if (!def.dialogo) return;
      await iniciarDialogoDe(def);
    });
  }

  async function nombreObjeto(id) {
    const d = defObjeto(id); const ref = d && d.texto_ref;
    const a = ref && M.objetos_audio[ref]; if (!a) return;
    const e = ob(id); if (e) { e.classList.add('rebota'); setTimeout(() => e.classList.remove('rebota'), 400); }
    await decir(id, a, { sobre: id });
  }

  function alTocarObjeto(id) {
    ejecutar(async () => {
      const d = defObjeto(id); if (!d) return;
      const duenioNPC = E.escenaDef.personajes.find(p => p.objeto_asociado === id);
      if (d.dialogo) {
        if (!cumple(d.dialogo.requiere)) {
          const g = E.escenaDef.personajes.find(p => p.rol === 'guia');
          const fr = g && (g.frase_requiere || g.frase_taxi_primero);
          if (fr) await decir(g.id, fr); else await nombreObjeto(id);
          return;
        }
        await caminarHasta(id);
        const g = E.escenaDef.personajes.find(p => p.rol === 'guia');
        const r = await correrDialogo(g ? g.id : 'bryan', d.dialogo);
        if (r) return;
        await efectos(d.dialogo.al_terminar, { duenio: id });
        return;
      }
      if (duenioNPC) {
        if (E.bloqueados.has(duenioNPC.id)) { await nombreObjeto(id); return; }
        if (duenioNPC.dialogo && cumple(duenioNPC.dialogo.requiere) && !E.flags.has(duenioNPC.id + '_hablado')) { await iniciarDialogoDe(duenioNPC); return; }
      }
      await nombreObjeto(id);
    });
  }

  /* ------------------------------------------------------------------ escenas */
  function ocioLoop() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (ocupado || E.terminado || !E.escenaDef) return;
      const g = E.escenaDef.personajes.find(p => p.rol === 'guia');
      if (!g || !g.frases_loop || (g.silencio_tras && E.flags.has(g.silencio_tras))) return;
      if (Date.now() - E.ultimaActividad < (RAPIDO ? 300 : 14000)) return;
      ejecutar(async () => { await decir(g.id, rnd(g.frases_loop)); });
    }, RAPIDO ? 150 : 1500);
  }

  async function irEscena(id, primera) {
    const velo = $('#velo');
    if (!primera) { velo.classList.add('on'); await sleep(450); }
    const def = M.escenas.find(s => s.id === id);
    const lay = L[id];
    E.escena = id; E.escenaDef = def; E.x = {}; E.habladosEscena = new Set(); E.sigue = lay.sigue || (lay.sara_sigue ? 'sara' : null);
    if (def.luz_inicial != null) E.luz = def.luz_inicial; else E.luz = 1;
    $('#fondo').innerHTML = ARTE.fondo(def.fondo);
    $('#capa-objetos').innerHTML = ''; $('#capa-personajes').innerHTML = '';
    (def.objetos || []).forEach(o => { const pos = lay.objetos[o.id]; if (pos) crearObjeto(o, pos); else console.warn('sin layout para', o.id); });

    // personajes
    const lugares = {};
    if (def.slots) {
      const decoys = barajar(def.personajes.filter(p => p.rol === 'decoy').map(p => p.id));
      const target = def.personajes.find(p => p.colocacion);
      const orden = decoys.slice();
      if (target) { const k = orden.indexOf(target.colocacion.junto_a); orden.splice(k + 1, 0, target.id); }
      orden.forEach((pid, i) => { lugares[pid] = { x: lay.slots[i][0], y: lay.slots[i][1] }; });
    } else Object.assign(lugares, lay.personajes || {});
    for (const p of def.personajes) {
      if (p.rol === 'guia' && !lugares[p.id]) continue;
      const pos = lugares[p.id]; if (!pos) continue;
      const e = crearPersonaje(p.id, pos.x, pos.y, { interactivo: true });
      if (pos.x > (lay.jugador.x) ) e.classList.add('izq');
    }
    // jugador y Sara (si acompana)
    const sPos = lay.jugador;
    crearPersonaje('bryan', sPos.x, sPos.y);
    E.jugadorX = sPos.x;
    if (E.sigue && !pj(E.sigue)) { crearPersonaje(E.sigue, sPos.x - 5, sPos.y, { interactivo: true }); E.x[E.sigue] = sPos.x - 5; }
    // personajes que solo estan en el layout (acompanan la escena sin dialogo propio)
    Object.entries(lay.personajes || {}).forEach(([pid, pos]) => { if (!pj(pid) && pid !== E.sigue && M.elenco[pid]) crearPersonaje(pid, pos.x, pos.y, { interactivo: true }); });
    Array.from(E.bloqueados).forEach(id => { const e = pj(id); if (e) e.classList.add('bloqueado'); });
    actualizarLuz();
    medir();
    const t = $('#titulo-escena'); t.textContent = def.titulo; t.classList.add('ver'); setTimeout(() => t.classList.remove('ver'), 2200);
    SONIDO.musicaOn(def.musica || M.musica_inicial);
    velo.classList.remove('on');
    await sleep(450);
    ocioLoop();
    if (def.inicio_automatico || def.personajes.some(p => p.auto)) autoIniciar(def);
  }

  function autoIniciar(def) {
    (async () => {
      while (ocupado) await sleep(60);
      await ejecutar(async () => {
        for (const p of def.personajes) {
          if (!p.dialogo || p.dialogo.requiere || !(p.auto || p.rol === 'conductor') || E.habladosEscena.has(p.id)) continue;   // solo los que hablan solos (y una vez)
          if (E.escena !== def.id) return;
          let r = await correrDialogo(p.id, p.dialogo);
          if (r) return;
          pistas(p.pista);
          r = await efectos(p.dialogo.al_terminar, { duenio: p.id });
          if (r) return;
        }
      });
    })();
  }

  /* ------------------------------------------------------------------ inicio y fin */
  function estrellas() {
    const e = M.reglas_juego.estrellas;
    if (E.errores <= e['3'].max_errores) return 3;
    if (E.errores <= e['2'].max_errores) return 2;
    return 1;
  }

  async function finMision() {
    E.terminado = true; clearInterval(idleTimer);
    SONIDO.sfx.fin();
    const est = estrellas();
    const res = { estrellas: est, errores: E.errores, puntos: E.puntos, turnos: E.turnos, monedas: E.monedas, repaso: E.repaso, reglas: E.reglas, fecha: new Date().toISOString() };
    guardar(res);
    window.__resultado = res;
    avisar({ tipo: 'fin', mision: M.id, resultado: res });
    await sleep(700);
    const m = $('#modal'); m.hidden = false;
    m.innerHTML = `<div class="tarjeta"><h1>🏠 Mission complete!</h1>
      <div class="estrellas">${'⭐'.repeat(est)}${'☆'.repeat(3 - est)}</div>
      <div class="datos"><span>🪙 ${E.monedas}</span><span>✅ ${E.puntos.toFixed(1)}/${E.turnos}</span><span>❌ ${E.errores}</span></div>
      <button class="btn" id="b-conv">📜 Conversation</button>
      <button class="btn sec" id="b-rep">🔁 Review (${E.repaso.length})</button>
      <button class="btn sec" id="b-otra">▶ Play again</button>
      <button class="btn sec" id="b-lista">📋 Stories</button>${EMBED ? '<button class="btn sec" id="b-salir">✕ Exit</button>' : ''}</div>`;
    if (EMBED) $('#b-salir').onclick = () => avisar({ tipo: 'salir' });
    $('#b-otra').onclick = () => location.reload();
    $('#b-lista').onclick = irALista;
    $('#b-conv').onclick = () => verLog(false);
    $('#b-rep').onclick = () => verLog(true);
  }

  function verLog(soloRepaso) {
    const m = $('#modal');
    let html = '<div class="tarjeta"><h1>' + (soloRepaso ? '🔁 Review' : '📜 Conversation') + '</h1><div class="dialogo-log">';
    if (soloRepaso) {
      html += E.repaso.length ? E.repaso.map(r => `<p><b>${r.escena}${r.reglaIds.length ? ' · regla ' + r.reglaIds.join(', ') : ''}</b>${r.texto}</p>`).join('') : '<p>Perfect! Nothing to review. 🎉</p>';
    } else {
      html += E.log.map(l => `<p class="${l.quien === 'bryan' ? 'yo' : ''}${l.mal ? ' mal' : ''}"><b>${l.quien}</b>${l.texto}</p>`).join('');
    }
    html += '</div><button class="btn" id="b-volver">Back</button></div>';
    m.innerHTML = html;
    $('#b-volver').onclick = finMisionPantalla;
  }
  function finMisionPantalla() { E.terminado = false; finMision(); }

  function pantallaInicio() {
    const m = $('#modal'); m.hidden = false;
    m.innerHTML = `<div class="tarjeta"><h1>${M.titulo}</h1>
      <div class="obj-en">🎯 ${M.objetivo}</div><div class="obj-es">${M.objetivo_es}</div>
      <p style="font-size:13px;opacity:.7;margin:0 0 14px">Tap the characters, listen, and choose the right audio.</p>
      <button class="btn" id="b-start">Start</button></div>`;
    $('#b-start').onclick = async () => {
      SONIDO.iniciar();
      try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => {}); } catch (e) { /* no soportado */ }
      m.hidden = true;
      $('#hud-objetivo').textContent = M.objetivo;
      await irEscena(M.escenas[0].id, true);
    };
  }

  function orientacion() {
    const v = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('vertical', v);
    $('#girar').hidden = false;
    if (v) SONIDO.detener();
  }
  async function arrancar() {
    orientacion(); window.addEventListener('resize', orientacion); window.addEventListener('orientationchange', orientacion);
    E = estadoNuevo();
    window.__juego = { get estado() { return E; }, get mision() { return M; } };
    const [m, l] = await Promise.all([
      fetch(`data/compilado/${MID}.json`).then(r => r.json()),
      fetch(`data/layouts/${MID}.json`).then(r => r.json())
    ]);
    M = m; L = l;
    document.title = M.titulo;
    medir(); window.addEventListener('resize', () => { medir(); actualizarLuz(); });
    $('#repetir').onclick = repetirUltima;
    $('#btn-lista').onclick = () => {
      const mo = $('#modal'); mo.hidden = false;
      mo.innerHTML = `<div class="tarjeta"><div class="obj-en">Leave this story?</div><div class="obj-es">¿Salir de esta historia? Perderas el avance de esta partida.</div>
        <button class="btn" id="b-si">📋 Stories</button><button class="btn sec" id="b-no">Stay</button></div>`;
      $('#b-si').onclick = irALista; $('#b-no').onclick = () => { mo.hidden = true; };
    };
    $('#btn-objetivo').onclick = () => { if (E.terminado) return; const mo = $('#modal'); mo.hidden = false; mo.innerHTML = `<div class="tarjeta"><div class="obj-en">🎯 ${M.objetivo}</div><div class="obj-es">${M.objetivo_es}</div><button class="btn" id="b-ok">OK</button></div>`; $('#b-ok').onclick = () => { mo.hidden = true; }; };
    if (EMBED) { const bs = $('#btn-salir'); bs.hidden = false; bs.onclick = () => avisar({ tipo: 'salir' }); }
    pantallaInicio();
  }

  /* ------------------------------------------------------------------ lista de historias */
  function irALista() { SONIDO.detener(); location.href = 'jugar.html' + (EMBED ? '?embed=1' : ''); }
  function irAMision(id) { location.href = `jugar.html?m=${id}` + (EMBED ? '&embed=1' : ''); }
  const leerLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
  const escribirLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } };

  async function lista() {
    document.body.classList.add('modo-lista');
    $('#app').style.display = 'none';
    const sec = $('#lista'); sec.hidden = false;
    const [cat, ind] = await Promise.all([
      fetch('data/catalogo_misiones.json').then(r => r.json()),
      fetch('data/compilado/indice.json').then(r => r.json()).catch(() => ({ misiones: [] }))
    ]);
    let db = {};
    try { db = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) { /* vacio */ }
    const jugables = new Set(ind.misiones || []);
    const ms = cat.misiones;
    const hechas = ms.filter(m => db[m.id] && db[m.id].intentos > 0);
    const siguiente = ms.find(m => jugables.has(m.id) && !(db[m.id] && db[m.id].intentos > 0));
    let filtro = leerLS('aventura_filtro', 'todas');

    const tarjeta = m => {
      const d = db[m.id], hecha = d && d.intentos > 0, ok = jugables.has(m.id);
      const est = hecha ? '⭐'.repeat(d.mejorEstrellas || 0) + '☆'.repeat(3 - (d.mejorEstrellas || 0)) : '';
      const chip = !ok ? '<span class="estado pronto">🔒 Soon</span>'
        : hecha ? `<span class="estado hecha">✓ Done${d.intentos > 1 ? ' ×' + d.intentos : ''}</span>`
        : '<span class="estado nueva">New</span>';
      const cls = ['hist', hecha ? 'hecha' : '', ok ? '' : 'bloq', siguiente && m.id === siguiente.id ? 'sig' : ''].join(' ');
      return `<button class="${cls}" data-id="${m.id}" ${ok ? '' : 'disabled'}>
        <div class="cab"><span class="num">#${m.n}</span><span class="niv">${m.nivel}</span><span class="est">${est}</span></div>
        <div class="tit-en">${m.titulo}</div><div class="tit-es">${m.titulo_es}</div>${chip}</button>`;
    };
    const render = () => {
      const visibles = ms.filter(m => filtro === 'todas' ? true : filtro === 'hechas' ? (db[m.id] && db[m.id].intentos > 0) : !(db[m.id] && db[m.id].intentos > 0));
      const grupos = [['A2', 'A2 · Starting'], ['A2-B1', 'A2–B1 · Growing'], ['B1', 'B1 · Getting stronger']];
      let html = `<header class="lcab">
          <div class="ltit">🎮 Stories <span class="prog">${hechas.length}/${ms.length} ✓</span></div>
          <div class="lfil">${[['todas', 'All'], ['pendientes', 'To do'], ['hechas', 'Done']].map(([k, t]) => `<button class="chip ${filtro === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
          <span class="chip">🪙 ${db.monedas || 0}</span>${EMBED ? '<button class="chip" id="l-salir" aria-label="Exit">✕</button>' : ''}
        </header>
        <div class="barra"><div style="width:${(100 * hechas.length / ms.length).toFixed(1)}%"></div></div>`;
      for (const [niv, nombre] of grupos) {
        const g = visibles.filter(m => m.nivel === niv);
        if (!g.length) continue;
        html += `<h2>${nombre}</h2><div class="rejilla">${g.map(tarjeta).join('')}</div>`;
      }
      if (!visibles.length) html += '<p class="vacio">Nothing here yet.</p>';
      sec.innerHTML = html;
      sec.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; escribirLS('aventura_filtro', filtro); render(); });
      sec.querySelectorAll('.hist:not(.bloq)').forEach(b => b.onclick = () => irAMision(b.dataset.id));
      const ls = $('#l-salir'); if (ls) ls.onclick = () => avisar({ tipo: 'salir' });
      const sig = sec.querySelector('.hist.sig'); if (sig) sig.scrollIntoView({ block: 'center' });
    };
    render();
  }

  if (!MID) { lista().catch(err => { document.body.innerHTML = '<pre style="padding:20px;color:#fff">No se pudo cargar la lista de historias.\n' + err + '</pre>'; }); return; }
  arrancar().catch(err => { document.body.innerHTML = '<pre style="padding:20px;color:#fff">No se pudo cargar la mision.\nAbre esta pagina con un servidor local (python -m http.server) y revisa data/compilado/' + MID + '.json\n\n' + err + '</pre>'; });
})();
