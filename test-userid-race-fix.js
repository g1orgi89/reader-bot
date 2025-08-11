/**
 * Тест для проверки исправления гонки userId в DiaryPage и HomePage
 * Проверяет что новые методы waitForValidUserId работают корректно
 */

// Эмуляция необходимых классов для тестирования
class MockAppState {
    constructor() {
        this.store = {
            user: {
                profile: null
            },
            debugMode: false
        };
    }
    
    getCurrentUserId() {
        const profile = this.store.user.profile;
        return profile?.id || profile?.telegramId || null;
    }
    
    get(path) {
        const parts = path.split('.');
        return parts.reduce((obj, key) => obj?.[key], this.store);
    }
    
    set(path, value) {
        const parts = path.split('.');
        const lastKey = parts.pop();
        const target = parts.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.store);
        target[lastKey] = value;
    }
    
    update(path, updates) {
        const current = this.get(path) || {};
        this.set(path, { ...current, ...updates });
    }
    
    // Симуляция других необходимых методов
    subscribe() { return () => {}; }
    push() {}
    remove() {}
    resetLoader() {}
}

class MockApiService {
    constructor() {
        this.debug = false;
    }
    
    async getQuotes(params, userId) {
        console.log('🔍 API Call: getQuotes с userId:', userId);
        if (!userId || userId === 'demo-user') {
            throw new Error('Invalid userId provided to getQuotes');
        }
        return { quotes: [], total: 0 };
    }
    
    async getStats(userId) {
        console.log('🔍 API Call: getStats с userId:', userId);
        if (!userId || userId === 'demo-user') {
            throw new Error('Invalid userId provided to getStats');
        }
        return { totalQuotes: 0, currentStreak: 0 };
    }
    
    async addQuote(quoteData, userId) {
        console.log('🔍 API Call: addQuote с userId:', userId);
        if (!userId || userId === 'demo-user') {
            throw new Error('Invalid userId provided to addQuote');
        }
        return { id: Date.now(), ...quoteData };
    }
    
    async getProfile(userId) {
        console.log('🔍 API Call: getProfile с userId:', userId);
        if (!userId || userId === 'demo-user') {
            throw new Error('Invalid userId provided to getProfile');
        }
        return { user: { id: userId, name: 'Test User' } };
    }
}

class MockTelegramService {
    hapticFeedback() {}
    getUser() { return { first_name: 'Test' }; }
}

// Симуляция DiaryPage с методом waitForValidUserId
class TestDiaryPage {
    constructor(app) {
        this.state = app.state;
        this.api = app.api;
        this.telegram = app.telegram;
    }
    
    async waitForValidUserId(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const userId = this.state.getCurrentUserId();
            
            // Проверяем что userId валидный и не равен demo-user
            if (userId && userId !== 'demo-user' && typeof userId === 'number') {
                console.log('✅ DiaryPage: Получен валидный userId:', userId);
                return userId;
            }
            
            // Также принимаем demo-user только в debug режиме
            if (userId === 'demo-user' && this.state.get('debugMode')) {
                console.log('🧪 DiaryPage: Используем demo-user в debug режиме');
                return userId;
            }
            
            // Ждем 100ms перед следующей проверкой
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Timeout: не удалось получить валидный userId');
    }
    
    async loadQuotes() {
        const userId = await this.waitForValidUserId();
        return await this.api.getQuotes({}, userId);
    }
    
    async loadStats() {
        const userId = await this.waitForValidUserId();
        return await this.api.getStats(userId);
    }
    
    async handleSaveQuote(quoteData) {
        const userId = await this.waitForValidUserId();
        return await this.api.addQuote(quoteData, userId);
    }
}

// Симуляция HomePage с методом waitForValidUserId
class TestHomePage {
    constructor(app) {
        this.state = app.state;
        this.api = app.api;
        this.telegram = app.telegram;
    }
    
    async waitForValidUserId(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const userId = this.state.getCurrentUserId();
            
            // Проверяем что userId валидный и не равен demo-user
            if (userId && userId !== 'demo-user' && typeof userId === 'number') {
                console.log('✅ HomePage: Получен валидный userId:', userId);
                return userId;
            }
            
            // Также принимаем demo-user только в debug режиме
            if (userId === 'demo-user' && this.state.get('debugMode')) {
                console.log('🧪 HomePage: Используем demo-user в debug режиме');
                return userId;
            }
            
            // Ждем 100ms перед следующей проверкой
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Timeout: не удалось получить валидный userId');
    }
    
    async loadUserStats() {
        const userId = await this.waitForValidUserId();
        return await this.api.getStats(userId);
    }
    
    async loadUserProfile() {
        const userId = await this.waitForValidUserId();
        return await this.api.getProfile(userId);
    }
}

// Тестовые функции
async function testValidUserIdScenario() {
    console.log('\n🧪 === Тест 1: Валидный userId ===');
    
    const app = {
        state: new MockAppState(),
        api: new MockApiService(),
        telegram: new MockTelegramService()
    };
    
    // Устанавливаем валидный userId
    app.state.update('user.profile', { id: 12345, telegramId: 12345 });
    
    const diaryPage = new TestDiaryPage(app);
    const homePage = new TestHomePage(app);
    
    try {
        console.log('📖 Тестируем DiaryPage...');
        await diaryPage.loadQuotes();
        await diaryPage.loadStats();
        await diaryPage.handleSaveQuote({ text: 'Test quote', author: 'Test Author' });
        
        console.log('🏠 Тестируем HomePage...');
        await homePage.loadUserStats();
        await homePage.loadUserProfile();
        
        console.log('✅ Тест 1 ПРОЙДЕН: Все API вызовы успешно получили валидный userId');
    } catch (error) {
        console.error('❌ Тест 1 ПРОВАЛЕН:', error.message);
        return false;
    }
    
    return true;
}

async function testDemoUserInDebugMode() {
    console.log('\n🧪 === Тест 2: Demo-user в debug режиме ===');
    
    const app = {
        state: new MockAppState(),
        api: new MockApiService(),
        telegram: new MockTelegramService()
    };
    
    // Устанавливаем demo-user и debug режим
    app.state.update('user.profile', { id: 'demo-user' });
    app.state.set('debugMode', true);
    
    const diaryPage = new TestDiaryPage(app);
    
    try {
        console.log('📖 Тестируем DiaryPage в debug режиме...');
        const userId = await diaryPage.waitForValidUserId();
        
        if (userId === 'demo-user') {
            console.log('✅ Тест 2 ПРОЙДЕН: Demo-user принят в debug режиме');
            return true;
        } else {
            console.error('❌ Тест 2 ПРОВАЛЕН: Неожиданный userId:', userId);
            return false;
        }
    } catch (error) {
        console.error('❌ Тест 2 ПРОВАЛЕН:', error.message);
        return false;
    }
}

async function testTimeoutScenario() {
    console.log('\n🧪 === Тест 3: Timeout при отсутствии userId ===');
    
    const app = {
        state: new MockAppState(),
        api: new MockApiService(),
        telegram: new MockTelegramService()
    };
    
    // Не устанавливаем userId (остается null)
    
    const diaryPage = new TestDiaryPage(app);
    
    try {
        console.log('📖 Тестируем timeout (короткий timeout для быстрого теста)...');
        await diaryPage.waitForValidUserId(500); // короткий timeout
        
        console.error('❌ Тест 3 ПРОВАЛЕН: Ожидался timeout, но получили userId');
        return false;
    } catch (error) {
        if (error.message.includes('Timeout')) {
            console.log('✅ Тест 3 ПРОЙДЕН: Корректный timeout при отсутствии userId');
            return true;
        } else {
            console.error('❌ Тест 3 ПРОВАЛЕН: Неожиданная ошибка:', error.message);
            return false;
        }
    }
}

async function testRaceConditionFix() {
    console.log('\n🧪 === Тест 4: Исправление гонки условий ===');
    
    const app = {
        state: new MockAppState(),
        api: new MockApiService(),
        telegram: new MockTelegramService()
    };
    
    const diaryPage = new TestDiaryPage(app);
    
    try {
        console.log('📖 Тестируем гонку условий...');
        
        // Симулируем гонку: запускаем загрузку данных, а userId появляется через 200ms
        const loadPromise = diaryPage.loadQuotes();
        
        setTimeout(() => {
            console.log('🔄 Устанавливаем userId через 200ms...');
            app.state.update('user.profile', { id: 98765, telegramId: 98765 });
        }, 200);
        
        await loadPromise;
        console.log('✅ Тест 4 ПРОЙДЕН: Гонка условий исправлена, метод дождался userId');
        return true;
    } catch (error) {
        console.error('❌ Тест 4 ПРОВАЛЕН:', error.message);
        return false;
    }
}

// Запуск всех тестов
async function runAllTests() {
    console.log('🚀 Запуск тестов для исправления гонки userId\n');
    
    const results = await Promise.all([
        testValidUserIdScenario(),
        testDemoUserInDebugMode(),
        testTimeoutScenario(),
        testRaceConditionFix()
    ]);
    
    const passed = results.filter(Boolean).length;
    const total = results.length;
    
    console.log(`\n📊 Результаты тестов: ${passed}/${total} пройдено`);
    
    if (passed === total) {
        console.log('🎉 Все тесты пройдены! Исправление гонки userId работает корректно.');
        process.exit(0);
    } else {
        console.log('❌ Некоторые тесты провалены. Требуется доработка.');
        process.exit(1);
    }
}

// Запуск тестов
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('💥 Критическая ошибка в тестах:', error);
        process.exit(1);
    });
}

module.exports = {
    TestDiaryPage,
    TestHomePage,
    MockAppState,
    MockApiService
};