import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentFactory } from "../target/types/agent_factory";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { assert } from "chai";

describe("agent-factory", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentFactory as Program<AgentFactory>;
  
  // Test accounts
  const authority = provider.wallet as anchor.Wallet;
  const platformTreasury = Keypair.generate();
  const creator = Keypair.generate();
  
  // PDAs
  let factoryPda: PublicKey;
  let factoryBump: number;
  let agentPda: PublicKey;
  let agentBump: number;
  let mintPda: PublicKey;
  let mintBump: number;
  let tokenVaultPda: PublicKey;
  let tokenVaultBump: number;

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropSignature = await provider.connection.requestAirdrop(
      creator.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Derive PDAs
    [factoryPda, factoryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("factory")],
      program.programId
    );
  });

  it("Initializes the factory", async () => {
    const creationFee = new anchor.BN(0); // Free creation like pump.fun

    const tx = await program.methods
      .initialize(creationFee)
      .accounts({
        factory: factoryPda,
        authority: authority.publicKey,
        platformTreasury: platformTreasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Fetch the factory account
    const factoryAccount = await program.account.agentFactory.fetch(factoryPda);
    
    assert.equal(factoryAccount.authority.toString(), authority.publicKey.toString());
    assert.equal(factoryAccount.platformTreasury.toString(), platformTreasury.publicKey.toString());
    assert.equal(factoryAccount.creationFee.toNumber(), 0);
    assert.equal(factoryAccount.totalAgents.toNumber(), 0);
  });

  it("Creates a new agent", async () => {
    const agentId = 0;
    
    // Derive agent PDAs
    [agentPda, agentBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), new anchor.BN(agentId).toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [mintPda, mintBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint"), agentPda.toBuffer()],
      program.programId
    );

    [tokenVaultPda, tokenVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), agentPda.toBuffer()],
      program.programId
    );

    const tx = await program.methods
      .createAgent(
        "Test Agent",
        "TEST",
        "A test AI agent for trading",
        "You are a helpful trading assistant",
        "gpt-4",
        "trading"
      )
      .accounts({
        factory: factoryPda,
        agent: agentPda,
        mint: mintPda,
        tokenVault: tokenVaultPda,
        creator: creator.publicKey,
        platformTreasury: platformTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    console.log("Create agent transaction signature:", tx);

    // Fetch the agent account
    const agentAccount = await program.account.agent.fetch(agentPda);
    
    assert.equal(agentAccount.name, "Test Agent");
    assert.equal(agentAccount.symbol, "TEST");
    assert.equal(agentAccount.creator.toString(), creator.publicKey.toString());
    assert.equal(agentAccount.isGraduated, false);
    
    // Check bonding curve initialization
    assert.equal(agentAccount.bondingCurve.virtualSolReserves.toNumber(), 30 * LAMPORTS_PER_SOL);
    assert.equal(agentAccount.bondingCurve.realSolReserves.toNumber(), 0);
  });

  it("Buys tokens using bonding curve", async () => {
    const buyer = Keypair.generate();
    
    // Airdrop SOL to buyer
    const airdropSignature = await provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    // Get buyer's token account
    const buyerTokenAccount = await getAssociatedTokenAddress(
      mintPda,
      buyer.publicKey
    );

    const solAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
    const minTokensOut = new anchor.BN(0); // No slippage protection for test

    const tx = await program.methods
      .buyTokens(solAmount, minTokensOut)
      .accounts({
        agent: agentPda,
        mint: mintPda,
        tokenVault: tokenVaultPda,
        buyerTokenAccount: buyerTokenAccount,
        buyer: buyer.publicKey,
        creator: creator.publicKey,
        platformTreasury: platformTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    console.log("Buy tokens transaction signature:", tx);

    // Fetch updated agent account
    const agentAccount = await program.account.agent.fetch(agentPda);
    
    // Check that SOL reserves increased
    assert.isAbove(agentAccount.bondingCurve.realSolReserves.toNumber(), 0);
    
    // Check that token reserves decreased
    const initialTokenReserves = 800_000_000 * 1_000_000_000; // 800M tokens with 9 decimals
    assert.isBelow(agentAccount.bondingCurve.realTokenReserves.toNumber(), initialTokenReserves);
  });

  it("Sells tokens using bonding curve", async () => {
    const seller = Keypair.generate();
    
    // First, buy some tokens
    const airdropSignature = await provider.connection.requestAirdrop(
      seller.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSignature);

    const sellerTokenAccount = await getAssociatedTokenAddress(
      mintPda,
      seller.publicKey
    );

    // Buy tokens first
    const buyAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
    await program.methods
      .buyTokens(buyAmount, new anchor.BN(0))
      .accounts({
        agent: agentPda,
        mint: mintPda,
        tokenVault: tokenVaultPda,
        buyerTokenAccount: sellerTokenAccount,
        buyer: seller.publicKey,
        creator: creator.publicKey,
        platformTreasury: platformTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    // Get token balance
    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(sellerTokenAccount);
    const tokenBalance = new anchor.BN(tokenAccountInfo.value.amount);

    // Sell half of the tokens
    const sellAmount = tokenBalance.div(new anchor.BN(2));
    const minSolOut = new anchor.BN(0);

    const tx = await program.methods
      .sellTokens(sellAmount, minSolOut)
      .accounts({
        agent: agentPda,
        mint: mintPda,
        sellerTokenAccount: sellerTokenAccount,
        seller: seller.publicKey,
        creator: creator.publicKey,
        platformTreasury: platformTreasury.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([seller])
      .rpc();

    console.log("Sell tokens transaction signature:", tx);

    // Verify tokens were burned
    const newTokenAccountInfo = await provider.connection.getTokenAccountBalance(sellerTokenAccount);
    const newTokenBalance = new anchor.BN(newTokenAccountInfo.value.amount);
    
    assert.isBelow(newTokenBalance.toNumber(), tokenBalance.toNumber());
  });
});

