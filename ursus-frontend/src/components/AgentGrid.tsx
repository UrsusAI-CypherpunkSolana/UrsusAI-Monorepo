import React from 'react';
import { useNavigate } from 'react-router-dom';
import AgentCard from './AgentCard';
import { Agent } from '../types';

interface AgentGridProps {
  agents: Agent[];
  loading?: boolean;
  onCardClick?: (agent: Agent) => void;
  onChatClick?: (agent: Agent) => void;
  onTradeClick?: (agent: Agent) => void;
  onCreateClick?: () => void;
  isWatchlistView?: boolean;
}

const AgentGrid: React.FC<AgentGridProps> = ({
  agents,
  loading = false,
  onCardClick,
  onChatClick,
  onTradeClick,
  isWatchlistView = false
}) => {
  const navigate = useNavigate();

  // Üstten prop gelmezse varsayılan yönlendirmeler
  const handleCardClick = onCardClick ?? ((a: Agent) => navigate(`/agent/${a.contractAddress}`));
  const handleChatClick = onChatClick ?? ((a: Agent) => navigate(`/chat/${a.contractAddress}`));
  const handleTradeClick = onTradeClick ?? ((a: Agent) => navigate(`/trade/${a.contractAddress}`));

  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-6 animate-pulse">
            <div className="w-12 h-12 bg-gray-700 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-700 rounded mb-2"></div>
            <div className="h-3 bg-gray-700 rounded mb-4 w-3/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (!loading && agents.length === 0) {
    if (isWatchlistView) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-6xl mb-6">⭐</div>
          <h3 className="text-2xl font-bold text-white mb-4">Your Watchlist is Empty</h3>
          <p className="text-gray-400 text-center max-w-md mb-8">
            Click the star icon on any agent to add it to your watchlist and track its performance.
          </p>
          <div className="bg-gray-800/50 rounded-lg p-6 max-w-lg">
            <h4 className="text-lg font-semibold text-white mb-3">How to Add Agents:</h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Browse agents in the Explore tab
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Click the star ⭐ icon on any agent card
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Or use the "Watch" button on agent detail pages
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                Your watched agents will appear here!
              </li>
            </ul>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-6">🤖</div>
        <h3 className="text-2xl font-bold text-white mb-4">No Agents Yet</h3>
        <p className="text-gray-400 text-center max-w-md mb-8">
          The platform is ready! Deploy your first AI agent on Core testnet to see it appear here.
        </p>
        <div className="bg-gray-800/50 rounded-lg p-6 max-w-lg">
          <h4 className="text-lg font-semibold text-white mb-3">Ready to Deploy?</h4>
          <ul className="text-sm text-gray-300 space-y-2">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Connect your wallet to Core testnet
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Create your AI agent with custom instructions
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Deploy smart contract and launch token
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Your agent will appear here automatically!
            </li>
          </ul>
        </div>

      </div>
    );
  }

  // Normal grid with agents
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {agents.map((agent) => (
        <AgentCard
          key={agent.contractAddress} 
          agent={agent}
          onCardClick={handleCardClick}
          onChatClick={handleChatClick}
          onTradeClick={handleTradeClick}
        />
      ))}
    </div>
  );
};

export default AgentGrid;
