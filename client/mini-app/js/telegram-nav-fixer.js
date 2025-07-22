// ПРОСТОЙ ФИКСЕР + ПРИНУДИТЕЛЬНАЯ ФИКСАЦИЯ ПРИ ПЕРЕКЛЮЧЕНИИ СТРАНИЦ

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
        nav.style.width = '100%';
        nav.style.maxWidth = 'none';
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
    
    // НОВОЕ: Принудительная фиксация при скролле
    window.addEventListener('scroll', () => {
        simpleNavFix();
    }, { passive: true });
    
    // НОВОЕ: Хук на переключение страниц
    const originalShowPage = window.showPage;
    window.showPage = function(pageId) {
        // Вызываем оригинальную функцию
        if (originalShowPage) {
            originalShowPage.call(this, pageId);
        }
        
        // Принудительно фиксим навигацию СРАЗУ после переключения
        setTimeout(() => {
            console.log('🔧 Фиксация навигации после переключения на:', pageId);
            simpleNavFix();
        }, 10);
        
        // Еще раз через 100мс на случай анимаций
        setTimeout(() => {
            simpleNavFix();
        }, 100);
        
        // И еще раз через 500мс для страниц с формами
        if (pageId === 'add' || pageId === 'reports') {
            setTimeout(() => {
                console.log('🔧 Дополнительная фиксация для страницы с формами:', pageId);
                simpleNavFix();
            }, 500);
        }
    };
    
    // НОВОЕ: Фиксация при фокусе на input/textarea (проблема с клавиатурой)
    document.addEventListener('focusin', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            console.log('⌨️ Поле ввода получило фокус, фиксим навигацию');
            
            // Сразу
            simpleNavFix();
            
            // Через 200мс когда клавиатура появится
            setTimeout(simpleNavFix, 200);
            
            // Через 500мс для надежности
            setTimeout(simpleNavFix, 500);
        }
    });
    
    // НОВОЕ: Фиксация при потере фокуса (клавиатура скрывается)
    document.addEventListener('focusout', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            console.log('⌨️ Поле ввода потеряло фокус, фиксим навигацию');
            
            // Через 100мс когда клавиатура скроется
            setTimeout(simpleNavFix, 100);
            
            // Через 300мс для полного восстановления viewport
            setTimeout(simpleNavFix, 300);
        }
    });
    
    // НОВОЕ: Фиксация при изменении размера окна (Telegram меняет viewport)
    window.addEventListener('resize', () => {
        console.log('📐 Изменение размера окна, фиксим навигацию');
        
        // Сразу
        simpleNavFix();
        
        // Через 100мс
        setTimeout(simpleNavFix, 100);
    });
}

// НОВОЕ: Экспортируем функцию для ручного вызова
window.forceNavFix = simpleNavFix;