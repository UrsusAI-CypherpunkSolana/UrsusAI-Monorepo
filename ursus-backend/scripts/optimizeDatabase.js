const mongoose = require('mongoose');
const Redis = require('redis');
require('dotenv').config();

// Import models
const Agent = require('../models/Agent');
const Trade = require('../models/Trade');
const User = require('../models/User');
const PriceHistory = require('../models/PriceHistory');

class DatabaseOptimizer {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ursus';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redisClient = null;
  }

  async connect() {
    try {
      // Connect to MongoDB
      await mongoose.connect(this.mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ Connected to MongoDB');

      // Connect to Redis
      this.redisClient = Redis.createClient({ url: this.redisUrl });
      await this.redisClient.connect();
      console.log('✅ Connected to Redis');

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  async createOptimalIndexes() {
    console.log('🔧 Creating optimal database indexes...');
    
    try {
      const db = mongoose.connection.db;

      // Agent collection indexes
      console.log('📊 Optimizing Agent collection...');
      await db.collection('agents').createIndexes([
        { key: { contractAddress: 1 }, unique: true, background: true },
        { key: { creator: 1, isActive: 1 }, background: true },
        { key: { category: 1, isActive: 1, 'metrics.marketCap': -1 }, background: true },
        { key: { isActive: 1, 'metrics.volume24h': -1 }, background: true },
        { key: { isActive: 1, 'aiMetrics.totalChats': -1 }, background: true },
        { key: { isActive: 1, isFeatured: 1, 'metrics.marketCap': -1 }, background: true },
        { key: { name: 'text', symbol: 'text', description: 'text' }, background: true },
        { key: { createdAt: -1 }, background: true },
        { key: { updatedAt: -1 }, background: true }
      ]);

      // Trade collection indexes
      console.log('📊 Optimizing Trade collection...');
      await db.collection('trades').createIndexes([
        { key: { agentAddress: 1, timestamp: -1 }, background: true },
        { key: { userAddress: 1, timestamp: -1 }, background: true },
        { key: { type: 1, timestamp: -1 }, background: true },
        { key: { agentAddress: 1, type: 1, timestamp: -1 }, background: true },
        { key: { timestamp: -1 }, background: true },
        { key: { blockNumber: 1, transactionHash: 1 }, unique: true, background: true }
      ]);

      // User collection indexes
      console.log('📊 Optimizing User collection...');
      await db.collection('users').createIndexes([
        { key: { walletAddress: 1 }, unique: true, background: true },
        { key: { username: 1 }, unique: true, sparse: true, background: true },
        { key: { email: 1 }, unique: true, sparse: true, background: true },
        { key: { isActive: 1, createdAt: -1 }, background: true }
      ]);

      // PriceHistory collection indexes
      console.log('📊 Optimizing PriceHistory collection...');
      await db.collection('pricehistories').createIndexes([
        { key: { agentAddress: 1, timestamp: -1 }, background: true },
        { key: { agentAddress: 1, interval: 1, timestamp: -1 }, background: true },
        { key: { timestamp: -1 }, background: true }
      ]);

      console.log('✅ Database indexes optimized successfully');

    } catch (error) {
      console.error('❌ Error creating indexes:', error);
    }
  }

  async cleanupOldData() {
    console.log('🧹 Cleaning up old data...');
    
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Clean old price history (keep only last 30 days for 1m intervals)
      const oldPriceData = await PriceHistory.deleteMany({
        interval: '1m',
        timestamp: { $lt: sevenDaysAgo }
      });
      console.log(`🗑️ Removed ${oldPriceData.deletedCount} old 1m price records`);

      // Clean old trade data (keep only last 30 days for detailed trades)
      const oldTrades = await Trade.deleteMany({
        timestamp: { $lt: thirtyDaysAgo },
        amount: { $lt: '1000' } // Keep large trades longer
      });
      console.log(`🗑️ Removed ${oldTrades.deletedCount} old small trade records`);

      console.log('✅ Data cleanup completed');

    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  async optimizeCollections() {
    console.log('⚡ Optimizing collection performance...');
    
    try {
      const db = mongoose.connection.db;
      const collections = ['agents', 'trades', 'users', 'pricehistories'];

      for (const collectionName of collections) {
        console.log(`🔧 Optimizing ${collectionName} collection...`);
        
        // Get collection stats
        const stats = await db.collection(collectionName).stats();
        console.log(`📊 ${collectionName}: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // Compact collection if needed (MongoDB 4.4+)
        try {
          await db.command({ compact: collectionName });
          console.log(`✅ Compacted ${collectionName}`);
        } catch (error) {
          console.log(`⚠️ Could not compact ${collectionName}: ${error.message}`);
        }
      }

      console.log('✅ Collection optimization completed');

    } catch (error) {
      console.error('❌ Error optimizing collections:', error);
    }
  }

  async warmupCache() {
    console.log('🔥 Warming up Redis cache...');
    
    try {
      // Cache trending agents
      const trendingAgents = await Agent.getTrending(20);
      await this.redisClient.setEx('trending_agents', 300, JSON.stringify(trendingAgents));
      console.log('✅ Cached trending agents');

      // Cache featured agents
      const featuredAgents = await Agent.getFeatured(10);
      await this.redisClient.setEx('featured_agents', 600, JSON.stringify(featuredAgents));
      console.log('✅ Cached featured agents');

      // Cache categories
      const categories = await Agent.distinct('category', { isActive: true });
      await this.redisClient.setEx('agent_categories', 3600, JSON.stringify(categories));
      console.log('✅ Cached agent categories');

      // Cache platform stats
      const totalAgents = await Agent.countDocuments({ isActive: true });
      const totalTrades = await Trade.countDocuments();
      const totalUsers = await User.countDocuments({ isActive: true });
      
      const platformStats = {
        totalAgents,
        totalTrades,
        totalUsers,
        lastUpdated: new Date().toISOString()
      };
      
      await this.redisClient.setEx('platform_stats', 300, JSON.stringify(platformStats));
      console.log('✅ Cached platform statistics');

      console.log('✅ Cache warmup completed');

    } catch (error) {
      console.error('❌ Error warming up cache:', error);
    }
  }

  async generateReport() {
    console.log('📊 Generating optimization report...');
    
    try {
      const db = mongoose.connection.db;
      
      // Collection statistics
      const collections = ['agents', 'trades', 'users', 'pricehistories'];
      const report = {
        timestamp: new Date().toISOString(),
        collections: {},
        indexes: {},
        performance: {}
      };

      for (const collectionName of collections) {
        const stats = await db.collection(collectionName).stats();
        const indexes = await db.collection(collectionName).indexes();
        
        report.collections[collectionName] = {
          documents: stats.count,
          size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          avgDocSize: `${(stats.avgObjSize / 1024).toFixed(2)} KB`,
          indexes: indexes.length
        };
        
        report.indexes[collectionName] = indexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          unique: idx.unique || false
        }));
      }

      // Redis info
      if (this.redisClient) {
        const redisInfo = await this.redisClient.info('memory');
        const memoryMatch = redisInfo.match(/used_memory_human:(.+)/);
        report.redis = {
          memoryUsed: memoryMatch ? memoryMatch[1].trim() : 'Unknown'
        };
      }

      console.log('\n📋 OPTIMIZATION REPORT');
      console.log('='.repeat(50));
      console.log(JSON.stringify(report, null, 2));
      console.log('='.repeat(50));

      return report;

    } catch (error) {
      console.error('❌ Error generating report:', error);
    }
  }

  async disconnect() {
    try {
      await mongoose.disconnect();
      if (this.redisClient) {
        await this.redisClient.disconnect();
      }
      console.log('✅ Disconnected from databases');
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
    }
  }

  async run() {
    console.log('🚀 Starting database optimization...');
    
    await this.connect();
    await this.createOptimalIndexes();
    await this.cleanupOldData();
    await this.optimizeCollections();
    await this.warmupCache();
    await this.generateReport();
    await this.disconnect();
    
    console.log('🎉 Database optimization completed successfully!');
  }
}

// Run optimization if called directly
if (require.main === module) {
  const optimizer = new DatabaseOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = DatabaseOptimizer;
