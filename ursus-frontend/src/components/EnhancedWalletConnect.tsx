import React, { useState } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { Copy, Check } from 'lucide-react';

interface EnhancedWalletConnectProps {
  className?: string;
  showTransactions?: boolean;
  showNetworkInfo?: boolean;
}

const EnhancedWalletConnect: React.FC<EnhancedWalletConnectProps> = ({
  className = '',
}) => {
  const { publicKey, connected } = useSolanaWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Solana Wallet Multi Button with custom styling */}
      <WalletMultiButton
        style={{
          backgroundColor: connected ? '#1a1a1a' : '#d8e9ea',
          color: connected ? 'white' : 'black',
          borderRadius: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          border: connected ? '1px solid #2a2a2a' : 'none',
          transition: 'all 0.2s',
        }}
      />

      {/* Copy Address Button (when connected) */}
      {connected && publicKey && (
        <button
          onClick={copyAddress}
          className="p-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:border-[#3a3a3a] rounded-lg transition-colors"
          title="Copy address"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
      )}
    </div>
  );
};

export default EnhancedWalletConnect;
