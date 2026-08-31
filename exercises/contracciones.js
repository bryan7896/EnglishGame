// exercises/contracciones.js
//
// Módulo compartido de contracciones en inglés. Se usa desde traduccion.js,
// completar.js, corregir.js, dictado.js y seleccionar.js para que "i have"
// y "i've" (o "i am" / "i'm", "do not" / "don't", etc.) se acepten como LA
// MISMA respuesta, sin importar cuál de las dos formas espera el ejercicio
// y cuál de las dos escriba el usuario.
//
// A propósito NO se usa vía informacion.js: ese nodo ("Práctica inicial")
// debe seguir validando de forma estricta/normal como hasta ahora.
//
// La misma data vive también en /contracciones.json (por si se quiere
// editar o reutilizar el listado fuera de la app). Aquí se repite como
// objeto JS plano para que la PWA funcione 100% offline sin depender de un
// fetch adicional al archivo .json.

// expanded (forma completa) -> contracted (forma contraída)
export const CONTRACTIONS_MAP = {

  "i am": "i'm", "you are": "you're", "we are": "we're", "they are": "they're",

  "he is": "he's", "she is": "she's", "it is": "it's", "that is": "that's",

  "there is": "there's", "here is": "here's", "who is": "who's", "what is": "what's",

  "where is": "where's", "when is": "when's", "why is": "why's", "how is": "how's",

  "there are": "there're", "who are": "who're", "what are": "what're",
  "where are": "where're", "when are": "when're", "why are": "why're",
  "how are": "how're",

  "i have": "i've", "you have": "you've", "we have": "we've", "they have": "they've",

  "he has": "he's", "she has": "she's", "it has": "it's", "there has": "there's",

  "who has": "who's", "what has": "what's",

  "there have": "there've", "who have": "who've", "what have": "what've",
  "where have": "where've", "when have": "when've", "why have": "why've",
  "how have": "how've",

  "i had": "i'd", "i would": "i'd", "you had": "you'd", "you would": "you'd",

  "he had": "he'd", "he would": "he'd", "she had": "she'd", "she would": "she'd",

  "it had": "it'd", "it would": "it'd", "we had": "we'd", "we would": "we'd",

  "they had": "they'd", "they would": "they'd", "who had": "who'd",
  "who would": "who'd", "what had": "what'd", "what would": "what'd",
  "where had": "where'd", "where would": "where'd",
  "when had": "when'd", "when would": "when'd",
  "why had": "why'd", "why would": "why'd",
  "how had": "how'd", "how would": "how'd",

  "there had": "there'd", "there would": "there'd",
  "that had": "that'd", "that would": "that'd",

  "i will": "i'll", "you will": "you'll", "he will": "he'll", "she will": "she'll",

  "it will": "it'll", "we will": "we'll", "they will": "they'll", "that will": "that'll",

  "there will": "there'll", "who will": "who'll", "what will": "what'll",
  "where will": "where'll", "when will": "when'll", "why will": "why'll",
  "how will": "how'll",

  "do not": "don't", "does not": "doesn't", "did not": "didn't",

  "is not": "isn't", "are not": "aren't", "was not": "wasn't", "were not": "weren't",

  "have not": "haven't", "has not": "hasn't", "had not": "hadn't",

  "will not": "won't", "would not": "wouldn't",

  "can not": "can't", "cannot": "can't", "could not": "couldn't",

  "should not": "shouldn't", "must not": "mustn't", "might not": "mightn't",

  "need not": "needn't", "ought not": "oughtn't", "shall not": "shan't",

  "dare not": "daren't",

  "should have": "should've", "would have": "would've", "could have": "could've",

  "might have": "might've", "must have": "must've",

  "let us": "let's",

  "you all": "y'all",

  "am not": "ain't", "is not": "ain't", "are not": "ain't",
  "have not": "ain't", "has not": "ain't",
};

// Precalculamos las expresiones regulares una sola vez. Se ordenan por
// cantidad de palabras (y longitud) de forma descendente para que frases
// más largas/específicas se evalúen antes que sub-frases más cortas.
const _CONTRACTION_REGEXES = Object.keys(CONTRACTIONS_MAP)
  .sort((a, b) => (b.split(' ').length - a.split(' ').length) || (b.length - a.length))
  .map((expanded) => ({
    regex: new RegExp('\\b' + expanded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b', 'gi'),
    replacement: CONTRACTIONS_MAP[expanded],
  }));

/**
 * Normaliza un texto colapsando toda forma completa ("i have", "do not",
 * "should have", etc.) a su forma contraída equivalente ("i've", "don't",
 * "should've"...). También unifica los distintos tipos de apóstrofe
 * (’ ‘ ' ) a uno solo, para que no falle por eso.
 *
 * Al aplicar esto TANTO al texto esperado como a lo que escribió el
 * usuario antes de comparar, "i have" y "i've" terminan siendo
 * exactamente el mismo string normalizado -> se aceptan como iguales en
 * ambos sentidos, sin importar cuál de las dos formas puso cada quien.
 *
 * IMPORTANTE: esta función es solo para la LÓGICA DE VALIDACIÓN interna.
 * Nunca se debe usar su resultado para sobreescribir lo que el usuario
 * escribió en pantalla (el input, el textarea, ni el texto que se le
 * muestra de vuelta) — eso debe seguir mostrando exactamente lo que él
 * tecleó.
 */
export function normalizeContractions(text) {
  let result = String(text || '').replace(/[’‘]/g, "'");
  for (const { regex, replacement } of _CONTRACTION_REGEXES) {
    result = result.replace(regex, replacement);
  }
  return result;
}

/**
 * Compara dos frases/palabras aceptando forma completa y forma contraída
 * como equivalentes, además de mayúsculas/minúsculas y espacios extra.
 * Útil para comparaciones simples (una sola palabra o frase completa).
 */
export function contractionAwareEquals(a, b) {
  const norm = (s) => normalizeContractions(String(s || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return norm(a) === norm(b);
}
