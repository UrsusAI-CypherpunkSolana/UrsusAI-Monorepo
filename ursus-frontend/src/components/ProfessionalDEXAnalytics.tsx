import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Zap,
  Shield,
  Activity,
  DollarSign,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Clock,
  Target
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface DEXQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  slippage: number;
  minimumReceived: string;
  route: string[];
  gasEstimate?: bigint;
}

interface DEXTradingState {
  loading: boolean;
  error: string | null;
  quote: DEXQuote | null;
  isApproved: boolean;
  isApproving: boolean;
}

interface ProfessionalDEXAnalyticsProps {
  dexState: DEXTradingState;
  tokenSymbol: string;
  className?: string;
  variant?: 'compact' | 'full';
}

export const ProfessionalDEXAnalytics: React.FC<ProfessionalDEXAnalyticsProps> = ({
  dexState,
  tokenSymbol,
  className = '',
  variant = 'full'
}) => {
  const [tradeHistory, setTradeHistory] = useState<Array<{
    timestamp: Date;
    type: 'quote' | 'approval' | 'trade';
    status: 'success' | 'error' | 'pending';
    details: string;
  }>>([]);

  // Track DEX state changes
  useEffect(() => {
    if (dexState.quote) {
      setTradeHistory(prev => [{
        timestamp: new Date(),
        type: 'quote',
        status: 'success',
        details: `Quote: ${dexState.quote?.inputAmount} → ${dexState.quote?.outputAmount}`
      }, ...prev.slice(0, 9)]);
    }
  }, [dexState.quote]);

  useEffect(() => {
    if (dexState.isApproving) {
      setTradeHistory(prev => [{
        timestamp: new Date(),
        type: 'approval',
        status: 'pending',
        details: 'Token approval in progress'
      }, ...prev.slice(0, 9)]);
    } else if (dexState.isApproved) {
      setTradeHistory(prev => [{
        timestamp: new Date(),
        type: 'approval',
        status: 'success',
        details: 'Token approved for trading'
      }, ...prev.slice(0, 9)]);
    }
  }, [dexState.isApproving, dexState.isApproved]);

  useEffect(() => {
    if (dexState.error) {
      setTradeHistory(prev => [{
        timestamp: new Date(),
        type: 'trade',
        status: 'error',
        details: dexState.error || 'Unknown error'
      }, ...prev.slice(0, 9)]);
    }
  }, [dexState.error]);

  const getQuoteQuality = () => {
    if (!dexState.quote) return null;
    
    const priceImpact = dexState.quote.priceImpact;
    if (priceImpact < 1) return { level: 'excellent', color: 'text-green-400', text: 'Excellent' };
    if (priceImpact < 3) return { level: 'good', color: 'text-blue-400', text: 'Good' };
    if (priceImpact < 5) return { level: 'fair', color: 'text-yellow-400', text: 'Fair' };
    return { level: 'poor', color: 'text-red-400', text: 'High Impact' };
  };

  const getStatusIcon = () => {
    if (dexState.loading) {
      return <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />;
    }
    if (dexState.error) {
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
    if (dexState.quote) {
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    }
    return <Zap className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = () => {
    if (dexState.loading) return 'text-yellow-400';
    if (dexState.error) return 'text-red-400';
    if (dexState.quote) return 'text-green-400';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (dexState.loading) return 'Loading...';
    if (dexState.error) return 'Error';
    if (dexState.quote) return 'Ready';
    return 'Idle';
  };

  const quoteQuality = getQuoteQuality();

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            DEX {getStatusText()}
          </span>
        </div>
        
        {dexState.quote && quoteQuality && (
          <div className="flex items-center space-x-2">
            <div className={`text-xs ${quoteQuality.color}`}>
              {quoteQuality.text}
            </div>
            <div className="text-xs text-gray-400">
              {dexState.quote.priceImpact.toFixed(2)}% impact
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
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <BarChart3 className="w-5 h-5" />
          <span>Professional DEX Analytics</span>
        </h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Approval</span>
          </div>
          <div className={`text-lg font-bold ${dexState.isApproved ? 'text-green-400' : 'text-gray-400'}`}>
            {dexState.isApproved ? 'Approved' : 'Pending'}
          </div>
          <div className="text-xs text-gray-500">
            {dexState.isApproving ? 'Processing...' : 'Token status'}
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Quote</span>
          </div>
          <div className={`text-lg font-bold ${dexState.quote ? 'text-green-400' : 'text-gray-400'}`}>
            {dexState.quote ? 'Available' : 'None'}
          </div>
          <div className="text-xs text-gray-500">
            {dexState.loading ? 'Loading...' : 'Quote status'}
          </div>
        </div>

        {dexState.quote && (
          <>
            <div className="bg-[#2a2a2a] rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <TrendingDown className="w-4 h-4 text-orange-400" />
                <span className="text-xs text-gray-400">Price Impact</span>
              </div>
              <div className={`text-lg font-bold ${quoteQuality?.color || 'text-white'}`}>
                {dexState.quote.priceImpact.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                {quoteQuality?.text || 'Unknown'}
              </div>
            </div>

            <div className="bg-[#2a2a2a] rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-400">Min Received</span>
              </div>
              <div className="text-lg font-bold text-white">
                {formatNumber(dexState.quote.minimumReceived)}
              </div>
              <div className="text-xs text-gray-500">
                {tokenSymbol}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quote Details */}
      {dexState.quote && (
        <div className="bg-[#2a2a2a] rounded-lg p-3 mb-4">
          <div className="text-sm text-gray-400 mb-2">Current Quote Details</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Input Amount:</span>
              <span className="text-white">{formatNumber(dexState.quote.inputAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Output Amount:</span>
              <span className="text-white">{formatNumber(dexState.quote.outputAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Slippage Tolerance:</span>
              <span className="text-white">{dexState.quote.slippage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Route:</span>
              <span className="text-white font-mono text-xs">
                {dexState.quote.route.join(' → ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trade History */}
      <div>
        <div className="text-sm text-gray-400 mb-2">Recent Activity</div>
        {tradeHistory.length === 0 ? (
          <div className="text-center py-4">
            <Activity className="w-6 h-6 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No DEX activity yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {tradeHistory.map((activity, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-2 rounded-lg text-xs ${
                  activity.status === 'success' 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : activity.status === 'error'
                    ? 'bg-red-500/10 border border-red-500/20'
                    : 'bg-yellow-500/10 border border-yellow-500/20'
                }`}
              >
                <div className="flex-shrink-0">
                  {activity.status === 'success' && <CheckCircle className="w-3 h-3 text-green-400" />}
                  {activity.status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
                  {activity.status === 'pending' && <Clock className="w-3 h-3 text-yellow-400" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="text-white truncate">{activity.details}</div>
                </div>
                
                <div className="flex-shrink-0 text-gray-500">
                  {activity.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Display */}
      {dexState.error && (
        <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">DEX Error</span>
          </div>
          <p className="text-red-300 text-sm">{dexState.error}</p>
        </div>
      )}

      {/* Professional Footer */}
      <div className="mt-4 pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Professional DEX Analytics • {tokenSymbol}</span>
          <span>Live Trading Data</span>
        </div>
      </div>
    </div>
  );
};
