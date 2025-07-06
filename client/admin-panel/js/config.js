/**
 * Конфигурация для админ-панели Reader Bot
 * @file client/admin-panel/js/config.js
 */

// API Configuration
const API_CONFIG = {
    BASE_URL: '/api/reader',
    ENDPOINTS: {
        // Users endpoints
        USERS: '/api/reader/users',
        USERS_STATS: '/api/reader/users/stats',
        USER_DETAIL: (userId) => `/api/reader/users/${userId}`,
        USER_MESSAGE: (userId) => `/api/reader/users/${userId}/message`,
        USERS_EXPORT: '/api/reader/users/export',
        
        // Quotes endpoints
        QUOTES: '/api/quotes',
        QUOTES_STATS: '/api/quotes/statistics',
        QUOTES_ANALYTICS: '/api/quotes/analytics',
        
        // Reports endpoints
        REPORTS: '/api/reader/reports',
        REPORTS_WEEKLY: '/api/reader/reports/weekly',
        REPORTS_MONTHLY: '/api/reader/reports/monthly',
        
        // Analytics endpoints
        ANALYTICS: '/api/reader/analytics',
        ANALYTICS_DASHBOARD: '/api/reader/analytics/dashboard',
        ANALYTICS_UTM: '/api/reader/analytics/utm',
        
        // Admin endpoints
        ADMIN_AUTH: '/api/reader/admin/auth',
        ADMIN_HEALTH: '/api/reader/health'
    }
};

// Helper function to get API URL
function getApiUrl(endpoint, ...params) {
    if (typeof endpoint === 'function') {
        return endpoint(...params);
    }
    return endpoint;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, getApiUrl };
} else {
    window.API_CONFIG = API_CONFIG;
    window.getApiUrl = getApiUrl;
}