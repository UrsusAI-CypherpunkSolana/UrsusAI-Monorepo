import { useState, useCallback, useEffect, useMemo } from 'react';
import { useWallet } from './useWallet';
import bondingCurveService, {
  BondingCurveQuote,
  BondingCurveTrade,
  AgentTokenInfo,
  BondingCurveError
} from '../services/bondingCurve';

export interface TradingQuote {
  inputAmount: string;
  outputAmount: string;
  tokensReceived?: string;
  coreReceived?: string;
  currentPrice: string;
  newPrice: string;
  priceImpact: number;
  slippage: number;
  fees: {
    platformFee: string;
    creatorFee: string;
    totalFees: string;
  };
  minimumReceived: string;
  gasEstimate: string;
  riskLevel: 'low' | 'medium' | 'high';
  warning?: string;
}

export interface TradingError {
  code: string;
  message: string;
  details?: any;
}

export interface TradingState {
  isTrading: boolean;
  quote: TradingQuote | null;
  quoteLoading: boolean;
  error: TradingError | null;
  tokenInfo: AgentTokenInfo | null;
  tokenLoading: boolean;
  userBalance: string;
  balanceLoading: boolean;
  tradingHistory: any[];
  priceHistory: any[];
  marketDataLoading: boolean;
}

export const useBondingCurveTrading = (tokenAddress?: string) => {
  const { address: userAddress, signer } = useWallet();

  // Trading State
  const [state, setState] = useState<TradingState>({
    isTrading: false,
    quote: null,
    quoteLoading: false,
    error: null,
    tokenInfo: null,
    tokenLoading: false,
    userBalance: '0',
    balanceLoading: false,
    tradingHistory: [],
    priceHistory: [],
    marketDataLoading: false
  });

  // Set signer when available
  useEffect(() => {
    if (signer) {
      bondingCurveService.setSigner(signer);
    }
  }, [signer]);

  // Fetch token information
  const fetchTokenInfo = useCallback(async (address: string) => {
    if (!address) return;
    
    setState(prev => ({ ...prev, tokenLoading: true, error: null }));
    
    try {
      const tokenInfo = await bondingCurveService.getTokenInfo(address);
      setState(prev => ({ ...prev, tokenInfo, tokenLoading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        tokenLoading: false,
        error: {
          code: 'TOKEN_INFO_ERROR',
          message: 'Failed to fetch token information',
          details: error
        }
      }));
    }
  }, []);

  // Fetch user balance
  const fetchUserBalance = useCallback(async (tokenAddr: string, userAddr: string) => {
    if (!tokenAddr || !userAddr) return;

    setState(prev => ({ ...prev, balanceLoading: true }));

    try {
      // Note: For non-deployed agents, balance is always 0
      // For deployed agents, use useTokenBalance hook in the component
      console.log('⚠️ getTokenBalance is deprecated. For deployed agents, use useTokenBalance hook.');
      setState(prev => ({ ...prev, userBalance: '0', balanceLoading: false }));
    } catch (error) {
      console.error('Error fetching user balance:', error);
      setState(prev => ({ ...prev, balanceLoading: false }));
    }
  }, []);

  // Get trading quote
  const getQuote = useCallback(async (
    type: 'buy' | 'sell',
    amount: string
  ): Promise<TradingQuote | null> => {
    if (!tokenAddress || !amount || parseFloat(amount) <= 0) return null;

    setState(prev => ({ ...prev, quoteLoading: true, error: null }));

    try {
      let bondingQuote: BondingCurveQuote;
      
      if (type === 'buy') {
        bondingQuote = await bondingCurveService.getBuyQuote(tokenAddress, amount);
      } else {
        bondingQuote = await bondingCurveService.getSellQuote(tokenAddress, amount);
      }

      // Convert to our TradingQuote interface
      const quote: TradingQuote = {
        inputAmount: type === 'buy' ? bondingQuote.coreAmount : bondingQuote.tokenAmount,
        outputAmount: type === 'buy' ? bondingQuote.tokenAmount : bondingQuote.coreAmount,
        tokensReceived: type === 'buy' ? bondingQuote.tokenAmount : undefined,
        coreReceived: type === 'sell' ? bondingQuote.coreAmount : undefined,
        currentPrice: bondingQuote.currentPrice,
        newPrice: bondingQuote.newPrice,
        priceImpact: bondingQuote.priceImpact,
        slippage: bondingQuote.slippage,
        fees: {
          platformFee: bondingQuote.platformFee,
          creatorFee: '0', // No creator fee in URSUS bonding curve
          totalFees: bondingQuote.platformFee
        },
        minimumReceived: bondingQuote.minimumReceived,
        gasEstimate: bondingQuote.gasEstimate,
        riskLevel: bondingQuote.riskLevel,
        warning: bondingQuote.warning
      };

      setState(prev => ({ ...prev, quote, quoteLoading: false }));
      return quote;
    } catch (error) {
      const code = error instanceof BondingCurveError ? error.code : 'QUOTE_ERROR';
      const message = error instanceof BondingCurveError ? error.message : 'Failed to get trading quote';
      setState(prev => ({
        ...prev,
        quoteLoading: false,
        error: {
          code,
          message,
          details: error
        }
      }));
      return null;
    }
  }, [tokenAddress]);

  // Execute trade
  const executeTrade = useCallback(async (
    type: 'buy' | 'sell',
    amount: string
  ): Promise<boolean> => {
    if (!tokenAddress || !amount || !userAddress) return false;
    
    setState(prev => ({ ...prev, isTrading: true, error: null }));
    
    try {
      let result: BondingCurveTrade;
      
      if (type === 'buy') {
        result = await bondingCurveService.buyTokens(tokenAddress, amount);
      } else {
        result = await bondingCurveService.sellTokens(tokenAddress, amount);
      }

      if (result.success) {
        // Clear quote after successful trade
        setState(prev => ({ ...prev, quote: null, isTrading: false }));
        
        // Refresh token info and user balance
        await Promise.all([
          fetchTokenInfo(tokenAddress),
          fetchUserBalance(tokenAddress, userAddress)
        ]);
        
        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('tradingSuccess', {
          detail: {
            type,
            txHash: result.transactionHash,
            tokenAddress,
            amount: result.tokenAmount || result.coreAmount,
            tradingMethod: 'bonding-curve',
            timestamp: Date.now()
          }
        }));

        return true;
      } else {
        setState(prev => ({
          ...prev,
          isTrading: false,
          error: {
            code: 'TRADE_ERROR',
            message: result.error || `Failed to ${type} tokens`,
            details: result
          }
        }));
        return false;
      }
    } catch (error) {
      const code = error instanceof BondingCurveError ? error.code : 'TRADE_ERROR';
      const message = error instanceof BondingCurveError ? error.message : `Failed to ${type} tokens`;
      setState(prev => ({
        ...prev,
        isTrading: false,
        error: {
          code,
          message,
          details: error
        }
      }));
      return false;
    }
  }, [tokenAddress, userAddress, fetchTokenInfo, fetchUserBalance]);

  // Fetch market data (trading history, price history)
  const fetchMarketData = useCallback(async (address: string) => {
    if (!address) return;
    
    setState(prev => ({ ...prev, marketDataLoading: true }));
    
    try {
      const [tradingHistory, priceHistory] = await Promise.all([
        bondingCurveService.getTradingHistory(address),
        bondingCurveService.getPriceHistory(address)
      ]);
      
      setState(prev => ({
        ...prev,
        tradingHistory,
        priceHistory,
        marketDataLoading: false
      }));
    } catch (error) {
      console.error('Error fetching market data:', error);
      setState(prev => ({ ...prev, marketDataLoading: false }));
    }
  }, []);

  // Record agent interaction
  const recordInteraction = useCallback(async (message: string): Promise<boolean> => {
    if (!tokenAddress) return false;
    
    try {
      return await bondingCurveService.recordInteraction(tokenAddress, message);
    } catch (error) {
      console.error('Error recording interaction:', error);
      return false;
    }
  }, [tokenAddress]);

  // Get bonding curve progress
  const getBondingCurveProgress = useCallback(async () => {
    if (!tokenAddress) return null;
    
    try {
      return await bondingCurveService.getBondingCurveProgress(tokenAddress);
    } catch (error) {
      console.error('Error getting bonding curve progress:', error);
      return null;
    }
  }, [tokenAddress]);

  // Auto-fetch data when tokenAddress changes
  useEffect(() => {
    if (tokenAddress) {
      fetchTokenInfo(tokenAddress);
      fetchMarketData(tokenAddress);
      
      if (userAddress) {
        fetchUserBalance(tokenAddress, userAddress);
      }
    }
  }, [tokenAddress, userAddress, fetchTokenInfo, fetchMarketData, fetchUserBalance]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Computed values
  const isGraduated = useMemo(() => state.tokenInfo?.isGraduated || false, [state.tokenInfo?.isGraduated]);
  const currentPrice = useMemo(() => state.tokenInfo?.currentPrice || '0', [state.tokenInfo?.currentPrice]);
  const marketCap = useMemo(() => state.tokenInfo?.marketCap || '0', [state.tokenInfo?.marketCap]);

  return {
    // State
    ...state,
    
    // Computed values
    isGraduated,
    currentPrice,
    marketCap,
    
    // Actions
    getQuote,
    executeTrade,
    fetchTokenInfo,
    fetchUserBalance,
    fetchMarketData,
    recordInteraction,
    getBondingCurveProgress,
    clearError,
    
    // Utilities
    isConnected: !!userAddress,
    canTrade: !!userAddress && !!signer && !isGraduated
  };
};

export default useBondingCurveTrading;
