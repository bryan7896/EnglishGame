# Juego de ordenamiento — notas de la entrega (v2, intercalado)

## Cambio respecto a la primera entrega
Antes las 3 tarjetas de ordenamiento viajaban pegadas, justo antes de su
traducción (bloque fijo). Ahora NO: cada una se mezcla por su cuenta en
cualquier parte del banco — se pueden intercalar con completar, corregir,
con las de otra traducción, etc. Lo único que se garantiza es que las 3
queden en alguna posición anterior a su traducción (nunca después, pase
lo que pase con el resto de la mezcla).

Ejemplo real de una corrida de la simulación (T1/T2 = dos traducciones
distintas que entraron juntas al banco, cada una con sus 3 de ordenamiento):

```
1.  Ordenamiento (frase T1)
2.  Completar
3.  Ordenamiento (frase T2)
4.  Corregir
5.  Ordenamiento (frase T1)
6.  Seleccionar
7.  Ordenamiento (frase T2)
8.  Ordenamiento (frase T1)
9.  Traducción T1
10. Dictado
11. Ordenamiento (frase T2)
12. Traducción T2
```
Cada "Ordenamiento (frase T1)" queda en una posición distinta, mezclado
con lo demás, y las tres caen en algún punto antes de "Traducción T1"
(ídem T2) — pero nunca pegadas entre sí a la fuerza ni en un orden fijo.

## Archivo nuevo
- `exercises/ordenamiento.js`
  Arma el ejercicio a partir de uno de traducción (misma frase
  español/inglés), tokeniza el inglés en minúsculas y sin puntuación,
  renderiza las fichas, y maneja el arrastre con Pointer Events (sirve
  para mouse y para touch). Audio de cada palabra al tomarla y de la
  frase completa al resolverse.

## Archivos modificados
- `build.py`: `exercises/ordenamiento.js` al diccionario de módulos
  (placeholder `__ORDENAMIENTO_JS__`, justo después de `__TRADUCCION_JS__`)
  y una rama en `formatReportEntryLines` para el informe.
- `mapa/map.js`: ícono (🔀) y nombre ("Ordenar") del tipo.
- `reels/reels-core.js` (el cambio principal está acá):
  - `rlMezclarEnBanco(...)`: por cada traducción que entra al banco,
    inserta sus 3 tarjetas de ordenamiento CADA UNA por separado, en una
    posición al azar, restringida a quedar antes de donde cayó la
    traducción (el límite se recalcula tras cada inserción). El resto de
    ítems nuevos se sigue mezclando exactamente igual que antes.
  - `ex.origenUid`: cada tarjeta de ordenamiento queda etiquetada con el
    `uid` de SU traducción, para poder identificarla después.
  - `rlOrdenAntesDeSuTraduccion(...)`: pasada de seguridad que corre
    después de `rlCorregirRachas` (el corrector que evita 3 iguales
    seguidas). Si ese corrector llegó a intercambiar una tarjeta de
    ordenamiento con algo ubicado después de su traducción, la reubica al
    azar en algún punto anterior. Así la regla "siempre antes" queda
    garantizada pase lo que pase con el resto de la mezcla. (Probado con
    una simulación de 2000 corridas: 0 violaciones.)
  - `case "ordenamiento"` en `rlRenderEjercicio` + `"ordenamiento"` en
    `rlTextoObjetivo` (sin cambios respecto a la v1).
- `styles/main.css`: sección "14. ORDENAMIENTO" (sin cambios respecto a
  la v1) — fichas `.ord-pill` (fondo `#cef1f9`), resaltado al arrastrar
  `.ord-hover` (`#bcffbb`), ficha fantasma `.ord-ghost` (opacidad 50%) y
  estado resuelto `.ord-row-solved` (fondo `#d7f4ff` con sombra interior).

## Qué no toqué
- El viejo "mapa" de nodos no arma este flujo — solo Reels.
- No se agregó al importador manual de JSON del menú (📥): estas tarjetas
  solo se generan automáticamente a partir de una traducción existente.
- `python3 build.py` corrí localmente para confirmar que no rompe el
  armado de `index.html`, y además corrí una simulación aparte en Node
  (sin tocar el repo) solo para validar el algoritmo de mezcla antes de
  entregarlo — no probé el juego en el navegador.

## Cómo aplicar
Copia el contenido de `nuevos/` y `modificados/` sobre las mismas rutas
del repo y corre tu `python3 build.py` de siempre.
