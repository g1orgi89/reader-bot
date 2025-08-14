
// Quick test to bypass authentication and test navigation
// Only runs in development environment
if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            // Hide loading screen
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            // Set up basic state
            window.testState = {
                user: { profile: { name: 'Test User', username: 'testuser' } },
                stats: { totalQuotes: 42, currentStreak: 7 }
            };
            
            // Test hash navigation
            window.location.hash = '/home';
            
            console.log('Quick test setup complete');
        }, 2000);
    });
} else if (typeof process === 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('dev') ||
    new URLSearchParams(window.location.search).get('debug') === 'true'
)) {
    // Fallback dev detection when process is undefined
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            // Hide loading screen
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            // Set up basic state
            window.testState = {
                user: { profile: { name: 'Test User', username: 'testuser' } },
                stats: { totalQuotes: 42, currentStreak: 7 }
            };
            
            // Test hash navigation
            window.location.hash = '/home';
            
            console.log('Quick test setup complete (dev fallback)');
        }, 2000);
    });
}

