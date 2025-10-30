const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { ethers } = require('ethers');
const AuthService = require('../services/AuthService');
const TradingService = require('../services/TradingService');
const RealTradingEngine = require('../services/RealTradingEngine');
const Portfolio = require('../models/Portfolio');
const Trade = require('../models/Trade');
const router = express.Router();

// Initialize real trading engine
const realTradingEngine = new RealTradingEngine(global.databaseService, global.websocketService);

// Helper function to validate Solana address
// Solana addresses are 32-44 characters in base58 format
// NOTE: We also accept lowercase addresses since they're stored lowercase in DB
function isSolanaAddress(address) {
  // Check if it's the right length (32-44 characters)
  if (!address || address.length < 32 || address.length > 44) {
    return false;
  }

  // Additional check: must not be a valid MongoDB ObjectId (24 hex characters)
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(address);
  if (isObjectId) {
    return false;
  }

  // Check if it contains only alphanumeric characters (base58-like)
  // We accept both uppercase and lowercase since DB stores them lowercase
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(address);
}

// Custom validator for Solana addresses
const validateSolanaAddress = (value) => {
  if (!isSolanaAddress(value)) {
    throw new Error('Invalid Solana address');
  }
  return true;
};

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// GET /api/trading/quote/buy/:agentAddress - Get buy quote
router.get('/quote/buy/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress),
    query('amount').isFloat({ min: 0.0001 }).withMessage('Amount must be at least 0.0001 SOL')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { amount } = req.query;

      console.log(`🔄 Processing buy quote request: ${agentAddress}, amount: ${amount}`);

      const quote = await TradingService.getBuyQuote(agentAddress, parseFloat(amount));

      if (quote.success) {
        console.log(`✅ Buy quote successful for ${agentAddress}`);
        res.json(quote);
      } else {
        console.log(`❌ Buy quote failed for ${agentAddress}: ${quote.error}`);
        res.status(400).json({
          success: false,
          error: quote.error,
          details: {
            agentAddress,
            amount: parseFloat(amount),
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Get buy quote error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// GET /api/trading/quote/sell/:agentAddress - Get sell quote
router.get('/quote/sell/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress),
    query('amount').isFloat({ min: 0.0001 }).withMessage('Amount must be at least 0.0001 tokens')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { amount } = req.query;

      console.log(`🔄 Processing sell quote request: ${agentAddress}, amount: ${amount}`);

      const quote = await TradingService.getSellQuote(agentAddress, parseFloat(amount));

      if (quote.success) {
        console.log(`✅ Sell quote successful for ${agentAddress}`);
        res.json(quote);
      } else {
        console.log(`❌ Sell quote failed for ${agentAddress}: ${quote.error}`);
        res.status(400).json({
          success: false,
          error: quote.error,
          details: {
            agentAddress,
            amount: parseFloat(amount),
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Get sell quote error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// GET /api/trading/balance/:agentAddress - Get user's token balance
router.get('/balance/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress),
    query('userAddress').custom(validateSolanaAddress)
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { userAddress } = req.query;

      if (!userAddress) {
        return res.status(400).json({ error: 'User address required as query parameter' });
      }

      const balance = await TradingService.getUserBalance(agentAddress, userAddress);
      
      if (balance.success) {
        res.json(balance);
      } else {
        res.status(400).json({ error: balance.error });
      }
    } catch (error) {
      console.error('Get balance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trading/portfolio - Get user's portfolio
router.get('/portfolio',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const userAddress = req.user.walletAddress;

      if (!userAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const portfolio = await TradingService.getUserPortfolio(userAddress);
      
      if (portfolio.success) {
        res.json(portfolio);
      } else {
        res.status(400).json({ error: portfolio.error });
      }
    } catch (error) {
      console.error('Get portfolio error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/trading/portfolio/refresh - Refresh portfolio values
router.post('/portfolio/refresh',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const userAddress = req.user.walletAddress;

      if (!userAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const result = await TradingService.updatePortfolioValues(userAddress);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Refresh portfolio error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trading/history - Get trading history
router.get('/history',
  AuthService.authenticateToken,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const userAddress = req.user.walletAddress;
      const limit = parseInt(req.query.limit) || 50;

      if (!userAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const history = await TradingService.getTradingHistory(userAddress, limit);
      
      if (history.success) {
        res.json(history);
      } else {
        res.status(400).json({ error: history.error });
      }
    } catch (error) {
      console.error('Get trading history error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trading/market/:agentAddress - Get market data
router.get('/market/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress)
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;

      const marketData = await TradingService.getMarketData(agentAddress);
      
      if (marketData.success) {
        res.json(marketData);
      } else {
        res.status(400).json({ error: marketData.error });
      }
    } catch (error) {
      console.error('Get market data error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/trading/alerts - Set price alerts
router.post('/alerts',
  AuthService.authenticateToken,
  [
    body('agentAddress').custom(validateSolanaAddress),
    body('type').isIn(['above', 'below']).withMessage('Type must be above or below'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be positive')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress, type, price } = req.body;
      const userAddress = req.user.walletAddress;

      if (!userAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      // Find portfolio
      const portfolio = await Portfolio.findOne({
        userAddress: userAddress.toLowerCase(),
        agentAddress: agentAddress.toLowerCase()
      });

      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio position not found' });
      }

      // Add price alert
      await portfolio.addPriceAlert(type, price);

      res.json({
        success: true,
        message: 'Price alert added successfully'
      });
    } catch (error) {
      console.error('Set price alert error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trading/alerts - Get user's alerts
router.get('/alerts',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const userAddress = req.user.walletAddress;

      if (!userAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }

      const portfolios = await Portfolio.find({
        userAddress: userAddress.toLowerCase(),
        $or: [
          { 'alerts.priceAlerts.0': { $exists: true } },
          { 'alerts.pnlAlerts.0': { $exists: true } }
        ]
      }).populate('agent', 'name symbol contractAddress');

      const alerts = portfolios.map(portfolio => ({
        agent: portfolio.agent,
        priceAlerts: portfolio.alerts.priceAlerts.filter(alert => !alert.triggered),
        pnlAlerts: portfolio.alerts.pnlAlerts.filter(alert => !alert.triggered)
      })).filter(item => item.priceAlerts.length > 0 || item.pnlAlerts.length > 0);

      res.json({
        success: true,
        alerts
      });
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/trading/leaderboard - Get trading leaderboard
router.get('/leaderboard',
  [
    query('metric').optional().isIn(['volume', 'pnl', 'winRate']).withMessage('Invalid metric'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const metric = req.query.metric || 'volume';
      const limit = parseInt(req.query.limit) || 10;

      const User = require('../models/User');
      
      let sortField;
      switch (metric) {
        case 'volume':
          sortField = 'tradingStats.totalVolume';
          break;
        case 'pnl':
          sortField = 'totalPnL';
          break;
        case 'winRate':
          sortField = 'tradingStats.winRate';
          break;
        default:
          sortField = 'tradingStats.totalVolume';
      }

      const leaderboard = await User.find({
        'tradingStats.totalTrades': { $gt: 0 }
      })
      .select('username walletAddress avatar tradingStats totalPnL totalPortfolioValue')
      .sort({ [sortField]: -1 })
      .limit(limit);

      res.json({
        success: true,
        leaderboard: leaderboard.map((user, index) => ({
          rank: index + 1,
          username: user.username || `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`,
          walletAddress: user.walletAddress,
          avatar: user.avatar,
          stats: {
            totalVolume: user.tradingStats.totalVolume,
            totalTrades: user.tradingStats.totalTrades,
            winRate: user.tradingStats.winRate,
            totalPnL: user.totalPnL,
            portfolioValue: user.totalPortfolioValue
          }
        }))
      });
    } catch (error) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/trading/buy - Execute real buy order (txHash zorunlu)
router.post('/buy',
  [
    body('userAddress').custom(validateSolanaAddress),
    body('agentAddress').custom(validateSolanaAddress),
    body('coreAmount').isFloat({ min: 0.001 }).withMessage('SOL amount must be at least 0.001'),
    body('txHash').isString().withMessage('txHash is required'),
    body('maxSlippage').optional().isFloat({ min: 0, max: 0.1 }).withMessage('Max slippage must be between 0 and 0.1'),
    body('gasLimit').optional().isInt({ min: 100000 }).withMessage('Gas limit must be at least 100000'),
    body('gasPrice').optional().isString().withMessage('Gas price must be a string')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userAddress, agentAddress, coreAmount, txHash, maxSlippage, gasLimit, gasPrice } = req.body;

      console.log(`🔥 Real buy order request: ${coreAmount} SOL for ${agentAddress} – tx: ${txHash}`);

      const options = {};
      if (gasLimit) options.gasLimit = gasLimit;
      if (gasPrice) options.gasPrice = gasPrice;
      if (maxSlippage !== undefined) options.maxSlippage = maxSlippage;
      options.txHash = txHash; // zincirden makbuzu okumak için

      const result = await realTradingEngine.executeBuyOrder(
        userAddress,
        agentAddress,
        parseFloat(coreAmount),
        options
      );

      // Update agent volume after successful buy
      if (result.success) {
        await TradingService.updateAgentVolume(agentAddress, coreAmount);
      }

      return res.json({
        success: true,
        data: result,
        message: 'Buy order processed'
      });

    } catch (error) {
      console.error('❌ Real buy order failed:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);


// POST /api/trading/sell - Execute real sell order
router.post('/sell',
  [
    body('userAddress').custom(validateSolanaAddress),
    body('agentAddress').custom(validateSolanaAddress),
    body('tokenAmount').isFloat({ min: 0.000001 }).withMessage('Token amount must be at least 0.000001'),
    body('maxSlippage').optional().isFloat({ min: 0, max: 0.1 }).withMessage('Max slippage must be between 0 and 0.1'),
    body('gasLimit').optional().isInt({ min: 100000 }).withMessage('Gas limit must be at least 100000'),
    body('gasPrice').optional().isString().withMessage('Gas price must be a string')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userAddress, agentAddress, tokenAmount, maxSlippage, gasLimit, gasPrice } = req.body;

      console.log(`🔥 Real sell order request: ${tokenAmount} tokens for ${agentAddress}`);

      const options = {};
      if (gasLimit) options.gasLimit = gasLimit;
      if (gasPrice) options.gasPrice = gasPrice;
      if (maxSlippage) options.maxSlippage = maxSlippage;

      const result = await realTradingEngine.executeSellOrder(
        userAddress,
        agentAddress,
        parseFloat(tokenAmount),
        options
      );

      // Update agent volume after successful sell
      if (result.success) {
        // For sell orders, we need to calculate the SOL amount from the result
        const coreAmount = result.coreReceived || result.data?.coreReceived || 0;
        await TradingService.updateAgentVolume(agentAddress, coreAmount);
      }

      res.json({
        success: true,
        data: result,
        message: 'Sell order executed successfully'
      });

    } catch (error) {
      console.error('❌ Real sell order failed:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// GET /api/trading/stats/:userAddress - Get comprehensive trading statistics
router.get('/stats/:userAddress',
  [
    param('userAddress').custom(validateSolanaAddress)
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userAddress } = req.params;

      console.log(`📊 Getting trading stats for: ${userAddress}`);

      const stats = await realTradingEngine.getTradingStats(userAddress);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Error getting trading stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trading statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// DUPLICATE ENDPOINT - COMMENTED OUT
// GET /api/trading/orderbook/:agentAddress - Get order book data
/*
router.get('/orderbook/:agentAddress',
  [
    param('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    query('depth').optional().isInt({ min: 5, max: 50 }).withMessage('Depth must be between 5 and 50')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { depth = 20 } = req.query;

      console.log(`📊 Getting order book for ${agentAddress}, depth: ${depth}`);

      // For now, generate simulated order book data
      // In a real implementation, this would come from actual order data
      const currentPrice = await realTradingEngine.getCurrentPrice(agentAddress);

      if (!currentPrice) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found or price unavailable'
        });
      }

      const price = parseFloat(currentPrice);
      const buyOrders = [];
      const sellOrders = [];

      // Generate buy orders (below current price)
      for (let i = 1; i <= depth; i++) {
        const orderPrice = price * (1 - (i * 0.001)); // 0.1% steps down
        const amount = Math.random() * 1000 + 100; // Random amount
        buyOrders.push({
          price: orderPrice,
          amount: amount,
          total: orderPrice * amount,
          count: Math.floor(Math.random() * 5) + 1
        });
      }

      // Generate sell orders (above current price)
      for (let i = 1; i <= depth; i++) {
        const orderPrice = price * (1 + (i * 0.001)); // 0.1% steps up
        const amount = Math.random() * 1000 + 100; // Random amount
        sellOrders.push({
          price: orderPrice,
          amount: amount,
          total: orderPrice * amount,
          count: Math.floor(Math.random() * 5) + 1
        });
      }

      // Get recent trades from database
      const Trade = require('../models/Trade');
      const recentTrades = await Trade.find({ agentAddress: agentAddress.toLowerCase() })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      const formattedTrades = recentTrades.map(trade => ({
        id: trade._id,
        type: trade.type,
        price: parseFloat(trade.price),
        amount: parseFloat(trade.amount),
        total: parseFloat(trade.total),
        timestamp: trade.timestamp,
        status: 'filled'
      }));

      res.json({
        success: true,
        data: {
          buyOrders: buyOrders.sort((a, b) => b.price - a.price), // Highest first
          sellOrders: sellOrders.sort((a, b) => a.price - b.price), // Lowest first
          recentTrades: formattedTrades,
          currentPrice: price,
          spread: sellOrders[0]?.price - buyOrders[0]?.price,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting order book:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order book data',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);
*/

// GET /api/trading/history/:agentAddress - Get trading history for chart data
router.get('/history/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress),
    query('interval').optional().isIn(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).withMessage('Invalid interval'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { interval = '1h', limit = 100 } = req.query;

      // Get trades from database
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit) * 10) // Get more trades to build candles
      .lean();

      if (trades.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No trading history found'
        });
      }

      // Convert trades to chart format
      const chartData = trades.map(trade => ({
        timestamp: trade.timestamp,
        price: parseFloat(trade.price || '0'),
        coreAmount: parseFloat(trade.coreAmount || '0'),
        tokenAmount: parseFloat(trade.tokenAmount || '0'),
        type: trade.type,
        transactionHash: trade.transactionHash,
        blockNumber: trade.blockNumber
      }));

      res.json({
        success: true,
        data: chartData,
        meta: {
          interval,
          limit: parseInt(limit),
          totalTrades: trades.length,
          agentAddress
        }
      });

    } catch (error) {
      console.error('Get trading history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trading history',
        details: error.message
      });
    }
  }
);

// GET /api/trading/candles/:agentAddress - Get candlestick data for charts
router.get('/candles/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress),
    query('interval').optional().isIn(['1m', '5m', '15m', '30m', '1h', '4h', '1d']).withMessage('Invalid interval'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { interval = '1h', limit = 100 } = req.query;

      console.log(`🕯️ Fetching candle data for ${agentAddress} with interval ${interval}, limit ${limit}`);

      // Get trades from database
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      })
      .sort({ timestamp: 1 }) // Sort ascending for candle calculation
      .lean();

      if (trades.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No trading data found for candles'
        });
      }

      // Convert interval to milliseconds
      const intervalMs = {
        '1m': 60 * 1000,
        '5m': 5 * 60 * 1000,
        '15m': 15 * 60 * 1000,
        '30m': 30 * 60 * 1000,
        '1h': 60 * 60 * 1000,
        '4h': 4 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000
      }[interval];

      // Group trades by time intervals
      const candleMap = new Map();

      trades.forEach(trade => {
        const tradeTime = new Date(trade.timestamp).getTime();
        const candleTime = Math.floor(tradeTime / intervalMs) * intervalMs;

        if (!candleMap.has(candleTime)) {
          candleMap.set(candleTime, {
            timestamp: candleTime,
            open: parseFloat(trade.price || '0'),
            high: parseFloat(trade.price || '0'),
            low: parseFloat(trade.price || '0'),
            close: parseFloat(trade.price || '0'),
            volume: 0,
            trades: []
          });
        }

        const candle = candleMap.get(candleTime);
        const price = parseFloat(trade.price || '0');
        const volume = parseFloat(trade.tokenAmount || '0');

        candle.high = Math.max(candle.high, price);
        candle.low = Math.min(candle.low, price);
        candle.close = price; // Last trade price becomes close
        candle.volume += volume;
        candle.trades.push({
          type: trade.type,
          price: price,
          volume: volume
        });        
      });

      // Convert to array and sort by timestamp
      let candles = Array.from(candleMap.values())
        .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
        .slice(0, parseInt(limit))
        .map(candle => ({
          timestamp: candle.timestamp,
          date: new Date(candle.timestamp).toISOString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          tradeCount: candle.trades.length,
          // son trade’in tipini kullan (buy → yeşil, sell → kırmızı)
          type: candle.trades[candle.trades.length - 1]?.type || 'buy'
        }));
        
      console.log(`🕯️ Generated ${candles.length} candles from ${trades.length} trades`);

      res.json({
        success: true,
        data: candles,
        metadata: {
          interval,
          limit: parseInt(limit),
          count: candles.length,
          agentAddress,
          totalTrades: trades.length
        }
      });

    } catch (error) {
      console.error('Get candle data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch candle data',
        details: error.message
      });
    }
  }
);

// GET /api/trading/orderbook/:agentAddress - Get order book data
router.get('/orderbook/:agentAddress',
  [
    param('agentAddress').custom(validateSolanaAddress)
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;

      // Get real trades for order book construction
      const recentTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

      console.log(`📊 Building real order book for ${agentAddress} from ${recentTrades.length} trades`);

      // Build real order book from actual trades
      const buyOrders = [];
      const sellOrders = [];

      if (recentTrades.length > 0) {
        // Group trades by price levels to create order book depth
        const priceMap = new Map();

        recentTrades.forEach(trade => {
          const price = parseFloat(trade.price);
          const amount = parseFloat(trade.coreAmount);
          const type = trade.type;

          // Round price to create price levels
          const priceLevel = Math.round(price * 1000000) / 1000000;

          if (!priceMap.has(priceLevel)) {
            priceMap.set(priceLevel, {
              buyAmount: 0,
              sellAmount: 0,
              buyCount: 0,
              sellCount: 0
            });
          }

          const level = priceMap.get(priceLevel);
          if (type === 'buy') {
            level.buyAmount += amount;
            level.buyCount += 1;
          } else {
            level.sellAmount += amount;
            level.sellCount += 1;
          }
        });

        // Convert to order book format
        const latestPrice = parseFloat(recentTrades[0].price);

        Array.from(priceMap.entries())
          .sort(([a], [b]) => b - a) // Sort by price descending
          .forEach(([price, data]) => {
            if (data.buyAmount > 0 && price <= latestPrice) {
              buyOrders.push({
                price,
                amount: data.buyAmount,
                total: price * data.buyAmount,
                count: data.buyCount
              });
            }

            if (data.sellAmount > 0 && price >= latestPrice) {
              sellOrders.push({
                price,
                amount: data.sellAmount,
                total: price * data.sellAmount,
                count: data.sellCount
              });
            }
          });

        // Sort orders properly
        buyOrders.sort((a, b) => b.price - a.price); // Highest buy prices first
        sellOrders.sort((a, b) => a.price - b.price); // Lowest sell prices first

        console.log(`✅ Built order book: ${buyOrders.length} buy levels, ${sellOrders.length} sell levels`);
      } else {
        console.log(`⚠️ No trades found for ${agentAddress} - empty order book`);
      }

      // Convert recent trades to order format
      const recentTradesFormatted = recentTrades.map(trade => ({
        id: trade._id.toString(),
        type: trade.type,
        price: parseFloat(trade.price || '0'),
        amount: parseFloat(trade.tokenAmount || '0'),
        total: parseFloat(trade.coreAmount || '0'),
        timestamp: new Date(trade.timestamp).getTime(),
        status: 'filled',
        userAddress: trade.trader
      }));

      res.json({
        success: true,
        data: {
          buyOrders: buyOrders.sort((a, b) => b.price - a.price), // Highest first
          sellOrders: sellOrders.sort((a, b) => a.price - b.price), // Lowest first
          recentTrades: recentTradesFormatted
        }
      });

    } catch (error) {
      console.error('Get order book error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order book data',
        details: error.message
      });
    }
  }
);

// POST /api/trading/record-trade - Record a trade for statistics
router.post('/record-trade',
  [
    body('agentAddress').custom(validateSolanaAddress),
    body('transactionHash').isString().withMessage('Transaction hash is required'),
    body('trader').custom(validateSolanaAddress),
    body('type').isIn(['buy', 'sell']).withMessage('Type must be buy or sell'),
    body('coreAmount').isString().withMessage('SOL amount is required'),
    body('tokenAmount').isString().withMessage('Token amount is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('timestamp').isISO8601().withMessage('Invalid timestamp')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        agentAddress,
        transactionHash,
        trader,
        type,
        coreAmount,
        tokenAmount,
        price,
        timestamp
      } = req.body;

      console.log(`📊 Recording ${type} trade for statistics:`, {
        agentAddress,
        transactionHash,
        trader,
        coreAmount,
        tokenAmount,
        price
      });

      // Check if trade already exists
      const existingTrade = await Trade.findOne({ transactionHash });
      if (existingTrade) {
        return res.json({
          success: true,
          message: 'Trade already recorded',
          data: existingTrade
        });
      }

      // Create trade record
      const trade = new Trade({
        agentAddress: agentAddress.toLowerCase(),
        transactionHash,
        blockNumber: 0,
        timestamp: new Date(timestamp),
        trader: trader.toLowerCase(),
        type,
        coreAmount,
        tokenAmount,
        price: price.toString(),     // 👈 string olarak kaydet
        priceUsd: price.toString(),  // 👈 string olarak kaydet
        gasUsed: 0,
        gasPrice: '0'
      });
      
      await trade.save();

      console.log(`✅ Trade recorded successfully: ${transactionHash}`);

      res.json({
        success: true,
        message: 'Trade recorded successfully',
        data: trade
      });

    } catch (error) {
      console.error('❌ Error recording trade:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record trade',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// POST /api/trading/ingest-tx - On-chain tx'i içeri al ve grafiği güncelle
router.post(
  '/ingest-tx',
  [
    body('agentAddress').custom(validateSolanaAddress),
    body('txHash')
      .isString()
      .isLength({ min: 64, max: 128 })
      .withMessage('Invalid Solana tx hash')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress, txHash } = req.body;

      // Zincirdeki tx'i çöz, Trade kaydını oluştur, cache/WS güncelle
      const result = await realTradingEngine.ingestOnchainTransaction(txHash, agentAddress);

      return res.json({
        success: true,
        data: result,
        message: 'Transaction ingested'
      });
    } catch (error) {
      console.error('❌ Ingest tx error:', error);
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);


module.exports = router;
