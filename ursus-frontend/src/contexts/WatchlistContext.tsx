import React, { createContext, useContext, useState, useEffect } from 'react';

interface WatchlistItem {
  address: string;
  tokenName: string;
  tokenSymbol: string;
  currentPrice: number;
  priceChange24h: number;
  marketCap: number;
  avatar?: string;
  addedAt: number;
}

interface WatchlistContextType {
  watchlist: WatchlistItem[];
  addToWatchlist: (item: Omit<WatchlistItem, 'addedAt'>) => void;
  removeFromWatchlist: (address: string) => void;
  isInWatchlist: (address: string) => boolean;
  clearWatchlist: () => void;
  updateWatchlistItem: (address: string, updates: Partial<Omit<WatchlistItem, 'address' | 'addedAt'>>) => void;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};

interface WatchlistProviderProps {
  children: React.ReactNode;
}

export const WatchlistProvider: React.FC<WatchlistProviderProps> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ursus-watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        setWatchlist(parsed);
      }
    } catch (error) {
      console.error('Failed to load watchlist from localStorage:', error);
    }
  }, []);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ursus-watchlist', JSON.stringify(watchlist));
    } catch (error) {
      console.error('Failed to save watchlist to localStorage:', error);
    }
  }, [watchlist]);

  const addToWatchlist = (item: Omit<WatchlistItem, 'addedAt'>) => {
    setWatchlist(prev => {
      // Check if already exists
      if (prev.some(w => w.address.toLowerCase() === item.address.toLowerCase())) {
        return prev;
      }
      
      // Add new item
      const newItem: WatchlistItem = {
        ...item,
        addedAt: Date.now()
      };
      
      return [newItem, ...prev]; // Add to beginning
    });
  };

  const removeFromWatchlist = (address: string) => {
    setWatchlist(prev => 
      prev.filter(item => item.address.toLowerCase() !== address.toLowerCase())
    );
  };

  const isInWatchlist = (address: string) => {
    return watchlist.some(item => item.address.toLowerCase() === address.toLowerCase());
  };

  const clearWatchlist = () => {
    setWatchlist([]);
  };

  const updateWatchlistItem = (address: string, updates: Partial<Omit<WatchlistItem, 'address' | 'addedAt'>>) => {
    setWatchlist(prev =>
      prev.map(item =>
        item.address.toLowerCase() === address.toLowerCase()
          ? { ...item, ...updates }
          : item
      )
    );
  };

  const value: WatchlistContextType = {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    clearWatchlist,
    updateWatchlistItem
  };

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
};
