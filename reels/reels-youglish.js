  // ==================== REELS (sorpresa 1: Mundo real con YouGlish) ====================
  // Busca una palabra (>3 letras) de lo último que estudiaste, reproduce SOLO
  // la frase donde aparece (se corta al terminar), la repite hasta 5 veces a
  // 0.8x, y pregunta cuál de 3 palabras se dice en esa frase. La correcta es
  // otra palabra de la misma frase (no la buscada); las otras 2 no están en
  // la frase y se parecen en largo y sonido. Sin subtítulos.
  const RL_YT_REPS = 5;
  const RL_YT_PAUSA = 1000;
  const RL_YT_VEL = 0.8;
  const RL_YT_MARGEN = 300;
  const RL_YT_TOPE_CLIP = 14000;
  const RL_YT_FALLBACK = {
    en: ["about", "after", "again", "always", "around", "because", "before", "better", "called", "change", "close", "could", "every", "family", "first", "friend", "going", "great", "happy", "house", "know", "later", "little", "money", "never", "night", "other", "people", "place", "right", "should", "small", "something", "still", "thing", "think", "those", "today", "together", "until", "water", "where", "which", "while", "world", "would", "years", "young"],
    it: ["sempre", "adesso", "molto", "tutto", "quando", "perché", "ancora", "allora", "questo", "quello", "niente", "persone", "grazie", "parlare", "andare", "lavoro", "casa", "tempo", "giorno", "notte", "amico", "bello", "grande", "piccolo", "prima", "dopo", "fare", "dire", "sapere", "vedere"],
  };
  let RL_YT_API = null;

  function rlYtApi() {
    if (window.YG && window.YG.Widget) return Promise.resolve(true);
    if (RL_YT_API) return RL_YT_API;
    RL_YT_API = new Promise((resolve, reject) => {
      const prev = window.onYouglishAPIReady;
      window.onYouglishAPIReady = function () { try { prev && prev(); } catch (e) { /* nada */ } resolve(true); };
      const s = document.createElement("script");
      s.src = "https://youglish.com/public/emb/widget.js";
      s.charset = "utf-8";
      s.onerror = () => { RL_YT_API = null; reject(new Error("widget.js")); };
      document.head.appendChild(s);
      setTimeout(() => { if (!(window.YG && window.YG.Widget)) { RL_YT_API = null; reject(new Error("timeout")); } }, 15000);
    });
    return RL_YT_API;
  }

  function rlYtDec(t) { t = String(t || ""); try { return decodeURIComponent(t.replace(/\+/g, " ")); } catch (e) { return t; } }
  function rlYtPalabras(texto) { return (String(texto || "").toLowerCase().match(/[a-zà-ÿ']+/g) || []).map((w) => w.replace(/^'+|'+$/g, "")).filter(Boolean); }

  function rlYtTextosFuente() {
    const t = (RL.recientes || []).slice(-20);
    if (t.length < 5) RL.banco.slice(0, 15).forEach((it) => { if (it.k === "ex") t.push(rlTextoObjetivo(it.ex)); });
    return t;
  }

  function rlPalabraParaYT() {
    const usadas = new Set(RL.yt.usadas || []);
    const cands = [];
    rlYtTextosFuente().forEach((txt) => rlYtPalabras(txt).forEach((w) => { if (w.length > 3 && !w.includes("'") && !usadas.has(w) && !cands.includes(w)) cands.push(w); }));
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    const fb = (RL_YT_FALLBACK[getTargetLanguage()] || RL_YT_FALLBACK.en).filter((w) => !usadas.has(w));
    return fb.length ? fb[Math.floor(Math.random() * fb.length)] : null;
  }

  // Palabras parecidas que NO están en la frase (largo ±1, mismo inicio o final).
  function rlYtDistractores(objetivo, enFrase) {
    const pool = new Set();
    const fuentes = (RL.recientes || []).concat(RL.banco.filter((it) => it.k === "ex").map((it) => rlTextoObjetivo(it.ex)));
    fuentes.forEach((t) => rlYtPalabras(t).forEach((w) => pool.add(w)));
    (RL_YT_FALLBACK[getTargetLanguage()] || []).forEach((w) => pool.add(w));
    const puntaje = (w) => {
      let s = 0;
      if (w.length === objetivo.length) s += 2; else if (Math.abs(w.length - objetivo.length) === 1) s += 1; else s -= 3;
      if (w[0] === objetivo[0]) s += 2;
      if (w.slice(-2) === objetivo.slice(-2)) s += 2;
      if (w.slice(0, 2) === objetivo.slice(0, 2)) s += 1;
      return s + Math.random();
    };
    const cands = Array.from(pool).filter((w) => w.length >= 3 && w !== objetivo && !enFrase.has(w) && !w.includes("'"));
    cands.sort((a, b) => puntaje(b) - puntaje(a));
    const top = shuffleArray(cands.slice(0, 6));
    return top.slice(0, 2);
  }

  function rlYtElegirObjetivo(texto, buscada) {
    // La palabra buscada viene marcada con [[[ ]]]: se excluye.
    const marcadas = new Set();
    texto.replace(/\[\[\[(.*?)\]\]\]/g, (_, m) => { rlYtPalabras(m).forEach((w) => marcadas.add(w)); return ""; });
    marcadas.add(buscada);
    const limpio = texto.replace(/\[\[\[|\]\]\]/g, "");
    const palabras = rlYtPalabras(limpio);
    const enFrase = new Set(palabras);
    let cands = palabras.filter((w) => !marcadas.has(w) && !w.includes("'") && w.length >= 4);
    if (!cands.length) cands = palabras.filter((w) => !marcadas.has(w) && !w.includes("'") && w.length >= 3);
    if (!cands.length) return null;
    const objetivo = cands[Math.floor(Math.random() * cands.length)];
    const dis = rlYtDistractores(objetivo, enFrase);
    if (dis.length < 2) return null;
    return { objetivo, opciones: shuffleArray([objetivo].concat(dis)), frase: limpio, enFrase };
  }

  function rlRenderYT(item, body) {
    const hostId = "rlYt_" + item.uid;
    body.innerHTML = rlCabecera(["🌎 Mundo real"]) + `
      <div class="rl-sorpresa rl-yt">
        <h2 class="rl-title">¿Qué palabra escuchas?</h2>
        <p class="rl-sub rl-yt-estado">Buscando un clip real…</p>
        <div class="rl-yt-host"><div id="${hostId}"></div></div>
        <div class="rl-yt-ops"></div>
        <div class="rl-yt-frase" hidden></div>
        <div class="rl-hist-foot">
          <button class="fun-btn rl-omitir">⏭ Omitir</button>
          <button class="fun-btn primary-btn rl-continuar" hidden>Continuar ⬆</button>
        </div>
        <p class="rl-credit">Powered by <a href="https://youglish.com" target="_blank" rel="noopener">YouGlish.com</a></p>
      </div>`;
    const estado = body.querySelector(".rl-yt-estado");
    const opsEl = body.querySelector(".rl-yt-ops");
    const S = { widget: null, palabra: null, intentos: 0, hit: null, reto: null, reps: 0, terminado: false, respondida: false, cutT: null, maxT: null, repT: null, buscarT: null, vivo: true };

    const limpiar = () => {
      S.vivo = false;
      [S.cutT, S.maxT, S.repT, S.buscarT].forEach((t) => clearTimeout(t));
      try { S.widget && S.widget.pause && S.widget.pause(); } catch (e) { /* nada */ }
      try { S.widget && S.widget.close && S.widget.close(); } catch (e) { /* nada */ }
      S.widget = null;
    };
    RLV.limpiar = limpiar;

    const fin = () => { limpiar(); rlSorpresaHecha(item); };
    body.querySelector(".rl-omitir").onclick = fin;
    body.querySelector(".rl-continuar").onclick = fin;

    const sinClip = (msg) => {
      if (!S.vivo) return;
      rlAnotar(item, "sin clip: " + (msg || "no se encontró"));
      rlGuardar();
      estado.textContent = msg || "No se encontró un clip. Sigamos.";
      body.querySelector(".rl-omitir").hidden = true;
      body.querySelector(".rl-continuar").hidden = false;
    };

    const finClip = () => {
      if (!S.vivo || S.terminado) return;
      S.terminado = true;
      clearTimeout(S.maxT); clearTimeout(S.cutT);
      try { S.widget.pause(); } catch (e) { /* nada */ }
      S.reps++;
      if (S.reps < RL_YT_REPS) {
        estado.textContent = S.respondida ? "Repitiendo la frase…" : "Escucha otra vez (" + (S.reps + 1) + "/" + RL_YT_REPS + ")";
        S.repT = setTimeout(() => {
          if (!S.vivo) return;
          S.hit = null; S.terminado = false;
          try { S.widget.replay(); } catch (e) { /* nada */ }
          armarTope();
        }, RL_YT_PAUSA);
      } else {
        estado.textContent = S.respondida ? "" : "Elige la palabra que escuchaste.";
      }
    };

    const armarTope = () => { clearTimeout(S.maxT); S.maxT = setTimeout(finClip, RL_YT_TOPE_CLIP); };

    const mostrarOpciones = () => {
      if (!S.reto || opsEl.childElementCount) return;
      estado.textContent = "Escucha (" + (S.reps + 1) + "/" + RL_YT_REPS + ") y elige la palabra que se dice.";
      opsEl.innerHTML = S.reto.opciones.map((w) => `<button class="rl-op rl-yt-op" data-w="${rlEsc(w)}">${rlEsc(w)}</button>`).join("");
      opsEl.querySelectorAll(".rl-yt-op").forEach((b) => {
        b.onclick = () => {
          if (S.respondida) return;
          S.respondida = true;
          const elegida = b.dataset.w;
          const ok = elegida === S.reto.objetivo;
          opsEl.querySelectorAll(".rl-yt-op").forEach((x) => {
            if (x.dataset.w === S.reto.objetivo) x.classList.add("rl-op-ok");
            else if (x === b) x.classList.add("rl-op-bad");
            x.disabled = true;
          });
          const fr = body.querySelector(".rl-yt-frase");
          const re = new RegExp("\\b(" + S.reto.objetivo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")\\b", "i");
          fr.innerHTML = "“" + rlEsc(S.reto.frase).replace(re, "<mark>$1</mark>") + "”";
          fr.hidden = false;
          estado.textContent = ok ? "🎉 ¡Bien! La oíste." : "👀 Era «" + S.reto.objetivo + "».";
          if (ok) burstConfetti();
          RL.reporte.mundo.push({ palabra: S.palabra, frase: S.reto.frase, objetivo: S.reto.objetivo, elegida, ok });
          rlGuardar();
          body.querySelector(".rl-omitir").hidden = true;
          body.querySelector(".rl-continuar").hidden = false;
        };
      });
    };

    const buscar = () => {
      if (!S.vivo) return;
      S.intentos++;
      S.palabra = rlPalabraParaYT();
      if (!S.palabra || S.intentos > 4) { sinClip(); return; }
      RL.yt.usadas.push(S.palabra);
      if (RL.yt.usadas.length > 400) RL.yt.usadas = RL.yt.usadas.slice(-400);
      rlGuardar();
      S.hit = null; S.reto = null; S.reps = 0; S.terminado = false; S.track = null;
      opsEl.innerHTML = "";
      estado.textContent = "Buscando un clip real…";
      try { S.widget.fetch(S.palabra, getTargetLanguage() === "it" ? "italian" : "english"); }
      catch (e) { sinClip("No se pudo buscar el clip."); return; }
      // Si en 15 s no aparece la frase, se intenta con otra palabra.
      clearTimeout(S.buscarT);
      S.buscarT = setTimeout(() => { if (!S.reto && S.vivo) { try { S.widget.next(); } catch (e) { /* nada */ } S.buscarT = setTimeout(() => { if (!S.reto && S.vivo) buscar(); }, 8000); } }, 15000);
    };

    rlYtApi().then(() => {
      if (!S.vivo) return;
      const host = body.querySelector(".rl-yt-host");
      const w = Math.max(220, Math.min(560, (host && host.clientWidth) || 320));
      S.widget = new YG.Widget(hostId, {
        width: w,
        autoStart: 1,
        components: 64,      // sin subtítulos (8) ni título (4)
        restrictionMode: 0,
        events: {
          onFetchDone: (e) => { if ((e.totalResult || 0) === 0) buscar(); },
          onVideoChange: (e) => {
            const tr = e && e.trackNumber;
            if (tr != null && tr === S.track) return;   // replay del mismo clip
            S.track = tr;
            if (S.respondida) return;                    // ya respondió: no se cambia nada
            S.hit = null; S.reto = null; S.reps = 0; S.terminado = false; opsEl.innerHTML = "";
            S.respondida = false;
            body.querySelector(".rl-yt-frase").hidden = true;
            armarTope();
          },
          onPlayerReady: () => { try { S.widget.setSpeed(RL_YT_VEL); } catch (e) { /* nada */ } },
          onPlayerStateChange: (e) => { if (e.state === 1) { try { if (S.widget.getSpeed && S.widget.getSpeed() !== RL_YT_VEL) S.widget.setSpeed(RL_YT_VEL); } catch (er) { /* nada */ } } },
          onCaptionChange: (e) => {
            if (S.hit || S.terminado) return;
            const txt = rlYtDec(e.caption);
            if (txt.indexOf("[[[") < 0) return;
            S.hit = { id: e.id };
            if (!S.reto) {
              S.reto = rlYtElegirObjetivo(txt, S.palabra);
              if (!S.reto) { try { S.widget.next(); } catch (er) { /* nada */ } S.hit = null; return; }
              clearTimeout(S.buscarT);
              mostrarOpciones();
            } else if (!S.respondida) {
              estado.textContent = "Escucha (" + (S.reps + 1) + "/" + RL_YT_REPS + ") y elige la palabra que se dice.";
            }
          },
          onCaptionConsumed: (e) => {
            if (S.hit && String(e.id) === String(S.hit.id)) {
              clearTimeout(S.cutT);
              S.cutT = setTimeout(finClip, RL_YT_MARGEN);
            }
          },
          onError: () => { try { S.widget.next(); } catch (e) { sinClip(); } },
        },
      });
      buscar();
    }).catch(() => sinClip("No se pudo cargar YouGlish (¿sin conexión?)."));
  }
