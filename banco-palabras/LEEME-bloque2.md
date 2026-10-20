# Banco de palabras — Bloque 2 (palabras clickeables + modal completo)

Sigue al bloque 1. Agrega 3 archivos nuevos a `banco-palabras/` y modifica
3 archivos YA existentes de tu proyecto (`exercises/traduccion.js`,
`exercises/completar.js`, `exercises/corregir.js` — vienen completos en
este zip, reemplaza los tuyos).

## Archivos nuevos

- **`banco-palabras-tokenize.js`**: parte el texto en español en
  palabras/separadores y marca clickeables las de 3+ letras (único
  filtro, como confirmaste). Probado.
- **`banco-palabras-ui.js`**: todo el flujo de modales — click en una
  palabra → confirmar (con ‹ › para moverse a la palabra anterior/
  siguiente del mismo texto, y la palabra activa en azul mientras el
  modal está abierto) → resultado del diccionario → "Aprender" (sentidos
  agrupados por tipo gramatical, ejemplos seleccionables con ✏️ para
  editar, contadores de "Oraciones seleccionadas"/"Oraciones en
  sistema") → "Almacenar en Banco de palabras".
- **`banco-palabras.css`**: estilos, reusando tus propias variables
  (`--surface`, `--ink`, `--brand`, etc.) y la clase `.modal-friend` que
  ya usan el resto de tus modales, para que no se note que es nuevo. La
  palabra clickeable no cambia de apariencia (solo cursor); al abrir su
  modal se pone azul (`--info`).

## Qué probé (sin navegador real, con jsdom simulando el DOM)

- Tokenizado: "Él cambió de tema." → solo "cambió" y "tema" quedan
  clickeables ("Él"/"de" tienen <3 letras). ✔️
- Flujo completo: click → modal de confirmación → buscar (con la API
  simulada) → resultado → Aprender → seleccionar un ejemplo → guardar →
  queda en Banco de palabras con la oración elegida MÁS las "oraciones en
  sistema" encontradas automáticamente. ✔️
- Navegación ‹ › entre palabras del mismo texto, con el resaltado azul
  moviéndose correctamente y quitándose al cerrar. ✔️
- Editar con el lápiz ✏️: abre el sub-modal, guarda el texto editado, y
  lo selecciona automáticamente (como pediste). ✔️
- Integración real en los 3 archivos modificados: confirmé con un import
  real de `traduccion.js`/`completar.js`/`corregir.js` que ahora usan
  `BancoPalabrasUI.html(...)` y llaman `BancoPalabrasUI.activar(...)`.
  **De paso corregí algo que no pediste pero encontré**: `completar.js`
  metía `spanishWord` crudo (sin escapar) en el HTML; ahora pasa por el
  mismo escape que los otros dos.

## Lo que NO alcancé a probar (porque no hay navegador real aquí)

- Que se vea bien / responsive en el celular — toca que lo revises tú en
  el navegador real.
- Que el click funcione igual cuando el ejercicio está dentro de Reels
  (debería, porque `activar()` es independiente de dónde esté el
  contenedor, pero no tengo cómo montar Reels en este entorno).

## Pendiente (bloques 3-4)

- La tarjeta + tabla de "Banco de palabras" en el home (con el botón
  "key" y el borrado automático visible).
- La sorpresa nueva en Reels.
- Pegar todo esto en `build.py`/`build_template.py` para que quede
  embebido en `index.html` (por ahora son archivos sueltos para que los
  revises).

Sigo con el bloque 3 (tarjeta + tabla del home) salvo que me digas algo
distinto.
