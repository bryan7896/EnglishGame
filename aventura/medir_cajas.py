#!/usr/bin/env python3
"""Mide la caja real (bounding box) de cada SVG de objetos y la guarda en svg/cajas.json.
construir_svg.py la usa para recortar el viewBox: asi la base de cada objeto toca el piso y su ancho es el real
(los emoji traen margen vacio y se veian flotando). Solo hace falta correrlo si agregas objetos:
  python construir_svg.py ...   ->   python medir_cajas.py   ->   python construir_svg.py ...
Requiere:  pip install playwright && playwright install chromium"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
AQUI = pathlib.Path(__file__).resolve().parent
SVG = AQUI / "svg" / "objetos"
out = {}
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    for f in sorted(SVG.glob("*.svg")):
        pg.set_content(f"<body>{f.read_text(encoding='utf-8')}</body>")
        bb = pg.evaluate("()=>{const s=document.querySelector('svg');const b=s.getBBox();return [b.x,b.y,b.width,b.height]}")
        out[f.stem] = [round(v, 3) for v in bb]
    b.close()
(AQUI / "svg" / "cajas.json").write_text(json.dumps(out, indent=0), encoding="utf-8")
print(len(out), "cajas medidas")
