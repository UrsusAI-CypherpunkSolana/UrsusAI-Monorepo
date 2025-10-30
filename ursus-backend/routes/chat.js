const express = require('express');
const { ethers } = require('ethers');
const Joi = require('joi');
const AIService = require('../services/AIService');
const AgentCreatorService = require('../services/AgentCreatorService');
const BlockchainService = require('../services/BlockchainService');
const UCPService = require('../services/UCPService');
const Agent = require('../models/Agent');
const ChatMessage = require('../models/ChatMessage');
const router = express.Router();

// Initialize services
const aiService = AIService;
const agentCreatorService = new AgentCreatorService();
const ucpService = new UCPService();

// Validation schema for chat messages
const chatMessageSchema = Joi.object({
  agentAddress: Joi.string().min(32).max(44).required(), // Solana addresses are base58 encoded, 32-44 chars
  message: Joi.string().min(1).max(2000).required(),
  userAddress: Joi.string().min(32).max(44).optional(), // Solana addresses
  sessionId: Joi.string().uuid().optional()
});

// POST /api/chat - Send message to agent
router.post('/', async (req, res) => {
  try {
    const { error, value } = chatMessageSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.details.map(d => d.message) 
      });
    }

    const { agentAddress, message, userAddress, sessionId } = value;

    // Sanitize user input
    const sanitizedMessage = message.trim();

    // Check rate limiting
    if (userAddress) {
      const canProceed = await AIService.checkRateLimit(userAddress, 'chat');
      if (!canProceed) {
        return res.status(429).json({
          error: 'Rate limit exceeded. Please wait before sending another message.'
        });
      }
    }

    console.log(`💬 Chat request for agent ${agentAddress} from user ${userAddress || 'anonymous'}`);

    // Use AgentCreatorService to handle the chat
    const startTime = Date.now();
    const chatResult = await agentCreatorService.chatWithAgent(
      agentAddress,
      sanitizedMessage,
      userAddress
    );
    const responseTime = Date.now() - startTime;

    // Prepare response
    const response = {
      success: chatResult.success,
      response: chatResult.response,
      agent: {
        address: agentAddress,
        name: chatResult.agentName,
        model: chatResult.model,
        fallback: chatResult.fallback || false
      },
      metadata: {
        responseTime,
        timestamp: new Date().toISOString(),
        messageLength: sanitizedMessage.length,
        responseLength: chatResult.response.length,
        model: chatResult.model,
        fallback: chatResult.fallback || false
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// GET /api/chat/agents/:address/info - Get agent chat info
router.get('/agents/:address/info', async (req, res) => {
  try {
    const { address } = req.params;

    // Validate Solana address (32-44 alphanumeric characters)
    if (!address || address.length < 32 || address.length > 44) {
      return res.status(400).json({ error: 'Invalid agent address' });
    }

    const agent = await BlockchainService.getAgentDetails(address);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const modelInfo = AIService.getModelInfo(agent.agentInfo.model);
    
    const chatInfo = {
      agent: {
        address,
        name: agent.tokenName,
        symbol: agent.tokenSymbol,
        description: agent.agentInfo.description,
        category: agent.metadata.category,
        isActive: agent.metadata.isActive
      },
      model: modelInfo,
      capabilities: {
        maxMessageLength: 2000,
        supportedLanguages: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
        features: ['text-generation', 'conversation', 'analysis']
      },
      pricing: {
        currentPrice: agent.currentPrice,
        marketCap: agent.bondingCurveInfo.marketCap
      }
    };

    res.json(chatInfo);
  } catch (error) {
    console.error('Error fetching agent chat info:', error);
    res.status(500).json({ error: 'Failed to fetch agent chat information' });
  }
});

// POST /api/chat/batch - Send messages to multiple agents
router.post('/batch', async (req, res) => {
  try {
    const { messages, userAddress } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (messages.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 messages per batch' });
    }

    // Validate each message
    const validationErrors = [];
    for (let i = 0; i < messages.length; i++) {
      const { error } = chatMessageSchema.validate(messages[i]);
      if (error) {
        validationErrors.push(`Message ${i + 1}: ${error.details[0].message}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Process messages in parallel
    const responses = await Promise.allSettled(
      messages.map(async (msg, index) => {
        try {
          const agent = await BlockchainService.getAgentDetails(msg.agentAddress);
          if (!agent || !agent.metadata.isActive) {
            throw new Error('Agent not found or inactive');
          }

          const sanitizedMessage = AIService.sanitizeInput(msg.message);
          const aiResponse = await AIService.generateResponse(
            agent.agentInfo.model,
            agent.agentInfo.instructions,
            sanitizedMessage,
            userAddress
          );

          return {
            index,
            success: true,
            agentAddress: msg.agentAddress,
            response: aiResponse,
            agent: {
              name: agent.tokenName,
              model: agent.agentInfo.model
            }
          };
        } catch (error) {
          return {
            index,
            success: false,
            agentAddress: msg.agentAddress,
            error: error.message
          };
        }
      })
    );

    const results = responses.map(result => result.value || result.reason);

    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in batch chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process batch chat messages' });
  }
});

// GET /api/chat/models - Get available AI models
router.get('/models', async (req, res) => {
  try {
    const models = agentCreatorService.getAvailableModels();

    return res.json({
      models: models,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return res.status(500).json({ error: 'Failed to fetch available models' });
  }
});

// GET /api/chat/history/:agentAddress - Get chat history for an agent
router.get('/history/:agentAddress', async (req, res) => {
  try {
    const { agentAddress } = req.params;
    const { userAddress, limit = 50, offset = 0 } = req.query;

    // Validate agent address (Solana address: 32-44 alphanumeric characters)
    if (!agentAddress || agentAddress.length < 32 || agentAddress.length > 44) {
      return res.status(400).json({ error: 'Invalid agent address' });
    }

    // Build query (case-insensitive for Solana addresses)
    const query = {
      agentAddress: { $regex: new RegExp(`^${agentAddress}$`, 'i') }
    };

    // Add user filter if provided
    if (userAddress) {
      if (!userAddress || userAddress.length < 32 || userAddress.length > 44) {
        return res.status(400).json({ error: 'Invalid user address' });
      }
      query.userAddress = { $regex: new RegExp(`^${userAddress}$`, 'i') };
    }

    // Use AgentCreatorService to get chat history
    const messages = await agentCreatorService.getChatHistory(
      agentAddress,
      userAddress,
      parseInt(limit)
    );

    // Format messages for frontend
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      message: msg.message,
      response: msg.response,
      timestamp: msg.timestamp,
      userAddress: msg.userAddress,
      sessionId: msg.sessionId
    }));

    res.json({
      success: true,
      messages: formattedMessages,
      total: formattedMessages.length
    });

  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// GET /api/chat/test - Test agent service connectivity
router.get('/test', async (req, res) => {
  try {
    const testResult = await agentCreatorService.testAgentService();

    return res.json({
      success: true,
      service: testResult.service,
      response: testResult.response,
      error: testResult.error || null
    });
  } catch (error) {
    console.error('Error testing agent service:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test agent service',
      details: error.message
    });
  }
});

module.exports = router;
