import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider } from '@coral-xyz/anchor';
import { X402Service } from '../services/x402Service';
import type { X402Config } from '../types/x402';

// USDC has 6 decimals
const USDC_DECIMALS = 1_000_000;

interface X402PaymentPanelProps {
  agentAddress: string;
  agentName: string;
}

export const X402PaymentPanel: React.FC<X402PaymentPanelProps> = ({ 
  agentAddress, 
  agentName 
}) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const [x402Config, setX402Config] = useState<X402Config | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [serviceResult, setServiceResult] = useState<any>(null);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('0.01');
  const [serviceId, setServiceId] = useState('market_analysis');
  
  // Config form state
  const [configEnabled, setConfigEnabled] = useState(true);
  const [minPayment, setMinPayment] = useState('0.001');
  const [maxPayment, setMaxPayment] = useState('1.0');
  const [timeout, setTimeout] = useState('3600');

  const x402Service = new X402Service(connection, 'TESTNET');

  useEffect(() => {
    loadX402Config();
  }, [agentAddress]);

  const loadX402Config = async () => {
    try {
      const config = await x402Service.getX402Config(agentAddress);
      setX402Config(config);
    } catch (err) {
      console.error('Error loading X402 config:', err);
    }
  };

  const handleConfigureX402 = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTxSignature(null);

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: 'confirmed' }
      );

      const signature = await x402Service.configureX402({
        agentAddress,
        enabled: configEnabled,
        minPaymentAmount: parseFloat(minPayment) * USDC_DECIMALS,
        maxPaymentAmount: parseFloat(maxPayment) * USDC_DECIMALS,
        serviceTimeoutSeconds: parseInt(timeout),
      }, provider);

      setTxSignature(signature);
      setSuccess('X402 configured successfully!');
      await loadX402Config();
    } catch (err: any) {
      setError(err.message || 'Failed to configure X402');
      console.error('Configure X402 error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayForService = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    if (!x402Config?.enabled) {
      setError('X402 is not enabled for this agent');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setTxSignature(null);
    setServiceResult(null);

    try {
      const provider = new AnchorProvider(
        connection,
        wallet as any,
        { commitment: 'confirmed' }
      );

      const amountLamports = parseFloat(paymentAmount) * USDC_DECIMALS;

      // Step 1: Make payment
      const signature = await x402Service.payForService({
        agentAddress,
        amount: amountLamports,
        serviceId,
      }, provider);

      setTxSignature(signature);
      setSuccess('Payment sent! Fetching service result...');

      // Step 2: Call backend to get service result
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/agents/${agentAddress}/x402/service`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId,
          paymentSignature: signature,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch service result');
      }

      const response_data = await response.json();
      console.log('📥 Received response from backend:', response_data);

      // Backend wraps response in {success, data, timestamp, requestId}
      const result = response_data.data || response_data;
      console.log('📥 Extracted service result:', result);

      setServiceResult(result);
      console.log('✅ Service result set to state');
      setSuccess('Service completed successfully!');

      await loadX402Config();
    } catch (err: any) {
      setError(err.message || 'Payment failed');
      console.error('Payment error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-6">
      <div className="border-b border-gray-700 pb-4">
        <h2 className="text-2xl font-bold text-white">X402 Payment Protocol</h2>
        <p className="text-gray-400 mt-1">Pay for AI agent services on-chain</p>
      </div>

      {/* X402 Status */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Status</h3>
        {x402Config ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Enabled:</span>
              <span className={x402Config.enabled ? 'text-green-400' : 'text-red-400'}>
                {x402Config.enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min Payment:</span>
              <span className="text-white">
                {(x402Config.minPaymentAmount / USDC_DECIMALS).toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Payment:</span>
              <span className="text-white">
                {(x402Config.maxPaymentAmount / USDC_DECIMALS).toFixed(4)} USDC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Payments:</span>
              <span className="text-white">{x402Config.totalPaymentsReceived}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Service Calls:</span>
              <span className="text-white">{x402Config.totalServiceCalls}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Not configured yet</p>
        )}
      </div>

      {/* Configure X402 */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Configure X402</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={configEnabled}
              onChange={(e) => setConfigEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label className="text-white text-sm">Enable X402 Payments</label>
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Min Payment (USDC)</label>
            <input
              type="number"
              step="0.001"
              value={minPayment}
              onChange={(e) => setMinPayment(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm block mb-1">Max Payment (USDC)</label>
            <input
              type="number"
              step="0.1"
              value={maxPayment}
              onChange={(e) => setMaxPayment(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Timeout (seconds)</label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm"
            />
          </div>
          
          <button
            onClick={handleConfigureX402}
            disabled={loading || !wallet.connected}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
          >
            {loading ? 'Configuring...' : 'Configure X402'}
          </button>
        </div>
      </div>

      {/* Pay for Service */}
      <div className="bg-gray-900 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3">Pay for Service</h3>
        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-sm block mb-1">Service ID</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm"
            >
              <option value="market_analysis">Market Analysis</option>
              <option value="trading_signal">Trading Signal</option>
              <option value="portfolio_advice">Portfolio Advice</option>
              <option value="risk_assessment">Risk Assessment</option>
              <option value="custom_query">Custom Query</option>
            </select>
          </div>
          
          <div>
            <label className="text-gray-400 text-sm block mb-1">Payment Amount (USDC)</label>
            <input
              type="number"
              step="0.001"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm"
            />
          </div>
          
          <button
            onClick={handlePayForService}
            disabled={loading || !wallet.connected || !x402Config?.enabled}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition"
          >
            {loading ? 'Processing...' : 'Pay for Service'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 rounded p-3 text-sm">
          {error}
        </div>
      )}
      
      {success && txSignature && (
        <div className="bg-green-900/50 border border-green-500 text-green-200 rounded p-3 text-sm">
          <div className="flex flex-col gap-2">
            <div className="font-semibold">✅ {success}</div>
            <div className="text-xs break-all">
              <span className="text-gray-400">Signature: </span>
              <span className="font-mono">{txSignature}</span>
            </div>
            <div className="flex gap-3">
              <a
                href={`https://solscan.io/tx/${txSignature}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 underline text-xs"
              >
                View on Solscan →
              </a>
              <a
                href={`https://explorer.solana.com/tx/${txSignature}?cluster=testnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 underline text-xs"
              >
                View on Solana Explorer →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Service Result */}
      {serviceResult && (
        <div className="bg-blue-900/50 border border-blue-500 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-200 mb-3">
            📊 Service Result: {serviceResult.service_id}
          </h3>
          <div className="bg-gray-900 rounded p-4 text-sm">
            <div className="text-gray-300 whitespace-pre-wrap font-mono">
              {typeof serviceResult.result === 'string'
                ? serviceResult.result
                : JSON.stringify(serviceResult.result, null, 2)}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Agent: {serviceResult.agent_name} • {new Date(serviceResult.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {!wallet.connected && (
        <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-200 rounded p-3 text-sm">
          Please connect your wallet to use X402 payments
        </div>
      )}
    </div>
  );
};

