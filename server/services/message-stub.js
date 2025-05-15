// Простые заглушки для всех сервисов
module.exports = {
  create: async () => ({ _id: 'stub', fake: true }),
  findById: async () => ({ _id: 'stub', fake: true }),
  getRecentMessages: async () => [],
  getMessagesByConversationId: async () => [],
  update: async () => ({ _id: 'stub', fake: true }),
  delete: async () => true,
  getStats: async () => ({ total: 0 })
};