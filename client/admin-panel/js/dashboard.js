/**
 * JavaScript для дашборда админ-панели "Читатель"
 * Аналитика цитат и пользователей
 */

/**
 * Класс для управления дашбордом Reader
 */
class ReaderDashboard {
    constructor() {
        this.currentPeriod = '7d';
        this.charts = {};
        this.init();
    }

    /**
     * Инициализация дашборда
     */
    async init() {
        console.log('📖 Инициализация дашборда Reader');
        
        try {
            await this.loadDashboardData();
            this.setupEventListeners();
            this.startAutoRefresh();
        } catch (error) {
            console.error('📖 Ошибка инициализации дашборда:', error);
            this.showError('Ошибка инициализации дашборда');
        }
    }

    /**
     * Загрузка данных дашборда
     */
    async loadDashboardData() {
        console.log('📖 Загрузка данных дашборда');
        
        try {
            const [dashboardStats, retentionData, topContent] = await Promise.all([
                this.fetchDashboardStats(),
                this.fetchRetentionData(),
                this.fetchTopContent()
            ]);

            this.updateStatCards(dashboardStats.overview);
            this.updateSourceChart(dashboardStats.sourceStats);
            this.updateUTMChart(dashboardStats.utmStats);
            this.updateRetentionChart(retentionData);
            this.updateTopContent(topContent);

        } catch (error) {
            console.error('📖 Ошибка загрузки данных:', error);
            this.showError('Ошибка загрузки данных дашборда');
        }
    }

    /**
     * Получение статистики дашборда
     */
    async fetchDashboardStats() {
        try {
            const response = await fetch(`/api/analytics/dashboard?period=${this.currentPeriod}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('📖 Ошибка получения статистики:', error);
            // Возвращаем заглушку для демонстрации
            return this.getMockDashboardStats();
        }
    }

    /**
     * Получение данных retention
     */
    async fetchRetentionData() {
        try {
            const response = await fetch('/api/analytics/retention');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('📖 Ошибка получения retention:', error);
            return this.getMockRetentionData();
        }
    }

    /**
     * Получение топ контента
     */
    async fetchTopContent() {
        try {
            const response = await fetch(`/api/analytics/top-content?period=${this.currentPeriod}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('📖 Ошибка получения топ контента:', error);
            return this.getMockTopContent();
        }
    }

    /**
     * Обновление карточек статистики
     */
    updateStatCards(stats) {
        const statElements = {
            'total-users-count': stats.totalUsers || 0,
            'new-users-count': stats.newUsers || 0,
            'total-quotes-count': stats.totalQuotes || 0,
            'avg-quotes-count': stats.avgQuotesPerUser || 0,
            'active-users-count': stats.activeUsers || 0,
            'promo-usage-count': stats.promoUsage || 0
        };

        Object.entries(statElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = this.formatNumber(value);
                element.classList.add('stat-updated');
            }
        });

        this.updateChangeIndicators(stats);
    }

    /**
     * Обновление индикаторов изменений
     */
    updateChangeIndicators(stats) {
        const changes = {
            'users-change': stats.usersChange || 0,
            'new-users-change': stats.newUsersChange || 0,
            'quotes-change': stats.quotesChange || 0,
            'avg-quotes-change': stats.avgQuotesChange || 0,
            'active-users-change': stats.activeUsersChange || 0,
            'promo-usage-change': stats.promoUsageChange || 0
        };

        Object.entries(changes).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                const sign = value >= 0 ? '+' : '';
                element.textContent = `${sign}${value}% к прошлому периоду`;
                element.className = `stat-change ${value >= 0 ? 'positive' : 'negative'}`;
            }
        });
    }

    /**
     * Обновление диаграммы источников
     */
    updateSourceChart(sourceStats) {
        const ctx = document.getElementById('sourceChart');
        if (!ctx) return;

        if (this.charts.source) {
            this.charts.source.destroy();
        }

        this.charts.source = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sourceStats.map(s => s._id || 'Неизвестно'),
                datasets: [{
                    data: sourceStats.map(s => s.count),
                    backgroundColor: [
                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                family: 'Inter',
                                size: 12
                            },
                            padding: 20
                        }
                    }
                }
            }
        });
    }

    /**
     * Обновление диаграммы UTM кампаний
     */
    updateUTMChart(utmStats) {
        const ctx = document.getElementById('utmChart');
        if (!ctx || !utmStats.length) return;

        if (this.charts.utm) {
            this.charts.utm.destroy();
        }

        this.charts.utm = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: utmStats.map(u => u.campaign),
                datasets: [
                    {
                        label: 'Клики',
                        data: utmStats.map(u => u.clicks),
                        backgroundColor: '#4ECDC4',
                        borderColor: '#4ECDC4',
                        borderWidth: 1
                    },
                    {
                        label: 'Уникальные пользователи',
                        data: utmStats.map(u => u.uniqueUsers),
                        backgroundColor: '#45B7D1',
                        borderColor: '#45B7D1',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Обновление диаграммы retention
     */
    updateRetentionChart(retentionData) {
        const ctx = document.getElementById('retentionChart');
        if (!ctx || !retentionData.length) return;

        if (this.charts.retention) {
            this.charts.retention.destroy();
        }

        this.charts.retention = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'],
                datasets: retentionData.slice(-6).map((cohort, index) => ({
                    label: cohort.cohort,
                    data: [cohort.week1, cohort.week2, cohort.week3, cohort.week4],
                    borderColor: this.getRetentionColor(index),
                    backgroundColor: this.getRetentionColor(index, 0.1),
                    tension: 0.1,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                family: 'Inter',
                                size: 12
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                family: 'Inter',
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Обновление топ контента
     */
    updateTopContent(topContent) {
        // Топ авторы
        const authorsContainer = document.getElementById('top-authors');
        if (authorsContainer && topContent.topAuthors) {
            authorsContainer.innerHTML = topContent.topAuthors.map((author, index) => `
                <div class="top-item">
                    <span class="rank">${index + 1}</span>
                    <span class="name">${author._id}</span>
                    <span class="count">${author.count} цитат</span>
                </div>
            `).join('');
        }

        // Топ категории
        const categoriesContainer = document.getElementById('top-categories');
        if (categoriesContainer && topContent.topCategories) {
            categoriesContainer.innerHTML = topContent.topCategories.map((category, index) => `
                <div class="top-item">
                    <span class="rank">${index + 1}</span>
                    <span class="name">${category._id}</span>
                    <span class="count">${category.count} цитат</span>
                </div>
            `).join('');
        }

        // Популярные цитаты
        const quotesContainer = document.getElementById('popular-quotes');
        if (quotesContainer && topContent.popularQuotes) {
            quotesContainer.innerHTML = topContent.popularQuotes.map((quote, index) => `
                <div class="popular-quote">
                    <div class="quote-text">"${quote._id.substring(0, 100)}..."</div>
                    <div class="quote-meta">
                        ${quote.author ? `— ${quote.author}` : ''} 
                        <span class="usage-count">(${quote.count} раз)</span>
                    </div>
                </div>
            `).join('');
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Переключение периода
        const periodSelect = document.getElementById('date-range');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                this.currentPeriod = e.target.value;
                this.loadDashboardData();
            });
        }

        // Экспорт данных
        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }
    }

    /**
     * Автоматическое обновление
     */
    startAutoRefresh() {
        // Обновление каждые 5 минут
        setInterval(() => {
            this.loadDashboardData();
        }, 5 * 60 * 1000);
    }

    /**
     * Получение цвета для retention графика
     */
    getRetentionColor(index, alpha = 1) {
        const colors = [
            `rgba(255, 107, 107, ${alpha})`,
            `rgba(78, 205, 196, ${alpha})`,
            `rgba(69, 183, 209, ${alpha})`,
            `rgba(150, 206, 180, ${alpha})`,
            `rgba(255, 234, 167, ${alpha})`,
            `rgba(221, 160, 221, ${alpha})`
        ];
        return colors[index % colors.length];
    }

    /**
     * Форматирование чисел
     */
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    /**
     * Показ ошибки
     */
    showError(message) {
        if (typeof showNotification === 'function') {
            showNotification('error', message);
        } else {
            console.error('📖 Ошибка:', message);
        }
    }

    /**
     * Экспорт данных
     */
    async exportData() {
        try {
            const data = await this.fetchDashboardStats();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reader-analytics-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            this.showError('Ошибка экспорта данных');
        }
    }

    /**
     * Мок данные для демонстрации
     */
    getMockDashboardStats() {
        return {
            overview: {
                totalUsers: 1247,
                newUsers: 156,
                totalQuotes: 8734,
                avgQuotesPerUser: 7.2,
                activeUsers: 423,
                promoUsage: 89,
                usersChange: 12,
                newUsersChange: 8,
                quotesChange: 15,
                avgQuotesChange: 3,
                activeUsersChange: 18,
                promoUsageChange: 22
            },
            sourceStats: [
                { _id: 'Instagram', count: 456 },
                { _id: 'Telegram', count: 234 },
                { _id: 'YouTube', count: 189 },
                { _id: 'Threads', count: 167 },
                { _id: 'Друзья', count: 134 },
                { _id: 'Другое', count: 67 }
            ],
            utmStats: [
                { campaign: 'weekly_report', clicks: 1234, uniqueUsers: 567 },
                { campaign: 'monthly_analysis', clicks: 987, uniqueUsers: 456 },
                { campaign: 'book_recommendations', clicks: 765, uniqueUsers: 234 }
            ]
        };
    }

    /**
     * Мок данные retention
     */
    getMockRetentionData() {
        return [
            { cohort: '2024-12', size: 234, week1: 89, week2: 67, week3: 52, week4: 45 },
            { cohort: '2025-01', size: 345, week1: 92, week2: 71, week3: 58, week4: 48 },
            { cohort: '2025-02', size: 456, week1: 94, week2: 76, week3: 63, week4: 52 },
            { cohort: '2025-03', size: 567, week1: 96, week2: 78, week3: 65, week4: 54 },
            { cohort: '2025-04', size: 678, week1: 98, week2: 81, week3: 68, week4: 58 },
            { cohort: '2025-05', size: 789, week1: 97, week2: 83, week3: 72, week4: 62 }
        ];
    }

    /**
     * Мок данные топ контента
     */
    getMockTopContent() {
        return {
            topAuthors: [
                { _id: 'Лев Толстой', count: 234 },
                { _id: 'Эрих Фромм', count: 189 },
                { _id: 'Марина Цветаева', count: 156 },
                { _id: 'Фёдор Достоевский', count: 134 },
                { _id: 'Антон Чехов', count: 98 }
            ],
            topCategories: [
                { _id: 'Саморазвитие', count: 1234 },
                { _id: 'Любовь', count: 967 },
                { _id: 'Мудрость', count: 723 },
                { _id: 'Философия', count: 567 },
                { _id: 'Творчество', count: 345 }
            ],
            popularQuotes: [
                { _id: 'В каждом слове — целая жизнь', author: 'Марина Цветаева', count: 12 },
                { _id: 'Любовь — это решение любить', author: 'Эрих Фромм', count: 8 },
                { _id: 'Счастье внутри нас', author: 'Будда', count: 6 },
                { _id: 'Жизнь — это путешествие', author: null, count: 4 }
            ]
        };
    }
}

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReaderDashboard;
}