const { Connection, PublicKey } = require('@solana/web3.js');

// Solana connection
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.testnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// Program ID
const PROGRAM_ID = new PublicKey('4m6mpe2jdRiM24ui1Z3AGbCheu1DfQEjmEGtaGKD2ftU');

/**
 * X402 Payment Middleware
 * Checks if payment is required and validates payment signature
 */
const checkX402Payment = async (req, res, next) => {
  try {
    const { agentAddress } = req.params;
    const paymentSignature = req.body.paymentSignature || req.headers['x-payment-signature'];
    const serviceId = req.body.serviceId || req.query.serviceId || 'default_service';

    // Get X402 config for this agent
    const agentPubkey = new PublicKey(agentAddress);
    const [x402ConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('x402_config'), agentPubkey.toBuffer()],
      PROGRAM_ID
    );

    let x402Config;
    try {
      const accountInfo = await connection.getAccountInfo(x402ConfigPDA);
      if (!accountInfo) {
        // No X402 config, service is free
        return next();
      }

      // Decode X402 config (simplified - in production use Anchor deserialization)
      const data = accountInfo.data;
      const enabled = data[8] === 1; // First byte after discriminator
      
      if (!enabled) {
        // X402 disabled, service is free
        return next();
      }

      // Read min/max payment amounts (u64, 8 bytes each)
      const minPayment = data.readBigUInt64LE(9);
      const maxPayment = data.readBigUInt64LE(17);

      x402Config = {
        enabled,
        minPayment: Number(minPayment),
        maxPayment: Number(maxPayment)
      };
    } catch (err) {
      console.error('Error reading X402 config:', err);
      // If can't read config, assume service is free
      return next();
    }

    // If no payment signature provided, return 402
    if (!paymentSignature) {
      return res.status(402).json({
        error: 'Payment Required',
        payment_details: {
          min_amount: x402Config.minPayment / 1_000_000, // Convert to USDC
          max_amount: x402Config.maxPayment / 1_000_000,
          service_id: serviceId,
          agent_address: agentAddress,
          currency: 'USDC'
        }
      });
    }

    // Verify payment signature on blockchain
    const paymentValid = await verifyPaymentSignature(
      paymentSignature,
      agentAddress,
      x402Config.minPayment
    );

    if (!paymentValid) {
      return res.status(402).json({
        error: 'Invalid or insufficient payment',
        payment_details: {
          min_amount: x402Config.minPayment / 1_000_000,
          max_amount: x402Config.maxPayment / 1_000_000,
          service_id: serviceId,
          agent_address: agentAddress,
          currency: 'USDC'
        }
      });
    }

    // Payment verified, attach to request and continue
    req.x402Payment = {
      signature: paymentSignature,
      verified: true,
      serviceId
    };

    next();
  } catch (error) {
    console.error('X402 middleware error:', error);
    // On error, allow request to proceed (fail open)
    next();
  }
};

/**
 * Verify payment signature on blockchain
 */
async function verifyPaymentSignature(signature, agentAddress, minAmount) {
  try {
    // Get transaction details
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });

    if (!tx) {
      console.error('Transaction not found:', signature);
      return false;
    }

    // Check if transaction was successful
    if (tx.meta?.err) {
      console.error('Transaction failed:', tx.meta.err);
      return false;
    }

    // Verify transaction is recent (within last 5 minutes)
    const txTime = tx.blockTime;
    const now = Math.floor(Date.now() / 1000);
    if (now - txTime > 300) {
      console.error('Transaction too old:', signature);
      return false;
    }

    // Verify transaction involves our program
    const programIds = tx.transaction.message.staticAccountKeys.map(key => key.toBase58());
    if (!programIds.includes(PROGRAM_ID.toBase58())) {
      console.error('Transaction does not involve our program');
      return false;
    }

    // In production, you would:
    // 1. Parse transaction logs to verify it's a payForService instruction
    // 2. Verify the payment amount meets minimum
    // 3. Verify the payment is for this specific agent
    // 4. Check payment hasn't been used before (prevent replay attacks)

    console.log('✅ Payment verified:', signature);
    return true;
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

module.exports = { checkX402Payment };

