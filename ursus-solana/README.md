# URSUS Solana Smart Contracts

Solana blockchain implementation of the URSUS AI Agent Platform using Anchor framework.

## 🏗️ Architecture

This project contains the Solana smart contracts (programs) for the URSUS platform, migrated from Core DAO (EVM) to Solana.

### Key Features

- **Agent Factory**: Create AI agent tokens with bonding curve mechanics
- **Bonding Curve**: Pump.fun style constant product AMM
- **Token Standard**: SPL Token (Solana's token standard)
- **DEX Integration**: Raydium/Orca graduation support
- **Fee System**: 1% platform fee + 1% creator fee

### Bonding Curve Parameters

- Virtual SOL Reserves: 30 SOL
- Virtual Token Reserves: 1.073B tokens
- Bonding Curve Supply: 800M tokens (80%)
- Total Supply: 1B tokens
- Graduation Threshold: 30,000 SOL
- Token Decimals: 9

## 📋 Prerequisites

### Required Software

1. **Rust** (latest stable)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. **Solana CLI** (v1.17.0 or later)
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

3. **Anchor CLI** (v0.29.0)
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

4. **Node.js** (v18 or later)
```bash
# Using nvm
nvm install 18
nvm use 18
```

### Verify Installation

```bash
rustc --version
solana --version
anchor --version
node --version
```

## 🚀 Quick Start

### 1. Clone and Install

```bash
cd ursus-solana
npm install
```

### 2. Configure Solana CLI

```bash
# Set cluster to devnet
solana config set --url devnet

# Create a new keypair (if you don't have one)
solana-keygen new

# Check your address
solana address

# Airdrop SOL for testing (devnet only)
solana airdrop 2
```

### 3. Build the Program

```bash
anchor build
```

### 4. Get Program ID

```bash
solana address -k target/deploy/agent_factory-keypair.json
```

Update the program ID in:
- `Anchor.toml`
- `programs/agent-factory/src/lib.rs` (declare_id!)
- `.env` file

### 5. Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

### 6. Run Tests

```bash
anchor test
```

## 📁 Project Structure

```
ursus-solana/
├── programs/
│   └── agent-factory/
│       ├── src/
│       │   ├── lib.rs              # Main program entry
│       │   ├── state/              # Account structures
│       │   │   ├── factory.rs      # Factory account
│       │   │   ├── agent.rs        # Agent account
│       │   │   └── bonding_curve.rs # Bonding curve logic
│       │   ├── instructions/       # Instruction handlers
│       │   │   ├── initialize.rs
│       │   │   ├── create_agent.rs
│       │   │   ├── buy_tokens.rs
│       │   │   ├── sell_tokens.rs
│       │   │   ├── graduate_agent.rs
│       │   │   └── update_fee.rs
│       │   └── errors.rs           # Error definitions
│       └── Cargo.toml
├── tests/
│   └── agent-factory.ts            # Integration tests
├── Anchor.toml                     # Anchor configuration
├── Cargo.toml                      # Workspace configuration
└── package.json                    # Node dependencies
```

## 🔧 Development

### Build

```bash
# Clean build
anchor clean
anchor build

# Build only
anchor build
```

### Test

```bash
# Run all tests
anchor test

# Run tests without building
anchor test --skip-build

# Run specific test
anchor test --skip-build -- --grep "Creates a new agent"
```

### Deploy

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet (requires SOL for deployment)
anchor deploy --provider.cluster mainnet
```

### Upgrade Program

```bash
# Build new version
anchor build

# Upgrade (requires upgrade authority)
solana program deploy \
  --program-id target/deploy/agent_factory-keypair.json \
  target/deploy/agent_factory.so \
  --upgrade-authority ~/.config/solana/id.json
```

## 📝 Program Instructions

### 1. Initialize Factory

Initialize the Agent Factory with platform settings.

```typescript
await program.methods
  .initialize(creationFee)
  .accounts({
    factory: factoryPda,
    authority: authority.publicKey,
    platformTreasury: platformTreasury.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

### 2. Create Agent

Create a new AI agent with bonding curve.

```typescript
await program.methods
  .createAgent(name, symbol, description, instructions, model, category)
  .accounts({
    factory: factoryPda,
    agent: agentPda,
    mint: mintPda,
    tokenVault: tokenVaultPda,
    creator: creator.publicKey,
    platformTreasury: platformTreasury.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .signers([creator])
  .rpc();
```

### 3. Buy Tokens

Purchase agent tokens using bonding curve.

```typescript
await program.methods
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
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([buyer])
  .rpc();
```

### 4. Sell Tokens

Sell agent tokens back to bonding curve.

```typescript
await program.methods
  .sellTokens(tokenAmount, minSolOut)
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
```

### 5. Graduate Agent

Graduate agent to DEX when threshold is reached.

```typescript
await program.methods
  .graduateAgent()
  .accounts({
    agent: agentPda,
    mint: mintPda,
    authority: authority.publicKey,
    dexProgram: dexProgram.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority])
  .rpc();
```

## 🔍 Monitoring

### View Program Logs

```bash
solana logs <PROGRAM_ID>
```

### Get Account Info

```bash
solana account <ACCOUNT_ADDRESS>
```

### View Transaction

```bash
solana confirm -v <SIGNATURE>
```

## 🌐 Network Endpoints

### Devnet
- RPC: `https://api.devnet.solana.com`
- Explorer: `https://explorer.solana.com/?cluster=devnet`

### Testnet
- RPC: `https://api.testnet.solana.com`
- Explorer: `https://explorer.solana.com/?cluster=testnet`

### Mainnet
- RPC: `https://api.mainnet-beta.solana.com`
- Explorer: `https://explorer.solana.com/`

## 🔐 Security

### Audit Checklist

- [ ] Integer overflow protection (using checked math)
- [ ] Access control (authority checks)
- [ ] Account validation (PDA verification)
- [ ] Reentrancy protection (Solana's single-threaded execution)
- [ ] Slippage protection (min_tokens_out, min_sol_out)
- [ ] Fee calculation accuracy

### Best Practices

1. Always use checked math operations
2. Validate all account inputs
3. Use PDAs for program-controlled accounts
4. Implement proper access control
5. Test thoroughly on devnet before mainnet

## 📚 Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Solana Cookbook](https://solanacookbook.com/)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details

