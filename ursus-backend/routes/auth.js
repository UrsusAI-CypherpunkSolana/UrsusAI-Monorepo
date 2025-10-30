const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
const User = require('../models/User');
const router = express.Router();

// Rate limiting for auth endpoints
const authRateLimit = AuthService.createRateLimiter(15 * 60 * 1000, 10); // 10 requests per 15 minutes

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// GET /api/auth/nonce - Get nonce for wallet authentication
router.get('/nonce/:walletAddress', 
  authRateLimit,
  async (req, res) => {
    try {
      const { walletAddress } = req.params;
      
      if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      const result = await AuthService.getNonce(walletAddress);
      
      if (result.success) {
        res.json({
          nonce: result.nonce,
          message: result.message
        });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Get nonce error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/wallet - Authenticate with wallet signature
router.post('/wallet',
  authRateLimit,
  [
    body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    body('signature').isLength({ min: 1 }).withMessage('Signature is required'),
    body('nonce').isLength({ min: 1 }).withMessage('Nonce is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { walletAddress, signature, nonce } = req.body;

      const result = await AuthService.authenticateWallet(walletAddress, signature, nonce);
      
      if (result.success) {
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        res.status(401).json({ 
          success: false,
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Wallet auth error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/email - Authenticate with email/password
router.post('/email',
  authRateLimit,
  [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      const result = await AuthService.authenticateEmail(email, password);
      
      if (result.success) {
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        res.status(401).json({ 
          success: false,
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Email auth error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/refresh - Refresh JWT token
router.post('/refresh',
  authRateLimit,
  [
    body('token').isLength({ min: 1 }).withMessage('Token is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { token } = req.body;

      const result = await AuthService.refreshToken(token);
      
      if (result.success) {
        res.json({
          success: true,
          token: result.token,
          user: result.user
        });
      } else {
        res.status(401).json({ 
          success: false,
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// POST /api/auth/logout - Logout user
router.post('/logout',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      const result = await AuthService.logout(token);
      
      res.json(result);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/auth/me - Get current user info
router.get('/me',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId)
        .select('-nonce')
        .populate('agentsCreated', 'name symbol contractAddress')
        .populate('favoriteAgents', 'name symbol contractAddress');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          socialLinks: user.socialLinks,
          preferences: user.preferences,
          isVerified: user.isVerified,
          verificationLevel: user.verificationLevel,
          subscription: user.subscription,
          reputation: user.reputation,
          tradingStats: user.tradingStats,
          totalPortfolioValue: user.totalPortfolioValue,
          totalPnL: user.totalPnL,
          agentsCreated: user.agentsCreated,
          favoriteAgents: user.favoriteAgents,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/auth/profile - Update user profile
router.put('/profile',
  AuthService.authenticateToken,
  [
    body('username').optional().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { username, email, bio, avatar, socialLinks, preferences } = req.body;
      
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if username is already taken
      if (username && username !== user.username) {
        const existingUser = await User.findByUsername(username);
        if (existingUser && !existingUser._id.equals(user._id)) {
          return res.status(400).json({ error: 'Username already taken' });
        }
        user.username = username;
      }

      // Check if email is already taken
      if (email && email !== user.email) {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser && !existingUser._id.equals(user._id)) {
          return res.status(400).json({ error: 'Email already taken' });
        }
        user.email = email.toLowerCase();
      }

      // Update other fields
      if (bio !== undefined) user.bio = bio;
      if (avatar !== undefined) user.avatar = avatar;
      if (socialLinks) user.socialLinks = { ...user.socialLinks, ...socialLinks };
      if (preferences) user.preferences = { ...user.preferences, ...preferences };

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          socialLinks: user.socialLinks,
          preferences: user.preferences
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /api/auth/stats - Get user statistics
router.get('/stats',
  AuthService.authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get portfolio summary
      const Portfolio = require('../models/Portfolio');
      const portfolioSummary = await Portfolio.getPortfolioSummary(user.walletAddress);
      
      // Get chat stats
      const ChatMessage = require('../models/ChatMessage');
      const chatStats = await ChatMessage.aggregate([
        { $match: { userAddress: user.walletAddress.toLowerCase() } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            uniqueAgents: { $addToSet: '$agentAddress' }
          }
        },
        {
          $project: {
            totalMessages: 1,
            uniqueAgents: { $size: '$uniqueAgents' }
          }
        }
      ]);

      res.json({
        success: true,
        stats: {
          trading: user.tradingStats,
          portfolio: portfolioSummary[0] || {
            totalValue: 0,
            totalInvested: 0,
            totalPnL: 0,
            positionCount: 0
          },
          chat: chatStats[0] || {
            totalMessages: 0,
            uniqueAgents: 0
          },
          reputation: user.reputation,
          agentsCreated: user.agentsCreated.length,
          favoriteAgents: user.favoriteAgents.length
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
