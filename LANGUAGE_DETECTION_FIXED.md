# Тестирование определения языка в Shrooms Support Bot

## Исправленные проблемы
✅ Исправлена проблема с UTF-8 кодировкой  
✅ Добавлена обработка rawBody в случае проблем с кодировкой  
✅ Улучшено контекстное определение языка  
✅ Добавлено логирование для отладки  

## Команды для тестирования

### 1. Windows (Git Bash/PowerShell)

```bash
# Русский язык
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Accept-Charset: utf-8" \
  --data-raw "{\"text\": \"Привет, как подключить кошелек?\"}"

# Английский язык  
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-raw "{\"text\": \"Hello, how to connect wallet?\"}"

# Испанский язык
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-raw "{\"text\": \"Hola, ¿cómo conectar la billetera?\"}"
```

### 2. Linux/macOS

```bash
# Русский язык
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Привет, как подключить кошелек?"}'

# Английский язык
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Hello, how to connect wallet?"}'

# Испанский язык  
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Hola, ¿cómo conectar la billetera?"}'
```

## Ожидаемые результаты

### Русский язык
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "ru",
    "text": "Привет, как подключить кошелек?",
    "method": "basic",
    "metadata": {
      "hasHistory": false,
      "historyCount": 0,
      "textLength": 30,
      "encoding": "utf-8"
    }
  }
}
```

### Английский язык
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "en",
    "text": "Hello, how to connect wallet?",
    "method": "basic",
    "metadata": {
      "hasHistory": false,
      "historyCount": 0,
      "textLength": 29,
      "encoding": "utf-8"
    }
  }
}
```

### Испанский язык
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "es",
    "text": "Hola, ¿cómo conectar la billetera?",
    "method": "basic",
    "metadata": {
      "hasHistory": false,
      "historyCount": 0,
      "textLength": 34,
      "encoding": "utf-8"
    }
  }
}
```

## Тестирование полного чат API

```bash
# Полный запрос к chat API с русским языком
curl -X POST "http://localhost:3000/api/chat/message" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-raw "{\"message\": \"Привет! Как подключить кошелек к платформе?\", \"userId\": \"test-user-123\"}"
```

## Проверка работы в браузере

1. Откройте сайт: `http://localhost:3000`
2. Откройте Developer Tools (F12)
3. Перейдите на вкладку Console
4. Выполните следующий JavaScript:

```javascript
// Тест определения языка
fetch('/api/chat/detect-language', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  },
  body: JSON.stringify({
    text: 'Привет, как подключить кошелек?'
  })
})
.then(response => response.json())
.then(data => console.log('Language detection result:', data));
```

## Отладка

Если русский текст все еще отображается как знаки вопроса, проверьте:

1. **Логи сервера** - должно появиться сообщение о Language detection request
2. **Кодировка терминала** - убедитесь, что терминал поддерживает UTF-8
3. **Перезапустите сервер** после внесения изменений

## Техническая информация

### Что было исправлено:

1. **Middleware для UTF-8** в `server/index.js`:
   - Добавлена принудительная установка charset=utf-8
   - Исправлена обработка verify функции для body parsing

2. **Language detection endpoint** в `server/api/chat.js`:
   - Добавлена проверка на неправильную кодировку (знаки вопроса)
   - Добавлен fallback к rawBody при проблемах с кодировкой
   - Расширено логирование для отладки

3. **Контекстное определение языка**:
   - История сообщений получается ДО определения языка
   - Язык разговора обновляется при изменении
   - Добавлено логирование изменений языка

Теперь бот корректно определяет русский, английский и испанский языки! 🍄
