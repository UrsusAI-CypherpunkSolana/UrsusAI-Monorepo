// Global test setup

// Setup before all tests
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  process.env.GOOGLE_AI_API_KEY = 'test-google-key';

  console.log('🧪 Test environment setup complete');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧪 Test cleanup complete');
});

// Global test utilities
global.testUtils = {
  // Create test agent data
  createTestAgent: (overrides = {}) => ({
    name: 'Test Agent',
    symbol: 'TEST',
    description: 'A test agent for unit testing',
    instructions: 'Test instructions for the agent',
    creator: '0x1234567890123456789012345678901234567890',
    contractAddress: '0x1234567890123456789012345678901234567890',
    currentPrice: '0.001',
    totalSupply: '1000000',
    marketCap: '1000',
    volume24h: '100',
    priceChange24h: '0.05',
    holders: 150,
    isVerified: true,
    ...overrides
  }),

  // Create test user data
  createTestUser: (overrides = {}) => ({
    address: '0x1234567890123456789012345678901234567890',
    username: 'testuser',
    email: 'test@example.com',
    isVerified: false,
    createdAt: new Date(),
    ...overrides
  }),

  // Create test trade data
  createTestTrade: (overrides = {}) => ({
    agentAddress: '0x1234567890123456789012345678901234567890',
    userAddress: '0x9876543210987654321098765432109876543210',
    type: 'buy',
    amount: '1000',
    price: '0.001',
    total: '1',
    timestamp: Date.now(),
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'completed',
    ...overrides
  }),

  // Create test chat message data
  createTestChatMessage: (overrides = {}) => ({
    agentAddress: '0x1234567890123456789012345678901234567890',
    userAddress: '0x9876543210987654321098765432109876543210',
    type: 'user',
    content: 'Hello, test agent!',
    sessionId: 'test-session-123',
    timestamp: new Date(),
    status: 'sent',
    ...overrides
  }),

  // Wait for async operations
  wait: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random Ethereum address
  generateAddress: () => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  },

  // Generate random transaction hash
  generateTxHash: () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  },

  BlockchainResponses: {
    getBuyQuote: {
      success: true,
      price: '0.001',
      total: '1.005',
      priceImpact: '0.5',
      fees: '0.005',
      gasEstimate: '150000'
    },
    getSellQuote: {
      success: true,
      price: '0.0009',
      total: '0.8955',
      priceImpact: '0.5',
      fees: '0.0045',
      gasEstimate: '120000'
    },
    executeTrade: {
      success: true,
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      gasUsed: '145000'
    }
  },

  mockAIResponses: {
    chat: {
      success: true,
      response: 'Hello! I am a test AI agent. How can I help you today?',
      model: 'gpt-3.5-turbo',
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        total_tokens: 70
      }
    }
  }
};

jest.mock('../services/BlockchainService', () => {
  return jest.fn().mockImplementation(() => ({
    getBuyQuote: jest.fn().mockResolvedValue(global.testUtils.mockBlockchainResponses.getBuyQuote),
    getSellQuote: jest.fn().mockResolvedValue(global.testUtils.mockBlockchainResponses.getSellQuote),
    executeTrade: jest.fn().mockResolvedValue(global.testUtils.mockBlockchainResponses.executeTrade),
    getAgentInfo: jest.fn().mockResolvedValue({
      success: true,
      totalSupply: '1000000',
      currentPrice: '0.001',
      marketCap: '1000'
    }),
    isConnected: jest.fn().mockReturnValue(true)
  }));
});

jest.mock('../services/AIService', () => {
  return jest.fn().mockImplementation(() => ({
    chat: jest.fn().mockResolvedValue(global.testUtils.mockAIResponses.chat),
    generateResponse: jest.fn().mockResolvedValue('Test AI response'),
    isAvailable: jest.fn().mockReturnValue(true)
  }));
});

jest.mock('../services/WebSocketService', () => {
  return jest.fn().mockImplementation(() => ({
    broadcast: jest.fn(),
    broadcastToRoom: jest.fn(),
    getConnectionCount: jest.fn().mockReturnValue(0),
    isConnected: jest.fn().mockReturnValue(true)
  }));
});

// Mock Redis for testing
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    expire: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    isReady: true
  }))
}));

// Suppress console logs during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for async operations
jest.setTimeout(30000);
