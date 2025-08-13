
// Quick test to bypass authentication and test navigation
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

