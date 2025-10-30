import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

/**
 * Solana Network Configuration
 * For Solana Testnet deployment
 */

// Network selection based on environment
export const SOLANA_NETWORK =
  import.meta.env.VITE_SOLANA_NETWORK === 'mainnet-beta'
    ? WalletAdapterNetwork.Mainnet
    : import.meta.env.VITE_SOLANA_NETWORK === 'testnet'
    ? WalletAdapterNetwork.Testnet
    : WalletAdapterNetwork.Devnet;

// RPC URL configuration
export const SOLANA_RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL ||
  clusterApiUrl(SOLANA_NETWORK);

// Program ID (will be updated after deployment)
export const AGENT_FACTORY_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_AGENT_FACTORY_PROGRAM_ID ||
  'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
);

/**
 * Supported Solana Wallets
 * Replaces MetaMask/WalletConnect configuration
 */
export const getSolanaWallets = () => {
  return [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];
};

/**
 * Network Configuration
 */
export const NETWORK_CONFIG = {
  devnet: {
    name: 'Solana Devnet',
    rpcUrl: clusterApiUrl('devnet'),
    explorerUrl: 'https://explorer.solana.com',
    cluster: 'devnet',
  },
  testnet: {
    name: 'Solana Testnet',
    rpcUrl: clusterApiUrl('testnet'),
    explorerUrl: 'https://explorer.solana.com',
    cluster: 'testnet',
  },
  'mainnet-beta': {
    name: 'Solana Mainnet',
    rpcUrl: clusterApiUrl('mainnet-beta'),
    explorerUrl: 'https://explorer.solana.com',
    cluster: 'mainnet-beta',
  },
} as const;

/**
 * Get current network config
 */
export const getCurrentNetworkConfig = () => {
  const network = SOLANA_NETWORK;
  return NETWORK_CONFIG[network];
};

/**
 * Bonding Curve Constants (matching Rust program)
 */
export const BONDING_CURVE_CONFIG = {
  VIRTUAL_SOL_RESERVES: 30, // 30 SOL
  VIRTUAL_TOKEN_RESERVES: 1_073_000_000, // 1.073B tokens
  BONDING_CURVE_SUPPLY: 800_000_000, // 800M tokens
  TOTAL_SUPPLY: 1_000_000_000, // 1B tokens
  GRADUATION_THRESHOLD: 30_000, // 30,000 SOL
  TOKEN_DECIMALS: 9,
} as const;

/**
 * Fee Configuration
 */
export const FEE_CONFIG = {
  PLATFORM_FEE_BPS: 100, // 1% (100 basis points)
  CREATOR_FEE_BPS: 100, // 1% (100 basis points)
  TOTAL_FEE_BPS: 200, // 2% total
} as const;

/**
 * Transaction Configuration
 */
export const TX_CONFIG = {
  COMMITMENT: 'confirmed' as const,
  PREFLIGHT_COMMITMENT: 'confirmed' as const,
  MAX_RETRIES: 3,
  TIMEOUT: 30000, // 30 seconds
} as const;

/**
 * Explorer URL helpers
 */
export const getExplorerUrl = (
  type: 'tx' | 'address' | 'block',
  value: string,
  cluster?: string
) => {
  const baseUrl = getCurrentNetworkConfig().explorerUrl;
  const clusterParam = cluster ? `?cluster=${cluster}` : '';
  
  switch (type) {
    case 'tx':
      return `${baseUrl}/tx/${value}${clusterParam}`;
    case 'address':
      return `${baseUrl}/address/${value}${clusterParam}`;
    case 'block':
      return `${baseUrl}/block/${value}${clusterParam}`;
    default:
      return baseUrl;
  }
};

/**
 * Format SOL amount
 */
export const formatSOL = (lamports: number | bigint): string => {
  const sol = Number(lamports) / 1_000_000_000;
  return sol.toFixed(9);
};

/**
 * Format token amount
 */
export const formatTokens = (amount: number | bigint, decimals: number = 9): string => {
  const tokens = Number(amount) / Math.pow(10, decimals);
  return tokens.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
};

/**
 * Parse SOL amount to lamports
 */
export const parseSOL = (sol: number): bigint => {
  return BigInt(Math.floor(sol * 1_000_000_000));
};

/**
 * Parse token amount
 */
export const parseTokens = (tokens: number, decimals: number = 9): bigint => {
  return BigInt(Math.floor(tokens * Math.pow(10, decimals)));
};

/**
 * Validate Solana address
 */
export const isValidSolanaAddress = (address: string): boolean => {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
};

/**
 * Shorten address for display
 */
export const shortenAddress = (address: string, chars: number = 4): string => {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

/**
 * Calculate bonding curve price
 */
export const calculateBondingCurvePrice = (
  virtualSolReserves: number,
  virtualTokenReserves: number
): number => {
  if (virtualTokenReserves === 0) return 0;
  return virtualSolReserves / virtualTokenReserves;
};

/**
 * Calculate market cap
 */
export const calculateMarketCap = (
  price: number,
  circulatingSupply: number
): number => {
  return price * circulatingSupply;
};

/**
 * Calculate tokens out for SOL in (buy)
 */
export const calculateBuyTokens = (
  solAmount: number,
  virtualSolReserves: number,
  virtualTokenReserves: number
): number => {
  const newSolReserves = virtualSolReserves + solAmount;
  const k = virtualSolReserves * virtualTokenReserves;
  const newTokenReserves = k / newSolReserves;
  return virtualTokenReserves - newTokenReserves;
};

/**
 * Calculate SOL out for tokens in (sell)
 */
export const calculateSellSOL = (
  tokenAmount: number,
  virtualSolReserves: number,
  virtualTokenReserves: number
): number => {
  const newTokenReserves = virtualTokenReserves + tokenAmount;
  const k = virtualSolReserves * virtualTokenReserves;
  const newSolReserves = k / newTokenReserves;
  return virtualSolReserves - newSolReserves;
};

/**
 * Calculate price impact
 */
export const calculatePriceImpact = (
  inputAmount: number,
  outputAmount: number,
  currentPrice: number
): number => {
  const executionPrice = inputAmount / outputAmount;
  return ((executionPrice - currentPrice) / currentPrice) * 100;
};

/**
 * Check if agent can graduate
 */
export const canGraduate = (realSolReserves: number): boolean => {
  return realSolReserves >= BONDING_CURVE_CONFIG.GRADUATION_THRESHOLD;
};

/**
 * Get graduation progress percentage
 */
export const getGraduationProgress = (realSolReserves: number): number => {
  return Math.min(
    (realSolReserves / BONDING_CURVE_CONFIG.GRADUATION_THRESHOLD) * 100,
    100
  );
};

export default {
  SOLANA_NETWORK,
  SOLANA_RPC_URL,
  AGENT_FACTORY_PROGRAM_ID,
  getSolanaWallets,
  getCurrentNetworkConfig,
  BONDING_CURVE_CONFIG,
  FEE_CONFIG,
  TX_CONFIG,
  getExplorerUrl,
  formatSOL,
  formatTokens,
  parseSOL,
  parseTokens,
  isValidSolanaAddress,
  shortenAddress,
  calculateBondingCurvePrice,
  calculateMarketCap,
  calculateBuyTokens,
  calculateSellSOL,
  calculatePriceImpact,
  canGraduate,
  getGraduationProgress,
};

