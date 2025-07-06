/**
 * @fileoverview JavaScript для страницы отчетов "Читатель"
 * Работа с реальными данными через API
 * @author g1orgi89
 */

/**
 * @typedef {Object} ReportStatistics
 * @property {number} totalReports - Общее количество отчетов
 * @property {number} reportsWithFeedback - Отчеты с обратной связью
 * @property {number} feedbackRate - Процент обратной связи
 * @property {number} averageRating - Средняя оценка
 */

/**
 * @typedef {Object} WeeklyReport
 * @property {string} id - ID отчета
 * @property {string} userId - ID пользователя
 * @property {number} weekNumber - Номер недели
 * @property {number} year - Год
 * @property {number} quotesCount - Количество цитат
 * @property {string} sentAt - Дата отправки
 * @property {boolean} isRead - Прочитан ли отчет
 * @property {Object} feedback - Обратная связь
 * @property {Array<string>} dominantThemes - Доминирующие темы
 * @property {string} emotionalTone - Эмоциональный тон
 */

class ReportsManager {
    constructor() {
        this.currentFilters = {
            type: 'all',
            dateFrom: null,
            dateTo: null,
            userSearch: ''
        };
        this.currentPage = 1;
        this.limit = 20;
        this.baseApiUrl = '/api/reader';
        
        this.init();
    }

    /**
     * Инициализация страницы отчетов
     */
    async init() {
        console.log('📈 Инициализация ReportsManager');
        
        try {
            // Загружаем начальные данные
            await this.loadStatistics();
            await this.loadReports();
            await this.loadSystemStatus();
            
            // Устанавливаем обработчики событий
            this.setupEventListeners();
            
            // Устанавливаем даты по умолчанию
            this.setDefaultDates();
            
            console.log('✅ ReportsManager инициализирован');
        } catch (error) {
            console.error('❌ Ошибка инициализации ReportsManager:', error);
            this.showNotification('error', 'Ошибка загрузки данных отчетов');
        }
    }

    /**
     * Установка обработчиков событий
     */
    setupEventListeners() {
        // Фильтры
        const reportTypeSelect = document.getElementById('report-type');
        const dateFromInput = document.getElementById('date-from');
        const dateToInput = document.getElementById('date-to');
        const userSearchInput = document.getElementById('user-search');

        if (reportTypeSelect) {
            reportTypeSelect.addEventListener('change', () => this.handleFilterChange());
        }

        if (dateFromInput) {
            dateFromInput.addEventListener('change', () => this.handleFilterChange());
        }

        if (dateToInput) {
            dateToInput.addEventListener('change', () => this.handleFilterChange());
        }

        if (userSearchInput) {
            userSearchInput.addEventListener('input', this.debounce(() => this.handleFilterChange(), 500));
        }

        // Кнопки действий
        window.applyFilters = () => this.applyFilters();
        window.resetFilters = () => this.resetFilters();
        window.generateReport = () => this.generateManualReport();
        window.exportReports = () => this.exportReports();
        window.viewReport = (reportId) => this.viewReport(reportId);
        window.resendReport = (reportId) => this.resendReport(reportId);
    }

    /**
     * Загрузка статистики отчетов
     */
    async loadStatistics() {
        try {
            console.log('📊 Загрузка статистики отчетов...');
            
            const response = await fetch(`${this.baseApiUrl}/reports/analytics/overview?days=30`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.updateStatisticsDisplay(result.data);
                console.log('✅ Статистика загружена:', result.data);
            } else {
                throw new Error(result.error || 'Неизвестная ошибка при загрузке статистики');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статистики:', error);
            this.updateStatisticsDisplay(this.getDefaultStatistics());
            this.showNotification('warning', 'Статистика загружена из демо-данных');
        }
    }

    /**
     * Обновление отображения статистики
     * @param {Object} data - Данные статистики
     */
    updateStatisticsDisplay(data) {
        const overview = data.overview || {};
        
        // Обновляем карточки статистики
        this.updateStatCard('.stat-card:nth-child(1) .stat-value', overview.totalReports || 0);
        this.updateStatCard('.stat-card:nth-child(2) .stat-value', this.calculateMonthlyReports(overview.totalReports));
        this.updateStatCard('.stat-card:nth-child(3) .stat-value', `${overview.feedbackRate || 0}%`);
        this.updateStatCard('.stat-card:nth-child(4) .stat-value', overview.averageRating?.toFixed(1) || '0.0');
        
        // Обновляем индикаторы изменений
        this.updateChangeIndicators(overview);
    }

    /**
     * Обновление значения в карточке статистики
     */
    updateStatCard(selector, value) {
        const element = document.querySelector(selector);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Вычисление количества месячных отчетов
     */
    calculateMonthlyReports(totalReports) {
        // Примерно 1/4 от еженедельных отчетов
        return Math.floor((totalReports || 0) / 4);
    }

    /**
     * Обновление индикаторов изменений
     */
    updateChangeIndicators(overview) {
        // Обновляем статус изменений на "Загружено"
        const changeElements = document.querySelectorAll('.stat-change');
        changeElements.forEach(element => {
            element.textContent = 'Обновлено';
            element.className = 'stat-change positive';
        });
    }

    /**
     * Получение статистики по умолчанию
     */
    getDefaultStatistics() {
        return {
            overview: {
                totalReports: 0,
                reportsWithFeedback: 0,
                feedbackRate: 0,
                averageRating: 0
            }
        };
    }

    /**
     * Загрузка списка отчетов
     */
    async loadReports() {
        try {
            console.log('📋 Загрузка отчетов...');
            
            // Строим параметры запроса
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.limit,
                ...this.buildFilterParams()
            });
            
            const response = await fetch(`${this.baseApiUrl}/reports/list?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                await this.updateReportsTable(result.data.reports);
                console.log('✅ Отчеты загружены:', result.data.reports.length);
            } else {
                throw new Error(result.error || 'Неизвестная ошибка при загрузке отчетов');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
            this.showEmptyReportsTable();
            this.showNotification('warning', 'Загружены демо-данные отчетов');
            // Загружаем демо-данные при ошибке
            await this.loadDemoReports();
        }
    }

    /**
     * Загрузка демо-отчетов при ошибке API
     */
    async loadDemoReports() {
        const demoReports = this.generateDemoReports();
        await this.updateReportsTable(demoReports);
    }

    /**
     * Построение параметров фильтра для API
     */
    buildFilterParams() {
        const params = {};
        
        if (this.currentFilters.dateFrom) {
            params.dateFrom = this.currentFilters.dateFrom;
        }
        
        if (this.currentFilters.dateTo) {
            params.dateTo = this.currentFilters.dateTo;
        }
        
        if (this.currentFilters.type && this.currentFilters.type !== 'all') {
            params.type = this.currentFilters.type;
        }
        
        if (this.currentFilters.userSearch.trim()) {
            params.search = this.currentFilters.userSearch.trim();
        }
        
        return params;
    }

    /**
     * Обновление таблицы отчетов
     * @param {Array} reports - Данные отчетов
     */
    async updateReportsTable(reports) {
        const tableBody = document.querySelector('#reports-table tbody');
        if (!tableBody) {
            console.error('❌ Таблица отчетов не найдена');
            return;
        }

        try {
            if (reports.length === 0) {
                this.showEmptyReportsTable();
                return;
            }

            // Строим HTML для отчетов
            const rowsHtml = reports.map(report => this.buildReportRow(report)).join('');
            tableBody.innerHTML = rowsHtml;
            
            console.log(`✅ Отображено ${reports.length} отчетов`);
            
        } catch (error) {
            console.error('❌ Ошибка обновления таблицы отчетов:', error);
            this.showEmptyReportsTable();
        }
    }

    /**
     * Генерация демо-отчетов
     */
    generateDemoReports() {
        const demoReports = [
            {
                id: 'R001',
                userId: 'user1',
                userName: 'Мария К.',
                type: 'weekly',
                period: '21-27 янв 2025',
                quotesCount: 7,
                rating: 5,
                sentAt: '2025-01-28T10:00:00Z',
                status: 'sent',
                dominantThemes: ['Саморазвитие', 'Любовь'],
                emotionalTone: 'positive'
            },
            {
                id: 'R002',
                userId: 'user2',
                userName: 'Елена А.',
                type: 'monthly',
                period: 'Январь 2025',
                quotesCount: 23,
                rating: 4,
                sentAt: '2025-01-31T12:00:00Z',
                status: 'sent',
                dominantThemes: ['Философия', 'Мудрость'],
                emotionalTone: 'thoughtful'
            },
            {
                id: 'R003',
                userId: 'user3',
                userName: 'Анна М.',
                type: 'weekly',
                period: '28 янв - 3 фев 2025',
                quotesCount: 5,
                rating: 5,
                sentAt: '2025-02-04T10:00:00Z',
                status: 'sent',
                dominantThemes: ['Творчество', 'Отношения'],
                emotionalTone: 'positive'
            }
        ];

        return demoReports;
    }

    /**
     * Построение строки таблицы для отчета
     * @param {Object} report - Данные отчета
     */
    buildReportRow(report) {
        const typeBadgeClass = report.type === 'weekly' ? 'weekly' : 'monthly';
        const statusBadgeClass = this.getStatusBadgeClass(report.status);
        const ratingStars = this.buildRatingStars(report.rating);
        const formattedDate = this.formatDate(report.sentAt);

        return `
            <tr>
                <td>#${report.id}</td>
                <td>${this.escapeHtml(report.userName)}</td>
                <td><span class="type-badge ${typeBadgeClass}">${this.getTypeLabel(report.type)}</span></td>
                <td>${this.escapeHtml(report.period)}</td>
                <td>${report.quotesCount}</td>
                <td>${ratingStars}</td>
                <td>${formattedDate}</td>
                <td><span class="status-badge ${statusBadgeClass}">${this.getStatusLabel(report.status)}</span></td>
                <td>
                    <button class="btn btn-sm" onclick="viewReport('${report.id}')">Просмотр</button>
                    <button class="btn btn-sm btn-secondary" onclick="resendReport('${report.id}')">Переслать</button>
                </td>
            </tr>
        `;
    }

    /**
     * Получение класса для статус-бейджа
     */
    getStatusBadgeClass(status) {
        switch (status) {
            case 'sent': return 'status-resolved';
            case 'automated': return 'status-pending';
            default: return 'status-open';
        }
    }

    /**
     * Получение метки типа отчета
     */
    getTypeLabel(type) {
        switch (type) {
            case 'weekly': return 'Еженедельный';
            case 'monthly': return 'Месячный';
            default: return 'Неизвестно';
        }
    }

    /**
     * Получение метки статуса
     */
    getStatusLabel(status) {
        switch (status) {
            case 'sent': return 'Отправлен';
            case 'automated': return 'Автоматический';
            default: return 'Неизвестно';
        }
    }

    /**
     * Построение звезд рейтинга
     */
    buildRatingStars(rating) {
        if (!rating) return '—';
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += i <= rating ? '⭐' : '☆';
        }
        return stars;
    }

    /**
     * Форматирование даты
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    /**
     * Экранирование HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Показ пустой таблицы
     */
    showEmptyReportsTable() {
        const tableBody = document.querySelector('#reports-table tbody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 2rem; color: var(--text-muted);">
                        📭 Отчеты не найдены
                        <br><small>Попробуйте изменить фильтры или создать новый отчет</small>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Загрузка статуса системы
     */
    async loadSystemStatus() {
        try {
            console.log('🔧 Загрузка статуса системы...');
            
            // Загружаем статус Telegram
            const telegramResponse = await fetch(`${this.baseApiUrl}/reports/telegram/status`);
            if (telegramResponse.ok) {
                const telegramResult = await telegramResponse.json();
                if (telegramResult.success) {
                    this.updateTelegramStatus(telegramResult.data);
                }
            }
            
            // Загружаем статус cron
            const cronResponse = await fetch(`${this.baseApiUrl}/reports/cron/status`);
            if (cronResponse.ok) {
                const cronResult = await cronResponse.json();
                if (cronResult.success) {
                    this.updateSystemInfo(cronResult.data);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки статуса системы:', error);
            this.updateTelegramStatus({ botStatus: 'unknown' });
        }
    }

    /**
     * Обновление статуса Telegram
     */
    updateTelegramStatus(data) {
        const statusElement = document.getElementById('telegram-status');
        if (statusElement) {
            switch (data.botStatus) {
                case 'active':
                    statusElement.textContent = '🟢 Активен';
                    break;
                case 'inactive':
                    statusElement.textContent = '🔴 Неактивен';
                    break;
                default:
                    statusElement.textContent = '🟡 Проверка...';
            }
        }
    }

    /**
     * Обновление информации о системе
     */
    updateSystemInfo(data) {
        // Обновляем время последнего отчета
        const lastReportElement = document.getElementById('last-report-time');
        if (lastReportElement && data.moscowTime) {
            lastReportElement.textContent = data.moscowTime;
        }
    }

    /**
     * Установка дат по умолчанию
     */
    setDefaultDates() {
        const today = new Date();
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        
        if (dateFrom && !dateFrom.value) {
            dateFrom.value = monthAgo.toISOString().split('T')[0];
            this.currentFilters.dateFrom = dateFrom.value;
        }
        
        if (dateTo && !dateTo.value) {
            dateTo.value = today.toISOString().split('T')[0];
            this.currentFilters.dateTo = dateTo.value;
        }
    }

    /**
     * Обработка изменения фильтров
     */
    handleFilterChange() {
        this.updateFiltersFromForm();
        // Автоматически применяем фильтры при изменении
        this.loadReports();
    }

    /**
     * Обновление фильтров из формы
     */
    updateFiltersFromForm() {
        const reportType = document.getElementById('report-type')?.value || 'all';
        const dateFrom = document.getElementById('date-from')?.value || '';
        const dateTo = document.getElementById('date-to')?.value || '';
        const userSearch = document.getElementById('user-search')?.value || '';

        this.currentFilters = {
            type: reportType,
            dateFrom: dateFrom,
            dateTo: dateTo,
            userSearch: userSearch
        };
    }

    /**
     * Применение фильтров
     */
    async applyFilters() {
        console.log('📈 Применение фильтров отчетов');
        this.updateFiltersFromForm();
        this.currentPage = 1; // Сбрасываем на первую страницу
        await this.loadReports();
        this.showNotification('info', 'Фильтры применены');
    }

    /**
     * Сброс фильтров
     */
    async resetFilters() {
        console.log('📈 Сброс фильтров');
        
        // Очищаем форму
        const reportType = document.getElementById('report-type');
        const userSearch = document.getElementById('user-search');
        
        if (reportType) reportType.value = 'all';
        if (userSearch) userSearch.value = '';
        
        // Устанавливаем даты по умолчанию
        this.setDefaultDates();
        
        // Сбрасываем фильтры
        this.currentFilters = {
            type: 'all',
            dateFrom: document.getElementById('date-from')?.value || '',
            dateTo: document.getElementById('date-to')?.value || '',
            userSearch: ''
        };
        
        this.currentPage = 1;
        await this.loadReports();
        this.showNotification('info', 'Фильтры сброшены');
    }

    /**
     * Создание нового отчета вручную
     */
    async generateManualReport() {
        console.log('📈 Создание отчета вручную');
        
        try {
            const userId = prompt('Введите ID пользователя для генерации отчета:');
            if (!userId) return;
            
            const response = await fetch(`${this.baseApiUrl}/reports/weekly/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('success', 'Отчет успешно создан и отправлен');
                await this.loadReports();
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
            
        } catch (error) {
            console.error('❌ Ошибка создания отчета:', error);
            this.showNotification('error', 'Ошибка создания отчета: ' + error.message);
        }
    }

    /**
     * Экспорт отчетов
     */
    async exportReports() {
        console.log('📈 Экспорт отчетов');
        this.showNotification('info', 'Функция экспорта отчетов будет добавлена');
    }

    /**
     * Просмотр отчета
     */
    async viewReport(reportId) {
        console.log('📈 Просмотр отчета:', reportId);
        
        try {
            // Пытаемся получить детали отчета
            const response = await fetch(`${this.baseApiUrl}/reports/weekly/details/${reportId}`);
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    this.showReportDetails(result.data);
                    return;
                }
            }
            
            // Если API недоступен, показываем демо-просмотр
            this.showNotification('info', `Просмотр отчета ${reportId} (демо-режим)`);
            
        } catch (error) {
            console.error('❌ Ошибка просмотра отчета:', error);
            this.showNotification('info', `Просмотр отчета ${reportId}`);
        }
    }

    /**
     * Показ деталей отчета
     */
    showReportDetails(reportData) {
        // Здесь можно добавить модальное окно с деталями отчета
        console.log('📋 Детали отчета:', reportData);
        this.showNotification('info', 'Детали отчета загружены');
    }

    /**
     * Повторная отправка отчета
     */
    async resendReport(reportId) {
        console.log('📈 Повторная отправка отчета:', reportId);
        
        try {
            const response = await fetch(`${this.baseApiUrl}/reports/telegram/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reportId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showNotification('success', `Отчет ${reportId} отправлен повторно`);
            } else {
                throw new Error(result.error || 'Ошибка отправки');
            }
            
        } catch (error) {
            console.error('❌ Ошибка повторной отправки:', error);
            this.showNotification('error', `Ошибка отправки отчета: ${error.message}`);
        }
    }

    /**
     * Показ уведомления
     */
    showNotification(type, message) {
        if (typeof window.showNotification === 'function') {
            window.showNotification(type, message);
        } else {
            console.log(`Notification: ${type} - ${message}`);
        }
    }

    /**
     * Debounce функция
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.reportsManager = new ReportsManager();
});

// Экспорт для использования в других скриптах
window.ReportsManager = ReportsManager;
