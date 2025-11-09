import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// Test USDC token mint (created specifically for this project on testnet)
const USDC_MINT_TESTNET = new PublicKey('2XEkLLnaAqiN7EU2fi54FxAXCSKerbPPBPY4MXVRP94k');
const USDC_DECIMALS = 1_000_000; // 6 decimals

async function mintTestUSDC() {
  try {
    console.log('🚀 Starting USDC Mint Process...\n');

    // Connect to Solana testnet
    const connection = new Connection('https://api.testnet.solana.com', 'confirmed');
    console.log('✅ Connected to Solana testnet');

    // Load wallet keypair
    const walletPath = path.join(process.env.HOME || '', '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
      console.error('❌ Wallet not found at:', walletPath);
      console.log('Please create a wallet first: solana-keygen new');
      process.exit(1);
    }

    const walletKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
    );
    
    console.log('✅ Loaded wallet:', walletKeypair.publicKey.toBase58());

    // Check SOL balance
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log('💰 SOL Balance:', balance / 1e9, 'SOL');

    if (balance < 0.01 * 1e9) {
      console.log('\n⚠️  Low SOL balance! Get testnet SOL from:');
      console.log('   https://faucet.solana.com');
      console.log('   or run: solana airdrop 2');
      process.exit(1);
    }

    // Get or create associated token account
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT_TESTNET,
      walletKeypair.publicKey
    );

    console.log('\n📦 USDC Token Account:', tokenAccount.toBase58());

    const accountInfo = await connection.getAccountInfo(tokenAccount);
    
    const transaction = new Transaction();

    if (!accountInfo) {
      console.log('⚙️  Creating USDC token account...');
      
      const createAccountIx = createAssociatedTokenAccountInstruction(
        walletKeypair.publicKey, // payer
        tokenAccount, // ata
        walletKeypair.publicKey, // owner
        USDC_MINT_TESTNET // mint
      );
      
      transaction.add(createAccountIx);
    } else {
      console.log('✅ USDC token account already exists');
    }

    // Mint 1000 USDC to the account
    const mintAmount = 1000 * USDC_DECIMALS; // 1000 USDC
    
    console.log('\n💵 Minting', mintAmount / USDC_DECIMALS, 'USDC...');
    
    // Note: This will only work if your wallet is the mint authority
    // For testing, you need to be the mint authority of the test USDC token
    const mintIx = createMintToInstruction(
      USDC_MINT_TESTNET, // mint
      tokenAccount, // destination
      walletKeypair.publicKey, // mint authority
      mintAmount // amount
    );
    
    transaction.add(mintIx);

    // Send transaction
    console.log('📤 Sending transaction...');
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [walletKeypair],
      { commitment: 'confirmed' }
    );

    console.log('\n✅ Success!');
    console.log('📝 Transaction signature:', signature);
    console.log('🔗 View on Solscan:', `https://solscan.io/tx/${signature}?cluster=testnet`);
    
    // Check token balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(tokenAccount);
    console.log('\n💰 USDC Balance:', tokenAccountInfo.value.uiAmount, 'USDC');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    
    if (error.message.includes('mint authority')) {
      console.log('\n⚠️  You are not the mint authority for this USDC token.');
      console.log('This is expected! The test USDC token has a different mint authority.');
      console.log('\nTo get test USDC, you need to:');
      console.log('1. Contact the mint authority to mint tokens for you');
      console.log('2. Or create your own test token with: spl-token create-token');
    }
    
    process.exit(1);
  }
}

mintTestUSDC();

