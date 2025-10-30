import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  AlertCircle,
  RefreshCw,
  Activity,
  Signal,
  Clock,
  TrendingUp,
  Server
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import websocketService from '../services/websocket';

interface ProfessionalConnectionIndicatorProps {
  className?: string;
  variant?: 'compact' | 'full' | 'minimal';
  showMetrics?: boolean;
  onReconnect?: () => void;
}

export const ProfessionalConnectionIndicator: React.FC<ProfessionalConnectionIndicatorProps> = ({
  className = '',
  variant = 'compact',
  showMetrics = false,
  onReconnect
}) => {
  const { connectionState, error, isConnected } = useWebSocket();
  const [showDetails, setShowDetails] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{
    status: string;
    uptime: number;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    lastConnected: Date | null;
    messagesPerSecond: number;
    averageLatency: number;
  } | null>(null);

  // Derive connection status
  const isConnecting = connectionState === 'connecting';
  const hasError = !!error || connectionState === 'error';

  // Update connection health periodically
  useEffect(() => {
    const updateHealth = () => {
      const health = websocketService.getConnectionHealth();
      setConnectionHealth(health);
    };

    updateHealth();
    const interval = setInterval(updateHealth, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  const handleReconnect = () => {
    websocketService.reconnect();
    if (onReconnect) {
      onReconnect();
    }
  };

  const getStatusIcon = () => {
    if (isConnecting) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (isConnected) {
      return <Wifi className="w-4 h-4" />;
    }
    if (hasError) {
      return <AlertCircle className="w-4 h-4" />;
    }
    return <WifiOff className="w-4 h-4" />;
  };

  const getStatusColor = () => {
    if (isConnecting) return 'text-yellow-400';
    if (isConnected) return 'text-green-400';
    if (hasError) return 'text-red-400';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Connected';
    if (hasError) return 'Error';
    return 'Disconnected';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-400';
    if (latency < 300) return 'text-yellow-400';
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

  // Minimal variant
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center ${className}`}>
        <div className={`${getStatusColor()} transition-colors`}>
          {getStatusIcon()}
        </div>
        {isConnected && (
          <div className="ml-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        )}
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <div
          className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
            isConnected 
              ? 'bg-green-500/10 hover:bg-green-500/20 border border-green-500/20' 
              : hasError
              ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/20'
              : 'bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/20'
          }`}
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className={getStatusColor()}>
            {getStatusIcon()}
          </div>
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {isConnected && connectionHealth && (
            <div className="flex items-center space-x-1">
              <Signal className="w-3 h-3 text-green-400" />
              <span className={`text-xs ${getLatencyColor(connectionHealth.averageLatency)}`}>
                {connectionHealth.averageLatency.toFixed(0)}ms
              </span>
            </div>
          )}
        </div>

        {/* Compact dropdown */}
        {showDetails && (
          <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Status:</span>
                <span className={`text-sm ${getStatusColor()}`}>{getStatusText()}</span>
              </div>
              
              {connectionHealth && isConnected && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Uptime:</span>
                    <span className="text-white text-sm">{formatUptime(connectionHealth.uptime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Latency:</span>
                    <span className={`text-sm ${getLatencyColor(connectionHealth.averageLatency)}`}>
                      {connectionHealth.averageLatency.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Messages/sec:</span>
                    <span className="text-white text-sm">{connectionHealth.messagesPerSecond.toFixed(1)}</span>
                  </div>
                </>
              )}

              {error && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300">
                  {error}
                </div>
              )}

              {!isConnected && (
                <button
                  onClick={handleReconnect}
                  disabled={isConnecting}
                  className="w-full mt-2 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded transition-colors text-sm"
                >
                  <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
                  <span>{isConnecting ? 'Connecting...' : 'Reconnect'}</span>
                </button>
              )}
            </div>
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
        <div className="flex items-center space-x-3">
          <div className={`${getStatusColor()} transition-colors`}>
            {getStatusIcon()}
          </div>
          <div>
            <h3 className="text-white font-medium">Connection Status</h3>
            <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
          </div>
        </div>
        
        {isConnected && (
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Live</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      {showMetrics && connectionHealth && isConnected && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">Uptime</span>
            </div>
            <div className="text-lg font-bold text-white">
              {formatUptime(connectionHealth.uptime)}
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Signal className="w-4 h-4 text-green-400" />
              <span className="text-xs text-gray-400">Latency</span>
            </div>
            <div className={`text-lg font-bold ${getLatencyColor(connectionHealth.averageLatency)}`}>
              {connectionHealth.averageLatency.toFixed(0)}ms
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Messages/sec</span>
            </div>
            <div className="text-lg font-bold text-white">
              {connectionHealth.messagesPerSecond.toFixed(1)}
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Server className="w-4 h-4 text-orange-400" />
              <span className="text-xs text-gray-400">Reconnects</span>
            </div>
            <div className="text-lg font-bold text-white">
              {connectionHealth.reconnectAttempts}/{connectionHealth.maxReconnectAttempts}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">Connection Error</span>
          </div>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {!isConnected && (
          <button
            onClick={handleReconnect}
            disabled={isConnecting}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
            <span>{isConnecting ? 'Connecting...' : 'Reconnect'}</span>
          </button>
        )}

        {connectionHealth && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(connectionHealth, null, 2));
            }}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Copy Debug Info
          </button>
        )}
      </div>

      {/* Connection Quality Indicator */}
      {isConnected && connectionHealth && (
        <div className="mt-4 pt-4 border-t border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Connection Quality</span>
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-4 rounded-sm ${
                    connectionHealth.averageLatency < 100 && i < 5 ? 'bg-green-400' :
                    connectionHealth.averageLatency < 200 && i < 4 ? 'bg-yellow-400' :
                    connectionHealth.averageLatency < 300 && i < 3 ? 'bg-orange-400' :
                    i < 2 ? 'bg-red-400' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Last connected: {connectionHealth.lastConnected?.toLocaleTimeString() || 'Never'}
          </div>
        </div>
      )}
    </div>
  );
};
