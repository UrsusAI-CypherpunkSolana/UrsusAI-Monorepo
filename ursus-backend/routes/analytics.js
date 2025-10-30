const express = require('express');
const { ethers } = require('ethers');
const BlockchainService = require('../services/BlockchainService');
const HistoricalDataService = require('../services/HistoricalDataService');
const EventListenerService = require('../services/EventListenerService');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const router = express.Router();

// GET /api/analytics/overview - Platform overview analytics
router.get('/overview', async (req, res) => {
  try {
    console.log('📊 Fetching platform analytics overview...');

    // Get real data from database
    const totalAgents = await Agent.countDocuments();
    const totalUsers = await User.countDocuments();

    // Calculate 24h metrics
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const agentsCreated24h = await Agent.countDocuments({
      createdAt: { $gte: last24h }
    });

    const trades24h = await Trade.find({
      timestamp: { $gte: last24h }
    });

    const volume24h = trades24h.reduce((sum, trade) => {
      return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
    }, 0);

    const uniqueTraders24h = new Set(trades24h.map(trade => trade.userAddress)).size;

    // Calculate total market cap and TVL
    const agents = await Agent.find({}, 'tokenomics.marketCap tokenomics.reserve');
    const totalMarketCap = agents.reduce((sum, agent) => {
      return sum + parseFloat(agent.tokenomics?.marketCap || 0);
    }, 0);

    const totalValueLocked = agents.reduce((sum, agent) => {
      return sum + parseFloat(agent.tokenomics?.reserve || 0);
    }, 0);

    // Calculate growth trends (compare with previous 24h)
    const previous24h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const tradesPrevious24h = await Trade.find({
      timestamp: { $gte: previous24h, $lt: last24h }
    });

    const volumePrevious24h = tradesPrevious24h.reduce((sum, trade) => {
      return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
    }, 0);

    const volumeChange24h = volumePrevious24h > 0
      ? ((volume24h - volumePrevious24h) / volumePrevious24h) * 100
      : 0;

    const analytics = {
      platform: {
        totalAgents,
        totalUsers,
        totalVolume: volume24h.toFixed(6),
        totalValueLocked: totalValueLocked.toFixed(6),
        totalMarketCap: totalMarketCap.toFixed(6),
        creationFee: '2.5' // From contract
      },
      growth: {
        agentsCreated24h,
        volume24h: volume24h.toFixed(6),
        volumeChange24h: volumeChange24h.toFixed(2),
        transactions24h: trades24h.length,
        uniqueTraders24h
      },
      trends: {
        volume: volumeChange24h > 0 ? 'up' : volumeChange24h < 0 ? 'down' : 'stable',
        transactions: trades24h.length > tradesPrevious24h.length ? 'up' : 'down',
        users: uniqueTraders24h > 0 ? 'up' : 'stable',
        agentCreation: agentsCreated24h > 0 ? 'up' : 'stable'
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Platform analytics calculated:', {
      totalAgents,
      volume24h: volume24h.toFixed(6),
      trades24h: trades24h.length
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/agents/top - Top performing agents
router.get('/agents/top', async (req, res) => {
  try {
    const { metric = 'marketCap', limit = 10 } = req.query;

    const validMetrics = ['marketCap', 'volume', 'holders', 'transactions', 'priceChange'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        error: 'Invalid metric',
        validMetrics
      });
    }

    console.log(`📊 Fetching top agents by ${metric}...`);

    // Get all agents from database
    const agents = await Agent.find({}).lean();

    // Calculate 24h metrics for each agent
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const agentsWithMetrics = await Promise.all(agents.map(async (agent) => {
      // Get 24h trades for this agent
      const trades24h = await Trade.find({
        agentAddress: agent.contractAddress.toLowerCase(),
        timestamp: { $gte: last24h }
      });

      const volume24h = trades24h.reduce((sum, trade) => {
        return sum + (parseFloat(trade.amount) * parseFloat(trade.price));
      }, 0);

      // Get holder count
      const holders = await Portfolio.countDocuments({
        agentAddress: agent.contractAddress.toLowerCase(),
        balance: { $gt: '0' },
        isActive: true
      });

      return {
        ...agent,
        volume24h,
        transactions24h: trades24h.length,
        holders,
        marketCapValue: parseFloat(agent.tokenomics?.marketCap || 0),
        priceChangeValue: parseFloat(agent.metrics?.priceChange24h || 0)
      };
    }));

    // Sort agents by the specified metric
    let sortedAgents = agentsWithMetrics.sort((a, b) => {
      switch (metric) {
        case 'marketCap':
          return b.marketCapValue - a.marketCapValue;
        case 'volume':
          return b.volume24h - a.volume24h;
        case 'holders':
          return b.holders - a.holders;
        case 'transactions':
          return b.transactions24h - a.transactions24h;
        case 'priceChange':
          return b.priceChangeValue - a.priceChangeValue;
        default:
          return 0;
      }
    });

    // Take top N agents
    sortedAgents = sortedAgents.slice(0, parseInt(limit));

    const topAgents = sortedAgents.map((agent, index) => ({
      rank: index + 1,
      address: agent.contractAddress,
      name: agent.name,
      symbol: agent.symbol,
      category: agent.category || 'General',
      marketCap: agent.tokenomics?.marketCap || '0',
      currentPrice: agent.tokenomics?.currentPrice || '1.00',
      priceChange24h: agent.metrics?.priceChange24h || '0',
      volume24h: agent.volume24h.toFixed(6),
      holders: agent.holders,
      transactions24h: agent.transactions24h,
      createdAt: agent.createdAt
    }));

    console.log(`✅ Found ${topAgents.length} top agents by ${metric}`);

    res.json({
      metric,
      agents: topAgents,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching top agents:', error);
    res.status(500).json({ error: 'Failed to fetch top agents' });
  }
});

// GET /api/analytics/agents/:address - Detailed agent analytics
router.get('/agents/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { timeframe = '24h' } = req.query;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid agent address' });
    }

    const agent = await BlockchainService.getAgentDetails(address);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const stats = await BlockchainService.getAgentStats(address);
    const priceHistory = await HistoricalDataService.getAgentPriceHistory(address, timeframe);
    const volumeHistory = await HistoricalDataService.getAgentVolumeHistory(address, timeframe);
    const tradingActivity = await HistoricalDataService.getAgentTradingActivity(address, 50);
    const interactionHistory = await HistoricalDataService.getAgentInteractionHistory(address, 100);

    // Calculate performance metrics from real data
    const prices = priceHistory.map(p => parseFloat(p.price));
    const allTimeHigh = prices.length > 0 ? Math.max(...prices) : parseFloat(agent.currentPrice);
    const allTimeLow = prices.length > 0 ? Math.min(...prices) : parseFloat(agent.currentPrice);

    // Calculate volatility (standard deviation of price changes)
    let volatility = 0;
    if (prices.length > 1) {
      const returns = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
      }
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
      volatility = Math.sqrt(variance) * 100; // Convert to percentage
    }

    const analytics = {
      agent: {
        address,
        name: agent.tokenName,
        symbol: agent.tokenSymbol,
        category: agent.metadata.category,
        createdAt: agent.metadata.createdAt
      },
      metrics: {
        currentPrice: agent.currentPrice,
        marketCap: agent.bondingCurveInfo.marketCap,
        totalSupply: agent.totalSupply,
        reserve: agent.bondingCurveInfo.reserve,
        holders: stats.holders,
        transactions24h: stats.transactions24h,
        volume24h: stats.volume24h,
        priceChange24h: stats.priceChange24h
      },
      performance: {
        allTimeHigh: allTimeHigh.toFixed(6),
        allTimeLow: allTimeLow.toFixed(6),
        volatility: volatility.toFixed(2),
        totalPurchases: stats.totalPurchases,
        totalSales: stats.totalSales
      },
      activity: {
        interactions24h: stats.totalInteractions,
        uniqueUsers24h: tradingActivity.length > 0 ? new Set(tradingActivity.map(t => t.user)).size : 0,
        recentTrades: tradingActivity.slice(0, 10),
        recentInteractions: interactionHistory.slice(0, 10)
      },
      charts: {
        priceHistory,
        volumeHistory
      },
      timeframe,
      timestamp: new Date().toISOString()
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    res.status(500).json({ error: 'Failed to fetch agent analytics' });
  }
});

// GET /api/analytics/categories - Category performance analytics
router.get('/categories', async (req, res) => {
  try {
    const allAgents = await BlockchainService.getAllAgents(0, 1000);
    
    // Group agents by category
    const categoryStats = {};
    
    allAgents.agents.forEach(agent => {
      const category = agent.metadata.category || 'General';
      
      if (!categoryStats[category]) {
        categoryStats[category] = {
          count: 0,
          totalMarketCap: 0,
          totalVolume: 0,
          avgPrice: 0,
          agents: []
        };
      }
      
      categoryStats[category].count++;
      categoryStats[category].totalMarketCap += parseFloat(agent.bondingCurveInfo.marketCap);
      categoryStats[category].agents.push({
        address: agent.address,
        name: agent.tokenName,
        marketCap: agent.bondingCurveInfo.marketCap
      });
    });

    // Calculate averages and sort
    const categories = Object.entries(categoryStats).map(([name, stats]) => ({
      name,
      count: stats.count,
      totalMarketCap: stats.totalMarketCap.toFixed(6),
      avgMarketCap: (stats.totalMarketCap / stats.count).toFixed(6),
      marketShare: ((stats.totalMarketCap / Object.values(categoryStats).reduce((sum, cat) => sum + cat.totalMarketCap, 0)) * 100).toFixed(2),
      topAgents: stats.agents
        .sort((a, b) => parseFloat(b.marketCap) - parseFloat(a.marketCap))
        .slice(0, 3)
    })).sort((a, b) => parseFloat(b.totalMarketCap) - parseFloat(a.totalMarketCap));

    res.json({
      categories,
      summary: {
        totalCategories: categories.length,
        totalAgents: allAgents.total,
        totalMarketCap: categories.reduce((sum, cat) => sum + parseFloat(cat.totalMarketCap), 0).toFixed(6)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching category analytics:', error);
    res.status(500).json({ error: 'Failed to fetch category analytics' });
  }
});

// GET /api/analytics/market - Market analytics
router.get('/market', async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const stats = await BlockchainService.getPlatformStats();
    
    // In production, these would be calculated from historical data
    const marketAnalytics = {
      overview: {
        totalMarketCap: stats.totalValueLocked,
        totalVolume24h: stats.totalVolume,
        avgPrice: '0',
        priceChange24h: 0,
        volumeChange24h: 0
      },
      trends: {
        newAgents24h: stats.newAgents24h,
        activeAgents24h: stats.activeAgents24h,
        totalTransactions24h: 0,
        uniqueTraders24h: 0
      },
      distribution: {
        byMarketCap: {
          'micro': 0,    // < 1 SOL
          'small': 0,    // 1-10 SOL
          'medium': 0,   // 10-100 SOL
          'large': 0     // > 100 SOL
        },
        byAge: {
          'new': 0,      // < 24h
          'recent': 0,   // 1-7 days
          'established': 0, // 7-30 days
          'mature': 0    // > 30 days
        }
      },
      timeframe,
      timestamp: new Date().toISOString()
    };

    res.json(marketAnalytics);
  } catch (error) {
    console.error('Error fetching market analytics:', error);
    res.status(500).json({ error: 'Failed to fetch market analytics' });
  }
});

module.exports = router;
