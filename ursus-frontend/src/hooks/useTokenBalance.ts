import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

export const useTokenBalance = (mintAddress?: string) => {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!publicKey || !mintAddress || !connection) {
      setBalance('0');
      return;
    }

    // Validate Solana address format
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(mintAddress)) {
      console.warn('Invalid mint address format:', mintAddress);
      setBalance('0');
      return;
    }

    setIsLoading(true);
    try {
      // Additional validation: try to create PublicKey
      let mint: PublicKey;
      try {
        mint = new PublicKey(mintAddress);
      } catch (error) {
        console.warn('Invalid PublicKey format:', mintAddress);
        setBalance('0');
        setIsLoading(false);
        return;
      }

      const ata = await getAssociatedTokenAddress(mint, publicKey);

      try {
        const tokenAccount = await getAccount(connection, ata);
        const decimals = 9; // Solana tokens typically use 9 decimals
        const formattedBalance = (Number(tokenAccount.amount) / Math.pow(10, decimals)).toString();
        setBalance(formattedBalance);
      } catch (error) {
        // Token account doesn't exist, balance is 0
        setBalance('0');
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setBalance('0');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, mintAddress, connection]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    symbol: 'TOKEN',
    decimals: 9,
    isLoading,
    refetch: fetchBalance,
  };
};

// Hook to get all user's agent token balances
export const useUserTokenBalances = () => {
  const { publicKey } = useWallet();
  const [balances, setBalances] = useState<Array<{
    tokenAddress: string;
    balance: string;
    symbol: string;
    agentName: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    try {
      // TODO: Fetch real balances from Solana
      setBalances([]);
    } catch (error) {
      console.error('Error fetching user token balances:', error);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return {
    balances,
    loading,
    refetch: fetchBalances,
  };
};