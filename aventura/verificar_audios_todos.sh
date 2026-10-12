#!/usr/bin/env bash
# VERIFICA QUE ESTEN TODOS LOS AUDIOS DE LA AVENTURA y escribe reporte_audios.txt
#
# Revisa:
#   - cada mp3 que piden las misiones compiladas (data/compilado/m*.json), historia por historia
#   - cada mp3 de frases.json (si existe)
#   - que ningun mp3 este vacio o danado (cabecera que no es MP3)
#   - mp3 sobrantes en la carpeta de audios que nadie usa
#
# Uso (desde la carpeta aventura/):
#   bash verificar_audios_todos.sh            # carpeta de audios: ./audio
#   bash verificar_audios_todos.sh otra/ruta  # otra carpeta de audios
# Sale con codigo 0 si todo esta bien y 1 si falta o esta danado algun audio.
# Compatible con el bash 3.2 de macOS (no usa arreglos asociativos).

set -u
export LC_ALL=C
cd "$(dirname "$0")" || exit 2

AUDIO_DIR="${1:-audio}"
REPORTE="reporte_audios.txt"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -d "$AUDIO_DIR" ]; then
  echo "No existe la carpeta de audios: $AUDIO_DIR" | tee "$REPORTE"
  exit 1
fi

# --- 1. audios esperados, por historia
: > "$TMP/esperados_todos"
: > "$TMP/por_historia"
for f in data/compilado/m*.json; do
  [ -e "$f" ] || continue
  mid="$(basename "$f" .json)"
  grep -o '"file"[[:space:]]*:[[:space:]]*"[^"]*\.mp3"' "$f" | sed 's/.*"\([^"]*\.mp3\)"/\1/' | sort -u > "$TMP/m_$mid"
  cat "$TMP/m_$mid" >> "$TMP/esperados_todos"
  echo "$mid" >> "$TMP/por_historia"
done
if [ -f frases.json ]; then
  grep -o '"nameFile"[[:space:]]*:[[:space:]]*"[^"]*\.mp3"' frases.json | sed 's/.*"\([^"]*\.mp3\)"/\1/' | sort -u > "$TMP/frases"
  cat "$TMP/frases" >> "$TMP/esperados_todos"
else
  : > "$TMP/frases"
fi
sort -u "$TMP/esperados_todos" -o "$TMP/esperados_todos"

# --- 2. audios presentes
( cd "$AUDIO_DIR" && ls -1 | grep -i '\.mp3$' ) | sort -u > "$TMP/presentes"

# --- 3. faltantes, danados y sobrantes
comm -23 "$TMP/esperados_todos" "$TMP/presentes" > "$TMP/faltan"
comm -13 "$TMP/esperados_todos" "$TMP/presentes" > "$TMP/sobran"
: > "$TMP/danados"
while IFS= read -r a; do
  p="$AUDIO_DIR/$a"
  [ -f "$p" ] || continue
  tam=$(wc -c < "$p" | tr -d ' ')
  if [ "$tam" -lt 1000 ]; then
    echo "$a  (tamano $tam bytes)" >> "$TMP/danados"; continue
  fi
  cab=$(head -c 3 "$p" | od -An -tx1 | tr -d ' \n')
  case "$cab" in
    494433*|fff*|ffe*) ;;                          # ID3 o trama MPEG
    *) echo "$a  (no parece MP3: cabecera $cab)" >> "$TMP/danados" ;;
  esac
done < <(comm -12 "$TMP/esperados_todos" "$TMP/presentes")

n_esp=$(wc -l < "$TMP/esperados_todos" | tr -d ' ')
n_pre=$(comm -12 "$TMP/esperados_todos" "$TMP/presentes" | wc -l | tr -d ' ')
n_fal=$(wc -l < "$TMP/faltan" | tr -d ' ')
n_dan=$(wc -l < "$TMP/danados" | tr -d ' ')
n_sob=$(wc -l < "$TMP/sobran" | tr -d ' ')

{
  echo "REPORTE DE AUDIOS - AVENTURA"
  echo "=================================================="
  echo "Fecha:                 $(date '+%Y-%m-%d %H:%M')"
  echo "Carpeta de audios:     $AUDIO_DIR"
  echo "Audios esperados:      $n_esp"
  echo "Encontrados:           $n_pre"
  echo "Faltantes:             $n_fal"
  echo "Danados o vacios:      $n_dan"
  echo "Sobrantes (sin uso):   $n_sob"
  echo
  echo "POR HISTORIA (encontrados / esperados)"
  while IFS= read -r mid; do
    tot=$(wc -l < "$TMP/m_$mid" | tr -d ' ')
    ok=$(comm -12 "$TMP/m_$mid" "$TMP/presentes" | wc -l | tr -d ' ')
    marca="OK"; [ "$ok" -lt "$tot" ] && marca="FALTAN $((tot - ok))"
    printf "  %-6s %4s / %-4s %s\n" "$mid" "$ok" "$tot" "$marca"
  done < "$TMP/por_historia"
  if [ -s "$TMP/frases" ]; then
    tot=$(wc -l < "$TMP/frases" | tr -d ' ')
    ok=$(comm -12 "$TMP/frases" "$TMP/presentes" | wc -l | tr -d ' ')
    printf "  %-6s %4s / %-4s\n" "frases" "$ok" "$tot"
  fi
  echo
  if [ "$n_fal" -gt 0 ]; then
    echo "FALTANTES ($n_fal) - agrupados por historia:"
    while IFS= read -r mid; do
      comm -12 "$TMP/m_$mid" "$TMP/faltan" > "$TMP/f_$mid"
      if [ -s "$TMP/f_$mid" ]; then
        echo "  [$mid]"
        sed 's/^/    - /' "$TMP/f_$mid"
      fi
    done < "$TMP/por_historia"
    cat "$TMP"/m_* 2>/dev/null | sort -u > "$TMP/en_misiones"
    comm -23 "$TMP/faltan" "$TMP/en_misiones" > "$TMP/f_solo_frases"
    if [ -s "$TMP/f_solo_frases" ]; then
      echo "  [solo en frases.json]"
      sed 's/^/    - /' "$TMP/f_solo_frases"
    fi
    echo
  fi
  if [ "$n_dan" -gt 0 ]; then
    echo "DANADOS O VACIOS ($n_dan) - borralos y vuelve a generarlos:"
    sed 's/^/  - /' "$TMP/danados"
    echo
  fi
  if [ "$n_sob" -gt 0 ]; then
    echo "SOBRANTES ($n_sob) - no los usa ninguna historia (puedes borrarlos o dejarlos):"
    sed 's/^/  - /' "$TMP/sobran"
    echo
  fi
  if [ "$n_fal" -eq 0 ] && [ "$n_dan" -eq 0 ]; then
    echo "RESULTADO: TODO BIEN. Estan todos los audios."
  else
    echo "RESULTADO: HAY PROBLEMAS. Corre:  python generar_audio_tts.py   y vuelve a verificar."
  fi
} > "$REPORTE"

tail -n 1 "$REPORTE"
echo "Reporte completo en: $(pwd)/$REPORTE"
[ "$n_fal" -eq 0 ] && [ "$n_dan" -eq 0 ]
