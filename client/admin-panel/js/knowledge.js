/**
 * Knowledge Management JavaScript with Document Upload Support
 * @file client/admin-panel/js/knowledge.js
 * 📖 ДОБАВЛЕНО: Функционал загрузки документов для Reader Bot
 * 🔍 ПОДДЕРЖКА: PDF, TXT, DOCX, XLS/XLSX файлов
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
                                 (!options.method || options.method === 'GET');

        // Не устанавливаем Content-Type для FormData (multipart/form-data)
        const headers = {
            ...options.headers
        };

        // Only set Content-Type for non-FormData requests
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

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
        showLoading('documents-table', 'Загрузка документов...');

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
        const tableBody = document.querySelector('#documents-table tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Не удалось загрузить документы</td></tr>';
        }
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

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            currentPage = 1;
            loadDocuments();
        });
    }

    // New document button
    const newDocButton = document.getElementById('new-document-btn');
    if (newDocButton) {
        newDocButton.addEventListener('click', showUploadDocumentModal);
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

    // Test search button
    const testRagBtn = document.getElementById('test-rag-btn');
    if (testRagBtn) {
        testRagBtn.addEventListener('click', showTestSearchModal);
    }

    // Sync vector store button
    const syncVectorBtn = document.getElementById('sync-vector-btn');
    if (syncVectorBtn) {
        syncVectorBtn.addEventListener('click', syncVectorStore);
    }

    // Diagnose button
    const diagnoseBtn = document.getElementById('diagnose-rag');
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
        currentPage = 1;
        loadDocuments();
    }, 300);
}

/**
 * Reset search filters
 */
function resetSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const tagsFilter = document.getElementById('tags-filter');

    if (searchInput) searchInput.value = '';
    if (categoryFilter) categoryFilter.value = '';
    if (tagsFilter) tagsFilter.value = '';

    currentPage = 1;
    loadDocuments();
}

/**
 * Show upload document modal with file support
 */
function showUploadDocumentModal() {
    // Создаем модальное окно для загрузки документов
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'upload-document-modal';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📁 Загрузить документ в базу знаний</h3>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Upload Methods Tabs -->
                    <div class="upload-tabs">
                        <button type="button" class="tab-button active" onclick="switchUploadTab('file')">
                            📁 Загрузить файл
                        </button>
                        <button type="button" class="tab-button" onclick="switchUploadTab('manual')">
                            ✏️ Ввести вручную
                        </button>
                    </div>

                    <!-- File Upload Tab -->
                    <div id="file-upload-tab" class="upload-tab-content active">
                        <form id="upload-document-form" enctype="multipart/form-data">
                            <div class="form-group">
                                <label for="document-file">Выберите документ *</label>
                                <div class="file-upload-area" id="file-upload-area">
                                    <input type="file" id="document-file" name="document" accept=".pdf,.txt,.docx,.doc,.xlsx,.xls" required>
                                    <div class="file-upload-text">
                                        <div class="upload-icon">📄</div>
                                        <div class="upload-message">
                                            <strong>Перетащите файл сюда или нажмите для выбора</strong>
                                            <br>
                                            <small>Поддерживаемые форматы: PDF, TXT, DOCX, XLS/XLSX (макс. 10MB)</small>
                                        </div>
                                    </div>
                                    <div class="file-info" id="file-info" style="display: none;"></div>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-md-8">
                                    <label for="doc-title">Название документа</label>
                                    <input type="text" id="doc-title" name="title" 
                                           placeholder="Оставьте пустым для автоматического определения">
                                </div>
                                <div class="form-group col-md-4">
                                    <label for="doc-language">Язык</label>
                                    <select id="doc-language" name="language">
                                        <option value="ru">Русский</option>
                                        <option value="en">English</option>
                                        <option value="auto">Авто-определение</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-md-6">
                                    <label for="doc-category">Категория</label>
                                    <select id="doc-category" name="category">
                                        <option value="">Авто-определение</option>
                                        <option value="books">📚 Книги</option>
                                        <option value="psychology">🧠 Психология</option>
                                        <option value="self-development">✨ Саморазвитие</option>
                                        <option value="relationships">💕 Отношения</option>
                                        <option value="productivity">⚡ Продуктивность</option>
                                        <option value="mindfulness">🧘 Осознанность</option>
                                        <option value="creativity">🎨 Творчество</option>
                                        <option value="general">📖 Общие</option>
                                    </select>
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="doc-status">Статус</label>
                                    <select id="doc-status" name="status">
                                        <option value="published">Опубликован</option>
                                        <option value="draft">Черновик</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="doc-tags">Теги (через запятую)</label>
                                <input type="text" id="doc-tags" name="tags" 
                                       placeholder="психология, книги, цитаты">
                                <small class="form-text text-muted">
                                    Теги по типу файла добавятся автоматически
                                </small>
                            </div>
                        </form>
                    </div>

                    <!-- Manual Entry Tab -->
                    <div id="manual-upload-tab" class="upload-tab-content" style="display: none;">
                        <form id="manual-document-form">
                            <div class="form-group">
                                <label for="manual-title">Название документа *</label>
                                <input type="text" id="manual-title" name="title" required 
                                       placeholder="Например: Цитаты о любви и отношениях">
                            </div>
                            
                            <div class="form-group">
                                <label for="manual-content">Содержание документа *</label>
                                <textarea id="manual-content" name="content" required rows="10"
                                          placeholder="Введите содержание документа..."></textarea>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-group col-md-6">
                                    <label for="manual-category">Категория *</label>
                                    <select id="manual-category" name="category" required>
                                        <option value="">Выберите категорию</option>
                                        <option value="books">📚 Книги</option>
                                        <option value="psychology">🧠 Психология</option>
                                        <option value="self-development">✨ Саморазвитие</option>
                                        <option value="relationships">💕 Отношения</option>
                                        <option value="productivity">⚡ Продуктивность</option>
                                        <option value="mindfulness">🧘 Осознанность</option>
                                        <option value="creativity">🎨 Творчество</option>
                                        <option value="general">📖 Общие</option>
                                    </select>
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="manual-language">Язык</label>
                                    <select id="manual-language" name="language">
                                        <option value="ru">Русский</option>
                                        <option value="en">English</option>
                                        <option value="auto">Авто-определение</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="manual-tags">Теги (через запятую)</label>
                                <input type="text" id="manual-tags" name="tags" 
                                       placeholder="психология, книги, цитаты">
                            </div>
                            
                            <div class="form-group">
                                <label for="manual-status">Статус</label>
                                <select id="manual-status" name="status">
                                    <option value="published">Опубликован</option>
                                    <option value="draft">Черновик</option>
                                </select>
                            </div>
                        </form>
                    </div>

                    <!-- Upload Progress -->
                    <div class="upload-progress" id="upload-progress" style="display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill"></div>
                        </div>
                        <div class="progress-text" id="progress-text">Загрузка...</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                    <button type="button" class="btn btn-primary" id="upload-btn" onclick="uploadDocument()">
                        📁 Загрузить документ
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Setup file upload events
    setupFileUploadEvents();
    
    // Фокус на первое поле
    document.getElementById('document-file').focus();
}

/**
 * Switch between upload tabs
 */
function switchUploadTab(tabName) {
    const fileTab = document.getElementById('file-upload-tab');
    const manualTab = document.getElementById('manual-upload-tab');
    const fileTabBtn = document.querySelector('.tab-button:first-child');
    const manualTabBtn = document.querySelector('.tab-button:last-child');
    const uploadBtn = document.getElementById('upload-btn');

    if (tabName === 'file') {
        fileTab.style.display = 'block';
        manualTab.style.display = 'none';
        fileTabBtn.classList.add('active');
        manualTabBtn.classList.remove('active');
        uploadBtn.textContent = '📁 Загрузить документ';
    } else {
        fileTab.style.display = 'none';
        manualTab.style.display = 'block';
        fileTabBtn.classList.remove('active');
        manualTabBtn.classList.add('active');
        uploadBtn.textContent = '💾 Создать документ';
    }
}

/**
 * Setup file upload drag and drop events
 */
function setupFileUploadEvents() {
    const fileInput = document.getElementById('document-file');
    const uploadArea = document.getElementById('file-upload-area');
    const fileInfo = document.getElementById('file-info');

    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    });

    // Click to select file
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
}

/**
 * Handle file selection and validation
 */
function handleFileSelect() {
    const fileInput = document.getElementById('document-file');
    const fileInfo = document.getElementById('file-info');
    const titleInput = document.getElementById('doc-title');
    
    if (fileInput.files.length === 0) {
        fileInfo.style.display = 'none';
        return;
    }

    const file = fileInput.files[0];
    
    // File validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    if (file.size > maxSize) {
        showError('Файл слишком большой. Максимальный размер: 10MB');
        fileInput.value = '';
        fileInfo.style.display = 'none';
        return;
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showError('Неподдерживаемый тип файла. Разрешены: PDF, TXT, DOCX, XLS/XLSX');
        fileInput.value = '';
        fileInfo.style.display = 'none';
        return;
    }

    // Auto-fill title if empty
    if (!titleInput.value.trim()) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        titleInput.value = fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Show file info
    fileInfo.innerHTML = `
        <div class="selected-file">
            <div class="file-icon">${getFileIcon(fileExtension)}</div>
            <div class="file-details">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button type="button" class="remove-file" onclick="removeSelectedFile()">×</button>
        </div>
    `;
    fileInfo.style.display = 'block';
}

/**
 * Remove selected file
 */
function removeSelectedFile() {
    const fileInput = document.getElementById('document-file');
    const fileInfo = document.getElementById('file-info');
    
    fileInput.value = '';
    fileInfo.style.display = 'none';
}

/**
 * Get file icon based on extension
 */
function getFileIcon(extension) {
    const icons = {
        'pdf': '📄',
        'txt': '📝',
        'docx': '📘',
        'doc': '📘',
        'xlsx': '📊',
        'xls': '📊'
    };
    return icons[extension] || '📄';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Upload document (file or manual)
 */
async function uploadDocument() {
    const activeTab = document.querySelector('.upload-tab-content.active, .upload-tab-content[style*="block"]');
    const isFileUpload = activeTab && activeTab.id === 'file-upload-tab';
    
    if (isFileUpload) {
        await uploadFileDocument();
    } else {
        await uploadManualDocument();
    }
}

/**
 * Upload file document
 */
async function uploadFileDocument() {
    const form = document.getElementById('upload-document-form');
    const fileInput = document.getElementById('document-file');
    
    if (!fileInput.files.length) {
        showError('Выберите файл для загрузки');
        return;
    }

    try {
        // Show progress
        showUploadProgress('Подготовка файла...');
        
        const formData = new FormData();
        formData.append('document', fileInput.files[0]);
        
        // Add other form fields
        const fields = ['title', 'category', 'language', 'status', 'tags'];
        fields.forEach(field => {
            const element = document.getElementById(`doc-${field}`);
            if (element && element.value.trim()) {
                formData.append(field, element.value.trim());
            }
        });

        console.log('📁 Uploading file document...');
        
        // Update progress
        updateUploadProgress(30, 'Загрузка файла...');
        
        const response = await makeAuthenticatedRequest('/knowledge/upload', {
            method: 'POST',
            body: formData
        });

        // Update progress
        updateUploadProgress(80, 'Обработка документа...');

        if (response.success) {
            updateUploadProgress(100, 'Готово!');
            showNotification('success', 'Документ успешно загружен и обработан!');
            closeModal();
            
            // Refresh documents list
            currentPage = 1;
            await loadDocuments();
            await loadRAGStats();
        } else {
            throw new Error(response.error || 'Не удалось загрузить документ');
        }
    } catch (error) {
        console.error('📁 Upload error:', error);
        hideUploadProgress();
        showError('Ошибка загрузки: ' + error.message);
    }
}

/**
 * Upload manual document
 */
async function uploadManualDocument() {
    const form = document.getElementById('manual-document-form');
    const formData = new FormData(form);
    
    // Validation
    const title = formData.get('title').trim();
    const category = formData.get('category');
    const content = formData.get('content').trim();
    
    if (!title || !category || !content) {
        showError('Заполните все обязательные поля');
        return;
    }
    
    if (content.length < 10) {
        showError('Содержание документа должно быть минимум 10 символов');
        return;
    }

    try {
        // Show progress
        showUploadProgress('Создание документа...');

        // Prepare document data
        const documentData = {
            title: title,
            category: category,
            content: content,
            tags: formData.get('tags') ? formData.get('tags').split(',').map(tag => tag.trim()).filter(tag => tag) : [],
            language: formData.get('language') || 'ru',
            status: formData.get('status') || 'published'
        };

        console.log('📝 Creating manual document:', documentData);

        const response = await makeAuthenticatedRequest('/knowledge', {
            method: 'POST',
            body: JSON.stringify(documentData)
        });

        if (response.success) {
            updateUploadProgress(100, 'Готово!');
            showNotification('success', 'Документ успешно создан!');
            closeModal();
            
            // Refresh documents list
            currentPage = 1;
            await loadDocuments();
            await loadRAGStats();
        } else {
            throw new Error(response.error || 'Не удалось создать документ');
        }
    } catch (error) {
        console.error('📝 Manual document creation error:', error);
        hideUploadProgress();
        showError('Ошибка создания документа: ' + error.message);
    }
}

/**
 * Show upload progress
 */
function showUploadProgress(message) {
    const progress = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    const uploadBtn = document.getElementById('upload-btn');
    
    progress.style.display = 'block';
    progressText.textContent = message;
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Загрузка...';
    
    updateUploadProgress(10, message);
}

/**
 * Update upload progress
 */
function updateUploadProgress(percent, message) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    progressFill.style.width = percent + '%';
    if (message) {
        progressText.textContent = message;
    }
}

/**
 * Hide upload progress
 */
function hideUploadProgress() {
    const progress = document.getElementById('upload-progress');
    const uploadBtn = document.getElementById('upload-btn');
    
    progress.style.display = 'none';
    uploadBtn.disabled = false;
    uploadBtn.textContent = '📁 Загрузить документ';
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

/**
 * Show test search modal
 */
function showTestSearchModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔍 Тестовый поиск в базе знаний</h3>
                    <button type="button" class="close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="test-query">Поисковый запрос</label>
                        <input type="text" id="test-query" class="form-control" 
                               placeholder="Например: цитаты о любви">
                    </div>
                    <div class="form-row">
                        <div class="form-group col-md-6">
                            <label for="test-limit">Количество результатов</label>
                            <select id="test-limit" class="form-control">
                                <option value="5">5</option>
                                <option value="10" selected>10</option>
                                <option value="20">20</option>
                            </select>
                        </div>
                        <div class="form-group col-md-6">
                            <label>
                                <input type="checkbox" id="test-chunks" checked>
                                Показать чанки
                            </label>
                        </div>
                    </div>
                    <div id="test-results"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
                    <button type="button" class="btn btn-primary" onclick="testSearch()">
                        🔍 Выполнить поиск
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Фокус на поле поиска
    document.getElementById('test-query').focus();
}

/**
 * Test search functionality
 */
async function testSearch() {
    const queryInput = document.getElementById('test-query');
    const limitSelect = document.getElementById('test-limit');
    const chunksCheckbox = document.getElementById('test-chunks');
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
                limit: parseInt(limitSelect.value) || 10,
                returnChunks: chunksCheckbox.checked
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
 * Render documents list
 */
function renderDocuments(documents) {
    const tableBody = document.querySelector('#documents-table tbody');
    const emptyState = document.getElementById('empty-state');
    
    if (!tableBody) return;

    if (!documents || documents.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Документы не найдены</td></tr>';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const documentsHTML = documents.map(doc => `
        <tr data-id="${doc._id || doc.id}">
            <td class="col-title">
                <div class="document-title">${escapeHtml(doc.title)}</div>
                <small class="text-muted">${escapeHtml((doc.content || '').substring(0, 100))}${(doc.content || '').length > 100 ? '...' : ''}</small>
            </td>
            <td class="col-category">
                <span class="badge badge-primary">${escapeHtml(doc.category || 'general')}</span>
            </td>
            <td class="col-language">${escapeHtml(doc.language || 'auto')}</td>
            <td class="col-tags">
                ${doc.tags && doc.tags.length > 0 ? 
                    doc.tags.slice(0, 3).map(tag => `<span class="badge badge-secondary badge-sm">${escapeHtml(tag)}</span>`).join(' ') +
                    (doc.tags.length > 3 ? ` <span class="text-muted">+${doc.tags.length - 3}</span>` : '')
                    : '<span class="text-muted">—</span>'
                }
            </td>
            <td class="col-status">
                <span class="badge badge-${doc.status === 'published' ? 'success' : 'warning'}">${doc.status === 'published' ? 'Опубликован' : 'Черновик'}</span>
            </td>
            <td class="col-actions">
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewDocument('${doc._id || doc.id}')" title="Просмотр">
                        👁️
                    </button>
                    <button class="btn btn-outline-secondary" onclick="editDocument('${doc._id || doc.id}')" title="Редактировать">
                        ✏️
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteDocument('${doc._id || doc.id}')" title="Удалить">
                        🗑️
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    tableBody.innerHTML = documentsHTML;
}

/**
 * Render RAG statistics
 */
function renderRAGStats(stats) {
    // Update main stats
    updateStatElement('total-docs', stats.total || 0);
    updateStatElement('published-docs', stats.published || 0);
    updateStatElement('draft-docs', stats.draft || 0);
    
    // Vector store stats
    if (stats.vectorStore) {
        const vectorStoreStatus = document.getElementById('vector-store-stats');
        if (vectorStoreStatus) {
            vectorStoreStatus.textContent = `${stats.vectorStore.documentsCount || 0} документов, ${stats.vectorStore.chunksCount || 0} чанков`;
        }
    }

    // Chunking status
    const chunkingStatus = document.getElementById('chunking-status');
    if (chunkingStatus) {
        const isEnabled = stats.chunkingEnabled || false;
        chunkingStatus.textContent = isEnabled ? 'Включен' : 'Выключен';
        chunkingStatus.className = `badge badge-${isEnabled ? 'success' : 'warning'}`;
    }

    // Language distribution
    renderLanguageStats(stats.byLanguage || []);

    // Recent updates info
    const lastUpdated = document.getElementById('rag-last-indexed');
    if (lastUpdated) {
        lastUpdated.textContent = stats.lastUpdated ? 
            new Date(stats.lastUpdated).toLocaleString('ru-RU') : 
            'Неизвестно';
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
    const resultsInfo = document.getElementById('results-info');
    
    if (resultsInfo) {
        resultsInfo.textContent = `Показано ${pagination.startDoc || 1}-${pagination.endDoc || pagination.totalDocs} из ${pagination.totalDocs || 0} документов`;
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
    loadDocuments();
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

function renderLanguageStats(languages) {
    const container = document.getElementById('language-stats');
    if (!container || !languages.length) {
        if (container) container.innerHTML = '<div class="text-muted">Нет данных</div>';
        return;
    }

    const statsHTML = languages.slice(0, 5).map(lang => `
        <div class="stat-item">
            <span class="stat-label">${escapeHtml(lang._id || 'Неизвестно')}</span>
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
    console.error('📖 Error:', message);
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

// Document management functions
async function viewDocument(documentId) {
    try {
        console.log('👁️ Просмотр документа:', documentId);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'document-view-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📄 Просмотр документа</h3>
                    <button type="button" class="modal-close">&times;</button>
                </div>
                <div class="modal-body" id="document-view-content">
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        📖 Загрузка документа...
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`);
        
        if (response.success) {
            const doc = response.data;
            const content = document.getElementById('document-view-content');
            content.innerHTML = `
                <div class="document-details">
                    <div class="document-header">
                        <h4>${escapeHtml(doc.title)}</h4>
                        <div class="document-meta">
                            <span class="category-badge category-${doc.category || 'general'}">${getCategoryDisplayName(doc.category)}</span>
                            <span class="status-badge status-${doc.status || 'draft'}">${getStatusDisplayName(doc.status)}</span>
                        </div>
                    </div>
                    <div class="document-content-text" style="max-height: 400px; overflow-y: auto; margin: 1rem 0; padding: 1rem; background: var(--hover-bg); border-radius: var(--border-radius);">
                        ${escapeHtml(doc.content || 'Содержание недоступно').replace(/\n/g, '<br>')}
                    </div>
                    <div class="document-actions" style="display: flex; gap: 1rem; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-primary" onclick="editDocument('${doc._id}')">✏️ Редактировать</button>
                        <button class="btn btn-danger" onclick="deleteDocument('${doc._id}')">🗑️ Удалить</button>
                        <button class="btn btn-secondary" onclick="closeModal()">Закрыть</button>
                    </div>
                </div>
            `;
        } else {
            throw new Error(response.error || 'Документ не найден');
        }
        
    } catch (error) {
        console.error('❌ Ошибка просмотра документа:', error);
        showError('Ошибка просмотра: ' + error.message);
    }
}

async function editDocument(documentId) {
    try {
        console.log('✏️ Редактирование документа:', documentId);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'document-edit-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✏️ Редактирование документа</h3>
                    <button type="button" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-document-form">
                        <input type="hidden" id="edit-document-id" value="${documentId}">
                        <div class="form-group">
                            <label for="edit-title">Название документа *</label>
                            <input type="text" id="edit-title" class="form-control" required>
                        </div>
                        <div class="form-row">
                            <div class="form-group col-md-6">
                                <label for="edit-category">Категория *</label>
                                <select id="edit-category" class="select-glow" required>
                                    <option value="books">📚 Книги</option>
                                    <option value="psychology">🧠 Психология</option>
                                    <option value="self-development">✨ Саморазвитие</option>
                                    <option value="relationships">💕 Отношения</option>
                                    <option value="productivity">⚡ Продуктивность</option>
                                    <option value="mindfulness">🧘 Осознанность</option>
                                    <option value="creativity">🎨 Творчество</option>
                                    <option value="general">📖 Общие</option>
                                </select>
                            </div>
                            <div class="form-group col-md-6">
                                <label for="edit-status">Статус *</label>
                                <select id="edit-status" class="select-glow" required>
                                    <option value="published">Опубликован</option>
                                    <option value="draft">Черновик</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="edit-content">Содержание *</label>
                            <textarea id="edit-content" class="form-control" rows="8" required></textarea>
                        </div>
                        <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem;">
                            <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                            <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Загружаем данные документа
        const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`);
        if (response.success) {
            const doc = response.data;
            document.getElementById('edit-title').value = doc.title || '';
            document.getElementById('edit-category').value = doc.category || 'general';
            document.getElementById('edit-status').value = doc.status || 'draft';
            document.getElementById('edit-content').value = doc.content || '';
        }
        
        // Обработчик формы
        document.getElementById('edit-document-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updateData = {
                title: document.getElementById('edit-title').value.trim(),
                category: document.getElementById('edit-category').value,
                status: document.getElementById('edit-status').value,
                content: document.getElementById('edit-content').value.trim()
            };
            
            try {
                const updateResponse = await makeAuthenticatedRequest(`/knowledge/${documentId}`, {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });
                
                if (updateResponse.success) {
                    showNotification('success', 'Документ успешно обновлен');
                    closeModal();
                    await loadDocuments();
                } else {
                    throw new Error(updateResponse.error || 'Ошибка обновления');
                }
            } catch (error) {
                showError('Ошибка сохранения: ' + error.message);
            }
        });
        
    } catch (error) {
        console.error('❌ Ошибка редактирования:', error);
        showError('Ошибка редактирования: ' + error.message);
    }
}

async function deleteDocument(documentId) {
    const confirmation = confirm('Вы уверены, что хотите удалить этот документ? Это действие нельзя отменить.');
    if (!confirmation) return;
    
    try {
        console.log('🗑️ Удаление документа:', documentId);
        
        const response = await makeAuthenticatedRequest(`/knowledge/${documentId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showNotification('success', 'Документ успешно удален');
            closeModal();
            await loadDocuments();
            await loadRAGStats();
        } else {
            throw new Error(response.error || 'Ошибка удаления');
        }
        
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        showError('Ошибка удаления: ' + error.message);
    }
}

function renderTestResults(data) {
    const container = document.getElementById('test-results');
    if (!container) return;

    if (!data.results || data.results.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Результаты не найдены</div>';
        return;
    }

    const resultsHTML = `
        <div class="test-results-summary">
            <h5>Результаты тестового поиска</h5>
            <p><strong>Запрос:</strong> ${escapeHtml(data.query)}</p>
            <p><strong>Найдено:</strong> ${data.totalFound} результатов</p>
            <p><strong>Тип поиска:</strong> ${data.searchType}</p>
        </div>
        <div class="test-results-list">
            ${data.results.map((result, index) => `
                <div class="test-result-item border-bottom py-2">
                    <h6>${index + 1}. ${escapeHtml(result.title)}</h6>
                    <div class="mb-2">
                        <span class="badge badge-info">Релевантность: ${(result.score * 100).toFixed(1)}%</span>
                        <span class="badge badge-secondary">${escapeHtml(result.category)}</span>
                        ${result.isChunk ? '<span class="badge badge-warning">Чанк</span>' : ''}
                    </div>
                    <div class="result-content text-muted">
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

// ========================================
// УЛУЧШЕННЫЕ ФУНКЦИИ ДЛЯ НОВОГО UI/UX
// ========================================

/**
 * Get category display name with emoji
 */
function getCategoryDisplayName(category) {
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
    return categories[category] || 'Неизвестно';
}

/**
 * Get status display name
 */
function getStatusDisplayName(status) {
    return status === 'published' ? 'Опубликован' : 'Черновик';
}

/**
 * Get language display name
 */
function getLanguageDisplayName(language) {
    const languages = {
        'ru': 'Русский',
        'en': 'English',
        'auto': 'Авто'
    };
    return languages[language] || 'Неизвестно';
}

/**
 * Render tags with limit
 */
function renderTags(tags) {
    if (!tags || tags.length === 0) return '<span class="text-muted">—</span>';
    
    const visibleTags = tags.slice(0, 3);
    const hiddenCount = tags.length - 3;
    
    let html = visibleTags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('');
    
    if (hiddenCount > 0) {
        html += `<span class="text-muted">+${hiddenCount}</span>`;
    }
    
    return html;
}

/**
 * Show table loading state
 */
function showTableLoading() {
    const tableBody = document.querySelector('#documents-table tbody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr class="table-loading">
                <td colspan="7">
                    <div class="loading-spinner"></div>
                    📚 Загрузка документов...
                </td>
            </tr>
        `;
    }
}

/**
 * Show table error state
 */
function showTableError(message) {
    const tableBody = document.querySelector('#documents-table tbody');
    if (tableBody) {
        tableBody.innerHTML = `
            <tr class="table-error">
                <td colspan="7" class="text-center">
                    ❌ ${message}
                    <br>
                    <button class="btn btn-secondary" onclick="loadDocuments()">🔄 Повторить</button>
                </td>
            </tr>
        `;
    }
}

/**
 * Enhanced modal management
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) {
        activeModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

/**
 * Enhanced debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Switch upload tabs in modal
 */
function switchUploadTab(tabName) {
    const fileTab = document.getElementById('file-upload-tab');
    const manualTab = document.getElementById('manual-upload-tab');
    const fileTabBtn = document.querySelector('.tab-button:first-child');
    const manualTabBtn = document.querySelector('.tab-button:last-child');
    const uploadBtn = document.getElementById('upload-btn');

    if (tabName === 'file') {
        if (fileTab) fileTab.style.display = 'block';
        if (manualTab) manualTab.style.display = 'none';
        if (fileTabBtn) fileTabBtn.classList.add('active');
        if (manualTabBtn) manualTabBtn.classList.remove('active');
        if (uploadBtn) uploadBtn.textContent = '📁 Загрузить документ';
    } else {
        if (fileTab) fileTab.style.display = 'none';
        if (manualTab) manualTab.style.display = 'block';
        if (fileTabBtn) fileTabBtn.classList.remove('active');
        if (manualTabBtn) manualTabBtn.classList.add('active');
        if (uploadBtn) uploadBtn.textContent = '💾 Создать документ';
    }
}

/**
 * Enhanced file upload setup
 */
function setupFileUploadEvents() {
    const fileInput = document.getElementById('document-file');
    const uploadArea = document.getElementById('file-upload-area');
    const fileInfo = document.getElementById('file-info');

    if (!fileInput || !uploadArea) return;

    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelect();
        }
    });

    // Click to select file
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });
}

/**
 * Handle file selection and validation
 */
function handleFileSelect() {
    const fileInput = document.getElementById('document-file');
    const fileInfo = document.getElementById('file-info');
    const titleInput = document.getElementById('doc-title');
    
    if (!fileInput || fileInput.files.length === 0) {
        if (fileInfo) fileInfo.style.display = 'none';
        return;
    }

    const file = fileInput.files[0];
    
    // File validation
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];

    if (file.size > maxSize) {
        showError('Файл слишком большой. Максимальный размер: 10MB');
        fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        return;
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = ['txt', 'pdf', 'docx', 'doc', 'xlsx', 'xls'];
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        showError('Неподдерживаемый тип файла. Разрешены: PDF, TXT, DOCX, XLS/XLSX');
        fileInput.value = '';
        if (fileInfo) fileInfo.style.display = 'none';
        return;
    }

    // Auto-fill title if empty
    if (titleInput && !titleInput.value.trim()) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        titleInput.value = fileName.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // Show file info
    if (fileInfo) {
        fileInfo.innerHTML = `
            <div class="selected-file">
                <div class="file-icon">${getFileIcon(fileExtension)}</div>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
                <button type="button" class="remove-file" onclick="removeSelectedFile()">×</button>
            </div>
        `;
        fileInfo.style.display = 'block';
    }
}

/**
 * Remove selected file
 */
function removeSelectedFile() {
    const fileInput = document.getElementById('document-file');
    const fileInfo = document.getElementById('file-info');
    
    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.style.display = 'none';
}

/**
 * Get file icon based on extension
 */
function getFileIcon(extension) {
    const icons = {
        'pdf': '📄',
        'txt': '📝',
        'docx': '📘',
        'doc': '📘',
        'xlsx': '📊',
        'xls': '📊'
    };
    return icons[extension] || '📄';
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Upload document (enhanced version)
 */
async function uploadDocument() {
    const activeTab = document.querySelector('.upload-tab-content[style*="block"], .upload-tab-content.active');
    const isFileUpload = activeTab && activeTab.id === 'file-upload-tab';
    
    if (isFileUpload) {
        await uploadFileDocument();
    } else {
        await uploadManualDocument();
    }
}

/**
 * Show upload progress
 */
function showUploadProgress(message) {
    const progress = document.getElementById('upload-progress');
    const progressText = document.getElementById('progress-text');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (progress) progress.style.display = 'block';
    if (progressText) progressText.textContent = message;
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Загрузка...';
    }
    
    updateUploadProgress(10, message);
}

/**
 * Update upload progress
 */
function updateUploadProgress(percent, message) {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    if (progressFill) progressFill.style.width = percent + '%';
    if (message && progressText) progressText.textContent = message;
}

/**
 * Hide upload progress
 */
function hideUploadProgress() {
    const progress = document.getElementById('upload-progress');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (progress) progress.style.display = 'none';
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = '📁 Загрузить документ';
    }
}

console.log('📚 Enhanced UI/UX functions loaded successfully');
