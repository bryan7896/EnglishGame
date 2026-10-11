# Guía de estilo del juego (para dibujar o pedir más piezas)

**Estilo:** plano (flat), sin contornos, formas redondeadas, una sombra más oscura abajo y un brillo claro arriba. Mismo look que Twemoji.
**Paleta fija:** rojo #DD2E44/#BE1931 · naranja #F4900C · amarillo #FFCC4D · crema #FFE8B6 · verde #77B255/#5C913B/#A6D388 ·
azul #55ACEE/#3B88C3/#9AD0F5 · marrón #C1694F/#662113/#D99E82 · grises #CCD6DD/#99AAB5/#66757F/#292F33 · blanco #F5F8FA · morado #9266CC/#553788.
**Objetos:** viewBox propio (la mayoría 36x36; anchos como mesa 72x44), apoyados en el borde inferior. El juego los escala por ancho (`s` del layout).
**Caras:** 30 emociones SIN manos (viewBox 36x36). Un personaje = cara + cuerpo de líneas (grosor 5, color de ropa) + accesorio opcional.
**Personaje (lienzo 60x120):** cara en (6,4) de 48x48 · torso (30,52)->(30,84) · brazos desde (30,58) · piernas desde (30,84) a y=114.
**Fondos:** 160x90, `preserveAspectRatio="none"`; piso desde y≈62.
**Nombres:** id en inglés con una palabra de tu lista (guion bajo para dos palabras: `street_lamp`). Ese id es el nombre que se dice en audio.
