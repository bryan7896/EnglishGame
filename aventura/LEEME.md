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
