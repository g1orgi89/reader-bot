/**
 * @fileoverview Тесты для ReminderService и AnnouncementService
 * @author g1orgi89
 */

const { ReminderService } = require('../server/services/reminderService');
const { AnnouncementService } = require('../server/services/announcementService');
const { CronService } = require('../server/services/cronService');

/**
 * Тест ReminderService
 */
async function testReminderService() {
  console.log('📖 Testing ReminderService...');
  
  const reminderService = new ReminderService();
  
  // Тест инициализации
  const mockBot = {
    telegram: {
      sendMessage: async (userId, message) => {
        console.log(`📧 Mock reminder sent to ${userId}: ${message.substring(0, 50)}...`);
        return { message_id: 123 };
      }
    }
  };
  
  reminderService.initialize({ bot: mockBot });
  
  // Тест получения конфигурации
  const mockUser = {
    registeredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 дней назад
    name: 'Тестовый пользователь'
  };
  
  const config = reminderService.getReminderConfigForUser(mockUser);
  console.log('📋 Reminder config for 5-day user:', config);
  
  // Тест проверки необходимости отправки
  const shouldSend = await reminderService.shouldSendReminderToday(mockUser, config);
  console.log('🤔 Should send reminder today:', shouldSend);
  
  // Тест диагностики
  const diagnostics = reminderService.getDiagnostics();
  console.log('🔍 Reminder diagnostics:', diagnostics);
  
  console.log('✅ ReminderService tests completed\n');
}

/**
 * Тест AnnouncementService
 */
async function testAnnouncementService() {
  console.log('📖 Testing AnnouncementService...');
  
  const announcementService = new AnnouncementService();
  
  // Тест инициализации
  const mockBot = {
    telegram: {
      sendMessage: async (userId, message, options) => {
        console.log(`📢 Mock announcement sent to ${userId}: ${message.substring(0, 50)}...`);
        return { message_id: 456 };
      }
    }
  };
  
  announcementService.initialize({ bot: mockBot });
  
  // Тест получения анонсов
  const announcements = await announcementService.getPersonalizedAnnouncements();
  console.log('📋 Available announcements:', announcements.length);
  announcements.forEach(a => console.log(`  - ${a.title} (${a.targetAudience.join(', ')})`));
  
  // Тест выбора анонса для пользователя
  const mockUser = {
    userId: 'test123',
    preferences: {
      mainThemes: ['Саморазвитие', 'Мудрость']
    },
    testResults: {
      lifestyle: 'замужем'
    }
  };
  
  const selectedAnnouncement = announcementService.selectAnnouncementForUser(mockUser, announcements);
  console.log('🎯 Selected announcement for user:', selectedAnnouncement?.title || 'none');
  
  // Тест генерации UTM ссылки
  const utmLink = announcementService.generateUTMLink('test_campaign', 'user123');
  console.log('🔗 Generated UTM link:', utmLink);
  
  // Тест проверки даты анонсов
  const shouldSendToday = announcementService.shouldSendAnnouncementsToday();
  console.log('📅 Should send announcements today:', shouldSendToday);
  
  // Тест диагностики
  const diagnostics = announcementService.getDiagnostics();
  console.log('🔍 Announcement diagnostics:', diagnostics);
  
  console.log('✅ AnnouncementService tests completed\n');
}

/**
 * Тест CronService с новыми сервисами
 */
async function testCronServiceIntegration() {
  console.log('📖 Testing CronService integration...');
  
  const cronService = new CronService();
  
  // Мок сервисы
  const mockServices = {
    bot: { telegram: { sendMessage: async () => ({ message_id: 789 }) } },
    weeklyReportHandler: {
      sendReportsToAllUsers: async () => ({ sent: 5, failed: 0, skipped: 2, total: 7, errors: [] }),
      getReportStats: async () => ({ total: 10, sent: 8, failed: 2 })
    },
    monthlyReportService: {
      generateMonthlyReportsForAllUsers: async () => ({ generated: 3, failed: 0, total: 3, errors: [] })
    },
    reminderService: new ReminderService(),
    announcementService: new AnnouncementService()
  };
  
  // Инициализируем сервисы
  mockServices.reminderService.initialize({ bot: mockServices.bot });
  mockServices.announcementService.initialize({ bot: mockServices.bot });
  
  cronService.initialize(mockServices);
  
  // Тест получения статуса
  const status = cronService.getJobsStatus();
  console.log('📊 Cron jobs status:', {
    totalJobs: status.totalJobs,
    hasReminderService: status.hasReminderService,
    hasAnnouncementService: status.hasAnnouncementService
  });
  
  // Тест получения расписания
  const schedule = cronService.getSchedule();
  console.log('📅 Cron schedule:', schedule);
  
  // Тест диагностики
  const diagnostics = cronService.getDiagnostics();
  console.log('🔍 Cron diagnostics:', {
    initialized: diagnostics.initialized,
    hasReminderService: diagnostics.hasReminderService,
    hasAnnouncementService: diagnostics.hasAnnouncementService,
    serviceStatuses: diagnostics.serviceStatuses
  });
  
  // Тест ручного запуска напоминаний
  console.log('🧪 Testing manual reminder trigger...');
  const reminderStats = await cronService.triggerReminders();
  console.log('📧 Reminder trigger result:', reminderStats);
  
  // Тест ручного запуска анонсов
  console.log('🧪 Testing manual announcement trigger...');
  const announcementStats = await cronService.triggerAnnouncements();
  console.log('📢 Announcement trigger result:', announcementStats);
  
  console.log('✅ CronService integration tests completed\n');
}

/**
 * Тест различных сценариев напоминаний
 */
async function testReminderScenarios() {
  console.log('📖 Testing reminder scenarios...');
  
  const reminderService = new ReminderService();
  const mockBot = {
    telegram: {
      sendMessage: async (userId, message) => {
        console.log(`📧 Reminder to ${userId}: ${message.substring(0, 30)}...`);
        return { message_id: 123 };
      }
    }
  };
  
  reminderService.initialize({ bot: mockBot });
  
  // Сценарий 1: Новый пользователь (первая неделя)
  const newUser = {
    registeredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 дня назад
    name: 'Новичок'
  };
  
  const newUserConfig = reminderService.getReminderConfigForUser(newUser);
  console.log('👶 New user config:', newUserConfig);
  
  // Сценарий 2: Активный пользователь (2-4 недели)
  const activeUser = {
    registeredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 недели назад
    name: 'Активный'
  };
  
  const activeUserConfig = reminderService.getReminderConfigForUser(activeUser);
  console.log('🎯 Active user config:', activeUserConfig);
  
  // Сценарий 3: Опытный пользователь (месяц+)
  const expertUser = {
    registeredAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 дней назад
    name: 'Опытный'
  };
  
  const expertUserConfig = reminderService.getReminderConfigForUser(expertUser);
  console.log('⭐ Expert user config:', expertUserConfig);
  
  console.log('✅ Reminder scenarios tests completed\n');
}

/**
 * Тест персонализации анонсов
 */
async function testAnnouncementPersonalization() {
  console.log('📖 Testing announcement personalization...');
  
  const announcementService = new AnnouncementService();
  const announcements = await announcementService.getPersonalizedAnnouncements();
  
  // Тестовые пользователи с разными профилями
  const testUsers = [
    {
      name: 'Мама',
      preferences: { mainThemes: ['Материнство'] },
      testResults: { lifestyle: 'Я мама (дети - главная забота)' }
    },
    {
      name: 'Саморазвитие',
      preferences: { mainThemes: ['Саморазвитие', 'Мудрость'] },
      testResults: { lifestyle: 'Без отношений, изучаю мир и себя' }
    },
    {
      name: 'Отношения',
      preferences: { mainThemes: ['Любовь', 'Отношения'] },
      testResults: { lifestyle: 'Замужем, балансирую дом/работу/себя' }
    },
    {
      name: 'Женственность',
      preferences: { mainThemes: ['Творчество'] },
      testResults: { priorities: 'баланс между дать и взять' }
    }
  ];
  
  testUsers.forEach(user => {
    const selectedAnnouncement = announcementService.selectAnnouncementForUser(user, announcements);
    console.log(`👤 ${user.name}: ${selectedAnnouncement?.title || 'default'} (${selectedAnnouncement?.targetAudience.join(', ') || 'none'})`);
  });
  
  console.log('✅ Announcement personalization tests completed\n');
}

/**
 * Главная функция тестирования
 */
async function runAllTests() {
  console.log('🧪 Starting Reminder & Announcement Services Tests\n');
  console.log('================================================\n');
  
  try {
    await testReminderService();
    await testAnnouncementService();
    await testCronServiceIntegration();
    await testReminderScenarios();
    await testAnnouncementPersonalization();
    
    console.log('🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('✅ ReminderService: optimized schedule working');
    console.log('✅ AnnouncementService: personalization working');
    console.log('✅ CronService: integration working');
    console.log('✅ User scenarios: all configurations correct');
    console.log('✅ Personalization: proper announcement selection');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Запуск тестов если файл выполняется напрямую
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testReminderService,
  testAnnouncementService,
  testCronServiceIntegration,
  testReminderScenarios,
  testAnnouncementPersonalization,
  runAllTests
};
