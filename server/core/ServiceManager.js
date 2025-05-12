/**
 * @file ServiceManager - центральный менеджер для управления сервисами
 * @description Обеспечивает централизованное управление всеми сервисами приложения,
 * dependency injection и предотвращает циклические зависимости
 */

/**
 * @typedef {Object} ServiceConfig
 * @property {Function} factory - Фабричная функция для создания сервиса
 * @property {string[]} [dependencies] - Массив имен зависимостей
 * @property {boolean} [singleton=true] - Создавать как singleton
 * @property {boolean} [lazy=true] - Инициализировать только при первом обращении
 */

/**
 * @typedef {Object} ServiceInfo
 * @property {string} name - Имя сервиса
 * @property {ServiceConfig} config - Конфигурация сервиса
 * @property {any} [instance] - Созданный экземпляр (для singleton)
 * @property {boolean} initialized - Флаг инициализации
 * @property {number} initOrder - Порядок инициализации
 */

/**
 * Менеджер сервисов для централизованного управления зависимостями
 */
class ServiceManager {
  constructor() {
    /** @type {Map<string, ServiceInfo>} */
    this.services = new Map();
    
    /** @type {Set<string>} */
    this.initializing = new Set();
    
    /** @type {number} */
    this.initCounter = 0;
    
    this.logger = console; // Можно заменить на реальный логгер
  }

  /**
   * Регистрирует сервис в менеджере
   * @param {string} name - Уникальное имя сервиса
   * @param {Function} factory - Фабричная функция для создания сервиса
   * @param {Omit<ServiceConfig, 'factory'>} options - Опции конфигурации
   */
  register(name, factory, options = {}) {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    const config = {
      factory,
      dependencies: options.dependencies || [],
      singleton: options.singleton !== false,
      lazy: options.lazy !== false,
      ...options
    };

    this.services.set(name, {
      name,
      config,
      instance: null,
      initialized: false,
      initOrder: -1
    });

    this.logger.debug(`Service ${name} registered`);
  }

  /**
   * Получает экземпляр сервиса
   * @template T
   * @param {string} name - Имя сервиса
   * @returns {T} Экземпляр сервиса
   */
  get(name) {
    const serviceInfo = this.services.get(name);
    
    if (!serviceInfo) {
      throw new Error(`Service ${name} is not registered`);
    }

    // Для non-singleton сервисов всегда создаем новый экземпляр
    if (!serviceInfo.config.singleton) {
      return this._createInstance(serviceInfo);
    }

    // Для singleton - используем закешированный экземпляр или создаем новый
    if (!serviceInfo.instance) {
      serviceInfo.instance = this._createInstance(serviceInfo);
      serviceInfo.initialized = true;
      serviceInfo.initOrder = this.initCounter++;
    }

    return serviceInfo.instance;
  }

  /**
   * Создает экземпляр сервиса с разрешением зависимостей
   * @param {ServiceInfo} serviceInfo - Информация о сервисе
   * @returns {any} Созданный экземпляр
   * @private
   */
  _createInstance(serviceInfo) {
    const { name, config } = serviceInfo;

    // Проверяем циклические зависимости
    if (this.initializing.has(name)) {
      const cycle = Array.from(this.initializing).join(' -> ') + ' -> ' + name;
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    this.initializing.add(name);

    try {
      // Разрешаем зависимости
      const dependencies = config.dependencies.map(depName => {
        this.logger.debug(`Resolving dependency ${depName} for ${name}`);
        return this.get(depName);
      });

      // Создаем экземпляр
      this.logger.debug(`Creating instance of ${name}`);
      const instance = config.factory(...dependencies);

      return instance;
    } catch (error) {
      this.logger.error(`Failed to create instance of ${name}:`, error);
      throw error;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Инициализирует все зарегистрированные сервисы
   * @returns {Promise<void>}
   */
  async initializeAll() {
    this.logger.info('Initializing all services...');

    // Получаем все сервисы с eager инициализацией
    const eagerServices = Array.from(this.services.values())
      .filter(s => !s.config.lazy);

    // Сортируем по зависимостям (сначала сервисы без зависимостей)
    const sorted = this._topologicalSort(eagerServices);

    // Инициализируем по порядку
    for (const serviceInfo of sorted) {
      try {
        this.logger.debug(`Initializing eager service: ${serviceInfo.name}`);
        this.get(serviceInfo.name);
      } catch (error) {
        this.logger.error(`Failed to initialize service ${serviceInfo.name}:`, error);
        throw error;
      }
    }

    this.logger.info('All services initialized successfully');
  }

  /**
   * Топологическая сортировка сервисов по зависимостям
   * @param {ServiceInfo[]} services - Массив сервисов для сортировки
   * @returns {ServiceInfo[]} Отсортированный массив
   * @private
   */
  _topologicalSort(services) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (serviceInfo) => {
      const { name } = serviceInfo;

      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected involving ${name}`);
      }

      if (visited.has(name)) {
        return;
      }

      visiting.add(name);

      // Посещаем все зависимости
      for (const depName of serviceInfo.config.dependencies) {
        const depService = this.services.get(depName);
        if (depService) {
          visit(depService);
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(serviceInfo);
    };

    for (const service of services) {
      if (!visited.has(service.name)) {
        visit(service);
      }
    }

    return sorted;
  }

  /**
   * Получает информацию о зарегистрированных сервисах
   * @returns {Object} Статистика сервисов
   */
  getStats() {
    const totalServices = this.services.size;
    const initializedServices = Array.from(this.services.values())
      .filter(s => s.initialized).length;
    const singletonServices = Array.from(this.services.values())
      .filter(s => s.config.singleton).length;

    return {
      totalServices,
      initializedServices,
      singletonServices,
      services: Array.from(this.services.entries()).map(([name, info]) => ({
        name,
        initialized: info.initialized,
        singleton: info.config.singleton,
        dependencies: info.config.dependencies,
        initOrder: info.initOrder
      }))
    };
  }

  /**
   * Проверяет здоровье всех сервисов
   * @returns {Promise<Object>} Результат проверки здоровья
   */
  async healthCheck() {
    const health = {
      status: 'healthy',
      services: {},
      timestamp: new Date().toISOString()
    };

    for (const [name, serviceInfo] of this.services.entries()) {
      try {
        if (serviceInfo.initialized && serviceInfo.instance) {
          // Если у сервиса есть метод healthCheck, вызываем его
          if (typeof serviceInfo.instance.healthCheck === 'function') {
            const serviceHealth = await serviceInfo.instance.healthCheck();
            health.services[name] = serviceHealth;
          } else {
            health.services[name] = { status: 'ok', message: 'Service is running' };
          }
        } else {
          health.services[name] = { status: 'not_initialized' };
        }
      } catch (error) {
        health.services[name] = { 
          status: 'error', 
          message: error.message 
        };
        health.status = 'degraded';
      }
    }

    // Если есть ошибки, меняем общий статус
    const hasErrors = Object.values(health.services)
      .some(s => s.status === 'error');
    
    if (hasErrors) {
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Очищает все сервисы (для тестов)
   */
  clear() {
    this.services.clear();
    this.initializing.clear();
    this.initCounter = 0;
  }

  /**
   * Выключает все сервисы (вызывает shutdown если есть)
   */
  async shutdown() {
    this.logger.info('Shutting down all services...');

    // Получаем инициализированные сервисы в обратном порядке
    const initializedServices = Array.from(this.services.values())
      .filter(s => s.initialized && s.instance)
      .sort((a, b) => b.initOrder - a.initOrder);

    for (const serviceInfo of initializedServices) {
      try {
        if (typeof serviceInfo.instance.shutdown === 'function') {
          this.logger.debug(`Shutting down service: ${serviceInfo.name}`);
          await serviceInfo.instance.shutdown();
        }
      } catch (error) {
        this.logger.error(`Error shutting down ${serviceInfo.name}:`, error);
      }
    }

    this.logger.info('All services shutdown complete');
  }
}

// Экспортируем singleton экземпляр
module.exports = new ServiceManager();
