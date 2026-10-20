# Banco de palabras — Bloque 4 (sorpresa nueva en Reels)

Modifiqué tu **`reels/reels-sorpresas.js`** (viene completo en el zip,
reemplaza el tuyo) y agregué el acento rosa a `banco-palabras.css`.

## Qué hace

- "Banco de palabras" entra a la rotación de sorpresas de Reels (Feature
  4, "espacio") como una más — tal como confirmaste. Automáticamente
  aparece también en el menú **⚙️ Configurar reels** (con su interruptor
  on/off y sus niveles 1-4), porque ese modal ya recorre la lista de
  tipos sola, no tuve que tocar nada ahí.
- Solo se ofrece como candidata si el idioma activo es inglés y hay al
  menos una palabra activa (no pausada) con alguna oración guardada.
- Cada vez que le toca: sortea 4 pasos en el orden fijo que pediste —
  **completar, traducir, completar, traducir**. Cada paso elige una
  palabra activa al azar (si solo hay una palabra en el banco, las 4
  caen en esa misma, como pediste) y una de sus oraciones guardadas.
- Usa literalmente `renderCompletarExercise`/`renderTraduccionExercise`
  y sus modales de resultado (`showCompletarModal`/
  `showComparativeModal`) — los mismos componentes del resto del juego,
  como pediste. Solo cambia el acento visual rosa (`.bp-reels-exercise`).
- Si el usuario falla y toca "🧠 Repasar luego": en vez de mandarlo a la
  cola principal de Reels (que es lo que hace esa misma opción en un
  ejercicio normal), ese paso se repite más adelante **dentro de este
  mismo "espacio"** — un 5to (o 6to, 7mo...) ejercicio del mismo lote,
  como pediste explícitamente.
- Cada ejercicio resuelto (acertado o no) suma 1 al contador VP de esa
  palabra en la tabla del Banco de palabras (vía `registrarPractica`,
  que ya trae el autoborrado al pasar 50 — bloque 1).

## Cómo lo probé

No hay forma de montar el motor completo de Reels fuera del navegador
real, así que simulé el archivo con un sandbox de Node (`vm`) con todas
sus dependencias externas mockeadas (RL, rlCabecera, etc.) y SIN
mockear las funciones del propio archivo. Con eso comprobé:

- `rlBancoPalabraAleatoria()` con una sola palabra activa siempre la
  devuelve.
- Un paso "completar" tapa exactamente la forma correcta de la oración
  (`englishSentence` con un solo `___`, `options` con esa forma).
- El plan siempre sale en el orden completar→traducir→completar→traducir.
- Recorrí los 4 pasos simulando que el usuario responde: en el primero
  pedí "Repasar luego" → el plan pasó de 4 a 5 pasos y siguió desde el
  paso 1 (no se reinició ni se saltó nada). Terminé los 5 y confirmé que
  al final se llama de verdad a la función real `rlSorpresaHecha` del
  propio archivo (quedó `RL.ultSorpresa = "banco"`), que es la que avisa
  a Reels que ya se acabó esta tarjeta y sigue con la siguiente.
- `registrarPractica` se llamó exactamente 5 veces (una por cada paso
  completado, incluido el repetido).

## Pendiente real

Todo lo de código de este bloque quedó hecho y probado a este nivel.
Lo único que falta — y es system, no de este bloque — es el **bloque 5**:
pegar los botones/screen del home (bloque 3) en tu `index.html` de
verdad y, si quieres, dejar todo esto embebido vía `build.py` en lugar
de como archivos sueltos cargados aparte. ¿Seguimos con eso, o prefieres
primero probar tú los bloques 1-4 en tu copia real del proyecto (puedo
armarte igual una guía corta de "cómo pegar estos archivos sueltos sin
tocar build.py todavía", para que puedas probarlo ya)?
