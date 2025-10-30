import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, MessageCircle, Zap } from 'lucide-react';

interface NotificationData {
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
}

interface RealtimeNotification {
  id: string;
  type: string;
  message: string;
  data: NotificationData;
  timestamp: number;
}

interface RealtimeNotificationsProps {
  notifications: RealtimeNotification[];
  onDismiss: (id: string) => void;
}

const RealtimeNotifications: React.FC<RealtimeNotificationsProps> = ({
  notifications,
  onDismiss
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<RealtimeNotification[]>([]);

  useEffect(() => {
    // Show only the latest 3 notifications
    setVisibleNotifications(notifications.slice(0, 3));
  }, [notifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'agentCreated':
        return <Zap className="w-4 h-4 text-[#d8e9ea]" />;
      case 'tokensPurchased':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'tokensSold':
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case 'agentInteraction':
        return <MessageCircle className="w-4 h-4 text-blue-400" />;
      default:
        return <Zap className="w-4 h-4 text-[#d8e9ea]" />;
    }
  };

  const getNotificationMessage = (notification: RealtimeNotification) => {
    const { type, data } = notification;

    switch (type) {
      case 'agentCreated':
        return `New agent "${data.name || 'Unknown'}" created by ${data.creator?.slice(0, 6) || 'Unknown'}...`;
      case 'tokensPurchased':
        return `${data.buyer?.slice(0, 6) || 'Unknown'}... bought ${parseFloat(data.tokensReceived || '0').toFixed(2)} tokens`;
      case 'tokensSold':
        return `${data.seller?.slice(0, 6) || 'Unknown'}... sold ${parseFloat(data.tokensAmount || '0').toFixed(2)} tokens`;
      case 'agentInteraction':
        return `${data.user?.slice(0, 6) || 'Unknown'}... interacted with agent`;
      default:
        return 'New activity detected';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'agentCreated':
        return 'border-[#d8e9ea] bg-[#d8e9ea]/10';
      case 'tokensPurchased':
        return 'border-green-400 bg-green-400/10';
      case 'tokensSold':
        return 'border-red-400 bg-red-400/10';
      case 'agentInteraction':
        return 'border-blue-400 bg-blue-400/10';
      default:
        return 'border-[#2a2a2a] bg-[#1a1a1a]';
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {/* Notifications */}
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 hover:scale-105 ${getNotificationColor(notification.type)}`}
          style={{ minWidth: '320px', maxWidth: '400px' }}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium leading-tight">
              {getNotificationMessage(notification)}
            </p>
            <p className="text-xs text-[#a0a0a0] mt-1">
              {formatTime(notification.timestamp)}
            </p>
          </div>
          
          <button
            onClick={() => onDismiss(notification.id)}
            className="flex-shrink-0 text-[#a0a0a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default RealtimeNotifications;
