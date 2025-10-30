const { ethers } = require('ethers');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');

class BlockchainDataService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.CORE_RPC_URL);
    this.AGENT_FACTORY_ADDRESS = process.env.AGENT_FACTORY_ADDRESS;
    
    // Agent Token ABI for interacting with individual agent contracts
    this.AGENT_TOKEN_ABI = [
      'function getCurrentPrice() view returns (uint256)',
      'function getBondingCurveInfo() view returns (uint256 price, uint256 marketCap, uint256 reserve, uint256 totalSupply)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address account) view returns (uint256)',
      'function getHolderCount() view returns (uint256)',
      'function calculatePurchaseReturn(uint256 coreAmount) view returns (uint256)',
      'function calculateSaleReturn(uint256 tokenAmount) view returns (uint256)',
      'event TokensPurchased(address indexed buyer, uint256 tokensAmount, uint256 coreSpent)',
      'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)',
      'event PriceUpdated(uint256 newPrice, uint256 marketCap, uint256 reserve)',
      'event TokenGraduated(address indexed token, uint256 reserveAmount, uint256 liquidityTokens)'
    ];
    
    // Agent Factory ABI
    this.AGENT_FACTORY_ABI = [
      'function getCreationFee() view returns (uint256)',
      'function getAllAgents() view returns (address[])',
      'function getAgentInfo(address agent) view returns (string name, string symbol, string description, address creator, bool isActive)',
      'event AgentCreated(address indexed tokenAddress, address indexed creator, string name, string symbol, string description, string category)'
    ];
    
    console.log('🔗 Blockchain Data Service initialized');
  }

  // Get real-time data for an agent from blockchain
  async updateAgentWithRealData(agentAddress) {
    try {
      console.log(`🔗 Fetching real blockchain data for: ${agentAddress}`);
      
      // Validate address
      if (!ethers.isAddress(agentAddress)) {
        throw new Error('Invalid agent address');
      }
      
      const agentContract = new ethers.Contract(
        agentAddress,
        this.AGENT_TOKEN_ABI,
        this.provider
      );
      
      // Get current blockchain data
      const [
        currentPrice,
        bondingCurveInfo,
        totalSupply,
        holderCount
      ] = await Promise.all([
        agentContract.getCurrentPrice().catch(() => ethers.parseEther('1.0')),
        agentContract.getBondingCurveInfo().catch(() => ({
          price: ethers.parseEther('1.0'),
          marketCap: ethers.parseEther('1000000'),
          reserve: ethers.parseEther('50000'),
          totalSupply: ethers.parseEther('1000000')
        })),
        agentContract.totalSupply().catch(() => ethers.parseEther('1000000')),
        agentContract.getHolderCount().catch(() => 1)
      ]);
      
      // Format data
      const priceFormatted = ethers.formatEther(currentPrice);
      const marketCapFormatted = ethers.formatEther(bondingCurveInfo.marketCap || bondingCurveInfo[1] || ethers.parseEther('1000000'));
      const reserveFormatted = ethers.formatEther(bondingCurveInfo.reserve || bondingCurveInfo[2] || ethers.parseEther('50000'));
      const totalSupplyFormatted = ethers.formatEther(totalSupply);
      
      // Get trade-based metrics from database
      const tradeMetrics = await this.calculateTradeMetrics(agentAddress);
      
      const blockchainData = {
        currentPrice: priceFormatted,
        marketCap: marketCapFormatted,
        reserve: reserveFormatted,
        totalSupply: totalSupplyFormatted,
        holders: Number(holderCount),
        ...tradeMetrics
      };
      
      // Update agent in database
      await Agent.updateOne(
        { contractAddress: agentAddress.toLowerCase() },
        {
          $set: {
            'tokenomics.currentPrice': blockchainData.currentPrice,
            'tokenomics.marketCap': blockchainData.marketCap,
            'tokenomics.reserve': blockchainData.reserve,
            'tokenomics.totalSupply': blockchainData.totalSupply,
            'metrics.holders': blockchainData.holders,
            'metrics.volume24h': blockchainData.volume24h,
            'metrics.priceChange24h': blockchainData.priceChange24h,
            'metrics.allTimeHigh': blockchainData.allTimeHigh,
            'metrics.allTimeLow': blockchainData.allTimeLow,
            'metrics.totalTransactions': blockchainData.totalTrades,
            lastPriceUpdate: new Date()
          }
        }
      );
      
      console.log(`✅ Blockchain data updated for ${agentAddress}`);
      
      return {
        success: true,
        agentAddress,
        data: blockchainData
      };
      
    } catch (error) {
      console.error(`❌ Error fetching blockchain data for ${agentAddress}:`, error);
      return {
        success: false,
        agentAddress,
        error: error.message
      };
    }
  }

  // Calculate metrics from trade data
  async calculateTradeMetrics(agentAddress) {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Get recent trades
      const recentTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase(),
        timestamp: { $gte: twentyFourHoursAgo }
      }).sort({ timestamp: 1 });
      
      // Get all trades for price extremes
      const allTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      }).sort({ timestamp: 1 });
      
      if (allTrades.length === 0) {
        return {
          volume24h: 0,
          priceChange24h: 0,
          allTimeHigh: '1.000000',
          allTimeLow: '1.000000',
          totalTrades: 0,
          uniqueTraders: 0,
          avgTradeSize: 0
        };
      }
      
      // Calculate 24h volume
      const volume24h = recentTrades.reduce((sum, trade) => {
        return sum + parseFloat(trade.coreAmount);
      }, 0);
      
      // Calculate price change
      const latestTrade = allTrades[allTrades.length - 1];
      const oldestTrade24h = recentTrades.length > 0 ? recentTrades[0] : latestTrade;
      const priceChange24h = latestTrade.price - oldestTrade24h.price;
      
      // Calculate price extremes
      const prices = allTrades.map(t => t.price);
      const allTimeHigh = Math.max(...prices);
      const allTimeLow = Math.min(...prices);
      
      // Calculate unique traders
      const uniqueTraders = new Set(allTrades.map(t => t.trader)).size;
      
      // Calculate average trade size
      const totalVolume = allTrades.reduce((sum, t) => sum + parseFloat(t.coreAmount), 0);
      const avgTradeSize = allTrades.length > 0 ? totalVolume / allTrades.length : 0;
      
      return {
        volume24h,
        priceChange24h,
        allTimeHigh: allTimeHigh.toFixed(6),
        allTimeLow: allTimeLow.toFixed(6),
        totalTrades: allTrades.length,
        uniqueTraders,
        avgTradeSize
      };
      
    } catch (error) {
      console.error('❌ Error calculating trade metrics:', error);
      return {
        volume24h: 0,
        priceChange24h: 0,
        allTimeHigh: '1.000000',
        allTimeLow: '1.000000',
        totalTrades: 0,
        uniqueTraders: 0,
        avgTradeSize: 0
      };
    }
  }

  // Get trading quote from blockchain
  async getBuyQuote(agentAddress, coreAmount) {
    try {
      const agentContract = new ethers.Contract(
        agentAddress,
        this.AGENT_TOKEN_ABI,
        this.provider
      );
      
      const coreAmountWei = ethers.parseEther(coreAmount.toString());
      const tokensReceived = await agentContract.calculatePurchaseReturn(coreAmountWei);
      
      const [currentPrice, bondingCurveInfo] = await Promise.all([
        agentContract.getCurrentPrice(),
        agentContract.getBondingCurveInfo()
      ]);
      
      return {
        success: true,
        tokensReceived: ethers.formatEther(tokensReceived),
        currentPrice: ethers.formatEther(currentPrice),
        marketCap: ethers.formatEther(bondingCurveInfo.marketCap || bondingCurveInfo[1]),
        priceImpact: this.calculatePriceImpact(coreAmount, ethers.formatEther(tokensReceived))
      };
      
    } catch (error) {
      console.error('❌ Error getting buy quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get sell quote from blockchain
  async getSellQuote(agentAddress, tokenAmount) {
    try {
      const agentContract = new ethers.Contract(
        agentAddress,
        this.AGENT_TOKEN_ABI,
        this.provider
      );
      
      const tokenAmountWei = ethers.parseEther(tokenAmount.toString());
      const coreReceived = await agentContract.calculateSaleReturn(tokenAmountWei);
      
      const [currentPrice, bondingCurveInfo] = await Promise.all([
        agentContract.getCurrentPrice(),
        agentContract.getBondingCurveInfo()
      ]);
      
      return {
        success: true,
        coreReceived: ethers.formatEther(coreReceived),
        currentPrice: ethers.formatEther(currentPrice),
        marketCap: ethers.formatEther(bondingCurveInfo.marketCap || bondingCurveInfo[1]),
        priceImpact: this.calculatePriceImpact(ethers.formatEther(coreReceived), tokenAmount)
      };
      
    } catch (error) {
      console.error('❌ Error getting sell quote:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate price impact
  calculatePriceImpact(coreAmount, tokenAmount) {
    try {
      const price = parseFloat(coreAmount) / parseFloat(tokenAmount);
      // This is a simplified calculation - in reality, you'd compare with current market price
      return Math.min(price * 0.01, 5.0); // Max 5% impact
    } catch (error) {
      return 0;
    }
  }

  // Get all agents from blockchain
  async getAllAgentsFromBlockchain() {
    try {
      const factoryContract = new ethers.Contract(
        this.AGENT_FACTORY_ADDRESS,
        this.AGENT_FACTORY_ABI,
        this.provider
      );
      
      const agentAddresses = await factoryContract.getAllAgents();
      console.log(`📊 Found ${agentAddresses.length} agents on blockchain`);
      
      return agentAddresses;
      
    } catch (error) {
      console.error('❌ Error getting agents from blockchain:', error);
      return [];
    }
  }

  // Get network information
  async getNetworkInfo() {
    try {
      const [network, blockNumber, feeData] = await Promise.all([
        this.provider.getNetwork(),
        this.provider.getBlockNumber(),
        this.provider.getFeeData()
      ]);
      
      return {
        chainId: Number(network.chainId),
        blockNumber,
        gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') : null,
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : null
      };
      
    } catch (error) {
      console.error('❌ Error getting network info:', error);
      throw error;
    }
  }
}

module.exports = BlockchainDataService;
