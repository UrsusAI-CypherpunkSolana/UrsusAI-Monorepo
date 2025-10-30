const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Agent Creator Service
 * Integrates with the agent-creator-services to provide AI agent functionality
 */
class AgentCreatorService {
  constructor() {
    this.agentServiceUrl = process.env.AGENT_SERVICE_URL || 'http://localhost:4000';
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.togetherApiKey = process.env.TOGETHER_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    
    // Initialize Google AI if API key is available
    if (this.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
    }
    
    // Enhanced supported models mapping
    this.supportedModels = {
      // Groq models (Fast inference)
      'llama-3.1-8b-instant': 'llama-3.1-8b-instant',
      'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
      
      // Together AI models (High quality)
      'deepseek-coder-33b-instruct': 'deepseek-ai/deepseek-coder-33b-instruct',
      'deepseek-llm-67b-chat': 'deepseek-ai/deepseek-llm-67b-chat',
      'mistral-7b-instruct': 'mistralai/Mistral-7B-Instruct-v0.1',
      'mistral-8x7b-instruct': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'meta-llama-3-8b': 'meta-llama/Llama-3-8b-chat-hf',
      'meta-llama-3-70b': 'meta-llama/Llama-3-70b-chat-hf',
      'meta-llama-3.1-8b': 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'meta-llama-3.1-70b': 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',

      // Gemini models (Google)
      'gemini-pro': 'gemini-pro',
      'gemini-1.5-flash': 'gemini-1.5-flash',
      'gemini-1.5-pro': 'gemini-1.5-pro',
      'gemini-1.5-flash-latest': 'gemini-1.5-flash-latest',

      // Local Ollama models (if available)
      'ollama-llama3': 'ollama-llama3',
      'ollama-llama3.1': 'ollama-llama3.1',
      'ollama-mistral': 'ollama-mistral',
      'ollama-codellama': 'ollama-codellama',
      'ollama-phi3': 'ollama-phi3',
      'ollama-qwen2': 'ollama-qwen2'
    };
    
    console.log('🤖 Agent Creator Service initialized');
  }

  /**
   * Get list of available AI models
   */
  getAvailableModels() {
    return Object.keys(this.supportedModels).map(key => ({
      id: key,
      name: this.formatModelName(key),
      provider: this.getModelProvider(key),
      description: this.getModelDescription(key)
    }));
  }

  /**
   * Format model name for display
   */
  formatModelName(modelId) {
    const nameMap = {
      'llama3-8b-8192': 'Llama 3 8B',
      'llama3-70b-8192': 'Llama 3 70B',
      'mixtral-8x7b-32768': 'Mixtral 8x7B',
      'deepseek-coder-33b-instruct': 'DeepSeek Coder 33B',
      'mistral-7b-instruct': 'Mistral 7B Instruct',
      'meta-llama-3-8b': 'Meta Llama 3 8B',
      'meta-llama-3-70b': 'Meta Llama 3 70B',
      'gemini-pro': 'Gemini Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'ollama-llama3': 'Ollama Llama 3',
      'ollama-mistral': 'Ollama Mistral',
      'ollama-codellama': 'Ollama Code Llama'
    };
    return nameMap[modelId] || modelId;
  }

  /**
   * Get model provider
   */
  getModelProvider(modelId) {
    if (modelId.startsWith('llama3') || modelId.startsWith('mixtral')) {
      return 'Groq';
    } else if (modelId.startsWith('deepseek') || modelId.startsWith('mistral') || modelId.startsWith('meta-llama')) {
      return 'Together AI';
    } else if (modelId.startsWith('gemini')) {
      return 'Google';
    } else if (modelId.startsWith('ollama')) {
      return 'Ollama';
    }
    return 'Unknown';
  }

  /**
   * Get enhanced model description
   */
  getModelDescription(modelId) {
    const descriptions = {
      // Groq models
      'llama3-8b-8192': 'Fast and efficient for general tasks (Groq)',
      'llama3-70b-8192': 'Most capable Llama model for complex reasoning (Groq)',
      'mixtral-8x7b-32768': 'Mixture of experts model with large context (Groq)',
      'llama-3.1-8b-instant': 'Latest Llama 3.1 with instant responses (Groq)',
      'llama-3.1-70b-versatile': 'Versatile Llama 3.1 for complex tasks (Groq)',

      // Together AI models
      'deepseek-coder-33b-instruct': 'Specialized for coding and technical tasks (Together)',
      'deepseek-llm-67b-chat': 'Large DeepSeek model for advanced reasoning (Together)',
      'mistral-7b-instruct': 'Balanced model for instruction following (Together)',
      'mistral-8x7b-instruct': 'Advanced Mixtral model (Together)',
      'meta-llama-3-8b': 'Meta\'s Llama 3 model (8B) (Together)',
      'meta-llama-3-70b': 'Meta\'s Llama 3 model (70B) (Together)',
      'meta-llama-3.1-8b': 'Latest Llama 3.1 Turbo (8B) (Together)',
      'meta-llama-3.1-70b': 'Latest Llama 3.1 Turbo (70B) (Together)',

      // Gemini models
      'gemini-pro': 'Google\'s multimodal AI model (Gemini)',
      'gemini-1.5-flash': 'Fast and efficient Gemini variant (Google)',
      'gemini-1.5-pro': 'Most capable Gemini model (Google)',
      'gemini-1.5-flash-latest': 'Latest Gemini Flash model (Google)',

      // Ollama models
      'ollama-llama3': 'Local Llama 3 via Ollama',
      'ollama-llama3.1': 'Local Llama 3.1 via Ollama',
      'ollama-mistral': 'Local Mistral via Ollama',
      'ollama-codellama': 'Local Code Llama via Ollama',
      'ollama-phi3': 'Local Phi-3 via Ollama',
      'ollama-qwen2': 'Local Qwen2 via Ollama'
    };
    return descriptions[modelId] || 'AI language model';
  }

  /**
   * Chat with an AI agent using specified model and instructions
   */
  async chatWithAgent(agentAddress, message, userAddress = null) {
    try {
      // Get agent details from database
      const Agent = require('../models/Agent');
      const mongoose = require('mongoose');

      // Build query - only include _id if it's a valid ObjectId
      const query = {
        $or: [
          { contractAddress: agentAddress },
          { mintAddress: agentAddress }
        ]
      };

      // Only add _id query if agentAddress is a valid MongoDB ObjectId (24 hex chars)
      if (mongoose.Types.ObjectId.isValid(agentAddress) && agentAddress.length === 24) {
        query.$or.push({ _id: agentAddress });
      }

      let agent = await Agent.findOne(query);

      // If agent not found, use a default AI assistant configuration
      if (!agent) {
        console.warn(`⚠️ Agent not found for address: ${agentAddress}, using default AI assistant`);
        agent = {
          name: 'AI Assistant',
          symbol: 'AI',
          description: 'A helpful AI assistant',
          category: 'General',
          model: 'gemini-1.5-flash',
          instructions: 'You are a helpful AI assistant. Provide clear, accurate, and friendly responses to user questions.'
        };
      }

      // Prepare the session data
      const session = {
        model: this.supportedModels[agent.model] || agent.model,
        instruction: agent.instructions || this.getDefaultInstructions(agent),
        input: message
      };

      console.log(`🤖 Chatting with agent ${agent.name} using model ${session.model}`);

      // Try to use external agent service first
      try {
        const response = await this.callExternalAgentService(session);
        
        // Save chat message to database
        await this.saveChatMessage(agentAddress, message, response, userAddress);
        
        return {
          success: true,
          response: response,
          model: agent.model,
          agentName: agent.name
        };
      } catch (externalError) {
        console.warn('External agent service failed, falling back to direct API calls:', externalError.message);
        
        // Fallback to direct API calls
        const response = await this.directModelCall(session);
        
        // Save chat message to database
        await this.saveChatMessage(agentAddress, message, response, userAddress);
        
        return {
          success: true,
          response: response,
          model: agent.model,
          agentName: agent.name,
          fallback: true
        };
      }
    } catch (error) {
      console.error('Error in chatWithAgent:', error);
      throw error;
    }
  }

  /**
   * Call external agent service
   */
  async callExternalAgentService(session) {
    try {
      const response = await axios.post(`${this.agentServiceUrl}/api/ask`, session, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.output) {
        return response.data.output;
      } else {
        throw new Error('Invalid response from agent service');
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Agent service is not available');
      }
      throw error;
    }
  }

  /**
   * Enhanced direct model API call with agent-creator-services integration
   */
  async directModelCall(session) {
    const { model, instruction, input } = session;

    try {
      // Try enhanced agent creator service first
      const enhancedResponse = await this.callEnhancedAgentService(session);
      if (enhancedResponse) {
        return enhancedResponse;
      }
    } catch (error) {
      console.warn('Enhanced agent service failed, falling back to direct APIs:', error.message);
    }

    // Fallback to direct API calls
    // Use free Hugging Face API for all models (no API key required!)
    console.log('🆓 Using free Hugging Face API for chat');
    return await this.callFreeAPI(instruction, input);
  }

  /**
   * Enhanced agent service call using agent-creator-services logic
   */
  async callEnhancedAgentService(session) {
    const { model, instruction, input } = session;

    // Build chat prompt
    const messages = this.buildChatPrompt(instruction, input);

    // Route to appropriate provider based on model
    if (model.startsWith('llama3') || model.startsWith('mixtral')) {
      return await this.enhancedGroqCall(messages, model);
    } else if (model.startsWith('deepseek') || model.startsWith('mistral') || model.startsWith('meta-llama')) {
      return await this.enhancedTogetherCall(messages, model);
    } else if (model.startsWith('models/gemini')) {
      return await this.enhancedGeminiCall(instruction, input, model);
    } else if (model.startsWith('ollama-')) {
      return await this.enhancedOllamaCall(instruction, input, model.replace('ollama-', ''));
    }

    return null;
  }

  /**
   * Build chat prompt for enhanced models
   */
  buildChatPrompt(instruction, input) {
    return [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: input,
      },
    ];
  }

  /**
   * Clean response text
   */
  cleanResponse(text) {
    return text
      .replace(/\n/g, " ")
      .replace(/\*+/g, "")
      .replace(/_+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Enhanced Groq API call
   */
  async enhancedGroqCall(messages, model) {
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

    if (!GROQ_API_KEY) {
      throw new Error("Missing GROQ_API_KEY in environment variables.");
    }

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return this.cleanResponse(content || "No response from model.");
    } catch (error) {
      console.error('[ENHANCED GROQ ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Enhanced Together AI call
   */
  async enhancedTogetherCall(messages, model) {
    const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;
    const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";

    if (!TOGETHER_API_KEY) {
      throw new Error("Missing TOGETHER_API_KEY in environment variables.");
    }

    try {
      const response = await fetch(TOGETHER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOGETHER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        throw new Error(`Together API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      return this.cleanResponse(content || "No response from model.");
    } catch (error) {
      console.error('[ENHANCED TOGETHER ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Enhanced Gemini API call
   */
  async enhancedGeminiCall(instruction, input, model) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY in environment variables.");
    }

    const prompt = `${instruction}\n\nUser: ${input}\n\nAssistant:`;
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${GEMINI_API_KEY}`;

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return this.cleanResponse(content || "No response from model.");
    } catch (error) {
      console.error('[ENHANCED GEMINI ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Enhanced Ollama API call
   */
  async enhancedOllamaCall(instruction, input, model) {
    const OLLAMA_API_URL = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const prompt = `${instruction}\n\n${input}`;

    try {
      const response = await fetch(`${OLLAMA_API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 1024,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return this.cleanResponse(data.response || "No response from model.");
    } catch (error) {
      console.error('[ENHANCED OLLAMA ERROR]', error.message);
      throw error;
    }
  }

  /**
   * Call Groq API directly
   */
  async callGroqAPI(instruction, input, model) {
    if (!this.groqApiKey) {
      throw new Error('Groq API key not configured');
    }

    const messages = [
      { role: "system", content: instruction },
      { role: "user", content: input }
    ];

    try {
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }, {
        headers: {
          'Authorization': `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const content = response.data?.choices?.[0]?.message?.content;
      return content || "No response from model.";
    } catch (error) {
      console.error('Groq API Error:', error?.response?.data || error.message);
      throw new Error('Error contacting Groq API');
    }
  }

  /**
   * Call Together AI API directly
   */
  async callTogetherAPI(instruction, input, model) {
    if (!this.togetherApiKey) {
      throw new Error('Together AI API key not configured');
    }

    const messages = [
      { role: "system", content: instruction },
      { role: "user", content: input }
    ];

    try {
      const response = await axios.post('https://api.together.xyz/v1/chat/completions', {
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }, {
        headers: {
          'Authorization': `Bearer ${this.togetherApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const content = response.data?.choices?.[0]?.message?.content;
      return content || "No response from model.";
    } catch (error) {
      console.error('Together AI API Error:', error?.response?.data || error.message);
      throw new Error('Error contacting Together AI API');
    }
  }

  /**
   * Simple fallback chat response (no external API needed)
   */
  async callFreeAPI(instruction, input) {
    try {
      // Parse agent info from instruction
      const agentName = instruction.match(/You are ([^,]+)/)?.[1] || 'AI Agent';
      const agentSymbol = instruction.match(/Symbol: ([^\n]+)/)?.[1] || 'TOKEN';
      const agentDescription = instruction.match(/Description: ([^\n]+)/)?.[1] || 'an AI agent';

      // Generate contextual responses based on input
      const lowerInput = input.toLowerCase();

      let response = '';

      if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
        response = `Hello! I'm ${agentName} (${agentSymbol}), ${agentDescription}. How can I help you today?`;
      } else if (lowerInput.includes('who are you') || lowerInput.includes('what are you')) {
        response = `I'm ${agentName}, ${agentDescription}. My token symbol is ${agentSymbol}. I'm here to assist you with any questions you might have!`;
      } else if (lowerInput.includes('price') || lowerInput.includes('token')) {
        response = `I'm ${agentName} (${agentSymbol}). For current token price and trading information, please check the trading interface. I'm here to answer your questions about the project!`;
      } else if (lowerInput.includes('buy') || lowerInput.includes('sell') || lowerInput.includes('trade')) {
        response = `To trade ${agentSymbol} tokens, use the trading interface on this page. I can help answer questions about the project, but I cannot execute trades directly.`;
      } else if (lowerInput.includes('help')) {
        response = `I'm ${agentName}, and I'm here to help! You can ask me about the project, tokenomics, or any general questions. For trading, please use the trading interface.`;
      } else {
        response = `Thanks for your message! I'm ${agentName} (${agentSymbol}), ${agentDescription}. I'm here to assist you. Feel free to ask me anything about the project!`;
      }

      return response;
    } catch (error) {
      console.error('Free API Error:', error);
      // Fallback response
      return "Hello! I'm an AI agent here to help you. How can I assist you today?";
    }
  }

  /**
   * Call Gemini API directly
   */
  async callGeminiAPI(instruction, input, model) {
    if (!this.genAI) {
      throw new Error('Gemini API key not configured');
    }

    try {
      const fullPrompt = `${instruction}\n\nUser: ${input}`;
      const geminiModel = this.genAI.getGenerativeModel({ model });

      const result = await geminiModel.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return text;
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Error contacting Gemini API');
    }
  }

  /**
   * Get default instructions for an agent
   */
  getDefaultInstructions(agent) {
    return `You are ${agent.name}, an AI agent with the following characteristics:
- Name: ${agent.name}
- Symbol: ${agent.symbol}
- Description: ${agent.description}
- Category: ${agent.category}

Please respond in character as this agent. Be helpful, knowledgeable, and maintain the personality described above.`;
  }

  /**
   * Save chat message to database
   */
  async saveChatMessage(agentAddress, message, response, userAddress) {
    try {
      const AgentChat = require('../models/AgentChat');

      const chatMessage = new AgentChat({
        agentAddress,
        userAddress,
        message,
        response,
        timestamp: new Date(),
        sessionId: this.generateSessionId(userAddress, agentAddress)
      });

      await chatMessage.save();
      console.log(`💬 Chat message saved for agent ${agentAddress}`);
    } catch (error) {
      console.error('Error saving chat message:', error);
      // Don't throw error here, just log it
    }
  }

  /**
   * Generate session ID for chat
   */
  generateSessionId(userAddress, agentAddress) {
    const crypto = require('crypto');
    const today = new Date().toISOString().split('T')[0];
    return crypto.createHash('md5').update(`${userAddress}-${agentAddress}-${today}`).digest('hex');
  }

  /**
   * Get chat history for an agent
   */
  async getChatHistory(agentAddress, userAddress = null, limit = 50) {
    try {
      const AgentChat = require('../models/AgentChat');

      const query = { agentAddress };
      if (userAddress) {
        query.userAddress = userAddress;
      }

      const messages = await AgentChat.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }
  }

  /**
   * Test agent service connectivity
   */
  async testAgentService() {
    try {
      const testSession = {
        model: 'llama3-8b-8192',
        instruction: 'You are a helpful assistant.',
        input: 'Hello, this is a test message.'
      };

      const response = await this.callExternalAgentService(testSession);
      return {
        success: true,
        response,
        service: 'external'
      };
    } catch (error) {
      console.warn('External service test failed, testing fallback...');
      
      try {
        const response = await this.directModelCall(testSession);
        return {
          success: true,
          response,
          service: 'fallback'
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: fallbackError.message,
          service: 'none'
        };
      }
    }
  }
}

module.exports = AgentCreatorService;
