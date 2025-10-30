import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Shield, 
  Clock, 
  Activity, 
  CheckCircle,
  AlertCircle,
  Zap,
  Network
} from 'lucide-react';
import { useWalletContext } from '../hooks/useWalletContext';
import { formatNumber } from '../utils/formatters';

interface WalletAnalytics {
  connectionTime: Date | null;
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  networkSwitches: number;
  lastActivity: Date | null;
  sessionDuration: number;
}

interface ProfessionalWalletAnalyticsProps {
  className?: string;
}

export const ProfessionalWalletAnalytics: React.FC<ProfessionalWalletAnalyticsProps> = ({
  className = ''
}) => {
  const {
    isConnected,
    address,
    balance,
    chain,
    isOnCoreNetwork,

    isOnMainnet,
    connectionAttempts,
    connectError
  } = useWalletContext();

  const [analytics, setAnalytics] = useState<WalletAnalytics>({
    connectionTime: null,
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    networkSwitches: 0,
    lastActivity: null,
    sessionDuration: 0
  });

  const [sessionStart] = useState(new Date());

  // Track connection events
  useEffect(() => {
    if (isConnected && !analytics.connectionTime) {
      setAnalytics(prev => ({
        ...prev,
        connectionTime: new Date(),
        totalConnections: prev.totalConnections + 1,
        successfulConnections: prev.successfulConnections + 1,
        lastActivity: new Date()
      }));
    }
  }, [isConnected, analytics.connectionTime]);

  // Track connection errors
  useEffect(() => {
    if (connectError) {
      setAnalytics(prev => ({
        ...prev,
        totalConnections: prev.totalConnections + 1,
        failedConnections: prev.failedConnections + 1,
        lastActivity: new Date()
      }));
    }
  }, [connectError]);

  // Track network changes
  useEffect(() => {
    if (chain && analytics.lastActivity) {
      setAnalytics(prev => ({
        ...prev,
        networkSwitches: prev.networkSwitches + 1,
        lastActivity: new Date()
      }));
    }
  }, [chain?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update session duration
  useEffect(() => {
    const interval = setInterval(() => {
      setAnalytics(prev => ({
        ...prev,
        sessionDuration: Date.now() - sessionStart.getTime()
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStart]);

  const getConnectionStatus = () => {
    if (isConnected) {
      return {
        icon: <CheckCircle className="w-4 h-4 text-green-400" />,
        text: 'Connected',
        color: 'text-green-400'
      };
    }
    if (connectError) {
      return {
        icon: <AlertCircle className="w-4 h-4 text-red-400" />,
        text: 'Error',
        color: 'text-red-400'
      };
    }
    return {
      icon: <Wallet className="w-4 h-4 text-gray-400" />,
      text: 'Disconnected',
      color: 'text-gray-400'
    };
  };

  const getNetworkStatus = () => {
    if (isOnCoreNetwork) {
      return {
        icon: <Network className="w-4 h-4 text-green-400" />,
        text: isOnMainnet ? 'Core Mainnet' : 'Core Testnet',
        color: 'text-green-400'
      };
    }
    return {
      icon: <Network className="w-4 h-4 text-yellow-400" />,
      text: chain?.name || 'Unknown Network',
      color: 'text-yellow-400'
    };
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getSuccessRate = () => {
    if (analytics.totalConnections === 0) return 0;
    return (analytics.successfulConnections / analytics.totalConnections) * 100;
  };

  const connectionStatus = getConnectionStatus();
  const networkStatus = getNetworkStatus();

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Professional Wallet Analytics</span>
        </h3>
        <div className="text-xs text-gray-400">
          Live Session
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            {connectionStatus.icon}
            <span className="text-sm text-gray-400">Connection Status</span>
          </div>
          <div className={`text-lg font-bold ${connectionStatus.color}`}>
            {connectionStatus.text}
          </div>
          {isConnected && address && (
            <div className="text-xs text-gray-500 mt-1 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            {networkStatus.icon}
            <span className="text-sm text-gray-400">Network</span>
          </div>
          <div className={`text-lg font-bold ${networkStatus.color}`}>
            {networkStatus.text}
          </div>
          {chain && (
            <div className="text-xs text-gray-500 mt-1">
              Chain ID: {chain.id}
            </div>
          )}
        </div>
      </div>

      {/* Balance Information */}
      {isConnected && balance && (
        <div className="bg-[#2a2a2a] rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Balance</span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatNumber(balance.formatted)} {balance.symbol}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Decimals: {balance.decimals}
          </div>
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Connections</span>
          </div>
          <div className="text-lg font-bold text-white">{analytics.totalConnections}</div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Success Rate</span>
          </div>
          <div className="text-lg font-bold text-green-400">
            {getSuccessRate().toFixed(1)}%
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Switches</span>
          </div>
          <div className="text-lg font-bold text-purple-400">{analytics.networkSwitches}</div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">Session</span>
          </div>
          <div className="text-lg font-bold text-orange-400">
            {formatDuration(analytics.sessionDuration)}
          </div>
        </div>
      </div>

      {/* Session Information */}
      <div className="bg-[#2a2a2a] rounded-lg p-3">
        <div className="text-sm text-gray-400 mb-2">Session Information</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Session Started:</span>
            <span className="text-white">{sessionStart.toLocaleTimeString()}</span>
          </div>
          {analytics.connectionTime && (
            <div className="flex justify-between">
              <span className="text-gray-400">Connected At:</span>
              <span className="text-white">{analytics.connectionTime.toLocaleTimeString()}</span>
            </div>
          )}
          {analytics.lastActivity && (
            <div className="flex justify-between">
              <span className="text-gray-400">Last Activity:</span>
              <span className="text-white">{analytics.lastActivity.toLocaleTimeString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">Connection Attempts:</span>
            <span className="text-white">{connectionAttempts}</span>
          </div>
        </div>
      </div>

      {/* Professional Footer */}
      <div className="mt-4 pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Professional Wallet Monitor</span>
          <span>URSUS Platform</span>
        </div>
      </div>
    </div>
  );
};
