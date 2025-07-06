/**
 * HTTP тест для проверки quotes API endpoints
 * @file server/utils/test-quotes-http.js
 */

const http = require('http');

// Конфигурация
const HOST = 'localhost';
const PORT = 3002;
const ADMIN_CREDENTIALS = Buffer.from('admin:password123').toString('base64');

/**
 * Выполняет HTTP запрос
 * @param {Object} options - Опции запроса
 * @returns {Promise<Object>} Результат запроса
 */
function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data ? JSON.parse(data) : null
                    };
                    resolve(response);
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        parseError: error.message
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        // Устанавливаем таймаут
        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.end();
    });
}

/**
 * Тестирует quotes API endpoints
 */
async function testQuotesAPI() {
    console.log('🔧 Тестирование Quotes API endpoints...\n');
    
    const endpoints = [
        {
            name: 'Health Check',
            path: '/api/health',
            authRequired: false
        },
        {
            name: 'Quotes List',
            path: '/api/quotes',
            authRequired: true
        },
        {
            name: 'Quotes Statistics',
            path: '/api/quotes/statistics',
            authRequired: true
        },
        {
            name: 'Quotes Analytics',
            path: '/api/quotes/analytics',
            authRequired: true
        },
        {
            name: 'Quote Details',
            path: '/api/quotes/Q001',
            authRequired: true
        }
    ];
    
    for (const endpoint of endpoints) {
        console.log(`📡 Тестирую: ${endpoint.name} (${endpoint.path})`);
        
        try {
            const options = {
                hostname: HOST,
                port: PORT,
                path: endpoint.path,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            // Добавляем авторизацию если нужно
            if (endpoint.authRequired) {
                options.headers['Authorization'] = `Basic ${ADMIN_CREDENTIALS}`;
            }
            
            const response = await makeRequest(options);
            
            // Анализируем ответ
            if (response.statusCode === 200) {
                console.log(`   ✅ Успешно (${response.statusCode})`);
                if (response.data && response.data.success) {
                    console.log(`   📊 Данные получены корректно`);
                } else {
                    console.log(`   ⚠️ Нестандартный формат ответа:`, response.data);
                }
            } else if (response.statusCode === 404) {
                console.log(`   ❌ Не найден (404) - роут не зарегистрирован`);
            } else if (response.statusCode === 401) {
                console.log(`   🔐 Требуется авторизация (401)`);
            } else if (response.statusCode === 500) {
                console.log(`   💥 Ошибка сервера (500):`, response.data?.message || response.data);
            } else {
                console.log(`   ❓ Неожиданный статус (${response.statusCode}):`, response.data);
            }
            
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.log(`   ❌ Сервер не запущен на ${HOST}:${PORT}`);
                break;
            } else {
                console.log(`   ❌ Ошибка запроса: ${error.message}`);
            }
        }
        
        console.log(''); // Пустая строка между тестами
    }
    
    console.log('🎯 Рекомендации:');
    console.log('1. Убедитесь что сервер запущен: npm start');
    console.log('2. Проверьте что порт 3002 свободен');
    console.log('3. Проверьте логи сервера на предмет ошибок загрузки роутов');
    console.log('4. Выполните: node server/utils/test-quotes-api.js');
}

// Запускаем тесты
if (require.main === module) {
    testQuotesAPI().catch(console.error);
}

module.exports = { testQuotesAPI, makeRequest };
