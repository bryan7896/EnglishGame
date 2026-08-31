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