/**
 * Читатель Mini App - Основное приложение
 * Главный модуль управления приложением
 */

class ReaderApp {
    constructor() {
        this.currentUser = null;
        this.currentPage = 'home';
        this.isInitialized = false;
        this.stats = {};
        this.quotes = [];
        this.reports = [];
        this.achievements = [];
        
        console.log('📱 Reader App инициализируется...');
    }
    
    /**
     * Инициализация приложения
     */
    async init() {
        try {
            console.log('🚀 Инициализация Reader App...');
            
            // Инициализация с простым подходом
            this.setupNavigation();
            this.setupForms();
            this.updateAllPages();
            
            this.isInitialized = true;
            console.log('🎉 Reader App инициализирован успешно!');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
        }
    }
    
    /**
     * Инициализация навигации - алиас для setupNavigation для совместимости
     */
    initNavigation() {
        return this.setupNavigation();
    }
    
    /**
     * Настройка навигации
     */
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                const page = item.dataset.page;
                if (page) {
                    this.showPage(page);
                }
            });
        });
    }
    
    /**
     * Показать страницу
     */
    showPage(pageId) {
        console.log('📄 Переход на страницу:', pageId);
        
        // Убираем активный класс со всех страниц и навигации
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Показываем нужную страницу
        const targetPage = document.getElementById(`page-${pageId}`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Активируем соответствующий элемент навигации
        const navItem = document.querySelector(`[data-page="${pageId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        this.currentPage = pageId;
    }
    
    /**
     * Настройка форм
     */
    setupForms() {
        // Быстрое добавление цитаты
        const quickAddForm = document.getElementById('quick-add-form');
        if (quickAddForm) {
            quickAddForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleQuickAddQuote();
            });
        }
        
        // Полная форма добавления цитаты
        const addQuoteForm = document.getElementById('add-quote-form');
        if (addQuoteForm) {
            addQuoteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddQuote();
            });
        }
    }
    
    /**
     * Быстрое добавление цитаты
     */
    async handleQuickAddQuote() {
        const textInput = document.getElementById('quick-quote-text');
        const authorInput = document.getElementById('quick-quote-author');
        
        if (!textInput || !textInput.value.trim()) {
            this.showToast('Введите текст цитаты', 'warning');
            return;
        }
        
        const quoteData = {
            text: textInput.value.trim(),
            author: authorInput ? authorInput.value.trim() : '',
            source: 'mini_app'
        };
        
        try {
            this.showToast('Сохраняем цитату...', 'info');
            
            // Используем прямой API запрос
            const response = await fetch('/api/reader/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quoteData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Очищаем форму
                textInput.value = '';
                if (authorInput) authorInput.value = '';
                
                this.showToast('Цитата сохранена! 📚', 'success');
                
                // Обновляем статистику
                this.updateStats();
                
            } else {
                throw new Error(result.message || 'Ошибка сохранения');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            this.showToast('Ошибка сохранения цитаты', 'error');
        }
    }
    
    /**
     * Добавление цитаты через полную форму
     */
    async handleAddQuote() {
        const textInput = document.getElementById('quote-text');
        const authorInput = document.getElementById('quote-author');
        const sourceInput = document.getElementById('quote-source');
        
        if (!textInput || !textInput.value.trim()) {
            this.showToast('Введите текст цитаты', 'warning');
            return;
        }
        
        const quoteData = {
            text: textInput.value.trim(),
            author: authorInput ? authorInput.value.trim() : '',
            source: sourceInput ? sourceInput.value.trim() : ''
        };
        
        try {
            this.showToast('Сохраняем цитату...', 'info');
            
            const response = await fetch('/api/reader/quotes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(quoteData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Очищаем форму
                textInput.value = '';
                if (authorInput) authorInput.value = '';
                if (sourceInput) sourceInput.value = '';
                
                this.showToast('Цитата сохранена! 📚', 'success');
                
                // Переходим на главную страницу
                this.showPage('home');
                
                // Обновляем данные
                this.updateStats();
                
            } else {
                throw new Error(result.message || 'Ошибка сохранения');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            this.showToast('Ошибка сохранения цитаты', 'error');
        }
    }
    
    /**
     * Обновление статистики
     */
    async updateStats() {
        try {
            const response = await fetch('/api/reader/quotes');
            const result = await response.json();
            
            if (result.success && result.data) {
                const totalQuotes = result.data.pagination ? result.data.pagination.totalCount : 0;
                
                // Обновляем элементы статистики
                const totalQuotesEl = document.getElementById('total-quotes');
                if (totalQuotesEl) {
                    totalQuotesEl.textContent = totalQuotes;
                }
                
                // Загружаем последние цитаты для главной страницы
                this.updateRecentQuotes(result.data.quotes || []);
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
        }
    }
    
    /**
     * Обновление списка последних цитат
     */
    updateRecentQuotes(quotes) {
        const quotesList = document.getElementById('recent-quotes-list');
        if (!quotesList) return;
        
        if (quotes && quotes.length > 0) {
            quotesList.innerHTML = quotes.slice(0, 3).map(quote => `
                <div class="quote-item">
                    <div class="quote-text">"${this.escapeHtml(quote.text)}"</div>
                    ${quote.author ? `<div class="quote-author">— ${this.escapeHtml(quote.author)}</div>` : ''}
                    <div class="quote-date">${this.formatDate(quote.createdAt)}</div>
                </div>
            `).join('');
        } else {
            quotesList.innerHTML = `
                <div class="empty-state">
                    <p>Пока нет сохраненных цитат</p>
                    <p>Добавьте первую цитату выше 👆</p>
                </div>
            `;
        }
    }
    
    /**
     * Обновление всех страниц
     */
    updateAllPages() {
        this.updateStats();
        
        // Устанавливаем mock данные для других страниц
        this.updateMockData();
    }
    
    /**
     * Mock данные для демонстрации
     */
    updateMockData() {
        // Статистика
        const weekQuotesEl = document.getElementById('week-quotes');
        const streakDaysEl = document.getElementById('streak-days');
        
        if (weekQuotesEl) weekQuotesEl.textContent = '3';
        if (streakDaysEl) streakDaysEl.textContent = '7';
        
        // Отчеты
        const reportsLists = document.querySelectorAll('.reports-list');
        reportsLists.forEach(list => {
            list.innerHTML = `
                <div class="empty-state">
                    <p>📈 Отчеты появятся после недели использования</p>
                    <p>Продолжайте добавлять цитаты!</p>
                </div>
            `;
        });
        
        // Достижения
        const achievementsGrid = document.getElementById('achievements-grid');
        if (achievementsGrid) {
            achievementsGrid.innerHTML = `
                <div class="achievement-card unlocked">
                    <div class="achievement-icon">📚</div>
                    <h3>Первая цитата</h3>
                    <p>Добавьте первую цитату в дневник</p>
                    <div class="unlocked-badge">✅ Получено</div>
                </div>
                <div class="achievement-card locked">
                    <div class="achievement-icon">🔥</div>
                    <h3>Неделя подряд</h3>
                    <p>Добавляйте цитаты 7 дней подряд</p>
                    <div class="progress">
                        <div class="progress-bar" style="width: 30%"></div>
                        <span class="progress-text">2/7</span>
                    </div>
                </div>
            `;
        }
        
        // Настройки
        const userNameEl = document.getElementById('user-name');
        const userUsernameEl = document.getElementById('user-username');
        
        if (userNameEl) userNameEl.textContent = 'Читатель';
        if (userUsernameEl) userUsernameEl.textContent = '@demo_user';
    }
    
    /**
     * Показать toast уведомление
     */
    showToast(message, type = 'info') {
        // Создаем toast элемент
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Показываем
        setTimeout(() => {
            toast.style.opacity = '1';
        }, 100);
        
        // Скрываем и удаляем
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
        
        console.log(`📢 Toast [${type}]: ${message}`);
    }
    
    /**
     * Утилиты
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            month: 'short',
            day: 'numeric'
        });
    }
}

// Делаем класс доступным глобально
window.ReaderApp = ReaderApp;
