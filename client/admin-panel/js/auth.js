/**
 * Authentication module for Shrooms AI Support Bot admin panel
 * @file client/admin-panel/js/auth.js
 */

/**
 * Initialize the login page functionality
 */
function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  // Add event listener to form submission
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    
    // Clear previous error
    if (errorElement) {
      errorElement.textContent = '';
    }
    
    // Validate input
    if (!username || !password) {
      if (errorElement) {
        errorElement.textContent = 'Please enter both username and password';
      }
      return;
    }
    
    try {
      // Show loading state (could add a spinner here)
      const submitButton = loginForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.querySelector('.btn-text').textContent = 'Logging in...';
      }
      
      // Perform login
      const result = await loginUser(username, password);
      
      if (result.success) {
        // Store auth token
        localStorage.setItem('adminToken', result.data.token);
        localStorage.setItem('adminUsername', result.data.username);
        
        // Redirect to dashboard
        window.location.href = 'index.html';
      } else {
        // Show error
        if (errorElement) {
          errorElement.textContent = result.error?.message || 'Login failed. Please check your credentials.';
        }
        
        // Reset loading state
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.querySelector('.btn-text').textContent = 'Login';
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      if (errorElement) {
        errorElement.textContent = 'An error occurred during login. Please try again.';
      }
      
      // Reset loading state on error
      const submitButton = loginForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.querySelector('.btn-text').textContent = 'Login';
      }
    }
  });
  
  // Check if already logged in
  const token = localStorage.getItem('adminToken');
  if (token) {
    // Redirect to dashboard if already logged in
    window.location.href = 'index.html';
  }
}

/**
 * Send login request to the server
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Promise<Object>} Login result
 */
async function loginUser(username, password) {
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Login request error:', error);
    return {
      success: false,
      error: {
        message: 'Network error. Please check your connection.'
      }
    };
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
function checkAuth() {
  try {
    const token = localStorage.getItem('adminToken');
    return !!token;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}

/**
 * Logout the current user
 */
function logout() {
  try {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error during logout. Please try again.');
  }
}

/**
 * Initialize the mushroom matrix background animation
 */
function initMushroomMatrix() {
  try {
    const container = document.querySelector('.mushroom-bg-animation');
    if (!container) return;
    
    // Create canvas if it doesn't exist
    let canvas = document.getElementById('mushroom-matrix-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'mushroom-matrix-canvas';
      container.appendChild(canvas);
    }
    
    // Set canvas dimensions
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Update canvas size on window resize
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
    
    const ctx = canvas.getContext('2d');
    
    // Mushroom symbols to use in the matrix
    const mushroomSymbols = ['🍄', '•', '○', '◌', '◍', '◎', '◯', '⚪', '⭕', '✱', '✲', '✳', '✴', '✵'];
    
    // Calculate columns based on canvas width (one column every 20px)
    const columns = Math.floor(canvas.width / 20);
    const drops = [];
    
    // Initialize drops at random positions
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * -canvas.height);
    }
    
    // Animation function
    function draw() {
      // Semi-transparent black background to create trail effect
      ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Set text color and font
      ctx.fillStyle = '#39FF14'; // Neon green
      ctx.font = '15px monospace';
      
      // Draw each column
      for (let i = 0; i < drops.length; i++) {
        // Select a random mushroom symbol
        const symbol = mushroomSymbols[Math.floor(Math.random() * mushroomSymbols.length)];
        
        // Draw the symbol
        ctx.fillText(symbol, i * 20, drops[i] * 20);
        
        // Move the drop down
        drops[i]++;
        
        // Reset drop position when it reaches bottom or randomly
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
      
      // Call draw again on the next frame
      requestAnimationFrame(draw);
    }
    
    // Start the animation
    draw();
  } catch (error) {
    console.error('Matrix animation error:', error);
    // Continue without animation in case of error
  }
}

// Initialize the login page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the login page functionality
  if (document.querySelector('.login-page')) {
    initLoginPage();
    initMushroomMatrix();
  }
  
  // Initialize logout button on other pages
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  
  // Protect admin pages (except login page)
  if (!document.querySelector('.login-page') && !checkAuth()) {
    // Redirect to login page if not authenticated
    window.location.href = 'login.html';
  }
  
  // Display username if available
  const usernameElement = document.getElementById('admin-username');
  if (usernameElement) {
    const username = localStorage.getItem('adminUsername');
    if (username) {
      usernameElement.textContent = username;
    }
  }
});
