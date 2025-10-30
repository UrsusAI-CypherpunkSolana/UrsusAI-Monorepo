const { ethers } = require('ethers');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const Agent = require('../models/Agent');

class TradingService {
  constructor() {
    // DEPRECATED: This service uses old EVM code, should use SolanaBlockchainService instead
    this.provider = new ethers.JsonRpcProvider(process.env.CORE_RPC_URL || 'https://rpc.test2.btcs.network');
    
    // Agent Token ABI for trading functions
    this.AGENT_TOKEN_ABI = [
      'function getCurrentPrice() view returns (uint256)',
      'function getBondingCurveInfo() view returns (uint256 supply, uint256 reserve, uint256 price, uint256 marketCap)',
      'function calculatePurchaseReturn(uint256 coreAmount) view returns (uint256)',
      'function calculateSaleReturn(uint256 tokenAmount) view returns (uint256)',
      'function purchaseTokens() payable',
      'function sellTokens(uint256 amount)',
      'function balanceOf(address account) view returns (uint256)',
      'function totalSupply() view returns (uint256)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function isGraduated() view returns (bool)',
      'function reserveBalance() view returns (uint256)',
      'function GRADUATION_THRESHOLD() view returns (uint256)',
      'event TokensPurchased(address indexed buyer, uint256 coreAmount, uint256 tokensReceived)',
      'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)'
    ];
  }

  // Enhanced graduation status checker
  async checkGraduationStatus(agentToken, agentAddress) {
    let isGraduated = false;
    let currentReserve = 0;
    let graduationThreshold = 30000; // 30,000 CORE
    let detectionMethod = 'none';
    let errors = [];

    try {
      // Method 1: Direct isGraduated call
      try {
        isGraduated = await agentToken.isGraduated();
        detectionMethod = 'direct';
        console.log(`🎓 Direct graduation check: ${isGraduated}`);
      } catch (error) {
        errors.push(`Direct isGraduated call failed: ${error.message}`);
        console.log('⚠️ Direct isGraduated call failed:', error.message);
      }

      // Method 2: Check reserve balance vs threshold
      if (!isGraduated) {
        try {
          const reserveBalance = await agentToken.reserveBalance();
          currentReserve = parseFloat(ethers.formatEther(reserveBalance));

          const threshold = await agentToken.GRADUATION_THRESHOLD();
          graduationThreshold = parseFloat(ethers.formatEther(threshold));

          console.log(`💰 Reserve: ${currentReserve} CORE, Threshold: ${graduationThreshold} CORE`);

          if (currentReserve >= graduationThreshold) {
            console.log('🎓 Reserve exceeds threshold, token should be graduated');
            isGraduated = true;
            detectionMethod = 'reserve_threshold';
          }
        } catch (error) {
          errors.push(`Reserve balance check failed: ${error.message}`);
          console.log('⚠️ Reserve balance check failed:', error.message);
        }
      }

      // Method 3: Try bonding curve info for graduation status
      if (!isGraduated) {
        try {
          const bondingCurveInfo = await agentToken.getBondingCurveInfo();
          // Check if reserve in bonding curve exceeds threshold
          const reserveFromCurve = parseFloat(ethers.formatEther(bondingCurveInfo[1])); // reserve is 2nd element

          if (reserveFromCurve >= graduationThreshold) {
            console.log('🎓 Bonding curve reserve indicates graduation');
            isGraduated = true;
            detectionMethod = 'bonding_curve';
            currentReserve = reserveFromCurve;
          }
        } catch (error) {
          errors.push(`Bonding curve info check failed: ${error.message}`);
          console.log('⚠️ Bonding curve info check failed:', error.message);
        }
      }

      // Method 4: Known graduated tokens (fallback) - gated by env for safety
      if (!isGraduated && process.env.ENABLE_KNOWN_GRADUATED === 'true' &&
          agentAddress.toLowerCase() === '0x36f73a86b59e4e5dc80ad84fbeb2cc3d8e55856d') {
        console.log('🎓 Known graduated token detected (env-gated)');
        isGraduated = true;
        detectionMethod = 'known_graduated';
      }

    } catch (error) {
      errors.push(`Graduation detection failed: ${error.message}`);
      console.log('⚠️ Graduation detection failed, assuming not graduated for safety:', error.message);
      isGraduated = false; // Changed to false for safety - let bonding curve handle it
    }

    return {
      isGraduated,
      currentReserve,
      graduationThreshold,
      detectionMethod,
      errors,
      progressPercentage: graduationThreshold > 0 ? (currentReserve / graduationThreshold) * 100 : 0
    };
  }

  // Get enhanced trading quote for buying tokens
  async getBuyQuote(agentAddress, solAmount) {
    try {
      console.log(`💰 Getting buy quote for ${agentAddress}: ${solAmount} SOL`);

      // Input validation - Solana address format
      // NOTE: In our database, addresses are stored in LOWERCASE for case-insensitive queries
      // So we need to accept both uppercase and lowercase characters
      if (!agentAddress || agentAddress.length < 32 || agentAddress.length > 44) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      // Additional check: must not be a valid MongoDB ObjectId (24 hex characters)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(agentAddress);
      if (isObjectId) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      // Check if it contains only alphanumeric characters
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      if (!alphanumericRegex.test(agentAddress)) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      if (!solAmount || solAmount <= 0 || solAmount < 0.0001) {
        return {
          success: false,
          error: 'Amount must be at least 0.0001 SOL'
        };
      }

      // Find agent by contractAddress OR mintAddress
      const agent = await Agent.findOne({
        $or: [
          { contractAddress: new RegExp(`^${agentAddress}$`, 'i') },
          { mintAddress: new RegExp(`^${agentAddress}$`, 'i') }
        ]
      });

      if (!agent) {
        return {
          success: false,
          error: 'Agent not found'
        };
      }

      console.log(`✅ Found agent: ${agent.name} (${agent.symbol})`);

      // Use Solana bonding curve calculation (constant product AMM)
      // Virtual reserves: 30 SOL, 1.073B tokens
      const VIRTUAL_SOL_RESERVES = 30;
      const VIRTUAL_TOKEN_RESERVES = 1073000000;

      // Get current reserves from agent (convert string to number)
      const currentSolReserves = parseFloat(agent.tokenomics?.reserve || 0);
      const currentTokenSupply = parseFloat(agent.tokenomics?.currentSupply || 0);

      // Calculate virtual reserves
      const virtualSol = VIRTUAL_SOL_RESERVES + currentSolReserves;
      const virtualTokens = VIRTUAL_TOKEN_RESERVES - currentTokenSupply;

      // Check graduation status
      const isGraduated = agent.isGraduated || currentSolReserves >= 30000;

      if (isGraduated) {
        console.log('🎓 Token is graduated, returning DEX quote message');
        return {
          success: false,
          error: 'GRADUATED_TOKEN',
          message: 'This token has graduated to DEX. Please use DEX trading instead of bonding curve.',
          graduationInfo: {
            isGraduated: true,
            currentReserve: currentSolReserves,
            graduationThreshold: 30000
          }
        };
      }

      // Solana bonding curve calculation (constant product AMM)
      // Formula: tokens_out = virtual_token_reserves - (virtual_sol_reserves * virtual_token_reserves) / (virtual_sol_reserves + sol_in)
      const newSolReserves = virtualSol + solAmount;
      const product = virtualSol * virtualTokens;
      const newTokenReserves = product / newSolReserves;
      const tokensReceived = virtualTokens - newTokenReserves;

      // Calculate current price (SOL per token)
      const currentPrice = virtualSol / virtualTokens;

      // Calculate new price after trade
      const newPrice = newSolReserves / newTokenReserves;

      // Calculate price impact
      const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;

      // Calculate fees (1% platform + 1% creator = 2% total)
      const platformFeePercent = 0.01; // 1%
      const creatorFeePercent = 0.01;  // 1%
      const platformFeeAmount = solAmount * platformFeePercent;
      const creatorFeeAmount = solAmount * creatorFeePercent;
      const totalFeesAmount = platformFeeAmount + creatorFeeAmount;

      // Calculate slippage (0.5% base)
      const baseSlippage = 0.5;
      const totalSlippage = baseSlippage;

      // Calculate minimum received with slippage protection
      const slippageProtection = totalSlippage / 100;
      const minimumReceived = tokensReceived * (1 - slippageProtection);

      // Calculate market cap
      const totalSupply = VIRTUAL_TOKEN_RESERVES;
      const marketCap = totalSupply * currentPrice;

      const quote = {
        solAmount: solAmount.toString(),
        tokensReceived: tokensReceived.toString(),
        currentPrice: currentPrice.toString(),
        newPrice: newPrice.toString(),
        priceImpact: Math.abs(priceImpact),
        slippage: totalSlippage,
        fees: {
          platformFee: platformFeePercent.toString(),      // Send as decimal (0.01 = 1%)
          creatorFee: creatorFeePercent.toString(),        // Send as decimal (0.01 = 1%)
          totalFees: (platformFeePercent + creatorFeePercent).toString(),  // Send as decimal (0.02 = 2%)
          platformFeeAmount: platformFeeAmount.toString(), // Actual SOL amount
          creatorFeeAmount: creatorFeeAmount.toString(),   // Actual SOL amount
          totalFeesAmount: totalFeesAmount.toString()      // Actual SOL amount
        },
        minimumReceived: minimumReceived.toString(),
        marketCap: marketCap.toString(),
        reserve: (currentSolReserves + solAmount).toString()
      };

      console.log('✅ Buy quote calculated:', {
        tokensReceived: tokensReceived.toFixed(4),
        priceImpact: priceImpact.toFixed(2) + '%',
        currentPrice: currentPrice.toFixed(8)
      });

      return {
        success: true,
        quote
      };
    } catch (error) {
      console.error('Get buy quote error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get trading quote for selling tokens
  async getSellQuote(agentAddress, tokenAmount) {
    try {
      console.log(`💰 Getting sell quote for ${agentAddress}: ${tokenAmount} tokens`);

      // Input validation - Solana address format
      // NOTE: In our database, addresses are stored in LOWERCASE for case-insensitive queries
      // So we need to accept both uppercase and lowercase characters
      if (!agentAddress || agentAddress.length < 32 || agentAddress.length > 44) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      // Additional check: must not be a valid MongoDB ObjectId (24 hex characters)
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(agentAddress);
      if (isObjectId) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      // Check if it contains only alphanumeric characters
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;
      if (!alphanumericRegex.test(agentAddress)) {
        return {
          success: false,
          error: 'Invalid agent address provided'
        };
      }

      if (!tokenAmount || tokenAmount <= 0 || tokenAmount < 0.0001) {
        return {
          success: false,
          error: 'Amount must be at least 0.0001 tokens'
        };
      }

      // Find agent by contractAddress OR mintAddress
      const agent = await Agent.findOne({
        $or: [
          { contractAddress: new RegExp(`^${agentAddress}$`, 'i') },
          { mintAddress: new RegExp(`^${agentAddress}$`, 'i') }
        ]
      });

      if (!agent) {
        return {
          success: false,
          error: 'Agent not found'
        };
      }

      console.log(`✅ Found agent: ${agent.name} (${agent.symbol})`);

      // Use Solana bonding curve calculation (constant product AMM)
      const VIRTUAL_SOL_RESERVES = 30;
      const VIRTUAL_TOKEN_RESERVES = 1073000000;

      // Get current reserves from agent (convert string to number)
      const currentSolReserves = parseFloat(agent.tokenomics?.reserve || 0);
      const currentTokenSupply = parseFloat(agent.tokenomics?.currentSupply || 0);

      // Calculate virtual reserves
      const virtualSol = VIRTUAL_SOL_RESERVES + currentSolReserves;
      const virtualTokens = VIRTUAL_TOKEN_RESERVES - currentTokenSupply;

      // Check graduation status
      const isGraduated = agent.isGraduated || currentSolReserves >= 30000;

      if (isGraduated) {
        console.log('🎓 Token is graduated, returning DEX quote message');
        return {
          success: false,
          error: 'GRADUATED_TOKEN',
          message: 'This token has graduated to DEX. Please use DEX trading instead of bonding curve.',
          graduationInfo: {
            isGraduated: true,
            currentReserve: currentSolReserves,
            graduationThreshold: 30000
          }
        };
      }

      // Solana bonding curve calculation (constant product AMM)
      // Formula: sol_out = virtual_sol_reserves - (virtual_sol_reserves * virtual_token_reserves) / (virtual_token_reserves + tokens_in)
      const newTokenReserves = virtualTokens + tokenAmount;
      const product = virtualSol * virtualTokens;
      const newSolReserves = product / newTokenReserves;
      const solReceived = virtualSol - newSolReserves;

      // Calculate current price (SOL per token)
      const currentPrice = virtualSol / virtualTokens;

      // Calculate new price after trade
      const newPrice = newSolReserves / newTokenReserves;

      // Calculate price impact (negative for sells)
      const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;

      // Calculate fees (1% platform + 1% creator = 2% total)
      const platformFeePercent = 0.01; // 1%
      const creatorFeePercent = 0.01;  // 1%
      const platformFeeAmount = solReceived * platformFeePercent;
      const creatorFeeAmount = solReceived * creatorFeePercent;
      const totalFeesAmount = platformFeeAmount + creatorFeeAmount;

      // Calculate slippage (0.5% base)
      const baseSlippage = 0.5;
      const totalSlippage = baseSlippage;

      // Calculate minimum received with slippage protection
      const slippageProtection = totalSlippage / 100;
      const minimumReceived = solReceived * (1 - slippageProtection);

      // Calculate market cap
      const totalSupply = VIRTUAL_TOKEN_RESERVES;
      const marketCap = totalSupply * currentPrice;

      const quote = {
        tokenAmount: tokenAmount.toString(),
        solReceived: solReceived.toString(),
        currentPrice: currentPrice.toString(),
        newPrice: newPrice.toString(),
        priceImpact: Math.abs(priceImpact),
        slippage: totalSlippage,
        fees: {
          platformFee: platformFeePercent.toString(),      // Send as decimal (0.01 = 1%)
          creatorFee: creatorFeePercent.toString(),        // Send as decimal (0.01 = 1%)
          totalFees: (platformFeePercent + creatorFeePercent).toString(),  // Send as decimal (0.02 = 2%)
          platformFeeAmount: platformFeeAmount.toString(), // Actual SOL amount
          creatorFeeAmount: creatorFeeAmount.toString(),   // Actual SOL amount
          totalFeesAmount: totalFeesAmount.toString()      // Actual SOL amount
        },
        minimumReceived: minimumReceived.toString(),
        marketCap: marketCap.toString(),
        reserve: (currentSolReserves - solReceived).toString()
      };

      console.log('✅ Sell quote calculated:', {
        solReceived: solReceived.toFixed(4),
        priceImpact: priceImpact.toFixed(2) + '%',
        currentPrice: currentPrice.toFixed(8)
      });

      return {
        success: true,
        quote
      };
    } catch (error) {
      console.error('Get sell quote error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user's token balance
  async getUserBalance(agentAddress, userAddress) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
      const balance = await agentToken.balanceOf(userAddress);
      
      return {
        success: true,
        balance: ethers.formatEther(balance)
      };
    } catch (error) {
      console.error('Get user balance error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process completed trade (called by event listener)
  // Process completed trade (called by event listener)
async processTrade(tradeData) {
  try {
    const { 
      agentAddress, 
      userAddress, 
      type, // 'buy' or 'sell'
      amount, 
      price, 
      transactionHash,
      blockNumber,
      timestamp 
    } = tradeData;

    // Trade Model import
    const Trade = require('../models/Trade');

    // ✅ 1. Trade DB'ye yaz (duplicate kontrolü ile)
    let existingTrade = await Trade.findOne({ transactionHash });
    if (!existingTrade) {
      const coreAmount = type === 'buy' ? amount : (parseFloat(amount) * parseFloat(price)).toString(); 
      const tokenAmount = type === 'buy' ? (parseFloat(amount) / parseFloat(price)).toString() : amount;

      const newTrade = new Trade({
        agentAddress: agentAddress.toLowerCase(),
        transactionHash,
        blockNumber: blockNumber || 0,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        trader: userAddress.toLowerCase(),
        type,
        coreAmount: coreAmount,
        tokenAmount: tokenAmount,
        price: parseFloat(price) || 0,
        priceUsd: parseFloat(price) || 0,
        gasUsed: 0,
        gasPrice: '0'
      });

      await newTrade.save();
      console.log(`✅ Trade saved in DB: ${transactionHash}`);
    } else {
      console.log(`⚠️ Trade ${transactionHash} already exists, skipping save`);
    }

    // ✅ 2. User kaydı güncelle
    let user = await User.findByWallet(userAddress);
    if (!user) {
      user = new User({ walletAddress: userAddress.toLowerCase() });
      await user.save();
    }

    // ✅ 3. Agent kaydı güncelle
    const agent = await Agent.findByAddress(agentAddress);
    if (!agent) throw new Error('Agent not found');

    // ✅ 4. Portfolio kaydı güncelle
    let portfolio = await Portfolio.findOne({
      userAddress: userAddress.toLowerCase(),
      agentAddress: agentAddress.toLowerCase()
    });

    if (!portfolio) {
      portfolio = new Portfolio({
        user: user._id,
        userAddress: userAddress.toLowerCase(),
        agent: agent._id,
        agentAddress: agentAddress.toLowerCase()
      });
    }

    await portfolio.addTrade(type, amount, price);

    // ✅ 5. User trading stats güncelle
    const tradeValue = parseFloat(amount) * parseFloat(price);
    await user.updateTradingStats({
      volume: tradeValue,
      pnl: type === 'sell' ? parseFloat(portfolio.realizedPnL) : 0
    });

    // ✅ 6. Agent metrics güncelle
    if (type === 'buy') {
      agent.metrics.holders = await Portfolio.countDocuments({
        agentAddress: agentAddress.toLowerCase(),
        balance: { $gt: '0' },
        isActive: true
      });
    }

    agent.metrics.totalTransactions += 1;
    agent.metrics.volumeTotal += tradeValue;
    await agent.save();

    console.log(`✅ Processed ${type} trade: ${amount} tokens for ${userAddress}`);

    return { success: true };
  } catch (error) {
    console.error('Process trade error:', error);
    return { success: false, error: error.message };
  }
}


  // Update portfolio values with current prices
  async updatePortfolioValues(userAddress) {
    try {
      const portfolios = await Portfolio.find({
        userAddress: userAddress.toLowerCase(),
        isActive: true,
        balance: { $gt: '0' }
      }).populate('agent');

      for (const portfolio of portfolios) {
        try {
          const agentToken = new ethers.Contract(
            portfolio.agentAddress, 
            this.AGENT_TOKEN_ABI, 
            this.provider
          );
          
          const currentPrice = await agentToken.getCurrentPrice();
          await portfolio.updateCurrentValue(ethers.formatEther(currentPrice));
          
          // Check alerts
          const triggeredAlerts = portfolio.checkAlerts(ethers.formatEther(currentPrice));
          if (triggeredAlerts.length > 0) {
            // Emit alert events (could be handled by WebSocket service)
            console.log(`🚨 Alerts triggered for ${userAddress}:`, triggeredAlerts);
          }
        } catch (error) {
          console.error(`Error updating portfolio for ${portfolio.agentAddress}:`, error);
        }
      }

      // Update user's total portfolio value
      const portfolioSummary = await Portfolio.getPortfolioSummary(userAddress);
      if (portfolioSummary.length > 0) {
        const user = await User.findByWallet(userAddress);
        if (user) {
          user.totalPortfolioValue = portfolioSummary[0].totalValue;
          user.totalPnL = portfolioSummary[0].totalPnL;
          await user.save();
        }
      }

      return {
        success: true,
        message: 'Portfolio values updated'
      };
    } catch (error) {
      console.error('Update portfolio values error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get user's complete portfolio
  async getUserPortfolio(userAddress) {
    try {
      const portfolios = await Portfolio.getUserPortfolio(userAddress);
      const portfolioSummary = await Portfolio.getPortfolioSummary(userAddress);

      return {
        success: true,
        portfolio: {
          positions: portfolios,
          summary: portfolioSummary[0] || {
            totalValue: 0,
            totalInvested: 0,
            totalPnL: 0,
            positionCount: 0
          }
        }
      };
    } catch (error) {
      console.error('Get user portfolio error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get trading history for user from real transaction events
  async getTradingHistory(userAddress, limit = 50) {
    try {
      console.log(`📊 Getting trading history for ${userAddress}, limit: ${limit}`);

      // Get real trades from Trade model (populated by blockchain events)
      const Trade = require('../models/Trade');

      const trades = await Trade.find({
        $or: [
          { userAddress: userAddress.toLowerCase() },
          { buyer: userAddress.toLowerCase() },
          { seller: userAddress.toLowerCase() }
        ]
      })
      .sort({ timestamp: -1 }) // Newest first
      .limit(limit)
      .lean(); // For better performance

      console.log(`📊 Found ${trades.length} trades for user ${userAddress}`);

      // Transform trades to consistent format
      const history = trades.map(trade => {
        // Determine trade type and user role
        const isBuyer = (trade.buyer && trade.buyer.toLowerCase() === userAddress.toLowerCase()) ||
                       (trade.userAddress && trade.userAddress.toLowerCase() === userAddress.toLowerCase() && trade.type === 'buy');

        const tradeType = isBuyer ? 'buy' : 'sell';

        // Calculate values
        const coreAmount = parseFloat(trade.coreAmount || trade.amount || 0);
        const tokenAmount = parseFloat(trade.tokenAmount || trade.tokensAmount || 0);
        const price = parseFloat(trade.price || 0);

        return {
          id: trade._id.toString(),
          agentAddress: trade.agentAddress,
          agentName: trade.agentName || 'Unknown Agent',
          agentSymbol: trade.agentSymbol || 'TOKEN',
          type: tradeType,
          coreAmount: coreAmount.toString(),
          tokenAmount: tokenAmount.toString(),
          price: price.toString(),
          pricePerToken: tokenAmount > 0 ? (coreAmount / tokenAmount).toString() : '0',
          value: coreAmount.toString(), // Value in CORE
          timestamp: trade.timestamp || trade.createdAt,
          txHash: trade.transactionHash || trade.txHash || 'N/A',
          blockNumber: trade.blockNumber || 0,
          gasUsed: trade.gasUsed || 0,
          gasPrice: trade.gasPrice || '0',
          status: trade.status || 'completed',
          // Additional metadata
          platformFee: trade.platformFee || '0',
          creatorFee: trade.creatorFee || '0',
          totalFees: trade.totalFees || '0',
          priceImpact: trade.priceImpact || 0,
          slippage: trade.slippage || 0
        };
      });

      // Get additional statistics
      const totalTrades = await Trade.countDocuments({
        $or: [
          { userAddress: userAddress.toLowerCase() },
          { buyer: userAddress.toLowerCase() },
          { seller: userAddress.toLowerCase() }
        ]
      });

      // Calculate user trading stats
      const buyTrades = history.filter(trade => trade.type === 'buy');
      const sellTrades = history.filter(trade => trade.type === 'sell');

      const totalBuyVolume = buyTrades.reduce((sum, trade) => sum + parseFloat(trade.coreAmount), 0);
      const totalSellVolume = sellTrades.reduce((sum, trade) => sum + parseFloat(trade.coreAmount), 0);
      const totalVolume = totalBuyVolume + totalSellVolume;

      const stats = {
        totalTrades,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        totalVolume: totalVolume.toString(),
        totalBuyVolume: totalBuyVolume.toString(),
        totalSellVolume: totalSellVolume.toString(),
        averageTradeSize: totalTrades > 0 ? (totalVolume / totalTrades).toString() : '0',
        uniqueAgents: [...new Set(history.map(trade => trade.agentAddress))].length
      };

      console.log(`✅ Trading history retrieved:`, {
        trades: history.length,
        totalTrades,
        totalVolume: totalVolume.toFixed(4) + ' CORE'
      });

      return {
        success: true,
        history,
        stats,
        pagination: {
          limit,
          total: totalTrades,
          hasMore: totalTrades > limit
        }
      };

    } catch (error) {
      console.error('❌ Get trading history error:', error);
      return {
        success: false,
        error: error.message,
        history: [],
        stats: {
          totalTrades: 0,
          buyTrades: 0,
          sellTrades: 0,
          totalVolume: '0',
          totalBuyVolume: '0',
          totalSellVolume: '0',
          averageTradeSize: '0',
          uniqueAgents: 0
        }
      };
    }
  }

  // Helper functions
  calculatePriceImpact(currentPrice, newPrice, tradeAmount) {
    const currentPriceNum = parseFloat(currentPrice);
    const newPriceNum = parseFloat(newPrice);
    
    if (currentPriceNum === 0) return 0;
    
    return ((newPriceNum - currentPriceNum) / currentPriceNum) * 100;
  }

  calculateSlippage(priceImpact) {
    // Simple slippage calculation based on price impact
    return Math.abs(priceImpact) * 1.2; // 20% buffer on price impact
  }

  // Assess trade risk based on multiple factors
  assessTradeRisk(priceImpact, tradeSize, reserveSize) {
    let riskScore = 0;

    // Price impact risk
    if (priceImpact > 10) riskScore += 3;
    else if (priceImpact > 5) riskScore += 2;
    else if (priceImpact > 2) riskScore += 1;

    // Trade size risk (relative to reserve)
    if (tradeSize > 0.1) riskScore += 3; // >10% of reserve
    else if (tradeSize > 0.05) riskScore += 2; // >5% of reserve
    else if (tradeSize > 0.02) riskScore += 1; // >2% of reserve

    // Liquidity risk
    if (reserveSize < 10) riskScore += 2; // Low liquidity
    else if (reserveSize < 50) riskScore += 1; // Medium liquidity

    // Return risk level
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  // Calculate optimal trade size to minimize slippage
  calculateOptimalTradeSize(reserveSize, targetAmount) {
    const maxRecommended = reserveSize * 0.05; // 5% of reserve

    if (targetAmount <= maxRecommended) {
      return {
        recommended: targetAmount,
        shouldSplit: false,
        splits: 1
      };
    }

    const splits = Math.ceil(targetAmount / maxRecommended);
    return {
      recommended: maxRecommended,
      shouldSplit: true,
      splits,
      splitAmount: targetAmount / splits
    };
  }

  // Get market data for agent
  async getMarketData(agentAddress) {
    try {
      const agentToken = new ethers.Contract(agentAddress, this.AGENT_TOKEN_ABI, this.provider);
      
      const [currentPrice, bondingCurveInfo, totalSupply, name, symbol] = await Promise.all([
        agentToken.getCurrentPrice(),
        agentToken.getBondingCurveInfo(),
        agentToken.totalSupply(),
        agentToken.name(),
        agentToken.symbol()
      ]);

      return {
        success: true,
        marketData: {
          name,
          symbol,
          currentPrice: ethers.formatEther(currentPrice),
          totalSupply: ethers.formatEther(totalSupply),
          marketCap: ethers.formatEther(bondingCurveInfo.marketCap),
          reserve: ethers.formatEther(bondingCurveInfo.reserve),
          bondingCurvePrice: ethers.formatEther(bondingCurveInfo.price),
          supply: ethers.formatEther(bondingCurveInfo.supply)
        }
      };
    } catch (error) {
      console.error('Get market data error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update agent volume after successful trade
  async updateAgentVolume(agentAddress, coreAmount) {
    try {
      const agent = await Agent.findOne({ contractAddress: agentAddress });
      if (!agent) {
        console.log(`Agent not found for volume update: ${agentAddress}`);
        return;
      }

      // Add trade amount to 24h volume
      const currentVolume = agent.metrics.volume24h || 0;
      const newVolume = currentVolume + parseFloat(coreAmount || 0);

      await Agent.updateOne(
        { contractAddress: agentAddress },
        {
          $set: {
            'metrics.volume24h': newVolume,
            'metrics.lastTradeAt': new Date()
          }
        }
      );

      console.log(`📊 Updated volume for ${agentAddress}: ${currentVolume} -> ${newVolume} CORE`);
      return newVolume;
    } catch (error) {
      console.error('Error updating agent volume:', error);
      return null;
    }
  }
}

module.exports = new TradingService();
