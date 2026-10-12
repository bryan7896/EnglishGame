/* ARTE: conecta el motor con la biblioteca de SVG (svg/biblioteca.js, generada por construir_svg.py).
 * Contrato con el motor:  ARTE.objeto(id, variante, capa) -> HTML | ARTE.personaje(cfg) -> SVG | ARTE.fondo(id) -> SVG | ARTE.setCara(el, emoji)
 * Los ids que usan las misiones (en espanol) se traducen a los ids de la biblioteca (en ingles). */
window.ARTE = (() => {
  const LIB = window.SVGLIB || { objetos: {}, caras: {}, accesorios: {}, fondos: {} };
  const ALIAS = {
    altavoz: 'speaker', globo: 'balloon', mesa: 'table', pastel: 'cake', lampara: 'lamp', ventana: 'window', ventana_taxi: 'window',
    cuadro: 'picture', planta: 'plant', arbol: 'tree', nube: 'cloud', luna: 'moon', estrella: 'star', farola: 'street_lamp',
    charco: 'water', casa: 'house', carretera: 'road', senal: 'sign', reloj: 'clock', asiento: 'seat', puerta: 'door',
    flores: 'flowers', jardin: 'garden'
  };
  const interior = svg => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

  function objeto(id, variante, capa) {
    const o = LIB.objetos[ALIAS[id] || id];
    if (!o) return '<span class="emo">❓</span>';
    let svg = o.svg.replace('<svg ', '<svg class="svgobj" ');
    if (id === 'taxi' && variante === 'rojo') svg = svg.replace(/#FFCC4D/gi, '#DD2E44').replace(/#F4900C/gi, '#BE1931');   // variante de color: se recolorea el SVG
    return svg;
  }

  function caraInterior(emoji) {
    const hex = emoji ? emoji.codePointAt(0).toString(16) : '1f642';
    const s = LIB.caras[hex] || LIB.caras['1f642'];
    return s ? interior(s) : '';
  }
  function setCara(el, emoji) {
    const c = el && el.querySelector('.cara');
    if (c) c.innerHTML = caraInterior(emoji);
  }

  const oscurecer = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(v * (1 - f)));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  };
  const PIEL = '#FFDC5D';
  const ANCHO = { gorra: 1.3, gorra_taxi: 1.3 };

  // Personaje (lienzo 60x120): cara SVG sin manos (52x52) + cuerpo con volumen: torso redondeado, brazos con manos,
  // piernas con zapatos. Accesorios: de cabeza/cara (Twemoji) o dibujados (bolso cruzado, mochila).
  function personaje(cfg) {
    const c = cfg.ropa || '#888';
    const pantalon = oscurecer(c, 0.55);
    const acc = cfg.accesorio;
    const A = acc && LIB.accesorios[acc];
    let atras = '', delante = '', arriba = '';
    if (A) {
      const t = A.t;
      const tw = t * (ANCHO[acc] || 1);   // las gorras son 30% mas anchas
      arriba = `<svg x="${A.x - tw / 2}" y="${A.y - t / 2}" width="${tw}" height="${t}" viewBox="0 0 36 36" preserveAspectRatio="none">${interior(A.svg)}</svg>`;
    }
    if (acc === 'gorro_chef') {
      arriba = '<path d="M17 14Q11 2 20 -2Q24 -10 31 -6Q39 -11 42 -2Q50 2 43 14Z" fill="#F5F8FA"/><rect x="17" y="10" width="26" height="7" rx="2" fill="#E1E8ED"/>';
    }
    if (acc === 'audifonos') {
      arriba = '<path d="M7 28Q7 3 30 3Q53 3 53 28" stroke="#292F33" stroke-width="4.5" fill="none" stroke-linecap="round"/>' +
        '<rect x="1.5" y="21" width="10" height="17" rx="4.5" fill="#DD2E44"/><rect x="48.5" y="21" width="10" height="17" rx="4.5" fill="#DD2E44"/>';
    }
    if (acc === 'mochila') {
      atras = '<rect x="6" y="52" width="16" height="30" rx="6" fill="#DD2E44"/><rect x="8" y="58" width="12" height="8" rx="3" fill="#BE1931"/>';
      delante = '<path d="M22 53L24 80" stroke="#BE1931" stroke-width="3" stroke-linecap="round" fill="none"/>';
    } else if (acc === 'bolso') {
      delante = '<path d="M22 52L40 84" stroke="#662113" stroke-width="2.6" stroke-linecap="round" fill="none"/>' +
        '<rect x="37" y="80" width="17" height="13" rx="3.5" fill="#C1694F"/><rect x="37" y="80" width="17" height="5" rx="2.5" fill="#A0523C"/><circle cx="45.5" cy="86" r="1.3" fill="#FFCC4D"/>';
    } else if (acc === 'delantal') {
      delante = '<rect x="21" y="62" width="18" height="26" rx="4" fill="#F5F8FA"/><path d="M25 62L25 52M35 62L35 52" stroke="#F5F8FA" stroke-width="2.4"/>';
    } else if (acc === 'corbata') {
      delante = '<path d="M24 51L30 56L36 51L35 58L30 56L25 58Z" fill="#F5F8FA"/>' +
        '<path d="M28.3 55.5H31.7L32.4 58L30.8 74L30 76L29.2 74L27.6 58Z" fill="#DD2E44"/><rect x="28.3" y="55" width="3.4" height="3" rx="1" fill="#BE1931"/>';
    } else if (acc === 'bata') {
      // bata blanca larga sobre la ropa (con solapas y bolsillo)
      delante = '<path d="M16 58Q16 50 24 50H36Q44 50 44 58V96H32V62H28V96H16Z" fill="#F5F8FA"/>' +
        '<path d="M24 50L30 62L36 50" fill="none" stroke="#CCD6DD" stroke-width="1.6"/><rect x="34" y="70" width="7" height="6" rx="1.5" fill="#E1E8ED"/><rect x="36" y="68" width="1.4" height="4" fill="#3B88C3"/>';
    } else if (acc === 'baston') {
      delante = '<path d="M52 117V84Q52 78 47 78Q43 78 43 82" stroke="#8A5A33" stroke-width="3" fill="none" stroke-linecap="round"/>';
    } else if (acc === 'chaqueta') {
      delante = `<rect x="29" y="52" width="2" height="34" fill="${oscurecer(c, 0.35)}"/><path d="M22 52L30 60L38 52" stroke="${oscurecer(c, 0.35)}" stroke-width="2.4" fill="none" stroke-linejoin="round"/>`;
    }
    return `<svg viewBox="0 0 60 120" class="svgpj" overflow="visible">
      ${atras}
      <g class="pierna p1"><line x1="25" y1="84" x2="23" y2="110" stroke="${pantalon}" stroke-width="9" stroke-linecap="round"/><ellipse cx="22" cy="115" rx="7.5" ry="3.8" fill="#292F33"/></g>
      <g class="pierna p2"><line x1="35" y1="84" x2="37" y2="110" stroke="${pantalon}" stroke-width="9" stroke-linecap="round"/><ellipse cx="38" cy="115" rx="7.5" ry="3.8" fill="#292F33"/></g>
      <g class="brazo b1"><line x1="19" y1="57" x2="10" y2="80" stroke="${c}" stroke-width="8" stroke-linecap="round"/><circle cx="9.5" cy="82" r="4.3" fill="${PIEL}"/></g>
      <g class="brazo b2"><line x1="41" y1="57" x2="50" y2="80" stroke="${c}" stroke-width="8" stroke-linecap="round"/><circle cx="50.5" cy="82" r="4.3" fill="${PIEL}"/></g>
      <rect class="torso" x="16" y="50" width="28" height="38" rx="11" fill="${c}"/>
      <rect x="16" y="78" width="28" height="10" rx="5" fill="${pantalon}"/>
      ${delante}
      <svg class="cara" x="4" y="2" width="52" height="52" viewBox="0 0 36 36">${caraInterior(cfg.cara)}</svg>
      ${arriba}
    </svg>`;
  }

  function fondo(id) { return LIB.fondos[id] || LIB.fondos.fiesta_noche || ''; }
  const meta = id => LIB.objetos[ALIAS[id] || id];
  return { objeto, personaje, fondo, setCara, meta };
})();
