/**
 * API маршруты для управления тикетами
 * @file server/api/tickets.js
 */

const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticketing');
const conversationService = require('../services/conversation');
const logger = require('../utils/logger');
const { requireAdminAuth } = require('../middleware/adminAuth');

/**
 * @typedef {Object} TicketResponse
 * @property {boolean} success - Статус успешности операции
 * @property {Object} data - Данные тикета или ошибка
 */

/**
 * @typedef {Object} TicketFilters
 * @property {string} [status] - Статус тикета (open, in_progress, resolved, closed)
 * @property {string} [priority] - Приоритет (low, medium, high, urgent)
 * @property {string} [category] - Категория тикета
 * @property {string} [assignedTo] - Ответственный за тикет
 * @property {number} [page] - Номер страницы для пагинации
 * @property {number} [limit] - Количество тикетов на странице
 */

/**
 * Получить статистику по тикетам
 * @route GET /api/tickets/stats/summary
 * @access Private (Admin)
 * @returns {Promise<Object>} Статистика тикетов
 */
router.get('/stats/summary', requireAdminAuth, async (req, res) => {
  try {
    const stats = await ticketService.getTicketStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error fetching ticket stats: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticket statistics',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Получить список всех тикетов с фильтрацией
 * @route GET /api/tickets
 * @access Private (Admin)
 * @param {TicketFilters} query - Параметры фильтрации
 * @returns {Promise<TicketResponse>} Список тикетов с пагинацией
 */
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      assignedTo,
      page = 1,
      limit = 10,
      sort = '-createdAt',
      search
    } = req.query;

    // Построение фильтров
    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (category) filters.category = category;
    if (assignedTo) filters.assignedTo = assignedTo;

    // Поиск по содержимому
    if (search) {
      filters.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { initialMessage: { $regex: search, $options: 'i' } },
        { ticketId: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: 'conversationId'
    };

    const result = await ticketService.getTickets(filters, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`Error fetching tickets: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Создать новый тикет
 * @route POST /api/tickets
 * @access Private (Admin) / Public (for auto-creation)
 * @body {Object} ticketData - Данные для создания тикета
 * @returns {Promise<TicketResponse>} Созданный тикет
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      conversationId,
      subject,
      message,
      initialMessage,
      context,
      priority = 'medium',
      category = 'technical',
      language = 'en',
      email,
      source = 'api'
    } = req.body;

    // Валидация обязательных полей
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    if (!subject && !message && !initialMessage) {
      return res.status(400).json({
        success: false,
        error: 'Subject or message is required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Создание или поиск разговора
    let conversation = null;
    if (conversationId) {
      conversation = await conversationService.getConversationById(conversationId);
    } else {
      // Создаем новый разговор для ручных тикетов
      conversation = await conversationService.createConversation(userId, {
        source: 'ticket',
        language
      });
    }

    // Подготовка данных тикета
    const ticketData = {
      userId,
      conversationId: conversation._id,
      subject: subject || `Support request: ${(initialMessage || message).substring(0, 50)}...`,
      initialMessage: initialMessage || message,
      context: context || JSON.stringify({ source: 'manual', initialMessage: initialMessage || message }),
      priority,
      category,
      language,
      email,
      metadata: {
        source,
        tags: [],
        createdBy: req.admin ? req.admin.id : 'system'
      }
    };

    const ticket = await ticketService.createTicket(ticketData);

    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error(`Error creating ticket: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to create ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Добавить комментарий к тикету
 * @route POST /api/tickets/:id/comments
 * @access Private (Admin)
 * @param {string} id - ID тикета
 * @body {Object} commentData - Данные комментария
 * @returns {Promise<TicketResponse>} Обновленный тикет с комментарием
 */
router.post('/:id/comments', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const comment = {
      content,
      authorId: req.admin ? req.admin.id : 'system',
      authorName: req.admin ? req.admin.username : 'Administrator',
      isInternal,
      createdAt: new Date()
    };

    // Пробуем добавить комментарий по ticketId, затем по ObjectId
    let ticket = await ticketService.addCommentByTicketId(id, comment);
    
    if (!ticket && id.match(/^[0-9a-fA-F]{24}$/)) {
      ticket = await ticketService.addCommentById(id, comment);
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error(`Error adding comment to ticket ${req.params.id}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Получить конкретный тикет по ID
 * @route GET /api/tickets/:id
 * @access Private (Admin)
 * @param {string} id - ID тикета (ticketId или _id)
 * @returns {Promise<TicketResponse>} Данные тикета
 */
router.get('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Пробуем найти тикет сначала по ticketId, затем по ObjectId
    let ticket = await ticketService.getTicketByTicketId(id);
    
    if (!ticket && id.match(/^[0-9a-fA-F]{24}$/)) {
      // Если не найден по ticketId и id выглядит как ObjectId
      ticket = await ticketService.getTicketById(id);
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error(`Error fetching ticket ${req.params.id}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Обновить тикет
 * @route PATCH /api/tickets/:id
 * @access Private (Admin)
 * @param {string} id - ID тикета (ticketId или _id)
 * @body {Object} updateData - Данные для обновления
 * @returns {Promise<TicketResponse>} Обновленный тикет
 */
router.patch('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Валидация данных для обновления
    const allowedFields = [
      'status',
      'priority',
      'category',
      'assignedTo',
      'email',
      'resolution',
      'metadata'
    ];

    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updateData[key];
      }
    });

    // Добавляем информацию об обновлении
    filteredData.updatedAt = new Date();
    if (req.admin) {
      filteredData.lastUpdatedBy = req.admin.id;
    }

    // Если статус меняется на resolved или closed, добавляем время завершения
    if (filteredData.status === 'resolved' || filteredData.status === 'closed') {
      filteredData.resolvedAt = new Date();
    }

    // Пробуем найти и обновить тикет сначала по ticketId, затем по ObjectId
    let ticket = await ticketService.updateTicketByTicketId(id, filteredData);
    
    if (!ticket && id.match(/^[0-9a-fA-F]{24}$/)) {
      ticket = await ticketService.updateTicketById(id, filteredData);
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error(`Error updating ticket ${req.params.id}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * 🗑️ ФИЗИЧЕСКИ УДАЛИТЬ тикет (НЕОБРАТИМО)
 * @route DELETE /api/tickets/:id
 * @access Private (Admin)
 * @param {string} id - ID тикета (ticketId или MongoDB ObjectId)
 * @returns {Promise<TicketResponse>} Подтверждение удаления
 */
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Получаем информацию об администраторе для логирования
    const deletedBy = req.admin ? `${req.admin.username} (${req.admin.id})` : 'Administrator';
    
    // Пробуем удалить тикет сначала по ticketId, затем по ObjectId
    let deletedTicket = await ticketService.deleteTicketByTicketId(id, deletedBy);
    
    if (!deletedTicket && id.match(/^[0-9a-fA-F]{24}$/)) {
      deletedTicket = await ticketService.deleteTicketById(id, deletedBy);
    }

    if (!deletedTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    // Формируем безопасный ответ (без полных данных тикета)
    const response = {
      success: true,
      data: {
        ticketId: deletedTicket.ticketId,
        subject: deletedTicket.subject,
        status: 'deleted',
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBy
      },
      message: `Ticket ${deletedTicket.ticketId} permanently deleted`
    };

    res.json(response);
  } catch (error) {
    logger.error(`Error deleting ticket ${req.params.id}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * 🔒 Закрыть тикет (НЕ удалять)
 * @route POST /api/tickets/:id/close
 * @access Private (Admin) 
 * @param {string} id - ID тикета
 * @body {Object} closeData - Причина закрытия
 * @returns {Promise<TicketResponse>} Закрытый тикет
 */
router.post('/:id/close', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution = 'Closed by administrator' } = req.body;

    // Пробуем закрыть тикет по ticketId, затем по ObjectId
    let ticket = await ticketService.closeTicketByTicketId(id, resolution, req.admin?.id);
    
    if (!ticket && id.match(/^[0-9a-fA-F]{24}$/)) {
      ticket = await ticketService.closeTicketById(id, resolution, req.admin?.id);
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket closed successfully'
    });
  } catch (error) {
    logger.error(`Error closing ticket ${req.params.id}: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to close ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;