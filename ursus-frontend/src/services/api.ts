// Prefer relative '/api' via Vite proxy in development to avoid CORS and hard deps on 3001
const API_BASE_URL = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api');

// Enhanced API Response Types
interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  requestId?: string;
}

interface AgentData {
  id: string;
  address: string;
  tokenName: string;
  tokenSymbol: string;
  agentInfo: {
    description: string;
    instructions: string;
    model: string;
  };
  metadata: {
    category: string;
    creator: string;
    createdAt: number;
    isActive: boolean;
  };
  currentPrice: string;
  bondingCurveInfo: {
    marketCap: string;
    reserve: string;
  };
  totalSupply: string;
  volume24h: number;
  holders: number;
  priceChange24h: number;
  chatCount: number;
  isVerified: boolean;
  avatar: string;
  image?: string;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface AgentsResponse {
  agents: AgentData[];
  pagination: PaginationData;
}

interface TrendingAgentsResponse {
  agents: AgentData[];
  total: number;
}

interface TradingQuoteResponse {
  quote: {
    tokenAmount: string;
    coreReceived: string;
    currentPrice: string;
    newPrice: string;
    priceImpact: number;
    slippage: number;
    fees: {
      platformFee: string;
      creatorFee: string;
      totalFees: string;
    };
    minimumReceived: string;
    marketCap: string;
    reserve: string;
  };
  error?: string;
}

interface ChatResponse {
  response: string;
  timestamp: string;
  model: string;
  tokens: number;
  agent?: {
    name: string;
    model: string;
    address: string;
  };
  metadata?: {
    responseTime: number;
    sessionId: string;
    messageId: string;
  };
}

interface AnalyticsResponse {
  totalAgents: number;
  totalVolume: string;
  totalTransactions: number;
  activeUsers: number;
  topAgents: AgentData[];
}

interface PortfolioResponse {
  holdings: Array<{
    agentAddress: string;
    tokenAmount: string;
    currentValue: string;
    profitLoss: string;
    profitLossPercentage: number;
  }>;
  totalValue: string;
  totalProfitLoss: string;
  totalProfitLossPercentage: number;
}

interface CreateAgentRequest {
  name: string;
  symbol: string;
  description: string;
  instructions: string;
  model: string;
  category: string;
  creatorAddress: string;
  avatar?: string;
  imageUrl?: string;
  contractAddress?: string;
  agentAddress?: string; // Alternative field name for backend compatibility
  txHash?: string;
}

class ApiService {
  private baseURL: string;
  private isServerAvailable: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 30000; // 30 seconds

  constructor() {
    this.baseURL = API_BASE_URL;
    this.checkServerHealth();
  }

  // Check if server is available
  private async checkServerHealth(): Promise<boolean> {
    const now = Date.now();

    // Only check health every 30 seconds
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isServerAvailable;
    }

    // Prefer hitting '/api/health' so Vite proxy handles CORS in dev
    const primaryUrl = `${this.baseURL}/health`;
    const fallbackUrl = `${this.baseURL.replace('/api', '')}/health`;

    const tryFetch = async (url: string, init?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, { method: 'GET', signal: controller.signal, ...(init || {}) });
        clearTimeout(timeoutId);
        return res;
      } catch (e) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    try {
      // 1) Try proxied URL (avoids CORS in dev)
      let response = await tryFetch(primaryUrl);

      // 2) If blocked by CORS or not ok, try no-cors fallback (opaque ok)
      if (!response.ok) {
        try {
          response = await tryFetch(primaryUrl, { mode: 'no-cors' });
          this.isServerAvailable = true;
        } catch {
          // 3) Try raw backend root as last resort
          try {
            response = await tryFetch(fallbackUrl);
            this.isServerAvailable = response.ok;
          } catch {
            // 4) no-cors fallback to raw
            await tryFetch(fallbackUrl, { mode: 'no-cors' });
            this.isServerAvailable = true;
          }
        }
      } else {
        this.isServerAvailable = true;
      }

      this.lastHealthCheck = now;
      if (!this.isServerAvailable) {
        console.debug('Health check non-critical failure; proceeding.');
      }
      return this.isServerAvailable;
    } catch {
      // Never block requests due to health check noise
      this.isServerAvailable = true;
      this.lastHealthCheck = now;
      console.debug('Health check error ignored (continuing).');
      return true;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries: number = 3
  ): Promise<T> {
    // Try to check server health, but don't block requests if health check fails
    try {
      await this.checkServerHealth();
    } catch (error) {
      console.warn('⚠️ Health check failed, proceeding with request anyway:', error);
    }

    const url = `${this.baseURL}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    config.signal = controller.signal;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, config);

        // Clear timeout on successful response
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Enhanced error handling for different status codes
          if (response.status === 400) {
            // Bad Request - likely invalid parameters or token graduated
            const errorMessage = errorData.error || errorData.message || 'Invalid request parameters';

            // Check for specific error types
            if (errorMessage.includes('GRADUATED_TOKEN') ||
                errorMessage.toLowerCase().includes('graduated') ||
                errorMessage.toLowerCase().includes('dex')) {
              throw new Error('GRADUATED_TOKEN');
            }

            if (errorMessage.includes('TOKEN_NOT_FOUND')) {
              throw new Error('TOKEN_NOT_FOUND');
            }

            // Check for validation errors
            if (errorMessage.includes('Validation failed') || errorData.details) {
              const validationDetails = Array.isArray(errorData.details)
                ? errorData.details.map((d: { msg: string }) => d.msg).join(', ')
                : errorMessage;
              throw new Error(`VALIDATION_ERROR: ${validationDetails}`);
            }

            throw new Error(`BAD_REQUEST: ${errorMessage}`);
          } else if (response.status === 404) {
            throw new Error('TOKEN_NOT_FOUND');
          } else if (response.status >= 500) {
            throw new Error('SERVER_ERROR');
          }

          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        // Mark server as available on successful request
        this.isServerAvailable = true;
        // Dispatch success signal for UI banners when request succeeds
        try {
          window.dispatchEvent(new CustomEvent('ursus:api:ok', { detail: { endpoint } }));
        } catch {}

        return await response.json();
      } catch (error) {
        const isLastAttempt = attempt === retries;
        const isConnectionError = error instanceof TypeError && error.message.includes('fetch');

        if (isConnectionError) {
          // Mark server as potentially unavailable
          this.isServerAvailable = false;

          if (!isLastAttempt) {
            console.warn(`🔄 API request failed (attempt ${attempt}/${retries}): ${endpoint}. Retrying...`);
            try {
              window.dispatchEvent(new CustomEvent('ursus:api:retry', { detail: { endpoint, attempt, retries } }));
            } catch {}
            // Exponential backoff: wait 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
            continue;
          }
        }

        // Reduce noise for expected graduated checks
        if (error instanceof Error && error.message === 'GRADUATED_TOKEN') {
          console.warn(`⚠️ API graduated-token precheck: ${endpoint}`);
        } else {
          console.error(`❌ API request failed: ${endpoint}`, error);
        }

        // Provide user-friendly error messages
        if (isConnectionError) {
          throw new Error('Unable to connect to server. Please check your connection and try again.');
        }

        throw error;
      }
    }

    throw new Error('Maximum retry attempts reached');
  }

  // Generic HTTP methods
  async get<T>(endpoint: string, options?: { params?: Record<string, string | number | boolean> }): Promise<{ data: T }> {
    let finalEndpoint = endpoint;

    if (options?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      if (searchParams.toString()) {
        finalEndpoint += `?${searchParams.toString()}`;
      }
    }

    const response = await this.request<T>(finalEndpoint);
    return { data: response };
  }

  async post<T>(endpoint: string, data?: Record<string, unknown> | string): Promise<{ data: T }> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: typeof data === 'string' ? data : (data ? JSON.stringify(data) : undefined),
    });
    return { data: response };
  }

  // Agent endpoints
  async getAllAgents(params?: {
    page?: number;
    limit?: number;
    category?: string;
    creator?: string;
    search?: string;
  }): Promise<ApiResponse<AgentsResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.category) searchParams.append('category', params.category);
    if (params?.creator) searchParams.append('creator', params.creator);
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    return this.request<ApiResponse<AgentsResponse>>(`/agents${query ? `?${query}` : ''}`);
  }

  async getTrendingAgents(limit = 10): Promise<ApiResponse<TrendingAgentsResponse>> {
    return this.request<ApiResponse<TrendingAgentsResponse>>(`/agents/trending?limit=${limit}`);
  }

  async getAgentDetails(address: string): Promise<ApiResponse<AgentData>> {
    return this.request<ApiResponse<AgentData>>(`/agents/${address}`);
  }

  async createAgent(agentData: CreateAgentRequest): Promise<ApiResponse<{ agentAddress: string }>> {
    return this.request<ApiResponse<{ agentAddress: string }>>('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async getAgentStats(address: string): Promise<ApiResponse<{
    currentPrice: string;
    marketCap: string;
    holders: number;
    transactions24h: number;
    volume24h: string;
    priceChange24h: number;
    totalSupply: string;
  }>> {
    return this.request<ApiResponse<{
      currentPrice: string;
      marketCap: string;
      holders: number;
      transactions24h: number;
      volume24h: string;
      priceChange24h: number;
      totalSupply: string;
    }>>(`/agents/${address}/stats`);
  }

  // Chat endpoints
  async sendMessage(data: {
    agentAddress: string;
    message: string;
    userAddress?: string;
    sessionId?: string;
  }): Promise<ApiResponse<ChatResponse>> {
    return this.request<ApiResponse<ChatResponse>>('/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAgentChatInfo(address: string): Promise<{
    agentAddress: string;
    agentName: string;
    description?: string;
    instructions?: string;
    totalMessages: number;
    lastActivity?: string;
    isActive: boolean;
    capabilities?: string[];
    model?: string;
  }> {
    return this.request<{
      agentAddress: string;
      agentName: string;
      description?: string;
      instructions?: string;
      totalMessages: number;
      lastActivity?: string;
      isActive: boolean;
      capabilities?: string[];
      model?: string;
    }>(`/chat/agents/${address}/info`);
  }

  async getAvailableModels(): Promise<ApiResponse<Array<{ id: string; name: string; description: string }>>> {
    return this.request<ApiResponse<Array<{ id: string; name: string; description: string }>>>('/chat/models');
  }

  async uploadImage(file: File): Promise<{ success?: boolean; imageUrl: string; filename?: string; originalName?: string; size?: number }> {
    const url = `${API_BASE_URL}/upload/image`;
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Image upload failed: ${response.status} ${text}`);
    }

    return response.json();
  }

  // Blockchain endpoints
  async getPlatformStats(): Promise<ApiResponse<AnalyticsResponse>> {
    return this.request<ApiResponse<AnalyticsResponse>>('/blockchain/stats');
  }

  async getUserBalance(agentAddress: string, userAddress: string): Promise<ApiResponse<{ balance: string }>> {
    return this.request<ApiResponse<{ balance: string }>>(`/blockchain/agents/${agentAddress}/balance/${userAddress}`);
  }

  async getPurchaseQuote(agentAddress: string, coreAmount: string): Promise<ApiResponse<TradingQuoteResponse>> {
    return this.request<ApiResponse<TradingQuoteResponse>>(`/blockchain/agents/${agentAddress}/purchase-quote/${coreAmount}`);
  }

  async getSaleQuote(agentAddress: string, tokenAmount: string): Promise<ApiResponse<TradingQuoteResponse>> {
    return this.request<ApiResponse<TradingQuoteResponse>>(`/blockchain/agents/${agentAddress}/sale-quote/${tokenAmount}`);
  }

  async getCreationFee(): Promise<ApiResponse<{ fee: string }>> {
    return this.request<ApiResponse<{ fee: string }>>('/blockchain/creation-fee');
  }

  async getNetworkInfo(): Promise<ApiResponse<{
    chainId: number;
    blockNumber: number;
    gasPrice: string;
    networkName: string;
  }>> {
    return this.request<ApiResponse<{
      chainId: number;
      blockNumber: number;
      gasPrice: string;
      networkName: string;
    }>>('/blockchain/network-info');
  }

  // Analytics endpoints
  async getAnalyticsOverview(): Promise<ApiResponse<AnalyticsResponse>> {
    return this.request<ApiResponse<AnalyticsResponse>>('/analytics/overview');
  }

  async getTopAgents(metric = 'marketCap', limit = 10): Promise<ApiResponse<{ agents: AgentData[] }>> {
    return this.request<ApiResponse<{ agents: AgentData[] }>>(`/analytics/agents/top?metric=${metric}&limit=${limit}`);
  }

  async getAgentAnalytics(address: string, timeframe = '24h'): Promise<ApiResponse<{
    priceHistory: Array<{ timestamp: number; price: number }>;
    volumeHistory: Array<{ timestamp: number; volume: number }>;
    holderCount: number;
    transactionCount: number;
  }>> {
    return this.request<ApiResponse<{
      priceHistory: Array<{ timestamp: number; price: number }>;
      volumeHistory: Array<{ timestamp: number; volume: number }>;
      holderCount: number;
      transactionCount: number;
    }>>(`/analytics/agents/${address}?timeframe=${timeframe}`);
  }

  async getCategoryAnalytics(): Promise<ApiResponse<Array<{
    category: string;
    agentCount: number;
    totalVolume: string;
    averageMarketCap: string;
  }>>> {
    return this.request<ApiResponse<Array<{
      category: string;
      agentCount: number;
      totalVolume: string;
      averageMarketCap: string;
    }>>>('/analytics/categories');
  }

  async getMarketAnalytics(timeframe = '24h'): Promise<ApiResponse<{
    totalMarketCap: string;
    totalVolume: string;
    activeAgents: number;
    priceChangeDistribution: Record<string, number>;
  }>> {
    return this.request<ApiResponse<{
      totalMarketCap: string;
      totalVolume: string;
      activeAgents: number;
      priceChangeDistribution: Record<string, number>;
    }>>(`/analytics/market?timeframe=${timeframe}`);
  }

  // Trading endpoints
  async getBuyQuote(agentAddress: string, amount: string): Promise<ApiResponse<TradingQuoteResponse>> {
    return this.request<ApiResponse<TradingQuoteResponse>>(`/trading/quote/buy/${agentAddress}?amount=${amount}`);
  }

  async getSellQuote(agentAddress: string, amount: string): Promise<ApiResponse<TradingQuoteResponse>> {
    return this.request<ApiResponse<TradingQuoteResponse>>(`/trading/quote/sell/${agentAddress}?amount=${amount}`);
  }

  async executeBuyOrder(data: {
    userAddress: string;
    agentAddress: string;
    coreAmount: number;
    maxSlippage?: number;
    gasLimit?: number;
    gasPrice?: string;
  }): Promise<ApiResponse<{
    transactionHash: string;
    tokensReceived: string;
    actualPrice: string;
  }>> {
    return this.request<ApiResponse<{
      transactionHash: string;
      tokensReceived: string;
      actualPrice: string;
    }>>('/trading/buy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async executeSellOrder(data: {
    userAddress: string;
    agentAddress: string;
    tokenAmount: number;
    maxSlippage?: number;
    gasLimit?: number;
    gasPrice?: string;
  }): Promise<ApiResponse<{
    transactionHash: string;
    coreReceived: string;
    actualPrice: string;
  }>> {
    return this.request<ApiResponse<{
      transactionHash: string;
      coreReceived: string;
      actualPrice: string;
    }>>('/trading/sell', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Blockchain helpers
  async getAgentAddressFromTransaction(txHash: string): Promise<ApiResponse<{ agentAddress: string }>> {
    return this.request<ApiResponse<{ agentAddress: string }>>(`/blockchain/transaction/${txHash}/agent`);
  }

  async getTradingStats(userAddress: string): Promise<ApiResponse<PortfolioResponse>> {
    return this.request<ApiResponse<PortfolioResponse>>(`/trading/stats/${userAddress}`);
  }
}

export const apiService = new ApiService();
export default apiService;