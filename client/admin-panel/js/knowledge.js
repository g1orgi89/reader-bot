/**
 * knowledge.js - система управления грибной базой знаний для Shrooms AI Support Bot
 * 
 * Этот модуль отвечает за взаимодействие с векторной базой данных Qdrant,
 * управление документами, настройку доходности фарминга и RAG-функциональность.
 * 
 * @fileoverview Управление грибной базой знаний и векторным хранилищем спор мудрости
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} KnowledgeDocument
 * @property {string} [id] - Уникальный идентификатор документа в мицелии
 * @property {string} title - Название документа (заголовок споры знаний)
 * @property {string} content - Содержимое документа в формате Markdown
 * @property {string} category - Категория документа (general|user-guide|tokenomics|technical|troubleshooting)
 * @property {string} language - Язык документа (en|es|ru)
 * @property {string[]} tags - Массив тегов для категоризации
 * @property {string} [status] - Статус документа (published|draft|archived)
 * @property {string} [createdAt] - Дата создания документа
 * @property {string} [updatedAt] - Дата последнего обновления
 * @property {string} [authorId] - ID автора документа
 */

/**
 * @typedef {Object} DocumentFilter
 * @property {string} [category] - Фильтр по категории ('all' для всех)
 * @property {string} [language] - Фильтр по языку ('all' для всех)
 * @property {string} [search] - Поисковый запрос
 * @property {number} [page] - Номер страницы для пагинации
 * @property {number} [limit] - Количество документов на странице
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Успешность выполнения запроса
 * @property {*} [data] - Данные ответа
 * @property {Object} [error] - Информация об ошибке
 * @property {string} [error.message] - Сообщение об ошибке
 * @property {string} [error.code] - Код ошибки
 */

/**
 * @typedef {Object} RAGStats
 * @property {number} totalDocuments - Общее количество документов
 * @property {string} vectorStore - Тип векторного хранилища
 * @property {string} embeddingModel - Модель для создания эмбеддингов
 * @property {string} lastIndexed - Время последней индексации
 * @property {string} syncStatus - Статус синхронизации
 */

/**
 * @typedef {Object} FarmingRate
 * @property {number} rate - Текущая доходность в процентах
 * @property {string} lastUpdated - Время последнего обновления
 * @property {string} [updatedBy] - Кто обновил доходность
 */

/**
 * Конфигурация модуля управления базой знаний
 */
const KNOWLEDGE_CONFIG = {
  /** @type {string} Базовый URL для API запросов */
  API_BASE: '/api/knowledge',
  
  /** @type {number} Количество документов на странице по умолчанию */
  DEFAULT_PAGE_SIZE: 10,
  
  /** @type {number} Максимальный размер документа в символах */
  MAX_DOCUMENT_SIZE: 50000,
  
  /** @type {Object<string, string>} Переводы категорий */
  CATEGORY_LABELS: {
    'general': 'Общие',
    'user-guide': 'Руководство',
    'tokenomics': 'Токеномика', 
    'technical': 'Техническое',
    'troubleshooting': 'Решение проблем'
  },
  
  /** @type {Object<string, string>} Переводы языков */
  LANGUAGE_LABELS: {
    'en': 'English',
    'ru': 'Русский',
    'es': 'Español'
  }
};

/**
 * Состояние модуля управления базой знаний
 */
const knowledgeState = {
  /** @type {KnowledgeDocument[]} Загруженные документы */
  documents: [],
  
  /** @type {DocumentFilter} Текущие фильтры */
  currentFilters: {
    category: 'all',
    language: 'all',
    search: '',
    page: 1,
    limit: KNOWLEDGE_CONFIG.DEFAULT_PAGE_SIZE
  },
  
  /** @type {number} Общее количество документов */
  totalDocuments: 0,
  
  /** @type {boolean} Идет ли загрузка */
  isLoading: false,
  
  /** @type {RAGStats|null} Статистика RAG */
  ragStats: null,
  
  /** @type {FarmingRate|null} Текущая доходность фарминга */
  farmingRate: null
};

/**
 * Инициализация страницы управления базой знаний
 * Основная точка входа после проверки аутентификации
 */
function initKnowledgePage() {
  console.log('🍄 Инициализация грибной базы знаний...');
  
  try {
    // Инициализируем компоненты интерфейса
    initKnowledgeFilters();
    initDocumentEditor();
    initRAGControls();
    initFarmingRateControl();
    initPagination();
    
    // Загружаем начальные данные
    loadDocuments();
    loadRAGStats();
    loadFarmingRate();
    
    console.log('🍄 База знаний готова к выращиванию мудрости!');
  } catch (error) {
    console.error('🍄 Ошибка инициализации базы знаний:', error);
    showNotification('error', '🍄 Не удалось инициализировать базу знаний');
  }
}

/**
 * Инициализация фильтров и поиска
 */
function initKnowledgeFilters() {
  console.log('🍄 Настройка фильтров грибного поиска...');
  
  const categoryFilter = document.getElementById('category-filter');
  const languageFilter = document.getElementById('language-filter');
  const searchInput = document.getElementById('search-knowledge');
  
  // Обработчик изменения категории
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      knowledgeState.currentFilters.category = categoryFilter.value;
      knowledgeState.currentFilters.page = 1; // Сбрасываем на первую страницу
      loadDocuments();
    });
  }
  
  // Обработчик изменения языка
  if (languageFilter) {
    languageFilter.addEventListener('change', () => {
      knowledgeState.currentFilters.language = languageFilter.value;
      knowledgeState.currentFilters.page = 1;
      loadDocuments();
    });
  }
  
  // Обработчик поиска с задержкой
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        knowledgeState.currentFilters.search = searchInput.value.trim();
        knowledgeState.currentFilters.page = 1;
        loadDocuments();
      }, 500); // Задержка 500мс для предотвращения слишком частых запросов
    });
  }
}

/**
 * Загружает документы из базы знаний с применением фильтров
 * @returns {Promise<void>}
 */
async function loadDocuments() {
  if (knowledgeState.isLoading) return;
  
  console.log('🍄 Загрузка документов из грибного хранилища...');
  
  try {
    knowledgeState.isLoading = true;
    updateLoadingState(true);
    
    // Формируем параметры запроса
    const params = new URLSearchParams();
    
    if (knowledgeState.currentFilters.category && knowledgeState.currentFilters.category !== 'all') {
      params.append('category', knowledgeState.currentFilters.category);
    }
    
    if (knowledgeState.currentFilters.language && knowledgeState.currentFilters.language !== 'all') {
      params.append('language', knowledgeState.currentFilters.language);
    }
    
    if (knowledgeState.currentFilters.search) {
      params.append('search', knowledgeState.currentFilters.search);
    }
    
    params.append('page', knowledgeState.currentFilters.page.toString());
    params.append('limit', knowledgeState.currentFilters.limit.toString());
    
    // Отправляем запрос
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}?${params}`);
    
    if (response.success) {
      knowledgeState.documents = response.data.documents;
      knowledgeState.totalDocuments = response.data.total;
      
      renderDocumentsTable();
      updatePaginationInfo();
      updateRAGDocumentCount(knowledgeState.totalDocuments);
      
      console.log(`🍄 Загружено ${knowledgeState.documents.length} документов из ${knowledgeState.totalDocuments} общих`);
    } else {
      throw new Error(response.error?.message || 'Не удалось загрузить документы');
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки документов:', error);
    showNotification('error', `🍄 Не удалось загрузить документы: ${error.message}`);
    renderEmptyDocumentsTable();
  } finally {
    knowledgeState.isLoading = false;
    updateLoadingState(false);
  }
}

/**
 * Отображает состояние загрузки в интерфейсе
 * @param {boolean} isLoading - Идет ли загрузка
 */
function updateLoadingState(isLoading) {
  const tbody = document.querySelector('#knowledge-table tbody');
  if (!tbody) return;
  
  if (isLoading) {
    tbody.innerHTML = `
      <tr class="table-loading">
        <td colspan="7" style="text-align: center; padding: var(--spacing-lg);">
          <div class="loading-spinner"></div>
          🍄 Споры прорастают в мудрость...
        </td>
      </tr>
    `;
  }
}

/**
 * Отображает таблицу документов
 */
function renderDocumentsTable() {
  const tbody = document.querySelector('#knowledge-table tbody');
  if (!tbody) return;
  
  if (knowledgeState.documents.length === 0) {
    renderEmptyDocumentsTable();
    return;
  }
  
  tbody.innerHTML = knowledgeState.documents.map(doc => `
    <tr class="document-row" onclick="viewDocument('${doc.id}')">
      <td class="col-id">${doc.id.substring(0, 8)}...</td>
      <td class="col-title">
        <div class="document-title">${escapeHtml(doc.title)}</div>
        ${doc.status === 'draft' ? '<span class="status-badge status-draft">Черновик</span>' : ''}
      </td>
      <td class="col-category">
        <span class="category-badge category-${doc.category}">
          ${KNOWLEDGE_CONFIG.CATEGORY_LABELS[doc.category] || doc.category}
        </span>
      </td>
      <td class="col-language">
        <span class="language-badge language-${doc.language}">
          ${KNOWLEDGE_CONFIG.LANGUAGE_LABELS[doc.language] || doc.language}
        </span>
      </td>
      <td class="col-tags">
        <div class="tags-container">
          ${doc.tags.slice(0, 3).map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join('')}
          ${doc.tags.length > 3 ? `<span class="tag-badge">+${doc.tags.length - 3}</span>` : ''}
        </div>
      </td>
      <td class="col-updated">${formatRelativeTime(doc.updatedAt)}</td>
      <td class="col-actions">
        <div class="action-buttons">
          <button class="action-edit" onclick="editDocument('${doc.id}'); event.stopPropagation();" 
                  title="Редактировать документ">
            ✏️
          </button>
          <button class="action-delete" onclick="deleteDocument('${doc.id}'); event.stopPropagation();"
                  title="Удалить документ">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Отображает пустую таблицу документов
 */
function renderEmptyDocumentsTable() {
  const tbody = document.querySelector('#knowledge-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr class="table-empty">
      <td colspan="7" style="text-align: center; padding: var(--spacing-xl);">
        <div class="empty-state">
          <div class="empty-icon">🍄</div>
          <div class="empty-title">Пока нет документов в этой части мицелия</div>
          <div class="empty-subtitle">
            ${knowledgeState.currentFilters.search ? 
              `По запросу "${knowledgeState.currentFilters.search}" ничего не найдено` :
              'Добавьте первый документ в грибную базу знаний'}
          </div>
          <button class="btn btn-primary btn-glow" onclick="showDocumentEditor()">
            📝 Добавить Документ
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Инициализация редактора документов
 */
function initDocumentEditor() {
  console.log('🍄 Настройка редактора грибных документов...');
  
  // Кнопка добавления документа
  const addDocBtn = document.getElementById('add-document');
  if (addDocBtn) {
    addDocBtn.addEventListener('click', () => showDocumentEditor());
  }
  
  // Кнопки закрытия модальных окон
  const closeEditorBtn = document.getElementById('close-document-editor');
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', hideDocumentEditor);
  }
  
  const closePreviewBtn = document.getElementById('close-document-preview');
  if (closePreviewBtn) {
    closePreviewBtn.addEventListener('click', hideDocumentPreview);
  }
  
  // Кнопка предпросмотра
  const previewBtn = document.getElementById('preview-document');
  if (previewBtn) {
    previewBtn.addEventListener('click', showDocumentPreview);
  }
  
  // Кнопка редактирования из предпросмотра
  const editFromPreviewBtn = document.getElementById('edit-from-preview');
  if (editFromPreviewBtn) {
    editFromPreviewBtn.addEventListener('click', () => {
      hideDocumentPreview();
      // Редактор уже открыт, просто скрываем предпросмотр
    });
  }
  
  // Форма документа
  const documentForm = document.getElementById('document-form');
  if (documentForm) {
    documentForm.addEventListener('submit', handleDocumentSave);
  }
  
  // Закрытие модальных окон по клику на overlay
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('document-editor-overlay')) {
      hideDocumentEditor();
    }
    if (event.target.classList.contains('document-preview-overlay')) {
      hideDocumentPreview();
    }
  });
  
  // Закрытие по Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (document.getElementById('document-editor-overlay').style.display === 'flex') {
        hideDocumentEditor();
      }
      if (document.getElementById('document-preview-overlay').style.display === 'flex') {
        hideDocumentPreview();
      }
    }
  });
}

/**
 * Показывает редактор документов
 * @param {string|null} documentId - ID документа для редактирования (null для создания нового)
 */
function showDocumentEditor(documentId = null) {
  console.log('🍄 Открытие редактора документов:', documentId ? 'редактирование' : 'создание');
  
  const overlay = document.getElementById('document-editor-overlay');
  const title = document.getElementById('editor-title');
  const form = document.getElementById('document-form');
  const saveText = document.getElementById('save-document-text');
  
  if (!overlay || !title || !form) return;
  
  if (documentId) {
    // Режим редактирования
    title.textContent = '✏️ Редактировать Документ';
    if (saveText) saveText.textContent = '💾 Сохранить Изменения';
    
    // Загружаем данные документа
    loadDocumentForEditing(documentId);
  } else {
    // Режим создания
    title.textContent = '📝 Добавить Документ';
    if (saveText) saveText.textContent = '💾 Создать Документ';
    
    // Очищаем форму
    form.reset();
    document.getElementById('document-id').value = '';
  }
  
  // Показываем модальное окно
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  
  // Фокусируемся на поле заголовка
  const titleInput = document.getElementById('document-title');
  if (titleInput) {
    setTimeout(() => titleInput.focus(), 300);
  }
}

/**
 * Скрывает редактор документов
 */
function hideDocumentEditor() {
  const overlay = document.getElementById('document-editor-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Загружает документ для редактирования
 * @param {string} documentId - ID документа
 */
async function loadDocumentForEditing(documentId) {
  try {
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/${documentId}`);
    
    if (response.success) {
      const doc = response.data;
      
      // Заполняем форму данными документа
      document.getElementById('document-id').value = doc.id;
      document.getElementById('document-title').value = doc.title;
      document.getElementById('document-category').value = doc.category;
      document.getElementById('document-language').value = doc.language;
      document.getElementById('document-tags').value = doc.tags.join(', ');
      document.getElementById('document-content').value = doc.content;
      
      console.log('🍄 Документ загружен для редактирования');
    } else {
      throw new Error(response.error?.message || 'Не удалось загрузить документ');
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки документа для редактирования:', error);
    showNotification('error', `🍄 Не удалось загрузить документ: ${error.message}`);
    hideDocumentEditor();
  }
}

/**
 * Показывает предпросмотр документа
 */
function showDocumentPreview() {
  const title = document.getElementById('document-title').value.trim();
  const category = document.getElementById('document-category').value;
  const language = document.getElementById('document-language').value;
  const tags = document.getElementById('document-tags').value.trim();
  const content = document.getElementById('document-content').value.trim();
  
  if (!title || !content) {
    showNotification('warning', '🍄 Заполните заголовок и содержимое для предпросмотра');
    return;
  }
  
  // Заполняем предпросмотр
  document.getElementById('preview-title').textContent = title;
  document.getElementById('preview-category').textContent = KNOWLEDGE_CONFIG.CATEGORY_LABELS[category];
  document.getElementById('preview-language').textContent = KNOWLEDGE_CONFIG.LANGUAGE_LABELS[language];
  
  // Обрабатываем теги
  const tagList = tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
  document.getElementById('preview-tags').innerHTML = tagList.length > 0 ?
    tagList.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join(' ') :
    '<span class="text-dim">Нет тегов</span>';
  
  // Рендерим содержимое как Markdown
  document.getElementById('preview-content').innerHTML = renderMarkdown(content);
  
  // Показываем предпросмотр
  const overlay = document.getElementById('document-preview-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
  }
}

/**
 * Скрывает предпросмотр документа
 */
function hideDocumentPreview() {
  const overlay = document.getElementById('document-preview-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Обработчик сохранения документа
 * @param {Event} event - Событие отправки формы
 */
async function handleDocumentSave(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const documentId = formData.get('document-id');
  
  /** @type {KnowledgeDocument} */
  const documentData = {
    title: formData.get('document-title').trim(),
    category: formData.get('document-category'),
    language: formData.get('document-language'),
    tags: formData.get('document-tags').split(',').map(tag => tag.trim()).filter(tag => tag),
    content: formData.get('document-content').trim(),
    status: 'published'
  };
  
  // Валидация
  if (!documentData.title) {
    showNotification('error', '🍄 Заполните название документа');
    return;
  }
  
  if (!documentData.content) {
    showNotification('error', '🍄 Заполните содержимое документа');
    return;
  }
  
  if (documentData.content.length > KNOWLEDGE_CONFIG.MAX_DOCUMENT_SIZE) {
    showNotification('error', `🍄 Документ слишком большой (максимум ${KNOWLEDGE_CONFIG.MAX_DOCUMENT_SIZE} символов)`);
    return;
  }
  
  try {
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    // Показываем состояние загрузки
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = documentId ? '💾 Сохранение...' : '🌱 Создание...';
    
    let response;
    if (documentId) {
      // Обновляем существующий документ
      response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData)
      });
    } else {
      // Создаем новый документ
      response = await makeAuthenticatedRequest(KNOWLEDGE_CONFIG.API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData)
      });
    }
    
    if (response.success) {
      const action = documentId ? 'обновлен' : 'создан';
      showNotification('success', `🍄 Документ успешно ${action} в грибной базе знаний!`);
      
      hideDocumentEditor();
      loadDocuments(); // Перезагружаем список документов
      
      // Запускаем синхронизацию с векторным хранилищем
      syncVectorStore();
      
      console.log(`🍄 Документ ${action}: ${documentData.title}`);
    } else {
      throw new Error(response.error?.message || 'Не удалось сохранить документ');
    }
  } catch (error) {
    console.error('🍄 Ошибка сохранения документа:', error);
    showNotification('error', `🍄 Не удалось сохранить документ: ${error.message}`);
  } finally {
    // Восстанавливаем кнопку
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) {
      btnText.textContent = documentId ? '💾 Сохранить Изменения' : '💾 Создать Документ';
    }
  }
}

/**
 * Просмотр документа (открывает в режиме только чтения)
 * @param {string} documentId - ID документа
 */
function viewDocument(documentId) {
  console.log('🍄 Просмотр документа:', documentId);
  // Можно добавить отдельное модальное окно для просмотра или открыть редактор в режиме только чтения
  editDocument(documentId);
}

/**
 * Редактирование документа
 * @param {string} documentId - ID документа
 */
function editDocument(documentId) {
  console.log('🍄 Редактирование документа:', documentId);
  showDocumentEditor(documentId);
}

/**
 * Удаление документа
 * @param {string} documentId - ID документа
 */
async function deleteDocument(documentId) {
  // Находим документ для отображения названия в подтверждении
  const document = knowledgeState.documents.find(doc => doc.id === documentId);
  const documentTitle = document ? document.title : documentId;
  
  const confirmed = confirm(
    `🍄 Вы уверены, что хотите удалить документ "${documentTitle}" из грибной базы знаний?\n\n` +
    'Это действие нельзя отменить!'
  );
  
  if (!confirmed) return;
  
  try {
    console.log('🍄 Удаление документа:', documentId);
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/${documentId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showNotification('success', '🍄 Документ удален из грибной базы знаний');
      
      loadDocuments(); // Перезагружаем список документов
      
      // Запускаем синхронизацию с векторным хранилищем
      syncVectorStore();
      
      console.log('🍄 Документ успешно удален');
    } else {
      throw new Error(response.error?.message || 'Не удалось удалить документ');
    }
  } catch (error) {
    console.error('🍄 Ошибка удаления документа:', error);
    showNotification('error', `🍄 Не удалось удалить документ: ${error.message}`);
  }
}

/**
 * Инициализация управления RAG
 */
function initRAGControls() {
  console.log('🍄 Настройка управления RAG системой...');
  
  // Синхронизация с векторным хранилищем
  const syncBtn = document.getElementById('sync-vector-store');
  if (syncBtn) {
    syncBtn.addEventListener('click', syncVectorStore);
  }
  
  // Пересборка индекса
  const rebuildBtn = document.getElementById('rebuild-index');
  if (rebuildBtn) {
    rebuildBtn.addEventListener('click', rebuildVectorIndex);
  }
  
  // Тестирование RAG поиска
  const testBtn = document.getElementById('test-rag-search');
  if (testBtn) {
    testBtn.addEventListener('click', showRAGTestModal);
  }
  
  // Диагностика RAG
  const diagnoseBtn = document.getElementById('diagnose-rag');
  if (diagnoseBtn) {
    diagnoseBtn.addEventListener('click', runRAGDiagnosis);
  }
  
  // Управление модальным окном RAG тестирования
  const closeRAGTestBtn = document.getElementById('close-rag-test');
  if (closeRAGTestBtn) {
    closeRAGTestBtn.addEventListener('click', hideRAGTestModal);
  }
  
  const runTestBtn = document.getElementById('run-rag-test');
  if (runTestBtn) {
    runTestBtn.addEventListener('click', runRAGTest);
  }
  
  // Закрытие модального окна по клику на overlay и Escape
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('rag-test-overlay')) {
      hideRAGTestModal();
    }
  });
  
  // Выполнение теста по Enter в поле ввода
  const testQueryInput = document.getElementById('rag-test-query');
  if (testQueryInput) {
    testQueryInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        runRAGTest();
      }
    });
  }
}

/**
 * Синхронизация с векторным хранилищем
 */
async function syncVectorStore() {
  try {
    console.log('🍄 Запуск синхронизации с векторным хранилищем...');
    
    showNotification('info', '🍄 Синхронизация с векторным хранилищем...');
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/sync-vector-store`, {
      method: 'POST'
    });
    
    if (response.success) {
      showNotification('success', '🍄 Синхронизация с Qdrant завершена успешно!');
      
      // Обновляем статистику RAG
      loadRAGStats();
      
      console.log('🍄 Синхронизация завершена');
    } else {
      throw new Error(response.error?.message || 'Не удалось синхронизировать');
    }
  } catch (error) {
    console.error('🍄 Ошибка синхронизации:', error);
    showNotification('error', `🍄 Ошибка синхронизации: ${error.message}`);
  }
}

/**
 * Пересборка векторного индекса
 */
async function rebuildVectorIndex() {
  const confirmed = confirm(
    '🍄 Пересборка индекса может занять несколько минут и временно повлиять на работу бота.\n\n' +
    'Продолжить?'
  );
  
  if (!confirmed) return;
  
  try {
    console.log('🍄 Запуск пересборки векторного индекса...');
    
    showNotification('info', '🍄 Пересборка векторного индекса... Это может занять время.');
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/rebuild-index`, {
      method: 'POST'
    });
    
    if (response.success) {
      showNotification('success', '🍄 Векторный индекс успешно пересобран!');
      
      // Обновляем статистику RAG
      loadRAGStats();
      
      console.log('🍄 Пересборка индекса завершена');
    } else {
      throw new Error(response.error?.message || 'Не удалось пересобрать индекс');
    }
  } catch (error) {
    console.error('🍄 Ошибка пересборки индекса:', error);
    showNotification('error', `🍄 Ошибка пересборки: ${error.message}`);
  }
}

/**
 * Показывает модальное окно тестирования RAG
 */
function showRAGTestModal() {
  const overlay = document.getElementById('rag-test-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    
    // Фокусируемся на поле ввода
    const queryInput = document.getElementById('rag-test-query');
    if (queryInput) {
      setTimeout(() => queryInput.focus(), 300);
    }
  }
}

/**
 * Скрывает модальное окно тестирования RAG
 */
function hideRAGTestModal() {
  const overlay = document.getElementById('rag-test-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Выполняет тест RAG поиска
 */
async function runRAGTest() {
  const queryInput = document.getElementById('rag-test-query');
  const resultsDiv = document.getElementById('rag-test-results');
  
  if (!queryInput || !resultsDiv) return;
  
  const query = queryInput.value.trim();
  if (!query) {
    showNotification('warning', '🍄 Введите тестовый запрос');
    queryInput.focus();
    return;
  }
  
  try {
    console.log('🍄 Выполнение RAG теста для запроса:', query);
    
    resultsDiv.innerHTML = '<div class="loading">🍄 Поиск в грибной мудрости...</div>';
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/test-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 })
    });
    
    if (response.success) {
      const results = response.data.results;
      
      if (results.length === 0) {
        resultsDiv.innerHTML = `
          <div class="test-no-results">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ничего не найдено</div>
            <div class="empty-subtitle">Попробуйте другой запрос или добавьте больше документов в базу знаний</div>
          </div>
        `;
      } else {
        resultsDiv.innerHTML = results.map((result, index) => `
          <div class="test-result">
            <div class="result-header">
              <h5 class="result-title">📄 ${escapeHtml(result.title)}</h5>
              <span class="result-score">Релевантность: ${Math.round(result.score * 100)}%</span>
            </div>
            <div class="result-meta">
              <span class="result-category">${KNOWLEDGE_CONFIG.CATEGORY_LABELS[result.category]}</span>
              <span class="result-language">${KNOWLEDGE_CONFIG.LANGUAGE_LABELS[result.language]}</span>
            </div>
            <div class="result-content">${escapeHtml(result.content.substring(0, 200))}...</div>
          </div>
        `).join('');
      }
      
      console.log(`🍄 RAG тест завершен, найдено ${results.length} результатов`);
    } else {
      throw new Error(response.error?.message || 'Не удалось выполнить поиск');
    }
  } catch (error) {
    console.error('🍄 Ошибка RAG теста:', error);
    resultsDiv.innerHTML = `
      <div class="test-error">
        <div class="error-icon">⚠️</div>
        <div class="error-title">Ошибка поиска</div>
        <div class="error-message">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

/**
 * Выполняет диагностику RAG системы
 */
async function runRAGDiagnosis() {
  try {
    console.log('🍄 Запуск диагностики RAG системы...');
    
    showNotification('info', '🍄 Выполняется диагностика RAG системы...');
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/diagnose`);
    
    if (response.success) {
      const diagnosis = response.data;
      
      // Формируем отчет о диагностике
      let reportMessages = [
        `🔍 Векторное хранилище: ${diagnosis.vectorStore.status}`,
        `📊 Документов в MongoDB: ${diagnosis.mongodb.documentCount}`,
        `🗃️ Документов в Qdrant: ${diagnosis.qdrant.documentCount}`,
        `⚡ Время ответа Qdrant: ${diagnosis.qdrant.responseTime}ms`
      ];
      
      if (diagnosis.issues.length > 0) {
        reportMessages.push('⚠️ Обнаружены проблемы:', ...diagnosis.issues);
      } else {
        reportMessages.push('✅ Проблем не обнаружено');
      }
      
      showNotification('success', reportMessages.join('\n'));
      
      // Обновляем статистику RAG
      loadRAGStats();
      
      console.log('🍄 Диагностика завершена:', diagnosis);
    } else {
      throw new Error(response.error?.message || 'Не удалось выполнить диагностику');
    }
  } catch (error) {
    console.error('🍄 Ошибка диагностики:', error);
    showNotification('error', `🍄 Ошибка диагностики: ${error.message}`);
  }
}

/**
 * Загружает статистику RAG системы
 */
async function loadRAGStats() {
  try {
    console.log('🍄 Загрузка статистики RAG...');
    
    const response = await makeAuthenticatedRequest(`${KNOWLEDGE_CONFIG.API_BASE}/stats`);
    
    if (response.success) {
      knowledgeState.ragStats = response.data;
      updateRAGStatsDisplay();
    } else {
      console.warn('🍄 Не удалось загрузить статистику RAG:', response.error?.message);
      // Показываем заглушки
      updateRAGStatsDisplay(null);
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки статистики RAG:', error);
    updateRAGStatsDisplay(null);
  }
}

/**
 * Обновляет отображение статистики RAG
 * @param {RAGStats|null} stats - Статистика или null для заглушек
 */
function updateRAGStatsDisplay(stats = knowledgeState.ragStats) {
  const elements = {
    lastIndexed: document.getElementById('rag-last-indexed'),
    docsCount: document.getElementById('rag-docs-count'),
    vectorStore: document.getElementById('rag-vector-store'),
    embeddingModel: document.getElementById('rag-embedding-model'),
    syncStatus: document.getElementById('rag-sync-status')
  };
  
  if (stats) {
    if (elements.lastIndexed) {
      elements.lastIndexed.textContent = formatRelativeTime(stats.lastIndexed);
    }
    if (elements.docsCount) {
      elements.docsCount.textContent = stats.totalDocuments.toString();
    }
    if (elements.vectorStore) {
      elements.vectorStore.textContent = stats.vectorStore;
    }
    if (elements.embeddingModel) {
      elements.embeddingModel.textContent = stats.embeddingModel;
    }
    if (elements.syncStatus) {
      elements.syncStatus.textContent = stats.syncStatus;
      elements.syncStatus.className = `status-badge status-${stats.syncStatus === 'synchronized' ? 'success' : 'warning'}`;
    }
  } else {
    // Заглушки
    if (elements.lastIndexed) elements.lastIndexed.textContent = 'Неизвестно';
    if (elements.docsCount) elements.docsCount.textContent = knowledgeState.totalDocuments.toString();
    if (elements.vectorStore) elements.vectorStore.textContent = 'Qdrant (локальный)';
    if (elements.embeddingModel) elements.embeddingModel.textContent = 'text-embedding-ada-002';
    if (elements.syncStatus) {
      elements.syncStatus.textContent = 'Неизвестно';
      elements.syncStatus.className = 'status-badge status-unknown';
    }
  }
}

/**
 * Обновляет количество документов в RAG статистике
 * @param {number} count - Количество документов
 */
function updateRAGDocumentCount(count) {
  const element = document.getElementById('rag-docs-count');
  if (element) {
    element.textContent = count.toString();
  }
}

/**
 * Инициализация управления доходностью фарминга
 */
function initFarmingRateControl() {
  console.log('🍄 Настройка управления доходностью фарминга...');
  
  const farmingForm = document.getElementById('farming-rate-form');
  if (farmingForm) {
    farmingForm.addEventListener('submit', handleFarmingRateUpdate);
  }
}

/**
 * Загружает текущую доходность фарминга
 */
async function loadFarmingRate() {
  try {
    console.log('🍄 Загрузка текущей доходности фарминга...');
    
    const response = await makeAuthenticatedRequest('/api/admin/farming-rate');
    
    if (response.success) {
      knowledgeState.farmingRate = response.data;
      updateFarmingRateDisplay();
    } else {
      console.warn('🍄 Не удалось загрузить доходность фарминга:', response.error?.message);
      // Показываем заглушки
      updateFarmingRateDisplay(null);
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки доходности фарминга:', error);
    updateFarmingRateDisplay(null);
  }
}

/**
 * Обновляет отображение доходности фарминга
 * @param {FarmingRate|null} rate - Данные доходности или null для заглушек
 */
function updateFarmingRateDisplay(rate = knowledgeState.farmingRate) {
  const rateInput = document.getElementById('farming-rate');
  const lastUpdatedElement = document.getElementById('farming-last-updated');
  
  if (rate) {
    if (rateInput) {
      rateInput.value = rate.rate.toString();
    }
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = formatRelativeTime(rate.lastUpdated);
    }
  } else {
    // Заглушки
    if (rateInput) {
      rateInput.value = '12.5'; // Значение по умолчанию
    }
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = 'Неизвестно';
    }
  }
}

/**
 * Обработчик обновления доходности фарминга
 * @param {Event} event - Событие отправки формы
 */
async function handleFarmingRateUpdate(event) {
  event.preventDefault();
  
  const rateInput = document.getElementById('farming-rate');
  const rate = parseFloat(rateInput.value);
  
  // Валидация
  if (isNaN(rate) || rate < 0 || rate > 100) {
    showNotification('error', '🍄 Введите корректную доходность от 0 до 100%');
    rateInput.focus();
    return;
  }
  
  try {
    console.log('🍄 Обновление доходности фарминга до', rate + '%');
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    // Показываем состояние загрузки
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = '🌱 Обновление...';
    
    const response = await makeAuthenticatedRequest('/api/admin/farming-rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate })
    });
    
    if (response.success) {
      knowledgeState.farmingRate = response.data;
      
      // Обновляем отображение времени последнего обновления
      const lastUpdatedElement = document.getElementById('farming-last-updated');
      if (lastUpdatedElement) {
        lastUpdatedElement.textContent = 'только что';
      }
      
      showNotification('success', `🍄 Доходность фарминга обновлена до ${rate}%!`);
      
      console.log('🍄 Доходность фарминга успешно обновлена');
    } else {
      throw new Error(response.error?.message || 'Не удалось обновить доходность');
    }
  } catch (error) {
    console.error('🍄 Ошибка обновления доходности:', error);
    showNotification('error', `🍄 Не удалось обновить доходность: ${error.message}`);
  } finally {
    // Восстанавливаем кнопку
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = '🚀 Обновить Доходность';
  }
}

/**
 * Инициализация пагинации
 */
function initPagination() {
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (knowledgeState.currentFilters.page > 1) {
        knowledgeState.currentFilters.page--;
        loadDocuments();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(knowledgeState.totalDocuments / knowledgeState.currentFilters.limit);
      if (knowledgeState.currentFilters.page < totalPages) {
        knowledgeState.currentFilters.page++;
        loadDocuments();
      }
    });
  }
}

/**
 * Обновляет информацию о пагинации
 */
function updatePaginationInfo() {
  const rangeElement = document.getElementById('pagination-range');
  const totalElement = document.getElementById('pagination-total');
  const currentElement = document.getElementById('pagination-current');
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  const { page, limit } = knowledgeState.currentFilters;
  const total = knowledgeState.totalDocuments;
  const totalPages = Math.ceil(total / limit);
  
  // Вычисляем диапазон отображаемых документов
  const start = total > 0 ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);
  
  // Обновляем элементы
  if (rangeElement) rangeElement.textContent = `${start}-${end}`;
  if (totalElement) totalElement.textContent = total.toString();
  if (currentElement) currentElement.textContent = total > 0 ? `Страница ${page} из ${totalPages}` : 'Страница 0 из 0';
  
  // Обновляем состояние кнопок
  if (prevBtn) {
    prevBtn.disabled = page <= 1;
  }
  if (nextBtn) {
    nextBtn.disabled = page >= totalPages || total === 0;
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

/**
 * Выполняет аутентифицированный запрос к API
 * @param {string} url - URL для запроса
 * @param {RequestInit} [options] - Дополнительные опции запроса
 * @returns {Promise<ApiResponse>} Ответ API
 */
async function makeAuthenticatedRequest(url, options = {}) {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    throw new Error('Токен аутентификации не найден');
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Проверяем авторизацию
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    window.location.href = 'login.html';
    throw new Error('Сессия истекла, требуется повторная авторизация');
  }
  
  const result = await response.json();
  return result;
}

/**
 * Экранирует HTML в строке
 * @param {string} str - Строка для экранирования
 * @returns {string} Экранированная строка
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Форматирует время в относительном формате
 * @param {string} dateString - Строка даты в ISO формате
 * @returns {string} Относительное время (например, "2 часа назад")
 */
function formatRelativeTime(dateString) {
  if (!dateString) return 'Неизвестно';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'только что';
    if (diffMinutes < 60) return `${diffMinutes} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;
    
    return date.toLocaleDateString('ru-RU');
  } catch (error) {
    return 'Неизвестно';
  }
}

/**
 * Простой рендеринг Markdown в HTML
 * @param {string} markdown - Текст в формате Markdown
 * @returns {string} HTML код
 */
function renderMarkdown(markdown) {
  return markdown
    // Заголовки
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Жирный и курсив
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Код
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```([^```]+)```/g, '<pre><code>$1</code></pre>')
    
    // Ссылки
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    
    // Списки
    .replace(/^\* (.+$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.+$)/gim, '<li>$2</li>')
    
    // Переносы строк
    .replace(/\n/g, '<br>');
}

/**
 * Показывает уведомление пользователю
 * @param {string} type - Тип уведомления (success|error|warning|info)
 * @param {string} message - Текст сообщения
 * @param {number} [duration=5000] - Длительность показа в миллисекундах
 */
function showNotification(type, message, duration = 5000) {
  const container = document.getElementById('notification-container');
  if (!container) {
    // Fallback к alert если контейнер не найден
    alert(message);
    return;
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // Иконки для разных типов уведомлений
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  notification.innerHTML = `
    <div class="notification-icon">${icons[type] || '🍄'}</div>
    <div class="notification-message">${escapeHtml(message)}</div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  container.appendChild(notification);
  
  // Показываем уведомление с анимацией
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Автоматически скрываем уведомление
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, duration);
}

// Экспорт основной функции для использования в HTML
window.initKnowledgePage = initKnowledgePage;

// Экспорт вспомогательных функций для использования в других модулях или HTML
window.showDocumentEditor = showDocumentEditor;
window.editDocument = editDocument;
window.deleteDocument = deleteDocument;
window.viewDocument = viewDocument;