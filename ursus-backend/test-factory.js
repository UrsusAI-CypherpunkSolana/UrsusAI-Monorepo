const { Connection, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Program, Wallet } = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

async function testFactory() {
  try {
    // Load IDL
    const idlPath = path.join(__dirname, 'idl/agent_factory.json');
    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));

    // Connect to devnet
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    
    // Create a dummy wallet (we don't need to sign anything)
    const dummyKeypair = require('@solana/web3.js').Keypair.generate();
    const wallet = new Wallet(dummyKeypair);
    
    // Create provider
    const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
    
    // Initialize program
    const programId = new PublicKey('GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345');
    const program = new Program(idl, programId, provider);
    
    // Derive factory PDA
    const [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('factory')],
      programId
    );
    
    console.log('🏭 Factory PDA:', factoryPda.toString());
    
    // Fetch factory account
    const factoryAccount = await program.account.agentFactory.fetch(factoryPda);
    
    console.log('\n📊 Factory Account Data:');
    console.log('  Authority:', factoryAccount.authority.toString());
    console.log('  Platform Treasury:', factoryAccount.platformTreasury.toString());
    console.log('  Total Agents:', factoryAccount.totalAgents.toString());
    console.log('  Creation Fee:', factoryAccount.creationFee.toString(), 'lamports');
    console.log('  Platform Fee:', factoryAccount.platformFee, 'bps');
    console.log('  Creator Fee:', factoryAccount.creatorFee, 'bps');
    console.log('  Bump:', factoryAccount.bump);
    
    // Calculate what the next agent PDA should be
    const nextAgentId = factoryAccount.totalAgents;
    console.log('\n🔍 Next Agent ID:', nextAgentId.toString());
    
    // Convert to buffer (little-endian 8 bytes)
    const agentIdBuffer = Buffer.alloc(8);
    nextAgentId.toArrayLike(Buffer, 'le', 8).copy(agentIdBuffer);
    
    console.log('📦 Agent ID Buffer (hex):', agentIdBuffer.toString('hex'));
    console.log('📦 Agent ID Buffer (decimal):', Array.from(agentIdBuffer));
    
    // Derive agent PDA
    const [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent'), agentIdBuffer],
      programId
    );
    
    console.log('\n📍 Expected Agent PDA:', agentPda.toString());
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testFactory();

