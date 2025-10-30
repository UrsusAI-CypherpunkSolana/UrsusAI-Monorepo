import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, DollarSign, Wifi, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';
import { useTradeEvents } from '../hooks/useWebSocket';
import { apiService } from '../services/api';
import websocketService from '../services/websocket';

interface Order {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  amount: number;
  total: number;
  timestamp: number;
  status: 'pending' | 'filled' | 'cancelled';
  userAddress?: string;
}

interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  count: number;
}

interface OrderBookProps {
  agentAddress: string;
  currentPrice?: number;
}

interface OrderBookResponse {
  success: boolean;
  data: {
    buyOrders: OrderBookLevel[];
    sellOrders: OrderBookLevel[];
    recentTrades: Order[];
  };
}

const OrderBook: React.FC<OrderBookProps> = ({ agentAddress, currentPrice = 0 }) => {
  const [buyOrders, setBuyOrders] = useState<OrderBookLevel[]>([]);
  const [sellOrders, setSellOrders] = useState<OrderBookLevel[]>([]);
  const [recentTrades, setRecentTrades] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [spread, setSpread] = useState(0);
  const [spreadPercent, setSpreadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [volume24h, setVolume24h] = useState(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time trade events
  const { latestTrade } = useTradeEvents(agentAddress);

  // Professional WebSocket connection management
  useEffect(() => {
    const updateConnectionStatus = () => {
      const currentState = websocketService.getConnectionState();
      const isConnected = websocketService.isConnected();

      console.log(`📡 Professional OrderBook WebSocket status check:`, {
        state: currentState,
        isConnected,
        agentAddress
      });

      if (isConnected && currentState === 'connected') {
        setConnectionStatus('connected');
      } else if (currentState === 'connecting') {
        setConnectionStatus('connecting');
      } else {
        setConnectionStatus('disconnected');
      }
    };

    const handleConnected = (data?: { timestamp?: Date; reconnectAttempts?: number }) => {
      console.log('📡 Professional OrderBook WebSocket connected:', data);
      setConnectionStatus('connected');
      // Re-subscribe after connection
      websocketService.subscribe(`orderbook:${agentAddress.toLowerCase()}`);
      websocketService.subscribe(`trades:${agentAddress.toLowerCase()}`);
    };

    const handleDisconnected = (data?: { code?: number; reason?: string; timestamp?: Date }) => {
      console.log('📡 Professional OrderBook WebSocket disconnected:', data);
      setConnectionStatus('disconnected');
    };

    const handleConnecting = () => {
      console.log('📡 Professional OrderBook WebSocket connecting...');
      setConnectionStatus('connecting');
    };

    // Set up professional WebSocket event listeners
    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    websocketService.on('connecting', handleConnecting);

    // Initial connection status check
    updateConnectionStatus();

    // Ensure connection and subscriptions
    if (!websocketService.isConnected()) {
      console.log('📡 Professional OrderBook initiating WebSocket connection...');
      websocketService.connect();
    } else {
      // Already connected, just subscribe
      websocketService.subscribe(`orderbook:${agentAddress.toLowerCase()}`);
      websocketService.subscribe(`trades:${agentAddress.toLowerCase()}`);
    }

    // Periodic connection status check
    const statusInterval = setInterval(updateConnectionStatus, 5000);

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('connecting', handleConnecting);
      websocketService.unsubscribe(`orderbook:${agentAddress.toLowerCase()}`);
      websocketService.unsubscribe(`trades:${agentAddress.toLowerCase()}`);
      clearInterval(statusInterval);
    };
  }, [agentAddress]);

  // Fetch order book data from backend
  const fetchOrderBook = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`📊 Fetching real order book for ${agentAddress}`);

      const response = await apiService.get(`/trading/orderbook/${agentAddress}`);
      const orderBookData = response.data as OrderBookResponse;

      if (orderBookData.success && orderBookData.data) {
        const { buyOrders: buys, sellOrders: sells, recentTrades: trades } = orderBookData.data;

        console.log(`✅ Found real order book data: ${buys?.length || 0} buys, ${sells?.length || 0} sells`);

        setBuyOrders(buys || []);
        setSellOrders(sells || []);
        setRecentTrades(trades || []);

        // Calculate spread
        if (buys && buys.length > 0 && sells && sells.length > 0) {
          const bestBid = buys[0].price;
          const bestAsk = sells[0].price;
          const spreadValue = bestAsk - bestBid;
          const spreadPercentValue = (spreadValue / bestBid) * 100;

          setSpread(spreadValue);
          setSpreadPercent(spreadPercentValue);
        } else {
          setSpread(0);
          setSpreadPercent(0);
        }
      } else {
        console.log(`⚠️ No order book data found for ${agentAddress}`);

        // Show empty state
        setBuyOrders([]);
        setSellOrders([]);
        setRecentTrades([]);
        setSpread(0);
        setSpreadPercent(0);
        setError('No order book data available yet. Start trading to see orders.');
      }
    } catch (error) {
      console.error('❌ Error fetching order book:', error);

      // Show error state
      setBuyOrders([]);
      setSellOrders([]);
      setRecentTrades([]);
      setSpread(0);
      setSpreadPercent(0);
      setError('Failed to load order book data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [agentAddress]);

  // Enhanced real-time trade processing
  useEffect(() => {
    if (latestTrade) {
      const tokenAmount = parseFloat(latestTrade.tokenAmount || '0');
      const solAmount = parseFloat(latestTrade.solAmount || '0');
      const price = parseFloat(latestTrade.price || '0');

      // Determine price direction
      if (recentTrades.length > 0) {
        const lastPrice = recentTrades[0].price;
        if (price > lastPrice) {
          setPriceDirection('up');
        } else if (price < lastPrice) {
          setPriceDirection('down');
        } else {
          setPriceDirection('neutral');
        }

        // Reset direction after animation
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = setTimeout(() => {
          setPriceDirection('neutral');
        }, 2000);
      }

      const newTrade: Order = {
        id: `${latestTrade.timestamp}-${Math.random()}`,
        type: latestTrade.type === 'buy' ? 'buy' : 'sell',
        price: price,
        amount: tokenAmount,
        total: solAmount,
        timestamp: new Date(latestTrade.timestamp).getTime(),
        status: 'filled',
        userAddress: latestTrade.userAddress
      };

      setRecentTrades(prev => [newTrade, ...prev.slice(0, 49)]);
      setLastUpdateTime(new Date());

      // Update 24h volume
      setVolume24h(prev => prev + solAmount);

      // Update spread calculation
      if (buyOrders.length > 0 && sellOrders.length > 0) {
        const bestBid = Math.max(...buyOrders.map(order => order.price));
        const bestAsk = Math.min(...sellOrders.map(order => order.price));
        const newSpread = bestAsk - bestBid;
        const newSpreadPercent = (newSpread / bestAsk) * 100;

        setSpread(newSpread);
        setSpreadPercent(newSpreadPercent);
      }
    }
  }, [latestTrade, recentTrades, buyOrders, sellOrders]);

  // Load data on mount
  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchOrderBook]);

  const formatPrice = (price: number) => {
    if (price === 0) return '0.000000000000';
    if (isNaN(price)) return '0.000000000000';

    // Always use decimal format with appropriate precision based on value size
    if (price < 0.000000000001) {
      return price.toFixed(18);
    } else if (price < 0.000000001) {
      return price.toFixed(15);
    } else if (price < 0.000001) {
      return price.toFixed(12);
    } else if (price < 0.001) {
      return price.toFixed(9);
    } else if (price < 1) {
      return price.toFixed(6);
    } else {
      return price.toFixed(4);
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getDepthPercentage = (amount: number, maxAmount: number) => {
    return Math.min((amount / maxAmount) * 100, 100);
  };

  const maxBuyAmount = Math.max(...buyOrders.map(order => order.amount), 0);
  const maxSellAmount = Math.max(...sellOrders.map(order => order.amount), 0);

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-[#d8e9ea]" />
          <span className="text-white font-medium">Order Book</span>

          {/* Connection Status */}
          <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded ${
            connectionStatus === 'connected'
              ? 'bg-green-500/20 text-green-400'
              : connectionStatus === 'connecting'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {connectionStatus === 'connected' ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="capitalize">{connectionStatus}</span>
          </div>

          {/* Price Direction Indicator */}
          {priceDirection !== 'neutral' && (
            <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded ${
              priceDirection === 'up'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {priceDirection === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{priceDirection === 'up' ? 'Rising' : 'Falling'}</span>
            </div>
          )}

          {error && (
            <span className="text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
              Error: {error}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-4">
          {/* Volume 24h */}
          <div className="text-sm">
            <span className="text-[#a0a0a0]">24h Vol: </span>
            <span className="text-white">{formatPrice(volume24h)}</span>
          </div>

          {/* Spread Info */}
          <div className="text-sm">
            <span className="text-[#a0a0a0]">Spread: </span>
            <span className="text-white">{formatPrice(spread)}</span>
            <span className="text-[#a0a0a0] ml-1">({spreadPercent.toFixed(2)}%)</span>
          </div>

          {/* Last Update */}
          {lastUpdateTime && (
            <div className="text-xs text-[#a0a0a0]">
              Updated: {lastUpdateTime.toLocaleTimeString()}
            </div>
          )}

          <button
            onClick={fetchOrderBook}
            disabled={loading}
            className="p-1 text-[#a0a0a0] hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Sell Orders */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-[#a0a0a0] border-b border-[#2a2a2a] pb-2">
            <span>Price (SOL)</span>
            <span>Amount</span>
            <span>Total</span>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {sellOrders.slice(0, 15).reverse().map((order, index) => (
              <div
                key={`sell-${index}`}
                className="relative flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-[#0a0a0a] transition-colors"
              >
                {/* Depth Bar */}
                <div
                  className="absolute left-0 top-0 h-full bg-red-500/20 rounded"
                  style={{ width: `${getDepthPercentage(order.amount, maxSellAmount)}%` }}
                />

                <span className="text-red-400 relative z-10">{formatPrice(order.price)}</span>
                <span className="text-[#a0a0a0] relative z-10">{formatAmount(order.amount)}</span>
                <span className="text-[#a0a0a0] relative z-10">{formatAmount(order.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Price & Recent Trades */}
        <div className="space-y-4">
          {/* Current Price */}
          <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 text-center">
            <div className="text-sm text-[#a0a0a0] mb-1">Current Price</div>
            <div className="text-2xl font-bold text-white">
              {formatPrice(currentPrice)}
            </div>
            <div className="text-sm text-[#a0a0a0]">SOL</div>
          </div>

          {/* Recent Trades */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-[#a0a0a0] border-b border-[#2a2a2a] pb-2">
              Recent Trades
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {recentTrades.slice(0, 10).map((trade, index) => (
                <div
                  key={trade.id || index}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[#0a0a0a] transition-colors"
                >
                  <span className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                    {formatPrice(trade.price)}
                  </span>
                  <span className="text-[#a0a0a0]">{formatAmount(trade.amount)}</span>
                  <span className="text-[#666]">{formatTime(trade.timestamp)}</span>
                </div>
              ))}

              {recentTrades.length === 0 && (
                <div className="text-center text-[#666] py-4">
                  No recent trades
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Buy Orders */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-[#a0a0a0] border-b border-[#2a2a2a] pb-2">
            <span>Price (SOL)</span>
            <span>Amount</span>
            <span>Total</span>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {buyOrders.slice(0, 15).map((order, index) => (
              <div
                key={`buy-${index}`}
                className="relative flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-[#0a0a0a] transition-colors"
              >
                {/* Depth Bar */}
                <div
                  className="absolute left-0 top-0 h-full bg-green-500/20 rounded"
                  style={{ width: `${getDepthPercentage(order.amount, maxBuyAmount)}%` }}
                />

                <span className="text-green-400 relative z-10">{formatPrice(order.price)}</span>
                <span className="text-[#a0a0a0] relative z-10">{formatAmount(order.amount)}</span>
                <span className="text-[#a0a0a0] relative z-10">{formatAmount(order.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-[#1a1a1a]/90 flex items-center justify-center rounded-xl">
          <div className="flex items-center space-x-2 text-white">
            <RefreshCw className="w-5 h-5 animate-spin text-[#d8e9ea]" />
            <span>Loading order book...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderBook;
