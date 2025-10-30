import React, { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Coins, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

interface Transaction {
  id: string;
  type: 'token_creation' | 'token_purchase' | 'token_sale';
  tokenName: string;
  tokenSymbol: string;
  amount: string;
  price: string;
  total: string;
  timestamp: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  userAddress: string;
}

interface TransactionHistoryProps {
  tokenAddress?: string; // If provided, show only transactions for this token
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ tokenAddress }) => {
  const { address } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'creation' | 'purchase' | 'sale'>('all');

  // Load transaction data
  useEffect(() => {
    setLoading(true);

    // Simulate loading delay
    const loadTransactions = async () => {
      // TODO: Fetch real transactions from backend API
      // For now, show empty state
      setTransactions([]);
      setLoading(false);
    };

    loadTransactions();
  }, [address, tokenAddress]);

  const filteredTransactions = transactions.filter(tx => {
    // Filter by user address if connected
    if (address && tx.userAddress.toLowerCase() !== address.toLowerCase()) {
      return false;
    }

    // Filter by transaction type
    if (filter === 'all') return true;
    if (filter === 'creation') return tx.type === 'token_creation';
    if (filter === 'purchase') return tx.type === 'token_purchase';
    if (filter === 'sale') return tx.type === 'token_sale';
    return true;
  });

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatNumber = (num: string) => {
    const n = parseFloat(num);
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(6);
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'token_creation':
        return <Coins className="text-purple-400" size={16} />;
      case 'token_purchase':
        return <TrendingUp className="text-green-400" size={16} />;
      case 'token_sale':
        return <TrendingDown className="text-red-400" size={16} />;
      default:
        return <Clock className="text-[#a0a0a0]" size={16} />;
    }
  };

  const getTransactionLabel = (type: Transaction['type']) => {
    switch (type) {
      case 'token_creation':
        return 'Token Created';
      case 'token_purchase':
        return 'Bought';
      case 'token_sale':
        return 'Sold';
      default:
        return 'Transaction';
    }
  };

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="text-green-400" size={14} />;
      case 'pending':
        return <Clock className="text-yellow-400" size={14} />;
      case 'failed':
        return <AlertCircle className="text-red-400" size={14} />;
      default:
        return null;
    }
  };

  const openInExplorer = (txHash: string) => {
    // Solana explorer URL
    const explorerUrl = `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
    window.open(explorerUrl, '_blank');
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Transaction History</h3>
          {!tokenAddress && (
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All' },
                { id: 'creation', label: 'Created' },
                { id: 'purchase', label: 'Bought' },
                { id: 'sale', label: 'Sold' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id as 'all' | 'creation' | 'purchase' | 'sale')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    filter === id
                      ? 'bg-[#d8e9ea] text-black'
                      : 'text-[#a0a0a0] hover:text-white hover:bg-[#2a2a2a]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-[#d8e9ea] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#a0a0a0]">Loading transactions...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="p-8 text-center">
          <Clock className="w-12 h-12 text-[#a0a0a0] mx-auto mb-4" />
          <h4 className="text-white font-medium mb-2">No Transactions</h4>
          <p className="text-[#a0a0a0] text-sm">
            {filter === 'all' 
              ? 'No transactions found for this wallet'
              : `No ${filter} transactions found`
            }
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#2a2a2a]">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className="p-6 hover:bg-[#0f0f0f] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg flex items-center justify-center">
                    {getTransactionIcon(tx.type)}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-white font-medium">{getTransactionLabel(tx.type)}</h4>
                      {getStatusIcon(tx.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                      <span>{tx.tokenName} ({tx.tokenSymbol})</span>
                      <span>•</span>
                      <span>{formatTime(tx.timestamp)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-white font-medium">
                      {tx.type === 'token_creation' ? (
                        <span className="text-purple-400">+{formatNumber(tx.amount)} {tx.tokenSymbol}</span>
                      ) : tx.type === 'token_purchase' ? (
                        <span className="text-green-400">+{formatNumber(tx.amount)} {tx.tokenSymbol}</span>
                      ) : (
                        <span className="text-red-400">-{formatNumber(tx.amount)} {tx.tokenSymbol}</span>
                      )}
                    </div>
                    <button
                      onClick={() => openInExplorer(tx.txHash)}
                      className="text-[#a0a0a0] hover:text-white transition-colors"
                      title="View on Explorer"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                  <div className="text-sm text-[#a0a0a0]">
                    {tx.type === 'token_creation' ? (
                      <span>Fee: {tx.total} SOL</span>
                    ) : (
                      <span>
                        {tx.type === 'token_purchase' ? '-' : '+'}{tx.total} SOL
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Transaction Hash */}
              <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
                <div className="flex items-center justify-between">
                  <span className="text-[#a0a0a0] text-sm">Transaction Hash</span>
                  <button
                    onClick={() => openInExplorer(tx.txHash)}
                    className="text-[#d8e9ea] hover:text-white transition-colors font-mono text-sm"
                  >
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-10)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
