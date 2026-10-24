#!/usr/bin/env python3
"""
generar_song_json.py — Arma el esqueleto de tracklist/song_<lang>_<n>.json
a partir de tracklist/song_<lang>_<n>.txt, siguiendo EXACTO el esquema
documentado en tracklist/NOTAS.md ("Aprender canción").

Qué hace:
  - Lee el .txt (una línea = un `content[].originalPhrase`, un bloque
    separado por línea en blanco = un `segments[]`, que es justo como
    emparejará el .lrc por POSICIÓN según canciones-lrc.js).
  - Arma songTitle/artist/segments con la forma que exige
    cancionJSONValido() de canciones-core.js (si no, la canción se
    descarta en el descubrimiento con un aviso en consola).
  - Deja translation/phrases/distractors/learn en blanco — son los
    campos que, según NOTAS.md, "se completan después" y que la app ya
    trata como opcionales (ese segments[n].content[j] simplemente no
    genera ejercicios de ese tipo todavía).
  - NO inventa traducciones ni rellena contenido — corre 100% local,
    sobre tu propio archivo, y no manda nada a ningún lado.

Uso:
  python3 generar_song_json.py tracklist/song_it_1.txt \
      --title "Título de la canción" --artist "Nombre del artista" \
      --lang it --n 1

  (lang y n se adivinan solos del nombre del archivo si sigue el patrón
   song_<lang>_<n>.txt, así que normalmente basta con:)

  python3 generar_song_json.py tracklist/song_it_1.txt \
      --title "..." --artist "..."

Después de correrlo, abre el .json y completa a mano (o con tu propia
herramienta de traducción) translation/phrases/distractors/learn de
cada content[] — exactamente el mismo flujo que ya usaste para dejar
los ejemplos de Die With A Smile en el chat.
"""
import argparse
import json
import os
import re
import sys


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("txt_path", help="Ruta al tracklist/song_<lang>_<n>.txt")
    p.add_argument("--title", required=True, help="songTitle (obligatorio, lo exige cancionJSONValido)")
    p.add_argument("--artist", required=True, help="artist (obligatorio, lo exige cancionJSONValido)")
    p.add_argument("--lang", help="en / it — si no se da, se adivina del nombre del archivo")
    p.add_argument("--n", help="número de la canción — si no se da, se adivina del nombre del archivo")
    p.add_argument("--out", help="ruta de salida (por defecto: mismo nombre, extensión .json)")
    p.add_argument("--force", action="store_true", help="sobrescribe el .json de salida si ya existe")
    return p.parse_args()


def adivinar_lang_n(txt_path):
    base = os.path.basename(txt_path)
    m = re.match(r"song_([a-zA-Z]+)_(\d+)\.txt$", base)
    if not m:
        return None, None
    return m.group(1), m.group(2)


def main():
    args = parse_args()

    if not os.path.isfile(args.txt_path):
        sys.exit(f"No existe el archivo: {args.txt_path}")

    lang, n = args.lang, args.n
    if not lang or not n:
        g_lang, g_n = adivinar_lang_n(args.txt_path)
        lang = lang or g_lang
        n = n or g_n

    out_path = args.out
    if not out_path:
        if lang and n:
            out_path = os.path.join(os.path.dirname(args.txt_path) or ".", f"song_{lang}_{n}.json")
        else:
            out_path = os.path.splitext(args.txt_path)[0] + ".json"

    if os.path.exists(out_path) and not args.force:
        sys.exit(f"Ya existe {out_path}. Usa --force si quieres sobrescribirlo.")

    with open(args.txt_path, "r", encoding="utf-8") as f:
        raw = f.read()

    # Estrofas = bloques separados por una (o más) líneas en blanco.
    bloques = [b for b in re.split(r"\n\s*\n", raw.strip("\n")) if b.strip()]

    segments = []
    total_lineas = 0
    for bloque in bloques:
        lineas = [l for l in bloque.split("\n") if l.strip()]
        total_lineas += len(lineas)
        segments.append({
            "text": "\n".join(lineas),
            "translation": "",
            "content": [
                {
                    "originalPhrase": linea.strip(),
                    "translation": "",
                    "phrases": [],
                    "distractors": [],
                    "learn": []
                }
                for linea in lineas
            ]
        })

    data = {
        "songTitle": args.title,
        "artist": args.artist,
        "segments": segments
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"✅ {out_path}")
    print(f"   {len(segments)} segmento(s) (estrofas), {total_lineas} línea(s) totales.")
    print("   translation/phrases/distractors/learn quedaron en blanco —")
    print("   complétalos a mano por cada content[], igual que el ejemplo")
    print("   que diste de 'I just woke up from a dream' en el chat.")
    print()
    print("   Verifica después que el .lrc tenga EXACTAMENTE la misma")
    print("   cantidad de líneas no vacías que este .txt (hoy canciones-lrc.js")
    print("   empareja por posición y descarta TODO el emparejamiento si no")
    print("   calza, ver tracklist/NOTAS.md).")


if __name__ == "__main__":
    main()
