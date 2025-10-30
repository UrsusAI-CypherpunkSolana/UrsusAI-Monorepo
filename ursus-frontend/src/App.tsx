import { useState, useCallback, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import NotificationBar from './components/NotificationBar';
import SearchBar from './components/SearchBar';
import TrendingSection from './components/TrendingSection';
import WatchlistSection from './components/WatchlistSection';
import FilterBar from './components/FilterBar';
import AgentGrid from './components/AgentGrid';
import AgentCreation from './components/AgentCreation';
import Profile from './components/Profile';
import More from './components/More';
import Portfolio from './components/Portfolio';
import CreateAgentModal from './components/CreateAgentModal';
import EnhancedWalletConnect from './components/EnhancedWalletConnect';
import AgentDetail from './components/AgentDetail';
import TradingInterface from './components/TradingInterface';
import RealtimeNotifications from './components/RealtimeNotifications';
import Toast, { ToastMessage } from './components/Toast';
import { ProfessionalConnectionIndicator } from './components/ProfessionalConnectionIndicator';
import { ProfessionalWebSocketAnalytics } from './components/ProfessionalWebSocketAnalytics';
import WebSocketTest from './components/WebSocketTest';
import { useAgents, useTrendingAgents } from './hooks/useAgents';
import { useMarketData } from './hooks/useWebSocket';
import { Agent } from './types';
import AgentChat from './components/AgentChat';
import {useWatchlist } from './contexts/WatchlistContext';
import { useParams } from 'react-router-dom';
import { useAgentDetails } from './hooks/useAgents';

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get current section from URL
  const getCurrentSection = useCallback(() => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/agent/')) return 'agent-detail';
    if (path === '/create') return 'agent-creation';
    if (path === '/discover') return 'discover';
    if (path === '/profile') return 'profile';
    if (path === '/more') return 'more';
    if (path === '/portfolio') return 'portfolio';
    return 'home';
  }, [location.pathname]);

  function AgentChatRoute() {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const state = (location.state || {}) as { agentName?: string; agentInstructions?: string };
    const { agent } = useAgentDetails(id);
  
    const agentName =
      state.agentName ||
      (agent as any)?.name ||
      agent?.tokenName ||
      (agent as any)?.metadata?.name ||
      'Agent';

    const agentInstructions =
      state.agentInstructions ||
      agent?.agentInfo?.instructions ||
      agent?.description ||
      '';
  
    return (
      <AgentChat
        agentAddress={agent?.address || id || ''}
        agentName={agentName}
        agentInstructions={agentInstructions}
        isOpen={true}
        onClose={() => window.history.back()}
      />
    );
  }
  
  

  const [activeSection, setActiveSection] = useState(getCurrentSection());
  const [searchQuery, setSearchQuery] = useState('');
  const [includeNsfw, setIncludeNsfw] = useState(false);
  const [sortBy, setSortBy] = useState('featured');
  const [selectedCategory] = useState('');
  const [activeView, setActiveView] = useState<'explore' | 'watchlist'>('explore');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    setActiveSection(getCurrentSection());
  }, [location.pathname, getCurrentSection]);

  // Fetch real agents data
  const { agents, loading: agentsLoading, error: agentsError, refetch: refetchAgents } = useAgents({
    search: searchQuery,
    category: selectedCategory,
    limit: 20,
    autoRefresh: false // Disable auto-refresh to reduce API calls
  });

  const { agents: trendingAgents } = useTrendingAgents(10);

  // Real-time platform updates
  const { notifications: wsNotifications } = useMarketData();

  // Real-time notifications state
  interface AppNotification {
    id: string;
    type: string;
    message: string;
    timestamp: number;
    data: {
      agentAddress?: string;
      agentName?: string;
      name?: string;
      amount?: string;
      price?: string;
      user?: string;
      message?: string;
      creator?: string;
      buyer?: string;
      seller?: string;
      tokensReceived?: string;
      tokensAmount?: string;
      [key: string]: unknown;
    };
  }
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pushToast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [{ id, ...msg }, ...prev].slice(0, 5));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);


  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Handle real-time events
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      const latestEvent = wsNotifications[0];

      // Add to notifications with duplicate prevention
      setNotifications(prev => {
        // Create unique identifier for this event
        const eventKey = `${latestEvent.type}-${latestEvent.data?.agentAddress || latestEvent.data?.name}-${latestEvent.timestamp}`;

        // Check if we already have this notification
        const isDuplicate = prev.some(notification =>
          notification.id.includes(eventKey) ||
          (notification.type === latestEvent.type &&
           notification.data.agentAddress === latestEvent.data?.agentAddress &&
           Math.abs(notification.timestamp - (typeof latestEvent.timestamp === 'string'
             ? new Date(latestEvent.timestamp).getTime()
             : Date.now())) < 5000) // Within 5 seconds
        );

        if (isDuplicate) {
          return prev; // Don't add duplicate
        }

        const newNotification: AppNotification = {
          id: `${eventKey}-${Math.random()}`,
          type: latestEvent.type,
          message: latestEvent.type === 'agentCreated' ? 'New agent created!' :
                   latestEvent.type === 'tokensPurchased' ? 'Token purchase!' :
                   latestEvent.type === 'tokensSold' ? 'Token sale!' : 'New activity',
          data: {
            agentAddress: latestEvent.data?.agentAddress as string,
            agentName: latestEvent.data?.name as string,
            name: latestEvent.data?.name as string,
            creator: latestEvent.data?.creator as string,
            amount: latestEvent.data?.solAmount as string,
            ...latestEvent.data
          },
          timestamp: typeof latestEvent.timestamp === 'string'
            ? new Date(latestEvent.timestamp).getTime()
            : Date.now()
        };
        return [newNotification, ...prev.slice(0, 9)]; // Keep last 10
      });

      // Refresh agents data when new agent is created
      if (latestEvent.type === 'agentCreated') {
        refetchAgents();
      }
    }
  }, [wsNotifications, refetchAgents]);

  // Global toast event bridge (after pushToast is defined)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ type?: ToastMessage['type']; title?: string; message: string; actionLabel?: string; actionHref?: string }>;
      const { type = 'info', title, message, actionLabel, actionHref } = ce.detail || { message: '' };
      if (message) pushToast({ type, title, message, actionLabel, actionHref });
    };
    window.addEventListener('ursus:toast', handler as EventListener);
    return () => window.removeEventListener('ursus:toast', handler as EventListener);
  }, [pushToast]);

  // Lightweight API retry banner (currently disabled UI)


  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleCardClick = useCallback((agent: Agent) => {
    navigate(`/agent/${agent.id}`);
  }, [navigate]);

  const handleChatClick = useCallback((agent: Agent) => {
    navigate(`/agent/${agent.id}/chat`, {
      state: {
        agentName: agent.name || agent.tokenName || agent.symbol,
        agentInstructions: (agent as any)?.agentInfo?.instructions || agent.description
      }
    });
  }, [navigate]);
  

  const handleTradeClick = useCallback((agent: Agent) => {
    navigate(`/agent/${agent.id}/trade`);
  }, [navigate]);

  const handleSectionChange = useCallback((section: string) => {
    switch (section) {
      case 'home':
        navigate('/');
        break;
      case 'agent-creation':
        navigate('/create');
        break;
      case 'discover':
        navigate('/discover');
        break;
      case 'profile':
        navigate('/profile');
        break;
      case 'more':
        navigate('/more');
        break;
      case 'portfolio':
        navigate('/portfolio');
        break;
      default:
        navigate('/');
    }
  }, [navigate]);

  const handleDismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Convert API agents to match frontend Agent type
  const convertedAgents: Agent[] = agents.map(agent => ({
    id: agent.address || agent.id || '',
    name: agent.tokenName || agent.name || '',
    symbol: agent.tokenSymbol || agent.symbol || '',
    description: agent.agentInfo?.description || agent.description || '',
    currentPrice: parseFloat(String(agent.currentPrice || '0')),
    priceChange24h: agent.priceChange24h || 0,
    marketCap: parseFloat(String(agent.bondingCurveInfo?.marketCap || '0')),
    volume24h: agent.volume24h || 0,
    holders: agent.holders || 0,
    chatCount: agent.chatCount || 0,
    createdAt: agent.metadata?.createdAt
      ? new Date(agent.metadata.createdAt * 1000).toISOString()
      : agent.createdAt || new Date().toISOString(),
    creator: agent.metadata?.creator || agent.creator || '',
    category: agent.metadata?.category || agent.category || 'General',
    model: agent.agentInfo?.model || agent.model,
    isNsfw: agent.isNsfw || false,
    isVerified: agent.isVerified || true,
    isActive: agent.metadata?.isActive ?? agent.isActive ?? true,
    avatar: agent.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.address || agent.id}`,
    image: agent.image,
    priceHistory: agent.priceHistory || [],
    // API compatibility fields
    address: agent.address,
    tokenName: agent.tokenName,
    tokenSymbol: agent.tokenSymbol,
    agentInfo: agent.agentInfo,
    metadata: agent.metadata,
    bondingCurveInfo: agent.bondingCurveInfo,
    totalSupply: agent.totalSupply,
    contractAddress: agent.address
  }));

  // Sort agents based on sortBy
  const sortedAgents = [...convertedAgents].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'market-cap':
        return b.marketCap - a.marketCap;
      case 'chats':
        return b.chatCount - a.chatCount;
      default: // featured
        return b.marketCap - a.marketCap;
    }
  });

  // Home page component
  const HomePage = () => {
    const { watchlist } = useWatchlist();

    // Filter agents based on active view
    const displayAgents = activeView === 'watchlist'
      ? agents.filter(agent => {
          const agentAddress = agent.contractAddress || agent.address || agent.id;
          return watchlist.some(w => w.address.toLowerCase() === agentAddress.toLowerCase());
        })
      : sortedAgents;

    return (
    <div className="ml-[200px]">
      <NotificationBar />
      <main className="p-5">
        {/* Header with Wallet Connection */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">URSUS</h1>
            <p className="text-gray-400 text-sm">AI Agent Trading Platform on Solana</p>
          </div>

          <div className="flex items-center gap-3">
            <ProfessionalConnectionIndicator
              variant="compact"
              showMetrics={true}
              className="mr-3"
            />
            <ProfessionalWebSocketAnalytics
              variant="compact"
              className="mr-3"
            />
            <EnhancedWalletConnect
              className="ml-auto"
              showTransactions={true}
              showNetworkInfo={true}
            />
          </div>
        </div>

        <SearchBar onSearch={handleSearch} />

        <WatchlistSection />

        <TrendingSection trendingAgents={trendingAgents.map(agent => ({
          id: agent.address || agent.id || '',
          name: agent.tokenName || agent.name || '',
          symbol: agent.tokenSymbol || agent.symbol || '',
          description: agent.agentInfo?.description || agent.description || '',
          currentPrice: parseFloat(String(agent.currentPrice || '0')),
          priceChange24h: agent.priceChange24h || 0,
          marketCap: parseFloat(String(agent.bondingCurveInfo?.marketCap || '0')),
          volume24h: agent.volume24h || 0,
          holders: agent.holders || 0,
          chatCount: agent.chatCount || 0,
          createdAt: agent.metadata?.createdAt
            ? new Date(agent.metadata.createdAt * 1000).toISOString()
            : agent.createdAt || new Date().toISOString(),
          creator: agent.metadata?.creator || agent.creator || '',
          category: agent.metadata?.category || agent.category || 'General',
          model: agent.agentInfo?.model || agent.model,
          isNsfw: agent.isNsfw || false,
          isVerified: agent.isVerified || true,
          isActive: agent.metadata?.isActive ?? agent.isActive ?? true,
          avatar: agent.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.address || agent.id}`,
          image: agent.image,
          priceHistory: agent.priceHistory || [],
          // API compatibility fields
          address: agent.address,
          tokenName: agent.tokenName,
          tokenSymbol: agent.tokenSymbol,
          agentInfo: agent.agentInfo,
          metadata: agent.metadata,
          bondingCurveInfo: agent.bondingCurveInfo,
          totalSupply: agent.totalSupply,
          contractAddress: agent.address
        }))} />

        <FilterBar
          includeNsfw={includeNsfw}
          sortBy={sortBy}
          activeView={activeView}
          onToggleNsfw={() => setIncludeNsfw(!includeNsfw)}
          onSortChange={setSortBy}
          onViewChange={setActiveView}
        />

        {agentsError ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-red-400 mb-4">Failed to load agents</p>
              <button
                onClick={() => refetchAgents()}
                className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <AgentGrid
            agents={displayAgents}
            loading={agentsLoading}
            onCardClick={handleCardClick}
            onChatClick={handleChatClick}
            onTradeClick={handleTradeClick}
            onCreateClick={() => setIsCreateModalOpen(true)}
            isWatchlistView={activeView === 'watchlist'}
          />
        )}
      </main>
    </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-aeonik-regular">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      {/* Toasts */}

      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Real-time Notifications */}
      <RealtimeNotifications
        notifications={notifications}
        onDismiss={handleDismissNotification}
      />

      <CreateAgentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<AgentCreation onBack={() => navigate('/')} />} />
        <Route path="/profile" element={<Profile onBack={() => navigate('/')} />} />
        <Route path="/more" element={<More onBack={() => navigate('/')} />} />

        <Route path="/agent/:id" element={<AgentDetail />} />
        <Route path="/agent/:id/chat" element={<AgentChatRoute />} />
        <Route path="/agent/:id/trade" element={<TradingInterface />} />
        <Route path="/portfolio" element={<Portfolio onBack={() => navigate('/')} />} />
        <Route path="/websocket-test" element={<WebSocketTest />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </div>
  );
};

export default App;
