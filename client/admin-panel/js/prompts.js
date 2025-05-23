/**
 * prompts.js - система управления промптами для Shrooms AI Support Bot
 * 
 * Этот модуль отвечает за взаимодействие с API промптов,
 * управление промптами и тестирование через Claude API.
 * 
 * @fileoverview Управление грибными промптами для AI ассистента
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} PromptData
 * @property {string} [id] - Уникальный идентификатор промпта
 * @property {string} name - Название промпта
 * @property {string} type - Тип промпта (basic|rag|ticket_detection|categorization|subject)
 * @property {string} category - Категория (system|safety|language|custom)
 * @property {string} language - Язык (en|ru|es|all)
 * @property {string} content - Содержимое промпта
 * @property {string} [description] - Описание промпта
 * @property {number} [maxTokens] - Максимальное количество токенов
 * @property {string[]} [tags] - Массив тегов
 * @property {boolean} [active] - Активен ли промпт
 * @property {boolean} [isDefault] - Системный ли промпт
 * @property {number} [version] - Версия промпта
 * @property {string} [createdAt] - Дата создания
 * @property {string} [updatedAt] - Дата последнего обновления
 */

/**
 * @typedef {Object} PromptFilter
 * @property {string} [category] - Фильтр по категории ('all' для всех)
 * @property {string} [type] - Фильтр по типу ('all' для всех)
 * @property {string} [language] - Фильтр по языку ('all' для всех)
 * @property {string} [search] - Поисковый запрос
 * @property {number} [page] - Номер страницы для пагинации
 * @property {number} [limit] - Количество промптов на странице
 */

/**
 * @typedef {Object} TestResult
 * @property {string} input - Входное сообщение
 * @property {string} output - Результат от Claude
 * @property {number} tokensUsed - Использованные токены
 * @property {string} provider - AI провайдер
 * @property {string} testedAt - Время тестирования
 * @property {boolean} successful - Успешность теста
 */

/**
 * Конфигурация модуля управления промптами
 */
const PROMPTS_CONFIG = {
  /** @type {string} Базовый URL для API запросов */
  API_BASE: '/api/prompts',
  
  /** @type {number} Количество промптов на странице по умолчанию */
  DEFAULT_PAGE_SIZE: 10,
  
  /** @type {number} Максимальный размер промпта в символах */
  MAX_PROMPT_SIZE: 10000,
  
  /** @type {Object<string, string>} Переводы категорий */
  CATEGORY_LABELS: {
    'system': 'Системная',
    'safety': 'Безопасность',
    'language': 'Языковая',
    'custom': 'Пользовательская'
  },
  
  /** @type {Object<string, string>} Переводы типов */
  TYPE_LABELS: {
    'basic': 'Базовый',
    'rag': 'RAG',
    'ticket_detection': 'Детекция тикетов',
    'categorization': 'Категоризация',
    'subject': 'Темы'
  },
  
  /** @type {Object<string, string>} Переводы языков */
  LANGUAGE_LABELS: {
    'en': 'English',
    'ru': 'Русский',
    'es': 'Español',
    'all': 'Все языки'
  }
};

/**
 * Состояние модуля управления промптами
 */
const promptsState = {
  /** @type {PromptData[]} Загруженные промпты */
  prompts: [],
  
  /** @type {PromptFilter} Текущие фильтры */
  currentFilters: {
    category: 'all',
    type: 'all',
    language: 'all',
    search: '',
    page: 1,
    limit: PROMPTS_CONFIG.DEFAULT_PAGE_SIZE
  },
  
  /** @type {number} Общее количество промптов */
  totalPrompts: 0,
  
  /** @type {boolean} Идет ли загрузка */
  isLoading: false,
  
  /** @type {Object|null} Статистика промптов */
  stats: null
};

/**
 * Инициализация страницы управления промптами
 * Основная точка входа после проверки аутентификации
 */
function initPromptsPage() {
  console.log('🍄 Инициализация управления грибными промптами...');
  
  try {
    // Инициализируем компоненты интерфейса
    initPromptsFilters();
    initPromptEditor();
    initPromptTesting();
    initImportExport();
    initPagination();
    
    // Загружаем начальные данные
    loadPrompts();
    loadPromptsStats();
    
    console.log('🍄 Управление промптами готово к созданию мудрости!');
  } catch (error) {
    console.error('🍄 Ошибка инициализации управления промптами:', error);
    showNotification('error', '🍄 Не удалось инициализировать управление промптами');
  }
}

/**
 * Инициализация фильтров и поиска
 */
function initPromptsFilters() {
  console.log('🍄 Настройка фильтров грибных промптов...');
  
  const categoryFilter = document.getElementById('category-filter');
  const typeFilter = document.getElementById('type-filter');
  const languageFilter = document.getElementById('language-filter');
  const searchInput = document.getElementById('search-prompts');
  
  // Обработчик изменения категории
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      promptsState.currentFilters.category = categoryFilter.value;
      promptsState.currentFilters.page = 1;
      loadPrompts();
    });
  }
  
  // Обработчик изменения типа
  if (typeFilter) {
    typeFilter.addEventListener('change', () => {
      promptsState.currentFilters.type = typeFilter.value;
      promptsState.currentFilters.page = 1;
      loadPrompts();
    });
  }
  
  // Обработчик изменения языка
  if (languageFilter) {
    languageFilter.addEventListener('change', () => {
      promptsState.currentFilters.language = languageFilter.value;
      promptsState.currentFilters.page = 1;
      loadPrompts();
    });
  }
  
  // Обработчик поиска с задержкой
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        promptsState.currentFilters.search = searchInput.value.trim();
        promptsState.currentFilters.page = 1;
        loadPrompts();
      }, 500);
    });
  }
}

/**
 * Загружает промпты с применением фильтров
 * @returns {Promise<void>}
 */
async function loadPrompts() {
  if (promptsState.isLoading) return;
  
  console.log('🍄 Загрузка промптов из грибного хранилища...');
  
  try {
    promptsState.isLoading = true;
    updateLoadingState(true);
    
    // Формируем параметры запроса
    const params = new URLSearchParams();
    
    if (promptsState.currentFilters.category && promptsState.currentFilters.category !== 'all') {
      params.append('category', promptsState.currentFilters.category);
    }
    
    if (promptsState.currentFilters.type && promptsState.currentFilters.type !== 'all') {
      params.append('type', promptsState.currentFilters.type);
    }
    
    if (promptsState.currentFilters.language && promptsState.currentFilters.language !== 'all') {
      params.append('language', promptsState.currentFilters.language);
    }
    
    if (promptsState.currentFilters.search) {
      // Используем search endpoint
      params.append('q', promptsState.currentFilters.search);
      const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/search?${params}`);
      
      if (response.success) {
        promptsState.prompts = response.data || [];
        promptsState.totalPrompts = response.count || 0;
        renderPromptsTable();
        updatePaginationInfo();
        console.log(`🍄 Найдено ${promptsState.prompts.length} промптов по запросу "${promptsState.currentFilters.search}"`);
      } else {
        throw new Error(response.error?.message || 'Не удалось найти промпты');
      }
    } else {
      // Обычный запрос с пагинацией
      params.append('page', promptsState.currentFilters.page.toString());
      params.append('limit', promptsState.currentFilters.limit.toString());
      
      const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}?${params}`);
      
      if (response.success) {
        promptsState.prompts = response.data || [];
        promptsState.totalPrompts = response.pagination?.total || 0;
        renderPromptsTable();
        updatePaginationInfo();
        console.log(`🍄 Загружено ${promptsState.prompts.length} промптов из ${promptsState.totalPrompts} общих`);
      } else {
        throw new Error(response.error?.message || 'Не удалось загрузить промпты');
      }
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки промптов:', error);
    showNotification('error', `🍄 Не удалось загрузить промпты: ${error.message}`);
    renderEmptyPromptsTable();
  } finally {
    promptsState.isLoading = false;
    updateLoadingState(false);
  }
}

/**
 * Отображает состояние загрузки в интерфейсе
 * @param {boolean} isLoading - Идет ли загрузка
 */
function updateLoadingState(isLoading) {
  const tbody = document.querySelector('#prompts-table tbody');
  if (!tbody) return;
  
  if (isLoading) {
    tbody.innerHTML = `
      <tr class="table-loading">
        <td colspan="9" style="text-align: center; padding: var(--spacing-lg);">
          <div class="loading-spinner"></div>
          🍄 Споры мудрости прорастают в промпты...
        </td>
      </tr>
    `;
  }
}

/**
 * Отображает таблицу промптов
 */
function renderPromptsTable() {
  const tbody = document.querySelector('#prompts-table tbody');
  if (!tbody) return;
  
  if (promptsState.prompts.length === 0) {
    renderEmptyPromptsTable();
    return;
  }
  
  tbody.innerHTML = promptsState.prompts.map(prompt => `
    <tr class="prompt-row" onclick="viewPrompt('${prompt.id}')">
      <td class="col-id">${prompt.id.substring(0, 8)}...</td>
      <td class="col-name">
        <div class="prompt-name">${escapeHtml(prompt.name)}</div>
        ${prompt.isDefault ? '<span class="status-badge status-system">Системный</span>' : ''}
      </td>
      <td class="col-category">
        <span class="category-badge category-${prompt.category}">
          ${PROMPTS_CONFIG.CATEGORY_LABELS[prompt.category] || prompt.category}
        </span>
      </td>
      <td class="col-type">
        <span class="type-badge type-${prompt.type}">
          ${PROMPTS_CONFIG.TYPE_LABELS[prompt.type] || prompt.type}
        </span>
      </td>
      <td class="col-language">
        <span class="language-badge language-${prompt.language}">
          ${PROMPTS_CONFIG.LANGUAGE_LABELS[prompt.language] || prompt.language}
        </span>
      </td>
      <td class="col-status">
        <span class="status-badge ${prompt.active ? 'status-active' : 'status-inactive'}">
          ${prompt.active ? 'Активный' : 'Неактивный'}
        </span>
      </td>
      <td class="col-tokens">${prompt.maxTokens || '--'}</td>
      <td class="col-version">v${prompt.version || '1.0'}</td>
      <td class="col-actions">
        <div class="action-buttons">
          <button class="action-test" onclick="testPrompt('${prompt.id}'); event.stopPropagation();" 
                  title="Тестировать промпт">
            🧪
          </button>
          <button class="action-edit" onclick="editPrompt('${prompt.id}'); event.stopPropagation();" 
                  title="Редактировать промпт">
            ✏️
          </button>
          ${!prompt.isDefault ? `
            <button class="action-delete" onclick="deletePrompt('${prompt.id}'); event.stopPropagation();"
                    title="Удалить промпт">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Отображает пустую таблицу промптов
 */
function renderEmptyPromptsTable() {
  const tbody = document.querySelector('#prompts-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr class="table-empty">
      <td colspan="9" style="text-align: center; padding: var(--spacing-xl);">
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <div class="empty-title">Пока нет промптов в этой части мицелия</div>
          <div class="empty-subtitle">
            ${promptsState.currentFilters.search ? 
              `По запросу "${promptsState.currentFilters.search}" ничего не найдено` :
              'Создайте первый промпт для грибного ИИ'}
          </div>
          <button class="btn btn-primary btn-glow" onclick="showPromptEditor()">
            ✨ Создать Промпт
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Инициализация редактора промптов
 */
function initPromptEditor() {
  console.log('🍄 Настройка редактора грибных промптов...');
  
  // Кнопка добавления промпта
  const addPromptBtn = document.getElementById('add-prompt');
  if (addPromptBtn) {
    addPromptBtn.addEventListener('click', () => showPromptEditor());
  }
  
  // Кнопки закрытия модальных окон
  const closeEditorBtn = document.getElementById('close-prompt-editor');
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', hidePromptEditor);
  }
  
  // Форма промпта
  const promptForm = document.getElementById('prompt-form');
  if (promptForm) {
    promptForm.addEventListener('submit', handlePromptSave);
  }
  
  // Счетчик токенов
  const contentTextarea = document.getElementById('prompt-content');
  if (contentTextarea) {
    contentTextarea.addEventListener('input', updateTokenCount);
  }
  
  // Тестирование текущего промпта
  const testCurrentBtn = document.getElementById('test-current-prompt');
  if (testCurrentBtn) {
    testCurrentBtn.addEventListener('click', testCurrentPrompt);
  }
  
  // Закрытие модальных окон по клику на overlay
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('prompt-editor-overlay')) {
      hidePromptEditor();
    }
  });
  
  // Закрытие по Escape
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (document.getElementById('prompt-editor-overlay').style.display === 'flex') {
        hidePromptEditor();
      }
    }
  });
}

/**
 * Показывает редактор промптов
 * @param {string|null} promptId - ID промпта для редактирования (null для создания нового)
 */
function showPromptEditor(promptId = null) {
  console.log('🍄 Открытие редактора промптов:', promptId ? 'редактирование' : 'создание');
  
  const overlay = document.getElementById('prompt-editor-overlay');
  const title = document.getElementById('editor-title');
  const form = document.getElementById('prompt-form');
  const saveText = document.getElementById('save-prompt-text');
  
  if (!overlay || !title || !form) return;
  
  if (promptId) {
    // Режим редактирования
    title.textContent = '✏️ Редактировать Промпт';
    if (saveText) saveText.textContent = '💾 Сохранить Изменения';
    
    // Загружаем данные промпта
    loadPromptForEditing(promptId);
  } else {
    // Режим создания
    title.textContent = '✨ Создать Промпт';
    if (saveText) saveText.textContent = '💾 Создать Промпт';
    
    // Очищаем форму
    form.reset();
    document.getElementById('prompt-id').value = '';
    updateTokenCount();
  }
  
  // Показываем модальное окно
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
  
  // Фокусируемся на поле названия
  const nameInput = document.getElementById('prompt-name');
  if (nameInput) {
    setTimeout(() => nameInput.focus(), 300);
  }
}

/**
 * Скрывает редактор промптов
 */
function hidePromptEditor() {
  const overlay = document.getElementById('prompt-editor-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Загружает промпт для редактирования
 * @param {string} promptId - ID промпта
 */
async function loadPromptForEditing(promptId) {
  try {
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/${promptId}`);
    
    if (response.success) {
      const prompt = response.data;
      
      // Заполняем форму данными промпта
      document.getElementById('prompt-id').value = prompt.id;
      document.getElementById('prompt-name').value = prompt.name;
      document.getElementById('prompt-type').value = prompt.type;
      document.getElementById('prompt-category').value = prompt.category;
      document.getElementById('prompt-language').value = prompt.language;
      document.getElementById('prompt-max-tokens').value = prompt.maxTokens || 1000;
      document.getElementById('prompt-description').value = prompt.description || '';
      document.getElementById('prompt-content').value = prompt.content;
      document.getElementById('prompt-tags').value = prompt.tags ? prompt.tags.join(', ') : '';
      
      updateTokenCount();
      
      console.log('🍄 Промпт загружен для редактирования');
    } else {
      throw new Error(response.error?.message || 'Не удалось загрузить промпт');
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки промпта для редактирования:', error);
    showNotification('error', `🍄 Не удалось загрузить промпт: ${error.message}`);
    hidePromptEditor();
  }
}

/**
 * Обновляет счетчик токенов
 */
function updateTokenCount() {
  const contentTextarea = document.getElementById('prompt-content');
  const tokenCountSpan = document.getElementById('token-count');
  
  if (!contentTextarea || !tokenCountSpan) return;
  
  const content = contentTextarea.value;
  // Простая оценка токенов (1 токен ≈ 4 символа)
  const estimatedTokens = Math.ceil(content.length / 4);
  
  tokenCountSpan.textContent = estimatedTokens;
  
  // Цветовая индикация
  const maxTokens = parseInt(document.getElementById('prompt-max-tokens')?.value || '1000');
  if (estimatedTokens > maxTokens) {
    tokenCountSpan.style.color = 'var(--color-error)';
  } else if (estimatedTokens > maxTokens * 0.8) {
    tokenCountSpan.style.color = 'var(--color-warning)';
  } else {
    tokenCountSpan.style.color = 'var(--color-success)';
  }
}

/**
 * Обработчик сохранения промпта
 * @param {Event} event - Событие отправки формы
 */
async function handlePromptSave(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const promptId = formData.get('prompt-id');
  
  /** @type {PromptData} */
  const promptData = {
    name: formData.get('prompt-name').trim(),
    type: formData.get('prompt-type'),
    category: formData.get('prompt-category'),
    language: formData.get('prompt-language'),
    content: formData.get('prompt-content').trim(),
    description: formData.get('prompt-description').trim(),
    maxTokens: parseInt(formData.get('prompt-max-tokens')),
    tags: formData.get('prompt-tags').split(',').map(tag => tag.trim()).filter(tag => tag)
  };
  
  // Валидация
  if (!promptData.name) {
    showNotification('error', '🍄 Заполните название промпта');
    return;
  }
  
  if (!promptData.content) {
    showNotification('error', '🍄 Заполните содержимое промпта');
    return;
  }
  
  if (promptData.content.length > PROMPTS_CONFIG.MAX_PROMPT_SIZE) {
    showNotification('error', `🍄 Промпт слишком большой (максимум ${PROMPTS_CONFIG.MAX_PROMPT_SIZE} символов)`);
    return;
  }
  
  try {
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    // Показываем состояние загрузки
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = promptId ? '💾 Сохранение...' : '🌱 Создание...';
    
    let response;
    if (promptId) {
      // Обновляем существующий промпт
      response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/${promptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptData)
      });
    } else {
      // Создаем новый промпт
      response = await makeAuthenticatedRequest(PROMPTS_CONFIG.API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptData)
      });
    }
    
    if (response.success) {
      const action = promptId ? 'обновлен' : 'создан';
      showNotification('success', `🍄 Промпт успешно ${action} в грибном хранилище мудрости!`);
      
      hidePromptEditor();
      loadPrompts(); // Перезагружаем список промптов
      
      console.log(`🍄 Промпт ${action}: ${promptData.name}`);
    } else {
      throw new Error(response.error?.message || 'Не удалось сохранить промпт');
    }
  } catch (error) {
    console.error('🍄 Ошибка сохранения промпта:', error);
    showNotification('error', `🍄 Не удалось сохранить промпт: ${error.message}`);
  } finally {
    // Восстанавливаем кнопку
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) {
      btnText.textContent = promptId ? '💾 Сохранить Изменения' : '💾 Создать Промпт';
    }
  }
}

/**
 * Инициализация тестирования промптов
 */
function initPromptTesting() {
  console.log('🍄 Настройка тестирования грибных промптов...');
  
  // Кнопка общего тестирования
  const testPromptsBtn = document.getElementById('test-prompts');
  if (testPromptsBtn) {
    testPromptsBtn.addEventListener('click', showPromptTestModal);
  }
  
  // Закрытие модального окна тестирования
  const closeTestBtn = document.getElementById('close-prompt-test');
  if (closeTestBtn) {
    closeTestBtn.addEventListener('click', hidePromptTestModal);
  }
  
  // Выполнение теста
  const runTestBtn = document.getElementById('run-prompt-test');
  if (runTestBtn) {
    runTestBtn.addEventListener('click', runPromptTest);
  }
  
  // Закрытие модального окна по клику на overlay
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('prompt-test-overlay')) {
      hidePromptTestModal();
    }
  });
  
  // Выполнение теста по Enter в поле ввода
  const testMessageInput = document.getElementById('test-message');
  if (testMessageInput) {
    testMessageInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        runPromptTest();
      }
    });
  }
}

/**
 * Показывает модальное окно тестирования промптов
 */
function showPromptTestModal() {
  const overlay = document.getElementById('prompt-test-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    
    // Фокусируемся на поле ввода
    const messageInput = document.getElementById('test-message');
    if (messageInput) {
      setTimeout(() => messageInput.focus(), 300);
    }
  }
}

/**
 * Скрывает модальное окно тестирования промптов
 */
function hidePromptTestModal() {
  const overlay = document.getElementById('prompt-test-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Тестирует текущий промпт в редакторе
 */
function testCurrentPrompt() {
  const content = document.getElementById('prompt-content').value.trim();
  if (!content) {
    showNotification('warning', '🍄 Заполните содержимое промпта для тестирования');
    return;
  }
  
  // Показываем модальное окно тестирования
  showPromptTestModal();
}

/**
 * Выполняет тест промпта
 */
async function runPromptTest() {
  const messageInput = document.getElementById('test-message');
  const languageSelect = document.getElementById('test-language');
  const resultsDiv = document.getElementById('test-results');
  const metadataDiv = document.getElementById('test-metadata');
  
  if (!messageInput || !resultsDiv) return;
  
  const testMessage = messageInput.value.trim();
  const language = languageSelect?.value || 'en';
  
  if (!testMessage) {
    showNotification('warning', '🍄 Введите тестовое сообщение');
    messageInput.focus();
    return;
  }
  
  // Получаем промпт для тестирования
  let promptContent;
  const promptEditor = document.getElementById('prompt-content');
  
  if (promptEditor && promptEditor.value.trim()) {
    // Тестируем промпт из редактора
    promptContent = promptEditor.value.trim();
  } else {
    showNotification('warning', '🍄 Нет промпта для тестирования');
    return;
  }
  
  try {
    console.log('🍄 Выполнение теста промпта...');
    
    resultsDiv.innerHTML = '<div class="loading">🍄 Тестирование грибной мудрости...</div>';
    if (metadataDiv) metadataDiv.style.display = 'none';
    
    const startTime = performance.now();
    
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptContent,
        testMessage,
        language
      })
    });
    
    const endTime = performance.now();
    const executionTime = Math.round(endTime - startTime);
    
    if (response.success && response.data) {
      const result = response.data;
      
      resultsDiv.innerHTML = `
        <div class="test-result-success">
          <div class="result-header">
            <h5>📋 Результат тестирования</h5>
            <span class="result-status status-success">Успешно</span>
          </div>
          <div class="result-content">
            <div class="result-input">
              <strong>Входное сообщение:</strong>
              <p>${escapeHtml(result.input)}</p>
            </div>
            <div class="result-output">
              <strong>Ответ от Claude:</strong>
              <p>${escapeHtml(result.output)}</p>
            </div>
          </div>
        </div>
      `;
      
      // Показываем метаданные
      if (metadataDiv) {
        document.getElementById('test-tokens-used').textContent = result.tokensUsed || '--';
        document.getElementById('test-execution-time').textContent = `${executionTime}ms`;
        document.getElementById('test-ai-provider').textContent = result.provider || 'Claude';
        metadataDiv.style.display = 'block';
      }
      
      console.log('🍄 Тест промпта завершен успешно');
    } else {
      throw new Error(response.error?.message || 'Не удалось выполнить тест');
    }
  } catch (error) {
    console.error('🍄 Ошибка теста промпта:', error);
    resultsDiv.innerHTML = `
      <div class="test-result-error">
        <div class="result-header">
          <h5>⚠️ Ошибка тестирования</h5>
          <span class="result-status status-error">Ошибка</span>
        </div>
        <div class="error-content">
          <p>${escapeHtml(error.message)}</p>
        </div>
      </div>
    `;
    
    if (metadataDiv) metadataDiv.style.display = 'none';
  }
}

/**
 * Тестирует конкретный промпт из таблицы
 * @param {string} promptId - ID промпта
 */
function testPrompt(promptId) {
  console.log('🍄 Тестирование промпта:', promptId);
  
  // Загружаем промпт в редактор для тестирования
  loadPromptForEditing(promptId).then(() => {
    showPromptTestModal();
  }).catch(error => {
    console.error('🍄 Ошибка загрузки промпта для тестирования:', error);
    showNotification('error', '🍄 Не удалось загрузить промпт для тестирования');
  });
}

/**
 * Инициализация импорта/экспорта
 */
function initImportExport() {
  console.log('🍄 Настройка импорта/экспорта промптов...');
  
  // Кнопки экспорта и импорта
  const exportBtn = document.getElementById('export-prompts');
  const importBtn = document.getElementById('import-prompts');
  
  if (exportBtn) {
    exportBtn.addEventListener('click', () => showImportExportModal('export'));
  }
  
  if (importBtn) {
    importBtn.addEventListener('click', () => showImportExportModal('import'));
  }
  
  // Закрытие модального окна
  const closeImportExportBtn = document.getElementById('close-import-export');
  if (closeImportExportBtn) {
    closeImportExportBtn.addEventListener('click', hideImportExportModal);
  }
  
  // Обработчики импорта/экспорта
  const downloadBackupBtn = document.getElementById('download-backup');
  if (downloadBackupBtn) {
    downloadBackupBtn.addEventListener('click', downloadPromptsBackup);
  }
  
  const selectFileBtn = document.getElementById('select-import-file');
  const importFileInput = document.getElementById('import-file');
  const confirmImportBtn = document.getElementById('confirm-import');
  
  if (selectFileBtn && importFileInput) {
    selectFileBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', handleFileSelection);
  }
  
  if (confirmImportBtn) {
    confirmImportBtn.addEventListener('click', importPrompts);
  }
  
  // Закрытие по клику на overlay
  document.addEventListener('click', (event) => {
    if (event.target.classList.contains('import-export-overlay')) {
      hideImportExportModal();
    }
  });
}

/**
 * Показывает модальное окно импорта/экспорта
 * @param {string} mode - Режим: 'import' или 'export'
 */
function showImportExportModal(mode) {
  const overlay = document.getElementById('import-export-overlay');
  const title = document.getElementById('import-export-title');
  const exportContent = document.getElementById('export-content');
  const importContent = document.getElementById('import-content');
  
  if (!overlay) return;
  
  if (mode === 'export') {
    if (title) title.textContent = '📤 Экспорт Промптов';
    if (exportContent) exportContent.style.display = 'block';
    if (importContent) importContent.style.display = 'none';
  } else {
    if (title) title.textContent = '📥 Импорт Промптов';
    if (exportContent) exportContent.style.display = 'none';
    if (importContent) importContent.style.display = 'block';
  }
  
  overlay.style.display = 'flex';
  setTimeout(() => overlay.classList.add('active'), 10);
}

/**
 * Скрывает модальное окно импорта/экспорта
 */
function hideImportExportModal() {
  const overlay = document.getElementById('import-export-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

/**
 * Скачивает резервную копию промптов
 */
async function downloadPromptsBackup() {
  try {
    console.log('🍄 Создание резервной копии промптов...');
    showNotification('info', '🍄 Создание резервной копии...');
    
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/backup`);
    
    if (response) {
      // Создаем blob и скачиваем файл
      const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shrooms-prompts-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('success', '🍄 Резервная копия промптов скачана!');
      console.log('🍄 Резервная копия создана успешно');
    } else {
      throw new Error('Не удалось создать резервную копию');
    }
  } catch (error) {
    console.error('🍄 Ошибка создания резервной копии:', error);
    showNotification('error', `🍄 Ошибка создания резервной копии: ${error.message}`);
  }
}

/**
 * Обрабатывает выбор файла для импорта
 * @param {Event} event - Событие выбора файла
 */
function handleFileSelection(event) {
  const file = event.target.files[0];
  const fileInfoDiv = document.getElementById('selected-file-info');
  const confirmBtn = document.getElementById('confirm-import');
  
  if (!file) return;
  
  if (file.type !== 'application/json') {
    showNotification('error', '🍄 Выберите JSON файл');
    return;
  }
  
  if (fileInfoDiv) {
    fileInfoDiv.innerHTML = `
      <div class="file-info-content">
        <span class="file-name">📄 ${file.name}</span>
        <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
      </div>
    `;
    fileInfoDiv.style.display = 'block';
  }
  
  if (confirmBtn) {
    confirmBtn.style.display = 'block';
  }
}

/**
 * Импортирует промпты из файла
 */
async function importPrompts() {
  const fileInput = document.getElementById('import-file');
  const file = fileInput?.files[0];
  
  if (!file) {
    showNotification('error', '🍄 Выберите файл для импорта');
    return;
  }
  
  try {
    console.log('🍄 Импорт промптов из файла...');
    showNotification('info', '🍄 Импорт промптов...');
    
    // Читаем файл
    const text = await file.text();
    const backup = JSON.parse(text);
    
    // Отправляем на сервер
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup })
    });
    
    if (response.success) {
      const { total, imported, errors } = response.data;
      
      let message = `🍄 Импорт завершен: ${imported}/${total} промптов`;
      if (errors > 0) {
        message += ` (${errors} ошибок)`;
      }
      
      showNotification('success', message);
      
      hideImportExportModal();
      loadPrompts(); // Перезагружаем список промптов
      
      console.log('🍄 Импорт промптов завершен');
    } else {
      throw new Error(response.error?.message || 'Не удалось импортировать промпты');
    }
  } catch (error) {
    console.error('🍄 Ошибка импорта промптов:', error);
    showNotification('error', `🍄 Ошибка импорта: ${error.message}`);
  }
}

/**
 * Просмотр промпта
 * @param {string} promptId - ID промпта
 */
function viewPrompt(promptId) {
  console.log('🍄 Просмотр промпта:', promptId);
  editPrompt(promptId);
}

/**
 * Редактирование промпта
 * @param {string} promptId - ID промпта
 */
function editPrompt(promptId) {
  console.log('🍄 Редактирование промпта:', promptId);
  showPromptEditor(promptId);
}

/**
 * Удаление промпта
 * @param {string} promptId - ID промпта
 */
async function deletePrompt(promptId) {
  // Находим промпт для отображения названия в подтверждении
  const prompt = promptsState.prompts.find(p => p.id === promptId);
  const promptName = prompt ? prompt.name : promptId;
  
  const confirmed = confirm(
    `🍄 Вы уверены, что хотите удалить промпт "${promptName}" из грибного хранилища мудрости?\n\n` +
    'Это действие нельзя отменить!'
  );
  
  if (!confirmed) return;
  
  try {
    console.log('🍄 Удаление промпта:', promptId);
    
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/${promptId}`, {
      method: 'DELETE'
    });
    
    if (response.success) {
      showNotification('success', '🍄 Промпт удален из грибного хранилища мудрости');
      
      loadPrompts(); // Перезагружаем список промптов
      
      console.log('🍄 Промпт успешно удален');
    } else {
      throw new Error(response.error?.message || 'Не удалось удалить промпт');
    }
  } catch (error) {
    console.error('🍄 Ошибка удаления промпта:', error);
    showNotification('error', `🍄 Не удалось удалить промпт: ${error.message}`);
  }
}

/**
 * Загружает статистику промптов
 */
async function loadPromptsStats() {
  try {
    console.log('🍄 Загрузка статистики промптов...');
    
    const response = await makeAuthenticatedRequest(`${PROMPTS_CONFIG.API_BASE}/stats`);
    
    if (response.success) {
      promptsState.stats = response.data;
      console.log('🍄 Статистика промптов загружена');
    } else {
      console.warn('🍄 Не удалось загрузить статистику промптов:', response.error?.message);
    }
  } catch (error) {
    console.error('🍄 Ошибка загрузки статистики промптов:', error);
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
      if (promptsState.currentFilters.page > 1) {
        promptsState.currentFilters.page--;
        loadPrompts();
      }
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(promptsState.totalPrompts / promptsState.currentFilters.limit);
      if (promptsState.currentFilters.page < totalPages) {
        promptsState.currentFilters.page++;
        loadPrompts();
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
  
  const { page, limit } = promptsState.currentFilters;
  const total = promptsState.totalPrompts;
  const totalPages = Math.ceil(total / limit);
  
  // Вычисляем диапазон отображаемых промптов
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
 * @returns {Promise<Object>} Ответ API
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
 * @returns {string} Относительное время
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
 * Показывает уведомление пользователю
 * @param {string} type - Тип уведомления (success|error|warning|info)
 * @param {string} message - Текст сообщения
 * @param {number} [duration=5000] - Длительность показа в миллисекундах
 */
function showNotification(type, message, duration = 5000) {
  const container = document.getElementById('notification-container');
  if (!container) {
    alert(message);
    return;
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
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
  
  setTimeout(() => notification.classList.add('show'), 10);
  
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
window.initPromptsPage = initPromptsPage;

// Экспорт функций для использования в HTML
window.showPromptEditor = showPromptEditor;
window.editPrompt = editPrompt;
window.deletePrompt = deletePrompt;
window.viewPrompt = viewPrompt;
window.testPrompt = testPrompt;