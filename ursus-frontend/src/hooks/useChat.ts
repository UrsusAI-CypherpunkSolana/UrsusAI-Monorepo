import { useState, useCallback } from 'react';
import { apiService } from '../services/api';

interface AgentChatInfo {
  agentAddress: string;
  agentName: string;
  description?: string;
  instructions?: string;
  totalMessages: number;
  lastActivity?: string;
  isActive: boolean;
  capabilities?: string[];
  model?: string;
}
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  agentAddress?: string;
  agentName?: string;
  model?: string;
  responseTime?: number;
}

interface ChatSession {
  id: string;
  agentAddress: string;
  agentName: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

export const useChat = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const createSession = useCallback((agentAddress: string, agentName: string) => {
    const sessionId = uuidv4();
    const newSession: ChatSession = {
      id: sessionId,
      agentAddress,
      agentName,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    setSessions(prev => [...prev, newSession]);
    setActiveSessionId(sessionId);
    return sessionId;
  }, []);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const closeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
    }
  }, [activeSessionId]);

  const sendMessage = useCallback(async (
    message: string,
    userAddress?: string
  ) => {
    if (!activeSession || !message.trim()) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    // Add user message immediately
    setSessions(prev => prev.map(session => 
      session.id === activeSession.id
        ? {
            ...session,
            messages: [...session.messages, userMessage],
            lastActivity: new Date()
          }
        : session
    ));

    try {
      setLoading(true);
      setError(null);

      const response = await apiService.sendMessage({
        agentAddress: activeSession.agentAddress,
        message: message.trim(),
        userAddress,
        sessionId: activeSession.id
      });

      const agentMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: response.data?.response ||
          ('response' in response ? (response as { response: string }).response : '') || '',
        timestamp: new Date(),
        agentAddress: activeSession.agentAddress,
        agentName: response.data?.agent?.name ||
          ('agent' in response ? (response as { agent: { name?: string } }).agent?.name : '') ||
          activeSession.agentName,
        model: response.data?.agent?.model ||
          ('agent' in response ? (response as { agent: { model?: string } }).agent?.model : ''),
        responseTime: response.data?.metadata?.responseTime ||
          ('metadata' in response ? (response as { metadata: { responseTime?: number } }).metadata?.responseTime : undefined)
      };

      // Add agent response
      setSessions(prev => prev.map(session => 
        session.id === activeSession.id
          ? {
              ...session,
              messages: [...session.messages, agentMessage],
              lastActivity: new Date()
            }
          : session
      ));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      console.error('Error sending message:', err);

      // Add error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        type: 'agent',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        agentAddress: activeSession.agentAddress,
        agentName: activeSession.agentName
      };

      setSessions(prev => prev.map(session => 
        session.id === activeSession.id
          ? {
              ...session,
              messages: [...session.messages, errorMessage],
              lastActivity: new Date()
            }
          : session
      ));
    } finally {
      setLoading(false);
    }
  }, [activeSession]);

  const clearSession = useCallback((sessionId?: string) => {
    const targetSessionId = sessionId || activeSessionId;
    if (!targetSessionId) return;

    setSessions(prev => prev.map(session => 
      session.id === targetSessionId
        ? { ...session, messages: [] }
        : session
    ));
  }, [activeSessionId]);

  const getSessionHistory = useCallback((sessionId: string) => {
    return sessions.find(s => s.id === sessionId)?.messages || [];
  }, [sessions]);

  return {
    sessions,
    activeSession,
    activeSessionId,
    loading,
    error,
    createSession,
    switchSession,
    closeSession,
    sendMessage,
    clearSession,
    getSessionHistory
  };
};

export const useAgentChatInfo = (agentAddress?: string) => {
  const [chatInfo, setChatInfo] = useState<AgentChatInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChatInfo = useCallback(async () => {
    if (!agentAddress) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getAgentChatInfo(agentAddress);
      setChatInfo(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch chat info');
      console.error('Error fetching chat info:', err);
    } finally {
      setLoading(false);
    }
  }, [agentAddress]);

  return {
    chatInfo,
    loading,
    error,
    fetchChatInfo
  };
};
