"""
Genera audio TTS local con Kokoro-82M (mlx-audio, Apple Silicon).

ENTRADA (frases.json, lo genera compilar_aventura.py): lista de objetos.
  [
    {"audio": "Hi, my name is Bryan", "voz": "am_adam", "nameFile": "1_juan.mp3"},
    {"audio": "Where is Sara?",       "voz": "bf_emma", "nameFile": "2_maria.mp3", "vel": 0.95}
  ]
  - audio:    texto que se convierte a voz
  - voz:      voz de Kokoro (af_heart, am_adam, bf_emma, bm_george, ...)
  - nameFile: nombre del archivo resultante (si no termina en .mp3 se lo agrega)
  Campos opcionales:
  - vel:          velocidad de esa voz (0.7 a 1.3). Si no está, se usa VELOCIDAD.
  - distractores: ["sheep", "shop"]  solo se usa si activas --verificar.
  - ctx:          nota libre (de dónde viene la frase); se ignora.

SALIDA: todos los mp3 en UNA sola carpeta, "audio/".
  - muestras/              (solo con --muestras) una frase por voz para escucharlas y elegir
  - audio_fallidos/        (solo con --verificar) wavs rechazados por Whisper
  - reporte_fallos.json    (solo si hubo fallos)

CAMBIOS RESPECTO A LA VERSION ANTERIOR
  - La verificación con Whisper queda APAGADA por defecto (es lo que más tarda). Para revisar los audios
    sin bloquear nada usa verificar_audios.py; para verificar al generar usa --verificar.
  - Velocidad por voz ("vel"), para que cada personaje suene distinto.
  - Recorta el silencio del inicio y del final (el diálogo responde más rápido) y nivela el volumen entre
    voces (si no, unas suenan mucho más fuertes que otras). Se puede apagar en la configuración.
  - Alias de nombres propios (Bryan/Brian, Sara/Sarah...) y se ignoran risas ("ha ha") al comparar.
  - Opciones: --muestras, --regenerar, --solo, --entrada, --salida, --verificar.

Reglas que se conservan:
  - Reanudable: si audio/{nameFile} ya existe, se salta.
  - Dos entradas con el mismo nameFile y contenido distinto detienen el script ANTES de generar nada.
  - Kokoro es determinista (mismo texto + voz + velocidad = mismo audio): no hay reintentos.

Instalación:
  pip install mlx-audio mlx-whisper soundfile numpy
  (si Kokoro pide más: pip install "misaki[en]"  y  brew install espeak-ng)

Uso típico:
  python generar_audio_tts.py --muestras         # escuchar cada voz antes de generar todo
  python generar_audio_tts.py                    # genera lo que falte
  python generar_audio_tts.py --regenerar hello__af_heart__ab12cd.mp3   # rehacer uno malo
"""

import argparse
import difflib
import json
import pathlib
import re
import shutil
import subprocess
import tempfile

# ---------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------

INPUT_JSON = pathlib.Path("frases.json")
OUTPUT_DIR = pathlib.Path("audio")
FALLIDOS_DIR = pathlib.Path("audio_fallidos")
MUESTRAS_DIR = pathlib.Path("muestras")
REPORTE_FALLOS = pathlib.Path("reporte_fallos.json")

MODEL_TTS = "mlx-community/Kokoro-82M-bf16"
VELOCIDAD = 1.0        # velocidad por defecto (cada frase puede traer su "vel")
SAMPLE_RATE = 24000

# Post-proceso del audio
RECORTAR_SILENCIO = True
NIVELAR_VOLUMEN = True
RMS_OBJETIVO = 0.08        # volumen medio al que se nivelan todas las voces
PICO_MAXIMO = 0.95         # nunca se pasa de aquí (evita saturar)
UMBRAL_SILENCIO = 0.02     # fracción del pico por debajo de la cual se considera silencio
MARGEN_INICIO = 0.05       # segundos que se dejan antes de la primera sílaba
MARGEN_FINAL = 0.15        # segundos que se dejan después de la última

# Verificación con Whisper (apagada por defecto; actívala con --verificar)
VERIFICAR = False
WHISPER_MODEL = "mlx-community/whisper-turbo"
MAX_PALABRAS_EXACTO = 3     # hasta 3 palabras: coincidencia exacta
UMBRAL_SIMILITUD = 0.95     # frases más largas: similitud mínima por palabras

FRASE_MUESTRA = "Hello! My name is Bryan. Where is the taxi?"


# ---------------------------------------------------------------------
# Lógica pura (entrada y comparación de texto)
# ---------------------------------------------------------------------

def preparar_tareas(data: list) -> tuple:
    """Valida la entrada. Devuelve (tareas, errores)."""
    tareas, errores = {}, []
    for i, item in enumerate(data):
        try:
            texto = str(item["audio"]).strip()
            voz = str(item["voz"]).strip()
            # .name evita que un nameFile con carpetas escriba fuera de audio/
            nombre = pathlib.Path(str(item["nameFile"]).strip()).name
        except (KeyError, TypeError) as e:
            errores.append(f"elemento {i}: falta el campo {e}")
            continue
        if not texto or not voz or not nombre:
            errores.append(f"elemento {i}: audio, voz o nameFile vacío")
            continue
        if not re.fullmatch(r"[a-z]{2}_[a-z0-9]+", voz):
            errores.append(f"elemento {i}: voz '{voz}' no parece una voz de Kokoro (ej. af_heart)")
            continue
        try:
            vel = float(item.get("vel", VELOCIDAD))
        except (TypeError, ValueError):
            errores.append(f"elemento {i}: vel '{item.get('vel')}' no es un número")
            continue
        if not 0.7 <= vel <= 1.3:
            errores.append(f"elemento {i}: vel {vel} fuera del rango 0.7-1.3")
            continue
        if not nombre.lower().endswith(".mp3"):
            nombre += ".mp3"
        previa = tareas.get(nombre)
        if previa and (previa["texto"], previa["voz"], previa["vel"]) != (texto, voz, vel):
            errores.append(f"nameFile repetido con contenido distinto: {nombre}")
            continue
        tareas[nombre] = {
            "nombre": nombre,
            "texto": texto,
            "voz": voz,
            "vel": vel,
            "distractores": list(item.get("distractores") or []),
        }
    return list(tareas.values()), errores


_NUMEROS = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
    "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
    "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
    "18": "eighteen", "19": "nineteen", "20": "twenty", "30": "thirty",
    "40": "forty", "50": "fifty", "60": "sixty", "70": "seventy",
    "80": "eighty", "90": "ninety",
}
# Whisper escribe estas palabras de otra forma que el texto original.
_ALIAS = {
    "ok": "okay",
    "brian": "bryan",
    "sarah": "sara",
    "lilly": "lily",
}
# Risas e interjecciones: Whisper las transcribe de forma distinta cada vez; no se comparan.
_IGNORAR = {"ha", "haha", "hahaha", "um", "uh", "hmm", "mm", "ah"}


def normalizar(texto: str) -> list:
    """Minúsculas, sin puntuación, dígitos a palabras, alias de nombres. Devuelve lista de palabras."""
    t = texto.lower().replace("’", "'")
    t = re.sub(r"[-–—]", " ", t)
    t = re.sub(r"[^a-z0-9' ]", " ", t)
    palabras = []
    for p in t.split():
        p = p.strip("'")
        if not p:
            continue
        p = _NUMEROS.get(p, p)
        p = _ALIAS.get(p, p)
        if p in _IGNORAR:
            continue
        palabras.append(p)
    return palabras


def comparar(esperado: str, transcrito: str, distractores: list) -> tuple:
    """Devuelve (ok, motivo)."""
    esp = normalizar(esperado)
    obt = normalizar(transcrito)
    if esp and esp == obt:
        return True, ""
    if not esp:  # frase hecha solo de risas: no hay nada que comparar
        return True, ""
    for d in distractores:
        if d and normalizar(d) == obt:
            return False, f"se entendió como la opción distractora '{d}'"
    if len(esp) > MAX_PALABRAS_EXACTO and obt:
        if difflib.SequenceMatcher(None, esp, obt).ratio() >= UMBRAL_SIMILITUD:
            return True, ""
    return False, "la transcripción no coincide con el texto esperado"


# ---------------------------------------------------------------------
# Post-proceso de audio (funciones puras sobre arreglos de numpy)
# ---------------------------------------------------------------------

def recortar_silencio(x, sr: int):
    """Quita el silencio del inicio y del final, dejando un pequeño margen."""
    import numpy as np
    if x.size == 0:
        return x
    pico = float(np.max(np.abs(x)))
    if pico <= 0:
        return x
    idx = np.flatnonzero(np.abs(x) > pico * UMBRAL_SILENCIO)
    if idx.size == 0:
        return x
    ini = max(0, int(idx[0]) - int(MARGEN_INICIO * sr))
    fin = min(len(x), int(idx[-1]) + int(MARGEN_FINAL * sr) + 1)
    return x[ini:fin]


def nivelar_volumen(x):
    """Lleva el volumen medio (RMS) a RMS_OBJETIVO sin pasar de PICO_MAXIMO."""
    import numpy as np
    if x.size == 0:
        return x
    rms = float(np.sqrt(np.mean(np.square(x, dtype=np.float64))))
    if rms < 1e-6:
        return x
    ganancia = RMS_OBJETIVO / rms
    pico = float(np.max(np.abs(x)))
    if pico * ganancia > PICO_MAXIMO:
        ganancia = PICO_MAXIMO / pico
    return (x * ganancia).astype(np.float32)


# ---------------------------------------------------------------------
# Síntesis, transcripción y conversión
# ---------------------------------------------------------------------

def cargar_tts():
    from mlx_audio.tts.utils import load_model
    return load_model(MODEL_TTS)


def sintetizar(model, texto: str, voz: str, destino_wav: pathlib.Path, vel: float = VELOCIDAD) -> None:
    """Genera el wav. El idioma de Kokoro sale de la primera letra de la voz
    (a = inglés americano, b = británico)."""
    import numpy as np
    import soundfile as sf

    trozos = []
    sr = SAMPLE_RATE
    for r in model.generate(texto, voice=voz, speed=vel, lang_code=voz[0]):
        trozos.append(np.array(r.audio).reshape(-1))
        sr = getattr(r, "sample_rate", None) or sr
    if not trozos:
        raise RuntimeError("Kokoro no devolvió audio")
    audio = np.concatenate(trozos).astype(np.float32)
    if RECORTAR_SILENCIO:
        audio = recortar_silencio(audio, sr)
    if NIVELAR_VOLUMEN:
        audio = nivelar_volumen(audio)
    sf.write(str(destino_wav), audio, sr)


def transcribir(wav: pathlib.Path, voz: str) -> str:
    import mlx_whisper

    out = mlx_whisper.transcribe(
        str(wav),
        path_or_hf_repo=WHISPER_MODEL,
        language="en" if voz[0] in "ab" else None,
        condition_on_previous_text=False,
        temperature=0.0,
    )
    return out.get("text", "").strip()


def wav_a_mp3(wav_path: pathlib.Path, mp3_path: pathlib.Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-ac", "1", "-b:a", "96k", str(mp3_path)],
        check=True,
    )


# ---------------------------------------------------------------------
# Modos auxiliares
# ---------------------------------------------------------------------

def modo_muestras(tareas: list) -> None:
    """Una frase de muestra por cada voz usada en frases.json, para escucharlas antes de generar todo."""
    voces = {}
    for t in tareas:
        voces.setdefault(t["voz"], t["vel"])
    MUESTRAS_DIR.mkdir(exist_ok=True)
    model = cargar_tts()
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="kokoro_m_"))
    try:
        for voz, vel in sorted(voces.items()):
            wav = tmp / f"{voz}.wav"
            try:
                sintetizar(model, FRASE_MUESTRA, voz, wav, vel)
                wav_a_mp3(wav, MUESTRAS_DIR / f"{voz}.mp3")
                print(f"muestra OK: {voz} (vel {vel})")
            except Exception as e:  # noqa: BLE001
                print(f"    XX {voz}: {e}  -> esa voz no existe o falló; cámbiala en data/elenco.json")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nEscucha los archivos de {MUESTRAS_DIR}/ y cambia las voces que no te gusten en data/elenco.json "
          f"(luego vuelve a correr compilar_aventura.py).")


# ---------------------------------------------------------------------
# Flujo principal
# ---------------------------------------------------------------------

def main() -> None:
    global INPUT_JSON, OUTPUT_DIR, VERIFICAR
    ap = argparse.ArgumentParser(description="Genera audios con Kokoro a partir de frases.json")
    ap.add_argument("--entrada", default=str(INPUT_JSON), help="JSON de entrada (por defecto frases.json)")
    ap.add_argument("--salida", default=str(OUTPUT_DIR), help="carpeta de mp3 (por defecto audio/)")
    ap.add_argument("--verificar", action="store_true", help="verifica cada audio con Whisper al generarlo (lento)")
    ap.add_argument("--muestras", action="store_true", help="genera solo una muestra por voz y termina")
    ap.add_argument("--regenerar", nargs="+", metavar="NAMEFILE",
                    help="vuelve a generar estos archivos aunque ya existan")
    ap.add_argument("--solo", metavar="TEXTO", help="procesa solo los nameFile que contengan este texto")
    args = ap.parse_args()
    INPUT_JSON, OUTPUT_DIR = pathlib.Path(args.entrada), pathlib.Path(args.salida)
    if args.verificar:
        VERIFICAR = True

    data = json.loads(INPUT_JSON.read_text(encoding="utf-8"))
    tareas, errores = preparar_tareas(data)
    if errores:
        print(f"La entrada tiene {len(errores)} problema(s); no se generó nada:")
        for e in errores[:20]:
            print("  -", e)
        if len(errores) > 20:
            print(f"  ... y {len(errores) - 20} más")
        raise SystemExit(1)

    if args.muestras:
        modo_muestras(tareas)
        return

    rehacer = {pathlib.Path(n).name if n.lower().endswith(".mp3") else pathlib.Path(n).name + ".mp3"
               for n in (args.regenerar or [])}
    if rehacer:
        desconocidos = rehacer - {t["nombre"] for t in tareas}
        if desconocidos:
            print("Estos nameFile no están en frases.json:", ", ".join(sorted(desconocidos)))
            raise SystemExit(1)
        tareas = [t for t in tareas if t["nombre"] in rehacer]
    if args.solo:
        tareas = [t for t in tareas if args.solo in t["nombre"]]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Agrupa por voz: evita cambiar de voz/idioma en cada audio.
    tareas.sort(key=lambda t: (t["voz"], t["nombre"]))
    total = len(tareas)

    model = cargar_tts()
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="kokoro_"))

    fallos = []
    stats = {}
    generados = saltados = 0

    try:
        for n, t in enumerate(tareas, 1):
            nombre, texto, voz = t["nombre"], t["texto"], t["voz"]
            s = stats.setdefault(voz, {"ok": 0, "fallo": 0})
            mp3_path = OUTPUT_DIR / nombre

            if mp3_path.exists() and nombre not in rehacer:
                saltados += 1
                continue

            wav_path = tmp / f"{n}.wav"
            try:
                sintetizar(model, texto, voz, wav_path, t["vel"])

                if VERIFICAR:
                    transcrito = transcribir(wav_path, voz)
                    ok, motivo = comparar(texto, transcrito, t["distractores"])
                else:
                    transcrito, ok, motivo = "", True, ""

                if ok:
                    wav_a_mp3(wav_path, mp3_path)
                    generados += 1
                    s["ok"] += 1
                    print(f"[{n}/{total}] {nombre} ({voz}) OK")
                else:
                    FALLIDOS_DIR.mkdir(exist_ok=True)
                    shutil.move(str(wav_path), str(FALLIDOS_DIR / pathlib.Path(nombre).with_suffix(".wav").name))
                    s["fallo"] += 1
                    fallos.append({"nameFile": nombre, "voz": voz, "esperado": texto,
                                   "transcrito": transcrito, "motivo": motivo})
                    print(f"    XX [{n}/{total}] {nombre} ({voz}): esperado '{texto}' / "
                          f"Whisper entendió '{transcrito}' -> {motivo}")
            except Exception as e:  # noqa: BLE001
                s["fallo"] += 1
                fallos.append({"nameFile": nombre, "voz": voz, "esperado": texto,
                               "transcrito": "", "motivo": f"error: {e}"})
                print(f"    XX [{n}/{total}] {nombre} ({voz}) error: {e}")
            finally:
                wav_path.unlink(missing_ok=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        if fallos:
            REPORTE_FALLOS.write_text(json.dumps(fallos, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\nListo. Generados: {generados} | Ya existían: {saltados} | Fallidos: {len(fallos)}")
    print(f"Audios en: {OUTPUT_DIR}/")
    if not VERIFICAR:
        print("Verificación con Whisper apagada. Para revisar los audios sin bloquear nada: python verificar_audios.py")
    if fallos:
        print(f"Detalle de fallos: {REPORTE_FALLOS}" + (f"  |  rechazados: {FALLIDOS_DIR}/" if VERIFICAR else ""))
        for v, s in sorted(stats.items()):
            if s["fallo"]:
                print(f"  {v}: {s['ok']} ok / {s['fallo']} fallo")


if __name__ == "__main__":
    main()
