# Aventura - entrega 2 (motor jugable)

Estructura (todo dentro de la carpeta `aventura/`):
```
jugar.html            pagina del juego
motor/                motor.js, sonido.js, arte.js (arte PROVISIONAL), estilos.css
data/compilado/       misiones compiladas (las genera compilar_aventura.py)
data/layouts/         donde va cada personaje/objeto en cada escena (x, y, tamano)
audio/                tus mp3 (los 203 de la mision)
```
Jugar: dentro de `aventura/` ejecuta `python3 -m http.server 8000` y abre
`http://localhost:8000/jugar.html` (mejor en horizontal; en el celular de lado).

Parametros utiles: `?m=m001` (mision) - `?debug` (marca la respuesta correcta con data-ok) - `?rapido` (no espera audios; solo pruebas).

Reglas implementadas: audio 1 y 2 = escuchar, 3a pulsacion = muestra el texto (resta 0.5 pts); respuesta mala = el NPC contesta
con una frase de error al azar y sale la hoja NARANJA con 2 opciones; tercer error = se revela la correcta, 0 pts y va a repaso;
estrellas por errores (3 si <=2, 2 si <=5); 2 monedas por turno sin error; el progreso se guarda en localStorage (`aventura_v1`).
Para 120 historias: cada historia nueva = 1 JSON en data/misiones + 1 layout; el elenco y los audios se reutilizan solos.

## Entregas 3-5: biblioteca de arte (carpeta `svg/`)
- `svg/biblioteca.js` (lo único que necesita el juego) · `svg/objetos/` 200 SVG · `svg/caras/` 30 caras sin manos · `svg/accesorios/` · `svg/fondos/` 10 fondos
- `svg/catalogo.html` abre en el navegador y muestra todo. `svg/GUIA_ESTILO.md` y `svg/CREDITOS.md` (atribución Twemoji CC-BY 4.0: obligatoria).
- `construir_svg.py` regenera todo y actualiza `data/objetos_audio.json`. Luego: `python compilar_aventura.py` y `python generar_audio_tts.py`
  (solo genera los ~160 audios nuevos de nombres de objetos; los demás ya existen).
- Orientación: el juego solo se usa en horizontal; en vertical muestra "Turn your phone sideways to play" (no fuerza ninguna orientación).

## Refinamiento de render
- `medir_cajas.py` mide la caja real de cada SVG (`svg/cajas.json`) y `construir_svg.py` recorta el viewBox: la base toca el piso y el ancho `s` del layout es el real.
- Zonas tocables ("hotspots"): una pieza puede anclarse a un punto de otro objeto, p. ej. `"puerta": {"sobre":"house","punto":"puerta"}` (la puerta ya dibujada en la casa; no se duplica).
- Personajes con volumen (torso, brazos con manos, piernas con zapatos), sombras suaves en el piso, variantes de color por recoloreo del SVG (taxi rojo).

## Plan de 40 historias (entrega 1 del plan)
- `data/catalogo_misiones.json`: el plan cerrado (titulo, objetivo, nivel, reglas, escenas, objetos y personajes de cada historia).
- Pantalla de lista: `jugar.html` sin `?m=` muestra las 40 historias con ✓, estrellas, veces jugada, filtros (All / To do / Done)
  y la siguiente recomendada. Una historia se puede jugar cuando su mision compilada aparece en `data/compilado/indice.json`
  (lo escribe `compilar_aventura.py`); las demas salen como "🔒 Soon". Durante una historia, ☰ vuelve a la lista.
- `python validar_aventura.py [--inventario] [--reglas ../data-en/reglas-gramaticales.json]`: revisa nivel A2-B1, reglas por
  mision (minimo 3 turnos por regla planeada), arte faltante y cobertura global por regla (meta 12+). Escribe `reporte_validacion.txt`
  y, con `--inventario`, `INVENTARIO.md`.
- `bash verificar_audios_todos.sh [carpeta]`: comprueba que esten todos los mp3 de todas las historias y de `frases.json`, que no
  esten vacios o danados, y lista los sobrantes. Escribe `reporte_audios.txt`; sale con codigo 1 si falta algo.

## Version final (40 historias) - como dejar todo funcionando
Orden de los pasos, desde la carpeta `aventura/` (el ultimo, desde la raiz del proyecto):
1. `python generar_audio_tts.py`  - genera con Kokoro los audios que falten de `frases.json` (1982 en total; los que ya tienes se saltan).
2. `bash verificar_audios_todos.sh`  - escribe `reporte_audios.txt`. Debe terminar en "RESULTADO: TODO BIEN".
   Si faltan o hay danados: borra los danados, vuelve al paso 1 y verifica otra vez.
3. `cd ..` y `python build.py`  - va DESPUES de generar los audios: el service worker solo guarda para uso sin conexion los mp3 que existen.

Contenido:
- 40 historias (`data/misiones/`), con 12 o mas turnos por cada una de las 51 reglas en total (ver `reporte_validacion.txt`).
- `guiones/`: el texto de todas las historias, turno por turno, con la regla de cada turno y la respuesta correcta marcada.
- `data/errores_intencionales.txt`: formas mal hechas a proposito (bringed, leaved...) que solo pueden aparecer en opciones incorrectas.
- Para agregar o cambiar historias: edita `data/misiones/*.json` y `data/layouts/*.json`, luego `python compilar_aventura.py`,
  `python validar_aventura.py`, y los pasos 1 a 3 de arriba.

## Revision final de dialogos (v15)
- Los turnos de refuerzo (los que se agregaron para llegar a 12+ turnos por regla) estaban todos pegados antes de la ultima
  linea del NPC, y esa linea muchas veces respondia a otra cosa. Se reubicaron uno por uno dentro de cada conversacion y se
  ajustaron o agregaron lineas cortas del NPC para que todo tenga sentido. Ningun turno se perdio: siguen 616 turnos del jugador.
- Errores de contenido corregidos: contradicciones (Kenji "dormido" al subir al bus, Walter con 80 vs 75 anos en el pueblo,
  carne de biblioteca), opciones "fuera de contexto" que en realidad eran respuestas validas, una pregunta del jefe con
  tiempo verbal que no casaba con la respuesta, el resumen de la historia 32 (jarron -> figura de piedra) y el titulo de la 31.
- `frases.json` paso de 3173 a 3205 audios (lineas nuevas o cambiadas). Si ya tenias audios, `generar_audio_tts.py` solo
  genera los que falten; `verificar_audios_todos.sh` lista los sobrantes (puedes borrarlos).
- `guiones/historia_01.txt`: guion de la historia 1, que faltaba.

## Version 16 - el juego es para divertirse, no un examen de gramatica
- Opciones incorrectas: ya no son "la correcta con un error". Ahora son frases reales que Bryan dice en OTRAS historias y que
  no encajan en esa conversacion (no comparten palabras ni tema con el dialogo). Se reutiliza su audio: `frases.json` bajo de
  3205 a 1982 audios. Las genero `distractores.py` (filtros: otra historia, sin palabras ni tema en comun, largo parecido,
  cada frase se usa como maximo 3 veces). `data/errores_intencionales.txt` ya no se usa en ninguna opcion.
- Audio: la opcion suena al seleccionarla; al enviarla ya no se vuelve a reproducir (si aun esta sonando, se espera a que termine).
- Panel del guion (izquierda): muestra el ultimo intercambio correcto, es decir lo que dijo el personaje desde tu respuesta
  anterior y tu respuesta. Se queda igual hasta que vuelves a responder bien y no cambia al pasar de escena. Si fallas tres
  veces, muestra la respuesta correcta que revela el juego. Con ‹ se contrae a la izquierda y con › se abre (se recuerda).
  Negro al 80%, letra blanca pequena y delgada (mismo tamano que el texto de las opciones).
- El boton 🔁 (repetir lo ultimo que dijo el personaje) paso a la esquina inferior izquierda para no chocar con el panel.
