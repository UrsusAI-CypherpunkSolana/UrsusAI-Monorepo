import React from 'react';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, Info, DollarSign, Percent, Clock } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

// Format price with decimal notation (no scientific notation)
const formatPrice = (price: string | number) => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (numPrice === 0) return '0.000000000000';
  if (isNaN(numPrice)) return '0.000000000000';

  // Always use decimal format with appropriate precision based on value size
  if (numPrice < 0.000000000001) {
    return numPrice.toFixed(18);
  } else if (numPrice < 0.000000001) {
    return numPrice.toFixed(15);
  } else if (numPrice < 0.000001) {
    return numPrice.toFixed(12);
  } else if (numPrice < 0.001) {
    return numPrice.toFixed(9);
  } else if (numPrice < 1) {
    return numPrice.toFixed(6);
  } else {
    return numPrice.toFixed(4);
  }
};

interface TradingQuote {
  solAmount?: string;
  tokensReceived?: string;
  tokenAmount?: string;
  solReceived?: string;
  currentPrice?: string;
  newPrice?: string;
  priceImpact: number;
  slippage: number;
  fees: {
    platformFee: string;
    creatorFee: string;
    totalFees: string;
  };
  minimumReceived: string;
  marketCap?: string;
  reserve?: string;
  error?: string;
}

interface ProfessionalQuoteDisplayProps {
  quote: TradingQuote | null;
  tradeType: 'buy' | 'sell';
  amount: string;
  isGraduated: boolean;
  loading: boolean;
  error: string | null;
  className?: string;
}

export const ProfessionalQuoteDisplay: React.FC<ProfessionalQuoteDisplayProps> = ({
  quote,
  tradeType,
  amount,
  isGraduated,
  loading,
  error,
  className = ''
}) => {
  if (loading) {
    return (
      <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#d8e9ea]"></div>
          <span className="ml-3 text-[#a0a0a0]">Getting quote...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-[#1a1a1a] border border-red-500/20 rounded-xl p-4 ${className}`}>
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-medium">Quote Error</span>
        </div>
        <p className="text-red-300 text-sm">{error}</p>
        <div className="mt-3 p-3 bg-red-500/10 rounded-lg">
          <p className="text-xs text-red-200">
            If this token is graduated, try using DEX trading instead of bonding curve.
          </p>
        </div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
        <div className="flex items-center justify-center py-8 text-[#a0a0a0]">
          <Info className="w-5 h-5 mr-2" />
          Enter an amount to get a quote
        </div>
      </div>
    );
  }

  const isBuy = tradeType === 'buy';
  const outputAmount = isBuy ? quote.tokensReceived : quote.solReceived;
  const inputAmount = isBuy ? quote.solAmount : quote.tokenAmount;
  
  const priceImpactColor = quote.priceImpact > 5 ? 'text-red-400' : 
                          quote.priceImpact > 2 ? 'text-yellow-400' : 'text-green-400';
  
  const slippageColor = quote.slippage > 3 ? 'text-red-400' : 
                       quote.slippage > 1 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isBuy ? (
            <TrendingUp className="w-5 h-5 text-green-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-400" />
          )}
          <span className="font-medium text-white">
            {isBuy ? 'Buy' : 'Sell'} Quote
          </span>
        </div>
        
        {isGraduated && (
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-xs text-yellow-400 font-medium">DEX</span>
          </div>
        )}
      </div>

      {/* Main Quote Display */}
      <div className="space-y-4">
        {/* Input/Output */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#2a2a2a] rounded-lg p-3 min-w-0">
            <div className="text-xs text-[#a0a0a0] mb-1">You {isBuy ? 'Pay' : 'Sell'}</div>
            <div className="text-lg font-bold text-white truncate" title={formatNumber(parseFloat(inputAmount || amount), { decimals: 6 })}>
              {formatNumber(parseFloat(inputAmount || amount), { decimals: 6 })}
            </div>
            <div className="text-xs text-[#a0a0a0]">
              {isBuy ? 'SOL' : 'TOKENS'}
            </div>
          </div>

          <div className="bg-[#2a2a2a] rounded-lg p-3 min-w-0">
            <div className="text-xs text-[#a0a0a0] mb-1">You {isBuy ? 'Receive' : 'Get'}</div>
            <div className="text-lg font-bold text-[#d8e9ea] truncate" title={formatNumber(parseFloat(outputAmount || '0'), { decimals: 6 })}>
              {formatNumber(parseFloat(outputAmount || '0'), { decimals: 6 })}
            </div>
            <div className="text-xs text-[#a0a0a0]">
              {isBuy ? 'TOKENS' : 'SOL'}
            </div>
          </div>
        </div>

        {/* Price Information */}
        {((quote.currentPrice && quote.currentPrice !== '0') || (quote.newPrice && quote.newPrice !== '0')) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#2a2a2a] rounded-lg p-3 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-[#a0a0a0]" />
                <span className="text-xs text-[#a0a0a0]">Current Price</span>
              </div>
              <div className="text-sm font-medium text-white truncate" title={`${formatPrice(parseFloat(quote.currentPrice || '0'))} SOL`}>
                {formatPrice(parseFloat(quote.currentPrice || '0'))} SOL
              </div>
            </div>

            <div className="bg-[#2a2a2a] rounded-lg p-3 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-[#a0a0a0]" />
                <span className="text-xs text-[#a0a0a0]">New Price</span>
              </div>
              <div className="text-sm font-medium text-white truncate" title={`${formatNumber(parseFloat(quote.newPrice || '0'), { decimals: 8 })} SOL`}>
                {formatNumber(parseFloat(quote.newPrice || '0'), { decimals: 8 })} SOL
              </div>
            </div>
          </div>
        )}

        {/* Trading Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Percent className="w-3 h-3 text-[#a0a0a0]" />
              <span className="text-xs text-[#a0a0a0]">Price Impact</span>
            </div>
            <div className={`text-sm font-medium ${priceImpactColor}`}>
              {quote.priceImpact.toFixed(2)}%
            </div>
          </div>
          
          <div className="bg-[#2a2a2a] rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Percent className="w-3 h-3 text-[#a0a0a0]" />
              <span className="text-xs text-[#a0a0a0]">Slippage</span>
            </div>
            <div className={`text-sm font-medium ${slippageColor}`}>
              {quote.slippage.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Fees Breakdown */}
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center gap-1 mb-2">
            <DollarSign className="w-3 h-3 text-[#a0a0a0]" />
            <span className="text-xs text-[#a0a0a0]">Fees</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#a0a0a0]">Platform Fee</span>
              <span className="text-white">{(parseFloat(quote.fees.platformFee) * 100).toFixed(1)}%</span>
            </div>
            {parseFloat(quote.fees.creatorFee) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-[#a0a0a0]">Creator Fee</span>
                <span className="text-white">{(parseFloat(quote.fees.creatorFee) * 100).toFixed(1)}%</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t border-[#3a3a3a] pt-1">
              <span className="text-[#a0a0a0] font-medium">Total Fees</span>
              <span className="text-white font-medium">{(parseFloat(quote.fees.totalFees) * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Minimum Received */}
        <div className="bg-[#2a2a2a] rounded-lg p-3 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-[#a0a0a0]" />
            <span className="text-xs text-[#a0a0a0]">Minimum Received</span>
          </div>
          <div className="text-sm font-medium text-white truncate" title={`${formatNumber(parseFloat(quote.minimumReceived), { decimals: 6 })} ${isBuy ? 'TOKENS' : 'SOL'}`}>
            {formatNumber(parseFloat(quote.minimumReceived), { decimals: 6 })} {isBuy ? 'TOKENS' : 'SOL'}
          </div>
          <div className="text-xs text-[#a0a0a0] mt-1">
            You will receive at least this amount or the transaction will revert
          </div>
        </div>

        {/* Trading Method Info */}
        <div className={`p-3 rounded-lg ${isGraduated ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {isGraduated ? (
              <Zap className="w-4 h-4 text-yellow-400" />
            ) : (
              <TrendingUp className="w-4 h-4 text-blue-400" />
            )}
            <span className={`text-sm font-medium ${isGraduated ? 'text-yellow-400' : 'text-blue-400'}`}>
              {isGraduated ? 'DEX Trading' : 'Bonding Curve Trading'}
            </span>
          </div>
          <p className={`text-xs ${isGraduated ? 'text-yellow-200' : 'text-blue-200'}`}>
            {isGraduated 
              ? 'This token has graduated to Uniswap V2. Trading with unlimited liquidity and market-driven pricing.'
              : 'Trading on bonding curve with algorithmic pricing. Price increases with each buy.'
            }
          </p>
        </div>

        {/* Warnings */}
        {quote.priceImpact > 5 && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">High Price Impact Warning</span>
            </div>
            <p className="text-xs text-red-200">
              This trade will significantly impact the token price. Consider reducing your trade size.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
