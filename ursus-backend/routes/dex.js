const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// Simple proxy for Sushi API to avoid browser CORS
// GET /api/dex/quote/:chainId?tokenIn=...&tokenOut=...&amount=...&maxSlippage=...
router.get('/quote/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { tokenIn, tokenOut, amount, maxSlippage } = req.query;
    if (!chainId || !tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const url = new URL(`https://api.sushi.com/quote/v7/${chainId}`);
    url.searchParams.set('tokenIn', String(tokenIn));
    url.searchParams.set('tokenOut', String(tokenOut));
    url.searchParams.set('amount', String(amount));
    if (maxSlippage) url.searchParams.set('maxSlippage', String(maxSlippage));

    const upstream = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(upstream.status).send(text);
  } catch (error) {
    console.error('DEX quote proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', details: error.message });
  }
});

// GET /api/dex/swap/:chainId?tokenIn=...&tokenOut=...&amount=...&maxSlippage=...
router.get('/swap/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { tokenIn, tokenOut, amount, maxSlippage } = req.query;
    if (!chainId || !tokenIn || !tokenOut || !amount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const url = new URL(`https://api.sushi.com/swap/v7/${chainId}`);
    url.searchParams.set('tokenIn', String(tokenIn));
    url.searchParams.set('tokenOut', String(tokenOut));
    url.searchParams.set('amount', String(amount));
    if (maxSlippage) url.searchParams.set('maxSlippage', String(maxSlippage));

    const upstream = await fetch(url.toString(), { headers: { 'accept': 'application/json' } });
    const text = await upstream.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(upstream.status).send(text);
  } catch (error) {
    console.error('DEX swap proxy error:', error);
    res.status(502).json({ error: 'Bad Gateway', details: error.message });
  }
});

module.exports = router;

