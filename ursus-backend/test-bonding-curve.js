/**
 * Bonding Curve Test Script
 * Tests the complete bonding curve functionality:
 * 1. Create a real agent on Solana
 * 2. Buy tokens using bonding curve
 * 3. Check bonding curve state
 * 4. Sell tokens using bonding curve
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, BN } = require('@coral-xyz/anchor');
const { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load IDL
const idlPath = path.join(__dirname, '../ursus-solana/target/idl/agent_factory.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Configuration
const PROGRAM_ID = new PublicKey('GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345');
const RPC_URL = 'https://api.testnet.solana.com';

// Platform treasury (from your backend config)
const PLATFORM_TREASURY = new PublicKey('Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS');

async function main() {
  console.log('🧪 Starting Bonding Curve Test...\n');

  // Load wallet from environment variable
  const privateKeyStr = process.env.SOLANA_WALLET_PRIVATE_KEY;
  if (!privateKeyStr) {
    console.error('❌ SOLANA_WALLET_PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  const privateKeyArray = JSON.parse(privateKeyStr);
  const secretKey = Uint8Array.from(privateKeyArray);
  const walletKeypair = Keypair.fromSecretKey(secretKey);
  console.log('💼 Wallet:', walletKeypair.publicKey.toBase58());

  // Create connection
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Check wallet balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('💰 Wallet balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient balance. Need at least 0.1 SOL for testing.');
    console.log('Get testnet SOL from: https://faucet.solana.com/');
    process.exit(1);
  }

  // Create wallet wrapper
  const { Wallet } = require('@coral-xyz/anchor');
  const wallet = new Wallet(walletKeypair);

  // Create provider
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'confirmed' }
  );

  // Initialize program
  const program = new Program(idl, PROGRAM_ID, provider);
  console.log('📋 Program ID:', PROGRAM_ID.toBase58());

  // Get factory PDA
  const [factoryPda] = await PublicKey.findProgramAddress(
    [Buffer.from('factory')],
    PROGRAM_ID
  );
  console.log('🏭 Factory PDA:', factoryPda.toBase58());

  try {
    // Fetch factory to get next agent ID
    let factory;
    try {
      factory = await program.account.agentFactory.fetch(factoryPda);
      console.log('✅ Factory found:', factory);
    } catch (error) {
      console.error('❌ Factory not found. Initializing factory...');

      // Initialize factory
      const initTx = await program.methods
        .initialize(new BN(100000000)) // 0.1 SOL creation fee
        .accounts({
          factory: factoryPda,
          authority: walletKeypair.publicKey,
          platformTreasury: PLATFORM_TREASURY,
          systemProgram: SystemProgram.programId,
        })
        .signers([walletKeypair])
        .rpc();

      console.log('✅ Factory initialized! TX:', initTx);
      await connection.confirmTransaction(initTx, 'confirmed');

      // Fetch factory again
      factory = await program.account.agentFactory.fetch(factoryPda);
    }

    const agentId = factory.totalAgents;
    console.log('🆔 Next Agent ID:', agentId.toString(), '\n');

    // Step 1: Create Agent
    console.log('📝 Step 1: Creating Agent...');
    const agentIdBytes = agentId.toArrayLike(Buffer, 'le', 8);
    const [agentPda] = await PublicKey.findProgramAddress(
      [Buffer.from('agent'), agentIdBytes],
      PROGRAM_ID
    );

    const [mintPda] = await PublicKey.findProgramAddress(
      [Buffer.from('mint'), agentPda.toBuffer()],
      PROGRAM_ID
    );

    console.log('🤖 Agent PDA:', agentPda.toBase58());
    console.log('🪙 Mint PDA:', mintPda.toBase58());

    const tokenName = 'Test Bonding Curve';
    const tokenSymbol = 'TBC';
    const tokenUri = 'https://example.com/metadata.json';

    const createTx = await program.methods
      .createAgent(tokenName, tokenSymbol, tokenUri)
      .accounts({
        factory: factoryPda,
        agent: agentPda,
        mint: mintPda,
        creator: walletKeypair.publicKey,
        platformTreasury: PLATFORM_TREASURY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
      })
      .signers([walletKeypair])
      .rpc();

    console.log('✅ Agent created! TX:', createTx);
    await connection.confirmTransaction(createTx, 'confirmed');

    // Fetch agent data
    let agentData = await program.account.agent.fetch(agentPda);
    console.log('\n📊 Agent Data:');
    console.log('  - Token Name:', agentData.tokenName);
    console.log('  - Token Symbol:', agentData.tokenSymbol);
    console.log('  - Creator:', agentData.creator.toBase58());
    console.log('  - Is Graduated:', agentData.isGraduated);
    console.log('  - Bonding Curve:');
    console.log('    - Virtual SOL Reserves:', agentData.bondingCurve.virtualSolReserves.toString());
    console.log('    - Virtual Token Reserves:', agentData.bondingCurve.virtualTokenReserves.toString());
    console.log('    - Real SOL Reserves:', agentData.bondingCurve.realSolReserves.toString());
    console.log('    - Real Token Reserves:', agentData.bondingCurve.realTokenReserves.toString());

    // Step 2: Buy Tokens
    console.log('\n💰 Step 2: Buying Tokens...');
    const buyAmount = 0.01; // 0.01 SOL
    const buyAmountLamports = new BN(buyAmount * LAMPORTS_PER_SOL);

    // Get buyer's token account
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintPda,
      walletKeypair.publicKey
    );

    console.log('🛒 Buying', buyAmount, 'SOL worth of tokens...');
    console.log('👛 Buyer Token Account:', buyerTokenAccount.toBase58());

    const buyTx = await program.methods
      .buyTokens(buyAmountLamports, new BN(0))
      .accounts({
        agent: agentPda,
        mint: mintPda,
        buyerTokenAccount: buyerTokenAccount,
        buyer: walletKeypair.publicKey,
        creator: agentData.creator,
        platformTreasury: PLATFORM_TREASURY,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    console.log('✅ Tokens bought! TX:', buyTx);
    await connection.confirmTransaction(buyTx, 'confirmed');

    // Fetch updated agent data
    agentData = await program.account.agent.fetch(agentPda);
    console.log('\n📊 Updated Bonding Curve State:');
    console.log('  - Virtual SOL Reserves:', agentData.bondingCurve.virtualSolReserves.toString());
    console.log('  - Virtual Token Reserves:', agentData.bondingCurve.virtualTokenReserves.toString());
    console.log('  - Real SOL Reserves:', agentData.bondingCurve.realSolReserves.toString());
    console.log('  - Real Token Reserves:', agentData.bondingCurve.realTokenReserves.toString());

    // Check buyer's token balance
    const tokenAccountInfo = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log('  - Buyer Token Balance:', tokenAccountInfo.value.uiAmount, tokenSymbol);

    // Step 3: Calculate current price
    const virtualSolReserves = agentData.bondingCurve.virtualSolReserves.toNumber();
    const virtualTokenReserves = agentData.bondingCurve.virtualTokenReserves.toNumber();
    const currentPrice = virtualSolReserves / virtualTokenReserves;
    console.log('  - Current Price:', currentPrice.toFixed(9), 'SOL per token');

    // Step 4: Sell some tokens
    console.log('\n💸 Step 3: Selling Tokens...');
    const sellAmount = Math.floor(tokenAccountInfo.value.uiAmount * 0.5); // Sell 50% of tokens
    const sellAmountBN = new BN(sellAmount * 1e9); // Convert to smallest unit

    console.log('📤 Selling', sellAmount, 'tokens...');

    const sellTx = await program.methods
      .sellTokens(sellAmountBN, new BN(0))
      .accounts({
        agent: agentPda,
        mint: mintPda,
        sellerTokenAccount: buyerTokenAccount,
        seller: walletKeypair.publicKey,
        creator: agentData.creator,
        platformTreasury: PLATFORM_TREASURY,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();

    console.log('✅ Tokens sold! TX:', sellTx);
    await connection.confirmTransaction(sellTx, 'confirmed');

    // Fetch final agent data
    agentData = await program.account.agent.fetch(agentPda);
    console.log('\n📊 Final Bonding Curve State:');
    console.log('  - Virtual SOL Reserves:', agentData.bondingCurve.virtualSolReserves.toString());
    console.log('  - Virtual Token Reserves:', agentData.bondingCurve.virtualTokenReserves.toString());
    console.log('  - Real SOL Reserves:', agentData.bondingCurve.realSolReserves.toString());
    console.log('  - Real Token Reserves:', agentData.bondingCurve.realTokenReserves.toString());

    // Check final token balance
    const finalTokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log('  - Final Buyer Token Balance:', finalTokenBalance.value.uiAmount, tokenSymbol);

    console.log('\n✅ Bonding Curve Test Completed Successfully!');
    console.log('\n📝 Summary:');
    console.log('  - Agent Address:', agentPda.toBase58());
    console.log('  - Mint Address:', mintPda.toBase58());
    console.log('  - Create TX:', createTx);
    console.log('  - Buy TX:', buyTx);
    console.log('  - Sell TX:', sellTx);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error.logs) {
      console.error('\n📋 Program Logs:');
      error.logs.forEach(log => console.error('  ', log));
    }
    process.exit(1);
  }
}

main().catch(console.error);

