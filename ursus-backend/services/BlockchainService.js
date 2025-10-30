const { ethers } = require('ethers');

class BlockchainService {
  constructor() {
    // Initialize provider for Core DAO Testnet
    this.provider = new ethers.JsonRpcProvider(process.env.CORE_RPC_URL || 'https://rpc.test2.btcs.network');

    // Initialize event listener (will be set by server)
    this.eventListener = null;
    
    // Contract addresses and ABIs
    this.AGENT_FACTORY_ADDRESS = process.env.AGENT_FACTORY_ADDRESS || '0xC783aC13244Cc2454dF4393c556b10ECE4820B1F';
    
    // Contract ABIs (simplified)
    this.AGENT_FACTORY_ABI = [
      'function getTotalAgents() view returns (uint256)',
      'function getAllAgents(uint256 offset, uint256 limit) view returns (address[] agents, uint256 total)',
      'function getTrendingAgents(uint256 limit) view returns (address[])',
      'function agentMetadata(address) view returns (address tokenAddress, string name, string symbol, string description, string category, address creator, uint256 createdAt, bool isActive)',
      'function creationFee() view returns (uint256)',
      'event AgentCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, string description, string category)',
    ];

    this.AGENT_TOKEN_ABI = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
      'function getCurrentPrice() view returns (uint256)',
      'function getBondingCurveInfo() view returns (uint256 supply, uint256 reserve, uint256 price, uint256 marketCap)',
      'function getAgentInfo() view returns (string description, string instructions, string model, address creator, uint256 timestamp)',
      'function balanceOf(address) view returns (uint256)',
      'function recordInteraction(string message)',
      'event TokensPurchased(address indexed buyer, uint256 coreAmount, uint256 tokensReceived)',
      'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)',
      'event AgentInteraction(address indexed user, string message)'
    ];

    // Initialize contracts
    this.agentFactory = new ethers.Contract(this.AGENT_FACTORY_ADDRESS, this.AGENT_FACTORY_ABI, this.provider);
  }

  // Set event listener reference
  setEventListener(eventListener) {
    this.eventListener = eventListener;
  }

  // Get network status (replaces direct frontend RPC calls)
  async getNetworkStatus() {
    try {
      console.log('🔍 Fetching network status from Core RPC...');

      // Get basic network data
      const [blockNumber, gasPrice, network] = await Promise.all([
        this.provider.getBlockNumber(),
        this.provider.getFeeData().then(fee => fee.gasPrice || ethers.parseUnits('1', 'gwei')),
        this.provider.getNetwork()
      ]);

      // Core-specific health checks
      let isHealthy = true;
      let validatorSetAccessible = false;

      try {
        // Check if Core precompiled contracts are accessible
        const validatorSetCode = await this.provider.getCode('0x0000000000000000000000000000000000001000');
        validatorSetAccessible = validatorSetCode !== '0x';

        // Additional Core network health checks
        const latestBlock = await this.provider.getBlock('latest');
        const blockAge = Date.now() / 1000 - latestBlock.timestamp;

        // Consider network healthy if:
        // 1. Validator set contract is accessible
        // 2. Latest block is less than 60 seconds old
        isHealthy = validatorSetAccessible && blockAge < 60;

        console.log(`🔍 Core network health: Block ${blockNumber}, Age: ${blockAge}s, Validator accessible: ${validatorSetAccessible}`);
      } catch (error) {
        console.warn('⚠️ Core health check failed:', error.message);
        isHealthy = false;
      }

      return {
        blockNumber: blockNumber,
        gasPrice: gasPrice,
        isHealthy: isHealthy,
        chainId: Number(network.chainId),
        networkName: network.name || 'Core Testnet',
        validatorSetAccessible: validatorSetAccessible,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error fetching network status:', error);
      throw new Error(`Network status fetch failed: ${error.message}`);
    }
  }

  // Calculate total volume from all Trade events across all agents
  async calculateTotalVolumeFromEvents() {
    try {
      console.log('💰 Calculating total volume from Trade events...');

      // Get all agents to query their trade events
      const agents = await this.getAllAgentAddresses();
      let totalVolume = ethers.parseEther('0');

      for (const agentAddress of agents) {
        try {
          // Get agent contract instance
          const agentContract = new ethers.Contract(
            agentAddress,
            this.AGENT_TOKEN_ABI,
            this.provider
          );
          

          // Query Trade events from this agent
          const tradeEvents = await agentContract.queryFilter(
            agentContract.filters.Trade(),
            0, // From genesis
            'latest'
          );

          // Sum up all trade volumes (coreAmount)
          for (const event of tradeEvents) {
            const coreAmount = event.args.coreAmount || ethers.parseEther('0');
            totalVolume = totalVolume + coreAmount;
          }

          console.log(`📊 Agent ${agentAddress}: ${tradeEvents.length} trades`);
        } catch (error) {
          console.warn(`⚠️ Failed to get trades for agent ${agentAddress}:`, error.message);
        }
      }

      const volumeInEther = ethers.formatEther(totalVolume);
      console.log(`✅ Total platform volume: ${volumeInEther} CORE`);

      return volumeInEther;
    } catch (error) {
      console.error('❌ Error calculating total volume:', error);
      return '0';
    }
  }

  // Calculate total value locked from all agent reserves
  async calculateTotalValueLockedFromEvents() {
    try {
      console.log('🔒 Calculating total value locked from agent reserves...');

      const agents = await this.getAllAgentAddresses();
      let totalValueLocked = ethers.parseEther('0');

      for (const agentAddress of agents) {
        try {
          // Get current CORE balance of agent contract (this is the TVL)
          const balance = await this.provider.getBalance(agentAddress);
          totalValueLocked = totalValueLocked + balance;

          console.log(`🔒 Agent ${agentAddress}: ${ethers.formatEther(balance)} CORE locked`);
        } catch (error) {
          console.warn(`⚠️ Failed to get balance for agent ${agentAddress}:`, error.message);
        }
      }

      const tvlInEther = ethers.formatEther(totalValueLocked);
      console.log(`✅ Total value locked: ${tvlInEther} CORE`);

      return tvlInEther;
    } catch (error) {
      console.error('❌ Error calculating total value locked:', error);
      return '0';
    }
  }

  // Calculate active agents in last 24h from Trade events
  async calculateActiveAgents24h(fromBlock, toBlock) {
    try {
      console.log('🔥 Calculating active agents in last 24h...');

      const agents = await this.getAllAgentAddresses();
      const activeAgents = new Set();

      for (const agentAddress of agents) {
        try {
          // Get agent contract instance
          const agentContract = new ethers.Contract(
            agentAddress,
            this.agentABI,
            this.provider
          );

          // Query recent Trade events
          const recentTrades = await agentContract.queryFilter(
            agentContract.filters.Trade(),
            fromBlock,
            toBlock
          );

          // If agent has trades in last 24h, it's active
          if (recentTrades.length > 0) {
            activeAgents.add(agentAddress);
            console.log(`🔥 Active agent ${agentAddress}: ${recentTrades.length} recent trades`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to check activity for agent ${agentAddress}:`, error.message);
        }
      }

      console.log(`✅ Active agents in last 24h: ${activeAgents.size}`);
      return activeAgents.size;
    } catch (error) {
      console.error('❌ Error calculating active agents:', error);
      return 0;
    }
  }

  // Calculate new agents created in last 24h from AgentCreated events
  async calculateNewAgents24h(fromBlock, toBlock) {
    try {
      console.log('🆕 Calculating new agents created in last 24h...');

      // Query AgentCreated events from factory contract
      const factoryContract = new ethers.Contract(
        this.AGENT_FACTORY_ADDRESS,
        this.AGENT_FACTORY_ABI,
        this.provider
      );
      

      const creationEvents = await factoryContract.queryFilter(
        factoryContract.filters.AgentCreated(),
        fromBlock,
        toBlock
      );

      console.log(`✅ New agents in last 24h: ${creationEvents.length}`);
      return creationEvents.length;
    } catch (error) {
      console.error('❌ Error calculating new agents:', error);
      return 0;
    }
  }

  // Calculate total trades from all Trade events
  async calculateTotalTradesFromEvents() {
    try {
      console.log('📊 Calculating total trades from all agents...');

      const agents = await this.getAllAgentAddresses();
      let totalTrades = 0;

      for (const agentAddress of agents) {
        try {
          // Get agent contract instance
          const agentContract = new ethers.Contract(
            agentAddress,
            this.agentABI,
            this.provider
          );

          // Query all Trade events
          const tradeEvents = await agentContract.queryFilter(
            agentContract.filters.Trade(),
            0, // From genesis
            'latest'
          );

          totalTrades += tradeEvents.length;
          console.log(`📊 Agent ${agentAddress}: ${tradeEvents.length} total trades`);
        } catch (error) {
          console.warn(`⚠️ Failed to get trades for agent ${agentAddress}:`, error.message);
        }
      }

      console.log(`✅ Total platform trades: ${totalTrades}`);
      return totalTrades;
    } catch (error) {
      console.error('❌ Error calculating total trades:', error);
      return 0;
    }
  }

  // Calculate unique traders from all Trade events
  async calculateUniqueTraders() {
    try {
      console.log('👥 Calculating unique traders across all agents...');

      const agents = await this.getAllAgentAddresses();
      const uniqueTraders = new Set();

      for (const agentAddress of agents) {
        try {
          // Get agent contract instance
          const agentContract = new ethers.Contract(
            agentAddress,
            this.agentABI,
            this.provider
          );

          // Query all Trade events
          const tradeEvents = await agentContract.queryFilter(
            agentContract.filters.Trade(),
            0, // From genesis
            'latest'
          );

          // Add all unique trader addresses
          for (const event of tradeEvents) {
            const trader = event.args.trader || event.args.user;
            if (trader) {
              uniqueTraders.add(trader.toLowerCase());
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to get traders for agent ${agentAddress}:`, error.message);
        }
      }

      console.log(`✅ Unique traders: ${uniqueTraders.size}`);
      return uniqueTraders.size;
    } catch (error) {
      console.error('❌ Error calculating unique traders:', error);
      return 0;
    }
  }

  // Get all agent addresses from factory events
  async getAllAgentAddresses() {
    try {
      // First try to get from database (faster)
      const Agent = require('../models/Agent');
      const agents = await Agent.find({ isActive: true }).select('contractAddress');

      if (agents.length > 0) {
        const addresses = agents.map(agent => agent.contractAddress);
        console.log(`📋 Found ${addresses.length} agents from database`);
        return addresses;
      }

      // Fallback: Query from blockchain events
      console.log('📋 Querying agent addresses from blockchain events...');

      const factoryContract = new ethers.Contract(
        this.factoryAddress,
        this.factoryABI,
        this.provider
      );

      const creationEvents = await factoryContract.queryFilter(
        factoryContract.filters.AgentCreated(),
        0, // From genesis
        'latest'
      );

      const addresses = creationEvents.map(event => event.args.tokenAddress);
      console.log(`📋 Found ${addresses.length} agents from blockchain events`);

      return addresses;
    } catch (error) {
      console.error('❌ Error getting agent addresses:', error);
      return [];
    }
  }

  // Get transaction receipt
  async getTransactionReceipt(hash) {
    try {
      console.log(`🔍 Getting transaction receipt for: ${hash}`);

      const receipt = await this.provider.getTransactionReceipt(hash);

      if (!receipt) {
        return null; // Transaction not found or still pending
      }

      return {
        hash: receipt.hash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'reverted',
        timestamp: Date.now() // Would get from block in production
      };
    } catch (error) {
      console.error('❌ Error getting transaction receipt:', error);
      return null;
    }
  }

  // Estimate gas for transaction
  async estimateGas(from, to, data = '0x', value = '0') {
    try {
      console.log(`⛽ Estimating gas: ${from} -> ${to}`);

      const gasEstimate = await this.provider.estimateGas({
        from: from,
        to: to,
        data: data,
        value: ethers.parseEther(value || '0')
      });

      console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);
      return gasEstimate;
    } catch (error) {
      console.error('❌ Error estimating gas:', error);
      // Return reasonable default
      return ethers.parseUnits('200000', 'wei');
    }
  }

  // Get current gas price
  async getGasPrice() {
    try {
      console.log('⛽ Getting current gas price...');

      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      console.log(`✅ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      return gasPrice;
    } catch (error) {
      console.error('❌ Error getting gas price:', error);
      // Return 1 gwei as fallback
      return ethers.parseUnits('1', 'gwei');
    }
  }

  async getAllAgents(offset = 0, limit = 20) {
    try {
      const result = await this.agentFactory.getAllAgents(offset, limit);
      const agentAddresses = result.agents;
      const total = Number(result.total);

      // Get metadata for each agent
      const agents = await Promise.all(
        agentAddresses.map(async (address) => {
          try {
            return await this.getAgentDetails(address);
          } catch (error) {
            console.error(`Error fetching agent ${address}:`, error);
            return null;
          }
        })
      );

      return {
        agents: agents.filter(agent => agent !== null),
        total
      };
    } catch (error) {
      console.error('Error fetching all agents:', error);
      throw new Error('Failed to fetch agents from blockchain');
    }
  }

  async getTrendingAgents(limit = 10) {
    try {
      const trendingAddresses = await this.agentFactory.getTrendingAgents(limit);
      
      const agents = await Promise.all(
        trendingAddresses.map(async (address) => {
          try {
            return await this.getAgentDetails(address);
          } catch (error) {
            console.error(`Error fetching trending agent ${address}:`, error);
            return null;
          }
        })
      );

      return agents.filter(agent => agent !== null);
    } catch (error) {
      console.error('Error fetching trending agents:', error);
      throw new Error('Failed to fetch trending agents from blockchain');
    }
  }

  async getAgentDetails(address) {
    try {
      console.log(`🔗 Fetching real blockchain data for: ${address}`);

      // Get token details with error handling
      const agentToken = new ethers.Contract(address, this.AGENT_TOKEN_ABI, this.provider);

      const results = await Promise.allSettled([
        agentToken.name().catch(() => 'Unknown Token'),
        agentToken.symbol().catch(() => 'UNK'),
        agentToken.totalSupply().catch(() => BigInt(0)),
        agentToken.getCurrentPrice().catch(() => BigInt(0)),
        agentToken.getBondingCurveInfo().catch(() => [BigInt(0), BigInt(0), BigInt(0), BigInt(0)])
      ]);

      // Extract values with fallbacks
      const tokenName = results[0].status === 'fulfilled' ? results[0].value : 'Unknown Token';
      const tokenSymbol = results[1].status === 'fulfilled' ? results[1].value : 'UNK';
      const totalSupply = results[2].status === 'fulfilled' ? results[2].value : BigInt(0);
      const currentPrice = results[3].status === 'fulfilled' ? results[3].value : BigInt(0);
      const bondingCurveInfo = results[4].status === 'fulfilled' ? results[4].value : [BigInt(0), BigInt(0), BigInt(0), BigInt(0)];

      // Calculate realistic values
      const totalSupplyFormatted = parseFloat(ethers.formatEther(totalSupply));
      const currentPriceFormatted = parseFloat(ethers.formatEther(currentPrice));
      const reserveFormatted = parseFloat(ethers.formatEther(bondingCurveInfo[1]));

      // Calculate market cap: totalSupply * currentPrice
      const marketCapCalculated = totalSupplyFormatted * currentPriceFormatted;

      // Use bonding curve market cap if available, otherwise calculate
      const marketCapFromContract = parseFloat(ethers.formatEther(bondingCurveInfo[3]));
      const finalMarketCap = marketCapFromContract > 0 ? marketCapFromContract : marketCapCalculated;

      // Get holders count from blockchain
      let realHolders = null; // null means we couldn't get real data

      try {
        console.log(`🔍 Fetching real holders count for ${address}...`);

        // Get Transfer events to find unique holders
        const transferFilter = agentToken.filters.Transfer();
        const transferEvents = await agentToken.queryFilter(transferFilter, 0, 'latest');

        console.log(`📊 Found ${transferEvents.length} transfer events`);

        // Get unique addresses that have received tokens
        const uniqueAddresses = new Set();
        for (const event of transferEvents) {
          if (event.args && event.args.to && event.args.to !== ethers.ZeroAddress) {
            uniqueAddresses.add(event.args.to.toLowerCase());
          }
        }

        console.log(`📊 Found ${uniqueAddresses.size} unique addresses`);

        // Check balance for each unique address to count real holders
        let holdersWithBalance = 0;
        for (const address of uniqueAddresses) {
          try {
            const balance = await agentToken.balanceOf(address);
            if (balance > 0n) {
              holdersWithBalance++;
            }
          } catch (balanceError) {
            console.warn(`Failed to check balance for ${address}:`, balanceError.message);
          }
        }

        realHolders = holdersWithBalance;
        console.log(`✅ Real holders count: ${realHolders}`);

      } catch (eventError) {
        console.error(`❌ Could not fetch real holders count for ${address}:`, eventError.message);
        console.log(`ℹ️ Holders count will be null (unable to determine from blockchain)`);
        realHolders = null; // Return null to indicate we couldn't get real data
      }

      const result = {
        address,
        tokenName,
        tokenSymbol,
        totalSupply: totalSupplyFormatted.toString(),
        currentPrice: currentPriceFormatted.toString(),
        marketCap: finalMarketCap.toString(),
        reserve: reserveFormatted.toString(),
        holders: realHolders, // null if we couldn't get real data
        supply: parseFloat(ethers.formatEther(bondingCurveInfo[0])).toString(),
        bondingCurvePrice: parseFloat(ethers.formatEther(bondingCurveInfo[2])).toString()
      };

      console.log(`✅ Real blockchain data fetched for ${address}:`, {
        price: result.currentPrice,
        supply: result.totalSupply,
        marketCap: result.marketCap,
        reserve: result.reserve
      });

      return result;
    } catch (error) {
      console.error(`❌ Error fetching blockchain data for ${address}:`, error.message);
      return null; // Return null instead of throwing to allow fallback
    }
  }

  async getAgentStats(address) {
    try {
      const agent = await this.getAgentDetails(address);

      // Get real stats from event listener if available
      let eventStats = {};
      if (this.eventListener) {
        eventStats = this.eventListener.getAgentStats(address);
      }

      const stats = {
        totalSupply: agent.totalSupply,
        currentPrice: agent.currentPrice,
        marketCap: agent.bondingCurveInfo.marketCap,
        reserve: agent.bondingCurveInfo.reserve,
        holders: eventStats.holders || 0,
        transactions24h: eventStats.transactions24h || 0,
        volume24h: eventStats.volume24h || 0,
        priceChange24h: eventStats.priceChange24h || 0,
        createdAt: agent.metadata.createdAt,
        category: agent.metadata.category,
        isActive: agent.metadata.isActive,
        totalPurchases: eventStats.totalPurchases || 0,
        totalSales: eventStats.totalSales || 0,
        totalInteractions: eventStats.totalInteractions || 0
      };

      return stats;
    } catch (error) {
      console.error(`Error fetching agent stats for ${address}:`, error);
      throw new Error('Failed to fetch agent statistics');
    }
  }

  async getUserBalance(agentAddress, userAddress) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
      const balance = await agentToken.balanceOf(userAddress);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error(`Error fetching user balance:`, error);
      throw new Error('Failed to fetch user balance');
    }
  }

  async calculatePurchaseReturn(agentAddress, coreAmount) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
  
      // Eğer fonksiyon sözleşmede yoksa 0 döndür
      if (typeof agentToken.calculatePurchaseReturn !== 'function') {
        console.warn('calculatePurchaseReturn not implemented on token:', agentAddress);
        return '0';
      }
  
      const tokensReceived = await agentToken.calculatePurchaseReturn(
        ethers.parseEther(coreAmount.toString())
      );
      return ethers.formatEther(tokensReceived);
    } catch (error) {
      console.error(`Error calculating purchase return:`, error);
      return '0';
    }
  }
  

  async calculateSaleReturn(agentAddress, tokenAmount) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
  
      if (typeof agentToken.calculateSaleReturn !== 'function') {
        console.warn('calculateSaleReturn not implemented on token:', agentAddress);
        return '0';
      }
  
      const coreReceived = await agentToken.calculateSaleReturn(
        ethers.parseEther(tokenAmount)
      );
      return ethers.formatEther(coreReceived);
    } catch (error) {
      console.warn('Sale return unavailable, returning 0:', error.message);
      return '0';
    }
  }

  async recordInteraction(agentAddress, message) {
    try {
      // This would require a signer, not just a provider
      // For now, just log the interaction
      console.log(`Interaction recorded for ${agentAddress}: ${message}`);
      return true;
    } catch (error) {
      console.error(`Error recording interaction:`, error);
      return false;
    }
  }

  async getCreationFee() {
    try {
      const fee = await this.agentFactory.creationFee();
      return ethers.formatEther(fee);
    } catch (error) {
      console.error('Error fetching creation fee:', error);
      throw new Error('Failed to fetch creation fee');
    }
  }

  async getTotalAgents() {
    try {
      const total = await this.agentFactory.getTotalAgents();
      return Number(total);
    } catch (error) {
      console.error('Error fetching total agents:', error);
      throw new Error('Failed to fetch total agents count');
    }
  }

  // Get platform statistics from real blockchain event logs
  async getPlatformStats() {
    try {
      console.log('📊 Calculating platform statistics from real blockchain events...');

      // Get basic contract data
      const [totalAgents, creationFee] = await Promise.all([
        this.getTotalAgents(),
        this.getCreationFee()
      ]);

      // Calculate time boundaries for 24h statistics
      const currentBlock = await this.provider.getBlockNumber();

      // Estimate block number from 24 hours ago (assuming ~3 second block time for Core)
      const blocksPerDay = Math.floor((24 * 60 * 60) / 3);
      const fromBlock = Math.max(0, currentBlock - blocksPerDay);

      console.log(`🔍 Analyzing events from block ${fromBlock} to ${currentBlock} (last 24h)`);

      // Get all platform statistics in parallel
      const [
        totalVolume,
        totalValueLocked,
        activeAgents24h,
        newAgents24h,
        totalTrades,
        uniqueTraders
      ] = await Promise.all([
        this.calculateTotalVolumeFromEvents(),
        this.calculateTotalValueLockedFromEvents(),
        this.calculateActiveAgents24h(fromBlock, currentBlock),
        this.calculateNewAgents24h(fromBlock, currentBlock),
        this.calculateTotalTradesFromEvents(),
        this.calculateUniqueTraders()
      ]);

      const stats = {
        totalAgents: totalAgents,
        creationFee: creationFee.toString(),
        totalVolume: totalVolume.toString(),
        totalValueLocked: totalValueLocked.toString(),
        activeAgents24h: activeAgents24h,
        newAgents24h: newAgents24h,
        totalTrades: totalTrades,
        uniqueTraders: uniqueTraders,
        lastUpdated: new Date().toISOString(),
        blockRange: {
          from: fromBlock,
          to: currentBlock,
          timeframe: '24h'
        }
      };

      console.log('✅ Platform statistics calculated from real blockchain events:', {
        totalAgents: stats.totalAgents,
        totalVolume: `${parseFloat(stats.totalVolume).toFixed(4)} CORE`,
        totalValueLocked: `${parseFloat(stats.totalValueLocked).toFixed(4)} CORE`,
        activeAgents24h: stats.activeAgents24h,
        newAgents24h: stats.newAgents24h,
        totalTrades: stats.totalTrades,
        uniqueTraders: stats.uniqueTraders
      });

      return stats;
    } catch (error) {
      console.error('❌ Error calculating platform stats from blockchain events:', error);
      throw new Error(`Failed to fetch platform statistics: ${error.message}`);
    }
  }
}

module.exports = BlockchainService;
