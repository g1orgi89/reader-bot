/**
 * Setup middleware with FIXED CORS configuration 🍄
 */
function setupMiddleware() {
  // Security middleware with updated CSP settings
  const helmetConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Allow inline scripts for onclick handlers
          "cdnjs.cloudflare.com"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'" // Allow inline styles
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
  
  // Serve static files from server/static directory
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
    // Try server/static first, then fallback to client if needed
    const serverPath = path.join(__dirname, 'static/test-cors.html');
    const clientPath = path.join(__dirname, '../client/test-cors.html');
    
    require('fs').access(serverPath, require('fs').constants.F_OK, (err) => {
      if (err) {
        res.sendFile(clientPath);
      } else {
        res.sendFile(serverPath);
      }
    });
  });
}