import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  MessageCircle,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { useAgentDetails } from '../hooks/useAgents';


interface HoldingsDetailProps {
  onBack: () => void;
  tokenId?: string;
}

interface TokenData {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  currentPrice: number;
  priceChange24h: number;
  totalHoldings: number;
  holdingsValue: number;
  allTimeHigh: number;
  allTimeLow: number;
  tradingVolume24h: number;
  marketCap: number;
  holderCount: number;
  agentCorrelation: number;
}

interface OrderHistory {
  id: string;
  date: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'completed' | 'pending' | 'failed';
}

const HoldingsDetail: React.FC<HoldingsDetailProps> = ({ onBack, tokenId = 'dat' }) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1D');
  const [tradingTab, setTradingTab] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showIndicators, setShowIndicators] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);

  const [loading, setLoading] = useState(true);

  // Fetch real token data
  const { agent, loading: agentLoading } = useAgentDetails(tokenId);

  useEffect(() => {
    const fetchTokenData = async () => {
      try {
        setLoading(true);

        if (agent) {
          // Convert agent data to token data format
          const convertedTokenData: TokenData = {
            id: agent.address || tokenId,
            name: agent.tokenName || 'Unknown Token',
            symbol: agent.tokenSymbol || 'UNK',
            logo: '🤖',
            currentPrice: parseFloat(String(agent.currentPrice || '0')) || 0,
            priceChange24h: 0, // Would be calculated
            totalHoldings: 0, // Would come from user's portfolio
            holdingsValue: 0, // Would be calculated
            allTimeHigh: 0, // Would be calculated
            allTimeLow: 0, // Would be calculated
            tradingVolume24h: 0, // Would be calculated
            marketCap: parseFloat(String(agent.bondingCurveInfo?.marketCap || '0')),
            holderCount: 0, // Would be calculated
            agentCorrelation: 0.85 // Would be calculated based on performance correlation
          };

          setTokenData(convertedTokenData);
        }

        // Order history would be fetched here

      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
  }, [agent, tokenId]);

  if (loading || agentLoading || !tokenData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#a0a0a0]">Loading token details...</div>
      </div>
    );
  }

  const timeframes = ['1H', '4H', '1D', '7D', '30D'];

  // Order history will be fetched from backend
  const orderHistory: OrderHistory[] = [
    // TODO: Fetch real order history from backend API
    },
    {
      id: '3',
      date: '2024-12-13 16:45',
      type: 'buy',
      amount: 2000,
      price: 0.023,
      status: 'completed'
    },
    {
      id: '4',
      date: '2024-12-12 11:20',
      type: 'buy',
      amount: 1500,
      price: 0.022,
      status: 'pending'
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="text-[#10b981]" />;
      case 'pending': return <Clock size={16} className="text-[#f59e0b]" />;
      case 'failed': return <XCircle size={16} className="text-[#ef4444]" />;
      default: return <AlertCircle size={16} className="text-[#a0a0a0]" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  const estimatedOutput = tradingTab === 'buy' 
    ? parseFloat(tradeAmount || '0') * tokenData.currentPrice
    : parseFloat(tradeAmount || '0') / tokenData.currentPrice;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="p-8">
        {/* Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Portfolio</span>
          </button>
        </div>

        {/* Token Header */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Token Logo */}
              <div className="w-20 h-20 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-2xl flex items-center justify-center text-3xl">
                {tokenData.logo}
              </div>
              
              {/* Token Info */}
              <div>
                <h1 className="text-white text-3xl font-bold mb-2">{tokenData.name}</h1>
                <div className="flex items-center gap-4">
                  <span className="text-[#a0a0a0] text-lg">{tokenData.symbol}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-2xl font-bold">${tokenData.currentPrice.toFixed(4)}</span>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                      tokenData.priceChange24h >= 0 
                        ? 'bg-[#10b981]/10 text-[#10b981]' 
                        : 'bg-[#ef4444]/10 text-[#ef4444]'
                    }`}>
                      {tokenData.priceChange24h >= 0 ? (
                        <TrendingUp size={14} />
                      ) : (
                        <TrendingDown size={14} />
                      )}
                      {Math.abs(tokenData.priceChange24h)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Holdings Value */}
            <div className="text-right">
              <div className="text-[#a0a0a0] text-sm mb-1">Total Holdings</div>
              <div className="text-white text-2xl font-bold mb-1">
                {tokenData.totalHoldings.toLocaleString()} {tokenData.symbol}
              </div>
              <div className="text-[#d8e9ea] text-lg font-semibold">
                ${tokenData.holdingsValue.toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Quick Action Buttons */}
          <div className="flex gap-4 mt-6 pt-6 border-t border-[#2a2a2a]">
            <button className="bg-[#d8e9ea] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#b8d4d6] transition-colors flex items-center gap-2">
              <BarChart3 size={16} />
              Trade
            </button>
            <button className="bg-[#2a2a2a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3a3a3a] transition-colors flex items-center gap-2">
              <TrendingUp size={16} />
              Stake
            </button>
            <button className="bg-[#2a2a2a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3a3a3a] transition-colors flex items-center gap-2">
              <ExternalLink size={16} />
              Transfer
            </button>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Chart & Analytics */}
          <div className="lg:col-span-2 space-y-8">
            {/* Price Chart */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-xl font-semibold">Price Chart</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowIndicators(!showIndicators)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      showIndicators 
                        ? 'bg-[#d8e9ea] text-black' 
                        : 'bg-[#2a2a2a] text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    Indicators
                  </button>
                </div>
              </div>
              
              {/* Timeframe Selectors */}
              <div className="flex gap-2 mb-6">
                {timeframes.map((timeframe) => (
                  <button
                    key={timeframe}
                    onClick={() => setSelectedTimeframe(timeframe)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedTimeframe === timeframe
                        ? 'bg-[#d8e9ea] text-black'
                        : 'bg-[#2a2a2a] text-[#a0a0a0] hover:text-white'
                    }`}
                  >
                    {timeframe}
                  </button>
                ))}
              </div>
              
              {/* Chart Placeholder */}
              <div className="h-80 bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4"></div>
                  <div className="text-white font-medium mb-2">TradingView Chart</div>
                  <div className="text-[#a0a0a0] text-sm">Interactive price chart with technical indicators</div>
                </div>
              </div>
              
              {/* Trading Volume */}
              <div className="mt-4 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-[#a0a0a0] text-sm">24h Volume</span>
                  <span className="text-white font-medium">${tokenData.tradingVolume24h.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <h3 className="text-white text-xl font-semibold mb-6">Performance Metrics</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="text-[#a0a0a0] text-sm">All-Time High</div>
                  <div className="text-white font-semibold">${tokenData.allTimeHigh.toFixed(4)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-[#a0a0a0] text-sm">All-Time Low</div>
                  <div className="text-white font-semibold">${tokenData.allTimeLow.toFixed(4)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-[#a0a0a0] text-sm">Market Cap</div>
                  <div className="text-white font-semibold">${tokenData.marketCap.toLocaleString()}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-[#a0a0a0] text-sm">Holders</div>
                  <div className="text-white font-semibold">{tokenData.holderCount.toLocaleString()}</div>
                </div>
              </div>
              
              {/* Agent Activity Correlation */}
              <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[#a0a0a0] text-sm">Agent Activity Correlation</span>
                  <span className="text-[#d8e9ea] font-medium">{(tokenData.agentCorrelation * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                  <div 
                    className="bg-[#d8e9ea] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${tokenData.agentCorrelation * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Trading Interface */}
          <div className="space-y-6">
            {/* Trading Panel */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <h3 className="text-white text-xl font-semibold mb-6">Trade {tokenData.symbol}</h3>
              
              {/* Buy/Sell Tabs */}
              <div className="flex bg-[#0a0a0a] rounded-lg p-1 mb-6">
                <button
                  onClick={() => setTradingTab('buy')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    tradingTab === 'buy'
                      ? 'bg-[#10b981] text-white'
                      : 'text-[#a0a0a0] hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setTradingTab('sell')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    tradingTab === 'sell'
                      ? 'bg-[#ef4444] text-white'
                      : 'text-[#a0a0a0] hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>
              
              {/* Amount Input */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#a0a0a0] text-sm">
                      {tradingTab === 'buy' ? 'SOL' : tokenData.symbol}
                    </div>
                  </div>
                  <div className="text-[#a0a0a0] text-xs mt-1">
                    Balance: {tradingTab === 'buy' ? '1,250.00 SOL' : `${tokenData.totalHoldings.toLocaleString()} ${tokenData.symbol}`}
                  </div>
                </div>
                
                {/* Estimated Output */}
                <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a0a0a0] text-sm">Estimated {tradingTab === 'buy' ? 'Tokens' : 'SOL'}</span>
                    <span className="text-white font-medium">
                      {estimatedOutput.toFixed(2)} {tradingTab === 'buy' ? tokenData.symbol : 'SOL'}
                    </span>
                  </div>
                </div>
                
                {/* Slippage Setting */}
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Slippage Tolerance</label>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 2.0].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSlippage(value)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          slippage === value
                            ? 'bg-[#d8e9ea] text-black'
                            : 'bg-[#2a2a2a] text-[#a0a0a0] hover:text-white'
                        }`}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Execute Trade Button */}
              <button className="w-full bg-[#d8e9ea] text-black py-4 rounded-xl font-bold text-lg hover:bg-[#b8d4d6] transition-colors">
                Execute {tradingTab === 'buy' ? 'Buy' : 'Sell'}
              </button>
            </div>

            {/* Order History */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <h3 className="text-white text-xl font-semibold mb-6">Order History</h3>
              
              <div className="space-y-3">
                {orderHistory.length === 0 ? (
                  <div className="text-center py-8 text-[#a0a0a0]">
                    No order history available yet
                  </div>
                ) : (
                  orderHistory.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          order.type === 'buy' ? 'bg-[#10b981]' : 'bg-[#ef4444]'
                        }`}></div>
                        <div>
                          <div className="text-white text-sm font-medium">
                            {order.type.toUpperCase()} {order.amount.toLocaleString()} {tokenData.symbol}
                          </div>
                          <div className="text-[#a0a0a0] text-xs">{order.date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm">${order.price.toFixed(4)}</div>
                        <div className="flex items-center gap-1 text-xs">
                          {getStatusIcon(order.status)}
                          <span className="text-[#a0a0a0]">{getStatusText(order.status)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <button className="w-full mt-4 bg-[#2a2a2a] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#3a3a3a] transition-colors">
                View All Orders
              </button>
            </div>

            {/* Agent Integration */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <h3 className="text-white text-xl font-semibold mb-6">Agent Integration</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-lg flex items-center justify-center text-lg">
                    🤖
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">DeFi Analyzer Pro</div>
                    <div className="text-[#a0a0a0] text-sm">Associated Agent</div>
                  </div>
                  <button className="text-[#d8e9ea] hover:text-[#b8d4d6] transition-colors">
                    <ExternalLink size={16} />
                  </button>
                </div>
                
                <div className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[#a0a0a0] text-sm">Performance Impact</span>
                    <span className="text-[#10b981] font-medium">+15.2%</span>
                  </div>
                  <div className="text-[#a0a0a0] text-xs">
                    Agent activity positively influences token performance
                  </div>
                </div>
                
                <button className="w-full bg-[#d8e9ea] text-black py-3 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors flex items-center justify-center gap-2">
                  <MessageCircle size={16} />
                  Chat with Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HoldingsDetail; 