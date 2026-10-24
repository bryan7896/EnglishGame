// canciones/canciones-generador.js — "Aprender canción" (Parte 2: generador
// de ejercicios; Parte 3: generador POR NIVELES)
//
// Transforma UNA canción (song_<lang>_N.json, ver tracklist/NOTAS.md) en
// ejercicios reutilizando el MISMO formato de "exercise" que ya usan
// exercises/*.js, para que reels2.js los pinte sin ningún adaptador:
//   - seleccionar:    { pairs: [{ englishWord, spanishWord }] }
//   - completar:      { spanishWord, englishSentence (con "___"), options: [...] }
//   - traduccion:     { spanishWord, englishWord }
//   - dictado:        { text }
//   - audioSeleccion: { audioText, correct, distractors } (ejercicio nuevo
//     de la Parte 3, ver canciones/canciones-audio-seleccion.js — suena
//     `audioText` y el usuario elige `correct` entre 4 opciones en español)
//
// Este archivo NO toca localStorage: solo construye datos a partir del JSON
// + lo ya dominado (progreso.frasesDominadas, ver canciones-core.js).

const CANCIONES_DICTADO_MAX_PALABRAS = 6; // "frases cortas / de pocas palabras" (ver NOTAS.md)
const CANCIONES_SELECCIONAR_BLOQUE = 5;   // "5 a la vez", como pidió Bryan
const CANCIONES_CALENTAMIENTO_MAX = 6;    // Nivel 4: ronda corta antes de los Niveles 5-8 (ver NOTAS.md)
const CANCIONES_COMPLETAR_HUECOS_NIVEL6 = 2; // "uno o 2 phrases por cada originalPhrase" (ver flujo #3.6 de Bryan)

// ---------- "Frases repetidas": texto normalizado ----------
// Mismo criterio documentado en tracklist/NOTAS.md: minúsculas, sin
// puntuación, espacios colapsados. No se quitan tildes (si se escribe
// distinto en español sigue contando como distinto).
function cancionNormalizar(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.,!?;:"'()¿¡…\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cancionPalabras(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean);
}

function cancionEsCorta(texto) {
  const n = cancionPalabras(texto).length;
  return n > 0 && n <= CANCIONES_DICTADO_MAX_PALABRAS;
}

// Reemplaza la primera aparición literal (sin distinguir mayúsculas) de
// `trozo` dentro de `texto` por "___". Si `trozo` no aparece tal cual (JSON
// cargado a mano con algún desajuste), devuelve null y ese hueco se omite
// sin romper el resto — mismo criterio permisivo que cancionJSONValido() en
// canciones-core.js.
function cancionQuitarTrozo(texto, trozo) {
  if (!texto || !trozo) return null;
  const idx = String(texto).toLowerCase().indexOf(String(trozo).toLowerCase());
  if (idx === -1) return null;
  return texto.slice(0, idx) + "___" + texto.slice(idx + String(trozo).length);
}

// Igual que cancionQuitarTrozo pero quitando VARIOS trozos del mismo texto.
// OJO: `trozos` puede venir en cualquier orden (el orden de phrases[]/
// learn[] en el JSON no tiene por qué ser el orden en que esas palabras
// aparecen DENTRO de originalPhrase) — pero `options[]` tiene que calzar
// con el orden de los "___" tal como los va a encontrar el usuario en
// pantalla (checkCompletarAnswers de exercises/completar.js compara
// options[idx] contra el input número `idx` de IZQUIERDA A DERECHA). Por
// eso cada trozo se reemplaza primero por un marcador único y, recién al
// final, se recorre el texto de izquierda a derecha para devolver `usados`
// en el orden real en que van a quedar los huecos — no en el orden en que
// se procesaron. Los trozos que no aparezcan tal cual se omiten sin romper
// el resto (mismo criterio permisivo de cancionQuitarTrozo).
function cancionQuitarVariosTrozos(texto, trozos) {
  let actual = String(texto || "");
  const mapa = []; // índice del marcador -> trozo original (orden de PROCESO, no el final)
  (trozos || []).forEach((t) => {
    const idx = actual.toLowerCase().indexOf(String(t).toLowerCase());
    if (idx === -1) {
      console.warn('⚠️ Aprender canción (Nivel 6): "' + t + '" no aparece tal cual en "' + texto + '" — se omite ese hueco');
      return;
    }
    const marcador = "\u0000" + mapa.length + "\u0000"; // improbable que choque con texto real
    actual = actual.slice(0, idx) + marcador + actual.slice(idx + String(t).length);
    mapa.push(t);
  });

  const reMarcador = /\u0000(\d+)\u0000/g;
  const usados = [];
  let m;
  while ((m = reMarcador.exec(actual))) usados.push(mapa[parseInt(m[1], 10)]);
  const textoFinal = actual.replace(reMarcador, "___");

  return { texto: textoFinal, usados };
}

// Hasta `max` trozos para blanquear de una originalPhrase: primero sus
// propios phrases[], y si no trae (o trae menos de los que hacen falta), se
// completa con learn[].phrase de esa misma línea — así una línea sin
// phrases[] documentado igual puede aportar huecos en los Niveles 6/8.
function cancionTrozosParaBlanquear(item, max) {
  const candidatos = [...(item.phrases || []), ...((item.learn || []).map((l) => l.phrase))];
  const vistos = new Set();
  const out = [];
  for (const c of candidatos) {
    const norm = cancionNormalizar(c);
    if (!c || vistos.has(norm)) continue;
    vistos.add(norm);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

// ---------- Generador principal (Parte 2 — banco PLANO, ya no lo usa el
// flujo por niveles de la Parte 3, se deja tal cual por si sirve de
// referencia / fallback) ----------
// frasesDominadasPrevias: array de texto normalizado (progreso.frasesDominadas,
// ver cancionProgresoLeer() en canciones-core.js) — lo que el usuario ya
// dominó en sesiones anteriores de ESTA canción.
//
// Devuelve:
//   ejercicios:   [{ ex, _frase }], donde _frase es el texto normalizado de
//                 la originalPhrase o del learn[].phrase del que salió ese
//                 ejercicio (string, array de varios para "seleccionar", o
//                 null si no aplica), para que reels2.js sepa qué marcar
//                 como dominado cuando se aprueba.
//   totalPorFrase: { [fraseNormalizada]: cantidad de ejercicios generados
//                 con esa frase } — una frase queda "dominada" solo cuando
//                 se aprueban TODOS los ejercicios que la usan, no con el
//                 primero (ver rl2MarcarFrasesAprobadas en reels2.js).
export function cancionGenerarBanco(json, frasesDominadasPrevias) {
  const vistos = new Set((frasesDominadasPrevias || []).map(cancionNormalizar));
  const ejercicios = [];
  const seleccionarPairs = []; // se agrupan de a 5 al final

  function agregar(ex, frase) { ejercicios.push({ ex, _frase: frase || null }); }

  (json.segments || []).forEach((seg) => {
    (seg.content || []).forEach((item) => {
      const originalPhrase = item.originalPhrase || "";
      const fraseLinea = cancionNormalizar(originalPhrase);
      const lineaEsNueva = !!fraseLinea && !vistos.has(fraseLinea);

      if (lineaEsNueva) {
        vistos.add(fraseLinea);

        // Completar: originalPhrase quitando cada phrases[] (un ejercicio por phrase).
        (item.phrases || []).forEach((p) => {
          const conHueco = cancionQuitarTrozo(originalPhrase, p);
          if (!conHueco) {
            console.warn('⚠️ Aprender canción: "' + p + '" no aparece tal cual en "' + originalPhrase + '" — se omite ese hueco de completar');
            return;
          }
          agregar({ type: "completar", spanishWord: item.translation || "", englishSentence: conHueco, options: [p] }, fraseLinea);
        });

        // Traducción de la línea completa.
        if (item.translation) agregar({ type: "traduccion", spanishWord: item.translation, englishWord: originalPhrase }, fraseLinea);

        // Dictado, solo si la línea es corta.
        if (cancionEsCorta(originalPhrase)) agregar({ type: "dictado", text: originalPhrase }, fraseLinea);
      }

      // learn[]: cada phrase es su propia unidad de "frase repetida",
      // independiente de si la línea (originalPhrase) ya se vio — así una
      // expresión nueva dentro de una línea ya conocida no se pierde.
      (item.learn || []).forEach((l) => {
        const fraseLearn = cancionNormalizar(l.phrase);
        if (!fraseLearn || vistos.has(fraseLearn)) return;
        vistos.add(fraseLearn);

        seleccionarPairs.push({ englishWord: l.phrase, spanishWord: l.translation || "", _frase: fraseLearn });

        (l.exercises || []).forEach((ex) => {
          if (ex.translation) agregar({ type: "traduccion", spanishWord: ex.translation, englishWord: ex.sentence }, fraseLearn);
          const conHueco = cancionQuitarTrozo(ex.sentence, l.phrase);
          if (conHueco) agregar({ type: "completar", spanishWord: ex.translation || item.translation || "", englishSentence: conHueco, options: [l.phrase] }, fraseLearn);
          if (cancionEsCorta(ex.sentence)) agregar({ type: "dictado", text: ex.sentence }, fraseLearn);
        });
      });
    });
  });

  // Seleccionar: bloques de 5 (si sobran menos al final, ese bloque queda
  // incompleto en vez de descartarse). Un bloque reparte su aprobación entre
  // TODAS las frases que contiene (ver totalPorFrase más abajo).
  for (let i = 0; i < seleccionarPairs.length; i += CANCIONES_SELECCIONAR_BLOQUE) {
    const bloque = seleccionarPairs.slice(i, i + CANCIONES_SELECCIONAR_BLOQUE);
    agregar(
      { type: "seleccionar", pairs: bloque.map((p) => ({ englishWord: p.englishWord, spanishWord: p.spanishWord })) },
      bloque.map((p) => p._frase)
    );
  }

  const totalPorFrase = {};
  ejercicios.forEach((e) => {
    const frases = Array.isArray(e._frase) ? e._frase : (e._frase ? [e._frase] : []);
    frases.forEach((f) => { totalPorFrase[f] = (totalPorFrase[f] || 0) + 1; });
  });

  return { ejercicios, totalPorFrase };
}

// ======================================================================
// Parte 3 — generador POR NIVELES (lo que usa reels2.js de acá en más)
// ======================================================================
// Distractores en español para "audioSeleccion", limpios de cualquiera que
// por error del JSON a mano coincida con la propia traducción correcta
// (mismo criterio permisivo que el resto del generador: si algo no calza,
// se omite esa parte en vez de romper la canción completa).
function cancionDistractoresLimpios(item) {
  const correctaNorm = cancionNormalizar(item.translation);
  return (item.distractors || []).filter((d) => d && cancionNormalizar(d) !== correctaNorm);
}

// ---------- Nivel 1 — "Seleccionar" (ver flujo #3.1 de Bryan) ----------
// TODOS los pares learn[].phrase/translation de la canción completa (no por
// segmento), en bloques de 5. Es el mismo tipo de bloque que ya generaba
// cancionGenerarBanco, aislado en su propio nivel: hasta que el usuario no
// los pase todos sin que le quede ninguno pendiente en la cola (ver
// "si falla una selección de ese bloque, ese bloque pasaría al final" —
// implementado en reels2.js, no acá), no se avanza al Nivel 2.
//
// Devuelve { ejercicios, totalPorFrase } con el mismo formato que
// cancionGenerarBanco.
export function cancionGenerarNivel1(json, frasesDominadasPrevias) {
  const vistos = new Set((frasesDominadasPrevias || []).map(cancionNormalizar));
  const pares = [];

  (json.segments || []).forEach((seg) => {
    (seg.content || []).forEach((item) => {
      (item.learn || []).forEach((l) => {
        const fraseLearn = cancionNormalizar(l.phrase);
        if (!fraseLearn || vistos.has(fraseLearn)) return;
        vistos.add(fraseLearn);
        pares.push({ englishWord: l.phrase, spanishWord: l.translation || "", _frase: fraseLearn });
      });
    });
  });

  const ejercicios = [];
  for (let i = 0; i < pares.length; i += CANCIONES_SELECCIONAR_BLOQUE) {
    const bloque = pares.slice(i, i + CANCIONES_SELECCIONAR_BLOQUE);
    ejercicios.push({
      ex: { type: "seleccionar", pairs: bloque.map((p) => ({ englishWord: p.englishWord, spanishWord: p.spanishWord })) },
      _frase: bloque.map((p) => p._frase),
    });
  }

  const totalPorFrase = {};
  ejercicios.forEach((e) => (e._frase || []).forEach((f) => { totalPorFrase[f] = (totalPorFrase[f] || 0) + 1; }));
  return { ejercicios, totalPorFrase };
}

// ---------- Nivel 2 — "Completar" + flujo por segmento (ver flujo #3.2) ----------
// frasesDominadasPrevias se debe leer DESPUÉS de terminar el Nivel 1 (para
// que ya incluya lo recién dominado ahí) — reels2.js se encarga de eso, acá
// solo se recibe como parámetro.
//
// Por cada segments[n] (estrofa) se generan dos "tareas" en orden:
//   1) "completar": los huecos de cada originalPhrase/learn[].exercises[].sentence.
//      Se deben terminar al 100% antes de pasar a la tarea 2 (ver reels2.js).
//   2) "resto": traducción + dictado + audioSeleccion + seleccionar (bloques
//      de 5 con los pares learn[] nuevos DE ESE segmento), "en ese flujo"
//      —decisión concreta: ese es el orden en que Bryan los escribió, así
//      que se generan y se muestran en ese orden—.
// Un segmento sin nada nuevo (todo ya dominado) no agrega tareas (se salta
// solo en reels2.js). "audioSeleccion" sale de content[].distractors (ya
// documentado en tracklist/NOTAS.md desde la Parte 1) y SOLO se genera si
// la línea trae translation + al menos un distractor válido.
//
// Devuelve:
//   tareas: [{ segIndex, sub: "completar"|"resto", banco: [{ex,_frase}] }]
//           (solo tareas con al menos 1 ejercicio)
//   totalPorFrase: igual criterio que el Nivel 1, pero mezclando completar+resto
//           de TODOS los segmentos (las frases no se repiten entre segmentos,
//           así que las llaves nunca chocan).
export function cancionGenerarNivel2(json, frasesDominadasPrevias) {
  const vistos = new Set((frasesDominadasPrevias || []).map(cancionNormalizar));
  const tareas = [];
  const totalPorFrase = {};

  function sumarAlTotal(entrada) {
    const frases = Array.isArray(entrada._frase) ? entrada._frase : (entrada._frase ? [entrada._frase] : []);
    frases.forEach((f) => { totalPorFrase[f] = (totalPorFrase[f] || 0) + 1; });
  }

  (json.segments || []).forEach((seg, segIndex) => {
    const completar = [];
    const traducciones = [];
    const dictados = [];
    const audioSel = [];
    const paresSeleccionar = [];

    (seg.content || []).forEach((item) => {
      const originalPhrase = item.originalPhrase || "";
      const fraseLinea = cancionNormalizar(originalPhrase);
      const lineaEsNueva = !!fraseLinea && !vistos.has(fraseLinea);

      if (lineaEsNueva) {
        vistos.add(fraseLinea);

        (item.phrases || []).forEach((p) => {
          const conHueco = cancionQuitarTrozo(originalPhrase, p);
          if (!conHueco) {
            console.warn('⚠️ Aprender canción (Nivel 2): "' + p + '" no aparece tal cual en "' + originalPhrase + '" — se omite ese hueco de completar');
            return;
          }
          completar.push({ ex: { type: "completar", spanishWord: item.translation || "", englishSentence: conHueco, options: [p] }, _frase: fraseLinea });
        });

        if (item.translation) traducciones.push({ ex: { type: "traduccion", spanishWord: item.translation, englishWord: originalPhrase }, _frase: fraseLinea });
        if (cancionEsCorta(originalPhrase)) dictados.push({ ex: { type: "dictado", text: originalPhrase }, _frase: fraseLinea });

        const distractores = cancionDistractoresLimpios(item);
        if (item.translation && distractores.length) {
          audioSel.push({
            ex: { type: "audioSeleccion", audioText: originalPhrase, correct: item.translation, distractors: distractores.slice(0, 3) },
            _frase: fraseLinea,
          });
        }
      }

      (item.learn || []).forEach((l) => {
        const fraseLearn = cancionNormalizar(l.phrase);
        if (!fraseLearn || vistos.has(fraseLearn)) return;
        vistos.add(fraseLearn);

        paresSeleccionar.push({ englishWord: l.phrase, spanishWord: l.translation || "", _frase: fraseLearn });

        (l.exercises || []).forEach((ex) => {
          if (ex.translation) traducciones.push({ ex: { type: "traduccion", spanishWord: ex.translation, englishWord: ex.sentence }, _frase: fraseLearn });
          const conHueco = cancionQuitarTrozo(ex.sentence, l.phrase);
          if (conHueco) completar.push({ ex: { type: "completar", spanishWord: ex.translation || item.translation || "", englishSentence: conHueco, options: [l.phrase] }, _frase: fraseLearn });
          if (cancionEsCorta(ex.sentence)) dictados.push({ ex: { type: "dictado", text: ex.sentence }, _frase: fraseLearn });
        });
      });
    });

    const seleccionarBloques = [];
    for (let i = 0; i < paresSeleccionar.length; i += CANCIONES_SELECCIONAR_BLOQUE) {
      const bloque = paresSeleccionar.slice(i, i + CANCIONES_SELECCIONAR_BLOQUE);
      seleccionarBloques.push({
        ex: { type: "seleccionar", pairs: bloque.map((p) => ({ englishWord: p.englishWord, spanishWord: p.spanishWord })) },
        _frase: bloque.map((p) => p._frase),
      });
    }

    // "en ese flujo": traducción, luego dictado, luego audioSeleccion,
    // luego seleccionar (ver comentario de más arriba sobre esta decisión).
    const resto = [...traducciones, ...dictados, ...audioSel, ...seleccionarBloques];

    completar.forEach(sumarAlTotal);
    resto.forEach(sumarAlTotal);

    if (completar.length) tareas.push({ segIndex, sub: "completar", banco: completar });
    if (resto.length) tareas.push({ segIndex, sub: "resto", banco: resto });
  });

  return { tareas, totalPorFrase };
}

// ======================================================================
// Parte 4 — Niveles 4 a 8 (audio REAL del mp3 + karaoke, flujo #3.5-#3.8)
// ======================================================================
// A diferencia de los Niveles 1-2 (que solo enseñan contenido NUEVO, por
// eso filtran con frasesDominadas), los Niveles 4-8 son "cantar la canción
// completa": recorren TODAS las líneas, ya se hayan dominado antes o no —
// no tiene sentido saltarse un verso de la canción real solo porque ya se
// aprendió su vocabulario en el Nivel 1/2.
//
// `tiempos` es el resultado de cancionTiemposDesdeLrc() (ver canciones-lrc.js):
// null si todavía no hay .lrc (o no calza) — en ese caso estas funciones
// igual arman los ejercicios, simplemente sin el campo `audio`, y los
// renderers (canciones-audio-seleccion.js, canciones-completar-audio.js,
// canciones-dictado-audio.js) caen solos a la voz del dispositivo.

function cancionAudioDeLinea(cancion, tiempos, segIndex, idx) {
  if (!tiempos) return null;
  const t = tiempos.porLinea[segIndex + ":" + idx];
  if (!t) return null;
  return { lang: cancion.lang, n: cancion.n, t0: t.t0, t1: t.t1 };
}

// ---------- Nivel 4 — "Calentamiento" (ver flujo #4, puente a audio real) ----------
// Ronda corta (hasta CANCIONES_CALENTAMIENTO_MAX) de "audio + selección" con
// el audio REAL del mp3 (si ya hay .lrc), para que el usuario se acostumbre
// a la voz real de la canción antes de los Niveles 5-8 — las primeras
// líneas que traigan translation + al menos 1 distractor, en el orden de la
// canción.
export function cancionGenerarNivel4(cancion, tiempos) {
  const json = cancion.json;
  const plano = cancionAplanarContenidoPublico(json);
  const ejercicios = [];
  for (const f of plano) {
    if (ejercicios.length >= CANCIONES_CALENTAMIENTO_MAX) break;
    const distractores = cancionDistractoresLimpios(f.item);
    if (!f.item.translation || !distractores.length) continue;
    ejercicios.push({
      type: "audioSeleccion",
      audioText: f.item.originalPhrase,
      correct: f.item.translation,
      distractors: distractores.slice(0, 3),
      audio: cancionAudioDeLinea(cancion, tiempos, f.segIndex, f.idx),
    });
  }
  return ejercicios;
}

// ---------- Nivel 5 — "Seleccionar letra con audio real" (flujo #5) ----------
// TODAS las líneas de la canción, EN ORDEN (no se baraja: es "escuchar la
// canción de principio a fin eligiendo lo que dice cada línea").
export function cancionGenerarNivel5(cancion, tiempos) {
  const json = cancion.json;
  const plano = cancionAplanarContenidoPublico(json);
  const ejercicios = [];
  plano.forEach((f) => {
    const distractores = cancionDistractoresLimpios(f.item);
    if (!f.item.translation || !distractores.length) return;
    ejercicios.push({
      type: "audioSeleccion",
      audioText: f.item.originalPhrase,
      correct: f.item.translation,
      distractors: distractores.slice(0, 3),
      audio: cancionAudioDeLinea(cancion, tiempos, f.segIndex, f.idx),
    });
  });
  return ejercicios;
}

// ---------- Nivel 6 — "Completar con audio real", por estrofa (flujo #6) ----------
// Una sola tarjeta por segments[n]: se escucha la estrofa completa (el
// tramo de audio de TODO el segmento) y abajo aparece su texto completo en
// modo completar, con 1-2 huecos por cada originalPhrase de esa estrofa.
// Devuelve [{ segIndex, ejercicio }] — una tarea por segmento con contenido
// que blanquear (un segmento sin ningún trozo disponible no aporta tarea).
export function cancionGenerarNivel6(cancion, tiempos) {
  const json = cancion.json;
  const tareas = [];

  (json.segments || []).forEach((seg, segIndex) => {
    const lineas = [];
    const options = [];

    (seg.content || []).forEach((item, idx) => {
      const trozos = cancionTrozosParaBlanquear(item, CANCIONES_COMPLETAR_HUECOS_NIVEL6);
      const { texto, usados } = trozos.length
        ? cancionQuitarVariosTrozos(item.originalPhrase || "", trozos)
        : { texto: item.originalPhrase || "", usados: [] };
      usados.forEach((u) => options.push(u));
      lineas.push({ idPlano: segIndex + ":" + idx, text: texto, t0: tiempos ? (tiempos.porLinea[segIndex + ":" + idx] || {}).t0 : null, t1: tiempos ? (tiempos.porLinea[segIndex + ":" + idx] || {}).t1 : null });
    });

    if (!options.length) return; // nada que blanquear en este segmento: se omite

    const audioSeg = tiempos && tiempos.porSegmento[segIndex]
      ? { lang: cancion.lang, n: cancion.n, t0: tiempos.porSegmento[segIndex].t0, t1: tiempos.porSegmento[segIndex].t1 }
      : null;

    tareas.push({
      segIndex,
      ejercicio: {
        type: "completarCancion",
        spanishWord: seg.translation || "",
        prompt: "🎧 Escucha la estrofa y completa lo que falta",
        lineas,
        options,
        audio: audioSeg,
        karaoke: !!tiempos,
      },
    });
  });

  return tareas;
}

// ---------- Nivel 7 — "Dictado con audio real, 80%" (flujo #7) ----------
// TODAS las líneas de la canción, en orden (igual que el Nivel 5). El 80%
// mínimo para aprobar ya lo aplica checkDictadoAnswer() (exercises/
// dictado.js) — reels2.js hace que la que no llegue al 80% vuelva al final
// de la cola hasta que se logre, como pidió Bryan.
export function cancionGenerarNivel7(cancion, tiempos) {
  const json = cancion.json;
  const plano = cancionAplanarContenidoPublico(json);
  return plano
    .filter((f) => !!(f.item.originalPhrase || "").trim())
    .map((f) => ({
      type: "dictadoCancion",
      text: f.item.originalPhrase,
      audio: cancionAudioDeLinea(cancion, tiempos, f.segIndex, f.idx),
    }));
}

// ---------- Nivel 8 — "Canción completa con huecos" (flujo #8, definitivo) ----------
// UNA sola tarjeta con TODA la letra (todos los segments, en orden) mientras
// suena el mp3 completo de principio a fin. Le falta exactamente UNA
// palabra/frase por cada segments[n] (si n == 10, son 10 huecos). El
// resultado de ESTA tarjeta (aciertos/total) es el % final y fijo de la
// canción — no hay reintento (ver tracklist/NOTAS.md y reels2.js).
export function cancionGenerarNivel8(cancion, tiempos) {
  const json = cancion.json;
  const lineas = [];
  const options = [];

  (json.segments || []).forEach((seg, segIndex) => {
    // El primer item de la estrofa que tenga algo blanqueable aporta EL
    // hueco de este segmento (uno solo, a diferencia del Nivel 6).
    let blanqueadoIdx = -1;
    let trozoElegido = null;
    (seg.content || []).forEach((item, idx) => {
      if (trozoElegido) return;
      const candidatos = cancionTrozosParaBlanquear(item, 1);
      if (candidatos.length) { trozoElegido = candidatos[0]; blanqueadoIdx = idx; }
    });

    (seg.content || []).forEach((item, idx) => {
      let texto = item.originalPhrase || "";
      if (idx === blanqueadoIdx && trozoElegido) {
        const conHueco = cancionQuitarTrozo(texto, trozoElegido);
        if (conHueco) { texto = conHueco; options.push(trozoElegido); }
      }
      lineas.push({
        idPlano: segIndex + ":" + idx,
        text: texto,
        t0: tiempos ? (tiempos.porLinea[segIndex + ":" + idx] || {}).t0 : null,
        t1: tiempos ? (tiempos.porLinea[segIndex + ":" + idx] || {}).t1 : null,
      });
    });
  });

  return {
    type: "completarCancion",
    spanishWord: "",
    prompt: "🎶 Suena la canción completa — completa lo que falta en la letra",
    lineas,
    options,
    audio: { lang: cancion.lang, n: cancion.n, t0: 0, t1: null }, // el mp3 entero, de punta a punta
    karaoke: !!tiempos,
  };
}

// Aplanado de content[] en orden canción (mismo criterio posicional que
// canciones-lrc.js usa para emparejar con el .lrc — se duplica acá, chico y
// sin estado, para no forzar que este archivo dependa de canciones-lrc.js
// ni al revés).
function cancionAplanarContenidoPublico(json) {
  const out = [];
  (json.segments || []).forEach((seg, segIndex) => {
    (seg.content || []).forEach((item, idx) => out.push({ segIndex, idx, item }));
  });
  return out;
}
