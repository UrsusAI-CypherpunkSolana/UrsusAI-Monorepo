const fs = require('fs');
const path = require('path');
const winston = require('winston');

class LoggingService {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
    this.initializeLoggers();
    
    console.log('📝 Logging Service initialized');
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  initializeLoggers() {
    // Custom format for logs
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.prettyPrint()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    );

    // Main application logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'ursus-backend' },
      transports: [
        // Error log file
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
          tailable: true
        }),
        
        // Combined log file
        new winston.transports.File({
          filename: path.join(this.logDir, 'combined.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true
        }),
        
        // Console output for development
        ...(process.env.NODE_ENV !== 'production' ? [
          new winston.transports.Console({
            format: consoleFormat
          })
        ] : [])
      ],
      
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'exceptions.log')
        })
      ],
      
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'rejections.log')
        })
      ]
    });

    // Trading-specific logger
    this.tradingLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'ursus-trading' },
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'trading.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 20,
          tailable: true
        })
      ]
    });

    // Blockchain-specific logger
    this.blockchainLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'ursus-blockchain' },
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'blockchain.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 15,
          tailable: true
        })
      ]
    });

    // API access logger
    this.accessLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'ursus-api' },
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'access.log'),
          maxsize: 20971520, // 20MB
          maxFiles: 30,
          tailable: true
        })
      ]
    });

    // Performance logger
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: logFormat,
      defaultMeta: { service: 'ursus-performance' },
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'performance.log'),
          maxsize: 5242880, // 5MB
          maxFiles: 10,
          tailable: true
        })
      ]
    });
  }

  // General logging methods
  info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  error(message, meta = {}) {
    this.logger.error(message, meta);
  }

  warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  // Trading-specific logging
  logTrade(tradeData) {
    this.tradingLogger.info('Trade executed', {
      type: tradeData.type,
      agentAddress: tradeData.agentAddress,
      userAddress: tradeData.userAddress,
      amount: tradeData.amount,
      price: tradeData.price,
      transactionHash: tradeData.transactionHash,
      timestamp: new Date().toISOString()
    });
  }

  logTradeFailure(failureData) {
    this.tradingLogger.error('Trade failed', {
      type: failureData.type,
      agentAddress: failureData.agentAddress,
      userAddress: failureData.userAddress,
      amount: failureData.amount,
      error: failureData.error,
      timestamp: new Date().toISOString()
    });
  }

  // Blockchain-specific logging
  logBlockchainEvent(eventData) {
    this.blockchainLogger.info('Blockchain event processed', {
      eventType: eventData.eventType,
      agentAddress: eventData.agentAddress,
      blockNumber: eventData.blockNumber,
      transactionHash: eventData.transactionHash,
      timestamp: new Date().toISOString()
    });
  }

  logBlockchainError(errorData) {
    this.blockchainLogger.error('Blockchain error', {
      operation: errorData.operation,
      agentAddress: errorData.agentAddress,
      error: errorData.error,
      timestamp: new Date().toISOString()
    });
  }

  // API access logging
  logApiAccess(requestData) {
    this.accessLogger.info('API request', {
      method: requestData.method,
      url: requestData.url,
      statusCode: requestData.statusCode,
      responseTime: requestData.responseTime,
      userAgent: requestData.userAgent,
      ip: requestData.ip,
      timestamp: new Date().toISOString()
    });
  }

  // Performance logging
  logPerformance(performanceData) {
    this.performanceLogger.info('Performance metric', {
      operation: performanceData.operation,
      duration: performanceData.duration,
      memoryUsage: performanceData.memoryUsage,
      cpuUsage: performanceData.cpuUsage,
      timestamp: new Date().toISOString()
    });
  }

  // Database operation logging
  logDatabaseOperation(operation, duration, success, error = null) {
    const logData = {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logData.error = error;
      this.logger.error('Database operation failed', logData);
    } else {
      this.logger.info('Database operation completed', logData);
    }
  }

  // WebSocket logging
  logWebSocketEvent(eventData) {
    this.logger.info('WebSocket event', {
      event: eventData.event,
      clientCount: eventData.clientCount,
      data: eventData.data,
      timestamp: new Date().toISOString()
    });
  }

  // Security logging
  logSecurityEvent(securityData) {
    this.logger.warn('Security event', {
      type: securityData.type,
      ip: securityData.ip,
      userAgent: securityData.userAgent,
      details: securityData.details,
      timestamp: new Date().toISOString()
    });
  }

  // System health logging
  logSystemHealth(healthData) {
    this.logger.info('System health check', {
      status: healthData.status,
      uptime: healthData.uptime,
      memoryUsage: healthData.memoryUsage,
      cpuUsage: healthData.cpuUsage,
      diskUsage: healthData.diskUsage,
      databaseStatus: healthData.databaseStatus,
      redisStatus: healthData.redisStatus,
      timestamp: new Date().toISOString()
    });
  }

  // Get log statistics
  async getLogStats() {
    try {
      const stats = {};
      const logFiles = ['error.log', 'combined.log', 'trading.log', 'blockchain.log', 'access.log'];
      
      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          stats[file] = {
            size: stat.size,
            modified: stat.mtime,
            created: stat.birthtime
          };
        }
      }
      
      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', { error: error.message });
      return {};
    }
  }

  // Clean old logs
  async cleanOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const files = fs.readdirSync(this.logDir);
      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      this.info(`Cleaned ${cleanedCount} old log files`);
      return cleanedCount;
    } catch (error) {
      this.error('Failed to clean old logs', { error: error.message });
      return 0;
    }
  }

  // Flush all loggers
  async flush() {
    return new Promise((resolve) => {
      let pending = 0;
      const loggers = [this.logger, this.tradingLogger, this.blockchainLogger, this.accessLogger, this.performanceLogger];
      
      const checkComplete = () => {
        pending--;
        if (pending === 0) {
          resolve();
        }
      };
      
      loggers.forEach(logger => {
        logger.transports.forEach(transport => {
          if (transport.flush) {
            pending++;
            transport.flush(checkComplete);
          }
        });
      });
      
      if (pending === 0) {
        resolve();
      }
    });
  }
}

module.exports = LoggingService;
