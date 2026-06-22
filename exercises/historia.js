// exercises/historia.js

export function renderHistoriaExercise(exercise, container) {
  const { title, content, paragraphs } = exercise;
  
  const paragraphsHtml = (paragraphs || [content]).map(p => 
    `<p class="story-paragraph">${p}</p>`
  ).join('');
  
  container.innerHTML = `
    <div class="story-content">
      <div class="story-title">📖 ${title}</div>
      ${paragraphsHtml}
    </div>
    <div class="button-group">
      <button class="btn-action btn-continue" id="markReadBtn" style="flex:1; background: #4ade80; color: #064e3b;">
        ✅ Marcar como leído
      </button>
    </div>
    <div class="mood-card">
      <div class="mood-emoji">📚</div>
      <div>
        <strong>Lectura</strong><br>
        <span>Lee y comprende la historia. Marca como leído para continuar.</span>
      </div>
    </div>
  `;
  
  container.querySelector('#markReadBtn').addEventListener('click', () => {
    const event = new CustomEvent('story-read');
    container.dispatchEvent(event);
  });
}