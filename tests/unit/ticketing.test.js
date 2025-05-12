/**
 * Tests for TicketService
 * @file tests/unit/ticketing.test.js
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ticketService = require('../../server/services/ticketing');
const Ticket = require('../../server/models/ticket');

describe('TicketService', () => {
  let mongoServer;

  // Setup in-memory MongoDB for testing
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database before each test
    await Ticket.deleteMany({});
  });

  describe('Enums and Type Guards', () => {
    test('should have correct enum values', () => {
      expect(ticketService.TicketStatus.OPEN).toBe('open');
      expect(ticketService.TicketStatus.IN_PROGRESS).toBe('in_progress');
      expect(ticketService.TicketStatus.RESOLVED).toBe('resolved');
      expect(ticketService.TicketStatus.CLOSED).toBe('closed');

      expect(ticketService.TicketPriority.LOW).toBe('low');
      expect(ticketService.TicketPriority.MEDIUM).toBe('medium');
      expect(ticketService.TicketPriority.HIGH).toBe('high');
      expect(ticketService.TicketPriority.URGENT).toBe('urgent');

      expect(ticketService.TicketCategory.TECHNICAL).toBe('technical');
      expect(ticketService.TicketCategory.ACCOUNT).toBe('account');
      expect(ticketService.TicketCategory.BILLING).toBe('billing');
      expect(ticketService.TicketCategory.FEATURE).toBe('feature');
      expect(ticketService.TicketCategory.OTHER).toBe('other');
    });

    test('type guards should work correctly', () => {
      expect(ticketService.isValidStatus('open')).toBe(true);
      expect(ticketService.isValidStatus('invalid')).toBe(false);

      expect(ticketService.isValidPriority('high')).toBe(true);
      expect(ticketService.isValidPriority('super-high')).toBe(false);

      expect(ticketService.isValidCategory('technical')).toBe(true);
      expect(ticketService.isValidCategory('unknown')).toBe(false);
    });
  });

  describe('createTicket', () => {
    test('should create a ticket with required fields', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'This is a test ticket'
      };

      const ticket = await ticketService.createTicket(ticketData);

      expect(ticket).toBeDefined();
      expect(ticket.userId).toBe(ticketData.userId);
      expect(ticket.subject).toBe(ticketData.subject);
      expect(ticket.initialMessage).toBe(ticketData.initialMessage);
      expect(ticket.status).toBe(ticketService.TicketStatus.OPEN);
      expect(ticket.priority).toBe(ticketService.TicketPriority.MEDIUM);
      expect(ticket.category).toBe(ticketService.TicketCategory.OTHER);
      expect(ticket.ticketId).toMatch(/^SHR[0-9A-Z]+$/);
    });

    test('should create a ticket with custom priority and category', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Urgent technical issue',
        initialMessage: 'System is down',
        priority: ticketService.TicketPriority.URGENT,
        category: ticketService.TicketCategory.TECHNICAL
      };

      const ticket = await ticketService.createTicket(ticketData);

      expect(ticket.priority).toBe(ticketService.TicketPriority.URGENT);
      expect(ticket.category).toBe(ticketService.TicketCategory.TECHNICAL);
    });

    test('should throw error for missing required fields', async () => {
      const ticketData = {
        userId: 'user123'
        // Missing required fields
      };

      await expect(ticketService.createTicket(ticketData))
        .rejects.toThrow('Validation errors');
    });

    test('should throw error for invalid enum values', async () => {
      const ticketData = {
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'This is a test ticket',
        status: 'invalid-status'
      };

      await expect(ticketService.createTicket(ticketData))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('getTickets', () => {
    beforeEach(async () => {
      // Create test tickets
      await ticketService.createTicket({
        userId: 'user1',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Open ticket',
        initialMessage: 'Open issue'
      });

      await ticketService.createTicket({
        userId: 'user2',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'High priority ticket',
        initialMessage: 'Important issue',
        priority: ticketService.TicketPriority.HIGH,
        status: ticketService.TicketStatus.IN_PROGRESS
      });
    });

    test('should get all tickets with pagination', async () => {
      const result = await ticketService.getTickets({}, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    test('should filter tickets by status', async () => {
      const result = await ticketService.getTickets(
        { status: ticketService.TicketStatus.OPEN },
        { page: 1, limit: 10 }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe(ticketService.TicketStatus.OPEN);
    });

    test('should filter tickets by priority', async () => {
      const result = await ticketService.getTickets(
        { priority: ticketService.TicketPriority.HIGH },
        { page: 1, limit: 10 }
      );

      expect(result.items).toHaveLength(1);
      expect(result.items[0].priority).toBe(ticketService.TicketPriority.HIGH);
    });

    test('should throw error for invalid filter values', async () => {
      await expect(ticketService.getTickets({ status: 'invalid' }))
        .rejects.toThrow('Invalid status filter');
    });
  });

  describe('getTicketById', () => {
    let createdTicket;

    beforeEach(async () => {
      createdTicket = await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'Test message'
      });
    });

    test('should get ticket by ticketId', async () => {
      const ticket = await ticketService.getTicketById(createdTicket.ticketId);

      expect(ticket).toBeDefined();
      expect(ticket.ticketId).toBe(createdTicket.ticketId);
    });

    test('should get ticket by MongoDB _id', async () => {
      const ticket = await ticketService.getTicketById(createdTicket._id);

      expect(ticket).toBeDefined();
      expect(ticket._id.toString()).toBe(createdTicket._id.toString());
    });

    test('should return null for non-existent ticket', async () => {
      const ticket = await ticketService.getTicketById('NONEXISTENT');

      expect(ticket).toBeNull();
    });
  });

  describe('updateTicket', () => {
    let createdTicket;

    beforeEach(async () => {
      createdTicket = await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'Test message'
      });
    });

    test('should update ticket status', async () => {
      const updatedTicket = await ticketService.updateTicket(
        createdTicket.ticketId,
        { status: ticketService.TicketStatus.IN_PROGRESS }
      );

      expect(updatedTicket.status).toBe(ticketService.TicketStatus.IN_PROGRESS);
    });

    test('should update multiple fields', async () => {
      const updateData = {
        status: ticketService.TicketStatus.RESOLVED,
        priority: ticketService.TicketPriority.HIGH,
        assignedTo: 'agent1'
      };

      const updatedTicket = await ticketService.updateTicket(
        createdTicket.ticketId,
        updateData
      );

      expect(updatedTicket.status).toBe(updateData.status);
      expect(updatedTicket.priority).toBe(updateData.priority);
      expect(updatedTicket.assignedTo).toBe(updateData.assignedTo);
    });

    test('should throw error for invalid updates', async () => {
      await expect(ticketService.updateTicket(
        createdTicket.ticketId,
        { status: 'invalid-status' }
      )).rejects.toThrow('Invalid status');
    });

    test('should return null for non-existent ticket', async () => {
      const result = await ticketService.updateTicket(
        'NONEXISTENT',
        { status: ticketService.TicketStatus.CLOSED }
      );

      expect(result).toBeNull();
    });
  });

  describe('closeTicket', () => {
    let createdTicket;

    beforeEach(async () => {
      createdTicket = await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'Test message'
      });
    });

    test('should close ticket without resolution', async () => {
      const closedTicket = await ticketService.closeTicket(createdTicket.ticketId);

      expect(closedTicket.status).toBe(ticketService.TicketStatus.CLOSED);
      expect(closedTicket.resolvedAt).toBeDefined();
    });

    test('should close ticket with resolution', async () => {
      const resolution = 'Fixed by restarting the service';
      const closedTicket = await ticketService.closeTicket(
        createdTicket.ticketId,
        resolution
      );

      expect(closedTicket.status).toBe(ticketService.TicketStatus.CLOSED);
      expect(closedTicket.resolution).toBe(resolution);
    });

    test('should close ticket with resolution and assignee', async () => {
      const resolution = 'Resolved by agent';
      const agent = 'agent123';
      const closedTicket = await ticketService.closeTicket(
        createdTicket.ticketId,
        resolution,
        agent
      );

      expect(closedTicket.status).toBe(ticketService.TicketStatus.CLOSED);
      expect(closedTicket.resolution).toBe(resolution);
      expect(closedTicket.assignedTo).toBe(agent);
    });
  });

  describe('getTicketsByStatus', () => {
    beforeEach(async () => {
      // Create tickets with different statuses
      await ticketService.createTicket({
        userId: 'user1',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Open ticket 1',
        initialMessage: 'Open issue 1'
      });

      await ticketService.createTicket({
        userId: 'user2',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Open ticket 2',
        initialMessage: 'Open issue 2'
      });

      await ticketService.createTicket({
        userId: 'user3',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Progress ticket',
        initialMessage: 'In progress issue',
        status: ticketService.TicketStatus.IN_PROGRESS
      });
    });

    test('should get tickets by status', async () => {
      const openTickets = await ticketService.getTicketsByStatus(
        ticketService.TicketStatus.OPEN
      );

      expect(openTickets).toHaveLength(2);
      openTickets.forEach(ticket => {
        expect(ticket.status).toBe(ticketService.TicketStatus.OPEN);
      });
    });

    test('should get tickets by status with assignee filter', async () => {
      // Update one ticket to have an assignee
      const tickets = await ticketService.getTicketsByStatus(
        ticketService.TicketStatus.OPEN
      );
      await ticketService.updateTicket(tickets[0]._id, { assignedTo: 'agent1' });

      const assignedTickets = await ticketService.getTicketsByStatus(
        ticketService.TicketStatus.OPEN,
        { assignedTo: 'agent1' }
      );

      expect(assignedTickets).toHaveLength(1);
      expect(assignedTickets[0].assignedTo).toBe('agent1');
    });

    test('should throw error for invalid status', async () => {
      await expect(ticketService.getTicketsByStatus('invalid-status'))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('searchTickets', () => {
    beforeEach(async () => {
      await ticketService.createTicket({
        userId: 'user1',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Login problem',
        initialMessage: 'Unable to log into the system'
      });

      await ticketService.createTicket({
        userId: 'user2',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Payment issue',
        initialMessage: 'Payment gateway not working'
      });

      await ticketService.createTicket({
        userId: 'user3',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Account suspension',
        initialMessage: 'My account was suspended unexpectedly'
      });
    });

    test('should search tickets by subject', async () => {
      const results = await ticketService.searchTickets('Login');

      expect(results).toHaveLength(1);
      expect(results[0].subject).toContain('Login');
    });

    test('should search tickets by initial message', async () => {
      const results = await ticketService.searchTickets('payment gateway');

      expect(results).toHaveLength(1);
      expect(results[0].initialMessage).toContain('Payment gateway');
    });

    test('should be case insensitive', async () => {
      const results = await ticketService.searchTickets('ACCOUNT');

      expect(results).toHaveLength(1);
      expect(results[0].subject.toLowerCase()).toContain('account');
    });

    test('should filter by status', async () => {
      // Close one ticket
      const tickets = await ticketService.searchTickets('Login');
      await ticketService.closeTicket(tickets[0]._id);

      const openResults = await ticketService.searchTickets('Login', {
        status: ticketService.TicketStatus.OPEN
      });

      expect(openResults).toHaveLength(0);

      const allResults = await ticketService.searchTickets('Login');
      expect(allResults).toHaveLength(1);
    });

    test('should throw error for invalid search term', async () => {
      await expect(ticketService.searchTickets(''))
        .rejects.toThrow('Search term is required');

      await expect(ticketService.searchTickets(null))
        .rejects.toThrow('Search term is required');
    });
  });

  describe('getUserTickets', () => {
    beforeEach(async () => {
      await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'User ticket 1',
        initialMessage: 'First ticket'
      });

      await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'User ticket 2',
        initialMessage: 'Second ticket',
        status: ticketService.TicketStatus.CLOSED
      });

      await ticketService.createTicket({
        userId: 'user456',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Another user ticket',
        initialMessage: 'Different user'
      });
    });

    test('should get all tickets for a user', async () => {
      const tickets = await ticketService.getUserTickets('user123');

      expect(tickets).toHaveLength(2);
      tickets.forEach(ticket => {
        expect(ticket.userId).toBe('user123');
      });
    });

    test('should filter user tickets by status', async () => {
      const openTickets = await ticketService.getUserTickets('user123', {
        status: ticketService.TicketStatus.OPEN
      });

      expect(openTickets).toHaveLength(1);
      expect(openTickets[0].status).toBe(ticketService.TicketStatus.OPEN);
    });

    test('should limit results', async () => {
      const tickets = await ticketService.getUserTickets('user123', {
        limit: 1
      });

      expect(tickets).toHaveLength(1);
    });

    test('should throw error for invalid userId', async () => {
      await expect(ticketService.getUserTickets(''))
        .rejects.toThrow('userId is required');

      await expect(ticketService.getUserTickets(null))
        .rejects.toThrow('userId is required');
    });
  });

  describe('assignTicket', () => {
    let createdTicket;

    beforeEach(async () => {
      createdTicket = await ticketService.createTicket({
        userId: 'user123',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Test ticket',
        initialMessage: 'Test message'
      });
    });

    test('should assign ticket to agent', async () => {
      const assignedTicket = await ticketService.assignTicket(
        createdTicket.ticketId,
        'agent123'
      );

      expect(assignedTicket.assignedTo).toBe('agent123');
      expect(assignedTicket.status).toBe(ticketService.TicketStatus.IN_PROGRESS);
    });

    test('should throw error for invalid agentId', async () => {
      await expect(ticketService.assignTicket(createdTicket.ticketId, ''))
        .rejects.toThrow('agentId is required');

      await expect(ticketService.assignTicket(createdTicket.ticketId, null))
        .rejects.toThrow('agentId is required');
    });
  });

  describe('getAssignedTickets', () => {
    beforeEach(async () => {
      // Create tickets and assign them
      const ticket1 = await ticketService.createTicket({
        userId: 'user1',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Assigned ticket 1',
        initialMessage: 'First assigned'
      });

      const ticket2 = await ticketService.createTicket({
        userId: 'user2',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Assigned ticket 2',
        initialMessage: 'Second assigned'
      });

      await ticketService.assignTicket(ticket1._id, 'agent123');
      await ticketService.assignTicket(ticket2._id, 'agent456');
    });

    test('should get tickets assigned to an agent', async () => {
      const tickets = await ticketService.getAssignedTickets('agent123');

      expect(tickets).toHaveLength(1);
      expect(tickets[0].assignedTo).toBe('agent123');
      expect(tickets[0].status).toBe(ticketService.TicketStatus.IN_PROGRESS);
    });

    test('should filter by status', async () => {
      // Close one assigned ticket
      const tickets = await ticketService.getAssignedTickets('agent123');
      await ticketService.closeTicket(tickets[0]._id);

      const openTickets = await ticketService.getAssignedTickets('agent123', {
        status: ticketService.TicketStatus.IN_PROGRESS
      });

      expect(openTickets).toHaveLength(0);

      const closedTickets = await ticketService.getAssignedTickets('agent123', {
        status: ticketService.TicketStatus.CLOSED
      });

      expect(closedTickets).toHaveLength(1);
    });

    test('should throw error for invalid agentId', async () => {
      await expect(ticketService.getAssignedTickets(''))
        .rejects.toThrow('agentId is required');
    });
  });

  describe('getTicketStatistics', () => {
    beforeEach(async () => {
      // Create tickets with different properties
      await ticketService.createTicket({
        userId: 'user1',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Open technical',
        initialMessage: 'Tech issue',
        category: ticketService.TicketCategory.TECHNICAL,
        priority: ticketService.TicketPriority.HIGH
      });

      await ticketService.createTicket({
        userId: 'user2',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'In progress billing',
        initialMessage: 'Billing issue',
        category: ticketService.TicketCategory.BILLING,
        priority: ticketService.TicketPriority.MEDIUM,
        status: ticketService.TicketStatus.IN_PROGRESS
      });

      await ticketService.createTicket({
        userId: 'user3',
        conversationId: new mongoose.Types.ObjectId(),
        subject: 'Closed account',
        initialMessage: 'Account issue',
        category: ticketService.TicketCategory.ACCOUNT,
        priority: ticketService.TicketPriority.LOW,
        status: ticketService.TicketStatus.CLOSED
      });
    });

    test('should get ticket statistics', async () => {
      const stats = await ticketService.getTicketStatistics();

      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('byCategory');
      expect(stats).toHaveProperty('byPriority');

      expect(stats.byStatus.open).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
      expect(stats.byStatus.closed).toBe(1);

      expect(stats.byCategory.technical).toBe(1);
      expect(stats.byCategory.billing).toBe(1);
      expect(stats.byCategory.account).toBe(1);

      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.medium).toBe(1);
      expect(stats.byPriority.low).toBe(1);
    });
  });
});