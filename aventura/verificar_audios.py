"""
Revisa con Whisper los mp3 que YA están en audio/ y escribe un reporte de dudas.
NO borra, mueve ni regenera nada: tú escuchas solo los que aparecen y decides.

Sirve para dejarlo corriendo aparte (por ejemplo de noche) sin frenar la generación.

  python verificar_audios.py                    revisa todo
  python verificar_audios.py --limite 50        solo los primeros 50 (prueba rápida)
  python verificar_audios.py --voz bf_emma      solo una voz
  python verificar_audios.py --modelo mlx-community/whisper-small-mlx    modelo más rápido

SALIDA: reporte_verificacion.json (y un resumen en pantalla). Cada duda trae lo que se esperaba, lo que
Whisper entendió, el nameFile y la ruta de origen (ctx) para que ubiques la frase en el juego.
Luego, para rehacer un audio malo:   python generar_audio_tts.py --regenerar <nameFile>

Nota: es normal que Whisper dude de risas, interjecciones y nombres raros; ya se ignoran "ha ha" y "um" y
se aceptan Brian/Bryan, Sarah/Sara. Una duda NO significa que el audio esté mal: significa "escúchalo".
"""

import argparse
import json
import pathlib
import time

import generar_audio_tts as g

ENTRADA = pathlib.Path("frases.json")
CARPETA = pathlib.Path("audio")
REPORTE = pathlib.Path("reporte_verificacion.json")


def main() -> None:
    ap = argparse.ArgumentParser(description="Revisa con Whisper los mp3 ya generados (no borra nada)")
    ap.add_argument("--entrada", default=str(ENTRADA))
    ap.add_argument("--carpeta", default=str(CARPETA))
    ap.add_argument("--limite", type=int, default=0, help="revisa solo los N primeros")
    ap.add_argument("--voz", help="revisa solo esta voz")
    ap.add_argument("--modelo", help="modelo de Whisper (por defecto el de generar_audio_tts.py)")
    args = ap.parse_args()
    if args.modelo:
        g.WHISPER_MODEL = args.modelo

    entrada, carpeta = pathlib.Path(args.entrada), pathlib.Path(args.carpeta)
    tareas, errores = g.preparar_tareas(json.loads(entrada.read_text(encoding="utf-8")))
    if errores:
        raise SystemExit("frases.json tiene problemas: " + "; ".join(errores[:5]))
    ctx = {i.get("nameFile") if str(i.get("nameFile", "")).endswith(".mp3") else str(i.get("nameFile")) + ".mp3":
           i.get("ctx", "") for i in json.loads(entrada.read_text(encoding="utf-8"))}

    pendientes = [t for t in tareas if (carpeta / t["nombre"]).exists()]
    faltan = len(tareas) - len(pendientes)
    if args.voz:
        pendientes = [t for t in pendientes if t["voz"] == args.voz]
    pendientes.sort(key=lambda t: (t["voz"], t["nombre"]))
    if args.limite:
        pendientes = pendientes[: args.limite]
    total = len(pendientes)
    print(f"A revisar: {total} audios (faltan por generar: {faltan})")

    dudas, t0 = [], time.time()
    for n, t in enumerate(pendientes, 1):
        try:
            transcrito = g.transcribir(carpeta / t["nombre"], t["voz"])
            ok, motivo = g.comparar(t["texto"], transcrito, t["distractores"])
        except Exception as e:  # noqa: BLE001
            transcrito, ok, motivo = "", False, f"error: {e}"
        if not ok:
            dudas.append({"nameFile": t["nombre"], "voz": t["voz"], "esperado": t["texto"],
                          "transcrito": transcrito, "motivo": motivo, "ctx": ctx.get(t["nombre"], "")})
            print(f"  ? [{n}/{total}] {t['nombre']}: esperado '{t['texto']}' / Whisper '{transcrito}'")
        elif n % 25 == 0:
            print(f"  [{n}/{total}] ...")

    REPORTE.write_text(json.dumps(dudas, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nRevisados {total} en {time.time() - t0:.0f}s. Para escuchar: {len(dudas)}")
    if dudas:
        print(f"Detalle en {REPORTE}. Para rehacer uno: python generar_audio_tts.py --regenerar <nameFile>")


if __name__ == "__main__":
    main()
