#!/usr/bin/env python3
"""
Construye la biblioteca de SVG del juego (200 objetos + 30 caras + accesorios).

  python construir_svg.py --twemoji RUTA   (RUTA = carpeta con los .svg de Twemoji: npm i @twemoji/svg -> node_modules/@twemoji/svg)

Fuentes de arte:
  * tw:<hex>  -> SVG de Twemoji (graficos CC-BY 4.0, ver svg/CREDITOS.md). Animales, comida, ropa y objetos con emoji.
  * dibujo    -> SVG dibujado aqui, en la MISMA paleta/estilo plano de Twemoji (mesa, nevera, pasto, ventana, etc.).

Salida (carpeta svg/):  objetos/*.svg  caras/*.svg  accesorios/*.svg  biblioteca.js  catalogo.html  catalogo_svg.json
y actualiza data/objetos_audio.json (el nombre en audio de cada objeto, solo con palabras de tu lista).
Despues:  python compilar_aventura.py  y  python generar_audio_tts.py   (generan los audios de los nombres nuevos).
"""
import argparse
import json
import pathlib
import re
import sys

AQUI = pathlib.Path(__file__).resolve().parent
SVG = AQUI / "svg"
DATA = AQUI / "data"

# Paleta (la de Twemoji) ---------------------------------------------------------------------------------
ROJO, ROJO_OSC = "#DD2E44", "#BE1931"
NARANJA, AMARILLO, CREMA = "#F4900C", "#FFCC4D", "#FFE8B6"
VERDE, VERDE_OSC, VERDE_CLA = "#77B255", "#5C913B", "#A6D388"
AZUL, AZUL_OSC, CELESTE = "#55ACEE", "#3B88C3", "#9AD0F5"
MARRON, MARRON_OSC, MARRON_CLA = "#C1694F", "#662113", "#D99E82"
GRIS, GRIS_OSC, GRIS_MED, GRIS_NEG = "#CCD6DD", "#99AAB5", "#66757F", "#292F33"
BLANCO, MORADO, MORADO_OSC = "#F5F8FA", "#9266CC", "#553788"

# ------------------------------------------------------------------------------------------------------
# CATALOGO: (id, espanol, categoria, fuente)   fuente = hex de Twemoji o "D" (dibujado)
# El nombre hablado es el id (guion bajo -> espacio). Toda palabra debe estar en palabras.txt.
# ------------------------------------------------------------------------------------------------------
C = []
def add(cat, filas):
    for f in filas.strip().splitlines():
        i, es, src = [x.strip() for x in f.split("|")]
        C.append((i, es, cat, src))

add("naturaleza", """
tree|árbol|1f333
forest|bosque|1f332
flowers|flores|1f337
leaf|hoja|1f343
cloud|nube|2601
sun|sol|2600
moon|luna|1f319
star|estrella|2b50
rain|lluvia|1f327
snow|nieve|2744
wind|viento|1f4a8
fire|fuego|1f525
mountain|montaña|26f0
sea|mar|1f30a
island|isla|1f3dd
beach|playa|1f3d6
water|charco de agua|D
earth|planeta tierra|1f30d
grass|pasto|D
rock|roca|1faa8
hill|colina|D
river|río|D
lake|lago|D
field|campo|D
sand|arena|D
garden|jardín|D
path|sendero|D
""")
add("lugares", """
house|casa|D
building|edificio|1f3e2
store|tienda|1f3ea
shop|almacén|1f3ec
church|iglesia|26ea
hotel|hotel|1f3e8
station|estación|1f689
library|biblioteca|1f4da
park|parque|1f3de
bridge|puente|1f309
farm|granja|1f69c
tooth|diente|1f9b7
hospital|hospital|1f3e5
school|escuela|1f3eb
bank|banco|1f3e6
market|mercado|1f6d2
street|calle|D
road|carretera|D
pool|piscina|D
wall|pared|D
floor|piso|D
sign|señal|D
street_lamp|farola|D
""")
add("transporte", """
taxi|taxi|1f695
car|carro|1f697
bus|bus|1f68c
motorcycle|moto|1f3cd
helicopter|helicóptero|1f681
boat|bote|26f5
train|tren|1f682
plane|avión|2708
bicycle|bicicleta|1f6b2
""")
add("casa", """
door|puerta|1f6aa
window|ventana|D
table|mesa|D
chair|silla|1fa91
sofa|sofá|1f6cb
bed|cama|1f6cf
lamp|lámpara|D
light|bombillo|1f4a1
speaker|altavoz|1f50a
radio|radio|1f4fb
tv|televisor|1f4fa
clock|reloj de pared|1f559
picture|cuadro|1f5bc
plant|planta|1fab4
fridge|nevera|D
stove|estufa|D
sink|lavamanos|D
shelf|estante|D
desk|escritorio|D
carpet|alfombra|D
curtain|cortina|D
stairs|escaleras|D
seat|asiento|D
pillow|almohada|D
blanket|cobija|D
towel|toalla|D
elevator|ascensor|D
box|caja|D
mirror|espejo|1fa9e
shower|ducha|1f6bf
toilet|inodoro|1f6bd
bath|bañera|1f6c1
basket|canasta|1f9fa
bottle|botella|D
""")
add("comida", """
cake|torta|1f382
pizza|pizza|1f355
cup|vaso|1f964
glass|copa|1f377
plate|plato|1f37d
bread|pan|1f35e
apple|manzana|1f34e
banana|banano|1f34c
orange|naranja|1f34a
milk|leche|1f95b
coffee|café|2615
tea|té|1f375
burger|hamburguesa|1f354
sandwich|sándwich|1f96a
salad|ensalada|1f957
soup|sopa|1f372
cheese|queso|1f9c0
egg|huevo|1f95a
rice|arroz|1f35a
juice|jugo|1f9c3
candy|dulce|1f36c
chocolate|chocolate|1f36b
potato|papa|1f954
tomato|tomate|1f345
carrot|zanahoria|1f955
onion|cebolla|1f9c5
lemon|limón|1f34b
grape|uva|1f347
strawberry|fresa|1f353
fruit|sandía|1f349
beer|cerveza|1f37a
wine|vino|1f37e
cookie|galleta|1f36a
salt|sal|1f9c2
pepper|ají|1f336
honey|miel|1f36f
pasta|pasta|1f35d
steak|carne|1f969
sausage|salchicha|1f32d
corn|maíz|1f33d
ice|hielo|1f9ca
ice_cream|helado|1f368
fork|tenedor|1f374
spoon|cuchara|1f944
knife|cuchillo|1f52a
""")
add("objetos", """
money|dinero|1f4b8
coin|moneda|1fa99
bill|billete|1f4b5
card|tarjeta|1f4b3
wallet|billetera|1f45b
balloon|globo|1f388
gift|regalo|1f381
ticket|boleto|1f3ab
map|mapa|1f5fa
letter|carta|2709
pen|esfero|1f58a
pencil|lápiz|270f
paper|papel|1f4c4
notebook|cuaderno|1f4d3
suitcase|maleta|1f4bc
heart|corazón|2764
soccer|balón de fútbol|26bd
""")
add("ropa", """
shirt|camiseta|1f455
pants|pantalones|1f456
dress|vestido|1f457
shoes|zapatos|1f45f
coat|abrigo|1f9e5
jacket|chaqueta|D
sock|medias|1f9e6
scarf|bufanda|1f9e3
""")
add("animales y extras (50 nuevos)", """
dog|perro|1f436
cat|gato|1f431
bird|pájaro|1f426
fish|pez|1f41f
horse|caballo|1f434
cow|vaca|1f42e
pig|cerdo|1f437
sheep|oveja|1f411
chicken|pollo|1f414
duck|pato|1f986
rabbit|conejo|1f430
mouse|ratón|1f42d
monkey|mono|1f435
lion|león|1f981
tiger|tigre|1f42f
bear|oso|1f43b
elephant|elefante|1f418
snake|serpiente|1f40d
butterfly|mariposa|1f98b
spider|araña|1f577
turtle|tortuga|1f422
dolphin|delfín|1f42c
owl|búho|1f989
insect|insecto|1f41b
phone|teléfono|1f4f1
computer|computador|1f4bb
bag|bolso|1f45c
key|llave|1f511
umbrella|paraguas|2602
hat|sombrero|1f3a9
glasses|gafas|1f453
watch|reloj de pulsera|231a
book|libro|1f4d5
camera|cámara|1f4f7
flag|bandera|1f6a9
guitar|guitarra|1f3b8
piano|piano|1f3b9
""")

# 30 caras SIN manos (emocion -> hex Twemoji). La base de los personajes es la cara_base del elenco.
CARAS = {
    "neutral": "1f642", "feliz": "1f60a", "risa": "1f604", "contento": "1f601", "cool": "1f60e", "timido": "1f97a",
    "emocionado": "1f929", "curioso": "1f9d0", "molesto": "1f612", "preocupado": "1f61f", "confundido": "1f615",
    "sorpresa": "1f62e", "nervioso": "1f605", "triste": "1f622", "enojado": "1f620", "dormido": "1f634",
    "avergonzado": "1f633", "tenso": "1f62c", "guino": "1f609", "carcajada": "1f602", "serio": "1f610",
    "inexpresivo": "1f611", "picaro": "1f60f", "fastidio": "1f644", "aliviado": "1f60c", "pensativo": "1f614",
    "decepcionado": "1f61e", "asombro": "1f632", "miedo": "1f631", "asustado": "1f628",
}
# Accesorios: id -> (hex Twemoji, ancla, x, y, tamano) en el lienzo del personaje 60x120
ACCESORIOS = {
    "gorra": ("1f9e2", "cabeza", 30, 6, 34), "gorra_taxi": ("1f9e2", "cabeza", 30, 6, 34),
    "sombrero": ("1f3a9", "cabeza", 30, 4, 34), "audifonos": (None, "cabeza", 0, 0, 0),
    "lazo": ("1f380", "cabeza", 42, 6, 24), "lentes": ("1f453", "cara", 30, 22, 46),
    "bolso": (None, "cuerpo", 0, 0, 0), "mochila": (None, "cuerpo", 0, 0, 0),
}

# ------------------------------------------------------------------------------------------------------
# DIBUJOS propios (viewBox propio por pieza; base abajo-centro; sin contorno, sombra inferior mas oscura)
# ------------------------------------------------------------------------------------------------------
def R(x, y, w, h, f, rx=0): return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{f}"/>'
def E(cx, cy, rx, ry, f): return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{f}"/>'
def Cc(cx, cy, r, f): return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{f}"/>'
def Pa(d, f): return f'<path d="{d}" fill="{f}"/>'

def dib_grass():
    b = ""
    for i, x in enumerate(range(0, 66, 9)):
        h = 14 + (i % 3) * 6
        b += Pa(f"M{x} 24L{x+5} {24-h}L{x+10} 24Z", VERDE if i % 2 else VERDE_OSC)
    return 72, 24, b
def dib_hill():
    return 72, 30, Pa("M0 30Q36 -14 72 30Z", VERDE) + Pa("M10 30Q36 4 62 30Z", VERDE_CLA) + E(48, 20, 5, 2, VERDE_OSC)
def dib_river():
    return 72, 18, Pa("M0 4Q18 -3 36 4T72 4V18H0Z", AZUL) + Pa("M0 10Q18 4 36 10T72 10V18H0Z", AZUL_OSC) + R(10, 6, 12, 2, CELESTE, 1) + R(44, 12, 14, 2, CELESTE, 1)
def dib_lake():
    return 54, 24, E(27, 14, 26, 10, AZUL_OSC) + E(27, 12, 24, 8, AZUL) + R(14, 10, 12, 2, CELESTE, 1) + R(30, 14, 10, 2, CELESTE, 1) + R(46, 2, 2, 12, VERDE, 1) + R(50, 4, 2, 10, VERDE_OSC, 1)
def dib_road():
    return 72, 20, R(0, 0, 72, 20, GRIS_MED) + R(0, 0, 72, 3, GRIS_OSC) + "".join(R(x, 9, 10, 2, AMARILLO, 1) for x in range(5, 70, 17))
def dib_street():
    return 72, 26, R(0, 0, 72, 7, GRIS) + R(0, 7, 72, 2, GRIS_OSC) + R(0, 9, 72, 17, GRIS_MED) + "".join(R(x, 18, 10, 2, BLANCO, 1) for x in range(5, 70, 17))
def dib_path():
    return 54, 18, E(27, 10, 26, 8, MARRON_CLA) + E(27, 9, 22, 6, CREMA) + Cc(14, 10, 2, MARRON_CLA) + Cc(38, 8, 2, MARRON_CLA)
def dib_sand():
    return 72, 22, Pa("M0 22Q20 2 40 10T72 22Z", AMARILLO) + Pa("M12 22Q30 10 46 16T66 22Z", CREMA)
def dib_field():
    return 72, 26, R(0, 0, 72, 26, VERDE) + "".join(R(0, y, 72, 5, VERDE_OSC) for y in (6, 16)) + Cc(14, 3, 1.5, AMARILLO) + Cc(46, 12, 1.5, ROJO) + Cc(60, 3, 1.5, BLANCO)
def dib_garden():
    f = "".join(Cc(x, y, 2.4, c) + Cc(x, y, 0.9, AMARILLO) for x, y, c in [(10, 8, ROJO), (24, 5, "#F4ABBA"), (36, 9, BLANCO), (46, 5, AZUL)])
    return 54, 30, E(27, 20, 26, 10, VERDE_OSC) + E(27, 18, 24, 9, VERDE) + f
def dib_water():  # charco
    return 54, 14, E(27, 8, 26, 6, AZUL_OSC) + E(27, 7, 23, 4.5, AZUL) + R(14, 5, 10, 1.6, CELESTE, 1) + R(30, 8, 8, 1.6, CELESTE, 1)
def dib_pool():
    return 72, 30, R(0, 6, 72, 24, BLANCO) + R(4, 10, 64, 18, AZUL) + R(4, 10, 64, 4, CELESTE) + R(14, 18, 14, 2, CELESTE, 1) + R(40, 22, 18, 2, CELESTE, 1) + R(58, 0, 3, 14, GRIS_OSC, 1) + R(65, 0, 3, 14, GRIS_OSC, 1)
def dib_wall():
    b = R(0, 0, 72, 40, MARRON_CLA)
    for r in range(4):
        y = r * 10
        b += R(0, y + 9, 72, 1.5, MARRON_OSC)
        for x in range(0 if r % 2 == 0 else -9, 72, 18):
            b += R(x + 17, y, 1.5, 10, MARRON_OSC)
    return 72, 40, b
def dib_floor():
    b = R(0, 0, 72, 14, MARRON)
    for x in (0, 18, 36, 54): b += R(x, 0, 1.5, 14, MARRON_OSC) + R(x + 6, 6, 9, 1.5, MARRON_CLA)
    return 72, 14, b + R(0, 12, 72, 2, MARRON_OSC)
def dib_sign():
    return 36, 48, R(16, 18, 4, 30, GRIS_MED, 1) + R(4, 2, 28, 18, BLANCO, 3) + R(6, 4, 24, 14, AZUL, 2) + Pa("M10 11H24M20 7L26 11L20 15", BLANCO).replace('fill="#F5F8FA"', 'fill="none" stroke="#F5F8FA" stroke-width="2"')
def dib_street_lamp():
    return 24, 60, R(10, 12, 4, 46, GRIS_NEG, 1) + R(4, 56, 16, 4, GRIS_NEG, 2) + Pa("M4 12Q12 -2 20 12Z", GRIS_NEG) + E(12, 13, 6, 3, AMARILLO) + E(12, 16, 9, 3, "#FFE8B6")
def dib_window():
    return 36, 36, R(2, 2, 32, 32, BLANCO, 3) + R(5, 5, 12.5, 12.5, CELESTE, 1) + R(18.5, 5, 12.5, 12.5, CELESTE, 1) + R(5, 18.5, 12.5, 12.5, CELESTE, 1) + R(18.5, 18.5, 12.5, 12.5, CELESTE, 1) + R(0, 32, 36, 4, GRIS_OSC, 2) + Pa("M7 14L12 7M20 14L25 7", BLANCO).replace('fill="#F5F8FA"', 'fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"')
def dib_table():
    return 72, 44, R(2, 6, 68, 8, MARRON, 3) + R(2, 12, 68, 3, MARRON_OSC, 1.5) + R(8, 14, 6, 30, MARRON_OSC, 2) + R(58, 14, 6, 30, MARRON_OSC, 2)
def dib_lamp():
    return 28, 44, Pa("M4 18L8 2H20L24 18Z", AMARILLO) + Pa("M4 18L24 18L22 21H6Z", NARANJA) + R(12, 20, 4, 18, GRIS_MED, 1) + E(14, 40, 9, 4, GRIS_NEG)
def dib_fridge():
    return 36, 56, R(4, 0, 28, 56, GRIS, 4) + R(4, 18, 28, 2, GRIS_OSC) + R(26, 6, 2.5, 8, GRIS_MED, 1) + R(26, 25, 2.5, 14, GRIS_MED, 1) + R(6, 52, 24, 4, GRIS_OSC, 2)
def dib_stove():
    return 44, 44, R(2, 6, 40, 38, GRIS, 3) + R(2, 2, 40, 6, GRIS_MED, 2) + "".join(E(x, 5, 6, 2, GRIS_NEG) for x in (12, 32)) + R(6, 18, 32, 20, GRIS_NEG, 3) + R(10, 22, 24, 12, "#4B5961", 2) + R(10, 14, 24, 2.5, GRIS_MED, 1) + Cc(10, 11, 1.5, ROJO) + Cc(18, 11, 1.5, ROJO) + Cc(26, 11, 1.5, ROJO) + Cc(34, 11, 1.5, ROJO)
def dib_sink():
    return 52, 46, R(6, 20, 40, 26, BLANCO, 3) + R(2, 14, 48, 8, GRIS, 3) + R(8, 16, 36, 4, AZUL, 2) + R(24, 2, 4, 12, GRIS_MED, 2) + R(24, 2, 12, 3.5, GRIS_MED, 2) + R(8, 24, 36, 2, GRIS, 1)
def dib_shelf():
    b = R(2, 0, 50, 46, MARRON, 3) + R(5, 3, 44, 18, MARRON_OSC, 1) + R(5, 24, 44, 18, MARRON_OSC, 1)
    for i, c in enumerate([ROJO, AZUL, AMARILLO, VERDE, MORADO]):
        b += R(8 + i * 8, 6 + (i % 2) * 2, 6, 15 - (i % 2) * 2, c, 1) + R(10 + i * 8, 28, 6, 14, [AZUL, ROJO, VERDE, AMARILLO, NARANJA][i], 1)
    return 54, 46, b
def dib_desk():
    return 72, 44, R(2, 4, 68, 7, MARRON, 3) + R(4, 11, 22, 33, MARRON_OSC, 2) + R(48, 11, 22, 33, MARRON_OSC, 2) + R(8, 16, 14, 9, MARRON, 2) + R(8, 29, 14, 9, MARRON, 2) + Cc(15, 20, 1.3, AMARILLO) + Cc(15, 33, 1.3, AMARILLO)
def dib_carpet():
    return 72, 16, E(36, 8, 35, 7, ROJO_OSC) + E(36, 8, 31, 5.5, ROJO) + E(36, 8, 22, 3.5, AMARILLO) + E(36, 8, 18, 2.6, ROJO_OSC)
def dib_curtain():
    return 40, 48, R(0, 0, 40, 4, GRIS_MED, 2) + Pa("M2 4H18Q16 24 6 46H2Z", ROJO) + Pa("M38 4H22Q24 24 34 46H38Z", ROJO) + Pa("M10 4Q12 24 6 46", ROJO_OSC).replace('fill="#BE1931"', 'fill="none" stroke="#BE1931" stroke-width="1.5"')
def dib_stairs():
    return 56, 40, "".join(R(i * 11, 40 - (i + 1) * 8, 56 - i * 11, 8, MARRON_CLA if i % 2 else MARRON, 1) for i in range(5))
def dib_seat():
    return 72, 34, R(4, 10, 64, 24, MORADO_OSC, 8) + R(8, 4, 56, 18, MORADO, 8) + R(12, 8, 48, 3, "#B79DDD", 2)
def dib_pillow():
    return 36, 28, R(2, 2, 32, 24, AZUL, 8) + R(2, 18, 32, 8, AZUL_OSC, 6) + Cc(18, 14, 2, BLANCO)
def dib_blanket():
    b = R(2, 2, 52, 22, ROJO, 4)
    for x in (14, 26, 38): b += R(x, 2, 3, 22, AMARILLO)
    return 56, 26, b + R(2, 20, 52, 4, ROJO_OSC, 2)
def dib_towel():
    return 36, 36, R(6, 2, 24, 32, AZUL, 3) + R(6, 10, 24, 4, BLANCO) + R(6, 18, 24, 4, BLANCO) + R(6, 30, 24, 4, AZUL_OSC, 2)
def dib_elevator():
    return 44, 58, R(2, 0, 40, 58, GRIS_OSC, 3) + R(6, 4, 15, 50, GRIS, 1) + R(23, 4, 15, 50, GRIS, 1) + R(20, 4, 4, 50, GRIS_MED) + Cc(40, 28, 1.6, AMARILLO) + R(14, 0, 16, 3, GRIS_NEG, 1)
def dib_box():
    return 40, 32, R(2, 6, 36, 26, MARRON_CLA, 2) + R(2, 6, 36, 6, MARRON, 2) + R(16, 6, 8, 12, CREMA, 1)
def dib_bottle():
    return 18, 44, R(6, 0, 6, 8, GRIS_MED, 1) + Pa("M6 8H12L16 18V40Q16 44 12 44H6Q2 44 2 40V18Z", VERDE) + R(4, 24, 10, 10, CREMA, 2) + R(5, 18, 2, 18, VERDE_CLA, 1)
def dib_jacket():
    return 36, 36, Pa("M12 4H24L34 10L32 30H26L26 34H10L10 30H4L2 10Z", AZUL_OSC) + R(17, 6, 2, 28, CELESTE) + R(10, 4, 16, 3, AZUL, 1.5) + R(2, 24, 6, 6, AZUL, 2) + R(28, 24, 6, 6, AZUL, 2)


# ------------------------------------------------------------------------------------------------------
# FONDOS (160x90, se estiran al escenario). Los 4 primeros son los de la mision m001; los demas, para las proximas historias.
# ------------------------------------------------------------------------------------------------------
def _estrellas(n=28):
    return "".join(f'<circle cx="{(i*37)%160}" cy="{(i*53)%40}" r="{0.3+(i%3)*0.2}" fill="#fff" opacity=".8"/>' for i in range(n))
def _edificios(color, base=62):
    s = ""
    for bx, h in [(0, 30), (22, 44), (44, 26), (70, 50), (96, 34), (118, 46), (140, 28)]:
        s += f'<rect x="{bx}" y="{base-h}" width="22" height="{h}" fill="{color}"/>'
        for k in range(int(h / 9) - 1):
            s += f'<rect x="{bx+4}" y="{base-h+5+k*9}" width="4" height="4" fill="#ffd36b" opacity=".7"/><rect x="{bx+13}" y="{base-h+5+k*9}" width="4" height="4" fill="#ffd36b" opacity=".5"/>'
    return s
def fondo_fiesta_noche():
    luces = "".join(f'<circle cx="{i*14.5+4}" cy="{16 if i%2 else 13}" r="1.3" fill="{["#ff5d73","#ffd36b","#5dd3ff","#9dff7a"][i%4]}"/>' for i in range(12))
    tablas = "".join(f'<line x1="{i*22}" y1="62" x2="{i*22-20}" y2="90"/>' for i in range(8))
    return ('<rect width="160" height="90" fill="#2a1840"/><rect y="62" width="160" height="28" fill="#5a3a2a"/>'
            f'<g stroke="#3d2850" stroke-width=".4">{tablas}</g><path d="M0 8Q40 22 80 8T160 8" stroke="#ffd36b" fill="none" stroke-width=".6"/>{luces}')
def fondo_calle_noche():
    return ('<rect width="160" height="90" fill="#141c3a"/>' + _estrellas() + _edificios("#232c52") +
            '<rect y="62" width="160" height="10" fill="#4b4f60"/><rect y="72" width="160" height="18" fill="#2c2f3a"/>')
def fondo_taxi_interior_noche():
    return ('<rect width="160" height="90" fill="#1b1b26"/><rect x="82" y="20" width="70" height="38" rx="3" fill="#10163a"/>'
            '<g class="ciudad">' + _edificios("#1d2650") + '</g><rect y="62" width="160" height="28" fill="#2a2433"/><rect x="0" y="52" width="70" height="12" fill="#12121a"/>')
def fondo_casa_noche():
    return ('<rect width="160" height="90" fill="#10183a"/>' + _estrellas() +
            '<rect y="68" width="160" height="22" fill="#1f4d2e"/><rect y="78" width="160" height="12" fill="#3a3d46"/>')
def fondo_parque_dia():
    return ('<rect width="160" height="90" fill="#8fd3ff"/><circle cx="130" cy="16" r="9" fill="#ffd54a"/>'
            '<path d="M0 62Q40 44 80 60T160 54V90H0Z" fill="#8ccf6a"/><rect y="66" width="160" height="24" fill="#6fb752"/>'
            '<path d="M0 78Q80 70 160 80V84Q80 76 0 86Z" fill="#e8d3a0"/>')
def fondo_playa_dia():
    return ('<rect width="160" height="90" fill="#8fd3ff"/><circle cx="24" cy="16" r="9" fill="#ffd54a"/><rect y="46" width="160" height="22" fill="#3b88c3"/>'
            '<path d="M0 52Q20 48 40 52T80 52T120 52T160 52V56H0Z" fill="#55acee"/><rect y="66" width="160" height="24" fill="#f1dca0"/>'
            '<path d="M0 66Q40 62 80 66T160 66V70H0Z" fill="#fff" opacity=".7"/>')
def fondo_ciudad_dia():
    return ('<rect width="160" height="90" fill="#a9ddff"/>' + _edificios("#8da4c7").replace('#ffd36b', '#d6ecff') +
            '<rect y="62" width="160" height="10" fill="#c9ccd4"/><rect y="72" width="160" height="18" fill="#6b707c"/>')
def fondo_sala_dia():
    return ('<rect width="160" height="90" fill="#f0d9b5"/><rect y="62" width="160" height="28" fill="#b9825a"/>'
            '<rect y="58" width="160" height="4" fill="#8a5a33"/>' + "".join(f'<line x1="{i*20}" y1="62" x2="{i*20-14}" y2="90" stroke="#9c6b44" stroke-width=".5"/>' for i in range(9)))
def fondo_cocina_dia():
    return ('<rect width="160" height="90" fill="#e9f3f7"/>' + "".join(f'<rect x="{x}" y="{y}" width="19" height="19" fill="#fff" stroke="#cfdde4" stroke-width=".5"/>' for x in range(0, 160, 20) for y in (0, 20)) +
            '<rect y="62" width="160" height="28" fill="#c7a77b"/><rect y="58" width="160" height="4" fill="#9a7b52"/>')
def fondo_tienda_dia():
    return ('<rect width="160" height="90" fill="#fff3d6"/><rect y="62" width="160" height="28" fill="#d9d2c3"/>' +
            "".join(f'<rect x="{10+i*50}" y="22" width="40" height="34" fill="#c18b5a"/><rect x="{13+i*50}" y="26" width="34" height="3" fill="#8a5a33"/><rect x="{13+i*50}" y="40" width="34" height="3" fill="#8a5a33"/>' for i in range(3)))
FONDOS = {k[6:]: v for k, v in dict(globals()).items() if k.startswith("fondo_")}


def dib_house():
    return 80, 72, (E(40, 70, 38, 3, "#00000033") + R(8, 28, 64, 40, CREMA, 2) + R(8, 62, 64, 6, "#E8CF9A") +
        Pa("M2 30L40 4L78 30Z", ROJO_OSC) + Pa("M2 30L40 4L78 30L72 30L40 10L8 30Z", ROJO) + R(56, 4, 8, 16, MARRON_CLA, 1) + R(54, 2, 12, 4, MARRON, 1) +
        R(14, 36, 16, 16, BLANCO, 2) + R(16, 38, 12, 12, "#FFE9A8", 1) + R(21.4, 38, 1.2, 12, BLANCO) + R(16, 43.4, 12, 1.2, BLANCO) +
        R(50, 36, 16, 16, BLANCO, 2) + R(52, 38, 12, 12, "#FFE9A8", 1) + R(57.4, 38, 1.2, 12, BLANCO) + R(52, 43.4, 12, 1.2, BLANCO) +
        R(32, 42, 16, 26, MARRON_OSC, 2) + R(34, 44, 12, 22, MARRON, 1.5) + Cc(43, 56, 1.2, AMARILLO) + R(30, 66, 20, 4, GRIS_OSC, 1) + R(0, 69, 80, 3, VERDE))
# puntos de anclaje (en unidades del dibujo): centro-x, base-y, ancho, alto
PUNTOS = {"house": {"puerta": (40, 68, 16, 26)}}

DIB = {k[4:]: v for k, v in dict(globals()).items() if k.startswith("dib_")}


def twemoji_svg(carpeta, hexa):
    f = carpeta / f"{hexa}.svg"
    if not f.exists():
        sys.exit(f"Falta en Twemoji: {f}")
    t = f.read_text(encoding="utf-8").strip()
    t = re.sub(r"^<\?xml[^>]*>", "", t).strip()
    return t


def envolver(w, h, cuerpo):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{cuerpo}</svg>'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--twemoji", default=str(AQUI / "tw_svg"), help="carpeta con los .svg de Twemoji")
    a = ap.parse_args()
    tw = pathlib.Path(a.twemoji)
    palabras = {l.strip().lower() for l in (DATA / "palabras.txt").read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")}

    ids = [c[0] for c in C]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup: sys.exit(f"ids repetidos: {dup}")
    if len(C) != 200: print(f"AVISO: el catalogo tiene {len(C)} objetos (meta: 200)")
    malas = [c[0] for c in C if any(p not in palabras for p in c[0].split("_"))]
    if malas: sys.exit(f"palabras fuera de tu lista: {malas}")

    cajas_f = SVG / "cajas.json"
    CAJAS = json.loads(cajas_f.read_text(encoding="utf-8")) if cajas_f.exists() else {}
    for d in ("objetos", "caras", "accesorios", "fondos"): (SVG / d).mkdir(parents=True, exist_ok=True)
    lib = {"objetos": {}, "caras": {}, "accesorios": {}, "fondos": {}}
    catalogo = []
    for i, es, cat, src in C:
        if src == "D":
            if i not in DIB: sys.exit(f"falta el dibujo de {i}")
            w, h, body = DIB[i]()
            svg = envolver(w, h, body); vb = [w, h]
        else:
            svg = twemoji_svg(tw, src); vb = [36, 36]
        punt = None
        cj = CAJAS.get(i)
        ox, oy = 0, 0
        if cj:   # viewBox = caja real del dibujo: asi la base toca el piso y el ancho es el real
            ox, oy = cj[0], cj[1]
            svg = re.sub(r'viewBox="[^"]+"', 'viewBox="%g %g %g %g"' % tuple(cj), svg, count=1)
            vb = [round(cj[2], 3), round(cj[3], 3)]
        if i in PUNTOS:
            punt = {k: {"x": round((v[0] - ox) / vb[0], 4), "y": round((v[1] - oy) / vb[1], 4), "w": round(v[2] / vb[0], 4), "h": round(v[3] / vb[1], 4)} for k, v in PUNTOS[i].items()}
        (SVG / "objetos" / f"{i}.svg").write_text(svg, encoding="utf-8")
        lib["objetos"][i] = {"vb": vb, "svg": svg}
        if punt: lib["objetos"][i]["puntos"] = punt
        catalogo.append({"id": i, "es": es, "en": i.replace("_", " ").capitalize() if i != "tv" else "TV", "cat": cat, "fuente": "twemoji" if src != "D" else "dibujo"})
    for k, hx in CARAS.items():
        svg = twemoji_svg(tw, hx)
        (SVG / "caras" / f"{k}.svg").write_text(svg, encoding="utf-8")
        lib["caras"][k] = svg
        lib["caras"][hx] = svg   # tambien por codepoint, para usar el emoji de cara_base del elenco
    for k, (hx, ancla, x, y, t) in ACCESORIOS.items():
        if hx is None: continue   # bolso y mochila se dibujan en arte.js (con el cuerpo)
        svg = twemoji_svg(tw, hx)
        (SVG / "accesorios" / f"{k}.svg").write_text(svg, encoding="utf-8")
        lib["accesorios"][k] = {"svg": svg, "ancla": ancla, "x": x, "y": y, "t": t}

    for k, fn in FONDOS.items():
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90" preserveAspectRatio="none">' + fn() + "</svg>"
        (SVG / "fondos" / f"{k}.svg").write_text(svg, encoding="utf-8")
        lib["fondos"][k] = svg
    (SVG / "biblioteca.js").write_text("window.SVGLIB = " + json.dumps(lib, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    (SVG / "catalogo_svg.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=1), encoding="utf-8")

    # nombres en audio (narrador) para que el generador cree los mp3 de TODOS los objetos
    objs = [{"id": c["id"], "texto": c["en"]} for c in catalogo]
    (DATA / "objetos_audio.json").write_text(json.dumps({
        "_comentario": "Nombre en audio de cada objeto SVG tocable (voz del narrador). Generado por construir_svg.py. "
                       "'water' es el charco: 'puddle' no esta en tu lista.", "objetos": objs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # hoja de catalogo para ver todo junto
    celdas = "".join(f'<figure><div class="im" style="aspect-ratio:{c_vb[0]}/{c_vb[1]}">{lib["objetos"][c["id"]]["svg"]}</div><figcaption><b>{c["en"]}</b><br>{c["es"]}</figcaption></figure>'
                     for c, c_vb in ((c, lib["objetos"][c["id"]]["vb"]) for c in catalogo))
    caras = "".join(f'<figure><div class="im c">{lib["caras"][k]}</div><figcaption>{k}</figcaption></figure>' for k in CARAS)
    (SVG / "catalogo.html").write_text(f"""<!doctype html><meta charset=utf-8><title>Catalogo SVG</title>
<style>body{{font:13px system-ui;background:#1b1e3a;color:#eee;margin:16px}}h2{{margin:20px 0 8px}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}}
figure{{margin:0;background:#2b2f5c;border-radius:10px;padding:8px;text-align:center}}
.im{{height:70px;display:flex;justify-content:center}}.im svg{{height:100%;width:auto;max-width:100%}}.im.c{{height:56px}}</style>
<h2>{len(catalogo)} objetos</h2><div class=g>{celdas}</div><h2>{len(CARAS)} caras (sin manos)</h2><div class=g>{caras}</div><h2>{len(FONDOS)} fondos</h2><div class=g style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">{"".join(f"<figure><div class=im style=height:auto>{lib[chr(102)+chr(111)+chr(110)+chr(100)+chr(111)+chr(115)][k]}</div><figcaption>{k}</figcaption></figure>" for k in FONDOS)}</div>""", encoding="utf-8")
    print(f"Listo: {len(catalogo)} objetos, {len(CARAS)} caras, {len(ACCESORIOS)} accesorios, {len(FONDOS)} fondos -> {SVG}")


if __name__ == "__main__":
    main()
