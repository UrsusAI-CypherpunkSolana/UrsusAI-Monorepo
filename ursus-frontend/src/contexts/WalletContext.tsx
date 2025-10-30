import React, { createContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Solana balance interface
interface WalletBalance {
  decimals: number;
  formatted: string;
  symbol: string;
  value: bigint;
}

interface WalletState {
  // Connection state
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;

  // Balance
  balance: WalletBalance | null;
  balanceSymbol: string;

  // Network state (Solana)
  chain: { id: string; name: string } | undefined;
  isOnSolanaNetwork: boolean; // For compatibility
  isOnTestnet: boolean;
  isOnMainnet: boolean;
  isSwitchLoading: boolean;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchToSolana: () => Promise<void>; // Alias for switchToTestnet
  switchToTestnet: () => Promise<void>;
  switchToMainnet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export const WalletContext = createContext<WalletState | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { publicKey, connected, connecting, disconnect: solanaDisconnect, select, wallets } = useSolanaWallet();
  const { connection } = useConnection();
  
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSwitchLoading, setIsSwitchLoading] = useState(false);

  // Get network from RPC URL
  const rpcUrl = import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.testnet.solana.com';
  const isTestnet = rpcUrl.includes('testnet');
  const isMainnet = rpcUrl.includes('mainnet');

  const chain = {
    id: isTestnet ? 'solana-testnet' : isMainnet ? 'solana-mainnet' : 'solana-devnet',
    name: isTestnet ? 'Solana Testnet' : isMainnet ? 'Solana Mainnet' : 'Solana Devnet'
  };

  // Fetch balance
  const refreshBalance = useCallback(async () => {
    if (!publicKey || !connection) {
      setBalance(null);
      return;
    }

    try {
      const lamports = await connection.getBalance(publicKey);
      const sol = lamports / LAMPORTS_PER_SOL;
      
      setBalance({
        decimals: 9,
        formatted: sol.toFixed(4),
        symbol: 'SOL',
        value: BigInt(lamports)
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(null);
    }
  }, [publicKey, connection]);

  // Auto-refresh balance
  useEffect(() => {
    if (connected && publicKey) {
      refreshBalance();
      const interval = setInterval(refreshBalance, 10000); // Every 10 seconds
      return () => clearInterval(interval);
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, refreshBalance]);

  // Connect wallet
  const connect = useCallback(async () => {
    try {
      // Select first available wallet if none selected
      if (wallets.length > 0 && !publicKey) {
        select(wallets[0].adapter.name);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  }, [wallets, publicKey, select]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await solanaDisconnect();
      setBalance(null);
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [solanaDisconnect]);

  // Network switching (not directly supported in Solana, would need to change RPC)
  const switchToTestnet = useCallback(async () => {
    setIsSwitchLoading(true);
    try {
      console.log('Network switching not directly supported. Please update VITE_SOLANA_RPC_URL to testnet RPC');
      // In a real app, you'd update the connection provider
    } finally {
      setIsSwitchLoading(false);
    }
  }, []);

  const switchToMainnet = useCallback(async () => {
    setIsSwitchLoading(true);
    try {
      console.log('Network switching not directly supported. Please update VITE_SOLANA_RPC_URL to mainnet RPC');
      // In a real app, you'd update the connection provider
    } finally {
      setIsSwitchLoading(false);
    }
  }, []);

  const value: WalletState = {
    address: publicKey?.toBase58(),
    isConnected: connected,
    isConnecting: connecting,
    isReconnecting,
    balance,
    balanceSymbol: 'SOL',
    chain,
    isOnSolanaNetwork: true, // Always true for Solana
    isOnTestnet: isTestnet,
    isOnMainnet: isMainnet,
    isSwitchLoading,
    connect,
    disconnect,
    switchToSolana: switchToTestnet, // Alias for compatibility
    switchToTestnet,
    switchToMainnet,
    refreshBalance
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

// Custom hook to use wallet context
export const useWallet = () => {
  const context = React.useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }

  // Also expose Solana wallet adapter hooks for direct access
  const solanaWallet = useSolanaWallet();

  return {
    ...context,
    // Direct access to Solana wallet adapter
    publicKey: solanaWallet.publicKey,
    wallet: solanaWallet.wallet,
    wallets: solanaWallet.wallets,
    select: solanaWallet.select,
    signTransaction: solanaWallet.signTransaction,
    signAllTransactions: solanaWallet.signAllTransactions,
    signMessage: solanaWallet.signMessage,
  };
};
