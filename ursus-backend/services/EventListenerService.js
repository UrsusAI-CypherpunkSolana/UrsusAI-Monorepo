const { ethers } = require('ethers');
const EventEmitter = require('events');

class EventListenerService extends EventEmitter {
  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(process.env.CORE_RPC_URL || 'https://rpc.test2.btcs.network');
    this.AGENT_FACTORY_ADDRESS = process.env.AGENT_FACTORY_ADDRESS || '0xC783aC13244Cc2454dF4393c556b10ECE4820B1F';

    // Trading service reference (will be set later to avoid circular dependency)
    this.tradingService = null;
    
    // Contract ABIs for events
    this.AGENT_FACTORY_ABI = [
      'event AgentCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, string description, string category)',
      'function agentMetadata(address) view returns (address tokenAddress, string name, string symbol, string description, string category, address creator, uint256 createdAt, bool isActive)'
    ];

    this.AGENT_TOKEN_ABI = [
      'event TokensPurchased(address indexed buyer, uint256 coreAmount, uint256 tokensReceived)',
      'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)',
      'event AgentInteraction(address indexed user, string message)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function getCurrentPrice() view returns (uint256)',
      'function getBondingCurveInfo() view returns (uint256 supply, uint256 reserve, uint256 price, uint256 marketCap)'
    ];

    // Initialize contracts
    this.agentFactory = new ethers.Contract(this.AGENT_FACTORY_ADDRESS, this.AGENT_FACTORY_ABI, this.provider);
    
    // Event storage (in production, use database)
    this.events = [];
    this.agentEvents = new Map(); // agentAddress -> events[]
    this.priceHistory = new Map(); // agentAddress -> price history
    this.volumeData = new Map(); // agentAddress -> volume data
    
    // Start listening
    this.startListening();
  }

  async startListening() {
    console.log('🎧 Starting blockchain event listener...');

    try {
      // Set up error handling for provider
      this.provider.on('error', (error) => {
        if (error.code === 'UNKNOWN_ERROR' && error.error?.message?.includes('filter not found')) {
          // Ignore filter not found errors - they're normal when filters expire
          return;
        }
        console.error('Provider error:', error);
      });

      // Listen to AgentCreated events with error handling
      this.agentFactory.on('AgentCreated', async (tokenAddress, creator, name, symbol, description, category, event) => {
        console.log('🆕 New Agent Created:', { tokenAddress, creator, name, symbol });

        const agentCreatedEvent = {
          type: 'AgentCreated',
          tokenAddress,
          creator,
          name,
          symbol,
          description,
          category,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now()
        };

        this.events.push(agentCreatedEvent);
        this.emit('agentCreated', agentCreatedEvent);
        
        // Start listening to this agent's token events
        await this.listenToAgentToken(tokenAddress);
      });

      // Get historical AgentCreated events
      await this.getHistoricalAgentEvents();

      console.log('✅ Event listener started successfully');
    } catch (error) {
      console.error('❌ Error starting event listener:', error);
    }

    // Set up periodic cleanup to prevent filter accumulation
    setInterval(() => {
      // This helps prevent filter accumulation
      // The actual cleanup is handled by the RPC provider
    }, 60000); // Every minute
  }

  async listenToAgentToken(tokenAddress) {
    try {
      const agentToken = new ethers.Contract(tokenAddress, this.AGENT_TOKEN_ABI, this.provider);
      
      // Listen to TokensPurchased events
      agentToken.on('TokensPurchased', async (buyer, coreAmount, tokensReceived, event) => {
        const purchaseEvent = {
          type: 'TokensPurchased',
          agentAddress: tokenAddress,
          buyer,
          coreAmount: ethers.formatEther(coreAmount),
          tokensReceived: ethers.formatEther(tokensReceived),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now()
        };

        this.addAgentEvent(tokenAddress, purchaseEvent);
        this.updatePriceHistory(tokenAddress);
        this.updateVolumeData(tokenAddress, purchaseEvent.coreAmount);

        // Process trade in trading service
        await this.processTrade({
          agentAddress: tokenAddress,
          userAddress: buyer,
          type: 'buy',
          amount: purchaseEvent.tokensReceived,
          price: (parseFloat(purchaseEvent.coreAmount) / parseFloat(purchaseEvent.tokensReceived)).toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: purchaseEvent.timestamp
        });

        this.emit('tokensPurchased', purchaseEvent);
        console.log('💰 Tokens Purchased:', { tokenAddress, buyer, coreAmount: purchaseEvent.coreAmount });
      });

      // Listen to TokensSold events
      agentToken.on('TokensSold', async (seller, tokensAmount, coreReceived, event) => {
        const saleEvent = {
          type: 'TokensSold',
          agentAddress: tokenAddress,
          seller,
          tokensAmount: ethers.formatEther(tokensAmount),
          coreReceived: ethers.formatEther(coreReceived),
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now()
        };

        this.addAgentEvent(tokenAddress, saleEvent);
        this.updatePriceHistory(tokenAddress);
        this.updateVolumeData(tokenAddress, saleEvent.coreReceived);

        // Process trade in trading service
        await this.processTrade({
          agentAddress: tokenAddress,
          userAddress: seller,
          type: 'sell',
          amount: saleEvent.tokensAmount,
          price: (parseFloat(saleEvent.coreReceived) / parseFloat(saleEvent.tokensAmount)).toString(),
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: saleEvent.timestamp
        });

        this.emit('tokensSold', saleEvent);
        console.log('💸 Tokens Sold:', { tokenAddress, seller, coreReceived: saleEvent.coreReceived });
      });

      // Listen to AgentInteraction events
      agentToken.on('AgentInteraction', async (user, message, event) => {
        const interactionEvent = {
          type: 'AgentInteraction',
          agentAddress: tokenAddress,
          user,
          message,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now()
        };

        this.addAgentEvent(tokenAddress, interactionEvent);
        this.emit('agentInteraction', interactionEvent);
        console.log('💬 Agent Interaction:', { tokenAddress, user });
      });

      console.log(`🎧 Listening to events for agent: ${tokenAddress}`);
    } catch (error) {
      console.error(`❌ Error listening to agent token ${tokenAddress}:`, error);
    }
  }

  async getHistoricalAgentEvents() {
    try {
      console.log('📚 Fetching historical events...');
      
      // Get AgentCreated events from the last 1000 blocks
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      const filter = this.agentFactory.filters.AgentCreated();
      const events = await this.agentFactory.queryFilter(filter, fromBlock, currentBlock);
      
      console.log(`📊 Found ${events.length} historical AgentCreated events`);
      
      for (const event of events) {
        const { tokenAddress, creator, name, symbol, description, category } = event.args;
        
        const agentCreatedEvent = {
          type: 'AgentCreated',
          tokenAddress,
          creator,
          name,
          symbol,
          description,
          category,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now() - (currentBlock - event.blockNumber) * 3000 // Estimate timestamp
        };

        this.events.push(agentCreatedEvent);
        
        // Get historical events for this agent
        await this.getHistoricalAgentTokenEvents(tokenAddress, fromBlock);
        
        // Start listening to future events
        await this.listenToAgentToken(tokenAddress);
      }
    } catch (error) {
      console.error('❌ Error fetching historical events:', error);
    }
  }

  async getHistoricalAgentTokenEvents(tokenAddress, fromBlock) {
    try {
      const agentToken = new ethers.Contract(tokenAddress, this.AGENT_TOKEN_ABI, this.provider);
      
      // Get TokensPurchased events
      const purchaseFilter = agentToken.filters.TokensPurchased();
      const purchaseEvents = await agentToken.queryFilter(purchaseFilter, fromBlock);
      
      // Get TokensSold events
      const saleFilter = agentToken.filters.TokensSold();
      const saleEvents = await agentToken.queryFilter(saleFilter, fromBlock);
      
      // Get AgentInteraction events
      const interactionFilter = agentToken.filters.AgentInteraction();
      const interactionEvents = await agentToken.queryFilter(interactionFilter, fromBlock);
      
      // Process all events
      const allEvents = [...purchaseEvents, ...saleEvents, ...interactionEvents]
        .sort((a, b) => a.blockNumber - b.blockNumber);
      
      for (const event of allEvents) {
        const eventData = {
          agentAddress: tokenAddress,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: Date.now() - (await this.provider.getBlockNumber() - event.blockNumber) * 3000
        };

        if (event.fragment.name === 'TokensPurchased') {
          const { buyer, coreAmount, tokensReceived } = event.args;
          const purchaseEvent = {
            ...eventData,
            type: 'TokensPurchased',
            buyer,
            coreAmount: ethers.formatEther(coreAmount),
            tokensReceived: ethers.formatEther(tokensReceived)
          };
          this.addAgentEvent(tokenAddress, purchaseEvent);
          this.updateVolumeData(tokenAddress, purchaseEvent.coreAmount);
        } else if (event.fragment.name === 'TokensSold') {
          const { seller, tokensAmount, coreReceived } = event.args;
          const saleEvent = {
            ...eventData,
            type: 'TokensSold',
            seller,
            tokensAmount: ethers.formatEther(tokensAmount),
            coreReceived: ethers.formatEther(coreReceived)
          };
          this.addAgentEvent(tokenAddress, saleEvent);
          this.updateVolumeData(tokenAddress, saleEvent.coreReceived);
        } else if (event.fragment.name === 'AgentInteraction') {
          const { user, message } = event.args;
          const interactionEvent = {
            ...eventData,
            type: 'AgentInteraction',
            user,
            message
          };
          this.addAgentEvent(tokenAddress, interactionEvent);
        }
      }
      
      // Initialize price history
      await this.initializePriceHistory(tokenAddress);
      
      console.log(`📊 Processed ${allEvents.length} historical events for ${tokenAddress}`);
    } catch (error) {
      console.error(`❌ Error fetching historical events for ${tokenAddress}:`, error);
    }
  }

  addAgentEvent(agentAddress, event) {
    if (!this.agentEvents.has(agentAddress)) {
      this.agentEvents.set(agentAddress, []);
    }
    this.agentEvents.get(agentAddress).push(event);
  }

  async updatePriceHistory(agentAddress) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
      const currentPrice = await agentToken.getCurrentPrice();
      const priceInEther = ethers.formatEther(currentPrice);
      
      if (!this.priceHistory.has(agentAddress)) {
        this.priceHistory.set(agentAddress, []);
      }
      
      const history = this.priceHistory.get(agentAddress);
      history.push({
        price: priceInEther,
        timestamp: Date.now()
      });
      
      // Keep only last 1000 price points
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    } catch (error) {
      console.error(`❌ Error updating price history for ${agentAddress}:`, error);
    }
  }

  async initializePriceHistory(agentAddress) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
      const currentPrice = await agentToken.getCurrentPrice();
      const priceInEther = ethers.formatEther(currentPrice);
      
      if (!this.priceHistory.has(agentAddress)) {
        this.priceHistory.set(agentAddress, []);
      }
      
      // Add initial price point
      this.priceHistory.get(agentAddress).push({
        price: priceInEther,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ Error initializing price history for ${agentAddress}:`, error);
    }
  }

  updateVolumeData(agentAddress, amount) {
    if (!this.volumeData.has(agentAddress)) {
      this.volumeData.set(agentAddress, {
        volume24h: 0,
        volumeHistory: []
      });
    }
    
    const data = this.volumeData.get(agentAddress);
    const now = Date.now();
    
    // Add to volume history
    data.volumeHistory.push({
      amount: parseFloat(amount),
      timestamp: now
    });
    
    // Calculate 24h volume
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    data.volume24h = data.volumeHistory
      .filter(v => v.timestamp > oneDayAgo)
      .reduce((sum, v) => sum + v.amount, 0);
    
    // Clean old data (keep only last 7 days)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    data.volumeHistory = data.volumeHistory.filter(v => v.timestamp > sevenDaysAgo);
  }

  // Getter methods for analytics
  getAgentEvents(agentAddress, limit = 100) {
    const events = this.agentEvents.get(agentAddress) || [];
    return events.slice(-limit).reverse(); // Most recent first
  }

  getPriceHistory(agentAddress, timeframe = '24h') {
    const history = this.priceHistory.get(agentAddress) || [];
    const now = Date.now();
    
    let cutoff;
    switch (timeframe) {
      case '1h':
        cutoff = now - 60 * 60 * 1000;
        break;
      case '24h':
        cutoff = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        cutoff = now - 24 * 60 * 60 * 1000;
    }
    
    return history.filter(p => p.timestamp > cutoff);
  }

  getVolumeData(agentAddress) {
    return this.volumeData.get(agentAddress) || { volume24h: 0, volumeHistory: [] };
  }

  getAllEvents(limit = 100) {
    return this.events.slice(-limit).reverse();
  }

  // Set trading service reference
  setTradingService(tradingService) {
    this.tradingService = tradingService;
  }

  // Process trade through trading service
  async processTrade(tradeData) {
    if (this.tradingService) {
      try {
        await this.tradingService.processTrade(tradeData);
      } catch (error) {
        console.error('Error processing trade:', error);
      }
    }
  }

  getAgentStats(agentAddress) {
    const events = this.agentEvents.get(agentAddress) || [];
    const volumeData = this.getVolumeData(agentAddress);
    const priceHistory = this.getPriceHistory(agentAddress, '24h');

    // Calculate stats
    const purchases = events.filter(e => e.type === 'TokensPurchased');
    const sales = events.filter(e => e.type === 'TokensSold');
    const interactions = events.filter(e => e.type === 'AgentInteraction');

    const uniqueHolders = new Set([
      ...purchases.map(p => p.buyer),
      ...sales.map(s => s.seller)
    ]).size;

    const transactions24h = events.filter(e =>
      e.timestamp > Date.now() - 24 * 60 * 60 * 1000
    ).length;

    const priceChange24h = priceHistory.length >= 2
      ? ((parseFloat(priceHistory[priceHistory.length - 1].price) - parseFloat(priceHistory[0].price)) / parseFloat(priceHistory[0].price)) * 100
      : 0;

    return {
      holders: uniqueHolders,
      transactions24h,
      volume24h: volumeData.volume24h,
      priceChange24h,
      totalPurchases: purchases.length,
      totalSales: sales.length,
      totalInteractions: interactions.length
    };
  }
}

module.exports = new EventListenerService();
