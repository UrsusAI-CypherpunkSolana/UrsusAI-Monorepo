import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, AlertCircle } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useAgentInteractions } from '../hooks/useWebSocket';
import { apiService } from '../services/api';
import websocketService from '../services/websocket';

// UUID fallback (SES/lockdown ortamlarında çalışır)
// UUID fallback (SES/lockdown ortamlarında çalışır)
const genUUID = (): string => {
  const w: any = typeof window !== 'undefined' ? window : {};
  const g = w.crypto?.getRandomValues?.bind(w.crypto);
  const bytes: Uint8Array = g
    ? g(new Uint8Array(16))
    : new Uint8Array(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
  
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  
  const hex = Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

interface ChatMessage {
  id: string;
  type: 'user' | 'agent';
  message: string;
  timestamp: number;
  isLoading?: boolean;
  error?: string;
}

interface ChatHistoryMessage {
  _id: string;
  message: string;
  response: string;
  timestamp: string;
}

interface ChatHistoryResponse {
  success: boolean;
  messages: ChatHistoryMessage[];
  error?: string;
}

interface ChatSendResponse {
  success: boolean;
  response: string;
  error?: string;
}

interface AgentChatProps {
  agentAddress: string;
  agentName: string;
  agentInstructions?: string;
  isOpen: boolean;
  onClose: () => void;
}

const AgentChat: React.FC<AgentChatProps> = ({
  agentAddress,
  agentName,
  agentInstructions,
  isOpen,
  onClose
}) => {
  const { address: userAddress } = useWallet();
  const { latestInteraction } = useAgentInteractions(agentAddress);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(genUUID);
 const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [isTyping, setIsTyping] = useState(false);
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // WebSocket connection management
  useEffect(() => {
    const handleConnectionChange = () => {
      const isConnected = websocketService.isConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    };

    // Set up WebSocket event listeners
    websocketService.on('connected', () => setConnectionStatus('connected'));
    websocketService.on('disconnected', () => setConnectionStatus('disconnected'));
    websocketService.on('connecting', () => setConnectionStatus('connecting'));

    // Initial connection status
    handleConnectionChange();

    return () => {
      websocketService.off('connected', () => setConnectionStatus('connected'));
      websocketService.off('disconnected', () => setConnectionStatus('disconnected'));
      websocketService.off('connecting', () => setConnectionStatus('connecting'));
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle real-time interactions
  useEffect(() => {
    if (latestInteraction && latestInteraction.agentAddress === agentAddress) {
      const newMessage: ChatMessage = {
        id: `${latestInteraction.timestamp}-agent`,
        type: 'agent',
        message: latestInteraction.response || 'No response received',
        timestamp: new Date(latestInteraction.timestamp).getTime()
      };

      setMessages(prev => {
        // Check if message already exists
        const exists = prev.some(msg => msg.id === newMessage.id);
        if (exists) return prev;

        return [...prev, newMessage];
      });

      setIsLoading(false);
    }
  }, [latestInteraction, agentAddress]);

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await apiService.get(`/chat/history/${agentAddress}`, {
        params: { userAddress: userAddress || '', limit: 50 }
      });

      const data = response.data as ChatHistoryResponse;

      if (data.success) {
        const historyMessages: ChatMessage[] = [];

        data.messages.forEach((msg: ChatHistoryMessage) => {
          // Add user message
          historyMessages.push({
            id: `${msg._id}-user`,
            type: 'user',
            message: msg.message,
            timestamp: new Date(msg.timestamp).getTime()
          });

          // Add agent response
          historyMessages.push({
            id: `${msg._id}-agent`,
            type: 'agent',
            message: msg.response,
            timestamp: new Date(msg.timestamp).getTime() + 1000 // Slightly later
          });
        });

        setMessages(historyMessages);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }, [agentAddress, userAddress]);

  // Load chat history on mount
  useEffect(() => {
    if (isOpen && agentAddress) {
      loadChatHistory();
    }
  }, [isOpen, agentAddress, loadChatHistory]);

  // Enhanced message sending with real-time features
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();

    // Add to message history for navigation
    setMessageHistory(prev => {
      const newHistory = [messageText, ...prev.filter(msg => msg !== messageText)];
      return newHistory.slice(0, 50); // Keep last 50 messages
    });
    setHistoryIndex(-1);

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      type: 'user',
      message: messageText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Send via WebSocket if connected, otherwise fallback to API
      if (connectionStatus === 'connected') {
        websocketService.send({
          type: 'agentMessage',
          agentAddress,
          userAddress,
          message: messageText,
          sessionId,
          timestamp: Date.now()
        });

        // Wait for response via WebSocket (handled in useEffect)
        setTimeout(() => {
          setIsTyping(false);
        }, 3000);
      } else {
        // Fallback to API
        const response = await apiService.post('/chat', {
          agentAddress,
          message: messageText,
          userAddress,
          sessionId
        });

        const data = response.data as ChatSendResponse;

        if (data.success) {
          // Add agent response directly
          const agentMessage: ChatMessage = {
            id: `${Date.now()}-agent`,
            type: 'agent',
            message: data.response,
            timestamp: Date.now()
          };

          setMessages(prev => [...prev, agentMessage]);
        } else {
          throw new Error(data.error || 'Failed to send message');
        }
      }
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  }, [inputMessage, isLoading, agentAddress, userAddress, sessionId, connectionStatus]);

  // Enhanced keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === 'ArrowUp' && inputMessage === '') {
      e.preventDefault();
      if (historyIndex < messageHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInputMessage(messageHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputMessage(messageHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputMessage('');
      }
    } else if (e.key === 'Escape') {
      setInputMessage('');
      setHistoryIndex(-1);
    }
  }, [sendMessage, inputMessage, historyIndex, messageHistory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 w-full max-w-2xl h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">{agentName}</h3>
              <div className="flex items-center space-x-2">
                <p className="text-gray-400 text-sm">AI Agent Chat</p>
               {/* 
<div className={`flex items-center space-x-1 text-xs ${
  connectionStatus === 'connected'
    ? 'text-green-400'
    : connectionStatus === 'connecting'
    ? 'text-yellow-400'
    : 'text-red-400'
}`}>
  {connectionStatus === 'connected' ? (
    <Wifi className="w-3 h-3" />
  ) : (
    <WifiOff className="w-3 h-3" />
  )}
  <span className="capitalize">{connectionStatus}</span>
</div> 
*/}

              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {agentInstructions && messages.length === 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-400 text-sm">{agentInstructions}</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <div className="flex items-start space-x-2">
                  {message.type === 'agent' && (
                    <Bot className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
                  )}
                  {message.type === 'user' && (
                    <User className="w-4 h-4 mt-0.5 text-white flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    {message.error && (
                      <p className="text-red-400 text-xs mt-1">{message.error}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(isLoading || isTyping) && (
            <div className="flex justify-start">
              <div className="bg-gray-800 rounded-lg p-3 max-w-[80%]">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-blue-400" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-gray-400 text-sm">
                    {connectionStatus === 'connected' ? 'Agent is typing...' : 'Agent is thinking...'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentChat;