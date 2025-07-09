/**
 * Knowledge Base Management - УПРОЩЕНО: Следует паттерну dashboard.js и users.html
 * @file client/admin-panel/js/knowledge.js
 * 📖 Adapted for Reader Bot project with WORKING authentication
 */

// Глобальные переменные
let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;
let currentCategory = '';
let currentTags = '';
let isLoading = false;

// Constants
const CATEGORIES = [
    'books',
    'psychology', 
    'self-development',
    'relationships',
    'productivity',
    'mindfulness',
    'creativity',
    'general'
];

/**
 * УПРОЩЕНО: Простой запрос с токеном (как в users.html)
 */
async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('reader_admin_token');
    
    if (!token) {
        console.warn('📖 No token available, redirecting to login');
        window.location.href = 'login.html';
        return null;
    }

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };

    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    try {
        const response = await fetch(url, finalOptions);
        
        if (response.status === 401) {
            console.warn('📖 Authentication failed, redirecting to login');
            localStorage.removeItem('reader_admin_token');
            localStorage.removeItem('reader_admin_user');
            window.location.href = 'login.html';
            return null;
        }

        return response;
    } catch (error) {
        console.error('📖 Request error:', error);
        throw error;
    }
}

/**
 * Загрузка документов с пагинацией
 */
async function loadDocuments() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        console.log('📖 Loading documents...', {
            page: currentPage,
            limit: itemsPerPage,
            category: currentCategory,
            tags: currentTags
        });

        showLoading('Загрузка документов...');

        // Формируем URL с параметрами
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage
        });

        if (currentCategory) {
            params.append('category', currentCategory);
        }

        if (currentTags) {
            params.append('tags', currentTags);
        }

        const url = `/api/knowledge?${params.toString()}`;
        const response = await makeAuthenticatedRequest(url);
        
        if (!response) return;

        const data = await response.json();
        console.log('📖 Documents data received:', data);

        if (data.success) {
            displayDocuments(data.data);
            updatePagination(data.pagination);
        } else {
            throw new Error(data.error || 'Failed to load documents');
        }
    } catch (error) {
        console.error('📖 Ошибка загрузки документов:', error);
        showError('Ошибка загрузки документов: ' + error.message);
    } finally {
        isLoading = false;
        hideLoading();
    }
}

/**
 * Загрузка статистики RAG
 */
async function loadRAGStats() {
    try {
        console.log('📖 Loading RAG statistics...');

        const response = await makeAuthenticatedRequest('/api/knowledge/stats');
        
        if (!response) return;

        const data = await response.json();
        console.log('📖 Stats data received:', data);

        if (data.success) {
            updateStatsDisplay(data.data);
        } else {
            throw new Error(data.error || 'Failed to load statistics');
        }
    } catch (error) {
        console.error('📖 Ошибка загрузки статистики RAG:', error);
        // Не показываем ошибку пользователю для статистики, просто логируем
        updateStatsDisplay({
            total: 0,
            published: 0,
            draft: 0,
            byLanguage: [],
            lastUpdated: new Date().toISOString()
        });
    }
}

/**
 * Отображение документов в таблице
 */
function displayDocuments(documents) {
    console.log('📖 Displaying documents:', documents.length);
    
    const tbody = document.querySelector('#documents-table tbody');
    if (!tbody) {
        console.error('📖 Documents table body not found');
        return;
    }

    if (!documents || documents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Документы не найдены</td></tr>';
        return;
    }

    tbody.innerHTML = documents.map(doc => `
        <tr>
            <td>
                <div class="doc-title">${escapeHtml(doc.title)}</div>
                <div class="doc-id text-muted small">ID: ${doc.id || doc._id}</div>
            </td>
            <td><span class="badge badge-secondary">${escapeHtml(doc.category || 'general')}</span></td>
            <td><span class="badge badge-info">${escapeHtml(doc.language || 'auto')}</span></td>
            <td>
                ${doc.tags && doc.tags.length > 0 
                    ? doc.tags.map(tag => `<span class="badge badge-light">${escapeHtml(tag)}</span>`).join(' ')
                    : '<span class="text-muted">Нет тегов</span>'
                }
            </td>
            <td>
                <span class="badge ${doc.status === 'published' ? 'badge-success' : 'badge-warning'}">
                    ${doc.status === 'published' ? 'Опубликован' : 'Черновик'}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewDocument('${doc.id || doc._id}')">
                        👁️
                    </button>
                    <button class="btn btn-outline-secondary" onclick="editDocument('${doc.id || doc._id}')">
                        ✏️
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteDocument('${doc.id || doc._id}', '${escapeHtml(doc.title)}')">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Обновление отображения статистики
 */
function updateStatsDisplay(stats) {
    console.log('📖 Updating stats display:', stats);
    
    try {
        // Обновляем основную статистику
        const totalEl = document.getElementById('total-docs');
        if (totalEl) totalEl.textContent = stats.total || 0;

        const publishedEl = document.getElementById('published-docs');
        if (publishedEl) publishedEl.textContent = stats.published || 0;

        const draftEl = document.getElementById('draft-docs');
        if (draftEl) draftEl.textContent = stats.draft || 0;

        // Обновляем информацию о языках
        const languageStatsEl = document.getElementById('language-stats');
        if (languageStatsEl && stats.byLanguage) {
            if (stats.byLanguage.length > 0) {
                languageStatsEl.innerHTML = stats.byLanguage.map(lang => 
                    `<div class="language-stat">
                        <span class="badge badge-info">${escapeHtml(lang._id || 'Unknown')}</span> 
                        <span>${lang.count}</span>
                    </div>`
                ).join('');
            } else {
                languageStatsEl.innerHTML = '<div class="text-muted">Нет данных о языках</div>';
            }
        }

        // Обновляем время последнего обновления
        const lastUpdatedEl = document.getElementById('rag-last-indexed');
        if (lastUpdatedEl && stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            lastUpdatedEl.textContent = date.toLocaleString('ru-RU');
        }

        // Обновляем информацию о векторном хранилище
        if (stats.vectorStore) {
            const vectorStatsEl = document.getElementById('vector-store-stats');
            if (vectorStatsEl) {
                vectorStatsEl.innerHTML = `
                    <div class="vector-stat">
                        <span class="text-muted">Статус:</span> 
                        <span class="badge ${stats.vectorStore.status === 'ok' ? 'badge-success' : 'badge-warning'}">
                            ${stats.vectorStore.status}
                        </span>
                    </div>
                    <div class="vector-stat">
                        <span class="text-muted">Документов:</span> 
                        <span>${stats.vectorStore.documentsCount || 0}</span>
                    </div>
                    <div class="vector-stat">
                        <span class="text-muted">Чанков:</span> 
                        <span>${stats.vectorStore.chunksCount || 0}</span>
                    </div>
                `;
            }
        }

        // Обновляем информацию о чанкинге
        if (stats.chunkingEnabled !== undefined) {
            const chunkingEl = document.getElementById('chunking-status');
            if (chunkingEl) {
                chunkingEl.innerHTML = `
                    <span class="badge ${stats.chunkingEnabled ? 'badge-success' : 'badge-secondary'}">
                        Чанкинг: ${stats.chunkingEnabled ? 'Включен' : 'Отключен'}
                    </span>
                `;
            }
        }

    } catch (error) {
        console.error('📖 Error updating stats display:', error);
    }
}

/**
 * Обновление пагинации
 */
function updatePagination(pagination) {
    if (!pagination) return;

    console.log('📖 Updating pagination:', pagination);

    totalItems = pagination.total || 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const paginationEl = document.getElementById('pagination');
    if (!paginationEl) return;

    // Обновляем информацию о результатах
    const resultsInfoEl = document.getElementById('results-info');
    if (resultsInfoEl) {
        const startItem = ((currentPage - 1) * itemsPerPage) + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        resultsInfoEl.textContent = `Показано ${startItem}-${endItem} из ${totalItems}`;
    }

    // Генерируем кнопки пагинации
    if (totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // Кнопка "Предыдущая"
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})" 
               ${currentPage === 1 ? 'tabindex="-1" aria-disabled="true"' : ''}>
                Предыдущая
            </a>
        </li>
    `;

    // Номера страниц
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
                </li>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    // Кнопка "Следующая"
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})"
               ${currentPage === totalPages ? 'tabindex="-1" aria-disabled="true"' : ''}>
                Следующая
            </a>
        </li>
    `;

    paginationEl.innerHTML = paginationHTML;
}

/**
 * Смена страницы
 */
function changePage(page) {
    if (page < 1 || page === currentPage || isLoading) return;
    
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page > totalPages) return;

    currentPage = page;
    loadDocuments();
}

/**
 * Поиск документов
 */
async function searchDocuments() {
    const searchInput = document.getElementById('search-input');
    const searchQuery = searchInput ? searchInput.value.trim() : '';

    if (!searchQuery) {
        showError('Введите запрос для поиска');
        return;
    }

    try {
        isLoading = true;
        showLoading('Поиск документов...');

        console.log('📖 Searching documents:', searchQuery);

        const params = new URLSearchParams({
            q: searchQuery,
            page: 1,
            limit: itemsPerPage
        });

        if (currentCategory) {
            params.append('category', currentCategory);
        }

        if (currentTags) {
            params.append('tags', currentTags);
        }

        const response = await makeAuthenticatedRequest(`/api/knowledge/search?${params.toString()}`);
        
        if (!response) return;

        const data = await response.json();
        console.log('📖 Search results:', data);

        if (data.success) {
            displayDocuments(data.data);
            
            // Обновляем информацию о результатах поиска
            const resultsInfoEl = document.getElementById('results-info');
            if (resultsInfoEl) {
                resultsInfoEl.textContent = `Найдено ${data.count || data.data.length} результатов по запросу "${searchQuery}"`;
            }

            // Скрываем пагинацию для результатов поиска
            const paginationEl = document.getElementById('pagination');
            if (paginationEl) {
                paginationEl.innerHTML = '';
            }
        } else {
            throw new Error(data.error || 'Search failed');
        }
    } catch (error) {
        console.error('📖 Search error:', error);
        showError('Ошибка поиска: ' + error.message);
    } finally {
        isLoading = false;
        hideLoading();
    }
}

/**
 * Сброс поиска и фильтров
 */
function resetSearch() {
    // Очищаем поисковый запрос
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }

    // Сбрасываем фильтры
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.value = '';
    }

    const tagsFilter = document.getElementById('tags-filter');
    if (tagsFilter) {
        tagsFilter.value = '';
    }

    // Сбрасываем переменные
    currentPage = 1;
    currentCategory = '';
    currentTags = '';

    // Перезагружаем документы
    loadDocuments();
}

/**
 * Применение фильтров
 */
function applyFilters() {
    const categoryFilter = document.getElementById('category-filter');
    const tagsFilter = document.getElementById('tags-filter');

    currentCategory = categoryFilter ? categoryFilter.value : '';
    currentTags = tagsFilter ? tagsFilter.value : '';
    currentPage = 1;

    console.log('📖 Applying filters:', {
        category: currentCategory,
        tags: currentTags
    });

    loadDocuments();
}

/**
 * Просмотр документа
 */
async function viewDocument(documentId) {
    try {
        console.log('📖 Viewing document:', documentId);
        showLoading('Загрузка документа...');

        const response = await makeAuthenticatedRequest(`/api/knowledge/${documentId}`);
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showDocumentModal(data.data, 'view');
        } else {
            throw new Error(data.error || 'Failed to load document');
        }
    } catch (error) {
        console.error('📖 Error viewing document:', error);
        showError('Ошибка загрузки документа: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Редактирование документа
 */
async function editDocument(documentId) {
    try {
        console.log('📖 Editing document:', documentId);
        showLoading('Загрузка документа для редактирования...');

        const response = await makeAuthenticatedRequest(`/api/knowledge/${documentId}`);
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showDocumentModal(data.data, 'edit');
        } else {
            throw new Error(data.error || 'Failed to load document for editing');
        }
    } catch (error) {
        console.error('📖 Error loading document for editing:', error);
        showError('Ошибка загрузки документа: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Удаление документа
 */
async function deleteDocument(documentId, title) {
    if (!confirm(`Вы уверены, что хотите удалить документ "${title}"?`)) {
        return;
    }

    try {
        console.log('📖 Deleting document:', documentId);
        showLoading('Удаление документа...');

        const response = await makeAuthenticatedRequest(`/api/knowledge/${documentId}`, {
            method: 'DELETE'
        });
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showSuccess('Документ успешно удален');
            loadDocuments(); // Перезагружаем список
        } else {
            throw new Error(data.error || 'Failed to delete document');
        }
    } catch (error) {
        console.error('📖 Error deleting document:', error);
        showError('Ошибка удаления документа: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Отображение модального окна документа
 */
function showDocumentModal(document, mode = 'view') {
    console.log('📖 Showing document modal:', mode, document.title);

    const modal = document.getElementById('document-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    if (modalTitle) {
        modalTitle.textContent = mode === 'edit' ? 'Редактирование документа' : 'Просмотр документа';
    }

    if (modalBody) {
        if (mode === 'view') {
            modalBody.innerHTML = `
                <div class="document-view">
                    <h4>${escapeHtml(document.title)}</h4>
                    <div class="document-meta mb-3">
                        <span class="badge badge-secondary">${escapeHtml(document.category || 'general')}</span>
                        <span class="badge badge-info">${escapeHtml(document.language || 'auto')}</span>
                        <span class="badge badge-${document.status === 'published' ? 'success' : 'warning'}">
                            ${document.status === 'published' ? 'Опубликован' : 'Черновик'}
                        </span>
                    </div>
                    ${document.tags && document.tags.length > 0 ? `
                        <div class="document-tags mb-3">
                            <strong>Теги:</strong>
                            ${document.tags.map(tag => `<span class="badge badge-light">${escapeHtml(tag)}</span>`).join(' ')}
                        </div>
                    ` : ''}
                    <div class="document-content">
                        <strong>Содержание:</strong>
                        <div class="mt-2 p-3 border rounded bg-light">
                            ${escapeHtml(document.content).replace(/\n/g, '<br>')}
                        </div>
                    </div>
                </div>
            `;
        } else {
            modalBody.innerHTML = `
                <form id="edit-document-form">
                    <input type="hidden" id="edit-doc-id" value="${document.id || document._id}">
                    
                    <div class="form-group">
                        <label for="edit-title">Название</label>
                        <input type="text" class="form-control" id="edit-title" value="${escapeHtml(document.title)}" required>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="edit-category">Категория</label>
                            <select class="form-control" id="edit-category" required>
                                ${CATEGORIES.map(cat => 
                                    `<option value="${cat}" ${document.category === cat ? 'selected' : ''}>${cat}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-group col-md-6">
                            <label for="edit-language">Язык</label>
                            <select class="form-control" id="edit-language">
                                <option value="auto" ${(document.language || 'auto') === 'auto' ? 'selected' : ''}>Авто-определение</option>
                                <option value="ru" ${document.language === 'ru' ? 'selected' : ''}>Русский</option>
                                <option value="en" ${document.language === 'en' ? 'selected' : ''}>Английский</option>
                                <option value="es" ${document.language === 'es' ? 'selected' : ''}>Испанский</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-tags">Теги (через запятую)</label>
                        <input type="text" class="form-control" id="edit-tags" 
                               value="${document.tags ? document.tags.join(', ') : ''}">
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-status">Статус</label>
                        <select class="form-control" id="edit-status">
                            <option value="draft" ${document.status === 'draft' ? 'selected' : ''}>Черновик</option>
                            <option value="published" ${document.status === 'published' ? 'selected' : ''}>Опубликован</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-content">Содержание</label>
                        <textarea class="form-control" id="edit-content" rows="10" required>${escapeHtml(document.content)}</textarea>
                    </div>
                </form>
            `;
        }
    }

    if (modalFooter) {
        if (mode === 'view') {
            modalFooter.innerHTML = `
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Закрыть</button>
                <button type="button" class="btn btn-primary" onclick="editDocument('${document.id || document._id}')">
                    Редактировать
                </button>
            `;
        } else {
            modalFooter.innerHTML = `
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Отмена</button>
                <button type="button" class="btn btn-primary" onclick="saveDocument()">
                    Сохранить изменения
                </button>
            `;
        }
    }

    // Показываем модальное окно
    $(modal).modal('show');
}

/**
 * Сохранение изменений документа
 */
async function saveDocument() {
    try {
        const form = document.getElementById('edit-document-form');
        if (!form) return;

        const documentId = document.getElementById('edit-doc-id').value;
        const title = document.getElementById('edit-title').value.trim();
        const category = document.getElementById('edit-category').value;
        const language = document.getElementById('edit-language').value;
        const tags = document.getElementById('edit-tags').value.trim();
        const status = document.getElementById('edit-status').value;
        const content = document.getElementById('edit-content').value.trim();

        if (!title || !content || !category) {
            showError('Заполните все обязательные поля');
            return;
        }

        console.log('📖 Saving document:', documentId);
        showLoading('Сохранение документа...');

        const updateData = {
            title,
            category,
            language,
            status,
            content,
            tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };

        const response = await makeAuthenticatedRequest(`/api/knowledge/${documentId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showSuccess('Документ успешно обновлен');
            $('#document-modal').modal('hide');
            loadDocuments(); // Перезагружаем список
        } else {
            throw new Error(data.error || 'Failed to update document');
        }
    } catch (error) {
        console.error('📖 Error saving document:', error);
        showError('Ошибка сохранения документа: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Создание нового документа
 */
function createNewDocument() {
    console.log('📖 Creating new document');

    const modal = document.getElementById('document-modal');
    if (!modal) return;

    const modalTitle = modal.querySelector('.modal-title');
    const modalBody = modal.querySelector('.modal-body');
    const modalFooter = modal.querySelector('.modal-footer');

    if (modalTitle) {
        modalTitle.textContent = 'Создание нового документа';
    }

    if (modalBody) {
        modalBody.innerHTML = `
            <form id="create-document-form">
                <div class="form-group">
                    <label for="new-title">Название</label>
                    <input type="text" class="form-control" id="new-title" required>
                </div>
                
                <div class="form-row">
                    <div class="form-group col-md-6">
                        <label for="new-category">Категория</label>
                        <select class="form-control" id="new-category" required>
                            ${CATEGORIES.map(cat => 
                                `<option value="${cat}">${cat}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-group col-md-6">
                        <label for="new-language">Язык</label>
                        <select class="form-control" id="new-language">
                            <option value="auto" selected>Авто-определение</option>
                            <option value="ru">Русский</option>
                            <option value="en">Английский</option>
                            <option value="es">Испанский</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="new-tags">Теги (через запятую)</label>
                    <input type="text" class="form-control" id="new-tags">
                </div>
                
                <div class="form-group">
                    <label for="new-status">Статус</label>
                    <select class="form-control" id="new-status">
                        <option value="draft" selected>Черновик</option>
                        <option value="published">Опубликован</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="new-content">Содержание</label>
                    <textarea class="form-control" id="new-content" rows="10" required></textarea>
                </div>
            </form>
        `;
    }

    if (modalFooter) {
        modalFooter.innerHTML = `
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Отмена</button>
            <button type="button" class="btn btn-primary" onclick="saveNewDocument()">
                Создать документ
            </button>
        `;
    }

    // Показываем модальное окно
    $(modal).modal('show');
}

/**
 * Сохранение нового документа
 */
async function saveNewDocument() {
    try {
        const form = document.getElementById('create-document-form');
        if (!form) return;

        const title = document.getElementById('new-title').value.trim();
        const category = document.getElementById('new-category').value;
        const language = document.getElementById('new-language').value;
        const tags = document.getElementById('new-tags').value.trim();
        const status = document.getElementById('new-status').value;
        const content = document.getElementById('new-content').value.trim();

        if (!title || !content || !category) {
            showError('Заполните все обязательные поля');
            return;
        }

        console.log('📖 Creating new document:', title);
        showLoading('Создание документа...');

        const newDocument = {
            title,
            category,
            language,
            status,
            content,
            tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };

        const response = await makeAuthenticatedRequest('/api/knowledge', {
            method: 'POST',
            body: JSON.stringify(newDocument)
        });
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showSuccess('Документ успешно создан');
            $('#document-modal').modal('hide');
            currentPage = 1; // Возвращаемся на первую страницу
            loadDocuments(); // Перезагружаем список
            loadRAGStats(); // Обновляем статистику
        } else {
            throw new Error(data.error || 'Failed to create document');
        }
    } catch (error) {
        console.error('📖 Error creating document:', error);
        showError('Ошибка создания документа: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Синхронизация с векторным хранилищем
 */
async function syncVectorStore() {
    if (!confirm('Вы уверены, что хотите синхронизировать документы с векторным хранилищем? Это может занять некоторое время.')) {
        return;
    }

    try {
        console.log('📖 Starting vector store synchronization');
        showLoading('Синхронизация с векторным хранилищем...');

        const response = await makeAuthenticatedRequest('/api/knowledge/sync-vector-store', {
            method: 'POST',
            body: JSON.stringify({
                enableChunking: true,
                chunkSize: 500,
                overlap: 100,
                preserveParagraphs: true
            })
        });
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showSuccess(`Синхронизация завершена! Обработано ${data.processed} из ${data.totalDocuments} документов`);
            loadRAGStats(); // Обновляем статистику
        } else {
            throw new Error(data.error || 'Synchronization failed');
        }
    } catch (error) {
        console.error('📖 Error syncing vector store:', error);
        showError('Ошибка синхронизации: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Тестирование RAG поиска
 */
async function testRAGSearch() {
    const searchQuery = prompt('Введите тестовый запрос для RAG поиска:');
    if (!searchQuery) return;

    try {
        console.log('📖 Testing RAG search:', searchQuery);
        showLoading('Тестирование RAG поиска...');

        const response = await makeAuthenticatedRequest('/api/knowledge/test-search', {
            method: 'POST',
            body: JSON.stringify({
                query: searchQuery,
                limit: 5,
                returnChunks: true
            })
        });
        
        if (!response) return;

        const data = await response.json();

        if (data.success) {
            showRAGTestResults(data.data);
        } else {
            throw new Error(data.error || 'RAG test failed');
        }
    } catch (error) {
        console.error('📖 Error testing RAG search:', error);
        showError('Ошибка тестирования RAG: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Отображение результатов тестирования RAG
 */
function showRAGTestResults(results) {
    console.log('📖 Showing RAG test results:', results);

    const modal = document.getElementById('rag-test-modal');
    if (!modal) {
        // Создаем модальное окно если его нет
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal fade" id="rag-test-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Результаты RAG поиска</h5>
                            <button type="button" class="close" data-dismiss="modal">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div id="rag-test-content"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">Закрыть</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    }

    const contentEl = document.getElementById('rag-test-content');
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="rag-test-results">
                <div class="test-info mb-3">
                    <strong>Запрос:</strong> ${escapeHtml(results.query)}<br>
                    <strong>Найдено результатов:</strong> ${results.totalFound}<br>
                    <strong>Тип поиска:</strong> ${results.searchType}<br>
                    <strong>Чанкинг использован:</strong> ${results.chunkingUsed ? 'Да' : 'Нет'}
                </div>
                
                ${results.statistics ? `
                    <div class="test-stats mb-3">
                        <strong>Статистика:</strong><br>
                        <small>
                            Средний score: ${results.statistics.averageScore}<br>
                            Диапазон score: ${results.statistics.scoreRange ? `${results.statistics.scoreRange.min} - ${results.statistics.scoreRange.max}` : 'N/A'}<br>
                            Общая длина контента: ${results.statistics.contentLengths.total} символов
                        </small>
                    </div>
                ` : ''}
                
                <div class="search-results">
                    ${results.results.map((result, index) => `
                        <div class="result-item mb-3 p-3 border rounded">
                            <div class="result-header">
                                <strong>${escapeHtml(result.title)}</strong>
                                <span class="badge badge-primary ml-2">Score: ${result.score.toFixed(4)}</span>
                                ${result.isChunk ? '<span class="badge badge-info ml-1">Чанк</span>' : ''}
                            </div>
                            <div class="result-meta text-muted small">
                                Категория: ${escapeHtml(result.category)} | 
                                Язык: ${escapeHtml(result.language)}
                                ${result.chunkInfo ? ` | Чанк ${result.chunkInfo.chunkIndex + 1}` : ''}
                            </div>
                            <div class="result-content mt-2">
                                <small>${escapeHtml(result.content.substring(0, 300))}${result.content.length > 300 ? '...' : ''}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    $('#rag-test-modal').modal('show');
}

// Utility functions
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(message = 'Загрузка...') {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.textContent = message;
        loadingEl.style.display = 'block';
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function showError(message) {
    console.error('📖 Error:', message);
    
    // Показываем уведомление
    if (typeof showNotification === 'function') {
        showNotification('error', message);
    } else {
        alert('Ошибка: ' + message);
    }
}

function showSuccess(message) {
    console.log('📖 Success:', message);
    
    // Показываем уведомление
    if (typeof showNotification === 'function') {
        showNotification('success', message);
    } else {
        alert('Успех: ' + message);
    }
}

/**
 * УПРОЩЕНО: Простая инициализация без сложной логики ожидания
 */
async function initKnowledgePage() {
    try {
        console.log('📖 Initializing knowledge page...');

        // Инициализируем фильтры категорий
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="">Все категории</option>' +
                CATEGORIES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
        }

        // Загружаем данные
        await Promise.all([
            loadDocuments(),
            loadRAGStats()
        ]);

        // Настраиваем обработчики событий
        setupEventListeners();

        console.log('📖 Knowledge page initialized successfully');
    } catch (error) {
        console.error('📖 Error initializing knowledge page:', error);
        showError('Ошибка инициализации страницы: ' + error.message);
    }
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Поиск
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchDocuments();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', searchDocuments);
    }

    // Сброс поиска
    const resetBtn = document.getElementById('reset-search-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSearch);
    }

    // Фильтры
    const categoryFilter = document.getElementById('category-filter');
    const tagsFilter = document.getElementById('tags-filter');

    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }

    if (tagsFilter) {
        tagsFilter.addEventListener('change', applyFilters);
    }

    // Кнопки действий
    const newDocBtn = document.getElementById('new-document-btn');
    if (newDocBtn) {
        newDocBtn.addEventListener('click', createNewDocument);
    }

    const syncBtn = document.getElementById('sync-vector-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncVectorStore);
    }

    const testRAGBtn = document.getElementById('test-rag-btn');
    if (testRAGBtn) {
        testRAGBtn.addEventListener('click', testRAGSearch);
    }
}

// Экспортируем функции для глобального использования
window.loadDocuments = loadDocuments;
window.searchDocuments = searchDocuments;
window.resetSearch = resetSearch;
window.applyFilters = applyFilters;
window.changePage = changePage;
window.viewDocument = viewDocument;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.saveDocument = saveDocument;
window.createNewDocument = createNewDocument;
window.saveNewDocument = saveNewDocument;
window.syncVectorStore = syncVectorStore;
window.testRAGSearch = testRAGSearch;
window.initKnowledgePage = initKnowledgePage;
