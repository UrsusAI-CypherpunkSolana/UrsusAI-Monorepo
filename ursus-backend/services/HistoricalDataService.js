const { ethers } = require('ethers');
const EventListenerService = require('./EventListenerService');

class HistoricalDataService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.CORE_RPC_URL || 'https://rpc.test2.btcs.network');
    this.eventListener = EventListenerService;
  }

  // Get price history for an agent
  async getAgentPriceHistory(agentAddress, timeframe = '24h', interval = '1h') {
    try {
      const priceHistory = this.eventListener.getPriceHistory(agentAddress, timeframe);
      
      if (priceHistory.length === 0) {
        return [];
      }

      // Group by interval
      const intervalMs = this.getIntervalMs(interval);
      const groupedData = this.groupByInterval(priceHistory, intervalMs);
      
      return groupedData.map(group => ({
        timestamp: group.timestamp,
        price: group.avgPrice,
        high: group.high,
        low: group.low,
        open: group.open,
        close: group.close,
        volume: group.volume || 0
      }));
    } catch (error) {
      console.error('Error getting price history:', error);
      return [];
    }
  }

  // Get volume history for an agent
  async getAgentVolumeHistory(agentAddress, timeframe = '24h') {
    try {
      const volumeData = this.eventListener.getVolumeData(agentAddress);
      const now = Date.now();
      
      let cutoff;
      switch (timeframe) {
        case '1h':
          cutoff = now - 60 * 60 * 1000;
          break;
        case '24h':
          cutoff = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          cutoff = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoff = now - 24 * 60 * 60 * 1000;
      }
      
      return volumeData.volumeHistory
        .filter(v => v.timestamp > cutoff)
        .map(v => ({
          timestamp: v.timestamp,
          volume: v.amount
        }));
    } catch (error) {
      console.error('Error getting volume history:', error);
      return [];
    }
  }

  // Get trading activity for an agent
  async getAgentTradingActivity(agentAddress, limit = 50) {
    try {
      const events = this.eventListener.getAgentEvents(agentAddress, limit);
      
      return events
        .filter(e => e.type === 'TokensPurchased' || e.type === 'TokensSold')
        .map(event => ({
          type: event.type === 'TokensPurchased' ? 'buy' : 'sell',
          user: event.buyer || event.seller,
          amount: event.type === 'TokensPurchased' ? event.tokensReceived : event.tokensAmount,
          price: event.type === 'TokensPurchased' ? event.coreAmount : event.coreReceived,
          timestamp: event.timestamp,
          transactionHash: event.transactionHash
        }));
    } catch (error) {
      console.error('Error getting trading activity:', error);
      return [];
    }
  }

  // Get agent interaction history
  async getAgentInteractionHistory(agentAddress, limit = 100) {
    try {
      const events = this.eventListener.getAgentEvents(agentAddress, limit);
      
      return events
        .filter(e => e.type === 'AgentInteraction')
        .map(event => ({
          user: event.user,
          message: event.message,
          timestamp: event.timestamp,
          transactionHash: event.transactionHash
        }));
    } catch (error) {
      console.error('Error getting interaction history:', error);
      return [];
    }
  }

  // Get platform-wide statistics over time
  async getPlatformHistoricalStats(timeframe = '24h') {
    try {
      const allEvents = this.eventListener.getAllEvents(1000);
      const now = Date.now();
      
      let cutoff;
      switch (timeframe) {
        case '1h':
          cutoff = now - 60 * 60 * 1000;
          break;
        case '24h':
          cutoff = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          cutoff = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoff = now - 24 * 60 * 60 * 1000;
      }
      
      const recentEvents = allEvents.filter(e => e.timestamp > cutoff);
      
      // Group events by hour
      const hourlyStats = {};
      
      recentEvents.forEach(event => {
        const hour = Math.floor(event.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
        
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = {
            timestamp: hour,
            agentsCreated: 0,
            totalTransactions: 0,
            totalVolume: 0,
            uniqueUsers: new Set()
          };
        }
        
        const stats = hourlyStats[hour];
        
        if (event.type === 'AgentCreated') {
          stats.agentsCreated++;
        } else if (event.type === 'TokensPurchased' || event.type === 'TokensSold') {
          stats.totalTransactions++;
          stats.totalVolume += parseFloat(event.coreAmount || event.coreReceived || 0);
          stats.uniqueUsers.add(event.buyer || event.seller);
        } else if (event.type === 'AgentInteraction') {
          stats.uniqueUsers.add(event.user);
        }
      });
      
      // Convert to array and calculate final stats
      return Object.values(hourlyStats)
        .map(stats => ({
          timestamp: stats.timestamp,
          agentsCreated: stats.agentsCreated,
          totalTransactions: stats.totalTransactions,
          totalVolume: stats.totalVolume,
          uniqueUsers: stats.uniqueUsers.size
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error getting platform historical stats:', error);
      return [];
    }
  }

  // Get top performers over time
  async getTopPerformers(metric = 'volume', timeframe = '24h', limit = 10) {
    try {
      const allEvents = this.eventListener.getAllEvents(1000);
      const now = Date.now();
      
      let cutoff;
      switch (timeframe) {
        case '1h':
          cutoff = now - 60 * 60 * 1000;
          break;
        case '24h':
          cutoff = now - 24 * 60 * 60 * 1000;
          break;
        case '7d':
          cutoff = now - 7 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoff = now - 24 * 60 * 60 * 1000;
      }
      
      const recentEvents = allEvents.filter(e => e.timestamp > cutoff);
      
      // Group by agent
      const agentStats = {};
      
      recentEvents.forEach(event => {
        if (!event.agentAddress) return;
        
        if (!agentStats[event.agentAddress]) {
          agentStats[event.agentAddress] = {
            agentAddress: event.agentAddress,
            volume: 0,
            transactions: 0,
            interactions: 0,
            uniqueUsers: new Set()
          };
        }
        
        const stats = agentStats[event.agentAddress];
        
        if (event.type === 'TokensPurchased' || event.type === 'TokensSold') {
          stats.volume += parseFloat(event.coreAmount || event.coreReceived || 0);
          stats.transactions++;
          stats.uniqueUsers.add(event.buyer || event.seller);
        } else if (event.type === 'AgentInteraction') {
          stats.interactions++;
          stats.uniqueUsers.add(event.user);
        }
      });
      
      // Convert to array and sort by metric
      const performers = Object.values(agentStats)
        .map(stats => ({
          ...stats,
          uniqueUsers: stats.uniqueUsers.size
        }))
        .sort((a, b) => {
          switch (metric) {
            case 'volume':
              return b.volume - a.volume;
            case 'transactions':
              return b.transactions - a.transactions;
            case 'interactions':
              return b.interactions - a.interactions;
            case 'users':
              return b.uniqueUsers - a.uniqueUsers;
            default:
              return b.volume - a.volume;
          }
        })
        .slice(0, limit);
      
      return performers;
    } catch (error) {
      console.error('Error getting top performers:', error);
      return [];
    }
  }

  // Get market trends
  async getMarketTrends(timeframe = '24h') {
    try {
      const platformStats = await this.getPlatformHistoricalStats(timeframe);
      
      if (platformStats.length < 2) {
        return {
          volumeTrend: 0,
          transactionTrend: 0,
          userTrend: 0,
          agentCreationTrend: 0
        };
      }
      
      const latest = platformStats[platformStats.length - 1];
      const previous = platformStats[0];
      
      const calculateTrend = (current, prev) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return ((current - prev) / prev) * 100;
      };
      
      return {
        volumeTrend: calculateTrend(latest.totalVolume, previous.totalVolume),
        transactionTrend: calculateTrend(latest.totalTransactions, previous.totalTransactions),
        userTrend: calculateTrend(latest.uniqueUsers, previous.uniqueUsers),
        agentCreationTrend: calculateTrend(latest.agentsCreated, previous.agentsCreated)
      };
    } catch (error) {
      console.error('Error getting market trends:', error);
      return {
        volumeTrend: 0,
        transactionTrend: 0,
        userTrend: 0,
        agentCreationTrend: 0
      };
    }
  }

  // Helper methods
  getIntervalMs(interval) {
    switch (interval) {
      case '1m':
        return 60 * 1000;
      case '5m':
        return 5 * 60 * 1000;
      case '15m':
        return 15 * 60 * 1000;
      case '1h':
        return 60 * 60 * 1000;
      case '4h':
        return 4 * 60 * 60 * 1000;
      case '1d':
        return 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // 1 hour
    }
  }

  groupByInterval(data, intervalMs) {
    const groups = {};
    
    data.forEach(point => {
      const intervalStart = Math.floor(point.timestamp / intervalMs) * intervalMs;
      
      if (!groups[intervalStart]) {
        groups[intervalStart] = {
          timestamp: intervalStart,
          prices: [],
          volumes: []
        };
      }
      
      groups[intervalStart].prices.push(parseFloat(point.price));
      if (point.volume) {
        groups[intervalStart].volumes.push(point.volume);
      }
    });
    
    return Object.values(groups).map(group => {
      const prices = group.prices.sort((a, b) => a - b);
      return {
        timestamp: group.timestamp,
        open: prices[0],
        close: prices[prices.length - 1],
        high: Math.max(...prices),
        low: Math.min(...prices),
        avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
        volume: group.volumes.reduce((sum, v) => sum + v, 0)
      };
    }).sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = new HistoricalDataService();
