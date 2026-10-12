"""
VALIDADOR DE LA AVENTURA: revisa nivel, reglas gramaticales, arte y plan de las 40 historias.
Complementa a compilar_aventura.py (que ya revisa vocabulario contra tu lista, longitud y voces).

QUE REVISA
  1. Plan (data/catalogo_misiones.json): ids, reglas que existen en tu reglas-gramaticales.json,
     cobertura del plan (cada regla en 2+ historias) y vocabulario de titulos y objetivos.
  2. Nivel A2-B1 de cada mision escrita (data/misiones/*.json):
       - estructuras por ENCIMA de B1 (inversiones, tercer condicional, conectores formales...) -> aviso
       - lineas demasiado basicas (A1) en exceso -> aviso
  3. Reglas por mision: cada turno del jugador debe traer "reglaIds"; cada regla del plan de esa
     historia necesita al menos 3 turnos (tu minimo para calificar una regla).
  4. Arte: fondos, objetos, accesorios y caras que piden el plan, las misiones y los layouts
     existen en la biblioteca SVG.
  5. Cobertura global: turnos por regla sumando todas las misiones escritas (meta: 12 o mas).

SALIDA
  reporte_validacion.txt   resumen + errores + avisos + tabla de cobertura por regla
  INVENTARIO.md            (con --inventario) que arte falta y que se reutiliza, historia por historia

USO
  python validar_aventura.py
  python validar_aventura.py --inventario
  python validar_aventura.py --reglas ../data-en/reglas-gramaticales.json
Sale con codigo 1 si hay errores.
"""
import argparse
import json
import pathlib
import re
import sys
from collections import defaultdict

BASE = pathlib.Path(__file__).resolve().parent
DATA = BASE / "data"
REPORTE = BASE / "reporte_validacion.txt"
INVENTARIO = BASE / "INVENTARIO.md"

META_TURNOS_GLOBAL = 12   # turnos por regla al terminar las 40 historias
MIN_TURNOS_MISION = 3     # minimo de turnos de una regla planeada dentro de su historia
MIN_HISTORIAS_REGLA = 2   # cada regla debe aparecer en al menos 2 historias del plan

# Accesorios que arte.js dibuja a mano (no estan en la biblioteca de accesorios Twemoji).
ACCESORIOS_DIBUJADOS = {"mochila", "bolso", "delantal", "chaqueta", "audifonos", "corbata", "bata", "gorro_chef", "baston"}

# Estructuras por encima de B1 (o fuera de tu lista de reglas). Solo avisan: tu decides.
SOBRE_NIVEL = [
    (r"(^|[.!?]\s+)(had|were|should) (i|you|he|she|we|they)\b[^?]*,", "inversion condicional (Had I..., Were I...)"),
    (r"\b(not only|no sooner|hardly had|scarcely|little did|never have i)\b", "inversion enfatica"),
    (r"\b(would|could|might) have (been|had|gone|done|seen|known|made|taken|got|come|said|told|\w+ed)\b",
     "tercer condicional / modal perfecto (would have + participio)"),
    (r"\b(moreover|furthermore|nevertheless|nonetheless|whereas|albeit|notwithstanding|hence|thus|thereby)\b",
     "conector formal (no esta en tu lista de reglas)"),
    (r"\bwish(es|ed)? (i|you|he|she|we|they) had\b", "wish + past perfect"),
    (r"\bit is (said|believed|thought|known) that\b", "pasiva impersonal"),
    (r"\b(whom|whose|whereby|wherein)\b", "relativo formal"),
    (r"\bhaving (been|\w+ed)\b", "participio perfecto (having + participio)"),
    (r"\bshall\b", "shall (formal/britanico)"),
]
SOBRE_NIVEL = [(re.compile(p, re.I), d) for p, d in SOBRE_NIVEL]

TOKEN_RE = re.compile(r"[a-z0-9]+(?:['\-][a-z0-9]+)*")


def tokens(t):
    return TOKEN_RE.findall(str(t).lower().replace("’", "'"))


def cargar_json(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def cargar_biblioteca():
    txt = (BASE / "svg" / "biblioteca.js").read_text(encoding="utf-8")
    txt = txt[txt.index("{"): txt.rindex("}") + 1]
    lib = json.loads(txt)
    return {k: set(lib.get(k, {}).keys()) for k in ("objetos", "caras", "accesorios", "fondos")}


def cargar_alias():
    """Lee el mapa ALIAS de motor/arte.js (ids en espanol de las misiones -> ids de la biblioteca)."""
    txt = (BASE / "motor" / "arte.js").read_text(encoding="utf-8")
    m = re.search(r"const ALIAS = \{(.*?)\};", txt, re.S)
    return dict(re.findall(r"(\w+):\s*'(\w+)'", m.group(1))) if m else {}


def cargar_palabras():
    s = set()
    for nombre in ("palabras.txt", "palabras_extra.txt"):
        p = DATA / nombre
        if p.exists():
            s |= {l.strip().lower() for l in p.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}
    return s


def palabra_ok(tk, lista):
    if tk in lista:
        return True
    if "-" in tk:
        return all(palabra_ok(p, lista) for p in tk.split("-") if p)
    if tk.endswith("'s") and tk[:-2] in lista:
        return True
    return False


def buscar_reglas(arg):
    candidatos = [arg] if arg else []
    candidatos += [BASE.parent / "data-en" / "reglas-gramaticales.json", DATA / "reglas-gramaticales.json"]
    for c in candidatos:
        if c and pathlib.Path(c).exists():
            d = cargar_json(c)
            return {int(r["id"]): r["regla"] for r in d["reglas"]}, str(c)
    return None, None


def recorrer(nodo, fn, ruta=""):
    if isinstance(nodo, dict):
        fn(nodo, ruta)
        for k, v in nodo.items():
            recorrer(v, fn, f"{ruta}.{k}" if ruta else k)
    elif isinstance(nodo, list):
        for i, v in enumerate(nodo):
            recorrer(v, fn, f"{ruta}[{i}]")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--reglas", help="ruta a reglas-gramaticales.json (por defecto ../data-en/)")
    ap.add_argument("--inventario", action="store_true", help="escribe INVENTARIO.md")
    args = ap.parse_args()

    errores, avisos = [], []
    cat = cargar_json(DATA / "catalogo_misiones.json")
    plan = cat["misiones"]
    nuevos = cat.get("personajes_nuevos", {})
    lib = cargar_biblioteca()
    alias = cargar_alias()
    palabras = cargar_palabras()
    elenco = cargar_json(DATA / "elenco.json")["personajes"]
    reglas, ruta_reglas = buscar_reglas(args.reglas)
    if reglas is None:
        avisos.append("no encontre reglas-gramaticales.json (usa --reglas RUTA); no se revisan los ids de regla")

    lib_obj = lambda i: (alias.get(i, i) in lib["objetos"])

    # ---------------------------------------------------------------- 1. plan
    ids = [m["id"] for m in plan]
    if len(set(ids)) != len(ids):
        errores.append("catalogo: hay ids de mision repetidos")
    historias_por_regla = defaultdict(list)
    for m in plan:
        for r in m["reglas"]:
            historias_por_regla[r].append(m["n"])
            if reglas is not None and r not in reglas:
                errores.append(f"catalogo {m['id']}: la regla {r} no existe en tu reglas-gramaticales.json")
        for campo in ("titulo", "objetivo"):
            fuera = [t for t in tokens(m[campo]) if not palabra_ok(t, palabras)]
            if fuera:
                avisos.append(f"catalogo {m['id']}.{campo}: palabras fuera de tu lista: {', '.join(sorted(set(fuera)))}")
        for p in m["personajes"]:
            if p not in elenco and p not in nuevos:
                errores.append(f"catalogo {m['id']}: personaje '{p}' no esta en elenco.json ni en personajes_nuevos")
    for r, hs in sorted(historias_por_regla.items()):
        if len(hs) < MIN_HISTORIAS_REGLA:
            avisos.append(f"plan: la regla {r} solo aparece en {len(hs)} historia(s): {hs}")

    # ---------------------------------------------------------------- 2-3. misiones escritas
    turnos_regla = defaultdict(int)        # global
    resumen_misiones = []
    escritas = {}
    for f in sorted((DATA / "misiones").glob("*.json")):
        m = cargar_json(f)
        escritas[m["id"]] = m
        mid = m["id"]
        pm = next((p for p in plan if p["id"] == mid), None)
        if not pm:
            errores.append(f"[{mid}] no esta en catalogo_misiones.json")
        turnos = []
        lineas = []

        def visitar(n, ruta):
            if isinstance(n.get("opciones"), list):
                turnos.append((ruta, n))
                for o in n["opciones"]:
                    if "texto" in o:
                        lineas.append((f"{ruta}.opciones", o["texto"]))
            elif n.get("quien") and "texto" in n:
                lineas.append((ruta, n["texto"]))
        recorrer(m, visitar, mid)

        en_mision = defaultdict(int)
        sin_regla = 0
        for ruta, t in turnos:
            rs = t.get("reglaIds") or []
            if not rs:
                sin_regla += 1
            for r in rs:
                en_mision[int(r)] += 1
                turnos_regla[int(r)] += 1
                if reglas is not None and int(r) not in reglas:
                    errores.append(f"{ruta}: reglaId {r} no existe en tus reglas")
        if sin_regla:
            avisos.append(f"[{mid}] {sin_regla} turno(s) del jugador sin reglaIds (no cuentan en el informe)")
        if pm:
            for r in pm["reglas"]:
                if en_mision[r] < MIN_TURNOS_MISION:
                    errores.append(f"[{mid}] la regla {r} del plan tiene {en_mision[r]} turno(s); minimo {MIN_TURNOS_MISION}")
            # las reglas de apoyo (fuera del plan de la historia) son normales: suman a la cobertura global

        # nivel
        cortas = 0
        for ruta, texto in lineas:
            for rx, desc in SOBRE_NIVEL:
                if rx.search(texto):
                    avisos.append(f"{ruta}: posible nivel sobre B1 ({desc}): «{texto}»")
            if len(tokens(texto)) <= 3:
                cortas += 1
        if lineas and cortas / len(lineas) > 0.35:
            avisos.append(f"[{mid}] {cortas} de {len(lineas)} lineas tienen 3 palabras o menos: puede quedar por debajo de A2-B1")

        # arte de la mision
        for esc in m.get("escenas", []):
            if esc.get("fondo") and esc["fondo"] not in lib["fondos"]:
                errores.append(f"[{mid}/{esc['id']}] fondo '{esc['fondo']}' no existe en la biblioteca")
            for o in esc.get("objetos", []):
                s = o.get("svg", o["id"])
                if not lib_obj(s) and not lib_obj(o["id"]):
                    errores.append(f"[{mid}/{esc['id']}] objeto '{o['id']}' (svg '{s}') no existe en la biblioteca")
        lay = DATA / "layouts" / f"{mid}.json"
        if not lay.exists():
            errores.append(f"[{mid}] falta data/layouts/{mid}.json")
        else:
            L = cargar_json(lay)
            nombres_esc = {e["id"] for e in m.get("escenas", [])}
            for k, v in L.items():
                if k.startswith("_"):
                    continue
                if k not in nombres_esc:
                    avisos.append(f"[{mid}] el layout tiene la escena '{k}' que la mision no usa")
                svg_de = {o["id"]: o.get("svg", o["id"]) for e in m.get("escenas", []) if e["id"] == k for o in e.get("objetos", [])}
                for oid in (v.get("objetos") or {}):
                    if oid not in svg_de:
                        avisos.append(f"[{mid}/{k}] layout: '{oid}' no esta en los objetos de la escena")
                    elif not lib_obj(svg_de[oid]) and not (v["objetos"][oid] or {}).get("sobre"):
                        avisos.append(f"[{mid}/{k}] layout: '{oid}' no se encuentra en la biblioteca")
        comp = DATA / "compilado" / f"{mid}.json"
        if not comp.exists():
            avisos.append(f"[{mid}] aun no esta compilada (corre compilar_aventura.py)")
        resumen_misiones.append((mid, len(turnos), len(lineas), dict(en_mision)))

    # ---------------------------------------------------------------- 4. arte del plan (inventario)
    faltan_fondos, faltan_obj, faltan_acc, faltan_caras = defaultdict(list), defaultdict(list), defaultdict(list), defaultdict(list)
    for m in plan:
        for e in m["escenas"]:
            if e["fondo"] not in lib["fondos"]:
                faltan_fondos[e["fondo"]].append(m["n"])
        for o in m["objetos"]:
            if not lib_obj(o):
                faltan_obj[o].append(m["n"])
    for pid, p in nuevos.items():
        acc = p.get("accesorio")
        if acc and acc not in lib["accesorios"] and acc not in ACCESORIOS_DIBUJADOS:
            faltan_acc[acc].append(pid)
        cp = format(ord(p["cara_base"][0]), "x")
        if cp not in lib["caras"]:
            faltan_caras[p["cara_base"]].append(pid)
    for d, nombre in ((faltan_fondos, "fondo"), (faltan_obj, "objeto"), (faltan_acc, "accesorio"), (faltan_caras, "cara")):
        for k, hs in sorted(d.items()):
            avisos.append(f"arte pendiente: {nombre} '{k}' (lo usan: {sorted(set(hs), key=str)})")

    # ---------------------------------------------------------------- reporte
    L = ["REPORTE DE VALIDACION - AVENTURA", "=" * 48,
         f"Historias en el plan:      {len(plan)}",
         f"Misiones escritas:         {len(escritas)}",
         f"Reglas en el plan:         {len(historias_por_regla)}" + (f"  (archivo: {ruta_reglas})" if ruta_reglas else ""),
         f"Arte pendiente:            {len(faltan_fondos)} fondos, {len(faltan_obj)} objetos, "
         f"{len(faltan_acc)} accesorios, {len(faltan_caras)} caras",
         f"Errores: {len(errores)}   Avisos: {len(avisos)}", ""]
    if resumen_misiones:
        L.append("MISIONES ESCRITAS (turnos del jugador / lineas / turnos por regla)")
        for mid, nt, nl, er in resumen_misiones:
            L.append(f"  {mid}: {nt} turnos, {nl} lineas, reglas {er}")
        L.append("")
    bajas = [r for r in historias_por_regla if turnos_regla[r] < META_TURNOS_GLOBAL]
    if len(escritas) >= len(plan) and bajas:
        avisos.append(f"cobertura: {len(bajas)} regla(s) con menos de {META_TURNOS_GLOBAL} turnos en total: {sorted(bajas)}")
    L.append(f"COBERTURA POR REGLA (meta al final: {META_TURNOS_GLOBAL}+ turnos)")
    L.append("  id  turnos  historias del plan        regla")
    todas = sorted(set(historias_por_regla) | set(turnos_regla))
    for r in todas:
        marca = "OK " if turnos_regla[r] >= META_TURNOS_GLOBAL else "   "
        nombre = reglas.get(r, "?") if reglas else ""
        L.append(f"  {r:>2}  {turnos_regla[r]:>4} {marca} {str(historias_por_regla.get(r, [])):<24} {nombre}")
    L.append("")
    if errores:
        L.append(f"ERRORES ({len(errores)}):")
        L += [f"  - {e}" for e in errores]
        L.append("")
    if avisos:
        L.append(f"AVISOS ({len(avisos)}):")
        L += [f"  - {a}" for a in avisos]
    texto = "\n".join(L) + "\n"
    REPORTE.write_text(texto, encoding="utf-8")
    print(texto)

    if args.inventario:
        escribir_inventario(plan, nuevos, lib, lib_obj, faltan_fondos, faltan_obj, faltan_acc, faltan_caras, reglas, palabras)
        print(f"Inventario escrito en {INVENTARIO.name}")
    sys.exit(1 if errores else 0)


def escribir_inventario(plan, nuevos, lib, lib_obj, ff, fo, fa, fc, reglas, palabras):
    reuso_obj = defaultdict(int)
    for m in plan:
        for o in m["objetos"]:
            if lib_obj(o):
                reuso_obj[o] += 1
    L = ["# Inventario de arte de las 40 historias", "",
         "Generado por `validar_aventura.py --inventario` a partir de `data/catalogo_misiones.json` y la biblioteca SVG.",
         "Todo lo que aparece como **pendiente** se dibuja en las entregas 2 (fondos) y 3 (objetos y accesorios).",
         "Despues de eso el arte queda cerrado: las historias solo reutilizan.", "",
         "## Resumen", "",
         f"- Fondos: {len(lib['fondos'])} existentes, **{len(ff)} pendientes**",
         f"- Objetos: {len(lib['objetos'])} existentes, **{len(fo)} pendientes**",
         f"- Accesorios pendientes: **{len(fa)}**  |  Caras pendientes: **{len(fc)}**",
         f"- Personajes nuevos (se arman con caras, ropa y accesorios; sin arte extra): {len(nuevos)}", "",
         "## Fondos pendientes", "", "| Fondo | Historias |", "|---|---|"]
    L += [f"| {k} | {', '.join(map(str, sorted(set(v))))} |" for k, v in sorted(ff.items())]
    L += ["", "## Objetos pendientes", "", "| Objeto | Historias |", "|---|---|"]
    fuera = lambda k: any(not palabra_ok(t, palabras) for t in k.split("_"))
    L += [f"| {k}{' †' if fuera(k) else ''} | {', '.join(map(str, sorted(set(v))))} |" for k, v in sorted(fo.items())]
    L += ["", "† El nombre en ingles no esta en tu lista de palabras: el objeto se dibuja igual, pero al tocarlo dira un "
          "nombre armado con palabras de tu lista (p. ej. atm -> \"a money machine\") o quedara como decoracion."]
    L += ["", "## Accesorios pendientes", "", "| Accesorio | Personajes |", "|---|---|"]
    L += [f"| {k} | {', '.join(v)} |" for k, v in sorted(fa.items())]
    L += ["", "## Personajes nuevos", "", "| id | Nombre | Rol | Voz | Cara | Accesorio |", "|---|---|---|---|---|---|"]
    L += [f"| {k} | {p['nombre']} | {p['rol_es']} | {p['voz']} | {p['cara_base']} | {p.get('accesorio', '')} |" for k, p in nuevos.items()]
    L += ["", "## Historias", ""]
    for m in plan:
        esc = ", ".join(f"{e['id']} ({e['fondo']}{' *' if e['fondo'] not in lib['fondos'] else ''})" for e in m["escenas"])
        obj = ", ".join(o + ("" if lib_obj(o) else " *") for o in m["objetos"])
        rg = ", ".join(f"{r} {reglas.get(r, '') if reglas else ''}".strip() for r in m["reglas"])
        L += [f"### {m['n']}. {m['titulo']} — {m['titulo_es']}  ·  {m['nivel']}  ·  lote {m['lote']}", "",
              f"- Objetivo: {m['objetivo']} / {m['objetivo_es']}",
              f"- Reglas: {rg}", f"- Escenas: {esc}", f"- Objetos: {obj}",
              f"- Personajes: {', '.join(m['personajes'])}", ""]
    L += ["`*` = pendiente de dibujar.", "",
          "## Objetos existentes mas reutilizados", "",
          ", ".join(f"{k} ({n})" for k, n in sorted(reuso_obj.items(), key=lambda x: -x[1])[:30]), ""]
    INVENTARIO.write_text("\n".join(L), encoding="utf-8")


if __name__ == "__main__":
    main()
