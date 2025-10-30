const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    
    // Performance metrics
    this.metrics = {
      websocket: {
        activeConnections: 0,
        totalConnections: 0,
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        averageLatency: 0,
        errors: 0,
        reconnections: 0
      },
      database: {
        queriesPerSecond: 0,
        averageQueryTime: 0,
        slowQueries: 0,
        connectionPoolSize: 0,
        errors: 0
      },
      blockchain: {
        rpcCallsPerSecond: 0,
        averageRpcTime: 0,
        failedCalls: 0,
        blockProcessingTime: 0,
        eventsProcessed: 0
      },
      trading: {
        tradesPerSecond: 0,
        priceUpdatesPerSecond: 0,
        portfolioUpdatesPerSecond: 0,
        processingLatency: 0,
        queueSizes: {
          trades: 0,
          prices: 0,
          portfolios: 0
        }
      },
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        heapUsed: 0,
        uptime: 0,
        eventLoopLag: 0
      }
    };
    
    // Performance history for trending
    this.history = {
      websocket: [],
      database: [],
      blockchain: [],
      trading: [],
      system: []
    };
    
    // Configuration
    this.config = {
      collectInterval: 5000, // 5 seconds
      historyLength: 720, // Keep 1 hour of 5-second intervals
      alertThresholds: {
        websocketLatency: 1000, // 1 second
        databaseQueryTime: 500, // 500ms
        rpcCallTime: 2000, // 2 seconds
        cpuUsage: 80, // 80%
        memoryUsage: 85, // 85%
        eventLoopLag: 100 // 100ms
      }
    };
    
    // Start monitoring
    this.startMonitoring();
    
    console.log('📊 Performance Monitor initialized');
  }

  // Start performance monitoring
  startMonitoring() {
    // Collect metrics periodically
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    // Monitor event loop lag
    this.monitorEventLoop();
    
    // Monitor memory usage
    this.monitorMemory();
  }

  // Collect all performance metrics
  async collectMetrics() {
    try {
      // Collect system metrics
      await this.collectSystemMetrics();
      
      // Update history
      this.updateHistory();
      
      // Check for alerts
      this.checkAlerts();
      
      // Emit metrics event
      this.emit('metrics', this.getMetricsSnapshot());
      
    } catch (error) {
      console.error('❌ Error collecting performance metrics:', error);
    }
  }

  // Collect system performance metrics
  async collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.metrics.system = {
      cpuUsage: this.calculateCpuUsage(cpuUsage),
      memoryUsage: (memUsage.rss / 1024 / 1024), // MB
      heapUsed: (memUsage.heapUsed / 1024 / 1024), // MB
      uptime: process.uptime(),
      eventLoopLag: this.eventLoopLag || 0
    };
  }

  // Calculate CPU usage percentage
  calculateCpuUsage(cpuUsage) {
    if (!this.lastCpuUsage) {
      this.lastCpuUsage = cpuUsage;
      return 0;
    }
    
    const userDiff = cpuUsage.user - this.lastCpuUsage.user;
    const systemDiff = cpuUsage.system - this.lastCpuUsage.system;
    const totalDiff = userDiff + systemDiff;
    
    this.lastCpuUsage = cpuUsage;
    
    // Convert microseconds to percentage (rough estimate)
    return Math.min(100, (totalDiff / 1000000) * 100);
  }

  // Monitor event loop lag
  monitorEventLoop() {
    let start = process.hrtime.bigint();
    
    const measureLag = () => {
      const delta = process.hrtime.bigint() - start;
      this.eventLoopLag = Number(delta / 1000000n); // Convert to milliseconds
      start = process.hrtime.bigint();
      setImmediate(measureLag);
    };
    
    setImmediate(measureLag);
  }

  // Monitor memory usage and garbage collection
  monitorMemory() {
    if (global.gc) {
      // Force garbage collection periodically if available
      setInterval(() => {
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();
        
        this.emit('gc', {
          before,
          after,
          freed: before.heapUsed - after.heapUsed
        });
      }, 60000); // Every minute
    }
  }

  // Update performance history
  updateHistory() {
    const timestamp = Date.now();
    
    Object.keys(this.history).forEach(category => {
      this.history[category].push({
        timestamp,
        ...this.metrics[category]
      });
      
      // Trim history to configured length
      if (this.history[category].length > this.config.historyLength) {
        this.history[category].shift();
      }
    });
  }

  // Check for performance alerts
  checkAlerts() {
    const alerts = [];
    
    // WebSocket latency alert
    if (this.metrics.websocket.averageLatency > this.config.alertThresholds.websocketLatency) {
      alerts.push({
        type: 'websocket_latency',
        severity: 'warning',
        message: `High WebSocket latency: ${this.metrics.websocket.averageLatency}ms`,
        value: this.metrics.websocket.averageLatency,
        threshold: this.config.alertThresholds.websocketLatency
      });
    }
    
    // Database query time alert
    if (this.metrics.database.averageQueryTime > this.config.alertThresholds.databaseQueryTime) {
      alerts.push({
        type: 'database_slow',
        severity: 'warning',
        message: `Slow database queries: ${this.metrics.database.averageQueryTime}ms`,
        value: this.metrics.database.averageQueryTime,
        threshold: this.config.alertThresholds.databaseQueryTime
      });
    }
    
    // CPU usage alert
    if (this.metrics.system.cpuUsage > this.config.alertThresholds.cpuUsage) {
      alerts.push({
        type: 'high_cpu',
        severity: 'critical',
        message: `High CPU usage: ${this.metrics.system.cpuUsage.toFixed(1)}%`,
        value: this.metrics.system.cpuUsage,
        threshold: this.config.alertThresholds.cpuUsage
      });
    }
    
    // Memory usage alert
    if (this.metrics.system.memoryUsage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        type: 'high_memory',
        severity: 'critical',
        message: `High memory usage: ${this.metrics.system.memoryUsage.toFixed(1)}MB`,
        value: this.metrics.system.memoryUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }
    
    // Event loop lag alert
    if (this.metrics.system.eventLoopLag > this.config.alertThresholds.eventLoopLag) {
      alerts.push({
        type: 'event_loop_lag',
        severity: 'warning',
        message: `High event loop lag: ${this.metrics.system.eventLoopLag}ms`,
        value: this.metrics.system.eventLoopLag,
        threshold: this.config.alertThresholds.eventLoopLag
      });
    }
    
    // Emit alerts if any
    if (alerts.length > 0) {
      this.emit('alerts', alerts);
      console.warn(`⚠️ Performance alerts:`, alerts);
    }
  }

  // Update WebSocket metrics
  updateWebSocketMetrics(metrics) {
    this.metrics.websocket = { ...this.metrics.websocket, ...metrics };
  }

  // Update database metrics
  updateDatabaseMetrics(metrics) {
    this.metrics.database = { ...this.metrics.database, ...metrics };
  }

  // Update blockchain metrics
  updateBlockchainMetrics(metrics) {
    this.metrics.blockchain = { ...this.metrics.blockchain, ...metrics };
  }

  // Update trading metrics
  updateTradingMetrics(metrics) {
    this.metrics.trading = { ...this.metrics.trading, ...metrics };
  }

  // Get current metrics snapshot
  getMetricsSnapshot() {
    return {
      timestamp: Date.now(),
      metrics: JSON.parse(JSON.stringify(this.metrics))
    };
  }

  // Get performance history
  getHistory(category, timeRange = 3600000) { // Default 1 hour
    const cutoff = Date.now() - timeRange;
    
    if (category && this.history[category]) {
      return this.history[category].filter(entry => entry.timestamp >= cutoff);
    }
    
    // Return all categories
    const result = {};
    Object.keys(this.history).forEach(cat => {
      result[cat] = this.history[cat].filter(entry => entry.timestamp >= cutoff);
    });
    
    return result;
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {
      overall: 'good',
      issues: [],
      recommendations: []
    };
    
    // Analyze WebSocket performance
    if (this.metrics.websocket.averageLatency > 500) {
      summary.issues.push('High WebSocket latency');
      summary.recommendations.push('Consider optimizing message processing or reducing message frequency');
    }
    
    // Analyze database performance
    if (this.metrics.database.averageQueryTime > 200) {
      summary.issues.push('Slow database queries');
      summary.recommendations.push('Review database indexes and query optimization');
    }
    
    // Analyze system performance
    if (this.metrics.system.cpuUsage > 70) {
      summary.issues.push('High CPU usage');
      summary.recommendations.push('Consider scaling horizontally or optimizing CPU-intensive operations');
    }
    
    if (this.metrics.system.memoryUsage > 1000) { // 1GB
      summary.issues.push('High memory usage');
      summary.recommendations.push('Review memory leaks and optimize data structures');
    }
    
    // Determine overall status
    if (summary.issues.length === 0) {
      summary.overall = 'excellent';
    } else if (summary.issues.length <= 2) {
      summary.overall = 'good';
    } else if (summary.issues.length <= 4) {
      summary.overall = 'fair';
    } else {
      summary.overall = 'poor';
    }
    
    return summary;
  }

  // Shutdown monitoring
  shutdown() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    console.log('📊 Performance Monitor shutdown');
  }
}

module.exports = PerformanceMonitor;
