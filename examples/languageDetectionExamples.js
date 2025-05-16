/**
 * Примеры тестирования улучшенной системы определения языка
 * @file examples/languageDetectionExamples.js
 */

// Примеры запросов для тестирования системы определения языка

/**
 * ТЕСТ 1: Простое определение языка без контекста
 */
const simpleLanguageTests = [
  // Русский язык
  {
    text: "Что такое токен SHROOMS?",
    expected: "ru",
    description: "Простой вопрос на русском"
  },
  {
    text: "У меня проблема с кошельком",
    expected: "ru", 
    description: "Техническая проблема на русском"
  },
  
  // Английский язык
  {
    text: "What is SHROOMS token?",
    expected: "en",
    description: "Simple English question"
  },
  {
    text: "I have wallet connection error",
    expected: "en",
    description: "Technical issue in English"
  },
  
  // Испанский язык
  {
    text: "¿Qué es el token SHROOMS?",
    expected: "es",
    description: "Pregunta simple en español"
  },
  {
    text: "Tengo problema con la billetera",
    expected: "es",
    description: "Problema técnico en español"
  }
];

/**
 * ТЕСТ 2: Смешанный контент (основной язык + технические вставки)
 */
const mixedContentTests = [
  {
    text: "У меня ошибка: Error: Connection failed. Что делать?",
    expected: "ru",
    description: "Русский текст с английской ошибкой"
  },
  {
    text: "Получаю ошибку 'NetworkError: Failed to fetch' при подключении кошелька",
    expected: "ru", 
    description: "Русский текст с английским кодом ошибки"
  },
  {
    text: "I'm getting ошибка подключения, help please",
    expected: "en",
    description: "Английский текст с русской вставкой"
  },
  {
    text: "Mi billetera muestra 'Insufficient funds' error",
    expected: "es",
    description: "Испанский текст с английской ошибкой"
  }
];

/**
 * ТЕСТ 3: Короткие сообщения с контекстом
 */
const shortMessagesWithContext = [
  {
    conversation: [
      { role: "user", content: "Что такое токен SHROOMS?" },
      { role: "assistant", content: "SHROOMS - это основной токен..." }
    ],
    newMessage: "Спасибо!",
    expected: "ru",
    description: "Короткое сообщение благодарности после русского диалога"
  },
  {
    conversation: [
      { role: "user", content: "What is SHROOMS token?" },
      { role: "assistant", content: "SHROOMS is the main token..." }
    ],
    newMessage: "Thanks!",
    expected: "en",
    description: "Short thank you after English conversation"
  },
  {
    conversation: [
      { role: "user", content: "¿Qué es el token SHROOMS?" },
      { role: "assistant", content: "SHROOMS es el token principal..." }
    ],
    newMessage: "¡Gracias!",
    expected: "es",
    description: "Agradecimiento corto después de conversación en español"
  }
];

/**
 * ТЕСТ 4: Переключение языка в диалоге
 */
const languageSwitchingTests = [
  {
    conversation: [
      { role: "user", content: "Привет, как дела?" },
      { role: "assistant", content: "Привет! Все отлично..." }
    ],
    newMessage: "Hello, can you speak English?",
    expected: "en",
    description: "Переключение с русского на английский"
  },
  {
    conversation: [
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "Hello! I'm doing great..." }
    ],
    newMessage: "Хорошо, теперь на русском",
    expected: "ru",
    description: "Switching from English to Russian"
  }
];

/**
 * ТЕСТ 5: Технический контент с JSON и кодами
 */
const technicalContentTests = [
  {
    text: "У меня ошибка: {\"error\": \"NETWORK_ERROR\", \"code\": 500}",
    expected: "ru",
    description: "Русский текст с JSON вставкой"
  },
  {
    text: "Сайт выдает 404 ошибку на https://example.com/api/token",
    expected: "ru",
    description: "Русский текст с URL"
  },
  {
    text: "Transaction hash: 0x1234567890abcdef не найден в блокчейне",
    expected: "ru",
    description: "Русский текст с хешем транзакции"
  }
];

/**
 * Функция для тестирования cURL команд
 */
const generateCurlTests = () => {
  return [
    {
      description: "Простой русский запрос",
      curl: `curl -X POST http://localhost:3000/api/chat/message \\
-H "Content-Type: application/json" \\
-d '{"message": "Что такое токен SHROOMS?", "userId": "test-ru-user"}'`
    },
    {
      description: "Русский запрос с явным указанием языка",
      curl: `curl -X POST http://localhost:3000/api/chat/message \\
-H "Content-Type: application/json" \\
-d '{"message": "Что такое токен SHROOMS?", "userId": "test-ru-user", "language": "ru"}'`
    },
    {
      description: "Смешанный контент (русский + английская ошибка)",
      curl: `curl -X POST http://localhost:3000/api/chat/message \\
-H "Content-Type: application/json" \\
-d '{"message": "У меня ошибка: Error: Connection failed. Что делать?", "userId": "test-mixed-user"}'`
    },
    {
      description: "Продолжение диалога с сохранением языка",
      curl: `curl -X POST http://localhost:3000/api/chat/message \\
-H "Content-Type: application/json" \\
-d '{"message": "Спасибо", "userId": "test-ru-user", "conversationId": "CONVERSATION_ID"}'`
    },
    {
      description: "Тест определения языка",
      curl: `curl -X POST http://localhost:3000/api/chat/detect-language \\
-H "Content-Type: application/json" \\
-d '{"text": "У меня ошибка: Error 500", "userId": "test-user"}'`
    },
    {
      description: "Очистка кеша языка пользователя",
      curl: `curl -X POST http://localhost:3000/api/chat/users/test-ru-user/clear-language-cache \\
-H "Content-Type: application/json"`
    }
  ];
};

/**
 * Ожидаемые улучшения
 */
const expectedImprovements = {
  beforeUpgrade: {
    issues: [
      "Смешанный контент (русский + английская ошибка) определялся как английский",
      "Короткие сообщения часто определялись неправильно",
      "Отсутствие контекста при определении языка", 
      "Пользователь должен был указывать язык в каждом запросе cURL"
    ]
  },
  afterUpgrade: {
    improvements: [
      "Корректное определение основного языка при смешанном контенте",
      "Использование истории диалога для коротких сообщений",
      "Кеширование языковых предпочтений пользователя",
      "Автоматическое определение языка без явного указания",
      "Умное переключение языка при явной смене пользователем"
    ]
  }
};

module.exports = {
  simpleLanguageTests,
  mixedContentTests,
  shortMessagesWithContext,
  languageSwitchingTests,
  technicalContentTests,
  generateCurlTests,
  expectedImprovements
};