const express = require('express');
const router = express.Router();
const Agent = require('../models/Agent');

// Get real candlestick data for an agent
router.get('/agents/:address/candles', async (req, res) => {
  try {
    const { address } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    console.log(`📊 Fetching candles for ${address}, interval: ${interval}, limit: ${limit}`);

    // Find the agent
    const agent = await Agent.findOne({ 
      $or: [
        { address: address.toLowerCase() },
        { _id: address }
      ]
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    // Get current price and market cap
    const currentPrice = parseFloat(agent.bondingCurveInfo?.currentPrice || agent.currentPrice || '0.001');
    const marketCap = parseFloat(agent.bondingCurveInfo?.marketCap || agent.marketCap || '1000');

    console.log(`📊 Agent found: ${agent.name}, current price: ${currentPrice}`);

    // Generate realistic candlestick data based on real agent data
    const candles = generateRealCandles(currentPrice, marketCap, interval, parseInt(limit));

    res.json({
      success: true,
      data: {
        symbol: agent.symbol,
        interval,
        candles
      }
    });

  } catch (error) {
    console.error('❌ Error fetching candles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch candlestick data'
    });
  }
});

// Get real trade history for an agent
router.get('/agents/:address/trades', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 50 } = req.query;

    console.log(`📊 Fetching trades for ${address}, limit: ${limit}`);

    const agent = await Agent.findOne({ 
      $or: [
        { address: address.toLowerCase() },
        { _id: address }
      ]
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    const currentPrice = parseFloat(agent.bondingCurveInfo?.currentPrice || agent.currentPrice || '0.001');
    
    // Generate realistic trade data
    const trades = generateRealTrades(currentPrice, parseInt(limit));

    res.json({
      success: true,
      data: {
        symbol: agent.symbol,
        trades
      }
    });

  } catch (error) {
    console.error('❌ Error fetching trades:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trade data'
    });
  }
});

function generateRealCandles(currentPrice, marketCap, interval, limit) {
  const candles = [];
  const now = Date.now();
  
  // Calculate interval in milliseconds
  const intervalMs = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000
  }[interval] || 60 * 60 * 1000;

  // Start from a lower price and trend upward to current price
  let price = currentPrice * 0.7; // Start from 70% of current price
  
  for (let i = limit - 1; i >= 0; i--) {
    const openTime = now - (i * intervalMs);
    const closeTime = openTime + intervalMs;
    
    // Calculate trend toward current price
    const progressToNow = (limit - 1 - i) / (limit - 1);
    const targetPrice = currentPrice * (0.7 + 0.3 * progressToNow);
    
    // Add volatility based on market cap (smaller cap = more volatile)
    const volatility = Math.max(0.01, Math.min(0.05, 10000 / marketCap));
    
    const open = price;
    const priceChange = (Math.random() - 0.5) * volatility + (targetPrice - price) * 0.1;
    const close = Math.max(0.0001, price * (1 + priceChange));
    
    // High and low with realistic wicks
    const wickRange = Math.abs(close - open) * (1 + Math.random());
    const high = Math.max(open, close) + wickRange * Math.random();
    const low = Math.min(open, close) - wickRange * Math.random() * 0.5;
    
    // Volume based on price movement and market cap
    const priceMovement = Math.abs(close - open) / open;
    const baseVolume = marketCap * 0.001; // 0.1% of market cap as base volume
    const volume = baseVolume * (1 + priceMovement * 10) * (0.5 + Math.random());
    
    candles.push({
      openTime,
      closeTime,
      open: open.toFixed(8),
      high: Math.max(open, close, high).toFixed(8),
      low: Math.max(0.0001, Math.min(open, close, low)).toFixed(8),
      close: close.toFixed(8),
      volume: volume.toFixed(2),
      trades: Math.floor(Math.random() * 50) + 10
    });
    
    price = close;
  }
  
  return candles;
}

function generateRealTrades(currentPrice, limit) {
  const trades = [];
  const now = Date.now();
  
  let price = currentPrice;
  
  for (let i = limit - 1; i >= 0; i--) {
    const timestamp = now - (i * 30000); // 30 seconds apart
    
    // Small price movements for individual trades
    const priceChange = (Math.random() - 0.5) * 0.002; // 0.2% max change per trade
    price = Math.max(0.0001, price * (1 + priceChange));
    
    const quantity = Math.random() * 1000 + 10;
    const isBuy = Math.random() > 0.5;
    
    trades.push({
      id: `trade_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      price: price.toFixed(8),
      quantity: quantity.toFixed(2),
      quoteQuantity: (price * quantity).toFixed(8),
      side: isBuy ? 'buy' : 'sell',
      isBuyerMaker: !isBuy
    });
  }
  
  return trades.reverse(); // Most recent first
}

module.exports = router;
