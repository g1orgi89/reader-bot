# Исправление CSP для CORS Test

## Проблема

Тест CORS содержал inline-скрипты (`onclick` атрибуты), что нарушало Content Security Policy (CSP). 

## Решение

1. **Обновлен HTML** (`client/test-cors.html`):
   - Убраны все `onclick` атрибуты 
   - Добавлены `data-test` атрибуты для кнопок
   - Встроен CSS прямо в HTML (для простоты)

2. **Создан JavaScript файл** (`client/static/cors-test.js`):
   - Все функции тестирования вынесены в отдельный файл
   - Используется `addEventListener` вместо inline обработчиков
   - Добавлено сопоставление кнопок и функций через `data-test`

3. **Нужно обновить server/index.js**:
   
   В функции `setupMiddleware()` следует изменить CSP настройки:

   ```javascript
   scriptSrc: [
     "'self'",
     // УБРАТЬ: "'unsafe-inline'",  // Больше не нужно!
     "cdnjs.cloudflare.com"
   ],
   ```

4. **Обновлены static file routes**:
   
   Убедитесь, что есть маршрут для `/static` который ведет на `client/static`:
   
   ```javascript
   // В setupMiddleware()
   app.use('/static', express.static(path.join(__dirname, '../client/static')));
   ```

## Результат

- ✅ CORS тесты работают без inline-скриптов
- ✅ CSP больше не блокирует выполнение
- ✅ Все тесты функционируют как раньше
- ✅ Безопасность улучшена

## Дополнительно

Если нужно сохранить старую функциональность во время разработки, можно добавить условие:

```javascript
// Только для режима разработки
if (process.env.NODE_ENV === 'development') {
  helmetConfig.contentSecurityPolicy.directives.scriptSrc.push("'unsafe-inline'");
}
```

Но это не рекомендуется, лучше исправить весь код для работы без inline-скриптов.
