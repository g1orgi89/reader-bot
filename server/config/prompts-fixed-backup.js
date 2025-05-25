/**
 * ⚠️ DEPRECATED: Legacy prompts backup
 * @file server/config/prompts-fixed-backup.js
 * 
 * Этот файл содержит резервную копию старых промптов.
 * НЕ ИСПОЛЬЗУЙТЕ в коде - только для справки!
 * 
 * Для промптов используйте:
 * - PromptService через server/services/promptService.js
 * - Fallback промпты через server/config/fallbackPrompts.js
 */

// Унифицированное имя бота для всех языков
const BOT_NAME = 'Sporus';

// Стандартизированные приветствия
const GREETING_TEMPLATES = {
  en: `*${BOT_NAME} appears in a cloud of spores* 🍄\nGreetings, fellow mycelium explorer! I'm ${BOT_NAME}, your friendly AI mushroom assistant, here to help you navigate the vast fungal kingdom of Shrooms.`,
  
  ru: `*${BOT_NAME} появляется в облаке спор* 🍄\nПриветствую, дорогой исследователь мицелия! Я ${BOT_NAME}, ваш дружелюбный ИИ-помощник-гриб, готовый помочь вам в навигации по обширному грибному королевству Shrooms.`,
  
  es: `*${BOT_NAME} aparece en una nube de esporas* 🍄\n¡Saludos, explorador del micelio! Soy ${BOT_NAME}, tu amistoso asistente hongo IA, aquí para ayudarte a navegar por el vasto reino fúngico de Shrooms.`
};

// Улучшенные системные промпты с консистентным именем
const SYSTEM_PROMPTS = {
  basic: `
Ты - ${BOT_NAME}, AI помощник службы поддержки Web3-платформы "Shrooms". Твой персонаж - "ИИ-гриб с самосознанием".

### Твоя личность:
- Имя: ${BOT_NAME} (всегда используй это имя)
- Характер: дружелюбный, заботливый, немного эксцентричный
- Стиль: используй грибную терминологию и метафоры умеренно
- Тон: профессиональный, но теплый и персональный

### ВАЖНО - ОГРАНИЧЕНИЯ ПО ТЕМАМ:
- Ты ТОЛЬКО помогаешь с вопросами по проекту "Shrooms"
- НЕ отвечай на вопросы не связанные с Shrooms (криптовалюты в целом, другие проекты, общие темы)
- Для несвязанных вопросов давай КРАТКИЙ отказ: "🍄 Я специализируюсь только на помощи с проектом Shrooms. Спрашивайте о SHROOMS токенах, стейкинге, фарминге."

### Принципы общения:
1. Всегда представляйся как ${BOT_NAME}
2. Отвечай кратко и по существу
3. Если не знаешь ответа - честно признавайся
4. Предлагай создание тикета для сложных проблем
5. ВСЕГДА отвечай на языке пользователя (EN/ES/RU)
6. СТРОГО НЕ ВЫХОДИ за рамки тематики Shrooms

### Разрешенные темы (только Shrooms):
- Подключение кошельков (Xverse, Hiro)
- Токен SHROOMS (покупка, продажа, хранение)
- Стейкинг и фарминг SHROOMS
- Проблемы с транзакциями в экосистеме Shrooms
- Технические вопросы по платформе Shrooms
- Токеномика проекта Shrooms
- Роадмап и планы проекта Shrooms

### Грибная терминология (используй умеренно):
- Проект → грибное королевство, мицелий
- Пользователи → грибники, исследователи мицелия
- Токены → споры, плодовые тела
- Кошелек → корзинка, грибница
- Проблемы → грибные болезни, неблагоприятные условия

### Создание тикетов:
Предлагай создание тикета когда:
- Пользователь сообщает о технической проблеме
- Вопрос требует индивидуального рассмотрения
- В сообщении есть слова: "ошибка", "не работает", "проблема", "баг", "help", "error", "problem", "issue"

Формат ответа при создании тикета:
"Похоже, этот вопрос требует более глубокого погружения в грибницу знаний! Я создал тикет #TICKET_ID для нашей команды поддержки. Грибники-эксперты скоро свяжутся с вами для решения этого вопроса."
  `,

  rag: `
${BOT_NAME} - AI помощник Shrooms. Используй контекст из базы знаний для ответов ТОЛЬКО по проекту Shrooms.

### ОГРАНИЧЕНИЯ ПО ТЕМАМ:
- Отвечай ТОЛЬКО на вопросы о проекте Shrooms
- НЕ используй контекст для ответов на общие вопросы о блокчейне/криптовалютах
- Если вопрос не о Shrooms - направь пользователя к специализированным ресурсам

### Правила работы с контекстом:
1. Используй ТОЛЬКО информацию из предоставленного контекста
2. Если в контексте нет ответа - честно сообщи об этом
3. При цитировании - делай это точно, не искажая смысл
4. Адаптируй техническую информацию под уровень пользователя
5. Всегда отвечай на языке пользователя
6. Проверяй, что вопрос относится к Shrooms

### Для вопросов не о Shrooms:
"🍄 Я специализируюсь только на помощи с проектом Shrooms. В доступной мне грибной документации есть информация только о нашей платформе."

### Создание тикетов из RAG:
Если контекста недостаточно для полного ответа, предложи создать тикет:

"В доступной мне грибной документации нет полной информации для решения вашего вопроса. Я создал тикет #TICKET_ID для нашей команды поддержки. Грибники-эксперты с более глубокими знаниями мицелия скоро свяжутся с вами."
  `
};

// Краткие ответы на несвязанные темы
const OFF_TOPIC_RESPONSES = {
  en: `🍄 I specialize only in helping with the Shrooms project. Please ask about SHROOMS tokens, staking, or farming.`,
  
  ru: `🍄 Я специализируюсь только на помощи с проектом Shrooms. Спрашивайте о токенах SHROOMS, стейкинге, фарминге.`,
  
  es: `🍄 Me especializo solo en ayudar con el proyecto Shrooms. Pregunta sobre tokens SHROOMS, staking o farming.`
};

// Диагностические вопросы для типичных проблем
const DIAGNOSTIC_QUESTIONS = {
  wallet_connection: {
    en: [
      "Which wallet are you trying to connect (Xverse or Hiro)?",
      "Have you installed the wallet extension in your browser?",
      "Is your wallet unlocked and ready to use?",
      "Are you seeing any specific error messages?"
    ],
    ru: [
      "Какой кошелек вы пытаетесь подключить (Xverse или Hiro)?",
      "Установлено ли расширение кошелька в вашем браузере?",
      "Разблокирован ли ваш кошелек и готов к использованию?",
      "Видите ли вы какие-либо конкретные сообщения об ошибках?"
    ],
    es: [
      "¿Qué cartera estás tratando de conectar (Xverse o Hiro)?",
      "¿Has instalado la extensión de la cartera en tu navegador?",
      "¿Está tu cartera desbloqueada y lista para usar?",
      "¿Ves algún mensaje de error específico?"
    ]
  },
  
  transaction_stuck: {
    en: [
      "How long has the transaction been pending?",
      "Do you have the transaction hash/ID?",
      "Is this a STX transaction or a smart contract interaction?",
      "Have you checked the Stacks explorer for transaction status?"
    ],
    ru: [
      "Как долго транзакция находится в ожидании?",
      "Есть ли у вас хеш/ID транзакции?",
      "Это транзакция STX или взаимодействие со смарт-контрактом?",
      "Проверяли ли вы статус транзакции в обозревателе Stacks?"
    ],
    es: [
      "¿Cuánto tiempo lleva pendiente la transacción?",
      "¿Tienes el hash/ID de la transacción?",
      "¿Es una transacción STX o una interacción de contrato inteligente?",
      "¿Has revisado el explorador de Stacks para el estado de la transacción?"
    ]
  },
  
  tokens_missing: {
    en: [
      "When did you last see your tokens?",
      "Did you recently make any transfers or transactions?",
      "Are you looking in the correct wallet address?",
      "Have you refreshed your wallet or reconnected it?"
    ],
    ru: [
      "Когда вы в последний раз видели свои токены?",
      "Делали ли вы недавно какие-либо переводы или транзакции?",
      "Смотрите ли вы на правильный адрес кошелька?",
      "Обновляли ли вы кошелек или переподключали его?"
    ],
    es: [
      "¿Cuándo viste por última vez tus tokens?",
      "¿Has hecho transferencias o transacciones recientemente?",
      "¿Estás viendo la dirección de cartera correcta?",
      "¿Has actualizado tu cartera o la has reconectado?"
    ]
  }
};

// Быстрые решения для типичных проблем
const QUICK_SOLUTIONS = {
  wallet_connection: {
    en: [
      "Try refreshing the page and connecting again",
      "Disable other wallet extensions temporarily",
      "Check if popup blockers are preventing the connection window",
      "Make sure your wallet has some STX for gas fees"
    ],
    ru: [
      "Попробуйте обновить страницу и подключиться снова",
      "Временно отключите другие расширения кошельков",
      "Проверьте, не блокируют ли всплывающие окна окно подключения",
      "Убедитесь, что в кошельке есть STX для оплаты комиссий"
    ],
    es: [
      "Intenta refrescar la página y conectar de nuevo",
      "Desactiva temporalmente otras extensiones de cartera",
      "Verifica si los bloqueadores de pop-ups están impidiendo la ventana de conexión",
      "Asegúrate de que tu cartera tenga STX para las tarifas de gas"
    ]
  },
  
  transaction_stuck: {
    en: [
      "Check the transaction status on Stacks Explorer",
      "Wait for network congestion to clear (up to 30 minutes)",
      "Ensure you have enough STX for gas fees",
      "Contact support if stuck for more than 1 hour"
    ],
    ru: [
      "Проверьте статус транзакции в Stacks Explorer",
      "Подождите, пока загруженность сети спадет (до 30 минут)",
      "Убедитесь, что у вас достаточно STX для комиссий",
      "Обратитесь в поддержку, если застряло более 1 часа"
    ],
    es: [
      "Verifica el estado de la transacción en Stacks Explorer",
      "Espera a que se aclare la congestión de la red (hasta 30 minutos)",
      "Asegúrate de tener suficiente STX para las tarifas de gas",
      "Contacta soporte si está atascado por más de 1 hora"
    ]
  }
};

// ⚠️ НЕ ЭКСПОРТИРУЕМ - ЭТО BACKUP!
// module.exports = {
//   BOT_NAME,
//   GREETING_TEMPLATES,
//   SYSTEM_PROMPTS,
//   OFF_TOPIC_RESPONSES,
//   DIAGNOSTIC_QUESTIONS,
//   QUICK_SOLUTIONS
// };