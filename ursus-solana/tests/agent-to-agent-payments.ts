import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentFactory } from "../target/types/agent_factory";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("Agent-to-Agent X402 Payments", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentFactory as Program<AgentFactory>;
  
  const authority = provider.wallet as anchor.Wallet;
  const callerCreator = Keypair.generate();
  const targetCreator = Keypair.generate();
  const platformTreasury = Keypair.generate();
  
  let factoryPda: PublicKey;
  let callerAgentPda: PublicKey;
  let targetAgentPda: PublicKey;
  let callerMintPda: PublicKey;
  let targetMintPda: PublicKey;
  let targetX402ConfigPda: PublicKey;
  let paymentRecordPda: PublicKey;
  
  const CREATION_FEE = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
  const MIN_PAYMENT = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
  const MAX_PAYMENT = new anchor.BN(1 * LAMPORTS_PER_SOL);
  const SERVICE_TIMEOUT = new anchor.BN(300);
  
  before(async () => {
    // Airdrop SOL
    await Promise.all([
      provider.connection.requestAirdrop(callerCreator.publicKey, 3 * LAMPORTS_PER_SOL),
      provider.connection.requestAirdrop(targetCreator.publicKey, 3 * LAMPORTS_PER_SOL),
    ].map(sig => provider.connection.confirmTransaction(sig)));
    
    [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );
    
    // Initialize factory
    await program.methods
      .initialize(CREATION_FEE)
      .accounts({
        factory: factoryPda,
        authority: authority.publicKey,
        platformTreasury: platformTreasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });
  
  it("Creates caller agent (Market Analyzer)", async () => {
    let factory = await program.account.agentFactory.fetch(factoryPda);
    
    [callerAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), factory.totalAgents.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    [callerMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), callerAgentPda.toBuffer()],
      program.programId
    );
    
    await program.methods
      .createAgent(
        "Market Analyzer",
        "MKTAI",
        "AI agent for market analysis",
        "Analyze crypto market trends",
        "GPT-4",
        "Trading"
      )
      .accounts({
        factory: factoryPda,
        agent: callerAgentPda,
        mint: callerMintPda,
        creator: callerCreator.publicKey,
        platformTreasury: platformTreasury.publicKey,
      })
      .signers([callerCreator])
      .rpc();
    
    const agent = await program.account.agent.fetch(callerAgentPda);
    expect(agent.name).to.equal("Market Analyzer");
  });
  
  it("Creates target agent (Data Provider)", async () => {
    let factory = await program.account.agentFactory.fetch(factoryPda);
    
    [targetAgentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), factory.totalAgents.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    [targetMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), targetAgentPda.toBuffer()],
      program.programId
    );
    
    await program.methods
      .createAgent(
        "Data Provider",
        "DATAI",
        "AI agent providing market data",
        "Provide real-time market data and analytics",
        "GPT-4",
        "Data"
      )
      .accounts({
        factory: factoryPda,
        agent: targetAgentPda,
        mint: targetMintPda,
        creator: targetCreator.publicKey,
        platformTreasury: platformTreasury.publicKey,
      })
      .signers([targetCreator])
      .rpc();
    
    const agent = await program.account.agent.fetch(targetAgentPda);
    expect(agent.name).to.equal("Data Provider");
  });
  
  it("Configures X402 for target agent", async () => {
    [targetX402ConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("x402_config"), targetAgentPda.toBuffer()],
      program.programId
    );
    
    await program.methods
      .configureX402(
        true,
        MIN_PAYMENT,
        MAX_PAYMENT,
        SERVICE_TIMEOUT
      )
      .accounts({
        agent: targetAgentPda,
        x402Config: targetX402ConfigPda,
        creator: targetCreator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([targetCreator])
      .rpc();
    
    const config = await program.account.x402Config.fetch(targetX402ConfigPda);
    expect(config.enabled).to.be.true;
  });
  
  it("Caller agent pays target agent for service", async () => {
    const x402Config = await program.account.x402Config.fetch(targetX402ConfigPda);
    const nonce = x402Config.nonce.add(new anchor.BN(1));
    const paymentAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
    const serviceId = "get_market_data";
    const serviceParams = Buffer.from(JSON.stringify({
      symbol: "SOL/USD",
      timeframe: "1h",
      indicators: ["RSI", "MACD"]
    }));
    
    [paymentRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_record"),
        targetAgentPda.toBuffer(),
        callerAgentPda.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    
    const targetCreatorBalanceBefore = await provider.connection.getBalance(targetCreator.publicKey);
    
    await program.methods
      .callAgentService(
        paymentAmount,
        serviceId,
        nonce,
        Array.from(serviceParams)
      )
      .accounts({
        callerAgent: callerAgentPda,
        targetAgent: targetAgentPda,
        targetX402Config: targetX402ConfigPda,
        paymentRecord: paymentRecordPda,
        callerAuthority: callerCreator.publicKey,
        targetPaymentRecipient: targetCreator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([callerCreator])
      .rpc();
    
    const targetCreatorBalanceAfter = await provider.connection.getBalance(targetCreator.publicKey);
    const paymentRecord = await program.account.x402PaymentRecord.fetch(paymentRecordPda);
    const updatedConfig = await program.account.x402Config.fetch(targetX402ConfigPda);
    
    // Verify payment was transferred
    expect(targetCreatorBalanceAfter - targetCreatorBalanceBefore).to.equal(paymentAmount.toNumber());
    
    // Verify payment record
    expect(paymentRecord.amount.toString()).to.equal(paymentAmount.toString());
    expect(paymentRecord.serviceId).to.equal(serviceId);
    expect(paymentRecord.payer.toString()).to.equal(callerAgentPda.toString());
    expect(paymentRecord.agent.toString()).to.equal(targetAgentPda.toString());
    
    // Verify config was updated
    expect(updatedConfig.totalPaymentsReceived.toString()).to.equal(paymentAmount.toString());
    expect(updatedConfig.totalServiceCalls.toString()).to.equal("1");
    expect(updatedConfig.nonce.toString()).to.equal(nonce.toString());
    
    console.log("✅ Agent-to-Agent payment successful!");
    console.log(`   Caller: ${callerAgentPda.toString().slice(0, 8)}...`);
    console.log(`   Target: ${targetAgentPda.toString().slice(0, 8)}...`);
    console.log(`   Service: ${serviceId}`);
    console.log(`   Amount: ${paymentAmount.toNumber() / LAMPORTS_PER_SOL} SOL`);
  });
  
  it("Multiple agent-to-agent service calls", async () => {
    const services = [
      { id: "get_price_feed", amount: 0.02 },
      { id: "get_volume_data", amount: 0.03 },
      { id: "get_orderbook", amount: 0.04 },
    ];
    
    for (const service of services) {
      const x402Config = await program.account.x402Config.fetch(targetX402ConfigPda);
      const nonce = x402Config.nonce.add(new anchor.BN(1));
      const paymentAmount = new anchor.BN(service.amount * LAMPORTS_PER_SOL);
      const serviceParams = Buffer.from(JSON.stringify({ service: service.id }));
      
      [paymentRecordPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("payment_record"),
          targetAgentPda.toBuffer(),
          callerAgentPda.toBuffer(),
          nonce.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      
      await program.methods
        .callAgentService(
          paymentAmount,
          service.id,
          nonce,
          Array.from(serviceParams)
        )
        .accounts({
          callerAgent: callerAgentPda,
          targetAgent: targetAgentPda,
          targetX402Config: targetX402ConfigPda,
          paymentRecord: paymentRecordPda,
          callerAuthority: callerCreator.publicKey,
          targetPaymentRecipient: targetCreator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([callerCreator])
        .rpc();
      
      console.log(`✅ Service call: ${service.id} - ${service.amount} SOL`);
    }
    
    const finalConfig = await program.account.x402Config.fetch(targetX402ConfigPda);
    const totalExpected = services.reduce((sum, s) => sum + s.amount, 0.05); // Including first payment
    
    expect(finalConfig.totalServiceCalls.toString()).to.equal("4");
    expect(finalConfig.totalPaymentsReceived.toNumber() / LAMPORTS_PER_SOL).to.be.closeTo(totalExpected, 0.001);
    
    console.log(`\n📊 Total service calls: ${finalConfig.totalServiceCalls.toString()}`);
    console.log(`💰 Total payments received: ${finalConfig.totalPaymentsReceived.toNumber() / LAMPORTS_PER_SOL} SOL`);
  });
});

