  /**
   * Get a single ticket by ID
   * @param {string} ticketId - Ticket ID or MongoDB ObjectId
   * @returns {Promise<TicketType|null>} Found ticket or null
   */
  async getTicketById(ticketId) {
    try {
      // Support both ticketId and MongoDB _id
      const query = mongoose.Types.ObjectId.isValid(ticketId) 
        ? { _id: ticketId }
        : { ticketId };

      // Removed .populate('conversation') since Conversation model doesn't exist
      const ticket = await Ticket.findOne(query);

      if (!ticket) {
        logger.warn(`Ticket not found: ${ticketId}`);
        return null;
      }

      logger.info(`Retrieved ticket: ${ticket.ticketId}`);
      return ticket;
    } catch (error) {
      logger.error(`Failed to get ticket: ${error.message}`, { ticketId });
      throw error;
    }
  }