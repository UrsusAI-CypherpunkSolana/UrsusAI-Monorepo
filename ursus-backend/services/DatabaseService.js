const mongoose = require('mongoose');
const Redis = require('redis');

class DatabaseService {
  constructor() {
    this.isConnected = false;
    this.redisClient = null;
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/ursus';
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Advanced connection options
    this.mongoOptions = {
      maxPoolSize: 20, // Increased pool size for production
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      retryReads: true,
      readPreference: 'primaryPreferred',
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 5000
      },
      // Enable compression
      compressors: ['zlib'],
      zlibCompressionLevel: 6
    };

    // Cache configuration
    this.cacheConfig = {
      defaultTTL: 300, // 5 minutes
      agentTTL: 60,    // 1 minute for agent data
      priceTTL: 30,    // 30 seconds for price data
      chartTTL: 120    // 2 minutes for chart data
    };
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('📊 Database already connected');
        return;
      }
  
      console.log('🔌 Connecting to MongoDB...');
  
      // MongoDB'ye retry/backoff ile bağlan
      await this.connectMongoWithRetry(5);
  
      this.isConnected = true;
      console.log('✅ MongoDB connected successfully');
  
      // Redis bağlantısı opsiyonel
      await this.connectRedis();
  
      // Event listener'lar
      this.setupEventListeners();
  
      // !!! initializeOptimizations BURADA ÇAĞRILMAYACAK !!!
      // Artık setupEventListeners içinden Mongo bağlanınca tetiklenecek.
  
    } catch (error) {
      console.error('❌ Database connection error:', error);
      throw error;
    }
  }
  

  async connectRedis() {
    try {
      console.log('🔌 Connecting to Redis...');

      this.redisClient = Redis.createClient({
        url: this.redisUrl,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.log('❌ Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      await this.redisClient.connect();
      console.log('✅ Redis connected successfully');

    } catch (error) {
      console.warn('⚠️ Redis connection failed, continuing without cache:', error.message);
      this.redisClient = null;
    }
  }

  setupEventListeners() {
    mongoose.connection.on('connected', async () => {
      console.log('📊 Mongoose connected to MongoDB');
      this.isConnected = true;
  
      try {
        await this.initializeOptimizations();
      } catch (err) {
        console.error('❌ Failed to run initializeOptimizations:', err);
      }
    });
  
    mongoose.connection.on('error', (error) => {
      console.error('❌ Mongoose connection error:', error);
      this.isConnected = false;
    });
  
    mongoose.connection.on('disconnected', () => {
      console.log('📊 Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });
  
    // Redis event listeners
    if (this.redisClient) {
      this.redisClient.on('error', (error) => {
        console.error('❌ Redis error:', error);
      });
  
      this.redisClient.on('connect', () => {
        console.log('📊 Redis connected');
      });
  
      this.redisClient.on('disconnect', () => {
        console.log('📊 Redis disconnected');
      });
    }
  
    // Handle application termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }
  

  async initializeOptimizations() {
    try {
      console.log('🔧 Initializing database optimizations...');
  
      const db = mongoose.connection.db;
      if (!db) {
        console.warn('initializeOptimizations skipped: MongoDB not ready yet');
        return;
      }
  
      // Agent collection optimizations
      await db.collection('agents').createIndex(
        { 'metrics.marketCap': -1, isActive: 1 },
        { background: true }
      );
  
      await db.collection('agents').createIndex(
        { 'metrics.volume24h': -1, isActive: 1 },
        { background: true }
      );
  
      // Trade collection optimizations
      await db.collection('trades').createIndex(
        { agentAddress: 1, timestamp: -1 },
        { background: true }
      );
  
      await db.collection('trades').createIndex(
        { trader: 1, timestamp: -1 },
        { background: true }
      );
  
      // Portfolio collection optimizations
      await db.collection('portfolios').createIndex(
        { userAddress: 1, agentAddress: 1 },
        { unique: true, background: true }
      );
  
      console.log('✅ Database optimizations completed');
    } catch (error) {
      console.error('❌ Error initializing optimizations:', error);
    }
  }
  

  // Cache methods
  async getFromCache(key) {
    if (!this.redisClient) return null;

    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  async setCache(key, data, ttl = this.cacheConfig.defaultTTL) {
    if (!this.redisClient) return false;

    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('❌ Cache set error:', error);
      return false;
    }
  }

  async deleteFromCache(key) {
    if (!this.redisClient) return false;

    try {
      await this.redisClient.del(key);
      return true;
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      return false;
    }
  }

  async clearCachePattern(pattern) {
    if (!this.redisClient) return false;

    try {
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('❌ Cache clear error:', error);
      return false;
    }
  }

  // Database health and monitoring
  async healthCheck() {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      // MongoDB ping
      await mongoose.connection.db.admin().ping();

      // Redis ping (if available)
      let redisStatus = 'disabled';
      if (this.redisClient) {
        try {
          await this.redisClient.ping();
          redisStatus = 'healthy';
        } catch (error) {
          redisStatus = 'unhealthy';
        }
      }

      return {
        status: 'healthy',
        mongodb: 'healthy',
        redis: redisStatus,
        timestamp: new Date().toISOString(),
        connection: this.getConnectionStatus()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        connection: this.getConnectionStatus()
      };
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      redis: this.redisClient ? 'connected' : 'disconnected'
    };
  }

  async disconnect() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('📊 Redis connection closed');
      }

      if (this.isConnected) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('📊 MongoDB connection closed');
      }
    } catch (error) {
      console.error('❌ Error closing database connections:', error);
    }
  }

  async connectMongoWithRetry(retries = 5) {
    let attempt = 0;
    let delay = 1000;
    while (attempt < retries) {
      try {
        await mongoose.connect(this.connectionString, this.mongoOptions);
        return;
      } catch (err) {
        attempt++;
        if (attempt >= retries) throw err;
        console.warn(`Mongo connect failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`, err.message);
        await new Promise(r => setTimeout(r, delay));
        delay = Math.min(delay * 2, 10000);
      }
    }
  }

}

module.exports = DatabaseService;
