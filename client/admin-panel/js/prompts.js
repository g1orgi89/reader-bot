/**
 * Prompts Management JavaScript for Reader Bot
 * @file client/admin-panel/js/prompts.js
 * 🤖 Управление промптами для Reader Bot
 * 📖 Создано на базе рабочего модуля knowledge.js
 */

// API configuration - использование правильного prefix
const API_PREFIX = '/api/reader'; // 📖 Правильный prefix для Reader Bot

// Global variables
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let searchTimeout = null;

/**
 * Initialize prompts management page
 */
async function initPromptsPage() {
    console.log('🤖 Initializing prompts management page...');
    
    try {
        // Load initial data
        await Promise.all([
            loadPrompts(),
            loadPromptsStats()
        ]);
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('✅ Prompts page initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize prompts page:', error);
        showError('Ошибка инициализации страницы: ' + error.message);
    }
}

/**
 * Make authenticated request with error handling
 * @param {string} endpoint - API endpoint (without prefix)
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
    try {
        // Создаем полный URL с API prefix
        const url = `${API_PREFIX}${endpoint}`;
        
        // 🔧 ИСПРАВЛЕНО: ВСЕ промпты требуют аутентификацию!
        // Сервер требует авторизацию для ВСЕХ endpoints /api/reader/prompts/*
        const isPublicEndpoint = false; // Больше НЕТ публичных промпт endpoints!

        // Не устанавливаем Content-Type для FormData (multipart/form-data)
        const headers = {
            ...options.headers
        };

        // Only set Content-Type for non-FormData requests
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        // 🔧 ИСПРАВЛЕНО: ВСЕГДА добавляем аутентификацию для всех промпт запросов
        const token = localStorage.getItem('adminToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            // Fallback на Basic Auth
            headers['Authorization'] = 'Basic ' + btoa('admin:password123');
        }

        console.log(`🤖 Making request to: ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers
        });

        console.log(`🤖 Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || `HTTP ${response.status}` };
            }
            
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('🤖 Request failed:', error);
        throw error;
    }
}

/**
 * Load prompts with pagination
 */
async function loadPrompts() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading('prompts-table', 'Загрузка промптов...');

        const params = new URLSearchParams({
            page: currentPage,
            limit: 10
        });

        // Add search filter if exists
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim()) {
            params.append('q', searchInput.value.trim());
        }

        // Add category filter if exists
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter && categoryFilter.value) {
            params.append('category', categoryFilter.value);
        }

        // Add language filter if exists
        const languageFilter = document.getElementById('language-filter');
        if (languageFilter && languageFilter.value) {
            params.append('language', languageFilter.value);
        }

        // Add status filter if exists
        const statusFilter = document.getElementById('status-filter');
        if (statusFilter && statusFilter.value) {
            params.append('status', statusFilter.value);
        }

        console.log('🤖 Loading prompts with params:', params.toString());

        const response = await makeAuthenticatedRequest(`/prompts?${params}`);
        
        // 🔍 ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ОТВЕТА СЕРВЕРА
        console.log('🔍 === ДЕТАЛЬНЫЙ АНАЛИЗ ОТВЕТА СЕРВЕРА ===');
        console.log('🤖 Full server response:', response);
        console.log('🤖 Response success:', response.success);
        console.log('🤖 Response data type:', typeof response.data);
        console.log('🤖 Response data:', response.data);
        
        if (Array.isArray(response.data)) {
            console.log('🤖 Data is array with length:', response.data.length);
            if (response.data.length > 0) {
                console.log('🤖 First item structure:', Object.keys(response.data[0]));
                console.log('🤖 First item:', response.data[0]);
            }
        } else {
            console.log('🤖 Data is NOT array, type:', typeof response.data);
        }
        
        if (response.pagination) {
            console.log('🤖 Pagination info:', response.pagination);
        }
        console.log('🔍 === КОНЕЦ АНАЛИЗА ОТВЕТА ===');
        
        if (response.success) {
            renderPrompts(response.data || []);
            
            if (response.pagination) {
                updatePagination(response.pagination);
            }
        } else {
            throw new Error(response.error || 'Не удалось загрузить промпты');
        }
    } catch (error) {
        console.error('🤖 Ошибка загрузки промптов:', error);
        showError('Ошибка загрузки промптов: ' + error.message);
        const tableBody = document.querySelector('#prompts-table tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Не удалось загрузить промпты</td></tr>';
        }
    } finally {
        isLoading = false;
    }
}

/**
 * Load prompts statistics
 */
async function loadPromptsStats() {
    try {
        console.log('🤖 Loading prompts statistics...');
        const response = await makeAuthenticatedRequest('/prompts/stats');
        
        console.log('🤖 Stats response:', response);
        
        if (response.success) {
            renderPromptsStats(response.data);
            console.log('✅ Prompts statistics loaded successfully');
        } else {
            throw new Error(response.error || 'Не удалось загрузить статистику');
        }
    } catch (error) {
        console.error('🤖 Ошибка загрузки статистики промптов:', error);
        // Показываем fallback статистику
        renderPromptsStats({
            total: 0,
            active: 0,
            draft: 0,
            archived: 0,
            byLanguage: [],
            byCategory: [],
            recentlyUpdated: [],
            error: error.message
        });
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search functionality
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 1;
            loadPrompts();
        });
    }

    // Language filter
    const languageFilter = document.getElementById('language-filter');
    if (languageFilter) {
        languageFilter.addEventListener('change', () => {
            currentPage = 1;
            loadPrompts();
        });
    }

    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            currentPage = 1;
            loadPrompts();
        });
    }

    // New prompt button
    const newPromptButton = document.getElementById('new-prompt-btn');
    if (newPromptButton) {
        newPromptButton.addEventListener('click', showCreatePromptModal);
    }

    // Reset search button
    const resetSearchBtn = document.getElementById('reset-search-btn');
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', resetSearch);
    }

    // Search button
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }

    // Test prompt button
    const testPromptBtn = document.getElementById('test-prompt-btn');
    if (testPromptBtn) {
        testPromptBtn.addEventListener('click', showTestPromptModal);
    }

    console.log('🤖 Event listeners setup completed');
}

/**
 * Handle search input
 */
function handleSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadPrompts();
    }, 300);
}

/**
 * Reset search filters
 */
function resetSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const languageFilter = document.getElementById('language-filter');
    const statusFilter = document.getElementById('status-filter');

    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (languageFilter) languageFilter.value = '';
    if (statusFilter) statusFilter.value = '';

    currentPage = 1;
    loadPrompts();
}

/**
 * Show create prompt modal
 */
function showCreatePromptModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'create-prompt-modal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">🤖 Создать новый промпт</h3>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="create-prompt-form">
                        <div class="form-group">
                            <label for="prompt-name">Название промпта *</label>
                            <input type="text" id="prompt-name" name="name" class="form-control" required 
                                   placeholder="Например: Анализ цитат для отчетов">
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="prompt-category">Категория *</label>
                                <select id="prompt-category" name="category" class="select-glow" required>
                                    <option value="">Выберите категорию</option>
                                    <option value="onboarding">🎯 Онбординг</option>
                                    <option value="quote_analysis">📝 Анализ цитат</option>
                                    <option value="weekly_reports">📊 Еженедельные отчеты</option>
                                    <option value="monthly_reports">📈 Месячные отчеты</option>
                                    <option value="book_recommendations">📚 Рекомендации книг</option>
                                    <option value="user_interaction">💬 Взаимодействие с пользователем</option>
                                    <option value="system">⚙️ Системные</option>
                                    <option value="other">📖 Другое</option>
                                </select>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="prompt-language">Язык</label>
                                <select id="prompt-language" name="language" class="select-glow">
                                    <option value="ru">Русский</option>
                                    <option value="en">English</option>
                                    <option value="none">Нет языка</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="prompt-content">Содержание промпта *</label>
                            <textarea id="prompt-content" name="content" class="form-control" rows="8" required
                                      placeholder="Введите текст промпта для Claude AI..."></textarea>
                            <small class="form-text text-muted">
                                Используйте переменные в формате {variable_name} для динамических значений
                            </small>
                        </div>
                        
                        <div class="form-group">
                            <label for="prompt-variables">Переменные (через запятую)</label>
                            <input type="text" id="prompt-variables" name="variables" class="form-control"
                                   placeholder="user_name, quote_text, analysis_type">
                            <small class="form-text text-muted">
                                Переменные, которые будут заменяться в промпте
                            </small>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="prompt-status">Статус</label>
                                <select id="prompt-status" name="status" class="select-glow">
                                    <option value="active">Активный</option>
                                    <option value="draft">Черновик</option>
                                    <option value="archived">Архивный</option>
                                </select>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="prompt-priority">Приоритет</label>
                                <select id="prompt-priority" name="priority" class="select-glow">
                                    <option value="normal">Обычный</option>
                                    <option value="high">Высокий</option>
                                    <option value="low">Низкий</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="prompt-description">Описание (опционально)</label>
                            <textarea id="prompt-description" name="description" class="form-control" rows="3"
                                      placeholder="Краткое описание назначения промпта..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                    <button type="button" class="btn btn-primary" onclick="createPrompt()">
                        🤖 Создать промпт
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Фокус на первое поле
    document.getElementById('prompt-name').focus();
}

/**
 * Create new prompt
 */
async function createPrompt() {
    const form = document.getElementById('create-prompt-form');
    const formData = new FormData(form);
    
    // Validation
    const name = formData.get('name').trim();
    const category = formData.get('category');
    const content = formData.get('content').trim();
    
    if (!name || !category || !content) {
        showError('Заполните все обязательные поля');
        return;
    }
    
    if (content.length < 10) {
        showError('Содержание промпта должно быть минимум 10 символов');
        return;
    }

    try {
        // Prepare prompt data
        const variables = formData.get('variables') ? 
            formData.get('variables').split(',').map(v => v.trim()).filter(v => v) : [];

        const promptData = {
            name: name,
            category: category,
            content: content,
            variables: variables,
            language: formData.get('language') || 'ru',
            status: formData.get('status') || 'active',
            priority: formData.get('priority') || 'normal',
            description: formData.get('description') ? formData.get('description').trim() : ''
        };

        console.log('🤖 Creating prompt:', promptData);

        const response = await makeAuthenticatedRequest('/prompts', {
            method: 'POST',
            body: JSON.stringify(promptData)
        });

        console.log('🤖 Create response:', response);

        if (response.success) {
            showNotification('success', 'Промпт успешно создан!');
            closeModal();
            
            // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Обновляем список как в knowledge.js
            currentPage = 1; // Возвращаемся на первую страницу
            await loadPrompts(); // Перезагружаем список промптов
            await loadPromptsStats(); // Обновляем статистику
            
            console.log('✅ Prompts list refreshed after creation');
        } else {
            throw new Error(response.error || 'Не удалось создать промпт');
        }
    } catch (error) {
        console.error('🤖 Prompt creation error:', error);
        showError('Ошибка создания промпта: ' + error.message);
    }
}

/**
 * Show test prompt modal
 */
function showTestPromptModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🧪 Тестирование промпта</h3>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="test-prompt-select">Выберите промпт для тестирования</label>
                        <select id="test-prompt-select" class="form-control">
                            <option value="">Загрузка промптов...</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="test-variables">Переменные (JSON формат)</label>
                        <textarea id="test-variables" class="form-control" rows="4"
                                  placeholder='{"user_name": "Мария", "quote_text": "Жизнь прекрасна"}'></textarea>
                    </div>
                    <div id="test-results"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
                    <button type="button" class="btn btn-primary" onclick="testPrompt()">
                        🧪 Тестировать
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Load prompts for testing
    loadPromptsForTesting();
}

/**
 * Load prompts for testing dropdown
 */
async function loadPromptsForTesting() {
    try {
        const response = await makeAuthenticatedRequest('/prompts?limit=100');
        const select = document.getElementById('test-prompt-select');
        
        if (response.success && response.data) {
            select.innerHTML = '<option value="">Выберите промпт</option>' +
                response.data.map(prompt => 
                    `<option value="${prompt.id || prompt._id}">${prompt.name} (${prompt.category})</option>`
                ).join('');
        } else {
            select.innerHTML = '<option value="">Нет доступных промптов</option>';
        }
    } catch (error) {
        const select = document.getElementById('test-prompt-select');
        select.innerHTML = '<option value="">Ошибка загрузки промптов</option>';
    }
}

/**
 * Test prompt functionality
 */
async function testPrompt() {
    const promptSelect = document.getElementById('test-prompt-select');
    const variablesInput = document.getElementById('test-variables');
    const resultsContainer = document.getElementById('test-results');
    
    if (!promptSelect || !resultsContainer) return;

    const promptId = promptSelect.value;
    if (!promptId) {
        showError('Выберите промпт для тестирования');
        return;
    }

    let variables = {};
    try {
        if (variablesInput.value.trim()) {
            variables = JSON.parse(variablesInput.value);
        }
    } catch (error) {
        showError('Неверный формат JSON для переменных');
        return;
    }

    try {
        showLoading('test-results', 'Тестирование промпта...');

        const response = await makeAuthenticatedRequest('/prompts/test', {
            method: 'POST',
            body: JSON.stringify({
                promptId: promptId,
                variables: variables
            })
        });

        if (response.success) {
            renderTestResults(response.data);
        } else {
            throw new Error(response.error || 'Ошибка тестирования промпта');
        }
    } catch (error) {
        console.error('🤖 Ошибка тестирования промпта:', error);
        resultsContainer.innerHTML = `<div class="alert alert-danger">Ошибка: ${error.message}</div>`;
    }
}

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
        
        // Убеждаемся, что у нас есть ID
        const promptId = prompt._id || prompt.id;
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
    console.log(`🤖 Setting innerHTML...`);
    
    tableBody.innerHTML = promptsHTML;
    
    console.log('✅ Prompts rendered successfully');
    console.log('🤖 === КОНЕЦ renderPrompts ===');
}

/**
 * 🔧 ДОБАВЛЕНО: Render variables helper function
 */
function renderVariables(variables) {
    if (!variables || (Array.isArray(variables) && variables.length === 0)) {
        return '<span class="text-muted">—</span>';
    }
    
    // Если variables это строка, преобразуем в массив
    if (typeof variables === 'string') {
        variables = variables.split(',').map(v => v.trim()).filter(v => v);
    }
    
    // Если variables не массив, возвращаем пустое значение
    if (!Array.isArray(variables)) {
        return '<span class="text-muted">—</span>';
    }
    
    const visibleVariables = variables.slice(0, 2);
    const hiddenCount = variables.length - 2;
    
    let html = visibleVariables.map(variable => 
        `<span class="badge badge-secondary badge-sm">${escapeHtml(variable)}</span>`
    ).join(' ');
    
    if (hiddenCount > 0) {
        html += ` <span class="text-muted">+${hiddenCount}</span>`;
    }
    
    return html;
}

/**
 * Render prompts statistics
 */
function renderPromptsStats(stats) {
    console.log('🤖 Rendering stats:', stats);
    
    // Update main stats
    updateStatElement('total-prompts', stats.total || 0);
    updateStatElement('active-prompts', stats.active || 0);
    updateStatElement('draft-prompts', stats.draft || 0);
    updateStatElement('archived-prompts', stats.archived || 0);
    
    // Category distribution
    renderCategoryStats(stats.byCategory || []);

    // Language distribution
    renderLanguageStats(stats.byLanguage || []);

    console.log('🤖 Prompts statistics rendered successfully');
}

/**
 * Update pagination
 */
function updatePagination(pagination) {
    totalPages = pagination.totalPages || 1;
    currentPage = pagination.currentPage || 1;

    const paginationContainer = document.getElementById('pagination');
    const resultsInfo = document.getElementById('results-info');
    
    if (resultsInfo) {
        resultsInfo.textContent = `Показано ${pagination.startDoc || 1}-${pagination.endDoc || pagination.totalDocs} из ${pagination.totalDocs || 0} промптов`;
    }

    if (!paginationContainer) return;

    let paginationHTML = '';

    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<li class="page-item"><button class="page-link" onclick="changePage(${currentPage - 1})">‹ Назад</button></li>`;
    }

    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        paginationHTML += `<li class="page-item ${isActive ? 'active' : ''}">
            <button class="page-link" onclick="changePage(${i})">${i}</button>
        </li>`;
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<li class="page-item"><button class="page-link" onclick="changePage(${currentPage + 1})">Вперед ›</button></li>`;
    }

    paginationContainer.innerHTML = paginationHTML;
}

/**
 * Change page
 */
function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    loadPrompts();
}

/**
 * Utility functions
 */

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

function renderCategoryStats(categories) {
    const container = document.getElementById('category-stats');
    if (!container || !categories.length) {
        if (container) container.innerHTML = '<div class="text-muted">Нет данных</div>';
        return;
    }

    const statsHTML = categories.slice(0, 5).map(cat => `
        <div class="stat-item">
            <span class="stat-label">${getCategoryDisplayName(cat._id || cat.category)}</span>
            <span class="stat-value badge badge-secondary">${cat.count}</span>
        </div>
    `).join('');

    container.innerHTML = statsHTML;
}

function renderLanguageStats(languages) {
    const container = document.getElementById('language-stats');
    if (!container || !languages.length) {
        if (container) container.innerHTML = '<div class="text-muted">Нет данных</div>';
        return;
    }

    const statsHTML = languages.slice(0, 5).map(lang => `
        <div class="stat-item">
            <span class="stat-label">${getLanguageDisplayName(lang._id || lang.language)}</span>
            <span class="stat-value badge badge-secondary">${lang.count}</span>
        </div>
    `).join('');

    container.innerHTML = statsHTML;
}

function showLoading(containerId, message = 'Загрузка...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="text-center text-muted py-4">${message}</div>`;
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error('🤖 Error:', message);
    if (typeof showNotification === 'function') {
        showNotification('error', message);
    } else {
        alert('Ошибка: ' + message);
    }
}

function showNotification(type, message) {
    // Use existing notification system or fallback
    if (typeof window.showNotification === 'function') {
        window.showNotification(type, message);
    } else {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="close" data-dismiss="alert">&times;</button>
        `;
        
        const container = document.getElementById('notification-container') || document.body;
        container.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

/**
 * Get category display name with emoji
 */
function getCategoryDisplayName(category) {
    const categories = {
        'onboarding': '🎯 Онбординг',
        'quote_analysis': '📝 Анализ цитат',
        'weekly_reports': '📊 Еженедельные отчеты',
        'monthly_reports': '📈 Месячные отчеты',
        'book_recommendations': '📚 Рекомендации книг',
        'user_interaction': '💬 Взаимодействие',
        'system': '⚙️ Системные',
        'other': '📖 Другое'
    };
    return categories[category] || category || 'Неизвестно';
}

/**
 * Get status display name
 */
function getStatusDisplayName(status) {
    const statuses = {
        'active': 'Активный',
        'draft': 'Черновик',
        'archived': 'Архивный'
    };
    return statuses[status] || status || 'Неизвестно';
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status) {
    const classes = {
        'active': 'success',
        'draft': 'warning',
        'archived': 'secondary'
    };
    return classes[status] || 'secondary';
}

/**
 * Get priority display name
 */
function getPriorityDisplayName(priority) {
    const priorities = {
        'high': 'Высокий',
        'normal': 'Обычный',
        'low': 'Низкий'
    };
    return priorities[priority] || priority || 'Обычный';
}

/**
 * Get language display name
 */
function getLanguageDisplayName(language) {
    const languages = {
        'ru': 'Русский',
        'en': 'English',
        'none': 'Нет языка'
    };
    return languages[language] || language || 'Неизвестно';
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Prompt management functions
async function viewPrompt(promptId) {
    try {
        console.log('👁️ Просмотр промпта:', promptId);
        // Implementation for viewing prompt
        showNotification('info', 'Функция просмотра промпта будет добавлена');
    } catch (error) {
        console.error('❌ Ошибка просмотра промпта:', error);
        showError('Ошибка просмотра: ' + error.message);
    }
}

async function editPrompt(promptId) {
    try {
        console.log('✏️ Редактирование промпта:', promptId);
        // Implementation for editing prompt
        showNotification('info', 'Функция редактирования промпта будет добавлена');
    } catch (error) {
        console.error('❌ Ошибка редактирования промпта:', error);
        showError('Ошибка редактирования: ' + error.message);
    }
}

async function testPromptById(promptId) {
    try {
        console.log('🧪 Тестирование промпта:', promptId);
        showTestPromptModal();
        // Auto-select the prompt in the modal
        setTimeout(() => {
            const select = document.getElementById('test-prompt-select');
            if (select) {
                select.value = promptId;
            }
        }, 100);
    } catch (error) {
        console.error('❌ Ошибка тестирования промпта:', error);
        showError('Ошибка тестирования: ' + error.message);
    }
}

async function deletePrompt(promptId) {
    const confirmation = confirm('Вы уверены, что хотите удалить этот промпт? Это действие нельзя отменить.');
    if (!confirmation) return;
    
    try {
        console.log('🗑️ Удаление промпта:', promptId);
        
        const response = await makeAuthenticatedRequest(`/prompts/${promptId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('success', 'Промпт успешно удален');
            // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Обновляем список после удаления
            await loadPrompts();
            await loadPromptsStats();
        } else {
            throw new Error(response.error || 'Ошибка удаления');
        }
        
    } catch (error) {
        console.error('❌ Ошибка удаления промпта:', error);
        showError('Ошибка удаления: ' + error.message);
    }
}

function renderTestResults(data) {
    const container = document.getElementById('test-results');
    if (!container) return;

    const resultsHTML = `
        <div class="test-results-summary">
            <h5>Результаты тестирования промпта</h5>
            <div class="alert alert-info">
                <strong>Статус:</strong> ${data.success ? 'Успешно' : 'Ошибка'}<br>
                <strong>Время выполнения:</strong> ${data.executionTime || 'N/A'}<br>
                <strong>Обработанный промпт:</strong><br>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${escapeHtml(data.processedPrompt || '')}</pre>
            </div>
            ${data.result ? `
                <div class="alert alert-success">
                    <strong>Результат:</strong><br>
                    <pre style="background: #e8f5e8; padding: 10px; border-radius: 4px;">${escapeHtml(data.result)}</pre>
                </div>
            ` : ''}
            ${data.error ? `
                <div class="alert alert-danger">
                    <strong>Ошибка:</strong> ${escapeHtml(data.error)}
                </div>
            ` : ''}
        </div>
    `;

    container.innerHTML = resultsHTML;
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('prompts.html')) {
        initPromptsPage();
    }
});

console.log('🤖 Prompts management module loaded successfully');
