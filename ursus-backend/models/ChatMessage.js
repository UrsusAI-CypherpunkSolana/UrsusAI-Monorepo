const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  // Message identification
  messageId: {
    type: String,
    unique: true,
    default: () => require('uuid').v4()
  },
  
  // Participants
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

  // Session management
  sessionId: {
    type: String,
    required: true
  },
  
  // Message content
  type: {
    type: String,
    enum: ['user', 'agent', 'system'],
    required: true
  },
  
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  
  // AI Response metadata
  aiMetadata: {
    model: String,
    promptTokens: Number,
    completionTokens: Number,
    totalTokens: Number,
    responseTime: Number, // milliseconds
    temperature: Number,
    maxTokens: Number
  },
  
  // Message status
  status: {
    type: String,
    enum: ['pending', 'delivered', 'read', 'failed'],
    default: 'delivered'
  },
  
  // Content moderation
  moderation: {
    flagged: { type: Boolean, default: false },
    categories: [String],
    confidence: Number,
    action: {
      type: String,
      enum: ['none', 'warn', 'filter', 'block'],
      default: 'none'
    }
  },
  
  // User feedback
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    helpful: Boolean,
    reportReason: String,
    reportedAt: Date
  },
  
  // Context and threading
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage'
  },
  
  threadId: String,
  
  // Analytics
  analytics: {
    readAt: Date,
    responseTime: Number,
    userEngagement: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  },
  
  // Blockchain integration
  onChain: {
    recorded: { type: Boolean, default: false },
    transactionHash: String,
    blockNumber: Number,
    gasUsed: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
chatMessageSchema.index({ user: 1, createdAt: -1 });
chatMessageSchema.index({ agent: 1, createdAt: -1 });
chatMessageSchema.index({ sessionId: 1, createdAt: 1 });
chatMessageSchema.index({ userAddress: 1, agentAddress: 1, createdAt: -1 });
chatMessageSchema.index({ type: 1, createdAt: -1 });
chatMessageSchema.index({ 'moderation.flagged': 1 });

// Compound indexes
chatMessageSchema.index({ agent: 1, type: 1, createdAt: -1 });
chatMessageSchema.index({ user: 1, agent: 1, createdAt: -1 });

// Virtual for replies
chatMessageSchema.virtual('replies', {
  ref: 'ChatMessage',
  localField: '_id',
  foreignField: 'parentMessage'
});

// Methods
chatMessageSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.analytics.readAt = new Date();
  return this.save();
};

chatMessageSchema.methods.addFeedback = function(rating, helpful, reportReason) {
  this.feedback = {
    rating,
    helpful,
    reportReason,
    reportedAt: reportReason ? new Date() : undefined
  };
  return this.save();
};

chatMessageSchema.methods.flagForModeration = function(categories, confidence, action = 'warn') {
  this.moderation = {
    flagged: true,
    categories,
    confidence,
    action
  };
  return this.save();
};

// Static methods
chatMessageSchema.statics.getSessionMessages = function(sessionId, limit = 50) {
  return this.find({ sessionId })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('user', 'username walletAddress avatar')
    .populate('agent', 'name symbol avatar');
};

chatMessageSchema.statics.getUserChatHistory = function(userAddress, limit = 100) {
  return this.find({ userAddress: userAddress.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('agent', 'name symbol avatar contractAddress');
};

chatMessageSchema.statics.getAgentChatHistory = function(agentAddress, limit = 100) {
  return this.find({ agentAddress: agentAddress.toLowerCase() })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'username walletAddress avatar');
};

chatMessageSchema.statics.getRecentChats = function(limit = 20) {
  return this.aggregate([
    {
      $match: { type: 'user' }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: {
          user: '$user',
          agent: '$agent'
        },
        lastMessage: { $first: '$$ROOT' },
        messageCount: { $sum: 1 }
      }
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id.user',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $lookup: {
        from: 'agents',
        localField: '_id.agent',
        foreignField: '_id',
        as: 'agent'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $unwind: '$agent'
    }
  ]);
};

chatMessageSchema.statics.getChatStats = function(agentAddress, timeframe = '24h') {
  const now = new Date();
  let startDate;
  
  switch (timeframe) {
    case '1h':
      startDate = new Date(now - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now - 24 * 60 * 60 * 1000);
  }
  
  return this.aggregate([
    {
      $match: {
        agentAddress: agentAddress.toLowerCase(),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userAddress' },
        avgResponseTime: { $avg: '$aiMetadata.responseTime' },
        totalTokens: { $sum: '$aiMetadata.totalTokens' }
      }
    },
    {
      $project: {
        totalMessages: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        avgResponseTime: 1,
        totalTokens: 1
      }
    }
  ]);
};

// Pre-save middleware
chatMessageSchema.pre('save', function(next) {
  if (this.isModified('userAddress')) {
    this.userAddress = this.userAddress.toLowerCase();
  }
  if (this.isModified('agentAddress')) {
    this.agentAddress = this.agentAddress.toLowerCase();
  }
  next();
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
