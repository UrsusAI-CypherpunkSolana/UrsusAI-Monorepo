import React, { useState, useEffect, useCallback } from 'react';
import { Crown, TrendingUp, Volume2, Users, Clock, Zap, Flame } from 'lucide-react';
import { apiService } from '../services/api';

interface Agent {
  address: string;
  name: string;
  symbol: string;
  image?: string;
  currentPrice: string;
  marketCap: string;
  holders: number;
  priceChange24h?: string;
  volume24h?: string;
  createdAt: string;
  isGraduated?: boolean;
  reserve?: string;
}

interface KingOfTheHillProps {
  onAgentClick?: (agentAddress: string) => void;
}

const KingOfTheHill: React.FC<KingOfTheHillProps> = ({ onAgentClick }) => {
  const [activeTab, setActiveTab] = useState<'trending' | 'volume' | 'new' | 'graduated'>('trending');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const tabs = [
    { id: 'trending', label: 'Trending', icon: Flame, metric: 'priceChange' },
    { id: 'volume', label: 'Volume Leaders', icon: Volume2, metric: 'volume' },
    { id: 'new', label: 'New Launches', icon: Zap, metric: 'created' },
    { id: 'graduated', label: 'Graduated', icon: Crown, metric: 'marketCap' }
  ];

  const fetchTopAgents = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (activeTab === 'graduated') {
        response = await apiService.getAllAgents({ limit: 20 });
      } else {
        const metric = activeTab === 'trending' ? 'priceChange' :
                      activeTab === 'volume' ? 'volume' : 'created';
        response = await apiService.getTopAgents(metric, 20);
      }

      if (response) {
        // Handle different response structures
        const agentsData = response.data?.agents || [];

        // Convert AgentData to Agent format
        const convertedAgents = agentsData.map(agentData => ({
          id: agentData.id,
          name: agentData.tokenName,
          symbol: agentData.tokenSymbol,
          description: agentData.agentInfo.description,
          avatar: agentData.avatar,
          image: agentData.image,
          creator: agentData.metadata.creator,
          createdAt: new Date(agentData.metadata.createdAt * 1000).toISOString(),
          marketCap: parseFloat(String(agentData.bondingCurveInfo.marketCap)),
          chatCount: agentData.chatCount,
          isNsfw: false,
          category: agentData.metadata.category,
          priceHistory: [],
          priceChange24h: agentData.priceChange24h,
          currentPrice: agentData.currentPrice,
          volume24h: agentData.volume24h,
          holders: agentData.holders,
          totalSupply: agentData.totalSupply,
          contractAddress: agentData.address,
          isVerified: agentData.isVerified,
          isActive: agentData.metadata.isActive,
          model: agentData.agentInfo.model,
          bondingCurveInfo: {
            supply: agentData.totalSupply,
            reserve: agentData.bondingCurveInfo.reserve,
            price: agentData.currentPrice,
            marketCap: agentData.bondingCurveInfo.marketCap,
          },
          // API compatibility fields
          address: agentData.address,
          tokenName: agentData.tokenName,
          tokenSymbol: agentData.tokenSymbol,
          agentInfo: agentData.agentInfo,
          metadata: agentData.metadata
        }));

        setAgents(convertedAgents as unknown as Agent[]);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch top agents:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTopAgents();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTopAgents, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchTopAgents]);

  const formatNumber = (num: number | string, decimals = 2) => {
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (n === 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toFixed(decimals);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center text-xs font-bold text-white">2</div>;
      case 3:
        return <div className="w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white">3</div>;
      default:
        return <div className="w-5 h-5 bg-gray-600 rounded-full flex items-center justify-center text-xs font-bold text-white">{rank}</div>;
    }
  };

  const getMetricDisplay = (agent: Agent) => {
    switch (activeTab) {
      case 'trending': {
        const change = parseFloat(agent.priceChange24h || '0');
        return (
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-4 h-4 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
              {change >= 0 ? '+' : ''}{formatNumber(change)}%
            </span>
          </div>
        );
      }
      case 'volume': {
        return (
          <div className="flex items-center gap-1">
            <Volume2 className="w-4 h-4 text-blue-500" />
            <span className="text-white">{formatNumber(agent.volume24h || '0')} SOL</span>
          </div>
        );
      }
      case 'new': {
        return (
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4 text-purple-500" />
            <span className="text-gray-400">{formatTime(agent.createdAt)}</span>
          </div>
        );
      }
      case 'graduated': {
        return (
          <div className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-yellow-500" />
            <span className="text-white">{formatNumber(agent.marketCap)} SOL</span>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Flame className="w-6 h-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-white">King of the Hill</h2>
        </div>
        <div className="text-right">
          <p className="text-gray-400 text-sm">Last updated</p>
          <p className="text-white text-sm">{lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-800 rounded-lg p-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'trending' | 'volume' | 'new' | 'graduated')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading...</p>
        </div>
      )}

      {/* Agents List */}
      {!loading && (
        <div className="space-y-3">
          {agents.length > 0 ? (
            agents.map((agent, index) => (
              <div
                key={agent.address}
                onClick={() => onAgentClick?.(agent.address)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    {getRankIcon(index + 1)}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      {agent.image && (
                        <img
                          src={agent.image}
                          alt={agent.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-white font-semibold truncate">{agent.name}</h3>
                        <p className="text-gray-400 text-sm">${agent.symbol}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-6">
                    {/* Price */}
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Price</p>
                      <p className="text-white text-sm font-medium">
                        {formatNumber(agent.currentPrice, 6)} SOL
                      </p>
                    </div>

                    {/* Market Cap */}
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Market Cap</p>
                      <p className="text-white text-sm font-medium">
                        {formatNumber(agent.marketCap)} SOL
                      </p>
                    </div>

                    {/* Holders */}
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">Holders</p>
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        <p className="text-white text-sm font-medium">{agent.holders}</p>
                      </div>
                    </div>

                    {/* Tab-specific metric */}
                    <div className="text-right min-w-[100px]">
                      <p className="text-gray-400 text-xs">
                        {activeTab === 'trending' && '24h Change'}
                        {activeTab === 'volume' && '24h Volume'}
                        {activeTab === 'new' && 'Created'}
                        {activeTab === 'graduated' && 'Status'}
                      </p>
                      {getMetricDisplay(agent)}
                    </div>
                  </div>
                </div>

                {/* Graduation Progress (for non-graduated tokens) */}
                {activeTab !== 'graduated' && !agent.isGraduated && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Graduation Progress</span>
                      <span>{Math.min(100, (parseFloat(agent.reserve || '0') / 85) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (parseFloat(agent.reserve || '0') / 85) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Graduated Badge */}
                {agent.isGraduated && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-500 text-sm font-medium">Graduated to DEX</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">No agents found</p>
            </div>
          )}
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-6 text-center">
        <button
          onClick={fetchTopAgents}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  );
};

export default KingOfTheHill;
