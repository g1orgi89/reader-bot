/**
 * Fixed server/index.js with proper CSP configuration
 * This patch removes 'unsafe-inline' from scriptSrc since we no longer use inline onclick handlers
 */

/** ... complete existing imports and setup ... **/

/**
 * Setup middleware with FIXED CORS configuration 🍄
 */
function setupMiddleware() {
  // Security middleware with UPDATED CSP settings 🛡️
  const helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Removed "'unsafe-inline'" since we no longer use onclick handlers
          "cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'" // Keep for embedded CSS in test pages
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:*", // Allow WebSocket connections
          "wss://localhost:*"
        ],
        objectSrc: ["'none'"],
        imageSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        frameSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    }
  };

  // Use different CSP settings based on environment
  if (process.env.NODE_ENV === 'development') {
    // Add some development-specific permissions
    helmetConfig.contentSecurityPolicy.directives.connectSrc.push(
      "ws://localhost:*",
      "wss://localhost:*",
      "http://localhost:*"
    );
  }

  app.use(helmet(helmetConfig));

  // 🍄 Apply our custom CORS middleware - THIS IS THE FIX!
  app.use(corsMiddleware);

  // Set default charset in Content-Type headers
  app.use((req, res, next) => {
    // Override the default express/socket.io content-type to include charset
    const setContentType = res.type.bind(res);
    res.type = function(type) {
      if (type === 'html' || type === 'text/html') {
        return setContentType.call(this, 'text/html; charset=utf-8');
      }
      if (type === 'json' || type === 'application/json') {
        return setContentType.call(this, 'application/json; charset=utf-8');
      }
      return setContentType.call(this, type);
    };
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static files - Updated to support test pages from both client and server
  // Serve the entire client directory for development/testing
  app.use('/client', express.static(path.join(__dirname, '../client')));
  
  // Serve static files from client/static directory (for our fixed JS files)
  app.use('/static', express.static(path.join(__dirname, '../client/static')));
  
  // Also serve static files from server/static directory if they exist
  app.use('/static', express.static(path.join(__dirname, 'static')));
  
  // Specific routes for components
  app.use('/widget', express.static(path.join(__dirname, '../client/chat-widget')));
  app.use('/admin', express.static(path.join(__dirname, '../client/admin-panel')));
  
  // Serve test pages directly (priority order matters)
  app.get('/test-chat', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-chat.html'));
  });
  
  app.get('/test-russian', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/test-russian-search.html'));
  });

  app.get('/test-cors', (req, res) => {
    // Always serve the client version since we fixed it
    const clientPath = path.join(__dirname, '../client/test-cors.html');
    res.sendFile(clientPath);
  });
}

/** ... rest of the file remains the same ... **/
