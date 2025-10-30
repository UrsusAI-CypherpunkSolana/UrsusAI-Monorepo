import * as React from 'react';
import {
  ArrowLeft,
  Edit,
  //BarChart3,
  Users,
  //TrendingUp,
  DollarSign,
  Star,
  ExternalLink as TwitterIcon,
  ExternalLink as GithubIcon,
  Calendar,
  Shield,
  Settings,
  Activity,
  Wallet,
  //Copy,
  //Eye,
  //EyeOff,
  //Key
} from 'lucide-react';
import { useAgents } from '../hooks/useAgents';
import { useWallet } from '../contexts/WalletContext';
import apiService from '../services/api';
import { Link } from 'react-router-dom';

type ActivityItem = {
  id: string;
  type: 'created' | 'earned' | 'milestone' | 'trade';
  message: string;
  amount?: number;
  timestamp: string; // ISO
  icon: string;
};

type NormalizedMarket = {
  priceUsd: number;
  change24h: number;
  symbol: string;
  icon?: string;
  volume24hUsd: number;
};

type SettingsForm = {
  username: string;
  email: string;
  twitter: string;
  discord: string;
  github: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
};


// market null gelebilir → her field için güvenli fallback ver
function toSafeMarket(market: NormalizedMarket | null | undefined, ag: any): NormalizedMarket {
  return {
    priceUsd: Number(market?.priceUsd ?? 0),
    change24h: Number(market?.change24h ?? 0),
    symbol: market?.symbol ?? ag?.tokenSymbol ?? 'AGT',
    icon: market?.icon ?? '🤖',
    volume24hUsd: Number(market?.volume24hUsd ?? 0),
  };
}
async function fetchAgentMarket(address: string): Promise<NormalizedMarket | null> {
  try {
    const statsResp = await apiService.getAgentStats(address);
    const detailsResp = await apiService.getAgentDetails(address);

    // ✅ TS18048 çözümü: opsiyonel zincirleme + null guard
    const stats = statsResp?.data ?? null;
    const details = detailsResp?.data ?? null;
    if (!stats || !details) return null;

    return {
      priceUsd: Number(stats.currentPrice ?? 0),
      change24h: Number(stats.priceChange24h ?? 0),
      volume24hUsd: Number(stats.volume24h ?? 0),
      symbol: details.tokenSymbol ?? 'AGT',
      icon: details.avatar || details.image || '🤖',
    };
  } catch (err) {
    console.error('fetchAgentMarket error', address, err);
    return null;
  }
}

// Tek seferde tüm token bakiyelerini çeker ve adres→miktar map'ine çevirir
async function loadWalletBalancesMap(wallet: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!wallet) return map;

  try {
    const resp = await apiService.getTradingStats(wallet); // GET /trading/stats/:wallet
    const data = resp?.data;
    if (data?.holdings?.length) {
      for (const h of data.holdings) {
        const addr = (h.agentAddress || '').toLowerCase();
        const amount = Number(h.tokenAmount ?? 0);
        if (addr) map.set(addr, amount);
      }
    }
  } catch (e) {
    console.warn('loadWalletBalancesMap failed', wallet, e);
  }
  return map;
}


async function fetchUserTokenBalance(agentAddress: string, userAddress: string): Promise<number> {
  if (!userAddress) return 0;
  try {
    const resp = await apiService.getUserBalance(agentAddress, userAddress);
    // ✅ TS18048 çözümü
    return Number(resp?.data?.balance ?? 0);
  } catch (err) {
    console.error('fetchUserTokenBalance error', agentAddress, userAddress, err);
    return 0;
  }
}


const fmtUSD = (n?: number) =>
  n == null ? '' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const relTime = (d: string | number | Date) => {
  const t = new Date(d).getTime();
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hours ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day} days ago`;
  return new Date(d).toLocaleDateString();
};

// --- Profile dynamic types & fetch (inline) ---
type UserProfile = {
  id: string;
  username: string;
  avatar?: string | null;
  joinDate: string;             // ISO veya "March 2023" gibi metin
  isVerified: boolean;
  walletAddress: string;
  socialLinks: { twitter?: string; discord?: string; github?: string };
  bio?: string;
};

interface ProfileProps {
  onBack: () => void;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'high-demand';
  chatCount: number;
  earnings: number;
  rating: number;
  icon: string;
  image?: string;
}

interface PortfolioItem {
  token: string;
  symbol: string;
  holdings: number;
  value: number;
  change24h: number;
  icon: string;
  volume24h?: number; 
}


const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = React.useState('agents');
  const [isEditingBio, setIsEditingBio] = React.useState(false);
  const [bio, setBio] = React.useState(
    'AI enthusiast and DeFi researcher. Building the future of decentralized AI agents.'
  );
  const [activities, setActivities] = React.useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = React.useState<boolean>(false);
  const [portfolio, setPortfolio] = React.useState<PortfolioItem[]>([]);
  const [portfolioLoading, setPortfolioLoading] = React.useState<boolean>(true);

  // settings form state'lerin de component İÇİNDE olsun:
  const [saving, setSaving] = React.useState(false);
  const [settingsForm, setSettingsForm] = React.useState<SettingsForm>({
    username: '',
    email: '',
    twitter: '',
    discord: '',
    github: '',
    emailNotifications: false,
    pushNotifications: false,
  });

  type RawAgentForActivity = {
    address?: string;
    tokenName?: string;
    createdAt?: string | number | Date;
    createTime?: string | number | Date;
    blockTimestamp?: string | number | Date;
  };

  // Dynamic profile state (setter yok; cüzdandan türetiyoruz)
  const { address: connectedWallet } = useWallet();

  

  // URL ?wallet= veya ?handle= varsa kullan; yoksa bağlı cüzdanı al
  const walletAddress = React.useMemo(() => {
    if (typeof window === 'undefined') return connectedWallet ?? '';
    const qs = new URLSearchParams(window.location.search);
    const val = qs.get('wallet') ?? qs.get('handle') ?? connectedWallet ?? '';
    return (val || '').toLowerCase();
  }, [connectedWallet]);

const [profile, setProfile] = React.useState<UserProfile | null>(null);
const profileLoading = false as const;

// wallet değişince minimal profili hazırla (API yoksa optimistic)
React.useEffect(() => {
  if (!walletAddress) { setProfile(null); return; }
  setProfile(prev => ({
    id: walletAddress,
    username: prev?.username ?? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
    joinDate: prev?.joinDate ?? '-',
    isVerified: prev?.isVerified ?? false,
    walletAddress,
    socialLinks: prev?.socialLinks ?? {},
    avatar: prev?.avatar ?? null,
    bio: prev?.bio ?? bio,
  }));
}, [walletAddress]);

// Bio değişirse profilde de güncelle
React.useEffect(() => {
  if (!profile) return;
  setProfile(p => p ? ({ ...p, bio }) : p);
}, [bio]);


// Header loader’ı kontrol etmek için basit flag
  const agentQuery = React.useMemo(() => {
    return { creator: profile?.walletAddress ?? '', limit: 50 };
  }, [profile?.walletAddress]);
  
  const { agents: userAgents, loading: agentsLoading } = useAgents(agentQuery);

  // Quick stats (derived)
const agentsCreated = React.useMemo(
  () => (Array.isArray(userAgents) ? userAgents.length : 0),
  [userAgents]
);

const totalPortfolioValue = React.useMemo(
  () =>
    Array.isArray(portfolio)
      ? portfolio.reduce(
          (sum: number, p: PortfolioItem) => sum + (Number(p.value) || 0),
          0
        )
      : 0,
  [portfolio]
);


  React.useEffect(() => {
    if (!walletAddress) {
      setPortfolio([]);
      setPortfolioLoading(false);
      return;
    }
    if (agentsLoading) return;
  
    if (!userAgents || userAgents.length === 0) {
      setPortfolio([]);
      setPortfolioLoading(false);
      return;
    }
  
    let cancelled = false;
    setPortfolioLoading(true);
  
    (async () => {
      try {
        const balancesMap = await loadWalletBalancesMap(walletAddress);
  
        const rows: PortfolioItem[] = await Promise.all(
          userAgents.map(async (ag: any) => {
            const address: string = String(ag.address || '').toLowerCase();
  
            const marketRaw = await fetchAgentMarket(address);     // NormalizedMarket | null
            const market = toSafeMarket(marketRaw, ag);            // null-safe
  
            const holdings = Number(balancesMap.get(address) ?? 0);
            const value = Number.isFinite(holdings * market.priceUsd)
              ? Number(holdings * market.priceUsd)
              : 0;
  
            return {
              token: ag.tokenName || 'AI Agent',
              symbol: market.symbol,
              holdings,
              value,
              change24h: market.change24h,
              icon: market.icon ?? '🤖',
              volume24h: market.volume24hUsd,
            } as PortfolioItem;
          })
        );
  
        rows.sort((a, b) => b.value - a.value);
  
        if (!cancelled) setPortfolio(rows);
      } catch (e) {
        if (!cancelled) {
          console.error('portfolio build failed', e);
          setPortfolio([]);
        }
      } finally {
        if (!cancelled) setPortfolioLoading(false);
      }
    })();
  
    return () => {
      cancelled = true;
    };
  }, [walletAddress, agentsLoading, userAgents]);
  
  
  
  React.useEffect(() => {
    if (!profileLoading && !profile?.walletAddress) {
      setPortfolio([]);
      setPortfolioLoading(false);
    }
  }, [profileLoading, profile?.walletAddress]);
  
  React.useEffect(() => {
    if (!profile?.walletAddress) {
      setPortfolio([]);
      setPortfolioLoading(false);
      return;
      }   
    if (agentsLoading) return;
    if (!userAgents || userAgents.length === 0) {
      setPortfolio([]);
      setPortfolioLoading(false);
      return;
    }
  
    let cancelled = false;
    setPortfolioLoading(true);
  
    (async () => {
      try {
        const rows = await Promise.all(
          userAgents.map(async (ag: any) => {
            const address = ag.address || '';
        
            const marketRaw = await fetchAgentMarket(address); // NormalizedMarket | null
            const market = toSafeMarket(marketRaw, ag);       
        
            const holdings = await fetchUserTokenBalance(address, profile?.walletAddress ?? '');
            const price = market.priceUsd;                    
            const value = Number.isFinite(holdings * price) ? holdings * price : 0;
        
            const row: PortfolioItem = {
              token: ag.tokenName || 'AI Agent',
              symbol: market.symbol,
              holdings: Number(holdings || 0),
              value: Number(value || 0),
              change24h: market.change24h,
              icon: market.icon ?? '🤖',
              volume24h: market.volume24hUsd,
            };
        
            return row;
          })
        );
        
        if (!cancelled) setPortfolio(rows);
      } catch (e) {
        if (!cancelled) {
          console.error('portfolio build failed', e);
          setPortfolio([]);
        }
      } finally {
        if (!cancelled) setPortfolioLoading(false);
      }
    })();
  
    return () => { cancelled = true; };
  }, [profile?.walletAddress, agentsLoading, userAgents]);

  React.useEffect(() => {
    if (!walletAddress) {
      setActivities([]);
      return;
    }
  
    let cancelled = false;
    setActivityLoading(true);
  
    (async () => {
      try {
        const items: ActivityItem[] = [];
  
        // 1) Eğer varsa direkt activity endpoint'i
        try {
          const res = await (apiService as any)?.getActivityFeed?.(walletAddress);
          const raw = res?.data ?? [];
          for (const ev of raw) {
            items.push({
              id: String(ev.id ?? `${ev.type}-${ev.timestamp ?? Math.random()}`),
              type: (ev.type ?? 'trade') as ActivityItem['type'],
              message: String(ev.message ?? ''),
              amount: ev.amount != null ? Number(ev.amount) : undefined,
              timestamp: ev.timestamp ? String(ev.timestamp) : new Date().toISOString(),
              icon:
                ev.icon ??
                (ev.type === 'earned'
                  ? '💰'
                  : ev.type === 'created'
                  ? '🤖'
                  : ev.type === 'milestone'
                  ? '🎯'
                  : '🛒'),
            });
          }
        } catch {/* yoksa fallback'lere geç */}
  
        // 2) Fallback: Agent oluşturma kayıtları (userAgents'tan)
        for (const ag of (userAgents as RawAgentForActivity[] ?? [])) {
          const tsRaw = ag?.createdAt ?? ag?.createTime ?? ag?.blockTimestamp;
          if (tsRaw) {
            items.push({
              id: `created-${ag.address ?? Math.random()}`,
              type: 'created',
              message: `Created ${ag.tokenName ?? 'AI'} agent`,
              timestamp: new Date(tsRaw).toISOString(),
              icon: '🤖',
            });
          }
        }
  
        // 3) Fallback: İşlemler (varsa)
        try {
          const txRes = await (apiService as any)?.getTradingTransactions?.(walletAddress);
          const txs = txRes?.data?.transactions ?? txRes?.data ?? [];
          for (const tx of (txs as any[])) {
            const side = (tx.side || tx.type || '').toLowerCase();
            const isBuy = side.includes('buy');
            const sym = tx.symbol || tx.tokenSymbol || 'DAT';
            const amt = Number(tx.amount ?? tx.tokenAmount ?? 0);
            const usd = Number(tx.usdValue ?? tx.valueUsd ?? 0);
  
            items.push({
              id: String(tx.hash ?? `${side}-${sym}-${tx.timestamp ?? Math.random()}`),
              type: 'trade',
              message: `${isBuy ? 'Bought' : 'Sold'} ${amt.toLocaleString()} ${sym} tokens`,
              amount: Number.isFinite(usd) && usd > 0 ? usd : undefined,
              timestamp: tx.timestamp ? String(tx.timestamp) : new Date().toISOString(),
              icon: '🛒',
            });
          }
        } catch {/* yoksa geç */}
  
        // yeni → eski
        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
        if (!cancelled) setActivities(items);
      } catch (e) {
        console.error('load activities failed', e);
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
  
    return () => { cancelled = true; };
  }, [walletAddress, userAgents]);
  

  React.useEffect(() => {
    setSettingsForm(prev => ({
      ...prev,
      username: profile?.username ?? '',
      // e-mail şimdilik backend yoksa boş
      twitter: profile?.socialLinks?.twitter ?? '',
      discord: profile?.socialLinks?.discord ?? '',
      github: profile?.socialLinks?.github ?? '',
    }));
  }, [
    profile?.username,
    profile?.socialLinks?.twitter,
    profile?.socialLinks?.discord,
    profile?.socialLinks?.github,
  ]);
  
  // Bildirimleri yerelde tut (örnek: localStorage)
  React.useEffect(() => {
    try {
      const raw = walletAddress ? localStorage.getItem(`noti:${walletAddress}`) : null;
      if (raw) {
        const v = JSON.parse(raw);
        setSettingsForm(prev => ({
          ...prev,
          emailNotifications: !!v.emailNotifications,
          pushNotifications: !!v.pushNotifications,
        }));
      }
    } catch {}
  }, [walletAddress]);
  
  React.useEffect(() => {
    try {
      if (walletAddress) {
        localStorage.setItem(
          `noti:${walletAddress}`,
          JSON.stringify({
            emailNotifications: settingsForm.emailNotifications,
            pushNotifications: settingsForm.pushNotifications,
          })
        );
      }
    } catch {}
  }, [walletAddress, settingsForm.emailNotifications, settingsForm.pushNotifications]);
  
  // Sosyal linkleri normalize et (kısa kullanıcı adını tam URL'e çevir)
  function normalizeSocial(kind: 'twitter'|'discord'|'github', value: string) {
    let v = (value || '').trim();
    if (!v) return '';
    if (v.startsWith('@')) v = v.slice(1);
    const hasProtocol = /^https?:\/\//i.test(v);
    if (hasProtocol) return v;
    const base =
      kind === 'twitter' ? 'https://twitter.com/' :
      kind === 'discord' ? 'https://discord.gg/' :
      'https://github.com/';
    return base + v;
  }
  
  async function handleSaveSettings() {
    if (!profile) return;
    setSaving(true);
  
    const next = {
      username: settingsForm.username?.trim() || profile.username,
      email: settingsForm.email?.trim() || '',
      socialLinks: {
        twitter: normalizeSocial('twitter', settingsForm.twitter),
        discord: normalizeSocial('discord', settingsForm.discord),
        github: normalizeSocial('github', settingsForm.github),
      },
      notifications: {
        email: settingsForm.emailNotifications,
        push: settingsForm.pushNotifications,
      },
    };
  
    try {
      // Backend’in varsa kullan; yoksa optimistic update devam
      await (apiService as any)?.updateUserProfile?.(profile.walletAddress, next);
    } catch (e) {
      console.warn('updateUserProfile yok/başarısız — optimistic update uygulanıyor.', e);
    } finally {
      // UI’yı anında güncelle
      setProfile(p => p ? ({ ...p, username: next.username, socialLinks: { ...p.socialLinks, ...next.socialLinks } }) : p);
      setSaving(false);
    }
  }

  // Convert API agents to Profile Agent format
  const agents: Agent[] = userAgents.map(agent => ({
    id: agent.address || '',
    name: agent.tokenName || '',
    description: agent.agentInfo?.description || 'AI Agent',
    status: 'active', // Would be determined from agent activity
    chatCount: 0, // Would come from chat analytics
    earnings: 0, // Would need to calculate from trading fees
    rating: 4.5, // Would need to calculate from user feedback
    icon: agent.image || agent.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.address}`,
    image: agent.image || agent.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${agent.address}`
  }));

  /*
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'created',
      message: 'Created DeFi Analyzer Pro agent',
      timestamp: '2 hours ago',
      icon: '🤖'
    },
    {
      id: '2',
      type: 'earned',
      message: 'Earned $234.50 from agent interactions',
      amount: 234.50,
      timestamp: '1 day ago',
      icon: '💰'
    },
    {
      id: '3',
      type: 'milestone',
      message: 'Content Creator AI reached 1000 chats milestone',
      timestamp: '3 days ago',
      icon: '🎯'
    },
    {
      id: '4',
      type: 'trade',
      message: 'Bought 5000 DAT tokens',
      amount: 125.00,
      timestamp: '1 week ago',
      icon: ''
    }
  ];
*/
  const tabs = [
    { id: 'agents', label: 'My Agents', icon: Users },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-[#10b981]';
      case 'paused': return 'text-[#f59e0b]';
      case 'high-demand': return 'text-[#ef4444]';
      default: return 'text-[#a0a0a0]';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[#10b981]/10';
      case 'paused': return 'bg-[#f59e0b]/10';
      case 'high-demand': return 'bg-[#ef4444]/10';
      default: return 'bg-[#2a2a2a]';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] ml-[200px]">
      {/* Header Section */}
      <div className="relative h-[200px] bg-gradient-to-b from-[#0a0a0a] to-[#1a1a1a]">
        <div className="absolute inset-0 flex items-center justify-center pt-8">
          <div className="text-center">
            <div className="w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] mx-auto mb-4 flex items-center justify-center text-4xl font-bold text-black">
            {(profile?.username ?? '').charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <h1 className="text-white text-3xl font-bold">
              {profileLoading ? '...' : (profile?.username ?? '')}
              </h1>
              {profile?.isVerified && (
                <div className="p-1 bg-[#d8e9ea] rounded-full">
                  <Shield size={16} className="text-black" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 text-[#a0a0a0]">
              <Calendar size={14} />
              <span className="text-sm">
              {profileLoading ? 'Joined —' : `Joined ${profile?.joinDate ?? '-'}`}
              </span>            </div>
          </div>
        </div>
        
        {/* Back Button */}
        <button
          onClick={onBack}
          className="absolute top-6 left-6 flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back</span>
        </button>
      </div>

      {/* Profile Info Section */}
      <div className="px-8 py-6">
        {/* Bio Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-medium">Bio</h3>
            <button
              onClick={() => setIsEditingBio(!isEditingBio)}
              className="text-[#d8e9ea] hover:text-[#b8d4d6] transition-colors"
            >
              <Edit size={16} />
            </button>
          </div>
          {isEditingBio ? (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors resize-none"
              rows={3}
            />
          ) : (
            <p className="text-[#e5e5e5] leading-relaxed">{bio}</p>
          )}
        </div>

        {/* Social Links */}
        <div className="mb-8">
          <h3 className="text-white font-medium mb-3">Social Links</h3>
          <div className="flex gap-4">
          <a href={profile?.socialLinks?.twitter} target="_blank" rel="noreferrer"
              className={`flex items-center gap-2 ${profile?.socialLinks?.twitter ? 'text-[#a0a0a0] hover:text-[#d8e9ea]' : 'text-[#555] cursor-not-allowed'}`}>
              <TwitterIcon size={18} />
              <span className="text-sm">Twitter</span>
            </a>
            <a
              href={profile?.socialLinks?.discord}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!profile?.socialLinks?.discord}
              className={`flex items-center gap-2 ${
                profile?.socialLinks?.discord
                  ? 'text-[#a0a0a0] hover:text-[#d8e9ea]'
                  : 'text-[#555] cursor-not-allowed'
              }`}
            >
              <TwitterIcon size={18} /> {/* ExternalLink ikonunu diğerleri gibi kullanıyoruz */}
              <span className="text-sm">Discord</span>
            </a>
            <a href={profile?.socialLinks?.github} target="_blank" rel="noreferrer"
              className={`flex items-center gap-2 ${profile?.socialLinks?.github ? 'text-[#a0a0a0] hover:text-[#d8e9ea]' : 'text-[#555] cursor-not-allowed'}`}>
              <GithubIcon size={18} />
              <span className="text-sm">GitHub</span>
            </a>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Agents Created */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
              <Users size={16} className="text-black" />
            </div>
            <span className="text-[#a0a0a0] text-sm">Agents Created</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {agentsLoading ? '—' : agentsCreated}
          </div>
        </div>

        {/* Total Value (from portfolio) */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
              <DollarSign size={16} className="text-black" />
            </div>
            <span className="text-[#a0a0a0] text-sm">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {portfolioLoading
              ? '—'
              : `$${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </div>
        </div>
         
         {/* 
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                <TrendingUp size={16} className="text-black" />
              </div>
              <span className="text-[#a0a0a0] text-sm">Success Rate</span>
            </div>
            <div className="text-2xl font-bold text-white">{userStats.successRate}%</div>
          </div>
          */}
          
          {/* BU KISIM FOLLOWERS KISMI ŞİMDİLİK KALDIRDIK
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                <Users size={16} className="text-black" />
              </div>
              <span className="text-[#a0a0a0] text-sm">Followers</span>
            </div>
           <div className="text-2xl font-bold text-white">{userStats.followers.toLocaleString()}</div> 
          </div> */}
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-[#2a2a2a] mb-6">
          <div className="flex gap-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 px-1 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-[#d8e9ea] border-b-2 border-[#d8e9ea]'
                      : 'text-[#a0a0a0] hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* My Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-white text-xl font-semibold">My Agents</h3>
                {/*<button className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors">
                  Create New Agent
                </button>*/}
              </div>
              
              {agentsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 animate-pulse">
                      <div className="w-12 h-12 bg-gray-700 rounded-xl mb-4"></div>
                      <div className="h-4 bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded mb-4 w-3/4"></div>
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
                  <div className="text-6xl mb-6">🤖</div>
                  <h3 className="text-2xl font-bold text-white mb-4">No Agents Created Yet</h3>
                  <p className="text-gray-400 text-center max-w-md mb-8">
                    You haven't created any AI agents yet. Deploy your first agent on Core testnet to start earning!
                  </p>
                  <button className="bg-[#d8e9ea] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors">
                    Create Your First Agent
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {agents.map((agent) => (
    <Link
      key={agent.id || agent.name}
      to={`/agent/${encodeURIComponent(agent.id)}`} // id = agent address
      aria-label={`Open ${agent.name} details`}
      className="block bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 hover:border-[#3a3a3a] transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#d8e9ea]"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-xl flex items-center justify-center text-xl overflow-hidden">
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
              🤖
            </span>
          </div>
          <div>
            <h4 className="text-white font-semibold">{agent.name}</h4>
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusBg(agent.status)} ${getStatusColor(agent.status)}`}>
              {agent.status === 'active' && 'Active'}
              {agent.status === 'paused' && 'Paused'}
              {agent.status === 'high-demand' && 'High Demand'}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[#a0a0a0] text-sm mb-4 line-clamp-2">{agent.description}</p>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-[#a0a0a0]">Chats</span>
          <span className="text-white">{agent.chatCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#a0a0a0]">Earnings</span>
          <span className="text-[#10b981]">${agent.earnings.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#a0a0a0]">Rating</span>
          <div className="flex items-center gap-1">
            <Star size={14} className="text-[#f59e0b] fill-current" />
            <span className="text-white">{agent.rating}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">{/* future actions */}</div>
    </Link>
  ))}
</div>

              )}
            </div>
          )}

          {/* Portfolio Tab */}
          {activeTab === 'portfolio' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-white text-xl font-semibold">Portfolio</h3>
                <div className="text-right">
                  <div className="text-[#a0a0a0] text-sm">Total Value</div>
                  <div className="text-white text-xl font-bold">
                  ${(
                    (portfolio ?? []).reduce((sum: number, i: PortfolioItem) => sum + i.value, 0)
                  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2a2a2a]">
                        <th className="text-left p-4 text-[#a0a0a0] font-medium">Token</th>
                        <th className="text-left p-4 text-[#a0a0a0] font-medium">Holdings</th>
                        <th className="text-left p-4 text-[#a0a0a0] font-medium">Value</th>
                        <th className="text-left p-4 text-[#a0a0a0] font-medium">24h Change</th>
                      </tr>
                    </thead>
                    <tbody>
                    {portfolioLoading ? (
                    <tr>
                    <td className="p-4 text-[#a0a0a0]" colSpan={5}>Loading portfolio...</td>
                    </tr>
                    ) : (portfolio ?? []).length === 0 ? (
                    <tr>
                    <td className="p-4 text-[#a0a0a0]" colSpan={5}>No assets found.</td>
                    </tr>
                    ) : (portfolio ?? []).map((item, index) => (
                        <tr key={index} className="border-b border-[#2a2a2a] hover:bg-[#0a0a0a] transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-lg flex items-center justify-center text-sm">
                                {item.icon}
                              </div>
                              <div>
                                <div className="text-white font-medium">{item.token}</div>
                                <div className="text-[#a0a0a0] text-sm">{item.symbol}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-white">{item.holdings.toLocaleString()}</td>
                          <td className="p-4 text-white">${item.value.toLocaleString()}</td>
                          <td className="p-4">
                            <span className={`font-medium ${item.change24h >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
                              {item.change24h >= 0 ? '+' : ''}{item.change24h}%
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
  <div className="space-y-6">
    <h3 className="text-white text-xl font-semibold">Activity Feed</h3>

    {activityLoading ? (
      <div className="text-[#a0a0a0]">Loading feed...</div>
    ) : activities.length === 0 ? (
      <div className="text-[#a0a0a0]">No activity yet.</div>
    ) : (
      <div className="space-y-4">
        {activities.map((activity: ActivityItem) => (
          <div key={activity.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-lg flex items-center justify-center text-lg">
                {activity.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white">{activity.message}</p>
                  {activity.amount != null && (
                    <span className="text-[#10b981] font-medium">{fmtUSD(activity.amount)}</span>
                  )}
                </div>
                <p className="text-[#a0a0a0] text-sm">{relTime(activity.timestamp)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}


          {/* Settings Tab */}
          {activeTab === 'settings' && (
          <div className="space-y-8">
            <h3 className="text-white text-xl font-semibold">Account Settings</h3>

            {/* Profile Information */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h4 className="text-white font-medium mb-4">Profile Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Username</label>
                  <input
                    type="text"
                    value={settingsForm.username}
                    onChange={(e) => setSettingsForm(s => ({ ...s, username: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Email</label>
                  <input
                    type="email"
                    value={settingsForm.email}
                    onChange={(e) => setSettingsForm(s => ({ ...s, email: e.target.value }))}
                    className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                    placeholder="you@example.com"
                  />
                </div>
              </div>
            </div>
            
            {/* Security (UI only, şimdilik işlevsiz) */}
<div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
  <h4 className="text-white font-medium mb-4">Security</h4>
  <div className="space-y-4">
    <div>
      <label className="text-[#a0a0a0] text-sm mb-2 block">Current Password</label>
      <input
        type="password"
        disabled
        placeholder="Enter current password"
        className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] opacity-60 cursor-not-allowed"
      />
    </div>
    <div>
      <label className="text-[#a0a0a0] text-sm mb-2 block">New Password</label>
      <input
        type="password"
        disabled
        placeholder="Enter new password"
        className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] opacity-60 cursor-not-allowed"
      />
    </div>
    <button
      disabled
      className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium opacity-60 cursor-not-allowed"
    >
      Enable 2FA
    </button>
  </div>
</div>

{/* API Keys (UI only, şimdilik işlevsiz) */}
<div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
  <h4 className="text-white font-medium mb-4">API Keys</h4>
  <div className="space-y-4">
    <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
      <div>
        <div className="text-white font-medium">Production API Key</div>
        <div className="text-[#a0a0a0] text-sm">Last used: 2 hours ago</div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => alert('Copy is not implemented yet')}
          className="bg-[#2a2a2a] text-white px-3 py-1 rounded text-sm hover:bg-[#3a3a3a] transition-colors"
        >
          Copy
        </button>
        <button
          onClick={() => alert('Revoke is not implemented yet')}
          className="bg-[#ef4444] text-white px-3 py-1 rounded text-sm hover:bg-[#dc2626] transition-colors"
        >
          Revoke
        </button>
      </div>
    </div>
    <button
      onClick={() => alert('Generate is not implemented yet')}
      className="bg-[#d8e9ea] text-black px-4 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors"
    >
      Generate New API Key
    </button>
  </div>
</div>


            {/* Social Links */}
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
              <h4 className="text-white font-medium mb-4">Social Links</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Twitter</label>
                  <input
                    type="text"
                    value={settingsForm.twitter}
                    onChange={(e) => setSettingsForm(s => ({ ...s, twitter: e.target.value }))}
                    placeholder="@handle or url"
                    className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">Discord</label>
                  <input
                    type="text"
                    value={settingsForm.discord}
                    onChange={(e) => setSettingsForm(s => ({ ...s, discord: e.target.value }))}
                    placeholder="invite code or url"
                    className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[#a0a0a0] text-sm mb-2 block">GitHub</label>
                  <input
                    type="text"
                    value={settingsForm.github}
                    onChange={(e) => setSettingsForm(s => ({ ...s, github: e.target.value }))}
                    placeholder="user or repo url"
                    className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-3 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                  />
                </div>
              </div>
            </div>

    {/* Notifications */}
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
      <h4 className="text-white font-medium mb-4">Notifications</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium">Email Notifications</div>
            <div className="text-[#a0a0a0] text-sm">Receive updates via email</div>
          </div>
          <button
            onClick={() => setSettingsForm(s => ({ ...s, emailNotifications: !s.emailNotifications }))}
            aria-pressed={settingsForm.emailNotifications}
            className={`relative w-12 h-6 rounded-full transition-colors ${settingsForm.emailNotifications ? 'bg-[#d8e9ea]' : 'bg-[#2a2a2a]'}`}
          >
            <div className={`absolute top-1 ${settingsForm.emailNotifications ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full shadow-md`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-medium">Push Notifications</div>
            <div className="text-[#a0a0a0] text-sm">Receive browser notifications</div>
          </div>
          <button
            onClick={() => setSettingsForm(s => ({ ...s, pushNotifications: !s.pushNotifications }))}
            aria-pressed={settingsForm.pushNotifications}
            className={`relative w-12 h-6 rounded-full transition-colors ${settingsForm.pushNotifications ? 'bg-[#d8e9ea]' : 'bg-[#2a2a2a]'}`}
          >
            <div className={`absolute top-1 ${settingsForm.pushNotifications ? 'right-1' : 'left-1'} w-4 h-4 bg-white rounded-full shadow-md`}></div>
          </button>
        </div>
      </div>
    </div>

    {/* Save */}
    <div className="flex justify-end">
      <button
        onClick={handleSaveSettings}
        disabled={saving}
        className="bg-[#d8e9ea] text-black px-5 py-2 rounded-lg font-medium hover:bg-[#b8d4d6] transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save changes'}
      </button>
    </div>
  </div>
)}

        </div>
      </div>
    </div>
  );
};

export default Profile; 