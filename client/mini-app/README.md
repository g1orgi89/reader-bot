# Telegram Mini App "Читатель"

## 📱 Описание

Тelegram Mini App для персонального дневника цитат от Анны Бусел. Приложение позволяет пользователям сохранять цитаты, получать ИИ-анализ и еженедельные отчеты.

## 🚀 Функциональность

### ✅ Готово
- 🏠 **Главная страница** - статистика и быстрое добавление цитат
- 📝 **Добавление цитат** - полная форма с ИИ анализом
- 📊 **Отчеты** - еженедельные и месячные аналитики
- 🏆 **Достижения** - геймификация и прогресс
- ⚙️ **Настройки** - профиль и управление
- 📱 **PWA поддержка** - установка как приложение
- 🌐 **Offline режим** - базовая функциональность без интернета
- 🎨 **Адаптивный дизайн** - оптимизация для всех экранов
- 🔗 **Telegram интеграция** - Web App SDK, темы, haptic feedback

## 🛠 Технический стек

- **Frontend**: Vanilla JavaScript (ES6+), CSS3, HTML5
- **Интеграция**: Telegram Web App SDK
- **PWA**: Service Worker, Web App Manifest
- **Стили**: CSS Custom Properties, Flexbox, Grid
- **API**: RESTful интеграция с backend

## 📁 Структура проекта

```
client/mini-app/
├── index.html              # Главная страница
├── manifest.json           # PWA манифест
├── service-worker.js       # Service Worker для offline
├── offline.html            # Страница offline режима
├── README.md               # Документация
├── .env.example            # Пример переменных окружения
├── css/
│   ├── main.css           # Основные стили + Telegram темы
│   ├── mobile.css         # Мобильная адаптация
│   └── components.css     # UI компоненты
├── js/
│   ├── telegram.js        # Интеграция с Telegram SDK
│   ├── api.js             # API менеджер
│   └── app.js             # Основное приложение
└── assets/
    └── .gitkeep           # Папка для иконок (от дизайнера)
```

## 🔧 Установка и запуск

### Локальная разработка

1. **Запуск сервера разработки**:
   ```bash
   # Простой HTTP сервер
   python -m http.server 8000
   # или
   npx serve .
   ```

2. **Откройте в браузере**:
   ```
   http://localhost:8000
   ```

### Интеграция с Telegram

1. **Создание Mini App в BotFather**:
   ```
   /newapp
   /setappdomain - установите ваш домен
   /setappname - "Читатель"
   /setappdescription - описание приложения
   ```

2. **Настройка домена**:
   - SSL сертификат обязателен
   - HTTPS протокол
   - Корректные CORS заголовки

## 🎨 Стилизация

### Цветовая схема

```css
/* Основные цвета */
--primary-color: #6366f1;        /* Основной цвет */
--secondary-color: #f3f4f6;      /* Вторичный цвет */
--accent-color: #f59e0b;         /* Акцентный цвет */
--text-primary: #111827;         /* Основной текст */
--bg-primary: #ffffff;           /* Основной фон */
```

### Адаптация под Telegram

- Автоматическое применение тем Telegram
- Поддержка светлой и темной темы
- Адаптация цветов под `themeParams`
- Responsive дизайн для всех устройств

## 📡 API Интеграция

### Endpoints

```javascript
// Аутентификация
POST /api/reader/auth/telegram

// Цитаты
GET  /api/reader/quotes
POST /api/reader/quotes
POST /api/reader/quotes/analyze

// Статистика
GET  /api/reader/stats

// Отчеты
GET  /api/reader/reports/weekly
GET  /api/reader/reports/monthly

// Достижения
GET  /api/reader/achievements

// Профиль
GET  /api/reader/profile
```

### Mock данные

Для разработки используются встроенные mock данные, которые автоматически активируются при отсутствии backend.

## 🔄 Состояния приложения

### Загрузка
- Loader при инициализации
- Проверка Telegram Web App
- Fallback на mock данные

### Навигация
- SPA роутинг между страницами
- Breadcrumb навигация
- Telegram Back Button интеграция

### Данные
- API запросы с retry логикой
- Offline кэширование
- Optimistic UI updates

## 📱 PWA функции

### Service Worker
- Кэширование статических ресурсов
- Offline страница
- Background sync для цитат
- Push уведомления (заготовка)

### Установка
- Web App Manifest
- Иконки разных размеров
- Splash screen
- Shortcuts для быстрых действий

## 🎯 Haptic Feedback

```javascript
// Типы feedback
hapticFeedback('light')      // Легкое касание
hapticFeedback('medium')     // Среднее касание
hapticFeedback('heavy')      // Сильное касание
hapticFeedback('selection')  // Изменение выбора
hapticFeedback('success')    // Успешное действие
hapticFeedback('warning')    // Предупреждение
hapticFeedback('error')      // Ошибка
```

## 🔍 Отладка

### Developer Tools
- Console логи для всех действий
- Mock режим для разработки
- Детальные error сообщения

### Telegram отладка
```javascript
// Проверка доступности функций
TelegramManager.hasFeature('mainButton')
TelegramManager.getPlatformInfo()
```

## 🚀 Deployment

### Готовность к продакшену
- ✅ Все файлы созданы
- ✅ PWA манифест настроен
- ✅ Service Worker готов
- ✅ API интеграция завершена
- ❓ Иконки от дизайнера
- ❓ SSL сертификат
- ❓ Регистрация в BotFather

### Checklist перед запуском
- [ ] Домен с SSL
- [ ] Иконки всех размеров
- [ ] Тестирование в Telegram
- [ ] Backend API доступен
- [ ] CORS настроен
- [ ] Регистрация Mini App

## 📞 Поддержка

При возникновении вопросов:
1. Проверьте console в Developer Tools
2. Убедитесь в доступности backend API
3. Проверьте настройки Telegram Mini App

---

**Версия**: 1.0.0  
**Последнее обновление**: 19.07.2025  
**Разработчик**: Reader Bot Team для Анны Бусел