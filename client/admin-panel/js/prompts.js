/**
 * 🔧 ИСПРАВЛЕНО: Render prompts list - переписано по образцу renderDocuments из knowledge.js
 */
function renderPrompts(prompts) {
    console.log('🤖 === НАЧАЛО renderPrompts ===');
    console.log('🤖 Rendering prompts:', prompts);
    console.log(`🤖 Rendering ${prompts ? prompts.length : 0} prompts`);
    
    const tableBody = document.querySelector('#prompts-table tbody');
    const emptyState = document.getElementById('empty-state');
    
    if (!tableBody) {
        console.error('🤖 Table body not found!');
        return;
    }

    // Проверяем наличие промптов
    if (!prompts || prompts.length === 0) {
        console.log('🤖 No prompts to display');
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Промпты не найдены</td></tr>';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    console.log(`🤖 Rendering ${prompts.length} prompts`);
    
    if (emptyState) emptyState.style.display = 'none';

    // 🔧 ГЛАВНОЕ ИСПРАВЛЕНИЕ: Переписываем renderPrompts по образцу renderDocuments
    const promptsHTML = prompts.map((prompt, index) => {
        console.log(`🤖 Rendering prompt ${index}:`, prompt.name, prompt.category);
        
        // 🔧 ИСПРАВЛЕНО: Сервер возвращает поле 'id', а не '_id'
        const promptId = prompt.id || prompt._id;
        console.log(`🤖 Prompt ${index} ID:`, promptId);
        
        if (!promptId) {
            console.warn('🤖 Prompt without ID:', prompt);
        }
        
        const html = `
        <tr data-id="${promptId}">
            <td class="col-name">
                <div class="prompt-name">${escapeHtml(prompt.name || 'Без названия')}</div>
                <small class="text-muted">${escapeHtml((prompt.description || '').substring(0, 80))}${(prompt.description || '').length > 80 ? '...' : ''}</small>
            </td>
            <td class="col-category">
                <span class="badge badge-primary">${getCategoryDisplayName(prompt.category)}</span>
            </td>
            <td class="col-language">${getLanguageDisplayName(prompt.language)}</td>
            <td class="col-variables">
                ${renderVariables(prompt.variables)}
            </td>
            <td class="col-status">
                <span class="badge badge-${getStatusBadgeClass(prompt.status)}">${getStatusDisplayName(prompt.status)}</span>
            </td>
            <td class="col-priority">
                <span class="priority priority-${prompt.priority || 'normal'}">${getPriorityDisplayName(prompt.priority)}</span>
            </td>
            <td class="col-actions">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewPrompt('${promptId}')" title="Просмотр">
                        👁️
                    </button>
                    <button class="btn btn-outline-secondary" onclick="editPrompt('${promptId}')" title="Редактировать">
                        ✏️
                    </button>
                    <button class="btn btn-outline-success" onclick="testPromptById('${promptId}')" title="Тестировать">
                        🧪
                    </button>
                    <button class="btn btn-outline-danger" onclick="deletePrompt('${promptId}')" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `;
        console.log(`🤖 Generated HTML for prompt ${index} (length: ${html.length})`);
        return html;
    }).join('');

    console.log(`🤖 Final HTML length: ${promptsHTML.length}`);
    console.log(`🤖 Final HTML preview:`, promptsHTML.substring(0, 200) + '...');
    console.log(`🤖 Setting innerHTML to table body...`);
    
    tableBody.innerHTML = promptsHTML;
    
    console.log('🤖 innerHTML set successfully');
    console.log('🤖 Table body content after setting:', tableBody.innerHTML.substring(0, 200) + '...');
    console.log('✅ Prompts rendered successfully');
    console.log('🤖 === КОНЕЦ renderPrompts ===');
}
