/**
 * Сервис для управления сообщениями в чате
 * @file server/services/message.js
 * 🔧 FIXED: Use existing Message model instead of creating duplicate
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * @typedef {Object} MessageData
 * @property {string} text - Текст сообщения
 * @property {string} role - Роль отправителя (user