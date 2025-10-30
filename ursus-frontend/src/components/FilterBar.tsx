import React from 'react';

interface FilterBarProps {
  includeNsfw: boolean;
  sortBy: string;
  activeView: 'explore' | 'watchlist';
  onToggleNsfw: () => void;
  onSortChange: (sort: string) => void;
  onViewChange: (view: 'explore' | 'watchlist') => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
  includeNsfw,
  sortBy,
  activeView,
  onToggleNsfw,
  onSortChange,
  onViewChange
}) => {
  return (
    <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a2a2a]">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onViewChange('explore')}
            className={`font-medium pb-1 transition-colors ${
              activeView === 'explore'
                ? 'text-white border-b-2 border-[#d8e9ea]'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            Explore
          </button>
          <button
            onClick={() => onViewChange('watchlist')}
            className={`font-medium pb-1 transition-colors ${
              activeView === 'watchlist'
                ? 'text-white border-b-2 border-[#d8e9ea]'
                : 'text-[#a0a0a0] hover:text-white'
            }`}
          >
            Watchlist
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-[#a0a0a0] text-sm">include nsfw:</span>
          <button
            onClick={onToggleNsfw}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              includeNsfw 
                ? 'bg-[#d8e9ea] text-black' 
                : 'bg-[#2a2a2a] text-[#a0a0a0] hover:bg-[#3a3a3a]'
            }`}
          >
            {includeNsfw ? 'On' : 'Off'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[#a0a0a0] text-sm">sort:</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-[#2a2a2a] text-white px-3 py-1 rounded text-sm focus:outline-none focus:bg-[#3a3a3a]"
          >
            <option value="featured">featured 🔥</option>
            <option value="newest">newest</option>
            <option value="market-cap">market cap</option>
            <option value="chats">most chats</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;