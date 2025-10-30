const TechnicalIndicators = require('../../services/TechnicalIndicators');

describe('TechnicalIndicators', () => {
  let indicators;

  beforeEach(() => {
    indicators = new TechnicalIndicators();
  });

  describe('Simple Moving Average (SMA)', () => {
    test('should calculate SMA correctly', () => {
      const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const period = 5;
      const result = indicators.calculateSMA(prices, period);

      expect(result).toHaveLength(6); // 10 - 5 + 1
      expect(result[0]).toBe(3); // (1+2+3+4+5)/5
      expect(result[1]).toBe(4); // (2+3+4+5+6)/5
      expect(result[5]).toBe(8); // (6+7+8+9+10)/5
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2, 3];
      const period = 5;
      const result = indicators.calculateSMA(prices, period);

      expect(result).toBeNull();
    });

    test('should handle edge case with exact period length', () => {
      const prices = [1, 2, 3, 4, 5];
      const period = 5;
      const result = indicators.calculateSMA(prices, period);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(3); // (1+2+3+4+5)/5
    });
  });

  describe('Exponential Moving Average (EMA)', () => {
    test('should calculate EMA correctly', () => {
      const prices = [22, 22.15, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29];
      const period = 5;
      const result = indicators.calculateEMA(prices, period);

      expect(result).toHaveLength(6);
      expect(result[0]).toBeCloseTo(22.116, 2); // First EMA is SMA
      expect(result[result.length - 1]).toBeCloseTo(22.26, 2);
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2];
      const period = 5;
      const result = indicators.calculateEMA(prices, period);

      expect(result).toBeNull();
    });
  });

  describe('Relative Strength Index (RSI)', () => {
    test('should calculate RSI correctly', () => {
      const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 47.37, 47.20, 46.57, 46.61, 46.50, 46.84, 47.28];
      const period = 14;
      const result = indicators.calculateRSI(prices, period);

      expect(result).toHaveLength(1); // Only one RSI value for this data
      expect(result[0]).toBeGreaterThan(0);
      expect(result[0]).toBeLessThan(100);
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2, 3];
      const period = 14;
      const result = indicators.calculateRSI(prices, period);

      expect(result).toBeNull();
    });

    test('should handle extreme values correctly', () => {
      // All increasing prices should give RSI close to 100
      const increasingPrices = Array.from({length: 20}, (_, i) => i + 1);
      const result = indicators.calculateRSI(increasingPrices, 14);

      expect(result[result.length - 1]).toBeGreaterThan(90);
    });
  });

  describe('MACD', () => {
    test('should calculate MACD correctly', () => {
      const prices = Array.from({length: 50}, (_, i) => 100 + Math.sin(i * 0.1) * 10);
      const result = indicators.calculateMACD(prices);

      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('histogram');
      expect(result.macd.length).toBeGreaterThan(0);
      expect(result.signal.length).toBeGreaterThan(0);
      expect(result.histogram.length).toBeGreaterThan(0);
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2, 3];
      const result = indicators.calculateMACD(prices);

      expect(result).toBeNull();
    });
  });

  describe('Bollinger Bands', () => {
    test('should calculate Bollinger Bands correctly', () => {
      const prices = [20, 21, 22, 21, 20, 19, 20, 21, 22, 23, 24, 23, 22, 21, 20, 19, 20, 21, 22, 23];
      const period = 10;
      const result = indicators.calculateBollingerBands(prices, period);

      expect(result).toHaveProperty('upper');
      expect(result).toHaveProperty('middle');
      expect(result).toHaveProperty('lower');
      expect(result.upper.length).toBe(11); // 20 - 10 + 1
      expect(result.middle.length).toBe(11);
      expect(result.lower.length).toBe(11);

      // Upper band should be above middle, middle above lower
      for (let i = 0; i < result.upper.length; i++) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
      }
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2, 3];
      const period = 10;
      const result = indicators.calculateBollingerBands(prices, period);

      expect(result).toBeNull();
    });
  });

  describe('Stochastic Oscillator', () => {
    test('should calculate Stochastic correctly', () => {
      const highs = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62];
      const lows = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54];
      const closes = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58];
      
      const result = indicators.calculateStochastic(highs, lows, closes, 14, 3);

      expect(result).toHaveProperty('k');
      expect(result).toHaveProperty('d');
      expect(result.k.length).toBe(2); // 15 - 14 + 1
      
      // %K values should be between 0 and 100
      result.k.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    test('should return null for insufficient data', () => {
      const highs = [1, 2];
      const lows = [1, 2];
      const closes = [1, 2];
      
      const result = indicators.calculateStochastic(highs, lows, closes, 14, 3);
      expect(result).toBeNull();
    });
  });

  describe('Williams %R', () => {
    test('should calculate Williams %R correctly', () => {
      const highs = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62];
      const lows = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54];
      const closes = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58];
      
      const result = indicators.calculateWilliamsR(highs, lows, closes, 14);

      expect(result).toHaveLength(2); // 15 - 14 + 1
      
      // Williams %R values should be between -100 and 0
      result.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(0);
      });
    });

    test('should return null for insufficient data', () => {
      const highs = [1, 2];
      const lows = [1, 2];
      const closes = [1, 2];
      
      const result = indicators.calculateWilliamsR(highs, lows, closes, 14);
      expect(result).toBeNull();
    });
  });

  describe('Average True Range (ATR)', () => {
    test('should calculate ATR correctly', () => {
      const highs = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62];
      const lows = [40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54];
      const closes = [44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58];
      
      const result = indicators.calculateATR(highs, lows, closes, 14);

      expect(result).toHaveLength(1); // 15 - 14
      expect(result[0]).toBeGreaterThan(0);
    });

    test('should return null for insufficient data', () => {
      const highs = [1, 2];
      const lows = [1, 2];
      const closes = [1, 2];
      
      const result = indicators.calculateATR(highs, lows, closes, 14);
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty arrays', () => {
      expect(indicators.calculateSMA([], 5)).toBeNull();
      expect(indicators.calculateEMA([], 5)).toBeNull();
      expect(indicators.calculateRSI([], 14)).toBeNull();
    });

    test('should handle invalid periods', () => {
      const prices = [1, 2, 3, 4, 5];
      expect(indicators.calculateSMA(prices, 0)).toBeNull();
      expect(indicators.calculateSMA(prices, -1)).toBeNull();
    });

    test('should handle NaN values in input', () => {
      const prices = [1, 2, NaN, 4, 5, 6, 7, 8, 9, 10];
      const result = indicators.calculateSMA(prices, 5);
      
      // Should handle NaN gracefully
      expect(result).toBeDefined();
    });
  });
});
