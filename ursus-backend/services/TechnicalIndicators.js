class TechnicalIndicators {
  constructor() {
    console.log('📊 Technical Indicators service initialized');
  }

  // Simple Moving Average
  calculateSMA(prices, period) {
    if (!prices || prices.length === 0 || period <= 0 || prices.length < period) return null;
    
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  // Exponential Moving Average
  calculateEMA(prices, period) {
    if (!prices || prices.length === 0 || period <= 0 || prices.length < period) return null;

    const multiplier = 2 / (period + 1);
    // Start with SMA for the first value
    const sma = this.calculateSMA(prices.slice(0, period), period);
    if (!sma) return null;

    const ema = [sma[0]];

    for (let i = period; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier)));
    }

    return ema;
  }

  // Relative Strength Index
  calculateRSI(prices, period = 14) {
    if (!prices || prices.length < period + 1) return null;

    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    if (gains.length < period) return null;

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    const rsi = [];

    // First RSI value
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }

    // Calculate RSI for remaining periods
    for (let i = period; i < gains.length; i++) {
      // Update averages using Wilder's smoothing
      avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
      avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  // MACD (Moving Average Convergence Divergence)
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    if (!fastEMA || !slowEMA) return null;
    
    // Calculate MACD line
    const macdLine = [];
    const startIndex = slowPeriod - fastPeriod;
    
    for (let i = startIndex; i < fastEMA.length; i++) {
      macdLine.push(fastEMA[i] - slowEMA[i - startIndex]);
    }
    
    // Calculate signal line (EMA of MACD line)
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    // Calculate histogram
    const histogram = [];
    if (signalLine) {
      const signalStartIndex = signalPeriod - 1;
      for (let i = signalStartIndex; i < macdLine.length; i++) {
        histogram.push(macdLine[i] - signalLine[i - signalStartIndex]);
      }
    }
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  // Bollinger Bands
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    const sma = this.calculateSMA(prices, period);
    if (!sma) return null;
    
    const bands = {
      upper: [],
      middle: sma,
      lower: []
    };
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      
      // Calculate standard deviation
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      bands.upper.push(mean + (stdDev * standardDeviation));
      bands.lower.push(mean - (stdDev * standardDeviation));
    }
    
    return bands;
  }

  // Volume Weighted Average Price
  calculateVWAP(prices, volumes) {
    if (prices.length !== volumes.length) return null;
    
    let cumulativeVolume = 0;
    let cumulativePriceVolume = 0;
    const vwap = [];
    
    for (let i = 0; i < prices.length; i++) {
      cumulativeVolume += volumes[i];
      cumulativePriceVolume += prices[i] * volumes[i];
      
      if (cumulativeVolume > 0) {
        vwap.push(cumulativePriceVolume / cumulativeVolume);
      } else {
        vwap.push(prices[i]);
      }
    }
    
    return vwap;
  }

  // Stochastic Oscillator
  calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
      return null;
    }
    
    const kPercent = [];
    
    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
      
      if (highestHigh === lowestLow) {
        kPercent.push(50); // Avoid division by zero
      } else {
        kPercent.push(((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100);
      }
    }
    
    // Calculate %D (SMA of %K)
    const dPercent = this.calculateSMA(kPercent, dPeriod);
    
    return {
      k: kPercent,
      d: dPercent
    };
  }

  // Average True Range
  calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < 2 || lows.length < 2 || closes.length < 2) {
      return null;
    }
    
    const trueRanges = [];
    
    for (let i = 1; i < closes.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  // Money Flow Index
  calculateMFI(highs, lows, closes, volumes, period = 14) {
    if (highs.length < period + 1) return null;
    
    const typicalPrices = [];
    const moneyFlows = [];
    
    // Calculate typical prices and money flows
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(typicalPrice);
      
      if (i > 0) {
        const moneyFlow = typicalPrice * volumes[i];
        moneyFlows.push({
          value: moneyFlow,
          isPositive: typicalPrice > typicalPrices[i - 1]
        });
      }
    }
    
    const mfi = [];
    
    for (let i = period - 1; i < moneyFlows.length; i++) {
      const periodFlows = moneyFlows.slice(i - period + 1, i + 1);
      
      const positiveFlow = periodFlows
        .filter(flow => flow.isPositive)
        .reduce((sum, flow) => sum + flow.value, 0);
      
      const negativeFlow = periodFlows
        .filter(flow => !flow.isPositive)
        .reduce((sum, flow) => sum + flow.value, 0);
      
      if (negativeFlow === 0) {
        mfi.push(100);
      } else {
        const moneyRatio = positiveFlow / negativeFlow;
        mfi.push(100 - (100 / (1 + moneyRatio)));
      }
    }
    
    return mfi;
  }

  // Calculate all indicators for OHLCV data
  calculateAllIndicators(ohlcvData) {
    if (!ohlcvData || ohlcvData.length < 26) {
      return null; // Need at least 26 periods for most indicators
    }
    
    const opens = ohlcvData.map(d => d.open);
    const highs = ohlcvData.map(d => d.high);
    const lows = ohlcvData.map(d => d.low);
    const closes = ohlcvData.map(d => d.close);
    const volumes = ohlcvData.map(d => d.volume);
    
    return {
      sma20: this.calculateSMA(closes, 20),
      sma50: this.calculateSMA(closes, 50),
      ema12: this.calculateEMA(closes, 12),
      ema26: this.calculateEMA(closes, 26),
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes, 12, 26, 9),
      bollingerBands: this.calculateBollingerBands(closes, 20, 2),
      vwap: this.calculateVWAP(closes, volumes),
      stochastic: this.calculateStochastic(highs, lows, closes, 14, 3),
      atr: this.calculateATR(highs, lows, closes, 14),
      mfi: this.calculateMFI(highs, lows, closes, volumes, 14)
    };
  }

  // Get latest indicator values
  getLatestValues(indicators) {
    if (!indicators) return null;
    
    const getLastValue = (arr) => arr && arr.length > 0 ? arr[arr.length - 1] : null;
    
    return {
      sma20: getLastValue(indicators.sma20),
      sma50: getLastValue(indicators.sma50),
      ema12: getLastValue(indicators.ema12),
      ema26: getLastValue(indicators.ema26),
      rsi: getLastValue(indicators.rsi),
      macd: {
        line: getLastValue(indicators.macd?.macd),
        signal: getLastValue(indicators.macd?.signal),
        histogram: getLastValue(indicators.macd?.histogram)
      },
      bollingerBands: {
        upper: getLastValue(indicators.bollingerBands?.upper),
        middle: getLastValue(indicators.bollingerBands?.middle),
        lower: getLastValue(indicators.bollingerBands?.lower)
      },
      vwap: getLastValue(indicators.vwap),
      stochastic: {
        k: getLastValue(indicators.stochastic?.k),
        d: getLastValue(indicators.stochastic?.d)
      },
      atr: getLastValue(indicators.atr),
      mfi: getLastValue(indicators.mfi)
    };
  }

  // MACD (Moving Average Convergence Divergence)
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return null;

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    if (!fastEMA || !slowEMA) return null;

    // Calculate MACD line
    const macdLine = [];
    const startIndex = slowPeriod - fastPeriod;

    for (let i = startIndex; i < fastEMA.length; i++) {
      macdLine.push(fastEMA[i] - slowEMA[i - startIndex]);
    }

    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMA(macdLine, signalPeriod);

    if (!signalLine) return null;

    // Calculate histogram
    const histogram = [];
    const histogramStartIndex = signalPeriod - 1;

    for (let i = histogramStartIndex; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i - histogramStartIndex]);
    }

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  // Bollinger Bands
  calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) return null;

    const sma = this.calculateSMA(prices, period);
    if (!sma) return null;

    const upper = [];
    const middle = [];
    const lower = [];

    for (let i = 0; i < sma.length; i++) {
      const dataIndex = i + period - 1;
      const slice = prices.slice(dataIndex - period + 1, dataIndex + 1);

      // Calculate standard deviation
      const mean = sma[i];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      middle.push(mean);
      upper.push(mean + (multiplier * stdDev));
      lower.push(mean - (multiplier * stdDev));
    }

    return {
      upper: upper,
      middle: middle,
      lower: lower
    };
  }

  // Stochastic Oscillator
  calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
      return null;
    }

    const kValues = [];

    for (let i = kPeriod - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
      const currentClose = closes[i];

      const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
    }

    // Calculate %D (SMA of %K)
    const dValues = this.calculateSMA(kValues, dPeriod);

    return {
      k: kValues,
      d: dValues || []
    };
  }

  // Williams %R
  calculateWilliamsR(highs, lows, closes, period = 14) {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const williamsR = [];

    for (let i = period - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
      const currentClose = closes[i];

      const wr = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
      williamsR.push(wr);
    }

    return williamsR;
  }

  // Average True Range (ATR)
  calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return null;
    }

    const trueRanges = [];

    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges, period);
  }
}

module.exports = TechnicalIndicators;
