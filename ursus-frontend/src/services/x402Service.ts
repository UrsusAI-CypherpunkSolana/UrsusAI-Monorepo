import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { SOLANA_PROGRAM_ADDRESSES } from '../config/contracts';
import idl from '../idl/agent_factory.json';

// Test USDC token mint (created specifically for this project on testnet)
// This is our own SPL token with 6 decimals to simulate USDC
const USDC_MINT_TESTNET = new PublicKey('2XEkLLnaAqiN7EU2fi54FxAXCSKerbPPBPY4MXVRP94k');
import type { 
  ConfigureX402Params, 
  PayForServiceParams, 
  CallAgentServiceParams,
  X402Config,
  X402PaymentRecord 
} from '../types/x402';

export class X402Service {
  private connection: Connection;
  private programId: PublicKey;
  private program: Program | null = null;

  constructor(connection: Connection, network: 'TESTNET' | 'DEVNET' | 'MAINNET' = 'TESTNET') {
    this.connection = connection;
    this.programId = new PublicKey(SOLANA_PROGRAM_ADDRESSES[network].PROGRAM_ID);
  }

  private getProgram(provider: AnchorProvider): Program {
    if (!this.program) {
      this.program = new Program(idl as any, this.programId, provider);
    }
    return this.program;
  }

  async getX402ConfigPDA(agentAddress: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('x402_config'), agentAddress.toBuffer()],
      this.programId
    );
  }

  async getPaymentRecordPDA(
    agentAddress: PublicKey,
    payerAddress: PublicKey,
    nonce: number
  ): Promise<[PublicKey, number]> {
    const nonceBuffer = Buffer.alloc(8);
    nonceBuffer.writeBigUInt64LE(BigInt(nonce));
    return PublicKey.findProgramAddressSync(
      [Buffer.from('payment_record'), agentAddress.toBuffer(), payerAddress.toBuffer(), nonceBuffer],
      this.programId
    );
  }

  /**
   * Ensure USDC token account exists for a wallet, create if needed
   */
  private async ensureTokenAccount(
    owner: PublicKey,
    provider: AnchorProvider
  ): Promise<PublicKey> {
    const tokenAccount = await getAssociatedTokenAddress(
      USDC_MINT_TESTNET,
      owner
    );

    // Check if account exists
    const accountInfo = await this.connection.getAccountInfo(tokenAccount);

    if (!accountInfo) {
      // Create the token account
      const instruction = createAssociatedTokenAccountInstruction(
        provider.wallet.publicKey, // payer
        tokenAccount, // ata
        owner, // owner
        USDC_MINT_TESTNET // mint
      );

      const transaction = new Transaction().add(instruction);
      const signature = await provider.sendAndConfirm(transaction);
      console.log('Created token account:', tokenAccount.toBase58(), 'signature:', signature);
    }

    return tokenAccount;
  }

  async configureX402(params: ConfigureX402Params, provider: AnchorProvider): Promise<string> {
    const program = this.getProgram(provider);
    const agentPubkey = new PublicKey(params.agentAddress);
    const [x402ConfigPDA] = await this.getX402ConfigPDA(agentPubkey);

    // Check if X402 config already exists
    try {
      const accountInfo = await this.connection.getAccountInfo(x402ConfigPDA);

      if (accountInfo) {
        // Account exists, use updateX402
        return await program.methods
          .updateX402(
            params.enabled,
            new BN(params.minPaymentAmount),
            new BN(params.maxPaymentAmount),
            new BN(params.serviceTimeoutSeconds)
          )
          .accounts({
            agent: agentPubkey,
            x402Config: x402ConfigPDA,
            authority: provider.wallet.publicKey,
          })
          .rpc();
      } else {
        // Account doesn't exist, use configureX402 (init)
        return await program.methods
          .configureX402(
            params.enabled,
            new BN(params.minPaymentAmount),
            new BN(params.maxPaymentAmount),
            new BN(params.serviceTimeoutSeconds)
          )
          .accounts({
            agent: agentPubkey,
            x402Config: x402ConfigPDA,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }
    } catch (error) {
      // If error checking account, assume it doesn't exist and try to create
      return await program.methods
        .configureX402(
          params.enabled,
          new BN(params.minPaymentAmount),
          new BN(params.maxPaymentAmount),
          new BN(params.serviceTimeoutSeconds)
        )
        .accounts({
          agent: agentPubkey,
          x402Config: x402ConfigPDA,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  }

  async payForService(params: PayForServiceParams, provider: AnchorProvider): Promise<string> {
    const program = this.getProgram(provider);
    const agentPubkey = new PublicKey(params.agentAddress);
    const [x402ConfigPDA] = await this.getX402ConfigPDA(agentPubkey);

    const config = await this.getX402Config(params.agentAddress);
    const nonce = config ? config.nonce : 0;

    const [paymentRecordPDA] = await this.getPaymentRecordPDA(
      agentPubkey,
      provider.wallet.publicKey,
      nonce + 1
    );

    // Ensure USDC token accounts exist (create if needed)
    const payerTokenAccount = await this.ensureTokenAccount(
      provider.wallet.publicKey,
      provider
    );

    const recipientTokenAccount = await this.ensureTokenAccount(
      config?.paymentRecipient || agentPubkey,
      provider
    );

    return await program.methods
      .payForService(
        new BN(params.amount),
        params.serviceId,
        new BN(nonce + 1)
      )
      .accounts({
        agent: agentPubkey,
        x402Config: x402ConfigPDA,
        paymentRecord: paymentRecordPDA,
        payer: provider.wallet.publicKey,
        payerTokenAccount,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async getX402Config(agentAddress: string): Promise<X402Config | null> {
    try {
      const agentPubkey = new PublicKey(agentAddress);
      const [x402ConfigPDA] = await this.getX402ConfigPDA(agentPubkey);
      const accountInfo = await this.connection.getAccountInfo(x402ConfigPDA);
      if (!accountInfo) return null;
      return this.decodeX402Config(accountInfo.data);
    } catch (error) {
      console.error('Error fetching X402 config:', error);
      return null;
    }
  }

  private decodeX402Config(data: Buffer): X402Config {
    let offset = 8;
    return {
      agent: new PublicKey(data.slice(offset, offset + 32)),
      paymentRecipient: new PublicKey(data.slice(offset + 32, offset + 64)),
      enabled: data.readUInt8(offset + 64) === 1,
      minPaymentAmount: Number(data.readBigUInt64LE(offset + 65)),
      maxPaymentAmount: Number(data.readBigUInt64LE(offset + 73)),
      serviceTimeoutSeconds: Number(data.readBigUInt64LE(offset + 81)),
      totalPaymentsReceived: Number(data.readBigUInt64LE(offset + 89)),
      totalServiceCalls: Number(data.readBigUInt64LE(offset + 97)),
      nonce: Number(data.readBigUInt64LE(offset + 105)),
      bump: data.readUInt8(offset + 113),
    };
  }

  private decodePaymentRecord(data: Buffer): X402PaymentRecord {
    let offset = 8;
    const agent = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const payer = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    const amount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    const timestamp = Number(data.readBigInt64LE(offset));
    offset += 8;
    const serviceIdLen = data.readUInt32LE(offset);
    offset += 4;
    const serviceId = data.slice(offset, offset + serviceIdLen).toString('utf-8');
    offset += serviceIdLen;
    const status = data.readUInt8(offset);
    offset += 1;
    const bump = data.readUInt8(offset);
    return { agent, payer, amount, timestamp, serviceId, status, bump };
  }
}
