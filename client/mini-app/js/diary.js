/**
 * DIARY.JS - Логика дневника цитат с перелистыванием страниц
 * Реалистичная анимация перелистывания через уголок страницы
 * ИСПРАВЛЕНА: ошибка с this.quotes.sort и добавление анимации написания
 */

class DiaryManager {
    constructor() {
        this.currentPageIndex = 0;
        this.quotes = []; // Убеждаемся что это массив
        this.quotesPerPage = 3; // Максимум цитат на одной странице
        this.isAnimating = false;
        
        // Группировка цитат по неделям
        this.weeklyPages = [];
        
        this.init();
    }

    init() {
        this.loadQuotes();
        this.setupEventListeners();
        // Отрисовка будет вызвана после загрузки данных
    }

    // ===== ЗАГРУЗКА ДАННЫХ =====
    async loadQuotes() {
        try {
            // Инициализируем как пустой массив
            this.quotes = [];
            
            // Пытаемся загрузить данные из API
            if (window.apiManager) {
                const response = await window.apiManager.getQuotes();
                if (response && response.success && Array.isArray(response.data)) {
                    this.quotes = response.data;
                } else {
                    console.log('API не вернул массив, загружаем демо-данные');
                    this.loadMockData();
                }
            } else {
                console.log('API Manager недоступен, загружаем демо-данные');
                this.loadMockData();
            }
        } catch (error) {
            console.log('Ошибка загрузки данных, используем демо-данные:', error);
            this.loadMockData();
        }
        
        // Убеждаемся что quotes это массив
        if (!Array.isArray(this.quotes)) {
            console.warn('quotes не является массивом, создаем пустой массив');
            this.quotes = [];
            this.loadMockData();
        }
        
        this.groupQuotesByWeeks();
        this.renderCurrentPage();
    }

    loadMockData() {
        this.quotes = [
            {
                text: "В каждом слове — целая жизнь. Каждая фраза несет в себе историю, эмоции и смыслы, которые могут изменить наш взгляд на мир.",
                author: "Марина Цветаева",
                date: "2025-07-15T10:30:00Z",
                createdAt: "2025-07-15T10:30:00Z"
            },
            {
                text: "Любовь — это решение любить. Это выбор, который мы делаем каждый день, а не просто чувство, которое приходит и уходит.",
                author: "Эрих Фромм",
                date: "2025-07-16T14:20:00Z",
                createdAt: "2025-07-16T14:20:00Z"
            },
            {
                text: "Счастье не приходит к нам готовым. Мы создаем его своими руками, своими мыслями и поступками каждый день.",
                author: "Далай-лама",
                date: "2025-07-17T09:15:00Z",
                createdAt: "2025-07-17T09:15:00Z"
            },
            {
                text: "Чтение - это окно в тысячи жизней. Книги позволяют нам прожить множество судеб и обогатить свою собственную.",
                author: "Джордж Мартин",
                date: "2025-07-18T16:45:00Z",
                createdAt: "2025-07-18T16:45:00Z"
            },
            {
                text: "Мудрость начинается с удивления. Способность удивляться простым вещам - ключ к глубокому пониманию жизни.",
                author: "Сократ",
                date: "2025-07-19T11:00:00Z",
                createdAt: "2025-07-19T11:00:00Z"
            },
            {
                text: "Время - самый ценный ресурс. Мы можем потратить его или инвестировать, но никогда не сможем вернуть обратно.",
                author: "",
                date: "2025-07-20T13:30:00Z",
                createdAt: "2025-07-20T13:30:00Z"
            }
        ];
    }

    // ===== ГРУППИРОВКА ПО НЕДЕЛЯМ =====
    groupQuotesByWeeks() {
        // Проверяем что quotes это массив
        if (!Array.isArray(this.quotes)) {
            console.error('quotes не является массивом:', this.quotes);
            this.quotes = [];
        }
        
        // Сортируем цитаты по дате
        this.quotes.sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
        
        // Группируем по неделям
        this.weeklyPages = [];
        let currentWeek = [];
        let weekNumber = 1;
        
        this.quotes.forEach((quote, index) => {
            currentWeek.push(quote);
            
            // Если достигли лимита цитат на странице или это последняя цитата
            if (currentWeek.length >= this.quotesPerPage || index === this.quotes.length - 1) {
                this.weeklyPages.push({
                    weekNumber: weekNumber,
                    quotes: [...currentWeek],
                    startDate: currentWeek[0].createdAt || currentWeek[0].date,
                    endDate: currentWeek[currentWeek.length - 1].createdAt || currentWeek[currentWeek.length - 1].date
                });
                currentWeek = [];
                weekNumber++;
            }
        });
        
        // Если нет цитат, создаем пустую первую страницу
        if (this.weeklyPages.length === 0) {
            this.weeklyPages.push({
                weekNumber: 1,
                quotes: [],
                startDate: new Date().toISOString(),
                endDate: new Date().toISOString()
            });
        }
    }

    // ===== СОБЫТИЯ =====
    setupEventListeners() {
        // Кнопки навигации
        document.getElementById('prev-page')?.addEventListener('click', () => this.previousPage());
        document.getElementById('next-page')?.addEventListener('click', () => this.nextPage());
        
        // Форма добавления цитаты
        document.getElementById('diary-quote-form')?.addEventListener('submit', (e) => this.handleQuoteSubmit(e));
        
        // Клик по уголку страницы для перелистывания
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-corner')) {
                this.nextPage();
            }
        });
        
        // Свайп жесты для мобильных устройств
        this.setupSwipeGestures();
    }

    setupSwipeGestures() {
        let startX = 0;
        let startY = 0;
        
        const bookContainer = document.querySelector('.book-container');
        if (!bookContainer) return;
        
        bookContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        bookContainer.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = startX - endX;
            const diffY = startY - endY;
            
            // Проверяем, что это горизонтальный свайп
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Свайп влево - следующая страница
                    this.nextPage();
                } else {
                    // Свайп вправо - предыдущая страница  
                    this.previousPage();
                }
            }
            
            startX = 0;
            startY = 0;
        });
    }

    // ===== НАВИГАЦИЯ СТРАНИЦ =====
    async nextPage() {
        if (this.isAnimating) return;
        
        if (this.currentPageIndex < this.weeklyPages.length - 1) {
            await this.animatePageTurn('next');
            this.currentPageIndex++;
            this.renderCurrentPage();
            this.updateNavigation();
        }
    }

    async previousPage() {
        if (this.isAnimating) return;
        
        if (this.currentPageIndex > 0) {
            await this.animatePageTurn('prev');
            this.currentPageIndex--;
            this.renderCurrentPage();
            this.updateNavigation();
        }
    }

    // ===== АНИМАЦИИ ПЕРЕЛИСТЫВАНИЯ =====
    async animatePageTurn(direction) {
        this.isAnimating = true;
        
        const leftPage = document.querySelector('.book-page.left');
        const rightPage = document.querySelector('.book-page.right');
        
        if (!leftPage || !rightPage) {
            this.isAnimating = false;
            return;
        }
        
        // Haptic feedback для Telegram
        if (window.TelegramManager && window.TelegramManager.vibrate) {
            window.TelegramManager.vibrate('light');
        }
        
        if (direction === 'next') {
            // Анимация перелистывания вперед
            rightPage.classList.add('turning');
            
            await this.delay(100);
            rightPage.classList.add('turned');
            
            await this.delay(800);
            rightPage.classList.remove('turning', 'turned');
        } else {
            // Анимация перелистывания назад
            leftPage.classList.add('turning');
            
            await this.delay(100);
            leftPage.style.transform = 'rotateY(0deg)';
            
            await this.delay(800);
            leftPage.classList.remove('turning');
            leftPage.style.transform = '';
        }
        
        this.isAnimating = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== ОТРИСОВКА СТРАНИЦ =====
    renderCurrentPage() {
        this.renderLeftPage();
        this.renderRightPage();
        this.updateNavigation();
    }

    renderLeftPage() {
        const leftPage = document.getElementById('left-page-content');
        if (!leftPage) return;
        
        const currentPage = this.weeklyPages[this.currentPageIndex];
        if (!currentPage) return;
        
        leftPage.innerHTML = `
            <div class="page-header">
                <div class="page-date">${this.formatPageDate(currentPage.startDate)}</div>
                <div class="page-week">Неделя ${currentPage.weekNumber}</div>
            </div>
            <div class="quotes-container">
                ${this.renderQuotes(currentPage.quotes.slice(0, Math.ceil(currentPage.quotes.length / 2)))}
            </div>
        `;
    }

    renderRightPage() {
        const rightPage = document.getElementById('right-page-content');
        if (!rightPage) return;
        
        const currentPage = this.weeklyPages[this.currentPageIndex];
        if (!currentPage) return;
        
        const rightQuotes = currentPage.quotes.slice(Math.ceil(currentPage.quotes.length / 2));
        
        rightPage.innerHTML = `
            <div class="page-header">
                <div class="page-date">${this.formatPageDate(currentPage.endDate)}</div>
                <div class="page-week">Продолжение недели ${currentPage.weekNumber}</div>
            </div>
            <div class="quotes-container">
                ${rightQuotes.length > 0 ? this.renderQuotes(rightQuotes) : '<div class="empty-page"><div class="empty-page-icon">✍️</div><p>Место для новых цитат...</p></div>'}
            </div>
            <div class="page-corner"></div>
        `;
    }

    renderQuotes(quotes) {
        if (!quotes || quotes.length === 0) {
            return '<div class="empty-page"><div class="empty-page-icon">📝</div><p>Пока нет цитат на этой странице</p></div>';
        }
        
        return quotes.map((quote, index) => `
            <div class="quote-entry" data-quote-index="${index}">
                <div class="quote-text">${this.escapeHtml(quote.text)}</div>
                <div class="quote-author">${quote.author || 'Собственная мысль'}</div>
                <div class="quote-date">${this.formatQuoteDate(quote.createdAt || quote.date)}</div>
            </div>
        `).join('');
    }

    // ===== АНИМАЦИЯ НАПИСАНИЯ ЦИТАТЫ =====
    async animateQuoteWriting(quoteElement, text) {
        const quoteTextElement = quoteElement.querySelector('.quote-text');
        if (!quoteTextElement) return;
        
        // Очищаем текст
        quoteTextElement.innerHTML = '"';
        
        // Анимация печатания
        for (let i = 0; i < text.length; i++) {
            await this.delay(50); // Задержка между символами
            quoteTextElement.innerHTML = '"' + text.substring(0, i + 1);
        }
        
        // Добавляем закрывающую кавычку
        quoteTextElement.innerHTML = '"' + text + '"';
        
        // Показываем автора с анимацией
        const authorElement = quoteElement.querySelector('.quote-author');
        const dateElement = quoteElement.querySelector('.quote-date');
        
        if (authorElement) {
            authorElement.style.opacity = '0';
            setTimeout(() => {
                authorElement.style.transition = 'opacity 0.5s ease';
                authorElement.style.opacity = '1';
            }, 200);
        }
        
        if (dateElement) {
            dateElement.style.opacity = '0';
            setTimeout(() => {
                dateElement.style.transition = 'opacity 0.5s ease';
                dateElement.style.opacity = '1';
            }, 400);
        }
    }

    // ===== ДОБАВЛЕНИЕ ЦИТАТЫ =====
    async handleQuoteSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const quoteText = formData.get('quote-text')?.trim();
        const quoteAuthor = formData.get('quote-author')?.trim();
        
        if (!quoteText) {
            this.showToast('Пожалуйста, введите текст цитаты', 'error');
            return;
        }
        
        const newQuote = {
            text: quoteText,
            author: quoteAuthor || '',
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        try {
            // Убеждаемся что quotes это массив
            if (!Array.isArray(this.quotes)) {
                this.quotes = [];
            }
            
            // Пытаемся сохранить через API
            if (window.apiManager) {
                try {
                    const response = await window.apiManager.addQuote(newQuote);
                    if (!response || !response.success) {
                        console.log('API вернул ошибку, сохраняем локально');
                    }
                } catch (apiError) {
                    console.log('API недоступен, сохраняем локально:', apiError);
                }
            }
            
            // Добавляем цитату локально
            this.quotes.push(newQuote);
            this.groupQuotesByWeeks();
            
            // Переходим на последнюю страницу
            this.currentPageIndex = this.weeklyPages.length - 1;
            this.renderCurrentPage();
            
            // Находим последнюю добавленную цитату и анимируем её
            setTimeout(async () => {
                const quoteElements = document.querySelectorAll('.quote-entry');
                const lastQuoteElement = quoteElements[quoteElements.length - 1];
                
                if (lastQuoteElement) {
                    lastQuoteElement.classList.add('new');
                    
                    // Анимация написания
                    await this.animateQuoteWriting(lastQuoteElement, quoteText);
                }
            }, 100);
            
            // Обновляем статистику на главной странице
            this.updateMainPageStats();
            
            // Очищаем форму
            e.target.reset();
            
            // Haptic feedback
            if (window.TelegramManager && window.TelegramManager.vibrate) {
                window.TelegramManager.vibrate('medium');
            }
            
            this.showToast('Цитата добавлена в дневник! ✨', 'success');
            
        } catch (error) {
            console.error('Ошибка при добавлении цитаты:', error);
            this.showToast('Ошибка при сохранении цитаты', 'error');
        }
    }

    // ===== ОБНОВЛЕНИЕ СТАТИСТИКИ НА ГЛАВНОЙ =====
    updateMainPageStats() {
        // Обновляем счетчики на главной странице
        const totalQuotesElement = document.getElementById('total-quotes');
        const weekQuotesElement = document.getElementById('week-quotes');
        const recentQuotesElement = document.getElementById('recent-quotes-list');
        
        if (totalQuotesElement) {
            totalQuotesElement.textContent = this.quotes.length;
        }
        
        if (weekQuotesElement) {
            // Считаем цитаты за последнюю неделю
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekQuotes = this.quotes.filter(quote => 
                new Date(quote.createdAt || quote.date) >= weekAgo
            );
            weekQuotesElement.textContent = weekQuotes.length;
        }
        
        if (recentQuotesElement) {
            // Показываем последние 3 цитаты
            const recentQuotes = this.quotes.slice(-3).reverse();
            recentQuotesElement.innerHTML = recentQuotes.map(quote => `
                <div class="quote-item">
                    <div class="quote-text">${this.escapeHtml(quote.text)}</div>
                    <div class="quote-author">${quote.author || 'Собственная мысль'}</div>
                </div>
            `).join('');
        }
    }

    // ===== НАВИГАЦИЯ И UI =====
    updateNavigation() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const indicator = document.getElementById('page-indicator');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPageIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPageIndex >= this.weeklyPages.length - 1;
        }
        
        if (indicator) {
            indicator.textContent = `Страница ${this.currentPageIndex + 1} из ${this.weeklyPages.length}`;
        }
    }

    // ===== УТИЛИТЫ =====
    formatPageDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    formatQuoteDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        // Используем существующую систему toast уведомлений
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        } else {
            // Fallback для отладки
            console.log(`Toast (${type}): ${message}`);
            
            // Простое уведомление
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    }

    // ===== ПУБЛИЧНЫЕ МЕТОДЫ =====
    
    // Добавить цитату программно
    addQuote(text, author = '') {
        const newQuote = {
            text,
            author,
            date: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };
        
        if (!Array.isArray(this.quotes)) {
            this.quotes = [];
        }
        
        this.quotes.push(newQuote);
        this.groupQuotesByWeeks();
        this.currentPageIndex = this.weeklyPages.length - 1;
        this.renderCurrentPage();
        this.updateMainPageStats();
    }
    
    // Получить статистику
    getStats() {
        return {
            totalQuotes: this.quotes.length,
            totalPages: this.weeklyPages.length,
            currentPage: this.currentPageIndex + 1,
            lastQuoteDate: this.quotes.length > 0 ? this.quotes[this.quotes.length - 1].createdAt : null
        };
    }
    
    // Экспорт данных
    exportQuotes() {
        return {
            quotes: this.quotes,
            weeklyPages: this.weeklyPages,
            exportDate: new Date().toISOString()
        };
    }
}

// ===== ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ =====
window.DiaryManager = DiaryManager;

// Автоинициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем дневник только если мы на странице дневника
    if (document.getElementById('page-diary')) {
        window.diaryManager = new DiaryManager();
    }
});
