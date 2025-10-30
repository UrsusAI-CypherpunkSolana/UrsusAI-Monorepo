const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Agent = require('../models/Agent');
const BlockchainDataService = require('../services/BlockchainDataService');
const ChartDataService = require('../services/ChartDataService');
const router = express.Router();

// Initialize services
const blockchainDataService = new BlockchainDataService();
const chartDataService = new ChartDataService(global.databaseService);

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

// GET /api/chart/:agentAddress - Get professional chart data for an agent
router.get('/:agentAddress',
  [
    param('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    query('timeframe').optional().isIn(['1m', '5m', '15m', '1h', '4h', '1d']).withMessage('Invalid timeframe'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { timeframe = '1h', limit = 100 } = req.query;

      console.log(`📊 Professional chart data request: ${agentAddress} (${timeframe}, ${limit})`);

      // Find agent
      const agent = await Agent.findOne({
        contractAddress: agentAddress.toLowerCase()
      });

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found'
        });
      }

      // Try to update with real blockchain data first
      console.log('🔗 Attempting blockchain data update...');
      const blockchainUpdate = await blockchainDataService.updateAgentWithRealData(agentAddress);

      if (blockchainUpdate.success) {
        console.log('✅ Blockchain data updated successfully');
      } else {
        console.log('🔄 Blockchain update failed, continuing with existing data...');
        console.log(`🔍 Blockchain error: ${blockchainUpdate.error}`);
      }

      // Refresh agent data after blockchain update
      const updatedAgent = await Agent.findOne({
        contractAddress: agentAddress.toLowerCase()
      });

      // Generate professional chart data using the new service
      const chartData = await chartDataService.generateChartData(
        agentAddress,
        timeframe,
        parseInt(limit)
      );

      res.json({
        success: true,
        data: chartData,
        agent: {
          address: (updatedAgent || agent).contractAddress,
          name: (updatedAgent || agent).name,
          symbol: (updatedAgent || agent).symbol,
          currentPrice: (updatedAgent || agent).tokenomics?.currentPrice || "1.00",
          marketCap: (updatedAgent || agent).tokenomics?.marketCap || 1000000,
          totalSupply: (updatedAgent || agent).tokenomics?.totalSupply || "1000000",
          reserve: (updatedAgent || agent).tokenomics?.reserve || 0,
          holders: (updatedAgent || agent).metrics?.holders || 1,
          volume24h: (updatedAgent || agent).metrics?.volume24h || 0,
          priceChange24h: (updatedAgent || agent).metrics?.priceChange24h || 0,
          allTimeHigh: (updatedAgent || agent).metrics?.allTimeHigh || (updatedAgent || agent).tokenomics?.currentPrice || "1.00",
          allTimeLow: (updatedAgent || agent).metrics?.allTimeLow || (updatedAgent || agent).tokenomics?.currentPrice || "1.00",
          totalTransactions: (updatedAgent || agent).metrics?.totalTransactions || 0,
          volumeTotal: (updatedAgent || agent).metrics?.volumeTotal || 0,
          lastPriceUpdate: (updatedAgent || agent).lastPriceUpdate
        },
        metadata: {
          agentAddress,
          timeframe,
          limit: parseInt(limit),
          dataSource: 'professional_chart_service',
          lastUpdate: new Date().toISOString(),
          hasRealTrades: chartData.stats.totalTrades > 0,
          blockchainUpdateStatus: blockchainUpdate.success ? 'success' : 'failed'
        }
      });

    } catch (error) {
      console.error('❌ Error fetching professional chart data:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// GET /api/chart/agents/:agentAddress/indicators - Get technical indicators
router.get('/agents/:agentAddress/indicators',
  [
    param('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    query('interval').optional().isIn(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']).withMessage('Invalid interval'),
    query('period').optional().isInt({ min: 5, max: 200 }).withMessage('Period must be between 5 and 200')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { interval = '1h', period = 20 } = req.query;

      console.log(`📊 Getting indicators for ${agentAddress}, interval: ${interval}, period: ${period}`);

      // Get price data first
      const priceData = await chartDataService.getAgentCandles(agentAddress, interval, 200);

      if (!priceData || priceData.length === 0) {
        return res.json({
          success: true,
          data: {
            sma: [],
            ema: [],
            rsi: [],
            macd: [],
            bollinger: []
          }
        });
      }

      // Extract close prices
      const closePrices = priceData.map(candle => parseFloat(candle.close));

      // Calculate technical indicators
      const TechnicalIndicators = require('../services/TechnicalIndicators');
      const indicators = new TechnicalIndicators();

      const sma = indicators.calculateSMA(closePrices, parseInt(period));
      const ema = indicators.calculateEMA(closePrices, parseInt(period));
      const rsi = indicators.calculateRSI(closePrices, 14);
      const macd = indicators.calculateMACD(closePrices);
      const bollinger = indicators.calculateBollingerBands(closePrices, parseInt(period));

      res.json({
        success: true,
        data: {
          sma: sma || [],
          ema: ema || [],
          rsi: rsi || [],
          macd: macd || { macd: [], signal: [], histogram: [] },
          bollinger: bollinger || { upper: [], middle: [], lower: [] },
          period: parseInt(period),
          interval,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting indicators:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get technical indicators',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

module.exports = router;