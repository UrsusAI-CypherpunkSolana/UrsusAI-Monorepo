/**
 * ⚠️ DEPRECATED: This service is for EVM/Ethereum-based trading
 *
 * For Solana trading, use SolanaBlockchainService instead:
 * - SolanaBlockchainService.buyTokens() for buy transactions
 * - SolanaBlockchainService.sellTokens() for sell transactions
 *
 * This file is kept for reference and backward compatibility only.
 * All new trading functionality should use SolanaBlockchainService.
 */

const { ethers } = require('ethers');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const BlockchainDataService = require('./BlockchainDataService');
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

const ERC20_MINI_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)"
];

async function getTokenDecimals(provider, tokenAddress) {
  const erc20 = new ethers.Contract(tokenAddress, ERC20_MINI_ABI, provider);
  try { return await erc20.decimals(); } catch { return 18; }
}

function parseTokenTransfersFromReceipt(receipt, tokenAddress, userAddress) {
  const iface = new ethers.Interface(ERC20_MINI_ABI);
  let toUser = 0n;     // kullanıcıya gelen token (buy)
  let fromUser = 0n;   // kullanıcıdan çıkan token (sell)

  for (const log of receipt.logs || []) {
    if ((log.address || '').toLowerCase() !== tokenAddress.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog(log);
      if (parsed.name === 'Transfer') {
        const from = parsed.args.from.toLowerCase();
        const to = parsed.args.to.toLowerCase();
        const value = parsed.args.value;
        if (to === userAddress.toLowerCase()) toUser += value;
        if (from === userAddress.toLowerCase()) fromUser += value;
      }
    } catch (_) {}
  }
  return { toUser, fromUser };
}

class RealTradingEngine {
  constructor(databaseService, websocketService) {
    this.databaseService = databaseService;
    this.websocketService = websocketService;
    this.blockchainService = new BlockchainDataService();
    this.provider = this.blockchainService.provider;

    // Trading configuration
    this.config = {
      maxSlippage: 0.05, // 5% max slippage
      minTradeAmount: 0.001, // Minimum 0.001 SOL
      // maxTradeAmount removed - users can trade any amount
      gasLimitMultiplier: 1.2, // 20% gas limit buffer
      maxGasPrice: ethers.parseUnits('100', 'gwei'), // Max 100 gwei
      tradingFee: 0.003 // 0.3% trading fee
    };

    console.log('⚠️ DEPRECATED: RealTradingEngine initialized (EVM-based). Use SolanaBlockchainService for Solana trading.');
  }

  // Execute a buy order
  // Execute a buy order
async executeBuyOrder(userAddress, agentAddress, coreAmount, options = {}) {
  try {
    console.log(`🔥 Executing buy order: ${coreAmount} CORE for ${agentAddress}`);

    const validation = await this.validateTradeInputs(userAddress, agentAddress, coreAmount, 'buy');
    if (!validation.isValid) throw new Error(validation.error);

    const quote = await this.blockchainService.getBuyQuote(agentAddress, coreAmount);
    if (!quote.success) throw new Error(`Failed to get buy quote: ${quote.error}`);

    const slippage = this.calculateSlippage(quote.priceImpact);
    if (slippage > this.config.maxSlippage) {
      throw new Error(`Slippage too high: ${(slippage * 100).toFixed(2)}%`);
    }

    // Frontend'in imzalayıp göndereceği tx datası (UI'ye dönebilmek için hâlâ üretiyoruz)
    const txData = await this.prepareBuyTransaction(userAddress, agentAddress, coreAmount, quote, options);

    // Execute transaction: expects signedTx or txHash from frontend
    const result = await this.executeTransaction(txData, options);

    // Eğer kullanıcı sadece txData istiyorsa, burada dönebiliriz (opsiyonel)
    if (options.returnTxOnly) {
      return { success: true, action: 'SIGN_AND_SEND', txData, quote };
    }

    if (!result.success) throw new Error(result.error);

    // Makbuzdan gerçek token/core miktarlarını çıkart
    const receipt = result.receipt;
    const decimals = await getTokenDecimals(this.provider, agentAddress);
    const { toUser } = parseTokenTransfersFromReceipt(receipt, agentAddress, userAddress);

    // coreAmount'ı tx'ten al
    const sentTx = await this.provider.getTransaction(result.transactionHash);
    const coreIn = sentTx && sentTx.value ? Number(ethers.formatEther(sentTx.value)) : Number(coreAmount);

    const tokensReceivedHuman = Number(ethers.formatUnits(toUser, decimals));
    const effectivePrice = tokensReceivedHuman > 0 ? coreIn / tokensReceivedHuman : Number(quote.currentPrice);

    await this.processSuccessfulTrade({
      type: 'buy',
      userAddress,
      agentAddress,
      coreAmount: coreIn,
      tokenAmount: tokensReceivedHuman,
      price: effectivePrice,
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed,
      gasPrice: result.gasPrice,
      slippage,
      fee: coreIn * this.config.tradingFee,
      blockNumber: result.blockNumber
    });

    return {
      success: true,
      transactionHash: result.transactionHash,
      tokensReceived: tokensReceivedHuman,
      price: effectivePrice,
      slippage,
      gasUsed: result.gasUsed,
      totalCost: coreIn + (coreIn * this.config.tradingFee)
    };

  } catch (error) {
    console.error('❌ Buy order failed:', error);
    await this.logFailedTrade({ type: 'buy', userAddress, agentAddress, coreAmount, error: error.message, timestamp: new Date() });
    throw error;
  }
}


async executeSellOrder(userAddress, agentAddress, tokenAmount, options = {}) {
  try {
    console.log(`🔥 Executing sell order: ${tokenAmount} tokens for ${agentAddress}`);

    const validation = await this.validateTradeInputs(userAddress, agentAddress, tokenAmount, 'sell');
    if (!validation.isValid) throw new Error(validation.error);

    const quote = await this.blockchainService.getSellQuote(agentAddress, tokenAmount);
    if (!quote.success) throw new Error(`Failed to get sell quote: ${quote.error}`);

    const slippage = this.calculateSlippage(quote.priceImpact);
    if (slippage > this.config.maxSlippage) {
      throw new Error(`Slippage too high: ${(slippage * 100).toFixed(2)}%`);
    }

    const txData = await this.prepareSellTransaction(userAddress, agentAddress, tokenAmount, quote, options);
    const result = await this.executeTransaction(txData, options);
    if (!result.success) throw new Error(result.error);

    const receipt = result.receipt;
    const decimals = await getTokenDecimals(this.provider, agentAddress);
    const { fromUser } = parseTokenTransfersFromReceipt(receipt, agentAddress, userAddress);
    const tokensSoldHuman = Number(ethers.formatUnits(fromUser, decimals));

    // CORE tarafı: WCORE kullanıyorsanız loglardan kullanıcıya gelen WCORE’u toplayın
    let coreOut = 0;
    if (process.env.WCORE_ADDRESS) {
      const { toUser: wToUser } = parseTokenTransfersFromReceipt(
        receipt,
        process.env.WCORE_ADDRESS,
        userAddress
      );
      coreOut = Number(ethers.formatEther(wToUser)); // WCORE 18 dec varsayıyoruz
    } else {
      // Router eventlerinden okunmadıysa son çare: quote.currentPrice ile tahmin
      coreOut = Number(quote.coreReceived || (tokensSoldHuman * Number(quote.currentPrice)));
    }

    const effectivePrice = tokensSoldHuman > 0 ? coreOut / tokensSoldHuman : Number(quote.currentPrice);

    await this.processSuccessfulTrade({
      type: 'sell',
      userAddress,
      agentAddress,
      coreAmount: coreOut,
      tokenAmount: tokensSoldHuman,
      price: effectivePrice,
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed,
      gasPrice: result.gasPrice,
      slippage,
      fee: coreOut * this.config.tradingFee,
      blockNumber: result.blockNumber
    });

    return {
      success: true,
      transactionHash: result.transactionHash,
      coreReceived: coreOut,
      price: effectivePrice,
      slippage,
      gasUsed: result.gasUsed,
      netReceived: coreOut - (coreOut * this.config.tradingFee)
    };

  } catch (error) {
    console.error('❌ Sell order failed:', error);
    await this.logFailedTrade({ type: 'sell', userAddress, agentAddress, tokenAmount, error: error.message, timestamp: new Date() });
    throw error;
  }
}


  // Validate trade inputs
  async validateTradeInputs(userAddress, agentAddress, amount, type) {
    try {
      // Validate addresses
      if (!ethers.isAddress(userAddress)) {
        return { isValid: false, error: 'Invalid user address' };
      }
      
      if (!ethers.isAddress(agentAddress)) {
        return { isValid: false, error: 'Invalid agent address' };
      }
      
      // Validate amount
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return { isValid: false, error: 'Invalid amount' };
      }
      
      // Check amount limits
      if (type === 'buy') {
        if (numAmount < this.config.minTradeAmount) {
          return { isValid: false, error: `Minimum trade amount is ${this.config.minTradeAmount} CORE` };
        }

        // Maximum trade amount limit removed - users can trade any amount
      }
      
      // Check if agent exists and is active
      const agent = await Agent.findOne({ 
        contractAddress: agentAddress.toLowerCase(),
        isActive: true
      });
      
      if (!agent) {
        return { isValid: false, error: 'Agent not found or inactive' };
      }
      
      // Check if user exists
      let user = await User.findOne({ walletAddress: userAddress.toLowerCase() });
      if (!user) {
        // Create user if doesn't exist
        user = new User({
          walletAddress: userAddress.toLowerCase(),
          username: null,
          email: null
        });
        await user.save();
      }
      
      return { isValid: true, agent, user };
      
    } catch (error) {
      console.error('❌ Trade validation error:', error);
      return { isValid: false, error: 'Validation failed' };
    }
  }

  // Calculate slippage
  calculateSlippage(priceImpact) {
    return Math.abs(priceImpact) / 100; // Convert percentage to decimal
  }

  /**
   * ⚠️ DEPRECATED: EVM-based transaction preparation
   *
   * For Solana, use SolanaBlockchainService.buyTokens() instead.
   * Solana transactions are prepared using Anchor framework:
   *
   * Example:
   * const solanaService = new SolanaBlockchainService();
   * const result = await solanaService.buyTokens({
   *   agentAddress: 'agent_pubkey',
   *   solAmount: '0.1',
   *   minTokensOut: '0',
   *   buyerPublicKey: 'buyer_pubkey'
   * });
   */
  async prepareBuyTransaction(userAddress, agentAddress, coreAmount, quote, options) {
    console.warn('⚠️ prepareBuyTransaction is deprecated for Solana. Use SolanaBlockchainService.buyTokens() instead.');
    throw new Error('EVM-based trading is deprecated. Use SolanaBlockchainService for Solana trading.');
  }

  /**
   * ⚠️ DEPRECATED: EVM-based transaction preparation
   *
   * For Solana, use SolanaBlockchainService.sellTokens() instead.
   * Solana transactions are prepared using Anchor framework:
   *
   * Example:
   * const solanaService = new SolanaBlockchainService();
   * const result = await solanaService.sellTokens({
   *   agentAddress: 'agent_pubkey',
   *   tokenAmount: '1000',
   *   minSolOut: '0',
   *   sellerPublicKey: 'seller_pubkey'
   * });
   */
  async prepareSellTransaction(userAddress, agentAddress, tokenAmount, quote, options) {
    console.warn('⚠️ prepareSellTransaction is deprecated for Solana. Use SolanaBlockchainService.sellTokens() instead.');
    throw new Error('EVM-based trading is deprecated. Use SolanaBlockchainService for Solana trading.');
  }

// Execute transaction (expects txHash or signedTx from frontend)
async executeTransaction(txData, options = {}) {
  try {
    // 1) Frontend'ten imzalı raw tx geldiyse yayınla
    if (options.signedTx) {
      const resp = await this.provider.broadcastTransaction(options.signedTx);
      const receipt = await resp.wait(); // v6'da txResponse.wait()
      const fullTx = await this.provider.getTransaction(receipt.hash);
      return {
        success: true,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed?.toString() ?? '0',
        gasPrice: (fullTx.gasPrice || fullTx.maxFeePerGas || 0n).toString(),
        blockNumber: receipt.blockNumber,
        receipt
      };
    }

    // 2) Frontend işlemi gönderip txHash verdiyse, zincirde onayını bekle
    if (options.txHash) {
      const receipt = await this.provider.waitForTransaction(options.txHash);
      if (!receipt || receipt.status === 0) {
        throw new Error('Transaction failed or not found');
      }
      const fullTx = await this.provider.getTransaction(options.txHash);
      return {
        success: true,
        transactionHash: options.txHash,
        gasUsed: receipt.gasUsed?.toString() ?? '0',
        gasPrice: (fullTx?.gasPrice || fullTx?.maxFeePerGas || 0n).toString(),
        blockNumber: receipt.blockNumber,
        receipt
      };
    }

    // Sunucu işlem GÖNDERMEZ; ya signedTx ya txHash gelmeli
    throw new Error('No signedTx or txHash provided. Backend does not sign transactions.');
  } catch (error) {
    return { success: false, error: error.message };
  }
}


  // Process successful trade
  async processSuccessfulTrade(tradeData) {
    try {
      // Create trade record
      const trade = new Trade({
        agentAddress: tradeData.agentAddress.toLowerCase(),
        transactionHash: tradeData.transactionHash,
        blockNumber: tradeData.blockNumber || 0,
        timestamp: new Date(),
        trader: tradeData.userAddress.toLowerCase(),
        type: tradeData.type,
        coreAmount: tradeData.coreAmount.toString(),
        tokenAmount: tradeData.tokenAmount.toString(),
        price: tradeData.price,
        priceUsd: tradeData.price, // Assuming CORE = USD for now
        gasUsed: tradeData.gasUsed || 0,
        gasPrice: tradeData.gasPrice || '0',
        slippage: tradeData.slippage || 0,
        fee: tradeData.fee || 0
      });
      
      await trade.save();
      
      // Update user portfolio
      await this.updateUserPortfolio(tradeData);
      
      // Update agent metrics
      await this.updateAgentMetrics(tradeData.agentAddress);
      
      // Broadcast real-time update
      this.broadcastTradeUpdate(tradeData);
      
      // Clear relevant caches
      await this.clearTradingCaches(tradeData.agentAddress);
      
      console.log(`✅ Trade processed successfully: ${tradeData.transactionHash}`);
      
    } catch (error) {
      console.error('❌ Error processing successful trade:', error);
      throw error;
    }
  }

  // Update user portfolio
  async updateUserPortfolio(tradeData) {
    try {
      // Find or create portfolio
      let portfolio = await Portfolio.findOne({
        userAddress: tradeData.userAddress.toLowerCase(),
        agentAddress: tradeData.agentAddress.toLowerCase()
      });
      
      if (!portfolio) {
        const agent = await Agent.findOne({ 
          contractAddress: tradeData.agentAddress.toLowerCase() 
        });
        
        const user = await User.findOne({ 
          walletAddress: tradeData.userAddress.toLowerCase() 
        });
        
        portfolio = new Portfolio({
          user: user._id,
          userAddress: tradeData.userAddress.toLowerCase(),
          agent: agent._id,
          agentAddress: tradeData.agentAddress.toLowerCase()
        });
      }
      
      // Update portfolio based on trade type
      if (tradeData.type === 'buy') {
        const currentBalance = parseFloat(portfolio.balance);
        const currentInvested = parseFloat(portfolio.totalInvested);
        const tokenAmount = parseFloat(tradeData.tokenAmount);
        const coreAmount = parseFloat(tradeData.coreAmount);
        
        const newBalance = currentBalance + tokenAmount;
        const newInvested = currentInvested + coreAmount;
        const newAvgPrice = newInvested / newBalance;
        
        portfolio.balance = newBalance.toString();
        portfolio.totalInvested = newInvested.toString();
        portfolio.averageBuyPrice = newAvgPrice.toString();
        
      } else { // sell
        const currentBalance = parseFloat(portfolio.balance);
        const currentInvested = parseFloat(portfolio.totalInvested);
        const tokenAmount = parseFloat(tradeData.tokenAmount);
        const coreReceived = parseFloat(tradeData.coreAmount);
        
        const newBalance = Math.max(0, currentBalance - tokenAmount);
        const sellRatio = tokenAmount / currentBalance;
        const newInvested = currentInvested * (1 - sellRatio);
        
        portfolio.balance = newBalance.toString();
        portfolio.totalInvested = newInvested.toString();
        
        // Calculate realized P&L
        const costBasis = parseFloat(portfolio.averageBuyPrice) * tokenAmount;
        const realizedPnL = coreReceived - costBasis;
        
        portfolio.realizedPnL = (parseFloat(portfolio.realizedPnL) + realizedPnL).toString();
      }
      
      // Update current value and last trade time
      portfolio.currentValue = (parseFloat(portfolio.balance) * tradeData.price).toString();
      portfolio.lastTradeAt = new Date();
      
      await portfolio.save();
      
    } catch (error) {
      console.error('❌ Error updating portfolio:', error);
      throw error;
    }
  }

  // Update agent metrics
  async updateAgentMetrics(agentAddress) {
    try {
      // This would trigger the real-time data processor
      // to recalculate agent metrics
      console.log(`📊 Updating metrics for agent: ${agentAddress}`);
      
      // Clear agent cache
      if (this.databaseService) {
        await this.databaseService.clearCachePattern(`agent:${agentAddress}:*`);
      }
      
    } catch (error) {
      console.error('❌ Error updating agent metrics:', error);
    }
  }

  // Broadcast trade update
  broadcastTradeUpdate(tradeData) {
    if (this.websocketService) {
      this.websocketService.broadcast({
        type: 'realTradeExecuted',
        agentAddress: tradeData.agentAddress,
        trade: {
          type: tradeData.type,
          amount: tradeData.tokenAmount,
          price: tradeData.price,
          timestamp: new Date(),
          trader: tradeData.userAddress,
          transactionHash: tradeData.transactionHash
        },
        timestamp: Date.now()
      });
    }
  }

  // Clear trading-related caches
  async clearTradingCaches(agentAddress) {
    if (this.databaseService) {
      await this.databaseService.clearCachePattern(`agent:${agentAddress}:*`);
      await this.databaseService.clearCachePattern(`chart:${agentAddress}:*`);
      await this.databaseService.clearCachePattern(`price:${agentAddress}:*`);
    }
  }

  // Log failed trade attempt
  async logFailedTrade(failureData) {
    try {
      console.error('📝 Logging failed trade:', failureData);
      
      // In a production system, you might want to store failed trades
      // for analysis and debugging purposes
      
    } catch (error) {
      console.error('❌ Error logging failed trade:', error);
    }
  }

  // Get trading statistics
  async getTradingStats(userAddress) {
    try {
      const trades = await Trade.find({
        trader: userAddress.toLowerCase()
      }).sort({ timestamp: -1 });
      
      const portfolios = await Portfolio.find({
        userAddress: userAddress.toLowerCase(),
        isActive: true
      }).populate('agent');
      
      // Calculate statistics
      const totalTrades = trades.length;
      const totalVolume = trades.reduce((sum, trade) => sum + parseFloat(trade.coreAmount), 0);
      const totalFees = trades.reduce((sum, trade) => sum + (trade.fee || 0), 0);
      
      const buyTrades = trades.filter(t => t.type === 'buy');
      const sellTrades = trades.filter(t => t.type === 'sell');
      
      const totalInvested = portfolios.reduce((sum, p) => sum + parseFloat(p.totalInvested), 0);
      const currentValue = portfolios.reduce((sum, p) => sum + parseFloat(p.currentValue), 0);
      const realizedPnL = portfolios.reduce((sum, p) => sum + parseFloat(p.realizedPnL), 0);
      const unrealizedPnL = currentValue - totalInvested;
      
      return {
        totalTrades,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        totalVolume,
        totalFees,
        totalInvested,
        currentValue,
        realizedPnL,
        unrealizedPnL,
        totalPnL: realizedPnL + unrealizedPnL,
        portfolios: portfolios.length,
        avgTradeSize: totalTrades > 0 ? totalVolume / totalTrades : 0
      };
      
    } catch (error) {
      console.error('❌ Error getting trading stats:', error);
      throw error;
    }
  }

  // Get current price for an agent
  async getCurrentPrice(agentAddress) {
    try {
      const agent = await Agent.findOne({
        contractAddress: agentAddress.toLowerCase()
      });

      if (!agent) {
        return null;
      }

      // Try to get from blockchain first
      try {
        const quote = await this.blockchainService.getBuyQuote(agentAddress, 0.001);
        if (quote.success && quote.currentPrice) {
          return quote.currentPrice;
        }
      } catch (error) {
        console.log('Failed to get price from blockchain, using cached price');
      }

      // Fallback to cached price
      return agent.currentPrice || '0';
    } catch (error) {
      console.error('Error getting current price:', error);
      return null;
    }
  }
  // Zincirde onaylanmış tx'i çöz ve Trade kaydı oluştur
async ingestOnchainTransaction(txHash, agentAddress) {
  try {
    const agentAddr = agentAddress.toLowerCase();

    // 1) Tx ve receipt al (gerekirse bekle)
    let tx = await this.provider.getTransaction(txHash);
    if (!tx) {
      // pending ise, mine olana kadar bekle
      const receiptWait = await this.provider.waitForTransaction(txHash, 1);
      tx = await this.provider.getTransaction(txHash);
      if (!receiptWait || !tx) {
        throw new Error('Transaction not found or not mined yet');
      }
    }
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) throw new Error('Transaction receipt not found');
    if (receipt.status !== 1n && receipt.status !== 1) {
      throw new Error('Transaction failed on-chain');
    }

    // 2) Blok zamanı
    const block = await this.provider.getBlock(receipt.blockNumber);
    const ts = new Date(Number(block.timestamp) * 1000);

    // 3) Agent token'ın ERC20 Transfer logunu bul
    const transferLog = receipt.logs.find(
      (l) =>
        (l.address && l.address.toLowerCase() === agentAddr) &&
        l.topics && l.topics.length >= 3 &&
        l.topics[0].toLowerCase() === TRANSFER_TOPIC.toLowerCase()
    );
    if (!transferLog) {
      throw new Error('No ERC20 Transfer log found for agent token');
    }

    // 4) Transfer logundan from/to ve miktar çıkar
    const topicToAddr = (t) => ethers.getAddress('0x' + t.slice(26));
    const fromAddr = topicToAddr(transferLog.topics[1]);
    const toAddr   = topicToAddr(transferLog.topics[2]);

    // amount (uint256) -> BigInt
    const amountRaw = BigInt(transferLog.data);
    // token decimals oku
    const erc20 = new ethers.Contract(
      agentAddress,
      ['function decimals() view returns (uint8)'],
      this.provider
    );
    const decimals = await erc20.decimals();
    const tokenAmountStr = ethers.formatUnits(amountRaw, decimals);

    // 5) İşlem tipini belirle (basit kural):
    // user token ALDIYSA => to == tx.from  => BUY
    // user token GÖNDERDİYSE => from == tx.from => SELL
    let type;
    if (toAddr.toLowerCase() === tx.from.toLowerCase()) {
      type = 'buy';
    } else if (fromAddr.toLowerCase() === tx.from.toLowerCase()) {
      type = 'sell';
    } else {
      // kullanıcı taraflı bir trade değil; yine de kaydetmek istemiyoruz
      throw new Error('Cannot infer trade direction for user');
    }

    // 6) CORE miktarı ve fiyat
    // BUY: native CORE gönderimi tx.value'dan okunur (doğrudan zincir verisi)
    // SELL: native geri dönüş internal transfer olduğundan net CORE miktarını receipt'ten
    // standart JSON-RPC ile kesin ayıklamak zor; şimdilik sadece BUY için zincirden %100 kesin değer.
    let coreAmountStr = '0';
    if (type === 'buy') {
      coreAmountStr = ethers.formatEther(tx.value || 0n);
    } else {
      // SELL için CORE girişi internal value transfer olduğundan standart receipt'te direkt yok.
      // Burada güvenilir hesaplama için DEX/kontrat spesifik event gerekir.
      // Şimdilik sell işlemlerini kayıt altına alıyor ama coreAmount=0 bırakıyoruz ki
      // candle’ları yanlış şişirmeyelim. (İleride kontrat event’ine göre iyileştireceğiz.)
      coreAmountStr = '0';
    }

    // Fiyat: core/token (sadece tokenAmount>0 ise)
    const tokenAmountNum = parseFloat(tokenAmountStr);
    const coreAmountNum  = parseFloat(coreAmountStr);
    const price = tokenAmountNum > 0 ? coreAmountNum / tokenAmountNum : 0;

    // 7) Var olan kaydı kontrol et (idempotent)
    const exist = await Trade.findOne({ transactionHash: txHash }).lean();
    if (exist) {
      return { alreadyRecorded: true, transactionHash: txHash };
    }

    // 8) processSuccessfulTrade ile tek yerden kayıt/portföy/metric/WS/cache yönet
    await this.processSuccessfulTrade({
      type,
      userAddress: tx.from,
      agentAddress,
      coreAmount: coreAmountStr,          // BUY için zincirden gerçek değer
      tokenAmount: tokenAmountStr,        // log’dan gerçek değer
      price: price,
      transactionHash: txHash,
      gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) : 0,
      gasPrice: receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : '0',
      slippage: 0,                        // isteğe bağlı, zincirden türetmiyoruz
      fee: 0,                             // engine fee mantığınız varsa ekleyebilirsiniz
      blockNumber: Number(receipt.blockNumber),
      timestamp: ts
    });

    return {
      recorded: true,
      type,
      agentAddress,
      trader: tx.from,
      tokenAmount: tokenAmountStr,
      coreAmount: coreAmountStr,
      price,
      blockNumber: Number(receipt.blockNumber),
      timestamp: ts.toISOString(),
      txHash
    };
  } catch (err) {
    console.error('❌ ingestOnchainTransaction error:', err);
    throw err;
  }
}

}

module.exports = RealTradingEngine;
