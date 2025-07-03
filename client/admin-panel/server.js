/**
 * Простой статический сервер для админ-панели "Читатель"
 * Для разработки и демонстрации
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3002;
const PUBLIC_DIR = __dirname;

// MIME типы для разных файлов
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

/**
 * Создание HTTP сервера
 */
const server = http.createServer((req, res) => {
    // Получаем путь из URL
    let urlPath = req.url === '/' ? '/login.html' : req.url;
    
    // Убираем query параметры
    urlPath = urlPath.split('?')[0];
    
    // Полный путь к файлу
    const filePath = path.join(PUBLIC_DIR, urlPath);
    
    // Проверяем, что файл находится в разрешенной директории
    if (!filePath.startsWith(PUBLIC_DIR)) {
        return sendError(res, 403, 'Доступ запрещен');
    }
    
    // Обработка API запросов (заглушки)
    if (urlPath.startsWith('/api/')) {
        return handleApiRequest(req, res,