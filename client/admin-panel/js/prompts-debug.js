/**
 * 🛠️ ДИАГНОСТИЧЕСКИЙ СКРИПТ ДЛЯ PROMPTS.JS
 * Максимально подробное логирование для выявления проблем с аутентификацией
 * 
 * @file client/admin-panel/js/prompts-debug.js
 * 📖 Debug script для Reader Bot prompts management
 */

// 🔧 КОНФИГУРАЦИЯ ОТЛАДКИ
const DEBUG_CONFIG = {
    VERBOSE_LOGGING: true,
    LOG_API_REQUESTS: true,
    LOG_AUTH_DETAILS: true,
    LOG_LOCALSTORAGE: true,
    LOG_ERRORS: true
};

// 📊 СЧЕТЧИКИ ДЛЯ ДИАГНОСТИКИ
let DEBUG_COUNTERS = {
    apiCalls: 0,
    authAttempts: 0,
    errors: 0,
    tokenChecks: 0
};

/**
 * 🔍 Подробное логирование с временными метками
 */
function debugLog(category, message, data = null) {
    if (!DEBUG_CONFIG.VERBOSE_LOGGING) return;
    
    const timestamp = new Date().toISOString().substring(11, 23);
    const prefix = `[${timestamp}] 🔍 ${category}:`;
    
    if (data) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }
}

/**
 * 🚨 Анализ состояния аутентификации
 */
function analyzeAuthState() {
    debugLog('AUTH_STATE', '=== АНАЛИЗ СОСТОЯНИЯ АУТЕНТИФИКАЦИИ ===');
    
    // Проверяем localStorage
    const tokenKey = 'adminToken'; // Унифицированный ключ
    const token = localStorage.getItem(tokenKey);
    const userKey = 'reader_admin_user';
    const user = localStorage.getItem(userKey);
    const expiresKey = 'reader_admin_expires';
    const expires = localStorage.getItem(expiresKey);
    
    debugLog('LOCALSTORAGE', 'Токен в localStorage', {
        key: tokenKey,
        value: token ? `${token.substring(0, 20)}...` : null,
        exists: !!token
    });
    
    debugLog('LOCALSTORAGE', 'Пользователь в localStorage', {
        key: userKey,
        value: user ? JSON.parse(user) : null,
        exists: !!user
    });
    
    debugLog('LOCALSTORAGE', 'Время истечения', {
        key: expiresKey,
        value: expires,
        expired: expires ? Date.now() > parseInt(expires) : 'N/A',
        timeLeft: expires ? Math.max(0, parseInt(expires) - Date.now()) / 1000 / 60 : 'N/A'
    });
    
    // Проверяем authManager
    if (typeof window.authManager !== 'undefined') {
        debugLog('AUTH_MANAGER', 'Состояние authManager', {
            exists: true,
            isAuthenticated: window.authManager.isAuthenticated(),
            currentUser: window.authManager.getCurrentUser(),
            token: window.authManager.getToken() ? `${window.authManager.getToken().substring(0, 20)}...` : null
        });
    } else {
        debugLog('AUTH_MANAGER', 'authManager не найден в window');
    }
    
    return {
        hasToken: !!token,
        hasUser: !!user,
        tokenExpired: expires ? Date.now() > parseInt(expires) : true,
        authManagerReady: typeof window.authManager !== 'undefined'
    };
}

/**
 * 🌐 Диагностика API запроса
 */
function diagnoseApiRequest(endpoint, options = {}) {
    DEBUG_COUNTERS.apiCalls++;
    
    debugLog('API_REQUEST', `=== API ЗАПРОС #${DEBUG_COUNTERS.apiCalls} ===`);
    debugLog('API_REQUEST', 'Параметры запроса', {
        endpoint,
        method: options.method || 'GET',
        hasBody: !!options.body,
        bodyType: options.body ? typeof options.body : 'none',
        optionsHeaders: options.headers || {}
    });
    
    // Анализируем URL
    const API_PREFIX = '/api/reader';
    const fullUrl = `${API_PREFIX}${endpoint}`;
    debugLog('API_REQUEST', 'URL анализ', {
        endpoint,
        apiPrefix: API_PREFIX,
        fullUrl,
        baseUrl: window.location.origin,
        absoluteUrl: window.location.origin + fullUrl
    });
    
    // Анализируем заголовки
    const authState = analyzeAuthState();
    const headers = { ...options.headers };
    
    debugLog('API_REQUEST', 'Заголовки до модификации', headers);
    
    // 🔧 ИСПРАВЛЕНО: ВСЕ промпты требуют аутентификацию!
    const isPublicEndpoint = false; // НЕТ публичных промпт endpoints!
    
    debugLog('API_REQUEST', 'Логика аутентификации', {
        isPublicEndpoint: false,
        note: '🔧 ВСЕ промпты требуют аутентификацию'
    });
    
    // 🔧 No authentication headers needed - using userId parameter now
    DEBUG_COUNTERS.authAttempts++;
    debugLog('AUTH_ATTEMPT', `Попытка аутентификации #${DEBUG_COUNTERS.authAttempts} - теперь через userId параметр`);
    
    debugLog('AUTH_ATTEMPT', 'Аутентификация через userId параметр в URL вместо заголовков');
    
    // Content-Type логика
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        debugLog('API_REQUEST', 'Установлен Content-Type: application/json');
    } else {
        debugLog('API_REQUEST', 'FormData обнаружена - Content-Type не устанавливается');
    }
    
    debugLog('API_REQUEST', 'Итоговые заголовки', headers);
    
    return {
        fullUrl,
        headers,
        finalOptions: { ...options, headers },
        metadata: {
            isPublic: false,
            hasAuth: false, // No longer using Authorization headers
            authType: 'userId-param' // Using userId parameter instead
        }
    };
}

/**
 * 🔧 Перехват и диагностика makeAuthenticatedRequest
 */
async function debugMakeAuthenticatedRequest(endpoint, options = {}) {
    debugLog('DEBUG_WRAPPER', '=== НАЧАЛО ЗАПРОСА ===');
    
    const diagnosis = diagnoseApiRequest(endpoint, options);
    
    try {
        debugLog('FETCH_CALL', 'Выполнение fetch', {
            url: diagnosis.fullUrl,
            options: diagnosis.finalOptions
        });
        
        const response = await fetch(diagnosis.fullUrl, diagnosis.finalOptions);
        
        debugLog('FETCH_RESPONSE', 'Ответ получен', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            DEBUG_COUNTERS.errors++;
            
            const errorText = await response.text();
            debugLog('ERROR_RESPONSE', `Ошибка #${DEBUG_COUNTERS.errors}`, {
                status: response.status,
                statusText: response.statusText,
                responseText: errorText,
                isAuthError: response.status === 401,
                diagnosis: diagnosis.metadata
            });
            
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || `HTTP ${response.status}` };
            }
            
            debugLog('ERROR_PARSED', 'Разобранная ошибка', errorData);
            
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        debugLog('SUCCESS_RESPONSE', 'Успешный ответ', {
            hasData: !!result,
            success: result.success,
            dataKeys: Object.keys(result)
        });
        
        return result;
        
    } catch (error) {
        DEBUG_COUNTERS.errors++;
        debugLog('CATCH_ERROR', `Исключение #${DEBUG_COUNTERS.errors}`, {
            message: error.message,
            name: error.name,
            stack: error.stack,
            diagnosis: diagnosis.metadata
        });
        
        throw error;
    } finally {
        debugLog('DEBUG_WRAPPER', '=== КОНЕЦ ЗАПРОСА ===');
    }
}

/**
 * 📈 Статистика отладки
 */
function getDebugStats() {
    return {
        counters: DEBUG_COUNTERS,
        authState: analyzeAuthState(),
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        currentUrl: window.location.href
    };
}

/**
 * 🧪 Тестирование API endpoints
 */
async function testApiEndpoints() {
    debugLog('API_TEST', '=== ТЕСТИРОВАНИЕ API ENDPOINTS ===');
    
    const endpoints = [
        { path: '/prompts?page=1&limit=10', method: 'GET', description: 'Список промптов' },
        { path: '/prompts/stats', method: 'GET', description: 'Статистика промптов' }
    ];
    
    for (const endpoint of endpoints) {
        debugLog('API_TEST', `Тестирование: ${endpoint.description}`);
        
        try {
            const result = await debugMakeAuthenticatedRequest(endpoint.path, {
                method: endpoint.method
            });
            
            debugLog('API_TEST', `✅ ${endpoint.description} - успех`, {
                success: result.success,
                hasData: !!result.data
            });
            
        } catch (error) {
            debugLog('API_TEST', `❌ ${endpoint.description} - ошибка`, {
                error: error.message
            });
        }
    }
    
    debugLog('API_TEST', '=== ЗАВЕРШЕНИЕ ТЕСТИРОВАНИЯ ===');
}

/**
 * 🔄 Сброс диагностических данных
 */
function resetDebugData() {
    DEBUG_COUNTERS = {
        apiCalls: 0,
        authAttempts: 0,
        errors: 0,
        tokenChecks: 0
    };
    debugLog('DEBUG_RESET', 'Счетчики сброшены');
}

/**
 * 💾 Экспорт диагностических данных
 */
function exportDebugData() {
    const data = {
        stats: getDebugStats(),
        localStorage: {
            adminToken: localStorage.getItem('adminToken'),
            reader_admin_user: localStorage.getItem('reader_admin_user'),
            reader_admin_expires: localStorage.getItem('reader_admin_expires')
        },
        config: DEBUG_CONFIG,
        timestamp: new Date().toISOString()
    };
    
    console.log('📊 ДИАГНОСТИЧЕСКИЕ ДАННЫЕ:', JSON.stringify(data, null, 2));
    return data;
}

// 🚀 Инициализация диагностики
function initPromptsDiagnostics() {
    debugLog('INIT', '🛠️ Инициализация диагностики prompts.js');
    
    // Анализируем начальное состояние
    analyzeAuthState();
    
    // 🔧 НЕ ЗАМЕНЯЕМ функцию - позволяем использовать исправленную версию
    debugLog('INIT', '🔧 Диагностика работает в пассивном режиме - НЕ перехватывает makeAuthenticatedRequest');
    
    // Экспортируем диагностические функции
    window.debugPrompts = {
        analyzeAuthState,
        testApiEndpoints,
        getDebugStats,
        resetDebugData,
        exportDebugData,
        diagnoseApiRequest
    };
    
    debugLog('INIT', '✅ Диагностика prompts.js инициализирована');
    
    // Автоматическое тестирование через 2 секунды
    setTimeout(() => {
        debugLog('AUTO_TEST', 'Запуск автоматического тестирования...');
        testApiEndpoints();
    }, 2000);
}

// Запуск диагностики при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('prompts.html')) {
        initPromptsDiagnostics();
    }
});

console.log('🛠️ Диагностический модуль prompts-debug.js загружен');
