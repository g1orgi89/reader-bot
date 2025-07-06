/**
 * Конфигурация для админ-панели Reader Bot
 * @file client/admin-panel/js/config.js
 */

// API Configuration
const API_CONFIG = {
    BASE_URL: '/api',
    ENDPOINTS: {
        // Users endpoints
        USERS: '/api/users',
        USERS_STATS: '/api/users/stats',
        USER_DETAIL: (userId) => `/api/users/${userId}`,
        USER_MESSAGE: (userId) => `/api/users/${userId}/message`,
        USERS_EXPORT: '/api/users/export',
        
        // Quotes endpoints
        QUOTES: '/api/quotes',
        QUOTES_STATS: '/api/quotes/statistics',
        QUOTES_ANALYTICS: '/api/quotes/analytics',
        
        // Reports endpoints
        REPORTS: '/api/reports',
        REPORTS_WEEKLY: '/api/reports/weekly',
        REPORTS_MONTHLY: '/api/reports/monthly',
        
        // Analytics endpoints
        ANALYTICS: '/api/analytics',
        ANALYTICS_DASHBOARD: '/api/analytics/dashboard',
        ANALYTICS_UTM: '/api/analytics/utm',
        
        // Admin endpoints
        ADMIN_AUTH: '/api/admin/auth',
        ADMIN_HEALTH: '/api/health'
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