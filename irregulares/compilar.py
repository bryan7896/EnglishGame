#!/usr/bin/env python3
# irregulares/compilar.py
# Lee y valida los datos de la sección "Irregulares" (solo inglés americano):
#
#   data-en/irregulares/verbos-irregulares.json   100 verbos en 10 paquetes de 10
#   data-en/irregulares/seccion/paquete-NN.txt    30 "seleccionar" (S) + 30 "completar" (C)
#   data-en/irregulares/banco/paquete-NN.txt      banco de traducción (t) y completar (c)
#                                                 por regla gramatical, 2 verbos del paquete
#
# Formato de las líneas (los "#" son comentarios, las líneas vacías se ignoran):
#
#   Sección:  S|verbo.forma|Español con **verbo** en negrita|English with [form]|distractor1,distractor2
#             C|verbo.forma|Español|English with [form]
#             (forma: b = base, p = pasado, pp = participio; los distractores son opcionales)
#
#   Banco:    regla|t|Español|English with [form1] and [form2]
#             regla|c|Español|English with [form1] and [form2]
#             (en "c" los corchetes se vuelven huecos; en "t" solo se quitan)
#
# build.py llama a cargar_irregulares(); también se puede correr suelto para ver
# el reporte de validación:  python3 irregulares/compilar.py
import json
import os
import re
import sys

BASE = "data-en"
VERBOS_FILE = os.path.join(BASE, "irregulares", "verbos-irregulares.json")
SECCION_DIR = os.path.join(BASE, "irregulares", "seccion")
BANCO_DIR = os.path.join(BASE, "irregulares", "banco")
REGLAS_FILE = os.path.join(BASE, "reglas-gramaticales.json")
REGLA_IRREGULARES = 19
FORMAS = {"b": "base", "p": "past", "pp": "participle"}
BRACKET = re.compile(r"\[([^\[\]]+)\]")


def _norm(w):
    return w.strip().lower().replace("’", "'")


def _cargar_verbos():
    with open(VERBOS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data["verbs"]


def _cargar_reglas():
    if not os.path.exists(REGLAS_FILE):
        return set()
    with open(REGLAS_FILE, encoding="utf-8") as f:
        data = json.load(f)
    rules = data.get("reglas", data if isinstance(data, list) else [])
    return {int(r["id"]) for r in rules}


def _regularizado(base):
    """Forma regular inventada (error típico) para usar como distractor: meet -> meeted."""
    if base.endswith("e"):
        return base + "d"
    if base.endswith("y") and len(base) > 2 and base[-2] not in "aeiou":
        return base[:-1] + "ied"
    v = "aeiou"
    if len(base) >= 3 and base[-1] not in v + "wxy" and base[-2] in v and base[-3] not in v:
        return base + base[-1] + "ed"          # put -> putted, quit -> quitted
    return base + "ed"


def _tercera(base):
    if base.endswith(("s", "sh", "ch", "x", "o")):
        return base + "es"
    if base.endswith("y") and len(base) > 2 and base[-2] not in "aeiou":
        return base[:-1] + "ies"
    return base + "s"


def _lineas(path):
    with open(path, encoding="utf-8") as f:
        for n, raw in enumerate(f, 1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            yield n, line


def cargar_irregulares(verbose=True):
    verbos = _cargar_verbos()
    reglas_validas = _cargar_reglas()
    por_base = {v["forms"]["base"]["en"]: v for v in verbos}
    avisos = []

    def aviso(msg):
        avisos.append(msg)

    # Mapa palabra -> verbos del paquete (para el banco)
    def mapa_paquete(pkg):
        m = {}
        for v in verbos:
            if v["package"] != pkg:
                continue
            for fk in ("base", "past", "participle"):
                for w in v["forms"][fk]["variants"]:
                    m.setdefault(_norm(w), set()).add(v["id"])
        return m

    seccion = {}
    banco = {}
    resumen = {}
    for pkg in range(1, 11):
        sel, comp = [], []
        spath = os.path.join(SECCION_DIR, f"paquete-{pkg:02d}.txt")
        if os.path.exists(spath):
            for n, line in _lineas(spath):
                parts = [p.strip() for p in line.split("|")]
                donde = f"{os.path.basename(spath)}:{n}"
                if parts[0] not in ("S", "C") or len(parts) < 4:
                    aviso(f"{donde}: línea mal formada"); continue
                tipo, tag, es, en = parts[0], parts[1], parts[2], parts[3]
                try:
                    vb, fk = tag.rsplit(".", 1)
                    v = por_base[vb]
                    forma = FORMAS[fk]
                except (ValueError, KeyError):
                    aviso(f"{donde}: etiqueta de verbo inválida '{tag}'"); continue
                if v["package"] != pkg:
                    aviso(f"{donde}: '{vb}' no es del paquete {pkg}"); continue
                marcas = BRACKET.findall(en)
                if len(marcas) != 1:
                    aviso(f"{donde}: debe tener exactamente 1 [forma] en inglés"); continue
                variantes = [_norm(w) for w in v["forms"][forma]["variants"]]
                if _norm(marcas[0]) not in variantes:
                    aviso(f"{donde}: [{marcas[0]}] no es la forma {forma} de '{vb}' ({'/'.join(variantes)})"); continue
                fid = v["forms"][forma]["id"]
                if tipo == "S":
                    if "**" not in es:
                        aviso(f"{donde}: falta el verbo en **negrita** en español")
                    resp = marcas[0]
                    if len(parts) >= 5 and parts[4]:
                        dis = [d.strip() for d in parts[4].split(",") if d.strip()]
                    else:
                        cand = []
                        for k in ("base", "past", "participle"):
                            for w in v["forms"][k]["variants"]:
                                cand.append(w)
                        cand.append(_regularizado(v["forms"]["base"]["en"]))
                        cand.append(_tercera(v["forms"]["base"]["en"]))
                        dis = []
                        for w in cand:
                            if _norm(w) != _norm(resp) and _norm(w) not in [_norm(x) for x in dis]:
                                dis.append(w)
                        # Primero las otras formas reales; si sobran, se queda con 2.
                        dis = dis[:2] if len(dis) >= 2 else dis
                    dis = [d for d in dis if _norm(d) != _norm(resp)][:2]
                    if len(dis) < 2:
                        aviso(f"{donde}: no hay 2 distractores distintos"); continue
                    sel.append({"f": fid, "v": v["id"], "es": es, "en": en, "op": [resp] + dis})
                else:
                    comp.append({"f": fid, "v": v["id"], "es": es, "en": en})
        for nombre, lista in (("seleccionar", sel), ("completar", comp)):
            ids = [x["f"] for x in lista]
            dup = {i for i in ids if ids.count(i) > 1}
            if dup:
                aviso(f"paquete {pkg}: formas repetidas en {nombre}: {sorted(dup)}")
            esperadas = {v["forms"][k]["id"] for v in verbos if v["package"] == pkg for k in ("base", "past", "participle")}
            faltan = esperadas - set(ids)
            if faltan and (sel or comp):
                aviso(f"paquete {pkg}: faltan {len(faltan)} formas en {nombre}")
        seccion[str(pkg)] = {"sel": sel, "comp": comp}

        # ---------- Banco ----------
        items = []
        bpath = os.path.join(BANCO_DIR, f"paquete-{pkg:02d}.txt")
        mapa = mapa_paquete(pkg)
        vistos = set()
        if os.path.exists(bpath):
            for n, line in _lineas(bpath):
                parts = [p.strip() for p in line.split("|")]
                donde = f"banco/{os.path.basename(bpath)}:{n}"
                if len(parts) != 4 or parts[1] not in ("t", "c"):
                    aviso(f"{donde}: línea mal formada"); continue
                try:
                    regla = int(parts[0])
                except ValueError:
                    aviso(f"{donde}: regla inválida"); continue
                if reglas_validas and regla not in reglas_validas:
                    aviso(f"{donde}: la regla {regla} no existe"); continue
                es, en = parts[2], parts[3]
                if "✗" in line or "..." in en or "…" in en or "[ " in en:
                    aviso(f"{donde}: texto incompleto o con notas"); continue
                marcas = BRACKET.findall(en)
                if len(marcas) != 2:
                    aviso(f"{donde}: debe tener exactamente 2 [formas] ({len(marcas)})"); continue
                vids = []
                ok = True
                for w in marcas:
                    cands = mapa.get(_norm(w))
                    if not cands:
                        aviso(f"{donde}: [{w}] no es una forma de los verbos del paquete {pkg}"); ok = False; break
                    vids.append(sorted(cands))
                if not ok:
                    continue
                # Elige verbos distintos para las 2 marcas (por si una palabra es de 2 verbos)
                elegido = None
                for a in vids[0]:
                    for b in vids[1]:
                        if a != b:
                            elegido = [a, b]; break
                    if elegido:
                        break
                if not elegido:
                    aviso(f"{donde}: las 2 formas son del mismo verbo"); continue
                clave = _norm(BRACKET.sub(lambda m: m.group(1), en))
                if clave in vistos:
                    aviso(f"{donde}: frase repetida"); continue
                vistos.add(clave)
                if not es or es == en:
                    aviso(f"{donde}: falta el español"); continue
                items.append([f"irr{pkg:02d}-{len(items) + 1:04d}", regla, parts[1], es, en, elegido])
        banco[str(pkg)] = items
        porregla = {}
        for it in items:
            porregla.setdefault(it[1], [0, 0])[0 if it[2] == "t" else 1] += 1
        resumen[pkg] = {"sel": len(sel), "comp": len(comp), "banco": len(items), "reglas": len(porregla),
                        "t": sum(1 for i in items if i[2] == "t"), "c": sum(1 for i in items if i[2] == "c")}

    verbos_cliente = []
    for v in verbos:
        verbos_cliente.append({
            "id": v["id"], "rank": v["rank"], "p": v["package"], "o": v["order"], "pat": v["pattern"],
            "f": [{"id": v["forms"][k]["id"], "en": v["forms"][k]["en"], "var": v["forms"][k]["variants"],
                   "es": v["forms"][k]["es"], "badge": bool(v.get("badgeNeeded", {}).get(k))}
                  for k in ("base", "past", "participle")],
            "nota": v.get("note", ""),
        })

    if verbose:
        total = sum(r["banco"] for r in resumen.values())
        for pkg, r in resumen.items():
            print(f"  ✅ [irregulares] paquete {pkg}: {r['sel']} seleccionar · {r['comp']} completar · "
                  f"banco {r['banco']} ({r['t']} traducción / {r['c']} completar, {r['reglas']} reglas)")
        print(f"  ✅ [irregulares] banco total: {total} ejercicios")
        if avisos:
            print(f"  ⚠️  [irregulares] {len(avisos)} aviso(s) (líneas omitidas o incompletas):")
            for a in avisos[:40]:
                print("     - " + a)
            if len(avisos) > 40:
                print(f"     … y {len(avisos) - 40} más (python3 irregulares/compilar.py para verlos todos)")

    return {"verbos": verbos_cliente, "seccion": seccion, "banco": banco, "regla": REGLA_IRREGULARES}, avisos, resumen


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(os.path.dirname(here))
    data, avisos, resumen = cargar_irregulares(verbose=False)
    for a in avisos:
        print("⚠️ ", a)
    total = 0
    for pkg, r in resumen.items():
        total += r["banco"]
        print(f"paquete {pkg:2d}: sel {r['sel']:2d} · comp {r['comp']:2d} · banco {r['banco']:4d} "
              f"(t {r['t']}, c {r['c']}, reglas {r['reglas']})")
    print(f"banco total: {total} · avisos: {len(avisos)}")
    if "--por-regla" in sys.argv:
        cuenta = {}
        for pkg, items in data["banco"].items():
            for it in items:
                cuenta[it[1]] = cuenta.get(it[1], 0) + 1
        for r in sorted(cuenta):
            print(f"  regla {r:2d}: {cuenta[r]}")
    sys.exit(1 if "--estricto" in sys.argv and avisos else 0)
