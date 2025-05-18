/**
 * Модуль для интеграции чат-виджета через iframe
 * @file client/chat-widget/iframe.js
 */

/**
 * @typedef {Object} IframeWidgetConfig
 * @property {string} targetOrigin - Домен родительского окна для сообщений
 * @property {string} apiUrl - URL API сервера
 * @property {Object} [styles] - Стили для виджета
 * @property {Object} [position] - Позиция виджета
 * @property {string} [theme] - Тема оформления
 * @property {boolean} [autoOpen] - Автоматически открывать виджет
 * @property {string} [welcomeMessage] - Приветственное сообщение
 * @property {Object} [i18n] - Переводы интерфейса
 * @property {string} [branding] - Текст брендинга
 */

(function() {
  /**
   * @type {IframeWidgetConfig}
   */
  let config = {
    targetOrigin: '*',
    apiUrl: window.location.origin,
    theme: 'neon',
    position: {
      side: 'right',
      align: 'bottom',
      offset: '20px'
    },
    autoOpen: false,
    welcomeMessage: 'Привет! Я - грибной помощник, как я могу вам помочь?',
    branding: 'Powered by Shrooms'
  };

  /**
   * @type {ShroomsWidget}
   */
  let widget;
  
  /**
   * Инициализирует виджет
   * @private
   */
  function initWidget() {
    // Создаем экземпляр виджета
    widget = new ShroomsWidget({
      apiUrl: config.apiUrl,
      styles: config.styles,
      theme: config.theme,
      position: config.position,
      autoOpen: config.autoOpen,
      welcomeMessage: config.welcomeMessage,
      branding: config.branding,
      i18n: config.i18n,
      onInit: handleWidgetInit,
      onOpen: handleWidgetOpen,
      onClose: handleWidgetClose,
      onMessage: handleWidgetMessage,
      onError: handleWidgetError,
      onTicketCreated: handleTicketCreated
    });
  }
  
  /**
   * Обработчик инициализации виджета
   * @private
   */
  function handleWidgetInit() {
    sendMessageToParent({
      type: 'widget:initialized',
      timestamp: new Date().toISOString(),
      state: widget.getState()
    });
  }
  
  /**
   * Обработчик открытия виджета
   * @private
   */
  function handleWidgetOpen() {
    sendMessageToParent({
      type: 'widget:opened',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Обработчик закрытия виджета
   * @private
   */
  function handleWidgetClose() {
    sendMessageToParent({
      type: 'widget:closed',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Обработчик нового сообщения
   * @param {Object} messageData - Данные сообщения
   * @private
   */
  function handleWidgetMessage(messageData) {
    sendMessageToParent({
      type: 'widget:message',
      timestamp: new Date().toISOString(),
      data: messageData
    });
  }
  
  /**
   * Обработчик ошибки
   * @param {Error} error - Объект ошибки
   * @private
   */
  function handleWidgetError(error) {
    sendMessageToParent({
      type: 'widget:error',
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    });
  }
  
  /**
   * Обработчик создания тикета
   * @param {string} ticketId - ID созданного тикета
   * @private
   */
  function handleTicketCreated(ticketId) {
    sendMessageToParent({
      type: 'widget:ticket',
      timestamp: new Date().toISOString(),
      ticketId
    });
  }
  
  /**
   * Отправляет сообщение родительскому окну
   * @param {Object} message - Объект сообщения
   * @private
   */
  function sendMessageToParent(message) {
    try {
      window.parent.postMessage(JSON.stringify(message), config.targetOrigin);
    } catch (error) {
      console.error('Failed to send message to parent:', error);
    }
  }
  
  /**
   * Обрабатывает сообщения от родительского окна
   * @param {MessageEvent} event - Событие сообщения
   * @private
   */
  function handleParentMessage(event) {
    try {
      // Проверяем, что сообщение в правильном формате
      if (!event.data || typeof event.data !== 'string') {
        return;
      }
      
      const message = JSON.parse(event.data);
      
      // Обрабатываем команды
      switch (message.type) {
        case 'widget:init':
          // Обновляем конфигурацию
          if (message.config) {
            config = {
              ...config,
              ...message.config
            };
          }
          
          // Инициализируем виджет, если еще не инициализирован
          if (!widget) {
            initWidget();
          } else {
            // Если виджет уже инициализирован, обновляем конфигурацию
            widget.updateConfig(config);
          }
          break;
          
        case 'widget:open':
          if (widget) {
            widget.open();
          }
          break;
          
        case 'widget:close':
          if (widget) {
            widget.close();
          }
          break;
          
        case 'widget:sendMessage':
          if (widget && message.text) {
            widget.sendMessage(message.text);
          }
          break;
          
        case 'widget:clearHistory':
          if (widget) {
            widget.clearHistory();
          }
          break;
          
        case 'widget:setLanguage':
          if (widget && message.language) {
            widget.setLanguage(message.language);
          }
          break;
          
        case 'widget:getState':
          if (widget) {
            sendMessageToParent({
              type: 'widget:state',
              timestamp: new Date().toISOString(),
              state: widget.getState()
            });
          }
          break;
          
        case 'widget:getMessages':
          if (widget) {
            sendMessageToParent({
              type: 'widget:messages',
              timestamp: new Date().toISOString(),
              messages: widget.getMessages()
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error handling parent message:', error);
    }
  }
  
  /**
   * Инициализация при загрузке страницы
   */
  function initIframeWidget() {
    // Добавляем обработчик сообщений от родительского окна
    window.addEventListener('message', handleParentMessage);
    
    // Отправляем сообщение о готовности
    sendMessageToParent({
      type: 'widget:ready',
      timestamp: new Date().toISOString()
    });
  }
  
  // Запускаем инициализацию при загрузке страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIframeWidget);
  } else {
    initIframeWidget();
  }
})();
