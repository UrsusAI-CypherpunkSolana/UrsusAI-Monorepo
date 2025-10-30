const { ethers } = require('ethers');
const EventEmitter = require('events');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const PriceHistory = require('../models/PriceHistory');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

class RealTimeDataProcessor extends EventEmitter {
  constructor(blockchainService, databaseService, websocketService) {
    super();

    this.blockchainService = blockchainService;
    this.databaseService = databaseService;
    this.websocketService = websocketService;
    this.provider = blockchainService.provider;

    // Processing queues with priority
    this.tradeQueue = [];
    this.priceUpdateQueue = [];
    this.portfolioUpdateQueue = [];
    this.metricsUpdateQueue = [];
    this.isProcessing = false;

    // Timeframes for chart data
    this.timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];

    // Advanced caching system
    this.priceCache = new Map();
    this.agentCache = new Map();
    this.portfolioCache = new Map();
    this.metricsCache = new Map();

    // Performance tracking
    this.metrics = {
      tradesProcessed: 0,
      priceUpdates: 0,
      portfolioUpdates: 0,
      cacheHits: 0,
      cacheMisses: 0,
      processingTime: 0,
      errors: 0,
      lastProcessedBlock: 0,
      queueSizes: {
        trades: 0,
        prices: 0,
        portfolios: 0,
        metrics: 0
      }
    };

    // Configuration
    this.config = {
      cacheTimeout: 30000, // 30 seconds
      batchSize: 50,
      maxRetries: 3,
      retryDelay: 1000,
      priceUpdateThreshold: 0.001, // 0.1% minimum price change
      volumeUpdateThreshold: 0.01, // 1% minimum volume change
      metricsUpdateInterval: 60000, // 1 minute
      cacheCleanupInterval: 300000, // 5 minutes
      maxCacheSize: 10000,
      maxQueueSize: 1000,
      processingInterval: 100, // 100ms
      priorityProcessingInterval: 50 // 50ms for high priority
    };

    // Processing state
    this.processingStats = {
      startTime: Date.now(),
      totalProcessed: 0,
      averageProcessingTime: 0,
      peakQueueSize: 0,
      lastProcessingTime: 0
    };

    // Initialize timers and processors
    this.initializeProcessors();

    console.log('🔄 Advanced real-time data processor initialized with professional features');
  }

  // Initialize processors and timers
  initializeProcessors() {
    console.log('🔧 Initializing advanced processing systems...');

    // Start queue processors
    this.startQueueProcessors();

    // Start cache management
    this.startCacheManagement();

    // Start metrics collection
    this.startMetricsCollection();

    // Setup cleanup tasks
    this.setupCleanupTasks();
  }

  // Start queue processing systems
  startQueueProcessors() {
    // High priority processor for trades
    setInterval(() => {
      this.processTradeQueue();
    }, this.config.priorityProcessingInterval);

    // Standard processors
    setInterval(() => {
      this.processPriceUpdateQueue();
    }, this.config.processingInterval);

    setInterval(() => {
      this.processPortfolioUpdateQueue();
    }, this.config.processingInterval);

    setInterval(() => {
      this.processMetricsUpdateQueue();
    }, this.config.metricsUpdateInterval);
  }

  // Start cache management
  startCacheManagement() {
    setInterval(() => {
      this.cleanupCaches();
    }, this.config.cacheCleanupInterval);
  }

  // Start metrics collection
  startMetricsCollection() {
    setInterval(() => {
      this.collectAndEmitMetrics();
    }, this.config.metricsUpdateInterval);
  }

  // Setup cleanup tasks
  setupCleanupTasks() {
    // Cleanup old price history data
    setInterval(() => {
      this.cleanupOldPriceHistory();
    }, 24 * 60 * 60 * 1000); // Daily

    // Cleanup old trade data
    setInterval(() => {
      this.cleanupOldTrades();
    }, 7 * 24 * 60 * 60 * 1000); // Weekly
  }

  // Enhanced trade event processing with queuing
  async processTradeEvent(event, agentAddress) {
    try {
      console.log(`🔄 Queuing trade event for ${agentAddress}:`, event.args);

      // Add to high priority queue
      this.tradeQueue.push({
        event,
        agentAddress,
        timestamp: Date.now(),
        priority: 'high',
        retries: 0
      });

      // Update queue metrics
      this.updateQueueMetrics();

      // Process immediately if queue is small
      if (this.tradeQueue.length <= 5 && !this.isProcessing) {
        await this.processTradeQueue();
      }

    } catch (error) {
      console.error('❌ Error queuing trade event:', error);
      this.metrics.errors++;
    }
  }

  // Process trade queue with batching and error handling
  async processTradeQueue() {
    if (this.isProcessing || this.tradeQueue.length === 0) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Process in batches
      const batch = this.tradeQueue.splice(0, this.config.batchSize);
      const processedTrades = [];

      for (const queueItem of batch) {
        try {
          const trade = await this.processTradeEventInternal(queueItem.event, queueItem.agentAddress);
          if (trade) {
            processedTrades.push(trade);
          }
        } catch (error) {
          console.error(`❌ Error processing trade in batch:`, error);

          // Retry logic
          if (queueItem.retries < this.config.maxRetries) {
            queueItem.retries++;
            this.tradeQueue.push(queueItem);
          } else {
            console.error(`❌ Max retries exceeded for trade event`);
            this.metrics.errors++;
          }
        }
      }

      // Batch broadcast updates
      if (processedTrades.length > 0) {
        await this.batchBroadcastTradeUpdates(processedTrades);
      }

      // Update metrics
      this.metrics.tradesProcessed += processedTrades.length;
      this.processingStats.totalProcessed += processedTrades.length;
      this.processingStats.lastProcessingTime = Date.now() - startTime;

      console.log(`✅ Processed ${processedTrades.length} trades in ${this.processingStats.lastProcessingTime}ms`);

    } catch (error) {
      console.error('❌ Error in trade queue processing:', error);
      this.metrics.errors++;
    } finally {
      this.isProcessing = false;
    }
  }

  // Internal trade processing logic
  async processTradeEventInternal(event, agentAddress) {
    const block = await this.provider.getBlock(event.blockNumber);
    const transaction = await this.provider.getTransaction(event.transactionHash);

    // Determine trade type and extract data
    const isTokensPurchased = event.fragment.name === 'TokensPurchased';
    const tradeType = isTokensPurchased ? 'buy' : 'sell';

    const trader = event.args.buyer || event.args.seller;
    const tokenAmount = event.args.tokensAmount;
    const coreAmount = event.args.coreSpent || event.args.coreReceived;

    // Get agent data with caching
    const agent = await this.getAgentWithCache(agentAddress);
    if (!agent) {
      console.warn(`⚠️ Agent not found: ${agentAddress}`);
      return null;
    }

    // Calculate price
    const price = parseFloat(ethers.formatEther(coreAmount)) / parseFloat(ethers.formatEther(tokenAmount));

    // Create trade record
    const trade = new Trade({
      agentAddress: agentAddress.toLowerCase(),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: new Date(block.timestamp * 1000),
      trader: trader.toLowerCase(),
      type: tradeType,
      coreAmount: ethers.formatEther(coreAmount),
      tokenAmount: ethers.formatEther(tokenAmount),
      price: price,
      priceUsd: price, // For now, assuming SOL = USD
      gasUsed: transaction.gasLimit ? Number(transaction.gasLimit) : 0,
      gasPrice: transaction.gasPrice ? ethers.formatUnits(transaction.gasPrice, 'gwei') : '0'
    });

    await trade.save();
    console.log(`✅ Trade saved: ${tradeType} ${ethers.formatEther(tokenAmount)} tokens at ${price.toFixed(6)} SOL`);

    // Queue updates instead of processing immediately
    this.queueAgentMetricsUpdate(agent, trade);
    this.queuePortfolioUpdate(trader, agentAddress, trade);
    this.queuePriceHistoryUpdate(agentAddress, trade, block.timestamp);

    // Update cache
    this.updatePriceCache(agentAddress, price);

    return { trade, agent, block };
  }

  // Update agent metrics with new trade data
  async updateAgentMetrics(agent, trade) {
    try {
      const agentAddress = agent.contractAddress;
      
      // Get all trades for this agent in the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTrades = await Trade.find({
        agentAddress: agentAddress,
        timestamp: { $gte: twentyFourHoursAgo }
      });
      
      // Calculate 24h metrics
      const volume24h = recentTrades.reduce((sum, t) => sum + parseFloat(t.coreAmount), 0);
      const totalTrades = await Trade.countDocuments({ agentAddress });
      
      // Get price data
      const latestTrade = await Trade.findOne({ agentAddress }).sort({ timestamp: -1 });
      const oldestTrade24h = recentTrades.length > 0 ? 
        recentTrades.sort((a, b) => a.timestamp - b.timestamp)[0] : null;
      
      const currentPrice = latestTrade ? latestTrade.price : parseFloat(agent.tokenomics.currentPrice);
      const priceChange24h = oldestTrade24h ? 
        currentPrice - oldestTrade24h.price : 0;
      
      // Get all-time high and low
      const priceStats = await Trade.aggregate([
        { $match: { agentAddress } },
        {
          $group: {
            _id: null,
            maxPrice: { $max: '$price' },
            minPrice: { $min: '$price' }
          }
        }
      ]);
      
      const allTimeHigh = priceStats.length > 0 ? priceStats[0].maxPrice : currentPrice;
      const allTimeLow = priceStats.length > 0 ? priceStats[0].minPrice : currentPrice;
      
      // Count unique holders
      const holders = await Portfolio.countDocuments({
        agentAddress,
        balance: { $gt: '0' },
        isActive: true
      });
      
      // Calculate market cap
      const totalSupply = parseFloat(agent.tokenomics.totalSupply);
      const marketCap = currentPrice * totalSupply;
      
      // Update agent
      await Agent.updateOne(
        { contractAddress: agentAddress },
        {
          $set: {
            'tokenomics.currentPrice': currentPrice.toString(),
            'tokenomics.marketCap': marketCap.toString(),
            'metrics.holders': holders,
            'metrics.totalTransactions': totalTrades,
            'metrics.volume24h': volume24h,
            'metrics.priceChange24h': priceChange24h,
            'metrics.allTimeHigh': allTimeHigh.toString(),
            'metrics.allTimeLow': allTimeLow.toString(),
            lastPriceUpdate: new Date()
          }
        }
      );
      
      console.log(`✅ Agent metrics updated for ${agentAddress}`);
      
    } catch (error) {
      console.error('❌ Error updating agent metrics:', error);
    }
  }

  // Update user portfolio
  async updateUserPortfolio(userAddress, agentAddress, trade) {
    try {
      // Find or create user
      let user = await User.findOne({ walletAddress: userAddress.toLowerCase() });
      if (!user) {
        user = new User({
          walletAddress: userAddress.toLowerCase(),
          username: null,
          email: null
        });
        await user.save();
      }
      
      // Find or create portfolio
      let portfolio = await Portfolio.findOne({
        userAddress: userAddress.toLowerCase(),
        agentAddress: agentAddress.toLowerCase()
      });
      
      if (!portfolio) {
        const agent = await Agent.findOne({ 
          contractAddress: agentAddress.toLowerCase() 
        });
        
        portfolio = new Portfolio({
          user: user._id,
          userAddress: userAddress.toLowerCase(),
          agent: agent._id,
          agentAddress: agentAddress.toLowerCase()
        });
      }
      
      // Update portfolio with trade
      const tokenAmount = parseFloat(trade.tokenAmount);
      const coreAmount = parseFloat(trade.coreAmount);
      const price = trade.price;
      
      if (trade.type === 'buy') {
        // Add to position
        const currentBalance = parseFloat(portfolio.balance);
        const currentInvested = parseFloat(portfolio.totalInvested);
        
        const newBalance = currentBalance + tokenAmount;
        const newInvested = currentInvested + coreAmount;
        const newAvgPrice = newInvested / newBalance;
        
        portfolio.balance = newBalance.toString();
        portfolio.totalInvested = newInvested.toString();
        portfolio.averageBuyPrice = newAvgPrice.toString();
        
      } else {
        // Reduce position
        const currentBalance = parseFloat(portfolio.balance);
        const currentInvested = parseFloat(portfolio.totalInvested);
        
        const newBalance = Math.max(0, currentBalance - tokenAmount);
        const sellRatio = tokenAmount / currentBalance;
        const newInvested = currentInvested * (1 - sellRatio);
        
        portfolio.balance = newBalance.toString();
        portfolio.totalInvested = newInvested.toString();
        
        // Calculate realized P&L
        const costBasis = parseFloat(portfolio.averageBuyPrice) * tokenAmount;
        const saleValue = coreAmount;
        const realizedPnL = saleValue - costBasis;
        
        portfolio.realizedPnL = (parseFloat(portfolio.realizedPnL) + realizedPnL).toString();
      }
      
      // Update current value
      portfolio.currentValue = (parseFloat(portfolio.balance) * price).toString();
      portfolio.lastTradeAt = trade.timestamp;
      
      await portfolio.save();
      
      console.log(`✅ Portfolio updated for ${userAddress}`);
      
    } catch (error) {
      console.error('❌ Error updating portfolio:', error);
    }
  }

  // Update price history for chart data
  async updatePriceHistory(agentAddress, trade, blockTimestamp) {
    try {
      const timestamp = new Date(blockTimestamp * 1000);
      
      // Update price history for each timeframe
      for (const timeframe of this.timeframes) {
        await this.updatePriceHistoryForTimeframe(agentAddress, trade, timestamp, timeframe);
      }
      
    } catch (error) {
      console.error('❌ Error updating price history:', error);
    }
  }

  async updatePriceHistoryForTimeframe(agentAddress, trade, timestamp, timeframe) {
    try {
      // Calculate interval start time
      const intervalStart = this.getIntervalStart(timestamp, timeframe);
      
      // Find existing candle or create new one
      let candle = await PriceHistory.findOne({
        agentAddress: agentAddress.toLowerCase(),
        timeframe,
        timestamp: intervalStart
      });
      
      if (!candle) {
        // Create new candle
        candle = new PriceHistory({
          agentAddress: agentAddress.toLowerCase(),
          timeframe,
          timestamp: intervalStart,
          open: trade.price.toString(),
          high: trade.price.toString(),
          low: trade.price.toString(),
          close: trade.price.toString(),
          volume: trade.coreAmount,
          trades: 1,
          blockNumber: trade.blockNumber
        });
      } else {
        // Update existing candle
        candle.high = Math.max(parseFloat(candle.high), trade.price).toString();
        candle.low = Math.min(parseFloat(candle.low), trade.price).toString();
        candle.close = trade.price.toString();
        candle.volume = (parseFloat(candle.volume) + parseFloat(trade.coreAmount)).toString();
        candle.trades += 1;
        candle.blockNumber = Math.max(candle.blockNumber, trade.blockNumber);
      }
      
      await candle.save();
      
    } catch (error) {
      console.error(`❌ Error updating price history for ${timeframe}:`, error);
    }
  }

  // Get interval start time for timeframe
  getIntervalStart(timestamp, timeframe) {
    const date = new Date(timestamp);
    
    switch (timeframe) {
      case '1m':
        date.setSeconds(0, 0);
        break;
      case '5m':
        date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
        break;
      case '15m':
        date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
        break;
      case '1h':
        date.setMinutes(0, 0, 0);
        break;
      case '4h':
        date.setHours(Math.floor(date.getHours() / 4) * 4, 0, 0, 0);
        break;
      case '1d':
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }

  // Broadcast real-time updates
  broadcastTradeUpdate(agentAddress, trade, agent) {
    if (this.websocketService) {
      this.websocketService.broadcast({
        type: 'tradeUpdate',
        agentAddress,
        trade: {
          type: trade.type,
          amount: trade.tokenAmount,
          price: trade.price,
          timestamp: trade.timestamp,
          trader: trade.trader
        },
        agent: {
          currentPrice: agent.tokenomics.currentPrice,
          marketCap: agent.tokenomics.marketCap,
          volume24h: agent.metrics.volume24h,
          priceChange24h: agent.metrics.priceChange24h
        },
        timestamp: Date.now()
      });
    }
  }

  // Clear relevant caches
  async clearRelevantCaches(agentAddress) {
    if (this.databaseService) {
      await this.databaseService.clearCachePattern(`agent:${agentAddress}:*`);
      await this.databaseService.clearCachePattern(`chart:${agentAddress}:*`);
      await this.databaseService.clearCachePattern(`price:${agentAddress}:*`);
    }
  }
  // Advanced caching system
  async getAgentWithCache(agentAddress) {
    const cacheKey = `agent:${agentAddress.toLowerCase()}`;

    // Check cache first
    if (this.agentCache.has(cacheKey)) {
      const cached = this.agentCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
        this.metrics.cacheHits++;
        return cached.data;
      }
    }

    // Cache miss - fetch from database
    this.metrics.cacheMisses++;
    const agent = await Agent.findOne({
      contractAddress: agentAddress.toLowerCase()
    });

    if (agent) {
      this.agentCache.set(cacheKey, {
        data: agent,
        timestamp: Date.now()
      });
    }

    return agent;
  }

  // Update price cache
  updatePriceCache(agentAddress, price) {
    const cacheKey = `price:${agentAddress.toLowerCase()}`;
    this.priceCache.set(cacheKey, {
      price,
      timestamp: Date.now()
    });
  }

  // Queue management functions
  queueAgentMetricsUpdate(agent, trade) {
    this.metricsUpdateQueue.push({
      type: 'agent_metrics',
      agent,
      trade,
      timestamp: Date.now(),
      priority: 'medium'
    });
  }

  queuePortfolioUpdate(trader, agentAddress, trade) {
    this.portfolioUpdateQueue.push({
      type: 'portfolio',
      trader,
      agentAddress,
      trade,
      timestamp: Date.now(),
      priority: 'medium'
    });
  }

  queuePriceHistoryUpdate(agentAddress, trade, blockTimestamp) {
    this.priceUpdateQueue.push({
      type: 'price_history',
      agentAddress,
      trade,
      blockTimestamp,
      timestamp: Date.now(),
      priority: 'low'
    });
  }

  // Update queue metrics
  updateQueueMetrics() {
    this.metrics.queueSizes = {
      trades: this.tradeQueue.length,
      prices: this.priceUpdateQueue.length,
      portfolios: this.portfolioUpdateQueue.length,
      metrics: this.metricsUpdateQueue.length
    };

    // Track peak queue sizes
    const totalQueueSize = Object.values(this.metrics.queueSizes).reduce((a, b) => a + b, 0);
    if (totalQueueSize > this.processingStats.peakQueueSize) {
      this.processingStats.peakQueueSize = totalQueueSize;
    }

    // Emit warning if queues are getting too large
    if (totalQueueSize > this.config.maxQueueSize * 0.8) {
      console.warn(`⚠️ Queue sizes approaching limit: ${totalQueueSize}/${this.config.maxQueueSize}`);
      this.emit('queueWarning', { queueSizes: this.metrics.queueSizes, totalSize: totalQueueSize });
    }
  }

  // Process price update queue
  async processPriceUpdateQueue() {
    if (this.priceUpdateQueue.length === 0) return;

    const batch = this.priceUpdateQueue.splice(0, this.config.batchSize);

    for (const update of batch) {
      try {
        await this.updatePriceHistory(update.agentAddress, update.trade, update.blockTimestamp);
        this.metrics.priceUpdates++;
      } catch (error) {
        console.error('❌ Error processing price update:', error);
        this.metrics.errors++;
      }
    }
  }

  // Process portfolio update queue
  async processPortfolioUpdateQueue() {
    if (this.portfolioUpdateQueue.length === 0) return;

    const batch = this.portfolioUpdateQueue.splice(0, this.config.batchSize);

    for (const update of batch) {
      try {
        await this.updateUserPortfolio(update.trader, update.agentAddress, update.trade);
        this.metrics.portfolioUpdates++;
      } catch (error) {
        console.error('❌ Error processing portfolio update:', error);
        this.metrics.errors++;
      }
    }
  }

  // Process metrics update queue
  async processMetricsUpdateQueue() {
    if (this.metricsUpdateQueue.length === 0) return;

    const batch = this.metricsUpdateQueue.splice(0, this.config.batchSize);

    for (const update of batch) {
      try {
        await this.updateAgentMetrics(update.agent, update.trade);
      } catch (error) {
        console.error('❌ Error processing metrics update:', error);
        this.metrics.errors++;
      }
    }
  }

  // Batch broadcast trade updates
  async batchBroadcastTradeUpdates(processedTrades) {
    try {
      const updates = processedTrades.map(({ trade, agent }) => ({
        type: 'tradeUpdate',
        agentAddress: trade.agentAddress,
        trade: {
          type: trade.type,
          amount: trade.tokenAmount,
          price: trade.price,
          timestamp: trade.timestamp,
          trader: trade.trader,
          txHash: trade.transactionHash
        },
        agent: {
          currentPrice: agent.tokenomics?.currentPrice,
          marketCap: agent.tokenomics?.marketCap,
          volume24h: agent.metrics?.volume24h,
          priceChange24h: agent.metrics?.priceChange24h
        },
        timestamp: Date.now()
      }));

      // Broadcast to WebSocket service
      if (this.websocketService) {
        for (const update of updates) {
          this.websocketService.broadcast(update.type, update, `agent:${update.agentAddress}`);
          this.websocketService.broadcast(update.type, update, 'platform');
        }
      }

      console.log(`📡 Broadcasted ${updates.length} trade updates`);

    } catch (error) {
      console.error('❌ Error in batch broadcast:', error);
      this.metrics.errors++;
    }
  }

  // Cache cleanup
  cleanupCaches() {
    const now = Date.now();
    let cleaned = 0;

    // Clean agent cache
    for (const [key, value] of this.agentCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.agentCache.delete(key);
        cleaned++;
      }
    }

    // Clean price cache
    for (const [key, value] of this.priceCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.priceCache.delete(key);
        cleaned++;
      }
    }

    // Clean portfolio cache
    for (const [key, value] of this.portfolioCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.portfolioCache.delete(key);
        cleaned++;
      }
    }

    // Clean metrics cache
    for (const [key, value] of this.metricsCache.entries()) {
      if (now - value.timestamp > this.config.cacheTimeout) {
        this.metricsCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} expired cache entries`);
    }

    // Enforce max cache size
    this.enforceCacheSize();
  }

  // Enforce cache size limits
  enforceCacheSize() {
    const caches = [
      { cache: this.agentCache, name: 'agent' },
      { cache: this.priceCache, name: 'price' },
      { cache: this.portfolioCache, name: 'portfolio' },
      { cache: this.metricsCache, name: 'metrics' }
    ];

    for (const { cache, name } of caches) {
      if (cache.size > this.config.maxCacheSize / 4) {
        // Remove oldest entries
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        const toRemove = cache.size - Math.floor(this.config.maxCacheSize / 4);
        for (let i = 0; i < toRemove; i++) {
          cache.delete(entries[i][0]);
        }

        console.log(`🧹 Enforced size limit on ${name} cache: removed ${toRemove} entries`);
      }
    }
  }

  // Collect and emit metrics
  collectAndEmitMetrics() {
    const now = Date.now();
    const uptime = now - this.processingStats.startTime;

    const currentMetrics = {
      ...this.metrics,
      uptime,
      averageProcessingTime: this.processingStats.totalProcessed > 0
        ? this.processingStats.lastProcessingTime / this.processingStats.totalProcessed
        : 0,
      cacheEfficiency: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100,
      processingRate: this.processingStats.totalProcessed / (uptime / 1000), // per second
      queueUtilization: Object.values(this.metrics.queueSizes).reduce((a, b) => a + b, 0) / this.config.maxQueueSize * 100
    };

    this.emit('metrics', currentMetrics);

    // Log metrics periodically
    if (currentMetrics.tradesProcessed > 0) {
      console.log(`📊 Data Processor Metrics: ${currentMetrics.tradesProcessed} trades, ${currentMetrics.cacheEfficiency.toFixed(1)}% cache efficiency, ${currentMetrics.processingRate.toFixed(2)} trades/sec`);
    }
  }

  // Cleanup old data
  async cleanupOldPriceHistory() {
    try {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
      const result = await PriceHistory.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old price history records`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up price history:', error);
    }
  }

  async cleanupOldTrades() {
    try {
      const cutoffDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year
      const result = await Trade.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old trade records`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up trades:', error);
    }
  }

  // Shutdown gracefully
  async shutdown() {
    console.log('🔄 Shutting down real-time data processor...');

    // Process remaining queues
    await this.processTradeQueue();
    await this.processPriceUpdateQueue();
    await this.processPortfolioUpdateQueue();
    await this.processMetricsUpdateQueue();

    // Clear caches
    this.agentCache.clear();
    this.priceCache.clear();
    this.portfolioCache.clear();
    this.metricsCache.clear();

    console.log('✅ Real-time data processor shutdown complete');
    this.emit('shutdown');
  }
}

module.exports = RealTimeDataProcessor;
