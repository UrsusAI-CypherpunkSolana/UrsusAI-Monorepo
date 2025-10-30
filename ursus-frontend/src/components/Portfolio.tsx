import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Wallet, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';

import TransactionHistory from './TransactionHistory';

interface PortfolioProps {
  onBack: () => void;
}

interface TokenHolding {
  tokenAddress: string;
  balance: string;
  symbol: string;
  agentName: string;
  currentPrice: string;
  priceChange24h: number;
  value: number;
  totalInvested: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  averageBuyPrice: string;
  portfolioWeight: number;
}

interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercentage: number;
  positionCount: number;
  bestPerformer: TokenHolding | null;
  worstPerformer: TokenHolding | null;
}

const Portfolio: React.FC<PortfolioProps> = ({ onBack }) => {
  const { isConnected, address } = useWallet();
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPortfolioData = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    try {
      console.log('📊 Fetching portfolio data for:', address);

      // TODO: Fetch real portfolio data from backend
      const holdings = [];

      // Process holdings data
      const processedHoldings: TokenHolding[] = holdings.map((holding: any) => {
          const currentValue = parseFloat(holding.currentValue);
          const totalInvested = parseFloat(holding.totalInvested);
          const unrealizedPnL = currentValue - totalInvested;
          const unrealizedPnLPercentage = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

          return {
            tokenAddress: holding.tokenAddress,
            balance: holding.balance,
            symbol: holding.tokenSymbol,
            agentName: holding.tokenName,
            currentPrice: (currentValue / parseFloat(holding.balance)).toString(),
            priceChange24h: 0, // Would come from agent data
            value: currentValue,
            totalInvested,
            unrealizedPnL,
            unrealizedPnLPercentage,
            averageBuyPrice: holding.averagePrice || '0',
            portfolioWeight: 0 // Will be calculated below
          };
        });

        // Calculate portfolio totals
        const totalValue = processedHoldings.reduce((sum, holding) => sum + holding.value, 0);
        const totalInvested = processedHoldings.reduce((sum, holding) => sum + holding.totalInvested, 0);
        const totalPnL = totalValue - totalInvested;
        const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

        // Calculate portfolio weights
        processedHoldings.forEach(holding => {
          holding.portfolioWeight = totalValue > 0 ? (holding.value / totalValue) * 100 : 0;
        });

        // Find best and worst performers
        const bestPerformer = processedHoldings.length > 0
          ? processedHoldings.reduce((best, current) =>
              current.unrealizedPnLPercentage > best.unrealizedPnLPercentage ? current : best)
          : null;

        const worstPerformer = processedHoldings.length > 0
          ? processedHoldings.reduce((worst, current) =>
              current.unrealizedPnLPercentage < worst.unrealizedPnLPercentage ? current : worst)
          : null;

        // Set portfolio summary
        const portfolioSummary: PortfolioSummary = {
          totalValue,
          totalInvested,
          totalPnL,
          totalPnLPercentage,
          positionCount: processedHoldings.length,
          bestPerformer,
          worstPerformer
        };

        setHoldings(processedHoldings);
        setPortfolioSummary(portfolioSummary);

        console.log('✅ Portfolio data loaded:', {
          holdings: processedHoldings.length,
          totalValue: portfolioSummary.totalValue,
          totalPnL: portfolioSummary.totalPnL
        });
      } catch (error) {
      console.error('❌ Error fetching portfolio data:', error);
      setHoldings([]);
      setPortfolioSummary(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchPortfolioData();
  }, [fetchPortfolioData]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatCurrency = (num: number) => {
    return `$${formatNumber(num)}`;
  };

  if (!isConnected) {
    return (
      <div className="ml-[200px] p-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[#a0a0a0]" />
          </button>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        </div>
        
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Wallet className="w-16 h-16 text-[#a0a0a0] mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-[#a0a0a0]">Connect your wallet to view your token holdings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-[200px] p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-[#a0a0a0]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Portfolio</h1>
            <p className="text-[#a0a0a0]">Your agent token holdings</p>
          </div>
        </div>
        
        <button
          onClick={() => {
            fetchPortfolioData();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:border-[#3a3a3a] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={`text-[#d8e9ea] ${loading ? 'animate-spin' : ''}`} />
          <span className="text-white">Refresh</span>
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-lg flex items-center justify-center">
              <Wallet size={20} className="text-black" />
            </div>
            <div>
              <p className="text-[#a0a0a0] text-sm">Total Value</p>
              <p className="text-white text-xl font-bold">{formatCurrency(portfolioSummary?.totalValue || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[#a0a0a0] text-sm">Holdings</p>
              <p className="text-white text-xl font-bold">{holdings.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <ExternalLink size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[#a0a0a0] text-sm">Wallet</p>
              <p className="text-white text-sm font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Holdings List */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#2a2a2a]">
          <h2 className="text-white text-lg font-semibold">Your Holdings</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-[#d8e9ea] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[#a0a0a0]">Loading holdings...</p>
          </div>
        ) : holdings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[#a0a0a0] mb-4">No token holdings found</p>
            <p className="text-sm text-[#666]">Create an agent to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {holdings.map((holding) => (
              <div key={holding.tokenAddress} className="p-6 hover:bg-[#0f0f0f] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-xl flex items-center justify-center">
                      <span className="text-black font-bold text-lg">
                        {holding.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{holding.agentName}</h3>
                      <p className="text-[#a0a0a0] text-sm">{holding.symbol}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-white font-semibold">{formatNumber(parseFloat(holding.balance))} {holding.symbol}</p>
                    <p className="text-[#a0a0a0] text-sm">{formatCurrency(holding.value)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="mt-8">
        <TransactionHistory />
      </div>
    </div>
  );
};

export default Portfolio;
