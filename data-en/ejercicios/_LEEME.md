# data/ejercicios/ — banco de ejercicios del proyecto

Todos los archivos `.json` que pongas en esta carpeta se combinan en UNA sola
base de ejercicios cuando corres `python build.py` (no importa cuántos
archivos sean ni cómo los nombres — puedes tener 1 o 50). Así puedes ir
agregando tandas nuevas (`tanda-K.json`, `tanda-L.json`...) sin tocar los
archivos anteriores, y sin que el .json de cada tanda se vuelva gigante.

## Por qué varios archivos y no uno solo

Con miles de ejercicios, un único archivo se vuelve difícil de editar y de
revisar en diffs. build.py los lee todos, les asigna un `id` único global
(si no le pones uno tú) y arma internamente una sola lista combinada que la
app usa como si siempre hubiera sido un solo archivo.

## Formato de cada archivo

Mismas 5 claves de siempre (todas opcionales), más `reglaIds` en cada ítem
para asociarlo a una o varias reglas de `data/reglas-gramaticales.json`
(un ejercicio puede pertenecer a 2+ reglas a la vez):

```json
{
  "traducciones": [
    { "spanishWord": "Ella ha vivido aquí desde 2020", "englishWord": "She has lived here since 2020", "reglaIds": [10, 34] }
  ],
  "completar": [
    { "spanishWord": "...", "englishSentence": "She ___ here since 2020", "options": ["has lived"], "reglaIds": [10] }
  ],
  "seleccionar": [
    { "pairs": [{ "englishWord": "since", "spanishWord": "desde" }, { "englishWord": "for", "spanishWord": "durante" }], "reglaIds": [34] }
  ],
  "corregir": [
    { "fraseConError": "She have lived here since 2020", "fraseCorrecta": "She has lived here since 2020", "spanishPhrase": "Ella ha vivido aquí desde 2020", "reglaIds": [10, 20] }
  ],
  "dictado": [
    { "text": "She has lived here since 2020", "reglaIds": [10, 34] }
  ]
}
```

Notas:

- `reglaIds` es opcional; si lo omites, el ejercicio simplemente no aparece
  en el flujo de "Seleccionar reglas a estudiar" (pero sigue disponible si
  algún día vuelve a existir un import manual con ese archivo).
- **`seleccionar` cambia de forma** respecto al import manual clásico: en
  vez de ser directamente un array de pares, aquí cada ítem es un objeto
  `{ "pairs": [...], "reglaIds": [...] }` — así se le puede asociar
  `reglaIds` igual que a los demás tipos.
- `dictado` acepta tanto texto plano dentro de un objeto (`{"text": "...",
  "reglaIds": [...]}`) como antes un string suelto (sin reglaIds, en ese
  caso no participará del flujo de selección por regla).
- `id` es opcional: si no lo pones, build.py genera uno estable
  (`tipo_número_nombreDeArchivo`) al reconstruir. Si le pones uno tú mismo,
  asegúrate de que sea único en todo el proyecto.
- Este archivo (`_LEEME.md`) y cualquier otro que no termine en `.json` es
  ignorado por build.py.

Puedes borrar el archivo `_ejemplo.json` de esta carpeta, es solo una
muestra de referencia con reglaIds ya asociados a modo de ejemplo.
