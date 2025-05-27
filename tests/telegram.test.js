/**
 * Простой тест для проверки Telegram бота
 * @file tests/telegram.test.js
 * 🍄 Тестирование основной функциональности Telegram интеграции
 */

const ShroomsTelegramBot = require('../telegram/index');

describe('🍄 Shrooms Telegram Bot', () => {
  let bot;

  beforeAll(() => {
    // Используем тестовый токен для тестов
    bot = new ShroomsTelegramBot({
      token: 'test-token',
      environment: 'test',
      maxMessageLength: 100 // Маленький лимит для тестов
    });
  });

  describe('Initialization', () => {
    test('should create bot instance', () => {
      expect(bot).toBeInstanceOf(ShroomsTelegramBot);
      expect(bot.config.platform).toBe('telegram');
      expect(bot.config.maxMessageLength).toBe(100);
    });

    test('should have correct configuration', () => {
      expect(bot.config.environment).toBe('test');
      expect(bot.config.typingDelay).toBe(1500);
    });
  });

  describe('Message Processing', () => {
    test('should detect test messages', () => {
      expect(bot._isTestMessage).toBeDefined();
      // Эти методы приватные, но можем протестировать через другие методы
    });

    test('should split long messages', () => {
      const longMessage = 'A'.repeat(250); // Длинное сообщение
      const chunks = bot._splitMessage(longMessage);
      
      expect(chunks).toBeInstanceOf(Array);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(100);
    });

    test('should handle short messages', () => {
      const shortMessage = 'Hello!';
      const chunks = bot._splitMessage(shortMessage);
      
      expect(chunks).toEqual([shortMessage]);
    });
  });

  describe('Language Detection', () => {
    test('should have default language methods', () => {
      const welcomeEn = bot._getDefaultWelcomeMessage('en');
      const welcomeRu = bot._getDefaultWelcomeMessage('ru');
      const welcomeEs = bot._getDefaultWelcomeMessage('es');

      expect(welcomeEn).toContain('🍄');
      expect(welcomeEn).toContain('Welcome');
      expect(welcomeRu).toContain('🍄');
      expect(welcomeRu).toContain('Добро пожаловать');
      expect(welcomeEs).toContain('🍄');
      expect(welcomeEs).toContain('Bienvenido');
    });

    test('should have help messages', () => {
      const helpEn = bot._getDefaultHelpMessage('en');
      const helpRu = bot._getDefaultHelpMessage('ru');
      const helpEs = bot._getDefaultHelpMessage('es');

      expect(helpEn).toContain('Help');
      expect(helpRu).toContain('Помощь');
      expect(helpEs).toContain('Ayuda');
    });
  });

  describe('Ticket Messages', () => {
    test('should generate ticket created messages', async () => {
      const ticketId = 'TEST-123';
      
      const messageEn = await bot._getTicketCreatedMessage('en', ticketId);
      const messageRu = await bot._getTicketCreatedMessage('ru', ticketId);
      const messageEs = await bot._getTicketCreatedMessage('es', ticketId);

      expect(messageEn).toContain(ticketId);
      expect(messageEn).toContain('🎫');
      expect(messageRu).toContain(ticketId);
      expect(messageEs).toContain(ticketId);
    });
  });

  describe('Statistics', () => {
    test('should provide stats structure', async () => {
      // Мокаем telegram API для тестов
      bot.bot = {
        telegram: {
          getMe: jest.fn().mockResolvedValue({
            id: 123,
            username: 'test_bot',
            first_name: 'Test Bot'
          })
        }
      };

      const stats = await bot.getStats();
      
      expect(stats).toHaveProperty('botInfo');
      expect(stats).toHaveProperty('systemMessages');
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('status');
      expect(stats.config.platform).toBe('telegram');
    });
  });

  describe('Error Handling', () => {
    test('should handle stats error gracefully', async () => {
      bot.bot = {
        telegram: {
          getMe: jest.fn().mockRejectedValue(new Error('API Error'))
        }
      };

      const stats = await bot.getStats();
      
      expect(stats).toHaveProperty('status', 'error');
      expect(stats).toHaveProperty('error');
    });
  });
});