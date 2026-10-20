# Banco de palabras — Bloque 3 (tarjeta + tabla del home)

Nuevo archivo: **`banco-palabras-screen.js`**. Pinta la pantalla con la
tabla pedida:

```
Palabra | #Data | VP | 🗑️ | ⏸️ | fecha
```

- `#Data` = cuántas oraciones tiene guardadas esa palabra.
- `⏸️` es un checkbox: tildado = activa (por defecto), destildado = pausada.
- `🗑️` borra la palabra entera.
- `fecha` = última vez practicada; la tabla ordena de más vieja a más
  nueva (como pediste).
- Botón **"key"** arriba, abre un modal para pegar/guardar la key del
  diccionario (se pone un ✓ junto al botón cuando ya hay una guardada).
- El borrado automático al pasar VP > 50 ya lo hace `banco-palabras-
  data.js` (bloque 1) solo — esta pantalla no tiene que hacer nada
  especial, simplemente no vuelve a mostrar esa palabra la próxima vez
  que se abra.

Probado con jsdom: tabla con los datos correctos, pausar, borrar
(desaparece de la tabla), y el modal de key guardando y mostrando el ✓.

## Esto sí me faltó por integrar (son cambios dentro de tu `index.html`,
## demasiado puntuales para "adivinarlos" sin el archivo delante;
## quedan documentados al final de `banco-palabras-screen.js` también):

1. El botón/tarjeta del home. Va **justo después** del botón de
   Irregulares (línea ~3601 de tu `index.html`):
   ```html
   <button class="home-tile home-tile-banco" id="homeBancoPalabrasBtn">
     <span class="home-tile-ico">📚</span>
     <span><b>Banco de palabras</b><small>Guarda y repasa tus propias palabras</small></span>
   </button>
   ```
2. Que sea "solo inglés": en `updateHelpBtnVisibility()` (línea ~13179),
   agregar `"homeBancoPalabrasBtn"` al arreglo que ya oculta Irregulares/
   Juego/Listening/Azure en italiano.
3. Una screen nueva (`<div id="bancoPalabrasScreen" class="screen">`,
   mismo patrón que las demás) + el click de `homeBancoPalabrasBtn` que la
   muestre y llame `BancoPalabrasScreen.render(...)` sobre ese div (para
   que la tabla salga siempre actualizada al entrar).

No lo hice directo sobre tu `index.html` en este bloque porque implica
tocar el archivo de ~13 mil líneas sin poder probarlo en un navegador
real desde aquí — prefiero dejarlo documentado y hacerlo junto con el
bloque 5 (cuando toque `build.py`/`build_template.py` de una vez), para
no andar editando el mismo archivo gigante en varias pasadas sueltas.

Sigo con el bloque 4: la sorpresa nueva en Reels.
