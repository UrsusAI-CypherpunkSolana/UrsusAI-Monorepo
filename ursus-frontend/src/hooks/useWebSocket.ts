import { useEffect, useState, useCallback, useRef } from 'react';
import websocketService, { WebSocketMessage, PriceUpdate, TradeEvent, AgentInteraction } from '../services/websocket';

// WebSocket event types
interface WebSocketCloseEvent {
  code: number;
  reason: string;
  wasClean: boolean;
}

interface WebSocketErrorEvent {
  message?: string;
  error?: Error;
}

// Market data types
interface MarketData {
  totalVolume: number;
  totalAgents: number;
  topPerformers: Array<{
    id: string;
    name: string;
    price: number;
    change24h: number;
  }>;
  recentTrades: Array<{
    id: string;
    agentId: string;
    price: number;
    volume: number;
    timestamp: string;
  }>;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: Date;
  agentAddress?: string;
  data?: {
    creator?: string;
    name?: string;
    coreAmount?: string;
    marketCap?: string;
    agentAddress?: string;
    [key: string]: unknown;
  };
}



interface MarketUpdateData {
  type: string;
  data?: {
    totalVolume24h?: string;
    totalAgents?: number;
    topPerformers?: Array<{
      address: string;
      name: string;
      symbol: string;
      price: string;
      change24h: string;
      volume24h: string;
    }>;
    recentTrades?: Array<{
      agentAddress: string;
      type: string;
      amount: string;
      price: string;
      timestamp: string;
    }>;
  };
  channel?: string;
}

interface TradeUpdateData {
  type: string;
  agentAddress: string;
  trade: {
    type: string;
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

interface AgentCreatedEventData {
  type: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  creator: string;
  description?: string;
  category?: string;
}

// Agent stats types
interface AgentStats {
  price: number;
  volume: number;
  marketCap: number;
  holders: number;
  priceChange24h: number;
}

interface AgentUpdateData {
  agentAddress: string;
  price?: number;
  volume?: number;
  marketCap?: number;
  holders?: number;
  priceChange24h?: number;
}

export interface AgentEvent {
  agentAddress: string;
  type: string;
  data: unknown;
  timestamp: string;
}

export interface WebSocketState {
  isConnected: boolean;
  connectionState: string;
  clientId: string | null;
  lastMessage: WebSocketMessage | null;
  error: string | null;
}

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  subscriptions?: string[];
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { subscriptions = [] } = options;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionState: 'disconnected',
    clientId: null,
    lastMessage: null,
    error: null
  });

  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Update connection state
  const updateConnectionState = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: websocketService.isConnected(),
      connectionState: websocketService.getConnectionState()
    }));
  }, []);

  // Handle connection events
  useEffect(() => {
    const handleConnected = () => {
      updateConnectionState();
      setState(prev => ({ ...prev, error: null }));
    };

    const handleDisconnected = (event: WebSocketCloseEvent) => {
      updateConnectionState();
      if (event.code !== 1000) { // Not a clean disconnect
        setState(prev => ({ ...prev, error: `Connection lost: ${event.reason}` }));
      }
    };

    const handleConnecting = () => {
      console.log('🔌 WebSocket connecting in useWebSocket hook');
      setState(prev => ({ ...prev, connectionState: 'connecting' }));
    };

    const handleError = (error: WebSocketErrorEvent) => {
      console.error('❌ WebSocket error in useWebSocket hook:', error);
      const errorMessage = error.message || error.error?.message || 'WebSocket error occurred';
      setState(prev => ({ ...prev, error: errorMessage }));
    };

    const handleConnectionFailed = (data: { attempts: number; lastError?: Error }) => {
      console.error('❌ WebSocket connection failed after max attempts:', data);
      setState(prev => ({
        ...prev,
        connectionState: 'error',
        error: `Connection failed after ${data.attempts} attempts`
      }));
    };

    const handleMessage = (message: WebSocketMessage) => {
      setState(prev => ({ ...prev, lastMessage: message }));
    };

    websocketService.on('connected', handleConnected);
    websocketService.on('disconnected', handleDisconnected);
    websocketService.on('connecting', handleConnecting);
    websocketService.on('error', handleError);
    websocketService.on('connectionFailed', handleConnectionFailed);
    websocketService.on('message', handleMessage);

    // Initial state update
    updateConnectionState();

    // Auto-connect if not connected
    if (!websocketService.isConnected()) {
      console.log('🔌 Auto-connecting WebSocket from useWebSocket hook...');
      // Force connection attempt
      setTimeout(() => {
        websocketService.forceConnect();
      }, 100);
    }

    return () => {
      websocketService.off('connected', handleConnected);
      websocketService.off('disconnected', handleDisconnected);
      websocketService.off('connecting', handleConnecting);
      websocketService.off('error', handleError);
      websocketService.off('connectionFailed', handleConnectionFailed);
      websocketService.off('message', handleMessage);
    };
  }, [updateConnectionState]);

  // Handle subscriptions
  useEffect(() => {
    const currentSubscriptions = subscriptionsRef.current;
    const newSubscriptions = new Set(subscriptions);

    // Unsubscribe from removed subscriptions
    for (const subscription of currentSubscriptions) {
      if (!newSubscriptions.has(subscription)) {
        websocketService.unsubscribe(subscription);
      }
    }

    // Subscribe to new subscriptions
    for (const subscription of newSubscriptions) {
      if (!currentSubscriptions.has(subscription)) {
        websocketService.subscribe(subscription);
      }
    }

    subscriptionsRef.current = newSubscriptions;
  }, [subscriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all subscriptions when component unmounts
      for (const subscription of subscriptionsRef.current) {
        websocketService.unsubscribe(subscription);
      }
      subscriptionsRef.current.clear();
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    websocketService.subscribe(channel);
    subscriptionsRef.current.add(channel);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    websocketService.unsubscribe(channel);
    subscriptionsRef.current.delete(channel);
  }, []);

  const send = useCallback((message: Partial<WebSocketMessage>) => {
    websocketService.send(message);
  }, []);

  const reconnect = useCallback(() => {
    websocketService.reconnect();
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    send,
    reconnect,
    websocketService
  };
}

// Specialized hooks for different data types
export function usePriceUpdates(agentAddress?: string) {
  const [priceData, setPriceData] = useState<PriceUpdate | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceUpdate[]>([]);

  useEffect(() => {
    const handlePriceUpdate = (update: PriceUpdate) => {
      if (!agentAddress || update.agentAddress === agentAddress) {
        setPriceData(update);
        setPriceHistory(prev => [...prev.slice(-99), update]); // Keep last 100 updates
      }
    };

    websocketService.on('priceUpdate', handlePriceUpdate);

    // Subscribe to agent if specified
    if (agentAddress) {
      websocketService.subscribeToAgent(agentAddress);
    }

    return () => {
      websocketService.off('priceUpdate', handlePriceUpdate);
      if (agentAddress) {
        websocketService.unsubscribeFromAgent(agentAddress);
      }
    };
  }, [agentAddress]);

  return { priceData, priceHistory };
}

export function useTradeEvents(agentAddress?: string) {
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [latestTrade, setLatestTrade] = useState<TradeEvent | null>(null);

  useEffect(() => {
    const handleTradeEvent = (trade: TradeEvent) => {
      if (!agentAddress || trade.agentAddress === agentAddress) {
        setLatestTrade(trade);
        setTrades(prev => [trade, ...prev.slice(0, 49)]); // Keep last 50 trades
      }
    };

    websocketService.on('tradeEvent', handleTradeEvent);

    // Subscribe to agent if specified
    if (agentAddress) {
      websocketService.subscribeToAgent(agentAddress);
    }

    return () => {
      websocketService.off('tradeEvent', handleTradeEvent);
      if (agentAddress) {
        websocketService.unsubscribeFromAgent(agentAddress);
      }
    };
  }, [agentAddress]);

  return { trades, latestTrade };
}

export function useAgentInteractions(agentAddress: string) {
  const [interactions, setInteractions] = useState<AgentInteraction[]>([]);
  const [latestInteraction, setLatestInteraction] = useState<AgentInteraction | null>(null);

  useEffect(() => {
    const handleAgentInteraction = (interaction: AgentInteraction) => {
      if (interaction.agentAddress === agentAddress) {
        setLatestInteraction(interaction);
        setInteractions(prev => [interaction, ...prev.slice(0, 99)]); // Keep last 100 interactions
      }
    };

    websocketService.on('agentInteraction', handleAgentInteraction);
    websocketService.subscribeToAgent(agentAddress);

    return () => {
      websocketService.off('agentInteraction', handleAgentInteraction);
      websocketService.unsubscribeFromAgent(agentAddress);
    };
  }, [agentAddress]);

  return { interactions, latestInteraction };
}

export function useMarketData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    console.log('🔌 Initializing real-time market data connection...');
    setIsLoading(true);
    setError(null);

    // Subscribe to market data updates
    const handleMarketUpdate = (data: MarketUpdateData) => {
      console.log('📊 Received market data update:', data);

      if (data.type === 'marketData' && data.data) {
        setMarketData({
          totalVolume: parseFloat(data.data.totalVolume24h || '0') || 0,
          totalAgents: data.data.totalAgents || 0,
          topPerformers: (data.data.topPerformers || []).map(performer => ({
            id: performer.address,
            name: performer.name,
            price: parseFloat(performer.price) || 0,
            change24h: parseFloat(performer.change24h) || 0
          })),
          recentTrades: (data.data.recentTrades || []).map((trade, index) => ({
            id: `${trade.agentAddress}-${index}-${Date.now()}`,
            agentId: trade.agentAddress,
            price: parseFloat(trade.price) || 0,
            volume: parseFloat(trade.amount) || 0,
            timestamp: trade.timestamp
          }))
        });
        setLastUpdate(new Date());
        setIsLoading(false);
      } else if (data.type === 'initialData' && data.channel === 'platform' && data.data) {
        setMarketData({
          totalVolume: parseFloat(data.data.totalVolume24h || '0') || 0,
          totalAgents: data.data.totalAgents || 0,
          topPerformers: [],
          recentTrades: (data.data.recentTrades || []).map((trade, index) => ({
            id: `${trade.agentAddress}-${index}-${Date.now()}`,
            agentId: trade.agentAddress,
            price: parseFloat(trade.price) || 0,
            volume: parseFloat(trade.amount) || 0,
            timestamp: trade.timestamp
          }))
        });
        setLastUpdate(new Date());
        setIsLoading(false);
      }
    };

    const handleTradeUpdate = (data: TradeUpdateData) => {
      if (data.type === 'tradeUpdate') {
        console.log('💰 Received trade update:', data);

        // Add to recent trades
        setMarketData(prev => {
          if (!prev) return prev;

          const newTrade = {
            id: data.trade.txHash || `${Date.now()}-${Math.random()}`,
            agentId: data.agentAddress,
            price: parseFloat(data.trade.price) || 0,
            volume: parseFloat(data.trade.amount) || 0,
            timestamp: data.trade.timestamp || new Date().toISOString()
          };

          const updatedTrades = [newTrade, ...prev.recentTrades.slice(0, 19)]; // Keep last 20

          return {
            ...prev,
            recentTrades: updatedTrades,
            totalVolume: prev.totalVolume + (newTrade.price * newTrade.volume)
          };
        });

        setLastUpdate(new Date());
      }
    };

    const handleAgentCreated = (data: AgentCreatedEventData | any) => {
      // Accept event regardless of explicit type flag and normalize fields
      const addr = data?.agentAddress || data?.address || data?.tokenAddress;
      const name = data?.name || data?.tokenName || 'New Agent';
      const symbol = data?.symbol || data?.tokenSymbol || '';

      console.log('🆕 New agent created:', { addr, name, symbol, raw: data });

      // Duplicate prevention for toast notifications
      const agentKey = addr || name;
      const recentToastKey = `ws-toast-${agentKey}`;
      const lastToastTime = sessionStorage.getItem(recentToastKey);
      const now = Date.now();

      // Only show toast if we haven't shown one for this agent in the last 15 seconds
      if (!lastToastTime || (now - parseInt(lastToastTime)) > 15000) {
        try {
          const evt = new CustomEvent('ursus:toast', {
            detail: {
              type: 'success',
              title: 'New Agent',
              message: `${name}${symbol ? ` (${symbol})` : ''} is live`,
              actionLabel: addr ? 'View agent' : undefined,
              actionHref: addr ? `/agent/${addr}` : undefined,
            }
          });
          window.dispatchEvent(evt);

          // Remember that we showed this toast
          sessionStorage.setItem(recentToastKey, now.toString());
        } catch {}
      }


      setMarketData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          totalAgents: (prev.totalAgents || 0) + 1
        };
      });

      // Add notification with duplicate prevention
      setNotifications(prev => {
        // Check for duplicate agent creation notifications
        const isDuplicate = prev.some(notification =>
          notification.type === 'agentCreated' &&
          notification.agentAddress === addr &&
          Math.abs(new Date().getTime() - new Date(notification.timestamp).getTime()) < 10000 // Within 10 seconds
        );

        if (isDuplicate) {
          return prev; // Don't add duplicate
        }

        return [{
          id: `agent-${addr}-${Date.now()}`,
          type: 'agentCreated',
          title: 'New Agent Created',
          message: `${name}${symbol ? ` (${symbol})` : ''} has been deployed`,
          timestamp: new Date(),
          agentAddress: addr
        }, ...prev.slice(0, 9)];
      });

      setLastUpdate(new Date());
    };

    const handleConnectionError = (error: Error | string) => {
      console.error('❌ Market data connection error:', error);
      setError('Failed to connect to real-time market data');
      setIsLoading(false);
    };

    const handleConnectionSuccess = () => {
      console.log('✅ Market data connection established');
      setError(null);

      // Request initial market data
      websocketService.send({
        type: 'getMarketData',
        options: {
          includeTopPerformers: true,
          includeRecentTrades: true,
          limit: 20
        }
      });
    };

    // Set up WebSocket event listeners
    websocketService.on('marketUpdate', handleMarketUpdate);
    websocketService.on('marketData', handleMarketUpdate);
    websocketService.on('initialData', handleMarketUpdate);
    websocketService.on('tradeUpdate', handleTradeUpdate);
    websocketService.on('tokensPurchased', handleTradeUpdate);
    websocketService.on('tokensSold', handleTradeUpdate);
    websocketService.on('agentCreated', handleAgentCreated);
    // Force a platform refetch on agentCreated by emitting a unified message
    websocketService.on('agentCreated', (evt: any) => handleAgentCreated(evt));
    websocketService.on('error', handleConnectionError);
    websocketService.on('connected', handleConnectionSuccess);

    // Subscribe to platform-wide updates
    websocketService.subscribe('platform');
    websocketService.subscribe('market');

    // Initial connection check
    if (websocketService.isConnected()) {
      handleConnectionSuccess();
    } else {
      // Wait for connection
      const connectionTimer = setTimeout(() => {
        if (!websocketService.isConnected()) {
          setError('Connection timeout - please refresh the page');
          setIsLoading(false);
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(connectionTimer);
    }

    return () => {
      console.log('🔌 Cleaning up market data subscriptions...');

      // Remove event listeners
      websocketService.off('marketUpdate', handleMarketUpdate);
      websocketService.off('marketData', handleMarketUpdate);
      websocketService.off('initialData', handleMarketUpdate);
      websocketService.off('tradeUpdate', handleTradeUpdate);
      websocketService.off('tokensPurchased', handleTradeUpdate);
      websocketService.off('tokensSold', handleTradeUpdate);
      websocketService.off('agentCreated', handleAgentCreated);
      websocketService.off('error', handleConnectionError);
      websocketService.off('connected', handleConnectionSuccess);

      // Unsubscribe from channels
      websocketService.unsubscribe('platform');
      websocketService.unsubscribe('market');
    };
  }, []);

  // Refresh market data manually
  const refreshMarketData = useCallback(() => {
    console.log('🔄 Manually refreshing market data...');
    setIsLoading(true);
    setError(null);

    websocketService.send({
      type: 'getMarketData',
      options: {
        includeTopPerformers: true,
        includeRecentTrades: true,
        limit: 20
      }
    });
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Remove specific notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    // Market data
    marketData,
    notifications,
    isLoading,
    error,
    lastUpdate,
    refreshMarketData,
    clearNotifications,
    removeNotification,

    // Connection status from WebSocket service
    connectionStatus: websocketService.getConnectionState(),
    isConnecting: websocketService.getConnectionState() === 'connecting',
    hasError: !!error || websocketService.getConnectionState() === 'error',
    isConnected: websocketService.isConnected(),

    // WebSocket service methods
    subscribe: websocketService.subscribe.bind(websocketService),
    unsubscribe: websocketService.unsubscribe.bind(websocketService),
    send: websocketService.send.bind(websocketService),
    reconnect: websocketService.reconnect.bind(websocketService),
    websocketService
  };
}

// Agent-specific realtime data hook
export const useAgentRealtime = (agentAddress: string) => {
  const [agentStats, setAgentStats] = useState<AgentStats>({
    price: 0,
    marketCap: 0,
    volume: 0,
    holders: 0,
    priceChange24h: 0
  });
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);

  useEffect(() => {
    if (!agentAddress) return;

    const handleAgentUpdate = (data: AgentUpdateData) => {
      if (data.agentAddress === agentAddress) {
        setAgentStats(prev => ({
          ...prev,
          price: data.price ?? prev.price,
          marketCap: data.marketCap ?? prev.marketCap,
          volume: data.volume ?? prev.volume,
          holders: data.holders ?? prev.holders,
          priceChange24h: data.priceChange24h ?? prev.priceChange24h
        }));
      }
    };

    const handleAgentEvent = (data: AgentEvent) => {
      if (data.agentAddress === agentAddress) {
        setRecentEvents(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 events
      }
    };

    websocketService.on('agentUpdate', handleAgentUpdate);
    websocketService.on('agentEvent', handleAgentEvent);
    websocketService.subscribeToAgent(agentAddress);

    return () => {
      websocketService.off('agentUpdate', handleAgentUpdate);
      websocketService.off('agentEvent', handleAgentEvent);
      websocketService.unsubscribeFromAgent(agentAddress);
    };
  }, [agentAddress]);

  return { agentStats, recentEvents };
};

export default useWebSocket;
