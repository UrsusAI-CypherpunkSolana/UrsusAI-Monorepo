const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Agent = require('../../models/Agent');
const Trade = require('../../models/Trade');

describe('Trading Flow E2E Tests', () => {
  let testAgent;
  let userAddress;

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/ursus_e2e_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections
    await Agent.deleteMany({});
    await Trade.deleteMany({});

    // Create test agent
    testAgent = await Agent.create({
      name: 'E2E Test Agent',
      symbol: 'E2E',
      description: 'Agent for end-to-end testing',
      instructions: 'E2E test instructions',
      creator: '0x1234567890123456789012345678901234567890',
      contractAddress: '0x1111111111111111111111111111111111111111',
      currentPrice: '0.001',
      totalSupply: '1000000',
      marketCap: '1000',
      volume24h: '0',
      priceChange24h: '0',
      holders: 1,
      isVerified: true
    });

    userAddress = '0x9876543210987654321098765432109876543210';
  });

  describe('Complete Trading Flow', () => {
    test('should complete full buy flow', async () => {
      // Step 1: Get buy quote
      const quoteResponse = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '1000'
        })
        .expect(200);

      expect(quoteResponse.body.success).toBe(true);
      expect(quoteResponse.body.data).toHaveProperty('price');
      expect(quoteResponse.body.data).toHaveProperty('total');
      expect(quoteResponse.body.data).toHaveProperty('priceImpact');

      const quote = quoteResponse.body.data;

      // Step 2: Execute buy trade
      const tradeResponse = await request(app)
        .post('/api/trading/buy')
        .send({
          agentAddress: testAgent.contractAddress,
          amount: '1000',
          maxPrice: quote.price,
          userAddress: userAddress,
          slippageTolerance: 5
        })
        .expect(200);

      expect(tradeResponse.body.success).toBe(true);
      expect(tradeResponse.body.data).toHaveProperty('tradeId');
      expect(tradeResponse.body.data).toHaveProperty('txHash');

      const tradeId = tradeResponse.body.data.tradeId;

      // Step 3: Verify trade was recorded
      const trade = await Trade.findById(tradeId);
      expect(trade).toBeTruthy();
      expect(trade.type).toBe('buy');
      expect(trade.amount).toBe('1000');
      expect(trade.agentAddress).toBe(testAgent.contractAddress.toLowerCase());
      expect(trade.userAddress).toBe(userAddress.toLowerCase());

      // Step 4: Check agent stats were updated
      const updatedAgent = await Agent.findById(testAgent._id);
      expect(parseFloat(updatedAgent.volume24h)).toBeGreaterThan(0);
      expect(parseInt(updatedAgent.totalSupply)).toBeGreaterThan(1000000);
    });

    test('should complete full sell flow', async () => {
      // First, simulate a buy to have tokens to sell
      await Trade.create({
        agentAddress: testAgent.contractAddress,
        userAddress: userAddress,
        type: 'buy',
        amount: '5000',
        price: '0.001',
        total: '5',
        timestamp: Date.now(),
        txHash: global.testUtils.generateTxHash(),
        status: 'completed'
      });

      // Step 1: Get sell quote
      const quoteResponse = await request(app)
        .get('/api/trading/quote/sell')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '2000'
        })
        .expect(200);

      expect(quoteResponse.body.success).toBe(true);
      const quote = quoteResponse.body.data;

      // Step 2: Execute sell trade
      const tradeResponse = await request(app)
        .post('/api/trading/sell')
        .send({
          agentAddress: testAgent.contractAddress,
          amount: '2000',
          minPrice: quote.price,
          userAddress: userAddress,
          slippageTolerance: 5
        })
        .expect(200);

      expect(tradeResponse.body.success).toBe(true);
      expect(tradeResponse.body.data).toHaveProperty('tradeId');

      // Step 3: Verify sell trade was recorded
      const sellTrade = await Trade.findById(tradeResponse.body.data.tradeId);
      expect(sellTrade).toBeTruthy();
      expect(sellTrade.type).toBe('sell');
      expect(sellTrade.amount).toBe('2000');
    });

    test('should handle price impact warnings', async () => {
      // Try to buy a large amount that would cause high price impact
      const largeAmount = '500000'; // 50% of supply

      const quoteResponse = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: largeAmount
        })
        .expect(200);

      expect(quoteResponse.body.data.priceImpact).toBeGreaterThan(10);
      expect(quoteResponse.body.data).toHaveProperty('warning');
    });

    test('should reject trades with insufficient balance', async () => {
      // Try to sell more tokens than user has
      const sellResponse = await request(app)
        .post('/api/trading/sell')
        .send({
          agentAddress: testAgent.contractAddress,
          amount: '10000', // User has 0 tokens
          minPrice: '0.0009',
          userAddress: userAddress,
          slippageTolerance: 5
        })
        .expect(400);

      expect(sellResponse.body.success).toBe(false);
      expect(sellResponse.body.error).toContain('balance');
    });

    test('should handle slippage tolerance violations', async () => {
      const quoteResponse = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '1000'
        });

      const quote = quoteResponse.body.data;

      // Set a very low max price to trigger slippage protection
      const tradeResponse = await request(app)
        .post('/api/trading/buy')
        .send({
          agentAddress: testAgent.contractAddress,
          amount: '1000',
          maxPrice: (parseFloat(quote.price) * 0.5).toString(), // 50% lower than quote
          userAddress: userAddress,
          slippageTolerance: 1 // 1% tolerance
        })
        .expect(400);

      expect(tradeResponse.body.success).toBe(false);
      expect(tradeResponse.body.error).toContain('slippage');
    });
  });

  describe('Trading History and Analytics', () => {
    beforeEach(async () => {
      // Create some test trades
      const trades = [
        {
          agentAddress: testAgent.contractAddress,
          userAddress: userAddress,
          type: 'buy',
          amount: '1000',
          price: '0.001',
          total: '1',
          timestamp: Date.now() - 3600000, // 1 hour ago
          txHash: global.testUtils.generateTxHash(),
          status: 'completed'
        },
        {
          agentAddress: testAgent.contractAddress,
          userAddress: userAddress,
          type: 'sell',
          amount: '500',
          price: '0.0011',
          total: '0.55',
          timestamp: Date.now() - 1800000, // 30 minutes ago
          txHash: global.testUtils.generateTxHash(),
          status: 'completed'
        },
        {
          agentAddress: testAgent.contractAddress,
          userAddress: global.testUtils.generateAddress(),
          type: 'buy',
          amount: '2000',
          price: '0.0012',
          total: '2.4',
          timestamp: Date.now() - 900000, // 15 minutes ago
          txHash: global.testUtils.generateTxHash(),
          status: 'completed'
        }
      ];

      await Trade.insertMany(trades);
    });

    test('should get trading history for agent', async () => {
      const response = await request(app)
        .get(`/api/trading/history/${testAgent.contractAddress}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trades).toHaveLength(3);
      expect(response.body.data.total).toBe(3);

      // Should be sorted by timestamp descending
      const trades = response.body.data.trades;
      expect(trades[0].timestamp).toBeGreaterThan(trades[1].timestamp);
      expect(trades[1].timestamp).toBeGreaterThan(trades[2].timestamp);
    });

    test('should get user trading history', async () => {
      const response = await request(app)
        .get('/api/trading/user-history')
        .query({ 
          userAddress: userAddress,
          limit: 10 
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.trades).toHaveLength(2); // User has 2 trades
    });

    test('should get trading analytics', async () => {
      const response = await request(app)
        .get(`/api/analytics/trading/${testAgent.contractAddress}`)
        .query({ period: '24h' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('volume');
      expect(response.body.data).toHaveProperty('trades');
      expect(response.body.data).toHaveProperty('uniqueTraders');
      expect(response.body.data).toHaveProperty('avgTradeSize');
    });
  });

  describe('Order Book and Market Data', () => {
    test('should get order book data', async () => {
      const response = await request(app)
        .get(`/api/trading/orderbook/${testAgent.contractAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('buyOrders');
      expect(response.body.data).toHaveProperty('sellOrders');
      expect(response.body.data).toHaveProperty('recentTrades');
      expect(response.body.data).toHaveProperty('currentPrice');
      expect(response.body.data).toHaveProperty('spread');

      // Buy orders should be sorted by price descending
      const buyOrders = response.body.data.buyOrders;
      if (buyOrders.length > 1) {
        expect(buyOrders[0].price).toBeGreaterThanOrEqual(buyOrders[1].price);
      }

      // Sell orders should be sorted by price ascending
      const sellOrders = response.body.data.sellOrders;
      if (sellOrders.length > 1) {
        expect(sellOrders[0].price).toBeLessThanOrEqual(sellOrders[1].price);
      }
    });

    test('should get market statistics', async () => {
      const response = await request(app)
        .get(`/api/analytics/market/${testAgent.contractAddress}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentPrice');
      expect(response.body.data).toHaveProperty('marketCap');
      expect(response.body.data).toHaveProperty('volume24h');
      expect(response.body.data).toHaveProperty('priceChange24h');
      expect(response.body.data).toHaveProperty('holders');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle non-existent agent', async () => {
      const fakeAddress = '0x9999999999999999999999999999999999999999';

      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: fakeAddress,
          amount: '1000'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    test('should handle invalid amounts', async () => {
      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '-1000' // Negative amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('amount');
    });

    test('should handle invalid addresses', async () => {
      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: 'invalid-address',
          amount: '1000'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('address');
    });

    test('should handle zero amounts', async () => {
      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '0'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle extremely large amounts', async () => {
      const response = await request(app)
        .get('/api/trading/quote/buy')
        .query({
          agentAddress: testAgent.contractAddress,
          amount: '999999999999999999999' // Very large amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on trading endpoints', async () => {
      const requests = [];
      
      // Make many requests quickly
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .get('/api/trading/quote/buy')
            .query({
              agentAddress: testAgent.contractAddress,
              amount: '1000'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some should be rate limited
      const rateLimited = responses.filter(res => res.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrent Trading', () => {
    test('should handle concurrent buy requests', async () => {
      const requests = [];
      
      // Make multiple concurrent buy requests
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/trading/buy')
            .send({
              agentAddress: testAgent.contractAddress,
              amount: '100',
              maxPrice: '0.002',
              userAddress: global.testUtils.generateAddress(),
              slippageTolerance: 10
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed (in a real scenario, some might fail due to price changes)
      responses.forEach(response => {
        expect([200, 400]).toContain(response.status);
      });
    });
  });
});
