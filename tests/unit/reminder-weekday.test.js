/**
 * Tests for weekday-based reminder system
 */

const { ReminderService } = require('../../server/services/reminderService');
const { notificationTemplates } = require('../../server/config/notificationTemplates');

describe('ReminderService - Weekday-based notifications', () => {
  let reminderService;

  beforeEach(() => {
    reminderService = new ReminderService();
  });

  describe('getMoscowWeekday', () => {
    it('should return a valid Russian weekday name', () => {
      const dayName = reminderService.getMoscowWeekday();
      
      expect(dayName).toBeDefined();
      expect(typeof dayName).toBe('string');
      
      // Should be one of the valid weekday names
      const validDays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
      expect(validDays).toContain(dayName);
    });

    it('should capitalize the first letter', () => {
      const dayName = reminderService.getMoscowWeekday();
      
      // First character should be uppercase
      expect(dayName.charAt(0)).toBe(dayName.charAt(0).toUpperCase());
    });
  });

  describe('notificationTemplates', () => {
    it('should have all 7 weekdays defined', () => {
      const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
      
      weekdays.forEach(day => {
        expect(notificationTemplates[day]).toBeDefined();
      });
    });

    it('should have three slots for each day', () => {
      const weekdays = Object.keys(notificationTemplates);
      const slots = ['morning', 'day', 'evening'];
      
      weekdays.forEach(day => {
        slots.forEach(slot => {
          expect(notificationTemplates[day]).toHaveProperty(slot);
        });
      });
    });

    it('Monday should have empty templates', () => {
      const monday = notificationTemplates['Понедельник'];
      
      expect(monday.morning).toBe('');
      expect(monday.day).toBe('');
      expect(monday.evening).toBe('');
    });

    it('Tuesday-Sunday should have content for specified slots', () => {
      // Tuesday - day and evening only
      expect(notificationTemplates['Вторник'].morning).toBe('');
      expect(notificationTemplates['Вторник'].day).not.toBe('');
      expect(notificationTemplates['Вторник'].evening).not.toBe('');

      // Wednesday - all three slots
      expect(notificationTemplates['Среда'].morning).not.toBe('');
      expect(notificationTemplates['Среда'].day).not.toBe('');
      expect(notificationTemplates['Среда'].evening).not.toBe('');

      // Thursday - all three slots
      expect(notificationTemplates['Четверг'].morning).not.toBe('');
      expect(notificationTemplates['Четверг'].day).not.toBe('');
      expect(notificationTemplates['Четверг'].evening).not.toBe('');

      // Friday - all three slots
      expect(notificationTemplates['Пятница'].morning).not.toBe('');
      expect(notificationTemplates['Пятница'].day).not.toBe('');
      expect(notificationTemplates['Пятница'].evening).not.toBe('');

      // Saturday - all three slots
      expect(notificationTemplates['Суббота'].morning).not.toBe('');
      expect(notificationTemplates['Суббота'].day).not.toBe('');
      expect(notificationTemplates['Суббота'].evening).not.toBe('');

      // Sunday - all three slots
      expect(notificationTemplates['Воскресенье'].morning).not.toBe('');
      expect(notificationTemplates['Воскресенье'].day).not.toBe('');
      expect(notificationTemplates['Воскресенье'].evening).not.toBe('');
    });
  });

  describe('sendReminderToUser', () => {
    let mockBot;
    let mockUser;

    beforeEach(() => {
      mockBot = {
        telegram: {
          sendMessage: jest.fn().mockResolvedValue(true)
        }
      };
      
      mockUser = {
        userId: '12345',
        name: 'Test User',
        statistics: {
          currentStreak: 0
        }
      };

      reminderService.initialize({ bot: mockBot });
    });

    it('should return "skipped" when template is empty', async () => {
      // Monday morning is empty
      const result = await reminderService.sendReminderToUser(mockUser, 'morning', 'Понедельник');
      
      expect(result).toBe('skipped');
      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should return "sent" when template exists', async () => {
      // Mock Quote model
      jest.mock('../../server/models', () => ({
        Quote: {
          countDocuments: jest.fn().mockResolvedValue(0)
        }
      }));

      // Wednesday morning has content
      const result = await reminderService.sendReminderToUser(mockUser, 'morning', 'Среда');
      
      expect(result).toBe('sent');
      expect(mockBot.telegram.sendMessage).toHaveBeenCalled();
    });

    it('should send message without user name prefix', async () => {
      jest.mock('../../server/models', () => ({
        Quote: {
          countDocuments: jest.fn().mockResolvedValue(0)
        }
      }));

      await reminderService.sendReminderToUser(mockUser, 'morning', 'Среда');
      
      const sentMessage = mockBot.telegram.sendMessage.mock.calls[0][1];
      
      // Should not start with user name
      expect(sentMessage).not.toMatch(/^Test User,/);
      // Should contain the template text
      expect(sentMessage).toContain('Начните день с фокуса на себе');
    });
  });

  describe('Template structure validation', () => {
    it('should have correct content for first week (Tue-Sun)', () => {
      // Verify Tuesday
      expect(notificationTemplates['Вторник'].day).toContain('Сделайте паузу от телефона');
      expect(notificationTemplates['Вторник'].day).toContain('Вы в приложении 1 день');
      
      // Verify Wednesday
      expect(notificationTemplates['Среда'].morning).toContain('Начните день с фокуса на себе');
      expect(notificationTemplates['Среда'].morning).toContain('Вы в приложении 2 день');
      
      // Verify Sunday
      expect(notificationTemplates['Воскресенье'].evening).toContain('Посмотрите свои записи за неделю');
      expect(notificationTemplates['Воскресенье'].evening).toContain('первый отчёт');
    });
  });
});
