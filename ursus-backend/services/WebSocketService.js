const WebSocket = require('ws');
const EventEmitter = require('events');
const EventListenerService = require('./EventListenerService');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const Portfolio = require('../models/Portfolio');

class WebSocketService extends EventEmitter {
  constructor(server) {
    super();

    // WebSocket server configuration
    this.wss = new WebSocket.Server({
      server,
      perMessageDeflate: {
        zlibDeflateOptions: {
          level: 3,
          chunkSize: 1024,
        },
        threshold: 1024,
        concurrencyLimit: 10,
        clientMaxWindowBits: 15,
        serverMaxWindowBits: 15,
        serverMaxNoContextTakeover: false,
        clientMaxNoContextTakeover: false,
      },
      maxPayload: 100 * 1024 * 1024, // 100MB
    });

    // Client management
    this.clients = new Map(); // clientId -> ClientConnection
    this.subscriptions = new Map(); // channel -> Set<clientId>
    this.rateLimits = new Map(); // clientId -> RateLimitData

    // Performance tracking
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      lastMetricsReset: Date.now(),
      messageCount: 0,
      byteCount: 0,
      errors: 0,
      reconnections: 0
    };

    // Configuration
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      clientTimeout: 60000, // 1 minute
      maxSubscriptionsPerClient: 100,
      rateLimitWindow: 60000, // 1 minute
      rateLimitMaxRequests: 1000, // 1000 requests per minute
      maxReconnectAttempts: 5,
      reconnectBackoffBase: 1000, // 1 second base
      maxReconnectBackoff: 30000, // 30 seconds max
      compressionThreshold: 1024,
      batchUpdateInterval: 100, // 100ms for batching updates
      maxBatchSize: 50
    };

    // Batch processing
    this.batchQueue = new Map(); // channel -> Array<message>
    this.batchTimer = null;

    this.setupEventListeners();
    this.setupWebSocketHandlers();
    this.initializeTracking();
    this.startHeartbeat();
    this.startMetricsCollection();
    this.startBatchProcessor();

    console.log('🔌 Advanced WebSocket service initialized with professional features');
  }

  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const clientIP = req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      console.log(`🔗 New WebSocket connection: ${clientId} from ${clientIP}`);

      // Create client connection object
      const clientConnection = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: Date.now(),
        lastPong: Date.now(),
        connectedAt: Date.now(),
        ip: clientIP,
        userAgent,
        isAlive: true,
        messageCount: 0,
        byteCount: 0,
        subscriptionCount: 0,
        rateLimitViolations: 0,
        lastActivity: Date.now(),
        reconnectCount: 0,
        metadata: {}
      };

      this.clients.set(clientId, clientConnection);
      this.metrics.totalConnections++;
      this.metrics.activeConnections++;

      // Initialize rate limiting
      this.rateLimits.set(clientId, {
        requests: 0,
        windowStart: Date.now(),
        violations: 0
      });

      // Send welcome message with connection info
      this.sendToClient(clientId, {
        type: 'connected',
        clientId,
        serverTime: Date.now(),
        config: {
          heartbeatInterval: this.config.heartbeatInterval,
          maxSubscriptions: this.config.maxSubscriptionsPerClient,
          compressionEnabled: true,
          batchingEnabled: true
        },
        timestamp: Date.now()
      });

      // Handle incoming messages with rate limiting
      ws.on('message', (data) => {
        try {
          // Rate limiting check
          if (!this.checkRateLimit(clientId)) {
            this.sendToClient(clientId, {
              type: 'error',
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Rate limit exceeded. Please slow down.',
              retryAfter: this.config.rateLimitWindow
            });
            return;
          }

          const message = JSON.parse(data.toString());
          this.updateClientActivity(clientId, data.length);
          this.handleClientMessage(clientId, message);

        } catch (error) {
          console.error(`Error parsing WebSocket message from ${clientId}:`, error);
          this.metrics.errors++;
          this.sendToClient(clientId, {
            type: 'error',
            code: 'INVALID_MESSAGE_FORMAT',
            message: 'Invalid message format. Expected valid JSON.',
            timestamp: Date.now()
          });
        }
      });

      // Handle pong responses (heartbeat)
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPong = Date.now();
          client.isAlive = true;
        }
      });

      // Handle ping from client
      ws.on('ping', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = Date.now();
          ws.pong();
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        const reasonStr = reason ? reason.toString() : 'No reason provided';
        console.log(`🔌 WebSocket disconnected: ${clientId} (Code: ${code}, Reason: ${reasonStr})`);
        this.handleClientDisconnect(clientId, code, reasonStr);
      });

      // Handle connection errors
      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientId}:`, error);
        this.metrics.errors++;
        this.handleClientDisconnect(clientId, 1006, error.message);
      });

      // Send initial data for subscribed channels
      this.emit('clientConnected', { clientId, clientConnection });
    });

    // Handle server errors
    this.wss.on('error', (error) => {
      console.error('❌ WebSocket Server error:', error);
      this.metrics.errors++;
      this.emit('serverError', error);
    });

    // Handle server close
    this.wss.on('close', () => {
      console.log('🔌 WebSocket Server closed');
      this.emit('serverClosed');
    });
  }

  setupEventListeners() {
    // Listen to blockchain events and broadcast to subscribed clients
    EventListenerService.on('agentCreated', (event) => {
      this.broadcast('agentCreated', event, 'platform');
    });

    EventListenerService.on('tokensPurchased', (event) => {
      this.broadcast('tokensPurchased', event, `agent:${event.agentAddress}`);
      this.broadcast('tokensPurchased', event, 'platform');
    });

    EventListenerService.on('tokensSold', (event) => {
      this.broadcast('tokensSold', event, `agent:${event.agentAddress}`);
      this.broadcast('tokensSold', event, 'platform');
    });

    EventListenerService.on('agentInteraction', (event) => {
      this.broadcast('agentInteraction', event, `agent:${event.agentAddress}`);
    });
  }

  // Advanced rate limiting
  checkRateLimit(clientId) {
    const rateLimit = this.rateLimits.get(clientId);
    if (!rateLimit) return true;

    const now = Date.now();

    // Reset window if expired
    if (now - rateLimit.windowStart >= this.config.rateLimitWindow) {
      rateLimit.requests = 0;
      rateLimit.windowStart = now;
    }

    // Check if limit exceeded
    if (rateLimit.requests >= this.config.rateLimitMaxRequests) {
      rateLimit.violations++;

      // Escalate punishment for repeat offenders
      if (rateLimit.violations > 5) {
        this.handleClientDisconnect(clientId, 1008, 'Excessive rate limit violations');
        return false;
      }

      return false;
    }

    rateLimit.requests++;
    return true;
  }

  // Update client activity metrics
  updateClientActivity(clientId, messageSize = 0) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = Date.now();
    client.messageCount++;
    client.byteCount += messageSize;

    // Update global metrics
    this.metrics.messageCount++;
    this.metrics.byteCount += messageSize;
  }

  // Enhanced message handling with validation
  handleClientMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`Received message from unknown client: ${clientId}`);
      return;
    }

    // Validate message structure
    if (!message || typeof message !== 'object' || !message.type) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'INVALID_MESSAGE_STRUCTURE',
        message: 'Message must be an object with a type property',
        timestamp: Date.now()
      });
      return;
    }

    // Handle different message types
    try {
      switch (message.type) {
        case 'subscribe':
          this.handleSubscription(clientId, message.channel, message.options);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(clientId, message.channel);
          break;

        case 'ping':
          this.handlePing(clientId, message.timestamp);
          break;

        case 'getAgentStats':
          this.handleGetAgentStats(clientId, message.agentAddress, message.options);
          break;

        case 'getPriceHistory':
          this.handleGetPriceHistory(clientId, message.agentAddress, message.timeframe, message.options);
          break;

        case 'getMarketData':
          this.handleGetMarketData(clientId, message.options);
          break;

        case 'subscribeToTrades':
          this.handleTradeSubscription(clientId, message.agentAddress, message.options);
          break;

        case 'subscribeToPortfolio':
          this.handlePortfolioSubscription(clientId, message.userAddress, message.options);
          break;

        case 'batchRequest':
          this.handleBatchRequest(clientId, message.requests);
          break;

        case 'setClientMetadata':
          this.handleSetClientMetadata(clientId, message.metadata);
          break;

        case 'agentMessage':
          this.handleAgentMessage(clientId, message);
          break;

        case 'getOrderBook':
          this.handleGetOrderBook(clientId, message.agentAddress, message.options);
          break;

        default:
          this.sendToClient(clientId, {
            type: 'error',
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${message.type}`,
            supportedTypes: [
              'subscribe', 'unsubscribe', 'ping', 'getAgentStats',
              'getPriceHistory', 'getMarketData', 'subscribeToTrades',
              'subscribeToPortfolio', 'batchRequest', 'setClientMetadata',
              'agentMessage', 'getOrderBook'
            ],
            timestamp: Date.now()
          });
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        code: 'MESSAGE_PROCESSING_ERROR',
        message: 'An error occurred while processing your message',
        timestamp: Date.now()
      });
    }
  }

  // Enhanced ping handling
  handlePing(clientId, clientTimestamp) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const serverTime = Date.now();
    const latency = clientTimestamp ? serverTime - clientTimestamp : null;

    this.sendToClient(clientId, {
      type: 'pong',
      serverTime,
      clientTime: clientTimestamp,
      latency,
      timestamp: serverTime
    });
  }

  // Advanced subscription handling
  handleSubscription(clientId, channel, options = {}) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check subscription limits
    if (client.subscriptions.size >= this.config.maxSubscriptionsPerClient) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
        message: `Maximum subscriptions limit reached (${this.config.maxSubscriptionsPerClient})`,
        timestamp: Date.now()
      });
      return;
    }

    // Validate channel format
    if (!this.isValidChannel(channel)) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'INVALID_CHANNEL',
        message: 'Invalid channel format',
        validFormats: ['platform', 'agent:ADDRESS', 'user:ADDRESS', 'trades:ADDRESS', 'market'],
        timestamp: Date.now()
      });
      return;
    }

    console.log(`📡 Client ${clientId} subscribing to ${channel} with options:`, options);

    // Add to client subscriptions
    client.subscriptions.add(channel);
    client.subscriptionCount++;

    // Add to global subscription tracking
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel).add(clientId);

    // Send initial data for the channel
    this.sendInitialData(clientId, channel, options);

    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      options,
      subscriberCount: this.subscriptions.get(channel).size,
      timestamp: Date.now()
    });

    this.emit('clientSubscribed', { clientId, channel, options });
  }

  handleUnsubscription(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`📡 Client ${clientId} unsubscribing from ${channel}`);

    // Remove from client subscriptions
    client.subscriptions.delete(channel);

    // Remove from global subscription tracking
    if (this.subscriptions.has(channel)) {
      this.subscriptions.get(channel).delete(clientId);

      // Clean up empty subscription sets
      if (this.subscriptions.get(channel).size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      remainingSubscribers: this.subscriptions.has(channel) ? this.subscriptions.get(channel).size : 0,
      timestamp: Date.now()
    });

    this.emit('clientUnsubscribed', { clientId, channel });
  }

  // Validate channel format
  isValidChannel(channel) {
    if (!channel || typeof channel !== 'string') return false;

    const validPatterns = [
      /^platform$/,
      /^market$/,
      /^agent:[a-zA-Z0-9]{40,}$/,
      /^user:[a-zA-Z0-9]{40,}$/,
      /^trades:[a-zA-Z0-9]{40,}$/,
      /^portfolio:[a-zA-Z0-9]{40,}$/
    ];

    return validPatterns.some(pattern => pattern.test(channel));
  }

  async handleGetAgentStats(clientId, agentAddress) {
    try {
      console.log(`📊 Getting real-time stats for agent: ${agentAddress}`);

      // Get agent from database
      const agent = await Agent.findOne({
        contractAddress: agentAddress.toLowerCase()
      });

      if (!agent) {
        this.sendToClient(clientId, {
          type: 'error',
          message: 'Agent not found'
        });
        return;
      }

      // Calculate real-time metrics
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const trades24h = await Trade.find({
        agentAddress: agentAddress.toLowerCase(),
        timestamp: { $gte: last24h }
      });

      const volume24h = trades24h.reduce((sum, trade) => {
        return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
      }, 0);

      const holders = await Portfolio.countDocuments({
        agentAddress: agentAddress.toLowerCase(),
        balance: { $gt: '0' },
        isActive: true
      });

      const stats = {
        address: agentAddress,
        name: agent.name,
        symbol: agent.symbol,
        currentPrice: agent.tokenomics?.currentPrice || '1.00',
        marketCap: agent.tokenomics?.marketCap || '0',
        totalSupply: agent.tokenomics?.totalSupply || '0',
        reserve: agent.tokenomics?.reserve || '0',
        holders,
        volume24h: volume24h.toFixed(6),
        transactions24h: trades24h.length,
        priceChange24h: agent.metrics?.priceChange24h || '0',
        allTimeHigh: agent.metrics?.allTimeHigh || agent.tokenomics?.currentPrice || '1.00',
        allTimeLow: agent.metrics?.allTimeLow || agent.tokenomics?.currentPrice || '1.00',
        lastUpdate: agent.lastPriceUpdate || new Date()
      };

      this.sendToClient(clientId, {
        type: 'agentStats',
        agentAddress,
        stats,
        timestamp: Date.now()
      });

      console.log(`✅ Sent real-time stats for ${agentAddress}`);
    } catch (error) {
      console.error('Error getting agent stats:', error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Failed to get agent stats'
      });
    }
  }

  async handleGetPriceHistory(clientId, agentAddress, timeframe = '24h') {
    try {
      console.log(` Getting price history for ${agentAddress} (${timeframe})`);

      // Calculate time range
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeRange = timeRanges[timeframe] || timeRanges['24h'];
      const startTime = new Date(Date.now() - timeRange);

      // Get trades for price history
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase(),
        timestamp: { $gte: startTime }
      }).sort({ timestamp: 1 });

      // Generate price history from trades
      const priceHistory = [];

      if (trades.length > 0) {
        // Group trades by time intervals
        const intervalMs = timeRange / 100; // 100 data points
        let currentTime = startTime.getTime();
        let currentPrice = parseFloat(trades[0].price);

        for (let i = 0; i < 100; i++) {
          const intervalEnd = currentTime + intervalMs;

          // Find trades in this interval
          const intervalTrades = trades.filter(trade => {
            const tradeTime = new Date(trade.timestamp).getTime();
            return tradeTime >= currentTime && tradeTime < intervalEnd;
          });

          // Update price if there are trades in this interval
          if (intervalTrades.length > 0) {
            currentPrice = parseFloat(intervalTrades[intervalTrades.length - 1].price);
          }

          priceHistory.push({
            time: Math.floor(currentTime / 1000),
            price: currentPrice,
            volume: intervalTrades.reduce((sum, trade) => {
              return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
            }, 0)
          });

          currentTime = intervalEnd;
        }
      } else {
        // No trades, use current price
        const agent = await Agent.findOne({
          contractAddress: agentAddress.toLowerCase()
        });

        const currentPrice = parseFloat(agent?.tokenomics?.currentPrice || '1.00');

        for (let i = 0; i < 10; i++) {
          priceHistory.push({
            time: Math.floor((Date.now() - (9 - i) * (timeRange / 10)) / 1000),
            price: currentPrice,
            volume: 0
          });
        }
      }

      this.sendToClient(clientId, {
        type: 'priceHistory',
        agentAddress,
        timeframe,
        data: priceHistory,
        timestamp: Date.now()
      });

      console.log(`✅ Sent price history for ${agentAddress} (${priceHistory.length} points)`);
    } catch (error) {
      console.error('Error getting price history:', error);
      this.sendToClient(clientId, {
        type: 'error',
        message: 'Failed to get price history'
      });
    }
  }

  async sendInitialData(clientId, channel, options = {}) {
    try {
      console.log(`📤 Sending initial data for channel: ${channel} to client: ${clientId}`);

      if (channel === 'platform') {
        // Send platform overview with real data
        const totalAgents = await Agent.countDocuments({ isActive: true });
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentTrades = await Trade.find({
          timestamp: { $gte: last24h }
        }).sort({ timestamp: -1 }).limit(20);

        const totalVolume24h = recentTrades.reduce((sum, trade) => {
          return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
        }, 0);

        this.sendToClient(clientId, {
          type: 'initialData',
          channel,
          data: {
            totalAgents,
            totalVolume24h: totalVolume24h.toFixed(6),
            totalTrades24h: recentTrades.length,
            recentTrades: recentTrades.map(trade => ({
              agentAddress: trade.agentAddress,
              type: trade.type,
              amount: trade.tokenAmount,
              price: trade.price,
              timestamp: trade.timestamp
            }))
          },
          timestamp: Date.now()
        });

      } else if (channel.startsWith('agent:')) {
        // Send agent-specific data
        const agentAddress = channel.split(':')[1];

        const agent = await Agent.findOne({
          contractAddress: agentAddress.toLowerCase()
        });

        if (agent) {
          const recentTrades = await Trade.find({
            agentAddress: agentAddress.toLowerCase()
          }).sort({ timestamp: -1 }).limit(10);

          this.sendToClient(clientId, {
            type: 'initialData',
            channel,
            data: {
              agent: {
                address: agent.contractAddress,
                name: agent.name,
                symbol: agent.symbol,
                currentPrice: agent.tokenomics?.currentPrice || '0',
                marketCap: agent.tokenomics?.marketCap || '0',
                volume24h: agent.metrics?.volume24h || '0',
                priceChange24h: agent.metrics?.priceChange24h || '0'
              },
              recentTrades: recentTrades.map(trade => ({
                type: trade.type,
                amount: trade.tokenAmount,
                price: trade.price,
                timestamp: trade.timestamp,
                trader: trade.trader
              }))
            },
            timestamp: Date.now()
          });
        }

      } else if (channel === 'market') {
        // Send market data
        await this.handleGetMarketData(clientId, options);

      } else if (channel.startsWith('trades:')) {
        // Send trade-specific data (handled separately to avoid infinite loop)
        const agentAddress = channel.split(':')[1];

        const recentTrades = await Trade.find({
          agentAddress: agentAddress.toLowerCase()
        })
        .sort({ timestamp: -1 })
        .limit(20);

        this.sendToClient(clientId, {
          type: 'initialData',
          channel,
          data: {
            trades: recentTrades.map(trade => ({
              type: trade.type,
              amount: trade.tokenAmount,
              price: trade.price,
              timestamp: trade.timestamp,
              trader: trade.trader,
              txHash: trade.txHash
            }))
          },
          timestamp: Date.now()
        });

      } else if (channel.startsWith('portfolio:')) {
        // Send portfolio-specific data
        const userAddress = channel.split(':')[1];
        await this.handlePortfolioSubscription(clientId, userAddress, options);
      }

    } catch (error) {
      console.error(`Error sending initial data for channel ${channel}:`, error);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        code: 'INITIAL_DATA_ERROR',
        message: 'Failed to send initial data',
        channel,
        timestamp: Date.now()
      });
    }
  }

  broadcast(eventType, data, channel = null) {
    const message = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    let targetClients = [];

    if (channel) {
      // Send to clients subscribed to specific channel
      targetClients = Array.from(this.clients.entries())
        .filter(([_, client]) => client.subscriptions.has(channel))
        .map(([clientId, client]) => ({ clientId, client }));
    } else {
      // Send to all clients
      targetClients = Array.from(this.clients.entries())
        .map(([clientId, client]) => ({ clientId, client }));
    }

    targetClients.forEach(({ clientId, client }) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error sending message to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    });

    if (targetClients.length > 0) {
      console.log(`📡 Broadcasted ${eventType} to ${targetClients.length} clients${channel ? ` (${channel})` : ''}`);
    }
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  cleanupDeadConnections() {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState !== WebSocket.OPEN || (now - client.lastPing) > timeout) {
        console.log(`🧹 Cleaning up dead connection: ${clientId}`);
        this.clients.delete(clientId);

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.terminate();
        }
      } else {
        // Send ping to check connection health
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Error pinging client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    }
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  getConnectedClients() {
    return this.clients.size;
  }

  getClientSubscriptions() {
    const subscriptions = {};
    for (const [clientId, client] of this.clients.entries()) {
      subscriptions[clientId] = Array.from(client.subscriptions);
    }
    return subscriptions;
  }
  // Broadcast message to all connected clients
  broadcastToAll(type, data) {
    const message = {
      type,
      data,
      timestamp: Date.now()
    };

    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error(`Error broadcasting to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  // Broadcast price update to specific agent subscribers
  broadcastPriceUpdate(agentAddress, priceData) {
    const channel = `agent:${agentAddress}`;
    this.broadcast('priceUpdate', {
      agentAddress,
      ...priceData
    }, channel);
  }

  // Broadcast trading event
  broadcastTradingEvent(eventType, eventData) {
    // Broadcast to agent-specific channel
    if (eventData.agentAddress) {
      const agentChannel = `agent:${eventData.agentAddress}`;
      this.broadcast(eventType, eventData, agentChannel);
    }

    // Broadcast to platform channel
    this.broadcast(eventType, eventData, 'platform');
  }

  // Broadcast market update
  broadcastMarketUpdate(marketData) {
    this.broadcast('marketUpdate', marketData, 'platform');
  }

  // Send notification to specific user
  sendUserNotification(userAddress, notification) {
    const userChannel = `user:${userAddress.toLowerCase()}`;
    this.broadcast('notification', notification, userChannel);
  }

  // Get real-time statistics
  getRealTimeStats() {
    return {
      connectedClients: this.clients.size,
      activeSubscriptions: this.getActiveSubscriptions(),
      uptime: Date.now() - this.startTime,
      messagesProcessed: this.messageCount || 0
    };
  }

  // Get active subscriptions summary
  getActiveSubscriptions() {
    const subscriptions = {};

    for (const [clientId, client] of this.clients.entries()) {
      for (const subscription of client.subscriptions) {
        if (!subscriptions[subscription]) {
          subscriptions[subscription] = 0;
        }
        subscriptions[subscription]++;
      }
    }

    return subscriptions;
  }

  // Initialize service tracking
  initializeTracking() {
    console.log('🔧 Initializing WebSocket tracking systems...');

    this.startTime = Date.now();
    this.messageCount = 0;

    // Initialize metrics collection
    this.resetMetrics();

    // Setup periodic cleanup
    this.setupPeriodicCleanup();

    // Track message processing
    const originalSendToClient = this.sendToClient.bind(this);
    this.sendToClient = (clientId, message) => {
      this.messageCount++;
      this.metrics.messageCount++;
      return originalSendToClient(clientId, message);
    };
  }

  // Start heartbeat system
  startHeartbeat() {
    console.log('💓 Starting WebSocket heartbeat system...');

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);
  }

  // Start metrics collection
  startMetricsCollection() {
    console.log('📊 Starting metrics collection...');

    this.metricsTimer = setInterval(() => {
      this.collectMetrics();
    }, 60000); // Collect every minute
  }

  // Start batch processor
  startBatchProcessor() {
    console.log('📦 Starting batch processor...');

    this.batchTimer = setInterval(() => {
      this.processBatchQueue();
    }, this.config.batchUpdateInterval);
  }

  // Perform heartbeat check
  performHeartbeat() {
    const now = Date.now();
    const deadClients = [];

    for (const [clientId, client] of this.clients.entries()) {
      // Check if client is alive
      if (now - client.lastPong > this.config.clientTimeout) {
        if (client.isAlive) {
          // First timeout - send ping
          client.isAlive = false;
          try {
            client.ws.ping();
          } catch (error) {
            deadClients.push(clientId);
          }
        } else {
          // Second timeout - client is dead
          deadClients.push(clientId);
        }
      }
    }

    // Remove dead clients
    deadClients.forEach(clientId => {
      console.log(`💀 Removing dead client: ${clientId}`);
      this.handleClientDisconnect(clientId, 1006, 'Heartbeat timeout');
    });

    if (deadClients.length > 0) {
      console.log(`💓 Heartbeat: Removed ${deadClients.length} dead clients`);
    }
  }

  // Collect and update metrics
  collectMetrics() {
    const now = Date.now();
    const timeDiff = now - this.metrics.lastMetricsReset;

    // Calculate rates
    this.metrics.messagesPerSecond = Math.round((this.metrics.messageCount / timeDiff) * 1000);
    this.metrics.bytesPerSecond = Math.round((this.metrics.byteCount / timeDiff) * 1000);

    // Update active connections
    this.metrics.activeConnections = this.clients.size;

    // Log metrics periodically
    if (this.metrics.activeConnections > 0) {
      console.log(`📊 WebSocket Metrics: ${this.metrics.activeConnections} clients, ${this.metrics.messagesPerSecond} msg/s, ${this.metrics.bytesPerSecond} bytes/s`);
    }

    // Reset counters
    this.metrics.messageCount = 0;
    this.metrics.byteCount = 0;
    this.metrics.lastMetricsReset = now;

    // Emit metrics for monitoring
    this.emit('metrics', { ...this.metrics });
  }

  // Setup periodic cleanup tasks
  setupPeriodicCleanup() {
    // Clean up empty subscriptions every 5 minutes
    setInterval(() => {
      this.cleanupEmptySubscriptions();
    }, 5 * 60 * 1000);

    // Clean up rate limit data every hour
    setInterval(() => {
      this.cleanupRateLimitData();
    }, 60 * 60 * 1000);
  }

  // Clean up empty subscription channels
  cleanupEmptySubscriptions() {
    let cleaned = 0;
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} empty subscription channels`);
    }
  }

  // Clean up old rate limit data
  cleanupRateLimitData() {
    const now = Date.now();
    let cleaned = 0;

    for (const [clientId, rateLimit] of this.rateLimits.entries()) {
      if (!this.clients.has(clientId) || now - rateLimit.windowStart > this.config.rateLimitWindow * 2) {
        this.rateLimits.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old rate limit entries`);
    }
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      bytesPerSecond: 0,
      lastMetricsReset: Date.now(),
      messageCount: 0,
      byteCount: 0,
      errors: 0,
      reconnections: 0
    };
  }
  // Handle client disconnect with cleanup
  handleClientDisconnect(clientId, code = 1000, reason = 'Normal closure') {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`🔌 Handling disconnect for client ${clientId} (Code: ${code}, Reason: ${reason})`);

    // Clean up subscriptions
    for (const channel of client.subscriptions) {
      if (this.subscriptions.has(channel)) {
        this.subscriptions.get(channel).delete(clientId);

        // Clean up empty subscription sets
        if (this.subscriptions.get(channel).size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    // Clean up rate limiting
    this.rateLimits.delete(clientId);

    // Update metrics
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);

    // Remove client
    this.clients.delete(clientId);

    // Emit disconnect event
    this.emit('clientDisconnected', {
      clientId,
      code,
      reason,
      connectionDuration: Date.now() - client.connectedAt,
      messageCount: client.messageCount,
      subscriptionCount: client.subscriptions.size
    });

    console.log(`✅ Client ${clientId} cleanup completed`);
  }

  // Enhanced batch processing
  processBatchQueue() {
    if (this.batchQueue.size === 0) return;

    for (const [channel, messages] of this.batchQueue.entries()) {
      if (messages.length === 0) continue;

      // Get subscribers for this channel
      const subscribers = this.subscriptions.get(channel);
      if (!subscribers || subscribers.size === 0) {
        this.batchQueue.delete(channel);
        continue;
      }

      // Send batched messages
      const batchMessage = {
        type: 'batch',
        channel,
        messages: messages.splice(0, this.config.maxBatchSize),
        timestamp: Date.now()
      };

      // Send to all subscribers
      for (const clientId of subscribers) {
        this.sendToClient(clientId, batchMessage);
      }

      // Clean up empty queues
      if (messages.length === 0) {
        this.batchQueue.delete(channel);
      }
    }
  }

  // Add message to batch queue
  addToBatchQueue(channel, message) {
    if (!this.batchQueue.has(channel)) {
      this.batchQueue.set(channel, []);
    }

    this.batchQueue.get(channel).push(message);

    // If batch is full, process immediately
    if (this.batchQueue.get(channel).length >= this.config.maxBatchSize) {
      this.processBatchQueue();
    }
  }

  // Enhanced message handlers
  async handleGetMarketData(clientId, options = {}) {
    try {
      console.log(`📊 Getting market data for client: ${clientId}`);

      // Get overall market statistics
      const totalAgents = await Agent.countDocuments({ isActive: true });
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recentTrades = await Trade.find({
        timestamp: { $gte: last24h }
      }).sort({ timestamp: -1 }).limit(50);

      const totalVolume24h = recentTrades.reduce((sum, trade) => {
        return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
      }, 0);

      // Get top performing agents
      const topAgents = await Agent.find({ isActive: true })
        .sort({ 'metrics.priceChange24h': -1 })
        .limit(10)
        .select('name symbol contractAddress tokenomics metrics');

      this.sendToClient(clientId, {
        type: 'marketData',
        data: {
          totalAgents,
          totalVolume24h: totalVolume24h.toFixed(6),
          totalTrades24h: recentTrades.length,
          topPerformers: topAgents.map(agent => ({
            address: agent.contractAddress,
            name: agent.name,
            symbol: agent.symbol,
            price: agent.tokenomics?.currentPrice || '0',
            change24h: agent.metrics?.priceChange24h || '0',
            volume24h: agent.metrics?.volume24h || '0'
          })),
          recentTrades: recentTrades.slice(0, 20).map(trade => ({
            agentAddress: trade.agentAddress,
            type: trade.type,
            amount: trade.tokenAmount,
            price: trade.price,
            timestamp: trade.timestamp
          }))
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error getting market data:', error);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        code: 'MARKET_DATA_ERROR',
        message: 'Failed to get market data',
        timestamp: Date.now()
      });
    }
  }

  async handleTradeSubscription(clientId, agentAddress, options = {}) {
    try {
      if (!agentAddress) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'INVALID_AGENT_ADDRESS',
          message: 'Agent address is required for trade subscription',
          timestamp: Date.now()
        });
        return;
      }

      // Send recent trades as initial data (without calling handleSubscription to avoid loop)
      const recentTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      })
      .sort({ timestamp: -1 })
      .limit(options.limit || 20);

      this.sendToClient(clientId, {
        type: 'initialTradeData',
        agentAddress,
        trades: recentTrades.map(trade => ({
          type: trade.type,
          amount: trade.tokenAmount,
          price: trade.price,
          timestamp: trade.timestamp,
          trader: trade.trader,
          txHash: trade.txHash
        })),
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error handling trade subscription:', error);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        code: 'TRADE_SUBSCRIPTION_ERROR',
        message: 'Failed to subscribe to trades',
        agentAddress,
        timestamp: Date.now()
      });
    }
  }

  async handlePortfolioSubscription(clientId, userAddress, options = {}) {
    try {
      if (!userAddress) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'INVALID_USER_ADDRESS',
          message: 'User address is required for portfolio subscription',
          timestamp: Date.now()
        });
        return;
      }

      const channel = `portfolio:${userAddress.toLowerCase()}`;
      this.handleSubscription(clientId, channel, options);

      // Send current portfolio as initial data
      const portfolio = await Portfolio.find({
        userAddress: userAddress.toLowerCase(),
        isActive: true
      }).populate('agentAddress');

      this.sendToClient(clientId, {
        type: 'initialPortfolioData',
        userAddress,
        portfolio: portfolio.map(holding => ({
          agentAddress: holding.agentAddress,
          balance: holding.balance,
          averagePrice: holding.averageBuyPrice,
          totalInvested: holding.totalInvested,
          currentValue: holding.currentValue,
          pnl: holding.pnl,
          lastUpdated: holding.updatedAt
        })),
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error handling portfolio subscription:', error);
      this.metrics.errors++;
      this.sendToClient(clientId, {
        type: 'error',
        code: 'PORTFOLIO_SUBSCRIPTION_ERROR',
        message: 'Failed to subscribe to portfolio',
        userAddress,
        timestamp: Date.now()
      });
    }
  }

  handleBatchRequest(clientId, requests) {
    if (!Array.isArray(requests) || requests.length === 0) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'INVALID_BATCH_REQUEST',
        message: 'Batch request must be a non-empty array',
        timestamp: Date.now()
      });
      return;
    }

    if (requests.length > 10) {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'BATCH_SIZE_EXCEEDED',
        message: 'Maximum batch size is 10 requests',
        timestamp: Date.now()
      });
      return;
    }

    // Process each request in the batch
    const responses = [];
    for (const request of requests) {
      try {
        // Handle each request type
        switch (request.type) {
          case 'getAgentStats':
            this.handleGetAgentStats(clientId, request.agentAddress, request.options);
            break;
          case 'getPriceHistory':
            this.handleGetPriceHistory(clientId, request.agentAddress, request.timeframe, request.options);
            break;
          default:
            responses.push({
              requestId: request.id,
              error: 'Unknown request type',
              timestamp: Date.now()
            });
        }
      } catch (error) {
        responses.push({
          requestId: request.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
    }

    if (responses.length > 0) {
      this.sendToClient(clientId, {
        type: 'batchResponse',
        responses,
        timestamp: Date.now()
      });
    }
  }

  handleSetClientMetadata(clientId, metadata) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Validate metadata
    if (!metadata || typeof metadata !== 'object') {
      this.sendToClient(clientId, {
        type: 'error',
        code: 'INVALID_METADATA',
        message: 'Metadata must be an object',
        timestamp: Date.now()
      });
      return;
    }

    // Update client metadata
    client.metadata = { ...client.metadata, ...metadata };

    this.sendToClient(clientId, {
      type: 'metadataUpdated',
      metadata: client.metadata,
      timestamp: Date.now()
    });

    console.log(`📝 Updated metadata for client ${clientId}:`, metadata);
  }

  // Handle agent message (chat)
  async handleAgentMessage(clientId, message) {
    try {
      console.log(`💬 Processing agent message from client: ${clientId}`);

      if (!message.agentAddress || !message.userAddress || !message.message) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'INVALID_AGENT_MESSAGE',
          message: 'Agent address, user address, and message are required',
          timestamp: Date.now()
        });
        return;
      }

      // Get agent from database
      const agent = await Agent.findOne({
        contractAddress: message.agentAddress.toLowerCase()
      });

      if (!agent) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'AGENT_NOT_FOUND',
          message: `Agent not found: ${message.agentAddress}`,
          timestamp: Date.now()
        });
        return;
      }

      // Process the message (this would integrate with AI service)
      const response = await this.processAgentInteraction(agent, message.message, message.userAddress);

      // Send response back to client
      this.sendToClient(clientId, {
        type: 'agentResponse',
        agentAddress: message.agentAddress,
        userAddress: message.userAddress,
        message: message.message,
        response: response,
        sessionId: message.sessionId,
        timestamp: Date.now()
      });

      // Broadcast to other subscribers if needed
      const channel = `agent:${message.agentAddress.toLowerCase()}`;
      this.broadcast('agentInteraction', {
        agentAddress: message.agentAddress,
        userAddress: message.userAddress,
        message: message.message,
        response: response,
        timestamp: Date.now()
      }, channel);

    } catch (error) {
      console.error('❌ Error handling agent message:', error);
      this.sendToClient(clientId, {
        type: 'error',
        code: 'AGENT_MESSAGE_ERROR',
        message: 'Failed to process agent message',
        timestamp: Date.now()
      });
    }
  }

  // Process agent interaction (placeholder for AI integration)
  async processAgentInteraction(agent, message, userAddress) {
    // This would integrate with your AI service
    // For now, return a simple response
    const responses = [
      `Hello! I'm ${agent.name}. How can I help you today?`,
      `Thanks for your message! As ${agent.name}, I'm here to assist you.`,
      `Interesting question! Let me think about that...`,
      `I appreciate your interest in ${agent.name}. What would you like to know?`,
      `Great to hear from you! I'm ${agent.name} and I'm ready to help.`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  // Handle order book request
  async handleGetOrderBook(clientId, agentAddress, options = {}) {
    try {
      console.log(`📊 Getting order book for agent: ${agentAddress}`);

      if (!agentAddress) {
        this.sendToClient(clientId, {
          type: 'error',
          code: 'INVALID_AGENT_ADDRESS',
          message: 'Agent address is required',
          timestamp: Date.now()
        });
        return;
      }

      // Get recent trades to simulate order book
      const recentTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      })
      .sort({ timestamp: -1 })
      .limit(100);

      // Generate order book levels from trades
      const { buyOrders, sellOrders } = this.generateOrderBookFromTrades(recentTrades);

      // Calculate spread
      const bestBid = buyOrders.length > 0 ? Math.max(...buyOrders.map(o => o.price)) : 0;
      const bestAsk = sellOrders.length > 0 ? Math.min(...sellOrders.map(o => o.price)) : 0;
      const spread = bestAsk - bestBid;
      const spreadPercent = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

      this.sendToClient(clientId, {
        type: 'orderBook',
        agentAddress,
        buyOrders: buyOrders.slice(0, options.depth || 20),
        sellOrders: sellOrders.slice(0, options.depth || 20),
        spread,
        spreadPercent,
        recentTrades: recentTrades.slice(0, 20).map(trade => ({
          id: trade._id,
          type: trade.type,
          price: parseFloat(trade.price),
          amount: parseFloat(trade.tokenAmount),
          total: parseFloat(trade.coreAmount),
          timestamp: trade.timestamp,
          userAddress: trade.trader
        })),
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error getting order book:', error);
      this.sendToClient(clientId, {
        type: 'error',
        code: 'ORDER_BOOK_ERROR',
        message: 'Failed to get order book',
        timestamp: Date.now()
      });
    }
  }

  // Generate order book from trades (simulation)
  generateOrderBookFromTrades(trades) {
    const buyOrders = [];
    const sellOrders = [];
    const priceMap = new Map();

    // Group trades by price
    trades.forEach(trade => {
      const price = parseFloat(trade.price);
      const amount = parseFloat(trade.tokenAmount);

      if (!priceMap.has(price)) {
        priceMap.set(price, { buy: 0, sell: 0 });
      }

      if (trade.type === 'buy') {
        priceMap.get(price).buy += amount;
      } else {
        priceMap.get(price).sell += amount;
      }
    });

    // Convert to order book format
    for (const [price, amounts] of priceMap.entries()) {
      if (amounts.buy > 0) {
        buyOrders.push({
          price,
          amount: amounts.buy,
          total: price * amounts.buy
        });
      }
      if (amounts.sell > 0) {
        sellOrders.push({
          price,
          amount: amounts.sell,
          total: price * amounts.sell
        });
      }
    }

    // Sort orders
    buyOrders.sort((a, b) => b.price - a.price); // Highest first
    sellOrders.sort((a, b) => a.price - b.price); // Lowest first

    return { buyOrders, sellOrders };
  }

  // Generate candlestick data from trades
  generateCandlesticks(trades, timeframe, limit) {
    if (!trades || trades.length === 0) return [];

    const timeRanges = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };

    const interval = timeRanges[timeframe] || timeRanges['1h'];
    const candleMap = new Map();

    // Group trades by time intervals
    for (const trade of trades) {
      const timestamp = new Date(trade.timestamp).getTime();
      const candleTime = Math.floor(timestamp / interval) * interval;
      const price = parseFloat(trade.price);
      const volume = parseFloat(trade.tokenAmount);

      if (!candleMap.has(candleTime)) {
        candleMap.set(candleTime, {
          timestamp: candleTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 0
        });
      }

      const candle = candleMap.get(candleTime);
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.volume += volume;
    }

    // Convert to array and sort
    const sortedCandles = Array.from(candleMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);

    return sortedCandles;
  }

  // Cleanup on service shutdown
  shutdown() {
    console.log('🔌 Shutting down WebSocket service...');

    // Clear all timers
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.batchTimer) clearInterval(this.batchTimer);

    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch (error) {
        console.error(`Error closing client ${clientId}:`, error);
      }
    }

    // Close WebSocket server
    this.wss.close(() => {
      console.log('✅ WebSocket service shutdown complete');
    });

    this.emit('shutdown');
  }
}

module.exports = WebSocketService;
