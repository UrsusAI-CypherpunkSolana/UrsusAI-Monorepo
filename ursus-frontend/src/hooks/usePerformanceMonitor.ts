import { useState, useEffect, useCallback, useRef } from 'react';

// Memory Info interface for Chrome's performance.memory
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}
import websocketService from '../services/websocket';

interface PerformanceMetrics {
  websocket: {
    latency: number;
    messagesPerSecond: number;
    connectionStatus: string;
    reconnections: number;
    errors: number;
  };
  rendering: {
    fps: number;
    frameTime: number;
    droppedFrames: number;
    renderTime: number;
  };
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  network: {
    downloadSpeed: number;
    uploadSpeed: number;
    rtt: number;
  };
}

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
  metric: string;
  value: number;
  threshold: number;
}

interface PerformanceConfig {
  collectInterval: number;
  alertThresholds: {
    latency: number;
    fps: number;
    memoryUsage: number;
    renderTime: number;
  };
  enableAlerts: boolean;
  enableLogging: boolean;
}

export const usePerformanceMonitor = (config?: Partial<PerformanceConfig>) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    websocket: {
      latency: 0,
      messagesPerSecond: 0,
      connectionStatus: 'disconnected',
      reconnections: 0,
      errors: 0
    },
    rendering: {
      fps: 0,
      frameTime: 0,
      droppedFrames: 0,
      renderTime: 0
    },
    memory: {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    },
    network: {
      downloadSpeed: 0,
      uploadSpeed: 0,
      rtt: 0
    }
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const configRef = useRef<PerformanceConfig>({
    collectInterval: 1000, // 1 second
    alertThresholds: {
      latency: 1000, // 1 second
      fps: 30, // Below 30 FPS
      memoryUsage: 100 * 1024 * 1024, // 100MB
      renderTime: 16 // Above 16ms (60fps threshold)
    },
    enableAlerts: true,
    enableLogging: false,
    ...config
  });

  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const renderTimesRef = useRef<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Collect WebSocket metrics
  const collectWebSocketMetrics = useCallback(() => {
    const stats = websocketService.getConnectionStats?.() || {};
    
    return {
      latency: stats.latency || 0,
      messagesPerSecond: stats.messagesPerSecond || 0,
      connectionStatus: websocketService.getConnectionState?.() || 'unknown',
      reconnections: stats.reconnections || 0,
      errors: stats.errors || 0
    };
  }, []);

  // Collect rendering metrics
  const collectRenderingMetrics = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastFrameTimeRef.current;
    
    frameCountRef.current++;
    lastFrameTimeRef.current = now;

    // Calculate FPS over last second
    const fps = frameCountRef.current;
    frameCountRef.current = 0;

    // Calculate average render time
    const avgRenderTime = renderTimesRef.current.length > 0
      ? renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
      : 0;

    // Reset render times
    renderTimesRef.current = [];

    return {
      fps,
      frameTime: deltaTime,
      droppedFrames: fps < 30 ? 60 - fps : 0,
      renderTime: avgRenderTime
    };
  }, []);

  // Collect memory metrics
  const collectMemoryMetrics = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
      if (memory) {
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        };
      }
    }
    
    return {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0
    };
  }, []);

  // Collect network metrics
  const collectNetworkMetrics = useCallback(async () => {
    try {
      // Simple RTT measurement using WebSocket ping
      const startTime = performance.now();
      websocketService.ping?.();
      
      // This is a simplified approach - in real implementation,
      // you'd measure the actual pong response time
      const rtt = performance.now() - startTime;

      return {
        downloadSpeed: 0, // Would need actual implementation
        uploadSpeed: 0,   // Would need actual implementation
        rtt
      };
    } catch {
      return {
        downloadSpeed: 0,
        uploadSpeed: 0,
        rtt: 0
      };
    }
  }, []);

  // Check for performance alerts
  const checkForAlerts = useCallback((currentMetrics: PerformanceMetrics) => {
    const newAlerts: PerformanceAlert[] = [];
    const thresholds = configRef.current.alertThresholds;

    // WebSocket latency alert
    if (currentMetrics.websocket.latency > thresholds.latency) {
      newAlerts.push({
        id: `latency-${Date.now()}`,
        type: 'warning',
        message: `High WebSocket latency: ${currentMetrics.websocket.latency}ms`,
        timestamp: new Date(),
        metric: 'websocket.latency',
        value: currentMetrics.websocket.latency,
        threshold: thresholds.latency
      });
    }

    // Memory usage alert
    if (currentMetrics.memory && currentMetrics.memory.usedJSHeapSize) {
      const memoryUsagePercent = (currentMetrics.memory.usedJSHeapSize / currentMetrics.memory.jsHeapSizeLimit) * 100;
      if (memoryUsagePercent > thresholds.memoryUsage) {
        newAlerts.push({
          id: `memory-${Date.now()}`,
          type: 'error',
          message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
          timestamp: new Date(),
          metric: 'memory.usage',
          value: memoryUsagePercent,
          threshold: thresholds.memoryUsage
        });
      }
    }

    // FPS alert
    if (currentMetrics.rendering.fps < thresholds.fps) {
      newAlerts.push({
        id: `fps-${Date.now()}`,
        type: 'warning',
        message: `Low FPS: ${currentMetrics.rendering.fps}`,
        timestamp: new Date(),
        metric: 'rendering.fps',
        value: currentMetrics.rendering.fps,
        threshold: thresholds.fps
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
    }
  }, []);

  // Collect all metrics
  const collectMetrics = useCallback(async () => {
    try {
      const newMetrics: PerformanceMetrics = {
        websocket: collectWebSocketMetrics(),
        rendering: collectRenderingMetrics(),
        memory: collectMemoryMetrics(),
        network: await collectNetworkMetrics()
      };

      setMetrics(newMetrics);

      // Check for alerts
      if (configRef.current.enableAlerts) {
        checkForAlerts(newMetrics);
      }

      // Log metrics if enabled
      if (configRef.current.enableLogging) {
        console.log('📊 Performance Metrics:', newMetrics);
      }

    } catch (error) {
      console.error('❌ Error collecting performance metrics:', error);
    }
  }, [collectWebSocketMetrics, collectRenderingMetrics, collectMemoryMetrics, collectNetworkMetrics, checkForAlerts]);

  // Track render time for components
  const trackRenderTime = useCallback((renderTime: number) => {
    renderTimesRef.current.push(renderTime);
    
    // Keep only last 10 render times
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift();
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    console.log('📊 Starting performance monitoring...');
    setIsMonitoring(true);

    intervalRef.current = setInterval(collectMetrics, configRef.current.collectInterval);
  }, [isMonitoring, collectMetrics]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    console.log('📊 Stopping performance monitoring...');
    setIsMonitoring(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // Clear alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Remove specific alert
  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const summary = {
      overall: 'good' as 'excellent' | 'good' | 'fair' | 'poor',
      issues: [] as string[],
      recommendations: [] as string[]
    };

    // Analyze metrics
    if (metrics.websocket.latency > 500) {
      summary.issues.push('High WebSocket latency');
      summary.recommendations.push('Check network connection or server performance');
    }

    if (metrics.rendering.fps < 30) {
      summary.issues.push('Low frame rate');
      summary.recommendations.push('Optimize rendering or reduce visual complexity');
    }

    if (metrics.memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
      summary.issues.push('High memory usage');
      summary.recommendations.push('Check for memory leaks or optimize data structures');
    }

    // Determine overall status
    if (summary.issues.length === 0) {
      summary.overall = 'excellent';
    } else if (summary.issues.length <= 1) {
      summary.overall = 'good';
    } else if (summary.issues.length <= 2) {
      summary.overall = 'fair';
    } else {
      summary.overall = 'poor';
    }

    return summary;
  }, [metrics]);

  // Auto-start monitoring on mount
  useEffect(() => {
    startMonitoring();
    return () => stopMonitoring();
  }, [startMonitoring, stopMonitoring]);

  return {
    metrics,
    alerts,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearAlerts,
    removeAlert,
    trackRenderTime,
    getPerformanceSummary
  };
};

export default usePerformanceMonitor;
