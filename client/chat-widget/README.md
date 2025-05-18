# Shrooms Chat Widget

Типизированный виджет чата для интеграции с Web3-платформой Shrooms. Виджет поддерживает JSDoc типизацию для удобства разработки и интеграции с TypeScript проектами.

## Особенности

- 🎨 Грибная неоновая эстетика с тремя темами (neon, light, dark)
- 🔌 Простая интеграция через iframe или прямое встраивание
- 📱 Адаптивный дизайн для мобильных устройств
- 🌐 Поддержка многоязычности (EN, ES, RU)
- 📝 Полная JSDoc типизация для JavaScript и TypeScript проектов
- 🎫 Интеграция с системой тикетов
- 🧠 Поддержка интеграции с RAG (Claude API)

## Установка

### 1. Копирование файлов виджета

Скопируйте файлы из директории `client/chat-widget` на ваш веб-сервер:

```
chat-widget/
├── types.js         # Типы для JSDoc
├── widget.js        # Основной класс виджета
├── iframe.js        # Интеграция через iframe
├── embed.js         # Скрипт для встраивания на сайт
├── styles.css       # Стили
└── index.html       # HTML шаблон
```

### 2. Настройка API URL

Убедитесь, что вы указали правильный URL до вашего API сервера в конфигурации виджета.

## Использование

### Встраивание через iframe (рекомендуемый метод)

```html
<!-- Подключение скрипта для встраивания -->
<script src="path/to/chat-widget/embed.js"></script>

<script>
  // Инициализация виджета
  const widget = new ShroomsWidgetEmbed({
    apiUrl: 'https://your-api-domain.com',
    widgetUrl: 'https://your-api-domain.com/chat-widget/',
    theme: 'neon',
    autoOpen: false
  });
  
  // Открытие виджета
  widget.open();
  
  // Отправка сообщения
  widget.sendMessage('Привет!');
  
  // Обработка событий
  widget.on('message', (data) => {
    console.log('Получено новое сообщение:', data);
  });
</script>
```

### Прямое встраивание (более гибкий метод)

```html
<!-- Подключение скрипта виджета -->
<script src="path/to/chat-widget/widget.js"></script>

<!-- Контейнер для виджета -->
<div id="shrooms-chat-widget"></div>

<script>
  // Инициализация виджета
  const chatWidget = new ShroomsWidget({
    apiUrl: 'https://your-api-domain.com',
    containerId: 'shrooms-chat-widget',
    theme: 'neon',
    autoOpen: true
  });
</script>
```

## Интеграция с TypeScript

Виджет полностью поддерживает TypeScript благодаря JSDoc типизации. Для использования в TypeScript проектах:

```typescript
// TypeScript определения
interface ShroomsWidgetEmbedConfig {
  apiUrl: string;
  widgetUrl?: string;
  containerId?: string;
  theme?: string;
  position?: {
    side?: string;
    align?: string;
    offset?: string;
  };
  autoOpen?: boolean;
  welcomeMessage?: string;
  i18n?: Record<string, string>;
  onReady?: () => void;
  onMessage?: (data: any) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: any) => void;
  onTicketCreated?: (ticketId: string) => void;
}

declare class ShroomsWidgetEmbed {
  constructor(config: ShroomsWidgetEmbedConfig);
  isReady(): boolean;
  open(): void;
  close(): void;
  sendMessage(text: string): void;
  clearHistory(): void;
  setLanguage(language: string): void;
  getState(callback: (state: any) => void): void;
  getMessages(callback: (messages: any[]) => void): void;
  on(event: string, handler: Function): ShroomsWidgetEmbed;
  once(event: string, handler: Function): ShroomsWidgetEmbed;
  off(event: string, handler: Function): ShroomsWidgetEmbed;
  updateConfig(newConfig: Partial<ShroomsWidgetEmbedConfig>): void;
}

declare global {
  interface Window {
    ShroomsWidgetEmbed: typeof ShroomsWidgetEmbed;
  }
}

// Использование
const widget = new window.ShroomsWidgetEmbed({
  apiUrl: 'https://your-api-domain.com',
  onReady: () => console.log('Widget is ready')
});
```

## API виджета

### ShroomsWidgetEmbed - интеграция через iframe

#### Конструктор

```javascript
const widget = new ShroomsWidgetEmbed(config);
```

#### Конфигурация

| Параметр | Тип | Описание |
|----------|-----|----------|
| `apiUrl` | `string` | URL API сервера (обязательный) |
| `widgetUrl` | `string` | URL iframe виджета |
| `containerId` | `string` | ID контейнера для iframe |
| `theme` | `string` | Тема оформления ('neon', 'light', 'dark') |
| `position` | `Object` | Позиция виджета |
| `position.side` | `string` | Сторона ('left', 'right') |
| `position.align` | `string` | Выравнивание ('top', 'bottom') |
| `position.offset` | `string` | Отступ от края (например, '20px') |
| `autoOpen` | `boolean` | Автоматически открывать виджет |
| `welcomeMessage` | `string` | Приветственное сообщение |
| `i18n` | `Object` | Переводы строк |
| `onReady` | `Function` | Колбэк готовности виджета |
| `onMessage` | `Function` | Колбэк при новом сообщении |
| `onOpen` | `Function` | Колбэк при открытии виджета |
| `onClose` | `Function` | Колбэк при закрытии виджета |
| `onError` | `Function` | Колбэк при ошибке |
| `onTicketCreated` | `Function` | Колбэк при создании тикета |

#### Методы

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `isReady()` | - | Проверяет готовность виджета |
| `open()` | - | Открывает виджет чата |
| `close()` | - | Закрывает виджет чата |
| `sendMessage(text)` | `text: string` | Отправляет сообщение в чат |
| `clearHistory()` | - | Очищает историю сообщений |
| `setLanguage(language)` | `language: string` | Устанавливает язык виджета |
| `getState(callback)` | `callback: Function` | Получает текущее состояние виджета |
| `getMessages(callback)` | `callback: Function` | Получает историю сообщений |
| `on(event, handler)` | `event: string, handler: Function` | Добавляет обработчик события |
| `once(event, handler)` | `event: string, handler: Function` | Добавляет одноразовый обработчик события |
| `off(event, handler)` | `event: string, handler: Function` | Удаляет обработчик события |
| `updateConfig(newConfig)` | `newConfig: Object` | Обновляет настройки виджета |

#### События

| Событие | Данные | Описание |
|---------|--------|----------|
| `ready` | - | Виджет инициализирован |
| `open` | - | Виджет открыт |
| `close` | - | Виджет закрыт |
| `message` | `Object` | Новое сообщение |
| `error` | `Object` | Ошибка |
| `ticket` | `string` | Создан тикет |
| `state` | `Object` | Состояние виджета |
| `messages` | `Array` | Сообщения виджета |

### ShroomsWidget - прямое встраивание

#### Конструктор

```javascript
const widget = new ShroomsWidget(config);
```

#### Конфигурация

| Параметр | Тип | Описание |
|----------|-----|----------|
| `apiUrl` | `string` | URL API сервера (обязательный) |
| `containerId` | `string` | ID контейнера для виджета |
| `styles` | `Object` | Кастомные стили |
| `theme` | `string` | Тема оформления ('neon', 'light', 'dark') |
| `position` | `Object` | Позиция виджета |
| `autoOpen` | `boolean` | Автоматически открывать виджет |
| `showHeader` | `boolean` | Показывать заголовок |
| `showAvatar` | `boolean` | Показывать аватар бота |
| `showUserAvatar` | `boolean` | Показывать аватар пользователя |
| `persistSession` | `boolean` | Сохранять сессию между визитами |
| `welcomeMessage` | `string` | Приветственное сообщение |
| `i18n` | `Object` | Переводы строк |
| `enableFileUploads` | `boolean` | Разрешить загрузку файлов |
| `allowedFileTypes` | `string[]` | Разрешенные типы файлов |
| `maxFileSize` | `number` | Максимальный размер файла в байтах |
| `branding` | `string` | Текст брендинга |
| `onInit` | `Function` | Колбэк после инициализации |
| `onOpen` | `Function` | Колбэк при открытии виджета |
| `onClose` | `Function` | Колбэк при закрытии виджета |
| `onMessage` | `Function` | Колбэк при новом сообщении |
| `onError` | `Function` | Колбэк при ошибке |
| `onTicketCreated` | `Function` | Колбэк при создании тикета |

#### Методы

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `open()` | - | Открывает виджет чата |
| `close()` | - | Закрывает виджет чата |
| `sendMessage(message)` | `message: string` | Отправляет сообщение программно |
| `clearHistory()` | - | Очищает историю сообщений |
| `setLanguage(language)` | `language: string` | Устанавливает язык виджета |
| `getState()` | - | Возвращает текущее состояние виджета |
| `getMessages()` | - | Получает историю сообщений |
| `updateConfig(newConfig)` | `newConfig: Object` | Обновляет конфигурацию виджета |

## Кастомизация

### Стили

Вы можете кастомизировать стили виджета через параметр `styles` при инициализации:

```javascript
const widget = new ShroomsWidget({
  apiUrl: 'https://your-api-domain.com',
  styles: {
    '.shrooms-chat-header': {
      'background-color': '#1a1a1a',
      'border-bottom': '1px solid #333'
    },
    '.shrooms-toggle-button': {
      'background-color': '#FF6EC7'
    }
  }
});
```

### Темы

Доступны три темы:
- `neon` - Неоновая тема с грибной эстетикой (по умолчанию)
- `dark` - Темная тема с грибной эстетикой
- `light` - Светлая тема с грибной эстетикой

```javascript
const widget = new ShroomsWidget({
  apiUrl: 'https://your-api-domain.com',
  theme: 'dark'
});
```

### Многоязычность

Виджет автоматически определяет язык пользователя и поддерживает:
- Английский (en)
- Испанский (es)
- Русский (ru)

Вы можете вручную задать язык:

```javascript
widget.setLanguage('ru');
```

## Примеры

Демонстрационную страницу с примерами можно найти в файле `example.html`. Запустите ее на вашем сервере для тестирования виджета.

## Лицензия

MIT
