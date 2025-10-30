import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Activity,
  Zap,
  Shield,
  Target,
  DollarSign,
  Users
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';
import { apiService } from '../services/api';

interface TradingEvent {
  type: 'success' | 'error' | 'pending';
  tradingMethod: 'dex' | 'bonding-curve';
  tokenAddress: string;
  amount: string;
  txHash?: string;
  error?: string;
  timestamp: string;
  tradeType?: 'buy' | 'sell'; // Add buy/sell indicator
}

interface ProfessionalTradingStatusProps {
  className?: string;
  maxEvents?: number;
  tokenAddress?: string; // Add token address to fetch real data
  agent?: any; // Add agent data for token symbol
}

export const ProfessionalTradingStatus: React.FC<ProfessionalTradingStatusProps> = ({
  className = '',
  maxEvents = 10,
  tokenAddress,
  agent
}) => {
  const [tradingEvents, setTradingEvents] = useState<TradingEvent[]>([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    dexTrades: 0,
    bondingCurveTrades: 0
  });
  const [realTimeStats, setRealTimeStats] = useState({
    volume24h: 0,
    transactions24h: 0,
    uniqueTraders24h: 0,
    avgTradeSize: 0
  });

  // Fetch real agent data from backend
  useEffect(() => {
    const fetchRealAgentData = async () => {
      if (!tokenAddress) return;

      try {
        // Fetch both agent data and trades data
        const [agentResponse, tradesResponse] = await Promise.all([
          fetch(`http://localhost:3001/api/agents/${tokenAddress}`),
          fetch(`http://localhost:3001/api/agents/${tokenAddress}/trades?limit=${maxEvents}`)
        ]);

        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          const agent = agentData.data || agentData;

          // Use existing real data from agent
          setRealTimeStats({
            volume24h: parseFloat(agent.volume24h || '0'),
            transactions24h: 0, // We don't have this data reliably
            uniqueTraders24h: parseInt(agent.holders || '0'), // Use holders as proxy
            avgTradeSize: 0 // We don't have this data reliably
          });

          // Fetch real trades data if available
          if (tradesResponse.ok) {
            const tradesData = await tradesResponse.json();
            const trades = tradesData.data || tradesData;

            if (Array.isArray(trades) && trades.length > 0) {
              // Convert real trades to trading events
              const realEvents: TradingEvent[] = trades.map((trade: any) => ({
                type: 'success' as const,
                tradingMethod: 'bonding-curve' as const,
                tokenAddress: tokenAddress,
                amount: trade.solAmount || trade.amount || '0',
                txHash: trade.txHash,
                timestamp: trade.timestamp,
                tradeType: trade.type as 'buy' | 'sell'
              }));

              setTradingEvents(realEvents);
            } else {
              // No real trades, show empty state
              setTradingEvents([]);
            }
          } else {
            // Fallback to empty state if trades endpoint fails
            setTradingEvents([]);
          }

          // Update basic stats
          setStats({
            totalTrades: 0, // We don't have reliable trade count
            successfulTrades: 0,
            failedTrades: 0,
            dexTrades: 0,
            bondingCurveTrades: 0
          });
        }
      } catch (error) {
        console.error('Error fetching real agent data:', error);
        // Set empty state on error
        setTradingEvents([]);
      }
    };

    fetchRealAgentData();

    // DISABLED: Refresh every 30 seconds - causing infinite loop
    // const interval = setInterval(fetchRealAgentData, 30000);
    // return () => clearInterval(interval);
  }, [tokenAddress, maxEvents]);

  // Listen for trading events
  useEffect(() => {
    const handleTradingSuccess = (event: CustomEvent) => {
      const { txHash, tokenAddress, amount, tradingMethod, type } = event.detail;

      const newEvent: TradingEvent = {
        type: 'success',
        tradingMethod: tradingMethod || 'bonding-curve',
        tokenAddress,
        amount,
        txHash,
        timestamp: new Date().toISOString(),
        tradeType: type as 'buy' | 'sell' // Use the type from event detail
      };

      setTradingEvents(prev => [newEvent, ...prev.slice(0, maxEvents - 1)]);
      
      setStats(prev => ({
        totalTrades: prev.totalTrades + 1,
        successfulTrades: prev.successfulTrades + 1,
        failedTrades: prev.failedTrades,
        dexTrades: prev.dexTrades + (tradingMethod === 'dex' ? 1 : 0),
        bondingCurveTrades: prev.bondingCurveTrades + (tradingMethod === 'bonding-curve' ? 1 : 0)
      }));
    };

    const handleTradingError = (event: CustomEvent) => {
      const { error, tokenAddress, amount, tradingMethod, type } = event.detail;

      const newEvent: TradingEvent = {
        type: 'error',
        tradingMethod: tradingMethod || 'bonding-curve',
        tokenAddress,
        amount,
        error,
        timestamp: new Date().toISOString(),
        tradeType: type as 'buy' | 'sell' // Use the type from event detail
      };

      setTradingEvents(prev => [newEvent, ...prev.slice(0, maxEvents - 1)]);
      
      setStats(prev => ({
        totalTrades: prev.totalTrades + 1,
        successfulTrades: prev.successfulTrades,
        failedTrades: prev.failedTrades + 1,
        dexTrades: prev.dexTrades + (tradingMethod === 'dex' ? 1 : 0),
        bondingCurveTrades: prev.bondingCurveTrades + (tradingMethod === 'bonding-curve' ? 1 : 0)
      }));
    };

    window.addEventListener('trading-success', handleTradingSuccess as EventListener);
    window.addEventListener('trading-error', handleTradingError as EventListener);

    return () => {
      window.removeEventListener('trading-success', handleTradingSuccess as EventListener);
      window.removeEventListener('trading-error', handleTradingError as EventListener);
    };
  }, [maxEvents]);

  const getEventIcon = (event: TradingEvent) => {
    switch (event.type) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400 animate-spin" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTradingMethodIcon = (method: string) => {
    switch (method) {
      case 'dex':
        return <Zap className="w-3 h-3 text-blue-400" />;
      case 'bonding-curve':
        return <TrendingUp className="w-3 h-3 text-purple-400" />;
      default:
        return <Activity className="w-3 h-3 text-gray-400" />;
    }
  };

  const getSuccessRate = () => {
    if (stats.totalTrades === 0) return 0;
    return (stats.successfulTrades / stats.totalTrades) * 100;
  };

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <span>Professional Trading Status</span>
        </h3>
        <div className="text-xs text-gray-400">
          Live Session
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">24h Volume</span>
          </div>
          <div className="text-lg font-bold text-green-400">
            {formatNumber(realTimeStats.volume24h)} SOL
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Holders</span>
          </div>
          <div className="text-lg font-bold text-purple-400">{realTimeStats.uniqueTraders24h}</div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <CheckCircle className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Status</span>
          </div>
          <div className="text-lg font-bold text-blue-400">Active</div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Method</span>
          </div>
          <div className="text-lg font-bold text-yellow-400">Bonding Curve</div>
        </div>
      </div>

      {/* Recent Events */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-300">Recent Trading Activity</h4>
          {tradingEvents.length > 0 && (
            <button
              onClick={() => setTradingEvents([])}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {tradingEvents.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">No trading activity yet</p>
            <p className="text-gray-500 text-xs mt-1">Start trading to see activity here</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tradingEvents.map((event, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  event.type === 'success' 
                    ? 'bg-green-500/5 border-green-500/20' 
                    : event.type === 'error'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-yellow-500/5 border-yellow-500/20'
                }`}
              >
                <div className="flex-shrink-0">
                  {getEventIcon(event)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-medium ${
                      event.type === 'success' ? 'text-green-400' :
                      event.type === 'error' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {event.tradeType ? (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          event.tradeType === 'buy'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {event.tradeType.toUpperCase()}
                        </span>
                      ) : (
                        event.type === 'success' ? 'Trade Successful' :
                        event.type === 'error' ? 'Trade Failed' : 'Trade Pending'
                      )}
                    </span>
                    {getTradingMethodIcon(event.tradingMethod)}
                    <span className="text-xs text-gray-400 uppercase">
                      {event.tradingMethod.replace('-', ' ')}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-400 mt-1">
                    {event.tradeType === 'buy' ? (
                      <>Bought {formatNumber(event.amount)} {agent?.tokenSymbol || 'tokens'} with SOL</>
                    ) : (
                      <>Sold {formatNumber(event.amount)} {agent?.tokenSymbol || 'tokens'} for SOL</>
                    )}
                  </div>
                  
                  {event.error && (
                    <div className="text-xs text-red-400 mt-1">
                      Error: {event.error}
                    </div>
                  )}
                  
                  {event.txHash && (
                    <div className="text-xs text-gray-500 mt-1 font-mono">
                      TX: {event.txHash.slice(0, 10)}...{event.txHash.slice(-8)}
                    </div>
                  )}
                </div>
                

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Professional Footer */}
      <div className="mt-4 pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Professional Trading Monitor</span>
          <span>Session: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};
