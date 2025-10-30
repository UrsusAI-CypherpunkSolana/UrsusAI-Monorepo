const mongoose = require('mongoose');

const socialActivitySchema = new mongoose.Schema({
  // Activity type
  type: {
    type: String,
    required: true,
    enum: [
      'comment',
      'like',
      'dislike',
      'follow',
      'unfollow',
      'token_purchase',
      'token_sale',
      'agent_created',
      'agent_liked',
      'holder_milestone'
    ],
    index: true
  },
  
  // User who performed the activity
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Target of the activity
  targetType: {
    type: String,
    required: true,
    enum: ['agent', 'comment', 'user'],
    index: true
  },
  
  targetId: {
    type: String,
    required: true,
    index: true
  },
  
  // Activity data
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // For feed generation
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Engagement metrics
  views: {
    type: Number,
    default: 0
  },
  
  interactions: {
    type: Number,
    default: 0
  }
});

// Compound indexes for efficient queries
socialActivitySchema.index({ userAddress: 1, createdAt: -1 });
socialActivitySchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
socialActivitySchema.index({ type: 1, createdAt: -1 });
socialActivitySchema.index({ isPublic: 1, createdAt: -1 });

// TTL index to automatically delete old activities (30 days)
socialActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SocialActivity', socialActivitySchema);
