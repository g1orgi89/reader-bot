# 🔧 Диагностика проблем с Quotes API

## Проблема
Страница цитат в админ-панели выдает ошибки 404 для всех API endpoints:
- `GET /api/quotes` → 404
- `GET /api/quotes/statistics` → 404  
- `GET /api/quotes/analytics` → 404

## Диагностические скрипты

### 1. Проверка зависимостей и импортов
```bash
cd server
node utils/test-quotes-api.js
```

Этот скрипт проверит:
- ✅ Все ли зависимости загружаются корректно
- ✅ Правильно ли экспортируются роуты
- ✅ Структуру роутов в router.stack

### 2. HTTP тестирование endpoints
```bash
cd server  
node utils/test-quotes-http.js
```

Этот скрипт проверит:
- 🌐 Доступность сервера на порту 3002
- 📡 HTTP ответы от всех quotes endpoints
- 🔐 Авторизацию Basic Auth
- 📊 Форматы JSON ответов

## Возможные причины 404

### 1. Сервер не запущен
```bash
# Запуск сервера
npm start
# или
node server/index.js
```

### 2. Роуты не зарегистрированы
Проверить в `server/index.js` строку ~196:
```javascript
app.use(`${config.app.apiPrefix}/quotes`, quotesRoutes);
```

### 3. Ошибка импорта роутов
Проверить что `server/api/quotes.js` корректно экспортирует router:
```javascript
module.exports = router;
```

### 4. Проблемы с middleware авторизации
Проверить что `basicAdminAuth` импортируется без ошибок:
```javascript
const { basicAdminAuth } = require('../middleware/auth');
```

### 5. Конфликт портов
Убедиться что порт 3002 свободен:
```bash
lsof -i :3002
```

## Логи для диагностики

### Проверить логи сервера
Запустить сервер и смотреть на вывод:
```bash
npm start
```

Искать сообщения:
- ✅ `✅ Quotes routes imported successfully`
- ❌ `❌ Failed to import quotes routes:`
- ✅ `✅ All API routes registered successfully`

### Проверить HTTP логи
При обращении к `/api/quotes` должны появляться логи:
```
🌐 HTTP GET /api/quotes
📝 Получение цитат с фильтрами: {...}
🌐 HTTP GET /api/quotes - 200 - XXXms
```

## Быстрое решение

### Шаг 1: Убедиться что сервер запущен
```bash
curl http://localhost:3002/api/health
```
Должен вернуть JSON со статусом сервера.

### Шаг 2: Тестировать quotes endpoint с авторизацией  
```bash
curl -u admin:password123 http://localhost:3002/api/quotes
```
Должен вернуть JSON с mock данными цитат.

### Шаг 3: Проверить админ-панель
Открыть `http://localhost:3002/admin/quotes.html` и проверить:
- 🔐 Авторизация работает (admin:password123)
- 📊 Данные загружаются без 404 ошибок
- 📈 Графики отображаются корректно

## Контрольные точки

- [ ] Сервер запущен на порту 3002
- [ ] `/api/health` возвращает 200 OK
- [ ] `/api/quotes` с Basic Auth возвращает JSON
- [ ] Логи показывают успешную регистрацию роутов
- [ ] Нет ошибок импорта в консоли сервера
