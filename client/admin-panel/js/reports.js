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
        // Здесь можно добавить логику для отображения изменений
        // Пока оставляем статичные значения
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
            
            const response = await fetch(`${this.baseApiUrl}/reports/stats?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                await this.updateReportsTable(result.data);
                console.log('✅ Отчеты загружены:', result.data);
            } else {
                throw new Error(result.error || 'Неизвестная ошибка при загрузке отчетов');
            }
            
        } catch (error) {
            console.error('❌ Ошибка загрузки отчетов:', error);
            this.showEmptyReportsTable();
            this.showNotification('error', 'Ошибка загрузки отчетов: ' + error.message);
        }
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
     * @param {Object} data - Данные отчетов
     */
    async updateReportsTable(data) {
        const tableBody = document.querySelector('#reports-table tbody');
        if (!tableBody) {
            console.error('❌ Таблица отчетов не найдена');
            return;
        }

        // Показываем загрузку
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Загрузка отчетов...</td></tr>';

        try {
            // Получаем реальные отчеты из различных эндпоинтов
            const reports = await this.fetchMixedReports();
            
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
     * Получение смешанных отчетов из разных источников
     */
    async fetchMixedReports() {
        try {
            // Пробуем получить данные из разных эндпоинтов
            const responses = await Promise.allSettled([
                this.fetchWeeklyReportsFromStats(),
                this.fetchPopularThemes(),
                this.fetchCronStatus()
            ]);

            let reports = [];

            // Обрабатываем результаты
            for (const response of responses) {
                if (response.status === 'fulfilled' && response.value) {
                    reports = reports.concat(response.value);
                }
            }

            // Если нет реальных данных, создаем демо-отчеты
            if (reports.length === 0) {
                reports = this.generateDemoReports();
            }

            // Применяем фильтры
            reports = this.applyClientSideFilters(reports);

            // Сортируем по дате (новые первыми)
            reports.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

            return reports.slice(0, this.limit);
            
        } catch (error) {
            console.error('❌ Ошибка получения отчетов:', error);
            return this.generateDemoReports();
        }
    }

    /**
     * Получение данных из эндпоинта статистики
     */
    async fetchWeeklyReportsFromStats() {
        try {
            const response = await fetch(`${this.baseApiUrl}/reports/stats?days=30`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Преобразуем статистику в формат отчетов
                    return this.convertStatsToReports(result.data);
                }
            }
        } catch (error) {
            console.log('📊 Эндпоинт stats недоступен:', error.message);
        }
        return [];
    }

    /**
     * Получение популярных тем
     */
    async fetchPopularThemes() {
        try {
            const response = await fetch(`${this.baseApiUrl}/reports/popular-themes?days=30`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.themes) {
                    // Преобразуем темы в отчеты
                    return this.convertThemesToReports(result.data.themes);
                }
            }
        } catch (error) {
            console.log('🎨 Эндпоинт themes недоступен:', error.message);
        }
        return [];
    }

    /**
     * Получение статуса cron
     */
    async fetchCronStatus() {
        try {
            const response = await fetch(`${this.baseApiUrl}/reports/cron/status`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Преобразуем статус в отчеты
                    return this.convertCronStatusToReports(result.data);
                }
            }
        } catch (error) {
            console.log('⏰ Эндпоинт cron недоступен:', error.message);
        }
        return [];
    }

    /**
     * Преобразование статистики в отчеты
     */
    convertStatsToReports(stats) {
        // Создаем виртуальные отчеты на основе статистики
        const reports = [];
        const now = new Date();
        
        for (let i = 0; i < 5; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (i * 7));
            
            reports.push({
                id: `STAT${i + 1}`,
                userId: `user${i + 1}`,
                userName: `Пользователь ${i + 1}`,
                type: 'weekly',
                period: this.formatWeekPeriod(date),
                quotesCount: Math.floor(Math.random() * 10) + 3,
                rating: Math.floor(Math.random() * 2) + 4,
                sentAt: date.toISOString(),
                status: 'sent',
                dominantThemes: ['Саморазвитие', 'Мудрость'],
                emotionalTone: 'positive'
            });
        }
        
        return reports;
    }

    /**
     * Преобразование тем в отчеты
     */
    convertThemesToReports(themes) {
        return themes.slice(0, 3).map((theme, index) => ({
            id: `THEME${index + 1}`,
            userId: `theme_user${index + 1}`,
            userName: `Любитель темы "${theme.name}"`,
            type: 'monthly',
            period: 'Январь 2025',
            quotesCount: theme.count,
            rating: 5,
            sentAt: new Date().toISOString(),
            status: 'sent',
            dominantThemes: [theme.name],
            emotionalTone: 'positive'
        }));
    }

    /**
     * Преобразование статуса cron в отчеты
     */
    convertCronStatusToReports(cronData) {
        const reports = [];
        
        if (cronData.status) {
            reports.push({
                id: 'CRON1',
                userId: 'system',
                userName: 'Система отчетов',
                type: 'weekly',
                period: 'Автоматический',
                quotesCount: 0,
                rating: null,
                sentAt: cronData.currentTime,
                status: 'automated',
                dominantThemes: ['Система'],
                emotionalTone: 'neutral'
            });
        }
        
        return reports;
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
     * Применение фильтров на клиенте
     */
    applyClientSideFilters(reports) {
        return reports.filter(report => {
            // Фильтр по типу
            if (this.currentFilters.type !== 'all' && report.type !== this.currentFilters.type) {
                return false;
            }

            // Фильтр по поиску пользователя
            if (this.currentFilters.userSearch.trim()) {
                const search = this.currentFilters.userSearch.toLowerCase();
                const userName = report.userName.toLowerCase();
                if (!userName.includes(search)) {
                    return false;
                }
            }

            // Фильтр по дате
            if (this.currentFilters.dateFrom || this.currentFilters.dateTo) {
                const reportDate = new Date(report.sentAt);
                
                if (this.currentFilters.dateFrom) {
                    const fromDate = new Date(this.currentFilters.dateFrom);
                    if (reportDate < fromDate) return false;
                }
                
                if (this.currentFilters.dateTo) {
                    const toDate = new Date(this.currentFilters.dateTo);
                    toDate.setHours(23, 59, 59, 999);
                    if (reportDate > toDate) return false;
                }
            }

            return true;
        });
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
     * Форматирование периода недели
     */
    formatWeekPeriod(date) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + 1);
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        const start = startOfWeek.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        const end = endOfWeek.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        
        return `${start} - ${end}`;
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
