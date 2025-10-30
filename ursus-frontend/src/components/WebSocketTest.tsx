import React, { useEffect, useState } from 'react';
import websocketService from '../services/websocket';

// Professional WebSocket test interfaces
interface ProfessionalConnectionHealth {
  status: string;
  uptime: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastConnected: Date | null;
  messagesPerSecond: number;
  bytesPerSecond: number;
  averageLatency: number;
}

interface ProfessionalWebSocketError {
  message?: string;
  code?: number;
  type?: string;
  timestamp?: Date;
}

const WebSocketTest: React.FC = () => {
  const [status, setStatus] = useState('Initializing...');
  const [logs, setLogs] = useState<string[]>([]);
  const [connectionHealth, setConnectionHealth] = useState<ProfessionalConnectionHealth | null>(null);
  const [testResults, setTestResults] = useState<{
    connectionTest: boolean | null;
    subscriptionTest: boolean | null;
    messageTest: boolean | null;
    reconnectionTest: boolean | null;
  }>({
    connectionTest: null,
    subscriptionTest: null,
    messageTest: null,
    reconnectionTest: null
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const updateTestResult = (test: keyof typeof testResults, result: boolean) => {
    setTestResults(prev => ({ ...prev, [test]: result }));
    addLog(`🧪 Test ${test}: ${result ? '✅ PASSED' : '❌ FAILED'}`);
  };

  // Professional test functions
  const runConnectionTest = async () => {
    addLog('🧪 Starting professional connection test...');
    try {
      const health = websocketService.getConnectionHealth();
      setConnectionHealth(health);

      if (!websocketService.isConnected()) {
        addLog('🔌 Attempting WebSocket connection...');
        websocketService.connect();
        // Check connection after a delay
        setTimeout(() => {
          if (websocketService.isConnected()) {
            updateTestResult('connectionTest', true);
            setStatus('Connected');
          } else {
            updateTestResult('connectionTest', false);
            setStatus('Failed');
          }
        }, 2000);
      } else {
        addLog('✅ WebSocket already connected');
        updateTestResult('connectionTest', true);
        setStatus('Connected');
      }
    } catch (error) {
      addLog(`❌ Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      updateTestResult('connectionTest', false);
      setStatus('Failed');
    }
  };

  const runSubscriptionTest = () => {
    addLog('🧪 Starting professional subscription test...');
    try {
      websocketService.subscribe('platform');
      addLog('📡 Subscribed to platform channel');

      websocketService.subscribe('agent:test-agent');
      addLog('📡 Subscribed to test agent channel');

      updateTestResult('subscriptionTest', true);
    } catch (error) {
      addLog(`❌ Subscription test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      updateTestResult('subscriptionTest', false);
    }
  };

  const runMessageTest = () => {
    addLog('🧪 Starting professional message test...');
    try {
      websocketService.ping();
      addLog('🏓 Ping message sent');

      // Test price history request
      websocketService.getPriceHistory('test-agent', '1h');
      addLog('📊 Price history request sent');

      updateTestResult('messageTest', true);
    } catch (error) {
      addLog(`❌ Message test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      updateTestResult('messageTest', false);
    }
  };

  const runReconnectionTest = () => {
    addLog('🧪 Starting professional reconnection test...');
    try {
      if (websocketService.isConnected()) {
        addLog('🔄 Testing reconnection capability...');
        websocketService.forceReconnect();
        addLog('🔄 Reconnection initiated');
        updateTestResult('reconnectionTest', true);
      } else {
        addLog('⚠️ Cannot test reconnection - not connected');
        updateTestResult('reconnectionTest', false);
      }
    } catch (error) {
      addLog(`❌ Reconnection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      updateTestResult('reconnectionTest', false);
    }
  };

  const runAllTests = async () => {
    addLog('🚀 Starting comprehensive WebSocket test suite...');
    await runConnectionTest();
    setTimeout(() => runSubscriptionTest(), 1000);
    setTimeout(() => runMessageTest(), 2000);
    setTimeout(() => runReconnectionTest(), 3000);
  };

  useEffect(() => {
    addLog('WebSocket test component mounted');
    
    // Test WebSocket service
    const testWebSocket = () => {
      addLog('Testing WebSocket service...');
      
      // Check if service exists
      if (!websocketService) {
        addLog('❌ WebSocket service not found');
        setStatus('Service not found');
        return;
      }
      
      addLog('✅ WebSocket service found');
      
      // Check connection state
      const isConnected = websocketService.isConnected();
      const connectionState = websocketService.getConnectionState();
      
      addLog(`Connection state: ${connectionState}`);
      addLog(`Is connected: ${isConnected}`);
      
      setStatus(`Status: ${connectionState}`);
      
      // Get connection health
      const health = websocketService.getConnectionHealth();
      setConnectionHealth(health);
      addLog(`Health: ${JSON.stringify(health, null, 2)}`);
      
      // Set up event listeners
      const handleConnected = () => {
        addLog('🟢 WebSocket connected!');
        setStatus('Connected');
      };
      
      const handleDisconnected = () => {
        addLog('🔴 WebSocket disconnected');
        setStatus('Disconnected');
      };
      
      const handleConnecting = () => {
        addLog('🟡 WebSocket connecting...');
        setStatus('Connecting');
      };
      
      const handleError = (error: ProfessionalWebSocketError) => {
        const errorMessage = error?.message || error?.type || 'Unknown error';
        addLog(`❌ Professional WebSocket error: ${errorMessage}`);
        setStatus('Error');
      };
      
      websocketService.on('connected', handleConnected);
      websocketService.on('disconnected', handleDisconnected);
      websocketService.on('connecting', handleConnecting);
      websocketService.on('error', handleError);
      
      // Try to force connection
      addLog('Attempting to force connection...');
      websocketService.forceConnect();
      
      return () => {
        websocketService.off('connected', handleConnected);
        websocketService.off('disconnected', handleDisconnected);
        websocketService.off('connecting', handleConnecting);
        websocketService.off('error', handleError);
      };
    };
    
    const cleanup = testWebSocket();
    
    // Update health periodically
    const healthInterval = setInterval(() => {
      const health = websocketService.getConnectionHealth();
      setConnectionHealth(health);
    }, 2000);
    
    return () => {
      cleanup?.();
      clearInterval(healthInterval);
    };
  }, []);

  const handleManualConnect = () => {
    addLog('Manual connection attempt...');
    websocketService.forceConnect();
  };

  const handleManualReconnect = () => {
    addLog('Manual reconnection attempt...');
    websocketService.reconnect();
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">WebSocket Connection Test</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Panel */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Connection Status</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-mono ${
                status.includes('Connected') ? 'text-green-400' :
                status.includes('Connecting') ? 'text-yellow-400' :
                status.includes('Error') ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {status}
              </span>
            </div>
            
            {connectionHealth && (
              <>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="font-mono">{Math.floor(connectionHealth.uptime / 1000)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Reconnect Attempts:</span>
                  <span className="font-mono">
                    {connectionHealth.reconnectAttempts}/{connectionHealth.maxReconnectAttempts}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Messages/sec:</span>
                  <span className="font-mono">{connectionHealth.messagesPerSecond.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Latency:</span>
                  <span className="font-mono">{connectionHealth.averageLatency.toFixed(0)}ms</span>
                </div>
              </>
            )}
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="space-x-2">
              <button
                onClick={handleManualConnect}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                Force Connect
              </button>
              <button
                onClick={handleManualReconnect}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
              >
                Reconnect
              </button>
            </div>

            {/* Professional Test Suite */}
            <div className="border-t border-gray-700 pt-3">
              <h3 className="text-sm font-semibold mb-2">Professional Test Suite</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={runConnectionTest}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-xs"
                >
                  Connection Test
                </button>
                <button
                  onClick={runSubscriptionTest}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                >
                  Subscription Test
                </button>
                <button
                  onClick={runMessageTest}
                  className="px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded text-xs"
                >
                  Message Test
                </button>
                <button
                  onClick={runReconnectionTest}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-xs"
                >
                  Reconnection Test
                </button>
              </div>
              <button
                onClick={runAllTests}
                className="w-full mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-semibold"
              >
                🚀 Run All Tests
              </button>
            </div>

            {/* Test Results */}
            <div className="border-t border-gray-700 pt-3">
              <h3 className="text-sm font-semibold mb-2">Test Results</h3>
              <div className="space-y-1 text-xs">
                {Object.entries(testResults).map(([test, result]) => (
                  <div key={test} className="flex justify-between">
                    <span className="capitalize">{test.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className={`font-mono ${
                      result === true ? 'text-green-400' :
                      result === false ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {result === true ? '✅ PASSED' : result === false ? '❌ FAILED' : '⏳ PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Logs Panel */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Connection Logs</h2>
          <div className="bg-black p-3 rounded font-mono text-sm h-80 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
          <button
            onClick={() => setLogs([])}
            className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      {/* Raw Health Data */}
      {connectionHealth && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Raw Health Data</h2>
          <pre className="bg-black p-3 rounded text-sm overflow-x-auto">
            {JSON.stringify(connectionHealth, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default WebSocketTest;
