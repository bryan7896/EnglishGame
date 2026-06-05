// ========================================
// STORY READER MODULE - CORREGIDO
// Speaking & Listening practice
// ========================================

// ========== STATE ==========
let storyText = null;
let storyWordsArray = [];
let storyOriginalTokens = [];
let matchedWordsSet = new Set();
let selectedPhrases = [];
let isRecording = false;
let recognition = null;
let currentTranscript = '';

// ========== CONSTANTS ==========
const MIN_WORDS_TO_MATCH = 2;

// ========== INITIALIZATION ==========
function initStoryReader() {
    renderStoryReaderUI();
    attachStoryReaderEvents();
    loadSavedStory();
}

function renderStoryReaderUI() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="screen active" id="scr-story">
            <div class="hdr">
                <button class="back" onclick="closeStoryReader()">←</button>
                <span class="logo">📖 Story Reader</span>
                <button class="ico-btn" onclick="openOptions()">⚙️</button>
            </div>
            
            <div class="story-body sb">
                <div id="story-input-area" class="story-input-area ${storyText ? 'hidden' : ''}">
                    <div class="info-card show" style="margin-bottom: 12px;">
                        <div class="info-row"><span>📖 Nueva historia</span><span class="info-v">Pega tu texto en inglés</span></div>
                    </div>
                    <textarea id="story-input" class="story-textarea" placeholder="Pega tu historia en inglés aquí...&#10;&#10;Ejemplo:&#10;There is less coffee this morning, but there are plenty of tea bags if you prefer."></textarea>
                    <button class="btn btn-p" id="save-story-btn" style="margin-top: 12px;">💾 Guardar historia</button>
                </div>
                
                <div id="story-display-area" class="story-display-area ${storyText ? '' : 'hidden'}">
                    <div class="selected-chips-container" id="selected-chips">
                        <div class="chips-title">📌 Palabras seleccionadas (toca para escuchar)</div>
                        <div class="chips-wrapper" id="chips-wrapper">
                            <span class="chips-empty">Selecciona palabras en el texto</span>
                        </div>
                    </div>
                    
                    <div class="story-card">
                        <div class="story-controls">
                            <button class="btn-icon" id="listen-full-btn">🔊 Escuchar todo</button>
                        </div>
                        <div id="story-text" class="story-text"></div>
                    </div>
                    
                    <div class="recording-controls">
                        <div class="recording-buttons">
                            <button class="btn-rec" id="record-btn">🎤 Grabar</button>
                            <button class="btn-stop hidden" id="stop-btn">⏹️ Detener</button>
                        </div>
                        <div id="recording-result" class="recording-result hidden">
                            <div class="result-feedback" id="result-feedback"></div>
                        </div>
                    </div>
                    
                    <button class="btn btn-s danger-btn" id="delete-story-btn" style="margin-top: 16px;">🗑️ Eliminar historia</button>
                </div>
            </div>
        </div>
    `;
}

function attachStoryReaderEvents() {
    const saveBtn = document.getElementById('save-story-btn');
    if (saveBtn) saveBtn.onclick = saveNewStory;

    const listenBtn = document.getElementById('listen-full-btn');
    if (listenBtn) listenBtn.onclick = () => speakFullStory();

    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) recordBtn.onclick = startRecording;

    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) stopBtn.onclick = stopRecording;

    const deleteBtn = document.getElementById('delete-story-btn');
    if (deleteBtn) deleteBtn.onclick = deleteStory;

    initSpeechRecognition();
}

// ========== TEXT PROCESSING ==========
function processStoryText(text) {
    const cleanText = text.trim();

    const originalTokens = [];
    const normalizedTokens = [];

    let currentWord = '';
    let currentPunctuation = '';

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];

        if (char === ' ') {
            if (currentWord) {
                originalTokens.push(currentWord);
                normalizedTokens.push(currentWord.toLowerCase());
                currentWord = '';
            }
            if (currentPunctuation) {
                originalTokens.push(currentPunctuation);
                normalizedTokens.push(currentPunctuation);
                currentPunctuation = '';
            }
            originalTokens.push(' ');
            normalizedTokens.push(' ');
        } else if (char.match(/[.,!?;:()"']/)) {
            if (currentWord) {
                originalTokens.push(currentWord);
                normalizedTokens.push(currentWord.toLowerCase());
                currentWord = '';
            }
            currentPunctuation += char;
        } else {
            if (currentPunctuation) {
                originalTokens.push(currentPunctuation);
                normalizedTokens.push(currentPunctuation);
                currentPunctuation = '';
            }
            currentWord += char;
        }
    }

    if (currentWord) {
        originalTokens.push(currentWord);
        normalizedTokens.push(currentWord.toLowerCase());
    }
    if (currentPunctuation) {
        originalTokens.push(currentPunctuation);
        normalizedTokens.push(currentPunctuation);
    }

    return { tokens: normalizedTokens, originalTokens: originalTokens };
}

function renderHighlightedText() {
    const container = document.getElementById('story-text');
    if (!container || !storyOriginalTokens) return;

    let html = '';
    let currentWordIndex = 0;

    for (let i = 0; i < storyOriginalTokens.length; i++) {
        const token = storyOriginalTokens[i];

        if (token === ' ') {
            html += ' ';
            continue;
        }

        const isPunctuation = token.match(/^[.,!?;:()"']+$/);

        if (isPunctuation) {
            html += `<span class="punctuation">${escapeHtml(token)}</span>`;
        } else {
            const isMatched = matchedWordsSet.has(currentWordIndex);
            const isSelected = isWordInSelectedPhrases(token);

            let classes = [];
            if (isMatched) classes.push('story-word-matched');
            if (isSelected) classes.push('story-word-selected');

            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
            html += `<span data-word="${escapeHtml(token.toLowerCase())}" data-idx="${currentWordIndex}"${classAttr}>${escapeHtml(token)}</span>`;
            currentWordIndex++;
        }
    }

    container.innerHTML = html;
    attachTouchEvents();
}

function isWordInSelectedPhrases(word) {
    const lowerWord = word.toLowerCase().replace(/[.,!?;:()"']/g, '');
    return selectedPhrases.some(phrase => {
        const phraseLower = phrase.toLowerCase();
        const wordsInPhrase = phraseLower.split(/\s+/);
        return wordsInPhrase.includes(lowerWord);
    });
}

function groupContiguousWords(words) {
    if (words.length === 0) return [];

    // Obtener las posiciones de cada palabra en el texto original
    const wordPositions = [];

    for (let i = 0; i < storyOriginalTokens.length; i++) {
        const token = storyOriginalTokens[i];
        if (token !== ' ' && !token.match(/^[.,!?;:()"']+$/)) {
            const normalizedToken = token.toLowerCase();
            if (words.includes(normalizedToken)) {
                wordPositions.push({
                    word: normalizedToken,
                    index: i,
                    original: token
                });
            }
        }
    }

    // Ordenar por índice de aparición en el texto
    wordPositions.sort((a, b) => a.index - b.index);

    // Agrupar palabras contiguas (diferencia de índice === 1)
    const phrases = [];
    let currentPhrase = [];
    let lastIndex = -1;

    for (let i = 0; i < wordPositions.length; i++) {
        const pos = wordPositions[i];

        if (lastIndex === -1) {
            currentPhrase.push(pos.original);
        } else if (pos.index === lastIndex + 1) {
            currentPhrase.push(pos.original);
        } else {
            if (currentPhrase.length > 0) {
                phrases.push(currentPhrase.join(' '));
            }
            currentPhrase = [pos.original];
        }
        lastIndex = pos.index;
    }

    if (currentPhrase.length > 0) {
        phrases.push(currentPhrase.join(' '));
    }

    return phrases;
}
function attachTouchEvents() {
    const container = document.getElementById('story-text');
    if (!container) return;

    container.style.userSelect = 'none';
    container.style.webkitUserSelect = 'none';

    let selectedIndicesTemp = new Set();
    let mouseSelecting = false;

    // ---- TOUCH ----
    container.addEventListener('touchstart', (e) => {
        selectedIndicesTemp.clear();
        const target = e.target.closest('[data-idx]');
        if (target) {
            const idx = parseInt(target.dataset.idx);
            if (!isNaN(idx)) {
                selectedIndicesTemp.add(idx);
                highlightTempWord(target, true);
            }
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const wordSpan = element?.closest('[data-idx]');
        if (wordSpan) {
            const idx = parseInt(wordSpan.dataset.idx);
            if (!isNaN(idx) && !selectedIndicesTemp.has(idx)) {
                selectedIndicesTemp.add(idx);
                highlightTempWord(wordSpan, true);
            }
        }
    }, { passive: false });

    container.addEventListener('touchend', () => {
        _commitSelection(selectedIndicesTemp);
        container.querySelectorAll('.temp-selected').forEach(el => el.classList.remove('temp-selected'));
        selectedIndicesTemp.clear();
    }, { passive: true });

    // ---- MOUSE ----
    container.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        mouseSelecting = true;
        selectedIndicesTemp.clear();
        container.querySelectorAll('.temp-selected').forEach(el => el.classList.remove('temp-selected'));

        const target = e.target.closest('[data-idx]');
        console.log('mousedown - target:', target, '| dataset:', target?.dataset);
        if (target) {
            const idx = parseInt(target.dataset.idx);
            if (!isNaN(idx)) {
                selectedIndicesTemp.add(idx);
                highlightTempWord(target, true);
                console.log('mousedown - añadido idx:', idx, '| Set ahora:', Array.from(selectedIndicesTemp));
            }
        }
    });

    const onMouseMove = (e) => {
        if (!mouseSelecting) return;
        const element = document.elementFromPoint(e.clientX, e.clientY);
        const wordSpan = element?.closest('[data-idx]');
        if (wordSpan) {
            const idx = parseInt(wordSpan.dataset.idx);
            if (!isNaN(idx) && !selectedIndicesTemp.has(idx)) {
                selectedIndicesTemp.add(idx);
                highlightTempWord(wordSpan, true);
                console.log('mousemove - añadido idx:', idx, '| Set ahora:', Array.from(selectedIndicesTemp));
            }
        }
    };

    const onMouseUp = () => {
        if (!mouseSelecting) return;
        console.log('mouseup - Set final antes de commit:', Array.from(selectedIndicesTemp));
        mouseSelecting = false;
        _commitSelection(selectedIndicesTemp);
        container.querySelectorAll('.temp-selected').forEach(el => el.classList.remove('temp-selected'));
        selectedIndicesTemp.clear();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function _commitSelection(indicesSet) {
    if (indicesSet.size === 0) return;

    const indicesArray = Array.from(indicesSet);
    console.log('=== _commitSelection ===');
    console.log('índices recibidos:', indicesArray);
    console.log('cantidad de índices:', indicesArray.length);

    const phrases = groupContiguousIndices(indicesArray);
    console.log('frases resultantes:', phrases);

    phrases.forEach(phrase => {
        if (phrase && !selectedPhrases.includes(phrase)) {
            selectedPhrases.unshift(phrase);
            if (selectedPhrases.length > 15) selectedPhrases.pop();
        }
    });
    renderSelectedChips();
    renderHighlightedText();
}

function groupContiguousIndices(wordIndices) {
    if (wordIndices.length === 0) return [];

    const sorted = [...wordIndices].sort((a, b) => a - b);
    const phrases = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            // Contiguas: mismo grupo
            currentGroup.push(sorted[i]);
        } else {
            phrases.push(_indicesToPhrase(currentGroup));
            currentGroup = [sorted[i]];
        }
    }
    phrases.push(_indicesToPhrase(currentGroup));

    return phrases.filter(Boolean);
}

// Convierte un array de word-indices en el texto original correspondiente
function _indicesToPhrase(indices) {
    const words = indices.map(wordIdx => {
        // Recorre storyOriginalTokens contando solo palabras reales
        let count = 0;
        for (let t = 0; t < storyOriginalTokens.length; t++) {
            const tok = storyOriginalTokens[t];
            if (tok !== ' ' && !tok.match(/^[.,!?;:()"']+$/)) {
                if (count === wordIdx) return tok;
                count++;
            }
        }
        return null;
    });
    return words.filter(Boolean).join(' ');
}

// Helper: dado un word-index, devuelve el token-index correspondiente en storyOriginalTokens
function getTokenIndexForWordIndex(wordIndex) {
    let wordCount = 0;
    for (let i = 0; i < storyOriginalTokens.length; i++) {
        const token = storyOriginalTokens[i];
        if (token !== ' ' && !token.match(/^[.,!?;:()"']+$/)) {
            if (wordCount === wordIndex) return i;
            wordCount++;
        }
    }
    return -1;
}

function highlightTempWord(element, add) {
    if (add) {
        element.classList.add('temp-selected');
    } else {
        element.classList.remove('temp-selected');
    }
}

function renderSelectedChips() {
    const wrapper = document.getElementById('chips-wrapper');
    if (!wrapper) return;

    if (selectedPhrases.length === 0) {
        wrapper.innerHTML = '<span class="chips-empty">Selecciona palabras en el texto</span>';
        return;
    }

    const chipsHtml = selectedPhrases.map((phrase, idx) => `
        <button class="chip" data-phrase="${escapeHtml(phrase)}" onclick="speakSelectedPhrase('${escapeHtml(phrase)}')">
            🔊 ${escapeHtml(phrase)}
        </button>
    `).join('');

    wrapper.innerHTML = chipsHtml;
}

// ========== STORAGE ==========
function loadSavedStory() {
    const saved = S.storyData;
    if (saved && saved.text) {
        storyText = saved.text;
        matchedWordsSet = new Set(saved.matchedIndices || []);
        loadStoryIntoView();
    }
}

function saveStoryToStorage() {
    if (!S.storyData) S.storyData = {};
    S.storyData.text = storyText;
    S.storyData.matchedIndices = Array.from(matchedWordsSet);
    save();
}

function saveNewStory() {
    const input = document.getElementById('story-input');
    const newText = input?.value.trim();

    if (!newText) {
        toast('📝 Por favor, escribe o pega una historia');
        return;
    }

    storyText = newText;
    matchedWordsSet.clear();
    selectedPhrases = [];
    saveStoryToStorage();
    loadStoryIntoView();

    toast('✅ Historia guardada correctamente');
}

function loadStoryIntoView() {
    if (!storyText) return;

    const processed = processStoryText(storyText);
    storyWordsArray = processed.tokens.filter(t => t !== ' ');
    storyOriginalTokens = processed.originalTokens;

    const inputArea = document.getElementById('story-input-area');
    const displayArea = document.getElementById('story-display-area');

    if (inputArea) inputArea.classList.add('hidden');
    if (displayArea) displayArea.classList.remove('hidden');

    renderHighlightedText();
    renderSelectedChips();
}

function deleteStory() {
    if (confirm('¿Eliminar esta historia? Se perderá el progreso.')) {
        storyText = null;
        storyWordsArray = [];
        storyOriginalTokens = [];
        matchedWordsSet.clear();
        selectedPhrases = [];

        if (S.storyData) {
            delete S.storyData.text;
            delete S.storyData.matchedIndices;
        }
        save();

        const inputArea = document.getElementById('story-input-area');
        const displayArea = document.getElementById('story-display-area');
        const textarea = document.getElementById('story-input');

        if (inputArea) inputArea.classList.remove('hidden');
        if (displayArea) displayArea.classList.add('hidden');
        if (textarea) textarea.value = '';

        toast('🗑️ Historia eliminada');
    }
}

function closeStoryReader() {
    if (recognition) {
        try { recognition.abort(); } catch (e) { }
    }
    renderMap();
}

// ========== SPEECH (LISTENING) ==========
function speakFullStory() {
    if (!storyText) return;
    speakWithRandomVoice(storyText, 0.85);
}

function speakSelectedPhrase(phrase) {
    if (!phrase) return;
    speakWithRandomVoice(phrase, 0.7);
}

let lastVoiceIndex = -1;
let availableVoices = [];

function loadVoices() {
    return new Promise((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) {
            availableVoices = voices.filter(v => v.lang.startsWith('en'));
            resolve();
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                availableVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
                resolve();
            };
        }
    });
}

async function speakWithRandomVoice(text, rate) {
    await loadVoices();

    if (availableVoices.length === 0) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        window.speechSynthesis.speak(utterance);
        return;
    }

    let randomIndex = Math.floor(Math.random() * availableVoices.length);
    if (availableVoices.length > 1 && randomIndex === lastVoiceIndex) {
        randomIndex = (randomIndex + 1) % availableVoices.length;
    }
    lastVoiceIndex = randomIndex;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = availableVoices[randomIndex];
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1.0;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// ========== SPEECH RECOGNITION (SPEAKING) ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        toast('⚠️ Tu navegador no soporta reconocimiento de voz');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript) {
            currentTranscript = finalTranscript;
            showRecordingResult(currentTranscript);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopRecording();
        toast('❌ Error al reconocer: ' + event.error);
    };

    recognition.onend = () => {
        if (isRecording) {
            stopRecording();
        }
    };
}

function startRecording() {
    if (!recognition) {
        toast('⚠️ Reconocimiento de voz no disponible');
        return;
    }

    if (!storyText) {
        toast('📖 Primero guarda una historia');
        return;
    }

    currentTranscript = '';
    isRecording = true;

    try {
        recognition.start();

        const recordBtn = document.getElementById('record-btn');
        const stopBtn = document.getElementById('stop-btn');
        const recordingResult = document.getElementById('recording-result');

        if (recordBtn) recordBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');
        if (recordingResult) recordingResult.classList.add('hidden');

        const feedback = document.getElementById('result-feedback');
        if (feedback) feedback.innerHTML = '';

        toast('🎤 Grabando... habla en inglés');
    } catch (e) {
        console.error('Error starting recording:', e);
        toast('❌ No se pudo iniciar la grabación');
        isRecording = false;
    }
}

function stopRecording() {
    if (!recognition || !isRecording) return;

    isRecording = false;

    try {
        recognition.stop();
    } catch (e) { }

    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');

    if (recordBtn) recordBtn.classList.remove('hidden');
    if (stopBtn) stopBtn.classList.add('hidden');

    if (currentTranscript.trim()) {
        processSpokenText(currentTranscript);
    } else {
        toast('🎙️ No se detectó voz. Intenta de nuevo');
    }
}

function showRecordingResult(transcript) {
    const resultDiv = document.getElementById('recording-result');

    if (resultDiv) {
        resultDiv.classList.remove('hidden');
    }
}

// ========== MATCHING ALGORITHM ==========
function normalizeForComparison(text) {
    return text.toLowerCase()
        .replace(/[^\w\s\u00C0-\u024F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function processSpokenText(spoken) {
    const normalizedSpoken = normalizeForComparison(spoken);
    const normalizedStory = normalizeForComparison(storyText);

    const spokenWords = normalizedSpoken.split(/\s+/);
    const storyWords = normalizedStory.split(/\s+/);

    if (spokenWords.length < MIN_WORDS_TO_MATCH) {
        const feedback = document.getElementById('result-feedback');
        if (feedback) {
            feedback.innerHTML = `<span class="feedback-warning">⚠️ Dijiste solo ${spokenWords.length} palabra(s). Necesitas al menos ${MIN_WORDS_TO_MATCH} palabras para marcar progreso.</span>`;
        }
        toast(`📝 Mínimo ${MIN_WORDS_TO_MATCH} palabras para practicar`);
        return;
    }

    const newMatches = findAllMatchingWords(spokenWords, storyWords);

    if (newMatches.length > 0) {
        newMatches.forEach(matchIdx => {
            matchedWordsSet.add(matchIdx);
        });

        saveStoryToStorage();
        renderHighlightedText();

        const matchedText = newMatches.map(idx => storyWordsArray[idx]).join(', ');
        const feedback = document.getElementById('result-feedback');
        if (feedback) {
            feedback.innerHTML = `<span class="feedback-success">✅ ¡Bien! Palabras correctas: ${matchedText}</span>`;
        }

        toast(`🎉 ${newMatches.length} palabra(s) correcta(s)!`);

        checkCompletion();
    } else {
        const feedback = document.getElementById('result-feedback');
        if (feedback) {
            feedback.innerHTML = `<span class="feedback-error">😅 No se encontraron coincidencias. Intenta: "${storyWords.slice(0, 5).join(' ')}..."</span>`;
        }
        toast('😅 No se encontraron coincidencias. Sigue practicando!');
    }
}

function findAllMatchingWords(spokenWords, storyWords) {
    const matches = new Set();
    let spokenIdx = 0;

    for (let storyIdx = 0; storyIdx < storyWords.length && spokenIdx < spokenWords.length; storyIdx++) {
        if (storyWords[storyIdx] === spokenWords[spokenIdx]) {
            const originalIdx = findWordIndexInOriginal(storyWords[storyIdx]);
            if (originalIdx !== -1 && !matchedWordsSet.has(originalIdx)) {
                matches.add(originalIdx);
            }
            spokenIdx++;
        }
    }

    if (matches.size >= MIN_WORDS_TO_MATCH) {
        return Array.from(matches);
    }

    return findMatchingSequences(spokenWords, storyWords);
}

function findMatchingSequences(spokenWords, storyWords) {
    const matches = new Set();

    for (let i = 0; i <= storyWords.length - MIN_WORDS_TO_MATCH; i++) {
        for (let j = 0; j <= spokenWords.length - MIN_WORDS_TO_MATCH; j++) {
            let matchLength = 0;

            while (matchLength < Math.min(storyWords.length - i, spokenWords.length - j) &&
                storyWords[i + matchLength] === spokenWords[j + matchLength]) {
                matchLength++;
            }

            if (matchLength >= MIN_WORDS_TO_MATCH) {
                for (let k = 0; k < matchLength; k++) {
                    const storyWord = storyWords[i + k];
                    const idx = findWordIndexInOriginal(storyWord);
                    if (idx !== -1 && !matchedWordsSet.has(idx)) {
                        matches.add(idx);
                    }
                }
                i += matchLength - 1;
                break;
            }
        }
    }

    return Array.from(matches);
}

function findWordIndexInOriginal(word) {
    for (let i = 0; i < storyWordsArray.length; i++) {
        if (storyWordsArray[i] === word) {
            return i;
        }
    }
    return -1;
}

function checkCompletion() {
    const totalWords = storyWordsArray.length;
    const matchedCount = matchedWordsSet.size;

    if (matchedCount >= totalWords && totalWords > 0) {
        confetti(60);
        toast('🎉 ¡INCREÍBLE! ¡Completaste toda la historia! 🎉');
        setTimeout(() => {
            deleteStory();
            renderMap();
        }, 3000);
    }
}

// ========== UTILITIES ==========
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== EXPORT ==========
window.speakSelectedPhrase = speakSelectedPhrase;
window.closeStoryReader = closeStoryReader;