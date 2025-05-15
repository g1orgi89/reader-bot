/**
 * CORS Test Script for Shrooms Support Bot 🍄
 * This script contains all test functions for the CORS test page
 */

// Base URL for API requests
const BASE_URL = window.location.origin;

/**
 * Display result in the specified element
 * @param {string} elementId - ID of the result container
 * @param {string} type - success or error
 * @param {string} message - Message to display
 * @param {Object} [details] - Optional details object
 */
function displayResult(elementId, type, message, details = null) {
  const element = document.getElementById(elementId);
  element.className = `result ${type}`;
  
  let content = `<p>${message}</p>`;
  
  if (details) {
    if (details.status) {
      content += `<p><strong>Status:</strong> ${details.status}</p>`;
    }
    if (details.headers && Object.keys(details.headers).length > 0) {
      content += '<p><strong>Response Headers:</strong></p><ul>';
      for (const [key, value] of Object.entries(details.headers)) {
        content += `<li><strong>${key}:</strong> ${value}</li>`;
      }
      content += '</ul>';
    }
    if (details.body) {
      content += `<p><strong>Response Body:</strong></p><pre>${JSON.stringify(details.body, null, 2)}</pre>`;
    }
    if (details.error) {
      content += `<p><strong>Error Details:</strong> ${details.error}</p>`;
    }
  }
  
  element.innerHTML = content;
}

/**
 * Test CORS OPTIONS preflight request
 */
async function testCorsPreflight() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    displayResult('preflight-result', 'success', '✅ OPTIONS preflight request successful!', {
      status: response.status,
      headers: responseHeaders
    });
  } catch (error) {
    displayResult('preflight-result', 'error', '❌ CORS preflight failed', {
      error: error.message
    });
  }
}

/**
 * Test CORS with credentials and custom headers
 */
async function testCorsWithCredentials() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'test-value'
      }
    });

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const body = await response.json();

    displayResult('cors-result', 'success', '✅ CORS with credentials successful!', {
      status: response.status,
      headers: responseHeaders,
      body: body
    });
  } catch (error) {
    displayResult('cors-result', 'error', '❌ CORS with credentials failed', {
      error: error.message
    });
  }
}

/**
 * Test health check endpoint
 */
async function testHealthCheck() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const body = await response.json();
    
    displayResult('health-result', 'success', '✅ Health check successful!', {
      status: response.status,
      body: body
    });
  } catch (error) {
    displayResult('health-result', 'error', '❌ Health check failed', {
      error: error.message
    });
  }
}

/**
 * Test admin login endpoint
 */
async function testAdminLogin() {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'shrooms-admin-2024'
      })
    });

    const body = await response.json();
    
    // Store token for subsequent requests
    if (body.token) {
      window.adminToken = body.token;
    }
    
    displayResult('admin-result', 'success', '✅ Admin login successful!', {
      status: response.status,
      body: body
    });
  } catch (error) {
    displayResult('admin-result', 'error', '❌ Admin login failed', {
      error: error.message
    });
  }
}

/**
 * Test admin tickets endpoint (requires authentication)
 */
async function testAdminTickets() {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    // Add authorization header if we have a token
    if (window.adminToken) {
      headers['Authorization'] = `Bearer ${window.adminToken}`;
    }
    
    const response = await fetch(`${BASE_URL}/api/admin/tickets`, {
      method: 'GET',
      headers: headers
    });

    const body = await response.json();
    
    displayResult('tickets-result', 'success', '✅ Admin tickets request successful!', {
      status: response.status,
      body: body
    });
  } catch (error) {
    displayResult('tickets-result', 'error', '❌ Admin tickets request failed', {
      error: error.message
    });
  }
}

/**
 * Test chat endpoint
 */
async function testChat() {
  try {
    const response = await fetch(`${BASE_URL}/api/chat-simple`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello from CORS test!',
        userId: 'test-user-' + Date.now(),
        language: 'en'
      })
    });

    const body = await response.json();
    
    displayResult('chat-result', 'success', '✅ Chat request successful!', {
      status: response.status,
      body: body
    });
  } catch (error) {
    displayResult('chat-result', 'error', '❌ Chat request failed', {
      error: error.message
    });
  }
}

/**
 * Test rate limiting by sending multiple rapid requests
 */
async function testRateLimit() {
  const resultDiv = document.getElementById('ratelimit-result');
  resultDiv.innerHTML = '<p>🔄 Sending 10 rapid requests...</p>';
  
  const requests = [];
  const results = [];
  
  // Send 10 requests rapidly
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch(`${BASE_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(response => ({
        attempt: i + 1,
        status: response.status,
        ok: response.ok
      })).catch(error => ({
        attempt: i + 1,
        error: error.message
      }))
    );
  }
  
  try {
    const responses = await Promise.all(requests);
    
    const successful = responses.filter(r => r.ok).length;
    const rateLimited = responses.filter(r => r.status === 429).length;
    const errors = responses.filter(r => r.error).length;
    
    let resultContent = `<p>✅ Rate limiting test completed!</p>`;
    resultContent += `<p><strong>Summary:</strong></p>`;
    resultContent += `<ul>`;
    resultContent += `<li>Successful requests: ${successful}</li>`;
    resultContent += `<li>Rate limited (429): ${rateLimited}</li>`;
    resultContent += `<li>Errors: ${errors}</li>`;
    resultContent += `</ul>`;
    
    resultContent += `<p><strong>Detailed Results:</strong></p>`;
    resultContent += `<ol>`;
    responses.forEach(result => {
      if (result.error) {
        resultContent += `<li>Request ${result.attempt}: ERROR - ${result.error}</li>`;
      } else {
        resultContent += `<li>Request ${result.attempt}: ${result.status} ${result.ok ? '✅' : '❌'}</li>`;
      }
    });
    resultContent += `</ol>`;
    
    resultDiv.className = 'result success';
    resultDiv.innerHTML = resultContent;
  } catch (error) {
    displayResult('ratelimit-result', 'error', '❌ Rate limiting test failed', {
      error: error.message
    });
  }
}

// Test function mapping
const testFunctions = {
  'preflight': testCorsPreflight,
  'cors': testCorsWithCredentials,
  'health': testHealthCheck,
  'admin': testAdminLogin,
  'tickets': testAdminTickets,
  'chat': testChat,
  'ratelimit': testRateLimit
};

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add event listeners to all buttons using data-test attribute
  document.querySelectorAll('button[data-test]').forEach(button => {
    const testType = button.getAttribute('data-test');
    const testFunction = testFunctions[testType];
    
    if (testFunction) {
      button.addEventListener('click', testFunction);
    }
  });
});
