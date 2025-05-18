/**
 * Интеграция виджета чата Shrooms в сайт
 * @file client/chat-widget/embed.js
 * 
 * Пример использования для внешних сайтов, в том числе на TypeScript
 */

/**
 * @typedef {Object} ShroomsWidgetEmbedConfig
 * @property {string} apiUrl - URL API сервера
 * @property {string} [widgetUrl] - URL iframe виджета
 * @property {string} [containerId] - ID контейнера для iframe
 * @property {string} [theme] - Тема оформления
 * @property {Object} [position] - Позиция виджета
 * @property {boolean} [autoOpen] - Автоматически открывать виджет
 * @property {string} [welcomeMessage] - Приветственное сообщение
 * @property {Object} [i18n] - Переводы интерфейса
 * @property {Function} [onReady] - Колбэк готовности виджета
 * @property {Function} [onMessage] - Колбэк при новом сообщении
 * @property {Function} [onOpen] - Колбэк при открытии виджета
 * @property {Function} [onClose] - Колбэк при закрытии виджета
 * @property {Function} [onError] - Колбэк при ошибке
 * @property {Function} [onTicketCreated] - Колбэк при создании тикета
 */

// IIFE для избежания глобальных переменных
(function() {
  /**
   * Класс для интеграции виджета чата Shrooms
   * @class ShroomsWidgetEmbed
   */
  class ShroomsWidgetEmbed {
    /**
     * @type {ShroomsWidgetEmbedConfig}
     * @private
     */
    _config;
    
    /**
     * @type {HTMLIFrameElement}
     * @private
     */
    _iframe;
    
    /**
     * @type {boolean}
     * @private
     */
    _isReady = false;
    
    /**
     * @type {Object.<string, Function[]>}
     * @private
     */
    _eventHandlers = {};
    
    /**
     * Создает экземпляр интеграции виджета
     * @constructor
     * @param {ShroomsWidgetEmbedConfig} config - Конфигурация виджета
     */
    constructor(config) {
      // Применение настроек по умолчанию
      this._config = {
        apiUrl: config.apiUrl,
        widgetUrl: config.widgetUrl || (window.location.origin + '/chat-widget/'),
        containerId: config.containerId || 'shrooms-widget-container',
        theme: config.theme || 'neon',
        position: config.position || {
          side: 'right',
          align: 'bottom',
          offset: '20px'
        },
        autoOpen: config.autoOpen || false,
        welcomeMessage: config.welcomeMessage,
        i18n: config.i18n || {},
        onReady: config.onReady || null,
        onMessage: config.onMessage || null,
        onOpen: config.onOpen || null,
        onClose: config.onClose || null,
        onError: config.onError || null,
        onTicketCreated: config.onTicketCreated || null
      };
      
      // Инициализация
      this._init();
    }
    
    /**
     * Инициализирует интеграцию виджета
     * @private
     */
    _init() {
      // Создание контейнера, если его нет
      let container = document.getElementById(this._config.containerId);
      
      if (!container) {
        container = document.createElement('div');
        container.id = this._config.containerId;
        document.body.appendChild(container);
      }
      
      // Стилизация контейнера
      container.style.position = 'fixed';
      container.style.zIndex = '9999';
      container.style[this._config.position.side] = this._config.position.offset;
      container.style[this._config.position.align] = this._config.position.offset;
      container.style.overflow = 'hidden';
      container.style.border = 'none';
      container.style.width = '0';
      container.style.height = '0';
      
      // Создание iframe
      this._iframe = document.createElement('iframe');
      this._iframe.src = this._config.widgetUrl;
      this._iframe.style.border = 'none';
      this._iframe.style.width = '100%';
      this._iframe.style.height = '100%';
      this._iframe.style.position = 'absolute';
      this._iframe.style.bottom = '0';
      this._iframe.style.right = '0';
      this._iframe.title = 'Shrooms Chat Widget';
      this._iframe.setAttribute('allowtransparency', 'true');
      
      // Добавление iframe в контейнер
      container.appendChild(this._iframe);
      
      // Добавление обработчика сообщений
      window.addEventListener('message', this._handleMessage.bind(this));
    }
    
    /**
     * Обрабатывает сообщения от iframe
     * @param {MessageEvent} event - Событие сообщения
     * @private
     */
    _handleMessage(event) {
      try {
        // Проверяем, что сообщение в правильном формате
        if (!event.data || typeof event.data !== 'string') {
          return;
        }
        
        const message = JSON.parse(event.data);
        
        // Обрабатываем разные типы сообщений
        switch (message.type) {
          case 'widget:ready':
            // Виджет готов, отправляем конфигурацию
            this._sendConfigToWidget();
            break;
            
          case 'widget:initialized':
            // Виджет инициализирован
            this._isReady = true;
            
            // Вызываем колбэк готовности
            if (typeof this._config.onReady === 'function') {
              this._config.onReady();
            }
            
            // Вызываем все отложенные обработчики
            this._executeEvent('ready');
            break;
            
          case 'widget:opened':
            // Виджет открыт
            if (typeof this._config.onOpen === 'function') {
              this._config.onOpen();
            }
            
            this._executeEvent('open');
            break;
            
          case 'widget:closed':
            // Виджет закрыт
            if (typeof this._config.onClose === 'function') {
              this._config.onClose();
            }
            
            this._executeEvent('close');
            break;
            
          case 'widget:message':
            // Новое сообщение
            if (typeof this._config.onMessage === 'function') {
              this._config.onMessage(message.data);
            }
            
            this._executeEvent('message', message.data);
            break;
            
          case 'widget:error':
            // Ошибка
            if (typeof this._config.onError === 'function') {
              this._config.onError(message.error);
            }
            
            this._executeEvent('error', message.error);
            break;
            
          case 'widget:ticket':
            // Создан тикет
            if (typeof this._config.onTicketCreated === 'function') {
              this._config.onTicketCreated(message.ticketId);
            }
            
            this._executeEvent('ticket', message.ticketId);
            break;
            
          case 'widget:state':
            // Состояние виджета
            this._executeEvent('state', message.state);
            break;
            
          case 'widget:messages':
            // Сообщения виджета
            this._executeEvent('messages', message.messages);
            break;
        }
      } catch (error) {
        console.error('Error handling widget message:', error);
      }
    }
    
    /**
     * Отправляет конфигурацию в iframe
     * @private
     */
    _sendConfigToWidget() {
      if (!this._iframe || !this._iframe.contentWindow) {
        return;
      }
      
      // Отправляем сообщение с конфигурацией
      this._iframe.contentWindow.postMessage(JSON.stringify({
        type: 'widget:init',
        config: {
          apiUrl: this._config.apiUrl,
          theme: this._config.theme,
          position: this._config.position,
          autoOpen: this._config.autoOpen,
          welcomeMessage: this._config.welcomeMessage,
          i18n: this._config.i18n
        }
      }), '*');
    }
    
    /**
     * Отправляет сообщение в iframe
     * @param {Object} message - Сообщение для отправки
     * @private
     */
    _sendMessage(message) {
      if (!this._iframe || !this._iframe.contentWindow) {
        return;
      }
      
      this._iframe.contentWindow.postMessage(JSON.stringify(message), '*');
    }
    
    /**
     * Выполняет все обработчики события
     * @param {string} event - Имя события
     * @param {*} data - Данные события
     * @private
     */
    _executeEvent(event, data = null) {
      if (!this._eventHandlers[event]) {
        return;
      }
      
      this._eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error executing ${event} handler:`, error);
        }
      });
    }
    
    /**
     * Проверяет готовность виджета
     * @returns {boolean} Готовность виджета
     * @public
     */
    isReady() {
      return this._isReady;
    }
    
    /**
     * Открывает виджет чата
     * @public
     */
    open() {
      if (!this._isReady) {
        // Добавляем обработчик, который будет вызван после инициализации
        this.on('ready', () => this.open());
        return;
      }
      
      this._sendMessage({
        type: 'widget:open'
      });
    }
    
    /**
     * Закрывает виджет чата
     * @public
     */
    close() {
      if (!this._isReady) {
        return;
      }
      
      this._sendMessage({
        type: 'widget:close'
      });
    }
    
    /**
     * Отправляет сообщение в чат
     * @param {string} text - Текст сообщения
     * @public
     */
    sendMessage(text) {
      if (!this._isReady || !text) {
        return;
      }
      
      this._sendMessage({
        type: 'widget:sendMessage',
        text
      });
    }
    
    /**
     * Очищает историю сообщений
     * @public
     */
    clearHistory() {
      if (!this._isReady) {
        return;
      }
      
      this._sendMessage({
        type: 'widget:clearHistory'
      });
    }
    
    /**
     * Устанавливает язык виджета
     * @param {string} language - Код языка ('en', 'es', 'ru')
     * @public
     */
    setLanguage(language) {
      if (!this._isReady) {
        return;
      }
      
      this._sendMessage({
        type: 'widget:setLanguage',
        language
      });
    }
    
    /**
     * Получает текущее состояние виджета
     * @param {Function} callback - Функция обратного вызова
     * @public
     */
    getState(callback) {
      if (!this._isReady) {
        return;
      }
      
      // Добавляем одноразовый обработчик
      this.once('state', callback);
      
      this._sendMessage({
        type: 'widget:getState'
      });
    }
    
    /**
     * Получает историю сообщений
     * @param {Function} callback - Функция обратного вызова
     * @public
     */
    getMessages(callback) {
      if (!this._isReady) {
        return;
      }
      
      // Добавляем одноразовый обработчик
      this.once('messages', callback);
      
      this._sendMessage({
        type: 'widget:getMessages'
      });
    }
    
    /**
     * Добавляет обработчик события
     * @param {string} event - Имя события
     * @param {Function} handler - Функция обработчик
     * @returns {ShroomsWidgetEmbed} Текущий экземпляр для цепочки вызовов
     * @public
     */
    on(event, handler) {
      if (typeof handler !== 'function') {
        return this;
      }
      
      if (!this._eventHandlers[event]) {
        this._eventHandlers[event] = [];
      }
      
      this._eventHandlers[event].push(handler);
      
      return this;
    }
    
    /**
     * Добавляет одноразовый обработчик события
     * @param {string} event - Имя события
     * @param {Function} handler - Функция обработчик
     * @returns {ShroomsWidgetEmbed} Текущий экземпляр для цепочки вызовов
     * @public
     */
    once(event, handler) {
      if (typeof handler !== 'function') {
        return this;
      }
      
      // Создаем обертку, которая удалит себя после вызова
      const wrappedHandler = (data) => {
        handler(data);
        this.off(event, wrappedHandler);
      };
      
      return this.on(event, wrappedHandler);
    }
    
    /**
     * Удаляет обработчик события
     * @param {string} event - Имя события
     * @param {Function} handler - Функция обработчик
     * @returns {ShroomsWidgetEmbed} Текущий экземпляр для цепочки вызовов
     * @public
     */
    off(event, handler) {
      if (!this._eventHandlers[event]) {
        return this;
      }
      
      this._eventHandlers[event] = this._eventHandlers[event].filter(
        h => h !== handler
      );
      
      return this;
    }
    
    /**
     * Обновляет настройки виджета
     * @param {Partial<ShroomsWidgetEmbedConfig>} newConfig - Новые настройки
     * @public
     */
    updateConfig(newConfig) {
      if (!newConfig) {
        return;
      }
      
      // Обновляем локальную конфигурацию
      this._config = {
        ...this._config,
        ...newConfig
      };
      
      // Отправляем новую конфигурацию в iframe
      if (this._isReady) {
        this._sendConfigToWidget();
      }
    }
  }
  
  // Экспортируем класс в глобальную область видимости
  window.ShroomsWidgetEmbed = ShroomsWidgetEmbed;
})();

// Примеры использования:

/* 
// Basic usage
const widget = new ShroomsWidgetEmbed({
  apiUrl: 'https://api.example.com',
  widgetUrl: 'https://api.example.com/chat-widget/'
});

// Open the widget
widget.open();

// Send a message
widget.sendMessage('Hello!');

// Listen for events
widget.on('message', (data) => {
  console.log('New message:', data);
});

// For TypeScript projects
interface ShroomsWidgetEmbedConfig {
  apiUrl: string;
  widgetUrl?: string;
  containerId?: string;
  theme?: string;
  position?: {
    side?: string;
    align?: string;
    offset?: string;
  };
  autoOpen?: boolean;
  welcomeMessage?: string;
  i18n?: Record<string, string>;
  onReady?: () => void;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onTicketCreated?: (ticketId: string) => void;
}

declare class ShroomsWidgetEmbed {
  constructor(config: ShroomsWidgetEmbedConfig);
  isReady(): boolean;
  open(): void;
  close(): void;
  sendMessage(text: string): void;
  clearHistory(): void;
  setLanguage(language: string): void;
  getState(callback: (state: any) => void): void;
  getMessages(callback: (messages: any[]) => void): void;
  on(event: string, handler: Function): ShroomsWidgetEmbed;
  once(event: string, handler: Function): ShroomsWidgetEmbed;
  off(event: string, handler: Function): ShroomsWidgetEmbed;
  updateConfig(newConfig: Partial<ShroomsWidgetEmbedConfig>): void;
}

declare global {
  interface Window {
    ShroomsWidgetEmbed: typeof ShroomsWidgetEmbed;
  }
}

// TypeScript usage example
const widget = new window.ShroomsWidgetEmbed({
  apiUrl: 'https://api.example.com',
  onReady: () => console.log('Widget is ready')
});
*/
