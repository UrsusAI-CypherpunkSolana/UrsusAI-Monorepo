const mongoose = require('mongoose');
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ursus';

class Volume24hFixer {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
  }

  async initialize() {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async fixAllAgents() {
    try {
      console.log('🔄 Starting volume24h fix for all agents...');

      // Get all active agents
      const agents = await Agent.find({ isActive: true });
      console.log(`📊 Found ${agents.length} active agents to process`);

      for (const agent of agents) {
        try {
          await this.fixAgentVolume24h(agent);
          this.processedCount++;
        } catch (error) {
          console.error(`❌ Error fixing agent ${agent.contractAddress}:`, error);
          this.errorCount++;
        }
      }

      console.log('\n📊 ===== VOLUME24H FIX SUMMARY =====');
      console.log(`✅ Successfully processed: ${this.processedCount} agents`);
      console.log(`❌ Errors: ${this.errorCount} agents`);
      console.log('=====================================\n');

    } catch (error) {
      console.error('❌ Error in fixAllAgents:', error);
      throw error;
    }
  }

  async fixAgentVolume24h(agent) {
    const agentAddress = agent.contractAddress;
    
    // Get all trades for this agent in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTrades = await Trade.find({
      agentAddress: agentAddress.toLowerCase(),
      timestamp: { $gte: twentyFourHoursAgo }
    });

    // Calculate correct 24h volume
    const volume24h = recentTrades.reduce((sum, trade) => {
      return sum + parseFloat(trade.coreAmount || 0);
    }, 0);

    // Update the agent with correct volume24h
    await Agent.updateOne(
      { contractAddress: agentAddress.toLowerCase() },
      {
        $set: {
          'metrics.volume24h': volume24h,
          lastPriceUpdate: new Date()
        }
      }
    );

    console.log(`✅ Fixed ${agent.name} (${agent.symbol}): ${volume24h.toFixed(4)} SOL volume24h`);
  }

  async cleanup() {
    try {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// CLI Interface
async function main() {
  const fixer = new Volume24hFixer();

  try {
    await fixer.initialize();
    await fixer.fixAllAgents();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await fixer.cleanup();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = Volume24hFixer;
