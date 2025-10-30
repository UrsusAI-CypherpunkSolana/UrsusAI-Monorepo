const Agent = require('../models/Agent');
const BlockchainDataService = require('./BlockchainDataService');
const RealDataCalculator = require('./RealDataCalculator');
const AgentUpdater = require('../scripts/updateAgent');

class RealTimeUpdater {
  constructor() {
    this.updateInterval = 30000; // 30 seconds
    this.isRunning = false;
    this.activeAgents = new Set();
    this.blockchainService = new BlockchainDataService();
    this.agentUpdater = null;
  }

  // Start real-time updates
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Real-time updater already running');
      return;
    }

    console.log('🚀 Starting real-time blockchain data updater');

    try {
      // Initialize AgentUpdater
      this.agentUpdater = new AgentUpdater();
      await this.agentUpdater.initialize();
      console.log('✅ AgentUpdater initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AgentUpdater:', error);
      // Continue with fallback methods
    }

    this.isRunning = true;

    // Initial update
    this.updateAllAgents();

    // Schedule periodic updates
    this.intervalId = setInterval(() => {
      this.updateAllAgents();
    }, this.updateInterval);
  }

  // Stop real-time updates
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping real-time blockchain data updater');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Add agent to active monitoring
  addAgent(agentAddress) {
    this.activeAgents.add(agentAddress.toLowerCase());
    console.log(`📊 Added agent to real-time monitoring: ${agentAddress}`);
  }

  // Remove agent from active monitoring
  removeAgent(agentAddress) {
    this.activeAgents.delete(agentAddress.toLowerCase());
    console.log(`📊 Removed agent from real-time monitoring: ${agentAddress}`);
  }

  // Update all active agents
  async updateAllAgents() {
    if (this.activeAgents.size === 0) {
      // Get all agents from database if none are actively monitored
      try {
        const agents = await Agent.find({ isActive: true }).limit(10);
        agents.forEach(agent => {
          this.activeAgents.add(agent.contractAddress.toLowerCase());
        });
      } catch (error) {
        console.error('❌ Error fetching agents for monitoring:', error);
        return;
      }
    }

    console.log(`🔄 Updating ${this.activeAgents.size} agents with real blockchain data`);

    // Use AgentUpdater if available, otherwise fallback to old method
    if (this.agentUpdater) {
      try {
        const agentAddresses = Array.from(this.activeAgents);
        const updatePromises = agentAddresses.map(async (agentAddress) => {
          const result = await this.agentUpdater.updateAgent(agentAddress);
          return { agentAddress, success: result.success, data: result.data, error: result.error };
        });

        const results = await Promise.allSettled(updatePromises);
        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        console.log(`📊 AgentUpdater result: ${successful} successful, ${failed} failed`);
        this.broadcastUpdates(results);
        return;
      } catch (error) {
        console.error('❌ AgentUpdater failed, falling back to legacy method:', error);
      }
    }

    // Legacy update method as fallback
    const updatePromises = Array.from(this.activeAgents).map(async (agentAddress) => {
      try {
        // Always try blockchain data first, fallback to calculated stats
        let result = await this.blockchainService.updateAgentWithRealData(agentAddress);

        if (!result.success) {
          console.log(`🔄 Blockchain update failed for ${agentAddress}, using calculated stats`);
          console.log(`🔍 Blockchain error: ${result.error}`);
          result = await RealDataCalculator.updateAgentWithRealStats(agentAddress);
        }

        if (result.success) {
          console.log(`✅ Updated ${agentAddress}: Price ${result.data.currentPrice}, Volume ${result.data.volume24h}`);
          return { agentAddress, success: true, data: result.data };
        } else {
          console.warn(`⚠️ Failed to update ${agentAddress}: ${result.error}`);
          return { agentAddress, success: false, error: result.error };
        }
      } catch (error) {
        console.error(`❌ Error updating ${agentAddress}:`, error);
        return { agentAddress, success: false, error: error.message };
      }
    });

    try {
      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - successful;
      
      console.log(`📊 Update complete: ${successful} successful, ${failed} failed`);
      
      // Broadcast updates via WebSocket if available
      this.broadcastUpdates(results);
      
    } catch (error) {
      console.error('❌ Error in batch update:', error);
    }
  }

  // Broadcast updates via WebSocket
  broadcastUpdates(results) {
    try {
      // This would integrate with your WebSocket service
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          const { agentAddress, data } = result.value;
          
          // Broadcast agent stats update
          if (global.websocketService) {
            global.websocketService.broadcast({
              type: 'agentStatsUpdate',
              agentAddress: agentAddress,
              stats: {
                currentPrice: data.currentPrice,
                marketCap: data.marketCap,
                volume24h: data.volume24h,
                priceChange24h: data.priceChange24h,
                holders: data.holders,
                totalTrades: data.totalTrades,
                lastUpdate: new Date().toISOString()
              },
              timestamp: Date.now()
            });
          }
        }
      });
    } catch (error) {
      console.error('❌ Error broadcasting updates:', error);
    }
  }

  // Force update specific agent
  async forceUpdateAgent(agentAddress) {
    console.log(`🔄 Force updating agent: ${agentAddress}`);
    
    try {
      const result = await BlockchainDataService.updateAgentWithRealData(agentAddress);
      
      if (result.success) {
        console.log(`✅ Force update successful for ${agentAddress}`);
        
        // Broadcast immediate update
        if (global.websocketService) {
          global.websocketService.broadcast({
            type: 'agentStatsUpdate',
            agentAddress: agentAddress,
            stats: result.data,
            timestamp: Date.now()
          });
        }
        
        return result;
      } else {
        console.warn(`⚠️ Force update failed for ${agentAddress}: ${result.error}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error in force update for ${agentAddress}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get current status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeAgents: Array.from(this.activeAgents),
      updateInterval: this.updateInterval,
      lastUpdate: this.lastUpdate || null
    };
  }

  // Update configuration
  updateConfig(config) {
    if (config.updateInterval && config.updateInterval >= 10000) {
      this.updateInterval = config.updateInterval;
      console.log(`⚙️ Update interval changed to ${this.updateInterval}ms`);
      
      // Restart with new interval
      if (this.isRunning) {
        this.stop();
        this.start();
      }
    }
  }
}

// Create singleton instance
const realTimeUpdater = new RealTimeUpdater();

// Auto-start when module is loaded
realTimeUpdater.start();

// Graceful shutdown
module.exports = RealTimeUpdater;
