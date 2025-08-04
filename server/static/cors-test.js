let adminToken = null;

function logResult(elementId, message, type = 'info') {
    const element = document.getElementById(elementId);
    element.className = `result ${type}`;
    element.innerHTML = `<pre>${message}</pre>`;
}

// 🍄 NEW: Manual CORS Preflight Test
async function testCorsPreflight() {
    logResult('preflight-result', 'Sending manual OPTIONS preflight request...', 'info');
    
    try {
        const response = await fetch('http://localhost:3000/api/tickets', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        });
        
        const corsHeaders = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
        };
        
        const message = `[${new Date().toLocaleTimeString()}] CORS Preflight Test
Status: ${response.status} ${response.statusText}
${Object.entries(corsHeaders).map(([key, value]) => `${key}: ${value || 'Not set'}`).join('\n')}`;
        
        logResult('preflight-result', message, response.status === 200 ? 'success' : 'error');
        
        console.log('Console will show CORS test results here...');
        console.log(message);
    } catch (error) {
        const message = `[${new Date().toLocaleTimeString()}] CORS Preflight Test
Status: Error
Error: ${error.message}`;
        logResult('preflight-result', message, 'error');
        console.log(message);
    }
}

// 🍄 NEW: Real CORS test that triggers preflight
async function testCorsWithCredentials() {
    logResult('cors-result', 'Testing CORS with custom headers (will trigger preflight)...', 'info');
    
    try {
        // First create a ticket using Basic Auth (this should trigger OPTIONS preflight)
        const credentials = btoa('admin:password123'); // admin:password123
        const response = await fetch('http://localhost:3000/api/admin/tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${credentials}`,
                'X-Custom-Header': 'test-value'  // This will force preflight
            },
            credentials: 'include',
            body: JSON.stringify({
                subject: 'Test ticket from CORS',
                message: 'Testing admin endpoint with CORS 🍄',
                category: 'other',
                priority: 'low'
            })
        });
        
        const corsHeaders = {
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
        };
        
        const data = response.ok ? await response.json() : { error: 'Failed to parse response' };
        
        const message = `[${new Date().toLocaleTimeString()}] CORS with Credentials Test
Status: ${response.status} ${response.statusText}
${Object.entries(corsHeaders).map(([key, value]) => `${key}: ${value || 'Not set'}`).join('\n')}
Response: ${JSON.stringify(data, null, 2)}`;
        
        logResult('cors-result', message, response.ok ? 'success' : 'error');
        console.log(message);
    } catch (error) {
        const message = `[${new Date().toLocaleTimeString()}] CORS with Credentials Test
Status: Error
Error: ${error.message}`;
        logResult('cors-result', message, 'error');
        console.log(message);
    }
}

async function testHealthCheck() {
    logResult('health-result', 'Testing health check...', 'info');
    
    try {
        const response = await fetch('http://localhost:3000/api/health', {
            method: 'GET',
            credentials: 'include'
        });
        
        const data = await response.json();
        const message = `Status: ${response.status}\nHeaders: ${JSON.stringify([...response.headers.entries()], null, 2)}\nCORS: ${response.headers.get('Access-Control-Allow-Origin') ? 'Allowed' : 'Not set'}\nData: ${JSON.stringify(data, null, 2)}`;
        
        logResult('health-result', message, response.ok ? 'success' : 'error');
    } catch (error) {
        logResult('health-result', `Error: ${error.message}`, 'error');
    }
}

async function testAdminLogin() {
    logResult('admin-result', 'Testing admin login...', 'info');
    
    try {
        const response = await fetch('http://localhost:3000/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                username: 'admin',
                password: 'password123'
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            adminToken = data.data.token;
        }
        
        const message = `Status: ${response.status}\nCORS: ${response.headers.get('Access-Control-Allow-Origin') ? 'Allowed' : 'Not set'}\nToken received: ${adminToken ? 'Yes' : 'No'}\nData: ${JSON.stringify(data, null, 2)}`;
        
        logResult('admin-result', message, response.ok ? 'success' : 'error');
    } catch (error) {
        logResult('admin-result', `Error: ${error.message}`, 'error');
    }
}

async function testAdminTickets() {
    if (!adminToken) {
        logResult('tickets-result', 'Please login first to get admin token', 'error');
        return;
    }
    
    logResult('tickets-result', 'Testing admin tickets with token...', 'info');
    
    try {
        const response = await fetch('http://localhost:3000/api/admin/tickets', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            credentials: 'include'
        });
        
        const data = await response.json();
        const message = `Status: ${response.status}\nCORS: ${response.headers.get('Access-Control-Allow-Origin') ? 'Allowed' : 'Not set'}\nData: ${JSON.stringify(data, null, 2)}`;
        
        logResult('tickets-result', message, response.ok ? 'success' : 'error');
    } catch (error) {
        logResult('tickets-result', `Error: ${error.message}`, 'error');
    }
}

async function testChat() {
    logResult('chat-result', 'Testing chat endpoint...', 'info');
    
    try {
        const response = await fetch('http://localhost:3000/api/chat-simple', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                message: 'Hello, what is Reader Bot?'
            })
        });
        
        const data = await response.json();
        const message = `Status: ${response.status}\nCORS: ${response.headers.get('Access-Control-Allow-Origin') ? 'Allowed' : 'Not set'}\nResponse: ${data.success ? 'Success' : 'Failed'}`;
        
        logResult('chat-result', message, response.ok ? 'success' : 'error');
    } catch (error) {
        logResult('chat-result', `Error: ${error.message}`, 'error');
    }
}

async function testRateLimit() {
    logResult('ratelimit-result', 'Sending 10 rapid requests...', 'info');
    
    const results = [];
    
    for (let i = 1; i <= 10; i++) {
        try {
            const start = Date.now();
            const response = await fetch('http://localhost:3000/api/chat-simple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Rate limit test ${i}`
                })
            });
            
            const end = Date.now();
            const rateLimit = {
                limit: response.headers.get('RateLimit-Limit'),
                remaining: response.headers.get('RateLimit-Remaining'),
                reset: response.headers.get('RateLimit-Reset')
            };
            
            results.push(`${i}: ${response.status} (${end - start}ms) Remaining: ${rateLimit.remaining}`);
        } catch (error) {
            results.push(`${i}: Error - ${error.message}`);
        }
    }
    
    const message = results.join('\n');
    logResult('ratelimit-result', message, 'info');
}