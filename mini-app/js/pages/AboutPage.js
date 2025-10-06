/**
 * ℹ️ О ПРИЛОЖЕНИИ - AboutPage.js
 * 
 * Полноэкранная страница информации о приложении
 * Функциональность:
 * - Информация о приложении и авторе
 * - Версия и история изменений
 * - Ссылки на социальные сети и контакты
 * - Лицензии и благодарности
 * - Использует существующий дизайн-систему
 */

class AboutPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        this.appInfo = {};
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.loadAppInfo();
    }
    
    /**
     * 📊 Загрузка информации о приложении
     */
    async loadAppInfo() {
        try {
            this.loading = true;
            
            // Load app info from API or use fallback
            try {
                this.appInfo = await this.api.getAppInfo();
            } catch (apiError) {
                console.warn('⚠️ API недоступен, используем статичную информацию');
                this.appInfo = this.getStaticAppInfo();
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки информации:', error);
            this.error = error.message;
            this.appInfo = this.getStaticAppInfo();
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🎨 Генерация HTML разметки страницы
     */
    render() {
        return `
            <div class="content">
                ${this.renderHeader()}
                ${this.renderAppInfo()}
                ${this.renderAuthorInfo()}
                ${this.renderContacts()}
                ${this.renderLegalInfo()}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка страницы
     */
    renderHeader() {
        return `
            <div class="page-header text-center">
                <div class="app-logo-large">📚</div>
                <h1>Reader Bot</h1>
                <p>Ваш персональный дневник мудрости</p>
            </div>
        `;
    }
    
    /**
     * ℹ️ Рендер информации о приложении
     */
    renderAppInfo() {
        return `
            <div class="about-section">
                <h3>ℹ️ О приложении</h3>
                <div class="about-card">
                    <p>
                        Reader Bot — это персональный дневник для сохранения и организации 
                        мудрых цитат из книг, которые вас вдохновляют. Приложение помогает 
                        создать привычку чтения и рефлексии, отслеживая ваш прогресс и 
                        мотивируя к дальнейшему развитию.
                    </p>
                    
                    <div class="features-list">
                        <div class="feature-item">
                            <span class="feature-emoji">📝</span>
                            <span>Сохранение любимых цитат</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">📊</span>
                            <span>Отслеживание прогресса чтения</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">🏆</span>
                            <span>Система достижений</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">📚</span>
                            <span>Каталог рекомендуемых книг</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">👥</span>
                            <span>Сообщество читателей</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 👤 Рендер информации об авторе
     */
    renderAuthorInfo() {
        return `
            <div class="about-section">
                <h3>👤 Об авторе</h3>
                <div class="author-card">
                    <div class="author-avatar">А</div>
                    <div class="author-info">
                        <h4>Анна Бусел</h4>
                        <p>Психолог, автор книг и создатель Reader Bot</p>
                        <p>
                            Анна — практикующий психолог с более чем 10-летним опытом работы. 
                            Автор популярных книг по психологии отношений и личностному росту. 
                            Создала Reader Bot, чтобы помочь людям развивать привычку осознанного 
                            чтения и рефлексии.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🔗 Рендер социальных ссылок
     */
    renderContacts() {
    return `
        <div class="about-section">
            <h3>Контакты</h3>
            <div class="contacts-list">
                <div class="contact-item">
                    <a href="https://annabusel.org/bookclub" target="_blank" rel="noopener" id="websiteBtn">
                        Сайт Анны Бусел
                    </a>
                </div>
                <div class="contact-item">
                    <a href="https://t.me/anna_busel" target="_blank" rel="noopener" id="telegramBtn">
                        Telegram: @anna_busel
                    </a>
                </div>
                <div class="contact-item">
                    <a href="mailto:bebusel@bk.ru" id="emailBtn">
                        Email: bebusel@bk.ru
                    </a>
                </div>
            </div>
        </div>
    `;
}  
    
    /**
     * 📄 Рендер правовой информации
     */
    renderLegalInfo() {
        return `
            <div class="about-section">
                <h3>📄 Правовая информация</h3>
                <div class="legal-links">
                    <button class="legal-link" id="privacyBtn">
                        <span>🔒 Политика конфиденциальности</span>
                    </button>
                    <button class="legal-link" id="termsBtn">
                        <span>📋 Условия использования</span>
                    </button>
                    <button class="legal-link" id="licensesBtn">
                        <span>⚖️ Лицензии</span>
                    </button>
                </div>
                
                <div class="copyright">
                    <p>© 2024 Анна Бусел. Все права защищены.</p>
                    <p>Приложение создано с ❤️ для любителей книг и мудрости.</p>
                </div>
            </div>
        `;
    }
    
    /**
     * ⚠️ Рендер ошибки
     */
    renderError() {
        if (!this.error) return '';
        
        return `
            <div class="error-message" id="errorMessage">
                <span>⚠️ ${this.error}</span>
                <button onclick="this.parentElement.style.display='none'">✕</button>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Social links
        const socialLinks = document.querySelectorAll('.social-link');
        socialLinks.forEach(link => {
            link.addEventListener('click', () => {
                const linkType = link.dataset.link;
                this.handleSocialLinkClick(linkType);
            });
        });
        
        // Legal links
        const legalLinks = document.querySelectorAll('.legal-link');
        legalLinks.forEach(link => {
            link.addEventListener('click', () => {
                const linkId = link.id;
                this.handleLegalLinkClick(linkId);
            });
        });
    }
    
    /**
     * 🔗 Обработчик кликов по социальным ссылкам
     */
    handleSocialLinkClick(linkType) {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const links = {
            website: 'https://annabusel.org',
            telegram: 'https://t.me/annabusel_official',
            instagram: 'https://instagram.com/anna.busel',
            email: 'mailto:hello@annabusel.org'
        };
        
        const url = links[linkType];
        if (url) {
            if (this.telegram?.openLink) {
                this.telegram.openLink(url);
            } else {
                window.open(url, '_blank');
            }
        }
    }
    
    /**
     * 📄 Обработчик кликов по правовым ссылкам
     */
    handleLegalLinkClick(linkId) {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const content = {
            privacyBtn: this.getPrivacyPolicyText(),
            termsBtn: this.getTermsOfServiceText(),
            licensesBtn: this.getLicensesText()
        };
        
        const text = content[linkId];
        if (text) {
            this.showLegalModal(text);
        }
    }
    
    /**
     * 📋 Показать правовой документ
     */
    showLegalModal(content) {
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(content);
        } else {
            alert(content);
        }
    }
    
    /**
     * 📊 Получить статичную информацию о приложении
     */
    getStaticAppInfo() {
        return {
            version: '1.0.0',
            releaseDate: '2024',
            author: 'Анна Бусел',
            description: 'Персональный дневник мудрости для Telegram'
        };
    }
    
    /**
     * 🔒 Получить текст политики конфиденциальности
     */
    getPrivacyPolicyText() {
        return `
ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ

Reader Bot уважает вашу конфиденциальность. Мы собираем минимально необходимые данные для работы приложения:

• Telegram ID для идентификации
• Цитаты и заметки, которые вы добавляете
• Статистика использования для улучшения сервиса

Ваши данные не передаются третьим лицам и используются только для предоставления функций приложения.

Полная версия: annabusel.org/privacy
        `.trim();
    }
    
    /**
     * 📋 Получить текст условий использования
     */
    getTermsOfServiceText() {
        return `
УСЛОВИЯ ИСПОЛЬЗОВАНИЯ

Используя Reader Bot, вы соглашаетесь с условиями:

• Приложение предоставляется "как есть"
• Вы несете ответственность за свой контент
• Запрещено использование для незаконных целей
• Мы можем модерировать публичный контент

Полная версия: annabusel.org/terms
        `.trim();
    }
    
    /**
     * ⚖️ Получить информацию о лицензиях
     */
    getLicensesText() {
        return `
ЛИЦЕНЗИИ

Reader Bot использует следующие открытые библиотеки:

• Telegram Web App API - MIT License
• Various JavaScript utilities - MIT License

Приложение создано с использованием собственных разработок и открытых стандартов.

Подробнее: annabusel.org/licenses
        `.trim();
    }
    
    /**
     * 🧹 Очистка ресурсов при уничтожении
     */
    destroy() {
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.appInfo = {};
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('ℹ️ AboutPage: onShow');
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('ℹ️ AboutPage: onHide');
    }
}

// 📤 Экспорт класса
window.AboutPage = AboutPage;
