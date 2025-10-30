import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import { useMarketData } from '../hooks/useWebSocket';

const NotificationBar: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { notifications: wsNotifications } = useMarketData();

  // Convert real-time events to notifications
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      const newNotifications = wsNotifications.slice(0, 10).map((event, index) => ({
        id: `${event.timestamp}-${index}`,
        type: event.type === 'agentCreated' ? 'create' as const :
              event.type === 'tokensPurchased' ? 'buy' as const : 'sell' as const,
        user: event.data?.creator?.slice(0, 6) + '...' || 'Unknown',
        amount: event.data?.solAmount ? parseFloat(event.data.solAmount) : undefined,
        agent: event.data?.name || 'Unknown Agent',
        marketCap: event.data?.marketCap ? parseFloat(event.data.marketCap) : undefined,
        timestamp: new Date(event.timestamp)
      }));

      setNotifications(newNotifications);
    }
  }, [wsNotifications]);

  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setScrollPosition(prev => prev - 1);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const formatNotification = (notification: Notification) => {
    switch (notification.type) {
      case 'buy':
        return (
          <span className="whitespace-nowrap">
            <span className="text-black px-2 py-1 rounded mr-2" style={{ backgroundColor: '#d8e9ea' }}>
              🤖 {notification.user} bought {notification.amount} SOL of {notification.agent} 🟡 | mcap: ${(notification.marketCap! / 1000).toFixed(1)}K
            </span>
          </span>
        );
      case 'create':
        return (
          <span className="whitespace-nowrap">
            <span className="text-black px-2 py-1 rounded mr-2" style={{ backgroundColor: '#d8e9ea' }}>
              👤 {notification.user} created {notification.agent}
            </span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
  <div></div>
  );
};

export default NotificationBar;