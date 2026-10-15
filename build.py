#!/usr/bin/env python3
# build.py - Script para generar index.html (con PWA)

import os
import re
import sys
import json
from datetime import datetime

# ==================== CONFIGURACIÓN ====================
VERSION = "17.5 (15-10-2026)"
LS_KEY = "english_trainer_v6"


def cache_name_for_version():
    """Deriva el CACHE_NAME del service worker a partir de VERSION, para
    que cada bump de versión fuerce una caché nueva (el 'activate' del SW
    ya borra cualquier caché con nombre distinto al actual). Antes
    CACHE_NAME era un string fijo ('english-trainer-v1') que nunca
    cambiaba entre builds, así que el navegador podía quedarse sirviendo
    un index.html viejo para siempre aunque se regenerara el build — por
    eso un cambio de JS/CSS podía parecer que "no hacía nada"."""
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', VERSION).strip('-').lower()
    return f"english-trainer-{slug}"

ICON_URL = "https://cdn-icons-png.flaticon.com/512/3898/3898082.png"

INPUT_TYPES = [
    {"id": "traducciones", "label": "📝 Traducciones (opcional)", "placeholder": '[{"spanishWord": "...", "englishWord": "..."}]'},
    {"id": "completar", "label": "✏️ Completar palabras (opcional)", "placeholder": '[{"spanishWord": "...", "englishSentence": "... _____ ...", "options": ["word1"]}]'},
    {"id": "seleccionar", "label": "🎯 Seleccionar palabras (opcional)", "placeholder": '[[{"englishWord": "...", "spanishWord": "..."}]]'},
    {"id": "corregir", "label": "🔍 Corregir frases (opcional)", "placeholder": '[{"fraseConError": "...", "fraseCorrecta": "..."}]'},
    {"id": "dictado", "label": "🎧 Dictado - frases en inglés (opcional)", "placeholder": '["The cat is on the table", "She goes to school every day"]'},
    {"id": "informacion", "label": "💡 Práctica inicial (opcional)", "placeholder": '[{"titulo": "...", "introduccion": "...", "ejercicio1": {"subtitulo": "...", "preguntas": [{"texto": "...", "opciones": [{"texto": "...", "correcta": true, "explicacion": "..."}]}]}, "ejercicio2": {"subtitulo": "...", "banco": ["..."], "frases": [{"texto": "... ___ ...", "respuesta": "..."}]}, "ejercicio3": {"subtitulo": "...", "explicacion": "...", "traducciones": [{"spanishWord": "...", "englishWord": "..."}]}}]'},
]

EXERCISE_FILES = {
    # idioma.js y contracciones.js van primero: definen helpers compartidos
    # (getTargetLangMeta/toggleTargetLanguage y normalizeContractions/
    # contractionAwareEquals) que usan los demás módulos de ejercicios.
    # informacion.js NO usa contracciones.js a propósito (debe seguir
    # validando de forma estricta, sin tolerar contracciones).
    "exercises/idioma.js": "__IDIOMA_JS__",
    "exercises/contracciones.js": "__CONTRACCIONES_JS__",
    "exercises/traduccion.js": "__TRADUCCION_JS__",
    "exercises/completar.js": "__COMPLETAR_JS__",
    "exercises/seleccionar.js": "__SELECCIONAR_JS__",
    "exercises/corregir.js": "__CORREGIR_JS__",
    "exercises/dictado.js": "__DICTADO_JS__",
    "exercises/informacion.js": "__INFORMACION_JS__",
}

# Módulos del Listening Trainer (Nivel 0) — carpeta aparte, propia llave de
# localStorage, propio dataset (listening/data/nivel0.json). No comparten
# nada con EXERCISE_FILES/data-en/data-it a propósito: es otra sección de
# la app que vive detrás de su propio botón en el header.
LISTENING_EXERCISE_FILES = {
    "listening/exercises/listening-core.js": "__LISTENING_CORE_JS__",
    "listening/exercises/listening-n1-core.js": "__LISTENING_N1_CORE_JS__",
    "listening/exercises/listening-map.js": "__LISTENING_MAP_JS__",
    "listening/exercises/listening-play.js": "__LISTENING_PLAY_JS__",
    "listening/exercises/listening-n1-play.js": "__LISTENING_N1_PLAY_JS__",
}

LISTENING_DATA_FILE = os.path.join("listening", "data", "nivel0.json")

# Reels: la sección principal (reemplaza al mapa). Secuencia infinita de
# ejercicios a pantalla completa con sorpresas cada 5-15 tarjetas. Todo vive
# en reels/ (JS, CSS e historias); usa el mismo banco de data-{lang}/ejercicios.
REELS_FILES = {
    "reels/reels-core.js": "__REELS_CORE_JS__",
    "reels/reels-sorpresas.js": "__REELS_SORPRESAS_JS__",
    "reels/reels-youglish.js": "__REELS_YOUGLISH_JS__",
}
REELS_STYLES_FILE = os.path.join("reels", "reels.css")
# Historias de la sorpresa 5: reels/historias/<idioma>/*.json. Cada archivo es
# un array de historias {id, titulo, story, preguntas: [{q, opciones[4], correcta}] x4}.
# Una historia ya terminada (4 lecturas) no se vuelve a usar; se pueden borrar del repo.
HISTORIAS_DIR = os.path.join("reels", "historias")

# Nivel 1 de Listening: 12 bloques. Los JSON de cada bloque viven en
# listening/nivel1/data/bloqueN.json y los audios en listening/nivel1/bloqueN/.
# Las palabras sueltas (1 palabra) las lee la app con la voz del sistema: no necesitan mp3.
# Los ejercicios de 2+ palabras solo entran si su mp3 existe de verdad (y no aparecen en
# un reporte_fallos.json), así que se puede ir generando bloque por bloque: lo que aún no
# tiene audios queda marcado como "faltan audios".
NIVEL1_DIR = os.path.join("listening", "nivel1")
NIVEL1_DATA_DIR = os.path.join(NIVEL1_DIR, "data")
NIVEL1_TOTAL_BLOQUES = 12
# True = el service worker precachea todos los audios del Nivel 1 al instalar
# (offline total, pero la instalación descarga todos los mp3). False = se
# guardan en caché solo al reproducirse.
NIVEL1_PRECACHE_AUDIO = False
NIVEL1_CAMPOS = ["id", "item", "bloque", "tipo", "version", "categoria", "audio", "voz", "nameFile", "sonido",
                 "objetivo", "par", "par_item", "pares", "pares_item", "estricto", "mascara", "hueco", "acepta",
                 "n_palabras", "evento", "texto_es"]
LISTENING_STYLES_FILE = os.path.join("listening", "styles", "listening.css")


# Aventura (juego de conversaciones por audio): carpeta aparte aventura/ con su propio
# juego (jugar.html), su propia llave de localStorage ("aventura_v1") y sus audios.
# Se abre en un iframe a pantalla completa y horizontal. Solo se precachean los
# archivos que el juego usa en runtime (no las herramientas ni los SVG sueltos).
AVENTURA_DIR = "aventura"


def aventura_asset_list():
    """Rutas (relativas al index.html) que el service worker precachea para jugar sin conexion."""
    base = AVENTURA_DIR
    if not os.path.isdir(base):
        return []
    assets = [f"./{base}/jugar.html"]
    for sub in ("motor", ):
        d = os.path.join(base, sub)
        if os.path.isdir(d):
            assets += [f"./{base}/{sub}/{f}" for f in sorted(os.listdir(d))]
    for rel in ("svg/biblioteca.js", "data/catalogo_misiones.json"):
        if os.path.exists(os.path.join(base, rel)):
            assets.append(f"./{base}/{rel}")
    for sub, ext in (("data/compilado", ".json"), ("data/layouts", ".json")):
        d = os.path.join(base, sub)
        if os.path.isdir(d):
            assets += [f"./{base}/{sub}/{f}" for f in sorted(os.listdir(d)) if f.endswith(ext)]
    # solo los mp3 que alguna mision compilada realmente usa
    comp = os.path.join(base, "data", "compilado")
    usados = set()
    if os.path.isdir(comp):
        for f in os.listdir(comp):
            if f.endswith(".json"):
                try:
                    usados |= set(re.findall(r'"file":\s*"([^"]+\.mp3)"', open(os.path.join(comp, f), encoding="utf-8").read()))
                except OSError:
                    pass
    audio_dir = os.path.join(base, "audio")
    assets += [f"./{base}/audio/{f}" for f in sorted(usados) if os.path.exists(os.path.join(audio_dir, f))]
    return assets


DATA_LANGUAGES = ["en", "it"]


def data_dir(lang):
    """Carpeta de datos de un idioma: data-en/, data-it/, etc. — cada
    idioma objetivo tiene su propia carpeta completa (reglas, ejercicios,
    información), totalmente separada de las demás."""
    return f"data-{lang}"


def grammar_rules_file(lang):
    return os.path.join(data_dir(lang), "reglas-gramaticales.json")


def study_exercises_dir(lang):
    return os.path.join(data_dir(lang), "ejercicios")


def informacion_reglas_file(lang):
    return os.path.join(data_dir(lang), "informacion-reglas.json")


# Claves de los 5 tipos crudos -> nombre de tipo singular usado en runtime
# (mismo mapeo que createNodeStructure() en mapa/map.js).
TYPE_KEY_TO_SINGULAR = {
    "traducciones": "traduccion",
    "completar": "completar",
    "seleccionar": "seleccionar",
    "corregir": "corregir",
    "dictado": "dictado",
}


def load_grammar_rules(lang):
    """Lee data-{lang}/reglas-gramaticales.json (listado maestro con
    id/regla/porcentaje) para UN idioma. Es solo la SEMILLA: en runtime el
    % real vive y se actualiza en localStorage (una llave por idioma),
    independiente de este archivo. Si la carpeta del idioma no existe
    todavía (por ejemplo data-it/ recién creada sin contenido), devuelve
    una lista vacía sin romper el build."""
    path = grammar_rules_file(lang)
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    rules = data.get('reglas', data if isinstance(data, list) else [])
    # Solo id/regla/porcentaje viajan al cliente (se ignoran comentarios).
    return [{"id": r["id"], "regla": r["regla"], "porcentaje": r.get("porcentaje", 0)} for r in rules]


def load_study_exercises(lang):
    """Combina TODOS los .json de data-{lang}/ejercicios/ en una sola
    lista plana de ejercicios ya normalizados (type/id/reglaIds + campos
    propios del tipo) para UN idioma, lista para que el flujo de
    'Seleccionar reglas a estudiar' la filtre por reglaId sin transformar
    nada en runtime."""
    all_exercises = []
    ejercicios_dir = study_exercises_dir(lang)
    if not os.path.isdir(ejercicios_dir):
        return all_exercises

    counters = {singular: 0 for singular in TYPE_KEY_TO_SINGULAR.values()}
    seen_ids = set()
    files = sorted(f for f in os.listdir(ejercicios_dir) if f.endswith('.json'))

    for fname in files:
        fpath = os.path.join(ejercicios_dir, fname)
        file_stem = os.path.splitext(fname)[0]
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for raw_key, singular in TYPE_KEY_TO_SINGULAR.items():
            for raw in (data.get(raw_key) or []):
                counters[singular] += 1

                if singular == "dictado":
                    if isinstance(raw, str):
                        ex = {"text": raw, "reglaIds": []}
                    else:
                        ex = dict(raw)
                        ex.setdefault("text", ex.get("text") or "")
                elif singular == "seleccionar":
                    if isinstance(raw, list):
                        ex = {"pairs": raw, "reglaIds": []}
                    else:
                        ex = dict(raw)
                else:
                    ex = dict(raw)

                ex["type"] = singular
                custom_id = ex.get("id") if isinstance(raw, dict) else None
                ex["id"] = custom_id or f"{lang}_{singular}_{counters[singular]}_{file_stem}"
                ex["reglaIds"] = ex.get("reglaIds") or []

                if ex["id"] in seen_ids:
                    print(f"  ⚠️  [{lang}] id duplicado '{ex['id']}' en {fname} — se agrega igual, revísalo a mano")
                seen_ids.add(ex["id"])

                all_exercises.append(ex)

    return all_exercises


def load_informacion_por_regla(lang):
    """Lee data-{lang}/informacion-reglas.json: lecciones de 'información'
    (mismo esquema que informacion.js) agrupadas por id de regla
    gramatical, para UN idioma."""
    path = informacion_reglas_file(lang)
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data.get('porRegla', data if isinstance(data, dict) else {})


def load_listening_exercises():
    """Lee listening/data/nivel0.json: los 700 ejercicios del Nivel 0 de
    Listening, con sus rutas de audio (campo "audios"). Si el archivo no
    existe todavía, el build sigue funcionando (NIVEL0_EXERCISES queda
    vacío) en vez de romperse — útil mientras se termina de armar la
    carpeta listening/."""
    if not os.path.exists(LISTENING_DATA_FILE):
        print(f"⚠️  No encontrado: {LISTENING_DATA_FILE} (Listening quedará vacío en este build)")
        return []
    with open(LISTENING_DATA_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def _nivel1_fallos():
    """nameFile de audios marcados como fallidos por generar.py --verificar
    (reporte_fallos.json). Se busca en listening/, listening/nivel1/ y en cada
    carpeta de bloque; si no hay ninguno, no se excluye nada."""
    rutas = [os.path.join("listening", "reporte_fallos.json"), os.path.join(NIVEL1_DIR, "reporte_fallos.json")]
    rutas += [os.path.join(NIVEL1_DIR, f"bloque{b}", "reporte_fallos.json") for b in range(1, NIVEL1_TOTAL_BLOQUES + 1)]
    fallos = set()
    for ruta in rutas:
        if not os.path.exists(ruta):
            continue
        try:
            with open(ruta, "r", encoding="utf-8") as f:
                data = json.load(f)
            for r in data:
                if isinstance(r, dict) and r.get("nameFile"):
                    fallos.add(r["nameFile"])
        except (OSError, ValueError):
            print(f"⚠️  No se pudo leer {ruta}")
    return fallos


def load_nivel1_bank():
    """Arma el banco del Nivel 1 que viaja dentro del index.html: por bloque, solo
    los ejercicios con audio presente. Devuelve {"bloques": {n: {...}}, "motiv": [...]}."""
    bank = {"bloques": {}, "motiv": []}
    fallos = _nivel1_fallos()
    if fallos:
        print(f"  ℹ️  [nivel1] {len(fallos)} audio(s) en reporte_fallos.json: no se incluirán")
    for b in range(1, NIVEL1_TOTAL_BLOQUES + 1):
        data_file = os.path.join(NIVEL1_DATA_DIR, f"bloque{b}.json")
        if not os.path.exists(data_file):
            continue
        try:
            with open(data_file, "r", encoding="utf-8") as f:
                items = json.load(f)
        except ValueError as e:
            print(f"❌ {data_file} no es un JSON válido: {e}")
            sys.exit(1)
        folder = os.path.join(NIVEL1_DIR, f"bloque{b}")
        existentes = set(os.listdir(folder)) if os.path.isdir(folder) else set()
        plan_train = sum(1 for it in items if it.get("tipo") == "entrenamiento")
        plan_exam = sum(1 for it in items if it.get("tipo") == "examen")
        listos = []
        for it in items:
            nf = it.get("nameFile")
            # Palabras sueltas (1 palabra): la app las lee con la voz del sistema, sin mp3.
            suelta = it.get("tipo") != "motivacion" and it.get("n_palabras", 1) == 1
            if not suelta and (not nf or nf not in existentes or nf in fallos):
                continue
            compact = {k: it[k] for k in NIVEL1_CAMPOS if k in it}
            if it.get("tipo") == "motivacion":
                bank["motiv"].append(compact)
            else:
                listos.append(compact)
        bank["bloques"][str(b)] = {"items": listos, "plan_train": plan_train, "plan_exam": plan_exam}
        n_train = sum(1 for it in listos if it["tipo"] == "entrenamiento")
        n_exam = sum(1 for it in listos if it["tipo"] == "examen")
        print(f"  ✅ [nivel1] bloque {b}: {n_train}/{plan_train} entrenamiento · {n_exam}/{plan_exam} examen listos (1 palabra = voz del sistema)")
    if bank["motiv"]:
        print(f"  ✅ [nivel1] {len(bank['motiv'])} audios motivacionales")
    return bank


def nivel1_asset_list(bank=None):
    """Rutas de audio del Nivel 1 para precachear (solo si NIVEL1_PRECACHE_AUDIO)."""
    if not NIVEL1_PRECACHE_AUDIO:
        return []
    bank = bank or load_nivel1_bank()
    rutas = []
    for bl in bank["bloques"].values():
        rutas += [f"./listening/nivel1/bloque{it['bloque']}/{it['nameFile']}" for it in bl["items"] if it.get("n_palabras", 1) > 1]
    rutas += [f"./listening/nivel1/bloque{it['bloque']}/{it['nameFile']}" for it in bank["motiv"]]
    return rutas


def load_historias(lang):
    """Combina reels/historias/<lang>/*.json (arrays de historias) y valida cada una."""
    carpeta = os.path.join(HISTORIAS_DIR, lang)
    if not os.path.isdir(carpeta):
        return []
    historias, ids = [], set()
    for fname in sorted(f for f in os.listdir(carpeta) if f.endswith('.json')):
        ruta = os.path.join(carpeta, fname)
        try:
            with open(ruta, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except ValueError as e:
            print(f"❌ {ruta} no es un JSON válido: {e}")
            sys.exit(1)
        lista = data.get('historias', []) if isinstance(data, dict) else data
        for h in lista:
            pregs = h.get('preguntas') or []
            ok = (h.get('id') and h.get('story') and len(pregs) >= 4 and
                  all(isinstance(p.get('opciones'), list) and len(p['opciones']) == 4 and
                      isinstance(p.get('correcta'), int) and 0 <= p['correcta'] < 4 for p in pregs[:4]))
            if not ok:
                print(f"  ⚠️  [{lang}] historia inválida en {fname}: {h.get('id', '(sin id)')} — se omite")
                continue
            if h['id'] in ids:
                print(f"  ⚠️  [{lang}] id de historia duplicado '{h['id']}' en {fname} — se omite")
                continue
            ids.add(h['id'])
            historias.append({"id": h['id'], "titulo": h.get('titulo', ''), "story": h['story'], "preguntas": pregs[:4]})
    return historias


def read_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    except FileNotFoundError:
        print(f"❌ No encontrado: {filepath}")
        sys.exit(1)


def build_import_example_json():
    return json.dumps({t["id"]: json.loads(t["placeholder"]) for t in INPUT_TYPES}, ensure_ascii=False)


def build_import_fields():
    # Un único textarea: se pega el array completo en un solo JSON con las
    # 5 claves (traducciones, completar, seleccionar, corregir, dictado).
    # Cualquier clave ausente se trata como vacía. Junto al textarea va el
    # botón "Copiar prompt", que copia el contenido de prompt.txt (archivo
    # externo y editable, no se genera desde este script) al portapapeles
    # para pegarlo directo en la IA que construye la tanda de ejercicios.
    example = build_import_example_json()
    return (
        '        <div class="multi-input-section">\n'
        '          <div class="import-fields-header">\n'
        '            <h4>📦 Array completo (JSON)</h4>\n'
        '            <button type="button" class="fun-btn" id="copyPromptBtn">📋 Copiar prompt para la IA</button>\n'
        '          </div>\n'
        f'          <textarea id="fullDataInput" class="answer-input" rows="10" placeholder=\'{example}\'></textarea>\n'
        '        </div>\n'
    )


def build_load_data_fields():
    ids = [t["id"] for t in INPUT_TYPES]
    lines = [
        'const __rawFullData = document.getElementById("fullDataInput").value.trim();',
        'const __parsedFullData = __rawFullData ? JSON.parse(__rawFullData) : {};',
    ]
    for _id in ids:
        lines.append(f'const {_id} = __parsedFullData.{_id} || [];')
    return '\n      '.join(lines)


def build_validation_args():
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def build_create_node_args():
    return '{ ' + ', '.join([t["id"] for t in INPUT_TYPES]) + ' }'


def create_manifest():
    manifest = {
        "name": "English Trainer",
        "short_name": "EnglishTrainer",
        "description": "Mejora tu inglés con práctica diaria",
        "start_url": "./index.html",
        "display": "standalone",
        "background_color": "#131f24",
        "theme_color": "#58cc02",
        "orientation": "portrait-primary",
        "icons": [
            {"src": ICON_URL, "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
            {"src": ICON_URL, "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}
        ]
    }
    with open('manifest.json', 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f"  ✅ manifest.json creado")


def create_service_worker():
    sw_code = '''// service-worker.js
const CACHE_NAME = '__CACHE_NAME__';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Baloo+2:wght@500;600;700;800&display=swap',
  'https://cdn-icons-png.flaticon.com/512/3898/3898082.png',
];
const AVENTURA_ASSETS = __AVENTURA_ASSETS__;
const NIVEL1_ASSETS = __NIVEL1_ASSETS__;

self.addEventListener('install', (event) => {
  // Los archivos de la Aventura se precachean uno a uno: si falta alguno (por ejemplo un audio),
  // no se rompe la instalacion del resto de la app.
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(ASSETS);
    await Promise.all(AVENTURA_ASSETS.map((u) => cache.add(u).catch(() => null)));
    await Promise.all(NIVEL1_ASSETS.map((u) => cache.add(u).catch(() => null)));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      // sin red: busca la peticion exacta y, si no esta (p. ej. jugar.html?m=m007), la misma pagina sin parametros
      .catch(() => caches.match(event.request).then((r) => r || caches.match(event.request, { ignoreSearch: true })))
  );
});
'''
    sw_code = sw_code.replace('__CACHE_NAME__', cache_name_for_version())
    sw_code = sw_code.replace('__AVENTURA_ASSETS__', json.dumps(aventura_asset_list(), indent=2))
    sw_code = sw_code.replace('__NIVEL1_ASSETS__', json.dumps(nivel1_asset_list(), indent=2))
    with open('service-worker.js', 'w', encoding='utf-8') as f:
        f.write(sw_code)
    print(f"  ✅ service-worker.js creado (cache: {cache_name_for_version()})")


def get_html_template():
    return '''<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="theme-color" content="#0a0a0a" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="English Trainer" />
  <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/3898/3898082.png" />
  <link rel="manifest" href="./manifest.json" />
  <title>English Trainer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Baloo+2:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>__STYLES__</style>
</head>
<body>
<div class="app-container">
  <div id="loginScreen" class="screen active">
    <div class="login-card">
      <div class="login-logo">EN</div>
      <h1>English Trainer</h1>
      <p>Mejora tu inglés con práctica diaria</p>
      <input type="text" id="usernameInput" class="username-input" placeholder="Nombre de usuario" maxlength="30" autocomplete="off">
      <button id="loginBtn" class="login-btn">Comenzar</button>
      <p class="pwa-hint">📱 También funciona sin conexión</p>
    </div>
  </div>

  <div id="mainScreen" class="screen">
    <div class="play-topbar">
      <div class="brand-mini">
        <div class="title-fun">English Trainer</div>
      </div>
      <div class="topbar-actions">
        <button class="menu-btn" id="toggleHomeBtn" title="Inicio" style="display:none;">🏠</button>
        <button class="menu-btn" id="toggleMenuBtn">☰</button>
      </div>
    </div>

    <div id="homeScreen" class="screen active">
      <div class="home-hero">
        <h2>¡Hola <span id="welcomeUsername"></span>!</h2>
        <p id="homeLangTag"></p>
      </div>
      <div class="home-grid">
        <button class="home-tile home-tile-reels" id="homeReelsBtn">
          <span class="home-tile-ico">▶</span>
          <span><b>Reels</b><small>Sigue donde quedaste. Nunca sabes qué viene.</small></span>
        </button>
        <button class="home-tile" id="homeJuegoBtn">
          <span class="home-tile-ico">🎮</span>
          <span><b>Juego</b><small>Aventura de conversaciones por audio</small></span>
        </button>
        <button class="home-tile" id="homeListeningBtn">
          <span class="home-tile-ico">🎧</span>
          <span><b>Listening</b><small>Entrena el oído por niveles</small></span>
        </button>
        <button class="home-tile home-tile-azure" id="homeAzureBtn">
          <span class="home-tile-ico">☁️</span>
          <span><b>Azure</b><small>Curso AI-901 (Azure AI Fundamentals)</small></span>
        </button>
      </div>
    </div>

    <div id="listeningHomeScreen" class="screen listening-theme">
      <div class="magic-card">
        <div class="l0-intro" id="listeningNivel1Toggle" role="button" tabindex="0" aria-expanded="true">
          <span class="l0-intro-icon">🎯</span>
          <div class="l0-intro-text">
            <h2>Nivel 1 — Pulido del oído</h2>
            <p>12 bloques: Descubre, Distingue, Completa, Escribe y examen. Cada examen se aprueba con 70 o más.</p>
          </div>
          <span class="l0-intro-chevron" id="listeningNivel1Chevron">▾</span>
        </div>
        <div id="listeningNivel1Body" class="l0-nivel0-body">
          <div id="listeningN1Summary" class="l0-summary-row"></div>
          <div id="listeningN1List" class="l0-level-list"></div>
          <div class="n1-aviso" id="listeningN1Retest" style="display:none;">🏁 Terminaste el Nivel 1. Sigue el re-test del Nivel 0 con palabras nuevas; después se abre el Nivel 2.</div>
        </div>
      </div>

      <div class="magic-card">
        <div class="l0-intro" id="listeningNivel0Toggle" role="button" tabindex="0" aria-expanded="false">
          <span class="l0-intro-icon">🎧</span>
          <div class="l0-intro-text">
            <h2>Nivel 0 — Diagnóstico de listening</h2>
            <p>700 ejercicios de dictado en 7 bloques. Cada audio tiene 4 voces distintas generadas por IA.</p>
          </div>
          <span class="l0-intro-chevron" id="listeningNivel0Chevron">▸</span>
        </div>
        <div id="listeningNivel0Body" class="l0-nivel0-body is-collapsed">
          <div id="listeningSummaryRow" class="l0-summary-row"></div>
          <div id="listeningMapList" class="l0-level-list"></div>
        </div>
        <button class="fun-btn full-width" id="listeningReportBtn" style="width:100%;margin-top:12px;">📊 Ver reporte</button>
      </div>

      <div id="listeningFutureLevels" class="l0-future-levels" style="display:none;"></div>
    </div>

    <div id="listeningReportScreen" class="screen listening-theme">
      <div class="magic-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <button class="l0-play-exit-btn" id="listeningReportBackBtn" aria-label="Volver" title="Volver"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 13.8 6 8 12l5.8 6 1.4-1.4L10.8 12z"/></svg></button>
          <h2 style="margin:0;font-family:var(--font-display);color:var(--ink);font-size:1.05rem;">📊 Reporte de Listening</h2>
        </div>
        <div id="listeningReportContainer"></div>
      </div>
    </div>

    <div id="listeningPlayScreen" class="screen listening-theme">
      <div class="exercise-area">
        <div class="l0-play-topbar">
          <button class="l0-play-exit-btn" id="l0PlayExitBtn" aria-label="Salir del bloque" title="Salir del bloque"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 13.8 6 8 12l5.8 6 1.4-1.4L10.8 12z"/></svg></button>
          <div class="l0-play-progress-track">
            <div class="l0-play-progress-fill" id="l0PlayProgressFill" style="width:0%;"></div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill-status" id="l0PlayBloqueTag">Bloque 1</span>
          <span class="pill-status" id="l0PlayExTag">Ejercicio 1/100</span>
          <span class="pill-status" id="l0PlayCategoriaTag">🔊</span>
        </div>
        <div id="listeningPlayContainer" class="l0-play-container"></div>
        <div id="l0PlayResultLine" class="sub-fun" style="text-align:center;">🎧 Escucha y elige</div>
      </div>
    </div>

    <div id="listeningN1HubScreen" class="screen listening-theme">
      <div class="magic-card">
        <div id="n1HubContainer"></div>
      </div>
    </div>

    <div id="listeningN1PlayScreen" class="screen listening-theme">
      <div class="exercise-area">
        <div class="l0-play-topbar">
          <button class="l0-play-exit-btn" id="n1PlayExitBtn" aria-label="Salir" title="Salir (tu avance se guarda)"><svg viewBox="0 0 24 24"><path d="M15.4 7.4 13.8 6 8 12l5.8 6 1.4-1.4L10.8 12z"/></svg></button>
          <div class="l0-play-progress-track">
            <div class="l0-play-progress-fill" id="n1PlayProgressFill" style="width:0%;"></div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill-status" id="n1PlayBloqueTag">Bloque 1</span>
          <span class="pill-status" id="n1PlayFaseTag">Escribe</span>
          <span class="pill-status" id="n1PlayExTag"></span>
          <span class="pill-status" id="n1PlayCatTag" style="display:none;"></span>
        </div>
        <div id="n1MotivBanner"></div>
        <div id="n1PlayContainer" class="l0-play-container"></div>
        <div id="n1PlayResultLine" class="sub-fun" style="text-align:center;">🎧 Escucha con atención</div>
      </div>
    </div>

    <div id="listeningResultScreen" class="screen listening-theme">
      <div class="magic-card">
        <div id="listeningResultContainer"></div>
        <div class="button-group">
          <button class="fun-btn full-width" id="l0ResultRetryBtn" style="width:100%;margin-bottom:8px;"><svg viewBox="0 0 24 24" style="width:1.1em;height:1.1em;vertical-align:-0.15em;margin-right:6px;fill:currentColor;"><path d="M12 5V2L7 7l5 5V9a5 5 0 1 1-5 5H5a7 7 0 1 0 7-9z"/></svg>Reintentar bloque</button>
          <button class="fun-btn primary-btn full-width" id="l0ResultBackBtn" style="width:100%;">🎧 Volver a Listening</button>
        </div>
      </div>
    </div>
  </div>
</div>

<div id="aventuraOverlay" class="aventura-overlay" hidden>
  <iframe id="aventuraFrame" title="Aventura" allow="autoplay; fullscreen" referrerpolicy="same-origin"></iframe>
</div>

<div id="azureOverlay" class="aventura-overlay" hidden>
  <iframe id="azureFrame" title="Curso Azure AI-901"></iframe>
</div>

<div id="reelsOverlay" class="rl-overlay" hidden>
  <div id="rlStage" class="rl-stage"></div>
  <button class="rl-float rl-close" id="rlCloseBtn" aria-label="Salir de Reels" title="Salir">✕</button>
  <button class="rl-float rl-help" id="rlHelpBtn" aria-label="Ayuda de gramática" title="Ayuda">❓</button>
</div>

<div id="toastFun" class="toast-fun"></div>

<script type="module">
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((reg) => console.log('✅ SW registrado:', reg.scope))
        .catch((err) => console.log('⚠️ SW falló:', err));
    });
  }

  __MAP_JS__
  __IDIOMA_JS__
  __CONTRACCIONES_JS__
  __TRADUCCION_JS__
  __COMPLETAR_JS__
  __SELECCIONAR_JS__
  __CORREGIR_JS__
  __DICTADO_JS__
  __INFORMACION_JS__
  const NIVEL0_EXERCISES = __NIVEL0_EXERCISES_JSON__;
  const NIVEL1_BANK = __NIVEL1_BANK_JSON__;
  const HISTORIAS_BY_LANG = __HISTORIAS_JSON__;
  __LISTENING_CORE_JS__
  __LISTENING_N1_CORE_JS__
  __LISTENING_MAP_JS__
  __LISTENING_PLAY_JS__
  __LISTENING_N1_PLAY_JS__
  __REELS_CORE_JS__
  __REELS_SORPRESAS_JS__
  __REELS_YOUGLISH_JS__
  __MAIN_LOGIC__
</script>
</body>
</html>'''


def get_main_logic():
    return r'''
  const BASE_STORAGE_KEY = "__LS_KEY__";
  const IMPORT_EXAMPLE_JSON = __IMPORT_EXAMPLE_JSON__;

  // Backend (Google Apps Script) donde se va guardando el historial de %
  // por regla, para poder verlo en una gráfica y para que "último
  // registro" sea consultable desde cualquier dispositivo/sesión. Si no
  // hay conexión, todas las funciones que lo usan fallan en silencio y la
  // app sigue funcionando 100% con lo que haya en localStorage (nunca es
  // obligatorio para jugar).
  const API_URL = "https://script.google.com/macros/s/AKfycbzHax9Z2BPYCGmIDjNZyzRyY8LLk5It79bFyi2aoIIa5hLtG4OZOmeKCknMTFNLm05a/exec";

  // El progreso (nodos/ejercicios cargados, avance, repaso, informe) se
  // guarda en una llave de localStorage DISTINTA por idioma objetivo, así
  // que estudiar inglés e italiano son dos "partidas" completamente
  // independientes: cambiar el idioma en el menú nunca mezcla ni pisa el
  // progreso del otro.
  function currentStorageKey() {
    return BASE_STORAGE_KEY + "_" + getTargetLanguage();
  }

  // ==================== REGLAS GRAMATICALES + BANCO DE EJERCICIOS ====================
  // Embebidos en el build (ver load_grammar_rules/load_study_exercises/
  // load_informacion_por_regla en build.py), UNA VEZ POR IDIOMA — cada uno
  // sale de su propia carpeta (data-en/, data-it/, ver DATA_LANGUAGES en
  // build.py), no de una carpeta única "data". Las constantes de abajo son
  // objetos {en: ..., it: ...}; current*() resuelve el idioma activo.
  // GRAMMAR_RULES_SEED solo aporta id + nombre (su % se ignora); el % real se
  // calcula desde la tabla y se cachea en localStorage bajo rulesStorageKey() (también por idioma) y sobrevive
  // a "Borrar todo" (esa acción solo toca currentStorageKey()).
  const GRAMMAR_RULES_SEED_BY_LANG = __GRAMMAR_RULES_JSON__;
  const ALL_STUDY_EXERCISES_BY_LANG = __STUDY_EXERCISES_JSON__;
  const INFORMACION_POR_REGLA_BY_LANG = __INFORMACION_POR_REGLA_JSON__;

  function currentGrammarSeed() { return GRAMMAR_RULES_SEED_BY_LANG[getTargetLanguage()] || []; }
  function currentStudyExercises() { return ALL_STUDY_EXERCISES_BY_LANG[getTargetLanguage()] || []; }
  function currentInformacionPorRegla() { return INFORMACION_POR_REGLA_BY_LANG[getTargetLanguage()] || {}; }

  // v2: se descartan los % viejos guardados antes (podían venir de un JSON
  // pegado a mano o de la semilla del proyecto). Ahora el % SOLO se calcula
  // a partir del historial de la tabla de Google (ver computeRulePercentage).
  function rulesStorageKey() {
    return "english_trainer_grammar_rules_v2_" + getTargetLanguage();
  }

  // La semilla (reglas-gramaticales.json) solo aporta id + nombre de la
  // regla. Su "porcentaje" se ignora por completo: arranca en 0 y el valor
  // real llega del historial de la tabla. localStorage solo guarda el
  // ÚLTIMO valor calculado desde la tabla, para mostrar algo sin conexión.
  function loadGrammarRules() {
    let saved = [];
    try {
      const raw = localStorage.getItem(rulesStorageKey());
      if (raw) saved = JSON.parse(raw) || [];
    } catch (e) { /* noop */ }
    return currentGrammarSeed().map((r) => {
      const found = saved.find((s) => s.id === r.id);
      return { ...r, porcentaje: found && typeof found.porcentaje === "number" ? found.porcentaje : 0 };
    });
  }

  function saveGrammarRules(rules) {
    try {
      localStorage.setItem(rulesStorageKey(), JSON.stringify(rules.map((r) => ({ id: r.id, porcentaje: r.porcentaje }))));
    } catch (e) { /* noop */ }
  }

  let AppRules = loadGrammarRules();

  function findRegla(id) {
    return AppRules.find((r) => r.id === id) || null;
  }

  // ==================== SINCRONIZACIÓN DE % CON EL BACKEND ====================
  // El backend (Google Sheets vía Apps Script) guarda un HISTORIAL por
  // idioma: cada vez que se actualizan porcentajes aquí, se agrega una
  // fila nueva por regla con fecha + idioma + reglaId + regla + %. Nunca
  // se sobrescribe nada — así se puede graficar cómo se ha movido cada
  // regla en el tiempo. El filtro por idioma (?idioma=en / ?idioma=it) es
  // lo que garantiza que un idioma nunca vea el registro del otro.
  function formatShortDate(fechaStr) {
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return String(fechaStr).slice(0, 10);
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
    } catch (e) { return String(fechaStr).slice(0, 10); }
  }

  // Cache del último historial COMPLETO (todas las reglas) traído del
  // backend para el idioma activo. Se llena al sincronizar (al entrar a
  // "Ver porcentajes" / "Seleccionar reglas") y el modal de estadísticas
  // la reutiliza en vez de volver a pedirle al backend exactamente lo
  // mismo que la pantalla ya acaba de traer — antes hacía la consulta dos
  // veces (una al entrar, otra al abrir el modal) sin necesidad. Queda
  // atada al idioma con el que se llenó (cachedPercentageHistoryLang), así
  // que un cambio de idioma la invalida sola.
  let cachedPercentageHistory = null;
  let cachedPercentageHistoryLang = null;

  async function fetchAllPercentageHistory() {
    const idioma = getTargetLanguage();
    const res = await fetch(API_URL + "?sheet=porcentajes&idioma=" + encodeURIComponent(idioma));
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Error desconocido");
    const data = json.data || [];
    cachedPercentageHistory = data;
    cachedPercentageHistoryLang = idioma;
    return data;
  }

  // Trae TODO el historial del idioma activo para una regla puntual,
  // ordenado de más viejo a más nuevo (para la gráfica de barras). Usa el
  // cache si ya está listo (idioma correcto) en vez de volver a pedírselo
  // al backend; si no hay cache todavía (p. ej. se abrió el modal antes de
  // que terminara la sincronización de fondo de la pantalla), lo trae una
  // sola vez y lo deja cacheado para la próxima.
  async function fetchPercentageHistory(reglaId) {
    const idioma = getTargetLanguage();
    const data = (cachedPercentageHistoryLang === idioma && cachedPercentageHistory)
      ? cachedPercentageHistory
      : await fetchAllPercentageHistory();
    return data
      .filter((it) => Number(it.reglaId) === Number(reglaId))
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  }

  const PCT_BONUS_THRESHOLD = 80;
  const PCT_BONUS = 10;

  function computeRulePercentage(results) {
    const valid = results.filter(
      (p) => typeof p === "number" && !Number.isNaN(p)
    );

    if (!valid.length) return 0;

    // Si hay más de un resultado, los ceros son valores iniciales
    // y no deben participar en el cálculo.
    const filtered = valid.length > 1
      ? valid.filter((p) => p !== 0)
      : valid;

    // Si solamente existían ceros, el resultado es 0
    if (!filtered.length) return 0;

    // Un único resultado
    if (filtered.length === 1) {
      const p = filtered[0];

      const adjusted = p >= PCT_BONUS_THRESHOLD
        ? Math.min(100, p + PCT_BONUS)
        : p;

      return Math.round((adjusted / 2) * 10) / 10;
    }

    // Si hay más de 4 resultados, tomar los 4 últimos
    const values = filtered.length > 4
      ? filtered.slice(-4)
      : filtered;

    // Regla normal: aplicar bonus y calcular promedio
    const adjusted = values.map((p) =>
      Math.min(
        100,
        p >= PCT_BONUS_THRESHOLD
          ? p + PCT_BONUS
          : p
      )
    );

    const avg =
      adjusted.reduce((sum, p) => sum + p, 0) / adjusted.length;

    return Math.round(avg * 10) / 10;
  }

  async function syncLatestPercentagesFromBackend() {
    try {
      const data = await fetchAllPercentageHistory();
      const resultsByRule = {};
      data.forEach((it) => {
        const id = Number(it.reglaId);
        (resultsByRule[id] = resultsByRule[id] || []).push(Number(it.porcentaje));
      });
      let changed = false;
      AppRules.forEach((r) => {
        const pct = computeRulePercentage(resultsByRule[r.id] || []);
        if (pct !== r.porcentaje) {
          r.porcentaje = pct;
          changed = true;
        }
      });
      if (changed) saveGrammarRules(AppRules);
      return changed;
    } catch (e) {
      return false;
    }
  }

  let currentUser = null;
  
  const AppState = {
    nodes: [],
    progress: {},
    activeNodeIndex: 0,
    activeExerciseIndex: 0,
    failedExercises: [],
    reportEntries: [],
    reviewPool: [],
    sessionCorrectness: {},
    sessionAnswers: {},
    practicaInicial: null,
  };

  function toast(msg) {
    const t = document.getElementById("toastFun");
    if(!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(window._tt);
    window._tt = setTimeout(() => t.classList.remove("show"), 2500);
  }
  window._toast = toast;
  
  window._escHTML = function(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  };
  
  function cleanupAudio() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    const exContainer = document.getElementById("exerciseContainer");
    if (exContainer && exContainer._corregirCarouselTimer) {
      clearInterval(exContainer._corregirCarouselTimer);
      exContainer._corregirCarouselTimer = null;
    }
  }
  
  const mainScreens = {
    home: document.getElementById("homeScreen"),
    listeningHome: document.getElementById("listeningHomeScreen"),
    listeningN1Hub: document.getElementById("listeningN1HubScreen"),
    listeningN1Play: document.getElementById("listeningN1PlayScreen"),
    listeningPlay: document.getElementById("listeningPlayScreen"),
    listeningResult: document.getElementById("listeningResultScreen"),
    listeningReport: document.getElementById("listeningReportScreen")
  };

  function showMainView(name) {
    Object.keys(mainScreens).forEach(k => {
      if(mainScreens[k]) mainScreens[k].classList.toggle("active", k === name);
    });
    const homeBtn = document.getElementById("toggleHomeBtn");
    if (homeBtn) homeBtn.style.display = name === "home" ? "none" : "flex";
  }

  // Clasifica un % de dominio en la escala good/warn/bad (verde/naranja/rojo).
  function pctTier(pct) {
    if (pct >= 80) return "good";
    if (pct >= 60) return "warn";
    return "bad";
  }

  // Modal con una gráfica de barras (CSS puro, sin librerías) del
  // historial de % de UNA regla, leído del backend. Si nunca se ha usado
  // registros en la tabla todavía no hay nada que graficar, y si no
  // hay conexión se avisa sin romper nada.
  async function showRuleStatsModal(reglaId) {
    const regla = findRegla(reglaId);
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>📊 ${window._escHTML(regla ? regla.regla : '')}</h3>
          <button class="menu-modal-close" id="statsModalClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">Así se ha movido tu dominio de esta regla a lo largo del tiempo.</p>
        <div id="statsChartContainer" class="stats-chart-container">
          <p class="sub-fun">Cargando historial...</p>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('#statsModalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const container = modal.querySelector('#statsChartContainer');
    try {
      const history = await fetchPercentageHistory(reglaId);
      if (!history.length) {
        container.innerHTML = `<p class="sub-fun">Todavía no hay historial guardado para esta regla. Se va llenando con los resultados que se registran en la tabla.</p>`;
        return;
      }
      const points = history.slice(-10);
      container.innerHTML = `
        <div class="stats-bar-chart">
          ${points.map((h) => `
            <div class="stats-bar-col">
              <span class="stats-bar-value">${h.porcentaje}%</span>
              <div class="stats-bar" style="height:${Math.max(4, Number(h.porcentaje) || 0)}%"></div>
              <span class="stats-bar-date">${formatShortDate(h.fecha)}</span>
            </div>
          `).join('')}
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<p class="sub-fun">⚠️ No se pudo cargar el historial (¿sin conexión?). Intenta de nuevo más tarde.</p>`;
    }
  }

  // Inicio: Juego (🎮) y Listening (🎧) solo existen en inglés. El ❓ vive
  // dentro de Reels (botón flotante, solo inglés).
  function updateHelpBtnVisibility() {
    const isEnglish = getTargetLanguage() === "en";
    ["homeJuegoBtn", "homeListeningBtn", "homeAzureBtn"].forEach((id) => { const b = document.getElementById(id); if (b) b.hidden = !isEnglish; });
    const tag = document.getElementById("homeLangTag");
    if (tag) tag.textContent = getTargetLangMeta().flag + " Practicando " + getTargetLangMeta().labelLower;
  }

  // ==================== AZURE (curso AI-901 en azure/) ====================
  // Es su propia app (con su build.py, su guardado y su service worker) y se abre
  // tal cual en un iframe a pantalla completa. Su botón ✕ avisa con postMessage.
  function openAzure() {
    const overlay = document.getElementById("azureOverlay");
    const frame = document.getElementById("azureFrame");
    if (!overlay || !frame) return;
    overlay.hidden = false;
    frame.src = "./azure/index.html?embed=1";
    try { document.documentElement.requestFullscreen?.().catch(() => {}); } catch (e) { /* nada */ }
  }

  function closeAzure() {
    const overlay = document.getElementById("azureOverlay");
    const frame = document.getElementById("azureFrame");
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (frame) frame.src = "about:blank";
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* nada */ } }
  }

  function onAzureMessage(ev) {
    const d = ev.data;
    if (!d || d.azure !== true || ev.origin !== window.location.origin) return;
    if (d.tipo === "salir") closeAzure();
  }

  // ==================== AVENTURA (juego de conversaciones por audio) ====================
  // Corre en un iframe de pantalla completa (aventura/jugar.html): su propio documento, CSS y
  // localStorage ("aventura_v1"), asi no choca con nada de la app. Solo se juega en horizontal:
  // al abrir se pide pantalla completa y se intenta bloquear la orientacion horizontal (Android);
  // si el sistema no deja, el juego muestra "gira el celular". Al salir se libera la orientacion.
  async function openAventura() {
    const overlay = document.getElementById("aventuraOverlay");
    const frame = document.getElementById("aventuraFrame");
    if (!overlay || !frame) return;
    overlay.hidden = false;
    frame.src = "./aventura/jugar.html?embed=1";   // abre la lista de historias
    try { await overlay.requestFullscreen?.(); } catch (e) { /* no soportado (iOS): sigue sin pantalla completa */ }
    try { await screen.orientation?.lock?.("landscape"); } catch (e) { /* no soportado: el juego pedira girar */ }
  }

  function closeAventura(fromFullscreenEvent) {
    const overlay = document.getElementById("aventuraOverlay");
    const frame = document.getElementById("aventuraFrame");
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    if (frame) frame.src = "about:blank";   // corta audio y musica
    try { screen.orientation?.unlock?.(); } catch (e) { /* nada */ }
    if (!fromFullscreenEvent && document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { /* nada */ } }
  }

  function onAventuraMessage(ev) {
    const d = ev.data;
    if (!d || d.aventura !== true || ev.origin !== window.location.origin) return;
    if (d.tipo === "salir") closeAventura(false);
  }

  // Resultados de la Aventura de HOY (la partida guarda su historial en "aventura_v1").
  // Se agregan al informe como una seccion mas, con reglaId, para calificar igual que lo demas.
  function buildAventuraReportLines() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem("aventura_v1") || "null"); } catch (e) { db = null; }
    if (!db) return [];
    const hoy = new Date().toLocaleDateString("en-CA");   // AAAA-MM-DD en hora local
    const lines = [];
    Object.keys(db).forEach((mid) => {
      const m = db[mid];
      if (!m || !Array.isArray(m.historial)) return;
      m.historial.filter((r) => r.fecha && new Date(r.fecha).toLocaleDateString("en-CA") === hoy).forEach((r, i) => {
        lines.push("🎮 " + mid + " — intento " + (i + 1) + ": " + "⭐".repeat(r.estrellas || 0) + " · errores " + r.errores + " · turnos " + r.turnos);
        const ids = Object.keys(r.reglas || {});
        if (ids.length) {
          lines.push("  Reglas practicadas (comprensión auditiva):");
          ids.forEach((id) => {
            const x = r.reglas[id];
            const regla = findRegla(Number(id));
            const pct = x.turnos ? Math.round((x.limpios / x.turnos) * 100) : 0;
            lines.push("  - Regla " + id + " · " + (regla ? regla.regla : "?") + " · " + x.limpios + "/" + x.turnos + " sin error (" + pct + ")");
          });
        }
        (r.repaso || []).forEach((q) => lines.push("  ✗ " + q.texto + (q.reglaIds && q.reglaIds.length ? "  [regla " + q.reglaIds.join(", ") + "]" : "") + " · errores " + q.errores + (q.texto_revelado ? " · vio el texto" : "")));
        lines.push("");
      });
    });
    return lines;
  }

  function showHelpModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>❓ Chuleta de gramática</h3>
          <button class="menu-modal-close" id="helpModalClose" aria-label="Cerrar">✕</button>
        </div>
        <div class="help-modal-content">

          <div class="help-section">
            <h4>1. Modales de probabilidad</h4>
            <div class="help-sub">(de lo menos a lo más cierto)</div>
            <ul class="help-list">
              <li><b>Might</b> <span class="help-arrow">→</span> podría / quizás <span class="help-pct">(~0% certeza)</span></li>
              <li><b>May</b> <span class="help-arrow">→</span> puede que / podría <span class="help-pct">(~30% certeza)</span></li>
              <li><b>Must</b> <span class="help-arrow">→</span> debe de / seguramente <span class="help-pct">(~60% certeza)</span></li>
              <li><b>Can't</b> <span class="help-arrow">→</span> no puede ser / seguramente no</li>
              <li><b>Could</b> <span class="help-arrow">→</span> podría <span class="help-pct">(~100% certeza)</span></li>
            </ul>
          </div>

          <div class="help-section">
            <h4>2. Expresiones de futuro e hipotéticas</h4>
            <ul class="help-list">
              <li><b>GOING TO</b> <span class="help-arrow">→</span> intención / plan previo o algo que ya se ve venir.</li>
              <li><b>WILL</b> <span class="help-arrow">→</span> decisión espontánea, promesa, oferta o predicción.</li>
              <li><b>WOULD</b> <span class="help-arrow">→</span> situación hipotética ("haría / sería / tendría"), normalmente después de <b>if + pasado</b>.</li>
            </ul>
          </div>

          <div class="help-section">
            <h4>3. Uso y significado de verbos modales</h4>
            <ul class="help-list">
              <li><b>MUST</b> <span class="help-arrow">→</span> debo / debemos (obligación, necesidad).</li>
              <li><b>SHOULD</b> <span class="help-arrow">→</span> debería / deberían (consejo, recomendación).</li>
              <li><b>CAN</b> <span class="help-arrow">→</span> poder / capacidad real.</li>
              <li><b>COULD</b> <span class="help-arrow">→</span> podría / podía.</li>
              <li><b>WILL</b> <span class="help-arrow">→</span> futuro real.</li>
              <li><b>WOULD</b> <span class="help-arrow">→</span> hipotético / cortés.</li>
              <li><b>USED TO</b> <span class="help-arrow">→</span> solía / hábito pasado.</li>
            </ul>
          </div>

          <div class="help-section">
            <h4>4. Cuantificadores: contables vs. no contables</h4>
            <table class="help-table">
              <tr><th>Palabra</th><th>Se usa con</th><th>Significa</th></tr>
              <tr><td><b>few</b></td><td>cosas contables</td><td>pocos</td></tr>
              <tr><td><b>fewer</b></td><td>cosas contables</td><td>menos</td></tr>
              <tr><td><b>little</b></td><td>cosas no contables</td><td>poco</td></tr>
              <tr><td><b>less</b></td><td>cosas no contables</td><td>menos</td></tr>
            </table>
          </div>

          <div class="help-section">
            <h4>5. Duda común: ¿GONE o LEFT?</h4>
            <ul class="help-list">
              <li>"Se fue a Bogotá" <span class="help-arrow">→</span> ¿A? <span class="help-arrow">→</span> <b>GONE</b></li>
              <li>"Salió de Bogotá" <span class="help-arrow">→</span> ¿DE? <span class="help-arrow">→</span> <b>LEFT</b></li>
              <li>"Se fue a trabajar" <span class="help-arrow">→</span> ¿A? <span class="help-arrow">→</span> <b>GONE</b></li>
              <li>"Abandonó la oficina" <i>(no lleva A)</i> <span class="help-arrow">→</span> <b>LEFT</b></li>
              <li>"Se ha marchado" <i>(no lleva A ni DE)</i> <span class="help-arrow">→</span> <b>LEFT</b></li>
              <li>"Partió hacia Bogotá" <i>(excepción 1)</i> <span class="help-arrow">→</span> <b>LEFT FOR</b></li>
              <li>"Desaparecieron" <i>(excepción 2)</i> <span class="help-arrow">→</span> <b>GONE</b></li>
              <li>"Se fue de vacaciones" <i>(expresión fija)</i> <span class="help-arrow">→</span> <b>GONE ON VACATION</b></li>
            </ul>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#helpModalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  }

  // ---- Análisis de diferencia palabra a palabra ----
  // Separa puntuación final (.,!?;:) de una palabra para poder dejarla fuera
  // del hueco de "completar" (así el hueco pide solo la palabra, no la
  // puntuación pegada al final).
  function splitTrailingPunct(word) {
    const m = String(word || "").match(/^(.*?)([.,!?;:]*)$/);
    return { core: m ? m[1] : word, punct: m ? m[2] : "" };
  }

  // Compara la respuesta correcta contra lo que escribió el usuario,
  // palabra por palabra. Solo se considera un "error de 1-2 palabras" (near
  // miss) cuando ambas frases tienen la MISMA cantidad de palabras — si
  // sobran o faltan palabras, el error es estructural y no un simple
  // "me equivoqué en una palabra", así que se trata como error mayor.
  function analyzeWordDiff(correctText, userAnswer) {
    const correctWords = String(correctText || "").trim().split(/\s+/).filter(Boolean);
    const userWords = String(userAnswer || "").trim().split(/\s+/).filter(Boolean);
    if (!correctWords.length || correctWords.length !== userWords.length) {
      return { sameLength: false, diffIndexes: [], correctWords, userWords };
    }
    const diffIndexes = [];
    correctWords.forEach((w, i) => {
      if (normalizeWord(w) !== normalizeWord(userWords[i])) diffIndexes.push(i);
    });
    return { sameLength: true, diffIndexes, correctWords, userWords };
  }

  // Construye un ejercicio de tipo "completar" a partir de la frase correcta
  // y los índices de las 1-2 palabras que el usuario falló, dejando esas
  // palabras como huecos ("_____") y el resto de la frase intacta.
  function buildCompletarFromDiff(spanishPrompt, correctWords, diffIndexes) {
    const options = [];
    const sentenceWords = correctWords.map((w, i) => {
      if (!diffIndexes.includes(i)) return w;
      const { core, punct } = splitTrailingPunct(w);
      options.push(core || w);
      return "___" + punct;
    });
    return {
      type: "completar",
      spanishWord: spanishPrompt || "✏️ Completa la(s) palabra(s) correcta(s):",
      englishSentence: sentenceWords.join(" "),
      options
    };
  }

  // Convierte un ejercicio fallado (de un nodo principal) en la forma en la
  // que debe aparecer dentro del nodo de repaso.
  //
  //  - Si el error del usuario es de 1 o 2 palabras (misma cantidad de
  //    palabras que la frase correcta, pero 1-2 distintas), se convierte en
  //    un ejercicio de "completar" con esas palabras como huecos.
  //  - En cualquier otro caso, Traducción y Corregir se convierten en
  //    ejercicios de tipo "corregir":
  //     · Traducción: "spanishWord/spanishWords" pasa a mostrarse arriba
  //       como "spanishPhrase" (🇪🇸 Frase en español), "englishWord/
  //       englishWords" pasa a ser "fraseCorrecta", y la tarjeta de error
  //       ("fraseConError") muestra lo que el propio usuario escribió mal.
  //     · Corregir: se conserva igual, pero "fraseConError" se reemplaza
  //       por el error que el propio usuario escribió al fallar.
  //    En ambos casos se inicia un historial "wrongAttempts" (máx. 3) con
  //    los intentos fallidos del usuario, para mostrarlos en la tarjeta
  //    rotativa de errores si vuelve a fallar en el nodo de repaso.
  //  - El resto de tipos (completar, seleccionar, dictado) entran sin
  //    cambios.
  function buildRepasoExercise(ex, userAnswer) {
    if (!ex.__repasoId) {
      AppState._repasoSeq = (AppState._repasoSeq || 0) + 1;
      ex.__repasoId = "rp" + AppState._repasoSeq;
    }
    const cleanAnswer = (userAnswer && userAnswer.trim()) ? userAnswer.trim() : "";

    let converted;
    if (ex.type === "traduccion" || ex.type === "corregir") {
      const spanishPrompt = ex.type === "traduccion"
        ? (ex.spanishWord || ex.spanishWords || "")
        : (ex.spanishPhrase || "");
      const correctText = ex.type === "traduccion"
        ? (ex.englishWord || ex.englishWords || "")
        : (ex.fraseCorrecta || "");

      const diff = cleanAnswer ? analyzeWordDiff(correctText, cleanAnswer) : { sameLength: false, diffIndexes: [] };
      const isNearMiss = diff.sameLength && diff.diffIndexes.length >= 1 && diff.diffIndexes.length <= 2;

      // Si lo respondió bien (p. ej. lo mandó a "Repasar luego" con 100%) no hay
      // ningún "error" que mostrar: vuelve tal cual, como ejercicio del mismo tipo.
      const stripP = (s) => normalizeContractions(String(s || "")).toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim();
      const wasCorrect = cleanAnswer && stripP(cleanAnswer) === stripP(correctText);

      if (wasCorrect) {
        converted = { ...ex };
      } else if (isNearMiss) {
        converted = buildCompletarFromDiff(spanishPrompt, diff.correctWords, diff.diffIndexes);
      } else {
        // Nunca cae de vuelta al texto en español: si por algún motivo no
        // hay respuesta del usuario registrada, se usa un texto neutro que
        // no se pueda confundir con la frase en español.
        const errorText = cleanAnswer || "(respuesta no registrada)";
        converted = {
          type: "corregir",
          spanishPhrase: spanishPrompt,
          fraseConError: errorText,
          fraseCorrecta: correctText,
          wrongAttempts: cleanAnswer ? [cleanAnswer] : []
        };
      }
    } else {
      converted = { ...ex };
    }
    converted.__repasoId = ex.__repasoId;
    converted.__originType = ex.type;
    // La marca de [Repasar] solo aplica a nodos principales; en la pool no.
    delete converted.__requeue;
    return converted;
  }

  // Marca cada entrada del informe según si sucedió dentro del nodo de repaso
  // (repaso) o en un nodo principal (para agruparlas por separado), y le
  // adjunta las reglaIds del ejercicio de origen (para agrupar el informe
  // por regla gramatical). exercise es opcional (el import manual clásico
  // no trae reglaIds, y la entrada simplemente cae en "Sin regla asociada").
  function tagEntryMeta(entry, exercise) {
    const node = AppState.nodes[AppState.activeNodeIndex];
    entry.origin = (node && node.type === "repaso") ? "repaso" : "main";
    entry.reglaIds = (exercise && exercise.reglaIds) || [];
    return entry;
  }

  // Etiquetas del tipo de ejercicio de origen, para que la entrada "manual"
  // del informe deje constancia de qué tipo era el ejercicio original.
  const ORIGIN_TYPE_LABELS = { traduccion: "Traducción", completar: "Completar", corregir: "Corregir", dictado: "Dictado" };

  // Cuando el usuario manda un ejercicio a [Repasar] (fin del nodo actual),
  // queda registrado en el informe como una entrada de tipo "corregir" —
  // igual que los ejercicios que caen al repaso por fallar — para que se
  // agrupe junto a las demás correcciones. Se marca con manualReview para
  // distinguirla en el texto del informe de una corrección "de verdad".
  function buildManualCorreccionEntry(exercise, userAnswer, duda) {
    const originType = exercise.type;
    const spanishPrompt = originType === "traduccion"
      ? (exercise.spanishWord || exercise.spanishWords || "")
      : originType === "corregir"
      ? (exercise.spanishPhrase || "")
      : originType === "completar"
      ? (exercise.spanishWord || "")
      : "";
    const correctText = originType === "traduccion"
      ? (exercise.englishWord || exercise.englishWords || "")
      : originType === "corregir"
      ? (exercise.fraseCorrecta || "")
      : originType === "completar"
      ? fillCompletarBlanks(exercise.englishSentence, exercise.options)
      : (exercise.text || exercise.phrase || exercise.original || "");
    const cleanAnswer = (userAnswer && userAnswer.trim()) ? userAnswer.trim() : "(respuesta no registrada)";
    return {
      type: "corregir",
      original: cleanAnswer,
      expected: correctText,
      spanishPhrase: spanishPrompt,
      userAnswer: userAnswer,
      duda: duda || '',
      manualReview: true,
      originType,
    };
  }

  // Formatea una sola entrada del informe (usado tanto en las secciones
  // por tipo como en la sección de repaso).
  function formatReportEntryLines(counter, entry) {
    const lines = [];
    lines.push(counter + ". " + (entry.original || entry.messageText || "").substring(0, 80));
    if (entry.type === "traduccion") { 
      lines.push("   ✅ Esperado: " + entry.expected); 
      lines.push("   ✏️ Usuario: " + entry.userAnswer); 
    }
    else if (entry.type === "completar") { 
      lines.push("   ✅ Frase: " + entry.expected); 
      lines.push("   ✏️ Respuestas: " + (entry.userAnswers || []).join(", ")); 
    }
    else if (entry.type === "corregir") { 
      if (entry.manualReview) {
        lines.push("   🔁 Marcado para corrección (antes: " + (ORIGIN_TYPE_LABELS[entry.originType] || entry.originType) + ")");
        lines.push("   ✏️ Tu respuesta: " + entry.original);
        lines.push("   ✅ Correcto: " + entry.expected);
      } else {
        lines.push("   ❌ Error: " + entry.original); 
        lines.push("   ✅ Correcto: " + entry.expected); 
        lines.push("   ✏️ Usuario: " + entry.userAnswer); 
      }
    }
    else if (entry.type === "dictado") { 
      lines.push("   🎧 Correcto: " + entry.original); 
      lines.push("   ✏️ Usuario: " + entry.userAnswer); 
    }
    if (entry.duda) lines.push("   💭 Consulta: " + entry.duda);
    lines.push("");
    return lines;
  }

  // Nombre de las reglas de una entrada del informe, ya resuelto contra
  // AppRules (por si cambió de dispositivo, el
  // NOMBRE de la regla siempre se toma de la lista vigente).
  function reglaGroupLabel(reglaIds) {
    if (!reglaIds || !reglaIds.length) return "📎 Sin regla gramatical asociada";
    const nombres = reglaIds.map((id) => {
      const r = findRegla(id);
      return r ? r.regla : ("Regla #" + id);
    });
    return "📚 " + nombres.join(" + ");
  }

  const REPORT_TYPE_NAMES = { traduccion: "TRADUCCIÓN", completar: "COMPLETAR", seleccionar: "EMPAREJAR", corregir: "CORREGIR" };

  // Agrupa un set de entradas (ya sin dictado) por regla gramatical y, DENTRO
  // de cada regla, por tipo de ejercicio (traducción/completar/corregir/
  // emparejar). Devuelve las líneas ya formateadas y actualiza el contador.
  function renderEntriesByRegla(entries, lines, counterRef) {
    const byRegla = {};
    const order = [];
    entries.forEach((entry) => {
      const label = reglaGroupLabel(entry.reglaIds);
      if (!byRegla[label]) { byRegla[label] = {}; order.push(label); }
      if (!byRegla[label][entry.type]) byRegla[label][entry.type] = [];
      byRegla[label][entry.type].push(entry);
    });

    order.forEach((label) => {
      lines.push(label);
      lines.push("-".repeat(30));
      Object.keys(REPORT_TYPE_NAMES).forEach((type) => {
        const list = byRegla[label][type];
        if (!list || !list.length) return;
        lines.push("  📌 " + REPORT_TYPE_NAMES[type] + " (" + list.length + " ejercicios)");
        list.forEach((entry) => {
          counterRef.n++;
          formatReportEntryLines(counterRef.n, entry).forEach((l) => lines.push(l ? ("  " + l) : l));
        });
      });
      lines.push("");
    });
  }

  function burstConfetti() {
    const colors = ["#58cc02", "#1cb0f6", "#ffc800", "#ce82ff", "#ff86d0"];
    for(let i = 0; i < 40; i++) {
      const c = document.createElement("div"); c.classList.add("confetti");
      c.style.left = Math.random() * 100 + "vw"; c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      c.style.width = (5 + Math.random() * 8) + "px"; c.style.height = (8 + Math.random() * 10) + "px";
      c.style.animationDuration = (1 + Math.random() * 2) + "s";
      document.body.appendChild(c); setTimeout(() => c.remove(), 3000);
    }
  }

  function login(username) {
    if(!username || !username.trim()) { toast("Por favor ingresa un nombre"); return false; }
    username = username.trim().toLowerCase();
    currentUser = username;
    localStorage.setItem("__LS_KEY___user", username);
    document.getElementById("welcomeUsername").innerText = username;
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("mainScreen").classList.add("active");
    showMainView("home");
    updateHelpBtnVisibility();
    toast("✨ Bienvenido " + username + "!");
    return true;
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem("__LS_KEY___user");
    document.getElementById("loginScreen").classList.add("active");
    document.getElementById("mainScreen").classList.remove("active");
    toast("👋 Sesion cerrada");
  }

  // Borra el banco, la reserva, el informe y el avance de historias del idioma
  // activo. Los porcentajes (vienen de la tabla) no se tocan.
  function resetAll() {
    if (confirm("¿Borrar todo el progreso de " + getTargetLangMeta().labelLower + "? (banco, reserva, informe e historias; los porcentajes se conservan)")) {
      rlBorrarTodo();
      showMainView("home");
      toast("🗑️ Todo borrado");
    }
  }

  // El header quedó reducido a una barra angosta (título + botón ☰). Todo lo
  // que antes vivía ahí (usuario, salir, mapa, copiar informe, nueva tanda,
  // borrar todo) ahora vive en este modal bajo demanda, para no robarle
  // altura permanente a la pantalla.
  // Vuelve a renderizar lo que esté visible en pantalla en este momento,
  // para que las etiquetas/banderas del idioma objetivo se actualicen sin
  // necesidad de recargar ni perder el progreso.
  // Al cambiar el idioma objetivo (inglés <-> italiano) desde el menú, la
  // "sección de estudio" completa cambia de base de datos: reglas
  // gramaticales, banco de ejercicios, lecciones de información Y el
  // progreso guardado (nodos/avance/repaso) pasan a ser los de ese idioma
  // — currentStorageKey()/rulesStorageKey() ya resuelven distinto en
  // cuanto getTargetLanguage() cambia, así que solo hace falta releer todo
  // desde esas llaves (o arrancar en blanco si el usuario nunca ha
  // estudiado ese idioma todavía) y mandarlo a la pantalla correcta.
  function switchStudyDataToCurrentLanguage() {
    AppRules = loadGrammarRules();
    rlCambioDeIdioma();
    showMainView("home");
    updateHelpBtnVisibility();
  }

  function showMenuModal() {
    const existing = document.querySelector('.sidebar-overlay, .modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "sidebar-overlay";
    overlay.innerHTML = `
      <div class="sidebar-panel">
        <div class="sidebar-panel-header">
          <h3>☰ Menú</h3>
          <button class="menu-modal-close" id="menuModalClose" aria-label="Cerrar">✕</button>
        </div>
        <div class="menu-modal-user">
          <span class="user-name">${window._escHTML(currentUser || '')}</span>
          <button id="menuLogoutBtn" class="logout-btn">Salir</button>
        </div>
        <div class="sub-fun" style="text-align:center;margin:8px 0 14px;">__VERSION__</div>
        <div class="sidebar-menu-list">
          <button class="fun-btn" id="menuToggleLangBtn">${getTargetLangMeta().flag} Idioma: ${getTargetLangMeta().label}</button>
          <button class="fun-btn" id="menuVoicePickerBtn">🎙️ Elegir voz</button>
          <button class="fun-btn" id="menuAddJsonBtn">📥 Agregar ejercicios (JSON)</button>
          <button class="fun-btn" id="menuHistoriaBtn">📜 Copiar historia</button>
          <button class="fun-btn danger-btn" id="menuResetAllBtn">🗑️ Borrar todo</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const modal = overlay; // alias: el resto del código ya usa "modal"

    const close = () => overlay.remove();
    modal.querySelector('#menuModalClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    modal.querySelector('#menuLogoutBtn').addEventListener('click', () => { close(); logout(); });
    modal.querySelector('#menuToggleLangBtn').addEventListener('click', () => {
      toggleTargetLanguage();
      switchStudyDataToCurrentLanguage();
      close();
      toast(getTargetLangMeta().flag + " Ahora practicando " + getTargetLangMeta().labelLower);
    });
    modal.querySelector('#menuVoicePickerBtn').addEventListener('click', () => { close(); showVoicePickerModal(); });
    modal.querySelector('#menuAddJsonBtn').addEventListener('click', () => { close(); rlModalAgregarJSON(); });
    modal.querySelector('#menuHistoriaBtn').addEventListener('click', () => { close(); rlCopiarHistoria(); });
    modal.querySelector('#menuResetAllBtn').addEventListener('click', () => { close(); resetAll(); });
  }

  // Deja al usuario escuchar ("▶️ Probar") y elegir a mano UNA voz fija
  // para el idioma objetivo actual. Esa elección queda guardada y a partir
  // de ahí gana siempre por sobre la selección automática de
  // dictado.js/seleccionar.js/traduccion.js/corregir.js — es la única
  // forma de garantizar al 100% que nunca suene otra voz distinta a la
  // elegida, sin importar cuántas voces reporte el dispositivo.
  function showVoicePickerModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();
    window.speechSynthesis?.cancel();

    const langMeta = getTargetLangMeta();
    const voices = listVoicesForLanguage(langMeta.code);
    const currentPreferred = getPreferredVoiceURI(langMeta.code);
    const sampleText = langMeta.code === "it"
      ? "Ciao, come stai? Questo è un esempio di voce."
      : "Hello, how are you? This is a voice sample.";

    const rowStyle = "display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:10px;margin-bottom:6px;background:#151515;";
    const rowActiveStyle = rowStyle + "border:1px solid #58cc02;";

    const autoRow = `
      <div style="${!currentPreferred ? rowActiveStyle : rowStyle}">
        <span>🔀 Automática (recomendado por la app)</span>
        <button type="button" class="fun-btn voice-select-btn" data-voice-uri="" style="white-space:nowrap;">Usar esta</button>
      </div>
    `;
    const voiceRows = voices.map((v) => `
      <div style="${currentPreferred === v.voiceURI ? rowActiveStyle : rowStyle}">
        <span style="overflow:hidden;text-overflow:ellipsis;">${window._escHTML(v.name)} <small style="color:#94a3b8;">(${window._escHTML(v.lang)})</small></span>
        <span style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="fun-btn voice-preview-btn" data-voice-uri="${window._escHTML(v.voiceURI)}">▶️</button>
          <button type="button" class="fun-btn voice-select-btn" data-voice-uri="${window._escHTML(v.voiceURI)}" style="white-space:nowrap;">Usar esta</button>
        </span>
      </div>
    `).join("");

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>🎙️ Voz de ${langMeta.label}</h3>
          <button class="menu-modal-close" id="voicePickerClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:12px;">
          Elige la voz que se usará SIEMPRE para ${langMeta.labelLower} en toda la app.
          Toca ▶️ para escucharla antes de elegir.
        </p>
        ${voices.length === 0 ? `<p style="color:#f59e0b;margin-bottom:10px;">No se encontró ninguna voz de ${langMeta.labelLower} instalada en este dispositivo/navegador todavía. Si acabas de abrir la app, espera unos segundos y vuelve a intentar.</p>` : ""}
        <div>${autoRow}${voiceRows}</div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => { window.speechSynthesis?.cancel(); modal.remove(); };
    modal.querySelector("#voicePickerClose").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    modal.querySelectorAll(".voice-preview-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uri = btn.dataset.voiceUri;
        const voice = voices.find((v) => v.voiceURI === uri);
        if (!voice) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(sampleText);
        u.lang = langMeta.ttsLang;
        u.voice = voice;
        window.speechSynthesis.speak(u);
      });
    });

    modal.querySelectorAll(".voice-select-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const uri = btn.dataset.voiceUri || null;
        setPreferredVoiceURI(langMeta.code, uri);
        close();
        toast(uri ? "🎙️ Voz guardada — se usará siempre" : "🔀 Volviendo a selección automática");
      });
    });
  }

  function init() {
    const savedUser = localStorage.getItem("__LS_KEY___user");
    if(savedUser) login(savedUser);
    document.getElementById("loginBtn")?.addEventListener("click", () => login(document.getElementById("usernameInput").value));
    document.getElementById("usernameInput")?.addEventListener("keypress", (e) => { if(e.key === "Enter") login(document.getElementById("usernameInput").value); });
    document.getElementById("toggleMenuBtn")?.addEventListener("click", showMenuModal);
    document.getElementById("toggleHomeBtn")?.addEventListener("click", () => showMainView("home"));
    document.getElementById("homeReelsBtn")?.addEventListener("click", openReels);
    document.getElementById("homeJuegoBtn")?.addEventListener("click", openAventura);
    document.getElementById("homeAzureBtn")?.addEventListener("click", openAzure);
    window.addEventListener("message", onAzureMessage);
    wireReels();
    window.addEventListener("message", onAventuraMessage);
    document.addEventListener("fullscreenchange", () => {
      // si el usuario sale de pantalla completa con el gesto del sistema, se cierra el juego
      if (!document.fullscreenElement && !document.getElementById("aventuraOverlay")?.hidden) closeAventura(true);
    });
    document.getElementById("homeListeningBtn")?.addEventListener("click", () => {
      renderListeningHome();
      showMainView("listeningHome");
    });
    document.getElementById("l0ResultBackBtn")?.addEventListener("click", () => {
      renderListeningHome();
      showMainView("listeningHome");
    });
    document.getElementById("l0ResultRetryBtn")?.addEventListener("click", () => {
      if (typeof ListeningPlaySession !== "undefined" && ListeningPlaySession.bloque) {
        startListeningBlock(ListeningPlaySession.bloque);
      } else {
        renderListeningHome();
        showMainView("listeningHome");
      }
    });
    document.getElementById("l0PlayExitBtn")?.addEventListener("click", () => {
      renderListeningHome();
      showMainView("listeningHome");
    });
    document.getElementById("n1PlayExitBtn")?.addEventListener("click", n1SalirDelJuego);
    document.getElementById("listeningReportBtn")?.addEventListener("click", openListeningReportScreen);
    document.getElementById("listeningReportBackBtn")?.addEventListener("click", () => {
      renderListeningHome();
      showMainView("listeningHome");
    });
  }
  
  init();
'''


AZURE_DIR = "azure"


def build_azure():
    """El curso de Azure es su propia app: se construye con SU build.py dentro de azure/."""
    if not os.path.exists(os.path.join(AZURE_DIR, "build.py")):
        print(f"⚠️  No encontrado: {AZURE_DIR}/build.py (el botón Azure no tendrá contenido)")
        return
    import subprocess
    print(f"☁️  Construyendo {AZURE_DIR}/ con su propio build.py...")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    r = subprocess.run([sys.executable, "build.py"], cwd=AZURE_DIR, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode == 0:
        print(f"  ✅ {AZURE_DIR}/index.html generado")
    else:
        print(f"  ❌ El build de {AZURE_DIR}/ falló (se deja el index.html anterior):")
        print("     " + "\n     ".join((r.stdout + r.stderr).strip().splitlines()[-15:]))


def build_html():
    print("📂 Leyendo archivos...")
    styles = read_file('styles/main.css')
    styles += "\n\n" + read_file(REELS_STYLES_FILE)
    if os.path.exists(LISTENING_STYLES_FILE):
        styles += "\n\n" + read_file(LISTENING_STYLES_FILE)
    else:
        print(f"⚠️  No encontrado: {LISTENING_STYLES_FILE} (tema de Listening quedará sin estilos)")
    map_js = read_file('mapa/map.js')

    listening_exercises = load_listening_exercises()
    print(f"  ✅ [listening] {len(listening_exercises)} ejercicios desde {LISTENING_DATA_FILE}")

    nivel1_bank = load_nivel1_bank()

    listening_modules = {}
    for filepath, marker in LISTENING_EXERCISE_FILES.items():
        content = read_file(filepath)
        listening_modules[marker] = content
        print(f"  ✅ {filepath} -> {marker} ({len(content):,} bytes)")

    grammar_rules_by_lang = {}
    study_exercises_by_lang = {}
    informacion_por_regla_by_lang = {}
    for lang in DATA_LANGUAGES:
        grammar_rules_by_lang[lang] = load_grammar_rules(lang)
        study_exercises_by_lang[lang] = load_study_exercises(lang)
        informacion_por_regla_by_lang[lang] = load_informacion_por_regla(lang)
        total_lecciones = sum(len(v) for v in informacion_por_regla_by_lang[lang].values())
        print(f"  ✅ [{lang}] {len(grammar_rules_by_lang[lang])} reglas gramaticales ({grammar_rules_file(lang)})")
        print(f"  ✅ [{lang}] {len(study_exercises_by_lang[lang])} ejercicios combinados desde {study_exercises_dir(lang)}/")
        print(f"  ✅ [{lang}] {total_lecciones} lección(es) de información en {len(informacion_por_regla_by_lang[lang])} regla(s) ({informacion_reglas_file(lang)})")
    
    exercise_modules = {}
    for filepath, marker in EXERCISE_FILES.items():
        content = read_file(filepath)
        exercise_modules[marker] = content
        print(f"  ✅ {filepath} -> {marker} ({len(content):,} bytes)")
    
    template = get_html_template()
    html = template.replace('__STYLES__', styles)
    html = html.replace('__VERSION__', VERSION)
    html = html.replace('__IMPORT_FIELDS__', build_import_fields())
    html = html.replace('__MAP_JS__', map_js)
    
    for marker, content in exercise_modules.items():
        html = html.replace(marker, content)

    for marker, content in listening_modules.items():
        html = html.replace(marker, content)

    for filepath, marker in REELS_FILES.items():
        content = read_file(filepath)
        html = html.replace(marker, content)
        print(f"  ✅ {filepath} -> {marker} ({len(content):,} bytes)")

    historias_by_lang = {lang: load_historias(lang) for lang in DATA_LANGUAGES}
    for lang, hs in historias_by_lang.items():
        print(f"  ✅ [{lang}] {len(hs)} historia(s) en {os.path.join(HISTORIAS_DIR, lang)}/")
    html = html.replace('__HISTORIAS_JSON__', json.dumps(historias_by_lang, ensure_ascii=False, separators=(",", ":")))

    html = html.replace('__NIVEL0_EXERCISES_JSON__', json.dumps(listening_exercises, ensure_ascii=False))
    html = html.replace('__NIVEL1_BANK_JSON__', json.dumps(nivel1_bank, ensure_ascii=False, separators=(",", ":")))

    main_logic = get_main_logic()
    main_logic = main_logic.replace('__LS_KEY__', LS_KEY)
    main_logic = main_logic.replace('__VERSION__', VERSION)
    main_logic = main_logic.replace('__LOAD_DATA_FIELDS__', build_load_data_fields())
    main_logic = main_logic.replace('__VALIDATION_ARGS__', build_validation_args())
    main_logic = main_logic.replace('__CREATE_NODE_ARGS__', build_create_node_args())
    main_logic = main_logic.replace('__GRAMMAR_RULES_JSON__', json.dumps(grammar_rules_by_lang, ensure_ascii=False))
    main_logic = main_logic.replace('__STUDY_EXERCISES_JSON__', json.dumps(study_exercises_by_lang, ensure_ascii=False))
    main_logic = main_logic.replace('__INFORMACION_POR_REGLA_JSON__', json.dumps(informacion_por_regla_by_lang, ensure_ascii=False))
    main_logic = main_logic.replace('__IMPORT_EXAMPLE_JSON__', json.dumps(build_import_example_json(), ensure_ascii=False))
    html = html.replace('__MAIN_LOGIC__', main_logic)
    
    return html


def main():
    print("=" * 60)
    print("🔨 English Trainer Builder (PWA)")
    print(f"📦 Version: {VERSION}")
    print("=" * 60)
    
    required_files = ['styles/main.css', 'mapa/map.js', REELS_STYLES_FILE] + list(EXERCISE_FILES.keys()) + list(REELS_FILES.keys())
    missing = [f for f in required_files if not os.path.exists(f)]
    if missing:
        print("❌ Faltan archivos:")
        for f in missing: print(f"   - {f}")
        sys.exit(1)
    
    print(f"✅ {len(required_files)} archivos encontrados\n")
    print("📱 Creando archivos PWA...")
    create_manifest()
    create_service_worker()
    print()
    
    build_azure()
    print()

    html = build_html()
    output_path = 'index.html'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html)
    
    file_size = os.path.getsize(output_path)
    print("\n" + "=" * 60)
    print(f"✅ Archivo generado: {output_path}")
    print(f"📦 Tamano: {file_size:,} bytes")
    print(f"📅 Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print("🎉 ¡Build PWA completado!")
    print(f"\n📱 Archivos generados:")
    print(f"   - index.html")
    print(f"   - manifest.json")
    print(f"   - service-worker.js")
    print(f"\n🌐 python -m http.server 8000")
    print(f"📲 Abre en Chrome Android y usa 'Agregar a pantalla de inicio'")


if __name__ == "__main__":
    main()