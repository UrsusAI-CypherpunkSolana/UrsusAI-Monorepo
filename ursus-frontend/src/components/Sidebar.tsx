import React from 'react';
import { Home, Monitor, User, MoreHorizontal, Plus, Wifi, Search } from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange
}) => {
  const navigationItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'discover', label: 'Discover', icon: Search },
    { id: 'agent-creation', label: 'Launchpad', icon: Monitor },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <div className="fixed left-0 top-0 w-[200px] h-screen bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col">
      {/* Navigation */}
      <div className="p-4 space-y-1">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-[#d8e9ea] text-black' 
                  : 'text-[#e5e5e5] hover:bg-[#2a2a2a] hover:text-white'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Create Agent Button */}
      <div className="px-4 mb-6">
        <button
          onClick={() => onSectionChange('agent-creation')}
          className="w-full bg-[#d8e9ea] text-black font-semibold py-2.5 px-4 rounded-lg hover:bg-[#b8d4d6] transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Create Agent
        </button>
      </div>
      {/* Status - Bottom Left */}
      <div className="mt-auto p-4">
        {/* Live Status */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
          <Wifi size={14} className="animate-pulse" />
          <span className="text-xs font-medium">LIVE</span>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;