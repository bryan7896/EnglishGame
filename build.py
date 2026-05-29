import re
import os

with open('index.dev.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Buscar y reemplazar includes en <style>
style_match = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
if style_match:
    style_content = style_match.group(1)
    # Buscar /* @include archivo.css */
    include_match = re.search(r'/\*\s*@include\s+([^*]+\.css)\s*\*/', style_content)
    if include_match:
        with open(include_match.group(1).strip(), 'r', encoding='utf-8') as f:
            css_content = f.read()
        # Reemplazar el comentario por el CSS
        new_style = re.sub(r'/\*\s*@include\s+[^*]+\.css\s*\*/', css_content, style_content)
        html = html.replace(style_content, new_style)

# Buscar y reemplazar includes en <script>
def replace_js_includes(match):
    script_content = match.group(1)
    # Buscar // @include archivo.js
    includes = re.findall(r'//\s*@include\s+([^\n]+\.js)', script_content)
    for inc in includes:
        with open(inc.strip(), 'r', encoding='utf-8') as f:
            js_content = f.read()
        script_content = script_content.replace(f'// @include {inc}', js_content)
    return f'<script>{script_content}</script>'

html = re.sub(r'<script>(.*?)</script>', replace_js_includes, html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('✅ index.html generado')