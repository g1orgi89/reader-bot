/**
 * 🏆 ДОСТИЖЕНИЯ - AchievementsPage.js
 * 
 * Полноэкранная страница достижений пользователя
 * Функциональность:
 * - Отображение всех достижений и наград
 * - Прогресс по категориям
 * - Мотивационные элементы
 * - Интеграция с API и State Management
 * - Использует существующий дизайн-систему
 */

class AchievementsPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние компонента
        this.loading = false;
        this.error = null;
        this.achievements = [];
        this.progress = {};
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация страницы
     */
    init() {
        this.setupSubscriptions();
        this.loadAchievementsData();
    }
    
    /**
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения достижений
        const achievementsSubscription = this.state.subscribe('achievements', (achievements) => {
            this.achievements = achievements.items || [];
            this.progress = achievements.progress || {};
            this.updateAchievementsUI();
        });
        
        this.subscriptions.push(achievementsSubscription);
    }
    
    /**
     * 📊 Загрузка данных достижений
     */
    async loadAchievementsData() {
        if (this.loading) return;
        
        try {
            this.loading = true;
            
            // Get userId with fallback methods
            let userId = null;
            if (this.state && typeof this.state.getCurrentUserId === 'function') {
                userId = this.state.getCurrentUserId();
            } else if (this.state && this.state.get) {
                userId = this.state.get('user.profile.id') || this.state.get('user.telegramData.id');
            }
            
            if (!userId || userId === 'demo-user') {
                // Use fallback data
                this.achievements = this.getFallbackAchievements();
                this.progress = this.getFallbackProgress();
                return;
            }
            
            // Load from API (if available)
            try {
                const achievementsData = await this.api.getAchievements(userId);
                if (achievementsData) {
                    this.achievements = achievementsData.items || [];
                    this.progress = achievementsData.progress || {};
                    this.state.set('achievements', {
                        items: this.achievements,
                        progress: this.progress
                    });
                }
            } catch (apiError) {
                console.warn('⚠️ API недоступен, используем fallback данные');
                this.achievements = this.getFallbackAchievements();
                this.progress = this.getFallbackProgress();
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
            this.error = error.message;
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
                ${this.renderProgressSection()}
                ${this.renderAchievementsList()}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка страницы
     */
    renderHeader() {
        const unlockedCount = this.achievements.filter(a => a.unlocked).length;
        const totalCount = this.achievements.length;
        
        return `
            <div class="page-header">
                <h1>🏆 Достижения</h1>
                <p>Ваши награды и прогресс (${unlockedCount}/${totalCount})</p>
            </div>
        `;
    }
    
    /**
     * 📈 Рендер секции прогресса
     */
    renderProgressSection() {
        return `
            <div class="progress-section">
                <h3>📈 Ваш прогресс</h3>
                <div class="progress-cards">
                    ${this.renderProgressCard('quotes', 'Цитаты', '📚', this.progress.quotes)}
                    ${this.renderProgressCard('streak', 'Серии', '🔥', this.progress.streak)}
                    ${this.renderProgressCard('exploration', 'Исследование', '🌟', this.progress.exploration)}
                </div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер карточки прогресса
     */
    renderProgressCard(type, title, emoji, data) {
        const current = data?.current || 0;
        const target = data?.target || 100;
        const percentage = Math.min((current / target) * 100, 100);
        
        return `
            <div class="progress-card">
                <div class="progress-header">
                    <span class="progress-emoji">${emoji}</span>
                    <span class="progress-title">${title}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-text">${current}/${target}</div>
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер списка достижений
     */
    renderAchievementsList() {
        const unlockedAchievements = this.achievements.filter(a => a.unlocked);
        const lockedAchievements = this.achievements.filter(a => !a.unlocked);
        
        return `
            <div class="achievements-section">
                <h3>🏆 Полученные награды</h3>
                <div class="achievements-grid">
                    ${unlockedAchievements.map(achievement => this.renderAchievementItem(achievement, true)).join('')}
                </div>
                
                <h3>🔒 Еще предстоит получить</h3>
                <div class="achievements-grid">
                    ${lockedAchievements.map(achievement => this.renderAchievementItem(achievement, false)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🎖️ Рендер элемента достижения
     */
    renderAchievementItem(achievement, unlocked) {
        const lockClass = unlocked ? '' : 'locked';
        const emoji = unlocked ? achievement.emoji : '🔒';
        
        return `
            <div class="achievement-item ${lockClass}" data-achievement-id="${achievement.id}">
                <div class="achievement-emoji">${emoji}</div>
                <div class="achievement-info">
                    <h4 class="achievement-title">${achievement.title}</h4>
                    <p class="achievement-description">${achievement.description}</p>
                    ${achievement.unlockedAt ? `<small class="achievement-date">Получено: ${new Date(achievement.unlockedAt).toLocaleDateString()}</small>` : ''}
                </div>
                ${achievement.rarity ? `<div class="achievement-rarity ${achievement.rarity}">${this.getRarityText(achievement.rarity)}</div>` : ''}
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
        // Клики по достижениям для показа деталей
        const achievementItems = document.querySelectorAll('.achievement-item');
        achievementItems.forEach(item => {
            item.addEventListener('click', () => {
                const achievementId = item.dataset.achievementId;
                this.handleAchievementClick(achievementId);
            });
        });
    }
    
    /**
     * 🎖️ Обработчик клика по достижению
     */
    handleAchievementClick(achievementId) {
        // Haptic feedback
        if (this.telegram?.hapticFeedback) {
            this.telegram.hapticFeedback('light');
        }
        
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (achievement) {
            this.showAchievementDetails(achievement);
        }
    }
    
    /**
     * 📖 Показать детали достижения
     */
    showAchievementDetails(achievement) {
        const details = `
${achievement.emoji} ${achievement.title}

${achievement.description}

${achievement.unlocked ? 
    `✅ Получено: ${new Date(achievement.unlockedAt).toLocaleDateString()}` : 
    `🔒 Еще не получено`}

${achievement.hint ? `💡 Подсказка: ${achievement.hint}` : ''}
        `.trim();
        
        if (this.telegram?.showAlert) {
            this.telegram.showAlert(details);
        } else {
            alert(details);
        }
    }
    
    /**
     * 🔄 Обновление UI достижений
     */
    updateAchievementsUI() {
        // Update header counts
        const headerP = document.querySelector('.page-header p');
        if (headerP) {
            const unlockedCount = this.achievements.filter(a => a.unlocked).length;
            const totalCount = this.achievements.length;
            headerP.textContent = `Ваши награды и прогресс (${unlockedCount}/${totalCount})`;
        }
    }
    
    /**
     * 🎯 Получить текст редкости
     */
    getRarityText(rarity) {
        const rarityMap = {
            common: 'Обычное',
            rare: 'Редкое',
            epic: 'Эпическое',
            legendary: 'Легендарное'
        };
        return rarityMap[rarity] || '';
    }
    
    /**
     * 📚 Получить fallback достижения
     */
    getFallbackAchievements() {
        return [
            {
                id: 'first_quote',
                title: 'Первая цитата',
                description: 'Добавили свою первую цитату в дневник',
                emoji: '📝',
                unlocked: true,
                unlockedAt: new Date().toISOString(),
                rarity: 'common'
            },
            {
                id: 'week_streak',
                title: 'Недельная серия',
                description: 'Добавляли цитаты 7 дней подряд',
                emoji: '🔥',
                unlocked: true,
                unlockedAt: new Date().toISOString(),
                rarity: 'rare'
            },
            {
                id: 'book_explorer',
                title: 'Исследователь книг',
                description: 'Изучили 10 разных книг из каталога',
                emoji: '📚',
                unlocked: false,
                rarity: 'epic',
                hint: 'Просматривайте книги в каталоге'
            },
            {
                id: 'wisdom_keeper',
                title: 'Хранитель мудрости',
                description: 'Собрали 100 цитат в дневник',
                emoji: '🧠',
                unlocked: false,
                rarity: 'legendary',
                hint: 'Продолжайте добавлять цитаты'
            }
        ];
    }
    
    /**
     * 📈 Получить fallback прогресс
     */
    getFallbackProgress() {
        return {
            quotes: { current: 47, target: 100 },
            streak: { current: 12, target: 30 },
            exploration: { current: 3, target: 10 }
        };
    }
    
    /**
     * 🧹 Очистка подписок при уничтожении
     */
    destroy() {
        // Отписка от всех подписок
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Очистка состояния компонента
        this.loading = false;
        this.error = null;
        this.achievements = [];
        this.progress = {};
    }
    
    /**
     * 📱 Lifecycle методы для интеграции с роутером
     */
    
    /**
     * Вызывается при показе страницы
     */
    onShow() {
        console.log('🏆 AchievementsPage: onShow');
        // Refresh data if needed
        if (this.achievements.length === 0) {
            this.loadAchievementsData();
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('🏆 AchievementsPage: onHide');
    }
}

// 📤 Экспорт класса
window.AchievementsPage = AchievementsPage;