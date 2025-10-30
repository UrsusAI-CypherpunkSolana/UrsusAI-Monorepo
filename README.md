# 🐻 UrsusAI - Solana AI Agent Trading Platform

<div align="center">

![UrsusAI Logo](https://github.com/user-attachments/assets/a9591f6a-efbf-477e-a6b6-2be84af6c15c)

**The First AI Agent + Token Launchpad on Solana**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Blockchain-blueviolet)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust&logoColor=white)](https://www.rust-lang.org/)

[Demo](https://drive.google.com/drive/folders/1YYL-V2LCePK-ktFX4sRXyVTfHVItwSNP?usp=sharing) • [Deck](https://github.com/user-attachments/files/21804308/Ursus.Deck.pdf) • [Documentation](#documentation)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [Solana Smart Contracts](#-solana-smart-contracts)
- [API Documentation](#-api-documentation)
- [Team](#-team)
- [License](#-license)

---

## 🌟 Overview

**UrsusAI** is a revolutionary decentralized platform built on Solana that enables users to create, trade, and interact with AI agents as tokenized assets. Each AI agent is backed by its own SPL token with an automated bonding curve mechanism for fair price discovery and instant liquidity.

### 🎯 Vision

We're building the future of AI-powered decentralized finance on Solana, where:
- 🤖 **AI Agents** are autonomous entities with unique personalities and capabilities
- 💰 **Tokenized Economy** - Each agent has its own SPL token for trading and governance
- 📈 **Bonding Curve** - Automated market maker ensures fair pricing and liquidity
- ⚡ **Solana Speed** - Lightning-fast transactions with minimal fees
- 🔒 **Fully On-Chain** - All agent data and trading logic secured by Solana programs

### 🚀 Why Solana?

- **High Performance**: 65,000+ TPS for seamless trading experience
- **Low Fees**: Sub-cent transaction costs enable micro-transactions
- **Fast Finality**: 400ms block times for real-time interactions
- **Growing Ecosystem**: Vibrant DeFi and NFT community
- **Developer-Friendly**: Rust-based smart contracts with Anchor framework

---

## ✨ Key Features

### 🤖 AI Agent Creation & Management
- **Custom AI Agents**: Deploy agents with unique personalities, instructions, and capabilities
- **Multi-Model Support**: Integration with OpenAI GPT-4, Anthropic Claude, and Google Gemini
- **Agent Discovery**: Browse and filter agents by category, performance, and popularity
- **Real-time Chat**: Communicate directly with AI agents using natural language

### 💹 Token Economics & Trading
- **Bonding Curve Pricing**: Automated price discovery based on supply and demand
- **SPL Token Standard**: Each agent token is a fully compliant SPL token
- **Instant Liquidity**: Buy and sell tokens anytime with automated market making
- **Fair Launch**: No pre-mine, no team allocation - pure bonding curve distribution
- **Fee Distribution**: Platform fees, creator royalties, and liquidity incentives

### 📊 Real-time Features
- **Live Price Updates**: WebSocket-based real-time price feeds
- **Trading Notifications**: Instant alerts for trades and price changes
- **Interactive Charts**: Candlestick charts with technical indicators
- **Portfolio Tracking**: Monitor holdings, P&L, and trading history

### 🔐 Security & Transparency
- **Non-Custodial**: Users maintain full control of their assets
- **Audited Contracts**: Comprehensive testing and security reviews
- **On-Chain Verification**: All transactions verifiable on Solana blockchain
- **Rate Limiting**: Protection against spam and abuse

---

## 🏗️ Architecture

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Frontend (React)  │────▶│  Backend (Node.js)  │────▶│  Solana Blockchain  │
│                     │     │                     │     │                     │
│  • UI Components    │     │  • REST API         │     │  • Anchor Programs  │
│  • Wallet Connect   │     │  • WebSocket        │     │  • SPL Tokens       │
│  • State Management │     │  • AI Services      │     │  • Event Listeners  │
│  • Real-time Charts │     │  • MongoDB          │     │  • Bonding Curve    │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Component Breakdown

- **Frontend**: React + TypeScript + Vite with Solana wallet integration
- **Backend**: Node.js + Express with MongoDB and Redis for caching
- **Blockchain**: Anchor programs deployed on Solana (Devnet/Mainnet)
- **AI Services**: Multi-provider AI integration (OpenAI, Anthropic, Google)
- **Database**: MongoDB for agent metadata, Redis for real-time data

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool with HMR
- **Tailwind CSS** - Utility-first styling
- **@solana/wallet-adapter** - Solana wallet integration
- **@solana/web3.js** - Solana blockchain interaction
- **React Query** - Data fetching and caching
- **Recharts** - Interactive charts and visualizations

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Redis** - In-memory caching
- **WebSocket (ws)** - Real-time communication
- **JWT** - Authentication
- **Joi** - Schema validation

### Blockchain
- **Anchor Framework** - Solana smart contract development
- **Rust** - Systems programming language
- **@solana/spl-token** - SPL token standard
- **@solana/web3.js** - Solana JavaScript SDK
- **@project-serum/anchor** - Anchor client library

### AI Services
- **OpenAI API** - GPT-4 and GPT-3.5-turbo
- **Anthropic API** - Claude-3 advanced reasoning
- **Google AI API** - Gemini Pro multimodal AI

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Anchor Test** - Solana program testing
- **Nodemon** - Development server

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18.0.0 or higher
- **Rust** v1.70.0 or higher
- **Solana CLI** v1.17.0 or higher
- **Anchor** v0.29.0 or higher
- **MongoDB** v5.0 or higher
- **Redis** v6.0 or higher

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/UrsusAI-CypherpunkSol/UrsusAI-Monorepo.git
   cd UrsusAI-Monorepo
   ```

2. **Install Solana Program Dependencies**
   ```bash
   cd ursus-solana
   anchor build
   ```

3. **Install Backend Dependencies**
   ```bash
   cd ../ursus-backend
   npm install
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install Frontend Dependencies**
   ```bash
   cd ../ursus-frontend
   npm install
   ```

5. **Start Development Environment**
   ```bash
   # Terminal 1: Start local Solana validator (optional for local dev)
   solana-test-validator

   # Terminal 2: Deploy Solana programs
   cd ursus-solana
   anchor deploy

   # Terminal 3: Start backend
   cd ursus-backend
   npm run dev

   # Terminal 4: Start frontend
   cd ursus-frontend
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

---

## 📁 Project Structure

```
UrsusAI-Monorepo/
├── ursus-solana/          # Solana Anchor programs
│   ├── programs/          # Smart contract source code
│   ├── tests/             # Anchor tests
│   └── target/            # Build artifacts
│
├── ursus-backend/         # Node.js backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   └── utils/         # Utility functions
│   └── server.js          # Entry point
│
├── ursus-frontend/        # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API clients
│   │   └── utils/         # Utilities
│   └── index.html
│
├── scripts/               # Deployment scripts
├── .env.example           # Environment template
└── README.md              # This file
```

---

## 🔗 Solana Smart Contracts

### Program Architecture

UrsusAI uses Anchor framework for Solana program development with the following key components:

#### 1. **Agent Factory Program**
- Creates and manages AI agent tokens
- Handles agent metadata and configuration
- Implements bonding curve logic
- Manages platform fees and treasury

#### 2. **Token Program (SPL)**
- Standard SPL token for each agent
- Mint authority controlled by bonding curve
- Transfer and burn functionality
- Token metadata integration

### Bonding Curve Mathematics

**Buy Formula:**
```
tokens_out = supply * ((1 + sol_in / reserve)^(ratio) - 1)
```

**Sell Formula:**
```
sol_out = reserve * (1 - (1 - tokens_in / supply)^(1/ratio))
```

**Parameters:**
- Reserve Ratio: 50% (0.5)
- Platform Fee: 2.5%
- Creator Fee: 5%
- Initial Price: 0.001 SOL

### Deployment

**Devnet:**
- Network: Solana Devnet
- RPC: https://api.devnet.solana.com
- Explorer: https://explorer.solana.com/?cluster=devnet

**Mainnet:**
- Network: Solana Mainnet Beta
- RPC: https://api.mainnet-beta.solana.com
- Explorer: https://explorer.solana.com

---

## 📚 API Documentation

### Base URL
- Development: `http://localhost:3001/api`
- Production: `https://api.ursusai.io/api`

### Key Endpoints

#### Agent Management
```http
GET    /api/agents              # List all agents
GET    /api/agents/:address     # Get agent details
POST   /api/agents              # Create new agent
```

#### Trading
```http
GET    /api/trading/quote       # Get trading quote
POST   /api/trading/buy         # Buy agent tokens
POST   /api/trading/sell        # Sell agent tokens
```

#### AI Chat
```http
POST   /api/chat                # Send message to agent
GET    /api/chat/history        # Get chat history
```

#### Analytics
```http
GET    /api/analytics/platform  # Platform statistics
GET    /api/analytics/agent/:address  # Agent analytics
```

### WebSocket Events
```javascript
// Subscribe to real-time updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'agent:ADDRESS'
}));

// Event types
- agentCreated
- tokensPurchased
- tokensSold
- priceUpdate
- statsUpdate
```

---

## 👥 Team

<div align="center">

![Team](https://github.com/user-attachments/assets/af7fd1bc-eccb-4333-8170-97336180f8aa)

**Building the future of AI x DeFi on Solana**

</div>

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Disclaimer

⚠️ **Important Notice:**

UrsusAI is experimental software. Users should be aware:
- Trading involves financial risk
- Smart contracts may contain bugs
- AI responses may be inaccurate
- Users are responsible for regulatory compliance
- No warranty provided

**Use at your own risk.**

---

<div align="center">

![Thanks](https://github.com/user-attachments/assets/888782a9-fd26-451d-a13e-68157571a88d)

**Built with ❤️ by the UrsusAI Team**

*Revolutionizing AI and DeFi on Solana*

[Website](https://ursusai.io) • [Twitter](https://twitter.com/UrsusAI) • [Discord](https://discord.gg/ursusai)

</div>

