import React, { useState, useEffect } from 'react';
import {
  Settings,
  CheckCircle,
  AlertCircle,
  Wifi,
  Shield,
  Network,
  Info,
  Activity
} from 'lucide-react';
import { useNetwork, usePublicClient } from 'wagmi';
import { configMetadata, validateConfiguration } from '../config/wagmi';

interface ConfigurationStatus {
  isValid: boolean;
  issues: string[];
  metadata: typeof configMetadata;
}

interface ProfessionalWagmiMonitorProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const ProfessionalWagmiMonitor: React.FC<ProfessionalWagmiMonitorProps> = ({
  className = '',
  variant = 'compact'
}) => {
  const { chain } = useNetwork();
  const publicClient = usePublicClient();
  const [configStatus, setConfigStatus] = useState<ConfigurationStatus | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  // Validate configuration on mount and periodically
  useEffect(() => {
    const validateConfig = () => {
      const status = validateConfiguration();
      setConfigStatus(status);
      setLastCheck(new Date());
    };

    validateConfig();
    const interval = setInterval(validateConfig, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (!configStatus) {
      return <Activity className="w-4 h-4 text-gray-400 animate-pulse" />;
    }
    
    return configStatus.isValid 
      ? <CheckCircle className="w-4 h-4 text-green-400" />
      : <AlertCircle className="w-4 h-4 text-red-400" />;
  };

  const getStatusColor = () => {
    if (!configStatus) return 'text-gray-400';
    return configStatus.isValid ? 'text-green-400' : 'text-red-400';
  };

  const getStatusText = () => {
    if (!configStatus) return 'Checking...';
    return configStatus.isValid ? 'Healthy' : 'Issues Detected';
  };

  const getChainStatus = () => {
    if (!chain) {
      return {
        icon: <Network className="w-4 h-4 text-gray-400" />,
        text: 'No Chain',
        color: 'text-gray-400'
      };
    }

    const isCoreChain = chain.id === 1114 || chain.id === 1116;
    return {
      icon: <Network className={`w-4 h-4 ${isCoreChain ? 'text-green-400' : 'text-yellow-400'}`} />,
      text: chain.name,
      color: isCoreChain ? 'text-green-400' : 'text-yellow-400'
    };
  };

  const getClientStatus = () => {
    return {
      icon: publicClient 
        ? <Wifi className="w-4 h-4 text-green-400" />
        : <Wifi className="w-4 h-4 text-red-400" />,
      text: publicClient ? 'Connected' : 'Disconnected',
      color: publicClient ? 'text-green-400' : 'text-red-400'
    };
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-1">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            Wagmi
          </span>
        </div>
        {configStatus && !configStatus.isValid && (
          <div className="text-xs text-red-400">
            {configStatus.issues.length} issue{configStatus.issues.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  const chainStatus = getChainStatus();
  const clientStatus = getClientStatus();

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Professional Wagmi Monitor</span>
        </h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-400">Configuration</span>
          </div>
          <div className={`text-lg font-bold ${getStatusColor()}`}>
            {getStatusText()}
          </div>
          {configStatus && (
            <div className="text-xs text-gray-500 mt-1">
              v{configStatus.metadata.version}
            </div>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            {chainStatus.icon}
            <span className="text-sm text-gray-400">Current Chain</span>
          </div>
          <div className={`text-lg font-bold ${chainStatus.color}`}>
            {chainStatus.text}
          </div>
          {chain && (
            <div className="text-xs text-gray-500 mt-1">
              ID: {chain.id}
            </div>
          )}
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            {clientStatus.icon}
            <span className="text-sm text-gray-400">RPC Client</span>
          </div>
          <div className={`text-lg font-bold ${clientStatus.color}`}>
            {clientStatus.text}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Public Client
          </div>
        </div>
      </div>

      {/* Configuration Details */}
      {configStatus && (
        <div className="bg-[#2a2a2a] rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-2">Configuration Details</div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Supported Chains:</span>
              <span className="text-white">{configStatus.metadata.supportedChains}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Connectors:</span>
              <span className="text-white">{configStatus.metadata.supportedConnectors}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">WalletConnect:</span>
              <span className={configStatus.metadata.hasWalletConnect ? 'text-green-400' : 'text-gray-400'}>
                {configStatus.metadata.hasWalletConnect ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Environment:</span>
              <span className="text-white capitalize">{configStatus.metadata.environment}</span>
            </div>
          </div>
        </div>
      )}

      {/* Issues Display */}
      {configStatus && configStatus.issues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">Configuration Issues</span>
          </div>
          <div className="space-y-1">
            {configStatus.issues.map((issue, index) => (
              <div key={index} className="text-red-300 text-sm">
                • {issue}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Professional Footer */}
      <div className="pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-3 h-3" />
            <span>Professional Wagmi Configuration</span>
          </div>
          {lastCheck && (
            <span>Last check: {lastCheck.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
};
