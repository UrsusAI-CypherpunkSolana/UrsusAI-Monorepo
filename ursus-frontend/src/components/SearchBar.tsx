import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 mb-8">
      <div className="relative flex-1 max-w-[400px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search agents..."
          className="w-full h-10 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 pr-10 text-white placeholder-[#a0a0a0] focus:outline-none focus:border-[#d8e9ea] transition-colors"
        />
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#a0a0a0]" size={16} />
      </div>
      <button
        type="submit"
        className="bg-[#d8e9ea] text-black px-6 py-2.5 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
      >
        Search
      </button>
    </form>
  );
};

export default SearchBar;