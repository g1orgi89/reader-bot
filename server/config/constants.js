/**
 * Constants for Reader Bot
 * @file server/config/constants.js
 */

/**
 * Application constants
 */
const CONSTANTS = {
  // API Configuration
  API: {
    VERSION: 'v1',
    PREFIX: '/api',
    DEFAULT_LANGUAGE: 'en',
    MAX_REQUEST_SIZE: '10mb',
    TIMEOUT: 30000,
    RETRIES: {
      MAX: 3,
      DELAY: 1000,
      BACKOFF: 2
    }
  },

  // Supported Languages
  LANGUAGES: {
    ENGLISH: 'en',
    SPANISH: 'es',
    RUSSIAN: 'ru'
  },

  // Supported File Types
  FILE_TYPES: {
    TEXT: ['.txt', '.md'],
    DOCUMENTS: ['.pdf', '.doc', '.docx'],
    SPREADSHEETS: ['.csv', '.xlsx', '.xls'],
    IMAGES: ['.jpg', '.jpeg', '.png', '.gif', '.svg']
  },

  // Document Categories
  DOCUMENT_CATEGORIES: {
    GENERAL: 'general',
    USER_GUIDE: 'user-guide',
    TOKENOMICS: 'tokenomics',
    TECHNICAL: 'technical',
    TROUBLESHOOTING: 'troubleshooting'
  },

  // Ticket Status
  TICKET_STATUS: {
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved',
    CLOSED: 'closed'
  },

  // Ticket Priorities
  TICKET_PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },

  // Message Roles
  MESSAGE_ROLES: {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
  },

  // Claude Models
  CLAUDE_MODELS: {
    HAIKU: 'claude-3-haiku-20240307',
    SONNET: 'claude-3-5-sonnet-20241022',
    OPUS: 'claude-3-opus-20240229'
  },

  // Vector Store Configuration
  VECTOR_STORE: {
    COLLECTION_NAME: 'reader_knowledge',
    DIMENSIONS: 1536,
    METRICS: {
      COSINE: 'cosine',
      EUCLIDEAN: 'euclidean',
      DOT_PRODUCT: 'dot'
    },
    DEFAULT_TOP_K: 5
  },

  // Rate Limiting
  RATE_LIMITS: {
    API: {
      WINDOW_MS: 15 * 60 * 1000, // 15 minutes
      MAX_REQUESTS: 100
    },
    CHAT: {
      WINDOW_MS: 60 * 1000, // 1 minute
      MAX_REQUESTS: 20
    }
  },

  // User Profile Limits
  USER_PROFILE: {
    STATUS_MAX_LENGTH: 80,         // Maximum length for user status
    NAME_MAX_LENGTH: 100,          // Maximum length for user name
    BIO_MAX_LENGTH: 200            // Maximum length for user bio
  },

  // Logging Levels
  LOG_LEVELS: {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'verbose'
  },

  // Database Collections
  COLLECTIONS: {
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
    TICKETS: 'tickets',
    KNOWLEDGE: 'knowledge_documents',
    USERS: 'users'
  },

  // Service Names
  SERVICES: {
    CLAUDE: 'claudeService',
    VECTOR_STORE: 'vectorStoreService',
    TICKET: 'ticketService',
    MONGO_CLIENT: 'mongoClient'
  },

  // Environment Types
  ENVIRONMENTS: {
    DEVELOPMENT: 'development',
    TEST: 'test',
    STAGING: 'staging',
    PRODUCTION: 'production'
  },

  // Cache Keys
  CACHE_KEYS: {
    PROMPTS: 'prompts:',
    RESPONSES: 'responses:',
    EMBEDDINGS: 'embeddings:',
    USER_SESSIONS: 'sessions:',
    RATE_LIMITS: 'rate_limits:'
  },

  // Error Codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT'
  },

  // Widget Configuration
  WIDGET: {
    DEFAULT_THEME: 'dark',
    THEMES: ['light', 'dark', 'auto'],
    POSITIONS: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
    DEFAULT_POSITION: 'bottom-right',
    MIN_WIDTH: 320,
    MIN_HEIGHT: 400
  },

  // Reader Bot specific constants
  READER: {
    DEFAULT_LANGUAGE: 'ru',
    QUOTE_CATEGORIES: ['psychology', 'philosophy', 'self-development', 'business'],
    BOOK_RECOMMENDATIONS: {
      MIN_SCORE: 0.7,
      MAX_RESULTS: 5
    },
    REPORTS: {
      WEEKLY_DAY: 'sunday',
      MONTHLY_DAY: 1
    }
  },

  // Feature Flags
  FEATURES: {
    RAG_ENABLED: 'ENABLE_RAG',
    ANALYTICS_ENABLED: 'ENABLE_ANALYTICS',
    CACHING_ENABLED: 'ENABLE_CACHING',
    METRICS_ENABLED: 'ENABLE_METRICS',
    HOT_RELOAD: 'ENABLE_HOT_RELOAD',
    DEBUG_MODE: 'ENABLE_DEBUG_MODE'
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  },

  // Time Constants
  TIME: {
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000
  },

  // Size Constants
  SIZE: {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024
  },

  // Regex Patterns
  PATTERNS: {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    STACKS_ADDRESS: /^S[0-9A-HJKMNP-TV-Z]{25,39}$/,
    BITCOIN_ADDRESS: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
  },

  // Socket Events
  SOCKET_EVENTS: {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    SEND_MESSAGE: 'sendMessage',
    MESSAGE_RESPONSE: 'messageResponse',
    ERROR: 'error',
    TYPING: 'typing',
    STOP_TYPING: 'stopTyping',
    USER_JOINED: 'userJoined',
    USER_LEFT: 'userLeft'
  }
};

// Backward compatibility exports
module.exports = {
  ...CONSTANTS,
  SUPPORTED_LANGUAGES: Object.values(CONSTANTS.LANGUAGES),
  SUPPORTED_FILE_TYPES: Object.values(CONSTANTS.FILE_TYPES).flat(),
  DOCUMENT_CATEGORIES: Object.values(CONSTANTS.DOCUMENT_CATEGORIES)
};
