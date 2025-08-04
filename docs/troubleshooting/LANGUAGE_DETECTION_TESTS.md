# Примеры curl команд для тестирования определения языка

## Важные замечания для Windows:

### 1. Установка кодировки терминала
Перед выполнением команд установите кодировку UTF-8:
```cmd
chcp 65001
```

### 2. Для PowerShell
```powershell
$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8
```

## Базовые curl команды с правильной кодировкой:

### 1. Русский язык
```bash
# Для Windows (Git Bash/PowerShell):
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Accept-Charset: utf-8" \
  --data-raw "{\"text\": \"Привет, как подключить кошелек?\"}"

# Для Unix (Linux/macOS):
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -H "Accept-Charset: utf-8" \
  -d '{"text": "Привет, как подключить кошелек?"}'
```

### 2. Английский язык
```bash
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Hello, how to connect my wallet?"}'
```

### 3. Испанский язык
```bash
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Hola, ¿cómo puedo conectar mi billetera?"}'
```

## Полный тест переключения языков:

### 1. Создание разговора на русском
```bash
curl -X POST "http://localhost:3000/api/chat/message" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"message": "Привет, мне нужна помощь", "userId": "test-user-123"}'
```

### 2. Переключение на английский
```bash
# Замените CONVERSATION_ID на ID из предыдущего ответа
curl -X POST "http://localhost:3000/api/chat/message" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"message": "Hello, I need help with wallet error", "userId": "test-user-123", "conversationId": "CONVERSATION_ID"}'
```

### 3. Переключение на испанский  
```bash
curl -X POST "http://localhost:3000/api/chat/message" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"message": "Hola, tengo problemas con mi billetera", "userId": "test-user-123", "conversationId": "CONVERSATION_ID"}'
```

## Тесты смешанного контента:

### 1. Русский + английская ошибка
```bash
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "У меня ошибка: Failed to connect wallet: User rejected request"}'
```

### 2. Русский + JSON
```bash
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Мой конфиг: {\"network\": \"mainnet\", \"wallet\": \"xverse\"}"}'
```

### 3. Русский + URL
```bash
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Не могу зайти на https://shrooms.io/farming"}'
```

## Тестирование с контекстом:

### 1. Контекстное определение языка
```bash
# Сначала создайте разговор
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/chat/message" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"message": "Привет, мне нужна помощь", "userId": "test-context-user"}')

# Извлеките conversationId из ответа
CONV_ID=$(echo $RESPONSE | grep -o '"conversationId":"[^"]*"' | cut -d'"' -f4)

# Тестируйте короткое сообщение (должно определяться по контексту как русский)
curl -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"text\": \"Ok\", \"userId\": \"test-context-user\", \"conversationId\": \"$CONV_ID\"}"
```

## Ожидаемые результаты:

1. **Русский с кириллицей** → `"detectedLanguage": "ru"`
2. **Английский с характерными словами** → `"detectedLanguage": "en"`  
3. **Испанский с диакритиками** → `"detectedLanguage": "es"`
4. **Смешанный контент (русский + техническое)** → `"detectedLanguage": "ru"`
5. **Контекстное определение коротких сообщений** → язык из контекста

## Полезные команды для отладки:

### 1. Получение статистики языков
```bash
curl -X GET "http://localhost:3000/api/chat/languages" \
  -H "Accept: application/json; charset=utf-8"
```

### 2. Очистка кеша языка пользователя
```bash
curl -X POST "http://localhost:3000/api/chat/users/test-user-123/clear-language-cache"
```

### 3. Получение статистики чата
```bash
curl -X GET "http://localhost:3000/api/chat/stats" \
  -H "Accept: application/json; charset=utf-8"
```

## Автоматизированный тест-скрипт:

Для удобства тестирования создан скрипт `test-language-detection.sh`. Запустите его так:

```bash
# Сделайте файл исполняемым (только для Unix)
chmod +x test-language-detection.sh

# Запустите тесты
./test-language-detection.sh
```

## Устранение неполадок:

### Если видите "??????" вместо кириллицы:
1. Проверьте кодировку терминала: `chcp 65001` (Windows)
2. Используйте `--data-raw` вместо `-d` в Windows
3. Убедитесь, что сервер запущен с исправлениями UTF-8

### Если язык определяется неправильно:
1. Проверьте ответ API - возможно есть ошибка в сервисе
2. Убедитесь, что база данных подключена
3. Проверьте логи сервера на наличие ошибок

### Для дополнительной отладки:
Добавьте параметр `-v` к curl для подробного вывода:
```bash
curl -v -X POST "http://localhost:3000/api/chat/detect-language" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{"text": "Привет, как дела?"}'
```