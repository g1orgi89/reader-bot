/**
 * 📚 КАТАЛОГ - CatalogPage.js (ИСПРАВЛЕНО - БЕЗ ШАПКИ!)
 * 
 * ✅ ИСПОЛЬЗУЕТ ПРАВИЛЬНУЮ СТРУКТУРУ:
 * - Убрана лишняя обертка .page
 * - Контент рендерится прямо как .content (как в ReportsPage)
 * - Правильная работа скролла и навигации
 * 
 * ✅ ИСПРАВЛЕНО: БЕЗ ШАПКИ СВЕРХУ - ЧИСТЫЙ ДИЗАЙН!
 * ✅ ИСПРАВЛЕНО: Устранены дублирующиеся API вызовы как в HomePage и DiaryPage
 */

// 14 витринных категорий каталога (точно как в бэкенде)
const CATALOG_CATEGORIES = [
  'КРИЗИСЫ',
  'Я — ЖЕНЩИНА',
  'ЛЮБОВЬ',
  'ОТНОШЕНИЯ',
  'ДЕНЬГИ',
  'ОДИНОЧЕСТВО',
  'СМЕРТЬ',
  'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
  'СМЫСЛ ЖИЗНИ',
  'СЧАСТЬЕ',
  'ВРЕМЯ И ПРИВЫЧКИ',
  'ДОБРО И ЗЛО',
  'ОБЩЕСТВО',
  'ПОИСК СЕБЯ'
];

class CatalogPage {
    constructor(app) {
        this.app = app;
        this.api = app.api;
        this.state = app.state;
        this.telegram = app.telegram;
        this.query = app.initialState?.query || {};
        
        // ✅ НОВОЕ: Флаги для предотвращения дублирующихся загрузок
        this.catalogLoaded = false;
        this.catalogLoading = false;
        
        // ✅ НОВОЕ: Поддержка отложенного highlight
        this.pendingHighlight = this.query.highlight || null;
        this.highlightApplied = false;
        
        // Состояние фильтров (14 категорий + ВСЕ)
        // Set initial filter from query parameters
        this.activeFilter = this.query.category ? this.mapQueryCategoryToFilter(this.query.category) : 'ПАКЕТЫ';
        this.searchQuery = '';
        this.showSearch = false;
        
        // Примеры данных (точно из концепта)
        this.userTags = ['Психология', 'Отношения', 'Саморазвитие'];
        this.books = [];
        
        // Top week IDs для бейджей
        this.topWeekIds = [];
        
        this.init();
    }
    
    init() {
        this.setupSubscriptions();
        // ✅ ИСПРАВЛЕНО: Убрана автозагрузка из init()
    }
    
    setupSubscriptions() {
        // Подписка на изменения топ недели IDs
        this.state.subscribe('catalog.topWeekIds', (topWeekData) => {
            if (topWeekData && topWeekData.ids) {
                console.log('📚 CatalogPage: Получены топ недели IDs:', topWeekData.ids);
                this.topWeekIds = topWeekData.ids;
                // Перерендер если каталог уже загружен
                if (this.catalogLoaded) {
                    this.rerender();
                }
            }
        });
        
        // Подписка на профиль для отложенной загрузки персонализации
        this.state.subscribe('user.profile', (profile) => {
            if (profile && profile.id && this.userTags.length === 0 && this.catalogLoaded) {
                console.log('📚 CatalogPage: Profile ready, loading personalization');
                this.loadPersonalizationTopics().then(() => {
                    this.rerender();
                });
            }
        });
    }
    
    async loadCatalogData() {
        // Защита от повторных вызовов
        if (this.catalogLoading) {
            console.log('🔄 CatalogPage: Каталог уже загружается, пропускаем');
            return;
        }
    
        try {
            this.catalogLoading = true;
            console.log('📚 CatalogPage: Загружаем данные каталога (main + packages)...');
    
            // Основные опции для общего запроса
            const mainOptions = { limit: 100 };
            if (this.query.category) mainOptions.category = this.query.category;
    
            // Явный пакетный запрос, чтобы гарантированно получить пакеты
            const packageOptions = { limit: 100, type: 'package' };
    
            // Параллельно делаем оба запроса. Если сервер не поддерживает type, второй вернёт пустой набор.
            const [mainSettled, packagesSettled] = await Promise.allSettled([
                this.api.getCatalog ? this.api.getCatalog(mainOptions) : this.api.getBookCatalog(mainOptions),
                this.api.getCatalog ? this.api.getCatalog(packageOptions) : this.api.getBookCatalog(packageOptions)
            ]);
    
            let mainBooks = [];
            let packageBooks = [];
    
            if (mainSettled.status === 'fulfilled' && mainSettled.value) {
                const r = mainSettled.value;
                if (r.success && Array.isArray(r.books)) mainBooks = r.books;
                else if (Array.isArray(r.data?.books)) mainBooks = r.data.books;
            } else {
                console.warn('⚠️ CatalogPage: Ошибка загрузки основной выдачи:', mainSettled.reason);
            }
    
            if (packagesSettled.status === 'fulfilled' && packagesSettled.value) {
                const r = packagesSettled.value;
                if (r.success && Array.isArray(r.books)) packageBooks = r.books;
                else if (Array.isArray(r.data?.books)) packageBooks = r.data.books;
                else if (Array.isArray(r.data)) packageBooks = r.data;
            } else {
                console.warn('⚠️ CatalogPage: Ошибка загрузки пакетов:', packagesSettled.reason);
            }
    
            // Merge + dedupe по id / _id / bookSlug / packageSlug
            const merged = [];
            const seen = new Set();
            const pushUnique = (item) => {
                const key = String(item.id || item._id || item.bookSlug || item.packageSlug || '').trim();
                if (!key) return;
                if (seen.has(key)) return;
                seen.add(key);
                merged.push(item);
            };
    
            // Сохраняем порядок mainBooks (priority), затем дополняем пакетами, чтобы гарантировать их присутствие
            for (const b of mainBooks) pushUnique(b);
            for (const b of packageBooks) pushUnique(b);
    
            // Конвертируем API объекты в UI формат
            this.books = merged.map(book => this.convertApiBookToDisplayFormat(book));
    
            // СОРТИРОВКА: Топ-3 недели отображаются первыми (как было)
            this.books.sort((a, b) => {
                const aIsTopWeek = a.badgeList?.some(x => x.type === 'top-week') || false;
                const bIsTopWeek = b.badgeList?.some(x => x.type === 'top-week') || false;
                if (aIsTopWeek && !bIsTopWeek) return -1;
                if (!aIsTopWeek && bIsTopWeek) return 1;
                return 0;
            });
            
            // НОВОЕ: индекс для быстрого lookup bookSlug -> doc
            this.bookIndex = this.buildBookIndex(this.books);
            
            // Лог и флаги состояния
            console.log('✅ CatalogPage: Загружено элементов (merged):', this.books.length);
            this.catalogLoaded = true;
            this.state.set('catalog.lastUpdate', Date.now());
    
        } catch (error) {
            console.error('❌ Ошибка загрузки данных каталога:', error);
            this.books = [];
        } finally {
            this.catalogLoading = false;
            this.rerender();
    
            // Применяем отложенный highlight, если есть
            if (this.pendingHighlight && !this.highlightApplied) {
                setTimeout(() => this.applyHighlight(this.pendingHighlight), 500);
            }
        }
    }

  
    /**
     * 🔥 Ensure top week IDs are available
     */
    async ensureTopWeekIds() {
        const existingTopWeekData = this.state.get('catalog.topWeekIds');
        if (existingTopWeekData && existingTopWeekData.ids && existingTopWeekData.ids.length > 0) {
            this.topWeekIds = existingTopWeekData.ids;
            console.log('✅ CatalogPage: Using existing top week IDs:', this.topWeekIds);
            return;
        }
        
        try {
            console.log('📚 CatalogPage: Loading top week IDs...');
            const res = await this.api.getTopBooks({ scope: 'week' });
            const items = res?.data || res || [];
            const topWeekIds = items.map(i => i.id || i._id).filter(Boolean);
            
            if (topWeekIds.length > 0) {
                this.topWeekIds = topWeekIds;
                this.state.set('catalog.topWeekIds', {
                    ids: topWeekIds,
                    timestamp: Date.now()
                });
                console.log('✅ CatalogPage: Loaded and saved top week IDs:', topWeekIds);
            }
        } catch (error) {
            console.error('❌ CatalogPage: Error loading top week IDs:', error);
            // Use fallback IDs
            this.topWeekIds = ['1', '2', '3'];
        }
    }
    
    /**
     * 🔄 Нормализация темы в каноническую категорию каталога
     * @param {string} theme - Исходная тема
     * @returns {string|null} - Каноническая категория или null
     */
    normalizeTheme(theme) {
        if (!theme || typeof theme !== 'string') return null;
        
        const themeLower = theme.trim().toLowerCase();
        if (themeLower.length < 2) return null;
        
        // Synonym map (lowercase keys)
        const synonyms = {
            'саморазвитие': 'ПОИСК СЕБЯ',
            'самопознание': 'ПОИСК СЕБЯ',
            'мудрость': 'СМЫСЛ ЖИЗНИ',
            'философия': 'СМЫСЛ ЖИЗНИ',
            'жизненная философия': 'СМЫСЛ ЖИЗНИ',
            'карьера': 'ДЕНЬГИ',
            'работа': 'ДЕНЬГИ',
            'семья': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
            'родители': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
            'дети': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
            'счастье': 'СЧАСТЬЕ',
            'радость': 'СЧАСТЬЕ',
            'время': 'ВРЕМЯ И ПРИВЫЧКИ',
            'привычки': 'ВРЕМЯ И ПРИВЫЧКИ'
        };
        
        // Check direct synonym match
        if (synonyms[themeLower]) {
            return synonyms[themeLower];
        }
        
        // Exact case-insensitive match with catalog categories
        const exactMatch = CATALOG_CATEGORIES.find(cat => 
            cat.toLowerCase() === themeLower
        );
        if (exactMatch) return exactMatch;
        
        // Partial match both directions (theme contains category or vice versa)
        const partialMatch = CATALOG_CATEGORIES.find(cat => {
            const catLower = cat.toLowerCase();
            return themeLower.includes(catLower) || catLower.includes(themeLower);
        });
        if (partialMatch) return partialMatch;
        
        return null;
    }
    
    /**
     * 🎯 Загрузка персональных тем из weeklyReport
     */
    async loadPersonalizationTopics() {
        try {
            let userId = this.state.getCurrentUserId();
            
            // Fallback to resolveUserId if state userId is not ready
            if (!userId || userId === 'demo-user') {
                if (this.api.resolveUserId) {
                    userId = this.api.resolveUserId();
                }
            }
            
            if (!userId || userId === 'demo-user') {
                console.log('🎯 CatalogPage: No valid userId, using default tags');
                return;
            }
            
            // Попытка получить weeklyReport через API
            if (this.api.getWeeklyReports) {
                const response = await this.api.getWeeklyReports({ limit: 1 }, userId);
                // FIX: Correct path to reports array
                const reports = response?.data?.reports || response?.reports || [];
                const weeklyReport = reports[0];
                
                if (weeklyReport) {
                    let dominantThemes = [];
                    
                    // Приоритет: analysis.dominantThemes (массив)
                    if (weeklyReport.analysis?.dominantThemes && Array.isArray(weeklyReport.analysis.dominantThemes)) {
                        dominantThemes = weeklyReport.analysis.dominantThemes;
                    }
                    // Fallback: weeklyReport.topics или reportData.topics (строка)
                    else if (weeklyReport.topics || weeklyReport.reportData?.topics) {
                        const topicsString = weeklyReport.topics || weeklyReport.reportData.topics;
                        dominantThemes = topicsString.split(',').map(t => t.trim()).filter(Boolean);
                    }
                    
                    if (dominantThemes.length > 0) {
                        // Normalize themes to canonical categories
                        const normalizedThemes = dominantThemes
                            .map(theme => this.normalizeTheme(theme))
                            .filter(theme => theme !== null);
                        
                        // De-duplicate
                        const uniqueThemes = [...new Set(normalizedThemes)];
                        
                        // Drop ДРУГОЕ if we have other topics
                        const finalThemes = uniqueThemes.length > 1 && uniqueThemes.includes('ДРУГОЕ')
                            ? uniqueThemes.filter(theme => theme !== 'ДРУГОЕ').slice(0, 5)
                            : uniqueThemes.slice(0, 5);
                        
                        if (finalThemes.length > 0) {
                            this.userTags = finalThemes;
                            console.log('✅ CatalogPage: Loaded normalized personalization topics:', this.userTags);
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ CatalogPage: Error loading personalization topics:', error);
        }
        
        // Если не удалось загрузить темы - оставляем пустым для placeholder
        this.userTags = [];
        console.log('📝 CatalogPage: No personalization topics, will show placeholder');
    }
    
    /**
     * 🔄 Конвертация данных API в формат для отображения
     */
    convertApiBookToDisplayFormat(apiBook) {
        // Нормализация автора: не выводить если отсутствует или совпадает с /неизвест/i
        let author = apiBook.author || '';
        if (!author || /неизвест/i.test(author)) {
            author = '';
        }
        
        // Определение isTopWeek: по id или bookSlug
        const bookId = apiBook.id || apiBook._id;
        const bookSlug = apiBook.bookSlug;
        const isTopWeek = this.topWeekIds.includes(bookId) || 
                         (bookSlug && this.topWeekIds.includes(bookSlug));
        
        // Генерация существующего бейджа
        const existingBadge = this.generateBadge(apiBook);
        
        // Создание массива бейджей
        const badgeList = [];
        
        // Если книга в топе - добавляем бейдж "Топ недели" первым
        if (isTopWeek) {
            badgeList.push({ type: 'top-week', text: 'Топ недели' });
        }
        
        // Если есть существующий бейдж - добавляем его
        if (existingBadge) {
            badgeList.push(existingBadge);
        }
        
        return {
            id: apiBook.id,
            title: apiBook.title,
            author: author,
            description: apiBook.description,
            coverClass: `cover-${(parseInt(apiBook.id) % 6) + 1}`,
            // removed meta (rating/duration/match) per redesign
            price: this.formatPriceUI(apiBook.priceByn, apiBook.title),
            oldPrice: null,
            category: this.mapApiCategoryToFilter(apiBook.categories),
            hasDiscount: false,
            badge: existingBadge, // Keep for backward compatibility
            badgeList: badgeList, // New multiple badges support
            utmLink: apiBook.utmLink,
            bookSlug: apiBook.bookSlug, // ← обязательно
        
            // СПЕЦИАЛЬНО ДЛЯ ПАКЕТОВ:
            type: typeof apiBook.type === 'string' ? apiBook.type.trim().toLowerCase() : null,
            booksInPackage: apiBook.booksInPackage || null,
            priceByn: apiBook.priceByn,
            priceRub: apiBook.priceRub,
            packageSlug: apiBook.packageSlug,
            purchaseUrl: apiBook.purchaseUrl,
        };
    }

    /**
     * Преобразовать slug в читаемое название:
     * "ya_u_sebya_odna_ili_vereteno_vasilisy" -> "Я У Себя Одна Или Веретено Василисы"
     */
    humanizeSlug(slug) {
      if (!slug || typeof slug !== 'string') return '';
      const cleaned = String(slug).replace(/\.(jpg|png|webp|jpeg)$/i, '').trim();
      return cleaned
        .replace(/[_\-]+/g, ' ')
        .split(/\s+/)
        .map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : '')
        .join(' ')
        .trim();
    }
    
    /**
     * Построить индекс bookSlug -> doc для быстрого поиска в this.books
     */
    buildBookIndex(booksArray) {
      if (!Array.isArray(booksArray)) return {};
      return booksArray.reduce((acc, b) => {
        const key = String(b.bookSlug || b.id || '').trim();
        if (key) acc[key] = b;
        return acc;
      }, {});
    }

    /**
     * Получить src для обложки (приоритет):
     * 1) book.image (если задано)
     * 2) book.bookSlug -> /mini-app/assets/book-covers/{bookSlug}.png
     * 3) book.packageSlug -> /mini-app/assets/book-covers/{packageSlug}.png
     * Возвращает строку (путь) или пустую строку — тогда onerror в <img> сработает.
     * (не делает сетевых запросов — только формирует путь)
     */
    coverSrcFor(book) {
      if (!book) return '';
      // если в API/БД задали абсолютный URL — используем его напрямую
      if (book.image && String(book.image).trim()) {
        return String(book.image).trim();
      }
      // prefer bookSlug, fallback to packageSlug
      const slug = encodeURIComponent(String(book.bookSlug || book.packageSlug || '').trim());
      if (slug) {
        return `/mini-app/assets/book-covers/${slug}.png`;
      }
      return '';
    }
    
    /**
     * Резолв элементов пакета — возвращает массив объектов { bookSlug, title, author, coverUrl }
     * Использует this.bookIndex (если есть) либо this.books как fallback, и humanizeSlug для отсутствующих.
     */
    resolvePackageItems(apiBook) {
      const slugs = Array.isArray(apiBook.booksInPackage) ? apiBook.booksInPackage : [];
      const index = this.bookIndex || this.buildBookIndex(this.books || []);
      return slugs.map(slug => {
        const s = String(slug || '').trim();
        if (!s) return null;
        const doc = index[s] || (this.books || []).find(b => (b.bookSlug || b.id || '').toString() === s);
        if (doc) {
          return {
            bookSlug: s,
            title: doc.title || this.humanizeSlug(s),
            author: doc.author || null,
            coverUrl: doc.coverUrl || doc.imageCover || null
          };
        }
        return { bookSlug: s, title: this.humanizeSlug(s), author: null, coverUrl: null };
      }).filter(Boolean);
    }
  
    /**
     * 💰 Форматирование цены для UI (Mini App)
     * Использует утилиты из utils/price.js
     * Формат: "{BYN} BYN / {RUB} ₽"
     * @param {number} priceByn - Цена в BYN
     * @param {string} titleOrSlug - Название или slug книги
     * @returns {string} Отформатированная строка цены
     */
    formatPriceUI(priceByn, titleOrSlug) {
        // Используем глобальную утилиту если доступна, иначе встроенную логику
        if (window.formatPriceUI) {
            return window.formatPriceUI(priceByn, titleOrSlug);
        }
        
        // Fallback: встроенная логика
        if (!priceByn || priceByn <= 0) {
            return '80 BYN / 2400 ₽';
        }
        
        const bynToRubMap = { 80: 2400, 90: 2700, 100: 3000, 120: 3600, 150: 4500, 200: 6000 };
        let normalizedByn = priceByn === 60 ? 80 : priceByn;
        
        // Специальный случай: "Тело помнит всё"
        if (priceByn === 80 && /тело помнит всё/i.test(String(titleOrSlug || ''))) {
            normalizedByn = 90;
        }
        
        const rub = bynToRubMap[normalizedByn];
        return rub ? `${normalizedByn} BYN / ${rub} ₽` : `${normalizedByn} BYN`;
    }
    
    /**
     * 🏷️ Маппинг категорий query в фильтры
     */
    mapQueryCategoryToFilter(queryCategory) {
        if (!queryCategory) return 'ВСЕ';
        
        // Try direct match first
        const directMatch = CATALOG_CATEGORIES.find(c => 
            c.toLowerCase() === queryCategory.toLowerCase()
        );
        if (directMatch) return directMatch;
        
        // Try partial match
        const partialMatch = CATALOG_CATEGORIES.find(c => 
            c.toLowerCase().includes(queryCategory.toLowerCase()) ||
            queryCategory.toLowerCase().includes(c.toLowerCase())
        );
        if (partialMatch) return partialMatch;
        
        // Specific mappings for slugified categories
        const categoryMappings = {
            'кризисы': 'КРИЗИСЫ',
            'я-женщина': 'Я — ЖЕНЩИНА',
            'любовь': 'ЛЮБОВЬ',
            'отношения': 'ОТНОШЕНИЯ',
            'деньги': 'ДЕНЬГИ',
            'одиночество': 'ОДИНОЧЕСТВО',
            'смерть': 'СМЕРТЬ',
            'семейные-отношения': 'СЕМЕЙНЫЕ ОТНОШЕНИЯ',
            'смысл-жизни': 'СМЫСЛ ЖИЗНИ',
            'счастье': 'СЧАСТЬЕ',
            'время-и-привычки': 'ВРЕМЯ И ПРИВЫЧКИ',
            'добро-и-зло': 'ДОБРО И ЗЛО',
            'общество': 'ОБЩЕСТВО',
            'поиск-себя': 'ПОИСК СЕБЯ',
            'психология-отношений': 'ОТНОШЕНИЯ',
            'психология': 'ПОИСК СЕБЯ'
        };
        
        const mapped = categoryMappings[queryCategory.toLowerCase()];
        return mapped || 'ВСЕ';
    }

    /**
     * 🏷️ Маппинг категорий API в фильтры
     */
    mapApiCategoryToFilter(categories) {
        if (!Array.isArray(categories) || categories.length === 0) return 'ПОИСК СЕБЯ';
        const first = String(categories[0]).trim().toUpperCase();
        const match = CATALOG_CATEGORIES.find(c => c === first);
        return match || 'ПОИСК СЕБЯ';
    }
    
    /**
     * 🏅 Генерация badge на основе данных книги
     * ❌ ИСПРАВЛЕНО: Старый бейдж "ТОП" больше не используется
     */
    generateBadge(apiBook) {
        // Возвращаем null - старые бейджи больше не нужны
        // Только "Топ недели" бейдж добавляется в convertApiBookToDisplayFormat
        return null;
    }
    
    /**
     * 📚 ПРИМЕРЫ КНИГ ИЗ КОНЦЕПТА (обновленные с акциями)
     */
    getExampleBooks() {
        return [
            {
                id: '1',
                title: 'Искусство любить',
                author: 'Эрих Фромм',
                description: 'Подробный разбор классической книги о психологии любви и отношений',
                coverClass: 'cover-1',
                badge: { type: 'top', text: 'ТОП' },
                rating: 4.9,
                reviews: 127,
                duration: '2.5 часа',
                match: '97% подходит',
                oldPrice: '1,200₽',
                price: '960₽',
                discount: '-20%',
                category: 'ЛЮБОВЬ',
                hasDiscount: true
            },
            {
                id: '2',
                title: 'Быть собой',
                author: 'Анна Бусел',
                description: 'Авторский курс по обретению внутренней гармонии и самопринятию',
                coverClass: 'cover-2',
                badge: { type: 'new', text: 'НОВОЕ' },
                rating: 5.0,
                reviews: 43,
                duration: '3 часа',
                match: '94% подходит',
                price: '1,800₽',
                category: 'ПОИСК СЕБЯ'
            },
            {
                id: '3',
                title: 'Письма к молодому поэту',
                author: 'Райнер Рильке',
                description: 'О творчестве, одиночестве и поиске своего пути в жизни',
                coverClass: 'cover-3',
                rating: 4.8,
                reviews: 89,
                duration: '1.5 часа',
                match: '91% подходит',
                price: '800₽',
                category: 'ПОИСК СЕБЯ'
            },
            {
                id: '4',
                title: 'Психология влияния',
                author: 'Роберт Чалдини',
                description: '6 принципов убеждения и их применение в жизни',
                coverClass: 'cover-4',
                badge: { type: 'popular', text: 'ПОПУЛЯРНОЕ' },
                rating: 4.7,
                reviews: 156,
                duration: '4 часа',
                match: '89% подходит',
                price: '1,400₽',
                category: 'ОБЩЕСТВО'
            },
            {
                id: '5',
                title: 'Думай медленно, решай быстро',
                author: 'Даниэль Канеман',
                description: 'Две системы мышления и принятие решений',
                coverClass: 'cover-5',
                rating: 4.6,
                reviews: 98,
                duration: '5 часов',
                match: '85% подходит',
                price: '1,600₽',
                category: 'ОБЩЕСТВО'
            },
            {
                id: '6',
                title: '7 навыков высокоэффективных людей',
                author: 'Стивен Кови',
                description: 'Классика саморазвития и личной эффективности',
                coverClass: 'cover-6',
                rating: 4.8,
                reviews: 234,
                duration: '3.5 часа',
                match: '93% подходит',
                oldPrice: '1,500₽',
                price: '1,000₽',
                discount: '-33%',
                category: 'ВРЕМЯ И ПРИВЫЧКИ',
                hasDiscount: true
            }
        ];
    }
    
    /**
     * 🎨 РЕНДЕР СТРАНИЦЫ (ИСПРАВЛЕНО!) - БЕЗ ШАПКИ!
     * 
     * 🔧 КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: 
     * - Убрана лишняя обертка .page px-3 py-3
     * - Используется .content как в ReportsPage
     * - Это обеспечивает правильную работу скролла и навигации
     */
    render() {
        const isSearchMode = this.showSearch;
        return `
            <div class="content">
                ${isSearchMode ? this.renderSearchMode() : this.renderNormalMode()}
            </div>
        `;
    }
    
    /**
     * 🔥 БАННЕР СКИДОК (для фильтра "Скидки")
     */
    renderDiscountBanner() {
        return `
            <div class="top-promo-banner">
                <div class="top-promo-title">🔥 Распродажа января</div>
                <div class="top-promo-subtitle">Скидки до 40% на популярные разборы</div>
                <div class="top-promo-timer">Только до 31 января</div>
            </div>
        `;
    }
    
    /**
     * 🏠 ОБЫЧНЫЙ РЕЖИМ С ПЕРСОНАЛИЗАЦИЕЙ (ИЗ КОНЦЕПТА)
     */
    renderNormalMode() {
        return `
            ${this.renderPersonalizationCard()}
            ${this.renderFilterTabs()}
            ${this.renderBooksList()}
        `;
    }
    
    /**
     * 🔍 РЕЖИМ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchMode() {
        return `
            ${this.renderSearchSection()}
            ${this.renderFilterTabs()}
            ${this.renderSearchResults()}
            ${this.renderPromoSection()}
        `;
    }
    
    /**
     * 🎯 ПЕРСОНАЛИЗАЦИЯ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderPersonalizationCard() {
        // Если нет тем - показать placeholder (вариант 2)
        if (!this.userTags || this.userTags.length === 0) {
            return `
                <div class="personalization-card">
                    <div class="personalization-title">🎯 Персональные рекомендации по категориям</div>
                    <div class="personalization-subtitle">Добавляйте цитаты — и появятся персональные темы</div>
                </div>
            `;
        }
        
        return `
            <div class="personalization-card">
                <div class="personalization-title">🎯 Персональные рекомендации</div>
                <div class="personalization-subtitle">На основе ваших цитат и интересов</div>
                <div class="user-tags">
                    ${this.userTags.map(tag => `
                        <span class="user-tag">${tag}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    /**
     * 🔍 СЕКЦИЯ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchSection() {
        return `
            <div class="search-section active">
                <input class="search-input" 
                       id="catalogSearchInput"
                       placeholder="Найти книгу или автора..." 
                       value="${this.searchQuery}">
            </div>
        `;
    }
    
    /**
     * 🏷️ ФИЛЬТРЫ (ТОЧНО ИЗ КОНЦЕПТА!)
     */
    renderFilterTabs() {
        const tabs = ['ПАКЕТЫ', 'ВСЕ', ...CATALOG_CATEGORIES];
        const active = this.activeFilter || 'ПАКЕТЫ';
        return `
            <div class="filter-tabs">
                ${tabs.map(tab => `
                    <button class="filter-tab ${tab === active ? 'active' : ''}" data-filter="${tab}">
                        ${tab}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    /**
     * 📚 СПИСОК КНИГ (ИЗ КОНЦЕПТА)
     */
    renderBooksList() {
        const filteredBooks = this.getFilteredBooks();
        
        if (filteredBooks.length === 0) {
           return ''; // ничего не показываем
        }
        
        return filteredBooks.map(book => this.renderBookCard(book)).join('');
    }
    
    /**
     * 🔍 РЕЗУЛЬТАТЫ ПОИСКА (ИЗ КОНЦЕПТА)
     */
    renderSearchResults() {
        const results = this.getFilteredBooks().filter(book => 
            book.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
            (book.author && book.author.toLowerCase().includes(this.searchQuery.toLowerCase()))
        );
        
        return `
            <div class="search-results-info">
                Найдено <span class="search-results-count">${results.length}</span> разборов по запросу "${this.searchQuery}"
            </div>
            ${results.map(book => this.renderBookCard(book)).join('')}
        `;
    }
    
    renderBookCard(book) {
    // === ЗАМЕНИТЬ ВНУТРИ renderBookCard(book) ВСЮ ВЕТКУ if (book.type === 'package') ===
    if (book.type === 'package') {
      // Быстрый резолв состава пакета: приоритет — resolvePackageItems -> this.bookIndex/this.books -> humanizeSlug
      const resolved = (this.resolvePackageItems && this.resolvePackageItems(book)) || [];
      let items = [];

      if (resolved && resolved.length) {
        items = resolved.map(i => {
          if (i.title && i.title.trim()) return i.title;
          if (i.bookSlug && this.bookIndex && this.bookIndex[i.bookSlug] && this.bookIndex[i.bookSlug].title) return this.bookIndex[i.bookSlug].title;
          return (i.bookSlug && this.humanizeSlug) ? this.humanizeSlug(i.bookSlug) : (i.bookSlug || '');
        }).filter(Boolean);
      } else if (Array.isArray(book.booksInPackage) && book.booksInPackage.length) {
        items = book.booksInPackage.map(s => {
          const slug = String(s || '').trim();
          if (!slug) return null;
          const found = (this.bookIndex && this.bookIndex[slug]) || (this.books || []).find(b => (b.bookSlug || b.id || '').toString() === slug);
          if (found && found.title) return found.title;
          return (this.humanizeSlug ? this.humanizeSlug(slug) : slug);
        }).filter(Boolean);
      } else {
        items = [];
      }

      // BYN/₽ формирование
      const price = book.priceByn ? `${book.priceByn} BYN` : '';
      const priceRub = book.priceRub ? `${book.priceRub} ₽` : '';
      const escapeHtml = window.escapeHtml || (t => String(t || ''));

      const itemsHtml = items.length
        ? `<ul class="package-books">${items.map(title => `<li>${escapeHtml(title)}</li>`).join('')}</ul>`
        : '';

      // Compute package-specific cover src (prefer packageSlug, fallback to bookSlug/book.image via helper)
      const pkgSlugRaw = String(book.packageSlug || book.bookSlug || '').trim().toLowerCase();
      const pkgSlug = pkgSlugRaw ? encodeURIComponent(pkgSlugRaw) : '';
      const pkgCoverSrc = pkgSlug ? `/mini-app/assets/book-covers/${pkgSlug}.png` : '';
      const coverSrc = pkgCoverSrc || this.coverSrcFor(book);

      return `
        <div class="book-card package-card" data-book-id="${book.id}" data-book-slug="${book.packageSlug || ''}">
          <div class="book-main">
            <div class="book-cover cover-package" data-cover-src="${coverSrc}">
              <img class="book-cover-img"
                   src="${coverSrc}"
                   alt="${escapeHtml(book.title || '')}"
                   onerror="this.style.display='none'; this.parentElement.classList.add('fallback');">
              <span class="package-label">ПАКЕТ</span>
              <div class="cover-fallback-text">${escapeHtml(book.title || '')}</div>
            </div>
            <div class="book-info">
              <div class="book-title package-title">${escapeHtml(book.title || '')}</div>
              <div class="book-description">${escapeHtml(book.description || '')}</div>
              ${itemsHtml}
            </div>
          </div>
          <div class="book-footer">
            <div class="book-pricing">
              <div class="book-price">${[price, priceRub].filter(Boolean).join(' / ')}</div>
            </div>
            <button class="buy-button" data-book-id="${book.id}" data-package="true">Купить пакет</button>
          </div>
        </div>
      `;
    }

    // Обычная карточка книги/разбора (без изменений)
    const discountClass = book.hasDiscount ? 'discount-card' : '';
    const escapeHtml = window.escapeHtml || ((text) => text);
    const safeTitle = escapeHtml(book.title || '');
    const safeAuthor = escapeHtml(book.author || '');
    const safeDescription = escapeHtml(book.description || '');

    // Multiple badges support
    const badges = book.badgeList || (book.badge ? [book.badge] : []);
    const badgesHtml = badges.length > 1 
        ? `<div class="book-badges">${badges.map(badge => 
            `<div class="book-badge ${badge.type}">${escapeHtml(badge.text)}</div>`
          ).join('')}</div>`
        : badges.length === 1
        ? `<div class="book-badge ${badges[0].type}">${escapeHtml(badges[0].text)}</div>`
        : '';

    return `
        <div class="book-card ${discountClass}" data-book-id="${book.id}" data-book-slug="${book.bookSlug || ''}">
            ${book.hasDiscount ? `
                <div class="discount-badge">${book.discount}</div>
            ` : ''}
            
            <div class="book-main">
                <div class="book-cover ${book.coverClass}">
                    <img class="book-cover-img" 
                         src="/mini-app/assets/book-covers/${book.bookSlug}.png" 
                         alt="${safeTitle}"
                         onerror="this.style.display='none'; this.parentElement.classList.add('fallback');">
                    <div class="cover-fallback-text">${safeTitle}</div>
                </div>
                <div class="book-info">
                    <div class="book-header">
                        <div>
                            <div class="book-title">${safeTitle}</div>
                            ${book.author ? `<div class="book-author">${safeAuthor}</div>` : ''}
                        </div>
                        ${badgesHtml}
                    </div>
                    <div class="book-description">${safeDescription}</div>
                </div>
            </div>
            
            <div class="book-footer">
                <div class="book-pricing">
                    ${book.oldPrice ? `
                        <div class="book-old-price">${book.oldPrice}</div>
                    ` : ''}
                    <div class="book-price">${book.price}</div>
                </div>
                <button class="buy-button ${book.hasDiscount ? 'discount-button' : ''}" 
                        data-book-id="${book.id}">
                    Купить разбор
                </button>
            </div>
        </div>
    `;
}
    
    /**
     * 🎁 ПРОМО СЕКЦИЯ (ИЗ КОНЦЕПТА)
     */
    renderPromoSection() {
        if (this.searchQuery.toLowerCase().includes('психология')) {
            return `
                <div class="promo-section">
                    <div class="promo-title">🔥 Скидка на психологию</div>
                    <div class="promo-text">Промокод PSYCHO15 дает 15% на все разборы по психологии</div>
                    <button class="promo-button" id="applyPromoBtn">Применить скидку</button>
                </div>
            `;
        }
        return '';
    }
    
    /**
     * 🚫 ПУСТОЕ СОСТОЯНИЕ
     */
    renderEmptyState() {
        return `
            <div class="text-center py-4 px-2">
                <div style="font-size: 48px; margin-bottom: var(--spacing-md);">📚</div>
                <div class="font-semibold text-primary mb-2" style="font-size: var(--font-size-sm);">
                    Разборы не найдены
                </div>
                <div class="text-muted" style="font-size: var(--font-size-xs); line-height: var(--line-height-normal);">
                    Попробуйте выбрать другую категорию или воспользоваться поиском
                </div>
            </div>
        `;
    }
    
    /**
     * 🔧 ФИЛЬТРАЦИЯ КНИГ
     */
    getFilteredBooks() {
      const active = this.activeFilter || 'ПАКЕТЫ';
      if (active === 'ПАКЕТЫ') {
          return (this.books || []).filter(b => b.type === 'package');
      } else if (active === 'ВСЕ') {
          return (this.books || []).filter(b => !b.type || b.type !== 'package');
      }
      return (this.books || []).filter(b => b.category === active && (!b.type || b.type !== 'package'));
  }
    
    /**
     * 🎯 ОБРАБОТЧИКИ СОБЫТИЙ
     */
    attachEventListeners() {
        // Фильтры
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.handleFilterChange(e.target.dataset.filter);
            });
        });
        
        // Кнопки покупки
        const buyButtons = document.querySelectorAll('.buy-button');
        buyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleBuyBook(btn.dataset.bookId);
            });
        });
        
        // Поиск
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.rerender();
            });
        }
        
        // Промо кнопка
        const promoBtn = document.getElementById('applyPromoBtn');
        if (promoBtn) {
            promoBtn.addEventListener('click', () => {
                this.handleApplyPromo();
            });
        }
    }
    
    /**
     * 🏷️ СМЕНА ФИЛЬТРА
     */
    handleFilterChange(filterId) {
        this.activeFilter = filterId;
        this.telegram.hapticFeedback('light');
        this.rerender();
    }
    
    /**
     * 💳 ПОКУПКА КНИГИ ИЛИ ПАКЕТА
     */
    handleBuyBook(bookId) {
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;
    
        this.telegram.hapticFeedback('success');
    
        // Для пакета — всегда используем purchaseUrl (строго!)
        if (book.type === 'package' && book.purchaseUrl) {
            this.telegram.openLink(book.purchaseUrl);
            this.showSuccess(`📦 Переходим к покупке пакета "${book.title}"`);
            return;
        }
    
        // Для книги/разбора — старый алгоритм
        this.api.trackCatalogClick({ bookSlug: book.bookSlug, bookId: book.id }).catch(() => {});
        const buyUrl = book.utmLink || `https://anna-busel.com/books?utm_source=telegram_bot&utm_medium=mini_app&utm_campaign=catalog&utm_content=${book.id}`;
        this.telegram.openLink(buyUrl);
    
        this.showSuccess(`📚 Переходим к покупке "${book.title}"`);
    }
    
    /**
     * 🎁 ПРИМЕНИТЬ ПРОМОКОД
     */
    handleApplyPromo() {
        this.telegram.hapticFeedback('success');
        this.showSuccess('🎉 Промокод PSYCHO15 применен!');
    }
    
    /**
     * 🔍 ПЕРЕКЛЮЧЕНИЕ ПОИСКА
     */
    toggleSearch() {
        this.showSearch = !this.showSearch;
        if (this.showSearch) {
            this.searchQuery = 'психология'; // Пример из концепта
        } else {
            this.searchQuery = '';
        }
        this.rerender();
    }
    
    /**
     * 📱 LIFECYCLE МЕТОДЫ - ИСПРАВЛЕНО: БЕЗ ШАПКИ!
     */
    onShow() {
        console.log('📚 CatalogPage: onShow - БЕЗ ШАПКИ!');
      
        // ✅ ИСПРАВЛЕНО: Умная загрузка как в HomePage
        if (!this.catalogLoaded) {
            console.log('🔄 CatalogPage: Первый показ, загружаем данные');
            
            // Parallel loading: ensureTopWeekIds + loadCatalogData, then personalization
            Promise.all([
                this.ensureTopWeekIds(),
                this.loadCatalogData()
            ]).then(() => {
                // После загрузки каталога загружаем персонализацию
                this.loadPersonalizationTopics().then(() => {
                    if (this.catalogLoaded) {
                        this.rerender();
                    }
                });
            });
        } else {
            // Проверяем актуальность данных (10 минут)
            const lastUpdate = this.state.get('catalog.lastUpdate');
            const now = Date.now();
            const tenMinutes = 10 * 60 * 1000;
            
            if (!lastUpdate || (now - lastUpdate) > tenMinutes) {
                console.log('🔄 CatalogPage: Данные устарели, обновляем');
                Promise.all([
                    this.ensureTopWeekIds(),
                    this.loadCatalogData()
                ]).then(() => {
                    this.loadPersonalizationTopics().then(() => {
                        if (this.catalogLoaded) {
                            this.rerender();
                        }
                    });
                });
            } else {
                console.log('✅ CatalogPage: Данные актуальны');
                // Проверяем есть ли topWeekIds
                const existingTopWeekData = this.state.get('catalog.topWeekIds');
                if (existingTopWeekData && existingTopWeekData.ids) {
                    this.topWeekIds = existingTopWeekData.ids;
                }
            }
        }
    }
    
    onHide() {
        console.log('📚 CatalogPage: onHide');
        // Ничего не делаем - Router управляет шапками
    }
    
    rerender() {
        const container = document.getElementById('page-content');
        if (container) {
            container.innerHTML = this.render();
            this.attachEventListeners();
            
            // ✅ НОВОЕ: Используем метод applyHighlight для обработки highlight
            const highlightId = this.app.initialState?.query?.highlight;
            if (highlightId && !this.highlightApplied) {
                console.log('🎯 CatalogPage: Применяем highlight в rerender:', highlightId);
                setTimeout(() => this.applyHighlight(highlightId), 300);
            }
        }
    }
    
    async rerenderWithFreshData() {
        // Принудительно обновляем данные каталога
        this.catalogLoaded = false;
        await this.loadCatalogData();
        this.rerender();
    }
    
    showSuccess(message) {
        if (this.telegram) {
            this.telegram.showAlert(message);
        }
    }
    
    /**
     * 🎯 Применение highlight к элементу каталога
     * @param {string} highlightSlug - Slug книги для подсветки
     */
    applyHighlight(highlightSlug) {
        if (!highlightSlug) return;
        
        console.log('🎯 CatalogPage: Ищем элемент для highlight:', highlightSlug);
        
        // Нормализуем slug (замена подчеркиваний на дефисы)
        const normalizedSlug = highlightSlug.replace(/_/g, '-');
        
        // Пробуем найти элемент несколькими способами
        let targetElement = null;
        
        // 1. По data-book-slug (основной способ)
        targetElement = document.querySelector(`[data-book-slug="${highlightSlug}"]`);
        
        // 2. По нормализованному slug
        if (!targetElement && normalizedSlug !== highlightSlug) {
            targetElement = document.querySelector(`[data-book-slug="${normalizedSlug}"]`);
        }
        
        // 3. По data-book-id (fallback)
        if (!targetElement) {
            targetElement = document.querySelector(`[data-book-id="${highlightSlug}"]`);
        }
        
        // 4. По альтернативному slug (с подчеркиваниями)
        if (!targetElement) {
            const underscoreSlug = highlightSlug.replace(/-/g, '_');
            targetElement = document.querySelector(`[data-book-slug="${underscoreSlug}"]`);
        }
        
        if (targetElement) {
            console.log('✅ CatalogPage: Элемент найден, применяем highlight');
            
            // Добавляем класс highlight
            targetElement.classList.add('catalog-item--highlight');
            
            // Скроллим к элементу
            targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
            
            // Убираем highlight через 2.5 секунды
            setTimeout(() => {
                targetElement.classList.remove('catalog-item--highlight');
                console.log('🎯 CatalogPage: Highlight убран');
            }, 2500);
            
            // Отмечаем что highlight применен
            this.highlightApplied = true;
            this.pendingHighlight = null;
            
        } else {
            console.warn('⚠️ CatalogPage: Элемент для highlight не найден:', highlightSlug);
            
            // Если элемент не найден и каталог еще загружается, попробуем еще раз
            if (this.catalogLoading) {
                console.log('🔄 CatalogPage: Каталог еще загружается, повторим highlight позже');
                setTimeout(() => this.applyHighlight(highlightSlug), 1000);
            }
        }
    }
    
    destroy() {
        // Очистка ресурсов
        
        // ✅ НОВОЕ: Сброс флагов
        this.catalogLoaded = false;
        this.catalogLoading = false;
    }
}

// 📤 Экспорт класса
window.CatalogPage = CatalogPage;
