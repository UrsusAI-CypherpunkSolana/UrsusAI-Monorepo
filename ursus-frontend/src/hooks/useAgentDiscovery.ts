import { useState, useCallback, useEffect, useMemo } from 'react';
import { apiService } from '../services/api';
import { Agent } from '../types';

// Helper to convert backend AgentData shape to frontend Agent
const mapAgentDataToAgent = (data: any): Agent => ({
  id: String(data.id || data.address || ''),
  name: String(data.tokenName || data.name || ''),
  symbol: String(data.tokenSymbol || data.symbol || ''),
  description: String(data.agentInfo?.description || data.description || ''),
  avatar: String(data.avatar || '🐻'),
  image: data.image,
  creator: String(data.metadata?.creator || data.creator || ''),
  createdAt: data.metadata?.createdAt
    ? new Date(data.metadata.createdAt * 1000).toISOString()
    : String(data.createdAt || new Date().toISOString()),
  marketCap: data.bondingCurveInfo?.marketCap
    ? parseFloat(String(data.bondingCurveInfo.marketCap))
    : Number(data.marketCap) || 0,
  chatCount: Number(data.chatCount) || 0,
  isNsfw: Boolean(data.isNsfw),
  category: String(data.metadata?.category || data.category || 'General'),
  priceHistory: Array.isArray(data.priceHistory) ? data.priceHistory : [],
  priceChange24h: Number(data.priceChange24h) || 0,
  currentPrice: data.currentPrice ? parseFloat(String(data.currentPrice)) : undefined,
  volume24h: Number(data.volume24h),
  holders: Number(data.holders),
  totalSupply: data.totalSupply ? parseFloat(String(data.totalSupply)) : undefined,
  contractAddress: String(data.address || data.contractAddress || ''),
  isVerified: Boolean(data.isVerified),
  isActive: Boolean(data.metadata?.isActive),
  model: String(data.agentInfo?.model || ''),
  bondingCurveInfo: data.bondingCurveInfo ? {
    supply: data.totalSupply,
    reserve: data.bondingCurveInfo.reserve,
    price: data.currentPrice,
    marketCap: data.bondingCurveInfo.marketCap,
  } : undefined,
  // API compatibility fields
  address: data.address,
  tokenName: data.tokenName,
  tokenSymbol: data.tokenSymbol,
  agentInfo: data.agentInfo,
  metadata: data.metadata
});

export interface AgentFilters {
  category?: string;
  isGraduated?: boolean;
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume24h?: number;
  sortBy?: 'marketCap' | 'volume24h' | 'priceChange24h' | 'createdAt' | 'totalChats';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface AgentDiscoveryResponse {
  agents: Agent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AgentDiscoveryError {
  code: string;
  message: string;
  details?: any;
}

export interface AgentDiscoveryState {
  agents: Agent[];
  loading: boolean;
  error: AgentDiscoveryError | null;
  hasMore: boolean;
  currentPage: number;
  totalAgents: number;
  filters: AgentFilters;
}

export const useAgentDiscovery = (
  initialPageSize = 20,
  initialFilters: AgentFilters = {}
) => {
  const [state, setState] = useState<AgentDiscoveryState>({
    agents: [],
    loading: false,
    error: null,
    hasMore: true,
    currentPage: 1,
    totalAgents: 0,
    filters: {
      sortBy: 'marketCap',
      sortOrder: 'desc',
      ...initialFilters
    }
  });

  // Fetch agents from URSUS backend
  const fetchAgents = useCallback(async (
    page = 1,
    pageSize = initialPageSize,
    customFilters?: AgentFilters,
    reset = false
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const activeFilters = customFilters || state.filters;
      
      const response = await apiService.getAllAgents({
        page,
        limit: pageSize,
        category: activeFilters.category,
        search: activeFilters.search,
      });

      const agentsData = response.data?.agents || [];
      const pagination = response.data?.pagination;

      const mappedAgents: Agent[] = agentsData.map(mapAgentDataToAgent);

      setState(prev => ({
        ...prev,
        agents: reset ? mappedAgents : [...prev.agents, ...mappedAgents],
        loading: false,
        hasMore: pagination ? (pagination.page < pagination.pages) : (mappedAgents.length === pageSize),
        currentPage: pagination?.page || page,
        totalAgents: pagination?.total || mappedAgents.length,
        filters: activeFilters
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: {
          code: 'FETCH_AGENTS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch agents',
          details: error
        }
      }));
    }
  }, [initialPageSize, state.filters]);

  // Load more agents (pagination)
  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) {
      fetchAgents(state.currentPage + 1, initialPageSize, undefined, false);
    }
  }, [state.loading, state.hasMore, state.currentPage, initialPageSize, fetchAgents]);

  // Refresh agents with new filters
  const refresh = useCallback((newFilters?: AgentFilters) => {
    const filters = newFilters ? { ...state.filters, ...newFilters } : state.filters;
    fetchAgents(1, initialPageSize, filters, true);
  }, [state.filters, initialPageSize, fetchAgents]);

  // Search agents
  const searchAgents = useCallback(async (query: string): Promise<Agent[]> => {
    if (!query.trim()) return [];

    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/search?q=${encodeURIComponent(query)}&limit=10`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }, []);

  // Get trending agents
  const getTrendingAgents = useCallback(async (limit = 10): Promise<Agent[]> => {
    try {
      const response = await apiService.getTrendingAgents(limit);
      const agentsData = response.data?.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting trending agents:', error);
      return [];
    }
  }, []);

  // Get featured agents
  const getFeaturedAgents = useCallback(async (limit = 5): Promise<Agent[]> => {
    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/featured?limit=${limit}`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting featured agents:', error);
      return [];
    }
  }, []);

  // Get agents by category
  const getAgentsByCategory = useCallback(async (category: string, limit = 20): Promise<Agent[]> => {
    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/category/${category}?limit=${limit}`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting agents by category:', error);
      return [];
    }
  }, []);

  // Get top agents by market cap
  const getTopAgentsByMarketCap = useCallback(async (limit = 10): Promise<Agent[]> => {
    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/top-market-cap?limit=${limit}`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting top agents by market cap:', error);
      return [];
    }
  }, []);

  // Get recently created agents
  const getRecentAgents = useCallback(async (limit = 10): Promise<Agent[]> => {
    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/recent?limit=${limit}`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting recent agents:', error);
      return [];
    }
  }, []);

  // Get agent by address
  const getAgentByAddress = useCallback(async (address: string): Promise<Agent | null> => {
    try {
      const response = await apiService.getAgentDetails(address);
      const data = response.data || null;
      return data ? mapAgentDataToAgent(data as any) : null;
    } catch (error) {
      console.error('Error getting agent by address:', error);
      return null;
    }
  }, []);

  // Get agents created by user
  const getAgentsByCreator = useCallback(async (creatorAddress: string): Promise<Agent[]> => {
    try {
      const response = await apiService.get<{ agents: any[] }>(`/agents/creator/${creatorAddress}`);
      const agentsData = response.data.agents || [];
      return agentsData.map(mapAgentDataToAgent);
    } catch (error) {
      console.error('Error getting agents by creator:', error);
      return [];
    }
  }, []);

  // Get agent statistics
  const getAgentStats = useCallback(async (address: string) => {
    try {
      const response = await apiService.getAgentStats(address);
      return response.data || null;
    } catch (error) {
      console.error('Error getting agent stats:', error);
      return null;
    }
  }, []);

  // Update filters
  const setFilters = useCallback((newFilters: Partial<AgentFilters>) => {
    const updatedFilters = { ...state.filters, ...newFilters };
    setState(prev => ({ ...prev, filters: updatedFilters }));
    fetchAgents(1, initialPageSize, updatedFilters, true);
  }, [state.filters, initialPageSize, fetchAgents]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Initial load
  useEffect(() => {
    fetchAgents(1, initialPageSize, state.filters, true);
  }, []); // Only run once on mount

  // Computed values
  const isEmpty = useMemo(() => state.agents.length === 0 && !state.loading, [state.agents.length, state.loading]);
  const isLoading = useMemo(() => state.loading, [state.loading]);
  const hasError = useMemo(() => !!state.error, [state.error]);
  const errorMessage = useMemo(() => state.error?.message || null, [state.error?.message]);

  // Filter agents by various criteria
  const filterAgents = useCallback((agents: Agent[], filters: AgentFilters): Agent[] => {
    let filtered = [...agents];

    if (filters.category) {
      filtered = filtered.filter(agent => 
        agent.category?.toLowerCase() === filters.category?.toLowerCase()
      );
    }

    if (filters.isGraduated !== undefined) {
      filtered = filtered.filter(agent => 
        agent.isActive === filters.isGraduated
      );
    }

    if (filters.minMarketCap) {
      filtered = filtered.filter(agent => 
        Number(agent.marketCap) >= filters.minMarketCap!
      );
    }

    if (filters.maxMarketCap) {
      filtered = filtered.filter(agent => 
        Number(agent.marketCap) <= filters.maxMarketCap!
      );
    }

    if (filters.minVolume24h) {
      filtered = filtered.filter(agent => 
        Number(agent.volume24h || 0) >= filters.minVolume24h!
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(agent =>
        agent.name.toLowerCase().includes(searchLower) ||
        agent.symbol.toLowerCase().includes(searchLower) ||
        agent.description.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, []);

  // Sort agents
  const sortAgents = useCallback((agents: Agent[], sortBy: string, sortOrder: 'asc' | 'desc'): Agent[] => {
    return [...agents].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'marketCap':
          aValue = Number(a.marketCap);
          bValue = Number(b.marketCap);
          break;
        case 'volume24h':
          aValue = Number(a.volume24h || 0);
          bValue = Number(b.volume24h || 0);
          break;
        case 'priceChange24h':
          aValue = Number(a.priceChange24h || 0);
          bValue = Number(b.priceChange24h || 0);
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'totalChats':
          aValue = Number(a.chatCount || 0);
          bValue = Number(b.chatCount || 0);
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, []);

  return {
    // State
    ...state,

    // Actions
    fetchAgents,
    loadMore,
    refresh,
    searchAgents,
    getTrendingAgents,
    getFeaturedAgents,
    getAgentsByCategory,
    getTopAgentsByMarketCap,
    getRecentAgents,
    getAgentByAddress,
    getAgentsByCreator,
    getAgentStats,
    setFilters,
    clearError,

    // Utilities
    filterAgents,
    sortAgents,

    // Computed
    isEmpty,
    isLoading,
    hasError,
    errorMessage
  };
};

export default useAgentDiscovery;
