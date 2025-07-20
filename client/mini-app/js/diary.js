/**
 * DIARY.JS - Логика дневника с цельными страницами и хронологическим порядком
 * ПЕРЕДЕЛАН: убрано разделение пополам, 5-7 цитат на страницу, точечная навигация
 * Интегрированная форма добавления, маленькие даты под цитатами
 */

class DiaryManager {
    constructor() {
        this.currentPageIndex = 0;
        this.quotes = [];
        this.quotesPerPage = 6; // 5-7 цитат на страницу
        this.isAnimating = false;
        
        // Страницы с цитатами (хронологический порядок)
        this.pages = [];
        
        this.init();
    }

    init() {
        this.loadQuotes();
        this.setupEventListeners();
    }

    // ===== ЗАГРУЗКА ДАННЫХ =====
    async loadQuotes() {
        try {
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
        
        if (!Array.isArray(this.quotes)) {
            console.warn('quotes не является массивом, создаем пустой массив');
            this.quotes = [];
            this.loadMockData();
        }
        
        this.createPages();
        this.renderCurrentPage();
    }

    loadMockData() {
        this.quotes = [
            {
                text: "В каждом слове — целая жизнь. Каждая фраза несет в себе историю, эмоции и смыслы.",
                author: "Марина Цветаева",
                date: "2025-07-15T10:30:00Z",
                createdAt: "2025-07-15T10:30:00Z"
            },
            {
                text: "Любовь — это решение любить. Это выбор, который мы делаем каждый день.",
                author: "Эрих Фромм",
                date: "2025-07-16T14:20:00Z",
                createdAt: "2025-07-16T14:20:00Z"
            },
            {
                text: "Счастье не приходит к нам готовым. Мы создаем его своими руками, своими мыслями.",
                author: "Далай-лама",
                date: "2025-07-17T09:15:00Z",
                createdAt: "2025-07-17T09:15:00Z"
            },
            {
                text: "Чтение - это окно в тысячи жизней. Книги позволяют нам прожить множество судеб.",
                author: "Джордж Мартин",
                date: "2025-07-18T16:45:00Z",
                createdAt: "2025-07-18T16:45:00Z"
            },
            {
                text: "Мудрость начинается с удивления. Способность удивляться — ключ к пониманию жизни.",
                author: "Сократ",
                date: "2025-07-19T11:00:00Z",
                createdAt: "2025-07-19T11:00:00Z"
            },
            {
                text: "Время - самый ценный ресурс. Мы можем потратить его или инвестировать.",
                author: "",
                date: "2025-07-20T13:30:00Z",
                createdAt: "2025-07-20T13:30:00Z"
            },
            {
                text: "Знание — сила, но мудрость — умение правильно её использовать.",
                author: "Конфуций",
                date: "2025-07-20T15:00:00Z",
                createdAt: "2025-07-20T15:00:00Z"
            }
        ];
    }

    // ===== СОЗДАНИЕ СТРАНИЦ (ХРОНОЛОГИЧЕСКИЙ ПОРЯДОК) =====
    createPages() {
        if (!Array.isArray(this.quotes)) {
            this.quotes = [];
        }
        
        // Сортируем цитаты по дате (от старых к новым)
        this.quotes.sort((a, b) => new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date));
        
        // Разбиваем на страницы по quotesPerPage цитат
        this.pages = [];
        for (let i = 0; i < this.quotes.length; i += this.quotesPerPage) {
            this.pages.push({
                quotes: this.quotes.slice(i, i + this.quotesPerPage),
                pageNumber: this.pages.length + 1
            });
        }
        
        // Если нет цитат, создаем пустую первую страницу
        if (this.pages.length === 0) {
            this.pages.push({
                quotes: [],
                pageNumber: 1
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
        
        // Клик по краю страницы для перелистывания
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-corner')) {
                this.nextPage();
            }
        });
        
        // Клик по точкам навигации
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-dot')) {
                const pageIndex = parseInt(e.target.dataset.page);
                if (!isNaN(pageIndex)) {
                    this.goToPage(pageIndex);
                }
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
        if (this.isAnimating || this.currentPageIndex >= this.pages.length - 1) return;
        
        await this.animatePageTurn('next');
        this.currentPageIndex++;
        this.renderCurrentPage();
    }

    async previousPage() {
        if (this.isAnimating || this.currentPageIndex <= 0) return;
        
        await this.animatePageTurn('prev');
        this.currentPageIndex--;
        this.renderCurrentPage();
    }

    async goToPage(pageIndex) {
        if (this.isAnimating || pageIndex === this.currentPageIndex || 
            pageIndex < 0 || pageIndex >= this.pages.length) return;
        
        await this.animatePageTurn(pageIndex > this.currentPageIndex ? 'next' : 'prev');
        this.currentPageIndex = pageIndex;
        this.renderCurrentPage();
    }

    // ===== АНИМАЦИИ ПЕРЕЛИСТЫВАНИЯ =====
    async animatePageTurn(direction) {
        this.isAnimating = true;
        
        const currentPage = document.querySelector('.book-page');
        if (!currentPage) {
            this.isAnimating = false;
            return;
        }
        
        // Haptic feedback для Telegram
        if (window.TelegramManager && window.TelegramManager.vibrate) {
            window.TelegramManager.vibrate('light');
        }
        
        // Анимация перелистывания
        currentPage.classList.add('turning');
        
        await this.delay(100);
        currentPage.classList.add('turned');
        
        await this.delay(800);
        currentPage.classList.remove('turning', 'turned');
        
        this.isAnimating = false;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== ОТРИСОВКА СТРАНИЦЫ =====
    renderCurrentPage() {
        this.renderPage();
        this.updateNavigation();
    }

    renderPage() {
        const pageContent = document.getElementById('page-content');
        if (!pageContent) return;
        
        const currentPage = this.pages[this.currentPageIndex];
        if (!currentPage) return;
        
        const isLastPage = this.currentPageIndex === this.pages.length - 1;
        
        pageContent.innerHTML = `
            <div class="quotes-container">
                ${currentPage.quotes.length > 0 ? this.renderQuotes(currentPage.quotes) : this.renderEmptyPage()}
            </div>
            ${isLastPage ? this.renderAddQuoteForm() : ''}
        `;
    }

    renderQuotes(quotes) {
        return quotes.map((quote, index) => `
            <div class="quote-entry" data-quote-index="${index}">
                <div class="quote-text">${this.escapeHtml(quote.text)}</div>
                <div class="quote-author">${quote.author || 'Собственная мысль'}</div>
                <div class="quote-date">${this.formatQuoteDate(quote.createdAt || quote.date)}</div>
            </div>
        `).join('');
    }

    renderEmptyPage() {
        return `
            <div class="empty-page">
                <div class="empty-page-icon">📝</div>
                <p>Здесь будут ваши цитаты...</p>
            </div>
        `;
    }

    renderAddQuoteForm() {
        return `
            <div class="add-quote-section">
                <h3 class="add-quote-title">✍️ Добавить новую цитату</h3>
                <form id="diary-quote-form">
                    <div class="diary-form-group">
                        <label for="diary-quote-text">Текст цитаты:</label>
                        <textarea 
                            id="diary-quote-text" 
                            name="quote-text" 
                            placeholder="Введите цитату или мудрую мысль..."
                            required
                        ></textarea>
                    </div>
                    <div class="diary-form-group">
                        <label for="diary-quote-author">Автор (необязательно):</label>
                        <input 
                            type="text" 
                            id="diary-quote-author" 
                            name="quote-author" 
                            placeholder="Имя автора"
                        />
                    </div>
                    <button type="submit" class="diary-submit-btn">
                        ✍️ Добавить в дневник
                    </button>
                </form>
            </div>
        `;
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
            this.createPages();
            
            // Переходим на последнюю страницу
            this.currentPageIndex = this.pages.length - 1;
            this.renderCurrentPage();
            
            // Анимируем появление новой цитаты
            setTimeout(() => {
                const quoteElements = document.querySelectorAll('.quote-entry');
                const lastQuoteElement = quoteElements[quoteElements.length - 1];
                
                if (lastQuoteElement) {
                    lastQuoteElement.classList.add('new');
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
        const totalQuotesElement = document.getElementById('total-quotes');
        const weekQuotesElement = document.getElementById('week-quotes');
        const recentQuotesElement = document.getElementById('recent-quotes-list');
        
        if (totalQuotesElement) {
            totalQuotesElement.textContent = this.quotes.length;
        }
        
        if (weekQuotesElement) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekQuotes = this.quotes.filter(quote => 
                new Date(quote.createdAt || quote.date) >= weekAgo
            );
            weekQuotesElement.textContent = weekQuotes.length;
        }
        
        if (recentQuotesElement) {
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
        this.updateButtons();
        this.updatePageIndicator();
        this.updatePageDots();
    }

    updateButtons() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPageIndex === 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPageIndex >= this.pages.length - 1;
        }
    }

    updatePageIndicator() {
        const indicator = document.getElementById('page-indicator');
        if (indicator) {
            indicator.textContent = `Страница ${this.currentPageIndex + 1} из ${this.pages.length}`;
        }
    }

    updatePageDots() {
        let dotsContainer = document.querySelector('.page-dots');
        
        // Создаем контейнер для точек если его нет
        if (!dotsContainer) {
            const navigation = document.querySelector('.page-navigation');
            if (navigation) {
                dotsContainer = document.createElement('div');
                dotsContainer.className = 'page-dots';
                navigation.appendChild(dotsContainer);
            }
        }
        
        if (!dotsContainer) return;
        
        // Ограничиваем количество точек (максимум 10)
        const maxDots = 10;
        const totalPages = this.pages.length;
        const showDots = Math.min(totalPages, maxDots);
        
        let dotsHTML = '';
        
        if (totalPages <= maxDots) {
            // Показываем все точки
            for (let i = 0; i < totalPages; i++) {
                const isActive = i === this.currentPageIndex;
                dotsHTML += `<div class="page-dot ${isActive ? 'active' : ''}" data-page="${i}"></div>`;
            }
        } else {
            // Показываем сокращенный вариант с "..."
            const current = this.currentPageIndex;
            const start = Math.max(0, current - 3);
            const end = Math.min(totalPages - 1, current + 3);
            
            for (let i = start; i <= end; i++) {
                const isActive = i === this.currentPageIndex;
                dotsHTML += `<div class="page-dot ${isActive ? 'active' : ''}" data-page="${i}"></div>`;
            }
        }
        
        dotsContainer.innerHTML = dotsHTML;
    }

    // ===== УТИЛИТЫ =====
    formatQuoteDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        if (window.app && window.app.showToast) {
            window.app.showToast(message, type);
        } else {
            console.log(`Toast (${type}): ${message}`);
            
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
        this.createPages();
        this.currentPageIndex = this.pages.length - 1;
        this.renderCurrentPage();
        this.updateMainPageStats();
    }
    
    getStats() {
        return {
            totalQuotes: this.quotes.length,
            totalPages: this.pages.length,
            currentPage: this.currentPageIndex + 1,
            quotesPerPage: this.quotesPerPage,
            lastQuoteDate: this.quotes.length > 0 ? this.quotes[this.quotes.length - 1].createdAt : null
        };
    }
    
    exportQuotes() {
        return {
            quotes: this.quotes,
            pages: this.pages,
            exportDate: new Date().toISOString()
        };
    }
}

// ===== ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ =====
window.DiaryManager = DiaryManager;

// Автоинициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('page-diary')) {
        window.diaryManager = new DiaryManager();
    }
});