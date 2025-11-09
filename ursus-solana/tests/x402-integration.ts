import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("X402 Payment Protocol Integration", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentFactory as Program<any>;
  
  // Test accounts
  const authority = provider.wallet as anchor.Wallet;
  const creator = Keypair.generate();
  const payer = Keypair.generate();
  const platformTreasury = Keypair.generate();
  
  let factoryPda: PublicKey;
  let agentPda: PublicKey;
  let mintPda: PublicKey;
  let x402ConfigPda: PublicKey;
  let paymentRecordPda: PublicKey;
  
  const CREATION_FEE = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
  const MIN_PAYMENT = new anchor.BN(0.01 * LAMPORTS_PER_SOL);
  const MAX_PAYMENT = new anchor.BN(1 * LAMPORTS_PER_SOL);
  const SERVICE_TIMEOUT = new anchor.BN(300); // 5 minutes
  
  before(async () => {
    // Airdrop SOL to test accounts
    const airdropSignature = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature, 'confirmed');

    const payerAirdrop = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(payerAirdrop, 'confirmed');
    
    // Derive PDAs
    [factoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );
  });
  
  it("Initializes the factory", async () => {
    await program.methods
      .initialize(CREATION_FEE)
      .accounts({
        factory: factoryPda,
        authority: authority.publicKey,
        platformTreasury: platformTreasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    const factory: any = await program.account.agentFactory.fetch(factoryPda);
    expect(factory.creationFee.toString()).to.equal(CREATION_FEE.toString());
    expect(factory.totalAgents.toString()).to.equal("0");
  });
  
  it("Creates an AI agent", async () => {
    const factory: any = await program.account.agentFactory.fetch(factoryPda);

    [agentPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), factory.totalAgents.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [mintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), agentPda.toBuffer()],
      program.programId
    );

    await program.methods
      .createAgent(
        "Market Analyzer",
        "MKTAI",
        "AI agent for market analysis",
        "Analyze crypto market trends and provide insights",
        "GPT-4",
        "Trading"
      )
      .accounts({
        factory: factoryPda,
        agent: agentPda,
        mint: mintPda,
        creator: creator.publicKey,
        platformTreasury: platformTreasury.publicKey,
      })
      .signers([creator])
      .rpc();

    const agent: any = await program.account.agent.fetch(agentPda);
    expect(agent.name).to.equal("Market Analyzer");
    expect(agent.symbol).to.equal("MKTAI");
  });
  
  it("Configures X402 payment for the agent", async () => {
    [x402ConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("x402_config"), agentPda.toBuffer()],
      program.programId
    );

    await program.methods
      .configureX402(
        true, // enabled
        MIN_PAYMENT,
        MAX_PAYMENT,
        SERVICE_TIMEOUT
      )
      .accounts({
        agent: agentPda,
        x402Config: x402ConfigPda,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const x402Config: any = await program.account.x402Config.fetch(x402ConfigPda);
    expect(x402Config.enabled).to.be.true;
    expect(x402Config.minPaymentAmount.toString()).to.equal(MIN_PAYMENT.toString());
    expect(x402Config.maxPaymentAmount.toString()).to.equal(MAX_PAYMENT.toString());
    expect(x402Config.paymentRecipient.toString()).to.equal(creator.publicKey.toString());
  });
  
  it("Pays for an agent service", async () => {
    const x402Config: any = await program.account.x402Config.fetch(x402ConfigPda);
    const nonce = x402Config.nonce.add(new anchor.BN(1));
    const paymentAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
    const serviceId = "market_analysis";

    [paymentRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_record"),
        agentPda.toBuffer(),
        payer.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    
    const creatorBalanceBefore = await provider.connection.getBalance(creator.publicKey);
    
    await program.methods
      .payForService(
        paymentAmount,
        serviceId,
        nonce
      )
      .accounts({
        agent: agentPda,
        x402Config: x402ConfigPda,
        paymentRecord: paymentRecordPda,
        payer: payer.publicKey,
        paymentRecipient: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    
    const creatorBalanceAfter = await provider.connection.getBalance(creator.publicKey);
    const paymentRecord: any = await program.account.x402PaymentRecord.fetch(paymentRecordPda);
    const updatedConfig: any = await program.account.x402Config.fetch(x402ConfigPda);

    // Verify payment was transferred
    expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(paymentAmount.toNumber());

    // Verify payment record
    expect(paymentRecord.amount.toString()).to.equal(paymentAmount.toString());
    expect(paymentRecord.serviceId).to.equal(serviceId);
    expect(paymentRecord.payer.toString()).to.equal(payer.publicKey.toString());

    // Verify config was updated
    expect(updatedConfig.totalPaymentsReceived.toString()).to.equal(paymentAmount.toString());
    expect(updatedConfig.totalServiceCalls.toString()).to.equal("1");
    expect(updatedConfig.nonce.toString()).to.equal(nonce.toString());
  });

  it("Fails to pay with invalid nonce (replay protection)", async () => {
    const x402Config: any = await program.account.x402Config.fetch(x402ConfigPda);
    const oldNonce = x402Config.nonce; // Using old nonce
    const paymentAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);
    const serviceId = "market_analysis";
    
    [paymentRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_record"),
        agentPda.toBuffer(),
        payer.publicKey.toBuffer(),
        oldNonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    
    try {
      await program.methods
        .payForService(
          paymentAmount,
          serviceId,
          oldNonce
        )
        .accounts({
          agent: agentPda,
          x402Config: x402ConfigPda,
          paymentRecord: paymentRecordPda,
          payer: payer.publicKey,
          paymentRecipient: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      expect.fail("Should have failed with nonce mismatch");
    } catch (error: any) {
      expect(error.toString()).to.include("NonceMismatch");
    }
  });
  
  it("Fails to pay below minimum amount", async () => {
    const x402Config: any = await program.account.x402Config.fetch(x402ConfigPda);
    const nonce = x402Config.nonce.add(new anchor.BN(1));
    const paymentAmount = new anchor.BN(0.001 * LAMPORTS_PER_SOL); // Below minimum
    const serviceId = "market_analysis";
    
    [paymentRecordPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("payment_record"),
        agentPda.toBuffer(),
        payer.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    
    try {
      await program.methods
        .payForService(
          paymentAmount,
          serviceId,
          nonce
        )
        .accounts({
          agent: agentPda,
          x402Config: x402ConfigPda,
          paymentRecord: paymentRecordPda,
          payer: payer.publicKey,
          paymentRecipient: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      expect.fail("Should have failed with payment too low");
    } catch (error: any) {
      expect(error.toString()).to.include("PaymentTooLow");
    }
  });
});

