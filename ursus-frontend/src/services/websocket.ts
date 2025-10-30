import { EventEmitter } from 'events';

// Type definitions for WebSocket events
export interface PriceUpdate {
  agentAddress: string;
  price: string;
  marketCap: string;
  volume24h: string;
  priceChange24h: string;
  timestamp: string;
}

export interface TradeEvent {
  agentAddress: string;
  userAddress: string;
  type: 'buy' | 'sell';
  tokenAmount: string;
  coreAmount: string;
  price: string;
  timestamp: string;
  transactionHash: string;
}

export interface AgentInteraction {
  agentAddress: string;
  userAddress: string;
  message: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  data?: Record<string, unknown> | WebSocketMessage[];
  timestamp?: number;
  channel?: string;
  clientId?: string;
  requestId?: string;
  options?: {
    includeTopPerformers?: boolean;
    includeRecentTrades?: boolean;
    limit?: number;
    [key: string]: unknown;
  };
  agentAddress?: string;
  userAddress?: string;
  timeframe?: string;
  metadata?: Record<string, unknown>;
  requests?: Array<Record<string, unknown>>;
  clientTime?: number;
  message?: string;
  sessionId?: string;
}

export interface PriceUpdate {
  agentAddress: string;
  price: string;
  marketCap: string;
  volume24h: string;
  priceChange24h: string;
  timestamp: string;
}

export interface TradeEvent {
  agentAddress: string;
  userAddress: string;
  type: 'buy' | 'sell';
  tokenAmount: string;
  coreAmount: string;
  price: string;
  timestamp: string;
  transactionHash: string;
}

export interface AgentInteraction {
  agentAddress: string;
  userAddress: string;
  message: string;
  response?: string;
  timestamp: string;
}

interface ConnectionConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  messageQueueSize: number;
  compressionEnabled: boolean;
  batchingEnabled: boolean;
  retryBackoffMultiplier: number;
  maxRetryDelay: number;
  persistentConnection: boolean;
  aggressiveReconnect: boolean;
}

interface ConnectionMetrics {
  totalConnections: number;
  reconnections: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  averageLatency: number;
  connectionUptime: number;
  lastConnected: Date | null;
  errors: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
}

interface QueuedMessage {
  message: WebSocketMessage;
  timestamp: number;
  retries: number;
  priority: 'high' | 'medium' | 'low';
}

class WebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private subscriptions = new Set<string>();
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private clientId: string | null = null;
  private connectionStartTime: number | null = null;

  // Advanced connection management
  private config: ConnectionConfig;
  private metrics: ConnectionMetrics;
  private messageQueue: QueuedMessage[] = [];
  private pendingMessages = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timeout: NodeJS.Timeout
  }>();


  // Performance optimization
  private batchTimer: NodeJS.Timeout | null = null;
  private batchedMessages: WebSocketMessage[] = [];

  // Connection state management
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' = 'disconnected';
  private lastPingTime: number = 0;


  constructor(url: string = (typeof window !== 'undefined'
      ? (import.meta.env.VITE_WS_URL
          || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${import.meta.env.VITE_WS_PORT || '3001'}`)
      : 'ws://localhost:3001'),
    config?: Partial<ConnectionConfig>) {
    super();
    console.log(`🔌 WebSocket service constructor called with URL: ${url}`);
    this.url = url;

    // Initialize configuration with persistent connection strategy
    this.config = {
      maxReconnectAttempts: 2, // Only 2 attempts as requested
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      messageQueueSize: 1000,
      compressionEnabled: true,
      batchingEnabled: true,
      retryBackoffMultiplier: 1.5,
      maxRetryDelay: 30000,
      persistentConnection: true, // Keep connection alive
      aggressiveReconnect: false, // Don't aggressively reconnect
      ...config
    };

    // Initialize metrics
    this.metrics = {
      totalConnections: 0,
      reconnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      averageLatency: 0,
      connectionUptime: 0,
      lastConnected: null,
      errors: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0
    };

    // Enhanced auto-connect with retry logic
    this.attemptConnection();

    // Initialize performance optimizations
    this.initializeOptimizations();
  }

  // Intelligent connection attempt with fallback
  private async attemptConnection(retryCount: number = 0): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('🔌 Already connecting or connected, skipping attempt');
      return;
    }

    try {
      console.log(`🔌 Attempting WebSocket connection to ${this.url} (attempt ${retryCount + 1})`);
      this.isConnecting = true;

      await this.connectWithPromise();
      console.log('✅ WebSocket connection established successfully');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    } catch (error) {
      this.isConnecting = false;
      console.warn(`⚠️ Connection attempt ${retryCount + 1} failed:`, error);

      if (retryCount < this.config.maxReconnectAttempts) {
        const delay = Math.min(
          this.config.reconnectDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount),
          this.config.maxRetryDelay
        );

        console.log(`🔄 Retrying connection in ${delay}ms...`);
        setTimeout(() => {
          this.attemptConnection(retryCount + 1);
        }, delay);
      } else {
        console.error('❌ Max connection attempts reached. WebSocket will remain disconnected.');
        this.emit('connectionFailed', {
          attempts: retryCount + 1,
          lastError: error
        });
      }
    }
  }

  // Promise-based connection method
  private connectWithPromise(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      console.log('🔌 Connecting to WebSocket server...');

      try {
        this.ws = new WebSocket(this.url);

        // Set connection timeout
        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            this.isConnecting = false;
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.metrics.totalConnections++;
          this.metrics.lastConnected = new Date();
          this.reconnectAttempts = 0;

          console.log('✅ Professional WebSocket connected successfully');
          this.connectionState = 'connected';

          // Emit connected event with comprehensive data
          this.emit('connected', {
            timestamp: new Date(),
            reconnectAttempts: this.reconnectAttempts,
            totalConnections: this.metrics.totalConnections,
            url: this.url,
            clientId: this.clientId
          });

          this.startHeartbeat();
          this.processMessageQueue();
          this.resubscribeToChannels();

          // Force update connection health
          this.updateMetrics();

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          console.log(`🔌 Professional WebSocket disconnected: ${event.code} - ${event.reason || 'No reason provided'}`);
          this.isConnecting = false;
          this.connectionState = 'disconnected';
          this.stopHeartbeat();
          this.emit('disconnected', {
            code: event.code,
            reason: event.reason,
            timestamp: new Date(),
            wasClean: event.wasClean
          });

          if (this.isConnecting) {
            reject(new Error(`Connection failed: ${event.code} ${event.reason || 'Connection closed'}`));
          } else if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
            console.log(`🔄 Attempting reconnection (${this.reconnectAttempts + 1}/${this.config.maxReconnectAttempts})`);
            this.handleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          this.metrics.errors++;
          this.emit('error', error);

          if (this.isConnecting) {
            reject(error);
          }
        };

      } catch (error) {
        this.isConnecting = false;
        this.metrics.errors++;
        console.error('❌ Failed to create WebSocket connection:', error);
        this.emit('error', error);
        reject(error);
      }
    });
  }

  // Public connect method
  public connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('🔌 Already connecting or connected');
      return;
    }

    console.log('🔌 Starting connection process...');
    this.attemptConnection();
  }



  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId || null;
        console.log('🆔 Client ID:', this.clientId);
        break;

      case 'subscribed':
        console.log('📡 Subscribed to channel:', message.channel);
        break;

      case 'unsubscribed':
        console.log('📡 Unsubscribed from channel:', message.channel);
        break;

      case 'pong':
        // Heartbeat response
        break;

      case 'priceUpdate':
        if (message.data && !Array.isArray(message.data)) {
          this.emit('priceUpdate', message.data as unknown as PriceUpdate);
        }
        break;

      case 'tokensPurchased':
      case 'tokensSold':
        if (message.data && !Array.isArray(message.data)) {
          this.emit('tradeEvent', message.data as unknown as TradeEvent);
          this.emit(message.type, message.data);
        }
        break;

      case 'agentCreated':
        this.emit('agentCreated', message.data);
        break;

      case 'agentInteraction':
        if (message.data && !Array.isArray(message.data)) {
          this.emit('agentInteraction', message.data as unknown as AgentInteraction);
        }
        break;

      case 'marketUpdate':
        this.emit('marketUpdate', message.data);
        break;

      case 'notification':
        this.emit('notification', message.data);
        break;

      case 'error':
        console.error('❌ WebSocket server error:', message.data);
        this.emit('serverError', message.data);
        break;

      default:
        console.log('📨 Unknown message type:', message.type, message.data);
        this.emit('message', message);
    }
  }

  private handleReconnect(): void {
    // Only reconnect if we haven't exceeded max attempts
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(`❌ Max reconnection attempts reached (${this.config.maxReconnectAttempts})`);
      this.connectionState = 'error';
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    // Don't aggressively reconnect if disabled
    if (!this.config.aggressiveReconnect && this.reconnectAttempts > 0) {
      console.log('🔌 Aggressive reconnect disabled, stopping reconnection attempts');
      this.connectionState = 'disconnected';
      return;
    }

    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(this.config.retryBackoffMultiplier, this.reconnectAttempts - 1),
      this.config.maxRetryDelay
    );

    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.connectionState === 'reconnecting') {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private resubscribeToChannels(): void {
    // Add delay to prevent spam during rapid reconnections
    setTimeout(() => {
      for (const channel of this.subscriptions) {
        this.send({ type: 'subscribe', channel });
      }
    }, 1000); // 1 second delay
  }

  public send(message: Partial<WebSocketMessage>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected, message not sent:', message);
    }
  }

  public subscribe(channel: string): void {
    if (this.subscriptions.has(channel)) {
      console.log(`📡 Already subscribed to channel: ${channel}`);
      return;
    }
    this.subscriptions.add(channel);
  
    const msg = { type: 'subscribe', channel };
  
    if (this.isConnected()) {
      this.send(msg);
    } else {
      console.warn("⚠️ Not connected yet, queueing:", msg);
      this.messageQueue.push({
        message: msg,
        timestamp: Date.now(),
        retries: 0,
        priority: 'high'
      });
    }
  }
  

  public unsubscribe(channel: string): void {
    this.subscriptions.delete(channel);
    this.send({ type: 'unsubscribe', channel });
  }

  public subscribeToAgent(agentAddress: string): void {
    this.subscribe(`agent:${agentAddress}`);
  }

  public unsubscribeFromAgent(agentAddress: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.unsubscribe(`agent:${agentAddress}`);
    }
  }

  public subscribeToPlatform(): void {
    this.subscribe('platform');
  }

  public unsubscribeFromPlatform(): void {
    this.unsubscribe('platform');
  }

  public subscribeToUser(userAddress: string): void {
    this.subscribe(`user:${userAddress.toLowerCase()}`);
  }

  public unsubscribeFromUser(userAddress: string): void {
    this.unsubscribe(`user:${userAddress.toLowerCase()}`);
  }

  public getAgentStats(agentAddress: string): void {
    this.send({ type: 'getAgentStats', agentAddress });
  }

  public getPriceHistory(agentAddress: string, timeframe: string = '1h'): void {
    this.send({ type: 'getPriceHistory', agentAddress, timeframe });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'closing' | 'error' {
    if (!this.ws) return 'disconnected';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED:
        return this.reconnectAttempts >= this.config.maxReconnectAttempts ? 'error' : 'disconnected';
      default: return 'disconnected';
    }
  }

  // Get detailed connection health info
  public getConnectionHealth(): {
    status: string;
    uptime: number;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    lastConnected: Date | null;
    messagesPerSecond: number;
    bytesPerSecond: number;
    averageLatency: number;
  } {
    return {
      status: this.getConnectionState(),
      uptime: this.isConnected() && this.metrics.lastConnected
        ? Date.now() - this.metrics.lastConnected.getTime()
        : 0,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      lastConnected: this.metrics.lastConnected,
      messagesPerSecond: this.metrics.messagesPerSecond,
      bytesPerSecond: this.metrics.bytesPerSecond,
      averageLatency: this.metrics.averageLatency
    };
  }

  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');

    this.connectionState = 'disconnected';
    this.stopHeartbeat();

    // Clear timers
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    // Clear pending messages
    this.pendingMessages.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingMessages.clear();

    // Close connection
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.subscriptions.clear();
    this.clientId = null;
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
    console.log('✅ WebSocket disconnected successfully');
  }

  public reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  // Public method to force connection
  public forceConnect(): void {
    console.log('🔌 Force connection requested');
    this.attemptConnection();
  }

  // Initialize performance optimizations
  private initializeOptimizations(): void {
    // Setup batching if enabled
    if (this.config.batchingEnabled) {
      this.batchTimer = setInterval(() => {
        this.processBatchedMessages();
      }, 100); // Process every 100ms
    }

    // Setup metrics collection
    setInterval(() => {
      this.updateMetrics();
    }, 60000); // Update every minute

    // Setup queue cleanup
    setInterval(() => {
      this.cleanupMessageQueue();
    }, 30000); // Cleanup every 30 seconds
  }

  // Process batched messages for performance
  private processBatchedMessages(): void {
    if (this.batchedMessages.length === 0) return;

    const batch = this.batchedMessages.splice(0, 50); // Process up to 50 messages at once

    if (this.isConnected()) {
      const batchMessage: WebSocketMessage = {
        type: 'batch',
        data: batch,
        timestamp: Date.now()
      };

      this.send(batchMessage);
    } else {
      // Re-queue messages if not connected
      this.batchedMessages.unshift(...batch);
    }
  }

  // Enhanced send with queuing and retry logic
  public sendWithResponse(message: WebSocketMessage, timeout: number = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      message.requestId = requestId;

      const timeoutHandle = setTimeout(() => {
        this.pendingMessages.delete(requestId);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingMessages.set(requestId, { resolve, reject, timeout: timeoutHandle });
      this.send(message);
    });
  }



  // Process message queue
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const queuedMessage = this.messageQueue.shift()!;

      try {
        this.send(queuedMessage.message);
      } catch (error) {
        console.error('❌ Error sending queued message:', error);

        // Retry logic
        if (queuedMessage.retries < 3) {
          queuedMessage.retries++;
          this.messageQueue.unshift(queuedMessage);
        }
      }
    }
  }

  // Clean up old messages from queue
  private cleanupMessageQueue(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    this.messageQueue = this.messageQueue.filter(item => {
      return now - item.timestamp < maxAge;
    });
  }



  // Update connection metrics
  private updateMetrics(): void {
    if (this.connectionStartTime) {
      this.metrics.connectionUptime = Date.now() - this.connectionStartTime;
    }

    // Emit metrics for monitoring
    this.emit('metrics', { ...this.metrics });
  }

  // Enhanced ping with latency measurement
  public ping(): void {
    if (this.isConnected()) {
      this.lastPingTime = Date.now();
      this.send({
        type: 'ping',
        clientTime: this.lastPingTime,
        timestamp: this.lastPingTime
      });
    }
  }

  // Get connection statistics
  public getConnectionStats(): ConnectionMetrics & { latency: number; queueSize: number } {
    return {
      ...this.metrics,
      latency: this.metrics.averageLatency,
      queueSize: this.messageQueue.length
    };
  }



  // Force reconnection
  public forceReconnect(): void {
    console.log('🔄 Forcing WebSocket reconnection...');

    if (this.ws) {
      this.ws.close(1000, 'Manual reconnection');
    }

    this.reconnectAttempts = 0;
    this.connectionState = 'disconnected';

    setTimeout(() => {
      this.connect();
    }, 1000);
  }



  // Graceful shutdown
  public shutdown(): void {
    console.log('🔌 Shutting down WebSocket service...');

    // Process remaining queued messages
    this.processMessageQueue();

    // Wait a bit for messages to be sent
    setTimeout(() => {
      this.disconnect();
    }, 1000);
  }
}

// Create singleton instance
console.log('🔌 Creating WebSocket service singleton...');
const websocketService = new WebSocketService();
console.log('✅ WebSocket service singleton created');

export default websocketService;
