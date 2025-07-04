/**
 * URL Fix for Reader Bot API
 * This script fixes API URLs, authentication headers, and response format compatibility
 */

(function() {
    'use strict';
    
    console.log('🔧 Applying API URL fix for Reader Bot...');
    
    // Admin credentials from config (должны соответствовать .env файлу)
    const ADMIN_CREDENTIALS = {
        username: 'reader_admin',  // соответствует ADMIN_USERNAME в .env
        password: 'reader_secure_pass_2025'  // соответствует ADMIN_PASSWORD в .env
    };
    
    // Create Basic Auth header
    function createBasicAuthHeader() {
        const credentials = btoa(`${ADMIN_CREDENTIALS.username}:${ADMIN_CREDENTIALS.password}`);
        return `Basic ${credentials}`;
    }
    
    // Override fetch function to automatically fix URLs and auth
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        // Convert relative API URLs to use /api/reader prefix
        if (typeof url === 'string' && url.startsWith('/api/users')) {
            url = url.replace('/api/users', '/api/reader/users');
            console.log('🔧 URL fixed:', url);
        }
        
        // Fix authorization headers for admin endpoints
        if (typeof url === 'string' && url.includes('/api/reader/')) {
            options = { ...options };
            options.headers = { ...options.headers };
            
            // Replace Bearer token with Basic Auth
            if (options.headers['Authorization'] && options.headers['Authorization'].startsWith('Bearer')) {
                options.headers['Authorization'] = createBasicAuthHeader();
                console.log('🔧 Auth header fixed to Basic Auth');
            } else if (!options.headers['Authorization']) {
                // Add Basic Auth if no authorization header exists
                options.headers['Authorization'] = createBasicAuthHeader();
                console.log('🔧 Basic Auth header added');
            }
        }
        
        // Wrap the response to fix data structure
        return originalFetch.call(this, url, options).then(async response => {
            if (response.ok && url.includes('/api/reader/users')) {
                const originalJson = response.json.bind(response);
                response.json = async function() {
                    const data = await originalJson();
                    console.log('🔧 Original response:', data);
                    
                    // Fix stats endpoint response format
                    if (url.includes('/stats') && data.success && data.stats) {
                        console.log('🔧 Fixing stats response format');
                        return data.stats;  // Return stats directly
                    }
                    
                    // Fix users list endpoint response format  
                    if (url.includes('/users') && !url.includes('/stats') && data.success && data.data) {
                        console.log('🔧 Fixing users response format');
                        return {
                            users: data.data.users,
                            pagination: data.data.pagination
                        };
                    }
                    
                    return data;
                };
            }
            return response;
        });
    };
    
    console.log('✅ API URL, Auth, and Response format fix applied successfully');
    console.log('🔑 Using credentials:', ADMIN_CREDENTIALS.username);
})();