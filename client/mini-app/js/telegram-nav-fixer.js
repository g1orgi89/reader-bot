// ПРОСТОЙ ФИКСЕР БЕЗ ХУЙНИ

function simpleNavFix() {
    const nav = document.querySelector('.bottom-nav');
    if (nav) {
        nav.style.position = 'fixed';
        nav.style.bottom = '0';
        nav.style.left = '0';
        nav.style.right = '0';
        nav.style.zIndex = '99999';
        nav.style.transform = 'none';
        nav.style.margin = '0';
    }
}

// Определяем Telegram
if (window.Telegram?.WebApp || navigator.userAgent.includes('Telegram')) {
    document.body.classList.add('telegram-mini-app');
    
    // Фиксим каждые 100мс
    setInterval(simpleNavFix, 100);
    
    // Фиксим при готовности
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', simpleNavFix);
    } else {
        simpleNavFix();
    }
    
    // Фиксим при скролле
    window.addEventListener('scroll', simpleNavFix, { passive: true });
}