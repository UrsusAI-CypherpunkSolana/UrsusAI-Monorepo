const Agent = require('../models/Agent');
const Trade = require('../models/Trade');

class RealDataCalculator {
  // Calculate real statistics from trade data
  static async calculateRealStats(agentAddress) {
    try {
      console.log(`📊 Calculating real stats from trade data for: ${agentAddress}`);
      
      // Get all trades for this agent
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      }).sort({ timestamp: 1 });
      
      if (trades.length === 0) {
        console.log('📊 No trades found, using default values');
        return {
          currentPrice: "1.000000",
          volume24h: 0,
          priceChange24h: "0.000000",
          allTimeHigh: "1.000000",
          allTimeLow: "1.000000",
          totalTrades: 0,
          uniqueTraders: 0,
          avgTradeSize: 0,
          marketCap: 1000000,
          holders: 1
        };
      }
      
      // Calculate time-based stats
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Filter trades for 24h period
      const trades24h = trades.filter(trade => trade.timestamp >= yesterday);
      
      // Current price (last trade price)
      const currentPrice = trades[trades.length - 1].price;
      
      // 24h volume (sum of SOL amounts in last 24h)
      const volume24h = trades24h.reduce((sum, trade) => {
        return sum + parseFloat(trade.coreAmount);
      }, 0);
      
      // Price change 24h
      let priceChange24h = 0;
      if (trades24h.length > 0) {
        const price24hAgo = trades24h[0].price;
        priceChange24h = currentPrice - price24hAgo;
      }
      
      // All time high and low
      const allPrices = trades.map(trade => trade.price);
      const allTimeHigh = Math.max(...allPrices);
      const allTimeLow = Math.min(...allPrices);
      
      // Unique traders
      const uniqueTraders = new Set(trades.map(trade => trade.trader.toLowerCase())).size;
      
      // Average trade size
      const totalVolume = trades.reduce((sum, trade) => sum + parseFloat(trade.coreAmount), 0);
      const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;
      
      // Market cap (current price * total supply)
      const totalSupply = 1000000; // Default 1M tokens
      const marketCap = currentPrice * totalSupply;
      
      // Holders (unique traders + creator)
      const holders = uniqueTraders + 1;
      
      const stats = {
        currentPrice: currentPrice.toFixed(6),
        volume24h: volume24h,
        priceChange24h: priceChange24h.toFixed(6),
        allTimeHigh: allTimeHigh.toFixed(6),
        allTimeLow: allTimeLow.toFixed(6),
        totalTrades: trades.length,
        uniqueTraders: uniqueTraders,
        avgTradeSize: avgTradeSize,
        marketCap: Math.floor(marketCap),
        holders: holders
      };
      
      console.log('✅ Real stats calculated:', {
        price: stats.currentPrice,
        volume24h: stats.volume24h.toFixed(2),
        trades: stats.totalTrades,
        traders: stats.uniqueTraders
      });
      
      return stats;
      
    } catch (error) {
      console.error('❌ Error calculating real stats:', error);
      return {
        currentPrice: "1.000000",
        volume24h: 0,
        priceChange24h: "0.000000",
        allTimeHigh: "1.000000",
        allTimeLow: "1.000000",
        totalTrades: 0,
        uniqueTraders: 0,
        avgTradeSize: 0,
        marketCap: 1000000,
        holders: 1
      };
    }
  }
  
  // Update agent with real calculated stats
  static async updateAgentWithRealStats(agentAddress) {
    try {
      console.log(`🔄 Updating agent with real calculated stats: ${agentAddress}`);
      
      const stats = await this.calculateRealStats(agentAddress);
      
      // Update agent in database
      const updatedAgent = await Agent.findOneAndUpdate(
        { contractAddress: agentAddress.toLowerCase() },
        {
          $set: {
            'tokenomics.currentPrice': stats.currentPrice,
            'tokenomics.marketCap': stats.marketCap.toString(),
            'metrics.volume24h': stats.volume24h,
            'metrics.priceChange24h': stats.priceChange24h,
            'metrics.allTimeHigh': stats.allTimeHigh,
            'metrics.allTimeLow': stats.allTimeLow,
            'metrics.holders': stats.holders,
            'metrics.totalTransactions': stats.totalTrades,
            'metrics.volumeTotal': stats.volume24h, // For now, same as 24h
            lastPriceUpdate: new Date()
          }
        },
        { new: true }
      );
      
      if (updatedAgent) {
        console.log(`✅ Agent updated with real stats: ${agentAddress}`);
        return {
          success: true,
          data: {
            ...stats,
            lastUpdate: new Date()
          }
        };
      } else {
        throw new Error('Agent not found in database');
      }
      
    } catch (error) {
      console.error('❌ Error updating agent with real stats:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Calculate 24h price change percentage
  static calculatePriceChangePercent(currentPrice, priceChange24h) {
    const previousPrice = currentPrice - priceChange24h;
    if (previousPrice === 0) return 0;
    return (priceChange24h / previousPrice) * 100;
  }
  
  // Calculate market cap from price and supply
  static calculateMarketCap(price, totalSupply) {
    return parseFloat(price) * parseFloat(totalSupply);
  }
  
  // Get trading activity summary
  static async getTradingActivitySummary(agentAddress) {
    try {
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      }).sort({ timestamp: -1 }).limit(100);
      
      if (trades.length === 0) {
        return {
          recentTrades: [],
          tradingActive: false,
          lastTradeTime: null
        };
      }
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const recentTrades = trades.filter(trade => trade.timestamp >= oneHourAgo);
      
      return {
        recentTrades: trades.slice(0, 10), // Last 10 trades
        tradingActive: recentTrades.length > 0,
        lastTradeTime: trades[0].timestamp,
        tradesLastHour: recentTrades.length
      };
      
    } catch (error) {
      console.error('❌ Error getting trading activity:', error);
      return {
        recentTrades: [],
        tradingActive: false,
        lastTradeTime: null
      };
    }
  }
  
  // Calculate price trend (bullish/bearish)
  static calculatePriceTrend(trades) {
    if (trades.length < 2) return 'neutral';
    
    const recent = trades.slice(-10); // Last 10 trades
    const older = trades.slice(-20, -10); // Previous 10 trades
    
    if (recent.length === 0 || older.length === 0) return 'neutral';
    
    const recentAvg = recent.reduce((sum, t) => sum + t.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.price, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.02) return 'bullish'; // 2% increase
    if (recentAvg < olderAvg * 0.98) return 'bearish'; // 2% decrease
    return 'neutral';
  }
}

module.exports = RealDataCalculator;
