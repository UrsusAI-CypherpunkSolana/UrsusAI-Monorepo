const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ursus_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and close database connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Health Check', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });

    test('GET /api/monitoring/health should return system health', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
    });
  });

  describe('Agents API', () => {
    test('GET /api/agents should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    test('POST /api/agents should create new agent', async () => {
      const agentData = {
        name: 'Test Agent',
        symbol: 'TEST',
        description: 'A test agent',
        instructions: 'Test instructions',
        creator: '0x1234567890123456789012345678901234567890'
      };

      const response = await request(app)
        .post('/api/agents')
        .send(agentData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name', agentData.name);
      expect(response.body.data).toHaveProperty('symbol', agentData.symbol);
    });

    test('GET /api/agents/:id should return specific agent', async () => {
      // First create an agent
      const agentData = {
        name: 'Test Agent',
        symbol: 'TEST',
        description: 'A test agent',
        instructions: 'Test instructions',
        creator: '0x1234567890123456789012345678901234567890'
      };

      const createResponse = await request(app)
        .post('/api/agents')
        .send(agentData);

      const agentId = createResponse.body.data._id;

      // Then fetch it
      const response = await request(app)
        .get(`/api/agents/${agentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('_id', agentId);
      expect(response.body.data).toHaveProperty('name', agentData.name);
    });

    test('GET /api/agents/:id should return 404 for non-existent agent', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/agents/${fakeId}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Trading API', () => {
    let testAgent;

    beforeEach(async () => {
      // Create a test agent for trading tests
      const agentData = {
        name: 'Trading Test Agent',
        symbol: 'TTA',
        description: 'Agent for trading tests',
        instructions: 'Trading test instructions',
        creator: '0x1234567890123456789012345678901234567890',
        contractAddress: '0x1234567890123456789012345678901234567890',
        currentPrice: '0.001',
        totalSupply: '1000000'
      };

      const response = await request(app)
        .post('/api/agents')
        .send(agentData);

      testAgent = response.body.data;
    });

    test('GET /api/trading/quote/buy should return buy quote', async () => {
      const response = await request(app)
        .get(`/api/trading/quote/buy`)
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '1000'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('price');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('priceImpact');
    });

    test('GET /api/trading/quote/sell should return sell quote', async () => {
      const response = await request(app)
        .get(`/api/trading/quote/sell`)
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '1000'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('price');
      expect(response.body.data).toHaveProperty('total');
    });

    test('GET /api/trading/orderbook/:agentAddress should return order book', async () => {
      const response = await request(app)
        .get(`/api/trading/orderbook/${testAgent.contractAddress}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('buyOrders');
      expect(response.body.data).toHaveProperty('sellOrders');
      expect(response.body.data).toHaveProperty('recentTrades');
    });
  });

  describe('Chart API', () => {
    let testAgent;

    beforeEach(async () => {
      const agentData = {
        name: 'Chart Test Agent',
        symbol: 'CTA',
        description: 'Agent for chart tests',
        instructions: 'Chart test instructions',
        creator: '0x1234567890123456789012345678901234567890',
        contractAddress: '0x1234567890123456789012345678901234567890'
      };

      const response = await request(app)
        .post('/api/agents')
        .send(agentData);

      testAgent = response.body.data;
    });

    test('GET /api/chart/agents/:agentAddress/candles should return candle data', async () => {
      const response = await request(app)
        .get(`/api/chart/agents/${testAgent.contractAddress}/candles`)
        .query({ interval: '1h', limit: 100 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('candles');
      expect(Array.isArray(response.body.data.candles)).toBe(true);
    });

    test('GET /api/chart/agents/:agentAddress/indicators should return technical indicators', async () => {
      const response = await request(app)
        .get(`/api/chart/agents/${testAgent.contractAddress}/indicators`)
        .query({ interval: '1h', period: 20 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('sma');
      expect(response.body.data).toHaveProperty('ema');
      expect(response.body.data).toHaveProperty('rsi');
      expect(response.body.data).toHaveProperty('macd');
      expect(response.body.data).toHaveProperty('bollinger');
    });
  });

  describe('Chat API', () => {
    let testAgent;

    beforeEach(async () => {
      const agentData = {
        name: 'Chat Test Agent',
        symbol: 'CHA',
        description: 'Agent for chat tests',
        instructions: 'Chat test instructions',
        creator: '0x1234567890123456789012345678901234567890',
        contractAddress: '0x1234567890123456789012345678901234567890'
      };

      const response = await request(app)
        .post('/api/agents')
        .send(agentData);

      testAgent = response.body.data;
    });

    test('POST /api/chat should send message to agent', async () => {
      const chatData = {
        agentAddress: testAgent.contractAddress,
        message: 'Hello, test agent!',
        userAddress: '0x1234567890123456789012345678901234567890',
        sessionId: 'test-session-123'
      };

      const response = await request(app)
        .post('/api/chat')
        .send(chatData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('messageId');
    });

    test('GET /api/chat/history/:agentAddress should return chat history', async () => {
      // First send a message
      const chatData = {
        agentAddress: testAgent.contractAddress,
        message: 'Test message for history',
        userAddress: '0x1234567890123456789012345678901234567890',
        sessionId: 'test-session-123'
      };

      await request(app)
        .post('/api/chat')
        .send(chatData);

      // Then get history
      const response = await request(app)
        .get(`/api/chat/history/${testAgent.contractAddress}`)
        .query({ userAddress: chatData.userAddress })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on trading endpoints', async () => {
      const agentAddress = '0x1234567890123456789012345678901234567890';
      
      // Make multiple requests quickly
      const requests = Array(25).fill().map(() => 
        request(app)
          .get('/api/trading/quote/buy')
          .query({ agentAddress, amount: '1000' })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    test('should enforce rate limits on chat endpoints', async () => {
      const chatData = {
        agentAddress: '0x1234567890123456789012345678901234567890',
        message: 'Rate limit test',
        userAddress: '0x1234567890123456789012345678901234567890',
        sessionId: 'rate-limit-test'
      };

      // Make multiple requests quickly
      const requests = Array(35).fill().map(() => 
        request(app)
          .post('/api/chat')
          .send(chatData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid Ethereum addresses', async () => {
      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: 'invalid-address',
          amount: '1000'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing required parameters', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({
          message: 'Test message'
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/agents')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Security', () => {
    test('should sanitize input data', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>Test Agent',
        symbol: 'TEST',
        description: 'javascript:alert("xss")',
        instructions: 'onclick="alert(\'xss\')" Test instructions',
        creator: '0x1234567890123456789012345678901234567890'
      };

      const response = await request(app)
        .post('/api/agents')
        .send(maliciousData)
        .expect(201);

      // Check that malicious content was sanitized
      expect(response.body.data.name).not.toContain('<script>');
      expect(response.body.data.description).not.toContain('javascript:');
      expect(response.body.data.instructions).not.toContain('onclick=');
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});
