import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Activity,
  Clock,
  TrendingUp,
  Server,
  Signal,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import websocketService from '../services/websocket';
import { formatNumber } from '../utils/formatters';

interface WebSocketMetrics {
  status: string;
  uptime: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastConnected: Date | null;
  messagesPerSecond: number;
  bytesPerSecond: number;
  averageLatency: number;
}

interface ProfessionalWebSocketAnalyticsProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const ProfessionalWebSocketAnalytics: React.FC<ProfessionalWebSocketAnalyticsProps> = ({
  className = '',
  variant = 'full'
}) => {
  const [metrics, setMetrics] = useState<WebSocketMetrics | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<Array<{
    timestamp: Date;
    event: 'connected' | 'disconnected' | 'error' | 'reconnecting';
    details?: string;
  }>>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Update metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      const health = websocketService.getConnectionHealth();
      setMetrics(health);
      setLastUpdate(new Date());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket events
  useEffect(() => {
    const handleConnected = () => {
      setConnectionHistory(prev => [{
        timestamp: new Date(),
        event: 'connected',
        details: 'WebSocket connection established'
      }, ...prev.slice(0, 9)]);
    };

    const handleDisconnected = (data: { code: number; reason: string }) => {
      setConnectionHistory(prev => [{
        timestamp: new Date(),
        event: 'disconnected',
        details: `Disconnected: ${data.code} - ${data.reason || 'No reason'}`
      }, ...prev.slice(0, 9)]);
    };

    const handleError = (error: Error | Event | unknown) => {
      setConnectionHistory(prev => [{
        timestamp: new Date(),
        event: 'error',
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }, ...prev.slice(0, 9)]);
    };

    const handleReconnecting = () => {
      setConnectionHistory(prev => [{
        timestamp: new Date(),
        event: 'reconnecting',
        details: 'Attempting to reconnect...'
      }, ...prev.slice(0, 9)]);
    };

    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    websocketService.on('error', handleError);
    websocketService.on('reconnecting', handleReconnecting);

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('error', handleError);
      websocketService.off('reconnecting', handleReconnecting);
    };
  }, []);

  const getStatusIcon = () => {
    if (!metrics) return <Activity className="w-4 h-4 text-gray-400 animate-pulse" />;
    
    switch (metrics.status) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />;
      case 'connecting':
      case 'reconnecting':
        return <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    if (!metrics) return 'text-gray-400';
    
    switch (metrics.status) {
      case 'connected': return 'text-green-400';
      case 'connecting':
      case 'reconnecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = () => {
    if (!metrics) return 'Loading...';
    
    switch (metrics.status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'reconnecting': return 'Reconnecting...';
      case 'error': return 'Error';
      case 'closing': return 'Closing...';
      default: return 'Disconnected';
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 50) return 'text-green-400';
    if (latency < 150) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatUptime = (uptime: number) => {
    if (uptime < 1000) return '< 1s';
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'connected':
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'disconnected':
        return <WifiOff className="w-3 h-3 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      case 'reconnecting':
        return <RefreshCw className="w-3 h-3 text-yellow-400" />;
      default:
        return <Activity className="w-3 h-3 text-gray-400" />;
    }
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            WebSocket
          </span>
        </div>
        
        {metrics && metrics.status === 'connected' && (
          <div className="flex items-center space-x-2">
            <Signal className="w-3 h-3 text-green-400" />
            <span className={`text-xs ${getLatencyColor(metrics.averageLatency)}`}>
              {metrics.averageLatency.toFixed(0)}ms
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <BarChart3 className="w-5 h-5" />
          <span>Professional WebSocket Analytics</span>
        </h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Uptime</span>
            </div>
            <div className="text-lg font-bold text-white">
              {formatUptime(metrics.uptime)}
            </div>
            <div className="text-xs text-gray-500">
              session time
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Signal className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Latency</span>
            </div>
            <div className={`text-lg font-bold ${getLatencyColor(metrics.averageLatency)}`}>
              {metrics.averageLatency.toFixed(0)}ms
            </div>
            <div className="text-xs text-gray-500">
              average ping
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Messages/sec</span>
            </div>
            <div className="text-lg font-bold text-white">
              {metrics.messagesPerSecond.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">
              throughput
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Server className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400">Reconnects</span>
            </div>
            <div className="text-lg font-bold text-white">
              {metrics.reconnectAttempts}/{metrics.maxReconnectAttempts}
            </div>
            <div className="text-xs text-gray-500">
              attempts
            </div>
          </div>
        </div>
      )}

      {/* Connection Details */}
      {metrics && (
        <div className="bg-[#2a2a2a] rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-2">Connection Details</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={getStatusColor()}>{getStatusText()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Data Rate:</span>
              <span className="text-white">{formatNumber(metrics.bytesPerSecond.toString())} B/s</span>
            </div>
            {metrics.lastConnected && (
              <div className="flex justify-between">
                <span className="text-gray-400">Last Connected:</span>
                <span className="text-white">{metrics.lastConnected.toLocaleTimeString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Connection Health:</span>
              <span className={metrics.status === 'connected' ? 'text-green-400' : 'text-red-400'}>
                {metrics.status === 'connected' ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connection History */}
      <div>
        <div className="text-sm text-gray-400 mb-2">Recent Events</div>
        {connectionHistory.length === 0 ? (
          <div className="text-center py-4">
            <Activity className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No connection events yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {connectionHistory.map((event, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-2 rounded-lg bg-[#2a2a2a] text-xs"
              >
                <div className="flex-shrink-0">
                  {getEventIcon(event.event)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{event.details}</div>
                </div>
                
                <div className="flex-shrink-0 text-gray-500">
                  {event.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Professional Footer */}
      <div className="mt-4 pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Professional WebSocket Monitor</span>
          {lastUpdate && (
            <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
};
