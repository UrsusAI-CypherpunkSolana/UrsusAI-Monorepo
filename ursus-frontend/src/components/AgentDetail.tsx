import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Copy,
  Share2,
  Star,
  BarChart3,
  Activity,
  DollarSign
} from 'lucide-react';
import { useAgentDetails, useAgentStats } from '../hooks/useAgents';
import { useWatchlist } from '../contexts/WatchlistContext';
import { TradingViewChart } from './TradingViewChart';
import OrderBook from './OrderBook';
import AgentChat from './AgentChat';
import { useGraduationStatus } from '../hooks/useGraduationStatus';
import { BondingCurveProgress } from './BondingCurveProgress';
import { useChartData } from '../hooks/useChartData';
import { X402PaymentPanel } from './X402PaymentPanel';


const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<'overview' | 'trading' | 'activity' | 'chat' | 'x402'>('overview');
  const [copied, setCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Fetch agent data
  const { agent, loading, error } = useAgentDetails(id);
  // Graduation status for this agent
  const graduationStatus = useGraduationStatus(id || '', true);
  // Watchlist functionality
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  const { stats } = useAgentStats(id);

  // id kontrat adresi gibi davranıyor
  const { livePrice } = useChartData(agent?.address || id!, {
    interval: '1m',
    limit: 50,
    autoUpdate: true,
    enableRealTime: true,
  });

  // open modal automatically on /chat
  useEffect(() => {
    const onChatRoute = location.pathname.endsWith('/chat');
    setIsChatOpen(onChatRoute);
    if (onChatRoute) setActiveTab('chat');
  }, [location]);

  // Use real-time data if available
  const currentStats = stats;

  const handleCopyAddress = () => {
    if (id) {
      navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWatchlistToggle = () => {
    if (!agent) return;

    const agentAddress = agent.address || agent.contractAddress || id || '';

    if (isInWatchlist(agentAddress)) {
      removeFromWatchlist(agentAddress);
    } else {
      addToWatchlist({
        address: agentAddress,
        tokenName: agent.tokenName || 'Unknown',
        tokenSymbol: agent.tokenSymbol || 'UNK',
        currentPrice: parseFloat(agent.currentPrice?.toString() || '0'),
        priceChange24h: currentStats?.priceChange24h || 0,
        marketCap: parseFloat(agent.bondingCurveInfo?.marketCap?.toString() || '0'),
        avatar: agent.image || agent.avatar
      });
    }
  };

  const formatNumber = (num: number) => {
    if (num === 0) return '0.00';

    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;

    // Handle very small numbers
    if (num < 0.01) {
      return num.toFixed(6);
    }

    return num.toFixed(2);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#d8e9ea] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#a0a0a0]">Loading agent details...</p>
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Agent not found</p>
          <button
            onClick={() => navigate('/')}
            className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] ml-[200px]">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Agents
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] transition-colors"
              >
                <Copy size={16} />
                {copied ? 'Copied!' : 'Copy Address'}
              </button>
              <button
                onClick={handleWatchlistToggle}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isInWatchlist(agent?.address || agent?.contractAddress || id || '')
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white'
                }`}
              >
                <Star
                  size={16}
                  fill={isInWatchlist(agent?.address || agent?.contractAddress || id || '') ? 'currentColor' : 'none'}
                />
                {isInWatchlist(agent?.address || agent?.contractAddress || id || '') ? 'Watching' : 'Watch'}
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-lg hover:bg-[#3a3a3a] transition-colors">
                <Share2 size={16} />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Info */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Agent Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agent Header */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <div className="flex items-start gap-6">
                <img
                  src={agent.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`}
                  alt={agent.tokenName}
                  className="w-20 h-20 rounded-xl bg-[#2a2a2a] object-cover"
                />

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-white">{agent.tokenName}</h1>
                    <span className="px-3 py-1 bg-[#d8e9ea] text-black text-sm font-medium rounded-full">
                      {agent.tokenSymbol}
                    </span>
                    <span className="px-3 py-1 bg-[#2a2a2a] text-[#a0a0a0] text-sm rounded-full">
                      <span
                        className={`px-3 py-1 text-sm rounded-full border ${
                          graduationStatus.isGraduated
                            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        }`}
                      >
                        {graduationStatus.isGraduated ? 'Graduated' : 'Bonding Curve Active'}
                      </span>
                      {' '}
                      {agent.metadata?.category || 'General'}
                    </span>
                  </div>

                  <p className="text-[#a0a0a0] mb-4 leading-relaxed">
                    {agent.agentInfo?.description || agent.description}
                  </p>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[#a0a0a0]">Created by:</span>
                      <span className="text-[#d8e9ea] font-medium">
                        {agent.metadata?.creator
                          ? `${agent.metadata.creator.slice(0, 6)}...${agent.metadata.creator.slice(-4)}`
                          : agent.creator
                          ? `${agent.creator.slice(0, 6)}...${agent.creator.slice(-4)}`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[#a0a0a0]">Model:</span>
                      <span className="text-white font-medium">
                        {agent.agentInfo?.model || agent.model || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
              <div className="border-b border-[#2a2a2a]">
                <div className="flex overflow-x-auto">
                  {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 as any },
                    { id: 'trading', label: 'Trading', icon: TrendingUp as any },
                    { id: 'activity', label: 'Activity', icon: Activity as any },
                    { id: 'chat', label: 'Chat', icon: MessageCircle as any },
                    { id: 'x402', label: 'X402 Payments', icon: DollarSign as any }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                        activeTab === (tab.id as any)
                          ? 'text-[#d8e9ea] border-b-2 border-[#d8e9ea]'
                          : 'text-[#a0a0a0] hover:text-white'
                      }`}
                    >
                      <tab.icon size={18} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Agent Instructions</h3>
                      <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
                        <p className="text-[#a0a0a0] leading-relaxed whitespace-pre-wrap">
                          {agent.agentInfo?.instructions || 'No specific instructions provided.'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Price Chart</h3>
                      <TradingViewChart
                        agentAddress={agent?.address || id!}
                        tokenSymbol={agent?.tokenSymbol || 'TOKEN'}
                        className="w-full h-64"
                      />
                    </div>

                    {/* Bonding Curve Progress */}
                    <BondingCurveProgress
                      currentReserve={graduationStatus.currentReserve}
                      graduationThreshold={graduationStatus.graduationThreshold}
                      isGraduated={graduationStatus.isGraduated}
                      currentPrice={graduationStatus.currentPrice}
                      marketCap={graduationStatus.marketCap}
                      holders={agent?.holders || 0}
                      variant="compact"
                      className="mt-4"
                    />
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                    <p className="text-[#a0a0a0]">Activity feed will be implemented here</p>
                  </div>
                )}

                {activeTab === 'trading' && (
                  <div className="space-y-6">
                    {/* Professional TradingView Chart */}
                    <TradingViewChart
                      agentAddress={agent?.address || id!}
                      tokenSymbol={agent?.tokenSymbol || 'TOKEN'}
                      className="w-full"
                    />

                    {/* Trading Interface Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                      {/* Order Book */}
                      <div className="xl:col-span-2">
                        <OrderBook
                          agentAddress={agent?.address || id!}
                          currentPrice={livePrice ?? parseFloat(String(agent?.currentPrice || '0'))}
                        />
                      </div>

                      {/* Trading Stats */}
                      <div className="space-y-4">
                        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
                          <div className="text-sm text-[#a0a0a0] mb-1">24h Volume</div>
                          <div className="text-xl font-bold text-white">
                            {formatNumber(currentStats?.volume24h || 0)} SOL
                          </div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
                          <div className="text-sm text-[#a0a0a0] mb-1">24h Change</div>
                          <div
                            className={`text-xl font-bold ${
                              (currentStats?.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {(currentStats?.priceChange24h || 0) >= 0 ? '+' : ''}
                            {Math.abs(currentStats?.priceChange24h || 0).toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4">
                          <div className="text-sm text-[#a0a0a0] mb-1">Market Cap</div>
                          <div className="text-xl font-bold text-white">
                            {formatPrice(agent?.bondingCurveInfo?.marketCap || 0)} SOL
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Quick Trade Button */}
                    <div className="text-center">
                      <button
                        onClick={() => navigate(`/agent/${id}/trade`)}
                        className="bg-[#d8e9ea] text-black px-8 py-3 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
                      >
                        Open Trading Interface
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-[#a0a0a0] mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Chat with {agent.tokenName}
                    </h3>
                    <p className="text-[#a0a0a0] mb-4">Start a conversation with this AI agent</p>
                    <button
                      onClick={() => navigate(`/agent/${id}/chat`)}
                      className="bg-[#d8e9ea] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
                    >
                      Start Chat
                    </button>
                  </div>
                )}

                {activeTab === 'x402' && (
                  <X402PaymentPanel
                    agentAddress={agent.address || id || ''}
                    agentName={agent.tokenName || agent.name || ''}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Price Info */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Price Information</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[#a0a0a0] text-sm">Current Price</p>
                  <p className="text-2xl font-bold text-white">
                    {formatPrice(livePrice ?? agent.currentPrice ?? 0)} SOL
                  </p>
                </div>
                <div>
                  <p className="text-[#a0a0a0] text-sm">24h Change</p>
                  <div
                    className={`flex items-center gap-1 ${
                      (currentStats?.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {(currentStats?.priceChange24h || 0) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span className="font-semibold">
                      {Math.abs(currentStats?.priceChange24h || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[#a0a0a0] text-sm">Market Cap</p>
                  <p className="text-lg font-semibold text-white">
                    ${formatNumber(parseFloat(String(agent.bondingCurveInfo?.marketCap || '0')))}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[#a0a0a0]">Total Supply</span>
                  <span className="text-white font-medium">
                    {formatNumber(parseFloat(String(agent.totalSupply || '0')))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a0a0a0]">Holders</span>
                  <span className="text-white font-medium">
                    {currentStats && currentStats.holders !== null ? currentStats.holders : 'Unable to fetch'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a0a0a0]">24h Volume</span>
                  <span className="text-white font-medium">
                    ${formatNumber(currentStats?.volume24h || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#a0a0a0]">24h Transactions</span>
                  <span className="text-white font-medium">{currentStats?.transactions24h || 0}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/agent/${id}/trade`)}
                  className="w-full bg-[#d8e9ea] text-black py-3 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
                >
                  Trade Tokens
                </button>
                <button
                  onClick={() => navigate(`/agent/${id}/chat`)}
                  className="w-full bg-[#2a2a2a] text-white py-3 rounded-lg font-medium hover:bg-[#3a3a3a] transition-colors"
                >
                  Chat with Agent
                </button>
                <button
                  onClick={handleWatchlistToggle}
                  className={`w-full py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    isInWatchlist(agent?.address || agent?.contractAddress || id || '')
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
                  }`}
                >
                  <Star size={18} fill={isInWatchlist(agent?.address || agent?.contractAddress || id || '') ? 'currentColor' : 'none'} />
                  {isInWatchlist(agent?.address || agent?.contractAddress || id || '') ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {agent && (
        <AgentChat
          agentAddress={agent.address || id || ''}
          agentName={agent.tokenName || agent.name || ''}
          agentInstructions={agent.agentInfo?.instructions}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            if (location.pathname.endsWith('/chat')) {
              navigate(`/agent/${id}`);
            }
          }}
        />
      )}
    </div>
  );
};

export default AgentDetail;
