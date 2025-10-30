const os = require('os');

class MonitoringService {
  constructor(databaseService, loggingService) {
    this.databaseService = databaseService;
    this.loggingService = loggingService || {
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: console.debug,
      logSystemHealth: (data) => console.log('System health check', data)
    };
    this.metrics = {
      requests: 0,
      errors: 0,
      trades: 0,
      blockchainEvents: 0,
      websocketConnections: 0,
      startTime: Date.now()
    };
    
    this.alerts = [];
    this.thresholds = {
      memoryUsage: 0.9, // 90%
      cpuUsage: 0.8, // 80%
      diskUsage: 0.9, // 90%
      errorRate: 0.1, // 10%
      responseTime: 5000 // 5 seconds
    };
    
    this.startMonitoring();
    console.log('📊 Monitoring Service initialized');
  }

  startMonitoring() {
    // Monitor system health every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
    
    // Monitor application metrics every 10 seconds
    setInterval(() => {
      this.collectApplicationMetrics();
    }, 10000);
    
    // Clean old metrics every hour
    setInterval(() => {
      this.cleanOldMetrics();
    }, 3600000);
  }

  // Collect system-level metrics
  async collectSystemMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          loadAverage: os.loadavg(),
          totalMemory: os.totalmem(),
          freeMemory: os.freemem(),
          cpuCount: os.cpus().length,
          platform: os.platform(),
          arch: os.arch()
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        nodejs: {
          version: process.version,
          versions: process.versions
        }
      };

      // Calculate derived metrics
      metrics.derived = {
        memoryUsagePercent: (metrics.system.totalMemory - metrics.system.freeMemory) / metrics.system.totalMemory,
        processMemoryPercent: metrics.process.memoryUsage.heapUsed / metrics.process.memoryUsage.heapTotal,
        loadAveragePercent: metrics.system.loadAverage[0] / metrics.system.cpuCount
      };

      // Check for alerts
      await this.checkSystemAlerts(metrics);
      
      // Log system health
      this.loggingService.logSystemHealth({
        status: 'healthy',
        uptime: metrics.process.uptime,
        memoryUsage: metrics.derived.memoryUsagePercent,
        cpuUsage: metrics.derived.loadAveragePercent,
        diskUsage: await this.getDiskUsage(),
        databaseStatus: await this.getDatabaseStatus(),
        redisStatus: await this.getRedisStatus()
      });

      return metrics;
    } catch (error) {
      if (this.loggingService && typeof this.loggingService.error === 'function') {
        this.loggingService.error('Failed to collect system metrics', {
          error: error?.message || error?.toString() || 'Unknown error',
          stack: error?.stack
        });
      } else {
        console.error('❌ MonitoringService error:', error?.message || error);
      }
      return null;
    }
  }

  // Collect application-specific metrics
  async collectApplicationMetrics() {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        application: {
          requests: this.metrics.requests,
          errors: this.metrics.errors,
          trades: this.metrics.trades,
          blockchainEvents: this.metrics.blockchainEvents,
          websocketConnections: this.metrics.websocketConnections,
          uptime: Date.now() - this.metrics.startTime
        },
        database: await this.getDatabaseMetrics(),
        cache: await this.getCacheMetrics()
      };

      // Calculate rates
      const uptimeSeconds = metrics.application.uptime / 1000;
      metrics.rates = {
        requestsPerSecond: this.metrics.requests / uptimeSeconds,
        errorsPerSecond: this.metrics.errors / uptimeSeconds,
        tradesPerSecond: this.metrics.trades / uptimeSeconds,
        errorRate: this.metrics.requests > 0 ? this.metrics.errors / this.metrics.requests : 0
      };

      // Check for application alerts
      await this.checkApplicationAlerts(metrics);

      return metrics;
    } catch (error) {
      this.loggingService.error('Failed to collect application metrics', { error: error.message });
      return null;
    }
  }

  // Get database metrics
  async getDatabaseMetrics() {
    try {
      if (!this.databaseService) return null;
      
      const healthCheck = await this.databaseService.healthCheck();
      return {
        status: healthCheck.status,
        connection: healthCheck.connection,
        responseTime: Date.now() // Would measure actual response time
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Get cache metrics
  async getCacheMetrics() {
    try {
      if (!this.databaseService || !this.databaseService.redisClient) {
        return { status: 'disabled' };
      }
      
      const info = await this.databaseService.redisClient.info();
      return {
        status: 'healthy',
        info: info
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Get disk usage
  async getDiskUsage() {
    try {
      // This is a simplified implementation
      // In production, you'd use a proper disk usage library
      return 0.5; // 50% as placeholder
    } catch (error) {
      return 0;
    }
  }

  // Get database status
  async getDatabaseStatus() {
    try {
      if (!this.databaseService) return 'unknown';
      const health = await this.databaseService.healthCheck();
      return health.status;
    } catch (error) {
      return 'unhealthy';
    }
  }

  // Get Redis status
  async getRedisStatus() {
    try {
      if (!this.databaseService || !this.databaseService.redisClient) {
        return 'disabled';
      }
      await this.databaseService.redisClient.ping();
      return 'healthy';
    } catch (error) {
      return 'unhealthy';
    }
  }

  // Record metrics
  recordRequest(method, path, statusCode, responseTime) {
    this.metrics.requests++;

    // Store request details for analytics (for future use)
    // const requestData = {
    //   method,
    //   path,
    //   statusCode,
    //   responseTime,
    //   timestamp: new Date()
    // };

    // Log request if needed
    if (this.loggingService) {
      this.loggingService.info(`Request recorded: ${method} ${path} - ${statusCode} (${responseTime}ms)`);
    }
  }

  recordError() {
    this.metrics.errors++;
  }

  recordTrade() {
    this.metrics.trades++;
  }

  recordBlockchainEvent() {
    this.metrics.blockchainEvents++;
  }

  recordWebSocketConnection() {
    this.metrics.websocketConnections++;
  }

  // Check system alerts
  async checkSystemAlerts(metrics) {
    const alerts = [];

    // Memory usage alert
    if (metrics.derived.memoryUsagePercent > this.thresholds.memoryUsage) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${(metrics.derived.memoryUsagePercent * 100).toFixed(1)}%`,
        value: metrics.derived.memoryUsagePercent,
        threshold: this.thresholds.memoryUsage
      });
    }

    // CPU usage alert
    if (metrics.derived.loadAveragePercent > this.thresholds.cpuUsage) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage: ${(metrics.derived.loadAveragePercent * 100).toFixed(1)}%`,
        value: metrics.derived.loadAveragePercent,
        threshold: this.thresholds.cpuUsage
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  // Check application alerts
  async checkApplicationAlerts(metrics) {
    const alerts = [];

    // Error rate alert
    if (metrics.rates.errorRate > this.thresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `High error rate: ${(metrics.rates.errorRate * 100).toFixed(1)}%`,
        value: metrics.rates.errorRate,
        threshold: this.thresholds.errorRate
      });
    }

    // Database connectivity alert
    if (metrics.database && metrics.database.status !== 'healthy') {
      alerts.push({
        type: 'database',
        severity: 'critical',
        message: `Database unhealthy: ${metrics.database.status}`,
        value: metrics.database.status
      });
    }

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(alert);
    }
  }

  // Process an alert
  async processAlert(alert) {
    try {
      alert.timestamp = new Date().toISOString();
      alert.id = Math.random().toString(36).substring(2, 11);
      
      // Add to alerts array
      this.alerts.push(alert);
      
      // Log the alert
      this.loggingService.warn('System alert triggered', alert);
      
      // In production, you might want to:
      // - Send notifications (email, Slack, etc.)
      // - Trigger automated responses
      // - Update monitoring dashboards
      
      console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
      
    } catch (error) {
      this.loggingService.error('Failed to process alert', { error: error.message, alert });
    }
  }

  // Increment metric counters
  incrementRequests() {
    this.metrics.requests++;
  }

  incrementErrors() {
    this.metrics.errors++;
  }

  incrementTrades() {
    this.metrics.trades++;
  }

  incrementBlockchainEvents() {
    this.metrics.blockchainEvents++;
  }

  setWebSocketConnections(count) {
    this.metrics.websocketConnections = count;
  }

  // Get current metrics
  getCurrentMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      timestamp: new Date().toISOString()
    };
  }

  // Get recent alerts
  getRecentAlerts(limit = 50) {
    return this.alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  // Clear old alerts
  cleanOldMetrics() {
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.alerts = this.alerts.filter(alert => 
      new Date(alert.timestamp) > oneHourAgo
    );
  }

  // Get health summary
  async getHealthSummary() {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      const appMetrics = await this.collectApplicationMetrics();
      const recentAlerts = this.getRecentAlerts(10);
      
      return {
        status: recentAlerts.some(a => a.severity === 'critical') ? 'critical' : 
                recentAlerts.some(a => a.severity === 'warning') ? 'warning' : 'healthy',
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        application: appMetrics,
        alerts: recentAlerts,
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      };
    } catch (error) {
      this.loggingService.error('Failed to get health summary', { error: error.message });
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Performance tracking
  trackPerformance(operation, startTime) {
    const duration = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();
    
    this.loggingService.logPerformance({
      operation,
      duration,
      memoryUsage: memoryUsage.heapUsed,
      cpuUsage: process.cpuUsage()
    });
    
    return duration;
  }
}

module.exports = MonitoringService;
