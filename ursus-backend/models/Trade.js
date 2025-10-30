const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  agentAddress: {
    type: String,
    required: true,
    lowercase: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true
  },
  blockNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  trader: {
    type: String,
    required: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['buy', 'sell'],
    required: true
  },
  coreAmount: {
    type: String,
    required: true
  },
  tokenAmount: {
    type: String,
    required: true
  },
  price: {
    type: String,
    required: true
  },
  priceUsd: {
    type: String,
    default: 0
  },
  gasUsed: {
    type: Number,
    default: 0
  },
  gasPrice: {
    type: String,
    default: '0'
  },
  marketCapAfter: {
    type: Number,
    default: 0
  },
  totalSupply: {
    type: String,
    default: '0'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
tradeSchema.index({ agentAddress: 1, timestamp: -1 });
tradeSchema.index({ agentAddress: 1, type: 1, timestamp: -1 });
tradeSchema.index({ trader: 1, timestamp: -1 });

module.exports = mongoose.model('Trade', tradeSchema);
