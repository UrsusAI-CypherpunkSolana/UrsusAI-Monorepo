import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import websocketService from '../services/websocket';

interface ConnectionStatusProps {
  className?: string;
  showDetails?: boolean;
  onReconnect?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = '',
  showDetails = false,
  onReconnect
}) => {
  const { connectionState, error, isConnected } = useWebSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<{
    status: string;
    uptime: number;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    lastConnected: Date | null;
    messagesPerSecond: number;
    averageLatency: number;
  } | null>(null);

  // Derive connection status from connectionState
  const isConnecting = connectionState === 'connecting';
  const hasError = !!error || connectionState === 'error';

  // Update connection health periodically
  useEffect(() => {
    const updateHealth = () => {
      const health = websocketService.getConnectionHealth();
      setConnectionHealth(health);
    };

    updateHealth();
    const interval = setInterval(updateHealth, 2000);

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

  const formatUptime = (uptime: number) => {
    if (uptime < 1000) return '< 1s';
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isConnected 
            ? 'bg-green-500/10 hover:bg-green-500/20' 
            : hasError
            ? 'bg-red-500/10 hover:bg-red-500/20'
            : 'bg-gray-500/10 hover:bg-gray-500/20'
        }`}
        onClick={() => setShowDropdown(!showDropdown)}
      >
        <div className={getStatusColor()}>
          {getStatusIcon()}
        </div>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </span>
        {isConnected && (
          <div className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400">Live</span>
          </div>
        )}
      </div>

      {/* Dropdown with details */}
      {showDropdown && showDetails && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Connection Status</h3>
              <button
                onClick={() => setShowDropdown(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            {/* Status Overview */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className={getStatusColor()}>{getStatusText()}</span>
              </div>

              {connectionHealth && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Uptime:</span>
                    <span className="text-white">
                      {formatUptime(connectionHealth.uptime)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Reconnect Attempts:</span>
                    <span className="text-white">
                      {connectionHealth.reconnectAttempts}/{connectionHealth.maxReconnectAttempts}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Messages/sec:</span>
                    <span className="text-white">
                      {connectionHealth.messagesPerSecond.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Latency:</span>
                    <span className="text-white">
                      {connectionHealth.averageLatency.toFixed(0)}ms
                    </span>
                  </div>

                  {connectionHealth.lastConnected && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Connected:</span>
                      <span className="text-white text-xs">
                        {connectionHealth.lastConnected.toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </>
              )}

              {error && (
                <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 text-sm">Error</span>
                  </div>
                  <p className="text-red-300 text-xs mt-1">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2 mt-4">
                {!isConnected && (
                  <button
                    onClick={handleReconnect}
                    disabled={isConnecting}
                    className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                    <span>{isConnecting ? 'Connecting...' : 'Reconnect'}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(connectionHealth, null, 2));
                  }}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors text-sm"
                >
                  Copy Debug Info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple tooltip for non-detailed view */}
      {showDropdown && !showDetails && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 p-3">
          <div className="text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-gray-400">Status:</span>
              <span className={getStatusColor()}>{getStatusText()}</span>
            </div>
            {error && (
              <div className="text-red-400 text-xs mb-2">{error}</div>
            )}
            {!isConnected && (
              <button
                onClick={handleReconnect}
                disabled={isConnecting}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded transition-colors"
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
};

export default ConnectionStatus;
