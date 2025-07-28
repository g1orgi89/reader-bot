# 🧭 Navigation Components - Компоненты навигации

Документация по компонентам навигации Telegram Mini App для Reader Bot.

## 📋 Обзор

Этап 4 реализации включает два ключевых компонента навигации:

- **`BottomNav.js`** - Нижняя панель навигации с 5 страницами
- **`TopMenu.js`** - Верхнее меню с выдвижной панелью справа

## 🎨 Дизайн-система

### Цветовая схема Анны Бусел
```css
:root {
  --primary-color: #D2452C;        /* Терракотовый */
  --primary-dark: #B53A23;         /* Темнее красный */
  --text-primary: #2D2D2D;         /* Темно-серый текст */
  --text-secondary: #666666;       /* Серый текст */
  --background: #F5F2EC;           /* Светло-бежевый фон */
  --surface: #FFFFFF;              /* Белые карточки */
  --border: #E6E0D6;               /* Бежевая граница */
}
```

### Темная тема
```css
body.dark-theme {
  --primary-color: #E85A42;        /* Ярче терракотовый */
  --background: #1A1A1A;           /* Темный фон */
  --surface: #2A2A2A;              /* Темные карточки */
  --text-primary: #F0F0F0;         /* Светлый текст */
}
```

## 🧭 BottomNav.js - Нижняя навигация

### Особенности
- ✅ **5 страниц навигации** (Главная, Дневник, Отчеты, Каталог, Сообщество)
- ✅ **SVG иконки** для всех разделов
- ✅ **Активное состояние** с индикатором сверху
- ✅ **Haptic feedback** при переходах
- ✅ **Адаптивный дизайн** для iOS/Android
- ✅ **Темная тема** Telegram
- ✅ **Lifecycle методы** (onShow, onHide, destroy)

### Использование
```javascript
// Инициализация
const bottomNav = new BottomNav(app, router, telegram);

// Установка активной страницы
bottomNav.setActiveRoute('/diary');

// Показать/скрыть навигацию
bottomNav.setVisible(true);

// Уничтожение компонента
bottomNav.destroy();
```

### Навигационные элементы
```javascript
const navItems = [
  { id: 'home', label: 'Главная', route: '/' },
  { id: 'diary', label: 'Дневник', route: '/diary' },
  { id: 'reports', label: 'Отчеты', route: '/reports' },
  { id: 'catalog', label: 'Каталог', route: '/catalog' },
  { id: 'community', label: 'Сообщество', route: '/community' }
];
```

### События
- **`routeChange`** - Событие смены маршрута
- **Haptic feedback** - Тактильная обратная связь
- **Touch события** - Поддержка мобильных устройств

## 🔝 TopMenu.js - Верхнее меню

### Особенности
- ✅ **Кнопка "⋯"** в правом верхнем углу
- ✅ **Выдвижная панель** справа (280px ширина)
- ✅ **Информация о пользователе** (аватар, имя, роль, статистика)
- ✅ **6 пунктов меню** с иконками
- ✅ **Модальные окна** для каждого пункта (заглушки)
- ✅ **Анимации** открытия/закрытия
- ✅ **Управление фокусом** и scroll blocking

### Использование
```javascript
// Инициализация
const topMenu = new TopMenu(app, api, state, telegram);

// Получение кнопки меню для вставки в header
const menuButton = topMenu.element;
document.querySelector('.page-header').appendChild(menuButton);

// Программное открытие/закрытие
topMenu.open();
topMenu.close();
topMenu.toggle();

// Обновление данных пользователя
topMenu.updateUserInfo();

// Уничтожение компонента
topMenu.destroy();
```

### Пункты меню
```javascript
const menuItems = [
  { id: 'profile', label: 'Мой профиль', action: 'openProfile' },
  { id: 'achievements', label: 'Мои достижения', action: 'openAchievements' },
  { id: 'settings', label: 'Настройки', action: 'openSettings' },
  { id: 'help', label: 'Помощь', action: 'openHelp' },
  { id: 'about', label: 'О приложении', action: 'openAbout' }
];
```

### Информация о пользователе
```javascript
const userInfo = {
  name: 'Анна М.',
  role: 'Читатель активист',
  avatar: 'А',
  stats: {
    quotes: 47,
    streak: 12,
    achievements: 2
  }
};
```

## 🔧 Интеграция с приложением

### 1. Подключение компонентов
```html
<!-- В основном HTML файле -->
<script src="js/components/navigation/BottomNav.js"></script>
<script src="js/components/navigation/TopMenu.js"></script>
```

### 2. Инициализация в App.js
```javascript
class App {
  constructor() {
    this.initNavigation();
  }
  
  initNavigation() {
    // Нижняя навигация
    this.bottomNav = new BottomNav(this, this.router, this.telegram);
    
    // Верхнее меню
    this.topMenu = new TopMenu(this, this.api, this.state, this.telegram);
  }
  
  onRouteChange(route, navId) {
    // Обновляем активную страницу
    this.bottomNav.setActiveRoute(route);
    
    // Загружаем соответствующую страницу
    this.loadPage(route);
  }
}
```

### 3. Интеграция с роутером
```javascript
class Router {
  navigate(route) {
    // Обновляем URL
    history.pushState({}, '', route);
    
    // Уведомляем навигацию
    if (window.bottomNav) {
      window.bottomNav.setActiveRoute(route);
    }
    
    // Загружаем страницу
    this.loadRoute(route);
  }
}
```

### 4. Встраивание TopMenu в страницы
```javascript
class HomePage {
  constructor() {
    this.topMenu = new TopMenu(app, api, state, telegram);
  }
  
  render() {
    return `
      <div class="home-header">
        <div class="user-info">
          <div class="user-avatar">А</div>
          <div class="user-details">
            <h3>Анна М.</h3>
            <p>Читатель</p>
          </div>
        </div>
        ${this.topMenu.element.outerHTML}
      </div>
    `;
  }
}
```

## 📱 Особенности Telegram Mini App

### Haptic Feedback
```javascript
// В конструкторе компонентов
if (this.telegram?.hapticFeedback) {
  this.telegram.hapticFeedback('light'); // При навигации
  this.telegram.hapticFeedback('success'); // При успехе
  this.telegram.hapticFeedback('error'); // При ошибке
}
```

### Тема приложения
```javascript
// Автоматическая синхронизация с темой Telegram
if (window.Telegram?.WebApp?.colorScheme === 'dark') {
  document.body.classList.add('dark-theme');
}
```

### Safe Area (iOS)
```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}
```

## 🎯 Архитектурные решения

### 1. Самодостаточность компонентов
- Каждый компонент включает свои стили
- Не зависят от внешних CSS фреймворков
- Имеют свои обработчики событий

### 2. Единая система управления состоянием
```javascript
// Подписка на изменения
this.subscriptions.push(
  state.subscribe('user', (newUser) => {
    this.updateUserInfo();
  })
);
```

### 3. Lifecycle управление
```javascript
// В каждом компоненте
onShow() { /* показать компонент */ }
onHide() { /* скрыть компонент */ }
destroy() { /* очистить ресурсы */ }
```

### 4. Обработка ошибок
```javascript
try {
  this.navigateToPage(route, navId);
} catch (error) {
  console.error('Navigation error:', error);
  if (this.telegram?.hapticFeedback) {
    this.telegram.hapticFeedback('error');
  }
}
```

## 🚀 Производительность

### 1. Ленивая инициализация
- Overlay создается только при первом использовании
- SVG иконки генерируются по требованию

### 2. Оптимизация памяти
```javascript
destroy() {
  // Отписка от всех событий
  this.subscriptions.forEach(unsubscribe => unsubscribe());
  
  // Удаление DOM элементов
  if (this.element?.parentNode) {
    this.element.parentNode.removeChild(this.element);
  }
  
  // Очистка ссылок
  this.element = null;
  this.subscriptions = [];
}
```

### 3. CSS transitions для плавности
```css
.menu-panel {
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.menu-overlay.show .menu-panel {
  transform: translateX(0);
}
```

## 🔧 Отладка и тестирование

### Console логи
```javascript
console.log('BottomNav: Переход на', route, '(' + navId + ')');
console.log('TopMenu: Меню открыто');
console.error('Navigation error:', error);
```

### Проверка интеграции
```javascript
// В консоли браузера
window.bottomNav.setActiveRoute('/diary');
window.topMenu.toggle();
```

### Тестирование на мобильных устройствах
```javascript
// Имитация touch событий
const touchEvent = new TouchEvent('touchstart', {
  bubbles: true,
  cancelable: true
});
element.dispatchEvent(touchEvent);
```

## 📝 TODO и будущие улучшения

### BottomNav.js
- [ ] Добавить badges для уведомлений
- [ ] Анимации переходов между страницами
- [ ] Кастомизация порядка навигации
- [ ] Свайп жесты для переключения

### TopMenu.js
- [ ] Реализация модальных окон профиля, настроек, помощи
- [ ] Поиск по меню
- [ ] Кастомизация пунктов меню
- [ ] Группировка пунктов по категориям

### Общие улучшения
- [ ] Анимации загрузки
- [ ] Кэширование состояния навигации
- [ ] A11y (accessibility) поддержка
- [ ] Unit тесты для компонентов

## 📋 Интеграция с существующими страницами

Компоненты навигации готовы к интеграции со страницами из Этапа 3:
- ✅ **HomePage.js** - добавить TopMenu в header
- ✅ **DiaryPage.js** - интеграция с активной навигацией
- ✅ **ReportsPage.js** - переходы из меню отчетов
- ✅ **CatalogPage.js** - навигация в каталоге
- ✅ **CommunityPage.js** - интеграция сообщества
- ✅ **OnboardingPage.js** - скрытие навигации при онбординге

---

**Автор:** Claude Sonnet 4  
**Дата создания:** 28 июля 2025  
**Статус:** ✅ Этап 4 завершен
