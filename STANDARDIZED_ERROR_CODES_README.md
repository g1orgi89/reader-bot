# Standard Error Codes Implementation

## 📋 Overview

This implementation provides a standardized error code system for the Shrooms Support Bot API across all modules:

## 🎯 Main Changes

### 1. Created Central Error Code System (`server/constants/errorCodes.js`)
- **Categorized error codes** by functionality (AUTH, VALIDATION, CHAT, etc.)
- **Consistent structure** with code, message, and default HTTP status
- **Helper functions** for easy error response creation
- **Complete type definitions** for JSDoc

### 2. Updated All API Modules
Updated all API files to use the standardized error codes:

#### **chat.js**
- Replaced hardcoded error codes with constants
- Uses `createErrorResponse()` helper function
- Standardized error handling patterns

#### **admin.js**
- Implemented consistent error responses
- Added proper status codes for all endpoints
- Improved error context and messages

#### **tickets.js**
- Replaced custom error handling with standard system
- Improved validation error messages
- Consistent response format across endpoints

#### **knowledge.js**
- Unified error code usage
- Removed duplicate error code definitions
- Simplified validation and error handling

## 🔧 Key Features

### Error Code Categories
- **`AUTH_ERRORS`**: Authentication and authorization errors
- **`VALIDATION_ERRORS`**: Input validation errors
- **`CHAT_ERRORS`**: Chat-related errors
- **`TICKET_ERRORS`**: Ticket management errors
- **`KNOWLEDGE_ERRORS`**: Knowledge base errors
- **`ADMIN_ERRORS`**: Admin operations errors
- **`GENERIC_ERRORS`**: Generic system errors

### Helper Functions
```javascript
// Create standardized error response
const errorResponse = createErrorResponse('VALIDATION_ERROR', 'Custom message', { details });

// Get error information
const errorInfo = getErrorInfo('TICKET_NOT_FOUND');
```

### Consistent Response Format
All error responses now follow the same structure:
```json
{
  "error": "Error message",
  "errorCode": "ERROR_CODE",
  "httpStatus": 400,
  "timestamp": "2025-05-12T19:37:27.123Z",
  "details": {...}
}
```

## 📈 Benefits

1. **Consistency**: All APIs use the same error format
2. **Maintainability**: Centralized error management
3. **Documentation**: Clear error codes for API consumers
4. **Extensibility**: Easy to add new error codes
5. **Type Safety**: Full JSDoc type definitions

## 🚀 Usage Examples

```javascript
// In any API route
const { createErrorResponse, VALIDATION_ERRORS } = require('../constants/errorCodes');

// Simple error
const error = createErrorResponse('VALIDATION_ERROR');
return res.status(error.httpStatus).json(error);

// Custom message
const error = createErrorResponse('TICKET_NOT_FOUND', 'Could not find ticket with given ID');
return res.status(error.httpStatus).json(error);

// With details
const error = createErrorResponse('VALIDATION_ERROR', 'Invalid input', { 
  field: 'email',
  reason: 'Invalid format' 
});
return res.status(error.httpStatus).json(error);
```

## ✅ Results

- **100% consistency** across all API modules
- **Centralized** error code management
- **Improved** error messages and context
- **Standardized** HTTP status codes
- **Better** developer experience for API consumers
