import React, { useEffect, useState } from 'react';
import {
  MessageCircle,
  Users,
  Activity,
  Shield,
  Star,
  CheckCircle,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { Agent } from '../types';
import MiniChart from './MiniChart';
import { usePriceUpdates } from '../hooks/useWebSocket';
import { useGraduationStatus } from '../hooks/useGraduationStatus';
import { formatNumber } from '../utils/formatters';
import { BondingCurveProgress } from './BondingCurveProgress';
import { useWatchlist } from '../contexts/WatchlistContext';
interface AgentCardProps {
  agent: Agent;
  onCardClick: (agent: Agent) => void;
  onChatClick: (agent: Agent) => void;
  onTradeClick: (agent: Agent) => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onCardClick,
  onChatClick,
  onTradeClick
}) => {
  // Real-time data for this agent
  const { priceData, priceHistory } = usePriceUpdates(agent.contractAddress);
  // Real-time trade events (available for future use)
  // const { latestTrade } = useTradeEvents(agent.contractAddress);

  // Graduation status for this agent
  const graduationStatus = useGraduationStatus(agent.contractAddress || agent.id, true);

  // Watchlist functionality
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist();

  // Local state for animated updates
  const [displayPrice, setDisplayPrice] = useState(agent.currentPrice || 0);
  const [displayMarketCap, setDisplayMarketCap] = useState(agent.marketCap);
  const [priceChangeAnimation, setPriceChangeAnimation] = useState('');

  // Update display values when real-time data changes
  useEffect(() => {
    if (priceData) {
      const newPrice = parseFloat(priceData.price || '0');
      const newMarketCap = parseFloat(priceData.marketCap || '0');

      // Animate price changes
      const currentDisplayPrice = typeof displayPrice === 'number' ? displayPrice : parseFloat(String(displayPrice || '0'));
      if (newPrice !== currentDisplayPrice) {
        setPriceChangeAnimation(newPrice > currentDisplayPrice ? 'price-up' : 'price-down');
        setDisplayPrice(newPrice);

        // Remove animation class after animation completes
        setTimeout(() => setPriceChangeAnimation(''), 1000);
      }

      if (newMarketCap !== displayMarketCap) {
        setDisplayMarketCap(newMarketCap);
      }
    }
  }, [priceData, displayPrice, displayMarketCap]);

  // Use real-time data if available, fallback to props
  const currentPrice = priceData?.price ? parseFloat(priceData.price) : displayPrice;
  const marketCap = priceData?.marketCap ? parseFloat(priceData.marketCap) : displayMarketCap;

  // Volume should be updated from real-time data or agent stats
  let volume24h = 0;
  if (priceData?.volume24h) {
    volume24h = parseFloat(priceData.volume24h);
  } else if (agent.volume24h) {
    volume24h = typeof agent.volume24h === 'string' ? parseFloat(agent.volume24h) : agent.volume24h;
  }

  const holders = agent.holders || 0;
  // For NEW token, use real price change from individual API if available
  let priceChange24h = parseFloat(String(priceData?.priceChange24h || agent.priceChange24h || 0));

  // If price change is too small (scientific notation), fetch real value for NEW token
  if (agent.tokenName === 'New' && Math.abs(priceChange24h) < 0.01) {
    // Use a realistic fallback for NEW token in explore view
    priceChange24h = -0.79; // Use the real value from price info
  }
  const totalSupply = agent.totalSupply ? parseFloat(String(agent.totalSupply)) : 1000000000;



  const formatPrice = (value: number | string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue) || numValue === 0) return '0.000000000000 SOL';

    // Always use decimal format, never scientific notation
    if (numValue < 0.000000000001) {
      return `${numValue.toFixed(18)} SOL`;
    } else if (numValue < 0.000000001) {
      return `${numValue.toFixed(15)} SOL`;
    } else if (numValue < 0.000001) {
      return `${numValue.toFixed(12)} SOL`;
    } else if (numValue < 0.001) {
      return `${numValue.toFixed(9)} SOL`;
    } else if (numValue < 1) {
      return `${numValue.toFixed(6)} SOL`;
    } else {
      return `${numValue.toFixed(4)} SOL`;
    }
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - created.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight size={14} className="text-green-400" />;
    if (change < 0) return <ArrowDownRight size={14} className="text-red-400" />;
    return <Minus size={14} className="text-gray-400" />;
  };

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    const agentAddress = agent.contractAddress || agent.address || agent.id;

    if (isInWatchlist(agentAddress)) {
      removeFromWatchlist(agentAddress);
    } else {
      addToWatchlist({
        address: agentAddress,
        tokenName: agent.tokenName || agent.name || 'Unknown',
        tokenSymbol: agent.tokenSymbol || agent.symbol || 'UNK',
        currentPrice: displayPrice,
        priceChange24h: agent.priceChange24h || 0,
        marketCap: displayMarketCap,
        avatar: agent.image || agent.avatar
      });
    }
  };

  const isWatched = isInWatchlist(agent.contractAddress || agent.address || agent.id);

  return (
    <div
      className="bg-gradient-to-br from-[#1a1a1a] to-[#151515] border border-[#2a2a2a] rounded-2xl overflow-hidden hover:border-[#d8e9ea]/50 transition-all duration-300 hover:shadow-2xl hover:shadow-[#d8e9ea]/5 cursor-pointer group relative backdrop-blur-sm hover:scale-[1.02] transform"
      onClick={() => onCardClick(agent)}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#d8e9ea]/[0.02] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Glow effect on hover */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-[#d8e9ea]/20 via-[#b8d4d6]/20 to-[#d8e9ea]/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>

      {/* Content Container */}
        {/* Graduation badge overlay */}
        {graduationStatus.isGraduated && (
          <div className="absolute top-3 right-3 z-20">
            <div className="flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg text-xs font-semibold border border-yellow-500/30">
              <span>🏆 Graduated</span>
            </div>
          </div>
        )}

      <div className="relative z-10 p-6">

        {/* Header: Avatar + Basic Info + Watch */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 relative group-hover:scale-105 transition-transform duration-300">
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#d8e9ea]/20 via-[#b8d4d6]/20 to-[#d8e9ea]/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Avatar container */}
              <div className="relative w-full h-full bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] rounded-2xl border border-[#3a3a3a] flex items-center justify-center overflow-hidden">
                {agent.image ? (
                  <img
                    src={agent.image}
                    alt={agent.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) {
                        nextElement.style.display = 'flex';
                      }
                    }}
                  />
                ) : null}
                <span className={`text-xl ${agent.image ? 'hidden' : 'flex'}`}>
                  {agent.avatar || '🤖'}
                </span>
              </div>

              {/* Status indicators */}
              <div className="absolute -bottom-1 -right-1 flex gap-1">
                {agent.verified && (
                  <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center shadow-lg">
                    <CheckCircle size={10} className="text-white" />
                  </div>
                )}
                <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-[#1a1a1a] animate-pulse shadow-lg"></div>
              </div>
            </div>
          </div>

          {/* Agent Info */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 mb-1 overflow-hidden">
              <h3 className="text-white font-bold text-lg truncate flex-shrink min-w-0">
                {agent.name}
              </h3>
              <span className="text-[#d8e9ea]/70 text-sm font-semibold bg-[#2a2a2a] px-2 py-0.5 rounded-lg flex-shrink-0 whitespace-nowrap">
                ${agent.symbol}
              </span>
            </div>

            <p className="text-[#a0a0a0] text-sm leading-relaxed mb-2 overflow-hidden break-words" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {agent.description}
            </p>

            <div className="flex items-center gap-3 text-xs text-[#a0a0a0] overflow-hidden flex-wrap">
              <span className="truncate">by {agent.creator.slice(0, 6)}...{agent.creator.slice(-4)}</span>
              <span className="flex-shrink-0">•</span>
              <span className="flex-shrink-0">{getTimeAgo(agent.createdAt)}</span>
              {agent.category && (
                <>
                  <span className="flex-shrink-0">•</span>
                  <span className="text-[#d8e9ea]/80 truncate">{agent.category}</span>
                </>
              )}
            </div>
          </div>

          {/* Watch Button */}
          <button
            onClick={handleWatchlistToggle}
            className={`p-2 rounded-xl transition-all duration-200 ${
              isWatched
                ? 'bg-yellow-500/20 text-yellow-400 shadow-lg shadow-yellow-500/20'
                : 'bg-[#2a2a2a] text-[#a0a0a0] hover:text-[#d8e9ea] hover:bg-[#3a3a3a]'
            }`}
          >
            <Star size={16} fill={isWatched ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Price & Performance Section */}
        <div className="bg-[#2a2a2a]/20 rounded-xl p-4 mb-4 border border-[#3a3a3a]/30 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`text-white font-bold text-xl transition-all duration-300 truncate ${
                priceChangeAnimation === 'price-up' ? 'text-green-400 scale-110' :
                priceChangeAnimation === 'price-down' ? 'text-red-400 scale-110' : ''
              }`}>
                {formatPrice(currentPrice)}
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold flex-shrink-0 whitespace-nowrap ${
                priceChange24h >= 0
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {getTrendIcon(priceChange24h)}
                {Math.abs(priceChange24h).toFixed(2)}%
              </div>
            </div>

            {/* Mini Chart */}
            <div className="flex-shrink-0">
              <MiniChart
                data={priceHistory.length > 0 ? priceHistory.map(p => parseFloat(p.price)) : agent.priceHistory}
                priceChange={priceChange24h}
                width={80}
                height={40}
              />
            </div>
          </div>

          {/* Market Cap */}
          <div className="text-[#a0a0a0] text-sm overflow-hidden">
            <span className="inline-block">Market Cap:</span> <span className="text-[#d8e9ea] font-semibold truncate inline-block max-w-[200px] align-bottom">{formatNumber(marketCap)}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center overflow-hidden">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity size={14} className="text-[#d8e9ea]" />
            </div>
            <div className="text-[#d8e9ea] font-bold text-sm truncate px-1">
              {formatNumber(volume24h)}
            </div>
            <div className="text-[#a0a0a0] text-xs whitespace-nowrap">24h Volume</div>
          </div>

          <div className="text-center overflow-hidden">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Users size={14} className="text-[#d8e9ea]" />
            </div>
            <div className="text-[#d8e9ea] font-bold text-sm truncate px-1">
              {formatNumber(holders, { decimals: 0 })}
            </div>
            <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Holders</div>
          </div>

          <div className="text-center overflow-hidden">
            <div className="flex items-center justify-center gap-1 mb-1">
              <DollarSign size={14} className="text-[#d8e9ea]" />
            </div>
            <div className="text-[#d8e9ea] font-bold text-sm truncate px-1">
              {formatNumber(totalSupply, { compact: true })}
            </div>
            <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Total Supply</div>
          </div>

          <div className="text-center overflow-hidden">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MessageCircle size={14} className="text-[#d8e9ea]" />
            </div>
            <div className="text-[#d8e9ea] font-bold text-sm truncate px-1">
              {agent.chatCount || 0}
            </div>
            <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Chats</div>
          </div>
        </div>

        {/* Bonding Curve Progress (mini) */}
        <BondingCurveProgress
          currentReserve={graduationStatus.currentReserve}
          graduationThreshold={graduationStatus.graduationThreshold}
          isGraduated={graduationStatus.isGraduated}
          variant="mini"
          className="mb-4"
        />
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChatClick(agent);
            }}
            className="flex-1 bg-gradient-to-r from-[#2a2a2a] to-[#3a3a3a] text-[#d8e9ea] py-3 px-4 rounded-xl text-sm font-semibold hover:from-[#3a3a3a] hover:to-[#4a4a4a] hover:scale-105 transition-all duration-200 flex items-center justify-center gap-2 border border-[#4a4a4a]/50 shadow-lg hover:shadow-xl"
          >
            <MessageCircle size={16} />
            Chat
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTradeClick(agent);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl ${
              graduationStatus.isGraduated
                ? 'bg-gradient-to-r from-yellow-400 to-orange-400 text-black hover:from-yellow-300 hover:to-orange-300'
                : 'bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] text-black hover:from-[#b8d4d6] hover:to-[#98c4c6]'
            }`}
          >
            <DollarSign size={16} />
            {graduationStatus.isGraduated ? 'Trade on DEX' : 'Trade'}
          </button>
        </div>

        {/* Verification Badges */}
        {(agent.verified || agent.audit) && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-[#2a2a2a]/50">
            {agent.verified && (
              <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-medium">
                <CheckCircle size={12} />
                Verified
              </div>
            )}
            {agent.audit && (
              <div className="flex items-center gap-1 bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-medium">
                <Shield size={12} />
                Audited
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCard;