/**
 * Основной класс виджета чата Shrooms с JSDoc типизацией
 * @file client/chat-widget/widget.js
 */

// Подключение к типам из types.js не требуется благодаря JSDoc

/**
 * Класс ShroomsWidget для интеграции чата в веб-сайты
 * 
 * @class ShroomsWidget
 * @example
 * // Базовое использование
 * const chatWidget = new ShroomsWidget({
 *   apiUrl: 'https://api.example.com',
 *   containerId: 'chat-container'
 * });
 * 
 * // Расширенная конфигурация
 * const chatWidget = new ShroomsWidget({
 *   apiUrl: 'https://api.example.com',
 *   theme: 'neon',
 *   position: { side: 'right', align: 'bottom', offset: '20px' },
 *   autoOpen: true,
 *   welcomeMessage: 'Привет! Чем могу помочь?'
 * });
 */
class ShroomsWidget {
  /**
   * @type {WidgetConfig}
   * @private
   */
  _config;

  /**
   * @type {WidgetState}
   * @private
   */
  _state;

  /**
   * @type {WidgetDOMElements}
   * @private
   */
  _elements;

  /**
   * Создает экземпляр виджета чата
   * @constructor
   * @param {WidgetConfig} config - Конфигурация виджета
   */
  constructor(config) {
    // Применение настроек по умолчанию
    this._config = {
      apiUrl: config.apiUrl,
      containerId: config.containerId || 'shrooms-chat-widget',
      styles: config.styles || {},
      theme: config.theme || 'neon',
      position: {
        side: config.position?.side || 'right',
        align: config.position?.align || 'bottom',
        offset: config.position?.offset || '20px'
      },
      autoOpen: config.autoOpen || false,
      showHeader: config.showHeader !== undefined ? config.showHeader : true,
      showAvatar: config.showAvatar !== undefined ? config.showAvatar : true,
      showUserAvatar: config.showUserAvatar || false,
      persistSession: config.persistSession !== undefined ? config.persistSession : true,
      welcomeMessage: config.welcomeMessage || 'Привет! Я - грибной помощник, как я могу вам помочь?',
      i18n: config.i18n || {},
      enableFileUploads: config.enableFileUploads || false,
      allowedFileTypes: config.allowedFileTypes || ['.jpg', '.png', '.pdf', '.txt'],
      maxFileSize: config.maxFileSize || 5 * 1024 * 1024, // 5MB
      branding: config.branding !== undefined ? config.branding : 'Powered by Shrooms',
      onInit: config.onInit || (() => {}),
      onOpen: config.onOpen || (() => {}),
      onClose: config.onClose || (() => {}),
      onMessage: config.onMessage || (() => {}),
      onError: config.onError || (() => {}),
      onTicketCreated: config.onTicketCreated || (() => {})
    };

    // Инициализация внутреннего состояния
    this._state = {
      isOpen: this._config.autoOpen,
      isLoading: false,
      isInitialized: false,
      isConnected: false,
      messages: [],
      inputValue: '',
      userId: this._getUserId(),
      language: this._getPreferredLanguage(),
      error: null
    };

    // Инициализация DOM элементов
    this._elements = {
      container: null,
      header: null,
      body: null,
      footer: null,
      messagesContainer: null,
      inputContainer: null,
      input: null,
      sendButton: null,
      toggleButton: null,
      closeButton: null
    };

    // Инициализация виджета
    this._initialize();
  }

  /**
   * Инициализирует виджет
   * @private
   */
  _initialize() {
    // Создание DOM структуры
    this._createDOMStructure();
    
    // Привязка обработчиков событий
    this._bindEventHandlers();

    // Загрузка предыдущих сообщений, если есть
    if (this._config.persistSession) {
      this._loadPreviousSession();
    }

    // Добавление приветственного сообщения
    if (this._config.welcomeMessage) {
      this._addBotMessage(this._config.welcomeMessage);
    }

    // Установка флага инициализации
    this._state.isInitialized = true;

    // Вызов колбэка инициализации
    if (typeof this._config.onInit === 'function') {
      this._config.onInit(this);
    }

    // Если autoOpen, открываем виджет
    if (this._config.autoOpen) {
      this.open();
    }
  }

  /**
   * Создает DOM структуру виджета
   * @private
   */
  _createDOMStructure() {
    // Проверка существования контейнера
    let container = document.getElementById(this._config.containerId);
    
    // Если контейнер не существует, создаем его
    if (!container) {
      container = document.createElement('div');
      container.id = this._config.containerId;
      document.body.appendChild(container);
    }
    
    // Установка основных стилей контейнера
    container.className = 'shrooms-widget-container';
    
    // Создание HTML структуры виджета
    container.innerHTML = `
      <div class="shrooms-widget ${this._state.isOpen ? 'open' : 'closed'} theme-${this._config.theme}">
        <div class="shrooms-toggle-button">
          <div class="toggle-icon">🍄</div>
        </div>
        
        <div class="shrooms-chat-window">
          ${this._config.showHeader ? `
            <div class="shrooms-chat-header">
              <div class="shrooms-header-title">
                <div class="shrooms-avatar">🍄</div>
                <div class="shrooms-title">Shrooms Support</div>
              </div>
              <div class="shrooms-header-actions">
                <button class="shrooms-close-button">×</button>
              </div>
            </div>
          ` : ''}
          
          <div class="shrooms-chat-body">
            <div class="shrooms-messages-container"></div>
          </div>
          
          <div class="shrooms-chat-footer">
            <div class="shrooms-input-container">
              <input 
                type="text" 
                class="shrooms-chat-input" 
                placeholder="${this._config.i18n.inputPlaceholder || 'Напишите сообщение...'}"
              />
              <button class="shrooms-send-button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            ${this._config.branding ? `
              <div class="shrooms-branding">${this._config.branding}</div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    // Применение пользовательских стилей
    this._applyCustomStyles(container);
    
    // Сохранение ссылок на DOM элементы
    this._elements.container = container;
    this._elements.toggleButton = container.querySelector('.shrooms-toggle-button');
    this._elements.closeButton = container.querySelector('.shrooms-close-button');
    this._elements.header = container.querySelector('.shrooms-chat-header');
    this._elements.body = container.querySelector('.shrooms-chat-body');
    this._elements.footer = container.querySelector('.shrooms-chat-footer');
    this._elements.messagesContainer = container.querySelector('.shrooms-messages-container');
    this._elements.inputContainer = container.querySelector('.shrooms-input-container');
    this._elements.input = container.querySelector('.shrooms-chat-input');
    this._elements.sendButton = container.querySelector('.shrooms-send-button');
    
    // Добавление стилей
    this._injectStyles();
  }

  /**
   * Добавляет стили к документу
   * @private
   */
  _injectStyles() {
    // Создание элемента стиля
    const style = document.createElement('style');
    
    // Определение цветов в зависимости от темы
    let themeColors = {};
    
    switch(this._config.theme) {
      case 'dark':
        themeColors = {
          primary: '#39FF14',
          secondary: '#8A2BE2',
          background: '#121212',
          surface: '#1E1E1E',
          text: '#E0E0E0',
          textLight: '#FFFFFF',
          accent: '#FF6EC7'
        };
        break;
      case 'light':
        themeColors = {
          primary: '#00B570',
          secondary: '#6200EA',
          background: '#F5F5F5',
          surface: '#FFFFFF',
          text: '#333333',
          textLight: '#666666',
          accent: '#FF4081'
        };
        break;
      case 'neon':
      default:
        themeColors = {
          primary: '#39FF14',
          secondary: '#8A2BE2',
          background: '#050505',
          surface: '#121212',
          text: '#E0E0E0',
          textLight: '#FFFFFF',
          accent: '#00FFF9'
        };
        break;
    }
    
    // CSS стили
    style.textContent = `
      .shrooms-widget-container {
        position: fixed;
        ${this._config.position.side}: ${this._config.position.offset};
        ${this._config.position.align}: ${this._config.position.offset};
        z-index: 9999;
        font-family: 'Inter', 'Roboto', 'Poppins', sans-serif;
      }
      
      .shrooms-widget {
        display: flex;
        flex-direction: column;
        max-width: 370px;
        width: 100%;
        box-shadow: 0 5px 40px rgba(0, 0, 0, 0.4);
        border-radius: 16px;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .shrooms-widget.closed .shrooms-chat-window {
        display: none;
      }
      
      .shrooms-toggle-button {
        width: 60px;
        height: 60px;
        border-radius: 30px;
        background: ${themeColors.primary};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: absolute;
        bottom: 0;
        ${this._config.position.side}: 0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      
      .shrooms-toggle-button:hover {
        transform: scale(1.1);
      }
      
      .toggle-icon {
        font-size: 30px;
      }
      
      .shrooms-widget.open .shrooms-toggle-button {
        transform: scale(0);
        opacity: 0;
      }
      
      .shrooms-chat-window {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 500px;
        max-height: 80vh;
        background: ${themeColors.background};
        border-radius: 16px;
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      .shrooms-chat-header {
        padding: 16px;
        background: ${themeColors.surface};
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .shrooms-header-title {
        display: flex;
        align-items: center;
      }
      
      .shrooms-avatar {
        width: 32px;
        height: 32px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${themeColors.primary};
        margin-right: 10px;
        font-size: 20px;
      }
      
      .shrooms-title {
        font-weight: bold;
        font-size: 16px;
        color: ${themeColors.textLight};
      }
      
      .shrooms-close-button {
        background: transparent;
        border: none;
        color: ${themeColors.text};
        font-size: 24px;
        cursor: pointer;
        padding: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .shrooms-close-button:hover {
        color: ${themeColors.primary};
      }
      
      .shrooms-chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      
      .shrooms-messages-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .shrooms-message {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 18px;
        position: relative;
        animation: fadeIn 0.3s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .shrooms-message-user {
        align-self: flex-end;
        background: ${themeColors.secondary};
        color: white;
        border-bottom-right-radius: 4px;
      }
      
      .shrooms-message-bot {
        align-self: flex-start;
        background: ${themeColors.surface};
        color: ${themeColors.text};
        border-bottom-left-radius: 4px;
      }
      
      .shrooms-message-time {
        font-size: 10px;
        opacity: 0.7;
        position: absolute;
        bottom: -18px;
        ${this._config.position.side === 'right' ? 'left: 0' : 'right: 0'};
      }
      
      .shrooms-chat-footer {
        padding: 16px;
        background: ${themeColors.surface};
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .shrooms-input-container {
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 24px;
        padding: 0 16px;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
      }
      
      .shrooms-chat-input {
        flex: 1;
        background: transparent;
        border: none;
        padding: 12px 0;
        color: ${themeColors.text};
        font-size: 14px;
      }
      
      .shrooms-chat-input:focus {
        outline: none;
      }
      
      .shrooms-chat-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }
      
      .shrooms-send-button {
        background: transparent;
        border: none;
        color: ${themeColors.primary};
        cursor: pointer;
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }
      
      .shrooms-send-button:hover {
        color: ${themeColors.accent};
        transform: scale(1.1);
      }
      
      .shrooms-branding {
        text-align: center;
        padding-top: 8px;
        font-size: 10px;
        opacity: 0.5;
        color: ${themeColors.text};
      }
      
      .shrooms-typing-indicator {
        display: inline-block;
        position: relative;
        width: 50px;
        height: 20px;
      }
      
      .shrooms-typing-indicator span {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${themeColors.primary};
        position: absolute;
        bottom: 0;
        animation: typing 1.5s infinite ease-in-out;
      }
      
      .shrooms-typing-indicator span:nth-child(1) {
        left: 0;
        animation-delay: 0s;
      }
      
      .shrooms-typing-indicator span:nth-child(2) {
        left: 15px;
        animation-delay: 0.2s;
      }
      
      .shrooms-typing-indicator span:nth-child(3) {
        left: 30px;
        animation-delay: 0.4s;
      }
      
      @keyframes typing {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      .shrooms-ticket-notification {
        background: ${themeColors.accent};
        padding: 10px 16px;
        border-radius: 10px;
        margin: 10px 0;
        font-size: 12px;
        text-align: center;
        color: #000;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 255, 249, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(0, 255, 249, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 255, 249, 0); }
      }
      
      /* Расширенные стили для выделения */
      .shrooms-widget.theme-neon .shrooms-message-bot {
        box-shadow: 0 0 10px rgba(57, 255, 20, 0.2);
      }
      
      .shrooms-widget.theme-neon .shrooms-toggle-button {
        box-shadow: 0 0 15px rgba(57, 255, 20, 0.5);
      }
      
      /* Адаптивность для мобильных устройств */
      @media screen and (max-width: 480px) {
        .shrooms-widget-container {
          width: 100%;
          right: 0;
          left: 0;
          bottom: 0;
        }
        
        .shrooms-widget.open {
          width: 100%;
          max-width: 100%;
          height: 100%;
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          border-radius: 0;
        }
        
        .shrooms-chat-window {
          height: 100vh;
          max-height: 100vh;
          border-radius: 0;
        }
      }
    `;
    
    // Добавление стилей в заголовок документа
    document.head.appendChild(style);
  }

  /**
   * Применяет пользовательские стили к контейнеру
   * @param {HTMLElement} container - DOM элемент контейнера
   * @private
   */
  _applyCustomStyles(container) {
    if (!this._config.styles || Object.keys(this._config.styles).length === 0) {
      return;
    }
    
    // Создаем дополнительный элемент стиля для пользовательских стилей
    const customStyle = document.createElement('style');
    
    // Формируем CSS из объекта стилей
    let cssText = '';
    Object.entries(this._config.styles).forEach(([selector, styles]) => {
      cssText += `#${this._config.containerId} ${selector} {\n`;
      Object.entries(styles).forEach(([property, value]) => {
        cssText += `  ${property}: ${value};\n`;
      });
      cssText += '}\n';
    });
    
    customStyle.textContent = cssText;
    document.head.appendChild(customStyle);
  }

  /**
   * Привязывает обработчики событий к элементам виджета
   * @private
   */
  _bindEventHandlers() {
    // Переключение видимости виджета
    if (this._elements.toggleButton) {
      this._elements.toggleButton.addEventListener('click', () => this.open());
    }
    
    // Закрытие виджета
    if (this._elements.closeButton) {
      this._elements.closeButton.addEventListener('click', () => this.close());
    }
    
    // Обработка отправки сообщения
    if (this._elements.input && this._elements.sendButton) {
      // Обработка клика на кнопку отправки
      this._elements.sendButton.addEventListener('click', () => this._handleSendMessage());
      
      // Обработка нажатия Enter
      this._elements.input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._handleSendMessage();
        }
      });
      
      // Обработка ввода текста
      this._elements.input.addEventListener('input', (e) => {
        this._state.inputValue = e.target.value;
      });
    }
  }

  /**
   * Обрабатывает отправку сообщения
   * @private
   */
  _handleSendMessage() {
    const message = this._state.inputValue.trim();
    
    if (!message) return;
    
    // Отображение сообщения пользователя
    this._addUserMessage(message);
    
    // Очистка поля ввода
    this._elements.input.value = '';
    this._state.inputValue = '';
    
    // Отображение индикатора ожидания
    this._showTypingIndicator();
    
    // Отправка сообщения на сервер
    this._sendMessageToServer(message);
  }

  /**
   * Отправляет сообщение на сервер
   * @param {string} message - Текст сообщения
   * @private
   */
  _sendMessageToServer(message) {
    const requestData = {
      message,
      userId: this._state.userId,
      conversationId: this._state.currentConversationId,
      language: this._state.language
    };
    
    this._state.isLoading = true;
    
    fetch(`${this._config.apiUrl}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    })
      .then(response => response.json())
      .then(data => {
        this._handleServerResponse(data);
      })
      .catch(error => {
        this._handleServerError(error);
      })
      .finally(() => {
        this._hideTypingIndicator();
        this._state.isLoading = false;
      });
  }

  /**
   * Обрабатывает ответ сервера
   * @param {ChatResponse} response - Ответ сервера
   * @private
   */
  _handleServerResponse(response) {
    if (!response.success) {
      this._handleServerError(new Error(response.error || 'Неизвестная ошибка'));
      return;
    }
    
    // Сохраняем ID разговора
    if (response.data.conversationId && !this._state.currentConversationId) {
      this._state.currentConversationId = response.data.conversationId;
      this._saveConversationId(response.data.conversationId);
    }
    
    // Добавляем сообщение от бота
    this._addBotMessage(response.data.message);
    
    // Если создан тикет, выводим уведомление
    if (response.data.needsTicket && response.data.ticketId) {
      this._showTicketNotification(response.data.ticketId);
      
      // Вызываем колбэк создания тикета
      if (typeof this._config.onTicketCreated === 'function') {
        this._config.onTicketCreated(response.data.ticketId);
      }
    }
    
    // Вызываем колбэк получения сообщения
    if (typeof this._config.onMessage === 'function') {
      this._config.onMessage(response.data);
    }
    
    // Если изменился язык, обновляем состояние
    if (response.data.language && response.data.language !== this._state.language) {
      this._state.language = response.data.language;
    }
  }

  /**
   * Обрабатывает ошибку сервера
   * @param {Error} error - Объект ошибки
   * @private
   */
  _handleServerError(error) {
    console.error('Shrooms Widget Error:', error);
    
    // Сохраняем ошибку в состоянии
    this._state.error = error;
    
    // Добавляем сообщение об ошибке
    this._addErrorMessage();
    
    // Вызываем колбэк ошибки
    if (typeof this._config.onError === 'function') {
      this._config.onError(error);
    }
  }

  /**
   * Добавляет сообщение пользователя в чат
   * @param {string} text - Текст сообщения
   * @private
   */
  _addUserMessage(text) {
    const timestamp = new Date().toISOString();
    
    // Создаем объект сообщения
    const message = {
      text,
      role: 'user',
      timestamp
    };
    
    // Добавляем в состояние
    this._state.messages.push(message);
    
    // Добавляем в DOM
    const messageElement = document.createElement('div');
    messageElement.className = 'shrooms-message shrooms-message-user';
    messageElement.innerHTML = `
      <div class="shrooms-message-content">${this._formatMessageText(text)}</div>
      <div class="shrooms-message-time">${this._formatTime(timestamp)}</div>
    `;
    
    this._elements.messagesContainer.appendChild(messageElement);
    
    // Прокручиваем в конец
    this._scrollToBottom();
    
    // Сохраняем сообщения, если включена персистентность
    if (this._config.persistSession) {
      this._saveMessages();
    }
  }

  /**
   * Добавляет сообщение бота в чат
   * @param {string} text - Текст сообщения
   * @private
   */
  _addBotMessage(text) {
    const timestamp = new Date().toISOString();
    
    // Создаем объект сообщения
    const message = {
      text,
      role: 'assistant',
      timestamp
    };
    
    // Добавляем в состояние
    this._state.messages.push(message);
    
    // Добавляем в DOM
    const messageElement = document.createElement('div');
    messageElement.className = 'shrooms-message shrooms-message-bot';
    messageElement.innerHTML = `
      <div class="shrooms-message-content">${this._formatMessageText(text)}</div>
      <div class="shrooms-message-time">${this._formatTime(timestamp)}</div>
    `;
    
    this._elements.messagesContainer.appendChild(messageElement);
    
    // Прокручиваем в конец
    this._scrollToBottom();
    
    // Сохраняем сообщения, если включена персистентность
    if (this._config.persistSession) {
      this._saveMessages();
    }
  }

  /**
   * Добавляет сообщение об ошибке в чат
   * @private
   */
  _addErrorMessage() {
    const timestamp = new Date().toISOString();
    const errorText = 'Упс! Что-то пошло не так. Пожалуйста, попробуйте снова или обратитесь в службу поддержки.';
    
    // Создаем объект сообщения
    const message = {
      text: errorText,
      role: 'system',
      timestamp,
      isError: true
    };
    
    // Добавляем в состояние
    this._state.messages.push(message);
    
    // Добавляем в DOM
    const messageElement = document.createElement('div');
    messageElement.className = 'shrooms-message shrooms-message-bot shrooms-message-error';
    messageElement.innerHTML = `
      <div class="shrooms-message-content">${errorText}</div>
      <div class="shrooms-message-time">${this._formatTime(timestamp)}</div>
    `;
    
    this._elements.messagesContainer.appendChild(messageElement);
    
    // Прокручиваем в конец
    this._scrollToBottom();
  }

  /**
   * Отображает индикатор набора текста
   * @private
   */
  _showTypingIndicator() {
    const typingElement = document.createElement('div');
    typingElement.className = 'shrooms-message shrooms-message-bot shrooms-typing';
    typingElement.innerHTML = `
      <div class="shrooms-typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    
    this._elements.messagesContainer.appendChild(typingElement);
    
    // Прокручиваем в конец
    this._scrollToBottom();
  }

  /**
   * Скрывает индикатор набора текста
   * @private
   */
  _hideTypingIndicator() {
    const typingElement = this._elements.messagesContainer.querySelector('.shrooms-typing');
    if (typingElement) {
      typingElement.remove();
    }
  }

  /**
   * Отображает уведомление о создании тикета
   * @param {string} ticketId - ID созданного тикета
   * @private
   */
  _showTicketNotification(ticketId) {
    const notificationElement = document.createElement('div');
    notificationElement.className = 'shrooms-ticket-notification';
    notificationElement.innerHTML = `
      🔔 Создан тикет #${ticketId}
      <br>
      Наша грибная команда ответит вам в ближайшее время!
    `;
    
    this._elements.messagesContainer.appendChild(notificationElement);
    
    // Прокручиваем в конец
    this._scrollToBottom();
  }

  /**
   * Прокручивает чат в конец
   * @private
   */
  _scrollToBottom() {
    if (this._elements.body) {
      this._elements.body.scrollTop = this._elements.body.scrollHeight;
    }
  }

  /**
   * Форматирует текст сообщения (замена ссылок, эмодзи и т.д.)
   * @param {string} text - Исходный текст
   * @returns {string} Форматированный текст
   * @private
   */
  _formatMessageText(text) {
    // Заменяем URL на ссылки
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formattedText = text.replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    
    // Заменяем переносы строк на <br>
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
  }

  /**
   * Форматирует время
   * @param {string} timestamp - ISO строка времени
   * @returns {string} Форматированное время
   * @private
   */
  _formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
  }

  /**
   * Получает или создает ID пользователя
   * @returns {string} ID пользователя
   * @private
   */
  _getUserId() {
    const storageKey = 'shrooms_widget_user_id';
    
    // Проверяем localStorage
    let userId = localStorage.getItem(storageKey);
    
    if (!userId) {
      // Генерируем новый ID
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      
      // Сохраняем в localStorage
      localStorage.setItem(storageKey, userId);
    }
    
    return userId;
  }

  /**
   * Получает предпочтительный язык пользователя
   * @returns {string} Код языка
   * @private
   */
  _getPreferredLanguage() {
    // Проверяем сохраненный язык
    const savedLanguage = localStorage.getItem('shrooms_widget_language');
    if (savedLanguage) {
      return savedLanguage;
    }
    
    // Проверяем язык браузера
    const browserLanguage = navigator.language.split('-')[0];
    
    // Проверяем, поддерживается ли этот язык
    const supportedLanguages = ['en', 'es', 'ru'];
    return supportedLanguages.includes(browserLanguage) ? browserLanguage : 'en';
  }

  /**
   * Загружает предыдущую сессию из localStorage
   * @private
   */
  _loadPreviousSession() {
    // Загружаем сообщения
    const messagesJson = localStorage.getItem(`shrooms_widget_messages_${this._state.userId}`);
    if (messagesJson) {
      try {
        const savedMessages = JSON.parse(messagesJson);
        
        // Проверяем структуру сообщений
        if (Array.isArray(savedMessages) && savedMessages.length > 0) {
          // Отображаем сохраненные сообщения
          savedMessages.forEach(msg => {
            if (msg.role === 'user') {
              this._addUserMessage(msg.text);
            } else if (msg.role === 'assistant') {
              this._addBotMessage(msg.text);
            }
          });
          
          // Сохраняем сообщения в состоянии
          this._state.messages = savedMessages;
        }
      } catch (error) {
        console.error('Error loading saved messages:', error);
      }
    }
    
    // Загружаем ID разговора
    const conversationId = localStorage.getItem(`shrooms_widget_conversation_${this._state.userId}`);
    if (conversationId) {
      this._state.currentConversationId = conversationId;
    }
  }

  /**
   * Сохраняет сообщения в localStorage
   * @private
   */
  _saveMessages() {
    if (!this._state.messages || this._state.messages.length === 0) return;
    
    try {
      // Ограничиваем количество сохраняемых сообщений
      const messagesToSave = this._state.messages.slice(-20);
      
      localStorage.setItem(
        `shrooms_widget_messages_${this._state.userId}`,
        JSON.stringify(messagesToSave)
      );
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  }

  /**
   * Сохраняет ID разговора в localStorage
   * @param {string} conversationId - ID разговора
   * @private
   */
  _saveConversationId(conversationId) {
    try {
      localStorage.setItem(
        `shrooms_widget_conversation_${this._state.userId}`,
        conversationId
      );
    } catch (error) {
      console.error('Error saving conversation ID:', error);
    }
  }

  /**
   * Открывает виджет чата
   * @public
   */
  open() {
    if (this._state.isOpen) return;
    
    const widgetElement = this._elements.container.querySelector('.shrooms-widget');
    if (widgetElement) {
      widgetElement.classList.add('open');
      widgetElement.classList.remove('closed');
    }
    
    this._state.isOpen = true;
    
    // Вызываем колбэк открытия
    if (typeof this._config.onOpen === 'function') {
      this._config.onOpen();
    }
    
    // Фокус в поле ввода
    setTimeout(() => {
      if (this._elements.input) {
        this._elements.input.focus();
      }
    }, 300);
  }

  /**
   * Закрывает виджет чата
   * @public
   */
  close() {
    if (!this._state.isOpen) return;
    
    const widgetElement = this._elements.container.querySelector('.shrooms-widget');
    if (widgetElement) {
      widgetElement.classList.remove('open');
      widgetElement.classList.add('closed');
    }
    
    this._state.isOpen = false;
    
    // Вызываем колбэк закрытия
    if (typeof this._config.onClose === 'function') {
      this._config.onClose();
    }
  }

  /**
   * Отправляет сообщение программно
   * @param {string} message - Текст сообщения
   * @public
   */
  sendMessage(message) {
    if (!message || !this._state.isInitialized) return;
    
    // Отображение сообщения пользователя
    this._addUserMessage(message);
    
    // Отображение индикатора ожидания
    this._showTypingIndicator();
    
    // Отправка сообщения на сервер
    this._sendMessageToServer(message);
  }

  /**
   * Очищает историю сообщений
   * @public
   */
  clearHistory() {
    // Очищаем состояние
    this._state.messages = [];
    
    // Очищаем DOM
    if (this._elements.messagesContainer) {
      this._elements.messagesContainer.innerHTML = '';
    }
    
    // Очищаем localStorage
    if (this._config.persistSession) {
      localStorage.removeItem(`shrooms_widget_messages_${this._state.userId}`);
    }
    
    // Добавляем приветственное сообщение, если оно задано
    if (this._config.welcomeMessage) {
      this._addBotMessage(this._config.welcomeMessage);
    }
  }

  /**
   * Устанавливает язык виджета
   * @param {string} language - Код языка ('en', 'es', 'ru')
   * @public
   */
  setLanguage(language) {
    if (!language || !['en', 'es', 'ru'].includes(language)) return;
    
    this._state.language = language;
    
    // Сохраняем в localStorage
    localStorage.setItem('shrooms_widget_language', language);
  }

  /**
   * Возвращает текущее состояние виджета
   * @returns {WidgetState} Состояние виджета
   * @public
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Получает историю сообщений
   * @returns {ChatMessage[]} Массив сообщений
   * @public
   */
  getMessages() {
    return [...this._state.messages];
  }

  /**
   * Обновляет конфигурацию виджета
   * @param {Partial<WidgetConfig>} newConfig - Новые настройки
   * @public
   */
  updateConfig(newConfig) {
    if (!newConfig) return;
    
    // Применяем новые настройки
    this._config = {
      ...this._config,
      ...newConfig
    };
    
    // Перезагружаем виджет, если он уже инициализирован
    if (this._state.isInitialized) {
      this._elements.container.innerHTML = '';
      this._initialize();
    }
  }
}

// Экспорт класса
window.ShroomsWidget = ShroomsWidget;
