/**
 * API маршруты для работы с тикетами поддержки
 * @file server/api/tickets.js
 */

const express = require('express');
const ticketService = require('../services/ticketing');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @route GET /api/tickets
 * @desc Получение списка тикетов с фильтрацией и пагинацией
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const {
      status,
      category,
      priority,
      assignedTo,
      userId,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Построение фильтра
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (userId) filter.userId = userId;

    // Опции пагинации и сортировки
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: true
    };

    const result = await ticketService.getTickets(filter, options);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('❌ Error getting tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/:ticketId
 * @desc Получение информации о конкретном тикете
 * @access Public
 */
router.get('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await ticketService.findById(ticketId);

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
    logger.error('❌ Error getting ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/tickets
 * @desc Создание нового тикета
 * @access Public
 */
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      conversationId,
      message,
      subject,
      category,
      priority,
      email,
      context,
      language
    } = req.body;

    // Валидация обязательных полей
    if (!userId || !message) {
      return res.status(400).json({
        success: false,
        error: 'UserId and message are required',
        code: 'VALIDATION_ERROR'
      });
    }

    // Создание тикета
    const ticketData = {
      userId,
      conversationId: conversationId || null,
      message,
      subject,
      category,
      priority,
      email,
      context,
      language,
      source: 'api',
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress
    };

    const ticket = await ticketService.createTicket(ticketData);

    res.status(201).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    logger.error('❌ Error creating ticket:', error);
    
    let statusCode = 500;
    let errorCode = 'INTERNAL_SERVER_ERROR';
    
    if (error.message.includes('validation')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    }
    
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode
    });
  }
});

/**
 * @route PUT /api/tickets/:ticketId
 * @desc Обновление тикета
 * @access Public
 */
router.put('/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const updateData = req.body;

    // Убираем поля, которые нельзя обновлять через API
    delete updateData.ticketId;
    delete updateData.userId;
    delete updateData.createdAt;
    delete updateData._id;

    const updatedTicket = await ticketService.updateTicket(ticketId, updateData);

    if (!updatedTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: updatedTicket
    });
  } catch (error) {
    logger.error('❌ Error updating ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/tickets/:ticketId/assign
 * @desc Назначение тикета агенту
 * @access Public
 */
router.post('/:ticketId/assign', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const ticket = await ticketService.assignTicket(ticketId, agentId);

    res.json({
      success: true,
      data: ticket,
      message: `Ticket assigned to ${agentId}`
    });
  } catch (error) {
    logger.error('❌ Error assigning ticket:', error);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    }
    
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/tickets/:ticketId/close
 * @desc Закрытие тикета с решением
 * @access Public
 */
router.post('/:ticketId/close', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { resolution, agentId } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: 'Resolution is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const ticket = await ticketService.closeTicket(ticketId, resolution, agentId);

    res.json({
      success: true,
      data: ticket,
      message: 'Ticket closed successfully'
    });
  } catch (error) {
    logger.error('❌ Error closing ticket:', error);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    }
    
    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/user/:userId
 * @desc Получение тикетов конкретного пользователя
 * @access Public
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;

    const options = {
      status,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    const tickets = await ticketService.getByUserId(userId, options);

    res.json({
      success: true,
      data: {
        tickets,
        count: tickets.length,
        userId
      }
    });
  } catch (error) {
    logger.error('❌ Error getting user tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/agent/:agentId
 * @desc Получение тикетов, назначенных конкретному агенту
 * @access Public
 */
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;

    // Используем метод из модели через service
    const filter = { assignedTo: agentId };
    if (status) filter.status = status;

    const options = {
      page: 1,
      limit: parseInt(limit),
      sort: { updatedAt: -1 }
    };

    const result = await ticketService.getTickets(filter, options);

    res.json({
      success: true,
      data: {
        tickets: result.tickets,
        pagination: result.pagination,
        agentId
      }
    });
  } catch (error) {
    logger.error('❌ Error getting agent tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get agent tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/search
 * @desc Поиск тикетов по тексту
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, status, category, priority, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      status,
      category,
      priority
    };

    const tickets = await ticketService.searchTickets(q, searchOptions);

    res.json({
      success: true,
      data: {
        tickets,
        count: tickets.length,
        query: q,
        options: searchOptions
      }
    });
  } catch (error) {
    logger.error('❌ Error searching tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/stats
 * @desc Получение статистики тикетов
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const filter = {};
    
    // Опциональные фильтры для статистики
    const { fromDate, toDate, category, assignedTo } = req.query;
    
    if (fromDate) {
      filter.createdAt = { ...filter.createdAt, $gte: new Date(fromDate) };
    }
    if (toDate) {
      filter.createdAt = { ...filter.createdAt, $lte: new Date(toDate) };
    }
    if (category) {
      filter.category = category;
    }
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }

    const stats = await ticketService.getStats(filter);

    res.json({
      success: true,
      data: {
        ...stats,
        filter,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('❌ Error getting ticket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ticket statistics',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/overdue
 * @desc Получение просроченных тикетов
 * @access Public
 */
router.get('/overdue', async (req, res) => {
  try {
    const { hoursOverdue = 24 } = req.query;

    const overdueTickets = await ticketService.findOverdueTickets(parseInt(hoursOverdue));

    res.json({
      success: true,
      data: {
        tickets: overdueTickets,
        count: overdueTickets.length,
        hoursOverdue: parseInt(hoursOverdue)
      }
    });
  } catch (error) {
    logger.error('❌ Error getting overdue tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get overdue tickets',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/categories
 * @desc Получение списка доступных категорий тикетов
 * @access Public
 */
router.get('/categories', async (req, res) => {
  try {
    // Получаем категории из сервиса тикетов
    const categories = [
      'technical',
      'account',
      'billing',
      'feature',
      'bug',
      'wallet',
      'staking',
      'farming',
      'other'
    ];

    const priorities = [
      'low',
      'medium',
      'high',
      'urgent'
    ];

    const statuses = [
      'open',
      'in_progress',
      'waiting_response',
      'resolved',
      'closed'
    ];

    res.json({
      success: true,
      data: {
        categories,
        priorities,
        statuses
      }
    });
  } catch (error) {
    logger.error('❌ Error getting ticket categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ticket categories',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route POST /api/tickets/:ticketId/escalate
 * @desc Эскалация тикета (повышение приоритета)
 * @access Public
 */
router.post('/:ticketId/escalate', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { newPriority, reason } = req.body;

    if (!newPriority) {
      return res.status(400).json({
        success: false,
        error: 'New priority is required',
        code: 'VALIDATION_ERROR'
      });
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(newPriority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority level',
        code: 'VALIDATION_ERROR'
      });
    }

    // Обновляем приоритет тикета
    const updateData = { 
      priority: newPriority,
      'metadata.escalationReason': reason || 'Manual escalation'
    };

    const ticket = await ticketService.updateTicket(ticketId, updateData);

    res.json({
      success: true,
      data: ticket,
      message: `Ticket escalated to ${newPriority} priority`
    });
  } catch (error) {
    logger.error('❌ Error escalating ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to escalate ticket',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/tickets/health
 * @desc Проверка здоровья API тикетов
 * @access Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await ticketService.healthCheck();

    res.status(health.status === 'ok' ? 200 : 503).json({
      success: health.status === 'ok',
      ...health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Ticket health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;