const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');

/**
 * Solana Event Listener
 * Listens to Solana program logs and processes events
 */
class SolanaEventListener {
  constructor(blockchainService, websocketService) {
    this.blockchainService = blockchainService;
    this.websocketService = websocketService;
    this.dataProcessor = null; // Will be set by server.js

    // In-memory storage for agent stats
    this.agentStats = new Map();
    this.agentList = new Set();

    // Subscription IDs
    this.logSubscriptionId = null;
    this.accountSubscriptionIds = new Map();

    this.setupEventListeners();
  }

  setupEventListeners() {
    console.log('🎧 Setting up Solana event listeners...');

    try {
      // Subscribe to program logs
      this.logSubscriptionId = this.blockchainService.subscribeToProgramLogs(
        this.handleProgramEvent.bind(this)
      );

      console.log('✅ Solana event listeners setup complete');
    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
    }
  }

  /**
   * Handle program events from logs
   */
  async handleProgramEvent(event) {
    try {
      console.log('📡 Received program event:', event.type);

      switch (event.type) {
        case 'AgentCreated':
          await this.handleAgentCreated(event);
          break;
        case 'TokensPurchased':
          await this.handleTokensPurchased(event);
          break;
        case 'TokensSold':
          await this.handleTokensSold(event);
          break;
        case 'AgentGraduated':
          await this.handleAgentGraduated(event);
          break;
        default:
          console.log('Unknown event type:', event.type);
      }
    } catch (error) {
      console.error('❌ Error handling program event:', error);
    }
  }

  /**
   * Handle AgentCreated event
   */
  async handleAgentCreated(event) {
    try {
      console.log('🎉 Processing AgentCreated event');

      // Wait a bit for transaction to be confirmed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Fetch all agents and find the newly created one
      const agents = await this.blockchainService.getAllAgentsFromChain();
      if (agents.length === 0) {
        console.error('No agents found on chain');
        return;
      }

      // Get the latest agent (highest agentId)
      const latestAgent = agents.reduce((max, agent) =>
        parseInt(agent.agentId) > parseInt(max.agentId) ? agent : max
      );

      console.log('📝 Saving agent to database:', latestAgent.name);

      // Check if agent already exists
      const existingAgent = await Agent.findOne({ contractAddress: latestAgent.address });
      if (existingAgent) {
        console.log('⚠️ Agent already exists in database:', latestAgent.name);
        return;
      }

      // Map model and category to valid enum values
      const modelMap = {
        'gpt-4': 'claude-3',
        'gpt-3.5-turbo': 'claude-3',
        'claude-3': 'claude-3',
        'claude-3-sonnet-20240229': 'claude-3-sonnet-20240229',
        'gemini-pro': 'gemini-pro',
        'llama3-8b-8192': 'llama3-8b-8192'
      };

      const categoryMap = {
        'test': 'General',
        'defi': 'DeFi',
        'trading': 'Trading',
        'analytics': 'Analytics',
        'gaming': 'Gaming',
        'social': 'Social',
        'utility': 'Utility',
        'entertainment': 'Entertainment',
        'education': 'Education',
        'general': 'General'
      };

      const validModel = modelMap[latestAgent.model?.toLowerCase()] || 'claude-3';
      const validCategory = categoryMap[latestAgent.category?.toLowerCase()] || 'General';

      // Calculate total supply (1 billion tokens)
      const totalSupply = '1000000000';

      // Save to database
      const agentDoc = new Agent({
        contractAddress: latestAgent.address,
        name: latestAgent.name,
        symbol: latestAgent.symbol,
        description: latestAgent.description || 'AI Agent on Solana',
        instructions: latestAgent.instructions || 'I am an AI agent powered by Solana blockchain.',
        model: validModel,
        category: validCategory,
        creator: latestAgent.creator,
        tokenomics: {
          totalSupply: totalSupply,
          currentPrice: '0',
          marketCap: '0',
          reserve: latestAgent.bondingCurve?.realSolReserves || '0',
          bondingCurveParams: {
            reserveRatio: 500000,
            slope: 1
          },
          liquidityTokens: '0',
          graduationReserve: '0',
          dexPair: null
        },
        metrics: {
          holders: 0,
          totalTransactions: 0,
          volume24h: 0,
          volume7d: 0,
          volumeTotal: 0,
          priceChange24h: 0,
          priceChange7d: 0,
          allTimeHigh: '0',
          allTimeLow: '0'
        },
        isGraduated: latestAgent.isGraduated || false,
        isActive: true,
        moderationStatus: 'approved'
      });

      await agentDoc.save();

      // Add to agent list
      this.agentList.add(latestAgent.address);

      // Broadcast to WebSocket clients
      if (this.websocketService) {
        this.websocketService.broadcast('agentCreated', {
          agent: agentDoc.toObject(),
          signature: event.signature,
        });
      }

      console.log('✅ Agent saved to database:', latestAgent.name);
    } catch (error) {
      console.error('❌ Error handling AgentCreated:', error);
    }
  }

  /**
   * Handle TokensPurchased event
   */
  async handleTokensPurchased(event) {
    try {
      console.log('💰 Processing TokensPurchased event');

      // Parse transaction
      const tx = await this.blockchainService.getTransaction(event.signature);
      if (!tx) {
        console.error('Transaction not found:', event.signature);
        return;
      }

      // Extract trade details from transaction
      // This is simplified - in production, parse the transaction properly
      const tradeData = {
        signature: event.signature,
        type: 'buy',
        timestamp: new Date(),
      };

      // Broadcast to WebSocket
      if (this.websocketService) {
        this.websocketService.broadcast('trade', tradeData);
      }

      console.log('✅ TokensPurchased event processed');
    } catch (error) {
      console.error('❌ Error handling TokensPurchased:', error);
    }
  }

  /**
   * Handle TokensSold event
   */
  async handleTokensSold(event) {
    try {
      console.log('💸 Processing TokensSold event');

      // Parse transaction
      const tx = await this.blockchainService.getTransaction(event.signature);
      if (!tx) {
        console.error('Transaction not found:', event.signature);
        return;
      }

      // Extract trade details
      const tradeData = {
        signature: event.signature,
        type: 'sell',
        timestamp: new Date(),
      };

      // Broadcast to WebSocket
      if (this.websocketService) {
        this.websocketService.broadcast('trade', tradeData);
      }

      console.log('✅ TokensSold event processed');
    } catch (error) {
      console.error('❌ Error handling TokensSold:', error);
    }
  }

  /**
   * Handle AgentGraduated event
   */
  async handleAgentGraduated(event) {
    try {
      console.log('🎓 Processing AgentGraduated event');

      // Update agent in database
      // This is simplified - extract agent address from transaction
      
      // Broadcast to WebSocket
      if (this.websocketService) {
        this.websocketService.broadcast('agentGraduated', {
          signature: event.signature,
          timestamp: new Date(),
        });
      }

      console.log('✅ AgentGraduated event processed');
    } catch (error) {
      console.error('❌ Error handling AgentGraduated:', error);
    }
  }

  /**
   * Process real-time events (polling for updates)
   */
  async processRealTimeEvents() {
    try {
      // Fetch all agents from chain
      const chainAgents = await this.blockchainService.getAllAgentsFromChain();

      // Update database with latest data
      for (const chainAgent of chainAgents) {
        try {
          const dbAgent = await Agent.findOne({ contractAddress: chainAgent.address });
          
          if (dbAgent) {
            // Update existing agent
            dbAgent.bondingCurve = {
              virtualSolReserves: chainAgent.bondingCurve.virtualSolReserves,
              virtualTokenReserves: chainAgent.bondingCurve.virtualTokenReserves,
              realSolReserves: chainAgent.bondingCurve.realSolReserves,
              realTokenReserves: chainAgent.bondingCurve.realTokenReserves,
            };
            dbAgent.isGraduated = chainAgent.isGraduated;
            
            await dbAgent.save();
          }
        } catch (error) {
          console.error(`Error updating agent ${chainAgent.address}:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error processing real-time events:', error);
    }
  }

  /**
   * Get agent stats
   */
  getAgentStats(agentAddress) {
    return this.agentStats.get(agentAddress) || {
      volume24h: '0',
      transactions24h: 0,
      holders: 0,
      priceChange24h: 0,
    };
  }

  /**
   * Cleanup subscriptions
   */
  async cleanup() {
    try {
      if (this.logSubscriptionId) {
        await this.blockchainService.unsubscribeFromLogs(this.logSubscriptionId);
      }

      for (const [address, subId] of this.accountSubscriptionIds) {
        await this.blockchainService.connection.removeAccountChangeListener(subId);
      }

      console.log('✅ Event listener cleanup complete');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

module.exports = SolanaEventListener;

