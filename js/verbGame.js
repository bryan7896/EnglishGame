const MOTIVATIONAL_PHRASES = [
    "¡Eres increíble! ✨",
    "¡Wow! Tu dedicación es inspiradora 💪",
    "¡Lo estás haciendo genial! 🚀",
    "¡Eres una máquina de aprendizaje! 🎯",
    "¡Qué manera tan brillante de aprender! 🌟",
    "¡Sigue así! Vas a dominar el inglés 💎",
    "¡Tu esfuerzo vale la pena! 📚",
    "¡Eres imparable! ⚡",
    "¡Qué orgullo verte progresar! 🥹",
    "¡Eres el/la mejor estudiante! 🏆",
    "¡Cada día más cerca de la meta! 🏁",
    "¡Tu constancia es tu superpoder! 🦸‍♂️",
    "¡Estás construyendo un gran futuro! 🛠️",
    "¡Nivelazo! Estás arrasando hoy 🔥",
    "¡Un paso más cerca de hablar con fluidez! 🗣️",
    "¡Brillante! Estás subiendo de nivel 📈",
    "¡La práctica hace al maestro, vas volando! 🦅",
    "¡Qué enfoque tan espectacular! 🧠",
    "¡Nada te detiene! Sigue rompiéndola 🌪️",
    "¡Estás dominando el juego del inglés! 🎮",
    "¡Tu mente no tiene límites! 🌌",
    "¡La disciplina de hoy es el éxito de mañana! ⏳",
    "¡Estás transformando tu esfuerzo en talento! 🔮",
    "¡Visualiza tu meta, ya casi estás ahí! 🗺️",
    "¡Qué racha tan increíble llevas! ⚡"
];

// ════════════════════════════════════════════
// FASE 1: SOPA DE LETRAS — versión final
// ════════════════════════════════════════════

// Colores por palabra (idx 0,1,2)
const WS_COLORS = [
    { bg: 'rgba(29,158,117,0.35)', border: '#1D9E75', found: '#9FE1CB', foundText: '#04342C', hint: 'rgba(29,158,117,0.15)', hintBorder: 'rgba(29,158,117,0.4)' },
    { bg: 'rgba(55,138,221,0.35)', border: '#378ADD', found: '#B5D4F4', foundText: '#042C53', hint: 'rgba(55,138,221,0.15)', hintBorder: 'rgba(55,138,221,0.4)' },
    { bg: 'rgba(186,117,23,0.35)', border: '#BA7517', found: '#FAC775', foundText: '#412402', hint: 'rgba(186,117,23,0.15)', hintBorder: 'rgba(186,117,23,0.4)' },
];

// Estado extra en verbGameState (se agrega al startVerbGame existente)
// verbGameState.wordSearchPaths  = { 'WORD': ['r,c', ...] }
// verbGameState.wsHintWord       = null | 'WORD'
// verbGameState.wsFoundColors    = { 'WORD': colorIdx }

function renderWordSearch(verbData) {
    const words = [verbData.verb, verbData.past, verbData.participle];
    const SIZE = 5;
    const { g, paths } = createWordSearchGrid(words, SIZE);
    verbGameState.wordSearchPaths = paths;
    verbGameState.wsHintWord = null;
    verbGameState.wsFoundColors = {};

    let gridHtml = `<div class="ws-grid" id="ws-grid-container" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;background:var(--card2);padding:14px;border-radius:var(--r);margin:10px 0;">`;
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            gridHtml += `<div class="ws-cell" data-row="${r}" data-col="${c}"
                style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;
                background:var(--card);border-radius:10px;font-weight:800;font-size:20px;
                color:var(--text);cursor:pointer;transition:background 0.1s,border 0.1s;border:2px solid transparent;">
                ${g[r][c]}</div>`;
        }
    }
    gridHtml += '</div>';

    const chipsHtml = words.map((w, i) => {
        const col = WS_COLORS[i];
        return `<div class="ws-word" data-word="${w.toUpperCase()}" data-cidx="${i}"
            onclick="wsToggleHint(this)"
            style="display:inline-flex;align-items:center;gap:6px;margin:4px 5px;padding:6px 14px;
            background:${col.hint};border:2px solid ${col.hintBorder};border-radius:20px;
            font-weight:700;font-size:13px;cursor:pointer;">
            <span style="width:8px;height:8px;border-radius:50%;background:${col.border};display:inline-block;"></span>
            🔍 ${w}
        </div>`;
    }).join('');

    return `
        <div class="game-card" style="padding:16px;">
            <div style="text-align:center;margin-bottom:14px;">
                <div class="ex-tag">SOPA DE LETRAS</div>
                <div style="font-size:22px;font-weight:800;color:var(--pri);margin-top:8px;">${verbData.spanishWord}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px;">Arrastra para seleccionar · Toca un chip para ver la pista</div>
            </div>
            ${gridHtml}
            <div style="text-align:center;margin-top:10px;">${chipsHtml}</div>
        </div>
        <button class="btn btn-p" id="ws-continue-btn" onclick="checkWordSearchComplete()" disabled style="margin-top:12px;">➡️ Continuar</button>
    `;
}

function createWordSearchGrid(words, SIZE = 5) {
    const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(''));
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const DIRS = [
        [0, 1],   // →
        [1, 0],   // ↓
        [0, -1],  // ←
        [-1, 0],  // ↑
    ];

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function inside(r, c) {
        return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
    }

    function generateDynamicPath(word) {
        const attempts = 500;

        for (let attempt = 0; attempt < attempts; attempt++) {

            const startR = Math.floor(Math.random() * SIZE);
            const startC = Math.floor(Math.random() * SIZE);

            const visited = new Set();
            const path = [];

            let currentR = startR;
            let currentC = startC;

            let currentDir = null;
            let turns = 0;

            function walk(index) {

                const key = `${currentR},${currentC}`;

                if (!inside(currentR, currentC)) return false;
                if (visited.has(key)) return false;

                const cell = g[currentR][currentC];

                if (cell !== '' && cell !== word[index]) {
                    return false;
                }

                visited.add(key);

                path.push({
                    r: currentR,
                    c: currentC
                });

                if (index === word.length - 1) {
                    return true;
                }

                const dirs = shuffle(DIRS);

                for (const dir of dirs) {

                    const [dr, dc] = dir;

                    const prevR = currentR;
                    const prevC = currentC;
                    const prevDir = currentDir;
                    const prevTurns = turns;

                    if (
                        currentDir &&
                        (currentDir[0] !== dr || currentDir[1] !== dc)
                    ) {
                        turns++;
                    }

                    // Máximo 2 giros
                    if (turns > 2) {
                        turns = prevTurns;
                        continue;
                    }

                    currentDir = dir;

                    currentR += dr;
                    currentC += dc;

                    const ok = walk(index + 1);

                    if (ok) return true;

                    currentR = prevR;
                    currentC = prevC;
                    currentDir = prevDir;
                    turns = prevTurns;
                }

                visited.delete(key);
                path.pop();

                return false;
            }

            if (walk(0)) {
                return path;
            }
        }

        return null;
    }

    const placed = {};

    const sorted = [...words].sort((a, b) => b.length - a.length);

    for (const word of sorted) {

        const W = word.toUpperCase();

        const path = generateDynamicPath(W);

        if (!path) {
            console.warn('No pudo colocar:', W);
            continue;
        }

        path.forEach(({ r, c }, i) => {
            g[r][c] = W[i];
        });

        placed[W] = path.map(({ r, c }) => `${r},${c}`);
    }

    // Rellenar vacíos
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (!g[r][c]) {
                g[r][c] = ALPHA[Math.floor(Math.random() * ALPHA.length)];
            }
        }
    }

    return {
        g,
        paths: placed
    };
}

function wsToggleHint(chipEl) {
    const word = chipEl.dataset.word;
    const cidx = parseInt(chipEl.dataset.cidx);
    if (verbGameState.wsFoundColors?.[word] !== undefined) return;

    const path = verbGameState.wordSearchPaths?.[word];
    if (!path) return;

    // Limpiar hints anteriores
    document.querySelectorAll('.ws-cell').forEach(el => {
        if (!el.dataset.found) {
            el.style.background = 'var(--card)';
            el.style.borderColor = 'transparent';
        }
    });

    if (verbGameState.wsHintWord === word) {
        verbGameState.wsHintWord = null;
        return;
    }
    verbGameState.wsHintWord = word;
    const col = WS_COLORS[cidx];
    path.forEach(key => {
        const [r, c] = key.split(',').map(Number);
        const el = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
        if (el && !el.dataset.found) {
            el.style.background = col.hint;
            el.style.borderColor = col.hintBorder;
        }
    });
}

function wsApplyFoundStyles() {
    const fc = verbGameState.wsFoundColors || {};
    const words = [
        verbGameState.currentVerbData.verb.toUpperCase(),
        verbGameState.currentVerbData.past.toUpperCase(),
        verbGameState.currentVerbData.participle.toUpperCase()
    ];
    
    for (const [key, cidx] of Object.entries(fc)) {
        // Extraer la palabra original de la clave (antes del _)
        const word = key.split('_')[0];
        const path = verbGameState.wordSearchPaths[word] || [];
        const col = WS_COLORS[cidx];
        path.forEach(cellKey => {
            const [r, c] = cellKey.split(',').map(Number);
            const el = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
            if (el) {
                el.dataset.found = '1';
                el.style.background = col.found;
                el.style.color = col.foundText;
                el.style.borderColor = col.border;
            }
        });
    }
}

function initWordSearchSelection() {
    const cont = document.getElementById('ws-grid-container');
    if (!cont) return;

    // Clonar para limpiar listeners
    const fresh = cont.cloneNode(true);
    cont.parentNode.replaceChild(fresh, cont);

    // Restaurar handlers de hint en chips
    document.querySelectorAll('.ws-word').forEach(el => {
        el.onclick = () => wsToggleHint(el);
    });

    let selCells = [];
    let isDragging = false;

    function getCell(e) {
        let el = e.target;
        if (e.touches?.length) el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        return el?.closest?.('.ws-cell');
    }

    function clearSelStyle() {
        selCells.forEach(k => {
            const [r, c] = k.split(',').map(Number);
            const el = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
            if (el && !el.dataset.found) {
                el.style.background = 'var(--card)';
                el.style.borderColor = 'transparent';
            }
        });
        selCells = [];
        wsApplyFoundStyles();
        // Reaplicar hint si hay uno activo
        if (verbGameState.wsHintWord) {
            const words = [
                verbGameState.currentVerbData.verb.toUpperCase(),
                verbGameState.currentVerbData.past.toUpperCase(),
                verbGameState.currentVerbData.participle.toUpperCase()
            ];
            const cidx = words.indexOf(verbGameState.wsHintWord);
            if (cidx >= 0) {
                const col = WS_COLORS[cidx];
                (verbGameState.wordSearchPaths[verbGameState.wsHintWord] || []).forEach(key => {
                    const [r, c] = key.split(',').map(Number);
                    const el = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
                    if (el && !el.dataset.found) {
                        el.style.background = col.hint;
                        el.style.borderColor = col.hintBorder;
                    }
                });
            }
        }
    }

    function checkWord() {
        const words = [
            verbGameState.currentVerbData.verb.toUpperCase(),
            verbGameState.currentVerbData.past.toUpperCase(),
            verbGameState.currentVerbData.participle.toUpperCase()
        ];
        const selected = selCells.map(k => {
            const [r, c] = k.split(',').map(Number);
            return document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`)?.textContent?.trim() || '';
        }).join('');

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const uniqueKey = `${w}_${i}`;
            if (selected === w && (verbGameState.wsFoundColors || {})[uniqueKey] === undefined) {
                if (!verbGameState.wsFoundColors) verbGameState.wsFoundColors = {};
                verbGameState.wsFoundColors[uniqueKey] = i;
                if (verbGameState.wsHintWord === w) verbGameState.wsHintWord = null;
                verbGameState.wordSearchFound.push({ word: w, cells: [...selCells] });
                wsApplyFoundStyles();
                updateWordSearchUI();
                playPing();
                toast(`✅ ¡Encontraste "${w}"!`);
                return true;
            }
        }
        return false;
    }

    fresh.addEventListener('mousedown', e => {
        e.preventDefault(); clearSelStyle(); isDragging = true;
        const cell = getCell(e); if (!cell) return;
        const key = `${cell.dataset.row},${cell.dataset.col}`;
        selCells = [key];
        cell.style.background = 'rgba(139,124,248,0.4)';
        cell.style.borderColor = 'var(--pri)';
    });
    fresh.addEventListener('mousemove', e => {
        if (!isDragging) return; e.preventDefault();
        const cell = getCell(e); if (!cell) return;
        const key = `${cell.dataset.row},${cell.dataset.col}`;
        if (!selCells.includes(key)) {
            selCells.push(key);
            cell.style.background = 'rgba(139,124,248,0.4)';
            cell.style.borderColor = 'var(--pri)';
        }
    });
    fresh.addEventListener('touchstart', e => {
        e.preventDefault(); clearSelStyle(); isDragging = true;
        const cell = getCell(e); if (!cell) return;
        const key = `${cell.dataset.row},${cell.dataset.col}`;
        selCells = [key];
        cell.style.background = 'rgba(139,124,248,0.4)';
        cell.style.borderColor = 'var(--pri)';
    }, { passive: false });
    fresh.addEventListener('touchmove', e => {
        if (!isDragging) return; e.preventDefault();
        const cell = getCell(e); if (!cell) return;
        const key = `${cell.dataset.row},${cell.dataset.col}`;
        if (!selCells.includes(key)) {
            selCells.push(key);
            cell.style.background = 'rgba(139,124,248,0.4)';
            cell.style.borderColor = 'var(--pri)';
        }
    }, { passive: false });

    function onEnd() {
        if (!isDragging) return; isDragging = false;
        const found = checkWord();
        if (!found) {
            selCells.forEach(k => {
                const [r, c] = k.split(',').map(Number);
                const el = document.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
                if (el && !el.dataset.found) el.style.background = 'rgba(255,118,117,0.3)';
            });
            setTimeout(() => { clearSelStyle(); selCells = []; }, 380);
        } else { selCells = []; }
    }
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

function updateWordSearchUI() {
    const words = [
        verbGameState.currentVerbData.verb.toUpperCase(),
        verbGameState.currentVerbData.past.toUpperCase(),
        verbGameState.currentVerbData.participle.toUpperCase()
    ];
    
    // Verificar si todas están encontradas (usando las claves únicas)
    const allFound = words.every((w, idx) => 
        (verbGameState.wsFoundColors || {})[`${w}_${idx}`] !== undefined
    );

    // Actualizar chips
    words.forEach((w, i) => {
        const chip = document.querySelector(`.ws-word[data-word="${w}"]`);
        if (!chip) return;
        if ((verbGameState.wsFoundColors || {})[`${w}_${i}`] !== undefined) {
            const col = WS_COLORS[i];
            chip.style.background = col.found;
            chip.style.borderColor = col.border;
            chip.style.color = col.foundText;
            chip.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${col.foundText};display:inline-block;"></span> ✓ ${w}`;
        }
    });

    const btn = document.getElementById('ws-continue-btn');
    if (btn) btn.disabled = !allFound;
}

function checkWordSearchComplete() {
    const words = [verbGameState.currentVerbData.verb.toUpperCase(),
    verbGameState.currentVerbData.past.toUpperCase(),
    verbGameState.currentVerbData.participle.toUpperCase()];
    const allFound = words.every(w => verbGameState.wordSearchFound.some(f => f.word === w));

    if (allFound) {
        verbGameState.completedExercises[0] = true;
        showMotivationalMessage();
        setTimeout(() => renderDragDrop(), 2000);
    }
}

// ════════════════════════════════════════════
// FASE 2: DRAG & DROP - Validación simple por texto
// ════════════════════════════════════════════

function renderDragDrop() {
    const verbData = verbGameState.currentVerbData;

    // Reset estado
    verbGameState.dragDropMatches = {};

    const words = [
        {
            id: 'verb',
            text: verbData.verb,
            category: 'verb'
        },
        {
            id: 'past',
            text: verbData.past,
            category: 'past'
        },
        {
            id: 'participle',
            text: verbData.participle,
            category: 'participle'
        }
    ];

    const shuffled = [...words];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const wordsHtml = shuffled.map(word => `
        <div 
            class="dd-word"
            draggable="true"
            data-id="${word.id}"
            data-word="${word.text}"
            data-category="${word.category}"
            style="
                background:linear-gradient(180deg,var(--card2),rgba(255,255,255,0.03));
                border:1px solid rgba(255,255,255,0.08);
                border-radius:18px;
                padding:14px 18px;
                min-width:110px;
                text-align:center;
                font-weight:800;
                font-size:17px;
                color:var(--text);
                box-shadow:
                    0 10px 20px rgba(0,0,0,0.18),
                    inset 0 1px 0 rgba(255,255,255,0.05);
                cursor:grab;
                user-select:none;
                transition:all .22s ease;
            "
        >
            ${word.text}
        </div>
    `).join('');

    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-verbgame">

            <style>
                .dd-word.dragging{
                    opacity:.5;
                    transform:scale(1.06);
                }

                .dd-zone{
                    background:linear-gradient(
                        180deg,
                        rgba(255,255,255,.04),
                        rgba(255,255,255,.02)
                    );
                    border:2px dashed rgba(255,255,255,.08);
                    border-radius:18px;
                    padding:14px;
                    min-height:90px;
                    transition:.2s ease;
                }

                .dd-zone.active{
                    border-color:var(--pri);
                    background:rgba(139,124,248,.08);
                }

                .dd-chip{
                    display:inline-flex;
                    align-items:center;
                    justify-content:center;
                    padding:10px 16px;
                    border-radius:14px;
                    background:linear-gradient(
                        180deg,
                        var(--pri),
                        rgba(139,124,248,.82)
                    );
                    color:white;
                    font-weight:700;
                    animation:ddPop .2s ease;
                }

                @keyframes ddPop{
                    from{
                        opacity:0;
                        transform:scale(.7);
                    }
                    to{
                        opacity:1;
                        transform:scale(1);
                    }
                }

                .dd-title{
                    font-size:13px;
                    color:var(--muted);
                    font-weight:700;
                    margin-bottom:10px;
                    letter-spacing:.4px;
                }

                .dd-slot{
                    min-height:40px;
                    display:flex;
                    align-items:center;
                    flex-wrap:wrap;
                    gap:8px;
                }
            </style>

            <div class="hdr">
                <button class="back" onclick="renderMap()">←</button>
                <span style="font-size:12px;font-weight:700;color:var(--muted);">
                    Verb Quest · 2/6
                </span>
                <button class="ico-btn" onclick="openOptions()">⚙️</button>
            </div>

            <div class="game-body sb">

                <div style="
                    background:linear-gradient(
                        180deg,
                        rgba(255,255,255,.05),
                        rgba(255,255,255,.02)
                    );
                    border-radius:28px;
                    padding:22px;
                ">

                    <div style="
                        display:flex;
                        flex-wrap:wrap;
                        justify-content:center;
                        gap:12px;
                        margin-bottom:24px;
                    ">
                        ${wordsHtml}
                    </div>

                    <div style="display:flex;flex-direction:column;gap:14px;">

                        <div class="dd-zone dd-category"
                             data-category="verb">

                            <div class="dd-title">BASE FORM</div>

                            <div id="cat-verb" class="dd-slot"></div>

                        </div>

                        <div class="dd-zone dd-category"
                             data-category="past">

                            <div class="dd-title">PAST SIMPLE</div>

                            <div id="cat-past" class="dd-slot"></div>

                        </div>

                        <div class="dd-zone dd-category"
                             data-category="participle">

                            <div class="dd-title">PAST PARTICIPLE</div>

                            <div id="cat-participle" class="dd-slot"></div>

                        </div>

                    </div>

                </div>

                <button
                    class="btn btn-p"
                    id="dd-continue-btn"
                    onclick="goToWritingPhase()"
                    disabled
                    style="
                        margin-top:18px;
                        height:58px;
                        border-radius:22px;
                        font-size:17px;
                        font-weight:800;
                    "
                >
                    Continuar
                </button>

            </div>
        </div>
    `;

    initDragDropEvents();
}

function initDragDropEvents() {

    document.querySelectorAll('.dd-word').forEach(word => {

        word.addEventListener('dragstart', e => {

            word.classList.add('dragging');

            e.dataTransfer.setData('application/json', JSON.stringify({
                id: word.dataset.id,
                word: word.dataset.word,
                category: word.dataset.category
            }));

        });

        word.addEventListener('dragend', () => {
            word.classList.remove('dragging');
        });

    });

    document.querySelectorAll('.dd-category').forEach(cat => {

        cat.addEventListener('dragover', e => {
            e.preventDefault();
            cat.classList.add('active');
        });

        cat.addEventListener('dragleave', () => {
            cat.classList.remove('active');
        });

        cat.addEventListener('drop', e => {

            e.preventDefault();

            cat.classList.remove('active');

            const data = JSON.parse(
                e.dataTransfer.getData('application/json')
            );

            const targetCategory = cat.dataset.category;

            // Ya usado
            if (verbGameState.dragDropMatches[data.id]) {
                toast('Esa palabra ya fue usada');
                return;
            }

            // Correcto
            if (data.category === targetCategory) {

                verbGameState.dragDropMatches[data.id] = true;

                const draggedWord = document.querySelector(
                    `.dd-word[data-id="${data.id}"]`
                );

                draggedWord?.remove();

                const slot = document.getElementById(
                    `cat-${targetCategory}`
                );

                const chip = document.createElement('div');

                chip.className = 'dd-chip';

                chip.textContent = data.word;

                slot.appendChild(chip);

                playPing();

                checkDragDropComplete();

            } else {

                cat.animate([
                    { transform:'translateX(0px)' },
                    { transform:'translateX(-6px)' },
                    { transform:'translateX(6px)' },
                    { transform:'translateX(0px)' }
                ], {
                    duration:220
                });

                toast('Categoría incorrecta');

            }

        });

    });

}

function checkDragDropComplete() {

    const completed =
        verbGameState.dragDropMatches.verb &&
        verbGameState.dragDropMatches.past &&
        verbGameState.dragDropMatches.participle;

    const btn = document.getElementById('dd-continue-btn');

    if (btn) {

        btn.disabled = !completed;

        if (completed) {

            btn.style.background =
                'linear-gradient(135deg,var(--mint),var(--mint-d))';

            btn.style.color = '#092018';

        }

    }

}

function goToWritingPhase() {

    verbGameState.completedExercises[1] = true;

    showMotivationalMessage();

    verbGameState.writtenAnswers = [];

    verbGameState.currentWritingIndex = 0;

    setTimeout(() => {
        renderWriting();
    }, 1800);

}
// ════════════════════════════════════════════
// FASE 3: ESCRITURA (3 ejercicios)
// ════════════════════════════════════════════

function renderWriting() {
    const exercises = [
        { id: 'verb', label: 'Verbo (Base form)', placeholder: 'Ej: break', correct: verbGameState.currentVerbData.verb },
        { id: 'past', label: 'Pasado simple (Past)', placeholder: 'Ej: broke', correct: verbGameState.currentVerbData.past },
        { id: 'participle', label: 'Participio pasado', placeholder: 'Ej: broken', correct: verbGameState.currentVerbData.participle }
    ];

    const currentEx = exercises[verbGameState.currentWritingIndex];
    const progress = `${verbGameState.currentWritingIndex + 1}/3`;

    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-verbgame">
            <div class="hdr"><button class="back" onclick="renderMap()">←</button>
                <span style="font-size:12px;">🎮 Verb Quest · (${progress})</span>
                <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
            <div class="game-body sb">
                <div class="game-card" style="padding:20px;">
                    <div style="text-align:center;margin-bottom:20px;">
                        <div class="ex-tag">✍️ ESCRIBE LA FORMA CORRECTA</div>
                        <div style="font-size:22px;font-weight:800;color:var(--pri);margin-top:10px;">${verbGameState.currentVerbData.spanishWord}</div>
                    </div>
                    <div>
                        <label style="font-size:16px;font-weight:700;color:var(--text);">${currentEx.label}:</label>
                        <input type="text" id="write-answer" class="write-input" placeholder="${currentEx.placeholder}" 
                               style="width:100%;padding:14px;background:var(--card2);border:2px solid var(--border);border-radius:16px;color:var(--text);font-size:18px;margin-top:10px;text-align:center;">
                    </div>
                </div>
                <button class="btn btn-p" onclick="checkWritingAnswer()" style="margin-top:12px;">✅ Verificar</button>
            </div>
        </div>
    `;

    setTimeout(() => {
        const input = document.getElementById('write-answer');
        if (input) input.focus();
    }, 100);
}

function checkWritingAnswer() {
    const exercises = [
        { id: 'verb', correct: verbGameState.currentVerbData.verb },
        { id: 'past', correct: verbGameState.currentVerbData.past },
        { id: 'participle', correct: verbGameState.currentVerbData.participle }
    ];

    // Verificar que el índice está dentro del rango
    if (verbGameState.currentWritingIndex >= exercises.length) {
        console.error('Índice fuera de rango en checkWritingAnswer');
        verbGameState.currentWritingIndex = 0;
    }
    
    const currentEx = exercises[verbGameState.currentWritingIndex];
    const answer = document.getElementById('write-answer')?.value.trim().toLowerCase();
    const isCorrect = answer === currentEx.correct.toLowerCase();

    if (isCorrect) {
        verbGameState.writtenAnswers[verbGameState.currentWritingIndex] = answer;
        playPing();
        toast(`✅ ¡Correcto!`);

        verbGameState.currentWritingIndex++;

        if (verbGameState.currentWritingIndex >= 3) {
            verbGameState.completedExercises[2] = true;
            showMotivationalMessage();
            // Reiniciar el índice
            verbGameState.currentWritingIndex = 0;
            // Ir DIRECTAMENTE a la fase de ordenar oraciones (FASE 4)
            setTimeout(() => renderSentence(), 2000);
        } else {
            setTimeout(() => renderWriting(), 500);
        }
    } else {
        toast(`❌ Incorrecto. Respuesta: ${currentEx.correct}`);
        playPing();
        const input = document.getElementById('write-answer');
        if (input) {
            input.style.borderColor = 'var(--red)';
            setTimeout(() => {
                input.style.borderColor = 'var(--border)';
                input.focus();
            }, 1000);
        }
    }
}

// ════════════════════════════════════════════
// FASE 4: ORDENAR ORACIÓN (3 ejercicios)
// ════════════════════════════════════════════

let sentenceIndex = 0;
const sentenceExercises = [];

function renderSentence() {
    sentenceExercises.length = 0;
    sentenceExercises.push(
        { spanish: verbGameState.currentVerbData.verbSentenceSpanish, english: verbGameState.currentVerbData.verbSentenceEnglish },
        { spanish: verbGameState.currentVerbData.pastSentenceSpanish, english: verbGameState.currentVerbData.pastSentenceEnglish },
        { spanish: verbGameState.currentVerbData.participleSentenceSpanish, english: verbGameState.currentVerbData.participleSentenceEnglish }
    );
    sentenceIndex = 0;
    renderSentenceExercise();
}

function renderSentenceExercise() {
    const currentEx = sentenceExercises[sentenceIndex];
    const progress = `${sentenceIndex + 1}/3`;
    const sentenceEnglish = currentEx.english;
    const sentenceSpanish = currentEx.spanish;

    const words = sentenceEnglish.split(' ');
    const shuffled = [...words];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    verbGameState.originalWords = shuffled;
    verbGameState.sentenceOrder = [];

    let wordsHtml = shuffled.map((word, idx) => `
        <div class="sentence-word" data-word="${word}" data-idx="${idx}" 
             style="background:var(--card2);border:2px solid var(--border);border-radius:16px;padding:10px 16px;margin:6px;display:inline-block;cursor:pointer;font-weight:600;">
            ${word}
        </div>
    `).join('');

    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-verbgame">
            <div class="hdr"><button class="back" onclick="renderMap()">←</button>
                <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
            <div class="game-body sb">
                <div class="game-card" style="padding:16px;">
                    <div style="text-align:center;margin-bottom:16px;">
                        <div class="ex-tag">📝 ORDENA LA ORACIÓN</div>
                        <div style="font-size:14px;color:var(--yellow);">🇪🇸 ${sentenceSpanish}</div>
                    </div>
                    <div style="background:var(--card);border-radius:20px;padding:20px;min-height:80px;margin-bottom:16px;">
                        <div id="sentence-area" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;"></div>
                    </div>
                    <div style="background:var(--card2);border-radius:20px;padding:16px;">
                        <div id="sentence-words-container" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                            ${wordsHtml}
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;margin-top:16px;">
                        <button class="btn btn-s" onclick="sentenceHelp()" style="flex:1;">💡 Ayuda</button>
                        <button class="btn btn-p" id="sentence-continue-btn" onclick="checkSentenceExercise()" style="flex:1;" disabled>✅ Siguiente</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    initSentenceDragExercise();
}

function initSentenceDragExercise() {
    const words = document.querySelectorAll('.sentence-word');
    const sentenceArea = document.getElementById('sentence-area');

    function updateButton() {
        const btn = document.getElementById('sentence-continue-btn');
        if (btn) btn.disabled = verbGameState.sentenceOrder.length !== verbGameState.originalWords.length;
    }

    words.forEach(word => {
        const newWord = word.cloneNode(true);
        word.parentNode.replaceChild(newWord, word);

        newWord.addEventListener('click', () => {
            const wordText = newWord.dataset.word;
            verbGameState.sentenceOrder.push(wordText);
            newWord.remove();

            const chip = document.createElement('div');
            chip.textContent = wordText;
            chip.style.cssText = 'background:var(--pri);padding:10px 16px;border-radius:16px;margin:6px;display:inline-block;cursor:pointer;font-weight:600;';
            chip.onclick = () => {
                chip.remove();
                verbGameState.sentenceOrder = verbGameState.sentenceOrder.filter(w => w !== wordText);
                const container = document.getElementById('sentence-words-container');
                const newWord2 = document.createElement('div');
                newWord2.textContent = wordText;
                newWord2.className = 'sentence-word';
                newWord2.style.cssText = 'background:var(--card2);border:2px solid var(--border);border-radius:16px;padding:10px 16px;margin:6px;display:inline-block;cursor:pointer;font-weight:600;';
                newWord2.onclick = () => {
                    verbGameState.sentenceOrder.push(wordText);
                    newWord2.remove();
                    const newChip = chip.cloneNode(true);
                    newChip.onclick = () => {
                        newChip.remove();
                        verbGameState.sentenceOrder = verbGameState.sentenceOrder.filter(w => w !== wordText);
                        container.appendChild(newWord2);
                        updateButton();
                    };
                    sentenceArea.appendChild(newChip);
                    updateButton();
                };
                container.appendChild(newWord2);
                updateButton();
            };
            sentenceArea.appendChild(chip);
            updateButton();
        });
    });
}

function sentenceHelp() {
    const currentEx = sentenceExercises[sentenceIndex];
    const correctSentence = currentEx.english.split(' ');
    const currentOrder = verbGameState.sentenceOrder;

    for (let i = 0; i < correctSentence.length; i++) {
        if (currentOrder[i] !== correctSentence[i]) {
            const wordToAdd = correctSentence[i];
            if (!currentOrder.includes(wordToAdd)) {
                verbGameState.sentenceOrder.push(wordToAdd);
                const wordElement = document.querySelector(`.sentence-word[data-word="${wordToAdd}"]`);
                if (wordElement) wordElement.remove();

                const sentenceArea = document.getElementById('sentence-area');
                const chip = document.createElement('div');
                chip.textContent = wordToAdd;
                chip.style.cssText = 'background:var(--pri);padding:10px 16px;border-radius:16px;margin:6px;display:inline-block;cursor:pointer;font-weight:600;';
                sentenceArea.appendChild(chip);
                toast('💡 Una palabra colocada');
                break;
            }
        }
    }

    const btn = document.getElementById('sentence-continue-btn');
    if (btn) btn.disabled = verbGameState.sentenceOrder.length !== verbGameState.originalWords.length;
}

function checkSentenceExercise() {
    const currentEx = sentenceExercises[sentenceIndex];
    const correctSentence = currentEx.english.split(' ');
    const userSentence = verbGameState.sentenceOrder;

    const isCorrect = userSentence.length === correctSentence.length &&
        userSentence.every((word, idx) => word === correctSentence[idx]);

    if (isCorrect) {
        playPing();
        toast(`✅ ¡Oración ${sentenceIndex + 1} correcta!`);
        sentenceIndex++;

        if (sentenceIndex >= 3) {
            verbGameState.completedExercises[4] = true;
            showMotivationalMessage();
            setTimeout(() => renderComplete(), 2000);
        } else {
            setTimeout(() => renderSentenceExercise(), 500);
        }
    } else {
        toast('❌ Orden incorrecto. ¡Intenta de nuevo!');
        playPing();
        verbGameState.sentenceOrder = [];
        document.getElementById('sentence-area').innerHTML = '';
        renderSentenceExercise();
    }
}

// ════════════════════════════════════════════
// FASE 5: COMPLETADO
// ════════════════════════════════════════════
function renderComplete() {
    verbGameState.completedExercises[4] = true; // Cambiado de [5] a [4]
    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-verbgame">
            <div class="hdr"><button class="back" onclick="renderMap()">←</button>
                <span style="font-size:12px;">🎮 Verb Quest · Completado</span>
                <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
            <div class="cmp-body sb">
                <span class="final-em">🏆</span>
                <h2 class="cmp-title">¡Felicidades!</h2>
                <p class="cmp-sub">Has dominado el verbo "${verbGameState.currentVerbData.spanishWord}"</p>
                <div class="sgrid au">
                    <div class="sc"><span class="sv">✅</span><span class="sl">Sopa de letras</span></div>
                    <div class="sc"><span class="sv">📦</span><span class="sl">Clasificación</span></div>
                    <div class="sc"><span class="sv">✍️</span><span class="sl">Escritura</span></div>
                    <div class="sc"><span class="sv">📝</span><span class="sl">Ordenar</span></div>
                    <div class="sc"><span class="sv">🎉</span><span class="sl">Completado</span></div>
                </div>
                <button class="btn btn-p" onclick="completeVerbGame()">🏆 Finalizar</button>
            </div>
        </div>
    `;
}

// ════════════════════════════════════════════
// FUNCIONES DE CONTROL
// ════════════════════════════════════════════

function showMotivationalMessage() {
    const msg = MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
    toast(msg);
    confetti(15);
}

function completeVerbGame() {
    const verbGameId = `verb_${verbGameState.currentVerbData.spanishWord}`;
    S.gameProgress[verbGameId] = {
        answers: { completed: true },
        correct: true,
        timeMs: Date.now()
    };
    save();
    toast('🏆 ¡Juego completado! Has dominado este verbo');
    confetti(40);
    setTimeout(() => renderMap(), 2000);
}

function startVerbGame(verbData, nodeIdx) {
    verbGameState = {
        active: true,
        currentVerbData: verbData,
        currentExerciseIndex: 0,
        completedExercises: [false, false, false, false, false],
        wordSearchFound: [],
        dragDropMatches: {},
        writtenAnswers: [],
        currentWritingIndex: 0,
        sentenceOrder: [],
        originalWords: []
    };
    renderWordSearchPhase();
}

function renderWordSearchPhase() {
    const html = renderWordSearch(verbGameState.currentVerbData);
    document.getElementById('app').innerHTML = `
        <div class="screen active" id="scr-verbgame">
            <div class="hdr"><button class="back" onclick="renderMap()">←</button>
                <span style="font-size:12px;font-weight:800;color:var(--muted)">🎮 Verb Quest · Fase 1/6</span>
                <button class="ico-btn" onclick="openOptions()">⚙️</button></div>
            <div class="game-body sb">
                ${html}
            </div>
        </div>
    `;
    setTimeout(() => initWordSearchSelection(), 100);
}