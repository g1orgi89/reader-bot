/**
 * Упрощенная система аутентификации для админ-панели Shrooms AI Support Bot
 * Следует принципам грибной философии: простота, натуральность, рост без усложнений 🍄
 * 
 * @fileoverview Управление входом грибных администраторов в священные дебри поддержки
 * @author Shrooms Development Team
 */

/**
 * @typedef {Object} LoginCredentials
 * @property {string} username - Имя грибного администратора
 * @property {string} password - Секретная фраза для входа в мицелий
 */

/**
 * @typedef {Object} LoginResult
 * @property {boolean} success - Успешно ли проросли споры аутентификации
 * @property {Object} [data] - Данные успешного входа
 * @property {string} [data.token] - Токен доступа к грибному мицелию
 * @property {string} [data.username] - Подтвержденное имя администратора
 * @property {Object} [error] - Информация об ошибке прорастания
 * @property {string} [error.message] - Сообщение об ошибке
 */

/**
 * Проверяет аутентификацию пользователя в грибном мицелии
 * УПРОЩЕННАЯ ВЕРСИЯ: проверяет только наличие токена в localStorage
 * 
 * @returns {boolean} Есть ли у администратора доступ к грибному мицелию
 */
function checkAuth() {
  try {
    const token = localStorage.getItem('adminToken');
    // Простая проверка: если токен есть - значит админ авторизован
    // Серверная проверка происходит при каждом API запросе через middleware
    return !!token;
  } catch (error) {
    console.error('🍄 Ошибка проверки состояния грибного доступа:', error);
    return false;
  }
}

/**
 * Проверяет аутентификацию и перенаправляет на login при необходимости
 * Используется для защиты всех админ-страниц
 * 
 * @returns {boolean} Разрешен ли доступ к текущей странице
 */
function requireAuth() {
  if (!checkAuth()) {
    console.log('🍄 Доступ к грибному мицелию запрещен, перенаправляем к входу');
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/**
 * Получает имя текущего администратора из хранилища спор
 * 
 * @returns {string} Имя грибного администратора или пустая строка
 */
function getAdminUsername() {
  try {
    return localStorage.getItem('adminUsername') || '';
  } catch (error) {
    console.error('🍄 Не удалось извлечь имя из грибного хранилища:', error);
    return '';
  }
}

/**
 * Проверяет, находимся ли мы на странице входа
 * 
 * @returns {boolean} Это страница входа в грибной мицелий?
 */
function isLoginPage() {
  return document.querySelector('.login-page') !== null;
}

/**
 * Отправляет запрос на вход в систему через грибной API
 * 
 * @param {string} username - Имя грибного администратора
 * @param {string} password - Секретная фраза доступа
 * @returns {Promise<LoginResult>} Результат попытки входа
 */
async function loginUser(username, password) {
  try {
    console.log('🍄 Попытка прорастания в грибной мицелий...');
    
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('🍄 Споры успешно проросли! Добро пожаловать в мицелий');
    } else {
      console.warn('🍄 Споры не смогли прорасти:', result.error?.message);
    }
    
    return result;
  } catch (error) {
    console.error('🍄 Ошибка сети при попытке входа:', error);
    return {
      success: false,
      error: {
        message: 'Сетевая ошибка. Проверьте подключение к грибному мицелию.'
      }
    };
  }
}

/**
 * Выполняет выход из системы и очищает все следы пребывания в мицелии
 */
function logout() {
  try {
    console.log('🍄 Покидаем грибной мицелий...');
    
    // Очищаем все токены и данные администратора
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
    
    // Возвращаемся к входу в мицелий
    window.location.href = 'login.html';
  } catch (error) {
    console.error('🍄 Ошибка при покидании мицелия:', error);
    alert('Ошибка при выходе. Попробуйте еще раз.');
  }
}

/**
 * Инициализирует обработчики для страницы входа
 */
function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  console.log('🍄 Инициализация входа в грибной мицелий');

  // Обработчик отправки формы входа
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    
    // Очищаем предыдущие ошибки
    if (errorElement) {
      errorElement.textContent = '';
    }
    
    // Проверяем заполнение полей
    if (!username || !password) {
      if (errorElement) {
        errorElement.textContent = 'Введите имя и пароль для входа в грибной мицелий';
      }
      return;
    }
    
    try {
      // Показываем состояние загрузки
      if (submitButton) {
        submitButton.disabled = true;
        const btnText = submitButton.querySelector('.btn-text');
        if (btnText) {
          btnText.textContent = 'Прорастание...';
        }
      }
      
      // Выполняем вход
      const result = await loginUser(username, password);
      
      if (result.success) {
        // Сохраняем данные аутентификации
        localStorage.setItem('adminToken', result.data.token);
        localStorage.setItem('adminUsername', result.data.username);
        
        console.log('🍄 Доступ к мицелию получен, перенаправляем в панель управления');
        
        // Перенаправляем в панель управления
        window.location.href = 'index.html';
      } else {
        // Показываем ошибку
        if (errorElement) {
          errorElement.textContent = result.error?.message || 'Не удалось войти. Проверьте учетные данные.';
        }
      }
    } catch (error) {
      console.error('🍄 Непредвиденная ошибка входа:', error);
      if (errorElement) {
        errorElement.textContent = 'Произошла ошибка. Попробуйте еще раз.';
      }
    } finally {
      // Восстанавливаем кнопку
      if (submitButton) {
        submitButton.disabled = false;
        const btnText = submitButton.querySelector('.btn-text');
        if (btnText) {
          btnText.textContent = 'Войти';
        }
      }
    }
  });
  
  // Если уже авторизован - перенаправляем на главную
  if (checkAuth()) {
    console.log('🍄 Уже находимся в мицелии, перенаправляем в панель управления');
    window.location.href = 'index.html';
  }
}

/**
 * Инициализирует анимацию грибного цифрового дождя для страницы входа
 */
function initMushroomMatrix() {
  try {
    const container = document.querySelector('.mushroom-bg-animation');
    if (!container) return;
    
    console.log('🍄 Инициализация грибного цифрового дождя');
    
    // Создаем canvas для анимации
    let canvas = document.getElementById('mushroom-matrix-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'mushroom-matrix-canvas';
      container.appendChild(canvas);
    }
    
    // Устанавливаем размеры canvas
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    const ctx = canvas.getContext('2d');
    
    // Грибные символы для матрицы
    const mushroomSymbols = ['🍄', '•', '○', '◌', '◍', '◎', '◯', '⚪', '⭕', '✱', '✲', '✳', '✴', '✵'];
    
    // Вычисляем количество колонок (одна колонка каждые 20px)
    const getColumns = () => Math.floor(canvas.width / 20);
    let columns = getColumns();
    let drops = [];
    
    // Инициализируем капли на случайных позициях
    const initDrops = () => {
      columns = getColumns();
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops[i] = Math.floor(Math.random() * -canvas.height);
      }
    };
    
    initDrops();
    window.addEventListener('resize', initDrops);
    
    // Функция анимации
    function draw() {
      // Полупрозрачный черный фон для создания эффекта следа
      ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Устанавливаем цвет и шрифт для символов
      ctx.fillStyle = '#39FF14'; // Неоновый зеленый
      ctx.font = '15px monospace';
      
      // Рисуем каждую колонку
      for (let i = 0; i < drops.length; i++) {
        // Выбираем случайный грибной символ
        const symbol = mushroomSymbols[Math.floor(Math.random() * mushroomSymbols.length)];
        
        // Рисуем символ
        ctx.fillText(symbol, i * 20, drops[i] * 20);
        
        // Двигаем каплю вниз
        drops[i]++;
        
        // Сбрасываем позицию капли при достижении низа или случайно
        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
      }
      
      // Вызываем отрисовку на следующем кадре
      requestAnimationFrame(draw);
    }
    
    // Запускаем анимацию
    draw();
  } catch (error) {
    console.error('🍄 Ошибка анимации грибной матрицы:', error);
    // Продолжаем работу без анимации в случае ошибки
  }
}

/**
 * Главная функция инициализации аутентификации
 * Автоматически определяет тип страницы и настраивает соответствующие обработчики
 */
function initAuth() {
  console.log('🍄 Инициализация системы доступа к грибному мицелию');
  
  if (isLoginPage()) {
    // Инициализируем страницу входа
    initLoginPage();
    initMushroomMatrix();
  } else {
    // Защищаем админ-страницы
    if (!requireAuth()) {
      return; // Если не авторизован - перенаправлен на login
    }
    
    // Настраиваем кнопку выхода
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }
    
    // Отображаем имя администратора
    const usernameElement = document.getElementById('admin-username');
    if (usernameElement) {
      const username = getAdminUsername();
      if (username) {
        usernameElement.textContent = username;
      }
    }
  }
}

// Устаревшие функции для обратной совместимости
// Эти функции оставлены для совместимости с существующим кодом

/**
 * @deprecated Используйте checkAuth() вместо этой функции
 * @returns {boolean} Статус аутентификации
 */
function isAuthenticated() {
  console.warn('🍄 isAuthenticated() устарела, используйте checkAuth()');
  return checkAuth();
}

/**
 * @deprecated Используйте requireAuth() вместо этой функции
 */
function redirectToLogin() {
  console.warn('🍄 redirectToLogin() устарела, используйте requireAuth()');
  window.location.href = 'login.html';
}

/**
 * @deprecated Используйте logout() вместо этой функции
 */
function handleLogout() {
  console.warn('🍄 handleLogout() устарела, используйте logout()');
  logout();
}

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initAuth);
