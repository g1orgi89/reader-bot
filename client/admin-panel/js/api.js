/**
 * api.js - унифицированная система для API запросов админ-панели Shrooms
 * 
 * @fileoverview Централизованное управление HTTP запросами с аутентификацией
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} ApiRequestOptions
 * @property {string} [method='GET'] - HTTP метод
 * @property {Object} [headers] - Дополнительные заголовки
 * @property {string|FormData|Object} [body] - Тело запроса
 * @property {boolean} [requireAuth=true] - Требовать аутентификацию
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Успешность запроса
 * @property {*} [data] - Данные ответа
 * @property {Object} [error] - Информация об ошибке
 * @property {string} [error.message] - Сообщение об ошибке
 * @property {string} [error.code] - Код ошибки
 */

/**
 * Конфигурация API
 */
const API_CONFIG = {
  /** @type {string} Базовый URL для API */
  BASE_URL: '',
  
  /** @type {number} Таймаут запроса в миллисекундах */
  TIMEOUT: 30000,
  
  /** @type {string} Ключ для хранения токена в localStorage */
  TOKEN_KEY: 'adminToken',
  
  /** @type {string} Ключ для хранения имени пользователя */
  USERNAME_KEY: 'adminUsername'
};

/**
 * Класс для работы с API
 */
class ApiClient {
  /**
   * @constructor
   */
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }
  
  /**
   * Получает токен аутентификации из localStorage
   * @returns {string|null} Токен или null если не найден
   */
  getAuthToken() {
    try {
      return localStorage.getItem(API_CONFIG.TOKEN_KEY);
    } catch (error) {
      console.error('🍄 Ошибка получения токена:', error);
      return null;
    }
  }
  
  /**
   * Получает имя пользователя из localStorage
   * @returns {string|null} Имя пользователя или null
   */
  getUsername() {
    try {
      return localStorage.getItem(API_CONFIG.USERNAME_KEY);
    } catch (error) {
      console.error('🍄 Ошибка получения имени пользователя:', error);
      return null;
    }
  }
  
  /**
   * Сохраняет токен аутентификации в localStorage
   * @param {string} token - Токен для сохранения
   */
  setAuthToken(token) {
    try {
      localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
    } catch (error) {
      console.error('🍄 Ошибка сохранения токена:', error);
    }
  }
  
  /**
   * Сохраняет имя пользователя в localStorage
   * @param {string} username - Имя пользователя
   */
  setUsername(username) {
    try {
      localStorage.setItem(API_CONFIG.USERNAME_KEY, username);
    } catch (error) {
      console.error('🍄 Ошибка сохранения имени пользователя:', error);
    }
  }
  
  /**
   * Очищает данные аутентификации
   */
  clearAuth() {
    try {
      localStorage.removeItem(API_CONFIG.TOKEN_KEY);
      localStorage.removeItem(API_CONFIG.USERNAME_KEY);
    } catch (error) {
      console.error('🍄 Ошибка очистки данных аутентификации:', error);
    }
  }
  
  /**
   * Выполняет HTTP запрос с аутентификацией
   * @param {string} url - URL для запроса (относительный или абсолютный)
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body = null,
      requireAuth = true
    } = options;
    
    try {
      // Формируем полный URL
      const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
      
      // Подготавливаем заголовки
      const requestHeaders = { ...headers };
      
      // Добавляем токен аутентификации если требуется
      if (requireAuth) {
        const token = this.getAuthToken();
        if (!token) {
          throw new Error('Токен аутентификации не найден');
        }
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
      
      // Подготавливаем тело запроса
      let requestBody = body;
      
      // Если тело запроса - объект, преобразуем в JSON
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify(body);
      }
      
      // Создаем контроллер для отмены запроса по таймауту
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      console.log(`🍄 API запрос: ${method} ${fullURL}`);
      
      // Выполняем запрос
      const response = await fetch(fullURL, {
        method,
        headers: requestHeaders,
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Проверяем статус аутентификации
      if (response.status === 401 || response.status === 403) {
        console.warn('🍄 Ошибка аутентификации, очищаем токены');
        this.clearAuth();
        
        // Перенаправляем на страницу входа, если мы не на ней
        if (!window.location.pathname.includes('login.html')) {
          window.location.href = 'login.html';
        }
        
        throw new Error('Сессия истекла, требуется повторная авторизация');
      }
      
      // Парсим ответ
      let result;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { success: response.ok, data: text };
      }
      
      // Если ответ не содержит поле success, определяем успешность по статусу
      if (typeof result.success === 'undefined') {
        result.success = response.ok;
      }
      
      // Если запрос не успешен, но сервер не вернул ошибку
      if (!response.ok && !result.error) {
        result.error = {
          message: `HTTP ${response.status}: ${response.statusText}`,
          code: `HTTP_${response.status}`
        };
      }
      
      console.log(`🍄 API ответ: ${response.status} ${response.statusText}`);
      
      return result;
    } catch (error) {
      console.error('🍄 Ошибка API запроса:', error);
      
      // Определяем тип ошибки
      let errorMessage = error.message;
      let errorCode = 'UNKNOWN_ERROR';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Запрос превысил время ожидания';
        errorCode = 'TIMEOUT';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
        errorCode = 'NETWORK_ERROR';
      }
      
      return {
        success: false,
        error: {
          message: errorMessage,
          code: errorCode
        }
      };
    }
  }
  
  /**
   * Выполняет GET запрос
   * @param {string} url - URL для запроса
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }
  
  /**
   * Выполняет POST запрос
   * @param {string} url - URL для запроса
   * @param {*} [body] - Тело запроса
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async post(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'POST', body });
  }
  
  /**
   * Выполняет PUT запрос
   * @param {string} url - URL для запроса
   * @param {*} [body] - Тело запроса
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async put(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'PUT', body });
  }
  
  /**
   * Выполняет PATCH запрос
   * @param {string} url - URL для запроса
   * @param {*} [body] - Тело запроса
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async patch(url, body = null, options = {}) {
    return this.request(url, { ...options, method: 'PATCH', body });
  }
  
  /**
   * Выполняет DELETE запрос
   * @param {string} url - URL для запроса
   * @param {ApiRequestOptions} [options] - Опции запроса
   * @returns {Promise<ApiResponse>} Результат запроса
   */
  async delete(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
}

// Создаем глобальный экземпляр API клиента
const apiClient = new ApiClient();

/**
 * Глобальная функция для совместимости с существующим кодом
 * @param {string} url - URL для запроса
 * @param {ApiRequestOptions} [options] - Опции запроса
 * @returns {Promise<ApiResponse>} Результат запроса
 */
async function makeAuthenticatedRequest(url, options = {}) {
  return apiClient.request(url, options);
}

// Экспортируем для использования в других модулях
window.apiClient = apiClient;
window.makeAuthenticatedRequest = makeAuthenticatedRequest;
window.API_CONFIG = API_CONFIG;