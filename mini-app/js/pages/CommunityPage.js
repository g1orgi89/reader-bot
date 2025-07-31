/**
 * 👥 СООБЩЕСТВО ЧИТАТЕЛЕЙ - CommunityPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ПОЛНОЕ СООТВЕТСТВИЕ КОНЦЕПТУ ИЗ "концепт 5 страниц app.txt":
 * - 3 таба: 📰 Лента, 🏆 Топ недели, 📊 Статистика
 * - MVP версия сообщества
 * - Точная HTML структура из концепта
 * - Все элементы как в макете
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

class CommunityPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.communityLoaded = false;
        this.communityLoading = false;
        
        // Состояние (точно как в концепте)
        this.activeTab = 'feed'; // feed, top, stats
        
        // Данные из концепта
        this.communityData = {
            activeReaders: 127,
            newQuotes: 89,
            totalReaders: 1247,
            totalQuotes: 8156,
            totalAuthors: 342,
            daysActive: 67
        };
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }
    
    setupSubscriptions() {
        // Подписки на изменения состояния, если необходимо
    }
    
    async loadCommunityData() {
        // ✅ ИСПРАВЛЕНО: Предотвращаем дублирующиеся вызовы
        if (this.communityLoading) {
            console.log('🔄 CommunityPage: Сообщество уже загружается, пропускаем');
            return;
        }
        
        try {
            this.communityLoading = true;
            console.log('👥 CommunityPage: Загружаем данные сообщества...');
            
            const stats = await this.api.getCommunityStats();
            if (stats) {
                this.communityData = { ...this.communityData, ...stats };
            }
            
            this.communityLoaded = true;
            this.state.set('community.lastUpdate', Date.now());
            console.log('✅ CommunityPage: Данные сообщества загружены');
            
        } catch (error) {
            console.error('❌ Ошибка загрузки данных сообщества:', error);
            // Используем данные из концепта как fallback
        } finally {
            this.communityLoading = false;
        }
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ТОЧНО ПО КОНЦЕПТУ!) - БЕЗ ШАПКИ!
     */
    render() {
        return `
            <div class="content">
                ${this.renderTabs()}
                ${this.renderTabContent()}
            </div>
        `;
    }
    
    /**
     * 📑 ТАБЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderTabs() {
        return `
            <div class="tabs">
                <button class="tab ${this.activeTab === 'feed' ? 'active' : ''}" data-tab="feed">📰 Лента</button>
                <button class="tab ${this.activeTab === 'top' ? 'active' : ''}" data-tab="top">🏆 Топ недели</button>
                <button class="tab ${this.activeTab === 'stats' ? 'active' : ''}" data-tab="stats">📊 Статистика</button>
            </div>
        `;
    }
    
    renderTabContent() {
        switch (this.activeTab) {
            case 'feed':
                return this.renderFeedTab();
            case 'top':
                return this.renderTopTab();
            case 'stats':
                return this.renderStatsTab();
            default:
                return this.renderFeedTab();
        }
    }
    
    /**
     * 📰 ТАБ ЛЕНТА (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderFeedTab() {
        return `
            <div class="stats-summary">
                📊 Сегодня: ${this.communityData.activeReaders} активных читателей • ${this.communityData.newQuotes} новых цитат
            </div>
            
            <div class="mvp-community-item">
                <div class="mvp-community-title">💫 Цитата дня от сообщества</div>
                <div class="mvp-community-text">"В каждом слове — целая жизнь"</div>
                <div class="mvp-community-author">— Марина Цветаева</div>
            </div>
            
            <div class="mvp-community-item">
                <div class="mvp-community-title">📚 Популярные разборы</div>
                <div class="mvp-community-text">"Искусство любить" — 47 покупок на этой неделе</div>
                <div class="mvp-community-author">Читатели с похожими интересами активно изучают эту тему</div>
            </div>
            
            <div class="mvp-community-item">
                <div class="mvp-community-title">🏆 Достижения недели</div>
                <div class="mvp-community-text">23 читателя получили значок "Коллекционер мудрости"</div>
                <div class="mvp-community-author">А вы уже собрали 50 цитат?</div>
            </div>
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                <div style="font-size: 11px; margin-bottom: 6px;">💬 Сообщение от Анны</div>
                <div style="font-size: 12px; margin-bottom: 6px;">"Дорогие читатели! Ваша активность на этой неделе впечатляет. Продолжайте собирать мудрость каждый день!"</div>
                <div style="font-size: 10px; opacity: 0.8;">2 часа назад</div>
            </div>
            
            <div class="promo-section">
                <div class="promo-title">🎯 Тренд недели</div>
                <div class="promo-text">Тема "Психология отношений" набирает популярность</div>
                <button class="promo-btn" id="exploreBtn">Изучить разборы</button>
            </div>
        `;
    }
    
    /**
     * 🏆 ТАБ ТОП НЕДЕЛИ (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderTopTab() {
        return `
            <div class="community-stats-grid">
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.activeReaders}</div>
                    <div class="community-stat-label">Активных читателей</div>
                </div>
                <div class="community-stat-card">
                    <div class="community-stat-number">${this.communityData.newQuotes}</div>
                    <div class="community-stat-label">Новых цитат</div>
                </div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin-bottom: 16px; text-align: center; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 6px;">🏆 Лидеры недели</div>
                <div style="font-size: 10px; color: var(--text-secondary);">Самые активные читатели сообщества</div>
            </div>
            
            <div class="leaderboard-item">
                <div class="rank-badge gold">1</div>
                <div class="user-info">
                    <div class="user-name">Мария К.</div>
                    <div class="user-stats">23 цитаты за неделю</div>
                    <div class="user-achievement">🔥 "Коллекционер мудрости"</div>
                </div>
            </div>
            
            <div class="leaderboard-item">
                <div class="rank-badge silver">2</div>
                <div class="user-info">
                    <div class="user-name">Анна М. (вы)</div>
                    <div class="user-stats">18 цитат за неделю</div>
                    <div class="user-achievement">📚 "Философ недели"</div>
                </div>
            </div>
            
            <div class="leaderboard-item">
                <div class="rank-badge bronze">3</div>
                <div class="user-info">
                    <div class="user-name">Елена В.</div>
                    <div class="user-stats">15 цитат за неделю</div>
                    <div class="user-achievement">💎 "Мыслитель"</div>
                </div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">⭐ Популярные цитаты недели</div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                    <div style="font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 4px;">"Любовь — это решение любить"</div>
                    <div style="font-size: 10px; color: var(--text-primary); font-weight: 500;">Эрих Фромм • добавили 23 человека</div>
                </div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                    <div style="font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 4px;">"В каждом слове — целая жизнь"</div>
                    <div style="font-size: 10px; color: var(--text-primary); font-weight: 500;">Марина Цветаева • добавили 18 человек</div>
                </div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; border: 1px solid var(--border-light);">
                    <div style="font-size: 10px; color: var(--text-secondary); font-style: italic; margin-bottom: 4px;">"Хорошая жизнь строится, а не дается"</div>
                    <div style="font-size: 10px; color: var(--text-primary); font-weight: 500;">Анна Бусел • добавили 15 человек</div>
                </div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 12px; margin: 16px 0; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--primary-color); margin-bottom: 8px; text-align: center;">📚 Популярные разборы недели</div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                    <div style="font-size: 11px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">1. "Искусство любить" Эрих Фромм</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">💫 47 человек заинтересовалось</div>
                </div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; margin-bottom: 8px; border: 1px solid var(--border-light);">
                    <div style="font-size: 11px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">2. "Быть собой" Анна Бусел</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">💫 31 человек заинтересовалось</div>
                </div>
                
                <div style="background: var(--background-light); border-radius: 8px; padding: 10px; border: 1px solid var(--border-light);">
                    <div style="font-size: 11px; font-weight: 500; color: var(--text-primary); margin-bottom: 2px;">3. "Письма поэту" Рильке</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">💫 23 человека заинтересовалось</div>
                </div>
            </div>
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px; margin-top: 16px;">
                <div style="font-size: 11px; margin-bottom: 6px; font-weight: 600;">🎯 Ваш прогресс в топах</div>
                <div style="font-size: 10px; opacity: 0.9; margin-bottom: 8px;">👑 Читатели: #2 место • ⭐ Цитаты: топ-5 • 📚 Интерес к разборам: активный</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 78%; background: white;"></div>
                </div>
                <div style="font-size: 10px; opacity: 0.9;">Добавьте еще 5 цитат до лидерства!</div>
            </div>
        `;
    }
    
    /**
     * 📊 ТАБ СТАТИСТИКА (ИЗ ДОПОЛНИТЕЛЬНОГО КОНЦЕПТА!)
     */
    renderStatsTab() {
        return `
            <div style="background: var(--surface); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-weight: 600; margin-bottom: 12px; font-size: 13px; color: var(--text-primary); text-align: center;">📈 Общая статистика сообщества</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalReaders.toLocaleString()}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Всего читателей</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalQuotes.toLocaleString()}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Цитат собрано</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.totalAuthors}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Авторов</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: var(--primary-color);">${this.communityData.daysActive}</div>
                        <div style="font-size: 10px; color: var(--text-secondary);">Дней работы</div>
                    </div>
                </div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">📚 Интерес к разборам</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">🔥 Лидер недели: "Искусство любить"</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📈 Рост интереса: +23% к прошлой неделе</div>
                <div style="font-size: 11px; color: var(--text-secondary);">📖 Активно изучают 12 разборов</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">✍️ Популярные авторы в цитатах</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">1. Эрих Фромм — 89 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">2. Анна Бусел — 67 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">3. Марина Цветаева — 45 цитат</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">4. Будда — 34 цитаты</div>
                <div style="font-size: 11px; color: var(--text-secondary);">5. Ошо — 29 цитат</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">🏆 Достижения сообщества</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">🔥 "Коллекционер мудрости" — 23 человека</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📚 "Философ недели" — 15 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">💎 "Мыслитель" — 11 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 6px;">📖 "Любитель классики" — 8 человек</div>
                <div style="font-size: 11px; color: var(--text-secondary);">⭐ "Вдохновитель" — 3 человека</div>
            </div>
            
            <div style="background: var(--surface); border-radius: 10px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--shadow-color);">
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">📊 Ваш рейтинг</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">#2</div>
                        <div style="font-size: 9px; color: var(--text-secondary);">Место в топе</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 16px; font-weight: bold; color: var(--primary-color);">78%</div>
                        <div style="font-size: 9px; color: var(--text-secondary);">Активнее других</div>
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(45deg, var(--primary-color), var(--primary-dark)); color: white; border-radius: 10px; padding: 12px;">
                <div style="font-size: 11px; margin-bottom: 6px; font-weight: 600; text-align: center;">✨ Интересный факт</div>
                <div style="font-size: 10px; opacity: 0.9; text-align: center; line-height: 1.3;">Цитаты Эриха Фромма чаще всего добавляют в избранное в сообществе!</div>
            </div>
        `;
    }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
     */
    attachEventListeners() {
        this.attachTabListeners();
        this.attachExploreButton();
    }
    
    attachTabListeners() {
        const tabs = document.querySelectorAll('.tab[data-tab]');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    attachExploreButton() {
        const exploreBtn = document.getElementById('exploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.telegram.hapticFeedback('medium');
                this.app.router.navigate('/catalog');
            });
        }
    }
    
    switchTab(tabName) {
        this.activeTab = tabName;
        this.telegram.hapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ИСПРАВЛЕНО: БЕЗ ШАПКИ!
     */
    onShow() {
        console.log('👥 CommunityPage: onShow - БЕЗ ШАПКИ!');
        
        // ✅ ИСПРАВЛЕНО: Умная загрузка как в HomePage
        if (!this.communityLoaded) {
            console.log('🔄 CommunityPage: Первый показ, загружаем данные');
            this.loadCommunityData().then(() => {
                this.rerender();
            });
        } else {
            // Проверяем актуальность данных (10 минут)
            const lastUpdate = this.state.get('community.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 CommunityPage: Данные устарели, обновляем');
                this.loadCommunityData().then(() => {
                    this.rerender();
                });
            } else {
                console.log('✅ CommunityPage: Данные актуальны');
            }
        }
    }
    
    onHide() {
        console.log('👥 CommunityPage: onHide');
        // Ничего не делаем - Router управляет шапками
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
        }
    }
    
    destroy() {
        // Очистка ресурсов
        
        // ✅ НОВОЕ: Сброс флагов
        this.communityLoaded = false;
        this.communityLoading = false;
    }
}

// 📤 Экспорт класса
window.CommunityPage = CommunityPage;