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
        
        // Alice badge state
        this.aliceProgress = null;
        this.aliceLoading = false;
        
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
        
        // Subscribe to app-wide events for real-time Alice progress updates
        if (this.app && this.app.on) {
            // Quote added event
            this.app.on('quote:added', () => {
                console.log('📖 Quote added, refreshing Alice progress...');
                this.refreshAliceProgress();
            });
            
            // Like changed event
            this.app.on('like:changed', () => {
                console.log('❤️ Like changed, refreshing Alice progress...');
                this.refreshAliceProgress();
            });
            
            // Follow changed event
            this.app.on('follow:changed', () => {
                console.log('👥 Follow changed, refreshing Alice progress...');
                this.refreshAliceProgress();
            });
            
            // Photo uploaded event
            this.app.on('photo:uploaded', () => {
                console.log('📸 Photo uploaded, refreshing Alice progress...');
                this.refreshAliceProgress();
            });
        }
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
                ${this.renderAliceBadgeSection()}
                ${this.renderEarnedAchievements()}
                ${this.renderError()}
            </div>
        `;
    }
    
    /**
     * 📋 Рендер заголовка страницы
     */
    renderHeader() {
        // Alice-based header: show "0 из 1" when not completed, "1 из 1" when completed
        const completed = this.aliceProgress?.completed ? 1 : 0;
        const total = 1;
        
        return `
            <div class="page-header">
                <h1>Достижения</h1>
                <p>Ваши награды (${completed} из ${total})</p>
            </div>
        `;
    }
    
    /**
     * 🎖️ Рендер секции Alice Badge
     */
    renderAliceBadgeSection() {
        if (this.aliceLoading) {
            return `
                <div class="alice-badge-section">
                    <div class="alice-badge-header">
                        <div class="alice-badge-title-wrapper">
                            <img src="/assets/badges/alice.png" alt="Alice Badge" class="alice-badge-image" loading="lazy" onerror="this.style.display='none'">
                            <h3>Бейдж «Алиса в стране чудес»</h3>
                        </div>
                    </div>
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p>Загрузка прогресса...</p>
                    </div>
                </div>
            `;
        }
        
        if (!this.aliceProgress) {
            return '';
        }
        
        const { 
            photos = { current: 0, required: 10 },
            following = { current: 0, required: 5 },
            likesGivenToOthers = { current: 0, required: 10 },
            streak = { current: 0, required: 30 },
            completed = false
        } = this.aliceProgress;
        
        const progressItems = [
            {
                label: '10 фото в рубрику «книжный кадр»',
                current: photos.current,
                required: photos.required,
                remaining: Math.max(0, photos.required - photos.current)
            },
            {
                label: '5 подписок на книжных друзей',
                current: following.current,
                required: following.required,
                remaining: Math.max(0, following.required - following.current)
            },
            {
                label: '10 лайков цитат сообщества',
                current: likesGivenToOthers.current,
                required: likesGivenToOthers.required,
                remaining: Math.max(0, likesGivenToOthers.required - likesGivenToOthers.current)
            },
            {
                label: 'непрерывная серия 30 дней',
                current: streak.current,
                required: streak.required,
                remaining: Math.max(0, streak.required - streak.current)
            }
        ];
        
        return `
            <div class="alice-badge-section">
                <div class="alice-badge-header">
                    <div class="alice-badge-title-wrapper">
                        <img src="/assets/badges/alice.png" alt="Alice Badge" class="alice-badge-image" loading="lazy" onerror="this.style.display='none'">
                        <h3>Бейдж «Алиса в стране чудес»</h3>
                    </div>
                </div>
                <p class="alice-badge-description">Выполните все условия для получения доступа к аудиоразбору</p>
                
                <div class="alice-progress-list">
                    ${progressItems.map(item => {
                        const widthPercent = Math.min(100, (item.current / item.required) * 100);
                        const isCompleted = item.remaining === 0;
                        const completedClass = isCompleted ? ' completed' : '';
                        return `
                        <div class="alice-progress-item${completedClass}">
                            <div class="alice-progress-header">
                                <span class="alice-progress-label">${item.label}</span>
                                <span class="alice-progress-counter">${item.current}/${item.required}</span>
                            </div>
                            <div class="alice-progress-bar">
                                <div class="alice-progress-fill" style="width: ${widthPercent}%"></div>
                            </div>
                            <div class="alice-progress-remaining">
                                ${item.remaining > 0 ? `Осталось ${item.remaining}` : '✓ Выполнено'}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
                
                <button 
                    class="alice-claim-button" 
                    id="aliceClaimButton"
                    ${!completed ? 'disabled' : ''}
                >
                    ${completed ? 'Получить доступ к разбору «Алиса»' : 'Выполните все условия'}
                </button>
            </div>
        `;
    }
    
    /**
     * 🏆 Рендер полученных наград (только разблокированные)
     */
    renderEarnedAchievements() {
        const unlockedAchievements = this.achievements.filter(a => a.unlocked);
        
        if (unlockedAchievements.length === 0) {
            return '';
        }
        
        return `
            <div class="achievements-section">
                <h3>🏆 Полученные награды</h3>
                <div class="achievements-grid">
                    ${unlockedAchievements.map(achievement => this.renderAchievementItem(achievement, true)).join('')}
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
     * 📊 Загрузка прогресса Alice Badge
     */
    async loadAliceProgress() {
        if (this.aliceLoading) return;
        
        try {
            this.aliceLoading = true;
            
            // Get current userId
            let userId = null;
            if (this.state && typeof this.state.getCurrentUserId === 'function') {
                userId = this.state.getCurrentUserId();
            } else if (this.state && this.state.get) {
                userId = this.state.get('user.profile.id') || this.state.get('user.telegramData.id');
            }
            
            // Build URL with userId query param to avoid demo-user fallback
            const url = userId && userId !== 'demo-user'
                ? `/api/reader/gamification/progress/alice?userId=${encodeURIComponent(userId)}`
                : '/api/reader/gamification/progress/alice';
            
            // Fetch Alice progress from backend
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const data = await response.json();
            this.aliceProgress = data;
            
        } catch (error) {
            console.warn('⚠️ Failed to load Alice progress:', error);
            // Set fallback data
            this.aliceProgress = {
                photos: { current: 0, required: 10 },
                following: { current: 0, required: 5 },
                likesGivenToOthers: { current: 0, required: 10 },
                streak: { current: 0, required: 30 },
                completed: false
            };
        } finally {
            this.aliceLoading = false;
        }
    }
    
    /**
     * 🔄 Refresh Alice progress (for manual or event-triggered updates)
     */
    async refreshAliceProgress() {
        if (this.aliceLoading) return;
        
        try {
            // Fetch latest progress
            await this.loadAliceProgress();
            
            // Update the Alice section only
            const aliceSection = document.querySelector('.alice-badge-section');
            if (aliceSection) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = this.renderAliceBadgeSection();
                const newAliceSection = tempDiv.firstElementChild;
                
                if (newAliceSection) {
                    aliceSection.replaceWith(newAliceSection);
                    
                    // Re-attach event listener for the Alice claim button
                    const aliceClaimButton = document.getElementById('aliceClaimButton');
                    if (aliceClaimButton) {
                        aliceClaimButton.addEventListener('click', () => {
                            this.handleAliceClaimClick();
                        });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to refresh Alice progress:', error);
        }
    }
    
    /**
     * 🎖️ Обработчик клика по кнопке получения Alice Badge
     */
    async handleAliceClaimClick() {
        if (!this.aliceProgress?.completed) {
            return;
        }
        
        try {
            // Haptic feedback
            if (this.telegram?.hapticFeedback) {
                this.telegram.hapticFeedback('medium');
            }
            
            // POST request to claim badge
            const response = await fetch('/api/reader/gamification/alice/claim', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Show success alert
                const message = 'Бейдж «Алиса» получен! Доступ открыт на 30 дней.';
                if (this.telegram?.showAlert) {
                    this.telegram.showAlert(message);
                } else {
                    alert(message);
                }
                
                // Navigate to free audios page
                setTimeout(() => {
                    if (this.app?.router) {
                        this.app.router.navigate('/free-audios');
                    } else {
                        window.location.hash = '#/free-audios';
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('❌ Failed to claim Alice badge:', error);
            const errorMsg = 'Ошибка при получении бейджа. Попробуйте позже.';
            if (this.telegram?.showAlert) {
                this.telegram.showAlert(errorMsg);
            } else {
                alert(errorMsg);
            }
        }
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
        
        // Alice claim button handler
        const aliceClaimButton = document.getElementById('aliceClaimButton');
        if (aliceClaimButton) {
            aliceClaimButton.addEventListener('click', () => {
                this.handleAliceClaimClick();
            });
        }
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
    async onShow() {
        console.log('🏆 AchievementsPage: onShow');
        // Refresh data if needed
        if (this.achievements.length === 0) {
            await this.loadAchievementsData();
        }
        
        // Load Alice progress
        await this.loadAliceProgress();
        
        // Re-render the page content
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
        
        // Start short-lived polling fallback (3s interval for 15s)
        this.startPolling();
    }
    
    /**
     * 🔄 Start short-lived polling for Alice progress
     * Polls every 3 seconds for 15 seconds after page show
     */
    startPolling() {
        // Clear any existing polling
        this.stopPolling();
        
        let pollCount = 0;
        const maxPolls = 5; // 5 polls * 3 seconds = 15 seconds
        
        this.pollingInterval = setInterval(async () => {
            pollCount++;
            console.log(`🔄 Polling Alice progress (${pollCount}/${maxPolls})...`);
            
            await this.refreshAliceProgress();
            
            if (pollCount >= maxPolls) {
                console.log('✅ Polling complete');
                this.stopPolling();
            }
        }, 3000); // Poll every 3 seconds
    }
    
    /**
     * 🛑 Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    /**
     * Вызывается при скрытии страницы
     */
    onHide() {
        console.log('🏆 AchievementsPage: onHide');
        // Stop polling when leaving the page
        this.stopPolling();
    }
}

// 📤 Экспорт класса
window.AchievementsPage = AchievementsPage;