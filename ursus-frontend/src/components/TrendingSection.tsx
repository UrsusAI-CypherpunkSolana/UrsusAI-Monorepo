import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Agent } from '../types';
import { formatMarketCap, formatTimeAgo } from '../utils/formatters';

interface TrendingSectionProps {
  trendingAgents: Agent[];
}

const TrendingSection: React.FC<TrendingSectionProps> = ({ trendingAgents }) => {
  const navigate = useNavigate();

  const handleAgentClick = (agent: Agent) => {
    const agentAddress = agent.contractAddress || agent.address || agent.id;
    navigate(`/agent/${agentAddress}`);
  };

  return (
    <div className="mb-8">
      <h2 className="text-white text-lg font-semibold mb-4">Now trending</h2>

      {trendingAgents.length === 0 ? (
        <div className="flex items-center justify-center py-12 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <div className="text-center">
            <div className="text-4xl mb-3"></div>
            <p className="text-gray-400 text-sm">No trending agents yet</p>
            <p className="text-gray-500 text-xs mt-1">Deploy agents to see trending activity</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {trendingAgents.map((agent) => (
            <div
              key={agent.id}
              className="relative flex-shrink-0 w-[300px] h-[180px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#d8e9ea] transition-colors cursor-pointer"
              onClick={() => handleAgentClick(agent)}
            >
              {agent.bondingCurveInfo?.reserve && Number(agent.bondingCurveInfo.reserve) >= 30000 && (
                <div className="absolute top-3 right-3">
                  <span className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-md border border-yellow-500/30">🏆 Graduated</span>
                </div>
              )}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  {agent.image ? (
                    <img
                      src={agent.image}
                      alt={agent.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] flex items-center justify-center text-black font-bold">
                      {agent.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{agent.name}</span>
                    <span className="text-[#a0a0a0] text-sm">({agent.symbol})</span>
                  </div>
                  <div className="text-[#10b981] text-sm font-medium">
                    {formatMarketCap(agent.marketCap)}
                  </div>

                  {/* Tiny bonding curve indicator */}
                  <div className="mt-1 w-24 bg-[#2a2a2a] h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-green-500 to-blue-500"
                      style={{ width: `${Math.min(((agent.bondingCurveInfo?.reserve as number || 0) / 30000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-[#e5e5e5] text-sm mb-3 line-clamp-3">
                {agent.description}
              </div>

              <div className="flex items-center justify-between text-[#a0a0a0] text-sm">
                <span>{agent.chatCount} chats</span>
                <span>{formatTimeAgo(agent.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendingSection;