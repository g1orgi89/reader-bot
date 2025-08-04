# 🍄 Инструкции по тестированию упрощенной системы языков

## 🚀 **БЫСТРЫЙ СТАРТ**

После внедрения упрощенной системы определения языков, проведите следующие тесты:

### 1. **Проверка запуска сервера**
```bash
npm start
```

**Ожидаемый результат**:
```
🚀 Starting Shrooms Support Bot Server...
🌍 Language Service: Simple (3 languages supported)
🍄 Language detection: SIMPLIFIED (no complex analysis)
✅ Server running on port 3000
```

### 2. **Базовое тестирование API**

#### Русский язык:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Привет, что такое токен SHROOMS?", "userId": "test-ru"}'
```

#### Английский язык:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what is SHROOMS token?", "userId": "test-en"}'
```

#### Испанский язык:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola, qué es el token SHROOMS?", "userId": "test-es"}'
```

### 3. **Тестирование переключения языков**

```bash
# Сохраните conversationId из первого ответа
CONV_ID="ваш_conversation_id"

# Отправляем сообщение на русском
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Расскажи подробнее", "userId": "test-switch", "conversationId": "'$CONV_ID'"}'

# Переключаемся на английский
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Now tell me in English", "userId": "test-switch", "conversationId": "'$CONV_ID'"}'
```

## 🧪 **ПОДРОБНОЕ ТЕСТИРОВАНИЕ**

### **Тест 1: Определение языка по API**
```bash
curl -X POST http://localhost:3000/api/chat/detect-language \
  -H "Content-Type: application/json" \
  -d '{"text": "Как подключить кошелек?"}'
```

**Ожидаемый ответ**:
```json
{
  "success": true,
  "data": {
    "detectedLanguage": "ru",
    "method": "simple",
    "metadata": {
      "simplified": true
    }
  }
}
```

### **Тест 2: Socket.IO интерфейс**

1. Откройте: http://localhost:3000/test-chat.html
2. Переключитесь на "Socket.IO" режим
3. Отправьте сообщения:
   - "Привет!" (должен ответить на русском)
   - "Hello!" (должен переключиться на английский)
   - "¡Hola!" (должен переключиться на испанский)

### **Тест 3: Health Check**
```bash
curl http://localhost:3000/api/health | jq '.services.language'
```

**Ожидаемый ответ**:
```json
{
  "status": "ok",
  "service": "SimpleLanguageService",
  "supportedLanguages": 3,
  "defaultLanguage": "en"
}
```

### **Тест 4: Статистика языков**
```bash
curl http://localhost:3000/api/chat/languages
```

**Ожидаемый ответ**:
```json
{
  "success": true,
  "data": {
    "supportedLanguages": [
      {"code": "en", "name": "English", "nativeName": "English"},
      {"code": "es", "name": "Spanish", "nativeName": "Español"}, 
      {"code": "ru", "name": "Russian", "nativeName": "Русский"}
    ],
    "defaultLanguage": "en"
  }
}
```

## ⚡ **ТЕСТИРОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ**

### **Скорость ответа**
```bash
# Измеряем время обработки
time curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Test performance", "userId": "perf-test"}' \
  -s > /dev/null
```

**Ожидаемый результат**: < 2 секунды общего времени

### **Параллельные запросы**
```bash
# Отправляем 5 параллельных запросов
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "Parallel test '$i'", "userId": "parallel-'$i'"}' &
done
wait
```

**Ожидаемый результат**: Все запросы должны завершиться успешно

## 🔍 **ПРОВЕРКА КАЧЕСТВА ОПРЕДЕЛЕНИЯ ЯЗЫКА**

### **Тестовые фразы для проверки**:

#### Должны определиться как русский (ru):
- "Привет, как дела?"
- "Что такое кошелек?"
- "У меня проблема с подключением"
- "Помощь нужна"
- "Спасибо за ответ"

#### Должны определиться как английский (en):
- "Hello, how are you?"
- "What is a wallet?"
- "I have a connection problem"
- "Need help"
- "Thank you for response"

#### Должны определиться как испанский (es):
- "Hola, ¿cómo estás?"
- "¿Qué es una billetera?"
- "Tengo un problema de conexión"
- "Necesito ayuda"
- "Gracias por la respuesta"

### **Скрипт автоматического тестирования**:
```bash
#!/bin/bash
# test-language-detection.sh

declare -A tests=(
  ["Привет, как дела?"]="ru"
  ["Hello, how are you?"]="en"
  ["Hola, ¿cómo estás?"]="es"
  ["Что такое токен?"]="ru"
  ["What is a token?"]="en"
  ["¿Qué es un token?"]="es"
)

for text in "${!tests[@]}"; do
  expected="${tests[$text]}"
  result=$(curl -s -X POST http://localhost:3000/api/chat/detect-language \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$text\"}" | jq -r '.data.detectedLanguage')
  
  if [ "$result" = "$expected" ]; then
    echo "✅ PASS: \"$text\" → $result"
  else
    echo "❌ FAIL: \"$text\" → $result (expected: $expected)"
  fi
done
```

## 🐛 **РЕШЕНИЕ ПРОБЛЕМ**

### **Проблема**: Сервер не запускается
**Решение**: 
1. Проверьте, что создан файл `server/services/simpleLanguage.js`
2. Убедитесь, что все импорты обновлены в `server/index.js` и `server/api/chat.js`

### **Проблема**: Неправильное определение языка
**Решение**:
1. Проверьте ключевые слова в `simpleLanguage.js`
2. Добавьте больше маркеров для нужного языка
3. Убедитесь, что Claude получает правильный контекст

### **Проблема**: Медленные ответы
**Решение**:
1. Проверьте логи на наличие ошибок
2. Убедитесь, что старые сервисы детекции отключены
3. Проверьте производительность Claude API

## 🎯 **КРИТЕРИИ УСПЕХА**

### ✅ **Все тесты должны пройти успешно, если**:
- Сервер запускается без ошибок
- API `/chat` отвечает быстро (< 2 сек)
- Языки определяются правильно (>90% точность)
- Socket.IO работает стабильно
- Health check показывает все сервисы как "ok"
- Переключение языков работает плавно

### 📊 **Метрики успеха**:
- **Время ответа**: < 2 секунд
- **Точность**: > 90% правильных определений
- **Стабильность**: 0 критических ошибок
- **Производительность**: выдерживает 10+ параллельных запросов

## 🚀 **СЛЕДУЮЩИЕ ШАГИ**

После успешного тестирования:

1. **Удалить старые файлы**:
   ```bash
   rm server/services/languageDetect.js
   rm server/utils/languageDetect.js  
   rm server/api/language-debug.js
   ```

2. **Обновить документацию**:
   - Удалить секции о сложной детекции в README
   - Обновить API документацию

3. **Мониторинг в production**:
   - Следить за точностью определения языков
   - Мониторить производительность
   - Собирать отзывы пользователей

---

**Дата создания**: 28 мая 2025  
**Статус**: ✅ Готово к тестированию  
**Автор**: Shrooms Development Team 🍄