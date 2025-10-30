/**
 * URSUS Bonding Curve Service
 * Real implementation for URSUS platform bonding curve trading
 * Integrates with AgentToken smart contracts and URSUS backend
 */

import { ethers } from 'ethers';
import { apiService } from './api';

// URSUS Chain Configuration
export const URSUS_CHAIN_CONFIG = {
  SOLANA_MAINNET: 1116,
  SOLANA_DEVNET: 1115,
  BASE_MAINNET: 8453,
  BASE_SEPOLIA: 84532
};

// AgentToken Contract ABI (essential functions)
export const AGENT_TOKEN_ABI = [
  'function getCurrentPrice() view returns (uint256)',
  'function getBondingCurveInfo() view returns (uint256 currentSupply_, uint256 reserveBalance_, uint256 price, uint256 marketCap, bool isGraduated_)',
  'function getBuyQuote(uint256 coreAmount) view returns (uint256 tokenAmount, uint256 currentPrice, uint256 newPrice, uint256 priceImpact)',
  'function getSellQuote(uint256 tokenAmount) view returns (uint256 coreAmount, uint256 currentPrice, uint256 newPrice, uint256 priceImpact)',
  'function calculatePurchaseReturn(uint256 coreAmount) view returns (uint256)',
  'function calculateSaleReturn(uint256 tokenAmount) view returns (uint256)',
  'function buyTokens() payable',
  'function sellTokens(uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function currentSupply() view returns (uint256)',
  'function reserveBalance() view returns (uint256)',
  'function isGraduated() view returns (bool)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function getAgentInfo() view returns (string description, string instructions, string model, address creator, uint256 timestamp)',
  'function recordInteraction(string message)',
  'event TokensPurchased(address indexed buyer, uint256 coreAmount, uint256 tokensReceived)',
  'event TokensSold(address indexed seller, uint256 tokensAmount, uint256 coreReceived)',
  'event TokenGraduated(address indexed token, uint256 reserveAmount, uint256 liquidityTokens)'
];

// Trading Response Interfaces
export interface BondingCurveQuote {
  tokenAmount: string;
  coreAmount: string;
  currentPrice: string;
  newPrice: string;
  priceImpact: number;
  platformFee: string;
  slippage: number;
  minimumReceived: string;
  gasEstimate: string;
  riskLevel: 'low' | 'medium' | 'high';
  warning?: string;
}

export interface BondingCurveTrade {
  success: boolean;
  transactionHash?: string;
  tokenAmount?: string;
  coreAmount?: string;
  gasUsed?: string;
  effectivePrice?: string;
  error?: string;
}

export interface AgentTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  description: string;
  instructions: string;
  model: string;
  creator: string;
  createdAt: number;
  currentSupply: string;
  totalSupply: string;
  reserveBalance: string;
  currentPrice: string;
  marketCap: string;
  isGraduated: boolean;
}

export class BondingCurveError extends Error {
  code: string;
  details?: any;
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'BondingCurveError';
    this.code = code;
    this.details = details;
  }
}

class BondingCurveService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;

  constructor() {
    this.initializeProvider();
  }

  private async initializeProvider() {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
      }
    } catch (error) {
      console.error('Failed to initialize provider:', error);
    }
  }

  async setSigner(signer: ethers.Signer) {
    this.signer = signer;
    this.provider = signer.provider;
  }

  // DEPRECATED: EVM contract methods removed for Solana migration
  private getContract(tokenAddress: string): any {
    console.warn('getContract is deprecated for Solana');
    return null;
  }

  private getSignedContract(tokenAddress: string): any {
    console.warn('getSignedContract is deprecated for Solana');
    return null;
  }

  /**
   * Get comprehensive token information from backend API (Solana)
   */
  async getTokenInfo(tokenAddress: string): Promise<AgentTokenInfo> {
    try {
      console.log(`🔄 Getting token info for ${tokenAddress}`);

      // Call backend API
      // Note: apiService.get() wraps response in { data: ... }
      const response = await apiService.get(`/agents/${tokenAddress}`) as any;

      console.log('🔍 Backend response:', { hasData: !!response.data });

      // apiService.get() returns { data: backendResponse }
      // backendResponse is { success: true, data: agentData }
      const backendResponse = response.data;

      if (!backendResponse || !backendResponse.success || !backendResponse.data) {
        throw new BondingCurveError(
          'TOKEN_INFO_ERROR',
          backendResponse?.error || 'Failed to get token information'
        );
      }

      const agent = backendResponse.data;

      return {
        address: tokenAddress,
        name: agent.name || agent.tokenName || 'Unknown',
        symbol: agent.symbol || agent.tokenSymbol || 'UNKNOWN',
        decimals: 9, // Solana tokens use 9 decimals
        description: agent.description || agent.agentInfo?.description || '',
        instructions: agent.instructions || agent.agentInfo?.instructions || '',
        model: agent.model || agent.agentInfo?.model || 'llama3-8b-8192',
        creator: agent.creator || agent.metadata?.creator || agent.creatorAddress || '',
        createdAt: agent.createdAt ? new Date(agent.createdAt).getTime() : (agent.metadata?.createdAt ? agent.metadata.createdAt * 1000 : Date.now()),
        currentSupply: agent.tokenomics?.currentSupply || agent.bondingCurveInfo?.currentSupply || '0',
        totalSupply: agent.tokenomics?.totalSupply || agent.totalSupply || '1073000000000000',
        reserveBalance: agent.tokenomics?.reserve || agent.bondingCurveInfo?.reserve || '0',
        currentPrice: agent.tokenomics?.currentPrice || agent.currentPrice || '0',
        marketCap: agent.tokenomics?.marketCap || agent.bondingCurveInfo?.marketCap || agent.marketCap || '0',
        isGraduated: agent.isGraduated || agent.metadata?.isGraduated || false
      };
    } catch (error: any) {
      console.error('Error getting token info:', error);

      if (error instanceof BondingCurveError) {
        throw error;
      }

      throw new BondingCurveError(
        'TOKEN_INFO_ERROR',
        error.message || 'Failed to get token information',
        error
      );
    }
  }

  /**
   * Get buy quote from backend API (Solana)
   */
  async getBuyQuote(tokenAddress: string, solAmount: string): Promise<BondingCurveQuote> {
    try {
      console.log(`🔄 Getting buy quote for ${tokenAddress}, amount: ${solAmount} SOL`);

      // Call backend API
      const response = await apiService.get(`/trading/quote/buy/${tokenAddress}?amount=${solAmount}`) as any;

      if (!response.success || !response.data) {
        throw new BondingCurveError(
          'QUOTE_ERROR',
          response.error || 'Failed to get buy quote'
        );
      }

      const quote = response.data as any;

      // Determine risk level based on price impact
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let warning: string | undefined;

      if (quote.priceImpact > 10) {
        riskLevel = 'high';
        warning = 'Very high price impact detected. Consider reducing trade size.';
      } else if (quote.priceImpact > 5) {
        riskLevel = 'medium';
        warning = 'High price impact detected.';
      }

      return {
        tokenAmount: quote.tokensOut.toString(),
        coreAmount: solAmount,
        currentPrice: quote.currentPrice.toString(),
        newPrice: quote.newPrice.toString(),
        priceImpact: quote.priceImpact,
        platformFee: quote.platformFee.toString(),
        slippage: 0.5, // 0.5% default slippage
        minimumReceived: (parseFloat(quote.tokensOut) * 0.995).toString(), // 0.5% slippage
        gasEstimate: '0.00001', // Estimated gas in SOL (very low on Solana)
        riskLevel,
        warning
      };
    } catch (error: any) {
      console.error('Error getting buy quote:', error);

      if (error instanceof BondingCurveError) {
        throw error;
      }

      throw new BondingCurveError(
        'QUOTE_ERROR',
        error.message || 'Failed to get buy quote',
        error
      );
    }
  }

  /**
   * Get sell quote from backend API (Solana)
   */
  async getSellQuote(tokenAddress: string, tokenAmount: string): Promise<BondingCurveQuote> {
    try {
      console.log(`🔄 Getting sell quote for ${tokenAddress}, amount: ${tokenAmount} tokens`);

      // Call backend API
      const response = await apiService.get(`/trading/quote/sell/${tokenAddress}?amount=${tokenAmount}`) as any;

      if (!response.success || !response.data) {
        throw new BondingCurveError(
          'QUOTE_ERROR',
          response.error || 'Failed to get sell quote'
        );
      }

      const quote = response.data as any;

      // Determine risk level based on price impact
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let warning: string | undefined;

      if (quote.priceImpact > 10) {
        riskLevel = 'high';
        warning = 'Very high price impact detected. Consider reducing trade size.';
      } else if (quote.priceImpact > 5) {
        riskLevel = 'medium';
        warning = 'High price impact detected.';
      }

      return {
        tokenAmount: tokenAmount,
        coreAmount: quote.solOut.toString(),
        currentPrice: quote.currentPrice.toString(),
        newPrice: quote.newPrice.toString(),
        priceImpact: quote.priceImpact,
        platformFee: quote.platformFee.toString(),
        slippage: 0.5, // 0.5% default slippage
        minimumReceived: (parseFloat(quote.solOut) * 0.995).toString(), // 0.5% slippage
        gasEstimate: '0.00001', // Estimated gas in SOL (very low on Solana)
        riskLevel,
        warning
      };
    } catch (error: any) {
      console.error('Error getting sell quote:', error);

      if (error instanceof BondingCurveError) {
        throw error;
      }

      throw new BondingCurveError(
        'QUOTE_ERROR',
        error.message || 'Failed to get sell quote',
        error
      );
    }
  }

  /**
   * Execute buy transaction
   */
  async buyTokens(tokenAddress: string, coreAmount: string): Promise<BondingCurveTrade> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const contract = this.getSignedContract(tokenAddress);
      const coreAmountWei = ethers.parseEther(coreAmount);

      // Get quote first for validation
      const quote = await this.getBuyQuote(tokenAddress, coreAmount);

      // Execute transaction
      const tx = await contract.buyTokens({ value: coreAmountWei });
      const receipt = await tx.wait();

      // Parse events to get actual amounts
      let actualTokenAmount = quote.tokenAmount;
      let actualCoreAmount = coreAmount;

      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog?.name === 'TokensPurchased') {
            actualCoreAmount = ethers.formatEther(parsedLog.args.coreAmount);
            actualTokenAmount = ethers.formatEther(parsedLog.args.tokensReceived);
          }
        } catch (e) {
          // Ignore parsing errors for non-contract logs
        }
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        tokenAmount: actualTokenAmount,
        coreAmount: actualCoreAmount,
        gasUsed: receipt.gasUsed.toString(),
        effectivePrice: (Number(actualCoreAmount) / Number(actualTokenAmount)).toString()
      };
    } catch (error: any) {
      console.error('Error buying tokens:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed'
      };
    }
  }

  /**
   * Execute sell transaction
   */
  async sellTokens(tokenAddress: string, tokenAmount: string): Promise<BondingCurveTrade> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const contract = this.getSignedContract(tokenAddress);
      const tokenAmountWei = ethers.parseEther(tokenAmount);

      // Get quote first for validation
      const quote = await this.getSellQuote(tokenAddress, tokenAmount);

      // Execute transaction
      const tx = await contract.sellTokens(tokenAmountWei);
      const receipt = await tx.wait();

      // Parse events to get actual amounts
      let actualTokenAmount = tokenAmount;
      let actualCoreAmount = quote.coreAmount;

      for (const log of receipt.logs) {
        try {
          const parsedLog = contract.interface.parseLog(log);
          if (parsedLog?.name === 'TokensSold') {
            actualTokenAmount = ethers.formatEther(parsedLog.args.tokensAmount);
            actualCoreAmount = ethers.formatEther(parsedLog.args.coreReceived);
          }
        } catch (e) {
          // Ignore parsing errors for non-contract logs
        }
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        tokenAmount: actualTokenAmount,
        coreAmount: actualCoreAmount,
        gasUsed: receipt.gasUsed.toString(),
        effectivePrice: (Number(actualCoreAmount) / Number(actualTokenAmount)).toString()
      };
    } catch (error: any) {
      console.error('Error selling tokens:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed'
      };
    }
  }

  /**
   * Get user token balance (Solana - use useTokenBalance hook instead)
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    console.warn('getTokenBalance is deprecated for Solana. Use useTokenBalance hook instead.');
    return '0';
  }

  /**
   * Record agent interaction on-chain
   */
  async recordInteraction(tokenAddress: string, message: string): Promise<boolean> {
    try {
      if (!this.signer) {
        throw new Error('Wallet not connected');
      }

      const contract = this.getSignedContract(tokenAddress);
      const tx = await contract.recordInteraction(message);
      await tx.wait();

      return true;
    } catch (error) {
      console.error('Error recording interaction:', error);
      return false;
    }
  }

  /**
   * Get current price from backend API (DEPRECATED - use useGraduationStatus hook)
   */
  async getCurrentPrice(tokenAddress: string): Promise<string> {
    console.warn('getCurrentPrice is deprecated for Solana. Use useGraduationStatus hook instead.');
    return '0';
  }

  /**
   * Check if token has graduated to DEX (DEPRECATED - use useGraduationStatus hook)
   */
  async isGraduated(tokenAddress: string): Promise<boolean> {
    console.warn('isGraduated is deprecated for Solana. Use useGraduationStatus hook instead.');
    return false;
  }

  /**
   * Get bonding curve progress (DEPRECATED - use useGraduationStatus hook)
   */
  async getBondingCurveProgress(tokenAddress: string): Promise<{
    currentSupply: string;
    maxSupply: string;
    progressPercentage: number;
    reserveBalance: string;
    graduationThreshold: string;
    remainingToGraduation: string;
  }> {
    console.warn('getBondingCurveProgress is deprecated for Solana. Use useGraduationStatus hook instead.');
    return {
      currentSupply: '0',
      maxSupply: '1073000000',
      progressPercentage: 0,
      reserveBalance: '0',
      graduationThreshold: '30000',
      remainingToGraduation: '30000'
    };
  }

  /**
   * Get trading history from backend
   */
  async getTradingHistory(tokenAddress: string, limit = 50): Promise<any[]> {
    try {
      const response = await apiService.get<{ trades: any[] }>(`/agents/${tokenAddress}/trades?limit=${limit}`);
      return response.data.trades || [];
    } catch (error) {
      console.error('Error getting trading history:', error);
      return [];
    }
  }

  /**
   * Get price history from backend
   */
  async getPriceHistory(tokenAddress: string, interval = '1h', limit = 100): Promise<any[]> {
    try {
      const response = await apiService.get<{ priceHistory: any[] }>(`/agents/${tokenAddress}/price-history?interval=${interval}&limit=${limit}`);
      return response.data.priceHistory || [];
    } catch (error) {
      console.error('Error getting price history:', error);
      return [];
    }
  }
}

// Create singleton instance
export const bondingCurveService = new BondingCurveService();
export default bondingCurveService;
