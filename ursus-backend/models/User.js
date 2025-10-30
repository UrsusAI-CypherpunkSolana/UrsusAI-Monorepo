const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Wallet address as primary identifier
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  
  // Profile information
  username: {
    type: String,
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  
  avatar: {
    type: String,
    default: null
  },
  
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // Social links
  socialLinks: {
    twitter: { type: String, default: '' },
    discord: { type: String, default: '' },
    telegram: { type: String, default: '' },
    website: { type: String, default: '' }
  },
  
  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ['dark', 'light'],
      default: 'dark'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      trading: { type: Boolean, default: true },
      agents: { type: Boolean, default: true }
    },
    privacy: {
      showPortfolio: { type: Boolean, default: false },
      showActivity: { type: Boolean, default: true }
    }
  },
  
  // Authentication
  nonce: {
    type: String,
    default: () => Math.floor(Math.random() * 1000000).toString()
  },
  
  // Activity tracking
  lastLogin: {
    type: Date,
    default: Date.now
  },
  
  loginCount: {
    type: Number,
    default: 1
  },
  
  // Portfolio tracking
  totalPortfolioValue: {
    type: Number,
    default: 0
  },
  
  totalPnL: {
    type: Number,
    default: 0
  },
  
  // Agent interactions
  agentsCreated: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  
  favoriteAgents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  
  // Trading stats
  tradingStats: {
    totalTrades: { type: Number, default: 0 },
    totalVolume: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
    bestTrade: { type: Number, default: 0 },
    worstTrade: { type: Number, default: 0 }
  },
  
  // Verification status
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationLevel: {
    type: String,
    enum: ['none', 'basic', 'advanced', 'premium'],
    default: 'none'
  },
  
  // Subscription/Premium features
  subscription: {
    type: {
      type: String,
      enum: ['free', 'premium', 'pro'],
      default: 'free'
    },
    expiresAt: Date,
    features: [String]
  },
  
  // Reputation system
  reputation: {
    score: { type: Number, default: 0 },
    level: { type: String, default: 'Newcomer' },
    badges: [String]
  },

  // Social features (pump.fun style)
  following: [{
    type: String,
    lowercase: true
  }],

  followers: [{
    type: String,
    lowercase: true
  }],

  // Social stats
  socialStats: {
    followingCount: { type: Number, default: 0 },
    followersCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    likesReceived: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 }
  },

  // Profile customization
  profileExtended: {
    displayName: { type: String, maxlength: 50, trim: true },
    banner: { type: String },
    website: { type: String },
    telegram: { type: String }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ walletAddress: 1 });
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for portfolio holdings
userSchema.virtual('holdings', {
  ref: 'Portfolio',
  localField: '_id',
  foreignField: 'user'
});

// Virtual for chat history
userSchema.virtual('chatHistory', {
  ref: 'ChatMessage',
  localField: '_id',
  foreignField: 'user'
});

// Methods
userSchema.methods.generateNonce = function() {
  this.nonce = Math.floor(Math.random() * 1000000).toString();
  return this.nonce;
};

userSchema.methods.updateLoginInfo = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

userSchema.methods.addFavoriteAgent = function(agentId) {
  if (!this.favoriteAgents.includes(agentId)) {
    this.favoriteAgents.push(agentId);
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.removeFavoriteAgent = function(agentId) {
  this.favoriteAgents = this.favoriteAgents.filter(id => !id.equals(agentId));
  return this.save();
};

userSchema.methods.updateTradingStats = function(tradeData) {
  this.tradingStats.totalTrades += 1;
  this.tradingStats.totalVolume += tradeData.volume;
  
  if (tradeData.pnl > this.tradingStats.bestTrade) {
    this.tradingStats.bestTrade = tradeData.pnl;
  }
  
  if (tradeData.pnl < this.tradingStats.worstTrade) {
    this.tradingStats.worstTrade = tradeData.pnl;
  }
  
  return this.save();
};

// Static methods
userSchema.statics.findByWallet = function(walletAddress) {
  return this.findOne({ walletAddress: walletAddress.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: new RegExp(`^${username}$`, 'i') });
};

userSchema.statics.getTopTraders = function(limit = 10) {
  return this.find({})
    .sort({ 'tradingStats.totalVolume': -1 })
    .limit(limit)
    .select('username walletAddress tradingStats totalPortfolioValue');
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  if (this.isModified('walletAddress')) {
    this.walletAddress = this.walletAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
