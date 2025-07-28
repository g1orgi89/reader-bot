/**
 * 🏆 ДОСТИЖЕНИЯ И ГЕЙМИФИКАЦИЯ - AchievementsModal.js
 * 
 * Функциональность:
 * - Список всех достижений пользователя
 * - Прогресс-бары для незавершенных достижений
 * - Анимации разблокировки новых достижений
 * - Система мотивации и геймификации
 * - Категории достижений
 * - Награды и бейджи
 */

class AchievementsModal {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // Состояние модального окна
        this.modal = null;
        this.isVisible = false;
        this.achievements = [];
        this.userStats = {};
        this.loading = false;
        
        // Конфигурация достижений
        this.achievementConfig = this.getAchievementConfig();
        
        // Подписки на изменения состояния
        this.subscriptions = [];
        
        this.init();
    }
    
    /**
     * 🔧 Инициализация модального окна достижений
     */
    init() {
        this.setupSubscriptions();
        this.loadAchievements();
    }
    
    /**
     * 📡 Настройка подписок на изменения состояния
     */
    setupSubscriptions() {
        // Подписка на изменения статистики
        const statsSubscription = this.state.subscribe('stats', (stats) => {
            this.userStats = stats;
            this.updateAchievementsProgress();
            this.updateUI();
        });
        
        // Подписка на изменения достижений
        const achievementsSubscription = this.state.subscribe('achievements', (achievements) => {
            this.achievements = achievements;
            this.updateUI();
        });
        
        this.subscriptions.push(statsSubscription, achievementsSubscription);
    }
    
    /**
     * 🏆 Загрузка достижений пользователя
     */
    async loadAchievements() {
        try {
            this.loading = true;
            
            // Загружаем достижения и статистику параллельно
            const [achievements, stats] = await Promise.all([
                this.loadUserAchievements(),
                this.loadUserStats()
            ]);
            
            this.achievements = achievements;
            this.userStats = stats;
            
            // Обновляем прогресс достижений
            this.updateAchievementsProgress();
            
            // Обновляем состояние приложения
            this.state.set('achievements', achievements);
            this.state.set('stats', stats);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
        } finally {
            this.loading = false;
        }
    }
    
    /**
     * 🏅 Загрузка достижений пользователя
     */
    async loadUserAchievements() {
        try {
            const achievements = await this.api.getAchievements();
            return achievements || [];
        } catch (error) {
            console.error('❌ Ошибка загрузки достижений:', error);
            return [];
        }
    }
    
    /**
     * 📊 Загрузка статистики пользователя
     */
    async loadUserStats() {
        try {
            const stats = await this.api.getStats();
            return stats;
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            return {};
        }
    }
    
    /**
     * 🔓 Открытие модального окна достижений
     */
    show() {
        if (this.isVisible) return;
        
        // Создаем модальное окно
        this.modal = new Modal({
            title: 'Мои достижения',
            content: this.renderContent(),
            size: 'medium',
            showCloseButton: true,
            onOpen: () => {
                this.isVisible = true;
                this.attachEventListeners();
                this.checkNewAchievements();
            },
            onClose: () => {
                this.isVisible = false;
                this.cleanup();
            }
        });
        
        this.modal.open();
        
        // Haptic feedback
        this.triggerHaptic('medium');
    }
    
    /**
     * 🔒 Закрытие модального окна
     */
    hide() {
        if (this.modal && this.isVisible) {
            this.modal.close();
        }
    }
    
    /**
     * 🎨 Рендер содержимого модального окна
     */
    renderContent() {
        if (this.loading) {
            return this.renderLoading();
        }
        
        return `
            <div class="achievements-modal">
                ${this.renderHeader()}
                ${this.renderProgress()}
                ${this.renderAchievementsList()}
                ${this.renderMotivation()}
            </div>
        `;
    }
    
    /**
     * ⏳ Рендер состояния загрузки
     */
    renderLoading() {
        return `
            <div class="achievements-loading">
                <div class="loading-spinner">🏆</div>
                <div class="loading-text">Загружаем ваши достижения...</div>
            </div>
        `;
    }
    
    /**
     * 📊 Рендер заголовка с общей статистикой
     */
    renderHeader() {
        const unlockedCount = this.getUnlockedAchievementsCount();
        const totalCount = this.achievementConfig.length;
        const completionPercent = Math.round((unlockedCount / totalCount) * 100);
        
        return `
            <div class="achievements-header">
                <div class="achievements-stats">
                    <div class="achievement-count">
                        <span class="count-number">${unlockedCount}</span>
                        <span class="count-separator">из</span>
                        <span class="count-total">${totalCount}</span>
                        <span class="count-label">достижений</span>
                    </div>
                    <div class="completion-percent">${completionPercent}% завершено</div>
                </div>
                
                <div class="achievements-progress-bar">
                    <div class="progress-fill" style="width: ${completionPercent}%"></div>
                </div>
                
                <div class="achievements-motivation">
                    ${this.getMotivationText(completionPercent)}
                </div>
            </div>
        `;
    }
    
    /**
     * 📈 Рендер общего прогресса
     */
    renderProgress() {
        const categories = this.getAchievementCategories();
        
        return `
            <div class="achievements-categories">
                <div class="categories-title">📈 Прогресс по категориям</div>
                <div class="categories-grid">
                    ${categories.map(category => this.renderCategoryProgress(category)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 📋 Рендер категории прогресса
     */
    renderCategoryProgress(category) {
        const categoryAchievements = this.achievementConfig.filter(a => a.category === category.id);
        const unlockedInCategory = categoryAchievements.filter(a => this.isAchievementUnlocked(a.id)).length;
        const progressPercent = Math.round((unlockedInCategory / categoryAchievements.length) * 100);
        
        return `
            <div class="category-progress">
                <div class="category-icon">${category.icon}</div>
                <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-stats">${unlockedInCategory}/${categoryAchievements.length}</div>
                </div>
                <div class="category-bar">
                    <div class="category-fill" style="width: ${progressPercent}%"></div>
                </div>
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер списка достижений
     */
    renderAchievementsList() {
        const groupedAchievements = this.groupAchievementsByCategory();
        
        return `
            <div class="achievements-list">
                ${Object.entries(groupedAchievements).map(([categoryId, achievements]) => 
                    this.renderAchievementCategory(categoryId, achievements)
                ).join('')}
            </div>
        `;
    }
    
    /**
     * 📂 Рендер категории достижений
     */
    renderAchievementCategory(categoryId, achievements) {
        const category = this.getCategoryInfo(categoryId);
        
        return `
            <div class="achievement-category">
                <div class="category-header">
                    <span class="category-icon">${category.icon}</span>
                    <span class="category-title">${category.name}</span>
                    <span class="category-count">(${achievements.length})</span>
                </div>
                
                <div class="category-achievements">
                    ${achievements.map(achievement => this.renderAchievementItem(achievement)).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🏅 Рендер элемента достижения
     */
    renderAchievementItem(achievement) {
        const isUnlocked = this.isAchievementUnlocked(achievement.id);
        const progress = this.getAchievementProgress(achievement);
        const canUnlock = progress.current >= progress.total;
        
        return `
            <div class="achievement-item ${isUnlocked ? 'unlocked' : 'locked'} ${canUnlock && !isUnlocked ? 'ready-to-unlock' : ''}" 
                 data-achievement-id="${achievement.id}">
                
                <div class="achievement-icon ${isUnlocked ? 'unlocked' : 'locked'}">
                    ${achievement.icon}
                    ${isUnlocked ? '<span class="unlock-badge">✓</span>' : ''}
                </div>
                
                <div class="achievement-info">
                    <div class="achievement-title">${achievement.title}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    
                    ${isUnlocked ? 
                        `<div class="achievement-completed">
                            <span class="completed-icon">🎉</span>
                            <span class="completed-text">Выполнено!</span>
                            ${achievement.unlockedAt ? `<span class="completed-date">${this.formatDate(achievement.unlockedAt)}</span>` : ''}
                        </div>` :
                        `<div class="achievement-progress">
                            <div class="progress-text">
                                ${progress.current}/${progress.total} ${achievement.unit || ''}
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${Math.min((progress.current / progress.total) * 100, 100)}%"></div>
                            </div>
                            ${canUnlock ? '<div class="ready-unlock">Готово к получению! 🎉</div>' : ''}
                        </div>`
                    }
                </div>
                
                ${achievement.reward ? `
                    <div class="achievement-reward">
                        <span class="reward-icon">${achievement.reward.icon}</span>
                        <span class="reward-text">${achievement.reward.text}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * 💪 Рендер мотивационной секции
     */
    renderMotivation() {
        const nextAchievement = this.getNextAchievementToUnlock();
        const unlockedCount = this.getUnlockedAchievementsCount();
        
        return `
            <div class="achievements-motivation-section">
                ${nextAchievement ? `
                    <div class="next-achievement">
                        <div class="next-title">🎯 Следующая цель</div>
                        <div class="next-item">
                            <span class="next-icon">${nextAchievement.icon}</span>
                            <div class="next-info">
                                <div class="next-name">${nextAchievement.title}</div>
                                <div class="next-progress">${this.getProgressText(nextAchievement)}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="motivation-tips">
                    <div class="tips-title">💡 Советы для получения достижений</div>
                    <div class="tips-list">
                        ${this.getMotivationTips(unlockedCount).map(tip => `
                            <div class="tip-item">
                                <span class="tip-icon">${tip.icon}</span>
                                <span class="tip-text">${tip.text}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * 📱 Навешивание обработчиков событий
     */
    attachEventListeners() {
        // Клики по достижениям
        const achievementItems = document.querySelectorAll('.achievement-item');
        achievementItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const achievementId = item.dataset.achievementId;
                this.handleAchievementClick(achievementId);
            });
        });
        
        // Клики по категориям для сворачивания/разворачивания
        const categoryHeaders = document.querySelectorAll('.category-header');
        categoryHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                this.toggleCategory(header.parentElement);
            });
        });
    }
    
    /**
     * 🏆 Обработчик клика по достижению
     */
    handleAchievementClick(achievementId) {
        const achievement = this.achievementConfig.find(a => a.id === achievementId);
        if (!achievement) return;
        
        const isUnlocked = this.isAchievementUnlocked(achievementId);
        const progress = this.getAchievementProgress(achievement);
        const canUnlock = progress.current >= progress.total && !isUnlocked;
        
        // Haptic feedback
        this.triggerHaptic('light');
        
        if (canUnlock) {
            // Разблокируем достижение
            this.unlockAchievement(achievementId);
        } else {
            // Показываем детали достижения
            this.showAchievementDetails(achievement, progress);
        }
    }
    
    /**
     * 🔓 Разблокировка достижения
     */
    async unlockAchievement(achievementId) {
        try {
            // Haptic feedback успеха
            this.triggerHaptic('heavy');
            
            // Отправляем на сервер
            await this.api.unlockAchievement(achievementId);
            
            // Обновляем локальное состояние
            const achievementIndex = this.achievements.findIndex(a => a.id === achievementId);
            if (achievementIndex >= 0) {
                this.achievements[achievementIndex].unlocked = true;
                this.achievements[achievementIndex].unlockedAt = new Date().toISOString();
            } else {
                // Добавляем новое достижение
                this.achievements.push({
                    id: achievementId,
                    unlocked: true,
                    unlockedAt: new Date().toISOString()
                });
            }
            
            // Обновляем состояние приложения
            this.state.set('achievements', this.achievements);
            
            // Показываем анимацию разблокировки
            this.showUnlockAnimation(achievementId);
            
            // Обновляем UI
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Ошибка разблокировки достижения:', error);
        }
    }
    
    /**
     * 🎆 Показать анимацию разблокировки
     */
    showUnlockAnimation(achievementId) {
        const achievement = this.achievementConfig.find(a => a.id === achievementId);
        if (!achievement) return;
        
        // Создаем временное уведомление об успехе
        const notification = document.createElement('div');
        notification.className = 'achievement-unlock-notification';
        notification.innerHTML = `
            <div class="unlock-animation">
                <div class="unlock-icon">${achievement.icon}</div>
                <div class="unlock-text">
                    <div class="unlock-title">🎉 Достижение получено!</div>
                    <div class="unlock-name">${achievement.title}</div>
                </div>
            </div>
        `;
        
        // Добавляем в DOM
        document.body.appendChild(notification);
        
        // Показываем анимацию
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Убираем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }
    
    /**
     * ℹ️ Показать детали достижения
     */
    showAchievementDetails(achievement, progress) {
        const detailModal = new Modal({
            title: achievement.title,
            content: `
                <div class="achievement-details">
                    <div class="detail-icon">${achievement.icon}</div>
                    <div class="detail-description">${achievement.description}</div>
                    
                    <div class="detail-progress">
                        <div class="progress-label">Прогресс:</div>
                        <div class="progress-bar large">
                            <div class="progress-fill" style="width: ${Math.min((progress.current / progress.total) * 100, 100)}%"></div>
                        </div>
                        <div class="progress-numbers">${progress.current} / ${progress.total} ${achievement.unit || ''}</div>
                    </div>
                    
                    ${achievement.tips ? `
                        <div class="detail-tips">
                            <div class="tips-title">💡 Как получить:</div>
                            <div class="tips-text">${achievement.tips}</div>
                        </div>
                    ` : ''}
                    
                    ${achievement.reward ? `
                        <div class="detail-reward">
                            <div class="reward-title">🎁 Награда:</div>
                            <div class="reward-content">
                                <span class="reward-icon">${achievement.reward.icon}</span>
                                <span class="reward-text">${achievement.reward.text}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `,
            size: 'small',
            buttons: [
                {
                    text: 'Понятно',
                    variant: 'primary',
                    onClick: () => true
                }
            ]
        });
        
        detailModal.open();
    }
    
    /**
     * 📂 Переключение категории (сворачивание/разворачивание)
     */
    toggleCategory(categoryElement) {
        const achievements = categoryElement.querySelector('.category-achievements');
        const isCollapsed = categoryElement.classList.contains('collapsed');
        
        if (isCollapsed) {
            categoryElement.classList.remove('collapsed');
            achievements.style.maxHeight = achievements.scrollHeight + 'px';
        } else {
            categoryElement.classList.add('collapsed');
            achievements.style.maxHeight = '0px';
        }
        
        // Haptic feedback
        this.triggerHaptic('light');
    }
    
    /**
     * 🔄 Обновление прогресса достижений
     */
    updateAchievementsProgress() {
        this.achievementConfig.forEach(achievement => {
            const progress = this.calculateAchievementProgress(achievement);
            // Сохраняем прогресс для использования в UI
            achievement.currentProgress = progress;
        });
    }
    
    /**
     * 📊 Расчет прогресса достижения
     */
    calculateAchievementProgress(achievement) {
        const stats = this.userStats;
        
        switch (achievement.id) {
            case 'first_quote':
                return { current: Math.min(stats.totalQuotes || 0, 1), total: 1 };
            
            case 'wisdom_collector':
                return { current: Math.min(stats.totalQuotes || 0, 25), total: 25 };
            
            case 'week_philosopher':
                return { current: Math.min(stats.currentStreak || 0, 7), total: 7 };
            
            case 'thinker':
                return { current: Math.min(stats.ownThoughts || 0, 10), total: 10 };
            
            case 'classic_lover':
                return { current: Math.min(stats.classicAuthors || 0, 10), total: 10 };
            
            case 'month_master':
                return { current: Math.min(stats.currentStreak || 0, 30), total: 30 };
            
            case 'hundred_quotes':
                return { current: Math.min(stats.totalQuotes || 0, 100), total: 100 };
            
            case 'year_reader':
                return { current: Math.min(stats.currentStreak || 0, 365), total: 365 };
            
            default:
                return { current: 0, total: 1 };
        }
    }
    
    /**
     * 🏆 Получение конфигурации достижений
     */
    getAchievementConfig() {
        return [
            // Категория: Первые шаги
            {
                id: 'first_quote',
                title: 'Первые шаги',
                description: 'Добавили первую цитату в дневник',
                icon: '🌟',
                category: 'beginner',
                unit: 'цитата',
                tips: 'Просто отправьте любую понравившуюся цитату боту!',
                reward: { icon: '🎉', text: 'Доступ к персональному анализу' }
            },
            {
                id: 'wisdom_collector',
                title: 'Коллекционер мудрости',
                description: 'Собрали 25 цитат',
                icon: '📚',
                category: 'beginner',
                unit: 'цитат',
                tips: 'Сохраняйте цитаты регулярно - по одной в день!'
            },
            
            // Категория: Постоянство
            {
                id: 'week_philosopher',
                title: 'Философ недели',
                description: '7 дней подряд добавляйте цитаты',
                icon: '🔥',
                category: 'consistency',
                unit: 'дней',
                tips: 'Добавляйте хотя бы одну цитату каждый день в течение недели',
                reward: { icon: '⭐', text: 'Еженедельный бонус к анализу' }
            },
            {
                id: 'month_master',
                title: 'Мастер месяца',
                description: '30 дней подряд добавляйте цитаты',
                icon: '👑',
                category: 'consistency',
                unit: 'дней',
                tips: 'Создайте привычку - добавляйте цитаты в одно и то же время'
            },
            {
                id: 'year_reader',
                title: 'Читатель года',
                description: '365 дней подряд добавляйте цитаты',
                icon: '🏆',
                category: 'consistency',
                unit: 'дней',
                tips: 'Создайте систему напоминаний и не пропускайте ни дня!',
                reward: { icon: '💎', text: 'Эксклюзивный анализ от Анны' }
            },
            
            // Категория: Качество
            {
                id: 'thinker',
                title: 'Мыслитель',
                description: 'Добавьте 10 собственных мыслей',
                icon: '💎',
                category: 'quality',
                unit: 'мыслей',
                tips: 'Записывайте свои размышления без указания автора'
            },
            {
                id: 'classic_lover',
                title: 'Любитель классики',
                description: '10 цитат классических авторов',
                icon: '🎭',
                category: 'quality',
                unit: 'цитат',
                tips: 'Исследуйте произведения великих писателей и философов'
            },
            
            // Категория: Масштаб
            {
                id: 'hundred_quotes',
                title: 'Сотня мудрости',
                description: 'Собрали 100 цитат',
                icon: '💯',
                category: 'scale',
                unit: 'цитат',
                tips: 'Продолжайте собирать цитаты из разных источников'
            }
        ];
    }
    
    /**
     * 📂 Получение категорий достижений
     */
    getAchievementCategories() {
        return [
            { id: 'beginner', name: 'Первые шаги', icon: '🌱' },
            { id: 'consistency', name: 'Постоянство', icon: '🔥' },
            { id: 'quality', name: 'Качество', icon: '💎' },
            { id: 'scale', name: 'Масштаб', icon: '📈' }
        ];
    }
    
    /**
     * 📋 Группировка достижений по категориям
     */
    groupAchievementsByCategory() {
        const grouped = {};
        
        this.achievementConfig.forEach(achievement => {
            const category = achievement.category;
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(achievement);
        });
        
        return grouped;
    }
    
    /**
     * ℹ️ Получение информации о категории
     */
    getCategoryInfo(categoryId) {
        return this.getAchievementCategories().find(c => c.id === categoryId) || 
               { id: categoryId, name: 'Неизвестно', icon: '❓' };
    }
    
    /**
     * 🔓 Проверка разблокировки достижения
     */
    isAchievementUnlocked(achievementId) {
        return this.achievements.some(a => a.id === achievementId && a.unlocked);
    }
    
    /**
     * 📊 Получение прогресса достижения
     */
    getAchievementProgress(achievement) {
        return achievement.currentProgress || this.calculateAchievementProgress(achievement);
    }
    
    /**
     * 🔢 Подсчет разблокированных достижений
     */
    getUnlockedAchievementsCount() {
        return this.achievements.filter(a => a.unlocked).length;
    }
    
    /**
     * 🎯 Получение следующего достижения для разблокировки
     */
    getNextAchievementToUnlock() {
        return this.achievementConfig
            .filter(a => !this.isAchievementUnlocked(a.id))
            .sort((a, b) => {
                const progressA = this.getAchievementProgress(a);
                const progressB = this.getAchievementProgress(b);
                const percentA = progressA.current / progressA.total;
                const percentB = progressB.current / progressB.total;
                return percentB - percentA;
            })[0];
    }
    
    /**
     * 💪 Получение мотивационного текста
     */
    getMotivationText(completionPercent) {
        if (completionPercent >= 100) return 'Поздравляем! Вы получили все достижения! 🎉';
        if (completionPercent >= 75) return 'Отлично! Вы почти у цели! 💪';
        if (completionPercent >= 50) return 'Хорошо! Половина пути пройдена! 📈';
        if (completionPercent >= 25) return 'Неплохое начало! Продолжайте в том же духе! 🌱';
        return 'Добро пожаловать! Впереди много интересных достижений! 🚀';
    }
    
    /**
     * 💡 Получение советов для мотивации
     */
    getMotivationTips(unlockedCount) {
        const allTips = [
            { icon: '📅', text: 'Добавляйте цитаты каждый день для серий' },
            { icon: '🧠', text: 'Записывайте собственные мысли и идеи' },
            { icon: '📚', text: 'Исследуйте цитаты классических авторов' },
            { icon: '🎯', text: 'Ставьте себе цели по количеству цитат' },
            { icon: '💡', text: 'Размышляйте над смыслом каждой цитаты' },
            { icon: '🔄', text: 'Регулярность важнее количества' }
        ];
        
        // Показываем случайные 3 совета
        return allTips.sort(() => 0.5 - Math.random()).slice(0, 3);
    }
    
    /**
     * 📅 Форматирование даты
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short'
        });
    }
    
    /**
     * 📊 Получение текста прогресса
     */
    getProgressText(achievement) {
        const progress = this.getAchievementProgress(achievement);
        return `${progress.current}/${progress.total} ${achievement.unit || ''}`;
    }
    
    /**
     * 🔍 Проверка новых достижений
     */
    checkNewAchievements() {
        const readyToUnlock = this.achievementConfig.filter(achievement => {
            const isUnlocked = this.isAchievementUnlocked(achievement.id);
            const progress = this.getAchievementProgress(achievement);
            return !isUnlocked && progress.current >= progress.total;
        });
        
        if (readyToUnlock.length > 0) {
            // Показываем уведомление о готовых достижениях
            this.showReadyAchievementsNotification(readyToUnlock.length);
        }
    }
    
    /**
     * 🔔 Показать уведомление о готовых достижениях
     */
    showReadyAchievementsNotification(count) {
        if (this.telegram) {
            this.telegram.showAlert(`У вас ${count} достижений готово к получению! 🎉`);
        }
    }
    
    /**
     * 🔄 Обновление UI
     */
    updateUI() {
        if (!this.isVisible) return;
        
        // Перерендериваем содержимое
        if (this.modal) {
            this.modal.setContent(this.renderContent());
            this.attachEventListeners();
        }
    }
    
    /**
     * 📳 Вибрация через Telegram API
     */
    triggerHaptic(type = 'light') {
        if (this.telegram && this.telegram.HapticFeedback) {
            this.telegram.HapticFeedback.impactOccurred(type);
        }
    }
    
    /**
     * 🧹 Очистка ресурсов
     */
    cleanup() {
        // Очистка при закрытии модального окна
    }
    
    /**
     * 🧹 Полная очистка при уничтожении
     */
    destroy() {
        // Закрываем модальное окно
        this.hide();
        
        // Отписываемся от событий
        this.subscriptions.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.subscriptions = [];
        
        // Очищаем данные
        this.achievements = [];
        this.userStats = {};
        this.modal = null;
    }
}

// 📤 Экспорт класса
window.AchievementsModal = AchievementsModal;