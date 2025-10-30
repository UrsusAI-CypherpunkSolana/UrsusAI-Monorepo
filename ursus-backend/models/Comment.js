const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Reference to agent
  agentAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // User who made the comment
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Comment content
  content: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  
  // Social interactions
  likes: {
    type: Number,
    default: 0
  },
  
  dislikes: {
    type: Number,
    default: 0
  },
  
  // Users who liked/disliked
  likedBy: [{
    type: String,
    lowercase: true
  }],
  
  dislikedBy: [{
    type: String,
    lowercase: true
  }],
  
  // Reply system
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  
  // Moderation
  isHidden: {
    type: Boolean,
    default: false
  },
  
  moderationReason: {
    type: String,
    default: null
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // User info at time of comment (for display)
  userInfo: {
    isHolder: { type: Boolean, default: false },
    holdingAmount: { type: String, default: '0' },
    isCreator: { type: Boolean, default: false }
  }
});

// Indexes for performance
commentSchema.index({ agentAddress: 1, createdAt: -1 });
commentSchema.index({ userAddress: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });

// Update timestamp on save
commentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for reply count
commentSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Virtual for net score
commentSchema.virtual('score').get(function() {
  return this.likes - this.dislikes;
});

module.exports = mongoose.model('Comment', commentSchema);
