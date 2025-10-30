/**
 * URSUS Real-Time Price Tracking Service
 * Tracks agent token prices using blockchain events and backend API
 */

import { ethers } from 'ethers';
import { apiService } from './api';
import bondingCurveService, { AGENT_TOKEN_ABI } from './bondingCurve';

export interface PriceUpdate {
  tokenAddress: string;
  price: string;
  marketCap: string;
  volume24h: string;
  priceChange24h: number;
  timestamp: number;
  source: 'blockchain' | 'api' | 'websocket';
}

export interface PriceHistoryPoint {
  timestamp: number;
  price: string;
  volume: string;
  marketCap: string;
}

export interface TradingEvent {
  id: string;
  tokenAddress: string;
  type: 'buy' | 'sell';
  user: string;
  coreAmount: string;
  tokenAmount: string;
  price: string;
  timestamp: number;
  transactionHash: string;
}

class PriceTrackingService {
  private provider: ethers.Provider | null = null;
  private eventListeners: Map<string, ethers.Contract> = new Map();
  private priceSubscriptions: Map<string, Set<(update: PriceUpdate) => void>> = new Map();
  private tradingSubscriptions: Map<string, Set<(event: TradingEvent) => void>> = new Map();
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.initializeProvider();
    this.initializeWebSocket();
  }

  private async initializeProvider() {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        console.log('✅ Price tracking provider initialized');
      }
    } catch (error) {
      console.error('❌ Failed to initialize price tracking provider:', error);
    }
  }

  private initializeWebSocket() {
    try {
      const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        console.log('✅ Price tracking WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Subscribe to price updates
        this.websocket?.send(JSON.stringify({
          type: 'subscribe',
          channel: 'price-updates'
        }));
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.websocket.onclose = () => {
        console.log('🔌 Price tracking WebSocket disconnected');
        this.handleWebSocketReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('❌ Price tracking WebSocket error:', error);
      };
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
    }
  }

  private handleWebSocketReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`🔄 Attempting WebSocket reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.initializeWebSocket();
      }, delay);
    } else {
      console.error('❌ Max WebSocket reconnection attempts reached');
    }
  }

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'price-update':
        this.handlePriceUpdate(data.payload);
        break;
      case 'trading-event':
        this.handleTradingEvent(data.payload);
        break;
      default:
        console.log('📨 Unknown WebSocket message type:', data.type);
    }
  }

  private handlePriceUpdate(update: PriceUpdate) {
    const subscribers = this.priceSubscriptions.get(update.tokenAddress);
    if (subscribers) {
      subscribers.forEach(callback => callback(update));
    }

    // Also notify global price subscribers
    const globalSubscribers = this.priceSubscriptions.get('*');
    if (globalSubscribers) {
      globalSubscribers.forEach(callback => callback(update));
    }
  }

  private handleTradingEvent(event: TradingEvent) {
    const subscribers = this.tradingSubscriptions.get(event.tokenAddress);
    if (subscribers) {
      subscribers.forEach(callback => callback(event));
    }

    // Also notify global trading subscribers
    const globalSubscribers = this.tradingSubscriptions.get('*');
    if (globalSubscribers) {
      globalSubscribers.forEach(callback => callback(event));
    }
  }

  /**
   * Subscribe to price updates for a specific token
   */
  subscribeToPriceUpdates(
    tokenAddress: string,
    callback: (update: PriceUpdate) => void
  ): () => void {
    if (!this.priceSubscriptions.has(tokenAddress)) {
      this.priceSubscriptions.set(tokenAddress, new Set());
    }
    
    this.priceSubscriptions.get(tokenAddress)!.add(callback);
    
    // Start blockchain event listening for this token
    this.startBlockchainEventListening(tokenAddress);

    // Return unsubscribe function
    return () => {
      const subscribers = this.priceSubscriptions.get(tokenAddress);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.priceSubscriptions.delete(tokenAddress);
          this.stopBlockchainEventListening(tokenAddress);
        }
      }
    };
  }

  /**
   * Subscribe to trading events for a specific token
   */
  subscribeToTradingEvents(
    tokenAddress: string,
    callback: (event: TradingEvent) => void
  ): () => void {
    if (!this.tradingSubscriptions.has(tokenAddress)) {
      this.tradingSubscriptions.set(tokenAddress, new Set());
    }
    
    this.tradingSubscriptions.get(tokenAddress)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = this.tradingSubscriptions.get(tokenAddress);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.tradingSubscriptions.delete(tokenAddress);
        }
      }
    };
  }

  /**
   * Start listening to blockchain events for a token
   */
  private async startBlockchainEventListening(tokenAddress: string) {
    if (!this.provider || this.eventListeners.has(tokenAddress)) {
      return;
    }

    try {
      const contract = new ethers.Contract(tokenAddress, AGENT_TOKEN_ABI, this.provider);
      
      // Listen to TokensPurchased events
      contract.on('TokensPurchased', async (buyer, coreAmount, tokensReceived, event) => {
        try {
          const price = await bondingCurveService.getCurrentPrice(tokenAddress);
          const tokenInfo = await bondingCurveService.getTokenInfo(tokenAddress);
          
          const priceUpdate: PriceUpdate = {
            tokenAddress,
            price,
            marketCap: tokenInfo.marketCap,
            volume24h: '0', // Will be calculated by backend
            priceChange24h: 0, // Will be calculated by backend
            timestamp: Date.now(),
            source: 'blockchain'
          };

          const tradingEvent: TradingEvent = {
            id: `${event.transactionHash}-${event.logIndex}`,
            tokenAddress,
            type: 'buy',
            user: buyer,
            coreAmount: ethers.formatEther(coreAmount),
            tokenAmount: ethers.formatEther(tokensReceived),
            price,
            timestamp: Date.now(),
            transactionHash: event.transactionHash
          };

          this.handlePriceUpdate(priceUpdate);
          this.handleTradingEvent(tradingEvent);
        } catch (error) {
          console.error('❌ Error processing TokensPurchased event:', error);
        }
      });

      // Listen to TokensSold events
      contract.on('TokensSold', async (seller, tokensAmount, coreReceived, event) => {
        try {
          const price = await bondingCurveService.getCurrentPrice(tokenAddress);
          const tokenInfo = await bondingCurveService.getTokenInfo(tokenAddress);
          
          const priceUpdate: PriceUpdate = {
            tokenAddress,
            price,
            marketCap: tokenInfo.marketCap,
            volume24h: '0', // Will be calculated by backend
            priceChange24h: 0, // Will be calculated by backend
            timestamp: Date.now(),
            source: 'blockchain'
          };

          const tradingEvent: TradingEvent = {
            id: `${event.transactionHash}-${event.logIndex}`,
            tokenAddress,
            type: 'sell',
            user: seller,
            coreAmount: ethers.formatEther(coreReceived),
            tokenAmount: ethers.formatEther(tokensAmount),
            price,
            timestamp: Date.now(),
            transactionHash: event.transactionHash
          };

          this.handlePriceUpdate(priceUpdate);
          this.handleTradingEvent(tradingEvent);
        } catch (error) {
          console.error('❌ Error processing TokensSold event:', error);
        }
      });

      this.eventListeners.set(tokenAddress, contract);
      console.log(`✅ Started blockchain event listening for ${tokenAddress}`);
    } catch (error) {
      console.error(`❌ Failed to start blockchain event listening for ${tokenAddress}:`, error);
    }
  }

  /**
   * Stop listening to blockchain events for a token
   */
  private stopBlockchainEventListening(tokenAddress: string) {
    const contract = this.eventListeners.get(tokenAddress);
    if (contract) {
      contract.removeAllListeners();
      this.eventListeners.delete(tokenAddress);
      console.log(`🛑 Stopped blockchain event listening for ${tokenAddress}`);
    }
  }

  /**
   * Get current price from multiple sources
   */
  async getCurrentPrice(tokenAddress: string): Promise<PriceUpdate | null> {
    try {
      // Try blockchain first (most accurate)
      const price = await bondingCurveService.getCurrentPrice(tokenAddress);
      const tokenInfo = await bondingCurveService.getTokenInfo(tokenAddress);
      
      return {
        tokenAddress,
        price,
        marketCap: tokenInfo.marketCap,
        volume24h: '0',
        priceChange24h: 0,
        timestamp: Date.now(),
        source: 'blockchain'
      };
    } catch (error) {
      console.error('❌ Error getting current price from blockchain:', error);
      
      // Fallback to API
      try {
        const response = await apiService.get<{ price: string; marketCap: string; volume24h: string; priceChange24h: number }>(`/agents/${tokenAddress}/price`);
        const { price, marketCap, volume24h, priceChange24h } = response.data;
        return {
          tokenAddress,
          price,
          marketCap,
          volume24h,
          priceChange24h,
          timestamp: Date.now(),
          source: 'api'
        };
      } catch (apiError) {
        console.error('❌ Error getting current price from API:', apiError);
        return null;
      }
    }
  }

  /**
   * Get price history for a token
   */
  async getPriceHistory(
    tokenAddress: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit = 100
  ): Promise<PriceHistoryPoint[]> {
    try {
      const response = await apiService.get<{ priceHistory: PriceHistoryPoint[] }>(
        `/agents/${tokenAddress}/price-history?interval=${interval}&limit=${limit}`
      );
      return response.data.priceHistory || [];
    } catch (error) {
      console.error('❌ Error getting price history:', error);
      return [];
    }
  }

  /**
   * Get trading history for a token
   */
  async getTradingHistory(tokenAddress: string, limit = 50): Promise<TradingEvent[]> {
    try {
      const response = await apiService.get<{ trades: TradingEvent[] }>(`/agents/${tokenAddress}/trades?limit=${limit}`);
      return response.data.trades || [];
    } catch (error) {
      console.error('❌ Error getting trading history:', error);
      return [];
    }
  }

  /**
   * Cleanup all subscriptions and connections
   */
  cleanup() {
    // Stop all blockchain event listeners
    this.eventListeners.forEach((_, tokenAddress) => {
      this.stopBlockchainEventListening(tokenAddress);
    });

    // Close WebSocket connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    // Clear all subscriptions
    this.priceSubscriptions.clear();
    this.tradingSubscriptions.clear();

    console.log('🧹 Price tracking service cleaned up');
  }
}

// Create singleton instance
export const priceTrackingService = new PriceTrackingService();
export default priceTrackingService;
