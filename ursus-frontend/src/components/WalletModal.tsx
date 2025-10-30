import React, { useState } from 'react';
import { X, Wallet, ExternalLink, Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { formatEther } from 'viem';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const { 
    isConnected, 
    address, 
    balance, 
    chain, 
    connectWallet, 
    disconnect, 
    isOnCoreNetwork, 
    switchToCore,
    isConnectLoading,
    isSwitchLoading,
    connectError 
  } = useWallet();

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = async (connectorId?: string) => {
    try {
      await connectWallet(connectorId);
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onClose();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
          <h2 className="text-xl font-bold text-white">
            {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {!isConnected ? (
            /* Connection Options */
            <div className="space-y-4">
              <p className="text-gray-300 text-sm mb-6">
                Connect your wallet to start creating and trading AI agents on Core Network.
              </p>

              {/* MetaMask */}
              <button
                onClick={() => handleConnect('metaMask')}
                disabled={isConnectLoading}
                className="w-full flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Wallet size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">MetaMask</div>
                  <div className="text-gray-400 text-sm">Connect using MetaMask wallet</div>
                </div>
                {isConnectLoading && <Loader2 size={20} className="text-gray-400 animate-spin" />}
              </button>

              {/* Injected Wallet */}
              <button
                onClick={() => handleConnect('injected')}
                disabled={isConnectLoading}
                className="w-full flex items-center gap-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
              >
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Wallet size={20} className="text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">Browser Wallet</div>
                  <div className="text-gray-400 text-sm">Connect using injected wallet</div>
                </div>
                {isConnectLoading && <Loader2 size={20} className="text-gray-400 animate-spin" />}
              </button>

              {connectError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle size={16} className="text-red-400" />
                  <span className="text-red-400 text-sm">
                    {connectError.message || 'Failed to connect wallet'}
                  </span>
                </div>
              )}

              <div className="text-center text-gray-500 text-xs mt-6">
                By connecting your wallet, you agree to our Terms of Service and Privacy Policy.
              </div>
            </div>
          ) : (
            /* Connected Wallet Info */
            <div className="space-y-6">
              {/* Network Status */}
              {!isOnCoreNetwork ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={16} className="text-yellow-400" />
                    <span className="text-yellow-400 font-medium">Wrong Network</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-3">
                    Please switch to Core Testnet to use URSUS platform.
                  </p>
                  <button
                    onClick={() => switchToCore()}
                    disabled={isSwitchLoading}
                    className="w-full bg-yellow-500 text-black px-4 py-2 rounded-lg font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSwitchLoading && <Loader2 size={16} className="animate-spin" />}
                    Switch to Core Testnet
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-400" />
                    <span className="text-green-400 font-medium">Connected to Core Testnet</span>
                  </div>
                </div>
              )}

              {/* Wallet Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Wallet Address</label>
                  <div className="flex items-center gap-2 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <span className="text-white font-mono text-sm flex-1">
                      {formatAddress(address!)}
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                    <a
                      href={`https://scan.test2.btcs.network/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Balance</label>
                  <div className="p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <span className="text-white font-medium">
                      {balance ? `${parseFloat(formatEther(balance.value)).toFixed(4)} ${balance.symbol}` : '0.0000 tSOL2'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Network</label>
                  <div className="p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                    <span className="text-white font-medium">
                      {chain?.name || 'Unknown Network'} ({chain?.id})
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleDisconnect}
                  className="flex-1 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg font-medium hover:bg-red-500/20 transition-colors"
                >
                  Disconnect
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
