// exercises/idioma.js
//
// Controla el "idioma objetivo" que se está practicando: inglés o
// italiano. El idioma nativo (español) nunca cambia — solo cambia el otro
// lado de cada tarjeta.
//
// Esto afecta TANTO la interfaz (banderas/etiquetas) COMO el audio: cada
// módulo de ejercicio (dictado.js, seleccionar.js, traduccion.js,
// corregir.js) usa `getTargetLangMeta().ttsLang` ("en-US" / "it-IT") y
// busca una voz de ese idioma instalada en el navegador/dispositivo. Si el
// dispositivo no tiene ninguna voz italiana instalada, el navegador hará
// lo que pueda con "it-IT" (normalmente usa la voz por defecto que tenga,
// aunque no sea ideal) — es una limitación del dispositivo, no de la app.
//
// Los datos que se cargan (traducciones, completar, corregir, etc.) siguen
// viniendo en los mismos campos de siempre (englishWord, englishSentence,
// fraseCorrecta...) — simplemente ahora pueden contener texto en italiano
// si el usuario así arma su JSON; el campo no cambia de nombre.

const TARGET_LANG_STORAGE_KEY = "englishTrainerTargetLanguage";

const LANGUAGES = {
  en: { code: "en", flag: "🇬🇧", label: "Inglés", labelLower: "inglés", ttsLang: "en-US" },
  it: { code: "it", flag: "🇮🇹", label: "Italiano", labelLower: "italiano", ttsLang: "it-IT" },
};

// Locale "exacto" preferido por idioma, para elegir voces de TTS. Lo usan
// dictado.js y seleccionar.js (se define una sola vez acá para no
// duplicar el mismo nombre de constante en dos archivos que terminan
// concatenados en el mismo scope).
export const PREFERRED_LOCALE = {
  en: ["en-us", "en_us"],
  it: ["it-it", "it_it"],
};

let _targetLang = "en";
try {
  const saved = window.localStorage?.getItem(TARGET_LANG_STORAGE_KEY);
  if (saved && LANGUAGES[saved]) _targetLang = saved;
} catch (e) { /* localStorage no disponible */ }

const _listeners = [];

export function getTargetLanguage() {
  return _targetLang;
}

export function getTargetLangMeta() {
  return LANGUAGES[_targetLang];
}

export function setTargetLanguage(lang) {
  if (!LANGUAGES[lang] || lang === _targetLang) return;
  _targetLang = lang;
  try { window.localStorage?.setItem(TARGET_LANG_STORAGE_KEY, lang); } catch (e) { /* noop */ }
  _listeners.forEach((fn) => { try { fn(_targetLang); } catch (e) { /* noop */ } });
}

export function toggleTargetLanguage() {
  setTargetLanguage(_targetLang === "en" ? "it" : "en");
}

// La lógica principal puede suscribirse para re-renderizar la pantalla
// actual apenas cambie el idioma objetivo.
export function onTargetLanguageChange(fn) {
  if (typeof fn === "function") _listeners.push(fn);
}

// =========================================================================
// Voz preferida por idioma (elegida a mano por el usuario)
// =========================================================================
// La selección automática de voz (ver dictado.js/seleccionar.js) hace lo
// mejor que puede, pero en algunos dispositivos con varios motores de voz
// instalados no hay forma de saber desde el código cuál "suena mejor". Por
// eso se le da al usuario la opción de elegir una voz concreta una sola
// vez (con un botón de "Probar" para escucharla antes) y la app la
// recuerda siempre para ese idioma — así queda garantizado que solo suene
// esa voz, sin importar qué otras voces reporte el navegador.
const PREFERRED_VOICE_STORAGE_PREFIX = "englishTrainerPreferredVoice_";
const _voiceListeners = [];

export function getPreferredVoiceURI(langCode) {
  try { return window.localStorage?.getItem(PREFERRED_VOICE_STORAGE_PREFIX + langCode) || null; }
  catch (e) { return null; }
}

export function setPreferredVoiceURI(langCode, voiceURI) {
  try {
    if (voiceURI) window.localStorage?.setItem(PREFERRED_VOICE_STORAGE_PREFIX + langCode, voiceURI);
    else window.localStorage?.removeItem(PREFERRED_VOICE_STORAGE_PREFIX + langCode);
  } catch (e) { /* noop */ }
  _voiceListeners.forEach((fn) => { try { fn(langCode); } catch (e) { /* noop */ } });
}

// Los módulos de audio (dictado.js, seleccionar.js) se suscriben para
// invalidar su caché de voz apenas el usuario elija o quite una voz
// manual, sin esperar a que también cambie el idioma.
export function onPreferredVoiceChange(fn) {
  if (typeof fn === "function") _voiceListeners.push(fn);
}

// Todas las voces del sistema cuyo idioma empieza con el prefijo dado
// (p.ej. "it" trae it-IT, it-CH, etc.), para mostrarlas en el selector.
export function listVoicesForLanguage(langCode) {
  if (!("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.filter((v) => new RegExp("^" + langCode, "i").test(v.lang));
}

// Busca, dentro de una lista de voces ya obtenida, la voz preferida
// guardada para ese idioma (o null si no hay ninguna guardada, o si la
// guardada ya no existe en este dispositivo/navegador).
export function findPreferredVoice(voices, langCode) {
  const uri = getPreferredVoiceURI(langCode);
  if (!uri) return null;
  return voices.find((v) => v.voiceURI === uri) || null;
}

// Aplica la voz preferida (si hay una guardada) a una utterance ya creada.
// Útil para los módulos que no eligen voz por sí mismos (traduccion.js,
// corregir.js) y simplemente dejan que el navegador use su voz por
// defecto para ese idioma.
export function applyPreferredVoice(utterance, langCode) {
  if (!("speechSynthesis" in window)) return;
  const voice = findPreferredVoice(window.speechSynthesis.getVoices() || [], langCode);
  if (voice) utterance.voice = voice;
}