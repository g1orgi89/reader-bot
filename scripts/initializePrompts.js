/**
 * Скрипт инициализации промптов в MongoDB
 * Загружает системные промпты из server/config/prompts.js в базу данных
 * @file scripts/initializePrompts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Prompt = require('../server/models/prompt');
const prompts = require('../server/config/prompts');

// Конфигурация для подключения к MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shrooms-support';

/**
 * Определение системных промптов для инициализации
 */
const SYSTEM_PROMPTS = [
  // Базовые системные промпты для разных языков
  {
    name: 'Sh