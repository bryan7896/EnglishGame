// listening/exercises/listening-n1-core.js
//
// Capa base del Nivel 1 de Listening (12 bloques de pulido fonético).
// Vive aparte del Nivel 0: su propia llave de localStorage
// ("listening_nivel1_v1"), su propio banco de ejercicios (NIVEL1_BANK,
// inyectado por build.py desde listening/nivel1/data/bloqueN.json filtrando
// solo los ítems que ya tienen su mp3 en listening/nivel1/bloqueN/), su
// propio estado en memoria.
//
// Cada bloque se juega en rondas. Una ronda tiene estas fases:
//   entrada   (solo ronda 1) 20 palabras sin pista: mide qué patrones pesan más
//   descubre  presentación del sonido (no califica)
//   distingue práctica de oído sin texto: ¿cuál suena distinto? (no califica)
//   completa  completar el hueco de la palabra
//   escribe   dictado libre, mezclado, en tandas  (la nota principal)
//   examen    palabras/frases nuevas y voces reservadas; aprueba con >= 70
// Si el examen sale < 70 se abre otra ronda con la mitad de ejercicios por
// fase, centrada en los patrones débiles, con palabras nuevas y otra versión
// del examen.

const N1_KEY = "listening_nivel1_v1";
const N1_UMBRAL = 70;
const N1_OFFSET_SHEET = 10;          // bloque 1 del Nivel 1 = bloque 11 en el Sheet
const N1_FASES = ["entrada", "descubre", "distingue", "completa", "escribe", "examen"];
const N1_FASE_LABEL = {
  entrada: "Chequeo de entrada",
  descubre: "Descubre",
  distingue: "Distingue",
  completa: "Completa",
  escribe: "Escribe",
  examen: "Examen",
};
const N1_FASE_DESC = {
  entrada: "20 palabras sin pista para ver qué patrones te cuestan más",
  descubre: "Conoce el sonido y escucha ejemplos (no califica)",
  distingue: "Solo oído, sin texto: ¿cuál suena distinto? (no califica)",
  completa: "Completa las letras que faltan",
  escribe: "Dictado libre en tandas — es tu nota principal",
  examen: "Palabras nuevas y voces nuevas. Aprueba con 70 o más",
};

const N1_BLOQUES_META = [
  { bloque: 1, icono: "⏱️", titulo: "Terminaciones -ed", descripcion: "/t/, /d/ y /ɪd/ al final del pasado" },
  { bloque: 2, icono: "🐍", titulo: "Terminaciones -s / -es", descripcion: "/s/, /z/ y /ɪz/ en plurales y 3.ª persona" },
  { bloque: 3, icono: "🔚", titulo: "Consonantes finales", descripcion: "d/t, s/z, p/b, k/g, f/v, ch/j y grupos al final" },
  { bloque: 4, icono: "🔉", titulo: "Vocal /ʌ/ y schwa", descripcion: "cup, cut, love y las vocales átonas" },
  { bloque: 5, icono: "🎚️", titulo: "Vocales cortas y largas", descripcion: "ship/sheep, full/fool, bed/bad y vocal + r" },
  { bloque: 6, icono: "✂️", titulo: "Contracciones", descripcion: "I'll, I'd, I've, it's, we're… frente a la forma completa" },
  { bloque: 7, icono: "🪶", titulo: "Formas débiles", descripcion: "of, and, for, to, pronombres y auxiliares sin acento" },
  { bloque: 8, icono: "🔗", titulo: "Habla conectada", descripcion: "Linking, elisión, asimilación y gonna/wanna" },
  { bloque: 9, icono: "🧱", titulo: "Frases de 4 palabras", descripcion: "Pasado, plurales, contracciones y funcionales en frase" },
  { bloque: 10, icono: "📜", titulo: "Frases de 5 y 6 palabras", descripcion: "Frases más largas, un solo intento de oído" },
  { bloque: 11, icono: "👅", titulo: "Consonantes I", descripcion: "th, dh, b/v, v/w y sonoridad inicial" },
  { bloque: 12, icono: "🌀", titulo: "Consonantes II", descripcion: "sh/ch, nasales, r/l, y/j y h inicial" },
];

function n1Meta(b) {
  return N1_BLOQUES_META.find((m) => m.bloque === b) || { bloque: b, icono: "🎧", titulo: "Bloque " + b, descripcion: "" };
}

// Bloques cuya meta es una consonante/terminación: ahí un desliz de vocal
// al escribir se considera ortografía, no oído. En los de vocales (4, 5),
// contracciones (6) y formas débiles (7) NO se perdona.
const N1_VOCAL_PERDONA = new Set([1, 2, 3, 8, 9, 10, 11, 12]);
// Bloques con apóstrofe estricto (la contracción ES el contenido).
const N1_ESTRICTO_BLOQUES = new Set([6]);

// ==================== ESTADO ====================
const N1State = {
  bank: (typeof NIVEL1_BANK !== "undefined" ? NIVEL1_BANK : { bloques: {}, motiv: [] }),
  prog: { meta: { descartados: [], motivacion: true }, bloques: {} },
  byId: {},
  loaded: false,
};

function n1Rand(n) { return Math.floor(Math.random() * n); }
function n1Shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = n1Rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function n1Hoy() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function n1CatNombre(cat) {
  return String(cat || "").replace(/_vs_/g, " vs ").replace(/_/g, " ");
}

function n1Load() {
  try {
    const raw = localStorage.getItem(N1_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === "object") {
      N1State.prog = p;
    }
  } catch (e) { /* noop */ }
  if (!N1State.prog.meta) N1State.prog.meta = {};
  if (!Array.isArray(N1State.prog.meta.descartados)) N1State.prog.meta.descartados = [];
  if (typeof N1State.prog.meta.motivacion !== "boolean") N1State.prog.meta.motivacion = true;
  if (!N1State.prog.bloques) N1State.prog.bloques = {};
  if (!N1State.loaded) {
    N1State.byId = {};
    Object.keys(N1State.bank.bloques || {}).forEach((b) => {
      (N1State.bank.bloques[b].items || []).forEach((it) => { N1State.byId[it.id] = it; });
    });
    (N1State.bank.motiv || []).forEach((it) => { N1State.byId[it.id] = it; });
    N1State.loaded = true;
  }
  return N1State.prog;
}

function n1Save() {
  try { localStorage.setItem(N1_KEY, JSON.stringify(N1State.prog)); } catch (e) { /* noop */ }
}

function n1Descartado(id) { return N1State.prog.meta.descartados.indexOf(id) >= 0; }
function n1Descartar(id) {
  if (!n1Descartado(id)) N1State.prog.meta.descartados.push(id);
  n1Save();
}

function n1Items(b) {
  const bl = N1State.bank.bloques[b];
  if (!bl) return [];
  return bl.items.filter((it) => !n1Descartado(it.id));
}
function n1Train(b) { return n1Items(b).filter((it) => it.tipo === "entrenamiento"); }
function n1Exam(b, version) {
  return n1Items(b).filter((it) => it.tipo === "examen" && (version == null || it.version === version));
}
function n1BlockInfo(b) {
  const bl = N1State.bank.bloques[b];
  if (!bl) return { train: 0, exam: 0, planTrain: 0, planExam: 0, jugable: false };
  const train = n1Train(b).length;
  const exam = n1Items(b).filter((it) => it.tipo === "examen").length;
  const jugable = train >= 20 && exam >= 10;
  return { train, exam, planTrain: bl.plan_train || 0, planExam: bl.plan_exam || 0, jugable };
}
function n1AudioPath(it) {
  return "listening/nivel1/bloque" + it.bloque + "/" + it.nameFile;
}

// ==================== PROGRESO POR BLOQUE ====================
function n1Prog(b) {
  const bl = N1State.prog.bloques;
  if (!bl[b]) {
    bl[b] = {
      estado: "nuevo",       // nuevo | curso | aprobado (recién aprobado)
      aprobado: false,       // se queda en true aunque se practique otra ronda
      ronda: 1,
      faseEstado: {},        // fase -> pendiente|hecha|omitida (de la ronda actual)
      plan: null,
      hechos: { completa: [], escribe: [], entrada: [] },
      usados: [],            // ids ya usados en alguna ronda
      fallados: [],          // ids con error en escribe (para rondas siguientes)
      escribeBase: 0,
      completaBase: 0,
      debil: [],             // categorías débiles
      statsCat: {},          // escribe acumulado { cat: {ok, total} }
      srs: {},               // id -> { paso, due }
      examenes: [],          // { ronda, version, pct, fecha, porCat }
      mejor: null,
      confusiones: {},
      confSonidos: {},
      respuestas: [],
      sesion: null,
      tandas: { fecha: "", n: 0 },
    };
  }
  return bl[b];
}

function n1Unlocked(b) {
  if (b <= 1) return true;
  const prev = N1State.prog.bloques[b - 1];
  return !!(prev && prev.aprobado);
}
function n1ActualBloque() {
  for (let b = 1; b <= N1_BLOQUES_META.length; b++) {
    const p = N1State.prog.bloques[b];
    if (!p || !p.aprobado) return b;
  }
  return N1_BLOQUES_META.length;
}
function n1TodoAprobado() {
  for (let b = 1; b <= N1_BLOQUES_META.length; b++) {
    const p = N1State.prog.bloques[b];
    if (!p || !p.aprobado) return false;
  }
  return true;
}

function n1GroupBy(arr, fn) {
  const o = {};
  arr.forEach((x) => { const k = fn(x); (o[k] = o[k] || []).push(x); });
  return o;
}

// ==================== PLAN DE UNA RONDA ====================
function n1TieneMascara(it) { return !!(it.mascara && it.hueco); }

function n1MakePlan(b, prog) {
  const train = n1Train(b);
  const plan = { intro: [], completa: [], escribe: [], entrada: [], reserva: [], weakIntro: [] };

  if (prog.ronda === 1) {
    const porCat = n1GroupBy(train, (it) => it.categoria);
    Object.keys(porCat).forEach((cat) => {
      let ids = n1Shuffle(porCat[cat]);
      const N = ids.length;
      const nRes = N >= 6 ? Math.round(N * 0.3) : 0;
      ids.splice(0, nRes).forEach((it) => plan.reserva.push(it.id));
      const R = ids.length;
      const nIntro = Math.min(R, Math.max(2, Math.round(R * 0.12)));
      ids.splice(0, nIntro).forEach((it) => plan.intro.push(it.id));
      const conMasc = ids.filter(n1TieneMascara);
      const nComp = Math.min(conMasc.length, Math.round(R * 0.25));
      const comp = conMasc.slice(0, nComp);
      const compSet = new Set(comp.map((x) => x.id));
      comp.forEach((it) => plan.completa.push(it.id));
      ids.filter((it) => !compSet.has(it.id)).forEach((it) => plan.escribe.push(it.id));
    });
    // Chequeo de entrada: 20 palabras repartidas entre categorías.
    const escPorCat = n1GroupBy(plan.escribe.map((id) => N1State.byId[id]), (it) => it.categoria);
    const cats = n1Shuffle(Object.keys(escPorCat));
    const tomar = new Set();
    let ronda = 0;
    while (tomar.size < 20 && ronda < 40) {
      let alguno = false;
      for (const c of cats) {
        if (tomar.size >= 20) break;
        const it = escPorCat[c][ronda];
        if (it) { tomar.add(it.id); alguno = true; }
      }
      if (!alguno) break;
      ronda++;
    }
    plan.entrada = Array.from(tomar);
    plan.escribe = plan.escribe.filter((id) => !tomar.has(id));
    prog.escribeBase = plan.escribe.length;
    prog.completaBase = plan.completa.length;
  } else {
    // Rondas siguientes: mitad de ejercicios, palabras nuevas, foco en lo débil.
    const debil = new Set(prog.debil || []);
    const usados = new Set(prog.usados || []);
    const libres = train.filter((it) => !usados.has(it.id));
    const nE = Math.max(12, Math.round(prog.escribeBase * 0.5));
    const nC = Math.round(prog.completaBase * 0.5);
    const elegir = (n, filtro) => {
      const pool = libres.filter((it) => !tomados.has(it.id) && filtro(it));
      const w = n1Shuffle(pool.filter((it) => debil.has(it.categoria)));
      const o = n1Shuffle(pool.filter((it) => !debil.has(it.categoria)));
      const nw = debil.size ? Math.min(w.length, Math.ceil(n * 0.7)) : 0;
      const sel = w.slice(0, nw).concat(o.slice(0, n - nw));
      if (sel.length < n) {
        // completar con las que sobraron de las categorías débiles
        w.slice(nw).concat(o.slice(n - nw)).slice(0, n - sel.length).forEach((it) => sel.push(it));
      }
      sel.forEach((it) => tomados.add(it.id));
      return sel;
    };
    const tomados = new Set();
    const comp = elegir(nC, n1TieneMascara);
    const esc = elegir(nE, () => true);
    // Si no alcanzaron palabras nuevas, se repiten primero las falladas y luego cualquiera.
    if (esc.length < nE) {
      const falladas = (prog.fallados || []).map((id) => N1State.byId[id]).filter((it) => it && !n1Descartado(it.id) && !tomados.has(it.id));
      n1Shuffle(falladas).slice(0, nE - esc.length).forEach((it) => { esc.push(it); tomados.add(it.id); });
    }
    if (esc.length < nE) {
      n1Shuffle(train.filter((it) => !tomados.has(it.id)))
        .slice(0, nE - esc.length).forEach((it) => { esc.push(it); tomados.add(it.id); });
    }
    plan.completa = comp.map((it) => it.id);
    plan.escribe = esc.map((it) => it.id);
    // Para Descubre (solo categorías débiles) y Distingue se pueden reutilizar palabras ya vistas.
    const dc = debil.size ? debil : new Set(Object.keys(n1GroupBy(train, (it) => it.categoria)));
    dc.forEach((cat) => {
      n1Shuffle(train.filter((it) => it.categoria === cat)).slice(0, 4).forEach((it) => plan.weakIntro.push(it.id));
    });
  }
  plan.escribe.concat(plan.completa, plan.entrada, plan.intro).forEach((id) => {
    if ((prog.usados || []).indexOf(id) < 0) prog.usados.push(id);
  });
  prog.plan = plan;
  prog.hechos = { completa: [], escribe: [], entrada: [] };
  prog.sesion = null;
  prog.faseEstado = {};
  N1_FASES.forEach((f) => { prog.faseEstado[f] = "pendiente"; });
  if (prog.ronda > 1) prog.faseEstado.entrada = "omitida";
  // Fases sin material en este bloque se omiten.
  if (!plan.entrada.length) prog.faseEstado.entrada = "omitida";
  if (!n1DescubreCategorias(b, prog).length) prog.faseEstado.descubre = "omitida";
  if (!n1OddityDisponible(b, prog)) prog.faseEstado.distingue = "omitida";
  if (!plan.completa.length) prog.faseEstado.completa = "omitida";
  if (!plan.escribe.length) prog.faseEstado.escribe = "omitida";
  return plan;
}

function n1PlanIds(prog, clave) {
  return ((prog.plan && prog.plan[clave]) || []).map((id) => N1State.byId[id]).filter((it) => it && !n1Descartado(it.id));
}

// Categorías para Descubre: en ronda 1 todas las del bloque, después solo las débiles.
function n1DescubreCategorias(b, prog) {
  const plan = prog.plan;
  if (!plan) return [];
  const ids = prog.ronda === 1 ? plan.intro : plan.weakIntro;
  const items = ids.map((id) => N1State.byId[id]).filter((it) => it && !n1Descartado(it.id));
  const porCat = n1GroupBy(items, (it) => it.categoria);
  return Object.keys(porCat).map((cat) => ({ categoria: cat, items: porCat[cat] }));
}

// Material para Distingue (ejercicios con sonido, ya conocidos o de la presentación).
function n1OddityPool(b, prog) {
  const plan = prog.plan;
  if (!plan) return [];
  const ids = new Set([].concat(plan.intro || [], plan.weakIntro || [], plan.completa || [], prog.ronda > 1 ? (prog.usados || []) : []));
  return Array.from(ids).map((id) => N1State.byId[id]).filter((it) => it && !n1Descartado(it.id) && it.tipo === "entrenamiento" && it.sonido && it.sonido !== "forma débil");
}
function n1OddityGroups(pool) {
  const g = n1GroupBy(pool, (it) => it.sonido);
  const out = {};
  Object.keys(g).forEach((k) => { if (g[k].length >= 2) out[k] = g[k]; });
  return out;
}
function n1OddityDisponible(b, prog) {
  const pool = n1OddityPool(b, prog);
  const g = n1OddityGroups(pool);
  const todos = n1GroupBy(pool, (it) => it.sonido);
  return Object.keys(g).length >= 1 && Object.keys(todos).length >= 2;
}

function n1FaseActual(prog) {
  for (const f of N1_FASES) {
    if (prog.faseEstado[f] === "pendiente") return f;
  }
  return null;
}

// ==================== TAMAÑO DE TANDA ====================
function n1MedianaPalabras(b) {
  const t = n1Train(b).map((it) => it.n_palabras || 1).sort((a, c) => a - c);
  return t.length ? t[Math.floor(t.length / 2)] : 1;
}
function n1TamanoDia(b) {
  const n = n1MedianaPalabras(b);
  return n <= 1 ? 140 : n === 2 ? 70 : n === 3 ? 50 : 30;
}
function n1TamanoTanda(b) { return Math.ceil(n1TamanoDia(b) / 3); }

// ==================== REPASO ESPACIADO (1, 3, 7 días) ====================
const N1_SRS_DIAS = [1, 3, 7];
function n1SrsFallo(prog, id) {
  prog.srs[id] = { paso: 0, due: Date.now() + N1_SRS_DIAS[0] * 86400000 };
}
function n1SrsAcierto(prog, id) {
  const s = prog.srs[id];
  if (!s) return;
  s.paso += 1;
  if (s.paso >= N1_SRS_DIAS.length) { delete prog.srs[id]; return; }
  s.due = Date.now() + N1_SRS_DIAS[s.paso] * 86400000;
}
function n1SrsVencidos(prog, max) {
  const ahora = Date.now();
  return Object.keys(prog.srs)
    .filter((id) => prog.srs[id].due <= ahora && N1State.byId[id] && !n1Descartado(id))
    .slice(0, max || 12);
}

// ==================== CALIFICACIÓN ====================
function n1Norm(s, estricto) {
  let t = String(s || "").toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9'\s]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!estricto) t = t.replace(/'/g, "");
  return t;
}
function n1EsEstricto(it) {
  return !!(it.estricto || N1_ESTRICTO_BLOQUES.has(it.bloque) || /^contraccion/.test(it.categoria));
}
function n1Tokens(s, estricto) {
  const n = n1Norm(s, estricto);
  return n ? n.split(" ").map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean) : [];
}
function n1Collapse(w) { return w.replace(/(.)\1+/g, "$1"); }
function n1Skel(w) { return n1Collapse(w.replace(/[aeiouy]/g, "")); }

// Una sola edición (sustitución/inserción/borrado). Devuelve los caracteres tocados o null.
function n1SingleEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return [a[i], b[i]];
  } else if (a.length === b.length + 1) {
    if (a.slice(i + 1) === b.slice(i)) return [a[i]];
  } else if (a.slice(i) === b.slice(i + 1)) return [b[i]];
  return null;
}

// ¿Es un simple desliz de ortografía (el oído estuvo bien)?
function n1EsOrtografia(typed, target, vocalPerdona) {
  if (typed === target) return true;
  if (!typed || !target) return false;
  if (n1Collapse(typed) === n1Collapse(target)) return true;      // consonante doble
  // ie <-> ei
  if (typed.length === target.length && typed.replace(/ie/g, "ei") === target.replace(/ie/g, "ei")) return true;
  if (vocalPerdona && target.length >= 4) {
    const e = n1SingleEdit(typed, target);
    if (e && e.every((ch) => /[aeiouy]/.test(ch)) && n1Skel(typed) === n1Skel(target)) return true;
  }
  return false;
}

// Alineación por palabras (programación dinámica). Devuelve filas
// { t, u, e } con e = ok | near | mal | falta | extra.
function n1Alinear(T, U, near) {
  const n = T.length, m = U.length;
  const D = [];
  for (let i = 0; i <= n; i++) { D.push(new Array(m + 1).fill(0)); D[i][0] = i; }
  for (let j = 0; j <= m; j++) D[0][j] = j;
  const costo = (t, u) => (t === u ? 0 : near(u, t) ? 0.3 : 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + costo(T[i - 1], U[j - 1]));
    }
  }
  const rows = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + costo(T[i - 1], U[j - 1]))) < 1e-9) {
      const t = T[i - 1], u = U[j - 1];
      rows.push({ t, u, e: t === u ? "ok" : near(u, t) ? "near" : "mal", ti: i - 1 });
      i--; j--;
    } else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) {
      rows.push({ t: T[i - 1], u: "", e: "falta", ti: i - 1 });
      i--;
    } else {
      rows.push({ t: "", u: U[j - 1], e: "extra", ti: -1 });
      j--;
    }
  }
  return rows.reverse();
}

function n1Alternativas(it) {
  const est = n1EsEstricto(it);
  return (it.acepta || []).map((a) => n1Norm(a, est)).filter(Boolean);
}

// Califica una respuesta escrita.
// Devuelve { exacta, oido, ortografia, clase, filas, acc, vacia, confKey, confSon }
function n1Grade(it, typed) {
  const est = n1EsEstricto(it);
  const T = n1Tokens(it.audio, est);
  const U = n1Tokens(typed, est);
  const vocal = N1_VOCAL_PERDONA.has(it.bloque);
  const near = (u, t) => n1EsOrtografia(u, t, vocal && (T.length === 1 || t.length >= 5));
  const res = { exacta: false, oido: false, ortografia: false, clase: "", filas: [], acc: 0, vacia: !U.length, confKey: "", confSon: "" };
  if (!U.length) { res.clase = "sin_respuesta"; return res; }

  const tn = T.join(" ");
  const un = U.join(" ");
  const alt = n1Alternativas(it);
  if (un === tn || alt.indexOf(un) >= 0) {
    res.exacta = true; res.oido = true;
    res.filas = T.map((t, i) => ({ t, u: t, e: "ok", ti: i }));
    res.acc = 1;
    res.clase = "exacta";
    return res;
  }
  const filas = n1Alinear(T, U, near);
  res.filas = filas;
  const buenas = filas.filter((f) => f.e === "ok" || f.e === "near").length;
  res.acc = T.length ? buenas / T.length : 0;
  const hayNear = filas.some((f) => f.e === "near");
  const hayMal = filas.some((f) => f.e === "mal" || f.e === "falta" || f.e === "extra");

  // Ítems con objetivo puntual (contracciones, formas débiles): la nota es el objetivo.
  const objTokens = (it.objetivo && (it.bloque === 6 || it.bloque === 7)) ? n1Tokens(it.objetivo, est) : null;
  let objIdx = [];
  if (objTokens && objTokens.length) {
    for (let s = 0; s + objTokens.length <= T.length; s++) {
      if (objTokens.every((tk, k) => T[s + k] === tk)) { objIdx = objTokens.map((_, k) => s + k); break; }
    }
  }
  if (objIdx.length) {
    const okObj = objIdx.every((ix) => filas.some((f) => f.ti === ix && f.e === "ok"));
    res.oido = okObj;
    res.ortografia = false;
    res.objetivo = objTokens;
    res.objetivoOk = okObj;
  } else if (T.length <= 3) {
    res.oido = !hayMal;
    res.ortografia = res.oido && hayNear;
  } else {
    res.oido = res.acc >= 0.8;
    res.ortografia = res.oido && hayNear && !hayMal;
  }
  if (res.oido) { res.clase = res.ortografia ? "oido_ok_ortografia" : (hayMal ? "aceptada_parcial" : "exacta"); return res; }

  // ---- clasificación del error ----
  const pares = [].concat(it.par ? [it.par] : [], it.pares || []).map((p) => n1Norm(p, est));
  if (pares.indexOf(un) >= 0) {
    res.clase = "confusion_par";
    res.confKey = tn + ">" + un;
  } else if (filas.some((f) => f.e === "mal" && f.u && f.t.length > f.u.length && f.t.indexOf(f.u) === 0 && f.t.length - f.u.length <= 3)) {
    res.clase = "omision_final";
  } else if (filas.some((f) => f.e === "mal" && f.t && f.u.length > f.t.length && f.u.indexOf(f.t) === 0 && f.u.length - f.t.length <= 3)) {
    res.clase = "adicion_final";
  } else if (objIdx.length) {
    const malObj = filas.find((f) => objIdx.indexOf(f.ti) >= 0 && f.e !== "ok");
    res.clase = "confusion_par";
    res.confKey = malObj ? (malObj.t + ">" + (malObj.u || "∅")) : "";
  } else {
    res.clase = "otra_palabra";
    if (T.length === 1) res.confKey = tn + ">" + un;
  }
  if (res.confKey && it.sonido) {
    // Sonido del que se confundió, si la palabra escrita es el par con audio.
    const parIt = n1ParItem(it);
    if (parIt && parIt.sonido && n1Norm(parIt.audio, est) === un) res.confSon = it.sonido + ">" + parIt.sonido;
  }
  return res;
}

// Ítem "gemelo" (par mínimo con su propio audio), si existe.
function n1ParItem(it) {
  const codes = [].concat(it.par_item ? [it.par_item] : [], it.pares_item || []);
  if (!codes.length) return null;
  const todos = (N1State.bank.bloques[it.bloque] || { items: [] }).items;
  for (const code of codes) {
    const f = todos.find((x) => x.item === code && !n1Descartado(x.id));
    if (f) return f;
  }
  return null;
}

// Compara un ítem de entrenamiento con el contraste más cercano (misma categoría, otro sonido).
function n1HermanoDe(b, it, excluir) {
  const prog = n1Prog(b);
  const usados = new Set(prog.usados || []);
  const lib = n1Train(b).filter((x) => x.id !== it.id && x.categoria === it.categoria && !excluir.has(x.id));
  const nuevos = lib.filter((x) => !usados.has(x.id));
  const pool = nuevos.length ? nuevos : lib;
  if (!pool.length) return null;
  const mismoSon = pool.filter((x) => x.sonido && x.sonido === it.sonido);
  const src = mismoSon.length ? mismoSon : pool;
  return src[n1Rand(src.length)];
}

// Pista corta de una línea para el modal de error.
function n1Pista(it) {
  const par = it.par || (it.pares && it.pares[0]);
  const s = it.sonido && it.sonido !== "forma débil" && it.sonido !== "forma completa" ? "Escucha el sonido " + it.sonido : "";
  if (it.categoria === "forma_completa") return "Aquí se dice la forma completa, sin contraer.";
  if (/^contraccion/.test(it.categoria)) return "Es una contracción: la última consonante es corta y pegada a la palabra.";
  if (/^forma_debil/.test(it.categoria)) return "En la palabra funcional la vocal casi desaparece: suena más débil que las demás.";
  if (it.categoria === "can_vs_cant") return "can suena débil y corto; can't es más largo y con la vocal clara.";
  if (/^ed_/.test(it.categoria)) return "Fíjate en el final: " + it.sonido + " al terminar la palabra. " + (par ? "No es solo «" + par + "»." : "");
  if (/^plural_/.test(it.categoria)) return "Fíjate en el final: " + it.sonido + " al terminar la palabra.";
  if (it.categoria === "reduccion_coloquial") return "Es habla relajada: gonna, wanna, gotta suenan como una sola unidad.";
  if (it.categoria === "linking_cv") return "La consonante final se une a la vocal de la palabra siguiente.";
  if (it.categoria === "elision") return "Una consonante del medio casi no se oye.";
  if (it.categoria === "asimilacion") return "Dos sonidos juntos se funden en uno nuevo.";
  if (s) return s + (par ? " (no «" + par + "»)." : ".");
  return "Escúchalo otra vez, más lento, y compara con lo que escribiste.";
}

// ==================== MOTIVACIÓN ====================
const N1Motiv = { ultima: 0, recientes: [] };
function n1ElegirMotivacion(evento) {
  if (!N1State.prog.meta.motivacion) return null;
  const lista = (N1State.bank.motiv || []).filter((m) => m.evento === evento);
  if (!lista.length) return null;
  const sin = lista.filter((m) => N1Motiv.recientes.indexOf(m.id) < 0);
  const src = sin.length ? sin : lista;
  const m = src[n1Rand(src.length)];
  N1Motiv.recientes.push(m.id);
  if (N1Motiv.recientes.length > 6) N1Motiv.recientes.shift();
  return m;
}

// ==================== SHEET ====================
async function n1PostResultados(b, fase, porCat, ronda, ortografia) {
  try {
    const registros = Object.keys(porCat).map((categoria) => {
      const s = porCat[categoria];
      const porcentaje = s.total ? Math.round((s.ok / s.total) * 1000) / 10 : 0;
      return { bloque: b + N1_OFFSET_SHEET, categoria, familia: fase, porcentaje, intentos: ronda };
    });
    if (ortografia && ortografia.total) {
      registros.push({
        bloque: b + N1_OFFSET_SHEET, categoria: "ortografia", familia: fase,
        porcentaje: Math.round((ortografia.exactas / ortografia.total) * 1000) / 10, intentos: ronda,
      });
    }
    if (!registros.length) return;
    await fetch(API_URL, { method: "POST", body: JSON.stringify({ sheet: "listening", action: "add", registros }) });
  } catch (e) { /* best-effort, igual que el Nivel 0 */ }
}

// ==================== INFORME DE ERRORES (para copiar) ====================
function n1ReporteErrores(b) {
  const prog = N1State.prog.bloques[b];
  if (!prog) return "";
  const meta = n1Meta(b);
  const errores = (prog.respuestas || []).filter((r) => !r.oido && !r.omitida);
  const confOrd = Object.keys(prog.confusiones || {}).map((k) => [k, prog.confusiones[k]]).sort((a, c) => c[1] - a[1]).slice(0, 25);
  const sonOrd = Object.keys(prog.confSonidos || {}).map((k) => [k, prog.confSonidos[k]]).sort((a, c) => c[1] - a[1]).slice(0, 15);
  const cat = Object.keys(prog.statsCat || {}).map((c) => ({ categoria: c, ok: prog.statsCat[c].ok, total: prog.statsCat[c].total, pct: prog.statsCat[c].total ? Math.round(prog.statsCat[c].ok / prog.statsCat[c].total * 100) : 0 }));
  const cab = {
    nivel: 1, bloque: b, titulo: meta.titulo, ronda: prog.ronda, estado: prog.estado,
    examenes: prog.examenes, por_categoria_escribe: cat,
    confusiones_palabra: confOrd.map(([k, v]) => ({ [k]: v })),
    confusiones_sonido: sonOrd.map(([k, v]) => ({ [k]: v })),
  };
  return "// Informe Nivel 1 — Bloque " + b + "\n" + JSON.stringify(cab, null, 1) + "\n// Errores (último registro):\n[\n" +
    errores.slice(-150).map((r) => "  " + JSON.stringify(r)).join(",\n") + "\n]";
}

async function n1CopiarTexto(texto, okMsg) {
  let ok = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(texto); ok = true; }
  } catch (e) { /* plan B */ }
  if (!ok) {
    try {
      const ta = document.createElement("textarea");
      ta.value = texto; ta.setAttribute("readonly", "");
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand("copy"); ta.remove();
    } catch (e) { ok = false; }
  }
  toast(ok ? (okMsg || "📋 Copiado") : "⚠️ No se pudo copiar automáticamente");
  return ok;
}

function n1Resumen() {
  let aprobados = 0;
  for (let b = 1; b <= N1_BLOQUES_META.length; b++) {
    const p = N1State.prog.bloques[b];
    if (p && p.aprobado) aprobados++;
  }
  let audios = 0, planeados = 0;
  Object.keys(N1State.bank.bloques || {}).forEach((b) => {
    audios += (N1State.bank.bloques[b].items || []).length;
    planeados += (N1State.bank.bloques[b].plan_train || 0) + (N1State.bank.bloques[b].plan_exam || 0);
  });
  return { aprobados, total: N1_BLOQUES_META.length, audios, planeados };
}
