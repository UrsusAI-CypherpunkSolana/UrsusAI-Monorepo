const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');

// Enhanced rate limiting with progressive delays
const createAdvancedRateLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    delayAfter = Math.floor(max * 0.5),
    delayMs = 500,
    maxDelayMs = 20000,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return [
    // Slow down requests after threshold
    slowDown({
      windowMs,
      delayAfter,
      delayMs: () => delayMs,
      maxDelayMs,
      skipFailedRequests,
      skipSuccessfulRequests,
      validate: { delayMs: false }
    }),
    
    // Hard rate limit
    rateLimit({
      windowMs,
      max,
      message: {
        success: false,
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skipFailedRequests,
      handler: (req, res) => {
        console.log(`🚫 Rate limit exceeded for ${req.ip} on ${req.path}`);
        res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
    })
  ];
};

// Security middleware configurations
const securityMiddleware = {
  // Enhanced helmet configuration
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http://localhost:*", "http://127.0.0.1:*"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }),

  // Rate limiters for different endpoints
  rateLimiters: {
    // General API endpoints
    general: createAdvancedRateLimiter({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
      delayAfter: 500,
      message: 'Too many API requests'
    }),

    // Authentication endpoints
    auth: createAdvancedRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 5,
      delayAfter: 2,
      delayMs: 1000,
      maxDelayMs: 10000,
      message: 'Too many authentication attempts'
    }),

    // Trading endpoints
    trading: createAdvancedRateLimiter({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 20,
      delayAfter: 10,
      delayMs: 2000,
      maxDelayMs: 30000,
      message: 'Too many trading requests',
      skipSuccessfulRequests: true
    }),

    // Chart data endpoints
    chart: createAdvancedRateLimiter({
      windowMs: 1 * 60 * 1000,
      max: 100,
      delayAfter: 50,
      delayMs: 100,
      maxDelayMs: 5000,
      message: 'Too many chart requests'
    }),

    // Chat endpoints
    chat: createAdvancedRateLimiter({
      windowMs: 1 * 60 * 1000,
      max: 30,
      delayAfter: 15,
      delayMs: 1000,
      maxDelayMs: 15000,
      message: 'Too many chat requests'
    }),

    // WebSocket connections
    websocket: createAdvancedRateLimiter({
      windowMs: 1 * 60 * 1000,
      max: 10,
      delayAfter: 5,
      delayMs: 5000,
      maxDelayMs: 60000,
      message: 'Too many WebSocket connection attempts'
    })
  }
};

// Request validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Ethereum address validation
const validateEthereumAddress = (field) => {
  return body(field)
    .custom((value) => {
      if (!ethers.isAddress(value)) {
        throw new Error('Invalid Ethereum address');
      }
      return true;
    })
    .normalizeEmail();
};

// Signature verification middleware
const verifySignature = async (req, res, next) => {
  try {
    const { signature, message, address } = req.body;

    if (!signature || !message || !address) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature, message, or address'
      });
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Check message timestamp (prevent replay attacks)
    const messageData = JSON.parse(message);
    const timestamp = messageData.timestamp;
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (!timestamp || Math.abs(now - timestamp) > fiveMinutes) {
      return res.status(401).json({
        success: false,
        error: 'Message timestamp is invalid or expired'
      });
    }

    req.verifiedAddress = address.toLowerCase();
    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Signature verification failed'
    });
  }
};

// JWT authentication middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Request sanitization middleware
const sanitizeRequest = (req, res, next) => {
  // Remove potentially dangerous characters
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};

// Request logging middleware
const logRequest = (req, res, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  
  req.requestId = requestId;
  
  console.log(`📝 [${requestId}] ${req.method} ${req.path} - ${req.ip} - ${new Date().toISOString()}`);
  
  // Log request body for POST/PUT requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const logBody = { ...req.body };
    // Remove sensitive fields
    delete logBody.signature;
    delete logBody.privateKey;
    delete logBody.password;
    
    if (Object.keys(logBody).length > 0) {
      console.log(`📝 [${requestId}] Body:`, JSON.stringify(logBody, null, 2));
    }
  }

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    console.log(`📝 [${requestId}] Response: ${res.statusCode} - ${duration}ms`);
    
    if (res.statusCode >= 400) {
      console.log(`❌ [${requestId}] Error:`, data);
    }
    
    return originalJson.call(this, data);
  };

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  
  console.error(`💥 [${requestId}] Error:`, err);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: isDevelopment ? err.message : undefined
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format',
      details: isDevelopment ? err.message : undefined
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry',
      details: isDevelopment ? err.message : undefined
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    requestId,
    details: isDevelopment ? err.message : undefined
  });
};

module.exports = {
  securityMiddleware,
  validateRequest,
  validateEthereumAddress,
  verifySignature,
  authenticateJWT,
  sanitizeRequest,
  logRequest,
  errorHandler
};
