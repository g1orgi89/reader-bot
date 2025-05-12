/**
 * Tickets API Tests
 * @file server/tests/api/tickets.test.js
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const ticketsRouter = require('../../api/tickets');
const { createSuccessResponse, createErrorResponse } = require('../../types/api');
const { TicketStatus, TicketPriority, TicketCategory } = require('../../types/ticket');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../middleware/adminAuth', () => ({
  requireAdminAuth: (req, res, next) => {
    req.admin = { id: 'admin-test', role: 'admin' };
    next();
  },
  optionalAdminAuth: (req, res, next) => {
    if (req.headers.authorization) {
      req.admin = { id: 'admin-test', role: 'admin' };
    }
    next();
  }
}));

// Mock the ticket service
const mockTicketService = {
  createTicket: jest.fn(),
  getTickets: jest.fn(),
  getTicketById: jest.fn(),
  updateTicket: jest.fn(),
  closeTicket: jest.fn(),
  assignTicket: jest.fn(),
  getAssignedTickets: jest.fn(),
  getUserTickets: jest.fn(),
  searchTickets: jest.fn(),
  getTicketsByStatus: jest.fn(),
  getTicketStatistics: jest.fn(),
  TicketStatus,
  TicketPriority,
  TicketCategory
};

jest.mock('../../services/ticketing', () => mockTicketService);

describe('Tickets API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/tickets', ticketsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/tickets', () => {
    it('should create a new ticket successfully', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: 'conv123',
        subject: 'Test ticket',
        initialMessage: 'This is a test ticket'
      };

      const createdTicket = {
        _id: '507f1f77bcf86cd799439011',
        ticketId: 'TKT-123',
        ...ticketData,
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        category: TicketCategory.OTHER,
        createdAt: new Date()
      };

      mockTicketService.createTicket.mockResolvedValue(createdTicket);

      const response = await request(app)
        .post('/api/tickets')
        .send(ticketData)
        .expect(201);

      expect(response.body).toEqual(createSuccessResponse(createdTicket, 'Ticket created successfully'));
      expect(mockTicketService.createTicket).toHaveBeenCalledWith({
        ...ticketData,
        language: 'en',
        priority: TicketPriority.MEDIUM,
        category: TicketCategory.OTHER
      });
    });

    it('should fail if required fields are missing', async () => {
      const incompleteData = {
        userId: 'user123',
        subject: 'Test ticket'
        // Missing conversationId and initialMessage
      };

      const response = await request(app)
        .post('/api/tickets')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('MISSING_FIELDS');
      expect(mockTicketService.createTicket).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: 'conv123',
        subject: 'Test ticket',
        initialMessage: 'This is a test ticket'
      };

      mockTicketService.createTicket.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/tickets')
        .send(ticketData)
        .expect(500);

      expect(response.body).toEqual(createErrorResponse('Failed to create ticket'));
    });
  });

  describe('GET /api/tickets', () => {
    it('should get tickets with pagination', async () => {
      const mockResult = {
        items: [
          { _id: '1', ticketId: 'TKT-001', subject: 'Ticket 1' },
          { _id: '2', ticketId: 'TKT-002', subject: 'Ticket 2' }
        ],
        totalCount: 25,
        page: 1,
        totalPages: 3,
        limit: 10
      };

      mockTicketService.getTickets.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/tickets?page=1&limit=10')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.total).toBe(25);
      expect(mockTicketService.getTickets).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 10, sort: '-createdAt' }
      );
    });

    it('should filter tickets by status', async () => {
      const mockResult = {
        items: [{ _id: '1', ticketId: 'TKT-001', status: 'open' }],
        totalCount: 1,
        page: 1,
        totalPages: 1,
        limit: 20
      };

      mockTicketService.getTickets.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/tickets?status=open')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockTicketService.getTickets).toHaveBeenCalledWith(
        { status: 'open' },
        { page: 1, limit: 20, sort: '-createdAt' }
      );
    });

    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/tickets')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('MISSING_AUTH');
    });
  });

  describe('GET /api/tickets/:ticketId', () => {
    it('should get a specific ticket', async () => {
      const mockTicket = {
        _id: '507f1f77bcf86cd799439011',
        ticketId: 'TKT-123',
        subject: 'Test ticket',
        status: TicketStatus.OPEN
      };

      mockTicketService.getTicketById.mockResolvedValue(mockTicket);

      const response = await request(app)
        .get('/api/tickets/TKT-123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(mockTicket));
      expect(mockTicketService.getTicketById).toHaveBeenCalledWith('TKT-123');
    });

    it('should return 404 if ticket not found', async () => {
      mockTicketService.getTicketById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/tickets/NONEXISTENT')
        .set('Authorization', 'Bearer admin-token')
        .expect(404);

      expect(response.body).toEqual(createErrorResponse('Ticket not found', 'TICKET_NOT_FOUND', 404));
    });
  });

  describe('PUT /api/tickets/:ticketId', () => {
    it('should update a ticket successfully', async () => {
      const updateData = {
        status: TicketStatus.IN_PROGRESS,
        priority: TicketPriority.HIGH,
        assignedTo: 'agent123'
      };

      const updatedTicket = {
        _id: '507f1f77bcf86cd799439011',
        ticketId: 'TKT-123',
        ...updateData,
        updatedAt: new Date()
      };

      mockTicketService.updateTicket.mockResolvedValue(updatedTicket);

      const response = await request(app)
        .put('/api/tickets/TKT-123')
        .set('Authorization', 'Bearer admin-token')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(updatedTicket, 'Ticket updated successfully'));
      expect(mockTicketService.updateTicket).toHaveBeenCalledWith('TKT-123', updateData);
    });

    it('should validate enum values', async () => {
      const invalidData = {
        status: 'invalid_status',
        priority: 'invalid_priority'
      };

      const response = await request(app)
        .put('/api/tickets/TKT-123')
        .set('Authorization', 'Bearer admin-token')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_STATUS');
    });
  });

  describe('POST /api/tickets/:ticketId/close', () => {
    it('should close a ticket with resolution', async () => {
      const resolution = 'Issue resolved by restarting service';
      
      const closedTicket = {
        _id: '507f1f77bcf86cd799439011',
        ticketId: 'TKT-123',
        status: TicketStatus.CLOSED,
        resolution,
        resolvedAt: new Date()
      };

      mockTicketService.closeTicket.mockResolvedValue(closedTicket);

      const response = await request(app)
        .post('/api/tickets/TKT-123/close')
        .set('Authorization', 'Bearer admin-token')
        .send({ resolution })
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(closedTicket, 'Ticket closed successfully'));
      expect(mockTicketService.closeTicket).toHaveBeenCalledWith('TKT-123', resolution, 'admin-test');
    });

    it('should require resolution', async () => {
      const response = await request(app)
        .post('/api/tickets/TKT-123/close')
        .set('Authorization', 'Bearer admin-token')
        .send({})
        .expect(400);

      expect(response.body).toEqual(createErrorResponse('Resolution is required', 'RESOLUTION_REQUIRED', 400));
    });
  });

  describe('POST /api/tickets/:ticketId/assign', () => {
    it('should assign a ticket to an agent', async () => {
      const assignedTo = 'agent123';
      
      const assignedTicket = {
        _id: '507f1f77bcf86cd799439011',
        ticketId: 'TKT-123',
        status: TicketStatus.IN_PROGRESS,
        assignedTo
      };

      mockTicketService.assignTicket.mockResolvedValue(assignedTicket);

      const response = await request(app)
        .post('/api/tickets/TKT-123/assign')
        .set('Authorization', 'Bearer admin-token')
        .send({ assignedTo })
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(assignedTicket, 'Ticket assigned successfully'));
      expect(mockTicketService.assignTicket).toHaveBeenCalledWith('TKT-123', assignedTo);
    });
  });

  describe('GET /api/tickets/user/:userId', () => {
    it('should get user tickets with optional admin auth', async () => {
      const mockTickets = [
        { _id: '1', ticketId: 'TKT-001', userId: 'user123' },
        { _id: '2', ticketId: 'TKT-002', userId: 'user123' }
      ];

      mockTicketService.getUserTickets.mockResolvedValue(mockTickets);

      const response = await request(app)
        .get('/api/tickets/user/user123')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(mockTickets));
      expect(mockTicketService.getUserTickets).toHaveBeenCalledWith('user123', { limit: 20 });
    });
  });

  describe('GET /api/tickets/search', () => {
    it('should search tickets', async () => {
      const query = 'connection issue';
      const mockResults = [
        { _id: '1', ticketId: 'TKT-001', subject: 'Connection issue' },
        { _id: '2', ticketId: 'TKT-002', subject: 'Network connection problem' }
      ];

      mockTicketService.searchTickets.mockResolvedValue(mockResults);

      const response = await request(app)
        .get(`/api/tickets/search?q=${encodeURIComponent(query)}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(mockResults));
      expect(mockTicketService.searchTickets).toHaveBeenCalledWith(query, { limit: 20 });
    });

    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/tickets/search')
        .set('Authorization', 'Bearer admin-token')
        .expect(400);

      expect(response.body).toEqual(createErrorResponse('Search query is required', 'QUERY_REQUIRED', 400));
    });
  });

  describe('GET /api/tickets/status/:status', () => {
    it('should get tickets by status', async () => {
      const status = TicketStatus.OPEN;
      const mockTickets = [
        { _id: '1', ticketId: 'TKT-001', status },
        { _id: '2', ticketId: 'TKT-002', status }
      ];

      mockTicketService.getTicketsByStatus.mockResolvedValue(mockTickets);

      const response = await request(app)
        .get(`/api/tickets/status/${status}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(mockTickets));
      expect(mockTicketService.getTicketsByStatus).toHaveBeenCalledWith(status, { limit: 50 });
    });

    it('should validate status', async () => {
      const response = await request(app)
        .get('/api/tickets/status/invalid_status')
        .set('Authorization', 'Bearer admin-token')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('INVALID_STATUS');
    });
  });

  describe('GET /api/tickets/stats', () => {
    it('should get ticket statistics', async () => {
      const mockStats = {
        byStatus: {
          open: 15,
          in_progress: 8,
          resolved: 25,
          closed: 100
        },
        byPriority: {
          low: 20,
          medium: 80,
          high: 40,
          urgent: 8
        },
        byCategory: {
          technical: 60,
          account: 20,
          billing: 15,
          feature: 30,
          other: 23
        }
      };

      mockTicketService.getTicketStatistics.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/tickets/stats')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(response.body).toEqual(createSuccessResponse(mockStats));
      expect(mockTicketService.getTicketStatistics).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle CastError for invalid ObjectId', async () => {
      const error = new Error('Cast to ObjectId failed');
      error.name = 'CastError';
      
      mockTicketService.getTicketById.mockRejectedValue(error);

      const response = await request(app)
        .get('/api/tickets/invalid-id')
        .set('Authorization', 'Bearer admin-token')
        .expect(400);

      expect(response.body).toEqual(createErrorResponse('Invalid ticket ID format', 'INVALID_TICKET_ID', 400));
    });

    it('should handle generic errors', async () => {
      mockTicketService.getTickets.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/tickets')
        .set('Authorization', 'Bearer admin-token')
        .expect(500);

      expect(response.body).toEqual(createErrorResponse('Failed to fetch tickets'));
    });
  });
});

// Integration tests with middleware
describe('Tickets API Integration', () => {
  let app;

  beforeAll(() => {
    // Create app without mocked middleware for integration tests
    app = express();
    app.use(express.json());

    // Add real middleware (would need to be configured properly)
    // app.use('/api/tickets', ticketsRouter);
  });

  // Add integration tests here if needed
});