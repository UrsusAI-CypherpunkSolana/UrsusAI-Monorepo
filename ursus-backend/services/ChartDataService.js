const Trade = require('../models/Trade');
const PriceHistory = require('../models/PriceHistory');
const Agent = require('../models/Agent');
const TechnicalIndicators = require('./TechnicalIndicators');

class ChartDataService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
    this.technicalIndicators = new TechnicalIndicators();

    console.log('📊 Chart Data Service initialized with technical indicators');
  }

  // Generate professional chart data from real trades
  async generateChartData(agentAddress, timeframe = '1h', limit = 100) {
    try {
      console.log(`📊 Generating chart data for ${agentAddress} (${timeframe}, ${limit} candles)`);
      
      // Try to get cached data first
      const cacheKey = `chart:${agentAddress}:${timeframe}:${limit}`;
      const cachedData = await this.databaseService.getFromCache(cacheKey);
      
      if (cachedData) {
        console.log('📊 Returning cached chart data');
        return cachedData;
      }
      
      // Get agent info
      const agent = await Agent.findOne({ 
        contractAddress: agentAddress.toLowerCase() 
      });
      
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      // Get trades from database
      const trades = await Trade.find({
        agentAddress: agentAddress.toLowerCase()
      }).sort({ timestamp: 1 });
      
      console.log(`📊 Found ${trades.length} trades for ${agentAddress}`);
      
      let chartData;
      
      if (trades.length === 0) {
        // Generate empty chart data
        chartData = this.generateEmptyChartData(agent, timeframe, limit);
      } else {
        // Generate real chart data from trades
        chartData = await this.generateRealChartDataFromTrades(
          agent, 
          timeframe, 
          limit, 
          trades
        );
      }
      
      // Cache the result
      await this.databaseService.setCache(
        cacheKey, 
        chartData, 
        this.databaseService.cacheConfig.chartTTL
      );
      
      return chartData;
      
    } catch (error) {
      console.error('❌ Error generating chart data:', error);
      throw error;
    }
  }

  // Generate real OHLCV data from trades
  async generateRealChartDataFromTrades(agent, timeframe, limit, trades) {
    try {
      const intervalSeconds = this.getIntervalSeconds(timeframe);
      const now = Math.floor(Date.now() / 1000);
      const startTime = now - (limit * intervalSeconds);
      
      // Create time intervals
      const intervals = [];
      for (let i = 0; i < limit; i++) {
        const intervalStart = startTime + (i * intervalSeconds);
        intervals.push({
          start: intervalStart,
          end: intervalStart + intervalSeconds,
          timestamp: intervalStart
        });
      }
      
      const candlesticks = [];
      const volume = [];
      let totalVolume = 0;
      const uniqueTraders = new Set();
      
      // Process each interval
      for (const interval of intervals) {
        const intervalTrades = trades.filter(trade => {
          const tradeTime = Math.floor(trade.timestamp.getTime() / 1000);
          return tradeTime >= interval.start && tradeTime < interval.end;
        });
        
        if (intervalTrades.length === 0) {
          // No trades in this interval - use previous close or agent price
          const prevCandle = candlesticks[candlesticks.length - 1];
          const price = prevCandle ? prevCandle.close : parseFloat(agent.tokenomics.currentPrice);
          
          candlesticks.push({
            time: interval.timestamp,
            open: price,
            high: price,
            low: price,
            close: price,
            trades: 0
          });
          
          volume.push({
            time: interval.timestamp,
            value: 0
          });
        } else {
          // Calculate OHLCV from trades
          const prices = intervalTrades.map(t => t.price);
          const open = intervalTrades[0].price;
          const close = intervalTrades[intervalTrades.length - 1].price;
          const high = Math.max(...prices);
          const low = Math.min(...prices);
          
          const intervalVolume = intervalTrades.reduce((sum, trade) => {
            return sum + parseFloat(trade.coreAmount);
          }, 0);
          
          totalVolume += intervalVolume;
          
          // Track unique traders
          intervalTrades.forEach(trade => {
            uniqueTraders.add(trade.trader);
          });
          
          candlesticks.push({
            time: interval.timestamp,
            open,
            high,
            low,
            close,
            trades: intervalTrades.length
          });
          
          volume.push({
            time: interval.timestamp,
            value: intervalVolume
          });
        }
      }
      
      // Calculate technical indicators
      const ohlcvData = candlesticks.map((candle, index) => ({
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: volume[index]?.value || 0
      }));

      const indicators = this.technicalIndicators.calculateAllIndicators(ohlcvData);
      const latestIndicators = this.technicalIndicators.getLatestValues(indicators);

      return {
        candlesticks,
        volume,
        indicators: latestIndicators,
        stats: {
          totalTrades: trades.length,
          totalVolume: totalVolume,
          uniqueTraders: uniqueTraders.size,
          avgTradeSize: trades.length > 0 ? totalVolume / trades.length : 0,
          priceChange: candlesticks.length > 1 ?
            candlesticks[candlesticks.length - 1].close - candlesticks[0].open : 0,
          priceChangePercent: candlesticks.length > 1 && candlesticks[0].open > 0 ?
            ((candlesticks[candlesticks.length - 1].close - candlesticks[0].open) / candlesticks[0].open) * 100 : 0
        }
      };
      
    } catch (error) {
      console.error('❌ Error generating real chart data:', error);
      throw error;
    }
  }

  // Generate empty chart data for tokens with no trades
  generateEmptyChartData(agent, timeframe, limit) {
    const candlesticks = [];
    const volume = [];
    
    const currentPrice = parseFloat(agent.tokenomics.currentPrice) || 1.0;
    const intervalSeconds = this.getIntervalSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = limit; i >= 0; i--) {
      const time = now - (i * intervalSeconds);
      
      candlesticks.push({
        time,
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        trades: 0
      });
      
      volume.push({
        time,
        value: 0
      });
    }
    
    return {
      candlesticks,
      volume,
      indicators: null, // No indicators for empty data
      stats: {
        totalTrades: 0,
        totalVolume: 0,
        uniqueTraders: 0,
        avgTradeSize: 0,
        priceChange: 0,
        priceChangePercent: 0
      }
    };
  }

  // Get interval seconds for timeframe
  getIntervalSeconds(timeframe) {
    const intervals = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    };
    
    return intervals[timeframe] || 3600;
  }

  // Get latest price for an agent
  async getLatestPrice(agentAddress) {
    try {
      const cacheKey = `price:${agentAddress}:latest`;
      const cachedPrice = await this.databaseService.getFromCache(cacheKey);
      
      if (cachedPrice) {
        return cachedPrice;
      }
      
      // Get latest trade
      const latestTrade = await Trade.findOne({
        agentAddress: agentAddress.toLowerCase()
      }).sort({ timestamp: -1 });
      
      let priceData;
      
      if (latestTrade) {
        priceData = {
          time: Math.floor(latestTrade.timestamp.getTime() / 1000),
          price: latestTrade.price,
          volume24h: 0, // Will be calculated separately
          priceChange24h: 0, // Will be calculated separately
          source: 'trade'
        };
      } else {
        // Fallback to agent price
        const agent = await Agent.findOne({
          contractAddress: agentAddress.toLowerCase()
        });
        
        priceData = {
          time: Math.floor(Date.now() / 1000),
          price: parseFloat(agent?.tokenomics?.currentPrice || '1.0'),
          volume24h: 0,
          priceChange24h: 0,
          source: 'agent'
        };
      }
      
      // Calculate 24h metrics
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTrades = await Trade.find({
        agentAddress: agentAddress.toLowerCase(),
        timestamp: { $gte: twentyFourHoursAgo }
      });
      
      priceData.volume24h = recentTrades.reduce((sum, trade) => {
        return sum + parseFloat(trade.coreAmount);
      }, 0);
      
      if (recentTrades.length > 0) {
        const oldestTrade = recentTrades.sort((a, b) => a.timestamp - b.timestamp)[0];
        priceData.priceChange24h = priceData.price - oldestTrade.price;
      }
      
      // Cache for 30 seconds
      await this.databaseService.setCache(
        cacheKey, 
        priceData, 
        this.databaseService.cacheConfig.priceTTL
      );
      
      return priceData;
      
    } catch (error) {
      console.error('❌ Error getting latest price:', error);
      throw error;
    }
  }

  // Update price history with aggregated data
  async updatePriceHistory(agentAddress, timeframe, timestamp, ohlcvData) {
    try {
      const intervalStart = this.getIntervalStart(new Date(timestamp * 1000), timeframe);
      
      // Find existing candle or create new one
      let priceHistory = await PriceHistory.findOne({
        agentAddress: agentAddress.toLowerCase(),
        timeframe,
        timestamp: intervalStart
      });
      
      if (!priceHistory) {
        priceHistory = new PriceHistory({
          agentAddress: agentAddress.toLowerCase(),
          timeframe,
          timestamp: intervalStart,
          open: ohlcvData.open.toString(),
          high: ohlcvData.high.toString(),
          low: ohlcvData.low.toString(),
          close: ohlcvData.close.toString(),
          volume: ohlcvData.volume.toString(),
          trades: ohlcvData.trades || 0
        });
      } else {
        // Update existing candle
        priceHistory.high = Math.max(parseFloat(priceHistory.high), ohlcvData.high).toString();
        priceHistory.low = Math.min(parseFloat(priceHistory.low), ohlcvData.low).toString();
        priceHistory.close = ohlcvData.close.toString();
        priceHistory.volume = (parseFloat(priceHistory.volume) + ohlcvData.volume).toString();
        priceHistory.trades += (ohlcvData.trades || 0);
      }
      
      await priceHistory.save();
      
      // Clear cache for this agent
      await this.databaseService.clearCachePattern(`chart:${agentAddress}:*`);
      
    } catch (error) {
      console.error('❌ Error updating price history:', error);
    }
  }

  // Get interval start time for timeframe
  getIntervalStart(timestamp, timeframe) {
    const date = new Date(timestamp);
    
    switch (timeframe) {
      case '1m':
        date.setSeconds(0, 0);
        break;
      case '5m':
        date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
        break;
      case '15m':
        date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
        break;
      case '1h':
        date.setMinutes(0, 0, 0);
        break;
      case '4h':
        date.setHours(Math.floor(date.getHours() / 4) * 4, 0, 0, 0);
        break;
      case '1d':
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }
}

module.exports = ChartDataService;
