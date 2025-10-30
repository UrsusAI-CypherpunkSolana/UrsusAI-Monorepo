import { useState, useEffect, useCallback, useRef } from 'react';
import priceTrackingService, { PriceUpdate, TradingEvent, PriceHistoryPoint } from '../services/priceTracking';

export interface PriceTrackingState {
  currentPrice: string;
  marketCap: string;
  volume24h: string;
  priceChange24h: number;
  priceHistory: PriceHistoryPoint[];
  recentTrades: TradingEvent[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
}

export const usePriceTracking = (tokenAddress?: string) => {
  const [state, setState] = useState<PriceTrackingState>({
    currentPrice: '0',
    marketCap: '0',
    volume24h: '0',
    priceChange24h: 0,
    priceHistory: [],
    recentTrades: [],
    isLoading: false,
    error: null,
    lastUpdate: 0
  });

  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // Handle price updates
  const handlePriceUpdate = useCallback((update: PriceUpdate) => {
    setState(prev => ({
      ...prev,
      currentPrice: update.price,
      marketCap: update.marketCap,
      volume24h: update.volume24h,
      priceChange24h: update.priceChange24h,
      lastUpdate: update.timestamp,
      error: null
    }));
  }, []);

  // Handle trading events
  const handleTradingEvent = useCallback((event: TradingEvent) => {
    setState(prev => ({
      ...prev,
      recentTrades: [event, ...prev.recentTrades.slice(0, 49)] // Keep last 50 trades
    }));
  }, []);

  // Fetch initial data
  const fetchInitialData = useCallback(async (address: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [currentPrice, priceHistory, tradingHistory] = await Promise.all([
        priceTrackingService.getCurrentPrice(address),
        priceTrackingService.getPriceHistory(address),
        priceTrackingService.getTradingHistory(address)
      ]);

      setState(prev => ({
        ...prev,
        currentPrice: currentPrice?.price || '0',
        marketCap: currentPrice?.marketCap || '0',
        volume24h: currentPrice?.volume24h || '0',
        priceChange24h: currentPrice?.priceChange24h || 0,
        priceHistory,
        recentTrades: tradingHistory,
        lastUpdate: currentPrice?.timestamp || Date.now(),
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch price data'
      }));
    }
  }, []);

  // Subscribe to real-time updates
  const subscribeToUpdates = useCallback((address: string) => {
    // Subscribe to price updates
    const priceUnsubscribe = priceTrackingService.subscribeToPriceUpdates(
      address,
      handlePriceUpdate
    );

    // Subscribe to trading events
    const tradingUnsubscribe = priceTrackingService.subscribeToTradingEvents(
      address,
      handleTradingEvent
    );

    unsubscribeRefs.current = [priceUnsubscribe, tradingUnsubscribe];
  }, [handlePriceUpdate, handleTradingEvent]);

  // Unsubscribe from updates
  const unsubscribeFromUpdates = useCallback(() => {
    unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
    unsubscribeRefs.current = [];
  }, []);

  // Refresh price history
  const refreshPriceHistory = useCallback(async (
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit = 100
  ) => {
    if (!tokenAddress) return;

    try {
      const priceHistory = await priceTrackingService.getPriceHistory(
        tokenAddress,
        interval,
        limit
      );
      
      setState(prev => ({ ...prev, priceHistory }));
    } catch (error) {
      console.error('Error refreshing price history:', error);
    }
  }, [tokenAddress]);

  // Refresh trading history
  const refreshTradingHistory = useCallback(async (limit = 50) => {
    if (!tokenAddress) return;

    try {
      const tradingHistory = await priceTrackingService.getTradingHistory(
        tokenAddress,
        limit
      );
      
      setState(prev => ({ ...prev, recentTrades: tradingHistory }));
    } catch (error) {
      console.error('Error refreshing trading history:', error);
    }
  }, [tokenAddress]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Setup subscriptions when tokenAddress changes
  useEffect(() => {
    if (tokenAddress) {
      fetchInitialData(tokenAddress);
      subscribeToUpdates(tokenAddress);
    }

    return () => {
      unsubscribeFromUpdates();
    };
  }, [tokenAddress, fetchInitialData, subscribeToUpdates, unsubscribeFromUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromUpdates();
    };
  }, [unsubscribeFromUpdates]);

  return {
    // State
    ...state,

    // Actions
    refreshPriceHistory,
    refreshTradingHistory,
    clearError,

    // Computed values
    isConnected: state.lastUpdate > 0,
    priceChangeDirection: state.priceChange24h > 0 ? 'up' : state.priceChange24h < 0 ? 'down' : 'neutral',
    formattedPriceChange: `${state.priceChange24h > 0 ? '+' : ''}${state.priceChange24h.toFixed(2)}%`
  };
};

export default usePriceTracking;
