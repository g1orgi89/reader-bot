/**
 * PATCH для knowledge.js - исправление проблемы с загрузкой документов
 * Проблема: Таблица показывает "Загрузка документов..." но не отображает реальные документы
 */

console.log('📚 ПАТЧ: Загружаем исправления для knowledge.js...');

// Перезаписываем функцию loadDocuments с улучшенной отладкой
window.loadDocuments = async function() {
    if (window.isLoading) {
        console.log('📚 ПАТЧ: Уже загружается, пропускаем...');
        return;
    }
    
    try {
        console.log('📚 ПАТЧ: Начинаем загрузку документов...');
        window.isLoading = true;
        
        // Показываем загрузку
        const tableBody = document.querySelector('#documents-table tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr class="table-loading">
                    <td colspan="6">
                        <div class="loading-spinner"></div>
                        📚 Загрузка документов...
                    </td>
                </tr>
            `;
        }

        const params = new URLSearchParams({
            page: window.currentPage || 1,
            limit: 10
        });

        // Добавляем фильтры если есть
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim()) {
            params.append('q', searchInput.value.trim());
            console.log('📚 ПАТЧ: Добавлен поисковый запрос:', searchInput.value.trim());
        }

        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter && categoryFilter.value) {
            params.append('category', categoryFilter.value);
            console.log('📚 ПАТЧ: Добавлен фильтр категории:', categoryFilter.value);
        }

        const url = `/api/reader/knowledge?${params}`;
        console.log('📚 ПАТЧ: Делаем запрос к:', url);

        // Упрощенный запрос без сложной аутентификации
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('📚 ПАТЧ: Статус ответа:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📚 ПАТЧ: Получены данные:', data);

        // Проверяем разные форматы ответа
        let documents = [];
        let pagination = null;

        if (data.success && data.data) {
            // Формат: {success: true, data: [...]}
            documents = data.data;
            pagination = data.pagination;
            console.log('📚 ПАТЧ: Используем формат {success: true, data: [...]}');
        } else if (Array.isArray(data)) {
            // Формат: прямой массив документов
            documents = data;
            console.log('📚 ПАТЧ: Используем прямой массив документов');
        } else if (data.documents) {
            // Формат: {documents: [...]}
            documents = data.documents;
            pagination = data.pagination;
            console.log('📚 ПАТЧ: Используем формат {documents: [...]}');
        } else {
            console.warn('📚 ПАТЧ: Неизвестный формат ответа:', data);
            documents = [];
        }

        console.log('📚 ПАТЧ: Обрабатываем', documents.length, 'документов');

        // Отображаем документы
        renderDocumentsPatch(documents);
        
        // Обновляем пагинацию если есть
        if (pagination && typeof updatePagination === 'function') {
            updatePagination(pagination);
        }

        console.log('📚 ПАТЧ: Документы успешно загружены и отображены');

    } catch (error) {
        console.error('📚 ПАТЧ: Ошибка загрузки документов:', error);
        
        const tableBody = document.querySelector('#documents-table tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr class="table-error">
                    <td colspan="6" class="text-center">
                        ❌ Ошибка загрузки: ${error.message}
                        <br>
                        <button class="btn btn-secondary" onclick="loadDocuments()" style="margin-top: 10px;">
                            🔄 Повторить
                        </button>
                    </td>
                </tr>
            `;
        }

        // Показываем уведомление об ошибке
        if (typeof showNotification === 'function') {
            showNotification('error', 'Ошибка загрузки документов: ' + error.message);
        }
    } finally {
        window.isLoading = false;
        console.log('📚 ПАТЧ: Загрузка завершена');
    }
};

// Улучшенная функция отображения документов
function renderDocumentsPatch(documents) {
    console.log('📚 ПАТЧ: Отображаем документы:', documents);
    
    const tableBody = document.querySelector('#documents-table tbody');
    if (!tableBody) {
        console.error('📚 ПАТЧ: Не найден tbody таблицы');
        return;
    }

    if (!documents || documents.length === 0) {
        console.log('📚 ПАТЧ: Документы не найдены');
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    📚 Документы не найдены
                    <br>
                    <small class="text-muted">Попробуйте изменить фильтры или загрузить новые документы</small>
                </td>
            </tr>
        `;
        return;
    }

    console.log('📚 ПАТЧ: Создаем HTML для', documents.length, 'документов');

    const documentsHTML = documents.map((doc, index) => {
        console.log(`📚 ПАТЧ: Обрабатываем документ ${index + 1}:`, doc);
        
        const id = doc._id || doc.id || `doc_${index}`;
        const title = doc.title || 'Без названия';
        const category = doc.category || 'general';
        const language = doc.language || 'auto';
        const status = doc.status || 'draft';
        const content = doc.content || '';
        const tags = doc.tags || [];

        return `
            <tr data-id="${escapeHtmlPatch(id)}">
                <td class="col-title">
                    <div class="document-title">${escapeHtmlPatch(title)}</div>
                    <small class="text-muted">${escapeHtmlPatch(content.substring(0, 100))}${content.length > 100 ? '...' : ''}</small>
                </td>
                <td class="col-category">
                    <span class="badge badge-primary">${getCategoryDisplayNamePatch(category)}</span>
                </td>
                <td class="col-language">${escapeHtmlPatch(language)}</td>
                <td class="col-tags">
                    ${renderTagsPatch(tags)}
                </td>
                <td class="col-status">
                    <span class="badge badge-${status === 'published' ? 'success' : 'warning'}">
                        ${status === 'published' ? 'Опубликован' : 'Черновик'}
                    </span>
                </td>
                <td class="col-actions">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewDocumentPatch('${id}')" title="Просмотр">
                            👁️
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editDocumentPatch('${id}')" title="Редактировать">
                            ✏️
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteDocumentPatch('${id}')" title="Удалить">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    console.log('📚 ПАТЧ: HTML создан, вставляем в таблицу...');
    tableBody.innerHTML = documentsHTML;
    
    // Обновляем информацию о результатах
    const resultsInfo = document.getElementById('results-info');
    if (resultsInfo) {
        resultsInfo.textContent = `Показано ${documents.length} документов`;
    }
    
    console.log('📚 ПАТЧ: Документы успешно отображены в таблице');
}

// Вспомогательные функции
function escapeHtmlPatch(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryDisplayNamePatch(category) {
    const categories = {
        'books': '📚 Книги',
        'psychology': '🧠 Психология',
        'self-development': '✨ Саморазвитие',
        'relationships': '💕 Отношения',
        'productivity': '⚡ Продуктивность',
        'mindfulness': '🧘 Осознанность',
        'creativity': '🎨 Творчество',
        'general': '📖 Общие'
    };
    return categories[category] || category || 'Общие';
}

function renderTagsPatch(tags) {
    if (!tags || tags.length === 0) {
        return '<span class="text-muted">—</span>';
    }
    
    const visibleTags = tags.slice(0, 3);
    const hiddenCount = tags.length - 3;
    
    let html = visibleTags.map(tag => 
        `<span class="badge badge-secondary badge-sm">${escapeHtmlPatch(tag)}</span>`
    ).join(' ');
    
    if (hiddenCount > 0) {
        html += ` <span class="text-muted">+${hiddenCount}</span>`;
    }
    
    return html;
}

// Заглушки для функций действий (пока что просто логирование)
function viewDocumentPatch(id) {
    console.log('📚 ПАТЧ: Просмотр документа:', id);
    if (typeof viewDocument === 'function') {
        viewDocument(id);
    } else {
        alert('Просмотр документа: ' + id);
    }
}

function editDocumentPatch(id) {
    console.log('📚 ПАТЧ: Редактирование документа:', id);
    if (typeof editDocument === 'function') {
        editDocument(id);
    } else {
        alert('Редактирование документа: ' + id);
    }
}

function deleteDocumentPatch(id) {
    console.log('📚 ПАТЧ: Удаление документа:', id);
    if (typeof deleteDocument === 'function') {
        deleteDocument(id);
    } else {
        if (confirm('Удалить документ: ' + id + '?')) {
            alert('Функция удаления не реализована');
        }
    }
}

// Глобальные переменные если не существуют
if (typeof window.currentPage === 'undefined') {
    window.currentPage = 1;
}
if (typeof window.isLoading === 'undefined') {
    window.isLoading = false;
}

console.log('📚 ПАТЧ: Исправления загружены успешно');
console.log('📚 ПАТЧ: Можно вызвать loadDocuments() для тестирования');

// Автоматически загружаем документы если находимся на странице знаний
if (window.location.pathname.includes('knowledge.html')) {
    console.log('📚 ПАТЧ: Автоматически загружаем документы...');
    setTimeout(() => {
        loadDocuments();
    }, 1000);
}
