/**
 * prompts.js - управление промптами для Reader Bot с исправленной аутентификацией
 * 
 * 🔐 ИСПРАВЛЕНО: Убрана логика публичных endpoints - всегда отправляем Basic Auth
 * ✅ Полностью рабочая система управления промптами
 * ✅ Подробное логирование всех операций
 * 
 * @fileoverview Управление промптами для AI помощника Анны Бусел
 */

// Конфигурация
const API_PREFIX = '/api/reader';
const DEBUG_MODE = true; // Включить детальное логирование

// Глобальные переменные
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let searchTimeout = null;

/**
 * Логирование с префиксом
 */
function log(level, message, ...args) {
    if (!DEBUG_MODE && level === 'debug') return;
    
    const timestamp = new Date().toISOString().substr(11, 12);
    const prefix = `[${timestamp}] 💭 PROMPTS:`;
    
    switch (level) {
        case 'error':
            console.error(prefix, message, ...args);
            break;
        case 'warn':
            console.warn(prefix, message, ...args);
            break;
        case 'debug':
            console.log(prefix, '[DEBUG]', message, ...args);
            break;
        default:
            console.log(prefix, message, ...args);
    }
}

/**
 * Initialize prompts management page
 */
async function initPromptsPage() {
    log('info', 'Initializing prompts management page...');
    
    try {
        log('debug', 'Starting initialization sequence');
        
        // Проверяем наличие необходимых элементов
        const requiredElements = [
            'prompts-table',
            'search-prompts', 
            'add-prompt'
        ];
        
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        if (missingElements.length > 0) {
            throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
        }
        
        log('debug', 'Required elements found');
        
        // Загружаем данные
        log('debug', 'Loading initial data...');
        await Promise.all([
            loadPrompts(),
            loadPromptsStats()
        ]);
        
        // Настраиваем обработчики событий
        log('debug', 'Setting up event listeners...');
        setupEventListeners();
        
        log('info', '✅ Prompts page initialized successfully');
        
    } catch (error) {
        log('error', 'Failed to initialize prompts page:', error);
        showSimpleError('Ошибка инициализации страницы: ' + error.message);
    }
}

/**
 * Выполнить аутентифицированный запрос - УПРОЩЕННАЯ ВЕРСИЯ
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
    const requestId = Math.random().toString(36).substr(2, 9);
    log('debug', `[${requestId}] Starting request to: ${endpoint}`);
    
    try {
        const url = `${API_PREFIX}${endpoint}`;
        
        const headers = {
            ...options.headers
        };

        // Устанавливаем Content-Type только для не-FormData запросов
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        // ВСЕГДА добавляем аутентификацию - никаких исключений
        const token = localStorage.getItem('adminToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            log('debug', `[${requestId}] Using Bearer token: ${token.substring(0, 10)}...`);
        } else {
            // Basic Auth как основной способ
            headers['Authorization'] = 'Basic ' + btoa('admin:password123');
            log('debug', `[${requestId}] Using Basic auth: admin:password123`);
        }

        log('debug', `[${requestId}] Final headers:`, Object.keys(headers));
        log('debug', `[${requestId}] Making request to: ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers
        });

        log('debug', `[${requestId}] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            
            try {
                errorData = JSON.parse(errorText);
                log('error', `[${requestId}] Parsed error response:`, errorData);
            } catch {
                errorData = { error: errorText || `HTTP ${response.status}` };
                log('error', `[${requestId}] Raw error response: ${errorText}`);
            }
            
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();
        log('debug', `[${requestId}] Request successful, response:`, responseData);
        
        return responseData;
        
    } catch (error) {
        log('error', `[${requestId}] Request error:`, error);
        throw error;
    }
}

/**
 * Загрузить список промптов
 */
async function loadPrompts() {
    if (isLoading) {
        log('debug', 'Load prompts skipped - already loading');
        return;
    }
    
    log('debug', 'Loading prompts...');
    
    try {
        isLoading = true;
        showTableLoading('prompts-table', 'Загрузка промптов...');

        const params = new URLSearchParams({
            page: currentPage,
            limit: 10
        });

        // Добавляем фильтры
        const filters = [
            { id: 'search-prompts', param: 'q' },
            { id: 'category-filter', param: 'category' },
            { id: 'type-filter', param: 'type' },
            { id: 'language-filter', param: 'language' }
        ];

        filters.forEach(filter => {
            const element = document.getElementById(filter.id);
            if (element && element.value && element.value.trim() && element.value !== 'all') {
                params.append(filter.param, element.value.trim());
                log('debug', `Added filter ${filter.param}: ${element.value}`);
            }
        });

        log('debug', 'Request params:', params.toString());

        const response = await makeAuthenticatedRequest(`/prompts?${params}`);
        
        if (response.success) {
            log('debug', 'Prompts loaded successfully:', response.data.length);
            renderPrompts(response.data);
            
            if (response.pagination) {
                updatePagination(response.pagination);
            }
        } else {
            throw new Error(response.error || 'Не удалось загрузить промпты');
        }
        
    } catch (error) {
        log('error', 'Error loading prompts:', error);
        showSimpleError('Ошибка загрузки промптов: ' + error.message);
        showTableError('prompts-table', 'Не удалось загрузить промпты');
    } finally {
        isLoading = false;
        log('debug', 'Load prompts finished');
    }
}

/**
 * Загрузить статистику промптов
 */
async function loadPromptsStats() {
    log('debug', 'Loading prompts statistics...');
    
    try {
        const response = await makeAuthenticatedRequest('/prompts/stats');
        
        if (response.success) {
            log('debug', 'Statistics loaded successfully:', response.data);
            renderPromptsStats(response.data);
        } else {
            throw new Error(response.error || 'Не удалось загрузить статистику');
        }
        
    } catch (error) {
        log('warn', 'Error loading statistics (non-critical):', error);
        // Показываем fallback статистику
        renderPromptsStats({
            total: 0,
            by_category: [],
            by_type: [],
            by_language: [],
            error: error.message
        });
    }
}

/**
 * Настроить обработчики событий
 */
function setupEventListeners() {
    log('debug', 'Setting up event listeners...');
    
    const handlers = [
        { id: 'search-prompts', event: 'input', handler: handleSearch },
        { id: 'category-filter', event: 'change', handler: () => { currentPage = 1; loadPrompts(); } },
        { id: 'type-filter', event: 'change', handler: () => { currentPage = 1; loadPrompts(); } },
        { id: 'language-filter', event: 'change', handler: () => { currentPage = 1; loadPrompts(); } },
        { id: 'add-prompt', event: 'click', handler: () => showPromptEditor() },
        { id: 'test-prompts', event: 'click', handler: showPromptTestModal },
        { id: 'export-prompts', event: 'click', handler: () => showImportExportModal('export') },
        { id: 'import-prompts', event: 'click', handler: () => showImportExportModal('import') }
    ];

    handlers.forEach(({ id, event, handler }) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
            log('debug', `Event listener added: ${id} -> ${event}`);
        } else {
            log('warn', `Element not found for event listener: ${id}`);
        }
    });

    // Обработчик Enter для поиска
    const searchInput = document.getElementById('search-prompts');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }

    log('debug', 'Event listeners setup completed');
}

/**
 * Обработчик поиска с debounce
 */
function handleSearch() {
    log('debug', 'Search triggered');
    
    const searchInput = document.getElementById('search-prompts');
    if (!searchInput) return;

    const query = searchInput.value.trim();
    log('debug', 'Search query:', query);
    
    // Очищаем предыдущий timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Debounce поиск
    searchTimeout = setTimeout(() => {
        log('debug', 'Executing search after debounce');
        currentPage = 1;
        loadPrompts();
    }, 300);
}

/**
 * Показать редактор промпта
 */
function showPromptEditor(promptId = null) {
    log('debug', 'Opening prompt editor:', { promptId, mode: promptId ? 'edit' : 'create' });
    
    const modal = createModal('prompt-editor-modal', {
        title: promptId ? '✏️ Редактировать Промпт' : '✨ Создать Промпт',
        size: 'lg',
        body: getPromptEditorHTML(promptId),
        footer: `
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button type="button" class="btn btn-primary" onclick="savePrompt()">
                ${promptId ? '💾 Сохранить' : '✨ Создать'}
            </button>
        `
    });

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Загружаем данные промпта если редактируем
    if (promptId) {
        loadPromptForEditing(promptId);
    }
    
    // Фокус на поле названия
    setTimeout(() => {
        const nameField = document.getElementById('edit-prompt-name');
        if (nameField) nameField.focus();
    }, 100);

    log('debug', 'Prompt editor opened');
}

/**
 * Получить HTML для редактора промпта
 */
function getPromptEditorHTML(promptId) {
    return `
        <form id="prompt-editor-form">
            <input type="hidden" id="edit-prompt-id" value="${promptId || ''}">
            
            <div class="form-group">
                <label for="edit-prompt-name">Название промпта *</label>
                <input type="text" id="edit-prompt-name" class="form-control" required 
                       placeholder="Например: Анализ цитат Анны Бусел">
            </div>
            
            <div class="form-row">
                <div class="form-group col-md-6">
                    <label for="edit-prompt-category">Категория *</label>
                    <select id="edit-prompt-category" class="form-control" required>
                        <option value="system">🎯 Системная</option>
                        <option value="analysis">💭 Анализ цитат</option>
                        <option value="psychology">🧠 Психологическая</option>
                        <option value="recommendations">📚 Рекомендации</option>
                        <option value="reports">📈 Отчеты</option>
                        <option value="custom">✨ Пользовательская</option>
                    </select>
                </div>
                <div class="form-group col-md-6">
                    <label for="edit-prompt-type">Тип *</label>
                    <select id="edit-prompt-type" class="form-control" required>
                        <option value="basic">Базовый</option>
                        <option value="rag">RAG</option>
                        <option value="quote_analysis">Анализ цитат</option>
                        <option value="book_recommendation">Рекомендации книг</option>
                        <option value="weekly_report">Еженедельные отчеты</option>
                        <option value="monthly_report">Месячные отчеты</option>
                        <option value="onboarding">Онбординг</option>
                    </select>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group col-md-6">
                    <label for="edit-prompt-language">Язык</label>
                    <select id="edit-prompt-language" class="form-control">
                        <option value="none">🤖 Универсальный</option>
                        <option value="ru">🇷🇺 Русский</option>
                        <option value="en">🇺🇸 English</option>
                    </select>
                </div>
                <div class="form-group col-md-6">
                    <label for="edit-prompt-max-tokens">Макс. токены</label>
                    <input type="number" id="edit-prompt-max-tokens" class="form-control" 
                           min="100" max="4000" value="1000">
                </div>
            </div>
            
            <div class="form-group">
                <label for="edit-prompt-description">Описание</label>
                <input type="text" id="edit-prompt-description" class="form-control" 
                       placeholder="Краткое описание назначения промпта">
            </div>
            
            <div class="form-group">
                <label for="edit-prompt-content">Содержимое промпта *</label>
                <textarea id="edit-prompt-content" class="form-control" rows="10" required
                          placeholder="Ты - психолог Анна Бусел, создатель проекта 'Читатель'..."></textarea>
                <small class="form-text text-muted">
                    💡 Используйте переменные: {quote_text}, {quote_author}, {user_profile}, {user_name}
                </small>
                <div id="token-counter" class="text-muted mt-1"></div>
            </div>
            
            <div class="form-group">
                <label for="edit-prompt-tags">Теги (через запятую)</label>
                <input type="text" id="edit-prompt-tags" class="form-control" 
                       placeholder="анна бусел, читатель, психология, книги">
            </div>
        </form>
    `;
}

/**
 * Загрузить промпт для редактирования
 */
async function loadPromptForEditing(promptId) {
    log('debug', 'Loading prompt for editing:', promptId);
    
    try {
        const response = await makeAuthenticatedRequest(`/prompts/${promptId}`);
        
        if (response.success && response.data) {
            const prompt = response.data;
            log('debug', 'Prompt data loaded:', prompt);
            
            // Заполняем форму
            const fields = [
                { id: 'edit-prompt-name', value: prompt.name || '' },
                { id: 'edit-prompt-category', value: prompt.category || 'custom' },
                { id: 'edit-prompt-type', value: prompt.type || 'basic' },
                { id: 'edit-prompt-language', value: prompt.language || 'none' },
                { id: 'edit-prompt-max-tokens', value: prompt.maxTokens || 1000 },
                { id: 'edit-prompt-description', value: prompt.description || '' },
                { id: 'edit-prompt-content', value: prompt.content || '' },
                { id: 'edit-prompt-tags', value: prompt.tags ? prompt.tags.join(', ') : '' }
            ];

            fields.forEach(field => {
                const element = document.getElementById(field.id);
                if (element) {
                    element.value = field.value;
                    log('debug', `Set field ${field.id}:`, field.value);
                } else {
                    log('warn', `Field not found: ${field.id}`);
                }
            });
            
            updateTokenCount();
            
        } else {
            throw new Error(response.error || 'Не удалось загрузить промпт');
        }
        
    } catch (error) {
        log('error', 'Error loading prompt for editing:', error);
        showSimpleError('Ошибка загрузки промпта: ' + error.message);
    }
}

/**
 * Сохранить промпт
 */
async function savePrompt() {
    log('debug', 'Saving prompt...');
    
    const promptId = document.getElementById('edit-prompt-id').value;
    
    const promptData = {
        name: getValue('edit-prompt-name'),
        category: getValue('edit-prompt-category'),
        type: getValue('edit-prompt-type'),
        language: getValue('edit-prompt-language') || 'none',
        maxTokens: parseInt(getValue('edit-prompt-max-tokens')) || 1000,
        description: getValue('edit-prompt-description'),
        content: getValue('edit-prompt-content'),
        tags: getValue('edit-prompt-tags')
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag)
    };
    
    log('debug', 'Prompt data to save:', promptData);
    
    // Валидация
    if (!promptData.name) {
        showSimpleError('Заполните название промпта');
        return;
    }
    
    if (!promptData.content) {
        showSimpleError('Заполните содержимое промпта');
        return;
    }
    
    try {
        let response;
        
        if (promptId) {
            log('debug', 'Updating existing prompt:', promptId);
            response = await makeAuthenticatedRequest(`/prompts/${promptId}`, {
                method: 'PUT',
                body: JSON.stringify(promptData)
            });
        } else {
            log('debug', 'Creating new prompt');
            response = await makeAuthenticatedRequest('/prompts', {
                method: 'POST',
                body: JSON.stringify(promptData)
            });
        }
        
        if (response.success) {
            const action = promptId ? 'обновлен' : 'создан';
            log('info', `Prompt ${action} successfully:`, response.data);
            showSimpleSuccess(`Промпт успешно ${action}!`);
            
            closeModal();
            loadPrompts();
            
        } else {
            throw new Error(response.error || 'Не удалось сохранить промпт');
        }
        
    } catch (error) {
        log('error', 'Error saving prompt:', error);
        showSimpleError('Ошибка сохранения промпта: ' + error.message);
    }
}

/**
 * Обновить счетчик токенов
 */
function updateTokenCount() {
    const contentTextarea = document.getElementById('edit-prompt-content');
    const counter = document.getElementById('token-counter');
    
    if (!contentTextarea || !counter) return;
    
    const content = contentTextarea.value;
    const estimatedTokens = Math.ceil(content.length / 4);
    
    counter.textContent = `Примерно ${estimatedTokens} токенов`;
    
    if (estimatedTokens > 3000) {
        counter.className = 'text-danger mt-1';
    } else if (estimatedTokens > 2000) {
        counter.className = 'text-warning mt-1';
    } else {
        counter.className = 'text-muted mt-1';
    }
}

/**
 * Показать модальное окно тестирования
 */
function showPromptTestModal() {
    log('debug', 'Opening prompt test modal');
    
    const modal = createModal('prompt-test-modal', {
        title: '🧪 Тестирование Промпта',
        size: 'lg',
        body: `
            <div class="form-group">
                <label for="test-prompt-message">Тестовое сообщение</label>
                <textarea id="test-prompt-message" class="form-control" rows="3"
                          placeholder="Введите цитату для тестирования, например: 'В каждом слове — целая жизнь (Марина Цветаева)'"></textarea>
            </div>
            <div class="form-row">
                <div class="form-group col-md-6">
                    <label for="test-prompt-language">Язык</label>
                    <select id="test-prompt-language" class="form-control">
                        <option value="none">🤖 Универсальный</option>
                        <option value="ru" selected>🇷🇺 Русский</option>
                        <option value="en">🇺🇸 English</option>
                    </select>
                </div>
            </div>
            <div id="test-prompt-results"></div>
        `,
        footer: `
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
            <button type="button" class="btn btn-primary" onclick="runPromptTest()">
                🚀 Выполнить Тест
            </button>
        `
    });

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Фокус на поле сообщения
    setTimeout(() => {
        const messageField = document.getElementById('test-prompt-message');
        if (messageField) messageField.focus();
    }, 100);

    log('debug', 'Prompt test modal opened');
}

/**
 * Выполнить тест промпта
 */
async function runPromptTest() {
    log('debug', 'Running prompt test...');
    
    const messageInput = document.getElementById('test-prompt-message');
    const languageSelect = document.getElementById('test-prompt-language');
    const resultsDiv = document.getElementById('test-prompt-results');
    
    if (!messageInput || !resultsDiv) {
        log('error', 'Test elements not found');
        return;
    }
    
    const testMessage = messageInput.value.trim();
    const language = languageSelect?.value || 'ru';
    
    if (!testMessage) {
        showSimpleError('Введите тестовое сообщение');
        return;
    }
    
    // Получаем содержимое промпта
    let promptContent = '';
    const promptEditor = document.getElementById('edit-prompt-content');
    if (promptEditor) {
        promptContent = promptEditor.value.trim();
    }
    
    if (!promptContent) {
        showSimpleError('Нет промпта для тестирования');
        return;
    }
    
    log('debug', 'Test parameters:', { testMessage, language, promptLength: promptContent.length });
    
    try {
        resultsDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Тестирование...</div>';
        
        const response = await makeAuthenticatedRequest('/prompts/test', {
            method: 'POST',
            body: JSON.stringify({
                prompt: promptContent,
                testMessage,
                language
            })
        });
        
        if (response.success && response.data) {
            const result = response.data;
            log('debug', 'Test result received:', result);
            
            resultsDiv.innerHTML = `
                <div class="alert alert-success">
                    <h5>📋 Результат тестирования</h5>
                    <p><strong>Входное сообщение:</strong> ${escapeHtml(result.input)}</p>
                    <p><strong>Ответ от Claude:</strong></p>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-top: 0.5rem;">
                        ${escapeHtml(result.output)}
                    </div>
                </div>
            `;
        } else {
            throw new Error(response.error || 'Не удалось выполнить тест');
        }
        
    } catch (error) {
        log('error', 'Test error:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5>⚠️ Ошибка тестирования</h5>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

/**
 * Показать модальное окно импорта/экспорта
 */
function showImportExportModal(mode) {
    log('debug', 'Opening import/export modal:', mode);
    
    const modal = createModal('import-export-modal', {
        title: mode === 'export' ? '📤 Экспорт Промптов' : '📥 Импорт Промптов',
        body: mode === 'export' ? `
            <p>Экспорт всех промптов в файл JSON для резервного копирования.</p>
            <button class="btn btn-primary" onclick="downloadPromptsBackup()">
                💾 Скачать Резервную Копию
            </button>
        ` : `
            <p>Импорт промптов из JSON файла.</p>
            <div class="form-group">
                <input type="file" id="import-prompts-file" accept=".json" class="form-control">
            </div>
            <button class="btn btn-primary" onclick="importPrompts()">
                📥 Импортировать
            </button>
        `,
        footer: `
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
        `
    });

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    log('debug', 'Import/export modal opened');
}

/**
 * Скачать резервную копию промптов
 */
async function downloadPromptsBackup() {
    log('debug', 'Downloading prompts backup...');
    
    try {
        const response = await makeAuthenticatedRequest('/prompts/backup');
        
        if (response) {
            const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reader-prompts-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            log('info', 'Backup downloaded successfully');
            showSimpleSuccess('Резервная копия промптов скачана!');
        }
        
    } catch (error) {
        log('error', 'Backup error:', error);
        showSimpleError('Ошибка создания резервной копии: ' + error.message);
    }
}

/**
 * Импортировать промпты из файла
 */
async function importPrompts() {
    log('debug', 'Importing prompts...');
    
    const fileInput = document.getElementById('import-prompts-file');
    const file = fileInput?.files[0];
    
    if (!file) {
        showSimpleError('Выберите файл для импорта');
        return;
    }
    
    try {
        const text = await file.text();
        const backup = JSON.parse(text);
        
        log('debug', 'Backup file parsed, importing...');
        
        const response = await makeAuthenticatedRequest('/prompts/restore', {
            method: 'POST',
            body: JSON.stringify({ backup })
        });
        
        if (response.success) {
            log('info', 'Prompts imported successfully');
            showSimpleSuccess('Промпты успешно импортированы!');
            closeModal();
            loadPrompts();
        } else {
            throw new Error(response.error || 'Не удалось импортировать промпты');
        }
        
    } catch (error) {
        log('error', 'Import error:', error);
        showSimpleError('Ошибка импорта: ' + error.message);
    }
}

/**
 * Отрендерить таблицу промптов
 */
function renderPrompts(prompts) {
    log('debug', 'Rendering prompts table:', prompts.length);
    
    const tableBody = document.querySelector('#prompts-table tbody');
    const emptyState = document.getElementById('empty-state');
    
    if (!tableBody) {
        log('error', 'Prompts table body not found');
        return;
    }

    if (!prompts || prompts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Промпты не найдены</td></tr>';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const promptsHTML = prompts.map(prompt => {
        const promptId = prompt.id || prompt._id;
        return `
            <tr data-id="${promptId}">
                <td class="col-id">${(promptId || '').substring(0, 8)}...</td>
                <td class="col-name">
                    <div class="prompt-name">${escapeHtml(prompt.name)}</div>
                    ${prompt.isDefault ? '<span class="badge badge-warning">Системный</span>' : ''}
                </td>
                <td class="col-category">
                    <span class="badge badge-primary">${getCategoryLabel(prompt.category)}</span>
                </td>
                <td class="col-type">
                    <span class="badge badge-info">${getTypeLabel(prompt.type)}</span>
                </td>
                <td class="col-language">
                    <span class="badge badge-secondary">${getLanguageLabel(prompt.language)}</span>
                </td>
                <td class="col-status">
                    <span class="badge badge-${prompt.active !== false ? 'success' : 'warning'}">
                        ${prompt.active !== false ? 'Активный' : 'Неактивный'}
                    </span>
                </td>
                <td class="col-tokens">${prompt.maxTokens || '--'}</td>
                <td class="col-version">v${prompt.version || '1.0'}</td>
                <td class="col-actions">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="viewPrompt('${promptId}')" title="Просмотр">
                            👁️
                        </button>
                        <button class="btn btn-outline-secondary" onclick="editPrompt('${promptId}')" title="Редактировать">
                            ✏️
                        </button>
                        ${!prompt.isDefault ? `
                            <button class="btn btn-outline-danger" onclick="deletePrompt('${promptId}')" title="Удалить">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tableBody.innerHTML = promptsHTML;
    log('debug', 'Prompts table rendered successfully');
}

/**
 * Отрендерить статистику промптов
 */
function renderPromptsStats(stats) {
    log('debug', 'Rendering prompts stats:', stats);
    // Здесь можно добавить отображение статистики если нужно
}

/**
 * Обновить пагинацию
 */
function updatePagination(pagination) {
    log('debug', 'Updating pagination:', pagination);
    
    totalPages = pagination.totalPages || 1;
    currentPage = pagination.currentPage || 1;

    const paginationInfo = document.querySelector('.pagination-info');
    if (paginationInfo) {
        paginationInfo.innerHTML = `Показано ${pagination.startDoc || 1}-${pagination.endDoc || pagination.totalDocs} из ${pagination.totalDocs || 0} промптов`;
    }

    // Обновляем кнопки пагинации
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const currentSpan = document.getElementById('pagination-current');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (currentSpan) currentSpan.textContent = `Страница ${currentPage} из ${totalPages}`;
}

/**
 * Изменить страницу
 */
function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    log('debug', 'Changing page to:', page);
    currentPage = page;
    loadPrompts();
}

/**
 * Просмотреть промпт
 */
function viewPrompt(promptId) {
    log('debug', 'Viewing prompt:', promptId);
    editPrompt(promptId);
}

/**
 * Редактировать промпт
 */
function editPrompt(promptId) {
    log('debug', 'Editing prompt:', promptId);
    showPromptEditor(promptId);
}

/**
 * Удалить промпт
 */
async function deletePrompt(promptId) {
    log('debug', 'Deleting prompt:', promptId);
    
    const confirmed = confirm('Вы уверены, что хотите удалить этот промпт?');
    if (!confirmed) return;
    
    try {
        const response = await makeAuthenticatedRequest(`/prompts/${promptId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            log('info', 'Prompt deleted successfully:', promptId);
            showSimpleSuccess('Промпт удален');
            loadPrompts();
        } else {
            throw new Error(response.error || 'Не удалось удалить промпт');
        }
        
    } catch (error) {
        log('error', 'Delete error:', error);
        showSimpleError('Ошибка удаления промпта: ' + error.message);
    }
}

// ================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================

/**
 * Создать модальное окно
 */
function createModal(id, { title, body, footer, size = '' }) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = id;
    modal.innerHTML = `
        <div class="modal-dialog ${size ? 'modal-' + size : ''}">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        </div>
    `;
    return modal;
}

/**
 * Закрыть модальное окно
 */
function closeModal() {
    log('debug', 'Closing modal');
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Получить значение поля формы
 */
function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : '';
}

/**
 * Показать загрузку в таблице
 */
function showTableLoading(tableId, message = 'Загрузка...') {
    const table = document.getElementById(tableId);
    if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">${message}</td></tr>`;
        }
    }
}

/**
 * Показать ошибку в таблице
 */
function showTableError(tableId, message) {
    const table = document.getElementById(tableId);
    if (table) {
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger py-4">${message}</td></tr>`;
        }
    }
}

/**
 * Безопасное экранирование HTML
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Простое показ ошибки
 */
function showSimpleError(message) {
    log('error', 'Showing error:', message);
    alert('Ошибка: ' + message);
}

/**
 * Простой показ успеха
 */
function showSimpleSuccess(message) {
    log('info', 'Showing success:', message);
    // Можно заменить на toast уведомление
    alert(message);
}

/**
 * Получить лейбл категории
 */
function getCategoryLabel(category) {
    const labels = {
        'system': '🎯 Системная',
        'analysis': '💭 Анализ',
        'psychology': '🧠 Психология',
        'recommendations': '📚 Рекомендации',
        'reports': '📈 Отчеты',
        'custom': '✨ Пользовательская'
    };
    return labels[category] || category;
}

/**
 * Получить лейбл типа
 */
function getTypeLabel(type) {
    const labels = {
        'basic': 'Базовый',
        'rag': 'RAG',
        'quote_analysis': 'Анализ цитат',
        'book_recommendation': 'Рекомендации книг',
        'weekly_report': 'Еженедельные отчеты',
        'monthly_report': 'Месячные отчеты',
        'onboarding': 'Онбординг'
    };
    return labels[type] || type;
}

/**
 * Получить лейбл языка
 */
function getLanguageLabel(language) {
    const labels = {
        'none': '🤖 Универсальный',
        'ru': '🇷🇺 Русский',
        'en': '🇺🇸 English'
    };
    return labels[language] || language;
}

// ================================
// ИНИЦИАЛИЗАЦИЯ
// ================================

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('prompts.html')) {
        log('info', 'DOM loaded, initializing prompts page...');
        initPromptsPage();
    }
});

// Экспорт функций для использования в HTML
window.initPromptsPage = initPromptsPage;
window.showPromptEditor = showPromptEditor;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.viewPrompt = viewPrompt;
window.savePrompt = savePrompt;
window.runPromptTest = runPromptTest;
window.downloadPromptsBackup = downloadPromptsBackup;
window.importPrompts = importPrompts;
window.closeModal = closeModal;
window.changePage = changePage;

log('info', '💭 Prompts.js loaded with ALWAYS AUTH - no public endpoints logic');
