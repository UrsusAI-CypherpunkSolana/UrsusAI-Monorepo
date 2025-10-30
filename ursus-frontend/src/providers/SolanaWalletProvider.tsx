import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { SOLANA_RPC_URL, getSolanaWallets } from '../config/solana';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

/**
 * Solana Wallet Provider
 * Replaces Wagmi/RainbowKit provider for EVM wallets
 */
export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  // Get supported wallets
  const wallets = useMemo(() => getSolanaWallets(), []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default SolanaWalletProvider;

