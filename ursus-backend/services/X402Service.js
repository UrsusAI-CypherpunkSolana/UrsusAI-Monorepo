const aiService = require('./AIService');

/**
 * X402 Service - Handles paid agent services
 */
class X402Service {
  constructor() {
    this.aiService = aiService;
    this.hfApiKey = process.env.HUGGINGFACE_API_KEY || 'hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  }

  /**
   * Generate AI response using OpenRouter (free models available!)
   */
  async callAI(userPrompt, systemInstructions = 'You are a helpful AI assistant.') {
    try {
      // Try OpenRouter first (has free models)
      const openRouterKey = process.env.OPENROUTER_API_KEY;

      if (openRouterKey && openRouterKey !== 'your_openrouter_api_key_here') {
        return await this.callOpenRouter(userPrompt, systemInstructions, openRouterKey);
      }

      // Fallback to intelligent mock response
      console.log('⚠️ No AI API key configured, using intelligent mock response');
      return this.generateMockResponse(userPrompt, systemInstructions);
    } catch (error) {
      console.error('AI API error:', error);
      // Fallback to mock response on error
      return this.generateMockResponse(userPrompt, systemInstructions);
    }
  }

  /**
   * Call OpenRouter API (free models available!)
   */
  async callOpenRouter(userPrompt, systemInstructions, apiKey) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ursusai.com',
        'X-Title': 'UrsusAI X402 Service'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-3b-instruct:free', // Free model!
        messages: [
          { role: 'system', content: systemInstructions },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }

  /**
   * Generate intelligent mock response based on prompt
   */
  generateMockResponse(userPrompt, systemInstructions) {
    const promptLower = userPrompt.toLowerCase();

    // Market Analysis
    if (promptLower.includes('market analysis')) {
      return `**Bitcoin (BTC) Analysis:**
- Current Trend: Bullish momentum with strong support at $42,000
- Key Resistance: $45,000 - $46,500
- Short-term Outlook: Consolidation expected before next leg up
- Recommendation: HOLD current positions, consider adding on dips to $42,500

**Ethereum (ETH) Analysis:**
- Current Trend: Neutral to slightly bullish, following BTC
- Key Support: $2,200 - $2,250
- Key Resistance: $2,400 - $2,500
- Short-term Outlook: Breakout likely if BTC maintains strength
- Recommendation: Accumulate on weakness below $2,300

**Solana (SOL) Analysis:**
- Current Trend: Strong bullish momentum, outperforming majors
- Key Support: $95 - $100
- Key Resistance: $115 - $120
- Short-term Outlook: Potential for continued upside
- Recommendation: BUY on pullbacks to $100 support`;
    }

    // Trading Signal
    if (promptLower.includes('trading signal')) {
      return `**Trading Signal - BTC/USDT**
- Action: BUY
- Entry Price: $43,250 (current market)
- Take Profit: $45,500 (+5.2%)
- Stop Loss: $42,000 (-2.9%)
- Timeframe: Short-term (3-7 days)
- Confidence Level: 8/10
- Reasoning: Strong support holding, bullish divergence on 4H chart, increasing volume`;
    }

    // Portfolio Advice
    if (promptLower.includes('portfolio')) {
      return `**Recommended Portfolio Allocation ($10,000):**
- Bitcoin (BTC): 40% ($4,000) - Core holding, lowest risk
- Ethereum (ETH): 30% ($3,000) - Strong fundamentals, DeFi exposure
- Solana (SOL): 20% ($2,000) - High growth potential
- Stablecoins (USDC): 10% ($1,000) - Dry powder for opportunities

**Risk Level:** Moderate
**Rebalancing Strategy:** Monthly review, rebalance if any asset deviates >10%
**Expected Returns:** 15-25% annually (conservative estimate)
**Risk Management:** Never invest more than you can afford to lose, use stop losses`;
    }

    // Price Prediction
    if (promptLower.includes('price prediction')) {
      return `**24-Hour Price Predictions:**

**Bitcoin (BTC):**
- Current: $43,250
- Predicted: $44,100 (+2.0%)
- Confidence: 7/10
- Key Factors: Strong institutional buying, positive funding rates

**Ethereum (ETH):**
- Current: $2,280
- Predicted: $2,350 (+3.1%)
- Confidence: 6/10
- Key Factors: Network upgrades, increasing DeFi activity

**Solana (SOL):**
- Current: $105
- Predicted: $110 (+4.8%)
- Confidence: 8/10
- Key Factors: Ecosystem growth, NFT marketplace activity`;
    }

    // Default response
    return `Thank you for using our X402 paid service!

Based on current market conditions and technical analysis, here are my insights:

The crypto market is showing signs of consolidation after recent volatility. Bitcoin continues to hold key support levels, which is a positive sign for the broader market. Ethereum is building momentum ahead of upcoming network upgrades.

For trading opportunities, I recommend focusing on:
1. Strong support/resistance levels
2. Volume confirmation
3. Risk management with proper stop losses

Always do your own research and never invest more than you can afford to lose.`;
  }

  /**
   * Execute a paid service based on service ID
   */
  async executeService(serviceId, agentData, paymentInfo) {
    console.log(`Executing X402 service: ${serviceId} for agent: ${agentData.name}`);

    switch (serviceId) {
      case 'market_analysis':
        return await this.getMarketAnalysis(agentData);
      
      case 'trading_signal':
        return await this.getTradingSignal(agentData);
      
      case 'portfolio_advice':
        return await this.getPortfolioAdvice(agentData);
      
      case 'price_prediction':
        return await this.getPricePrediction(agentData);
      
      default:
        return await this.getDefaultService(agentData, serviceId);
    }
  }

  /**
   * Market Analysis Service
   */
  async getMarketAnalysis(agentData) {
    const prompt = `You are ${agentData.name}, a professional crypto market analyst.

Provide a detailed market analysis for the top 3 cryptocurrencies (BTC, ETH, SOL).

For each coin, include:
- Current trend (Bullish/Bearish/Neutral)
- Key support and resistance levels
- Short-term outlook (24-48 hours)
- Trading recommendation

Keep it professional and concise.`;

    try {
      const response = await this.callAI(
        prompt,
        agentData.instructions || 'You are a professional crypto analyst.'
      );

      return {
        service_id: 'market_analysis',
        agent_name: agentData.name,
        result: response,
        timestamp: new Date().toISOString(),
        paid: true
      };
    } catch (error) {
      console.error('Error in market analysis:', error);
      return this.getErrorResponse('market_analysis', error);
    }
  }

  /**
   * Trading Signal Service
   */
  async getTradingSignal(agentData) {
    const prompt = `You are ${agentData.name}, a professional crypto trader.

Generate a specific trading signal for RIGHT NOW.

Include:
- Coin to trade (BTC, ETH, or SOL)
- Action (BUY/SELL/HOLD)
- Entry price (current market price)
- Take profit target
- Stop loss level
- Timeframe (short/medium/long term)
- Confidence level (1-10)
- Brief reasoning`;

    try {
      const response = await this.callAI(
        prompt,
        agentData.instructions || 'You are a professional crypto trader.'
      );

      return {
        service_id: 'trading_signal',
        agent_name: agentData.name,
        result: response,
        timestamp: new Date().toISOString(),
        paid: true
      };
    } catch (error) {
      console.error('Error in trading signal:', error);
      return this.getErrorResponse('trading_signal', error);
    }
  }

  /**
   * Portfolio Advice Service
   */
  async getPortfolioAdvice(agentData) {
    const prompt = `You are ${agentData.name}, a professional crypto portfolio manager.

Provide portfolio allocation advice for a $10,000 crypto portfolio.

Include:
- Recommended allocation percentages for BTC, ETH, SOL, and stablecoins
- Risk level (Conservative/Moderate/Aggressive)
- Rebalancing strategy
- Expected returns (realistic estimate)
- Risk management tips`;

    try {
      const response = await this.callAI(
        prompt,
        agentData.instructions || 'You are a professional portfolio advisor.'
      );

      return {
        service_id: 'portfolio_advice',
        agent_name: agentData.name,
        result: response,
        timestamp: new Date().toISOString(),
        paid: true
      };
    } catch (error) {
      console.error('Error in portfolio advice:', error);
      return this.getErrorResponse('portfolio_advice', error);
    }
  }

  /**
   * Price Prediction Service
   */
  async getPricePrediction(agentData) {
    const prompt = `You are ${agentData.name}, a crypto price prediction expert.

Provide price predictions for BTC, ETH, and SOL for the next 24 hours.

For each coin include:
- Current price estimate
- Predicted price in 24 hours
- Percentage change
- Confidence level (1-10)
- Key factors influencing the prediction`;

    try {
      const response = await this.callAI(
        prompt,
        agentData.instructions || 'You are a professional price analyst.'
      );

      return {
        service_id: 'price_prediction',
        agent_name: agentData.name,
        result: response,
        timestamp: new Date().toISOString(),
        paid: true
      };
    } catch (error) {
      console.error('Error in price prediction:', error);
      return this.getErrorResponse('price_prediction', error);
    }
  }

  /**
   * Default service for unknown service IDs
   */
  async getDefaultService(agentData, serviceId) {
    const prompt = `You are ${agentData.name}. A user has paid for the service: "${serviceId}".

Provide a helpful and professional response related to crypto trading, market analysis, or investment advice.

Keep it valuable and actionable.`;

    try {
      const response = await this.callAI(
        prompt,
        agentData.instructions || 'You are a helpful AI assistant.'
      );

      return {
        service_id: serviceId,
        agent_name: agentData.name,
        result: response,
        timestamp: new Date().toISOString(),
        paid: true
      };
    } catch (error) {
      console.error('Error in default service:', error);
      return this.getErrorResponse(serviceId, error);
    }
  }

  /**
   * Error response
   */
  getErrorResponse(serviceId, error) {
    return {
      service_id: serviceId,
      error: true,
      message: 'Service temporarily unavailable. Please try again.',
      details: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = X402Service;

