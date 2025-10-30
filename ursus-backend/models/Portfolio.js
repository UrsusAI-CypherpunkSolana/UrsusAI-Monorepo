const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  userAddress: {
    type: String,
    required: true,
    lowercase: true
  },

  // Agent/Token reference
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },

  agentAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  
  // Holdings information
  balance: {
    type: String, // Use string for precise decimal handling
    required: true,
    default: '0'
  },
  
  // Cost basis tracking
  totalInvested: {
    type: String,
    default: '0'
  },
  
  averageBuyPrice: {
    type: String,
    default: '0'
  },
  
  // Performance metrics
  currentValue: {
    type: String,
    default: '0'
  },
  
  unrealizedPnL: {
    type: String,
    default: '0'
  },
  
  unrealizedPnLPercentage: {
    type: Number,
    default: 0
  },
  
  realizedPnL: {
    type: String,
    default: '0'
  },
  
  // Trading statistics
  tradingStats: {
    totalBuys: { type: Number, default: 0 },
    totalSells: { type: Number, default: 0 },
    totalVolume: { type: String, default: '0' },
    firstPurchaseDate: Date,
    lastTradeDate: Date,
    holdingPeriod: Number // days
  },
  
  // Position details
  position: {
    type: {
      type: String,
      enum: ['long', 'short', 'neutral'],
      default: 'long'
    },
    size: {
      type: String,
      default: '0'
    },
    leverage: {
      type: Number,
      default: 1
    }
  },
  
  // Risk metrics
  riskMetrics: {
    volatility: { type: Number, default: 0 },
    sharpeRatio: { type: Number, default: 0 },
    maxDrawdown: { type: Number, default: 0 },
    beta: { type: Number, default: 0 }
  },
  
  // Alerts and notifications
  alerts: {
    priceAlerts: [{
      type: { type: String, enum: ['above', 'below'] },
      price: String,
      triggered: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],
    pnlAlerts: [{
      type: { type: String, enum: ['profit', 'loss'] },
      percentage: Number,
      triggered: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isWatching: {
    type: Boolean,
    default: false
  },
  
  // Metadata
  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  
  tags: [String],
  
  // Last update tracking
  lastPriceUpdate: {
    type: Date,
    default: Date.now
  },
  
  lastBalanceUpdate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
portfolioSchema.index({ user: 1, agent: 1 }, { unique: true });
portfolioSchema.index({ userAddress: 1, agentAddress: 1 }, { unique: true });
portfolioSchema.index({ user: 1, isActive: 1 });
portfolioSchema.index({ userAddress: 1, isActive: 1 });
portfolioSchema.index({ agent: 1 });
portfolioSchema.index({ currentValue: -1 });
portfolioSchema.index({ unrealizedPnLPercentage: -1 });

// Virtual for current price
portfolioSchema.virtual('currentPrice').get(function() {
  const balance = parseFloat(this.balance);
  const currentValue = parseFloat(this.currentValue);
  return balance > 0 ? (currentValue / balance).toString() : '0';
});

// Virtual for portfolio weight (requires total portfolio value)
portfolioSchema.virtual('portfolioWeight').get(function() {
  // This would be calculated at query time with total portfolio value
  return 0;
});

// Methods
portfolioSchema.methods.updateBalance = function(newBalance, currentPrice) {
  this.balance = newBalance.toString();
  this.currentValue = (parseFloat(newBalance) * parseFloat(currentPrice)).toString();
  this.lastBalanceUpdate = new Date();
  
  // Update PnL
  const totalInvested = parseFloat(this.totalInvested);
  const currentValue = parseFloat(this.currentValue);
  
  if (totalInvested > 0) {
    this.unrealizedPnL = (currentValue - totalInvested).toString();
    this.unrealizedPnLPercentage = ((currentValue - totalInvested) / totalInvested) * 100;
  }
  
  return this.save();
};

portfolioSchema.methods.addTrade = function(tradeType, amount, price, fee = '0') {
  const tradeAmount = parseFloat(amount);
  const tradePrice = parseFloat(price);
  const tradeFee = parseFloat(fee);
  const tradeValue = tradeAmount * tradePrice;
  
  if (tradeType === 'buy') {
    // Update balance
    const currentBalance = parseFloat(this.balance);
    const newBalance = currentBalance + tradeAmount;
    this.balance = newBalance.toString();
    
    // Update cost basis
    const currentInvested = parseFloat(this.totalInvested);
    const newInvested = currentInvested + tradeValue + tradeFee;
    this.totalInvested = newInvested.toString();
    
    // Update average buy price
    this.averageBuyPrice = (newInvested / newBalance).toString();
    
    // Update trading stats
    this.tradingStats.totalBuys += 1;
    if (!this.tradingStats.firstPurchaseDate) {
      this.tradingStats.firstPurchaseDate = new Date();
    }
  } else if (tradeType === 'sell') {
    // Update balance
    const currentBalance = parseFloat(this.balance);
    const newBalance = Math.max(0, currentBalance - tradeAmount);
    this.balance = newBalance.toString();
    
    // Calculate realized PnL
    const avgBuyPrice = parseFloat(this.averageBuyPrice);
    const realizedPnL = (tradePrice - avgBuyPrice) * tradeAmount - tradeFee;
    const currentRealizedPnL = parseFloat(this.realizedPnL);
    this.realizedPnL = (currentRealizedPnL + realizedPnL).toString();
    
    // Update total invested proportionally
    const sellRatio = tradeAmount / currentBalance;
    const currentInvested = parseFloat(this.totalInvested);
    this.totalInvested = (currentInvested * (1 - sellRatio)).toString();
    
    // Update trading stats
    this.tradingStats.totalSells += 1;
  }
  
  // Update common stats
  const currentVolume = parseFloat(this.tradingStats.totalVolume);
  this.tradingStats.totalVolume = (currentVolume + tradeValue).toString();
  this.tradingStats.lastTradeDate = new Date();
  
  // Calculate holding period
  if (this.tradingStats.firstPurchaseDate) {
    const holdingPeriodMs = Date.now() - this.tradingStats.firstPurchaseDate.getTime();
    this.tradingStats.holdingPeriod = Math.floor(holdingPeriodMs / (1000 * 60 * 60 * 24));
  }
  
  return this.save();
};

portfolioSchema.methods.updateCurrentValue = function(currentPrice) {
  const balance = parseFloat(this.balance);
  const price = parseFloat(currentPrice);
  this.currentValue = (balance * price).toString();
  this.lastPriceUpdate = new Date();
  
  // Update unrealized PnL
  const totalInvested = parseFloat(this.totalInvested);
  const currentValue = parseFloat(this.currentValue);
  
  if (totalInvested > 0) {
    this.unrealizedPnL = (currentValue - totalInvested).toString();
    this.unrealizedPnLPercentage = ((currentValue - totalInvested) / totalInvested) * 100;
  }
  
  return this.save();
};

portfolioSchema.methods.addPriceAlert = function(type, price) {
  this.alerts.priceAlerts.push({
    type,
    price: price.toString(),
    triggered: false,
    createdAt: new Date()
  });
  return this.save();
};

portfolioSchema.methods.checkAlerts = function(currentPrice) {
  const price = parseFloat(currentPrice);
  let alertsTriggered = [];
  
  // Check price alerts
  this.alerts.priceAlerts.forEach(alert => {
    if (!alert.triggered) {
      const alertPrice = parseFloat(alert.price);
      if ((alert.type === 'above' && price >= alertPrice) ||
          (alert.type === 'below' && price <= alertPrice)) {
        alert.triggered = true;
        alertsTriggered.push({
          type: 'price',
          direction: alert.type,
          value: alertPrice,
          currentValue: price
        });
      }
    }
  });
  
  // Check PnL alerts
  this.alerts.pnlAlerts.forEach(alert => {
    if (!alert.triggered) {
      const currentPnLPercentage = this.unrealizedPnLPercentage;
      if ((alert.type === 'profit' && currentPnLPercentage >= alert.percentage) ||
          (alert.type === 'loss' && currentPnLPercentage <= -alert.percentage)) {
        alert.triggered = true;
        alertsTriggered.push({
          type: 'pnl',
          direction: alert.type,
          value: alert.percentage,
          currentValue: currentPnLPercentage
        });
      }
    }
  });
  
  if (alertsTriggered.length > 0) {
    this.save();
  }
  
  return alertsTriggered;
};

// Static methods
portfolioSchema.statics.getUserPortfolio = function(userAddress) {
  return this.find({ userAddress: userAddress.toLowerCase(), isActive: true })
    .populate('agent', 'name symbol avatar contractAddress tokenomics')
    .sort({ currentValue: -1 });
};

portfolioSchema.statics.getTopHolders = function(agentAddress, limit = 10) {
  return this.find({ agentAddress: agentAddress.toLowerCase(), isActive: true })
    .populate('user', 'username walletAddress avatar')
    .sort({ balance: -1 })
    .limit(limit);
};

portfolioSchema.statics.getPortfolioSummary = function(userAddress) {
  return this.aggregate([
    {
      $match: { userAddress: userAddress.toLowerCase(), isActive: true }
    },
    {
      $group: {
        _id: null,
        totalValue: { $sum: { $toDouble: '$currentValue' } },
        totalInvested: { $sum: { $toDouble: '$totalInvested' } },
        totalRealizedPnL: { $sum: { $toDouble: '$realizedPnL' } },
        positionCount: { $sum: 1 }
      }
    },
    {
      $project: {
        totalValue: 1,
        totalInvested: 1,
        totalRealizedPnL: 1,
        totalUnrealizedPnL: { $subtract: ['$totalValue', '$totalInvested'] },
        totalPnL: { $add: ['$totalRealizedPnL', { $subtract: ['$totalValue', '$totalInvested'] }] },
        positionCount: 1
      }
    }
  ]);
};

// Pre-save middleware
portfolioSchema.pre('save', function(next) {
  if (this.isModified('userAddress')) {
    this.userAddress = this.userAddress.toLowerCase();
  }
  if (this.isModified('agentAddress')) {
    this.agentAddress = this.agentAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('Portfolio', portfolioSchema);
