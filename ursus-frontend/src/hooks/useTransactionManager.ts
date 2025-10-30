import { useState, useCallback, useEffect } from 'react';
import { useWallet } from './useWallet';
import { Hash } from 'viem';
import { apiService } from '../services/api';

export interface Transaction {
  hash: Hash;
  type: 'buy' | 'sell' | 'approve' | 'create_agent' | 'other';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: number;
  amount?: string;
  tokenAddress?: string;
  agentAddress?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  error?: string;
}

export interface TransactionOptions {
  onSuccess?: (receipt: TransactionReceipt) => void;
  onError?: (error: Error) => void;
  onPending?: (hash: Hash) => void;
}

export interface TransactionReceipt {
  hash: Hash;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'reverted';
  timestamp: number;
}

interface GasEstimateResponse {
  gasEstimate: string;
}

interface GasPriceResponse {
  gasPrice: string;
}

interface TransactionStatusResponse {
  receipt?: TransactionReceipt;
}

export const useTransactionManager = () => {
  const { address, isConnected } = useWallet();
  // Note: Using backend API for transaction monitoring instead of direct RPC calls
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Hash[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load transactions from localStorage
  useEffect(() => {
    if (address) {
      const stored = localStorage.getItem(`transactions_${address}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setTransactions(parsed);
        } catch (error) {
          console.error('Error loading transactions:', error);
        }
      }
    }
  }, [address]);

  // Save transactions to localStorage
  const saveTransactions = useCallback((txs: Transaction[]) => {
    if (address) {
      localStorage.setItem(`transactions_${address}`, JSON.stringify(txs));
    }
  }, [address]);

  // Add new transaction
  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(prev => {
      const updated = [tx, ...prev.slice(0, 99)]; // Keep last 100 transactions
      saveTransactions(updated);
      return updated;
    });
  }, [saveTransactions]);

  // Update transaction status
  const updateTransaction = useCallback((hash: Hash, updates: Partial<Transaction>) => {
    setTransactions(prev => {
      const updated = prev.map(tx => 
        tx.hash === hash ? { ...tx, ...updates } : tx
      );
      saveTransactions(updated);
      return updated;
    });
  }, [saveTransactions]);

  // Monitor pending transactions via backend API
  useEffect(() => {
    if (pendingTransactions.length === 0) return;

    const checkTransactions = async () => {
      for (const hash of pendingTransactions) {
        try {
          // Use backend API to check transaction status
          const response = await apiService.get(`/blockchain/transaction/${hash}`);
          const data = response.data as TransactionStatusResponse;

          if (data.receipt) {
            const receipt = data.receipt;
            const status = receipt.status === 'success' ? 'confirmed' : 'failed';

            updateTransaction(hash, {
              status,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              ...(status === 'failed' && { error: 'Transaction failed' })
            });

            setPendingTransactions(prev => prev.filter(h => h !== hash));
          }
        } catch (error) {
          console.error(`Error checking transaction ${hash}:`, error);
          // If transaction not found after 10 minutes, mark as failed
          const transaction = transactions.find(tx => tx.hash === hash);
          if (transaction && Date.now() - transaction.timestamp > 600000) {
            updateTransaction(hash, {
              status: 'failed',
              error: 'Transaction timeout - not found on blockchain'
            });
            setPendingTransactions(prev => prev.filter(h => h !== hash));
          }
        }
      }
    };

    const interval = setInterval(checkTransactions, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [pendingTransactions, updateTransaction, transactions]);

  // Execute transaction with monitoring
  const executeTransaction = useCallback(async (
    txFunction: () => Promise<Hash>,
    type: Transaction['type'],
    options: TransactionOptions = {},
    metadata: Partial<Transaction> = {}
  ) => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected');
    }

    setIsProcessing(true);

    try {
      const hash = await txFunction();
      
      const transaction: Transaction = {
        hash,
        type,
        status: 'pending',
        timestamp: Date.now(),
        ...metadata
      };

      addTransaction(transaction);
      setPendingTransactions(prev => [...prev, hash]);
      
      options.onPending?.(hash);

      // Transaction submitted successfully, monitoring will be handled by useEffect
      console.log(`✅ Transaction submitted: ${hash}`);

      // Note: Transaction monitoring is handled by the useEffect hook above
      // which polls the backend API for transaction status updates

      return hash;
    } catch (error) {
      console.error('Transaction execution error:', error);
      options.onError?.(error as Error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [isConnected, address, addTransaction]);

  // Get transaction by hash
  const getTransaction = useCallback((hash: Hash) => {
    return transactions.find(tx => tx.hash === hash);
  }, [transactions]);

  // Get transactions by type
  const getTransactionsByType = useCallback((type: Transaction['type']) => {
    return transactions.filter(tx => tx.type === type);
  }, [transactions]);

  // Get pending transactions
  const getPendingTransactions = useCallback(() => {
    return transactions.filter(tx => tx.status === 'pending');
  }, [transactions]);

  // Get recent transactions
  const getRecentTransactions = useCallback((limit = 10) => {
    return transactions.slice(0, limit);
  }, [transactions]);

  // Clear all transactions
  const clearTransactions = useCallback(() => {
    setTransactions([]);
    if (address) {
      localStorage.removeItem(`transactions_${address}`);
    }
  }, [address]);

  // Calculate transaction stats
  const getTransactionStats = useCallback(() => {
    const total = transactions.length;
    const confirmed = transactions.filter(tx => tx.status === 'confirmed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const pending = transactions.filter(tx => tx.status === 'pending').length;

    return {
      total,
      confirmed,
      failed,
      pending,
      successRate: total > 0 ? (confirmed / total) * 100 : 0
    };
  }, [transactions]);

  // Estimate gas for transaction via backend API
  const estimateGas = useCallback(async (
    to: string,
    txData: string,
    value: bigint = 0n
  ) => {
    if (!address) {
      throw new Error('Wallet address not available');
    }

    try {
      // Use backend API for gas estimation
      const response = await apiService.post('/blockchain/estimate-gas', {
        from: address,
        to,
        data: txData,
        value: value.toString()
      });

      const responseData = response.data as GasEstimateResponse;
      const gasEstimate = BigInt(responseData.gasEstimate);
      return gasEstimate;
    } catch (error) {
      console.error('Gas estimation error:', error);
      // Fallback to a reasonable default
      return BigInt(200000); // 200k gas as fallback
    }
  }, [address]);

  // Get gas price via backend API
  const getGasPrice = useCallback(async () => {
    try {
      // Use backend API for gas price
      const response = await apiService.get('/blockchain/gas-price');
      const data = response.data as GasPriceResponse;
      const gasPrice = BigInt(data.gasPrice);
      return gasPrice;
    } catch (error) {
      console.error('Gas price error:', error);
      // Fallback to 1 gwei
      return BigInt(1000000000);
    }
  }, []);

  return {
    // State
    transactions,
    pendingTransactions: getPendingTransactions(),
    isProcessing,
    
    // Actions
    executeTransaction,
    addTransaction,
    updateTransaction,
    clearTransactions,
    
    // Getters
    getTransaction,
    getTransactionsByType,
    getPendingTransactions,
    getRecentTransactions,
    getTransactionStats,
    
    // Utilities
    estimateGas,
    getGasPrice
  };
};

export default useTransactionManager;
