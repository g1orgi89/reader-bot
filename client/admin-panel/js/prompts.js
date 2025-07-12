/**
 * Prompts Management JavaScript for Reader Bot - MINIMAL VERSION
 * @file client/admin-panel/js/prompts.js
 * 🔧 УПРОЩЕННАЯ ВЕРСИЯ для быстрого исправления проблемы с отображением
 */

// API configuration
const API_PREFIX = '/api/reader';

// Global variables
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

/**
 * Initialize prompts management page
 */
async function initPromptsPage() {
    console.log('🤖 Initializing prompts management page...');
    
    try {
        await loadPrompts();
        setupEventListeners();
        console.log('✅ Prompts page initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize prompts page:', error);
    }
}

/**
 * Make authenticated request
 */
async function makeAuthenticatedRequest(endpoint, options = {}) {
    try {
        const url = `${API_PREFIX}${endpoint}`;
        
        const headers = {
            ...options.headers
        };

        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const token = localStorage.getItem('adminToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
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
            throw new Error(errorText || `HTTP ${response.status}`);
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
        
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10
        });

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
        }
        console.log('🔍 === КОНЕЦ АНАЛИЗА ОТВЕТА ===');
        
        if (response.success) {
            renderPrompts(response.data || []);
        } else {
            throw new Error(response.error || 'Не удалось загрузить промпты');
        }
    } catch (error) {
        console.error('🤖 Ошибка загрузки промптов:', error);
        const tableBody = document.querySelector('#prompts-table tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Не удалось загрузить промпты</td></tr>';
        }
    } finally {
        isLoading = false;
    }
}

/**
 * 🔧 ИСПРАВЛЕННАЯ ФУНКЦИЯ: Render prompts list
 */
function renderPrompts(prompts) {
    console.log('🤖 === НАЧАЛО renderPrompts ===');
    console.log('🤖 Rendering prompts:', prompts);
    console.log(`🤖 Rendering ${prompts ? prompts.length : 0} prompts`);
    
    const tableBody = document.querySelector('#prompts-table tbody');
    
    if (!tableBody) {
        console.error('🤖 Table body not found!');
        return;
    }

    // Проверяем наличие промптов
    if (!prompts || prompts.length === 0) {
        console.log('🤖 No prompts to display');
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Промпты не найдены</td></tr>';
        return;
    }

    console.log(`🤖 Rendering ${prompts.length} prompts`);

    // 🔧 ГЛАВНОЕ ИСПРАВЛЕНИЕ: Сервер возвращает поле 'id', а не '_id'
    const promptsHTML = prompts.map((prompt, index) => {
        console.log(`🤖 Rendering prompt ${index}:`, prompt.name, prompt.category);
        
        // 🔧 ИСПРАВЛЕНО: Сначала проверяем 'id', потом '_id'
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

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // New prompt button
    const newPromptButton = document.getElementById('new-prompt-btn');
    if (newPromptButton) {
        newPromptButton.addEventListener('click', () => {
            alert('Функция создания промпта будет добавлена позже');
        });
    }
    
    console.log('🤖 Event listeners setup completed');
}

/**
 * Helper functions
 */
function renderVariables(variables) {
    if (!variables || (Array.isArray(variables) && variables.length === 0)) {
        return '<span class="text-muted">—</span>';
    }
    
    if (typeof variables === 'string') {
        variables = variables.split(',').map(v => v.trim()).filter(v => v);
    }
    
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

function getStatusDisplayName(status) {
    const statuses = {
        'active': 'Активный',
        'draft': 'Черновик',
        'archived': 'Архивный'
    };
    return statuses[status] || status || 'Неизвестно';
}

function getStatusBadgeClass(status) {
    const classes = {
        'active': 'success',
        'draft': 'warning',
        'archived': 'secondary'
    };
    return classes[status] || 'secondary';
}

function getPriorityDisplayName(priority) {
    const priorities = {
        'high': 'Высокий',
        'normal': 'Обычный',
        'low': 'Низкий'
    };
    return priorities[priority] || priority || 'Обычный';
}

function getLanguageDisplayName(language) {
    const languages = {
        'ru': 'Русский',
        'en': 'English',
        'none': 'Нет языка'
    };
    return languages[language] || language || 'Неизвестно';
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Placeholder functions for actions
function viewPrompt(promptId) {
    console.log('👁️ Просмотр промпта:', promptId);
    alert('Функция просмотра будет добавлена позже');
}

function editPrompt(promptId) {
    console.log('✏️ Редактирование промпта:', promptId);
    alert('Функция редактирования будет добавлена позже');
}

function testPromptById(promptId) {
    console.log('🧪 Тестирование промпта:', promptId);
    alert('Функция тестирования будет добавлена позже');
}

function deletePrompt(promptId) {
    console.log('🗑️ Удаление промпта:', promptId);
    if (confirm('Удалить этот промпт?')) {
        alert('Функция удаления будет добавлена позже');
    }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('prompts.html')) {
        initPromptsPage();
    }
});

console.log('🤖 Minimal prompts management module loaded successfully');
