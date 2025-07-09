/**
 * Knowledge Management JavaScript
 * @file client/admin-panel/js/knowledge.js
 * 📖 ИСПРАВЛЕНО: Убрана аутентификация для базовых endpoints + правильный API prefix
 */

// API configuration - использование правильного prefix
const API_PREFIX = '/api/reader'; // 📖 Правильный prefix для Reader Bot

// Global variables
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let searchTimeout = null;

/**
 * Initialize knowledge management page
 */
async function initKnowledgePage() {
    console.log('📖 Initializing knowledge management page...');
    
    try {
        // Load initial data
        await loadDocuments();
        await loadRAGStats();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('✅ Knowledge page initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize knowledge page:', error);
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
        
        // Базовые endpoints больше не требуют аутентификации
        const isPublicEndpoint = endpoint.includes('/knowledge') && 
                                 !endpoint.includes('/diagnose') && 
                                 !endpoint.includes('/vector-search') && 
                                 !endpoint.includes('/test-search') && 
                                 !endpoint.includes('/sync-vector-store') &&
                                 !options.method || options.method === 'GET';

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Добавляем аутентификацию только для приватных endpoints
        if (!isPublicEndpoint) {
            const token = localStorage.getItem('adminToken');
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            } else {
                // Fallback на Basic Auth
                headers['Authorization'] = 'Basic ' + btoa('admin:password123');
            }
        }

        console.log(`📖 Making request to: ${url}`);
        
        const response = await fetch(url, {
            ...options,
            headers
        });

        console.log(`📖 Response status: ${response.status}`);

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
        console.error('📖 Request failed:', error);
        throw error;
    }
}

/**
 * Load documents with pagination
 */
async function loadDocuments() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading('document-list', 'Загрузка документов...');

        const params = new URLSearchParams({
            page: currentPage,
            limit: 10
        });

        // Add search filter if exists
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value.trim()) {
            params.append('q', searchInput.value.trim());
        }

        const response = await makeAuthenticatedRequest(`/knowledge?${params}`);
        
        if (response.success) {
            renderDocuments(response.data);
            
            if (response.pagination) {
                updatePagination(response.pagination);
            }
        } else {
            throw new Error(response.error || 'Не удалось загрузить документы');
        }
    } catch (error) {
        console.error('📖 Ошибка загрузки документов:', error);
        showError('Ошибка загрузки документов: ' + error.message);
        document.getElementById('document-list').innerHTML = 
            '<div class="no-data">Не удалось загрузить документы</div>';
    } finally {
        isLoading = false;
    }
}

/**
 * Load RAG statistics
 */
async function loadRAGStats() {
    try {
        console.log('📖 Loading RAG statistics...');
        const response = await makeAuthenticatedRequest('/knowledge/stats');
        
        if (response.success) {
            renderRAGStats(response.data);
            console.log('✅ RAG statistics loaded successfully');
        } else {
            throw new Error(response.error || 'Не удалось загрузить статистику');
        }
    } catch (error) {
        console.error('📖 Ошибка загрузки статистики RAG:', error);
        // Показываем fallback статистику
        renderRAGStats({
            total: 0,
            published: 0,
            draft: 0,
            byLanguage: [],
            byCategory: [],
            recentlyUpdated: [],
            chunkingEnabled: false,
            vectorStore: { status: 'unknown', totalVectors: 0 },
            universalSearch: true,
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

    // Add document button
    const addDocButton = document.getElementById('add-document-btn');
    if (addDocButton) {
        addDocButton.addEventListener('click', showAddDocumentModal);
    }

    // Refresh button
    const refreshButton = document.getElementById('refresh-btn');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            currentPage = 1;
            loadDocuments();
            loadRAGStats();
        });
    }

    // Test search button
    const testSearchBtn = document.getElementById('test-search-btn');
    if (testSearchBtn) {
        testSearchBtn.addEventListener('click', showTestSearchModal);
    }

    // Sync vector store button
    const syncVectorBtn = document.getElementById('sync-vector-btn');
    if (syncVectorBtn) {
        syncVectorBtn.addEventListener('click', syncVectorStore);
    }

    // Diagnose button
    const diagnoseBtn = document.getElementById('diagnose-btn');
    if (diagnoseBtn) {
        diagnoseBtn.addEventListener('click', runDiagnostics);
    }

    console.log('📖 Event listeners setup completed');
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
        if (query.length === 0) {
            // Reset to show all documents
            currentPage = 1;
            loadDocuments();
        } else if (query.length >= 2) {
            // Search with query
            searchDocuments(query);
        }
    }, 300);
}

/**
 * Search documents
 */
async function searchDocuments(query) {
    try {
        isLoading = true;
        showLoading('document-list', 'Поиск документов...');

        const params = new URLSearchParams({
            q: query,
            limit: 10,
            page: 1
        });

        const response = await makeAuthenticatedRequest(`/knowledge/search?${params}`);
        
        if (response.success) {
            renderDocuments(response.data, true, query);
            updateSearchResults(response.count, query);
        } else {
            throw new Error(response.error || 'Ошибка поиска');
        }
    } catch (error) {
        console.error('📖 Ошибка поиска:', error);
        showError('Ошибка поиска: ' + error.message);
    } finally {
        isLoading = false;
    }
}

/**
 * Render documents list
 */
function renderDocuments(documents, isSearchResult = false, searchQuery = '') {
    const container = document.getElementById('document-list');
    if (!container) return;

    if (!documents || documents.length === 0) {
        container.innerHTML = isSearchResult ? 
            `<div class="no-data">Документы по запросу "${searchQuery}" не найдены</div>` :
            '<div class="no-data">Документы не найдены</div>';
        return;
    }

    const documentsHTML = documents.map(doc => `
        <div class="document-card" data-id="${doc._id || doc.id}">
            <div class="document-header">
                <h4 class="document-title">${escapeHtml(doc.title)}</h4>
                <div class="document-actions">
                    <button class="btn btn-sm btn-outline" onclick="viewDocument('${doc._id || doc.id}')">
                        👁️ Просмотр
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="editDocument('${doc._id || doc.id}')">
                        ✏️ Редактировать
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDocument('${doc._id || doc.id}')">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
            <div class="document-meta">
                <span class="badge badge-primary">${escapeHtml(doc.category || 'Без категории')}</span>
                <span class="badge badge-secondary">${escapeHtml(doc.language || 'auto')}</span>
                ${doc.status ? `<span class="badge badge-${doc.status === 'published' ? 'success' : 'warning'}">${doc.status}</span>` : ''}
                ${isSearchResult && doc.score ? `<span class="badge badge-info">Релевантность: ${(doc.score * 100).toFixed(1)}%</span>` : ''}
            </div>
            <div class="document-content">
                ${escapeHtml((doc.content || '').substring(0, 200))}${(doc.content || '').length > 200 ? '...' : ''}
            </div>
            <div class="document-footer">
                <small class="text-muted">
                    ${doc.tags && doc.tags.length > 0 ? `Теги: ${doc.tags.map(tag => escapeHtml(tag)).join(', ')}` : 'Без тегов'}
                </small>
                <small class="text-muted">
                    Обновлено: ${new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('ru-RU')}
                </small>
            </div>
        </div>
    `).join('');

    container.innerHTML = documentsHTML;
}

/**
 * Render RAG statistics
 */
function renderRAGStats(stats) {
    // Update main stats
    updateStatElement('total-documents', stats.total || 0);
    updateStatElement('published-documents', stats.published || 0);
    updateStatElement('draft-documents', stats.draft || 0);
    
    // Vector store stats
    if (stats.vectorStore) {
        updateStatElement('vector-documents', stats.vectorStore.documentsCount || 0);
        updateStatElement('vector-chunks', stats.vectorStore.chunksCount || 0);
        
        const statusElement = document.getElementById('vector-status');
        if (statusElement) {
            const status = stats.vectorStore.status || 'unknown';
            statusElement.textContent = getVectorStatusText(status);
            statusElement.className = `status status-${status}`;
        }
    }

    // Chunking status
    const chunkingElement = document.getElementById('chunking-status');
    if (chunkingElement) {
        const isEnabled = stats.chunkingEnabled || false;
        chunkingElement.textContent = isEnabled ? 'Включен' : 'Выключен';
        chunkingElement.className = `status status-${isEnabled ? 'ok' : 'warning'}`;
    }

    // Language distribution
    renderLanguageStats(stats.byLanguage || []);

    // Category distribution  
    renderCategoryStats(stats.byCategory || []);

    // Recent updates
    renderRecentUpdates(stats.recentlyUpdated || []);

    // Error indicator
    if (stats.error) {
        showWarning(`Частичная ошибка статистики: ${stats.error}`);
    }

    console.log('📖 RAG statistics rendered successfully');
}

/**
 * Update pagination
 */
function updatePagination(pagination) {
    totalPages = pagination.totalPages || 1;
    currentPage = pagination.currentPage || 1;

    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;

    let paginationHTML = '';

    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button class="btn btn-sm btn-outline" onclick="changePage(${currentPage - 1})">← Предыдущая</button>`;
    }

    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        paginationHTML += `<button class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}" 
                          onclick="changePage(${i})" ${isActive ? 'disabled' : ''}>${i}</button>`;
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button class="btn btn-sm btn-outline" onclick="changePage(${currentPage + 1})">Следующая →</button>`;
    }

    paginationContainer.innerHTML = paginationHTML;
}

/**
 * Change page
 */
function changePage(page) {
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    loadDocuments();
}

/**
 * Test search functionality
 */
async function testSearch() {
    const modal = document.getElementById('test-search-modal');
    const queryInput = document.getElementById('test-query');
    const resultsContainer = document.getElementById('test-results');
    
    if (!queryInput || !resultsContainer) return;

    const query = queryInput.value.trim();
    if (!query) {
        showError('Введите поисковый запрос');
        return;
    }

    try {
        showLoading('test-results', 'Выполняется тестовый поиск...');

        const response = await makeAuthenticatedRequest('/knowledge/test-search', {
            method: 'POST',
            body: JSON.stringify({
                query: query,
                limit: 5,
                returnChunks: true
            })
        });

        if (response.success) {
            renderTestResults(response.data);
        } else {
            throw new Error(response.error || 'Ошибка тестового поиска');
        }
    } catch (error) {
        console.error('📖 Ошибка тестового поиска:', error);
        resultsContainer.innerHTML = `<div class="alert alert-danger">Ошибка: ${error.message}</div>`;
    }
}

/**
 * Sync vector store
 */
async function syncVectorStore() {
    const confirmation = confirm('Это может занять несколько минут. Продолжить синхронизацию векторного хранилища?');
    if (!confirmation) return;

    try {
        showNotification('info', 'Начинается синхронизация векторного хранилища...');

        const response = await makeAuthenticatedRequest('/knowledge/sync-vector-store', {
            method: 'POST',
            body: JSON.stringify({
                enableChunking: true,
                chunkSize: 500,
                overlap: 100
            })
        });

        if (response.success) {
            showNotification('success', `Синхронизация завершена: ${response.processed}/${response.totalDocuments} документов обработано`);
            await loadRAGStats(); // Обновляем статистику
        } else {
            throw new Error(response.error || 'Ошибка синхронизации');
        }
    } catch (error) {
        console.error('📖 Ошибка синхронизации:', error);
        showError('Ошибка синхронизации: ' + error.message);
    }
}

/**
 * Run diagnostics
 */
async function runDiagnostics() {
    try {
        showNotification('info', 'Выполняется диагностика системы...');

        const response = await makeAuthenticatedRequest('/knowledge/diagnose');

        if (response.success) {
            renderDiagnostics(response);
            showNotification('success', 'Диагностика завершена успешно');
        } else {
            throw new Error(response.error || 'Ошибка диагностики');
        }
    } catch (error) {
        console.error('📖 Ошибка диагностики:', error);
        showError('Ошибка диагностики: ' + error.message);
    }
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

function getVectorStatusText(status) {
    const statusMap = {
        'ok': 'Активен',
        'connected': 'Подключен',
        'error': 'Ошибка',
        'disconnected': 'Отключен',
        'unknown': 'Неизвестно'
    };
    return statusMap[status] || status;
}

function renderLanguageStats(languages) {
    const container = document.getElementById('language-stats');
    if (!container || !languages.length) return;

    const statsHTML = languages.slice(0, 5).map(lang => `
        <div class="stat-item">
            <span class="stat-label">${escapeHtml(lang._id || 'Неизвестно')}</span>
            <span class="stat-value">${lang.count}</span>
        </div>
    `).join('');

    container.innerHTML = statsHTML;
}

function renderCategoryStats(categories) {
    const container = document.getElementById('category-stats');
    if (!container || !categories.length) return;

    const statsHTML = categories.slice(0, 5).map(cat => `
        <div class="stat-item">
            <span class="stat-label">${escapeHtml(cat._id || 'Без категории')}</span>
            <span class="stat-value">${cat.count}</span>
        </div>
    `).join('');

    container.innerHTML = statsHTML;
}

function renderRecentUpdates(updates) {
    const container = document.getElementById('recent-updates');
    if (!container) return;

    if (!updates.length) {
        container.innerHTML = '<div class="no-data">Нет недавних обновлений</div>';
        return;
    }

    const updatesHTML = updates.map(doc => `
        <div class="recent-item">
            <div class="recent-title">${escapeHtml(doc.title)}</div>
            <div class="recent-meta">
                <span class="badge badge-primary">${escapeHtml(doc.category)}</span>
                <small class="text-muted">${new Date(doc.updatedAt).toLocaleDateString('ru-RU')}</small>
            </div>
        </div>
    `).join('');

    container.innerHTML = updatesHTML;
}

function showLoading(containerId, message = 'Загрузка...') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="loading-spinner">${message}</div>`;
    }
}

function updateSearchResults(count, query) {
    const resultsInfo = document.getElementById('search-results-info');
    if (resultsInfo) {
        resultsInfo.textContent = `Найдено ${count} результатов по запросу "${query}"`;
        resultsInfo.style.display = 'block';
    }
}

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    console.error('📖 Error:', message);
    if (typeof showNotification === 'function') {
        showNotification('error', message);
    } else {
        alert('Ошибка: ' + message);
    }
}

function showWarning(message) {
    console.warn('📖 Warning:', message);
    if (typeof showNotification === 'function') {
        showNotification('warning', message);
    }
}

// Placeholder functions for modal operations (to be implemented)
function showAddDocumentModal() {
    showError('Функция добавления документов в разработке');
}

function showTestSearchModal() {
    showError('Функция тестового поиска в разработке');
}

function viewDocument(id) {
    showError('Функция просмотра документа в разработке');
}

function editDocument(id) {
    showError('Функция редактирования документа в разработке');
}

function deleteDocument(id) {
    const confirmation = confirm('Вы уверены, что хотите удалить этот документ?');
    if (confirmation) {
        showError('Функция удаления документа в разработке');
    }
}

function renderTestResults(data) {
    const container = document.getElementById('test-results');
    if (!container) return;

    if (!data.results || data.results.length === 0) {
        container.innerHTML = '<div class="no-data">Результаты не найдены</div>';
        return;
    }

    const resultsHTML = `
        <div class="test-results-summary">
            <h4>Результаты тестового поиска</h4>
            <p>Запрос: <strong>${escapeHtml(data.query)}</strong></p>
            <p>Найдено: <strong>${data.totalFound}</strong> результатов</p>
            <p>Тип поиска: <strong>${data.searchType}</strong></p>
            <p>Чанкинг: <strong>${data.chunkingUsed ? 'используется' : 'не используется'}</strong></p>
        </div>
        <div class="test-results-list">
            ${data.results.map((result, index) => `
                <div class="test-result-item">
                    <h5>${index + 1}. ${escapeHtml(result.title)}</h5>
                    <div class="result-meta">
                        <span class="badge badge-info">Релевантность: ${(result.score * 100).toFixed(1)}%</span>
                        <span class="badge badge-secondary">${escapeHtml(result.category)}</span>
                        ${result.isChunk ? '<span class="badge badge-warning">Чанк</span>' : ''}
                    </div>
                    <div class="result-content">
                        ${escapeHtml(result.content.substring(0, 300))}...
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = resultsHTML;
}

function renderDiagnostics(data) {
    console.log('📖 Диагностика:', data);
    showNotification('info', 'Результаты диагностики отображены в консоли');
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('knowledge.html')) {
        initKnowledgePage();
    }
});
