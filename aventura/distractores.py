"""Opciones incorrectas = frases CORRECTAS que Bryan dice en OTRAS historias (su audio ya existe).
Reglas: de otra historia; sin palabras de contenido en común con el diálogo actual; sin nombres de
personajes; largo parecido a la correcta; las dos de historias distintas; ninguna se usa más de 3 veces.
Uso: python3 distractores.py RUTA/aventura"""
import json, pathlib, random, re, sys, collections

AV = pathlib.Path(sys.argv[1])
random.seed(16)
STOP = set("""a an the and or but so to of in on at for with from by as is are am was were be been being do does did done
have has had i you he she it we they me him her us them my your his its our their this that these those there here what
where when why who how which not no yes ok okay sure please thanks thank sorry oh wow ha hey hi hello well then too very
can could will would should must might may shall just only also again now really all some any one two let lets let's
i'm you're he's she's it's we're they're i've you've we've i'll you'll we'll i'd don't doesn't didn't isn't aren't wasn't
can't won't haven't hasn't hadn't that's what's there's here's mom dad great good nice cool fine right course
""".split())
MISIONES = sorted((AV / "data" / "misiones").glob("m*.json"))
ELENCO = json.loads((AV / "data" / "elenco.json").read_text(encoding="utf-8"))
NOMBRES = {k.lower() for k in ELENCO["personajes"]} | {p.get("nombre", "").lower() for p in ELENCO["personajes"].values()}
NOMBRES |= {"walter", "nina", "pedro", "kenji", "marco", "olivia", "ruth", "hank", "clark", "grace", "ben", "patel", "joe", "frank", "leo", "rosa", "linda", "george"}


def palabras(t):
    return [w.strip("'") for w in re.findall(r"[a-z']+", t.lower())]


def raiz(w):
    for suf in ("ing", "ed", "es", "s"):
        if len(w) > 4 and w.endswith(suf):
            return w[: -len(suf)]
    return w


TEMAS = {
 "clima": "rain raining rained sunny sun cold hot wet dark cloudy clouds storm snow snowing weather warm umbrella sky",
 "espera": "wait waiting waited late early minutes minute hours hour time hurry long soon",
 "comida": "eat eating ate food cake pizza coffee tea hungry dinner lunch breakfast juice sandwich sandwiches cookies drink drinking soup bread eggs milk sugar ice cream pasta steak fruit bananas honey",
 "viaje": "bus train taxi station ticket car airport flight trip drive driving road stop",
 "dinero": "money dollars pay paid card bank cheap cheapest price buy bought",
 "telefono": "phone call called battery number",
 "salud": "sick doctor medicine headache pharmacy tired",
 "casa": "house home room kitchen garden street live lives lived",
 "fiesta": "party birthday music song songs dance concert sing singer",
 "trabajo": "job work working worked office project interview company",
 "estudio": "study studying school university class teacher book books library english",
}
TEMAS = {k: set(v.split()) for k, v in TEMAS.items()}


def temas(t):
    ws = set(palabras(t))
    return {k for k, v in TEMAS.items() if ws & v}


def contenido(t):
    return {raiz(w) for w in palabras(t) if w and w not in STOP and len(w) > 2}


def recorrer(m):
    for e in m["escenas"]:
        for x in e.get("personajes", []) + e.get("objetos", []):
            d = x.get("dialogo")
            if d:
                yield d["pasos"]


# 1) piscina: respuestas correctas de Bryan, por historia
datos = [(f, json.loads(f.read_text(encoding="utf-8"))) for f in MISIONES]
pool = {}
for f, m in datos:
    for pasos in recorrer(m):
        for p in pasos:
            if "opciones" in p:
                t = next(o["texto"] for o in p["opciones"] if o.get("ok"))
                pool.setdefault(t, m["id"])
candidatos = []
for t, mid in pool.items():
    pw = set(palabras(t))
    if pw & NOMBRES:
        continue
    if len(contenido(t)) < 2:        # demasiado genérica ("Yes, it is.") podría encajar en cualquier sitio
        continue
    candidatos.append((t, mid))
print("frases disponibles como incorrectas:", len(candidatos), "de", len(pool))

usos = collections.Counter()
cambios = 0
for f, m in datos:
    for pasos in recorrer(m):
        ctx_dialogo = set()
        for p in pasos:
            ctx_dialogo |= contenido(p["texto"]) if "texto" in p else set()
            if "opciones" in p:
                ctx_dialogo |= contenido(next(o["texto"] for o in p["opciones"] if o.get("ok")))
        previas = []
        for p in pasos:
            if "opciones" not in p:
                previas.append(p.get("texto", ""))
                continue
            ok = next(o for o in p["opciones"] if o.get("ok"))
            ctx = ctx_dialogo | contenido(" ".join(previas[-3:])) | contenido(ok["texto"])
            ctx_temas = temas(" ".join(previas[-2:]) + " " + ok["texto"])
            n_ok = len(palabras(ok["texto"]))
            pregunta = ok["texto"].rstrip().endswith("?")
            elegidas = []
            for intento in range(2):
                def puntaje(c):
                    t, mid = c
                    n = len(palabras(t))
                    s = abs(n - n_ok) / max(n_ok, 1) * 3 + usos[t] * 1.5 + random.random()
                    if t.rstrip().endswith("?") != pregunta:
                        s += 1.2
                    return s
                ops = [c for c in candidatos if c[1] != m["id"] and c[0] != ok["texto"]
                       and not (contenido(c[0]) & ctx) and not (temas(c[0]) & ctx_temas) and usos[c[0]] < 4
                       and all(c[1] != e[1] and c[0] != e[0] for e in elegidas)]
                ops.sort(key=puntaje)
                elegidas.append(ops[0])
            for c in elegidas:
                usos[c[0]] += 1
            p["opciones"] = [{"texto": ok["texto"], "ok": True}] + [{"texto": c[0]} for c in elegidas]
            previas.append(ok["texto"])
            cambios += 1
    f.write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("turnos rehechos:", cambios, "| frases distintas usadas como incorrectas:", len(usos), "| máx. usos:", max(usos.values()))
