import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, Clock, Users, XCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { usePriceUpdates } from '../hooks/useWebSocket';
import { useBondingCurveTrading } from '../hooks/useBondingCurveTrading';

interface Agent {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  symbol?: string; // For backward compatibility
  currentPrice: string;
  marketCap: string;
  priceChange24h?: string;
  volume24h?: string;
  holders?: number;
  isGraduated?: boolean;
  bondingCurveInfo?: {
    reserve: string;
    supply: string;
    progress: number;
  };
}

interface Quote {
  inputAmount: string;
  outputAmount: string;
  tokensReceived?: string;
  solReceived?: string;
  priceImpact: number;
  fee?: string;
  fees?: {
    totalFees: string;
    platformFee?: string;
    creatorFee?: string;
  };
  slippage: number;
  minimumReceived?: string;
  gasEstimate?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  warning?: string;
}

interface Trade {
  id: string;
  type: 'buy' | 'sell' | 'tokensPurchased' | 'tokensSold';
  amount: string;
  price: string;
  timestamp: string | number;
  user: string;
  tokensReceived?: string;
  tokensAmount?: string;
  solAmount?: string;
  solReceived?: string;
}

interface PumpTradingInterfaceProps {
  agentAddress: string;
  agentData: Agent;
}

const PumpTradingInterface: React.FC<PumpTradingInterfaceProps> = ({
  agentAddress,
  agentData
}) => {
  const { isConnected, address } = useWallet();
  const { priceData } = usePriceUpdates(agentAddress);

  // Agent stats from real-time data
  const agentStats = {
    currentPrice: priceData?.price || parseFloat(agentData?.currentPrice || '0'),
    marketCap: parseFloat(agentData?.marketCap || '0'),
    volume24h: parseFloat(agentData?.volume24h || '0'),
    holders: agentData?.holders || 0,
    priceChange24h: parseFloat(agentData?.priceChange24h || '0')
  };
  const recentEvents = useMemo(() => {
    return [] as Array<{id: string; type: string; data: Record<string, unknown>; timestamp: number}>;
  }, []);

  // URSUS Bonding Curve Trading Integration
  const {
    isTrading,
    quoteLoading,
    getQuote: getBondingCurveQuote,
    executeTrade: executeBondingCurveTrade,
    error: tradingError,
    tokenInfo: bondingTokenInfo,
    tradingHistory,
    isGraduated,
    currentPrice: bondingCurvePrice,
    marketCap: bondingCurveMarketCap
  } = useBondingCurveTrading(agentAddress);

  // Trading state
  const needsApproval = false; // URSUS bonding curve doesn't need approval for SOL
  const approving = false;
  const virtualsTrades = useMemo(() => tradingHistory || [], [tradingHistory]);

  // Trading functions
  const executeTrade = useCallback(async (type: 'buy' | 'sell', amount: string) => {
    return await executeBondingCurveTrade(type, amount);
  }, [executeBondingCurveTrade]);

  const approveAllowance = useCallback(async () => true, []); // No approval needed for SOL

  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [tokenType, setTokenType] = useState<'sentient' | 'prototype'>('sentient');
  const [userBalance, setUserBalance] = useState('0');
  const [showApproval, setShowApproval] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);

  // Quick buy amounts (in SOL)
  const quickAmounts = ['0.1', '0.5', '1', '5', '10'];

  const getQuote = useCallback(async () => {
    if (!amount || parseFloat(amount) <= 0) return;

    try {
      // Use URSUS bonding curve for real quotes
      const bondingQuote = await getBondingCurveQuote(activeTab, amount);

      if (bondingQuote) {
        // Convert bonding curve quote to our Quote interface
        const convertedQuote: Quote = {
          inputAmount: bondingQuote.inputAmount,
          outputAmount: bondingQuote.outputAmount,
          tokensReceived: bondingQuote.tokensReceived,
          solReceived: bondingQuote.solReceived,
          priceImpact: bondingQuote.priceImpact,
          slippage: bondingQuote.slippage,
          fees: bondingQuote.fees,
          minimumReceived: bondingQuote.minimumReceived,
          gasEstimate: bondingQuote.gasEstimate,
          riskLevel: bondingQuote.riskLevel,
          warning: bondingQuote.warning
        };

        setQuote(convertedQuote);
      } else {
        setQuote(null);
      }
    } catch (error) {
      console.error('Quote error:', error);
      setQuote(null);
    }
  }, [amount, activeTab]); // Removed getBondingCurveQuote dependency to prevent re-renders

  // Get quote when amount changes - with debounce
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const timeoutId = setTimeout(() => {
        getQuote();
      }, 800); // Quick debounce - 0.8 seconds for responsive UX

      return () => clearTimeout(timeoutId);
    } else {
      setQuote(null);
    }
  }, [amount, activeTab, getQuote]);

  // Update recent trades from Virtuals Protocol and WebSocket
  useEffect(() => {
    // Combine Virtuals Protocol trades with WebSocket events
    const combinedTrades: Trade[] = [];

    // URSUS Bonding Curve trades will be added here
    // TODO: Implement real bonding curve trade history

    // Add WebSocket events
    if (recentEvents) {
      const tradeEvents = recentEvents.filter(event =>
        event.type === 'tokensPurchased' || event.type === 'tokensSold'
      ).map(event => {
        const eventData = event.data as { amount?: string; price?: string; user?: string; tokensReceived?: string; solReceived?: string };
        return {
          id: `ws-${event.timestamp}`,
          type: event.type === 'tokensPurchased' ? 'buy' : 'sell' as 'buy' | 'sell',
          amount: eventData?.amount || '0',
          price: eventData?.price || '0',
          timestamp: event.timestamp,
          user: eventData?.user || 'Unknown',
          tokensReceived: eventData?.tokensReceived,
          solReceived: eventData?.solReceived
        };
      });
      combinedTrades.push(...tradeEvents);
    }

    // Sort by timestamp and take latest 10
    const sortedTrades = combinedTrades
      .sort((a, b) => {
        const timeA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : a.timestamp;
        const timeB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : b.timestamp;
        return timeB - timeA;
      })
      .slice(0, 10);

    setRecentTrades(sortedTrades);
  }, [recentEvents, virtualsTrades]);

  const handleTrade = async () => {
    if (!isConnected || !quote || !amount) return;

    try {
      // Check if approval is needed first
      if (needsApproval && activeTab === 'sell') {
        setShowApproval(true);
        return;
      }

      // Execute the trade using URSUS bonding curve
      const success = await executeTrade(activeTab, amount);

      if (success) {
        // Reset form
        setAmount('');
        setQuote(null);
        setShowApproval(false);

        // Show success message
        alert(`${activeTab === 'buy' ? 'Purchase' : 'Sale'} successful!`);

        // Refresh balance
        fetchUserBalance();
      } else {
        alert('Trade failed. Please try again.');
      }
    } catch (error) {
      console.error('Trade error:', error);
      alert('Trade failed. Please try again.');
    }
  };

  const handleApproval = async () => {
    if (!amount) return;

    const success = await approveAllowance();
    if (success) {
      setShowApproval(false);
      // Now execute the trade
      handleTrade();
    } else {
      alert('Approval failed. Please try again.');
    }
  };

  const fetchUserBalance = useCallback(async () => {
    if (!isConnected || !address) return;

    try {
      // TODO: Fetch real user balance from blockchain
      setUserBalance('0.0');
    } catch (error) {
      console.error('Balance fetch error:', error);
    }
  }, [isConnected, address]);

  useEffect(() => {
    fetchUserBalance();
  }, [isConnected, address, agentAddress, fetchUserBalance]);

  const formatNumber = (num: number | string, decimals = 6) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n === 0) return '0';
    if (n < 0.000001) return '<0.000001';
    return n.toFixed(decimals).replace(/\.?0+$/, '');
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  // Use URSUS backend data (prefer bonding curve data if available)
  const currentPrice = bondingCurvePrice || agentStats?.currentPrice || agentData?.currentPrice || '0';
  const marketCap = bondingCurveMarketCap || agentStats?.marketCap || agentData?.marketCap || '0';
  const priceChange = parseFloat(String(agentStats?.priceChange24h || agentData?.priceChange24h || 0));
  const graduationStatus = isGraduated || agentData?.isGraduated || false;

  return (
    <div className="bg-gray-900 rounded-lg p-6 space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Price</p>
          <p className="text-white font-bold">{formatNumber(currentPrice)} SOL</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Market Cap</p>
          <p className="text-white font-bold">{formatNumber(marketCap)} SOL</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">24h Change</p>
          <div className="flex items-center gap-1">
            {priceChange >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            <p className={`font-bold ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{formatNumber(priceChange, 2)}%
            </p>
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-gray-400 text-xs">Holders</p>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-gray-400" />
            <p className="text-white font-bold">{agentStats?.holders || 0}</p>
          </div>
        </div>
      </div>

      {/* Graduation Status */}
      {graduationStatus && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            <p className="text-green-500 font-medium">Graduated to DEX!</p>
          </div>
          <p className="text-gray-300 text-sm mt-1">
            This token has graduated and is now trading on the DEX.
          </p>
        </div>
      )}

      {/* Error Display */}
      {tradingError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-500 font-medium">Trading Error</p>
          </div>
          <p className="text-gray-300 text-sm mt-1">{tradingError.message}</p>
        </div>
      )}

      {/* Trading Interface */}
      {!graduationStatus && (
        <div className="space-y-4">
          {/* Tab Selector */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'buy'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sell'
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sell
            </button>
          </div>

          {/* User Balance */}
          {isConnected && (
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-gray-400 text-sm">
                Your Balance: <span className="text-white font-medium">{formatNumber(userBalance)} {agentData?.symbol}</span>
              </p>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {activeTab === 'buy' ? 'SOL Amount' : 'Token Amount'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Enter ${activeTab === 'buy' ? 'SOL' : agentData?.symbol || 'tokens'} amount`}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                step="0.000001"
                min="0"
              />
            </div>

            {/* Quick Amount Buttons (Buy only) */}
            {activeTab === 'buy' && (
              <div className="flex gap-2 flex-wrap">
                {quickAmounts.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    onClick={() => setAmount(quickAmount)}
                    className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600 transition-colors"
                  >
                    {quickAmount} SOL
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quote Loading */}
          {quoteLoading && (
            <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-300">Getting quote...</span>
              </div>
            </div>
          )}

          {/* Quote Display */}
          {quote && !quoteLoading && (
            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">
                  {activeTab === 'buy' ? 'You will receive' : 'You will get'}
                </span>
                <span className="text-white font-medium">
                  {formatNumber(activeTab === 'buy' ? (quote.tokensReceived || '0') : (quote.solReceived || '0'))}{' '}
                  {activeTab === 'buy' ? agentData?.symbol : 'SOL'}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Price Impact</span>
                <span className={`font-medium ${
                  quote.priceImpact > 5 ? 'text-red-400' : 
                  quote.priceImpact > 2 ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {formatNumber(quote.priceImpact, 2)}%
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Slippage Tolerance</span>
                <span className="text-white">{formatNumber(quote.slippage, 2)}%</span>
              </div>
              
              {quote.fees && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Platform Fee</span>
                  <span className="text-white">{formatNumber(quote.fees.totalFees)} SOL</span>
                </div>
              )}

              {quote.riskLevel && quote.riskLevel !== 'low' && (
                <div className="flex items-start gap-2 mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <div>
                    <p className="text-yellow-500 text-sm font-medium">
                      {quote.riskLevel === 'high' ? 'High Risk Trade' : 'Medium Risk Trade'}
                    </p>
                    <p className="text-gray-300 text-xs">
                      Large price impact detected. Consider splitting your trade.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval Section */}
          {showApproval && needsApproval && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <p className="text-yellow-500 font-medium">Approval Required</p>
              </div>
              <p className="text-gray-300 text-sm">
                You need to approve the contract to spend your {bondingTokenInfo?.symbol || agentData?.symbol || 'tokens'} before selling.
              </p>
              <button
                onClick={handleApproval}
                disabled={approving}
                className="w-full py-2 px-4 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {approving ? 'Approving...' : `Approve ${bondingTokenInfo?.symbol || agentData?.symbol || 'Tokens'}`}
              </button>
            </div>
          )}

          {/* Token Type Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Token Type</label>
            <div className="flex bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setTokenType('sentient')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  tokenType === 'sentient'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Sentient
              </button>
              <button
                onClick={() => setTokenType('prototype')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  tokenType === 'prototype'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Prototype
              </button>
            </div>
          </div>

          {/* Trade Button */}
          <button
            onClick={handleTrade}
            disabled={!isConnected || !quote || isTrading || parseFloat(amount) <= 0}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              activeTab === 'buy'
                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
            }`}
          >
            {!isConnected ? 'Connect Wallet' :
             isTrading ? 'Processing...' :
             showApproval && needsApproval ? 'Approve First' :
             `${activeTab === 'buy' ? 'Buy' : 'Sell'} ${bondingTokenInfo?.symbol || agentData?.symbol || 'Tokens'}`}
          </button>
        </div>
      )}

      {/* Recent Trades */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white">Recent Trades</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {recentTrades.length > 0 ? (
            recentTrades.map((trade, index) => (
              <div key={index} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    trade.type === 'tokensPurchased' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-white text-sm">
                      {trade.type === 'tokensPurchased' ? 'Buy' : 'Sell'}{' '}
                      {formatNumber(trade.type === 'tokensPurchased' ? (trade.tokensReceived || '0') : (trade.tokensAmount || '0'))}{' '}
                      {agentData?.symbol}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {formatNumber(trade.type === 'tokensPurchased' ? (trade.solAmount || '0') : (trade.solReceived || '0'))} SOL
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(typeof trade.timestamp === 'string' ? parseInt(trade.timestamp) : trade.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No recent trades</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PumpTradingInterface;
