import { useState, useEffect, useCallback, useRef } from 'react';
import { useTradeEvents } from './useWebSocket';
import { apiService } from '../services/api';
import websocketService from '../services/websocket';

export interface CandleData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap?: number | null;          
  direction?: 'up' | 'down';
}
export interface TradeData {
  timestamp: number;
  price: number;
  amount: number;
  type: 'buy' | 'sell';
  transactionHash: string;
}

export interface ChartDataState {
  candles: CandleData[];
  trades: TradeData[];
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isRealTime: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  livePrice: number | null;
  onChainPrice: number | null;
  priceChange24h: number | null;
}

export interface ChartOptions {
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  limit: number;
  autoUpdate: boolean;
  enableRealTime: boolean;
}

interface RealTimeTradeUpdate {
  type: string;
  agentAddress: string;
  trade: {
    type: 'buy' | 'sell';
    amount: string;
    price: string;
    timestamp: string;
    trader: string;
    txHash?: string;
  };
  agent?: {
    currentPrice?: string;
    marketCap?: string;
    volume24h?: string;
    priceChange24h?: string;
  };
}

interface CandleApiData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  marketCap?: number | string | null;
}

interface TradeApiData {
  timestamp: string | number | Date;
  price: string | number;
  coreAmount?: string | number;
  tokenAmount?: string | number;
  type: 'buy' | 'sell';
  transactionHash: string;
}

interface CandleMetadata {
  interval: string;
  limit: number;
  count: number;
  agentAddress: string;
  totalTrades?: number;
}

interface TradeMetadata {
  interval: string;
  limit: number;
  totalTrades: number;
  agentAddress: string;
}

const normalizeWsTrade = (msg: any) => {
  const agent = (msg.agentAddress || msg.tokenAddress || '').toLowerCase();
  const t = msg.trade || {};
  return {
    agentAddress: agent,
    trade: {
      type: t.type as 'buy' | 'sell',
      amount: String(t.tokenAmount ?? t.amount ?? '0'),
      price: String(t.price ?? '0'),
      timestamp: String(t.timestamp ?? msg.timestamp ?? new Date().toISOString()),
      trader: String(t.trader ?? t.user ?? ''),
      txHash: String(t.txHash ?? t.transactionHash ?? msg.transactionHash ?? '')
    }
  };
};


export const useChartData = (
  agentAddress: string,
  options: ChartOptions = {
    interval: '1h',
    limit: 100,
    autoUpdate: true,
    enableRealTime: true
  }
) => {
  const [state, setState] = useState<ChartDataState>({
    candles: [],
    trades: [],
    loading: false,
    error: null,
    lastUpdate: null,
    isRealTime: false,
    connectionStatus: 'disconnected',
    livePrice: null,
    onChainPrice: null,
    priceChange24h: null
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { latestTrade } = useTradeEvents(agentAddress);

  const fetchLivePrice = useCallback(async () => {
    if (!agentAddress) return null;
    try {
      console.log(`🔗 Fetching live price via backend for: ${agentAddress}`);
      const res = await apiService.getAgentDetails(agentAddress);
      const p = (res as any)?.data?.data?.currentPrice ?? (res as any)?.data?.currentPrice;
      const priceNum = p != null ? parseFloat(String(p)) : NaN;
      if (!Number.isFinite(priceNum)) return null;
      console.log(`💰 Backend on-chain price (reference): ${priceNum} SOL`);
      return priceNum;
    } catch (error) {
      console.error('❌ Failed to fetch on-chain price via backend:', error);
      return null;
    }
  }, [agentAddress]);

  // Fetch market data from backend API
  const fetchMarketData = useCallback(async () => {
    if (!agentAddress) return null;

    try {
      console.log(`📊 Fetching market data for: ${agentAddress}`);
      const res = await apiService.getAgentDetails(agentAddress);
      const data = (res as any)?.data?.data ?? (res as any)?.data;

      if (!data) return null;

      return {
        currentSupply: parseFloat(data.totalSupply || '0'),
        reserveBalance: parseFloat(data.bondingCurveInfo?.reserve || '0'),
        price: parseFloat(data.currentPrice || '0'),
        marketCap: parseFloat(data.bondingCurveInfo?.marketCap || '0'),
        isGraduated: data.isGraduated || false
      };
    } catch (error) {
      console.error('❌ Failed to fetch market data:', error);
      return null;
    }
  }, [agentAddress]);

  const getIntervalMs = useCallback((interval: string): number => {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[interval] || intervals['1h'];
  }, []);

  const generateCandlesFromTrades = useCallback((trades: TradeData[], interval: string): CandleData[] => {
    if (trades.length === 0) return [];

    const intervalMs = getIntervalMs(interval);
    const candleMap = new Map<number, CandleData>();

    const sortedTrades = trades.sort((a, b) => a.timestamp - b.timestamp);

    sortedTrades.forEach(trade => {
      const candleTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;

      if (!candleMap.has(candleTime)) {
        candleMap.set(candleTime, {
          date: new Date(candleTime),
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.amount
        });
      } else {
        const candle = candleMap.get(candleTime)!;
        candle.high = Math.max(candle.high, trade.price);
        candle.low = Math.min(candle.low, trade.price);
        candle.close = trade.price;
        candle.volume += trade.amount;
      }
    });

    return Array.from(candleMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [getIntervalMs]);

const fetchHistoricalData = useCallback(async () => {
  if (!agentAddress) return;

  setState(prev => ({ ...prev, loading: true, error: null }));

  try {
    console.log(`📊 Fetching real trading history for ${agentAddress}`);
    
    const candleResponse = await apiService.get<{
      success: boolean;
      data: CandleApiData[];
      metadata?: CandleMetadata;
    }>(`/trading/candles/${agentAddress}`, {
      params: {
        interval: options.interval,
        limit: options.limit
      }
    });
    console.log("🟢 Raw candle data:", candleResponse.data?.data?.slice(0, 3));
    let candles: CandleData[] = [];
    const candleArray = candleResponse.data?.data ?? candleResponse.data;

   //let latestMarketCapValue: number | null = null;  // ⬅️ Map öncesi
   const marketData = await fetchMarketData();
 

    if (Array.isArray(candleArray) && candleArray.length > 0) {
      console.log(`✅ Found ${candleArray.length} real candles for ${agentAddress}`);
      candles = candleArray.map((candle: CandleApiData) => {
        const ts = Number(candle.timestamp);
        const open = Number(candle.open) || 0;
        const close = Number(candle.close) || 0;
        const high = Number(candle.high) || 0;
        const low = Number(candle.low) || 0;
        const volume = Number(candle.volume ?? 0);
    
        return {
          date: new Date(ts),
          open,
          high,
          low,
          close,
          volume,
          direction: close >= open ? 'up' : 'down'
        };
      });
    
      // ✅ Market cap'i sadece son muma ekle
      if (marketData && candles.length > 0) {
        candles[candles.length - 1].marketCap = marketData.marketCap;
        console.log("💰 MarketCap injected into last candle:", marketData.marketCap);
      }
    }
    
    const tradesResponse = await apiService.get<{
      success: boolean;
      data: TradeApiData[];
      meta?: TradeMetadata;
    }>(`/trading/history/${agentAddress}`, {
      params: {
        interval: options.interval,
        limit: 50
      }
    });
    console.log("🟢 Raw trade data:", tradesResponse.data?.data?.slice(0, 3));
    let trades: TradeData[] = [];
    if (
      tradesResponse.data?.success &&
      Array.isArray(tradesResponse.data?.data) &&
      tradesResponse.data.data.length > 0
    ) {
      trades = tradesResponse.data.data.map((trade: TradeApiData) => {
        const ts = new Date(trade.timestamp).getTime();
        const price = Number(trade.price) || 0;
        const amount = trade.coreAmount !== undefined
          ? Number(trade.coreAmount) || 0
          : trade.tokenAmount !== undefined
          ? Number(trade.tokenAmount) || 0
          : 0;
      
        return {
          timestamp: ts,
          price,
          amount,
          type: trade.type, 
          transactionHash: trade.transactionHash,
          direction: trade.type === 'buy' ? 'up' : 'down'
        };
      });
      
    }

    const onChainPrice = await fetchLivePrice();
    const marketPrice =
      candles.length > 0
        ? candles[candles.length - 1].close
        : trades.length > 0
        ? trades[0].price
        : null;

    let priceChange24h: number | null = null;
    if (candles.length >= 2) {
      const latest = candles[candles.length - 1];
      const previous = candles[0];
      priceChange24h =
        previous.close > 0
          ? ((latest.close - previous.close) / previous.close) * 100
          : 0;
    }

    setState(prev => ({
      ...prev,
      candles,
      trades,
      loading: false,
      error:
        candles.length === 0 && trades.length === 0
          ? 'No trading history available yet. Start trading to see chart data.'
          : null,
      lastUpdate: new Date(),
      livePrice: marketPrice ?? null, 
      onChainPrice: onChainPrice ?? null,
      priceChange24h,
      connectionStatus: 'connected',
      marketCap: marketData?.marketCap ?? null
    }));

    if (onChainPrice != null) {
      console.log(`💰 On-chain contract price (reference): ${onChainPrice} SOL`);
    }
    if (marketData) {
      console.log(
        `📊 Market data - Cap: ${marketData.marketCap} SOL, Supply: ${marketData.currentSupply}`
      );
    }

    if (candles.length === 0 && trades.length === 0) {
      console.log(`⚠️ No real trading data found for ${agentAddress}`);
      setState(prev => ({
        ...prev,
        candles: [],
        trades: [],
        loading: false,
        error:
          'No trading history available yet. Start trading to see chart data.',
        lastUpdate: new Date()
      }));
    }
  } catch (error) {
    console.error('❌ Error fetching chart data:', error);
    setState(prev => ({
      ...prev,
      candles: [],
      trades: [],
      loading: false,
      error: 'Failed to load trading data. Please try again.',
      lastUpdate: new Date()
    }));
  }
}, [agentAddress, options.interval, options.limit, fetchLivePrice, fetchMarketData]);

  const updateOnChainPrice = useCallback(async () => {
    if (!agentAddress) return;

    try {
      const onChain = await fetchLivePrice();
      if (onChain !== null) {
        setState(prev => ({
          ...prev,
          onChainPrice: onChain,
          lastUpdate: new Date(),
          connectionStatus: 'connected'
        }));
      }
    } catch (error) {
      console.error('❌ Failed to update on-chain price:', error);
      setState(prev => ({
        ...prev,
        connectionStatus: 'error'
      }));
    }
  }, [agentAddress, fetchLivePrice]);

  const updateWithNewTrade = useCallback((trade: TradeData) => {
    setState(prev => {
      const intervalMs = getIntervalMs(options.interval);
      const candleTime = Math.floor(trade.timestamp / intervalMs) * intervalMs;
      const newCandles = [...prev.candles];
      
      const existingCandleIndex = newCandles.findIndex(
        candle => candle.date.getTime() === candleTime
      );

      if (existingCandleIndex >= 0) {
        const candle = newCandles[existingCandleIndex];
        candle.high = Math.max(candle.high, trade.price);
        candle.low = Math.min(candle.low, trade.price);
        candle.close = trade.price;
        candle.volume += trade.amount;
      } else {
        const newCandle: CandleData = {
          date: new Date(candleTime),
          open: trade.price,
          high: trade.price,
          low: trade.price,
          close: trade.price,
          volume: trade.amount,
        };
        
        newCandles.push(newCandle);
        newCandles.sort((a, b) => a.date.getTime() - b.date.getTime());
        
        if (newCandles.length > options.limit) {
          newCandles.splice(0, newCandles.length - options.limit);
        }
      }

      return {
        ...prev,
        candles: newCandles,
        trades: [trade, ...prev.trades.slice(0, 99)],
        lastUpdate: new Date()
      };
    });
  }, [options.interval, options.limit, getIntervalMs]);

  useEffect(() => {
    if (latestTrade && options.autoUpdate) {
      const tradeData: TradeData = {
        timestamp: new Date(latestTrade.timestamp).getTime(),
        price: parseFloat(latestTrade.price),
        amount: parseFloat(latestTrade.coreAmount),
        type: latestTrade.type,
        transactionHash: latestTrade.transactionHash
      };
      
      updateWithNewTrade(tradeData);
    }
  }, [latestTrade, options.autoUpdate, updateWithNewTrade]);

  useEffect(() => {
    // DISABLED: Auto-update causing infinite loop and performance issues
    // if (options.autoUpdate) {
    //   const refreshInterval = Math.max(getIntervalMs(options.interval) / 5, 60000);
    //   const onChainUpdateInterval = 30000;

    //   intervalRef.current = setInterval(() => {
    //     fetchHistoricalData();
    //   }, refreshInterval);

    //   const onChainIntervalRef = setInterval(() => {
    //     updateOnChainPrice();
    //   }, onChainUpdateInterval);

    //   return () => {
    //     if (intervalRef.current) {
    //       clearInterval(intervalRef.current);
    //     }
    //     clearInterval(onChainIntervalRef);
    //   };
    // }
  }, [options.autoUpdate, options.interval, fetchHistoricalData, getIntervalMs, updateOnChainPrice]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        
      }
    };
  }, []);

  const handleRealTimeTradeUpdate = useCallback((data: RealTimeTradeUpdate) => {
    if (data.agentAddress.toLowerCase() !== agentAddress.toLowerCase()) return;
  
    const newTrade: TradeData = {
      timestamp: new Date(data.trade.timestamp).getTime(),
      price: parseFloat(data.trade.price),
      amount: parseFloat(data.trade.amount),
      type: data.trade.type,
      transactionHash: data.trade.txHash || '' 
    };
  
    if (!newTrade.transactionHash && (data as any)?.trade?.transactionHash) {
      newTrade.transactionHash = (data as any).trade.transactionHash;
    }
  
    setState(prev => {
      const updatedTrades = [newTrade, ...prev.trades.slice(0, options.limit - 1)];
      const updatedCandles = generateCandlesFromTrades(updatedTrades, options.interval);
  
      return {
        ...prev,
        trades: updatedTrades,
        candles: updatedCandles,
        lastUpdate: new Date(),
        livePrice: newTrade.price,
        priceChange24h: data.agent?.priceChange24h ? parseFloat(data.agent.priceChange24h) : prev.priceChange24h
      };
    });
  }, [agentAddress, options.interval, options.limit, generateCandlesFromTrades]);
  
  const handleConnectionStatusChange = useCallback((status: string) => {
    setState(prev => ({
      ...prev,
      connectionStatus: status as ChartDataState['connectionStatus'],
      isRealTime: status === 'connected' && options.enableRealTime
    }));
  }, [options.enableRealTime]);

  useEffect(() => {
    if (!options.enableRealTime || !agentAddress) return;
  
    console.log('🔌 Setting up real-time chart data for agent:', agentAddress);
  
    // ---- handlers
    const handleTradeUpdate = (data: Record<string, unknown>) => {
      if (data.type === 'tradeUpdate') {
        handleRealTimeTradeUpdate(data as unknown as RealTimeTradeUpdate);
      }
    };
  
    const handleTokensPurchased = (data: Record<string, unknown>) => {
      if (data.type === 'tokensPurchased') {
        handleRealTimeTradeUpdate({
          type: 'tradeUpdate',
          agentAddress: (data.agentAddress || data.tokenAddress) as string,
          trade: {
            type: 'buy',
            amount: (data.tokensReceived || data.amount) as string,
            price: (data.price || '0') as string,
            timestamp: (data.timestamp || new Date().toISOString()) as string,
            trader: (data.buyer || data.user) as string,
            txHash: data.transactionHash as string
          }
        });
      }
    };
  
    const handleTokensSold = (data: Record<string, unknown>) => {
      if (data.type === 'tokensSold') {
        handleRealTimeTradeUpdate({
          type: 'tradeUpdate',
          agentAddress: (data.agentAddress || data.tokenAddress) as string,
          trade: {
            type: 'sell',
            amount: (data.tokensAmount || data.amount) as string,
            price: (data.price || '0') as string,
            timestamp: (data.timestamp || new Date().toISOString()) as string,
            trader: (data.seller || data.user) as string,
            txHash: data.transactionHash as string
          }
        });
      }
    };
  
    const handleRealTradeExecuted = (raw: any) => {
      if (!raw || raw.type !== 'realTradeExecuted') return;
      const norm = normalizeWsTrade(raw);
      if (norm.agentAddress !== agentAddress.toLowerCase()) return;
  
      const trade: TradeData = {
        timestamp: new Date(norm.trade.timestamp).getTime(),
        price: parseFloat(norm.trade.price?.toString() || '0'),
        amount: parseFloat(norm.trade.amount?.toString() || '0'),
        type: norm.trade.type,
        transactionHash: norm.trade.txHash || ''
      };      
  
      updateWithNewTrade(trade);
  
      setState(prev => ({
        ...prev,
        livePrice: trade.price,
        isRealTime: true,
        connectionStatus: 'connected',
        lastUpdate: new Date()
      }));
    };
  
    websocketService.on('tradeUpdate', handleTradeUpdate);
    websocketService.on('tokensPurchased', handleTokensPurchased);
    websocketService.on('tokensSold', handleTokensSold);
    websocketService.on('realTradeExecuted', handleRealTradeExecuted);
  
    const agentChannel = `agent:${agentAddress.toLowerCase()}`;
    const tradesChannel = `trades:${agentAddress.toLowerCase()}`;
    websocketService.subscribe(agentChannel);
    websocketService.subscribe(tradesChannel);
  
    handleConnectionStatusChange(
      websocketService.isConnected() ? 'connected' : 'disconnected'
    );

    return () => {
      console.log('🔌 Cleaning up real-time chart subscriptions for agent:', agentAddress);
    
      websocketService.off('tradeUpdate', handleTradeUpdate);
      websocketService.off('tokensPurchased', handleTokensPurchased);
      websocketService.off('tokensSold', handleTokensSold);
      websocketService.off('realTradeExecuted', handleRealTradeExecuted);
    
      websocketService.unsubscribe(agentChannel);
      websocketService.unsubscribe(tradesChannel);
    };
  }, [agentAddress, options.enableRealTime, handleRealTimeTradeUpdate, handleConnectionStatusChange, updateWithNewTrade]);
  
  return {
    ...state,
    refresh: fetchHistoricalData,
    clearError: () => setState(prev => ({ ...prev, error: null })),
    toggleRealTime: useCallback(() => {
      setState(prev => ({ ...prev, isRealTime: !prev.isRealTime }));
    }, []),
    forceReconnect: useCallback(() => {
      if (websocketService.forceReconnect) {
        websocketService.forceReconnect();
      }
    }, [])
  };
};

export default useChartData;