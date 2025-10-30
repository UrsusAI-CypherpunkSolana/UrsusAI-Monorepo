const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  // Blockchain data
  contractAddress: {
    type: String,
    required: true,
    unique: true
    // NOTE: Removed lowercase: true because Solana addresses are case-sensitive
  },

  // Solana token mint address (PDA derived from agent address)
  mintAddress: {
    type: String,
    required: false,
    sparse: true
    // NOTE: Removed lowercase: true because Solana addresses are case-sensitive
  },

  // Basic info
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    maxlength: 10
  },
  
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // AI Configuration
  instructions: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  model: {
    type: String,
    required: true,
    enum: [
      'claude-3',
      'claude-3-sonnet-20240229',
      'gemini-pro',
      'llama3-8b-8192'
    ]
  },

  
  // Metadata
  category: {
    type: String,
    required: true,
    enum: ['DeFi', 'Trading', 'Analytics', 'Gaming', 'Social', 'Utility', 'Entertainment', 'Education', 'General']
  },
  
  avatar: {
    type: String,
    default: null
  },

  image: {
    type: String,
    default: null
  },

  // Creator info
  creator: {
    type: String,
    required: true,
    lowercase: true
  },
  
  creatorUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Token economics
  tokenomics: {
    totalSupply: { type: String, required: true },
    currentPrice: { type: String, default: '0' },
    marketCap: { type: String, default: '0' },
    reserve: { type: String, default: '0' },
    bondingCurveParams: {
      reserveRatio: { type: Number, default: 500000 }, // PPM
      slope: { type: Number, default: 1 }
    },
    // Graduation data (pump.fun style)
    liquidityTokens: { type: String, default: '0' },
    graduationReserve: { type: String, default: '0' },
    dexPair: { type: String, default: null }
  },
  
  // Performance metrics
  metrics: {
    holders: { type: Number, default: 0 },
    totalTransactions: { type: Number, default: 0 },
    volume24h: { type: Number, default: 0 },
    volume7d: { type: Number, default: 0 },
    volumeTotal: { type: Number, default: 0 },
    priceChange24h: { type: Number, default: 0 },
    priceChange7d: { type: Number, default: 0 },
    allTimeHigh: { type: String, default: '0' },
    allTimeLow: { type: String, default: '0' }
  },
  
  // AI Performance
  aiMetrics: {
    totalChats: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    satisfactionScore: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    popularityScore: { type: Number, default: 0 }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  isFeatured: {
    type: Boolean,
    default: false
  },

  // Graduation status (pump.fun style)
  isGraduated: {
    type: Boolean,
    default: false
  },

  graduationDate: {
    type: Date,
    default: null
  },
  
  // Moderation
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  
  moderationNotes: {
    type: String,
    default: ''
  },
  
  // Tags and features
  tags: [String],
  
  features: {
    hasCustomAvatar: { type: Boolean, default: false },
    hasAdvancedInstructions: { type: Boolean, default: false },
    hasCustomModel: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false }
  },
  
  // Social features
  social: {
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },
  
  // Analytics
  analytics: {
    views: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    chatSessions: { type: Number, default: 0 },
    avgSessionDuration: { type: Number, default: 0 }
  },
  
  // Blockchain events tracking
  lastEventBlock: {
    type: Number,
    default: 0
  },
  
  lastPriceUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
agentSchema.index({ contractAddress: 1 });
agentSchema.index({ creator: 1 });
agentSchema.index({ category: 1 });
agentSchema.index({ isActive: 1 });
agentSchema.index({ isFeatured: 1 });
agentSchema.index({ 'metrics.marketCap': -1 });
agentSchema.index({ 'metrics.volume24h': -1 });
agentSchema.index({ 'aiMetrics.totalChats': -1 });
agentSchema.index({ createdAt: -1 });

// Compound indexes
agentSchema.index({ category: 1, isActive: 1, 'metrics.marketCap': -1 });
agentSchema.index({ creator: 1, isActive: 1, createdAt: -1 });

// Virtual for price history
agentSchema.virtual('priceHistory', {
  ref: 'PriceHistory',
  localField: '_id',
  foreignField: 'agent'
});

// Virtual for chat messages
agentSchema.virtual('chatMessages', {
  ref: 'ChatMessage',
  localField: '_id',
  foreignField: 'agent'
});

// Methods
agentSchema.methods.updateMetrics = function(metricsData) {
  Object.assign(this.metrics, metricsData);
  this.lastPriceUpdate = new Date();
  return this.save();
};

agentSchema.methods.incrementChatCount = function() {
  this.aiMetrics.totalChats += 1;
  this.analytics.chatSessions += 1;
  return this.save();
};

agentSchema.methods.updateAIMetrics = function(responseTime, satisfaction) {
  this.aiMetrics.totalMessages += 1;
  
  // Update average response time
  const totalResponses = this.aiMetrics.totalMessages;
  this.aiMetrics.avgResponseTime = 
    ((this.aiMetrics.avgResponseTime * (totalResponses - 1)) + responseTime) / totalResponses;
  
  // Update satisfaction score
  if (satisfaction !== undefined) {
    const totalSatisfactions = this.aiMetrics.totalChats;
    this.aiMetrics.satisfactionScore = 
      ((this.aiMetrics.satisfactionScore * (totalSatisfactions - 1)) + satisfaction) / totalSatisfactions;
  }
  
  return this.save();
};

agentSchema.methods.incrementView = function(isUnique = false) {
  this.analytics.views += 1;
  if (isUnique) {
    this.analytics.uniqueViews += 1;
  }
  return this.save();
};

// Static methods
agentSchema.statics.findByAddress = function(contractAddress) {
  // Use case-insensitive regex for Solana addresses (stored in mixed case)
  return this.findOne({ contractAddress: { $regex: new RegExp(`^${contractAddress}$`, 'i') } });
};

agentSchema.statics.findByCreator = function(creatorAddress) {
  return this.find({ creator: creatorAddress.toLowerCase(), isActive: true });
};

agentSchema.statics.getTrending = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ 'metrics.volume24h': -1, 'aiMetrics.totalChats': -1 })
    .limit(limit);
};

agentSchema.statics.getFeatured = function(limit = 5) {
  return this.find({ isActive: true, isFeatured: true })
    .sort({ 'metrics.marketCap': -1 })
    .limit(limit);
};

agentSchema.statics.getByCategory = function(category, limit = 20) {
  return this.find({ category, isActive: true })
    .sort({ 'metrics.marketCap': -1 })
    .limit(limit);
};

agentSchema.statics.search = function(query, limit = 20) {
  return this.find({
    $and: [
      { isActive: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { symbol: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { tags: { $in: [new RegExp(query, 'i')] } }
        ]
      }
    ]
  })
  .sort({ 'metrics.marketCap': -1 })
  .limit(limit);
};

// Pre-save middleware
agentSchema.pre('save', function(next) {
  // NOTE: Removed contractAddress lowercase conversion because Solana addresses are case-sensitive
  // Keep contractAddress as-is from blockchain
  if (this.isModified('creator')) {
    this.creator = this.creator.toLowerCase();
  }
  if (this.isModified('symbol')) {
    this.symbol = this.symbol.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Agent', agentSchema);
