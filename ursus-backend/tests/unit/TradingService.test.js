const TradingService = require('../../services/TradingService');

describe('TradingService', () => {
  let tradingService;

  beforeEach(() => {
    tradingService = new TradingService();
  });

  describe('Bonding Curve Calculations', () => {
    test('should calculate buy price correctly', () => {
      const currentSupply = 1000000; // 1M tokens
      const amount = 1000; // 1K tokens
      const result = tradingService.calculateBuyPrice(currentSupply, amount);

      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('priceImpact');
      expect(result).toHaveProperty('fees');
      expect(result).toHaveProperty('total');
      expect(result.price).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(result.price);
    });

    test('should calculate sell price correctly', () => {
      const currentSupply = 1000000;
      const amount = 1000;
      const result = tradingService.calculateSellPrice(currentSupply, amount);

      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('priceImpact');
      expect(result).toHaveProperty('fees');
      expect(result).toHaveProperty('total');
      expect(result.price).toBeGreaterThan(0);
      expect(result.total).toBeLessThan(result.price);
    });

    test('should have higher price impact for larger trades', () => {
      const currentSupply = 1000000;
      const smallAmount = 1000;
      const largeAmount = 10000;

      const smallTrade = tradingService.calculateBuyPrice(currentSupply, smallAmount);
      const largeTrade = tradingService.calculateBuyPrice(currentSupply, largeAmount);

      expect(largeTrade.priceImpact).toBeGreaterThan(smallTrade.priceImpact);
    });

    test('should calculate market cap correctly', () => {
      const currentSupply = 1000000;
      const currentPrice = 0.001;
      const marketCap = tradingService.calculateMarketCap(currentSupply, currentPrice);

      expect(marketCap).toBe(1000); // 1M * 0.001
    });

    test('should handle edge cases', () => {
      // Zero supply
      expect(() => tradingService.calculateBuyPrice(0, 1000)).toThrow();
      
      // Zero amount
      const result = tradingService.calculateBuyPrice(1000000, 0);
      expect(result.price).toBe(0);
      expect(result.total).toBe(0);

      // Negative values
      expect(() => tradingService.calculateBuyPrice(-1000, 1000)).toThrow();
      expect(() => tradingService.calculateBuyPrice(1000, -1000)).toThrow();
    });
  });

  describe('Fee Calculations', () => {
    test('should calculate trading fees correctly', () => {
      const amount = 1000;
      const feeRate = 0.005; // 0.5%
      const fee = tradingService.calculateTradingFee(amount, feeRate);

      expect(fee).toBe(5); // 1000 * 0.005
    });

    test('should apply different fee rates for different trade sizes', () => {
      const amount = 10000;
      const standardFee = tradingService.calculateTradingFee(amount, 0.005);
      const discountedFee = tradingService.calculateTradingFee(amount, 0.003);

      expect(discountedFee).toBeLessThan(standardFee);
    });

    test('should handle zero fees', () => {
      const amount = 1000;
      const fee = tradingService.calculateTradingFee(amount, 0);

      expect(fee).toBe(0);
    });
  });

  describe('Slippage Calculations', () => {
    test('should calculate slippage correctly', () => {
      const expectedPrice = 0.001;
      const actualPrice = 0.0011;
      const slippage = tradingService.calculateSlippage(expectedPrice, actualPrice);

      expect(slippage).toBeCloseTo(10, 1); // 10% slippage
    });

    test('should handle negative slippage (better than expected)', () => {
      const expectedPrice = 0.001;
      const actualPrice = 0.0009;
      const slippage = tradingService.calculateSlippage(expectedPrice, actualPrice);

      expect(slippage).toBeLessThan(0);
    });

    test('should validate slippage tolerance', () => {
      const slippage = 15; // 15%
      const tolerance = 10; // 10%
      const isValid = tradingService.validateSlippageTolerance(slippage, tolerance);

      expect(isValid).toBe(false);
    });
  });

  describe('Price Impact Analysis', () => {
    test('should calculate price impact for different trade sizes', () => {
      const currentSupply = 1000000;
      const basePrice = tradingService.getCurrentPrice(currentSupply);
      
      const smallTrade = tradingService.calculateBuyPrice(currentSupply, 1000);
      const largeTrade = tradingService.calculateBuyPrice(currentSupply, 100000);

      expect(largeTrade.priceImpact).toBeGreaterThan(smallTrade.priceImpact);
      expect(smallTrade.priceImpact).toBeGreaterThanOrEqual(0);
      expect(largeTrade.priceImpact).toBeGreaterThanOrEqual(0);
    });

    test('should warn for high price impact trades', () => {
      const currentSupply = 1000000;
      const largeAmount = 500000; // 50% of supply
      const result = tradingService.calculateBuyPrice(currentSupply, largeAmount);

      expect(result.priceImpact).toBeGreaterThan(10); // Should be > 10%
      expect(result.warning).toBeDefined();
    });
  });

  describe('Liquidity Calculations', () => {
    test('should calculate available liquidity', () => {
      const currentSupply = 1000000;
      const maxPriceImpact = 5; // 5%
      const liquidity = tradingService.calculateAvailableLiquidity(currentSupply, maxPriceImpact);

      expect(liquidity).toHaveProperty('buyLiquidity');
      expect(liquidity).toHaveProperty('sellLiquidity');
      expect(liquidity.buyLiquidity).toBeGreaterThan(0);
      expect(liquidity.sellLiquidity).toBeGreaterThan(0);
    });

    test('should have lower liquidity for lower price impact tolerance', () => {
      const currentSupply = 1000000;
      const lowImpact = tradingService.calculateAvailableLiquidity(currentSupply, 1);
      const highImpact = tradingService.calculateAvailableLiquidity(currentSupply, 10);

      expect(highImpact.buyLiquidity).toBeGreaterThan(lowImpact.buyLiquidity);
      expect(highImpact.sellLiquidity).toBeGreaterThan(lowImpact.sellLiquidity);
    });
  });

  describe('Trade Validation', () => {
    test('should validate minimum trade amounts', () => {
      const minAmount = 100;
      const validTrade = tradingService.validateTradeAmount(1000, minAmount);
      const invalidTrade = tradingService.validateTradeAmount(50, minAmount);

      expect(validTrade.isValid).toBe(true);
      expect(invalidTrade.isValid).toBe(false);
      expect(invalidTrade.error).toContain('minimum');
    });

    test('should validate maximum trade amounts', () => {
      const maxAmount = 100000;
      const validTrade = tradingService.validateTradeAmount(50000, 100, maxAmount);
      const invalidTrade = tradingService.validateTradeAmount(150000, 100, maxAmount);

      expect(validTrade.isValid).toBe(true);
      expect(invalidTrade.isValid).toBe(false);
      expect(invalidTrade.error).toContain('maximum');
    });

    test('should validate sufficient balance for sells', () => {
      const userBalance = 5000;
      const sellAmount = 3000;
      const largeSellAmount = 7000;

      const validSell = tradingService.validateSellAmount(sellAmount, userBalance);
      const invalidSell = tradingService.validateSellAmount(largeSellAmount, userBalance);

      expect(validSell.isValid).toBe(true);
      expect(invalidSell.isValid).toBe(false);
      expect(invalidSell.error).toContain('balance');
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate trade execution time', () => {
      const startTime = Date.now();
      // Simulate some processing time
      const endTime = startTime + 100;
      const executionTime = tradingService.calculateExecutionTime(startTime, endTime);

      expect(executionTime).toBe(100);
    });

    test('should track gas estimation accuracy', () => {
      const estimatedGas = 100000;
      const actualGas = 95000;
      const accuracy = tradingService.calculateGasAccuracy(estimatedGas, actualGas);

      expect(accuracy).toBeCloseTo(95, 0); // 95% accuracy
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid inputs gracefully', () => {
      expect(() => tradingService.calculateBuyPrice(null, 1000)).toThrow();
      expect(() => tradingService.calculateBuyPrice(1000000, null)).toThrow();
      expect(() => tradingService.calculateBuyPrice('invalid', 1000)).toThrow();
    });

    test('should handle extreme values', () => {
      const veryLargeSupply = Number.MAX_SAFE_INTEGER;
      const verySmallAmount = 0.000001;

      expect(() => {
        tradingService.calculateBuyPrice(veryLargeSupply, verySmallAmount);
      }).not.toThrow();
    });

    test('should handle division by zero', () => {
      expect(() => tradingService.calculateSlippage(0, 0.001)).toThrow();
    });
  });

  describe('Integration with Bonding Curve', () => {
    test('should maintain price consistency across operations', () => {
      const initialSupply = 1000000;
      const tradeAmount = 10000;

      // Buy tokens
      const buyResult = tradingService.calculateBuyPrice(initialSupply, tradeAmount);
      const newSupply = initialSupply + tradeAmount;

      // Immediately sell the same amount
      const sellResult = tradingService.calculateSellPrice(newSupply, tradeAmount);

      // Sell price should be lower than buy price due to fees and curve shape
      expect(sellResult.price).toBeLessThan(buyResult.price);
    });

    test('should handle multiple consecutive trades', () => {
      let currentSupply = 1000000;
      const trades = [1000, 2000, 5000, 1000];
      let totalCost = 0;

      trades.forEach(amount => {
        const result = tradingService.calculateBuyPrice(currentSupply, amount);
        totalCost += result.total;
        currentSupply += amount;
      });

      expect(totalCost).toBeGreaterThan(0);
      expect(currentSupply).toBe(1000000 + trades.reduce((a, b) => a + b, 0));
    });
  });
});
