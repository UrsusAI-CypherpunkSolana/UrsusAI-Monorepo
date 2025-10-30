export interface Agent {
  id: string;
  name: string;
  symbol: string;
  description: string;
  avatar: string;
  image?: string; // Agent logo/image URL
  creator: string;
  createdAt: string;
  marketCap: number;
  chatCount: number;
  isNsfw: boolean;
  category: string;
  priceHistory: number[];
  priceChange24h: number;

  // API compatibility fields (optional for backward compatibility)
  address?: string;
  tokenName?: string;
  tokenSymbol?: string;
  agentInfo?: {
    description: string;
    instructions: string;
    model: string;
  };
  metadata?: {
    category: string;
    creator: string;
    createdAt: number;
    isActive: boolean;
  };

  // Extended trading data
  currentPrice?: number | string;
  volume24h?: number;
  holders?: number;
  liquidity?: number;
  priceChange1h?: number;
  priceChange7d?: number;
  priceChange30d?: number;
  allTimeHigh?: number;
  allTimeLow?: number;
  totalSupply?: number | string;
  circulatingSupply?: number;
  fdv?: number; // Fully Diluted Valuation

  // Trading metrics
  buys24h?: number;
  sells24h?: number;
  transactions24h?: number;
  uniqueTraders24h?: number;
  avgTradeSize?: number;

  // Social metrics
  twitterFollowers?: number;
  telegramMembers?: number;
  discordMembers?: number;

  // Risk metrics
  riskScore?: number;
  liquidityScore?: number;
  volatilityScore?: number;

  // Contract info
  contractAddress?: string;
  mintAddress?: string; // Solana token mint address
  verified?: boolean;
  audit?: boolean;

  // Bonding curve info (for API compatibility)
  bondingCurveInfo?: {
    supply?: string | number;
    reserve?: string | number;
    price?: string | number;
    marketCap?: string | number;
  };

  // Performance
  performance?: {
    '1h': number;
    '24h': number;
    '7d': number;
    '30d': number;
    '90d': number;
  };

  // Additional fields for API compatibility
  isVerified?: boolean;
  isActive?: boolean;
  model?: string;
}

export interface Notification {
  id: string;
  type: 'buy' | 'sell' | 'create';
  user: string;
  amount?: number;
  agent: string;
  marketCap?: number;
  timestamp: Date;
}

export interface User {
  id: string;
  username: string;
  balance: number;
  holdings: AgentHolding[];
}

export interface AgentHolding {
  agentId: string;
  agentName: string;
  amount: number;
  value: number;
}