/**
 * CORS Test Page JavaScript
 * @file server/static/cors-test.js
 */

// Global variables
const baseURL = window.location.origin;

// Log function to show activity
function log(message) {
    console.log(`[CORS Test] ${message}`);
}

// Utility function to update status indicators
function updateStatus(elementId, status) {
    log(`Updating status ${elementId}: ${status}`);
    const indicator = document.getElementById(elementId);
    if (!indicator) {
        log(`Warning: Status indicator ${elementId} not found`);
        return;
    }
    
    indicator.className = 'status-indicator';
    if (status === 'pending') {
        indicator.classList.add('status-pending');
    } else if (status === 'success') {
        indicator.classList.add('status-success');
    } else if (status === 'error') {
        indicator.classList.add('status-error');
    }
}

// Test public endpoints
async function testPublicEndpoint(endpoint) {
    const statusId = endpoint.includes('health') ? 'health-status' : 'chat-status';
    const btnId = endpoint.includes('health') ? 'health-btn' : 'chat-btn';
    
    log(`Testing public endpoint: ${endpoint}`);
    updateStatus(statusId, 'pending');
    
    // Disable button during test
    const button = document.getElementById(btnId);
    button.disabled = true;
    
    const results = document.getElementById('public-results');
    const timestamp = new Date().toLocaleTimeString();
    
    try {
        let options = { method: 'GET' };
        
        if (endpoint.includes('chat')) {
            options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'http://test-cors.example.com'
                },
                body: JSON.stringify({
                    message: 'Hello from CORS test! 🍄',
                    userId: 'test-user-cors',
                    language: 'en'
                })
            };
        }
        
        log(`Making request to ${baseURL + endpoint}`);
        const response = await fetch(baseURL + endpoint, options);
        const data = await response.json();
        
        updateStatus(statusId, response.ok ? 'success' : 'error');
        
        results.textContent += `[${timestamp}] ${endpoint} (${options.method})\n`;
        results.textContent += `Status: ${response.status} ${response.statusText}\n`;
        
        // Show important headers
        const corsHeaders = {};
        response.headers.forEach((value, key) => {
            if (key.toLowerCase().startsWith('access-control-') || key.toLowerCase().includes('cors')) {
                corsHeaders[key] = value;
            }
        });
        
        if (Object.keys(corsHeaders).length > 0) {
            results.textContent += `CORS Headers: ${JSON.stringify(corsHeaders, null, 2)}\n`;
        }
        
        results.textContent += `Response: ${JSON.stringify(data, null, 2)}\n\n`;
        results.scrollTop = results.scrollHeight;
        
    } catch (error) {
        log(`Error in testPublicEndpoint: ${error.message}`);
        updateStatus(statusId, 'error');
        results.textContent += `[${timestamp}] ${endpoint} - ERROR\n`;
        results.textContent += `Error: ${error.message}\n\n`;
        results.scrollTop = results.scrollHeight;
    } finally {
        // Re-enable button
        button.disabled = false;
    }
}

// Test authenticated endpoints
async function testAuthEndpoint(endpoint, method = 'GET') {
    const statusId = method === 'POST' ? 'auth-post-status' : 'auth-tickets-status';
    const btnId = method === 'POST' ? 'auth-post-btn' : 'auth-get-btn';
    
    log(`Testing auth endpoint: ${endpoint} (${method})`);
    updateStatus(statusId, 'pending');
    
    // Disable button during test
    const button = document.getElementById(btnId);
    button.disabled = true;
    
    const results = document.getElementById('auth-results');
    const timestamp = new Date().toLocaleTimeString();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const options = {
            method: method,
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
                'Content-Type': 'application/json',
                'Origin': 'http://test-cors.example.com'
            }
        };
        
        if (method === 'POST') {
            options.body = JSON.stringify({
                title: 'Test ticket from CORS',
                description: 'Testing admin endpoint with CORS 🍄',
                priority: 'low'
            });
        }
        
        log(`Making authenticated request to ${baseURL + endpoint}`);
        const response = await fetch(baseURL + endpoint, options);
        const data = await response.json();
        
        updateStatus(statusId, response.ok ? 'success' : 'error');
        
        results.textContent += `[${timestamp}] ${endpoint} (${method})\n`;
        results.textContent += `Credentials: ${username}:${password.replace(/./g, '*')}\n`;
        results.textContent += `Status: ${response.status} ${response.statusText}\n`;
        
        // Show auth-related headers
        const authHeaders = {};
        response.headers.forEach((value, key) => {
            if (key.toLowerCase().includes('auth') || key.toLowerCase().startsWith('access-control-')) {
                authHeaders[key] = value;
            }
        });
        
        if (Object.keys(authHeaders).length > 0) {
            results.textContent += `Auth/CORS Headers: ${JSON.stringify(authHeaders, null, 2)}\n`;
        }
        
        results.textContent += `Response: ${JSON.stringify(data, null, 2)}\n\n`;
        results.scrollTop = results.scrollHeight;
        
    } catch (error) {
        log(`Error in testAuthEndpoint: ${error.message}`);
        updateStatus(statusId, 'error');
        results.textContent += `[${timestamp}] ${endpoint} (${method}) - ERROR\n`;
        results.textContent += `Error: ${error.message}\n\n`;
        results.scrollTop = results.scrollHeight;
    } finally {
        // Re-enable button
        button.disabled = false;
    }
}

// Test rate limiting
async function testRateLimit() {
    log('Starting rate limit test');
    updateStatus('rate-limit-status', 'pending');
    
    // Disable button during test
    const button = document.getElementById('rate-limit-btn');
    button.disabled = true;
    
    const results = document.getElementById('rate-limit-results');
    const timestamp = new Date().toLocaleTimeString();
    
    results.textContent += `[${timestamp}] Starting rate limit test (10 rapid requests)...\n`;
    
    try {
        const promises = [];
        for (let i = 0; i < 10; i++) {
            promises.push(
                fetch(baseURL + '/api/health')
                    .then(response => ({
                        request: i + 1,
                        status: response.status,
                        headers: {
                            'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
                            'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
                            'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
                            'retry-after': response.headers.get('retry-after')
                        }
                    }))
                    .catch(error => ({
                        request: i + 1,
                        error: error.message
                    }))
            );
        }
        
        const responses = await Promise.all(promises);
        let rateLimited = false;
        
        responses.forEach(resp => {
            results.textContent += `Request ${resp.request}: `;
            if (resp.error) {
                results.textContent += `ERROR - ${resp.error}\n`;
            } else {
                results.textContent += `Status ${resp.status}`;
                if (resp.status === 429) {
                    rateLimited = true;
                    results.textContent += ` (Rate Limited!)`;
                    if (resp.headers['retry-after']) {
                        results.textContent += ` - Retry after: ${resp.headers['retry-after']}s`;
                    }
                }
                if (resp.headers['x-ratelimit-remaining']) {
                    results.textContent += ` - Remaining: ${resp.headers['x-ratelimit-remaining']}`;
                }
                results.textContent += `\n`;
            }
        });
        
        updateStatus('rate-limit-status', rateLimited ? 'success' : 'error');
        results.textContent += `\nRate limiting is ${rateLimited ? 'WORKING ✓' : 'NOT WORKING ✗'}\n\n`;
        results.scrollTop = results.scrollHeight;
        
    } catch (error) {
        log(`Error in testRateLimit: ${error.message}`);
        updateStatus('rate-limit-status', 'error');
        results.textContent += `Rate limit test failed: ${error.message}\n\n`;
        results.scrollTop = results.scrollHeight;
    } finally {
        // Re-enable button
        button.disabled = false;
    }
}

// Test CORS preflight
async function testCORSPreflight() {
    log('Testing CORS preflight');
    updateStatus('cors-preflight-status', 'pending');
    
    // Disable button during test
    const button = document.getElementById('cors-preflight-btn');
    button.disabled = true;
    
    const results = document.getElementById('cors-results');
    const timestamp = new Date().toLocaleTimeString();
    
    try {
        // Note: Browser will automatically send OPTIONS request for preflight
        const response = await fetch(baseURL + '/api/admin/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'http://test-cors.example.com',
                'Authorization': 'Basic ' + btoa('admin:password123')
            },
            body: JSON.stringify({ test: 'preflight' })
        });
        
        updateStatus('cors-preflight-status', response.ok || response.status === 401 ? 'success' : 'error');
        
        results.textContent += `[${timestamp}] CORS Preflight Test\n`;
        results.textContent += `Status: ${response.status} ${response.statusText}\n`;
        results.textContent += `Access-Control-Allow-Origin: ${response.headers.get('Access-Control-Allow-Origin') || 'Not set'}\n`;
        results.textContent += `Access-Control-Allow-Methods: ${response.headers.get('Access-Control-Allow-Methods') || 'Not set'}\n`;
        results.textContent += `Access-Control-Allow-Headers: ${response.headers.get('Access-Control-Allow-Headers') || 'Not set'}\n`;
        results.textContent += `Access-Control-Allow-Credentials: ${response.headers.get('Access-Control-Allow-Credentials') || 'Not set'}\n\n`;
        results.scrollTop = results.scrollHeight;
        
    } catch (error) {
        log(`Error in testCORSPreflight: ${error.message}`);
        updateStatus('cors-preflight-status', 'error');
        results.textContent += `[${timestamp}] CORS Preflight - ERROR\n`;
        results.textContent += `Error: ${error.message}\n\n`;
        results.scrollTop = results.scrollHeight;
    } finally {
        // Re-enable button
        button.disabled = false;
    }
}

// Test CORS with credentials
async function testCORSCredentials() {
    log('Testing CORS with credentials');
    updateStatus('cors-credentials-status', 'pending');
    
    // Disable button during test
    const button = document.getElementById('cors-credentials-btn');
    button.disabled = true;
    
    const results = document.getElementById('cors-results');
    const timestamp = new Date().toLocaleTimeString();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(baseURL + '/api/admin/tickets', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + password),
                'Origin': 'http://test-cors.example.com'
            }
        });
        
        const data = await response.json();
        
        updateStatus('cors-credentials-status', response.ok ? 'success' : 'error');
        
        results.textContent += `[${timestamp}] CORS with Credentials Test\n`;
        results.textContent += `Status: ${response.status} ${response.statusText}\n`;
        results.textContent += `Access-Control-Allow-Credentials: ${response.headers.get('Access-Control-Allow-Credentials') || 'Not set'}\n`;
        results.textContent += `Response: ${JSON.stringify(data, null, 2)}\n\n`;
        results.scrollTop = results.scrollHeight;
        
    } catch (error) {
        log(`Error in testCORSCredentials: ${error.message}`);
        updateStatus('cors-credentials-status', 'error');
        results.textContent += `[${timestamp}] CORS with Credentials - ERROR\n`;
        results.textContent += `Error: ${error.message}\n\n`;
        results.scrollTop = results.scrollHeight;
    } finally {
        // Re-enable button
        button.disabled = false;
    }
}

// Initialize page
function initializePage() {
    log('CORS test page loaded successfully. JavaScript is working.');
    
    // Set debug info
    document.getElementById('current-url').textContent = window.location.href;
    document.getElementById('user-agent').textContent = navigator.userAgent;
    
    // Add event listeners to buttons
    document.getElementById('health-btn').addEventListener('click', () => testPublicEndpoint('/api/health'));
    document.getElementById('chat-btn').addEventListener('click', () => testPublicEndpoint('/api/chat/message'));
    document.getElementById('auth-get-btn').addEventListener('click', () => testAuthEndpoint('/api/admin/tickets'));
    document.getElementById('auth-post-btn').addEventListener('click', () => testAuthEndpoint('/api/admin/tickets', 'POST'));
    document.getElementById('rate-limit-btn').addEventListener('click', testRateLimit);
    document.getElementById('cors-preflight-btn').addEventListener('click', testCORSPreflight);
    document.getElementById('cors-credentials-btn').addEventListener('click', testCORSCredentials);
    
    // Auto-run health check after a short delay
    setTimeout(() => {
        testPublicEndpoint('/api/health');
    }, 1000);
}

// Wait for DOM to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// Log any JavaScript errors
window.addEventListener('error', (event) => {
    log(`JavaScript Error: ${event.error.message}`);
    console.error('JavaScript Error:', event.error);
});

// Make functions globally available for any remaining inline handlers
window.testPublicEndpoint = testPublicEndpoint;
window.testAuthEndpoint = testAuthEndpoint;
window.testRateLimit = testRateLimit;
window.testCORSPreflight = testCORSPreflight;
window.testCORSCredentials = testCORSCredentials;