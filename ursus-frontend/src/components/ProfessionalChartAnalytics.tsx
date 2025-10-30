import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, DollarSign, Clock } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface Trade {
  id: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  txHash?: string;
}

interface Candle {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ProfessionalChartAnalyticsProps {
  trades: Trade[];
  candles: Candle[];
  tokenSymbol: string;
  currentPrice: number | null;
  priceChange24h: number;
  className?: string;
}

export const ProfessionalChartAnalytics: React.FC<ProfessionalChartAnalyticsProps> = ({
  trades,
  candles,
  tokenSymbol,
  currentPrice,
  priceChange24h,
  className = ''
}) => {
  // Professional analytics calculations
  const analytics = useMemo(() => {
    if (!trades.length || !candles.length) {
      return {
        totalVolume: 0,
        avgTradeSize: 0,
        buyVolume: 0,
        sellVolume: 0,
        buyCount: 0,
        sellCount: 0,
        volatility: 0,
        highPrice: 0,
        lowPrice: 0,
        vwap: 0,
        rsi: 50
      };
    }

    // Trade analytics
    const buyTrades = trades.filter(t => t.type === 'buy');
    const sellTrades = trades.filter(t => t.type === 'sell');
    const totalVolume = trades.reduce((sum, t) => sum + (t.amount * t.price), 0);
    const buyVolume = buyTrades.reduce((sum, t) => sum + (t.amount * t.price), 0);
    const sellVolume = sellTrades.reduce((sum, t) => sum + (t.amount * t.price), 0);

    // Price analytics
    const prices = candles.map(c => c.close);
    const highPrice = Math.max(...candles.map(c => c.high));
    const lowPrice = Math.min(...candles.map(c => c.low));
    
    // Volatility calculation (standard deviation)
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice * 100;

    // VWAP calculation
    const vwapNumerator = candles.reduce((sum, c) => sum + (c.close * c.volume), 0);
    const vwapDenominator = candles.reduce((sum, c) => sum + c.volume, 0);
    const vwap = vwapDenominator > 0 ? vwapNumerator / vwapDenominator : 0;

    // Simple RSI calculation (14-period)
    let rsi = 50;
    if (prices.length >= 14) {
      const gains = [];
      const losses = [];
      
      for (let i = 1; i < Math.min(prices.length, 15); i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
          gains.push(change);
          losses.push(0);
        } else {
          gains.push(0);
          losses.push(Math.abs(change));
        }
      }
      
      const avgGain = gains.reduce((sum, g) => sum + g, 0) / gains.length;
      const avgLoss = losses.reduce((sum, l) => sum + l, 0) / losses.length;
      
      if (avgLoss > 0) {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
    }

    return {
      totalVolume,
      avgTradeSize: totalVolume / trades.length,
      buyVolume,
      sellVolume,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      volatility,
      highPrice,
      lowPrice,
      vwap,
      rsi
    };
  }, [trades, candles]);

  const getRSIColor = (rsi: number) => {
    if (rsi > 70) return 'text-red-400';
    if (rsi < 30) return 'text-green-400';
    return 'text-yellow-400';
  };

  const getVolatilityColor = (volatility: number) => {
    if (volatility > 10) return 'text-red-400';
    if (volatility > 5) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <BarChart3 className="w-5 h-5" />
          <span>Professional Analytics</span>
        </h3>
        <div className="text-xs text-gray-400">
          {tokenSymbol} • Real-time
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Price Metrics */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Current Price</span>
          </div>
          <div className="text-lg font-bold text-white">
            {currentPrice ? formatNumber(currentPrice.toString()) : '0.00'}
          </div>
          <div className={`text-sm ${priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
          </div>
        </div>

        {/* Volume Metrics */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Total Volume</span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatNumber(analytics.totalVolume.toString())}
          </div>
          <div className="text-sm text-gray-400">
            {analytics.buyCount + analytics.sellCount} trades
          </div>
        </div>

        {/* Volatility */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">Volatility</span>
          </div>
          <div className={`text-lg font-bold ${getVolatilityColor(analytics.volatility)}`}>
            {analytics.volatility.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-400">
            24h standard dev
          </div>
        </div>

        {/* RSI */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400">RSI (14)</span>
          </div>
          <div className={`text-lg font-bold ${getRSIColor(analytics.rsi)}`}>
            {analytics.rsi.toFixed(1)}
          </div>
          <div className="text-sm text-gray-400">
            {analytics.rsi > 70 ? 'Overbought' : analytics.rsi < 30 ? 'Oversold' : 'Neutral'}
          </div>
        </div>
      </div>

      {/* Advanced Metrics */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Range */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">24h Price Range</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Low</div>
              <div className="text-sm font-semibold text-red-400">
                {formatNumber(analytics.lowPrice.toString())}
              </div>
            </div>
            <div className="flex-1 mx-3">
              <div className="h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full"></div>
            </div>
            <div>
              <div className="text-xs text-gray-500">High</div>
              <div className="text-sm font-semibold text-green-400">
                {formatNumber(analytics.highPrice.toString())}
              </div>
            </div>
          </div>
        </div>

        {/* Buy/Sell Ratio */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">Buy/Sell Volume</div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-xs text-gray-400">Buy</span>
              </div>
              <div className="text-sm font-semibold text-green-400">
                {formatNumber(analytics.buyVolume.toString())} ({analytics.buyCount})
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="text-xs text-gray-400">Sell</span>
              </div>
              <div className="text-sm font-semibold text-red-400">
                {formatNumber(analytics.sellVolume.toString())} ({analytics.sellCount})
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VWAP */}
      {analytics.vwap > 0 && (
        <div className="mt-4 bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">VWAP (Volume Weighted Average Price)</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(analytics.vwap.toString())} SOL
              </div>
            </div>
            <div className={`text-sm ${currentPrice && currentPrice > analytics.vwap ? 'text-green-400' : 'text-red-400'}`}>
              {currentPrice && currentPrice > analytics.vwap ? 'Above VWAP' : 'Below VWAP'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
