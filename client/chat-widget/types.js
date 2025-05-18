/**
 * Типы для Shrooms Chat Widget
 * @file client/chat-widget/types.js
 */

/**
 * @typedef {Object} WidgetConfig
 * @property {string} apiUrl - URL API сервера
 * @property {string} [containerId] - ID контейнера для виджета (default: 'shrooms-chat-widget')
 * @property {Object} [styles] - Кастомные стили
 * @property {string} [theme] - Тема оформления ('light', 'dark', 'neon') (default: 'neon')
 * @property {Object} [position] - Позиция виджета на странице
 * @property {string} [position.side] - Сторона ('left', 'right') (default: 'right')
 * @property {string} [position.align] - Выравнивание ('top', 'bottom') (default: 'bottom')
 * @property {string} [position.offset] - Отступ от края (например, '20px') (default: '20px')
 * @property {boolean} [autoOpen] - Автоматически открывать виджет (default: false)
 * @property {boolean} [showHeader] - Показывать заголовок (default: true)
 * @property {boolean} [showAvatar] - Показывать аватар бота (default: true)
 * @property {boolean} [showUserAvatar] - Показывать аватар пользователя (default: false)
 * @property {boolean} [persistSession] - Сохранять сессию между визитами (default: true)
 * @property {string} [welcomeMessage] - Приветственное сообщение
 * @property {Object} [i18n] - Переводы строк
 * @property {boolean} [enableFileUploads] - Разрешить загрузку файлов (default: false)
 * @property {string[]} [allowedFileTypes] - Разрешенные типы файлов
 * @property {number} [maxFileSize] - Максимальный размер файла в байтах
 * @property {string} [branding] - Текст брендинга (default: 'Powered by Shrooms')
 * @property {Function} [onInit] - Колбэк после инициализации
 * @property {Function} [onOpen] - Колбэк при открытии виджета
 * @property {Function} [onClose] - Колбэк при закрытии виджета
 * @property {Function} [onMessage] - Колбэк при новом сообщении
 * @property {Function} [onError] - Колбэк при ошибке
 * @property {Function} [onTicketCreated] - Колбэк при создании тикета
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль отправителя ('user', 'assistant', 'system')
 * @property {string} timestamp - Метка времени создания сообщения
 * @property {string} [messageId] - ID сообщения
 * @property {boolean} [isLoading] - Флаг загрузки (для временных сообщений)
 * @property {Object} [metadata] - Дополнительные метаданные
 */

/**
 * @typedef {Object} ChatConversation
 * @property {string} conversationId - ID разговора
 * @property {string} userId - ID пользователя
 * @property {string} status - Статус разговора ('active', 'inactive', 'archived')
 * @property {string} language - Язык разговора (ISO код)
 * @property {number} messageCount - Количество сообщений в разговоре
 * @property {string} startedAt - Время начала разговора
 * @property {string} [lastMessageAt] - Время последнего сообщения
 */

/**
 * @typedef {Object} ChatResponse
 * @property {boolean} success - Успешность запроса
 * @property {Object} data - Данные ответа
 * @property {string} data.message - Ответное сообщение
 * @property {string} data.conversationId - ID разговора
 * @property {string} data.messageId - ID сообщения
 * @property {boolean} data.needsTicket - Нужно ли создавать тикет
 * @property {string} [data.ticketId] - ID созданного тикета
 * @property {string} [data.ticketError] - Ошибка создания тикета
 * @property {number} data.tokensUsed - Количество использованных токенов
 * @property {string} data.language - Язык ответа
 * @property {string} data.timestamp - Время создания ответа
 * @property {Object} data.metadata - Дополнительные метаданные
 */

/**
 * @typedef {Object} ApiError
 * @property {boolean} success - Всегда false для ошибок
 * @property {string} error - Сообщение об ошибке
 * @property {string} code - Код ошибки
 * @property {string} [details] - Подробности ошибки
 */

/**
 * @typedef {Object} WidgetState
 * @property {boolean} isOpen - Открыт ли виджет
 * @property {boolean} isLoading - Флаг загрузки
 * @property {boolean} isInitialized - Флаг инициализации
 * @property {boolean} isConnected - Флаг подключения к API
 * @property {string} [currentConversationId] - ID текущего разговора
 * @property {ChatMessage[]} messages - Массив сообщений
 * @property {string} [inputValue] - Значение поля ввода
 * @property {string} userId - ID пользователя
 * @property {string} language - Текущий язык
 * @property {Object} [user] - Информация о пользователе
 * @property {Object} [error] - Информация об ошибке
 */

/**
 * @typedef {Object} WidgetTheme
 * @property {string} primaryColor - Основной цвет
 * @property {string} secondaryColor - Вторичный цвет
 * @property {string} backgroundColor - Цвет фона
 * @property {string} textColor - Цвет текста
 * @property {string} highlightColor - Цвет выделения
 * @property {string} errorColor - Цвет ошибки
 * @property {string} successColor - Цвет успеха
 * @property {string} borderRadius - Радиус скругления границ
 * @property {string} fontFamily - Основной шрифт
 * @property {string} fontSize - Размер шрифта
 */

/**
 * @typedef {Object} I18nStrings
 * @property {string} welcomeMessage - Приветственное сообщение
 * @property {string} inputPlaceholder - Плейсхолдер для поля ввода
 * @property {string} sendButtonLabel - Подпись кнопки отправки
 * @property {string} closeButtonLabel - Подпись кнопки закрытия
 * @property {string} loadingMessage - Сообщение о загрузке
 * @property {string} errorMessage - Сообщение об ошибке
 * @property {string} reconnectMessage - Сообщение о переподключении
 * @property {string} ticketCreatedMessage - Сообщение о создании тикета
 */

/**
 * @typedef {Object} WidgetEvents
 * @property {Function} onInit - Событие инициализации
 * @property {Function} onOpen - Событие открытия
 * @property {Function} onClose - Событие закрытия
 * @property {Function} onMessage - Событие нового сообщения
 * @property {Function} onError - Событие ошибки
 * @property {Function} onTicketCreated - Событие создания тикета
 * @property {Function} onConnectionChange - Событие изменения соединения
 * @property {Function} onLanguageChange - Событие изменения языка
 */

/**
 * @typedef {Object} WidgetDOMElements
 * @property {HTMLElement} container - Контейнер виджета
 * @property {HTMLElement} header - Заголовок виджета
 * @property {HTMLElement} body - Тело виджета
 * @property {HTMLElement} footer - Футер виджета
 * @property {HTMLElement} messagesContainer - Контейнер сообщений
 * @property {HTMLElement} inputContainer - Контейнер ввода
 * @property {HTMLElement} input - Поле ввода
 * @property {HTMLElement} sendButton - Кнопка отправки
 * @property {HTMLElement} toggleButton - Кнопка переключения
 * @property {HTMLElement} closeButton - Кнопка закрытия
 */

// Экспорт типов не нужен, так как JSDoc использует глобальную область видимости для типов