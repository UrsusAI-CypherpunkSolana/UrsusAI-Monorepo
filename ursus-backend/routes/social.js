const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const SocialActivity = require('../models/SocialActivity');
const User = require('../models/User');
const Agent = require('../models/Agent');
const Portfolio = require('../models/Portfolio');
const router = express.Router();

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }
  next();
};

// POST /api/social/comments - Add comment to agent
router.post('/comments',
  [
    body('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    body('content').isLength({ min: 1, max: 500 }).withMessage('Content must be 1-500 characters'),
    body('userAddress').isEthereumAddress().withMessage('Invalid user address'),
    body('parentComment').optional().isMongoId().withMessage('Invalid parent comment ID')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress, content, userAddress, parentComment } = req.body;

      // Check if agent exists
      const agent = await Agent.findOne({ 
        contractAddress: agentAddress.toLowerCase() 
      });
      
      if (!agent) {
        return res.status(404).json({ 
          success: false, 
          error: 'Agent not found' 
        });
      }

      // Get user info for comment metadata
      const user = await User.findOne({ 
        walletAddress: userAddress.toLowerCase() 
      });
      
      // Check if user holds tokens
      const portfolio = await Portfolio.findOne({
        userAddress: userAddress.toLowerCase(),
        agentAddress: agentAddress.toLowerCase(),
        isActive: true
      });
      
      const isHolder = portfolio && parseFloat(portfolio.balance) > 0;
      const isCreator = agent.creator.toLowerCase() === userAddress.toLowerCase();

      // Create comment
      const comment = new Comment({
        agentAddress: agentAddress.toLowerCase(),
        userAddress: userAddress.toLowerCase(),
        content: content.trim(),
        parentComment: parentComment || null,
        userInfo: {
          isHolder,
          holdingAmount: portfolio?.balance || '0',
          isCreator
        }
      });

      await comment.save();

      // Update parent comment if this is a reply
      if (parentComment) {
        await Comment.findByIdAndUpdate(
          parentComment,
          { $push: { replies: comment._id } }
        );
      }

      // Update user social stats
      if (user) {
        user.socialStats.commentsCount += 1;
        await user.save();
      }

      // Create social activity
      await SocialActivity.create({
        type: 'comment',
        userAddress: userAddress.toLowerCase(),
        targetType: 'agent',
        targetId: agentAddress.toLowerCase(),
        data: {
          commentId: comment._id,
          content: content.substring(0, 100),
          isReply: !!parentComment
        }
      });

      // Populate comment for response
      const populatedComment = await Comment.findById(comment._id)
        .populate('replies', 'content userAddress createdAt likes dislikes userInfo');

      res.json({
        success: true,
        comment: populatedComment
      });

    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add comment' 
      });
    }
  }
);

// GET /api/social/comments/:agentAddress - Get comments for agent
router.get('/comments/:agentAddress',
  [
    param('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('sortBy').optional().isIn(['newest', 'oldest', 'popular']).withMessage('Invalid sort option')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { page = 1, limit = 20, sortBy = 'newest' } = req.query;

      // Build sort criteria
      let sortCriteria = {};
      switch (sortBy) {
        case 'newest':
          sortCriteria = { createdAt: -1 };
          break;
        case 'oldest':
          sortCriteria = { createdAt: 1 };
          break;
        case 'popular':
          sortCriteria = { likes: -1, createdAt: -1 };
          break;
      }

      // Get top-level comments (not replies)
      const comments = await Comment.find({
        agentAddress: agentAddress.toLowerCase(),
        parentComment: null,
        isHidden: false
      })
      .sort(sortCriteria)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('replies', 'content userAddress createdAt likes dislikes userInfo')
      .lean();

      // Get total count
      const total = await Comment.countDocuments({
        agentAddress: agentAddress.toLowerCase(),
        parentComment: null,
        isHidden: false
      });

      res.json({
        success: true,
        comments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Get comments error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get comments' 
      });
    }
  }
);

// POST /api/social/comments/:commentId/like - Like/unlike comment
router.post('/comments/:commentId/like',
  [
    param('commentId').isMongoId().withMessage('Invalid comment ID'),
    body('userAddress').isEthereumAddress().withMessage('Invalid user address'),
    body('action').isIn(['like', 'unlike']).withMessage('Action must be like or unlike')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { commentId } = req.params;
      const { userAddress, action } = req.body;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Comment not found' 
        });
      }

      const userAddr = userAddress.toLowerCase();
      const hasLiked = comment.likedBy.includes(userAddr);
      const hasDisliked = comment.dislikedBy.includes(userAddr);

      if (action === 'like') {
        if (hasLiked) {
          // Unlike
          comment.likedBy.pull(userAddr);
          comment.likes = Math.max(0, comment.likes - 1);
        } else {
          // Like
          comment.likedBy.push(userAddr);
          comment.likes += 1;
          
          // Remove dislike if exists
          if (hasDisliked) {
            comment.dislikedBy.pull(userAddr);
            comment.dislikes = Math.max(0, comment.dislikes - 1);
          }
        }
      } else if (action === 'unlike') {
        if (hasLiked) {
          comment.likedBy.pull(userAddr);
          comment.likes = Math.max(0, comment.likes - 1);
        }
      }

      await comment.save();

      res.json({
        success: true,
        likes: comment.likes,
        dislikes: comment.dislikes,
        userLiked: comment.likedBy.includes(userAddr),
        userDisliked: comment.dislikedBy.includes(userAddr)
      });

    } catch (error) {
      console.error('Like comment error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update like' 
      });
    }
  }
);

// GET /api/social/leaderboard - Get holder leaderboard for agent
router.get('/leaderboard/:agentAddress',
  [
    param('agentAddress').isEthereumAddress().withMessage('Invalid agent address'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { agentAddress } = req.params;
      const { limit = 20 } = req.query;

      // Get top holders
      const holders = await Portfolio.find({
        agentAddress: agentAddress.toLowerCase(),
        isActive: true,
        balance: { $gt: '0' }
      })
      .sort({ balance: -1 })
      .limit(parseInt(limit))
      .populate('user', 'username profileExtended.displayName socialStats')
      .lean();

      // Calculate holder stats
      const holderStats = holders.map((holder, index) => ({
        rank: index + 1,
        userAddress: holder.userAddress,
        username: holder.user?.username || `${holder.userAddress.substring(0, 6)}...${holder.userAddress.substring(-4)}`,
        displayName: holder.user?.profileExtended?.displayName,
        balance: holder.balance,
        currentValue: holder.currentValue,
        totalInvested: holder.totalInvested,
        pnl: (parseFloat(holder.currentValue) - parseFloat(holder.totalInvested)).toFixed(6),
        pnlPercentage: holder.totalInvested > 0 
          ? (((parseFloat(holder.currentValue) - parseFloat(holder.totalInvested)) / parseFloat(holder.totalInvested)) * 100).toFixed(2)
          : '0.00',
        reputation: holder.user?.socialStats?.reputation || 0
      }));

      res.json({
        success: true,
        leaderboard: holderStats,
        agentAddress
      });

    } catch (error) {
      console.error('Get leaderboard error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get leaderboard' 
      });
    }
  }
);

module.exports = router;
