const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const rateLimiters = {
  // General API rate limit
  general: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests per window
    'Too many API requests, please try again later'
  ),
  
  // Chart data rate limit (more restrictive)
  chart: createRateLimiter(
    1 * 60 * 1000, // 1 minute
    60, // 60 requests per minute
    'Too many chart requests, please slow down'
  ),
  
  // Trading rate limit (very restrictive)
  trading: createRateLimiter(
    1 * 60 * 1000, // 1 minute
    10, // 10 requests per minute
    'Too many trading requests, please wait before trading again'
  ),
  
  // Authentication rate limit
  auth: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts, please try again later'
  )
};

// Security middleware
const securityMiddleware = [
  // Helmet for security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "http://localhost:*", "http://127.0.0.1:*"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false
  }),
  
  // Compression
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024
  }),
  
// CORS configuration
cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
      'http://192.168.1.101:5173',
      'https://ursus.app',
      'https://www.ursus.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const isLocalNetwork = (url) => {
      try {
        const u = new URL(url);
        const h = u.hostname;
        return (
          ['localhost', '127.0.0.1'].includes(h) ||
          /^192\.168\.\d+\.\d+$/.test(h) ||
          /^10\.\d+\.\d+\.\d+$/.test(h) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)
        );
      } catch { return false; }
    };

    if (allowedOrigins.includes(origin) || isLocalNetwork(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
})
];

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const ip = req.ip || req.connection.remoteAddress;
    
    // Log request details
    console.log(`${method} ${url} - ${statusCode} - ${duration}ms - ${ip} - ${userAgent}`);
    
    // Log errors
    if (statusCode >= 400) {
      console.error(`❌ API Error: ${method} ${url} - ${statusCode} - ${duration}ms`);
      if (statusCode >= 500) {
        console.error(`🔥 Server Error Details:`, {
          method,
          url,
          statusCode,
          duration,
          ip,
          userAgent,
          body: req.body,
          query: req.query,
          params: req.params
        });
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('🔥 Unhandled API Error:', err);
  
  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details = null;
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = Object.values(err.errors).map(e => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    details = 'Resource already exists';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.message) {
    message = err.message;
    if (err.statusCode) {
      statusCode = err.statusCode;
    }
  }
  
  res.status(statusCode).json({
    success: false,
    error: message,
    details: process.env.NODE_ENV === 'development' ? details || err.stack : undefined,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

// Health check middleware
const healthCheck = (req, res, next) => {
  if (req.path === '/health' || req.path === '/api/health') {
    // Ensure CORS headers even if CORS middleware hasn’t run yet
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  }
  next();
};

// API response formatter
const responseFormatter = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Add standard response format
    if (data && typeof data === 'object' && !data.hasOwnProperty('success')) {
      data = {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        requestId: req.id || Math.random().toString(36).substr(2, 9)
      };
    }
    
    originalJson.call(this, data);
  };
  
  next();
};

// Request ID middleware
const requestId = (req, res, next) => {
  req.id = Math.random().toString(36).substr(2, 9);
  res.setHeader('X-Request-ID', req.id);
  next();
};

// API versioning middleware
const apiVersioning = (req, res, next) => {
  // Extract version from header or URL
  const version = req.headers['api-version'] || req.query.version || 'v1';
  req.apiVersion = version;
  res.setHeader('API-Version', version);
  next();
};

// Cache control middleware
const cacheControl = (maxAge = 300) => {
  return (req, res, next) => {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.setHeader('ETag', `"${Date.now()}"`);
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  };
};

module.exports = {
  rateLimiters,
  securityMiddleware,
  requestLogger,
  errorHandler,
  healthCheck,
  responseFormatter,
  requestId,
  apiVersioning,
  cacheControl
};
