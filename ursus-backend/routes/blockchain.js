const express = require('express');
const { PublicKey } = require('@solana/web3.js');
const SolanaBlockchainService = require('../services/SolanaBlockchainService');
const router = express.Router();

// Create singleton instance
const BlockchainService = new SolanaBlockchainService();

// GET /api/blockchain/network-status - Get network status
router.get('/network-status', async (req, res) => {
  try {
    console.log('🔍 Fetching Solana network status via backend...');

    // Get network data from blockchain service
    const networkData = await BlockchainService.getNetworkStatus();

    res.json({
      success: true,
      data: {
        slot: networkData.slot,
        blockTime: networkData.blockTime,
        version: networkData.version,
        cluster: networkData.cluster,
        epochInfo: networkData.epochInfo,
        isHealthy: networkData.isHealthy,
        lastChecked: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error fetching network status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch network status',
      data: {
        slot: 0,
        isHealthy: false,
        cluster: 'devnet',
        lastChecked: new Date().toISOString()
      }
    });
  }
});

// GET /api/blockchain/transaction/:signature - Get transaction status
router.get('/transaction/:signature', async (req, res) => {
  try {
    const { signature } = req.params;

    if (!signature || signature.length < 80) {
      return res.status(400).json({ error: 'Invalid transaction signature format' });
    }

    console.log(`🔍 Checking Solana transaction status: ${signature}`);

    const transaction = await BlockchainService.getTransaction(signature);

    res.json({
      success: true,
      transaction: transaction
    });
  } catch (error) {
    console.error('❌ Error fetching transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction status'
    });
  }
});

// POST /api/blockchain/initialize-factory - Initialize the factory (one-time)
router.post('/initialize-factory', async (req, res) => {
  try {
    console.log('🏭 Initializing Solana Agent Factory...');

    const result = await BlockchainService.initializeFactory();

    res.json({
      success: true,
      signature: result.signature,
      factoryPda: result.factoryPda,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error initializing factory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize factory',
      details: error.message
    });
  }
});

// POST /api/blockchain/create-agent - Create a new agent
router.post('/create-agent', async (req, res) => {
  try {
    const { name, symbol, description, instructions, model, category } = req.body;

    if (!name || !symbol) {
      return res.status(400).json({ error: 'Missing required fields: name, symbol' });
    }

    console.log(`🤖 Creating agent: ${name} (${symbol})`);

    const result = await BlockchainService.createAgent({
      name,
      symbol,
      description,
      instructions,
      model,
      category
    });

    res.json({
      success: true,
      signature: result.signature,
      agentAddress: result.agentAddress,
      mintAddress: result.mintAddress,
      agentId: result.agentId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error creating agent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create agent',
      details: error.message
    });
  }
});

// POST /api/blockchain/buy-tokens - Buy agent tokens
router.post('/buy-tokens', async (req, res) => {
  try {
    const { agentAddress, solAmount, minTokensOut, buyerPublicKey } = req.body;

    if (!agentAddress || !solAmount) {
      return res.status(400).json({ error: 'Missing required fields: agentAddress, solAmount' });
    }

    console.log(`💰 Buying tokens for agent: ${agentAddress}, amount: ${solAmount} SOL`);

    const result = await BlockchainService.buyTokens({
      agentAddress,
      solAmount,
      minTokensOut,
      buyerPublicKey
    });

    res.json({
      success: true,
      signature: result.signature,
      tokensReceived: result.tokensReceived,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error buying tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to buy tokens',
      details: error.message
    });
  }
});

// POST /api/blockchain/sell-tokens - Sell agent tokens
router.post('/sell-tokens', async (req, res) => {
  try {
    const { agentAddress, tokenAmount, minSolOut, sellerPublicKey } = req.body;

    if (!agentAddress || !tokenAmount) {
      return res.status(400).json({ error: 'Missing required fields: agentAddress, tokenAmount' });
    }

    console.log(`💸 Selling tokens for agent: ${agentAddress}, amount: ${tokenAmount} tokens`);

    const result = await BlockchainService.sellTokens({
      agentAddress,
      tokenAmount,
      minSolOut,
      sellerPublicKey
    });

    res.json({
      success: true,
      signature: result.signature,
      solReceived: result.solReceived,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error selling tokens:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sell tokens',
      details: error.message
    });
  }
});

// GET /api/blockchain/stats - Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const agents = await BlockchainService.getAllAgentsFromChain();

    const stats = {
      totalAgents: agents.length,
      totalValueLocked: agents.reduce((sum, agent) => sum + parseFloat(agent.bondingCurve.virtualSolReserves || 0), 0),
      totalTransactions: agents.reduce((sum, agent) => sum + parseInt(agent.totalTransactions || 0), 0),
      graduatedAgents: agents.filter(agent => agent.isGraduated).length,
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform statistics' });
  }
});

// GET /api/blockchain/agents - Get all agents from chain
router.get('/agents', async (req, res) => {
  try {
    console.log('📋 Fetching all agents from Solana...');

    const agents = await BlockchainService.getAllAgentsFromChain();

    res.json({
      success: true,
      agents,
      count: agents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents from chain' });
  }
});

// GET /api/blockchain/agents/:address - Get specific agent details
router.get('/agents/:address', async (req, res) => {
  try {
    const { address } = req.params;

    try {
      new PublicKey(address);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid Solana address format' });
    }

    console.log(`🔍 Fetching agent details: ${address}`);

    const agent = await BlockchainService.getAgentByAddress(address);

    res.json({
      success: true,
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching agent details:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

// GET /api/blockchain/creation-fee - Get current creation fee
router.get('/creation-fee', async (req, res) => {
  try {
    // On Solana, creation fee is minimal (just rent + transaction fees)
    const fee = '0.01'; // Approximate SOL needed for rent + tx fees

    res.json({
      creationFee: fee,
      currency: 'SOL',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching creation fee:', error);
    res.status(500).json({ error: 'Failed to fetch creation fee' });
  }
});

// GET /api/blockchain/network-info - Get network information
router.get('/network-info', async (req, res) => {
  try {
    const networkStatus = await BlockchainService.getNetworkStatus();

    res.json({
      network: {
        name: 'Solana Devnet',
        cluster: networkStatus.cluster,
        slot: networkStatus.slot,
        version: networkStatus.version,
        epochInfo: networkStatus.epochInfo
      },
      program: {
        programId: BlockchainService.programId.toString(),
        factoryPda: BlockchainService.factoryPda.toString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching network info:', error);
    res.status(500).json({ error: 'Failed to fetch network information' });
  }
});

// GET /api/blockchain/transaction/:signature/agent - Get agent from transaction signature
router.get('/transaction/:signature/agent', async (req, res) => {
  try {
    const { signature } = req.params;

    console.log('🔍 Looking up agent address for transaction:', signature);

    const transaction = await BlockchainService.getTransaction(signature);

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'TRANSACTION_NOT_FOUND' });
    }

    // Parse transaction logs to find agent creation
    // This is a simplified version - in production you'd parse program logs
    const agents = await BlockchainService.getAllAgentsFromChain();

    // Find the most recently created agent (this is a simplification)
    const latestAgent = agents.reduce((max, agent) =>
      parseInt(agent.agentId) > parseInt(max.agentId) ? agent : max
    );

    res.json({
      success: true,
      data: {
        transactionSignature: signature,
        agentAddress: latestAgent.address,
        creator: latestAgent.creator,
        name: latestAgent.name,
        symbol: latestAgent.symbol,
        description: latestAgent.description,
        category: latestAgent.category
      }
    });

  } catch (error) {
    console.error('❌ Error getting agent address from transaction:', error);
    res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_AGENT_FROM_TRANSACTION',
      details: error.message
    });
  }
});

module.exports = router;
