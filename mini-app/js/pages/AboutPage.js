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
            <div class="about-page">
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
            <div class="about-header">
                <div class="about-logo">📚</div>
                <h1 class="about-title">"Читатель"</h1>
                <p class="about-subtitle">Ваш персональный дневник мудрости</p>
                <span class="about-version">v1.0.2</span>
            </div>
        `;
    }
    
    /**
     * ℹ️ Рендер информации о приложении
     */
    renderAppInfo() {
        return `
            <div class="about-section">
                <div class="about-section-header">
                    <div class="about-section-title">ℹ️ О приложении</div>
                </div>
                <div class="about-section-content">
                    <p class="about-description">
                        <span class="about-app-name">Приложение "Читатель"</span> — это персональный дневник для сохранения и организации мудрых цитат из книг, которые вас вдохновляют.
                        <br>
                        Приложение помогает создать привычку осознанного чтения и рефлексии, отслеживает ваш прогресс и мотивирует к развитию.
                    </p>
                    
                    <div class="features-list">
                        <div class="feature-item">
                            <span class="feature-emoji">📝</span>
                            <span class="feature-desc">Сохранение любимых цитат</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">📊</span>
                            <span class="feature-desc">Отслеживание прогресса чтения</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">🗓️</span>
                            <span class="feature-desc">Еженедельные отчеты</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">📚</span>
                            <span class="feature-desc">Каталог рекомендуемых книг</span>
                        </div>
                        <div class="feature-item">
                            <span class="feature-emoji">👥</span>
                            <span class="feature-desc">Сообщество читателей</span>
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
        <section class="about-section">
            <div class="about-section-title">👤 Об авторе</div>
            <div class="about-section-content">
                <div class="author-card">
                    <div class="author-header">
                        <div class="author-avatar">А</div>
                        <div class="author-meta">
                            <h4 class="author-name">Анна Бусел</h4>
                            <p class="author-role">Психолог, автор книг и создатель приложения «Читатель»</p>
                        </div>
                    </div>
                    <div class="author-bio">
                        <p>Меня зовут Анна Бусел, я - практикующий психолог и создатель проекта «Книжный клуб от психолога».</p>
                        <p>В июле 2023 года я создала книжный клуб для тех, кому важно перестать растрачивать свое время на соц.сети и начать регулярно читать в кругу единомышленников.</p>
                        <p>Мой клуб не только про книги, сколько про фокус на себе. 
Каждый месяц в клубе говорим на жизненно важные темы: кризисы, растерянность, одиночество, отношения, деньги, тело, сексуальность и другие.
Один месяц - одна тема.</p>
                        <p>Создание книжного клуба было моей мечтой. 
А создание приложения - второй мечтой.
Собственно, вы можете на моем примере убедиться, что если очень захотеть - можно делать то, что очень нравится, и разделять это с другими.</p>
                        <p>Осмысленное чтение в клубе меняет жизни участников. Вы очень смелый человек, раз ступили на этот путь. Пускай этот путь складывается лучшим для вас образом.</p>
                    </div>
                </div>
            </div>
        </section>
    `;
}
    
    /**
     * 🔗 Рендер блока контактов с эмодзи слева от каждой строки
     */
    renderContacts() {
        return `
            <div class="about-section">
                <div class="about-section-title">📬 Контакты</div>
                <div class="about-section-content">
                    <div class="contacts-list">
                        <div class="contact-item">
                            <span class="contact-emoji">🌐</span>
                            <a href="https://annabusel.org/bookclub" target="_blank" rel="noopener" id="websiteBtn" class="contact-link">
                                Сайт Анны Бусел
                            </a>
                        </div>
                        <div class="contact-item">
                            <span class="contact-emoji">📱</span>
                            <a href="https://t.me/manager_bookclub" target="_blank" rel="noopener" id="telegramBtn" class="contact-link">
                                Telegram: @manager_bookclub
                            </a>
                        </div>
                        <div class="contact-item">
                            <span class="contact-emoji">✉️</span>
                            <a href="mailto:bebusel@bk.ru" id="emailBtn" class="contact-link">
                                Email: bebusel@bk.ru
                            </a>
                        </div>
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
                <div class="about-section-title">📄 Правовая информация</div>
                <div class="about-section-content">
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
