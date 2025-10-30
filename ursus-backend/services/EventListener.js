const { ethers } = require('ethers');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');

class EventListener {
  constructor(blockchainService, websocketService) {
    this.blockchainService = blockchainService;
    this.websocketService = websocketService;
    this.provider = blockchainService.provider;
    this.agentFactory = blockchainService.agentFactory;
    this.dataProcessor = null; // Will be set by server.js

    // In-memory storage for agent stats (in production, use Redis or database)
    this.agentStats = new Map();
    this.agentList = new Set();

    this.setupEventListeners();
  }

  setupEventListeners() {
    console.log('🎧 Setting up blockchain event listeners...');

    // Avoid ambiguous listeners and register explicit signatures
    try {
      // Remove all listeners to start clean; avoids ethers ambiguous getEvent
      this.agentFactory.removeAllListeners();
    } catch {}

    // ✅ DOĞRU: Sadece event adını kullan
    this.agentFactory.on('AgentCreated', async (tokenAddress, creator, name, symbol, description, category, event) => {
      await this.handleAgentCreatedNormalized(tokenAddress, creator, name, symbol, description, category, event);
    });


    // Listen for Transfer events (token purchases/sales)
    // Note: We would need to listen to all agent token contracts
    // For now, we'll implement a polling mechanism for active agents
    this.setupTradingEventListeners();

    console.log('✅ Event listeners setup complete');
  }

  // Shared handler to persist and broadcast AgentCreated
// Shared handler to persist and broadcast AgentCreated
async handleAgentCreatedNormalized(tokenAddress, creator, name, symbol, description, category, event) {
  console.log('🎉 AgentCreated event:', { tokenAddress, creator, name, symbol, description, category, blockNumber: event.blockNumber, transactionHash: event.transactionHash });

  try {
    // Listeye ekle + başlangıç istatistikleri
    this.agentList.add(tokenAddress.toLowerCase());
    this.agentStats.set(tokenAddress.toLowerCase(), {
      holders: 1,
      transactions24h: 1,
      volume24h: 0,
      totalVolume: 0,
      createdAt: Date.now(),
      lastActivity: Date.now()
    });

    // Full detayları dene; patlarsa minimal kayda düş
    let agentDetails = null;
    try {
      agentDetails = await this.blockchainService.getAgentDetails(tokenAddress);
    } catch (e) {
      console.warn('getAgentDetails failed, saving minimal agent:', e.message);
      agentDetails = {
        totalSupply: '0',
        currentPrice: '0',
        bondingCurveInfo: { marketCap: '0', reserve: '0' },
        agentInfo: {}
      };
    }

    // Pending create verisini al (varsa)
    const creationKey = `${creator.toLowerCase()}_${name}_${symbol}`;
    const pendingData = global.pendingAgentCreations?.get(creationKey);
    const agentData = pendingData || {};

    // DB kaydı — agentDetails yoksa default kullan
    const newAgent = new Agent({
      contractAddress: tokenAddress,
      name,
      symbol,
      description: description || agentDetails?.metadata?.description || '',
      category: category || agentDetails?.metadata?.category || 'General',
      creator,
      instructions:
        agentData.instructions ||
        `You are ${name}, a helpful AI agent specialized in ${(category || 'agents').toLowerCase()}.`,
      model: agentData.model || 'claude-3',
      avatar: agentData.avatar || '🤖',
      image: agentData.imageUrl || null,
      tokenomics: {
        totalSupply: agentDetails?.totalSupply || '0',
        currentPrice: agentDetails?.currentPrice || '0',
        marketCap: agentDetails?.bondingCurveInfo?.marketCap || '0',
        reserve: agentDetails?.bondingCurveInfo?.reserve || '0',
        bondingCurveParams: { reserveRatio: 500000, slope: 1 }
      },
      metrics: {
        holders: 1,
        totalTransactions: 1,
        volume24h: 0,
        priceChange24h: 0,
        lastActivity: new Date()
      },
      status: { isActive: true, isVerified: false, isListed: false },
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      createdAt: new Date()
    });

    await newAgent.save();
    console.log('💾 Agent saved to database:', tokenAddress);

    if (pendingData) {
      global.pendingAgentCreations?.delete(creationKey);
      console.log('🧹 Cleaned up pending creation data for:', creationKey);
    }

    // WS yayını
    this.websocketService.broadcast({
      type: 'agentCreated',
      data: {
        address: tokenAddress,
        creator,
        name,
        symbol,
        description,
        category,
        ...agentDetails,
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      },
      timestamp: Date.now()
    });

    console.log('✅ AgentCreated event processed and broadcasted');
  } catch (error) {
    console.error('❌ Error processing AgentCreated event:', error);
  }
}



  // Setup trading event listeners for all agent tokens
  async setupTradingEventListeners() {
    try {
      console.log('🎧 Setting up trading event listeners...');

      // Get all active agents from database
      const agents = await Agent.find({ 'status.isActive': true });

      for (const agent of agents) {
        await this.setupAgentTokenListeners(agent.contractAddress);
      }

      console.log(`✅ Trading event listeners setup for ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Error setting up trading event listeners:', error);
    }
  }

  // Setup event listeners for a specific agent token
  async setupAgentTokenListeners(tokenAddress) {
    try {
      const agentTokenABI = [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event TokensPurchased(address indexed buyer, uint256 coreAmount, uint256 tokensReceived, uint256 newPrice)',
        'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived, uint256 newPrice)',
        'event PriceUpdated(uint256 newPrice, uint256 marketCap, uint256 reserve)'
      ];

      const agentToken = new ethers.Contract(tokenAddress, agentTokenABI, this.provider);

      // Listen for token purchases
      agentToken.on('TokensPurchased', async (buyer, coreAmount, tokensReceived, newPrice, event) => {
        await this.handleTokensPurchased(tokenAddress, buyer, coreAmount, tokensReceived, newPrice, event);
      });

      // Listen for token sales
      agentToken.on('TokensSold', async (seller, tokensAmount, coreReceived, newPrice, event) => {
        await this.handleTokensSold(tokenAddress, seller, tokensAmount, coreReceived, newPrice, event);
      });

      // Listen for price updates
      agentToken.on('PriceUpdated', async (newPrice, marketCap, reserve, event) => {
        await this.handlePriceUpdated(tokenAddress, newPrice, marketCap, reserve, event);
      });

      // Listen for graduation events
      agentToken.on('TokenGraduated', async (token, reserveAmount, liquidityTokens, event) => {
        await this.handleTokenGraduated(tokenAddress, reserveAmount, liquidityTokens, event);
      });

      console.log(`🎧 Event listeners setup for agent token: ${tokenAddress}`);
    } catch (error) {
      console.error(`❌ Error setting up listeners for ${tokenAddress}:`, error);
    }
  }

  // Get agent stats
  getAgentStats(address) {
    const normalizedAddress = address.toLowerCase();
    return this.agentStats.get(normalizedAddress) || {
      holders: 0,
      transactions24h: 0,
      volume24h: 0,
      totalVolume: 0,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
  }

  // Handle tokens purchased event
  async handleTokensPurchased(tokenAddress, buyer, coreAmount, tokensReceived, newPrice, event) {
    try {
      console.log('💰 TokensPurchased event:', {
        tokenAddress,
        buyer,
        coreAmount: ethers.formatEther(coreAmount),
        tokensReceived: ethers.formatEther(tokensReceived),
        newPrice: ethers.formatEther(newPrice)
      });

      // Save trade to database
      const tradeData = {
        agentAddress: tokenAddress.toLowerCase(),
        userAddress: buyer.toLowerCase(),
        type: 'buy',
        amount: ethers.formatEther(tokensReceived),
        price: ethers.formatEther(newPrice),
        coreAmount: ethers.formatEther(coreAmount),
        timestamp: new Date(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      };

      await this.saveTrade(tradeData);

      // Update agent metrics
      await this.updateAgentMetrics(tokenAddress, 'buy', parseFloat(ethers.formatEther(coreAmount)));

      // Update user portfolio
      await this.updateUserPortfolio(buyer, tokenAddress, 'buy', tradeData);

      // Broadcast to WebSocket clients
      this.websocketService.broadcastTradingEvent('tokensPurchased', {
        agentAddress: tokenAddress,
        buyer,
        coreAmount: ethers.formatEther(coreAmount),
        tokensReceived: ethers.formatEther(tokensReceived),
        newPrice: ethers.formatEther(newPrice),
        transactionHash: event.transactionHash
      });

      console.log('✅ TokensPurchased event processed');
    } catch (error) {
      console.error('❌ Error handling TokensPurchased event:', error);
    }
  }

  // Handle tokens sold event
  async handleTokensSold(tokenAddress, seller, tokensAmount, coreReceived, newPrice, event) {
    try {
      console.log('💸 TokensSold event:', {
        tokenAddress,
        seller,
        tokensAmount: ethers.formatEther(tokensAmount),
        coreReceived: ethers.formatEther(coreReceived),
        newPrice: ethers.formatEther(newPrice)
      });

      // Save trade to database
      const tradeData = {
        agentAddress: tokenAddress.toLowerCase(),
        userAddress: seller.toLowerCase(),
        type: 'sell',
        amount: ethers.formatEther(tokensAmount),
        price: ethers.formatEther(newPrice),
        coreAmount: ethers.formatEther(coreReceived),
        timestamp: new Date(),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      };

      await this.saveTrade(tradeData);

      // Update agent metrics
      await this.updateAgentMetrics(tokenAddress, 'sell', parseFloat(ethers.formatEther(coreReceived)));

      // Update user portfolio
      await this.updateUserPortfolio(seller, tokenAddress, 'sell', tradeData);

      // Broadcast to WebSocket clients
      this.websocketService.broadcastTradingEvent('tokensSold', {
        agentAddress: tokenAddress,
        seller,
        tokensAmount: ethers.formatEther(tokensAmount),
        coreReceived: ethers.formatEther(coreReceived),
        newPrice: ethers.formatEther(newPrice),
        transactionHash: event.transactionHash
      });

      console.log('✅ TokensSold event processed');
    } catch (error) {
      console.error('❌ Error handling TokensSold event:', error);
    }
  }

  // Handle price updated event
  async handlePriceUpdated(tokenAddress, newPrice, marketCap, reserve, event) {
    try {
      console.log(' PriceUpdated event:', {
        tokenAddress,
        newPrice: ethers.formatEther(newPrice),
        marketCap: ethers.formatEther(marketCap),
        reserve: ethers.formatEther(reserve)
      });

      // Update agent price data
      await Agent.findOneAndUpdate(
        { contractAddress: tokenAddress.toLowerCase() },
        {
          'tokenomics.currentPrice': ethers.formatEther(newPrice),
          'tokenomics.marketCap': ethers.formatEther(marketCap),
          'tokenomics.reserve': ethers.formatEther(reserve),
          lastPriceUpdate: new Date()
        }
      );

      // Broadcast price update
      this.websocketService.broadcastPriceUpdate(tokenAddress, {
        newPrice: ethers.formatEther(newPrice),
        marketCap: ethers.formatEther(marketCap),
        reserve: ethers.formatEther(reserve),
        timestamp: Date.now()
      });

      console.log('✅ PriceUpdated event processed');
    } catch (error) {
      console.error('❌ Error handling PriceUpdated event:', error);
    }
  }

  // Save trade to database
  async saveTrade(tradeData) {
    try {
      const trade = new Trade(tradeData);
      await trade.save();
      console.log('💾 Trade saved:', tradeData.type, tradeData.coreAmount, 'CORE');
    } catch (error) {
      console.error('❌ Error saving trade:', error);
    }
  }

  // Update agent metrics
  async updateAgentMetrics(tokenAddress, tradeType, coreAmount) {
    try {
      const updateData = {
        $inc: {
          'metrics.totalTransactions': 1,
          'metrics.volumeTotal': coreAmount
        },
        lastPriceUpdate: new Date()
      };

      await Agent.findOneAndUpdate(
        { contractAddress: tokenAddress.toLowerCase() },
        updateData
      );

      console.log(`📊 Agent metrics updated for ${tokenAddress}: ${tradeType} ${coreAmount} CORE`);

      // Note: volume24h will be calculated by RealTimeDataProcessor from actual trades
    } catch (error) {
      console.error('❌ Error updating agent metrics:', error);
    }
  }

  // Handle token graduation event
  async handleTokenGraduated(tokenAddress, reserveAmount, liquidityTokens, event) {
    try {
      console.log('🎓 TokenGraduated event:', {
        tokenAddress,
        reserveAmount: ethers.formatEther(reserveAmount),
        liquidityTokens: ethers.formatEther(liquidityTokens)
      });

      // Update agent status to graduated
      await Agent.findOneAndUpdate(
        { contractAddress: tokenAddress.toLowerCase() },
        {
          'status.isGraduated': true,
          'status.graduationDate': new Date(),
          'tokenomics.liquidityTokens': ethers.formatEther(liquidityTokens),
          'tokenomics.graduationReserve': ethers.formatEther(reserveAmount),
          lastPriceUpdate: new Date()
        }
      );

      // Broadcast graduation event
      this.websocketService.broadcastToAll('tokenGraduated', {
        agentAddress: tokenAddress,
        reserveAmount: ethers.formatEther(reserveAmount),
        liquidityTokens: ethers.formatEther(liquidityTokens),
        transactionHash: event.transactionHash,
        timestamp: Date.now()
      });

      console.log('✅ TokenGraduated event processed');
    } catch (error) {
      console.error('❌ Error handling TokenGraduated event:', error);
    }
  }

  // Update user portfolio
  async updateUserPortfolio(userAddress, tokenAddress, tradeType, tradeData) {
    try {
      const portfolio = await Portfolio.findOneAndUpdate(
        {
          userAddress: userAddress.toLowerCase(),
          agentAddress: tokenAddress.toLowerCase()
        },
        {
          userAddress: userAddress.toLowerCase(),
          agentAddress: tokenAddress.toLowerCase(),
          lastActivity: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );

      // Update portfolio based on trade type
      if (tradeType === 'buy') {
        portfolio.balance = (parseFloat(portfolio.balance || '0') + parseFloat(tradeData.amount)).toString();
        portfolio.totalInvested = (parseFloat(portfolio.totalInvested || '0') + parseFloat(tradeData.coreAmount)).toString();
      } else if (tradeType === 'sell') {
        portfolio.balance = Math.max(0, parseFloat(portfolio.balance || '0') - parseFloat(tradeData.amount)).toString();
        // Note: totalInvested remains the same for P&L calculation
      }

      // Calculate current value
      const currentPrice = parseFloat(tradeData.price);
      portfolio.currentValue = (parseFloat(portfolio.balance) * currentPrice).toString();

      await portfolio.save();

      console.log(`📊 Portfolio updated for ${userAddress}`);
    } catch (error) {
      console.error('❌ Error updating user portfolio:', error);
    }
  }

  // Update agent stats (called by trading events)
  updateAgentStats(address, update) {
    const normalizedAddress = address.toLowerCase();
    const currentStats = this.getAgentStats(normalizedAddress);

    const updatedStats = {
      ...currentStats,
      ...update,
      lastActivity: Date.now()
    };

    this.agentStats.set(normalizedAddress, updatedStats);

    // Broadcast updated stats
    this.websocketService.broadcast({
      type: 'agentStats',
      agentAddress: address,
      stats: updatedStats,
      timestamp: Date.now()
    });
  }

  // Get all known agents
  getAllKnownAgents() {
    return Array.from(this.agentList);
  }

  // Real-time blockchain event processing
  async processRealTimeEvents() {
    console.log('🔄 Processing real-time blockchain events...');

    // Process any pending events from the blockchain
    try {
      // Get latest block number
      const latestBlock = await this.provider.getBlockNumber();

      // Process events for all active agents
      for (const agentAddress of this.agentList) {
        await this.processAgentEvents(agentAddress, latestBlock);
      }

    } catch (error) {
      console.error('❌ Error processing real-time events:', error);
    }
  }

  // Process events for a specific agent
  async processAgentEvents(agentAddress, latestBlock) {
    try {
      const agent = await Agent.findOne({
        contractAddress: agentAddress.toLowerCase()
      });

      if (!agent) return;

      const fromBlock = agent.lastEventBlock || 0;

      // Get contract instance
      const agentContract = new ethers.Contract(
        agentAddress,
        [
          'event TokensPurchased(address indexed buyer, uint256 tokensAmount, uint256 coreSpent)',
          'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)'
        ],
        this.provider
      );

      // Get purchase events
      const purchaseEvents = await agentContract.queryFilter(
        agentContract.filters.TokensPurchased(),
        fromBlock,
        latestBlock
      );

      // Get sale events
      const saleEvents = await agentContract.queryFilter(
        agentContract.filters.TokensSold(),
        fromBlock,
        latestBlock
      );

      // Process all events
      const allEvents = [...purchaseEvents, ...saleEvents].sort(
        (a, b) => a.blockNumber - b.blockNumber
      );

      for (const event of allEvents) {
        if (this.dataProcessor) {
          await this.dataProcessor.processTradeEvent(event, agentAddress);
        } else {
          console.warn('⚠️ Data processor not available, skipping trade event processing');
        }
      }

      // Update last processed block
      await Agent.updateOne(
        { contractAddress: agentAddress.toLowerCase() },
        { lastEventBlock: latestBlock }
      );

    } catch (error) {
      console.error(`❌ Error processing events for ${agentAddress}:`, error);
    }
  }

  // Clean up event listeners
  cleanup() {
    console.log('🧹 Cleaning up event listeners...');
    this.agentFactory.removeAllListeners();
  }
}

module.exports = EventListener;
