const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  // Agent reference
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
    index: true
  },
  
  agentAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Time-series data
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  
  // OHLCV data
  open: {
    type: String, // Use string for precise decimal handling
    required: true
  },
  
  high: {
    type: String,
    required: true
  },
  
  low: {
    type: String,
    required: true
  },
  
  close: {
    type: String,
    required: true
  },
  
  volume: {
    type: String,
    default: '0'
  },
  
  // Additional metrics
  trades: {
    type: Number,
    default: 0
  },
  
  marketCap: {
    type: String,
    default: '0'
  },
  
  // Timeframe for aggregated data
  timeframe: {
    type: String,
    enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
    required: true,
    index: true
  },
  
  // Technical indicators (calculated)
  indicators: {
    sma20: { type: String, default: null },
    sma50: { type: String, default: null },
    ema12: { type: String, default: null },
    ema26: { type: String, default: null },
    rsi: { type: Number, default: null },
    macd: {
      line: { type: String, default: null },
      signal: { type: String, default: null },
      histogram: { type: String, default: null }
    },
    bollinger: {
      upper: { type: String, default: null },
      middle: { type: String, default: null },
      lower: { type: String, default: null }
    }
  },
  
  // Volume analysis
  volumeAnalysis: {
    buyVolume: { type: String, default: '0' },
    sellVolume: { type: String, default: '0' },
    volumeRatio: { type: Number, default: 0 },
    avgTradeSize: { type: String, default: '0' }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient queries
priceHistorySchema.index({ agentAddress: 1, timeframe: 1, timestamp: -1 });
priceHistorySchema.index({ agentAddress: 1, timestamp: -1 });
priceHistorySchema.index({ timeframe: 1, timestamp: -1 });
priceHistorySchema.index({ blockNumber: -1 });

// Unique constraint to prevent duplicate entries
priceHistorySchema.index(
  { agentAddress: 1, timeframe: 1, timestamp: 1 }, 
  { unique: true }
);

// TTL index for data retention (optional - remove old data after 1 year)
priceHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

// Virtual for price change
priceHistorySchema.virtual('priceChange').get(function() {
  const openPrice = parseFloat(this.open);
  const closePrice = parseFloat(this.close);
  return closePrice - openPrice;
});

// Virtual for price change percentage
priceHistorySchema.virtual('priceChangePercent').get(function() {
  const openPrice = parseFloat(this.open);
  const closePrice = parseFloat(this.close);
  if (openPrice === 0) return 0;
  return ((closePrice - openPrice) / openPrice) * 100;
});

// Static methods for data aggregation
priceHistorySchema.statics.getLatestPrice = function(agentAddress) {
  return this.findOne({ 
    agentAddress: agentAddress.toLowerCase() 
  }).sort({ timestamp: -1 });
};

priceHistorySchema.statics.getPriceRange = function(agentAddress, timeframe, from, to) {
  return this.find({
    agentAddress: agentAddress.toLowerCase(),
    timeframe,
    timestamp: { $gte: from, $lte: to }
  }).sort({ timestamp: 1 });
};

priceHistorySchema.statics.getVolumeData = function(agentAddress, timeframe, from, to) {
  return this.aggregate([
    {
      $match: {
        agentAddress: agentAddress.toLowerCase(),
        timeframe,
        timestamp: { $gte: from, $lte: to }
      }
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: { $toDouble: '$volume' } },
        avgVolume: { $avg: { $toDouble: '$volume' } },
        maxVolume: { $max: { $toDouble: '$volume' } },
        totalTrades: { $sum: '$trades' }
      }
    }
  ]);
};

// Instance methods
priceHistorySchema.methods.calculateTechnicalIndicators = function() {
  // This would implement technical indicator calculations
  // For now, we'll add placeholder logic
  return this;
};

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
