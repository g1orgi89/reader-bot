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
        
        // Ждем готовности Telegram
        if (window.telegramManager) {
            this.initApp();
        } else {
            window.addEventListener('telegram:ready', () => {
                this.initApp();
            });
        }
    }
    
    /**
     * Инициализация приложения
     */
    async initApp() {
        try {
            console.log('🚀 Инициализация Reader App...');
            
            // Показываем loading
            this.showLoading(true);
            
            // Получаем данные пользователя из Telegram
            const user = window.telegramManager.getUser();
            const initData = window.telegramManager.getInitData();
            
            console.log('👤 Пользователь Telegram:', user);
            
            // Аутентификация через API
            const authResult = await window.apiManager.authenticateWithTelegram(initData, user);
            
            if (authResult.success) {
                this.currentUser = authResult.user;
                console.log('✅ Аутентификация успешна:', this.currentUser);
                
                // Загружаем данные пользователя
                await this.loadUserData();
                
                // Настраиваем интерфейс
                this.setupUI();
                
                // Показываем главное приложение
                this.showMainApp();
                
                this.isInitialized = true;
                console.log('🎉 Reader App инициализирован успешно!');
                
            } else {
                throw new Error('Ошибка аутентификации');
            }
            
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Ошибка запуска приложения. Попробуйте перезагрузить.');
        } finally {
            this.showLoading(false);
        }
    }
    
    /**
     * Загрузка данных пользователя
     */
    async loadUserData() {
        try {
            console.log('📊 Загрузка данных пользователя...');
            
            // Загружаем статистику
            const statsResponse = await window.apiManager.getStats();
            if (statsResponse.success) {
                this.stats = statsResponse.data;
            }
            
            // Загружаем последние цитаты
            const quotesResponse = await window.apiManager.getQuotes({ limit: 5, sort: 'newest' });
            if (quotesResponse.success) {
                this.quotes = quotesResponse.data;
            }
            
            // Загружаем отчеты
            const reportsResponse = await window.apiManager.getReports();
            if (reportsResponse.success) {
                this.reports = reportsResponse.data;
            }
            
            // Загружаем достижения
            const achievementsResponse = await window.apiManager.getAchievements();
            if (achievementsResponse.success) {
                this.achievements = achievementsResponse.data;
            }
            
            console.log('✅ Данные пользователя загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
        }
    }
    
    /**
     * Настройка пользовательского интерфейса
     */
    setupUI() {
        console.log('🎨 Настройка интерфейса...');
        
        // Отображаем информацию о пользователе
        this.updateUserInfo();
        
        // Настраиваем навигацию
        this.setupNavigation();
        
        // Настраиваем обработчики форм
        this.setupForms();
        
        // Отображаем данные на страницах
        this.updateAllPages();
        
        // Настраиваем Telegram кнопки
        this.setupTelegramButtons();
    }
    
    /**
     * Обновление информации о пользователе в интерфейсе
     */
    updateUserInfo() {
        const userInfoElement = document.getElementById('user-info');
        if (userInfoElement && this.currentUser) {
            const userName = this.currentUser.name || 
                           `${this.currentUser.first_name || ''} ${this.currentUser.last_name || ''}`.trim() ||
                           this.currentUser.username ||
                           'Читатель';
                           
            userInfoElement.innerHTML = `
                <span class="user-name">${this.escapeHtml(userName)}</span>
            `;
        }
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
                    this.navigateToPage(page);
                    
                    // Haptic feedback
                    window.telegramManager.hapticFeedback('selection');
                }
            });
        });
    }
    
    /**
     * Навигация между страницами
     */
    navigateToPage(pageId) {
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
        
        // Обновляем содержимое страницы при переходе
        this.updatePage(pageId);
    }
    
    /**
     * Настройка форм
     */
    setupForms() {
        // Быстрое добавление цитаты на главной странице
        const quickAddBtn = document.getElementById('quick-add-btn');
        if (quickAddBtn) {
            quickAddBtn.addEventListener('click', () => {
                this.handleQuickAddQuote();
            });
        }
        
        // Форма добавления цитаты
        const quoteForm = document.getElementById('quote-form');
        if (quoteForm) {
            quoteForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddQuote();
            });
        }
        
        // Кнопка анализа цитаты
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.handleAnalyzeQuote();
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
            author: authorInput.value.trim() || '',
            source: 'mini_app'
        };
        
        try {
            this.showToast('Сохраняем цитату...', 'info');
            
            const response = await window.apiManager.addQuote(quoteData);
            
            if (response.success) {
                // Очищаем форму
                textInput.value = '';
                authorInput.value = '';
                
                // Обновляем данные
                await this.loadUserData();
                this.updateAllPages();
                
                this.showToast('Цитата сохранена! 📚', 'success');
                
                // Haptic feedback
                window.telegramManager.hapticFeedback('success');
                
            } else {
                throw new Error(response.message || 'Ошибка сохранения');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            this.showToast('Ошибка сохранения цитаты', 'error');
            
            // Haptic feedback
            window.telegramManager.hapticFeedback('error');
        }
    }
    
    /**
     * Добавление цитаты через полную форму
     */
    async handleAddQuote() {
        const textInput = document.getElementById('quote-text');
        const authorInput = document.getElementById('quote-author');
        const sourceInput = document.getElementById('quote-book');
        
        if (!textInput || !textInput.value.trim()) {
            this.showToast('Введите текст цитаты', 'warning');
            return;
        }
        
        const quoteData = {
            text: textInput.value.trim(),
            author: authorInput.value.trim() || '',
            source: sourceInput.value.trim() || '',
            fromApp: 'mini_app'
        };
        
        try {
            this.showToast('Сохраняем цитату...', 'info');
            
            const response = await window.apiManager.addQuote(quoteData);
            
            if (response.success) {
                // Очищаем форму
                textInput.value = '';
                authorInput.value = '';
                sourceInput.value = '';
                
                // Скрываем анализ
                const analysisBlock = document.getElementById('ai-analysis');
                if (analysisBlock) {
                    analysisBlock.style.display = 'none';
                }
                
                // Обновляем данные
                await this.loadUserData();
                this.updateAllPages();
                
                this.showToast('Цитата сохранена! 📚', 'success');
                
                // Переходим на главную страницу
                this.navigateToPage('home');
                
                // Haptic feedback
                window.telegramManager.hapticFeedback('success');
                
            } else {
                throw new Error(response.message || 'Ошибка сохранения');
            }
            
        } catch (error) {
            console.error('❌ Ошибка добавления цитаты:', error);
            this.showToast('Ошибка сохранения цитаты', 'error');
            
            // Haptic feedback
            window.telegramManager.hapticFeedback('error');
        }
    }
    
    /**
     * Анализ цитаты через AI
     */
    async handleAnalyzeQuote() {
        const textInput = document.getElementById('quote-text');
        const authorInput = document.getElementById('quote-author');
        
        if (!textInput || !textInput.value.trim()) {
            this.showToast('Введите текст цитаты для анализа', 'warning');
            return;
        }
        
        try {
            this.showToast('Анализируем цитату...', 'info');
            
            const response = await window.apiManager.analyzeQuote(
                textInput.value.trim(),
                authorInput.value.trim()
            );
            
            if (response.success && response.data) {
                const analysisBlock = document.getElementById('ai-analysis');
                const analysisContent = document.getElementById('analysis-content');
                
                if (analysisBlock && analysisContent) {
                    analysisContent.innerHTML = this.formatAnalysis(response.data);
                    analysisBlock.style.display = 'block';
                    analysisBlock.scrollIntoView({ behavior: 'smooth' });
                }
                
                this.showToast('Анализ готов! 🤖', 'success');
                
            } else {
                throw new Error(response.message || 'Ошибка анализа');
            }
            
        } catch (error) {
            console.error('❌ Ошибка анализа цитаты:', error);
            this.showToast('Ошибка анализа цитаты', 'error');
        }
    }
    
    /**
     * Форматирование результата анализа
     */
    formatAnalysis(analysis) {
        let html = '';
        
        if (analysis.category) {
            html += `<p><strong>Категория:</strong> ${this.escapeHtml(analysis.category)}</p>`;
        }
        
        if (analysis.mood) {
            html += `<p><strong>Настроение:</strong> ${this.escapeHtml(analysis.mood)}</p>`;
        }
        
        if (analysis.themes && analysis.themes.length > 0) {
            html += `<p><strong>Темы:</strong> ${analysis.themes.map(theme => this.escapeHtml(theme)).join(', ')}</p>`;
        }
        
        if (analysis.explanation) {
            html += `<p><strong>Объяснение:</strong> ${this.escapeHtml(analysis.explanation)}</p>`;
        }
        
        return html || '<p>Анализ выполнен</p>';
    }
    
    /**
     * Обновление всех страниц
     */
    updateAllPages() {
        this.updateHomePage();
        this.updateReportsPage();
        this.updateAchievementsPage();
        this.updateSettingsPage();
    }
    
    /**
     * Обновление главной страницы
     */
    updateHomePage() {
        // Обновляем статистику
        if (this.stats) {
            this.updateElement('total-quotes', this.stats.totalQuotes || 0);
            this.updateElement('week-quotes', this.stats.weekQuotes || 0);
            this.updateElement('current-streak', this.stats.currentStreak || 0);
        }
        
        // Обновляем список последних цитат
        this.updateRecentQuotes();
    }
    
    /**
     * Обновление списка последних цитат
     */
    updateRecentQuotes() {
        const quotesList = document.getElementById('recent-quotes-list');
        if (!quotesList) return;
        
        if (this.quotes && this.quotes.length > 0) {
            quotesList.innerHTML = this.quotes.map(quote => `
                <div class="quote-item fade-in">
                    <div class="quote-text">"${this.escapeHtml(quote.text)}"</div>
                    ${quote.author ? `<div class="quote-author">— ${this.escapeHtml(quote.author)}</div>` : ''}
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
     * Обновление страницы отчетов
     */
    updateReportsPage() {
        const reportsList = document.getElementById('reports-list');
        if (!reportsList) return;
        
        if (this.reports && this.reports.length > 0) {
            reportsList.innerHTML = this.reports.map(report => `
                <div class="card fade-in">
                    <h3>📊 ${report.type === 'weekly' ? 'Еженедельный' : 'Месячный'} отчет</h3>
                    <p class="text-secondary">${this.formatDate(report.createdAt)}</p>
                    <p>${this.escapeHtml(report.analysis)}</p>
                    ${report.recommendations && report.recommendations.length > 0 ? `
                        <div class="recommendations">
                            <h4>📚 Рекомендации:</h4>
                            ${report.recommendations.map(book => `
                                <div class="recommendation">
                                    <strong>${this.escapeHtml(book.title)}</strong>
                                    ${book.author ? ` — ${this.escapeHtml(book.author)}` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } else {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <p>📈 Отчеты появятся после недели использования</p>
                    <p>Продолжайте добавлять цитаты!</p>
                </div>
            `;
        }
    }
    
    /**
     * Обновление страницы достижений
     */
    updateAchievementsPage() {
        const achievementsGrid = document.getElementById('achievements-grid');
        if (!achievementsGrid) return;
        
        if (this.achievements && this.achievements.length > 0) {
            achievementsGrid.innerHTML = this.achievements.map(achievement => `
                <div class="achievement-card ${achievement.isUnlocked ? 'unlocked' : 'locked'} fade-in">
                    <div class="achievement-icon">${achievement.icon}</div>
                    <h3>${this.escapeHtml(achievement.title)}</h3>
                    <p>${this.escapeHtml(achievement.description)}</p>
                    ${!achievement.isUnlocked && achievement.progress !== undefined ? `
                        <div class="progress">
                            <div class="progress-bar" style="width: ${(achievement.progress / achievement.target) * 100}%"></div>
                            <span class="progress-text">${achievement.progress}/${achievement.target}</span>
                        </div>
                    ` : ''}
                    ${achievement.isUnlocked ? `<div class="unlocked-badge">✅ Получено</div>` : ''}
                </div>
            `).join('');
        } else {
            achievementsGrid.innerHTML = `
                <div class="empty-state">
                    <p>🏆 Достижения загружаются...</p>
                </div>
            `;
        }
    }
    
    /**
     * Обновление страницы настроек
     */
    updateSettingsPage() {
        const settingsList = document.getElementById('settings-list');
        if (!settingsList) return;
        
        settingsList.innerHTML = `
            <div class="card">
                <h3>👤 Профиль</h3>
                <p>Имя: ${this.escapeHtml(this.currentUser?.name || 'Не указано')}</p>
                <p>Telegram: @${this.escapeHtml(this.currentUser?.username || 'Не указано')}</p>
            </div>
            
            <div class="card">
                <h3>📊 Статистика</h3>
                <p>Всего цитат: ${this.stats.totalQuotes || 0}</p>
                <p>Дней подряд: ${this.stats.currentStreak || 0}</p>
                <p>Лучшая серия: ${this.stats.longestStreak || 0}</p>
            </div>
            
            <div class="card">
                <h3>ℹ️ О приложении</h3>
                <p>Читатель — ваш персональный дневник цитат от Анны Бусел</p>
                <p>Версия: 1.0.0</p>
            </div>
        `;
    }
    
    /**
     * Настройка Telegram кнопок
     */
    setupTelegramButtons() {
        // Скрываем главную кнопку по умолчанию
        window.telegramManager.hideMainButton();
        
        // Обработчик кнопки назад (если понадобится)
        window.addEventListener('telegram:backButtonClicked', () => {
            if (this.currentPage !== 'home') {
                this.navigateToPage('home');
            }
        });
    }
    
    /**
     * Показать/скрыть экран загрузки
     */
    showLoading(show = true) {
        const loadingScreen = document.getElementById('loading');
        if (loadingScreen) {
            loadingScreen.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Показать главное приложение
     */
    showMainApp() {
        const mainApp = document.getElementById('main-app');
        if (mainApp) {
            mainApp.style.display = 'flex';
        }
        
        this.showLoading(false);
    }
    
    /**
     * Показать toast уведомление
     */
    showToast(message, type = 'info') {
        // Создаем элемент toast если его нет
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: var(--app-surface);
            color: var(--app-text);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: var(--shadow-lg);
            margin-bottom: 10px;
            transform: translateY(-100px);
            opacity: 0;
            transition: all 0.3s ease;
            pointer-events: all;
            border-left: 4px solid ${this.getToastColor(type)};
        `;
        
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        // Анимация появления
        setTimeout(() => {
            toast.style.transform = 'translateY(0)';
            toast.style.opacity = '1';
        }, 100);
        
        // Автоудаление
        setTimeout(() => {
            toast.style.transform = 'translateY(-100px)';
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
     * Получить цвет для toast
     */
    getToastColor(type) {
        const colors = {
            success: '#4CAF50',
            error: '#F44336',
            warning: '#FF9800',
            info: '#2196F3'
        };
        return colors[type] || colors.info;
    }
    
    /**
     * Показать ошибку
     */
    showError(message) {
        console.error('💥 Ошибка приложения:', message);
        
        // Показываем ошибку в интерфейсе
        window.telegramManager.showPopup({
            title: 'Ошибка',
            message: message,
            buttons: [
                { type: 'ok', text: 'OK' }
            ]
        });
    }
    
    /**
     * Утилиты
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    /**
     * Обновление конкретной страницы
     */
    updatePage(pageId) {
        switch (pageId) {
            case 'home':
                this.updateHomePage();
                break;
            case 'reports':
                this.updateReportsPage();
                break;
            case 'achievements':
                this.updateAchievementsPage();
                break;
            case 'settings':
                this.updateSettingsPage();
                break;
        }
    }
}

// Инициализируем приложение когда DOM готов
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 DOM готов, создаем Reader App...');
    window.readerApp = new ReaderApp();
});

// Экспортируем для ES6 модулей
export default ReaderApp;