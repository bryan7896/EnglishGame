"""
Compila el juego de aventura: valida las misiones y genera los dos archivos que el resto del
proyecto necesita a partir de UNA sola fuente de verdad.

ENTRADA (carpeta data/):
  elenco.json            personajes reutilizables (voz, velocidad, saludos, frases de error, ocupado)
  objetos_audio.json     nombre en audio de cada objeto SVG tocable (voz del narrador)
  misiones/*.json        una misión por archivo (escenas, diálogos, efectos)
  palabras.txt           tu lista de ~3000 palabras
  palabras_extra.txt     nombres propios e interjecciones permitidas aunque no estén en tu lista
  errores_intencionales.txt  formas mal hechas a propósito (bringed, leaved...): solo valen en opciones INCORRECTAS

SALIDA:
  frases.json            lo que lee generar_audio_tts.py
  data/compilado/indice.json   misiones jugables (pantalla de lista)  [{"audio","voz","nameFile","vel"?}, ...]
  data/compilado/<id>.json   la misión lista para el motor del juego (cada línea trae su "file" mp3)
  reporte_vocabulario.txt    palabras fuera de tu lista, estadísticas y avisos

CONVENCIONES DE LOS JSON FUENTE
  - Toda línea hablada es un objeto con "quien" (id del personaje) y "texto".
  - Un turno del jugador es {"quien": "bryan", "opciones": [{"texto","ok":true}, {...}, {...}]}
    (siempre 3 opciones y exactamente 1 con "ok": true).
  - {"quien": "tom", "ref": "saludo"} usa un saludo del elenco (se elige al azar en el juego).
  - "texto" es lo que se MUESTRA; si el TTS debe leer algo distinto, añade "hablado": "...".
  - Escribe los números con palabras ("fifteen dollars"), nunca con cifras.

USO:   python compilar_aventura.py            (valida y escribe)
       python compilar_aventura.py --solo-validar
       python compilar_aventura.py --permitir-fuera-de-lista
"""

import argparse
import copy
import hashlib
import json
import pathlib
import re
import sys
from collections import defaultdict

BASE = pathlib.Path(__file__).resolve().parent
DATA = BASE / "data"
SALIDA_FRASES = BASE / "frases.json"
SALIDA_COMPILADO = DATA / "compilado"
SALIDA_REPORTE = BASE / "reporte_vocabulario.txt"

# Lo que el TTS debe leer distinto de lo que se muestra en pantalla.
TTS_REEMPLAZOS = [
    (re.compile(r"\bOK\b"), "okay"),
]

# Voces de Kokoro-82M v1.0 conocidas. Una voz fuera de esta lista solo da un aviso.
VOCES_CONOCIDAS = {
    "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river",
    "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx",
    "am_puck", "am_santa", "bf_alice", "bf_emma", "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george",
    "bm_lewis",
}

MAX_PALABRAS_OPCION = 10
MAX_PALABRAS_NPC = 14

TOKEN_RE = re.compile(r"[a-z0-9àèìòùáéíóúüñ]+(?:['\-][a-z0-9àèìòùáéíóúüñ]+)*")


# ---------------------------------------------------------------------
# Texto
# ---------------------------------------------------------------------

def tokens(texto: str) -> list:
    t = str(texto).lower().replace("’", "'").replace("‘", "'")
    return TOKEN_RE.findall(t)


def cargar_palabras(path: pathlib.Path) -> set:
    palabras = set()
    for linea in path.read_text(encoding="utf-8").splitlines():
        linea = linea.strip().lower()
        if linea and not linea.startswith("#"):
            palabras.add(linea)
    return palabras


def palabra_valida(tok: str, lista: set, extra: set) -> bool:
    if tok in lista or tok in extra:
        return True
    if "-" in tok:  # fifty-five, ex-wife...
        return all(palabra_valida(p, lista, extra) for p in tok.split("-") if p)
    if tok.endswith("'s") and (tok[:-2] in lista or tok[:-2] in extra):  # Sara's
        return True
    return False


def hablado_de(linea: dict) -> str:
    if linea.get("hablado"):
        return str(linea["hablado"]).strip()
    t = str(linea["texto"]).strip()
    for patron, reemplazo in TTS_REEMPLAZOS:
        t = patron.sub(reemplazo, t)
    return t


def slug(texto: str, largo: int = 40) -> str:
    s = "-".join(re.findall(r"[a-z0-9]+", texto.lower().replace("'", "")))
    if len(s) > largo:
        s = s[:largo].rsplit("-", 1)[0]
    return s or "audio"


def nombre_archivo(hablado: str, voz: str, vel: float) -> str:
    h = hashlib.sha1(f"{hablado}|{voz}|{vel:.3f}".encode("utf-8")).hexdigest()[:6]
    return f"{slug(hablado)}__{voz}__{h}.mp3"


# ---------------------------------------------------------------------
# Recolección de líneas
# ---------------------------------------------------------------------

class Linea:
    __slots__ = ("ruta", "quien", "dic", "tipo")

    def __init__(self, ruta, quien, dic, tipo):
        self.ruta, self.quien, self.dic, self.tipo = ruta, quien, dic, tipo


def recolectar(nodo, ruta, salida):
    """Recorre un JSON y junta todo dict con 'quien' + 'texto', y las 'opciones' de un turno del jugador."""
    if isinstance(nodo, dict):
        quien = nodo.get("quien")
        if quien and "texto" in nodo and "opciones" not in nodo:
            salida.append(Linea(ruta, quien, nodo, "npc"))
        if quien and isinstance(nodo.get("opciones"), list):
            for i, op in enumerate(nodo["opciones"]):
                if isinstance(op, dict) and "texto" in op:
                    salida.append(Linea(f"{ruta}.opciones[{i}]", quien, op, "opcion"))
        for k, v in nodo.items():
            if k != "opciones":
                recolectar(v, f"{ruta}.{k}" if ruta else k, salida)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            recolectar(v, f"{ruta}[{i}]", salida)


def recolectar_turnos(nodo, ruta, salida):
    if isinstance(nodo, dict):
        if isinstance(nodo.get("opciones"), list):
            salida.append((ruta, nodo))
        for k, v in nodo.items():
            recolectar_turnos(v, f"{ruta}.{k}" if ruta else k, salida)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            recolectar_turnos(v, f"{ruta}[{i}]", salida)


def recolectar_refs(nodo, ruta, salida):
    if isinstance(nodo, dict):
        if "ref" in nodo and "quien" in nodo:
            salida.append((ruta, nodo))
        for k, v in nodo.items():
            recolectar_refs(v, f"{ruta}.{k}" if ruta else k, salida)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            recolectar_refs(v, f"{ruta}[{i}]", salida)


def recolectar_clave(nodo, clave, ruta, salida):
    if isinstance(nodo, dict):
        for k, v in nodo.items():
            if k == clave:
                salida.append((f"{ruta}.{k}" if ruta else k, v))
            recolectar_clave(v, clave, f"{ruta}.{k}" if ruta else k, salida)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            recolectar_clave(v, clave, f"{ruta}[{i}]", salida)


# ---------------------------------------------------------------------
# Programa
# ---------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--solo-validar", action="store_true", help="valida pero no escribe archivos")
    ap.add_argument("--permitir-fuera-de-lista", action="store_true",
                    help="las palabras fuera de tu lista son aviso, no error")
    args = ap.parse_args()

    errores, avisos = [], []
    lista = cargar_palabras(DATA / "palabras.txt")
    extra = cargar_palabras(DATA / "palabras_extra.txt") if (DATA / "palabras_extra.txt").exists() else set()
    # formas incorrectas A PROPOSITO (bringed, leaved...): solo se aceptan en opciones incorrectas del jugador
    errores_a_proposito = cargar_palabras(DATA / "errores_intencionales.txt") if (DATA / "errores_intencionales.txt").exists() else set()
    elenco = json.loads((DATA / "elenco.json").read_text(encoding="utf-8"))
    personajes = elenco["personajes"]
    narrador = elenco["narrador"]
    objetos = json.loads((DATA / "objetos_audio.json").read_text(encoding="utf-8"))["objetos"]
    ids_objeto = {o["id"] for o in objetos}

    archivos = sorted((DATA / "misiones").glob("*.json"))
    if not archivos:
        sys.exit("No hay misiones en data/misiones/")
    misiones = [json.loads(a.read_text(encoding="utf-8")) for a in archivos]

    # ---- 1. Validación estructural de cada misión
    usados = set()
    for m in misiones:
        mid = m.get("id", "?")
        escenas = m.get("escenas", [])
        ids_escena = [e.get("id") for e in escenas]
        if len(set(ids_escena)) != len(ids_escena):
            errores.append(f"[{mid}] hay ids de escena repetidos")

        turnos = []
        recolectar_turnos(m, mid, turnos)
        for ruta, t in turnos:
            ops = t["opciones"]
            if t.get("quien") not in personajes:
                errores.append(f"{ruta}: 'quien' desconocido ({t.get('quien')})")
            if len(ops) != 3:
                errores.append(f"{ruta}: un turno del jugador necesita 3 opciones (tiene {len(ops)})")
            if sum(1 for o in ops if o.get("ok")) != 1:
                errores.append(f"{ruta}: debe haber exactamente 1 opción con \"ok\": true")
            textos = [o.get("texto", "").strip().lower() for o in ops]
            if len(set(textos)) != len(textos):
                errores.append(f"{ruta}: opciones repetidas")

        for ruta, v in [r for r in _claves(m, "ir_escena")]:
            if v not in ids_escena:
                errores.append(f"{ruta}: la escena '{v}' no existe")

        refs = []
        recolectar_refs(m, mid, refs)
        for ruta, nodo in refs:
            p = personajes.get(nodo["quien"])
            if not p:
                errores.append(f"{ruta}: personaje desconocido '{nodo['quien']}'")
            elif nodo["ref"] == "saludo" and not p.get("saludos"):
                errores.append(f"{ruta}: '{nodo['quien']}' no tiene saludos en el elenco")
            elif nodo["ref"] not in ("saludo", "error", "ocupado"):
                errores.append(f"{ruta}: ref desconocida '{nodo['ref']}'")

        for esc in escenas:
            ids_obj_escena = {o["id"] for o in esc.get("objetos", [])}
            for o in esc.get("objetos", []):
                if "texto_ref" in o and o.get("texto_ref") not in ids_objeto:   # sin texto_ref = decorativo
                    errores.append(f"[{mid}/{esc['id']}] objeto '{o['id']}': texto_ref '{o.get('texto_ref')}' "
                                   f"no está en objetos_audio.json")
            for p in esc.get("personajes", []):
                usados.add(p["id"])
                asoc = p.get("objeto_asociado")
                if asoc and asoc not in ids_obj_escena:
                    errores.append(f"[{mid}/{esc['id']}] {p['id']}: objeto_asociado '{asoc}' no existe en la escena")
                if p["id"] not in personajes:
                    errores.append(f"[{mid}/{esc['id']}] personaje '{p['id']}' no está en elenco.json")

    # ---- 2. Líneas habladas
    todas = []  # (Linea, ctx, voz, vel)
    for m in misiones:
        ls = []
        recolectar(m, m["id"], ls)
        for l in ls:
            if l.quien not in personajes:
                errores.append(f"{l.ruta}: 'quien' desconocido ({l.quien})")
                continue
            usados.add(l.quien)
            todas.append((l, l.ruta))

    # Líneas reutilizables del elenco (solo de los personajes usados)
    extras_elenco = []  # (texto, quien, tipo, ruta)
    for pid in sorted(usados):
        p = personajes.get(pid)
        if not p:
            continue
        for tipo in [k for k in p if re.match(r"(saludos|errores|ocupado)(_\w+)?$", k)]:
            for i, t in enumerate(p.get(tipo, [])):
                extras_elenco.append((t, pid, tipo, f"elenco.{pid}.{tipo}[{i}]"))
    extras_obj = [(o["texto"], "narrador", "objeto", f"objetos.{o['id']}") for o in objetos]

    # ---- 3. Vocabulario y longitud
    fuera = defaultdict(list)
    usadas_lista = set()
    total_lineas = 0

    def revisar(texto, ruta, tipo, quien, mala=False):
        nonlocal total_lineas
        total_lineas += 1
        toks = tokens(texto)
        if re.search(r"\d", texto):
            errores.append(f"{ruta}: tiene cifras; escribe los números con palabras -> '{texto}'")
        for tk in toks:
            if palabra_valida(tk, lista, extra):
                usadas_lista.add(tk)
            elif mala and tk in errores_a_proposito:
                pass
            else:
                fuera[tk].append(f"{ruta}  «{texto}»")
        n = len(toks)
        if tipo == "opcion" and n > MAX_PALABRAS_OPCION:
            avisos.append(f"{ruta}: opción larga ({n} palabras): «{texto}»")
        if tipo == "npc" and n > MAX_PALABRAS_NPC:
            avisos.append(f"{ruta}: línea larga ({n} palabras): «{texto}»")

    for l, ruta in todas:
        revisar(l.dic["texto"], ruta, l.tipo, l.quien, mala=(l.tipo == "opcion" and not l.dic.get("ok")))
    for t, pid, tipo, ruta in extras_elenco:
        revisar(t, ruta, "npc", pid)
    for t, pid, tipo, ruta in extras_obj:
        revisar(t, ruta, "objeto", pid)

    for tk, sitios in sorted(fuera.items()):
        msg = f"palabra fuera de tu lista: '{tk}' ({len(sitios)}x), p. ej. {sitios[0]}"
        (avisos if args.permitir_fuera_de_lista else errores).append(msg)

    # ---- 4. Voces
    for pid in sorted(usados | {"narrador"}):
        p = narrador if pid == "narrador" else personajes.get(pid, {})
        voz = p.get("voz", "")
        if not re.fullmatch(r"[a-z]{2}_[a-z0-9]+", voz):
            errores.append(f"elenco.{pid}: voz '{voz}' no tiene forma de voz de Kokoro (ej. af_heart)")
        elif voz not in VOCES_CONOCIDAS:
            avisos.append(f"elenco.{pid}: la voz '{voz}' no está en mi lista de voces conocidas; pruébala con "
                          f"generar_audio_tts.py --muestras")
        vel = float(p.get("vel", 1.0))
        if not 0.7 <= vel <= 1.3:
            errores.append(f"elenco.{pid}: vel {vel} fuera del rango 0.7-1.3")

    # ---- 5. Armar frases.json (deduplicado por texto hablado + voz + velocidad)
    def voz_vel(quien):
        p = narrador if quien == "narrador" else personajes[quien]
        return p["voz"], float(p.get("vel", 1.0))

    frases = {}  # nameFile -> dict

    def registrar(texto_dic, quien, ctx):
        voz, vel = voz_vel(quien)
        hablado = hablado_de(texto_dic)
        nf = nombre_archivo(hablado, voz, vel)
        if nf not in frases:
            item = {"audio": hablado, "voz": voz, "nameFile": nf}
            if abs(vel - 1.0) > 1e-9:
                item["vel"] = vel
            item["ctx"] = ctx
            frases[nf] = item
        return nf, voz

    if errores:
        _terminar(errores, avisos, fuera, usadas_lista, total_lineas, frases, lista)
        sys.exit(1)

    # Compilados (una copia de cada misión con "file" y "voz" en cada línea)
    compilados = {}
    for m in misiones:
        c = copy.deepcopy(m)
        ls = []
        recolectar(c, c["id"], ls)
        for l in ls:
            nf, voz = registrar(l.dic, l.quien, l.ruta)
            l.dic["file"], l.dic["voz"] = nf, voz
        compilados[c["id"]] = c

    cast_out = {}
    for pid in sorted(usados):
        p = personajes[pid]
        item = {k: p[k] for k in ("nombre", "rol", "voz", "vel", "cara_base", "ropa", "accesorio", "estilo") if k in p}
        for tipo in [k for k in p if re.match(r"(saludos|errores|ocupado)(_\w+)?$", k)]:
            lst = []
            for t in p.get(tipo, []):
                d = {"texto": t}
                nf, _ = registrar(d, pid, f"elenco.{pid}.{tipo}")
                d["file"] = nf
                lst.append(d)
            item[tipo] = lst
        cast_out[pid] = item
    obj_out = {}
    for o in objetos:
        d = {"texto": o["texto"]}
        nf, _ = registrar(d, "narrador", f"objetos.{o['id']}")
        obj_out[o["id"]] = {"texto": o["texto"], "file": nf}

    # Orden estable: por voz y luego por nameFile
    lista_frases = sorted(frases.values(), key=lambda f: (f["voz"], f["nameFile"]))

    if not args.solo_validar:
        SALIDA_COMPILADO.mkdir(parents=True, exist_ok=True)
        SALIDA_FRASES.write_text(json.dumps(lista_frases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for mid, c in compilados.items():
            c["elenco"] = cast_out
            c["objetos_audio"] = obj_out
            c["audio_dir"] = "audio/"
            (SALIDA_COMPILADO / f"{mid}.json").write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n",
                                                          encoding="utf-8")
        # indice de misiones jugables (lo lee la pantalla de lista del juego)
        jugables = sorted(f.stem for f in SALIDA_COMPILADO.glob("m*.json"))
        (SALIDA_COMPILADO / "indice.json").write_text(json.dumps({"misiones": jugables}) + "\n", encoding="utf-8")
    _terminar(errores, avisos, fuera, usadas_lista, total_lineas, frases, lista, escribio=not args.solo_validar)


def _claves(nodo, clave):
    salida = []
    recolectar_clave(nodo, clave, "", salida)
    return salida


def _terminar(errores, avisos, fuera, usadas_lista, total_lineas, frases, lista, escribio=False):
    por_voz = defaultdict(int)
    for f in frases.values():
        por_voz[f["voz"]] += 1
    lineas = ["REPORTE DE VOCABULARIO Y AUDIO", "=" * 40,
              f"Líneas habladas revisadas: {total_lineas}",
              f"Audios únicos a generar:   {len(frases)}",
              f"Palabras distintas usadas: {len(usadas_lista)} (de tu lista de {len(lista)})",
              f"Palabras fuera de tu lista: {len(fuera)}", ""]
    if por_voz:
        lineas.append("Audios por voz:")
        lineas += [f"  {v}: {n}" for v, n in sorted(por_voz.items())]
        lineas.append("")
    if errores:
        lineas.append(f"ERRORES ({len(errores)}):")
        lineas += [f"  - {e}" for e in errores]
        lineas.append("")
    if avisos:
        lineas.append(f"AVISOS ({len(avisos)}):")
        lineas += [f"  - {a}" for a in avisos]
        lineas.append("")
    texto = "\n".join(lineas)
    SALIDA_REPORTE.write_text(texto + "\n", encoding="utf-8")
    print(texto)
    if errores:
        print("No se generó frases.json: corrige los errores de arriba.")
    elif escribio:
        print(f"Listo: {SALIDA_FRASES.name} ({len(frases)} audios) y data/compilado/*.json")
        print("Siguiente paso:  python generar_audio_tts.py")


if __name__ == "__main__":
    main()
