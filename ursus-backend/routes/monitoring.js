const express = require('express');
const { param, query } = require('express-validator');
const { validateRequest, authenticateJWT } = require('../middleware/securityMiddleware');
const MonitoringService = require('../services/MonitoringService');

const router = express.Router();

// Initialize monitoring service
let monitoringService;
try {
  monitoringService = new MonitoringService();
} catch (error) {
  console.error('Failed to initialize monitoring service:', error);
}

// GET /api/monitoring/health - Public health check
router.get('/health', (req, res) => {
  try {
    if (!monitoringService) {
      return res.status(503).json({
        success: false,
        status: 'error',
        message: 'Monitoring service unavailable'
      });
    }

    const health = monitoringService.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'warning' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      ...health
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'error',
      message: 'Health check failed'
    });
  }
});

// GET /api/monitoring/metrics - Get system metrics (protected)
router.get('/metrics', 
  authenticateJWT,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics'
      });
    }
  }
);

// GET /api/monitoring/alerts - Get active alerts (protected)
router.get('/alerts',
  authenticateJWT,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      const metrics = monitoringService.getMetrics();
      
      res.json({
        success: true,
        data: {
          alerts: metrics.alerts || [],
          count: metrics.alerts?.length || 0
        }
      });
    } catch (error) {
      console.error('Alerts error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts'
      });
    }
  }
);

// GET /api/monitoring/stats - Get aggregated statistics (protected)
router.get('/stats',
  authenticateJWT,
  [
    query('period').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid period')
  ],
  validateRequest,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      const { period = '24h' } = req.query;
      const metrics = monitoringService.getMetrics();

      // Calculate period-specific stats
      const now = Date.now();
      const periodMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      }[period];

      const stats = {
        period,
        timestamp: now,
        requests: {
          total: metrics.requests.total,
          success: metrics.requests.success,
          errors: metrics.requests.errors,
          successRate: metrics.computed.successRate,
          errorRate: metrics.computed.errorRate,
          avgResponseTime: metrics.computed.avgResponseTime,
          requestsPerMinute: metrics.computed.requestsPerMinute
        },
        system: {
          cpu: metrics.system.cpu,
          memory: metrics.system.memory,
          disk: metrics.system.disk,
          uptime: metrics.system.uptime
        },
        blockchain: {
          connectionStatus: metrics.blockchain.connectionStatus,
          lastBlockNumber: metrics.blockchain.lastBlockNumber,
          transactionCount: metrics.blockchain.transactionCount,
          failedTransactions: metrics.blockchain.failedTransactions
        },
        websocket: {
          activeConnections: metrics.websocket.connections,
          totalConnections: metrics.websocket.totalConnections,
          messagesReceived: metrics.websocket.messagesReceived,
          messagesSent: metrics.websocket.messagesSent,
          errors: metrics.websocket.errors
        },
        trading: {
          totalTrades: metrics.trading.totalTrades,
          successfulTrades: metrics.trading.successfulTrades,
          failedTrades: metrics.trading.failedTrades,
          successRate: metrics.computed.tradingSuccessRate,
          totalVolume: metrics.trading.totalVolume
        }
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  }
);

// POST /api/monitoring/reset - Reset metrics (protected)
router.post('/reset',
  authenticateJWT,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      monitoringService.resetMetrics();
      
      res.json({
        success: true,
        message: 'Metrics reset successfully'
      });
    } catch (error) {
      console.error('Reset metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset metrics'
      });
    }
  }
);

// GET /api/monitoring/endpoints - Get endpoint statistics (protected)
router.get('/endpoints',
  authenticateJWT,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      const metrics = monitoringService.getMetrics();
      const endpointStats = [];

      // Convert Map to array for JSON response
      for (const [endpoint, stats] of metrics.requests.byEndpoint) {
        endpointStats.push({
          endpoint,
          count: stats.count,
          errors: stats.errors,
          avgResponseTime: stats.count > 0 ? stats.totalTime / stats.count : 0,
          errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
        });
      }

      // Sort by request count
      endpointStats.sort((a, b) => b.count - a.count);

      res.json({
        success: true,
        data: {
          endpoints: endpointStats,
          total: endpointStats.length
        }
      });
    } catch (error) {
      console.error('Endpoints stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get endpoint statistics'
      });
    }
  }
);

// GET /api/monitoring/status-codes - Get status code distribution (protected)
router.get('/status-codes',
  authenticateJWT,
  (req, res) => {
    try {
      if (!monitoringService) {
        return res.status(503).json({
          success: false,
          error: 'Monitoring service unavailable'
        });
      }

      const metrics = monitoringService.getMetrics();
      const statusCodes = [];

      // Convert Map to array for JSON response
      for (const [status, count] of metrics.requests.byStatus) {
        statusCodes.push({
          status: parseInt(status),
          count,
          percentage: metrics.requests.total > 0 ? (count / metrics.requests.total) * 100 : 0
        });
      }

      // Sort by status code
      statusCodes.sort((a, b) => a.status - b.status);

      res.json({
        success: true,
        data: {
          statusCodes,
          total: metrics.requests.total
        }
      });
    } catch (error) {
      console.error('Status codes error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status code statistics'
      });
    }
  }
);

// Middleware to record request metrics
const recordRequestMetrics = (req, res, next) => {
  if (!monitoringService) return next();

  const start = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - start;
    monitoringService.recordRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };

  next();
};

module.exports = {
  router,
  recordRequestMetrics,
  monitoringService
};
