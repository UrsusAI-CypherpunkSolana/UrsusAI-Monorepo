const mongoose = require('mongoose');

/**
 * Agent Chat Message Schema
 * Simplified schema for agent-creator-services integration
 */
const agentChatSchema = new mongoose.Schema({
  // Agent identification
  agentAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },

  // User identification (optional for anonymous chats)
  userAddress: {
    type: String,
    lowercase: true,
    index: true
  },

  // Session management
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // Message content
  message: {
    type: String,
    required: true,
    maxlength: 10000
  },

  // Agent response
  response: {
    type: String,
    required: true,
    maxlength: 50000
  },

  // Metadata
  model: {
    type: String,
    default: 'llama3-8b-8192'
  },

  provider: {
    type: String,
    enum: ['groq', 'together', 'gemini', 'ollama', 'fallback'],
    default: 'groq'
  },

  responseTime: {
    type: Number, // milliseconds
    default: 0
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true,
  collection: 'agent_chats'
});

// Indexes for performance
agentChatSchema.index({ agentAddress: 1, timestamp: -1 });
agentChatSchema.index({ userAddress: 1, timestamp: -1 });
agentChatSchema.index({ sessionId: 1, timestamp: 1 });

// Virtual for formatted timestamp
agentChatSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Method to get conversation context
agentChatSchema.statics.getConversationContext = async function(agentAddress, userAddress, limit = 5) {
  const query = { agentAddress };
  if (userAddress) {
    query.userAddress = userAddress;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('message response timestamp')
    .lean();
};

// Method to get agent statistics
agentChatSchema.statics.getAgentStats = async function(agentAddress) {
  const stats = await this.aggregate([
    { $match: { agentAddress } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userAddress' },
        avgResponseTime: { $avg: '$responseTime' },
        lastActivity: { $max: '$timestamp' }
      }
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        uniqueUsers: { $size: '$uniqueUsers' },
        avgResponseTime: { $round: ['$avgResponseTime', 2] },
        lastActivity: 1
      }
    }
  ]);

  return stats[0] || {
    totalMessages: 0,
    uniqueUsers: 0,
    avgResponseTime: 0,
    lastActivity: null
  };
};

// Method to clean old messages (for maintenance)
agentChatSchema.statics.cleanOldMessages = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });

  return result.deletedCount;
};

module.exports = mongoose.model('AgentChat', agentChatSchema);
