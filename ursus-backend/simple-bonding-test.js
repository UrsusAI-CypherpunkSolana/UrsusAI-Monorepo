/**
 * Simple Bonding Curve Test
 * Creates an agent and tests buy/sell functionality
 */

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } = require('@solana/web3.js');
const { AnchorProvider, Program, BN, Wallet } = require('@coral-xyz/anchor');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load IDL
const idlPath = path.join(__dirname, '../ursus-solana/target/idl/agent_factory.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

// Configuration
const PROGRAM_ID = new PublicKey('GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345');
const RPC_URL = 'https://api.testnet.solana.com';
const PLATFORM_TREASURY = new PublicKey('Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS');

async function testBondingCurve() {
  console.log('🧪 Simple Bonding Curve Test\n');

  // Load wallet
  const privateKeyStr = process.env.SOLANA_WALLET_PRIVATE_KEY;
  if (!privateKeyStr) {
    console.error('❌ SOLANA_WALLET_PRIVATE_KEY not found');
    process.exit(1);
  }

  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(privateKeyStr))
  );
  console.log('💼 Wallet:', walletKeypair.publicKey.toBase58());

  // Create connection
  const connection = new Connection(RPC_URL, 'confirmed');
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log('💰 Balance:', balance / LAMPORTS_PER_SOL, 'SOL\n');

  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient balance. Need at least 0.1 SOL');
    process.exit(1);
  }

  // Create provider and program
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl, PROGRAM_ID, provider);

  // Get factory PDA
  const [factoryPda] = await PublicKey.findProgramAddress(
    [Buffer.from('factory')],
    PROGRAM_ID
  );

  console.log('🏭 Factory PDA:', factoryPda.toBase58());

  try {
    // Fetch factory
    const factory = await program.account.agentFactory.fetch(factoryPda);
    console.log('✅ Factory found');
    console.log('   Total Agents:', factory.totalAgents.toString());
    console.log('   Creation Fee:', factory.creationFee.toString(), 'lamports\n');

    // Create a new agent
    console.log('📝 Creating new agent...');
    const agentId = factory.totalAgents;
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

    // Create agent (6 parameters: name, symbol, description, instructions, model, category)
    const createTx = await program.methods
      .createAgent(
        'Bonding Test',
        'BOND',
        'Testing bonding curve functionality',
        'You are a helpful AI agent for testing bonding curves',
        'gpt-4',
        'test'
      )
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
      .rpc();

    console.log('✅ Agent created! TX:', createTx);
    await connection.confirmTransaction(createTx, 'confirmed');

    // Fetch agent data
    let agentData = await program.account.agent.fetch(agentPda);
    console.log('\n📊 Agent Created:');
    console.log('   Name:', agentData.tokenName);
    console.log('   Symbol:', agentData.tokenSymbol);
    console.log('   Creator:', agentData.creator.toBase58());
    console.log('   Graduated:', agentData.isGraduated);
    console.log('\n💹 Initial Bonding Curve:');
    console.log('   Virtual SOL:', agentData.bondingCurve.virtualSolReserves.toString());
    console.log('   Virtual Tokens:', agentData.bondingCurve.virtualTokenReserves.toString());
    console.log('   Real SOL:', agentData.bondingCurve.realSolReserves.toString());
    console.log('   Real Tokens:', agentData.bondingCurve.realTokenReserves.toString());

    // Buy tokens
    console.log('\n💰 Buying tokens with 0.01 SOL...');
    const buyAmount = new BN(0.01 * LAMPORTS_PER_SOL);

    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintPda,
      walletKeypair.publicKey
    );

    // Check if token account exists
    const accountInfo = await connection.getAccountInfo(buyerTokenAccount);
    const preInstructions = [];

    if (!accountInfo) {
      console.log('📝 Creating token account...');
      preInstructions.push(
        createAssociatedTokenAccountInstruction(
          walletKeypair.publicKey,
          buyerTokenAccount,
          walletKeypair.publicKey,
          mintPda,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    const buyTx = await program.methods
      .buyTokens(buyAmount, new BN(0))
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
      .preInstructions(preInstructions)
      .rpc();

    console.log('✅ Tokens bought! TX:', buyTx);
    await connection.confirmTransaction(buyTx, 'confirmed');

    // Fetch updated agent data
    agentData = await program.account.agent.fetch(agentPda);
    console.log('\n💹 Updated Bonding Curve:');
    console.log('   Virtual SOL:', agentData.bondingCurve.virtualSolReserves.toString());
    console.log('   Virtual Tokens:', agentData.bondingCurve.virtualTokenReserves.toString());
    console.log('   Real SOL:', agentData.bondingCurve.realSolReserves.toString());
    console.log('   Real Tokens:', agentData.bondingCurve.realTokenReserves.toString());

    // Check token balance
    const tokenBalance = await connection.getTokenAccountBalance(buyerTokenAccount);
    console.log('   Your Token Balance:', tokenBalance.value.uiAmount, 'BOND');

    // Calculate price (use toString to avoid overflow)
    const virtualSol = parseFloat(agentData.bondingCurve.virtualSolReserves.toString());
    const virtualTokens = parseFloat(agentData.bondingCurve.virtualTokenReserves.toString());
    const price = virtualSol / virtualTokens;
    console.log('   Current Price:', price.toExponential(6), 'SOL per token');

    console.log('\n✅ Bonding Curve Test Completed Successfully!');
    console.log('\n📝 Summary:');
    console.log('   Agent Address:', agentPda.toBase58());
    console.log('   Mint Address:', mintPda.toBase58());
    console.log('   Create TX:', createTx);
    console.log('   Buy TX:', buyTx);
    console.log('\n🎯 You can now test this agent in the frontend!');
    console.log('   Use this address:', agentPda.toBase58());

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.logs) {
      console.error('\n📋 Program Logs:');
      error.logs.forEach(log => console.error('  ', log));
    }
    process.exit(1);
  }
}

testBondingCurve().catch(console.error);

