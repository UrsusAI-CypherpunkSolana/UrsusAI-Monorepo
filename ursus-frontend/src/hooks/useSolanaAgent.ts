import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { AGENT_FACTORY_PROGRAM_ID, TX_CONFIG } from '../config/solana';
import { BN } from '@coral-xyz/anchor';

/**
 * Hook for interacting with Agent Factory program
 * Replaces useAgentFactory hook for EVM
 */
export const useSolanaAgent = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Create a new agent
   */
  const createAgent = useCallback(
    async (
      name: string,
      symbol: string,
      description: string,
      instructions: string,
      model: string,
      category: string
    ) => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        // TODO: Build transaction using Anchor program
        // This is a placeholder - actual implementation would use the program instance
        
        console.log('Creating agent:', {
          name,
          symbol,
          description,
          instructions,
          model,
          category,
        });

        // TODO: Return actual transaction signature
        throw new Error('Agent creation not yet implemented on Solana');
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  /**
   * Buy tokens
   */
  const buyTokens = useCallback(
    async (
      agentPubkey: string,
      solAmount: number,
      minTokensOut: number = 0
    ) => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        console.log('Buying tokens:', {
          agent: agentPubkey,
          solAmount,
          minTokensOut,
        });

        // TODO: Build and send buy transaction
        throw new Error('Buy tokens not yet implemented on Solana');
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  /**
   * Sell tokens
   */
  const sellTokens = useCallback(
    async (
      agentPubkey: string,
      tokenAmount: number,
      minSolOut: number = 0
    ) => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        console.log('Selling tokens:', {
          agent: agentPubkey,
          tokenAmount,
          minSolOut,
        });

        // TODO: Build and send sell transaction
        throw new Error('Sell tokens not yet implemented on Solana');
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  /**
   * Get agent info
   */
  const getAgentInfo = useCallback(
    async (agentPubkey: string) => {
      try {
        const pubkey = new PublicKey(agentPubkey);
        const accountInfo = await connection.getAccountInfo(pubkey);

        if (!accountInfo) {
          throw new Error('Agent not found');
        }

        // TODO: Parse account data using Anchor
        
        return {
          address: agentPubkey,
          // ...parsed data
        };
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      }
    },
    [connection]
  );

  /**
   * Get token balance
   */
  const getTokenBalance = useCallback(
    async (mintAddress: string) => {
      if (!publicKey) {
        return { amount: '0', decimals: 9, uiAmount: 0 };
      }

      try {
        const mintPubkey = new PublicKey(mintAddress);
        const tokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          publicKey
        );

        const balance = await connection.getTokenAccountBalance(tokenAccount);
        
        return {
          amount: balance.value.amount,
          decimals: balance.value.decimals,
          uiAmount: balance.value.uiAmount || 0,
        };
      } catch (err) {
        console.error('Error fetching token balance:', err);
        return { amount: '0', decimals: 9, uiAmount: 0 };
      }
    },
    [publicKey, connection]
  );

  /**
   * Get SOL balance
   */
  const getSOLBalance = useCallback(async () => {
    if (!publicKey) {
      return 0;
    }

    try {
      const balance = await connection.getBalance(publicKey);
      return balance / 1_000_000_000; // Convert lamports to SOL
    } catch (err) {
      console.error('Error fetching SOL balance:', err);
      return 0;
    }
  }, [publicKey, connection]);

  return {
    createAgent,
    buyTokens,
    sellTokens,
    getAgentInfo,
    getTokenBalance,
    getSOLBalance,
    loading,
    error,
  };
};

export default useSolanaAgent;

