# Banco de palabras — Bloque 1 (datos + diccionario + búsqueda en sistema)

Esta carpeta `banco-palabras/` es nueva. Trae 3 módulos, ya probados con
pruebas unitarias en Node (lógica pura, sin UI todavía):

## 1. `banco-palabras-data.js`
Capa de datos (solo inglés). Guarda en su propia llave de localStorage
(`englishTrainerBancoPalabras_v1`), igual de independiente que el
Listening Trainer. Expone `window.BancoPalabrasData` con:
`listar()`, `obtener(palabra)`, `activas()`, `guardarPalabra(...)`,
`editarOracion(...)`, `borrarOracion(...)`, `setPausado(...)`,
`borrarPalabra(...)`, `registrarPractica(palabra, cuantos)` (aplica el
borrado automático cuando VP > 50), `getApiKey()/setApiKey()`.

Probado: guardar palabra, evitar duplicar oraciones repetidas, pausar,
y el autoborrado al superar 50 VP. Todo pasó.

## 2. `banco-palabras-api.js`
Cliente del Spanish-English Dictionary API de Merriam-Webster, pero
consultando DIRECTO la palabra en español (no hay que alinearla con el
inglés del ejercicio, como confirmaste). Flujo:
1. Consulta la palabra en español → resuelve el headword en inglés.
2. Con ese headword, trae el detalle rico (sentidos, ejemplos, frases,
   formas, audio) reusando la misma lógica ya probada de tu
   `dictionaryapi.html` (ahí sí consultaba en inglés).

**Actualización:** ya probé `normalizeReverse()` contra la respuesta real
que me pasaste para "cambiar" → resuelve correctamente `englishHeadword:
"change"` (incluyendo quitarle el "to " de infinitivo y los paréntesis
que trae `shortdef`, p.ej. "to change (money)"). Si de todos modos algún
día una palabra sale rara, sigue disponible:
```js
BancoPalabrasAPI.debugRaw("esapalabra").then(console.log)
```
para revisar el JSON crudo.

## 3. `banco-palabras-buscar-sistema.js`
"Oraciones en sistema": busca, entre TODOS los ejercicios ya cargados en
memoria (`currentStudyExercises()`, los mismos que usa el resto de la
app), las oraciones de tipo traducción y completar que contienen alguna
forma de la palabra — tal como pediste, solo esos dos tipos, no
corrección ni dictado. No hace falta ningún índice aparte: reutiliza el
banco que el build ya deja en memoria.

**Pendiente, a propósito:** no toca `irregulares/verbos-irregulares.json`
(vive en otra estructura/carpeta); si quieres que el banco de palabras
también rastree ahí, lo armo aparte una vez vea ese formato.

## Qué sigue (bloques 2-4, aún no hechos)
- Hacer clickeables las palabras (≥3 letras) en el texto en español de
  `traduccion.js`, `completar.js` y `corregir.js`, sin tocar su
  apariencia, solo cuando el idioma activo es inglés.
- El modal de confirmación → resultado → "Aprender" → selección de
  oraciones con lápiz ✏️ → "Almacenar en Banco de palabras".
- La tarjeta nueva en el home (debajo de Irregulares) + la tabla
  (Palabra | #Data | VP | 🗑️ | ⏸️ | fecha) + botón "key".
- La sorpresa nueva en Reels (4 ejercicios rosas) usando
  `traduccion.js`/`completar.js` reales.
- Tocar `build.py`/`build_template.py` para que todo esto quede embebido
  en `index.html` como el resto de módulos.

Voy a seguir con esto en el siguiente bloque salvo que quieras ajustar
algo de lo de arriba primero.
