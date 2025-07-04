/**
 * URL Fix for Reader Bot API
 * This script fixes API URLs to work with /api/reader prefix
 */

(function() {
    'use strict';
    
    console.log('🔧 Applying API URL fix for Reader Bot...');
    
    // Override fetch function to automatically fix URLs
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Convert relative API URLs to use /api/reader prefix
        if (typeof url === 'string' && url.startsWith('/api/users')) {
            url = url.replace('/api/users', '/api/reader/users');
            console.log('🔧 URL fixed:', url);
        }
        
        return originalFetch.call(this, url, options);
    };
    
    console.log('✅ API URL fix applied successfully');
})();