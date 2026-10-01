#!/usr/bin/env python3
# build.py - Script para generar index.html (con PWA)

import os
import sys
import json
from datetime import datetime

# ==================== CONFIGURACIÓN ====================
VERSION = "11.2 (28-09-2026)"
LS_KEY = "english_trainer_v6"

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
const CACHE_NAME = 'english-trainer-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './prompt.txt',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Baloo+2:wght@500;600;700;800&display=swap',
  'https://cdn-icons-png.flaticon.com/512/3898/3898082.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
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
      .catch(() => caches.match(event.request))
  );
});
'''
    with open('service-worker.js', 'w', encoding='utf-8') as f:
        f.write(sw_code)
    print(f"  ✅ service-worker.js creado")


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
        <button class="menu-btn help-btn" id="toggleHelpBtn" title="Ayuda de gramática" style="display:none;">❓</button>
        <button class="menu-btn" id="toggleMenuBtn">☰</button>
      </div>
    </div>

    <div id="importScreen" class="screen active">
      <div class="magic-card">
        <h2>📚 ¡Hola <span id="welcomeUsername"></span>!</h2>
        <div class="button-group">
          <button class="fun-btn primary-btn full-width" id="goToRulesSelectBtn" style="width:100%;">🎯 Seleccionar reglas a estudiar</button>
        </div>
        <details class="advanced-import-details">
          <summary>⚙️ Avanzado: pegar JSON manual</summary>
          <p>Pega aquí el JSON completo con tu tanda de ejercicios (usa el botón para copiar el prompt y pedírselo a la IA):</p>
          __IMPORT_FIELDS__
          <div class="button-group">
            <button class="btn-action btn-check" id="loadBtn">✨ Construir mapa</button>
          </div>
        </details>
      </div>
    </div>

    <div id="rulesSelectScreen" class="screen">
      <div class="magic-card rules-card">
        <h2>🎯 Selecciona las reglas a estudiar</h2>
        <p>Marca las reglas que quieres practicar en esta tanda. La barra muestra tu dominio actual de cada una.</p>
        <div id="rulesSelectList" class="rules-select-list"></div>
        <div id="rulesSelectSummary" class="rules-selection-summary"></div>
        <div class="button-group">
          <button class="btn-action btn-check" id="rulesSelectFinishBtn">✅ Finalizar selección</button>
        </div>
      </div>
    </div>

    <div id="rulesConfigScreen" class="screen">
      <div class="magic-card rules-card">
        <h2>📋 Reglas seleccionadas</h2>
        <p>Indica cuántos ejercicios quieres de cada regla y, si tiene varios tipos, cuántos de cada uno.</p>
        <div id="rulesConfigList" class="rules-config-list"></div>
        <div id="rulesConfigSummary" class="rules-selection-summary"></div>
        <div class="button-group">
          <button class="fun-btn" id="rulesConfigBackBtn">← Editar selección</button>
          <button class="btn-action btn-check" id="rulesConfigStartBtn">🚀 Empezar a estudiar</button>
        </div>
      </div>
    </div>

    <div id="percentagesScreen" class="screen">
      <div class="magic-card rules-card">
        <h2>📊 Porcentajes por regla</h2>
        <p>Así vas en cada regla gramatical. Toca el ícono de barras para ver cómo ha cambiado en el tiempo.</p>
        <div class="button-group">
          <button class="fun-btn primary-btn full-width" id="percentagesUpdateBtn" style="width:100%;">🔄 Actualizar % de reglas</button>
        </div>
        <div id="percentagesList" class="rules-select-list" style="margin-top:14px;"></div>
        <div class="button-group">
          <button class="fun-btn full-width" id="percentagesBackBtn" style="width:100%;">← Volver al mapa</button>
        </div>
      </div>
    </div>

    <div id="mapScreen" class="screen">
      <div class="magic-card">
        <div id="mapList" class="adventure-map"></div>
      </div>
      <div class="magic-card" style="padding:14px 18px;">
        <textarea id="reportArea" class="report" rows="4" readonly style="display:none;"></textarea>
        <button class="copy-report-btn" id="copyFinalReportBtn">📋 Copiar reporte</button>
      </div>
    </div>

    <div id="exerciseScreen" class="screen">
      <div class="exercise-area">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <span class="pill-status" id="nodeTag">Nodo 1</span>
          <span class="pill-status" id="exTag">Ejercicio 1/1</span>
          <span class="pill-status" id="exTypeTag">📝</span>
        </div>
        <div id="exerciseContainer"></div>
        <div id="resultLine" class="sub-fun" style="text-align:center;">✏️ Tu turno</div>
      </div>
    </div>

    <div id="infoScreen" class="screen">
      <div class="exercise-area info-scroll">
        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <span class="pill-status info-pill" id="infoTag">💡 Lección 1/1</span>
        </div>
        <div id="infoContainer"></div>
      </div>
    </div>
  </div>
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
  const API_URL = "https://script.google.com/macros/s/AKfycbwyu6wOJYkUXa8A-50Qzay61jC9eCRliTUA9TlXJkd7qL3TRpkyCImilgFfG88E_gKH/exec";

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
  // GRAMMAR_RULES_SEED es solo el % INICIAL de cada idioma; el % real vive
  // en localStorage bajo rulesStorageKey() (también por idioma) y sobrevive
  // a "Borrar todo" (esa acción solo toca currentStorageKey()).
  const GRAMMAR_RULES_SEED_BY_LANG = __GRAMMAR_RULES_JSON__;
  const ALL_STUDY_EXERCISES_BY_LANG = __STUDY_EXERCISES_JSON__;
  const INFORMACION_POR_REGLA_BY_LANG = __INFORMACION_POR_REGLA_JSON__;

  function currentGrammarSeed() { return GRAMMAR_RULES_SEED_BY_LANG[getTargetLanguage()] || []; }
  function currentStudyExercises() { return ALL_STUDY_EXERCISES_BY_LANG[getTargetLanguage()] || []; }
  function currentInformacionPorRegla() { return INFORMACION_POR_REGLA_BY_LANG[getTargetLanguage()] || {}; }

  function rulesStorageKey() {
    return "english_trainer_grammar_rules_v1_" + getTargetLanguage();
  }

  function loadGrammarRules() {
    let saved = [];
    try {
      const raw = localStorage.getItem(rulesStorageKey());
      if (raw) saved = JSON.parse(raw) || [];
    } catch (e) { /* noop */ }
    return currentGrammarSeed().map((r) => {
      const found = saved.find((s) => s.id === r.id);
      return { ...r, porcentaje: found ? found.porcentaje : r.porcentaje };
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

  // Envía el estado ACTUAL de AppRules (del idioma activo) como una nueva
  // fila de historial por regla. Se llama después de guardar porcentajes
  // nuevos (showUpdateRulesModal). No bloquea nada si falla (sin
  // conexión, por ejemplo) — solo se pierde ese punto del historial. Como
  // el historial en el backend queda desactualizado respecto al cache
  // local, se invalida el cache para que la próxima consulta (p. ej. abrir
  // el modal de estadísticas) traiga la fila nueva en vez de servir la
  // versión vieja.
  async function syncPercentagesToBackend() {
    const idioma = getTargetLanguage();
    const registros = AppRules.map((r) => ({ reglaId: r.id, regla: r.regla, porcentaje: r.porcentaje }));
    try {
      await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ sheet: "porcentajes", action: "add", idioma, registros })
      });
      cachedPercentageHistory = null;
      cachedPercentageHistoryLang = null;
      return true;
    } catch (e) {
      console.log("⚠️ No se pudo sincronizar con el backend:", e.message);
      return false;
    }
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

  // Trae el ÚLTIMO registro de cada regla (idioma activo) y, si hay algo
  // más nuevo que lo que tenemos en local, actualiza AppRules + localStorage.
  // Se usa al entrar a "Seleccionar reglas a estudiar" y a "Ver
  // porcentajes", para que el % mostrado sea siempre el más reciente sin
  // importar desde qué dispositivo se actualizó por última vez. Devuelve
  // true si cambió algo (para saber si hay que volver a pintar). De paso
  // deja el historial completo cacheado (fetchAllPercentageHistory), que
  // es lo que evita la consulta duplicada al abrir el modal de
  // estadísticas justo después.
  async function syncLatestPercentagesFromBackend() {
    try {
      const data = await fetchAllPercentageHistory();
      const latestByRule = {};
      data.forEach((it) => {
        const id = Number(it.reglaId);
        const t = new Date(it.fecha).getTime();
        if (!latestByRule[id] || t > latestByRule[id].t) {
          latestByRule[id] = { t, porcentaje: Number(it.porcentaje) };
        }
      });
      let changed = false;
      AppRules.forEach((r) => {
        const latest = latestByRule[r.id];
        if (latest && !Number.isNaN(latest.porcentaje) && latest.porcentaje !== r.porcentaje) {
          r.porcentaje = latest.porcentaje;
          changed = true;
        }
      });
      if (changed) saveGrammarRules(AppRules);
      return changed;
    } catch (e) {
      return false;
    }
  }

  function saveToStorage() {
    const data = {
      username: currentUser,
      nodes: AppState.nodes,
      progress: AppState.progress,
      activeNodeIndex: AppState.activeNodeIndex,
      activeExerciseIndex: AppState.activeExerciseIndex,
      reportEntries: AppState.reportEntries,
      reviewPool: AppState.reviewPool,
      // "Práctica inicial" vive fuera del array de nodos (ver map.js /
      // createPracticaInicial). Se persiste completa (incluye las
      // lecciones) para que un reload no la pierda; solo el progreso
      // DENTRO de la lección activa se reinicia si hay un reload (es
      // intencional, ver informacion.js).
      practicaInicial: AppState.practicaInicial || null,
      // Se persisten también las respuestas/resultados "de sesión". Antes
      // vivían solo en memoria: si la página se recargaba a mitad de un
      // nodo (muy común en PWA/móvil), se perdían, y al cerrar el nodo los
      // ejercicios fallados ANTES del reload quedaban sin userAnswer
      // registrada — eso hacía que el error mandado al nodo de repaso cayera en un
      // fallback incorrecto (mostraba el texto en español en vez del error
      // real del usuario). Persistir esto soluciona ese bug de raíz.
      sessionCorrectness: AppState.sessionCorrectness,
      sessionAnswers: AppState.sessionAnswers,
      lastUpdated: new Date().toISOString()
    };
    try { localStorage.setItem(currentStorageKey(), JSON.stringify(data)); } catch(e) {}
  }
  
  function loadFromStorage(username) {
    try {
      const raw = localStorage.getItem(currentStorageKey());
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.username !== username) return false;
      AppState.nodes = data.nodes || [];
      AppState.progress = data.progress || {};
      AppState.activeNodeIndex = data.activeNodeIndex || 0;
      AppState.activeExerciseIndex = data.activeExerciseIndex || 0;
      AppState.reportEntries = data.reportEntries || [];
      AppState.reviewPool = data.reviewPool || [];
      AppState.sessionCorrectness = data.sessionCorrectness || {};
      AppState.sessionAnswers = data.sessionAnswers || {};
      AppState.practicaInicial = data.practicaInicial || null;
      return AppState.nodes.length > 0;
    } catch(e) { return false; }
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
  
  function debounceSave() {
    clearTimeout(window._saveTimeout);
    window._saveTimeout = setTimeout(() => saveToStorage(), 500);
  }

  const mainScreens = {
    import: document.getElementById("importScreen"),
    rulesSelect: document.getElementById("rulesSelectScreen"),
    rulesConfig: document.getElementById("rulesConfigScreen"),
    percentages: document.getElementById("percentagesScreen"),
    map: document.getElementById("mapScreen"),
    exercise: document.getElementById("exerciseScreen"),
    info: document.getElementById("infoScreen")
  };
  
  function showMainView(name) {
    Object.keys(mainScreens).forEach(k => {
      if(mainScreens[k]) mainScreens[k].classList.toggle("active", k === name);
    });
  }

  function loadAllData() {
    try {
      __LOAD_DATA_FIELDS__
      
      // Sin validación - todo es opcional
      AppState.nodes = createNodeStructure(__CREATE_NODE_ARGS__);
      AppState.practicaInicial = createPracticaInicial(informacion);
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      AppState.reviewPool = [];
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};
      
      AppState.nodes.forEach((node, idx) => {
        AppState.progress[idx] = {
          completed: false,
          exercisesDone: 0,
          exerciseResults: Array(node.exercises.length).fill(false)
        };
      });
      
      saveToStorage();
      renderMapView();
      showMainView("map");
      const totalEj = AppState.nodes.reduce((sum, n) => sum + n.exercises.length, 0);
      const leccionesCount = AppState.practicaInicial?.lecciones?.length || 0;
      if (totalEj > 0 || leccionesCount > 0) {
        const leccionesMsg = leccionesCount > 0 ? (" + " + leccionesCount + " lección(es) de práctica inicial") : "";
        toast("🎒 " + totalEj + " ejercicios en " + AppState.nodes.length + " nodos" + leccionesMsg);
      } else {
        toast("⚠️ No se encontraron ejercicios. Agrega al menos uno.");
      }
    } catch(e) {
      toast("❌ JSON invalido: " + e.message);
      console.error(e);
    }
  }

  // ==================== SELECCIONAR REGLAS A ESTUDIAR ====================
  // Flujo: [Seleccionar reglas a estudiar] -> checkboxes con % -> [Finalizar
  // selección] -> tabla con cantidad (1-50) + info opcional por regla ->
  // [Empezar a estudiar]. Los ejercicios se toman de ALL_STUDY_EXERCISES
  // (embebido por build.py) filtrando por reglaIds, sin repetir el mismo id
  // de ejercicio entre dos reglas distintas de la misma tanda.
  let pendingRuleIds = [];

  function openRulesSelect() {
    pendingRuleIds = [];
    renderRulesSelectScreen();
    showMainView("rulesSelect");
    // Consulta el último registro guardado en el backend (idioma activo)
    // y, si hay algo más nuevo, repinta con los % actualizados — sin
    // bloquear la pantalla mientras tanto.
    syncLatestPercentagesFromBackend().then((changed) => { if (changed) renderRulesSelectScreen(); });
  }

  function countAvailable(ruleId) {
    return currentStudyExercises().reduce((n, e) => n + ((e.reglaIds || []).includes(ruleId) ? 1 : 0), 0);
  }

  // Cuántos ejercicios hay disponibles por regla, desglosado por tipo
  // (traduccion/completar/seleccionar/corregir/dictado). Solo se listan los
  // tipos con al menos 1 ejercicio.
  function computeTypeCounts(ruleId) {
    const counts = {};
    currentStudyExercises().forEach((e) => {
      if ((e.reglaIds || []).includes(ruleId)) counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }

  const TYPE_LABELS_UI = { traduccion: "📝 Traducción", completar: "✏️ Completar", seleccionar: "🎯 Emparejar", corregir: "🔍 Corregir", dictado: "🎧 Dictado" };

  // Clasifica un % de dominio en la misma escala good/warn/bad que ya usa
  // el resto de la app (corrección de ejercicios, progreso de nodos...).
  function pctTier(pct) {
    if (pct >= 80) return "good";
    if (pct >= 60) return "warn";
    return "bad";
  }

  // Orden para las listas de reglas (Seleccionar / Ver porcentajes): de
  // menor a mayor % de dominio, PERO las de 0% siempre al final (0% suele
  // ser "todavía no tiene ejercicios/no se ha estudiado", no
  // necesariamente "lo peor dominado" — no tiene sentido mezclarlas con
  // las que sí tienen algo de progreso real). Dentro de cada grupo
  // (0% / resto) se conserva el orden original (sort es estable), así que
  // no se reordena nada "porque sí" entre reglas con el mismo %.
  function sortRulesByPercentage(rules) {
    return [...rules].sort((a, b) => {
      const aZero = a.porcentaje === 0;
      const bZero = b.porcentaje === 0;
      if (aZero !== bZero) return aZero ? 1 : -1;
      if (aZero && bZero) return 0;
      return a.porcentaje - b.porcentaje;
    });
  }

  function renderRulesSelectScreen() {
    const list = document.getElementById("rulesSelectList");
    if (!list) return;
    list.innerHTML = sortRulesByPercentage(AppRules).map((r) => {
      const disponibles = countAvailable(r.id);
      const checked = pendingRuleIds.includes(r.id);
      const tier = pctTier(r.porcentaje);
      const empty = disponibles === 0;
      return `
        <label class="rule-card rule-select-row tier-${tier} ${empty ? 'rule-row-empty' : ''} ${checked ? 'rule-row-checked' : ''}">
          <input type="checkbox" class="rule-select-checkbox" data-id="${r.id}" ${checked ? 'checked' : ''} ${empty ? 'disabled' : ''}>
          <span class="rule-check" aria-hidden="true"></span>
          <span class="rule-card-body">
            <span class="rule-card-top">
              <span class="rule-select-text">${window._escHTML(r.regla)}</span>
              <span class="rule-pct-badge tier-${tier}">${r.porcentaje}%</span>
            </span>
            <span class="rule-pct-bar" role="presentation">
              <span class="rule-pct-bar-fill tier-${tier}" style="width:${r.porcentaje}%"></span>
            </span>
            <span class="rule-card-bottom">
              <span class="rule-select-count">${empty ? 'Sin ejercicios todavía' : disponibles + ' ejercicio' + (disponibles === 1 ? '' : 's') + ' disponible' + (disponibles === 1 ? '' : 's')}</span>
            </span>
          </span>
        </label>
      `;
    }).join('');

    list.querySelectorAll('.rule-select-checkbox').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = parseInt(cb.dataset.id, 10);
        if (cb.checked) { if (!pendingRuleIds.includes(id)) pendingRuleIds.push(id); }
        else pendingRuleIds = pendingRuleIds.filter((x) => x !== id);
        cb.closest('.rule-select-row')?.classList.toggle('rule-row-checked', cb.checked);
        updateRulesSelectSummary();
      });
    });

    updateRulesSelectSummary();
  }

  function updateRulesSelectSummary() {
    const el = document.getElementById("rulesSelectSummary");
    if (!el) return;
    if (!pendingRuleIds.length) { el.innerHTML = ''; return; }
    const totalDisponibles = pendingRuleIds.reduce((n, id) => n + countAvailable(id), 0);
    el.innerHTML = `<strong>${pendingRuleIds.length}</strong> regla${pendingRuleIds.length === 1 ? '' : 's'} seleccionada${pendingRuleIds.length === 1 ? '' : 's'} · <strong>${totalDisponibles}</strong> ejercicio${totalDisponibles === 1 ? '' : 's'} disponibles en total`;
  }

  function finishRulesSelect() {
    if (!pendingRuleIds.length) { toast("⚠️ Selecciona al menos una regla"); return; }
    renderRulesConfigScreen();
    showMainView("rulesConfig");
  }

  function renderRulesConfigScreen() {
    const list = document.getElementById("rulesConfigList");
    if (!list) return;
    list.innerHTML = pendingRuleIds.map((id) => {
      const r = findRegla(id);
      if (!r) return '';
      const disponibles = countAvailable(id);
      const maxTotal = Math.max(1, Math.min(50, disponibles));
      const lecciones = (currentInformacionPorRegla()[id] || currentInformacionPorRegla()[String(id)] || []);
      const tier = pctTier(r.porcentaje);
      return `
        <div class="rule-card rule-config-row tier-${tier}" data-rule-id="${id}" data-max-total="${maxTotal}">
          <div class="rule-card-top">
            <span class="rule-select-text">${window._escHTML(r.regla)}</span>
            <span class="rule-pct-badge tier-${tier}">${r.porcentaje}%</span>
          </div>
          <span class="rule-pct-bar" role="presentation">
            <span class="rule-pct-bar-fill tier-${tier}" style="width:${r.porcentaje}%"></span>
          </span>
          <div class="rule-config-meta">${disponibles} ejercicio${disponibles === 1 ? '' : 's'} disponible${disponibles === 1 ? '' : 's'}</div>
          <div class="rule-config-controls">
            <label class="rule-config-qty-field">
              <span class="rule-config-qty-label">Cantidad a estudiar</span>
              <span class="rule-config-qty-inputwrap">
                <input type="number" class="rule-config-qty" data-id="${id}" min="1" max="${maxTotal}" placeholder="—" required>
                <span class="rule-config-qty-max">/ ${maxTotal} máx.</span>
              </span>
            </label>
            ${lecciones.length ? `
              <label class="rule-config-info-toggle">
                <input type="checkbox" class="rule-config-info" data-id="${id}">
                <span class="rule-config-switch" aria-hidden="true"></span>
                <span>💡 Incluir lección de información</span>
              </label>
            ` : ''}
          </div>
          <div class="rule-config-type-breakdown" data-id="${id}"></div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.rule-config-qty').forEach((inp) => {
      inp.addEventListener('input', () => { renderTypeBreakdown(inp); updateRulesConfigSummary(); });
    });

    updateRulesConfigSummary();
  }

  // Al escribir la cantidad total de una regla, si hay más de un tipo de
  // ejercicio disponible para ella, se despliega un desglose "¿cuántos de
  // cada tipo?" que debe sumar exactamente el total. Con un solo tipo
  // disponible no hace falta desglosar: todo va a ese tipo.
  function renderTypeBreakdown(qtyInput) {
    const id = parseInt(qtyInput.dataset.id, 10);
    const row = qtyInput.closest('.rule-config-row');
    const breakdownEl = row.querySelector('.rule-config-type-breakdown');
    const maxTotal = parseInt(row.dataset.maxTotal, 10) || 0;
    const total = parseInt(qtyInput.value, 10);

    if (!Number.isInteger(total) || total < 1 || total > maxTotal) {
      breakdownEl.innerHTML = '';
      return;
    }

    const counts = computeTypeCounts(id);
    const types = Object.keys(TYPE_LABELS_UI).filter((t) => counts[t] > 0);

    if (types.length <= 1) {
      breakdownEl.innerHTML = '';
      return;
    }

    breakdownEl.innerHTML = `
      <div class="rule-type-breakdown-label">¿Cuántos de cada tipo? <span class="rule-type-breakdown-sum" data-id="${id}"></span></div>
      <div class="rule-type-breakdown-inputs">
        ${types.map((t) => `
          <label class="rule-type-chip">
            <span class="rule-type-chip-label">${TYPE_LABELS_UI[t]}</span>
            <input type="number" class="rule-config-type-qty" data-id="${id}" data-type="${t}" min="0" max="${Math.min(counts[t], total)}" placeholder="—">
            <span class="rule-type-chip-max">máx. ${Math.min(counts[t], total)}</span>
          </label>
        `).join('')}
      </div>
    `;

    breakdownEl.querySelectorAll('.rule-config-type-qty').forEach((typeInp) => {
      typeInp.addEventListener('input', () => { updateBreakdownSum(id, total); updateRulesConfigSummary(); });
    });
    updateBreakdownSum(id, total);
  }

  function updateBreakdownSum(id, total) {
    const breakdownEl = document.querySelector('.rule-config-type-breakdown[data-id="' + id + '"]');
    if (!breakdownEl) return;
    const inputs = breakdownEl.querySelectorAll('.rule-config-type-qty');
    let sum = 0;
    inputs.forEach((i) => { sum += parseInt(i.value, 10) || 0; });
    const sumEl = breakdownEl.querySelector('.rule-type-breakdown-sum');
    if (!sumEl) return;
    const ok = sum === total;
    sumEl.textContent = (ok ? "✅ " : "") + sum + "/" + total;
    sumEl.className = "rule-type-breakdown-sum" + (ok ? " sum-ok" : " sum-bad");
  }

  function updateRulesConfigSummary() {
    const el = document.getElementById("rulesConfigSummary");
    if (!el) return;
    const qtyInputs = document.querySelectorAll('.rule-config-qty');
    let total = 0;
    let filled = 0;
    qtyInputs.forEach((inp) => {
      const v = parseInt(inp.value, 10);
      if (Number.isInteger(v) && v > 0) { total += v; filled++; }
    });
    if (!total) { el.innerHTML = ''; return; }
    el.innerHTML = `Vas a estudiar <strong>${total}</strong> ejercicio${total === 1 ? '' : 's'} en total (${filled}/${qtyInputs.length} regla${qtyInputs.length === 1 ? '' : 's'} con cantidad definida)`;
  }

  function handleStartStudyFromRules() {
    const list = document.getElementById("rulesConfigList");
    if (!list) return;
    const rows = Array.from(list.querySelectorAll('.rule-config-row'));
    if (!rows.length) return;

    const config = [];
    let allValid = true;

    rows.forEach((row) => {
      const id = parseInt(row.dataset.ruleId, 10);
      const maxTotal = parseInt(row.dataset.maxTotal, 10) || 0;
      const qtyInput = row.querySelector('.rule-config-qty');
      const total = parseInt(qtyInput.value, 10);

      if (!Number.isInteger(total) || total < 1 || total > maxTotal) { allValid = false; return; }

      const typeInputs = Array.from(row.querySelectorAll('.rule-config-type-qty'));
      let byType;
      if (typeInputs.length) {
        byType = {};
        let sum = 0;
        typeInputs.forEach((inp) => {
          const v = parseInt(inp.value, 10) || 0;
          if (v > 0) byType[inp.dataset.type] = v;
          sum += v;
        });
        if (sum !== total) allValid = false;
      } else {
        const counts = computeTypeCounts(id);
        const onlyType = Object.keys(counts).find((t) => counts[t] > 0);
        byType = onlyType ? { [onlyType]: total } : {};
      }

      config.push({ id, byType });
    });

    if (!allValid) { toast("⚠️ Revisa las cantidades: cada regla necesita un total válido dentro de su máximo, y si hay desglose por tipo debe sumar exactamente ese total"); return; }

    const infoRuleIds = new Set(
      Array.from(list.querySelectorAll('.rule-config-info:checked')).map((cb) => parseInt(cb.dataset.id, 10))
    );

    startStudyFromRules(config, infoRuleIds);
  }

  function startStudyFromRules(config, infoRuleIds) {
    const usedIds = new Set();
    const chosen = [];
    let anyShort = false;

    config.forEach(({ id, byType }) => {
      Object.keys(byType).forEach((type) => {
        const qty = byType[type];
        if (!qty) return;
        const pool = shuffleArray(currentStudyExercises().filter((e) => e.type === type && (e.reglaIds || []).includes(id) && !usedIds.has(e.id)));
        const take = pool.slice(0, qty);
        if (take.length < qty) anyShort = true;
        take.forEach((e) => { usedIds.add(e.id); chosen.push(e); });
      });
    });

    const informacionLecciones = [];
    infoRuleIds.forEach((id) => {
      (currentInformacionPorRegla()[id] || currentInformacionPorRegla()[String(id)] || []).forEach((leccion) => informacionLecciones.push(leccion));
    });

    AppState.nodes = buildNodesFromExerciseList(chosen);
    AppState.practicaInicial = createPracticaInicial(informacionLecciones);
    AppState.progress = {};
    AppState.activeNodeIndex = 0;
    AppState.activeExerciseIndex = 0;
    AppState.failedExercises = [];
    AppState.reportEntries = [];
    AppState.reviewPool = [];
    AppState.sessionCorrectness = {};
    AppState.sessionAnswers = {};

    AppState.nodes.forEach((node, idx) => {
      AppState.progress[idx] = {
        completed: false,
        exercisesDone: 0,
        exerciseResults: Array(node.exercises.length).fill(false)
      };
    });

    saveToStorage();
    renderMapView();
    showMainView("map");
    pendingRuleIds = [];

    const totalEj = chosen.length;
    const leccionesMsg = informacionLecciones.length > 0 ? (" + " + informacionLecciones.length + " lección(es) de información") : "";
    const shortMsg = anyShort ? "⚠️ Algunas reglas no tenían suficientes ejercicios disponibles. " : "";
    if (totalEj > 0 || informacionLecciones.length > 0) {
      toast(shortMsg + "🎒 " + totalEj + " ejercicios en " + AppState.nodes.length + " nodos" + leccionesMsg);
    } else {
      toast("⚠️ No hay ejercicios disponibles para esas reglas todavía");
    }
  }

  // "🔄 Actualizar % de reglas": pega un JSON tipo [{"id":1,"porcentaje":55}, ...]
  // (parcial o completo) y se fusiona por id contra AppRules; lo que no
  // venga en el JSON queda intacto. Persiste en RULES_STORAGE_KEY, que
  // "Borrar todo" nunca toca.
  // ==================== PANTALLA "VER PORCENTAJES" ====================
  function openPercentagesScreen() {
    renderPercentagesScreen();
    showMainView("percentages");
    syncLatestPercentagesFromBackend().then((changed) => { if (changed) renderPercentagesScreen(); });
  }

  function renderPercentagesScreen() {
    const list = document.getElementById("percentagesList");
    if (!list) return;
    list.innerHTML = sortRulesByPercentage(AppRules).map((r) => {
      const tier = pctTier(r.porcentaje);
      return `
        <div class="rule-card tier-${tier} percentages-row">
          <span class="rule-card-body">
            <span class="rule-card-top">
              <span class="rule-select-text">${window._escHTML(r.regla)}</span>
              <span class="rule-pct-badge tier-${tier}">${r.porcentaje}%</span>
            </span>
            <span class="rule-pct-bar" role="presentation">
              <span class="rule-pct-bar-fill tier-${tier}" style="width:${r.porcentaje}%"></span>
            </span>
          </span>
          <button type="button" class="rule-stats-btn" data-id="${r.id}" title="Ver estadísticas" aria-label="Ver estadísticas de ${window._escHTML(r.regla)}">📊</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.rule-stats-btn').forEach((btn) => {
      btn.addEventListener('click', () => showRuleStatsModal(parseInt(btn.dataset.id, 10)));
    });
  }

  // Modal con una gráfica de barras (CSS puro, sin librerías) del
  // historial de % de UNA regla, leído del backend. Si nunca se ha usado
  // "Actualizar % de reglas" todavía no hay nada que graficar, y si no
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
        container.innerHTML = `<p class="sub-fun">Todavía no hay historial guardado para esta regla. Se va llenando cada vez que usas "🔄 Actualizar % de reglas".</p>`;
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

  function showUpdateRulesModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>🔄 Actualizar % de reglas</h3>
          <button class="menu-modal-close" id="updateRulesClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">
          Pega un JSON con los porcentajes nuevos, por ejemplo:<br>
          <code style="font-size:0.72rem;">[{"id":1,"porcentaje":55},{"id":2,"porcentaje":60}]</code><br>
          Solo se actualizan las reglas que incluyas; el resto queda igual.
        </p>
        <textarea id="updateRulesInput" class="answer-input" rows="8" placeholder='[{"id":1,"porcentaje":55}]'></textarea>
        <div class="action-buttons">
          <button class="fun-btn primary-btn" id="updateRulesApply">✅ Aplicar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#updateRulesClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#updateRulesApply').addEventListener('click', () => {
      const raw = document.getElementById("updateRulesInput").value.trim();
      if (!raw) { toast("📝 Pega el JSON primero"); return; }
      let updates;
      try { updates = JSON.parse(raw); } catch (e) { toast("❌ JSON inválido: " + e.message); return; }
      if (!Array.isArray(updates)) { toast("❌ Debe ser un array de {id, porcentaje}"); return; }

      let count = 0;
      updates.forEach((u) => {
        const r = findRegla(u.id);
        if (r && typeof u.porcentaje === "number") { r.porcentaje = u.porcentaje; count++; }
      });
      saveGrammarRules(AppRules);
      close();
      renderPercentagesScreen();
      renderRulesSelectScreen();
      toast(count > 0 ? ("🔄 " + count + " regla(s) actualizadas") : "⚠️ No se encontraron coincidencias por id");
      if (count > 0) {
        syncPercentagesToBackend().then((ok) => { if (ok) toast("☁️ Guardado en el historial"); });
      }
    });
  }

  // "🔀 Mezclar JSON manual": el mismo formato de siempre (traducciones/
  // completar/seleccionar/corregir/dictado/informacion, las 6 opcionales),
  // pero en vez de REEMPLAZAR lo que ya está cargado (como hace "Nueva
  // tanda" / loadAllData), se AGREGA a lo que ya seleccionaste desde la
  // base de datos por reglas. Útil, por ejemplo, para sumar una tanda con
  // audios reales que no vive en data/ejercicios/. Como todo el conjunto
  // (lo viejo + lo nuevo) se reparte de nuevo entre los nodos, el progreso
  // y la cola de repaso se reinician — igual que al cargar cualquier tanda
  // nueva o iniciar el estudio por reglas.
  // Botón de ayuda (❓, junto al de menú): solo tiene sentido estudiando
  // inglés (el contenido es la chuleta de gramática inglesa), así que se
  // oculta por completo cuando el idioma objetivo es italiano. Se
  // actualiza al boot y cada vez que se cambia de idioma.
  function updateHelpBtnVisibility() {
    const btn = document.getElementById("toggleHelpBtn");
    if (!btn) return;
    btn.style.display = getTargetLanguage() === "en" ? "flex" : "none";
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

  function showMergeDataModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>🔀 Mezclar JSON manual</h3>
          <button class="menu-modal-close" id="mergeDataClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:10px;">
          Pega aquí un JSON con el mismo formato de siempre (traducciones,
          completar, seleccionar, corregir, dictado e información — todas
          opcionales). Estos ejercicios se <strong>agregan</strong> a los
          que ya tienes cargados (no los reemplazan). Como todo se reparte
          de nuevo entre los nodos, el progreso y el repaso se reinician.
        </p>
        <div class="import-fields-header">
          <button type="button" class="fun-btn" id="mergeCopyPromptBtn">📋 Copiar prompt para la IA</button>
        </div>
        <textarea id="mergeDataInput" class="answer-input" rows="10" placeholder='${window._escHTML(IMPORT_EXAMPLE_JSON)}'></textarea>
        <div class="action-buttons">
          <button class="fun-btn primary-btn" id="mergeDataApply">🔀 Mezclar con lo cargado</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#mergeDataClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#mergeCopyPromptBtn').addEventListener('click', copyPromptFromFile);

    modal.querySelector('#mergeDataApply').addEventListener('click', () => {
      const raw = document.getElementById("mergeDataInput").value.trim();
      if (!raw) { toast("📝 Pega el JSON primero"); return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) { toast("❌ JSON inválido: " + e.message); return; }
      close();
      mergeManualData(parsed);
    });
  }

  function mergeManualData(parsedData) {
    try {
      const newExercises = rawDataToExerciseList(parsedData);
      const existingExercises = (AppState.nodes || [])
        .filter((n) => n.type === "main")
        .flatMap((n) => n.exercises);
      const merged = existingExercises.concat(newExercises);

      AppState.nodes = buildNodesFromExerciseList(merged);
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      AppState.reviewPool = [];
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};

      const newLecciones = parsedData?.informacion || [];
      if (newLecciones.length) {
        if (!AppState.practicaInicial) {
          AppState.practicaInicial = createPracticaInicial(newLecciones);
        } else {
          AppState.practicaInicial.lecciones = AppState.practicaInicial.lecciones.concat(newLecciones);
          AppState.practicaInicial.completed = false;
        }
      }

      AppState.nodes.forEach((node, idx) => {
        AppState.progress[idx] = {
          completed: false,
          exercisesDone: 0,
          exerciseResults: Array(node.exercises.length).fill(false)
        };
      });

      saveToStorage();
      renderMapView();
      showMainView("map");

      const totalEj = AppState.nodes.reduce((sum, n) => sum + n.exercises.length, 0);
      toast("🔀 Mezclados: " + newExercises.length + " ejercicio(s) nuevo(s) + " + existingExercises.length + " que ya tenías = " + totalEj + " en total");
    } catch (e) {
      toast("❌ Error al mezclar: " + e.message);
      console.error(e);
    }
  }


  function renderMapView() {
    cleanupAudio();
    renderMap(AppState.nodes, AppState.progress, { openNode, openPracticaInicial, showToast: toast }, AppState.practicaInicial);
  }

  const PASS_THRESHOLD = 0.8;

  // El repaso ya no es siempre un único nodo al final del array: si la pool
  // crece, se reparte en varios nodos de repaso (ver buildRepasoNodes() en
  // map.js), igual que los principales se reparten con computeNodeSizes().
  // Estos helpers ubican dónde EMPIEZAN los nodos de repaso dentro del
  // array, sin asumir que hay exactamente uno.
  function getFirstRepasoNodeIndex() {
    const idx = AppState.nodes.findIndex(n => n.type === 'repaso');
    return idx === -1 ? AppState.nodes.length : idx;
  }

  function isRepasoNodeIndex(idx) {
    return AppState.nodes[idx]?.type === 'repaso';
  }

  function refreshRepasoNode() {
    const firstRepasoIdx = getFirstRepasoNodeIndex();
    if (firstRepasoIdx >= AppState.nodes.length) return;

    const mainNodes = AppState.nodes.slice(0, firstRepasoIdx);
    const oldRepasoCount = AppState.nodes.length - firstRepasoIdx;
    const chunkSize = computeRepasoChunkSize(mainNodes);
    const newRepasoNodes = buildRepasoNodes(AppState.reviewPool, chunkSize, firstRepasoIdx + 1);

    // El progreso de los nodos de repaso viejos se descarta (igual que
    // antes: cada refresh arranca el repaso "de cero") y se arma de nuevo
    // para los nodos recién construidos.
    for (let i = 0; i < oldRepasoCount; i++) delete AppState.progress[firstRepasoIdx + i];

    AppState.nodes = [...mainNodes, ...newRepasoNodes];
    newRepasoNodes.forEach((node, i) => {
      AppState.progress[firstRepasoIdx + i] = {
        completed: node.exercises.length === 0,
        exercisesDone: 0,
        exerciseResults: Array(node.exercises.length).fill(false)
      };
    });
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
  const ORIGIN_TYPE_LABELS = { traduccion: "Traducción", corregir: "Corregir", dictado: "Dictado" };

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
      : "";
    const correctText = originType === "traduccion"
      ? (exercise.englishWord || exercise.englishWords || "")
      : originType === "corregir"
      ? (exercise.fraseCorrecta || "")
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

  // Tipos cuyo modal de resultado muestra [Repasar] / [Repasar luego]. Para
  // estos ya NO hay envío automático al repaso: lo decide el usuario. Los
  // demás tipos (completar, emparejar) conservan la regla anterior al
  // cerrar el nodo (ver renderExercise).
  const MANUAL_REVIEW_TYPES = ["traduccion", "corregir", "dictado"];

  // [Repasar]: una copia del ejercicio se agrega al FINAL del nodo actual.
  // La copia se marca con __requeue para que, si luego se cambia la cantidad
  // de nodos (redistributeMainNodes en map.js), siga en ESTE nodo en vez de
  // moverse con el reparto automático.
  function requeueAtEndOfMainNode(node, ex) {
    const nodeIdx = AppState.activeNodeIndex;
    const clone = { ...ex, __requeue: true };
    node.exercises.push(clone);
    node.totalExercises = node.exercises.length;

    const prog = AppState.progress[nodeIdx];
    if (prog) {
      prog.exerciseResults = prog.exerciseResults || [];
      while (prog.exerciseResults.length < node.exercises.length) prog.exerciseResults.push(false);
      prog.completed = false;
    }
    toast("🔁 Irá al final de este nodo");
  }

  // [Repasar luego]: el ejercicio va a la pool de la sección de repaso final.
  function sendToReviewPool(ex, userAnswer) {
    const alreadyQueued = ex.__repasoId && AppState.reviewPool.some(p => p.__repasoId === ex.__repasoId);
    if (!alreadyQueued) AppState.reviewPool.push(buildRepasoExercise(ex, userAnswer));
    // Se refleja de una vez en el mapa (los nodos de repaso van después de
    // los principales, así que no mueve el nodo que se está jugando).
    refreshRepasoNode();
    toast("🧠 Enviado a la sección de repaso");
  }

  // decision (opcional): "repasar" | "luego" | null/undefined (solo continuar).
  function recordExerciseResult(isCorrect, decision) {
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    AppState.sessionCorrectness[exIndex] = !!isCorrect;
    if (!node) return;

    const current = node.exercises[exIndex];
    if (!current) return;
    const userAnswer = AppState.sessionAnswers[exIndex];

    if (node.type === "repaso") {
      // Reencola el ejercicio al FINAL del nodo de repaso, refrescando el
      // error con la última respuesta del usuario.
      const requeueInRepaso = () => {
        const clone = { ...current };
        if (clone.type === "corregir" && userAnswer && userAnswer.trim()) {
          const attempt = userAnswer.trim();
          clone.fraseConError = attempt;
          // Acumula el historial de intentos fallidos (máx. 3, el más
          // reciente al final) para la tarjeta rotativa de errores.
          const history = Array.isArray(current.wrongAttempts) ? current.wrongAttempts.slice() : (current.fraseConError ? [current.fraseConError] : []);
          if (history[history.length - 1] !== attempt) history.push(attempt);
          clone.wrongAttempts = history.slice(-3);
        }
        node.exercises.push(clone);
      };

      if (decision === "repasar") {
        // Pidió repasarlo otra vez: se queda en la pool y vuelve al final de este nodo.
        requeueInRepaso();
      } else if (decision === "luego") {
        // Se queda en la pool para una próxima ronda de repaso (no se reencola aquí).
      } else if (isCorrect) {
        // Aprobado de verdad: sale definitivamente de la pool de repaso
        if (current.__repasoId) {
          AppState.reviewPool = AppState.reviewPool.filter(p => p.__repasoId !== current.__repasoId);
        }
      } else {
        // Sigue sin superar el 80%: se reencola al FINAL del nodo de repaso
        // hasta que realmente lo apruebe.
        requeueInRepaso();
      }
      return;
    }

    // Nodo principal
    if (decision === "repasar") requeueAtEndOfMainNode(node, current);
    else if (decision === "luego") sendToReviewPool(current, userAnswer);
  }

  // ==================== PRÁCTICA INICIAL ====================
  // Nodo especial, obligatorio, previo al Nodo 1. Vive fuera del array de
  // nodos (principales + repaso, ahora este último puede ser más de uno) y
  // NO alimenta el informe de errores
  // (ver informacion.js).
  let practicaLeccionState = null;

  function openPracticaInicial() {
    cleanupAudio();
    const p = AppState.practicaInicial;
    if (!p || p.completed || !p.lecciones?.length) { renderMapView(); showMainView("map"); return; }
    if (p.leccionIndex >= p.lecciones.length) {
      p.completed = true;
      saveToStorage();
      renderMapView();
      showMainView("map");
      return;
    }
    practicaLeccionState = freshLeccionState(p.lecciones[p.leccionIndex]);
    renderPracticaInicialScreen();
    showMainView("info");
  }

  function renderPracticaInicialScreen() {
    const p = AppState.practicaInicial;
    const leccion = p.lecciones[p.leccionIndex];
    const container = document.getElementById("infoContainer");
    // Cada interacción vuelve a renderizar todo el scroll (más simple y
    // robusto que parchear el DOM a mano). Sin esto, cada tap reseteaba el
    // scroll al tope de la lección — muy molesto en ejercicio 2, donde el
    // usuario ya bajó varias líneas.
    const preservedScroll = window.scrollY;
    document.getElementById("infoTag").innerHTML = "💡 Lección " + (p.leccionIndex + 1) + "/" + p.lecciones.length;
    container.innerHTML = renderLeccion(leccion, practicaLeccionState);
    wireLeccion(leccion, container, practicaLeccionState, renderPracticaInicialScreen, () => {
      p.leccionIndex++;
      saveToStorage();
      if (p.leccionIndex >= p.lecciones.length) {
        p.completed = true;
        saveToStorage();
        renderMapView();
        showMainView("map");
        burstConfetti();
        toast("🎉 ¡Práctica inicial completada!");
      } else {
        practicaLeccionState = freshLeccionState(p.lecciones[p.leccionIndex]);
        renderPracticaInicialScreen();
      }
    });
    window.scrollTo(0, preservedScroll);
  }

  function openNode(nodeIndex) {
    cleanupAudio();
    if (!AppState.nodes[nodeIndex]?.exercises?.length) {
      toast(isRepasoNodeIndex(nodeIndex) ? "🎉 No tienes ejercicios pendientes de repaso" : "📭 Este nodo está vacío");
      return;
    }
    AppState.activeNodeIndex = nodeIndex;
    AppState.activeExerciseIndex = 0;
    AppState.failedExercises = [];
    AppState.sessionCorrectness = {};
    AppState.sessionAnswers = {};
    
    const prog = AppState.progress[nodeIndex] || { exerciseResults: [] };
    const results = prog.exerciseResults || [];
    for (let i = 0; i < AppState.nodes[nodeIndex].exercises.length; i++) {
      if (!results[i]) { AppState.activeExerciseIndex = i; break; }
    }
    
    saveToStorage();
    renderExercise();
    showMainView("exercise");
  }

  function renderExercise() {
    cleanupAudio();
    
    const node = AppState.nodes[AppState.activeNodeIndex];
    if (!node?.exercises?.length) { showMainView("map"); return; }
    
    const exIndex = AppState.activeExerciseIndex;
    if (exIndex >= node.exercises.length) {
      AppState.progress[AppState.activeNodeIndex].completed = true;

      if (node.type !== 'repaso') {
        // El nodo de repaso resuelve su propia pool ejercicio a ejercicio (ver
        // recordExerciseResult), así que aquí solo evaluamos nodos principales.
        // Traducción/corrección/dictado ya NO se envían solos al repaso: el
        // usuario decide con [Repasar] / [Repasar luego] en el modal. Esta
        // regla (nodo < 80%) solo sigue aplicando a los demás tipos.
        const total = node.exercises.length;
        let correctCount = 0;
        node.exercises.forEach((ex, i) => { if (AppState.sessionCorrectness[i]) correctCount++; });
        const score = total ? correctCount / total : 1;
        if (score < PASS_THRESHOLD) {
          node.exercises.forEach((ex, i) => {
            if (!AppState.sessionCorrectness[i] && !MANUAL_REVIEW_TYPES.includes(ex.type)) {
              const alreadyQueued = ex.__repasoId && AppState.reviewPool.some(p => p.__repasoId === ex.__repasoId);
              if (!alreadyQueued) {
                AppState.reviewPool.push(buildRepasoExercise(ex, AppState.sessionAnswers[i]));
              }
            }
          });
        }
      }
      refreshRepasoNode();
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};

      saveToStorage();
      renderMapView();
      showMainView("map");
      burstConfetti();
      toast("🎉 Nodo " + (AppState.activeNodeIndex + 1) + " completado!");
      return;
    }
    
    const exercise = node.exercises[exIndex];
    const container = document.getElementById("exerciseContainer");
    
    document.getElementById("nodeTag").innerHTML = "📌 Nodo " + (AppState.activeNodeIndex + 1);
    document.getElementById("exTag").innerHTML = "📝 " + (exIndex + 1) + "/" + node.exercises.length;
    document.getElementById("exTypeTag").innerHTML = getExerciseTypeIcon(exercise.type) + " " + getExerciseTypeName(exercise.type);
    
    const isRetry = AppState.failedExercises.includes(exIndex);
    
    switch(exercise.type) {
      case "traduccion": renderTraduccionExercise(exercise, container); setupTraduccionListeners(exercise, container); break;
      case "completar": renderCompletarExercise(exercise, container, isRetry); setupCompletarListeners(exercise, container); break;
      case "seleccionar": renderSeleccionarExercise(exercise, container); setupSeleccionarListeners(exercise); break;
      case "corregir": renderCorregirExercise(exercise, container, isRetry); setupCorregirListeners(exercise, container); break;
      case "dictado": renderDictadoExercise(exercise, container); setupDictadoListeners(exercise, container); break;
    }
    
    document.getElementById("resultLine").innerHTML = isRetry ? "⚠️ Correccion de error" : "✏️ Tu turno";
  }

  function setupTraduccionListeners(exercise, container) {
    const checkBtn = container.querySelector('.traduccion-check');
    const answerInput = container.querySelector('.traduccion-answer');
    if (checkBtn && answerInput) {
      checkBtn.onclick = () => {
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) { toast("📝 Escribe algo"); return; }
        showComparativeModal(exercise, userAnswer, (duda, passed, decision) => {
          AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
          recordExerciseResult(passed, decision);
          const entry = decision === "repasar"
            ? buildManualCorreccionEntry(exercise, userAnswer, duda)
            : getTraduccionReportEntry(exercise, userAnswer, duda);
          AppState.reportEntries.push(tagEntryMeta(entry, exercise));
          advanceExercise();
        });
      };
    }
  }

  function setupCompletarListeners(exercise, container) {
    const checkBtn = container.querySelector('.completar-check');
    if (checkBtn) {
      checkBtn.onclick = () => {
        const result = checkCompletarAnswers(exercise, container);
        const { allCorrect, userAnswers, results } = result;
        showCompletarModal(exercise, results, 
          (success, duda) => { 
            recordExerciseResult(success);
            AppState.reportEntries.push(tagEntryMeta(getCompletarReportEntry(exercise, userAnswers, duda), exercise)); 
            advanceExercise(); 
          },
          (duda) => { 
            if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) {
              AppState.failedExercises.push(AppState.activeExerciseIndex);
            }
            renderExercise(); 
          }
        );
      };
    }
  }

  function setupCorregirListeners(exercise, container) {
    const checkBtn = container.querySelector('.corregir-check');
    const answerInput = container.querySelector('.corregir-answer');
    if (checkBtn && answerInput) {
      checkBtn.onclick = () => {
        const userAnswer = answerInput.value.trim();
        if (!userAnswer) { toast("📝 Escribe algo"); return; }
        AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
        const result = checkCorregirAnswer(exercise, userAnswer);
        showCorregirModal(exercise, result, userAnswer, 
          (duda, decision) => {
            recordExerciseResult(result.passed, decision);
            const entry = decision === "repasar"
              ? buildManualCorreccionEntry(exercise, userAnswer, duda)
              : getCorregirReportEntry(exercise, userAnswer, duda);
            AppState.reportEntries.push(tagEntryMeta(entry, exercise));
            advanceExercise();
          },
          (duda) => { AppState.reportEntries.push(tagEntryMeta(getCorregirReportEntry(exercise, userAnswer, duda), exercise)); if (!AppState.failedExercises.includes(AppState.activeExerciseIndex)) AppState.failedExercises.push(AppState.activeExerciseIndex); renderExercise(); }
        );
      };
    }
  }

  function setupSeleccionarListeners(exercise) {
    const container = document.getElementById("exerciseContainer");
    if (container) container.addEventListener("all-matched", () => { showSeleccionarCompleteModal(exercise.pairs, () => { recordExerciseResult(true); advanceExercise(); }); });
  }

  function setupDictadoListeners(exercise, container) {
    // Guardar referencia en el container para poder removerla después
    if (container._dictadoHandler) {
      container.removeEventListener("dictado-done", container._dictadoHandler);
    }
    
    const handler = function(e) {
      cleanupAudio();
      const { originalText, userAnswer, result, duda, decision } = e.detail;
      AppState.sessionAnswers[AppState.activeExerciseIndex] = userAnswer;
      recordExerciseResult(!!result?.passed, decision);
      const entry = decision === "repasar"
        ? buildManualCorreccionEntry(exercise, userAnswer, duda)
        : getDictadoReportEntry(originalText, userAnswer, duda);
      AppState.reportEntries.push(tagEntryMeta(entry, exercise));
      advanceExercise();
    };
    
    container._dictadoHandler = handler;
    container.addEventListener("dictado-done", handler);
  }

  function advanceExercise() {
    cleanupAudio();
    const node = AppState.nodes[AppState.activeNodeIndex];
    const exIndex = AppState.activeExerciseIndex;
    if (!AppState.progress[AppState.activeNodeIndex]) {
      AppState.progress[AppState.activeNodeIndex] = { completed: false, exercisesDone: 0, exerciseResults: Array(node.exercises.length).fill(false) };
    }
    if (!AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex]) {
      AppState.progress[AppState.activeNodeIndex].exerciseResults[exIndex] = true;
      AppState.progress[AppState.activeNodeIndex].exercisesDone = (AppState.progress[AppState.activeNodeIndex].exercisesDone || 0) + 1;
    }
    AppState.failedExercises = AppState.failedExercises.filter(i => i !== exIndex);
    AppState.activeExerciseIndex = AppState.failedExercises.length > 0 ? AppState.failedExercises[0] : AppState.activeExerciseIndex + 1;
    saveToStorage();
    renderExercise();
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
  // AppRules (por si el usuario actualizó % o cambió de dispositivo, el
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

  function buildReport() {
    let lines = [];
    lines.push("📘 INFORME DE APRENDIZAJE");
    lines.push("=".repeat(40));
    lines.push("");
    
    if (AppState.reportEntries.length === 0) { 
      lines.push("🌟 Intenta algunos ejercicios para ver tu informe"); 
      return lines.join("\n");
    }

    // Dictado siempre queda en un único grupo aparte (normal + repaso
    // mezclados) sin importar la regla gramatical. El resto se agrupa por
    // regla gramatical, y dentro de eso se separa lo hecho en nodos
    // principales de lo hecho en la sección de repaso.
    const dictadoEntries = AppState.reportEntries.filter((e) => e.type === "dictado");
    const nonDictado = AppState.reportEntries.filter((e) => e.type !== "dictado");
    const mainEntries = nonDictado.filter((e) => e.origin !== "repaso");
    const repasoEntries = nonDictado.filter((e) => e.origin === "repaso");

    const counterRef = { n: 0 };

    if (mainEntries.length > 0) {
      lines.push("📚 EJERCICIOS POR REGLA GRAMATICAL");
      lines.push("=".repeat(40));
      renderEntriesByRegla(mainEntries, lines, counterRef);
    }

    if (dictadoEntries.length > 0) {
      lines.push("🎧 DICTADO (" + dictadoEntries.length + " ejercicios)");
      lines.push("=".repeat(40));
      lines.push("-".repeat(30));
      dictadoEntries.forEach((entry) => {
        counterRef.n++;
        lines.push(...formatReportEntryLines(counterRef.n, entry));
      });
      lines.push("");
    }

    if (repasoEntries.length > 0) {
      lines.push("🔁 SECCIÓN DE REPASO — Practicando hasta superar tus errores");
      lines.push("=".repeat(40));
      lines.push("Aquí queda registrado todo lo ocurrido en tus nodos de repaso,");
      lines.push("donde cada ejercicio fallado se repite hasta que se aprueba de verdad.");
      lines.push("");
      renderEntriesByRegla(repasoEntries, lines, counterRef);
    }
    
    return lines.join("\n");
  }

  function copyReport() {
    const report = buildReport();
    const reportArea = document.getElementById("reportArea");
    if (reportArea) { reportArea.style.display = "block"; reportArea.value = report; }
    navigator.clipboard?.writeText(report).then(() => toast("📋 Informe copiado")).catch(() => toast("📋 Copia manualmente"));
  }

  // prompt.txt vive como archivo aparte (no se genera desde build.py) para
  // que se pueda editar en cualquier momento sin tener que reconstruir el
  // proyecto. Este botón simplemente lo lee y lo copia al portapapeles.
  async function copyPromptFromFile() {
    try {
      const res = await fetch('./prompt.txt', { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast("📋 Prompt copiado");
    } catch (e) {
      console.error(e);
      toast("❌ No se pudo leer prompt.txt");
    }
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
    const hasData = loadFromStorage(username);
    if (!hasData) { AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.reportEntries = []; AppState.practicaInicial = null; }
    renderMapView();
    document.getElementById("loginScreen").classList.remove("active");
    document.getElementById("mainScreen").classList.add("active");
    showMainView(AppState.nodes.length ? "map" : "import");
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

  async function resetAll() {
    if(confirm("¿Borrar todo el progreso?")) {
      AppState.nodes = []; AppState.progress = {}; AppState.activeNodeIndex = 0; AppState.activeExerciseIndex = 0; AppState.failedExercises = []; AppState.reportEntries = []; AppState.reviewPool = []; AppState.sessionCorrectness = {}; AppState.sessionAnswers = {}; AppState.practicaInicial = null;
      saveToStorage(); renderMapView(); showMainView("import"); toast("🗑️ Todo borrado");
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
    const loaded = loadFromStorage(currentUser);
    if (!loaded) {
      AppState.nodes = [];
      AppState.progress = {};
      AppState.activeNodeIndex = 0;
      AppState.activeExerciseIndex = 0;
      AppState.failedExercises = [];
      AppState.reportEntries = [];
      AppState.reviewPool = [];
      AppState.sessionCorrectness = {};
      AppState.sessionAnswers = {};
      AppState.practicaInicial = null;
    }
    showMainView(loaded ? "map" : "import");
    updateHelpBtnVisibility();
  }

  function refreshCurrentScreenForLanguage() {
    if (document.getElementById("exerciseScreen")?.classList.contains("active")) {
      renderExercise();
    } else if (document.getElementById("infoScreen")?.classList.contains("active")) {
      renderPracticaInicialScreen();
    } else {
      renderMapView();
    }
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
          <button class="fun-btn" id="menuBackToMapBtn">🗺️ Mapa</button>
          <button class="fun-btn" id="menuPercentagesBtn">📊 Ver porcentajes</button>
          <button class="fun-btn" id="menuRulesSelectBtn">🎯 Estudiar por reglas</button>
          <button class="fun-btn" id="menuToggleLangBtn">${getTargetLangMeta().flag} Idioma: ${getTargetLangMeta().label}</button>
          <button class="fun-btn" id="menuVoicePickerBtn">🎙️ Elegir voz</button>
          <button class="fun-btn" id="menuNodeCountBtn">🔢 Nodos: ${getTotalMainNodes()}</button>
          <button class="fun-btn" id="menuCopyReportBtn">📋 Copiar informe</button>
          <button class="fun-btn" id="menuMergeDataBtn">🔀 Mezclar JSON manual</button>
          <button class="fun-btn" id="menuReplaceListBtn">📥 Nueva tanda</button>
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
    modal.querySelector('#menuBackToMapBtn').addEventListener('click', () => { close(); renderMapView(); showMainView("map"); });
    modal.querySelector('#menuPercentagesBtn').addEventListener('click', () => { close(); openPercentagesScreen(); });
    modal.querySelector('#menuToggleLangBtn').addEventListener('click', () => {
      toggleTargetLanguage();
      switchStudyDataToCurrentLanguage();
      close();
      refreshCurrentScreenForLanguage();
      toast(getTargetLangMeta().flag + " Ahora practicando " + getTargetLangMeta().labelLower);
    });
    modal.querySelector('#menuVoicePickerBtn').addEventListener('click', () => { close(); showVoicePickerModal(); });
    modal.querySelector('#menuNodeCountBtn').addEventListener('click', () => { close(); showNodeCountModal(); });
    modal.querySelector('#menuCopyReportBtn').addEventListener('click', () => { close(); copyReport(); });
    modal.querySelector('#menuRulesSelectBtn').addEventListener('click', () => { close(); openRulesSelect(); });
    modal.querySelector('#menuMergeDataBtn').addEventListener('click', () => { close(); showMergeDataModal(); });
    modal.querySelector('#menuReplaceListBtn').addEventListener('click', () => { close(); showMainView("import"); toast("📥 Ingresa nuevos datos"); });
    modal.querySelector('#menuResetAllBtn').addEventListener('click', () => { close(); resetAll(); });
  }

  // Deja al usuario definir libremente en cuántos nodos se reparten sus
  // ejercicios, con botones +/-. Al aplicar, se usa redistributeMainNodes()
  // (map.js) para reacomodar los ejercicios existentes en la nueva
  // cantidad de nodos SIN perder el progreso ya hecho (cada ejercicio
  // conserva si ya estaba resuelto, caiga en el nodo que caiga).
  function showNodeCountModal() {
    const existing = document.querySelector('.modal-overlay');
    if (existing) existing.remove();

    let pending = getTotalMainNodes();

    const modal = document.createElement("div");
    modal.className = "modal-overlay modal-active";
    modal.innerHTML = `
      <div class="modal-friend menu-modal">
        <div class="menu-modal-header">
          <h3>🔢 Cantidad de nodos</h3>
          <button class="menu-modal-close" id="nodeCountClose" aria-label="Cerrar">✕</button>
        </div>
        <p class="sub-fun" style="text-align:left;margin-bottom:14px;">
          Define en cuántos nodos se reparten tus ejercicios (mínimo ${MIN_MAIN_NODES}, máximo ${MAX_MAIN_NODES}).
          Puedes cambiarlo cuando quieras: tu progreso se conserva.
        </p>
        <div style="display:flex;align-items:center;justify-content:center;gap:20px;margin:10px 0 18px;">
          <button type="button" class="fun-btn" id="nodeCountMinus" style="width:52px;height:52px;font-size:1.5rem;">−</button>
          <span id="nodeCountValue" style="font-size:2rem;font-weight:900;min-width:56px;text-align:center;">${pending}</span>
          <button type="button" class="fun-btn" id="nodeCountPlus" style="width:52px;height:52px;font-size:1.5rem;">+</button>
        </div>
        <div class="action-buttons">
          <button class="fun-btn primary-btn" id="nodeCountApply">✅ Aplicar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const valueEl = modal.querySelector('#nodeCountValue');
    const minusBtn = modal.querySelector('#nodeCountMinus');
    const plusBtn = modal.querySelector('#nodeCountPlus');

    const refreshStepper = () => {
      minusBtn.disabled = pending <= MIN_MAIN_NODES;
      plusBtn.disabled = pending >= MAX_MAIN_NODES;
      minusBtn.style.opacity = minusBtn.disabled ? "0.4" : "1";
      plusBtn.style.opacity = plusBtn.disabled ? "0.4" : "1";
    };
    refreshStepper();

    minusBtn.addEventListener('click', () => {
      if (pending > MIN_MAIN_NODES) { pending--; valueEl.textContent = pending; refreshStepper(); }
    });
    plusBtn.addEventListener('click', () => {
      if (pending < MAX_MAIN_NODES) { pending++; valueEl.textContent = pending; refreshStepper(); }
    });

    const close = () => modal.remove();
    modal.querySelector('#nodeCountClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#nodeCountApply').addEventListener('click', () => {
      close();
      applyNodeCount(pending);
    });
  }

  function applyNodeCount(newCount) {
    const current = getTotalMainNodes();

    // Sin ejercicios cargados todavía: solo guardamos la preferencia, se
    // usará quando se construya el mapa por primera vez.
    if (!AppState.nodes.length) {
      setTotalMainNodes(newCount);
      toast("🔢 Se usarán " + getTotalMainNodes() + " nodos cuando cargues tus ejercicios");
      return;
    }

    if (newCount === current) { toast("🔢 Ya tienes " + current + " nodos"); return; }

    const { nodes, progress } = redistributeMainNodes(AppState.nodes, AppState.progress, newCount);
    AppState.nodes = nodes;
    AppState.progress = progress;

    saveToStorage();
    renderMapView();
    showMainView("map");
    toast("🔢 Ahora tienes " + getTotalMainNodes() + " nodos — tu progreso se mantuvo");
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
    document.getElementById("loadBtn")?.addEventListener("click", loadAllData);
    document.getElementById("copyPromptBtn")?.addEventListener("click", copyPromptFromFile);
    document.getElementById("copyFinalReportBtn")?.addEventListener("click", copyReport);
    document.getElementById("toggleMenuBtn")?.addEventListener("click", showMenuModal);
    document.getElementById("toggleHelpBtn")?.addEventListener("click", showHelpModal);
    document.getElementById("goToRulesSelectBtn")?.addEventListener("click", openRulesSelect);
    document.getElementById("rulesSelectFinishBtn")?.addEventListener("click", finishRulesSelect);
    document.getElementById("rulesConfigBackBtn")?.addEventListener("click", () => { renderRulesSelectScreen(); showMainView("rulesSelect"); });
    document.getElementById("rulesConfigStartBtn")?.addEventListener("click", handleStartStudyFromRules);
    document.getElementById("percentagesUpdateBtn")?.addEventListener("click", showUpdateRulesModal);
    document.getElementById("percentagesBackBtn")?.addEventListener("click", () => { renderMapView(); showMainView("map"); });
  }
  
  init();
'''


def build_html():
    print("📂 Leyendo archivos...")
    styles = read_file('styles/main.css')
    map_js = read_file('mapa/map.js')

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
    
    required_files = ['styles/main.css', 'mapa/map.js'] + list(EXERCISE_FILES.keys())
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