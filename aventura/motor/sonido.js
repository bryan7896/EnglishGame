/* Sonido del juego: musica de fondo sintetizada (loop suave y bajito), efectos y reproduccion de voces con pan.
 * Todo con Web Audio: no hace falta ningun archivo de musica. Las voces son los mp3 de Kokoro. */
window.SONIDO = (() => {
  let ctx = null, master = null, musGain = null, panNode = null;
  let musica = null, timer = null, paso = 0, proxima = 0, tempoMul = 1, silenciada = false;
  let voz = null, vozFin = null;
  const RAPIDO = new URLSearchParams(location.search).has('rapido');

  const MUSICAS = {
    party_loop:  { bpm: 112, base: 57, onda: 'triangle', escala: [0, 3, 5, 7, 10], patron: [0, 2, 1, 3, 2, 4, 3, 1], bajo: [0, 0, 3, 2] },
    street_loop: { bpm: 84,  base: 52, onda: 'sine',     escala: [0, 2, 3, 7, 9],  patron: [0, 1, 2, 1, 3, 2, 4, 2], bajo: [0, 3, 0, 2] },
    ride_loop:   { bpm: 96,  base: 55, onda: 'triangle', escala: [0, 2, 4, 7, 9],  patron: [0, 2, 4, 2, 1, 3, 4, 3], bajo: [0, 2, 3, 1] },
    home_loop:   { bpm: 72,  base: 53, onda: 'sine',     escala: [0, 2, 4, 5, 7],  patron: [0, 2, 4, 2, 3, 1, 2, 0], bajo: [0, 0, 3, 3] }
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function iniciar() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    musGain = ctx.createGain(); musGain.gain.value = 0.05; musGain.connect(master);
    panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panNode) panNode.connect(master);
  }

  function nota(t, midi, dur, onda, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = onda; o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musGain); o.start(t); o.stop(t + dur + 0.05);
  }

  function tick() {
    if (!ctx || !musica) return;
    const m = MUSICAS[musica]; if (!m) return;
    const seg = 60 / (m.bpm * tempoMul) / 2;
    while (proxima < ctx.currentTime + 0.35) {
      const i = paso % m.patron.length, grado = m.patron[i];
      nota(proxima, m.base + 12 + m.escala[grado], seg * 1.6, m.onda, 0.5);
      if (i % 2 === 0) nota(proxima, m.base - 12 + m.escala[m.bajo[(paso >> 1) % m.bajo.length]], seg * 3, 'sine', 0.7);
      proxima += seg; paso++;
    }
  }

  function musicaOn(id) {
    if (!ctx || RAPIDO) { musica = id; return; }
    if (musica === id && timer) return;
    musica = id; paso = 0; tempoMul = 1; proxima = ctx.currentTime + 0.1;
    if (!timer) timer = setInterval(tick, 120);
  }
  function musicaRapida(on) { tempoMul = on ? 1.4 : 1; }
  function silenciar(v) {
    silenciada = v;
    if (musGain) musGain.gain.setTargetAtTime(v ? 0 : 0.05, ctx.currentTime, 0.05);
  }
  function bajarMusica(bajar) {
    if (musGain && !silenciada) musGain.gain.setTargetAtTime(bajar ? 0.02 : 0.05, ctx.currentTime, 0.1);
  }

  function blip(f1, f2, dur, tipo, vol) {
    if (!ctx || RAPIDO) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    pop: () => blip(500, 900, 0.12, 'sine', 0.2),
    error: () => blip(220, 110, 0.25, 'sawtooth', 0.1),
    ok: () => { blip(660, 990, 0.15, 'triangle', 0.15); setTimeout(() => blip(990, 1320, 0.15, 'triangle', 0.12), 120); },
    moneda: () => blip(988, 1319, 0.18, 'square', 0.06),
    toque: () => blip(400, 300, 0.06, 'sine', 0.1),
    motor: () => {
      if (!ctx || RAPIDO) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(180, t + 1.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 1.6);
    },
    fin: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, f, 0.3, 'triangle', 0.15), i * 140))
  };

  function detener() {
    if (voz) { try { voz.pause(); } catch (e) { /* nada */ } voz = null; }
    if (vozFin) { const f = vozFin; vozFin = null; f(); }
  }

  // Reproduce un mp3 y resuelve cuando termina (o falla: el juego nunca se queda colgado).
  function decir(url, opc) {
    opc = opc || {};
    detener();
    if (RAPIDO) return new Promise(r => setTimeout(r, 30));
    return new Promise(resolve => {
      const a = new Audio(url);
      voz = a;
      let hecho = false;
      const fin = () => { if (hecho) return; hecho = true; if (voz === a) voz = null; vozFin = null; bajarMusica(false); resolve(); };
      vozFin = fin;
      a.addEventListener('ended', fin);
      a.addEventListener('error', () => { console.warn('audio no disponible', url); fin(); });
      if (opc.pan != null && ctx && panNode) {
        try {
          const src = ctx.createMediaElementSource(a);
          const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opc.pan));
          src.connect(p); p.connect(master);
        } catch (e) { /* si falla, suena centrado */ }
      }
      if (ctx) bajarMusica(true);
      const pr = a.play();
      if (pr && pr.catch) pr.catch(() => fin());
    });
  }

  return { iniciar, musicaOn, musicaRapida, silenciar, sfx, decir, detener, get silenciada() { return silenciada; } };
})();
