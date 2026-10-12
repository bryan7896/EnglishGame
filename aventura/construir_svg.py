#!/usr/bin/env python3
"""
Construye la biblioteca de SVG del juego (246 objetos + 30 caras + accesorios + 28 fondos).

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
# El nombre hablado es el id (guion bajo -> espacio) o el 4o campo si el id no esta en tu lista.
# "-" = objeto solo decorativo (no dice nada al tocarlo). Toda palabra hablada debe estar en palabras.txt.
# ------------------------------------------------------------------------------------------------------
C = []
def add(cat, filas):
    for f in filas.strip().splitlines():
        partes = [x.strip() for x in f.split("|")]
        i, es, src = partes[:3]
        nom = partes[3] if len(partes) > 3 else i.replace("_", " ")   # nombre hablado ("-" = solo decoracion)
        C.append((i, es, cat, src, nom))

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
bridge|puente|D
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
    # entrega 3: gafas de sol (Twemoji) y cuatro dibujados en arte.js con el cuerpo
    "lentes_sol": ("1f576", "cara", 30, 22, 46),
    "corbata": (None, "cuerpo", 0, 0, 0), "bata": (None, "cuerpo", 0, 0, 0),
    "gorro_chef": (None, "cabeza", 0, 0, 0), "baston": (None, "cuerpo", 0, 0, 0),
}

add("historias (entrega 3)", """
bus_stop|parada de bus|D
bench|banca|D|park seat
coffee_machine|cafetera|D
cash_register|caja registradora|D
menu|menú|D
baggage_belt|banda de equipaje|D|bag belt
flight_board|pantalla de vuelos|D
passport|pasaporte|D
display_case|vitrina|D|glass box
doorbell|timbre|D|door bell
fence|cerca|D|garden wall
market_stall|puesto de mercado|D|market table
stage|tarima|D
poster|afiche|D
sleeping_bag|saco de dormir|D
statue|estatua|D|stone figure
surfboard|tabla de surf|D|surf board
whiteboard|tablero|D
photo_album|álbum de fotos|D
atm|cajero automático|D|money machine
medicine|medicina|D
backpack|mochila|1f392
calendar|calendario|1f4c5
candle|vela|1f56f|small light
reception_bell|timbre de recepción|1f6ce|desk bell
security_camera|cámara de seguridad|1f4f9
shopping_cart|carrito de compras|1f6d2|shopping basket
traffic_light|semáforo|1f6a6
moving_truck|camión de mudanza|1f69a|moving car
microphone|micrófono|1f3a4|-
package|paquete|1f4e6|small box
pan|sartén|1f373
pot|olla|1f372|cooking pan
laptop|portátil|1f4bb
printer|impresora|1f5a8
folder|carpeta|1f4c1
mailbox|buzón|1f4eb|mail box
globe|globo terráqueo|1f30d|world map
thermometer|termómetro|1f321|-
tent|carpa|26fa
flashlight|linterna|1f526|hand light
wrench|llave inglesa|1f527|-
toolbox|caja de herramientas|1f9f0|repair box
vase|jarrón|1f3fa|-
tire|llanta|1f6de
trash_can|caneca de basura|1f5d1
""")

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
# ---- Fondos de las 40 historias (entrega 2). Misma regla: pared 0-62, piso 62-90 (los pies van sobre el piso).
def _rep(n, fn):
    return "".join(fn(i) for i in range(n))
def _piso_tablas(c1, c2, paso=20):
    return f'<rect y="62" width="160" height="28" fill="{c1}"/>' + _rep(10, lambda i: f'<line x1="{i*paso}" y1="62" x2="{i*paso-14}" y2="90" stroke="{c2}" stroke-width=".5"/>')
def _piso_baldosas(c1, c2):
    s = f'<rect y="62" width="160" height="28" fill="{c1}"/>'
    s += _rep(4, lambda j: f'<line x1="0" y1="{62+j*7}" x2="160" y2="{62+j*7}" stroke="{c2}" stroke-width=".4"/>')
    s += _rep(17, lambda i: f'<line x1="{i*10}" y1="62" x2="{i*10-(i*10-80)*0.35}" y2="90" stroke="{c2}" stroke-width=".4"/>')
    return s
def _zocalo(c, y=58):
    return f'<rect y="{y}" width="160" height="{62-y}" fill="{c}"/>'
def _lampara_techo(x, c="#ffd36b"):
    return f'<line x1="{x}" y1="0" x2="{x}" y2="8" stroke="#3a3a3a" stroke-width=".5"/><path d="M{x-4} 12L{x-2} 8H{x+2}L{x+4} 12Z" fill="#3a3a3a"/><ellipse cx="{x}" cy="12.3" rx="3" ry=".9" fill="{c}"/>'
def _ventana(x, y, w, h, cielo="#a9ddff", marco="#fff"):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{marco}"/><rect x="{x+1.2}" y="{y+1.2}" width="{w-2.4}" height="{h-2.4}" fill="{cielo}"/>'
            f'<rect x="{x+w/2-.5}" y="{y}" width="1" height="{h}" fill="{marco}"/>')
def _cuadro(x, y, w, h, c1, c2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#8a5a33"/><rect x="{x+1}" y="{y+1}" width="{w-2}" height="{h-2}" fill="{c1}"/><path d="M{x+1} {y+h-1}L{x+w*.4} {y+h*.45}L{x+w*.65} {y+h*.7}L{x+w-1} {y+h*.35}V{y+h-1}Z" fill="{c2}"/>'
def _libros(x, y, w, filas=4, alto=9):
    cols = ["#DD2E44", "#3B88C3", "#77B255", "#FFCC4D", "#9266CC", "#F4900C", "#55ACEE", "#C1694F"]
    s = f'<rect x="{x}" y="{y}" width="{w}" height="{filas*alto+2}" fill="#8a5a33"/>'
    for f in range(filas):
        yy = y + 1 + f * alto
        s += f'<rect x="{x+1}" y="{yy}" width="{w-2}" height="{alto-1.5}" fill="#5c3a21"/>'
        bx, k = x + 1.5, f * 3
        while bx < x + w - 3:
            bw = 1.6 + (k * 7 % 5) * 0.35
            bh = alto - 2.5 - (k * 3 % 3) * 0.6
            s += f'<rect x="{bx:.2f}" y="{yy+alto-1.5-bh:.2f}" width="{bw:.2f}" height="{bh:.2f}" fill="{cols[k % len(cols)]}"/>'
            bx += bw + 0.3; k += 1
        s += f'<rect x="{x}" y="{yy+alto-1.5}" width="{w}" height="1.5" fill="#8a5a33"/>'
    return s
def _arboles_silueta(c, base, n=9, alto=26, sem=1):
    s = ""
    for i in range(n):
        x = i * (160 / (n - 1)) + ((i * 13 * sem) % 9) - 4
        h = alto - (i * 7 * sem) % 9
        s += f'<path d="M{x} {base-h}L{x+7} {base}H{x-7}Z" fill="{c}"/><path d="M{x} {base-h-6}L{x+5} {base-h+6}H{x-5}Z" fill="{c}"/>'
    return s

def fondo_cafe_dia():
    pizarra = ('<rect x="62" y="8" width="36" height="22" rx="1" fill="#8a5a33"/><rect x="63.5" y="9.5" width="33" height="19" fill="#2f3b33"/>'
               + _rep(5, lambda i: f'<rect x="67" y="{12.5+i*3.2}" width="{14+(i*5)%9}" height=".8" fill="#e8efe9" opacity=".8"/><rect x="88" y="{12.5+i*3.2}" width="4" height=".8" fill="#ffd36b" opacity=".85"/>'))
    barra = '<rect x="0" y="44" width="58" height="14" fill="#8a5a33"/><rect x="0" y="42.5" width="60" height="2.5" fill="#5c3a21"/>'
    tazas = _rep(4, lambda i: f'<rect x="{6+i*7}" y="34" width="4" height="4" rx="1" fill="#fff"/>') + '<rect x="2" y="38.5" width="40" height="1.2" fill="#5c3a21"/>'
    return ('<rect width="160" height="90" fill="#f3e3c8"/><rect y="0" width="160" height="5" fill="#e2c9a2"/>' + _ventana(110, 12, 40, 30, "#a9ddff") +
            '<rect x="110" y="34" width="40" height="8" fill="#8da4c7" opacity=".7"/>' + pizarra + tazas + barra + _zocalo("#c99a6b") +
            _lampara_techo(24) + _lampara_techo(52) + _lampara_techo(130) + _piso_baldosas("#d8c3a5", "#bfa584"))

def fondo_restaurante_noche():
    aplique = lambda x: f'<path d="M{x-2} 26H{x+2}L{x+3} 22H{x-3}Z" fill="#ffd36b"/><circle cx="{x}" cy="24" r="6" fill="#ffd36b" opacity=".15"/>'
    return ('<rect width="160" height="90" fill="#5a1e24"/><rect y="38" width="160" height="20" fill="#3d1418"/><rect y="37" width="160" height="1.5" fill="#c79a4b"/>'
            + _cuadro(18, 10, 20, 15, "#f4c87a", "#77B255") + _cuadro(122, 10, 20, 15, "#9fc6e8", "#3B88C3")
            + _ventana(62, 8, 36, 26, "#10163a", "#3d1418") + '<circle cx="90" cy="15" r="3" fill="#fff6c8"/>' + _rep(8, lambda i: f'<circle cx="{65+(i*11)%30}" cy="{11+(i*7)%20}" r=".35" fill="#fff" opacity=".8"/>')
            + aplique(50) + aplique(110) + _zocalo("#2a0d10") + _piso_tablas("#4a2a1c", "#3a2015"))

def fondo_aeropuerto():
    avion = '<path d="M50 40H80L86 37H90L88 40H98Q101 40 101 41.5Q101 43 98 43H54Q50 43 50 41.5Z" fill="#fff"/><path d="M70 41L64 48H68L78 41Z" fill="#dfe6ee"/>'
    cartel = lambda x, c: f'<line x1="{x}" y1="0" x2="{x}" y2="6" stroke="#555" stroke-width=".4"/><line x1="{x+20}" y1="0" x2="{x+20}" y2="6" stroke="#555" stroke-width=".4"/><rect x="{x-2}" y="6" width="24" height="6" rx="1" fill="{c}"/><rect x="{x+1}" y="8.3" width="12" height="1.4" fill="#fff"/><path d="M{x+16} 9L{x+19} 9M{x+17.5} 7.8L{x+19} 9L{x+17.5} 10.2" stroke="#fff" stroke-width=".7" fill="none"/>'
    return ('<rect width="160" height="90" fill="#cfd8e3"/><rect x="0" y="14" width="160" height="44" fill="#a9ddff"/>'
            '<rect x="0" y="46" width="160" height="12" fill="#9aa3ad"/>' + avion
            + _rep(9, lambda i: f'<rect x="{i*20-1}" y="14" width="2" height="44" fill="#6b7a8c"/>') + '<rect y="13" width="160" height="2" fill="#6b7a8c"/><rect y="35" width="160" height="1" fill="#6b7a8c"/>'
            + cartel(14, "#1F4E8C") + cartel(120, "#F4900C") + _zocalo("#6b7a8c") + _piso_baldosas("#e9edf2", "#cfd6de")
            + '<path d="M0 70H160" stroke="#fff" stroke-width="1.5" opacity=".6"/>')

def fondo_oficina():
    return ('<rect width="160" height="90" fill="#dfe7ee"/>' + _ventana(14, 8, 60, 34, "#a9ddff", "#9aa8b6")
            + '<g transform="translate(15,9) scale(.37)">' + _edificios("#8da4c7", 90).replace('#ffd36b', '#d6ecff') + '</g>'
            + _ventana(96, 8, 50, 34, "#a9ddff", "#9aa8b6") + '<g transform="translate(97,9) scale(.31)">' + _edificios("#9db2d1", 108).replace('#ffd36b', '#d6ecff') + '</g>'
            + '<rect x="0" y="0" width="160" height="4" fill="#c9d3dd"/>' + _rep(4, lambda i: f'<rect x="{12+i*40}" y="4" width="16" height="1.6" rx=".8" fill="#fff"/>')
            + '<rect x="0" y="46" width="160" height="12" fill="#b9c7d6"/><rect x="0" y="45" width="160" height="1.5" fill="#8a9aab"/>'
            + _rep(5, lambda i: f'<rect x="{i*36}" y="45" width="1.5" height="13" fill="#8a9aab"/>')
            + _zocalo("#8a9aab") + '<rect y="62" width="160" height="28" fill="#9aa4ae"/>'
            + _rep(14, lambda i: f'<line x1="{i*12}" y1="62" x2="{i*12-(i*12-80)*.4}" y2="90" stroke="#8b949e" stroke-width=".4"/>'))

def fondo_biblioteca():
    return ('<rect width="160" height="90" fill="#e8d5b5"/>' + _libros(4, 6, 44, 5) + _libros(112, 6, 44, 5)
            + _ventana(60, 8, 40, 30, "#a9ddff", "#8a5a33") + '<path d="M60 8Q80 -2 100 8" fill="#8a5a33"/>'
            + '<rect x="56" y="44" width="48" height="1.5" fill="#8a5a33"/>' + _lampara_techo(80, "#fff3c4")
            + _zocalo("#8a5a33") + _piso_tablas("#b07a4d", "#94623b", 16))

def fondo_hotel_lobby():
    columna = lambda x: f'<rect x="{x}" y="4" width="8" height="54" fill="#efe3c8"/><rect x="{x-1.5}" y="2" width="11" height="3" fill="#d9c8a3"/><rect x="{x-1.5}" y="55" width="11" height="3" fill="#d9c8a3"/>' + _rep(3, lambda i: f'<rect x="{x+1.5+i*2}" y="6" width=".6" height="48" fill="#d9c8a3"/>')
    arana = '<line x1="80" y1="0" x2="80" y2="6" stroke="#c79a4b" stroke-width=".6"/><path d="M68 10Q80 18 92 10Z" fill="#ffd36b"/>' + _rep(7, lambda i: f'<circle cx="{69+i*3.7}" cy="{11+(i%2)*1.5}" r="1" fill="#fff6c8"/>') + '<circle cx="80" cy="12" r="14" fill="#ffd36b" opacity=".12"/>'
    recepcion = '<rect x="56" y="38" width="48" height="20" fill="#7a4a2a"/><rect x="54" y="36" width="52" height="3" fill="#5c3a21"/><rect x="62" y="42" width="36" height="12" fill="#8a5a33"/>'
    return ('<rect width="160" height="90" fill="#f6ead2"/>' + columna(14) + columna(138) + _cuadro(30, 14, 18, 14, "#f4c87a", "#C1694F") + _cuadro(112, 14, 18, 14, "#9fc6e8", "#5C913B")
            + recepcion + arana + _zocalo("#d9c8a3") + _piso_baldosas("#efe6d8", "#d8ccb7")
            + '<path d="M40 74H120L130 90H30Z" fill="#a8323a"/><path d="M44 76H116L124 88H36Z" fill="none" stroke="#e0b25a" stroke-width=".6"/>')

def fondo_banco():
    ventanilla = lambda x: (f'<rect x="{x}" y="22" width="26" height="22" fill="#cfe8f5" opacity=".75"/><rect x="{x}" y="22" width="26" height="22" fill="none" stroke="#7d8b99" stroke-width=".8"/>'
                            f'<rect x="{x+9}" y="16" width="8" height="4" rx="1" fill="#1F4E8C"/><rect x="{x+11}" y="17.4" width="4" height="1.2" fill="#fff"/>')
    return ('<rect width="160" height="90" fill="#e4ebf1"/><rect y="0" width="160" height="10" fill="#1F4E8C"/><rect y="10" width="160" height="1.5" fill="#c79a4b"/>'
            + '<path d="M66 3L80 0L94 3V8H66Z" fill="#c79a4b"/>' + _rep(4, lambda i: f'<rect x="{70+i*6}" y="4" width="2" height="4" fill="#1F4E8C"/>')
            + '<rect x="0" y="44" width="160" height="14" fill="#8a9aab"/><rect x="0" y="42.5" width="160" height="2" fill="#5f6e7d"/>'
            + ventanilla(14) + ventanilla(50) + ventanilla(86) + ventanilla(122)
            + _zocalo("#5f6e7d") + _piso_baldosas("#dcd6cc", "#c3bcb0"))

def fondo_museo():
    foco = lambda x: f'<path d="M{x-1.5} 0H{x+1.5}L{x+1} 3H{x-1}Z" fill="#333"/><path d="M{x-1} 3L{x-12} 50H{x+12}L{x+1} 3Z" fill="#fff6c8" opacity=".25"/>'
    cuadro = lambda x, w, h, c1, c2: f'<rect x="{x-.8}" y="{12-.8}" width="{w+1.6}" height="{h+1.6}" fill="#c79a4b"/>' + _cuadro(x, 12, w, h, c1, c2).replace('fill="#8a5a33"', 'fill="#fff"', 1)
    return ('<rect width="160" height="90" fill="#f4f1ea"/><rect y="0" width="160" height="3" fill="#ddd6c8"/>'
            + cuadro(14, 26, 20, "#9fc6e8", "#3B88C3") + cuadro(66, 28, 22, "#f4c87a", "#DD2E44") + cuadro(120, 24, 18, "#c9e3b4", "#5C913B")
            + foco(27) + foco(80) + foco(132)
            + _rep(2, lambda i: f'<rect x="{i*90+30}" y="48" width="1.2" height="10" fill="#c79a4b"/><rect x="{i*90+58}" y="48" width="1.2" height="10" fill="#c79a4b"/><path d="M{i*90+31} 50Q{i*90+44.5} 55 {i*90+58} 50" stroke="#a8323a" stroke-width="1" fill="none"/>')
            + _zocalo("#ddd6c8") + _piso_tablas("#d9b98c", "#c3a274", 18))

def fondo_farmacia():
    cruz = '<rect x="72" y="6" width="16" height="16" rx="2" fill="#fff"/><rect x="77.5" y="8" width="5" height="12" fill="#3aa757"/><rect x="74" y="11.5" width="12" height="5" fill="#3aa757"/>'
    estante = lambda x: f'<rect x="{x}" y="10" width="44" height="34" fill="#f5f8fa" stroke="#c7d3db" stroke-width=".6"/>' + _rep(3, lambda j: f'<rect x="{x}" y="{20+j*10}" width="44" height="1.2" fill="#c7d3db"/>' + _rep(7, lambda k: f'<rect x="{x+2+k*6}" y="{13+j*10+(k%2)}" width="4" height="{6-(k%2)}" rx=".6" fill="{["#55ACEE","#FFCC4D","#DD2E44","#77B255","#F4900C","#9266CC","#fff"][(k+j)%7]}"/>'))
    return ('<rect width="160" height="90" fill="#e6f4ee"/>' + estante(6) + estante(110) + cruz
            + '<rect x="50" y="44" width="60" height="14" fill="#f5f8fa"/><rect x="48" y="42.5" width="64" height="2" fill="#3aa757"/>'
            + _zocalo("#b9d9c8") + _piso_baldosas("#f2f5f3", "#d6dfd9"))

def fondo_mercado_dia():
    toldo = lambda x, c: (f'<rect x="{x+2}" y="26" width="1.2" height="32" fill="#8a5a33"/><rect x="{x+34}" y="26" width="1.2" height="32" fill="#8a5a33"/>'
                          + _rep(6, lambda i: f'<path d="M{x+i*6.2} 20H{x+i*6.2+6.2}V28Q{x+i*6.2+3.1} 31 {x+i*6.2} 28Z" fill="{c if i%2==0 else "#fff"}"/>')
                          + f'<rect x="{x+1}" y="44" width="35" height="14" fill="#c18b5a"/><rect x="{x}" y="42.5" width="37" height="2" fill="#8a5a33"/>')
    banderines = '<path d="M0 6Q40 14 80 6T160 6" stroke="#555" stroke-width=".3" fill="none"/>' + _rep(16, lambda i: f'<path d="M{i*10+2} {7.5+3*(1-abs(((i*10+3.5)%80)-40)/40)}l3 0l-1.5 3.5z" fill="{["#DD2E44","#FFCC4D","#3B88C3","#77B255"][i%4]}"/>')
    return ('<rect width="160" height="90" fill="#9fdcff"/>' + banderines
            + '<rect y="50" width="160" height="12" fill="#d9cfc0"/>'
            + toldo(2, "#DD2E44") + toldo(44, "#3B88C3") + toldo(86, "#77B255") + toldo(124, "#F4900C")
            + '<rect y="58" width="160" height="4" fill="#b7aa96"/>' + _piso_baldosas("#cdbfa8", "#b3a58d"))

def fondo_bosque_noche():
    return ('<rect width="160" height="90" fill="#0e1633"/>' + _estrellas(40)
            + _arboles_silueta("#16264a", 52, 11, 30, 1) + _arboles_silueta("#0f1d3a", 60, 9, 34, 2)
            + '<rect y="60" width="160" height="30" fill="#1c3324"/><path d="M0 62Q40 58 80 62T160 61V64H0Z" fill="#244030"/>'
            + _rep(12, lambda i: f'<path d="M{i*14+3} {72+(i*5)%12}l1 -3l1 3z" fill="#2e5238"/>'))

def fondo_bus_interior():
    ventana = lambda x: f'<rect x="{x}" y="12" width="34" height="24" rx="2.5" fill="#a9ddff"/>'
    asiento = lambda x: f'<rect x="{x}" y="40" width="14" height="14" rx="2" fill="#3B88C3"/><rect x="{x+1}" y="38" width="12" height="4" rx="1.5" fill="#55ACEE"/>'
    return ('<rect width="160" height="90" fill="#e8e3d6"/>' + '<g class="ciudad">' + '<g transform="translate(0,4) scale(1,.5)">' + _edificios("#8da4c7").replace('#ffd36b', '#d6ecff') + _edificios("#8da4c7").replace('#ffd36b', '#d6ecff').replace('x="', 'x="1') + '</g></g>'
            + '<path d="M0 0H160V12H0ZM0 36H160V58H0Z" fill="#e8e3d6"/>' + _rep(5, lambda i: f'<rect x="{i*34+2-6}" y="12" width="6" height="24" fill="#e8e3d6"/>')
            + _rep(5, lambda i: f'<rect x="{i*34+2}" y="12" width="34" height="24" rx="2.5" fill="none" stroke="#b9b2a2" stroke-width="1"/>')
            + '<rect y="4" width="160" height="1.2" fill="#c0c4cc"/>' + _rep(8, lambda i: f'<line x1="{10+i*20}" y1="5" x2="{10+i*20}" y2="9" stroke="#c0c4cc" stroke-width=".5"/><circle cx="{10+i*20}" cy="10" r="1.3" fill="none" stroke="#FFCC4D" stroke-width=".6"/>')
            + asiento(6) + asiento(40) + asiento(74) + asiento(108) + asiento(142)
            + _zocalo("#9aa3ad") + '<rect y="62" width="160" height="28" fill="#8a919b"/><rect y="72" width="160" height="1.2" fill="#FFCC4D"/>')

def fondo_taller():
    herramientas = ('<rect x="10" y="10" width="46" height="30" fill="#c9a77b"/>' + _rep(36, lambda i: f'<circle cx="{13+(i%9)*5}" cy="{13+(i//9)*7}" r=".4" fill="#8a6a45"/>')
                    + '<path d="M16 16h2v14h-2zM14 15h6v3h-6z" fill="#7d8b99"/><path d="M26 15l2 0 0 12 2 3-6 0 2-3z" fill="#DD2E44"/><circle cx="40" cy="20" r="4" fill="none" stroke="#7d8b99" stroke-width="1.6"/><path d="M40 24v8" stroke="#7d8b99" stroke-width="1.6"/><path d="M48 15h3v16h-3z" fill="#F4900C"/>')
    puerta = '<rect x="78" y="6" width="70" height="52" fill="#9aa3ad"/>' + _rep(12, lambda i: f'<rect x="78" y="{8+i*4.2}" width="70" height="1" fill="#7d8690"/>') + '<path d="M78 52H148V58H78Z" fill="#FFCC4D"/>' + _rep(8, lambda i: f'<path d="M{80+i*9} 52l4 6h-3l-4-6z" fill="#292F33"/>')
    llantas = _rep(3, lambda i: f'<ellipse cx="66" cy="{56-i*4}" rx="7" ry="2.2" fill="#292F33"/><ellipse cx="66" cy="{56-i*4}" rx="3" ry=".9" fill="#555"/>')
    return ('<rect width="160" height="90" fill="#cfcac0"/>' + herramientas + puerta + llantas + _zocalo("#8a8478")
            + '<rect y="62" width="160" height="28" fill="#a9a59d"/><ellipse cx="40" cy="78" rx="14" ry="3" fill="#7d7a73" opacity=".6"/><ellipse cx="118" cy="84" rx="10" ry="2" fill="#7d7a73" opacity=".5"/>')

def fondo_pasillo_edificio():
    puerta = lambda x, c: (f'<rect x="{x}" y="18" width="20" height="40" fill="#8a5a33"/><rect x="{x+1.5}" y="19.5" width="17" height="38.5" fill="{c}"/>'
                           f'<circle cx="{x+15.5}" cy="40" r="1" fill="#FFCC4D"/><rect x="{x+7}" y="22" width="6" height="3" rx=".5" fill="#FFCC4D"/>')
    return ('<rect width="160" height="90" fill="#e9dfcf"/><rect y="0" width="160" height="4" fill="#d6c9b3"/>'
            + puerta(10, "#a8323a") + puerta(56, "#3B88C3") + puerta(126, "#5C913B")
            + _lampara_techo(40) + _lampara_techo(100) + _cuadro(90, 26, 14, 10, "#9fc6e8", "#77B255")
            + _zocalo("#a08a6c") + _piso_baldosas("#cfc4b2", "#b8ab96") + '<rect x="0" y="68" width="160" height="12" fill="#7a4a2a" opacity=".55"/>')

def fondo_estacion_tren():
    arcos = _rep(4, lambda i: f'<path d="M{i*40} 18Q{i*40+20} 0 {i*40+40} 18" fill="none" stroke="#6b7a8c" stroke-width="1.6"/>')
    return ('<rect width="160" height="90" fill="#cdd9e4"/><rect y="0" width="160" height="18" fill="#a9ddff" opacity=".8"/>' + arcos
            + '<rect y="17" width="160" height="2" fill="#6b7a8c"/>' + _rep(9, lambda i: f'<rect x="{i*20-1}" y="18" width="2" height="30" fill="#6b7a8c"/>')
            + '<rect x="100" y="24" width="40" height="10" rx="1" fill="#292F33"/><rect x="103" y="27" width="20" height="1.6" fill="#FFCC4D"/><rect x="103" y="30" width="14" height="1.4" fill="#fff"/>'
            + '<rect y="48" width="160" height="10" fill="#6b5a4a"/>' + _rep(17, lambda i: f'<rect x="{i*10}" y="50" width="6" height="8" fill="#5a4a3a"/>')
            + '<rect y="51" width="160" height="1.2" fill="#c0c4cc"/><rect y="55" width="160" height="1.2" fill="#c0c4cc"/>'
            + '<rect y="58" width="160" height="4" fill="#c9ccd4"/><rect y="61" width="160" height="2" fill="#FFCC4D"/>' + _piso_baldosas("#d6d9de", "#bfc3ca"))

def fondo_calle_lluvia():
    lluvia = _rep(70, lambda i: f'<line x1="{(i*23)%160}" y1="{(i*37)%88}" x2="{(i*23)%160-2}" y2="{(i*37)%88+6}" stroke="#d6ecff" stroke-width=".35" opacity=".7"/>')
    nubes = _rep(6, lambda i: f'<ellipse cx="{i*30+10}" cy="{6+(i%2)*3}" rx="22" ry="9" fill="#5f6b7a"/>')
    return ('<rect width="160" height="90" fill="#7d8a99"/>' + nubes + _edificios("#5a6678").replace('#ffd36b', '#ffe9a8')
            + '<rect y="62" width="160" height="10" fill="#8d939e"/><rect y="72" width="160" height="18" fill="#4a505b"/>'
            + '<ellipse cx="40" cy="80" rx="16" ry="2.2" fill="#7f97b3" opacity=".6"/><ellipse cx="118" cy="85" rx="20" ry="2.5" fill="#7f97b3" opacity=".6"/>'
            + lluvia)

def fondo_concierto_noche():
    haz = lambda x, c, a: f'<path d="M{x} 6L{x+a-14} 62H{x+a+14}Z" fill="{c}" opacity=".18"/>'
    publico = _rep(26, lambda i: f'<circle cx="{i*6.3+2}" cy="{84+(i*7)%4}" r="3.2" fill="#0b0b14"/><rect x="{i*6.3-1.5}" y="{86+(i*7)%4}" width="7" height="6" rx="2" fill="#0b0b14"/>')
    return ('<rect width="160" height="90" fill="#120c22"/><rect y="0" width="160" height="6" fill="#2b2b38"/>'
            + _rep(10, lambda i: f'<rect x="{6+i*16}" y="5" width="4" height="3" fill="#333"/><circle cx="{8+i*16}" cy="8.5" r="1.2" fill="{["#ff5d73","#5dd3ff","#ffd36b","#9dff7a"][i%4]}"/>')
            + haz(20, "#ff5d73", 10) + haz(60, "#5dd3ff", -8) + haz(100, "#ffd36b", 6) + haz(140, "#9dff7a", -12)
            + '<rect y="58" width="160" height="4" fill="#2b2b38"/><rect y="62" width="160" height="28" fill="#1c1c28"/>' + publico)

def fondo_casa_dia():
    nube = lambda x, y: f'<ellipse cx="{x}" cy="{y}" rx="10" ry="4" fill="#fff"/><ellipse cx="{x+6}" cy="{y-2}" rx="7" ry="4" fill="#fff"/>'
    arbusto = lambda x: f'<ellipse cx="{x}" cy="64" rx="9" ry="6" fill="#5C913B"/><ellipse cx="{x+6}" cy="62" rx="6" ry="5" fill="#77B255"/>'
    return ('<rect width="160" height="90" fill="#9fdcff"/><circle cx="26" cy="14" r="8" fill="#ffd54a"/>' + nube(60, 12) + nube(118, 18)
            + '<path d="M0 60Q40 50 80 58T160 54V68H0Z" fill="#8ccf6a"/>' + arbusto(8) + arbusto(140)
            + '<rect y="66" width="160" height="12" fill="#77B255"/><rect y="78" width="160" height="12" fill="#c9ccd4"/><rect y="78" width="160" height="1" fill="#a9adb5"/>'
            + _rep(16, lambda i: f'<rect x="{i*10}" y="79" width=".5" height="11" fill="#a9adb5"/>'))

FONDOS = {k[6:]: v for k, v in dict(globals()).items() if k.startswith("fondo_")}


def dib_house():
    return 80, 72, (E(40, 70, 38, 3, "#00000033") + R(8, 28, 64, 40, CREMA, 2) + R(8, 62, 64, 6, "#E8CF9A") +
        Pa("M2 30L40 4L78 30Z", ROJO_OSC) + Pa("M2 30L40 4L78 30L72 30L40 10L8 30Z", ROJO) + R(56, 4, 8, 16, MARRON_CLA, 1) + R(54, 2, 12, 4, MARRON, 1) +
        R(14, 36, 16, 16, BLANCO, 2) + R(16, 38, 12, 12, "#FFE9A8", 1) + R(21.4, 38, 1.2, 12, BLANCO) + R(16, 43.4, 12, 1.2, BLANCO) +
        R(50, 36, 16, 16, BLANCO, 2) + R(52, 38, 12, 12, "#FFE9A8", 1) + R(57.4, 38, 1.2, 12, BLANCO) + R(52, 43.4, 12, 1.2, BLANCO) +
        R(32, 42, 16, 26, MARRON_OSC, 2) + R(34, 44, 12, 22, MARRON, 1.5) + Cc(43, 56, 1.2, AMARILLO) + R(30, 66, 20, 4, GRIS_OSC, 1) + R(0, 69, 80, 3, VERDE))
# puntos de anclaje (en unidades del dibujo): centro-x, base-y, ancho, alto

# ---- Objetos de las 40 historias (entrega 3). Mismo estilo plano de Twemoji, base abajo.
def dib_bus_stop():
    return 60, 56, (R(4, 6, 3, 50, GRIS_MED) + R(53, 6, 3, 50, GRIS_MED) + R(0, 2, 60, 6, AZUL_OSC, 2) + R(8, 12, 44, 30, CELESTE)
                    + R(8, 12, 44, 30, BLANCO, 0).replace('fill="#F5F8FA"', 'fill="#F5F8FA" opacity=".35"') + R(10, 40, 40, 4, MARRON, 1) + R(12, 44, 3, 8, GRIS_MED) + R(45, 44, 3, 8, GRIS_MED)
                    + R(22, 3.5, 16, 3, BLANCO, 1.5))
def dib_bench():
    return 56, 26, (R(2, 0, 52, 4, MARRON, 2) + R(2, 6, 52, 4, MARRON, 2) + R(0, 12, 56, 4, MARRON_CLA, 2) + R(4, 4, 2, 20, GRIS_NEG) + R(50, 4, 2, 20, GRIS_NEG)
                    + R(4, 16, 3, 10, GRIS_NEG, 1) + R(49, 16, 3, 10, GRIS_NEG, 1))
def dib_coffee_machine():
    return 34, 40, (R(2, 0, 30, 40, GRIS_NEG, 4) + R(5, 3, 24, 8, GRIS_MED, 2) + Cc(11, 7, 2, ROJO) + Cc(18, 7, 2, VERDE) + Cc(25, 7, 2, AMARILLO)
                    + R(12, 13, 10, 5, GRIS_OSC, 1) + R(5, 30, 24, 4, GRIS_MED, 1) + R(13, 22, 8, 8, BLANCO, 2) + R(21, 24, 2, 4, BLANCO, 1) + R(14, 19, 1.2, 3, MARRON_CLA) + R(18, 19, 1.2, 3, MARRON_CLA))
def dib_cash_register():
    return 40, 34, (R(4, 0, 22, 12, GRIS_NEG, 2) + R(6, 2, 18, 8, "#5DD3A0", 1) + R(9, 4, 10, 2, GRIS_NEG) + Pa("M2 12H38L40 26H0Z", GRIS_OSC)
                    + "".join(Cc(9 + c * 7, 16 + r * 4.5, 1.6, BLANCO) for c in range(4) for r in range(2)) + R(0, 26, 40, 8, GRIS_MED, 1) + R(14, 28, 12, 1.4, GRIS_NEG))
def dib_menu():
    return 26, 36, (R(1, 0, 24, 36, MARRON_OSC, 2) + R(3, 2, 20, 32, CREMA, 1) + R(7, 5, 12, 2.4, ROJO, 1)
                    + "".join(R(6, 11 + i * 4.5, 10, 1.2, GRIS_MED) + R(18, 11 + i * 4.5, 3, 1.2, VERDE_OSC) for i in range(5)))
def dib_baggage_belt():
    return 90, 24, (R(0, 8, 90, 10, GRIS_NEG, 5) + R(2, 9, 86, 6, GRIS_MED, 3) + "".join(R(6 + i * 10, 10, 1, 4, GRIS_OSC) for i in range(8))
                    + R(6, 18, 4, 6, GRIS_OSC) + R(80, 18, 4, 6, GRIS_OSC) + R(14, 0, 16, 10, ROJO, 2) + R(19, 0, 6, 2, ROJO_OSC, 1) + R(52, 2, 14, 8, AZUL_OSC, 2) + R(56, 1, 6, 2, GRIS_NEG, 1))
def dib_flight_board():
    filas = "".join(R(6, 8 + i * 6, 16, 2.4, AMARILLO, 0.5) + R(26, 8 + i * 6, 10, 2.4, BLANCO, 0.5) + R(40, 8 + i * 6, 8, 2.4, VERDE if i % 3 else ROJO, 0.5) for i in range(5))
    return 54, 52, R(0, 0, 54, 40, GRIS_NEG, 3) + R(3, 3, 48, 34, "#1b2240", 2) + filas + R(25, 40, 4, 12, GRIS_MED)
def dib_passport():
    return 26, 34, (R(1, 0, 24, 34, "#1F4E8C", 3) + R(3, 2, 2, 30, "#163a6a") + Cc(14, 14, 6, "none").replace('fill="none"', 'fill="none" stroke="#FFCC4D" stroke-width="1.4"')
                    + R(13.3, 8, 1.4, 12, AMARILLO) + R(8, 13.3, 12, 1.4, AMARILLO) + R(8, 25, 12, 1.6, AMARILLO, 0.8) + R(10, 28.5, 8, 1.2, AMARILLO, 0.6))
def dib_display_case():
    return 40, 52, (R(4, 34, 32, 18, MARRON, 2) + R(2, 32, 36, 3, MARRON_OSC, 1) + R(6, 4, 28, 28, CELESTE).replace('/>', ' opacity=".45"/>')
                    + R(6, 4, 28, 28, "none").replace('fill="none"', 'fill="none" stroke="#99AAB5" stroke-width="1.2"') + R(4, 2, 32, 3, GRIS_OSC, 1)
                    + R(13, 4, 2, 28, BLANCO).replace('/>', ' opacity=".6"/>') + Cc(24, 26, 4, AMARILLO) + R(18, 29, 12, 3, GRIS, 1))
def dib_doorbell():
    return 18, 26, R(1, 0, 16, 26, GRIS_OSC, 4) + R(3, 2, 12, 22, GRIS, 3) + Cc(9, 15, 4, AMARILLO) + Cc(9, 15, 2.4, NARANJA) + R(5, 5, 8, 3, BLANCO, 1)
def dib_fence():
    tabla = lambda x: Pa(f"M{x} 8L{x+3} 3L{x+6} 8V30H{x}Z", BLANCO)
    return 70, 30, "".join(tabla(1 + i * 9.5) for i in range(7)) + R(0, 11, 70, 3, GRIS, 1) + R(0, 22, 70, 3, GRIS, 1)
def dib_market_stall():
    toldo = "".join(Pa(f"M{i*8} 0H{i*8+8}V9Q{i*8+4} 13 {i*8} 9Z", ROJO if i % 2 == 0 else BLANCO) for i in range(8))
    frutas = Cc(14, 34, 4, NARANJA) + Cc(22, 34, 4, ROJO) + Cc(30, 34, 4, AMARILLO) + Cc(40, 34, 4, VERDE) + Cc(48, 34, 4, ROJO) + Cc(18, 30, 4, AMARILLO) + Cc(44, 30, 4, NARANJA)
    return 64, 60, toldo + R(4, 10, 3, 50, MARRON) + R(57, 10, 3, 50, MARRON) + R(2, 36, 60, 24, MARRON_CLA, 2) + R(2, 36, 60, 4, MARRON, 1) + frutas
def dib_stage():
    return 120, 34, (R(0, 10, 120, 24, GRIS_NEG, 2) + R(0, 8, 120, 4, MARRON_OSC, 1) + R(0, 12, 120, 2, MARRON)
                     + "".join(Cc(10 + i * 20, 22, 2.5, ["#ff5d73", "#5dd3ff", "#ffd36b", "#9dff7a"][i % 4]) for i in range(6))
                     + R(10, 0, 14, 8, GRIS_NEG, 2) + Cc(17, 4, 3, GRIS_MED) + R(96, 0, 14, 8, GRIS_NEG, 2) + Cc(103, 4, 3, GRIS_MED))
def dib_poster():
    return 30, 42, (R(0, 0, 30, 42, MORADO_OSC, 1) + R(2, 2, 26, 38, MORADO, 1) + Cc(15, 15, 7, AMARILLO) + Cc(15, 15, 4, NARANJA)
                    + R(5, 26, 20, 3, BLANCO, 1) + R(8, 31, 14, 2, AMARILLO, 1) + R(9, 35, 12, 1.6, BLANCO, 0.8) + Cc(3, 3, 1, GRIS_MED) + Cc(27, 3, 1, GRIS_MED))
def dib_sleeping_bag():
    return 60, 18, R(0, 4, 60, 14, VERDE_OSC, 7) + R(2, 5, 56, 10, VERDE, 5) + R(4, 2, 16, 12, BLANCO, 5) + R(26, 6, 1.4, 10, VERDE_OSC) + R(40, 6, 1.4, 10, VERDE_OSC)
def dib_statue():
    return 30, 60, (R(4, 44, 22, 16, GRIS_OSC, 1) + R(2, 42, 26, 4, GRIS, 1) + Pa("M7 42Q7 26 15 24Q23 26 23 42Z", GRIS)
                    + Cc(15, 16, 7, GRIS) + Pa("M8 14Q10 6 16 7Q22 7 23 13Q18 10 14 11Q10 12 8 14Z", GRIS_OSC) + R(13, 22, 4, 4, GRIS) + R(6, 50, 18, 2, GRIS_MED, 1))
def dib_surfboard():
    return 20, 64, Pa("M10 0Q20 18 18 46Q16 64 10 64Q4 64 2 46Q0 18 10 0Z", AMARILLO) + Pa("M9 4H11V60H9Z", ROJO) + Pa("M10 0Q14 8 15 16H5Q6 8 10 0Z", NARANJA)
def dib_whiteboard():
    return 60, 50, (R(0, 0, 60, 36, GRIS_MED, 2) + R(2, 2, 56, 32, BLANCO, 1) + R(6, 7, 26, 2, AZUL_OSC, 1) + R(6, 13, 34, 1.6, GRIS_OSC, 0.8) + R(6, 18, 20, 1.6, GRIS_OSC, 0.8)
                    + Pa("M38 20L44 26L54 10", "none").replace('fill="none"', 'fill="none" stroke="#DD2E44" stroke-width="2" stroke-linecap="round"')
                    + R(10, 34, 40, 2, GRIS_OSC, 1) + R(10, 36, 2.5, 14, GRIS_MED) + R(47.5, 36, 2.5, 14, GRIS_MED) + R(18, 33, 6, 1.6, ROJO, 0.8))
def dib_photo_album():
    return 40, 30, (R(0, 2, 40, 28, MARRON_OSC, 3) + R(2, 0, 36, 28, MARRON, 3) + R(19, 0, 2, 28, MARRON_OSC)
                    + R(5, 4, 11, 9, BLANCO, 1) + R(6, 5, 9, 7, CELESTE) + Pa("M6 12L9 8L12 11L15 9V12Z", VERDE)
                    + R(24, 4, 11, 9, BLANCO, 1) + R(25, 5, 9, 7, CREMA) + Cc(29.5, 8.5, 2, "#FFDC5D")
                    + R(5, 16, 11, 9, BLANCO, 1) + R(6, 17, 9, 7, AZUL) + R(24, 16, 11, 9, BLANCO, 1) + R(25, 17, 9, 7, ROJO))
def dib_atm():
    return 34, 56, (R(0, 0, 34, 56, GRIS_OSC, 3) + R(2, 2, 30, 6, AZUL_OSC, 2) + R(8, 3.5, 18, 3, BLANCO, 1.5) + R(5, 11, 24, 15, "#1b2240", 2) + R(8, 14, 12, 1.8, "#5DD3A0") + R(8, 18, 16, 1.8, "#5DD3A0")
                    + "".join(R(7 + c * 6, 29 + r * 4.5, 4, 3, GRIS, 0.8) for c in range(3) for r in range(3)) + R(25, 29, 5, 12, GRIS_MED, 1)
                    + R(8, 44, 18, 2, GRIS_NEG, 1) + R(6, 49, 22, 3, GRIS_NEG, 1) + R(9, 47, 14, 3, VERDE, 0.6))
def dib_medicine():
    return 22, 34, (R(4, 0, 14, 7, BLANCO, 2) + R(4, 5, 14, 2, GRIS) + Pa("M3 7H19Q21 7 21 10V31Q21 34 18 34H4Q1 34 1 31V10Q1 7 3 7Z", NARANJA)
                    + R(3, 14, 16, 12, BLANCO, 1) + R(9.5, 16, 3, 8, "#3aa757") + R(7, 18.5, 8, 3, "#3aa757") + R(16, 9, 2, 22, "#FFB347", 1))

def dib_bridge():   # puente de dia (el emoji de Twemoji es de noche)
    tablas = "".join(R(4 + i * 6, 14, 4.6, 3, MARRON_CLA, 0.8) for i in range(12))
    return 80, 34, (Pa("M0 34Q40 -2 80 34H72Q40 8 8 34Z", GRIS_OSC) + Pa("M2 34Q40 4 78 34H74Q40 12 6 34Z", GRIS)
                    + R(0, 12, 80, 5, MARRON, 1.5) + tablas + R(2, 4, 3, 10, MARRON_OSC) + R(75, 4, 3, 10, MARRON_OSC)
                    + R(2, 4, 76, 2.4, MARRON_OSC, 1.2) + "".join(R(8 + i * 8, 6, 1.6, 7, MARRON_OSC) for i in range(9)))


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
    malas = [c[0] for c in C if c[4] != "-" and any(p not in palabras for p in c[4].split())]
    if malas: sys.exit(f"palabras fuera de tu lista: {malas}")

    cajas_f = SVG / "cajas.json"
    CAJAS = json.loads(cajas_f.read_text(encoding="utf-8")) if cajas_f.exists() else {}
    for d in ("objetos", "caras", "accesorios", "fondos"): (SVG / d).mkdir(parents=True, exist_ok=True)
    lib = {"objetos": {}, "caras": {}, "accesorios": {}, "fondos": {}}
    catalogo = []
    for i, es, cat, src, nom in C:
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
        catalogo.append({"id": i, "es": es, "en": i.replace("_", " ").capitalize() if i != "tv" else "TV", "cat": cat, "fuente": "twemoji" if src != "D" else "dibujo",
                         "habla": None if nom == "-" else (nom[0].upper() + nom[1:] if i != "tv" else "TV")})
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
    objs = [{"id": c["id"], "texto": c["habla"]} for c in catalogo if c["habla"]]   # los decorativos no hablan
    (DATA / "objetos_audio.json").write_text(json.dumps({
        "_comentario": "Nombre en audio de cada objeto SVG tocable (voz del narrador). Generado por construir_svg.py. "
                       "'water' es el charco: 'puddle' no esta en tu lista.", "objetos": objs}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # hoja de catalogo para ver todo junto
    celdas = "".join(f'<figure><div class="im" style="aspect-ratio:{c_vb[0]}/{c_vb[1]}">{lib["objetos"][c["id"]]["svg"]}</div><figcaption><b>{c["en"]}</b><br>{c["es"]}{"" if c["habla"] == c["en"] else "<br><i>dice: " + (c["habla"] or "(decorativo)") + "</i>"}</figcaption></figure>'
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
