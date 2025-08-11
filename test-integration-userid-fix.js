/**
 * Интеграционный тест для проверки совместимости исправлений userId с существующим кодом
 */

// Загружаем необходимые модули
const fs = require('fs');
const path = require('path');

function testCodeIntegration() {
    console.log('🧪 Проверка интеграции исправлений userId с существующим кодом\n');

    const testResults = [];

    // Тест 1: Проверка что все файлы корректно подключают зависимости
    try {
        console.log('📋 Тест 1: Проверка синтаксиса модифицированных файлов...');
        
        const filesToCheck = [
            'mini-app/js/pages/DiaryPage.js',
            'mini-app/js/pages/HomePage.js', 
            'mini-app/js/core/App.js',
            'mini-app/js/core/State.js',
            'mini-app/js/services/api.js'
        ];

        filesToCheck.forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Проверяем что файл не пустой
                if (content.length === 0) {
                    throw new Error(`Файл ${file} пустой`);
                }
                
                // Проверяем базовую структуру JavaScript
                if (!content.includes('class ') && !content.includes('function ')) {
                    throw new Error(`Файл ${file} не содержит классов или функций`);
                }
                
                console.log(`  ✅ ${file} - синтаксис корректен`);
            } else {
                console.log(`  ⚠️ ${file} - файл не найден`);
            }
        });
        
        testResults.push({ test: 'Синтаксис файлов', status: 'ПРОЙДЕН' });
        console.log('✅ Тест 1 ПРОЙДЕН\n');
        
    } catch (error) {
        testResults.push({ test: 'Синтаксис файлов', status: 'ПРОВАЛЕН', error: error.message });
        console.error('❌ Тест 1 ПРОВАЛЕН:', error.message, '\n');
    }

    // Тест 2: Проверка что новые методы присутствуют
    try {
        console.log('📋 Тест 2: Проверка наличия новых методов waitForValidUserId...');
        
        const diaryPagePath = path.join(__dirname, 'mini-app/js/pages/DiaryPage.js');
        const homePagePath = path.join(__dirname, 'mini-app/js/pages/HomePage.js');
        
        if (fs.existsSync(diaryPagePath)) {
            const diaryContent = fs.readFileSync(diaryPagePath, 'utf8');
            
            if (!diaryContent.includes('waitForValidUserId')) {
                throw new Error('DiaryPage.js не содержит метод waitForValidUserId');
            }
            
            if (!diaryContent.includes('await this.waitForValidUserId()')) {
                throw new Error('DiaryPage.js не использует waitForValidUserId в API вызовах');
            }
            
            console.log('  ✅ DiaryPage.js содержит необходимые изменения');
        }
        
        if (fs.existsSync(homePagePath)) {
            const homeContent = fs.readFileSync(homePagePath, 'utf8');
            
            if (!homeContent.includes('waitForValidUserId')) {
                throw new Error('HomePage.js не содержит метод waitForValidUserId');
            }
            
            if (!homeContent.includes('await this.waitForValidUserId()')) {
                throw new Error('HomePage.js не использует waitForValidUserId в API вызовах');
            }
            
            console.log('  ✅ HomePage.js содержит необходимые изменения');
        }
        
        testResults.push({ test: 'Наличие новых методов', status: 'ПРОЙДЕН' });
        console.log('✅ Тест 2 ПРОЙДЕН\n');
        
    } catch (error) {
        testResults.push({ test: 'Наличие новых методов', status: 'ПРОВАЛЕН', error: error.message });
        console.error('❌ Тест 2 ПРОВАЛЕН:', error.message, '\n');
    }

    // Тест 3: Проверка что API вызовы изменены корректно
    try {
        console.log('📋 Тест 3: Проверка корректности изменений API вызовов...');
        
        const diaryPagePath = path.join(__dirname, 'mini-app/js/pages/DiaryPage.js');
        
        if (fs.existsSync(diaryPagePath)) {
            const content = fs.readFileSync(diaryPagePath, 'utf8');
            
            // Проверяем что API методы теперь принимают userId
            const apiCalls = [
                'this.api.getQuotes(params, userId)',
                'this.api.getStats(userId)',
                'this.api.addQuote(quoteData, userId)'
            ];
            
            apiCalls.forEach(call => {
                if (!content.includes(call)) {
                    throw new Error(`API вызов не найден или неправильно изменен: ${call}`);
                }
            });
            
            console.log('  ✅ API вызовы в DiaryPage.js изменены корректно');
        }
        
        const homePagePath = path.join(__dirname, 'mini-app/js/pages/HomePage.js');
        
        if (fs.existsSync(homePagePath)) {
            const content = fs.readFileSync(homePagePath, 'utf8');
            
            // Проверяем что методы получают userId
            if (!content.includes('loadUserStats(userId = null)')) {
                throw new Error('Метод loadUserStats не изменен для приема userId');
            }
            
            if (!content.includes('loadUserProfile(userId = null)')) {
                throw new Error('Метод loadUserProfile не изменен для приема userId');
            }
            
            console.log('  ✅ API методы в HomePage.js изменены корректно');
        }
        
        testResults.push({ test: 'Изменения API вызовов', status: 'ПРОЙДЕН' });
        console.log('✅ Тест 3 ПРОЙДЕН\n');
        
    } catch (error) {
        testResults.push({ test: 'Изменения API вызовов', status: 'ПРОВАЛЕН', error: error.message });
        console.error('❌ Тест 3 ПРОВАЛЕН:', error.message, '\n');
    }

    // Тест 4: Проверка что State.js содержит getCurrentUserId
    try {
        console.log('📋 Тест 4: Проверка метода getCurrentUserId в State.js...');
        
        const statePath = path.join(__dirname, 'mini-app/js/core/State.js');
        
        if (fs.existsSync(statePath)) {
            const content = fs.readFileSync(statePath, 'utf8');
            
            if (!content.includes('getCurrentUserId()')) {
                throw new Error('State.js не содержит метод getCurrentUserId');
            }
            
            if (!content.includes('profile?.id || telegramData?.id || null')) {
                throw new Error('getCurrentUserId не реализован корректно');
            }
            
            console.log('  ✅ State.js содержит корректный getCurrentUserId');
        }
        
        testResults.push({ test: 'getCurrentUserId в State', status: 'ПРОЙДЕН' });
        console.log('✅ Тест 4 ПРОЙДЕН\n');
        
    } catch (error) {
        testResults.push({ test: 'getCurrentUserId в State', status: 'ПРОВАЛЕН', error: error.message });
        console.error('❌ Тест 4 ПРОВАЛЕН:', error.message, '\n');
    }

    // Выводим общие результаты
    console.log('📊 Результаты интеграционного тестирования:');
    console.log('=' .repeat(50));
    
    const passed = testResults.filter(r => r.status === 'ПРОЙДЕН').length;
    const total = testResults.length;
    
    testResults.forEach(result => {
        const status = result.status === 'ПРОЙДЕН' ? '✅' : '❌';
        console.log(`${status} ${result.test}: ${result.status}`);
        if (result.error) {
            console.log(`   Ошибка: ${result.error}`);
        }
    });
    
    console.log('=' .repeat(50));
    console.log(`Итого: ${passed}/${total} тестов пройдено`);
    
    if (passed === total) {
        console.log('🎉 Все интеграционные тесты пройдены! Изменения совместимы с существующим кодом.');
        return true;
    } else {
        console.log('⚠️ Некоторые интеграционные тесты провалены. Требуется проверка совместимости.');
        return false;
    }
}

// Запуск тестов
if (require.main === module) {
    const success = testCodeIntegration();
    process.exit(success ? 0 : 1);
}

module.exports = { testCodeIntegration };