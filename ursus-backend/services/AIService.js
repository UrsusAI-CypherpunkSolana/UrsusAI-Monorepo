const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIService {
  constructor() {
    // Initialize only the providers you want
    this.anthropic = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;

    this.googleAI = process.env.GOOGLE_AI_API_KEY
      ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
      : null;
  }

  async validateModel(model) {
    try {
      switch (model) {
        // OpenAI modelleri devre dışı
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          return false;

        case 'claude-3':
        case 'claude-3-sonnet-20240229':
          return !!this.anthropic;

        case 'gemini-pro':
          return !!this.googleAI;

        default:
          return false;
      }
    } catch (error) {
      console.error('Error validating model:', error);
      return false;
    }
  }

  async generateResponse(model, instructions, userMessage, userAddress = null) {
    try {
      const systemPrompt = this.buildSystemPrompt(instructions, userAddress);

      switch (model) {
        // OpenAI modelleri kapalı:
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          throw new Error('OpenAI provider is disabled');

        case 'claude-3':
          case 'claude-3-sonnet-20240229':
            if (!this.anthropic) throw new Error('Anthropic API key missing');
            // geçmişi zaten contextualPrompt'a gömdük; userMessage'ı ayrıca göndermiyoruz
            return await this.generateAnthropicResponse(contextualPrompt, '');
            

        case 'gemini-pro':
          if (!this.googleAI) throw new Error('Google AI API key missing');
          return await this.generateGoogleAIResponse(systemPrompt, userMessage);

        default:
          throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  // Tek bir buildSystemPrompt bırak (dosyanda iki tane vardı, çakışıyordu)
  buildSystemPrompt(instructions, userAddress = null, agentData = null) {
    let systemPrompt = `${instructions}\n\nYou are an AI agent on the Solana blockchain. You should:
- Be helpful and informative
- Stay in character based on your instructions
- Provide accurate information about blockchain and DeFi
- Be engaging and conversational
- If asked about trading or financial advice, remind users to do their own research
- Keep responses concise but informative (max 500 words)
- You can reference your token's performance and metrics when relevant`;

    if (agentData) {
      systemPrompt += `\n\nYour token information:
- Name: ${agentData.name}
- Symbol: ${agentData.symbol}
- Current Price: ${agentData.currentPrice} CORE
- Market Cap: ${agentData.marketCap} CORE
- Holders: ${agentData.holders}
- You can mention these stats when relevant to the conversation`;
    }

    if (userAddress) {
      systemPrompt += `\n\nUser wallet address: ${userAddress}`;
    }

    systemPrompt += `\n\nCurrent timestamp: ${new Date().toISOString()}`;
    return systemPrompt;
  }

  async generateAnthropicResponse(systemPrompt, userMessage) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 500,
        temperature: 0.7,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      });
      return response.content[0].text;
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw new Error('Failed to generate response with Claude');
    }
  }

  async generateGoogleAIResponse(systemPrompt, userMessage) {
    try {
      const model = this.googleAI.getGenerativeModel({ model: 'gemini-pro' });
      const prompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Google AI API error:', error);
      throw new Error('Failed to generate response with Gemini');
    }
  }

  generateAgentPersonality(category, instructions) {
    const personalities = {
      DeFi: "You are a DeFi expert who loves explaining complex financial concepts in simple terms. You're enthusiastic about yield farming, liquidity pools, and decentralized finance innovations.",
      Trading: "You are a seasoned trader with deep market knowledge. You provide insights on market trends, technical analysis, and trading strategies while emphasizing risk management.",
      Analytics: 'You are a data-driven analyst who excels at interpreting blockchain data, market metrics, and providing actionable insights based on quantitative analysis.',
      Gaming: "You are a gaming enthusiast who understands blockchain gaming, NFTs, and play-to-earn mechanics. You're excited about the future of decentralized gaming.",
      Social: 'You are a community-focused agent who helps with social interactions, DAO governance, and building connections in the Web3 space.',
      Utility: 'You are a practical problem-solver who focuses on real-world applications of blockchain technology and helping users accomplish their goals efficiently.',
      Entertainment: 'You are a creative and fun agent who brings joy and entertainment while still being helpful and informative about blockchain topics.',
      Education: 'You are a patient teacher who excels at breaking down complex blockchain concepts into easy-to-understand lessons for learners of all levels.',
      General: 'You are a well-rounded AI assistant with broad knowledge across all aspects of blockchain, DeFi, and the Solana ecosystem.'
    };
    return personalities[category] || personalities.General;
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') throw new Error('Input must be a string');
    const sanitized = input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
    if (!sanitized.length) throw new Error('Input cannot be empty');
    if (sanitized.length > 2000) throw new Error('Input too long (max 2000 characters)');
    return sanitized;
  }

  async checkRateLimit() { return true; }

  getModelInfo(model) {
    const modelInfo = {
      'claude-3': {
        name: 'Claude 3 Sonnet',
        provider: 'Anthropic',
        maxTokens: 4096,
        costPer1kTokens: 0.015,
        responseTime: 'Medium'
      },
      'gemini-pro': {
        name: 'Gemini Pro',
        provider: 'Google',
        maxTokens: 2048,
        costPer1kTokens: 0.001,
        responseTime: 'Fast'
      }
    };
    return modelInfo[model] || null;
  }

  async generateContextualResponse(model, instructions, userMessage, conversationHistory = [], agentData = null, userAddress = null) {
    try {
      const systemPrompt = this.buildSystemPrompt(instructions, userAddress, agentData);
      let contextualPrompt = systemPrompt;

      if (conversationHistory.length > 0) {
        contextualPrompt += '\n\nConversation history (last 5 messages):';
        conversationHistory.slice(-5).forEach(msg => {
          contextualPrompt += `\n${msg.role}: ${msg.content}`;
        });
      }

      contextualPrompt += `\n\nUser: ${userMessage}\n\nAssistant:`;

      switch (model) {
        case 'claude-3':
        case 'claude-3-sonnet-20240229':
          if (!this.anthropic) throw new Error('Anthropic API key missing');
          return await this.generateAnthropicResponse(systemPrompt, userMessage);

        case 'gemini-pro':
          if (!this.googleAI) throw new Error('Google AI API key missing');
          return await this.generateGoogleAIResponse(contextualPrompt, '');

        // OpenAI kapalı:
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          throw new Error('OpenAI provider is disabled');

        default:
          throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      console.error('Error generating contextual response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  cleanupRateLimit() {
    if (!this.rateLimitCache) return;
    const now = Date.now();
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (now > value.resetTime) this.rateLimitCache.delete(key);
    }
  }
}

module.exports = new AIService();
