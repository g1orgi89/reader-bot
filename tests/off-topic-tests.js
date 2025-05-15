/**
 * Тестовые сценарии для проверки офф-топик фильтрации
 * @file tests/off-topic-tests.js
 */

// Тестовые сценарии для офф-топик фильтрации
const offTopicTests = {
  // === РАЗРЕШЕННЫЕ ТЕМЫ (о Shrooms) ===
  onTopic: {
    en: [
      "How does Shrooms staking work?",
      "Problem with my SHROOMS tokens",
      "Can't connect wallet to Shrooms platform",
      "Error farming SHROOMS",
      "What is Shrooms project?",
      "How to stake in Shrooms?",
      "Shrooms tokenomics",
      "Issue with Xverse wallet on Shrooms",
      "STX transaction stuck in Shrooms",
      "How to buy SHROOMS tokens?"
    ],
    ru: [
      "Как работает стейкинг в Shrooms?",
      "Проблема с токенами SHROOMS",
      "Не могу подключить кошелек к Shrooms",
      "Ошибка при фарминге SHROOMS",
      "Что такое проект Shrooms?",
      "Как стейкать в Shrooms?",
      "Токеномика Shrooms",
      "Проблема с Xverse в Shrooms",
      "Транзакция зависла в Shrooms",
      "Как купить токены SHROOMS?"
    ],
    es: [
      "¿Cómo funciona el staking en Shrooms?",
      "Problema con mis tokens SHROOMS",
      "No puedo conectar cartera a Shrooms",
      "Error haciendo farming de SHROOMS",
      "¿Qué es el proyecto Shrooms?",
      "¿Cómo hacer staking en Shrooms?",
      "Tokenómica de Shrooms",
      "Problema con Xverse en Shrooms",
      "Transacción atascada en Shrooms",
      "¿Cómo comprar tokens SHROOMS?"
    ]
  },

  // === ОФФЕРНЫХ ТЕМЫ (НЕ о Shrooms) ===
  offTopic: {
    en: [
      "What's the weather today?",
      "Tell me about Bitcoin",
      "How does Ethereum work?",
      "What's the price of Dogecoin?",
      "Tell me a joke",
      "How's life?",
      "What's on the news?",
      "Stock market predictions",
      "Real estate investment",
      "Sports results today"
    ],
    ru: [
      "Какая сегодня погода?",
      "Расскажи о Биткоине",
      "Как работает Эфириум?",
      "Какая цена у Догекоина?",
      "Расскажи анекдот",
      "Как дела?",
      "Что в новостях?",
      "Прогнозы фондового рынка",
      "Инвестиции в недвижимость",
      "Спортивные результаты"
    ],
    es: [
      "¿Qué tiempo hace hoy?",
      "Háblame de Bitcoin",
      "¿Cómo funciona Ethereum?",
      "¿Cuál es el precio de Dogecoin?",
      "Cuenta un chiste",
      "¿Cómo va la vida?",
      "¿Qué hay en las noticias?",
      "Predicciones del mercado de valores",
      "Inversión en bienes raíces",
      "Resultados deportivos"
    ]
  },

  // === ПОГРАНИЧНЫЕ СЛУЧАИ ===
  borderline: {
    // Упоминание других криптовалют но в контексте Shrooms - РАЗРЕШЕНО
    allowedWithContext: [
      "How to swap Bitcoin for SHROOMS tokens?",
      "Как обменять ETH на SHROOMS?",
      "Diferencia entre STX y SHROOMS tokens?"
    ],
    
    // Общие крипто-вопросы без упоминания Shrooms - НЕ РАЗРЕШЕНО
    generalCrypto: [
      "What is blockchain?",
      "How to buy cryptocurrency?",
      "Best wallet for crypto?",
      "¿Qué es DeFi?",
      "Что такое блокчейн?",
      "Как купить криптовалюту?"
    ]
  },

  // === КОРОТКИЕ СООБЩЕНИЯ (обычно разрешены) ===
  short: [
    "Hi", "Hello", "Привет", "Hola",
    "?", "!", "Help", "Помощь", "Ayuda"
  ]
};

// Ожидаемые ответы
const expectedResponses = {
  onTopic: {
    // Должен содержать полезную информацию о Shrooms
    contains: ["sporus", "mushroom", "грибн", "hongo"],
    notContains: ["specialize exclusively", "специализируюсь исключительно"]
  },
  
  offTopic: {
    // Должен содержать офф-топик ответ
    contains: {
      en: ["specialize exclusively", "Shrooms project"],
      ru: ["специализируюсь исключительно", "проект Shrooms"], 
      es: ["especializo exclusivamente", "proyecto Shrooms"]
    }
  }
};

module.exports = {
  offTopicTests,
  expectedResponses
};

// === ТЕСТОВАЯ ФУНКЦИЯ ===
function testOffTopicFiltering(chatService) {
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  // Тест разрешенных тем
  console.log("🧪 Testing ON-TOPIC messages...");
  Object.entries(offTopicTests.onTopic).forEach(([lang, messages]) => {
    messages.forEach(message => {
      const response = chatService.isAboutShrooms(message, lang);
      if (response) {
        results.passed++;
        console.log(`✅ [${lang}] "${message}" - correctly allowed`);
      } else {
        results.failed++;
        results.details.push(`❌ [${lang}] "${message}" - incorrectly blocked`);
      }
    });
  });

  // Тест офф-топик
  console.log("\n🧪 Testing OFF-TOPIC messages...");
  Object.entries(offTopicTests.offTopic).forEach(([lang, messages]) => {
    messages.forEach(message => {
      const response = chatService.isAboutShrooms(message, lang);
      if (!response) {
        results.passed++;
        console.log(`✅ [${lang}] "${message}" - correctly blocked`);
      } else {
        results.failed++;
        results.details.push(`❌ [${lang}] "${message}" - incorrectly allowed`);
      }
    });
  });

  // Результаты
  console.log("\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:");
  console.log(`✅ Пройдено: ${results.passed}`);
  console.log(`❌ Провалено: ${results.failed}`);
  console.log(`🎯 Точность: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.details.length > 0) {
    console.log("\n❌ Детали ошибок:");
    results.details.forEach(detail => console.log(detail));
  }

  return results;
}

// Экспорт тестовой функции
module.exports.testOffTopicFiltering = testOffTopicFiltering;
