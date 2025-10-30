import React, { useState } from 'react';
import { dispatchToast } from '../utils/toast';

import { ChevronRight, Home, ArrowLeft, Check, Zap, Brain, Clock, Sparkles, Database, Languages, Upload, Coins, TrendingUp, DollarSign, Wallet, AlertCircle } from 'lucide-react';
import StepIndicator from './StepIndicator';
import TemplateCard from './TemplateCard';
import { useWallet } from '../hooks/useWallet';
import { useAgentFactory, AgentCreationParams } from '../hooks/useAgentFactory';
import apiService from '../services/api';

interface AgentCreationProps {
  onBack: () => void;
}

const AgentCreation: React.FC<AgentCreationProps> = ({ onBack }) => {
  // Wallet and contract hooks
  const { isConnected, connectWallet, address } = useWallet();
  const { createAgentToken, creationFee } = useAgentFactory();

  // Form state
  const [currentStep, setCurrentStep] = useState(1);
  const [instructions, setInstructions] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [selectedModel, setSelectedModel] = useState('');
  const [responseTime, setResponseTime] = useState(50);
  const [creativity, setCreativity] = useState(50);
  const [memoryRetention, setMemoryRetention] = useState(true);
  const [multiLanguage, setMultiLanguage] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDescription, setTokenDescription] = useState('');
  const [tokenCategory, setTokenCategory] = useState('');
  const [initialSupply, setInitialSupply] = useState(100000000);
  const [tokenLogo, setTokenLogo] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') as string;
  const backendRoot = apiBase.replace(/\/api$/, '');

  const [deployProgress, setDeployProgress] = useState(0);
  const [isDeploySuccess, setIsDeploySuccess] = useState(false);

  const steps = [
    'Instructions',
    'Model & Settings',
    'Token Configuration',
    'Deploy & Launch'
  ];

  const templates = [
    {
      title: 'DeFi Analyzer',
      icon: '💎',
      description: 'You are a DeFi research assistant that analyzes yield farming opportunities across Solana protocols. Monitor liquidity pools, calculate APY rates, and provide risk assessments for various DeFi strategies.'
    },
    {
      title: 'Content Creator',
      icon: '📝',
      description: 'You are a creative content generator that produces engaging social media posts, blog articles, and marketing copy. Focus on viral content patterns, SEO optimization, and audience engagement strategies.'
    },
    {
      title: 'Trading Bot',
      icon: '⚡',
      description: 'You are a cryptocurrency trading analyst that provides real-time market analysis and trading signals. Use technical indicators, sentiment analysis, and on-chain data to generate actionable trading insights.'
    },
    {
      title: 'Research Assistant',
      icon: '🔬',
      description: 'You are a comprehensive research assistant that analyzes market trends, compiles reports, and provides data-driven insights. Synthesize information from multiple sources and present clear, actionable findings.'
    },
    {
      title: 'Social Media Manager',
      icon: '📱',
      description: 'You are a social media management expert that creates content calendars, analyzes engagement metrics, and optimizes posting strategies across multiple platforms to maximize reach and engagement.'
    },
    {
      title: 'Code Reviewer',
      icon: '⚙️',
      description: 'You are a smart contract auditor and code reviewer that identifies vulnerabilities, suggests optimizations, and ensures best practices in blockchain development. Focus on security and gas efficiency.'
    }
  ];

  const defaultModels = [
    {
      id: 'llama3-8b-8192',
      name: 'Llama 3 8B (Groq)',
      logo: '🦙',
      capabilities: 'Fast, general tasks',
      pricing: 'low',
      performance: 'fast',
      description: 'Groq-hosted Llama 3 8B'
    },
    {
      id: 'llama3-70b-8192',
      name: 'Llama 3 70B (Groq)',
      logo: '🦙',
      capabilities: 'High reasoning',
      pricing: 'higher',
      performance: 'great',
      description: 'Groq-hosted Llama 3 70B'
    },
    {
      id: 'mixtral-8x7b-32768',
      name: 'Mixtral 8x7B (Groq)',
      logo: '🧩',
      capabilities: 'MoE, long context',
      pricing: 'medium',
      performance: 'great',
      description: 'Mixture-of-Experts with 32K context'
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      logo: '✨',
      capabilities: 'Multimodal',
      pricing: 'medium',
      performance: 'good',
      description: 'Google Gemini Pro'
    }
  ];
  const models = defaultModels;

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 2000) {
      setInstructions(value);
      setCharCount(value.length);
    }
  };

  const handleTemplateSelect = (templateDescription: string) => {
    setInstructions(templateDescription);
    setCharCount(templateDescription.length);
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleTokenLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      // Upload to backend and store normalized URL
      const result = await apiService.uploadImage(file);
      const normalizedUrl = result.imageUrl?.startsWith('http')
        ? result.imageUrl
        : `${backendRoot}${result.imageUrl}`;
      setImageUrl(normalizedUrl);
      setTokenLogo(file);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Failed to upload image');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDeploy = async () => {
    // Check wallet connection
    if (!isConnected || !address) {
      try {
        console.log('🔗 Wallet not connected, attempting to connect...');
        await connectWallet();
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check again after connection attempt
        if (!isConnected || !address) {
          throw new Error('Wallet connection failed');
        }
        console.log('✅ Wallet connected successfully:', address);
      } catch (error) {
        console.error('❌ Wallet connection error:', error);
        const errorMessage = `Wallet connection failed. Please:

1. Make sure MetaMask is installed and unlocked
2. Click the MetaMask extension icon
3. Connect this site to your wallet
4. Refresh the page and try again

Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        alert(errorMessage);
        return;
      }
    }

    // Network check removed - Solana wallet adapter handles network automatically

    // Validate form data
    if (!tokenName || !tokenSymbol || !instructions || !selectedModel || !tokenDescription || !tokenCategory) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate token description length
    if (tokenDescription.length < 10) {
      alert('Token description must be at least 10 characters long');
      return;
    }

    if (tokenDescription.length > 1000) {
      alert('Token description must be less than 1000 characters');
      return;
    }

    setIsDeploying(true);
    setDeployProgress(0);

    try {
      // Prepare agent creation parameters
      const agentParams: AgentCreationParams = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription || `AI Agent: ${tokenName}`,
        instructions: instructions,
        model: selectedModel,
        category: tokenCategory || 'General',
        avatar: '🤖',
        imageUrl: imageUrl || undefined,
      };

      setDeployProgress(25);

      // Create agent token on blockchain
      try {
        await createAgentToken(agentParams, async (agentAddressOrTxHash) => {
          console.log('Agent creation result:', agentAddressOrTxHash);
          setDeployProgress(75);

          // Check if it's a tx hash (66 chars) - if so, we need to get the agent address
          const isTxHash = agentAddressOrTxHash.startsWith('0x') && agentAddressOrTxHash.length === 66;

          let finalAgentAddress = agentAddressOrTxHash;

          // If it's a transaction hash, get the agent address from backend
          if (isTxHash) {
            try {
              console.log('🔍 Getting agent address from transaction hash...');
              const { data: addrResp } = await apiService.getAgentAddressFromTransaction(agentAddressOrTxHash);
              if (addrResp?.agentAddress) {
                finalAgentAddress = addrResp.agentAddress;
                console.log('🎯 Got agent address:', finalAgentAddress);
              } else {
                try {
                  const evt = new CustomEvent('ursus:toast', {
                    detail: { type: 'warning', title: 'Awaiting index', message: 'Waiting for agent address indexing...' }
                  });
                  window.dispatchEvent(evt);
                } catch {}
                console.error('❌ Failed to get agent address from backend response');
              }
            } catch (error) {
              console.error('❌ Error getting agent address:', error);
              if (error instanceof Error && error.message === 'TOKEN_NOT_FOUND') {
                dispatchToast({ type: 'error', title: 'Token not found', message: 'Backend has not indexed the agent yet.' });
              } else {
                dispatchToast({ type: 'warning', title: 'Awaiting index', message: 'Waiting for agent address indexing...' });
              }
              // Continue with transaction hash as fallback
            }
          }

          setTimeout(() => {
            setDeployProgress(100);
            setIsDeploySuccess(true);

            // Auto-redirect to agent page after 3 seconds
            setTimeout(() => {
              if (finalAgentAddress.startsWith('0x') && finalAgentAddress.length === 42) {
                // Navigate to the specific agent page
                window.location.href = `/agent/${finalAgentAddress}`;
              } else {
                // Fallback to home page
                onBack();
              }
            }, 3000);
          }, 1000);
        });
        console.log('Agent deployed successfully');
      } catch (txError) {
        console.error('Transaction error:', txError);
        throw new Error(`Transaction failed: ${txError instanceof Error ? txError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Deployment failed:', error);
      alert(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] ml-[200px]">
      <div className="p-8">
        {/* Header Section */}
        <div className="mb-8">
          {/* Back Button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#a0a0a0] hover:text-white mb-6 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Back to Home</span>
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-[#a0a0a0] mb-4">
            <Home size={14} />
            <span>Home</span>
            <ChevronRight size={14} />
            <span className="text-[#d8e9ea]">Agent Creation</span>
          </div>

          {/* Title */}
          <h1 className="text-white text-4xl font-bold mb-3 bg-gradient-to-r from-white to-[#d8e9ea] bg-clip-text text-transparent">
            Create Your AI Agent
          </h1>
          <p className="text-[#e5e5e5] text-lg">
            Deploy an AI agent with its own token in minutes
          </p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={steps} />

        {/* Step 1: Instructions Panel */}
        {currentStep === 1 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-10 shadow-2xl">
              {/* Section Title */}
              <div className="text-center mb-8">
                <h2 className="text-white text-3xl font-semibold mb-3">
                  Describe Your AI Agent
                </h2>
                <p className="text-[#a0a0a0] text-lg">
                  Tell your agent what to do and how to behave
                </p>
              </div>

              {/* Main Text Area */}
              <div className="mb-8">
                <div className="relative">
                  <textarea
                    value={instructions}
                    onChange={handleInstructionsChange}
                    placeholder="Tell your agent what to do. Example: 'You are a DeFi research assistant that analyzes yield farming opportunities across Solana protocols...'"
                    className="w-full h-48 bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-6 text-white placeholder-[#666] resize-none focus:outline-none focus:border-[#d8e9ea] transition-colors text-base leading-relaxed"
                  />

                  {/* Character Counter */}
                  <div className="absolute bottom-4 right-4 text-sm text-[#666]">
                    {charCount}/2000
                  </div>
                </div>
              </div>

              {/* Template Gallery */}
              <div className="mb-8">
                <h3 className="text-white text-xl font-medium mb-6 text-center">
                  Quick Start Templates
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map((template, index) => (
                    <TemplateCard
                      key={index}
                      title={template.title}
                      description={template.description}
                      icon={template.icon}
                      onSelect={handleTemplateSelect}
                    />
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-6 border-t border-[#2a2a2a]">
                <button
                  onClick={handleNext}
                  disabled={!instructions.trim()}
                  className="bg-[#d8e9ea] text-black px-8 py-3 rounded-xl font-semibold hover:bg-[#b8d4d6] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl hover:shadow-[#d8e9ea]/25"
                >
                  Next: Model Selection
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Model & Settings Panel */}
        {currentStep === 2 && (
          <div className="max-w-5xl mx-auto">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-10 shadow-2xl">
              {/* Section Title */}
              <div className="text-center mb-10">
                <h2 className="text-white text-3xl font-semibold mb-3">
                  Choose AI Model & Configure Settings
                </h2>
                <p className="text-[#a0a0a0] text-lg">
                  Select the AI engine and customize your agent's behavior
                </p>
              </div>

              {/* AI Model Selection */}
              <div className="mb-12">
                <h3 className="text-white text-xl font-medium mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                    <Brain size={20} className="text-black" />
                  </div>
                  AI Model Selection
                </h3>

                <div className="grid grid-cols-2 gap-6">
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`group relative p-6 bg-[#0a0a0a] border-2 rounded-xl text-left transition-all duration-300 hover:shadow-lg hover:shadow-[#d8e9ea]/10 ${
                        selectedModel === model.id
                          ? 'border-[#d8e9ea] bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]'
                          : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                      }`}
                    >
                      {/* Selection Indicator */}
                      <div className={`absolute top-4 right-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedModel === model.id
                          ? 'border-[#d8e9ea] bg-[#d8e9ea]'
                          : 'border-[#666]'
                      }`}>
                        {selectedModel === model.id && (
                          <Check size={14} className="text-black animate-in fade-in duration-200" />
                        )}
                      </div>

                      {/* Model Info */}
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#d8e9ea] to-[#b8d4d6] rounded-xl flex items-center justify-center text-xl shadow-lg">
                          {model.logo}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-lg font-semibold mb-1 transition-colors ${
                            selectedModel === model.id ? 'text-[#d8e9ea]' : 'text-white'
                          }`}>
                            {model.name}
                          </h4>
                          <p className="text-[#a0a0a0] text-sm">
                            {model.description}
                          </p>
                        </div>
                      </div>

                      {/* Capabilities */}
                      <div className="mb-4">
                        <div className="text-[#e5e5e5] text-sm mb-2">
                          <strong>Capabilities:</strong> {model.capabilities}
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#10b981]">{model.pricing}</span>
                          <span className="text-[#d8e9ea]">Performance: {model.performance}</span>
                        </div>
                      </div>

                      {/* Hover Effect */}
                      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#d8e9ea]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl pointer-events-none" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Settings */}
              <div className="mb-8">
                <h3 className="text-white text-xl font-medium mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                    <Zap size={20} className="text-black" />
                  </div>
                  Agent Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Response Time Slider */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-[#d8e9ea]" />
                        <span className="text-white font-medium">Response Time</span>
                      </div>
                      <span className="text-[#a0a0a0] text-sm">
                        {responseTime < 30 ? 'Fast' : responseTime < 70 ? 'Balanced' : 'Thoughtful'}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={responseTime}
                        onChange={(e) => setResponseTime(Number(e.target.value))}
                        className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #d8e9ea 0%, #d8e9ea ${responseTime}%, #2a2a2a ${responseTime}%, #2a2a2a 100%)`
                        }}
                      />
                    </div>
                  </div>

                  {/* Creativity Level Slider */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={18} className="text-[#d8e9ea]" />
                        <span className="text-white font-medium">Creativity Level</span>
                      </div>
                      <span className="text-[#a0a0a0] text-sm">
                        {creativity < 30 ? 'Precise' : creativity < 70 ? 'Balanced' : 'Creative'}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={creativity}
                        onChange={(e) => setCreativity(Number(e.target.value))}
                        className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #d8e9ea 0%, #d8e9ea ${creativity}%, #2a2a2a ${creativity}%, #2a2a2a 100%)`
                        }}
                      />
                    </div>
                  </div>

                  {/* Memory Retention Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                        <Database size={16} className="text-black" />
                      </div>
                      <div>
                        <span className="text-white font-medium">Memory Retention</span>
                        <p className="text-[#a0a0a0] text-sm">Remember conversation context</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMemoryRetention(!memoryRetention)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        memoryRetention ? 'bg-[#d8e9ea]' : 'bg-[#2a2a2a]'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                        memoryRetention ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* Multi-language Support Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                        <Languages size={16} className="text-black" />
                      </div>
                      <div>
                        <span className="text-white font-medium">Multi-language Support</span>
                        <p className="text-[#a0a0a0] text-sm">Respond in multiple languages</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMultiLanguage(!multiLanguage)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        multiLanguage ? 'bg-[#d8e9ea]' : 'bg-[#2a2a2a]'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                        multiLanguage ? 'translate-x-7' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-6 border-t border-[#2a2a2a]">
                <button
                  onClick={handlePrevious}
                  className="bg-[#2a2a2a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3a3a3a] transition-all duration-200 flex items-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!selectedModel}
                  className="bg-[#d8e9ea] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#b8d4d6] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl hover:shadow-[#d8e9ea]/25"
                >
                  Next: Token Configuration
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Token Configuration Panel */}
        {currentStep === 3 && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-10 shadow-2xl">
              {/* Section Title */}
              <div className="text-center mb-10">
                <h2 className="text-white text-3xl font-semibold mb-3">
                  Configure Your Token
                </h2>
                <p className="text-[#a0a0a0] text-lg">
                  Set up your agent's token economics and branding
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Token Details */}
                <div className="space-y-6">
                  <h3 className="text-white text-xl font-medium mb-6 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                      <Coins size={20} className="text-black" />
                    </div>
                    Token Details
                  </h3>

                  {/* Token Name Input */}
                  <div className="space-y-2">
                    <label className="text-white font-medium">Token Name</label>
                    <input
                      type="text"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      placeholder="Enter token name (e.g., DeFi Analyzer Token)"
                      className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors"
                    />
                  </div>

                  {/* Token Symbol Input */}
                  <div className="space-y-2">
                    <label className="text-white font-medium">Token Symbol</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={tokenSymbol}
                        onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                        placeholder="DAT"
                        maxLength={5}
                        className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 text-white placeholder-[#666] focus:outline-none focus:border-[#d8e9ea] transition-colors uppercase"
                      />
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#666] text-sm">
                        Auto-generated
                      </div>
                    </div>
                  </div>

                  {/* Token Description */}
                  <div className="space-y-2">
                    <label className="text-white font-medium">Token Description</label>
                    <div className="relative">
                      <textarea
                        value={tokenDescription}
                        onChange={(e) => setTokenDescription(e.target.value)}
                        placeholder="Describe your AI agent and its capabilities..."
                        rows={3}
                        maxLength={1000}
                        className={`w-full bg-[#0a0a0a] border-2 rounded-xl p-4 text-white placeholder-[#666] focus:outline-none transition-colors resize-none ${
                          tokenDescription.length < 10
                            ? 'border-red-500 focus:border-red-400'
                            : tokenDescription.length > 950
                            ? 'border-yellow-500 focus:border-yellow-400'
                            : 'border-[#2a2a2a] focus:border-[#d8e9ea]'
                        }`}
                      />

                      {/* Character Counter */}
                      <div className="absolute bottom-2 right-3 text-xs">
                        <span className={`${
                          tokenDescription.length < 10
                            ? 'text-red-400'
                            : tokenDescription.length > 950
                            ? 'text-yellow-400'
                            : 'text-[#666]'
                        }`}>
                          {tokenDescription.length}/1000
                        </span>
                      </div>
                    </div>

                    {/* Validation Messages */}
                    {tokenDescription.length > 0 && tokenDescription.length < 10 && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <span>⚠️</span>
                        Minimum 10 characters required ({10 - tokenDescription.length} more needed)
                      </p>
                    )}
                    {tokenDescription.length > 950 && (
                      <p className="text-yellow-400 text-xs flex items-center gap-1">
                        <span>⚠️</span>
                        Approaching character limit ({1000 - tokenDescription.length} characters remaining)
                      </p>
                    )}
                  </div>

                  {/* Token Category */}
                  <div className="space-y-2">
                    <label className="text-white font-medium">Category</label>
                    <select
                      value={tokenCategory}
                      onChange={(e) => setTokenCategory(e.target.value)}
                      className="w-full bg-[#0a0a0a] border-2 border-[#2a2a2a] rounded-xl p-4 text-white focus:outline-none focus:border-[#d8e9ea] transition-colors"
                    >
                      <option value="">Select a category</option>
                      <option value="DeFi">DeFi</option>
                      <option value="Trading">Trading</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Social">Social</option>
                      <option value="Utility">Utility</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Education">Education</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  {/* Initial Supply Slider */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-white font-medium">Initial Supply</label>
                      <span className="text-[#a0a0a0] text-sm">
                        {initialSupply.toLocaleString()} tokens
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="1000000"
                        max="1000000000"
                        step="1000000"
                        value={initialSupply}
                        onChange={(e) => setInitialSupply(Number(e.target.value))}
                        className="w-full h-2 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, #d8e9ea 0%, #d8e9ea ${((initialSupply - 1000000) / (1000000000 - 1000000)) * 100}%, #2a2a2a ${((initialSupply - 1000000) / (1000000000 - 1000000)) * 100}%, #2a2a2a 100%)`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[#666]">
                      <span>1M</span>
                      <span>100M</span>
                      <span>1B</span>
                    </div>
                  </div>

                  {/* Token Logo Upload */}
                  <div className="space-y-2">
                    <label className="text-white font-medium">Token Logo</label>
                    <div className="border-2 border-dashed border-[#2a2a2a] rounded-xl p-8 text-center hover:border-[#d8e9ea] transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleTokenLogoChange}
                        className="hidden"
                        id="token-logo-upload"
                      />
                      <label htmlFor="token-logo-upload" className="cursor-pointer">
                        <Upload size={32} className="text-[#666] mx-auto mb-3" />
                        <p className="text-[#a0a0a0] mb-2">
                          {tokenLogo ? tokenLogo.name : 'Click to upload logo'}
                        </p>
                        <p className="text-[#666] text-sm">PNG, JPG up to 2MB</p>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Right Column - Economics */}
                <div className="space-y-6">
                  <h3 className="text-white text-xl font-medium mb-6 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                      <TrendingUp size={20} className="text-black" />
                    </div>
                    Token Economics
                  </h3>

                  {/* Bonding Curve Visualization */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Bonding Curve</h4>
                    <div className="h-32 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-lg border border-[#2a2a2a] relative overflow-hidden">
                      {/* Curve visualization */}
                      <div className="absolute inset-0 flex items-end">
                        <div className="w-full h-full bg-gradient-to-t from-[#d8e9ea]/20 to-transparent rounded-lg"></div>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6]"></div>
                    </div>
                    <p className="text-[#a0a0a0] text-sm mt-2">
                      Price increases with each token purchase
                    </p>
                  </div>

                  {/* Initial Price Calculation */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Initial Price</h4>
                    <div className="text-2xl font-bold text-[#d8e9ea] mb-2">
                      ~0.000028 SOL
                    </div>
                    <p className="text-[#a0a0a0] text-sm">
                      Starting price per token
                    </p>
                  </div>

                  {/* Market Cap Estimation */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Market Cap</h4>
                    <div className="text-2xl font-bold text-[#d8e9ea] mb-2">
                      ${(initialSupply * 0.001).toLocaleString()}
                    </div>
                    <p className="text-[#a0a0a0] text-sm">
                      Estimated initial market cap
                    </p>
                  </div>

                  {/* Trading Fee Structure */}
                  <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Trading Fee Structure</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[#a0a0a0]">Platform Fee</span>
                        <span className="text-[#d8e9ea]">2.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#a0a0a0]">Creator Royalty</span>
                        <span className="text-[#d8e9ea]">5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#a0a0a0]">Liquidity Pool</span>
                        <span className="text-[#d8e9ea]">92.5%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-6 border-t border-[#2a2a2a] mt-8">
                <button
                  onClick={handlePrevious}
                  className="bg-[#2a2a2a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3a3a3a] transition-all duration-200 flex items-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!tokenName.trim() || !tokenSymbol.trim() || !tokenDescription.trim() || !tokenCategory}
                  className="bg-[#d8e9ea] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#b8d4d6] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl hover:shadow-[#d8e9ea]/25"
                >
                  Next: Deploy & Launch
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Deploy & Launch Panel */}
        {currentStep === 4 && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-10 shadow-2xl">
              {/* Section Title */}
              <div className="text-center mb-10">
                <h2 className="text-white text-3xl font-semibold mb-3">
                  Deploy & Launch
                </h2>
                <p className="text-[#a0a0a0] text-lg">
                  Review costs and deploy your AI agent with token
                </p>
              </div>

              {/* Cost Breakdown */}
              <div className="mb-8">
                <h3 className="text-white text-xl font-medium mb-6 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-[#d8e9ea] to-[#b8d4d6] rounded-lg">
                    <DollarSign size={20} className="text-black" />
                  </div>
                  Cost Breakdown
                </h3>

                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#a0a0a0]">Agent Deployment</span>
                    <span className="text-[#10b981] font-medium">Free</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#a0a0a0]">Platform Fee</span>
                    <span className="text-[#d8e9ea] font-medium">{creationFee} SOL</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#a0a0a0]">Transaction Fee</span>
                    <span className="text-[#d8e9ea] font-medium">~0.00001 SOL</span>
                  </div>
                  <div className="border-t border-[#2a2a2a] pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-semibold text-lg">Total Cost</span>
                      <span className="text-[#d8e9ea] font-bold text-lg">{creationFee} SOL</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Summary */}
              <div className="mb-8">
                <h3 className="text-white text-xl font-medium mb-6">Agent Summary</h3>
                <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[#a0a0a0] text-sm">Agent Type</span>
                      <p className="text-white font-medium">{instructions.substring(0, 50)}...</p>
                    </div>
                    <div>
                      <span className="text-[#a0a0a0] text-sm">AI Model</span>
                      <p className="text-white font-medium">{models.find(m => m.id === selectedModel)?.name || 'Not selected'}</p>
                    </div>
                    <div>
                      <span className="text-[#a0a0a0] text-sm">Token Name</span>
                      <p className="text-white font-medium">{tokenName || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-[#a0a0a0] text-sm">Token Symbol</span>
                      <p className="text-white font-medium">{tokenSymbol || 'Not set'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallet Status */}
              {!isConnected && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertCircle size={16} />
                    <span className="text-sm">Please connect your wallet to deploy</span>
                  </div>
                </div>
              )}

              {/* Network warning removed - Solana wallet adapter handles network */}

              {/* Deploy Button */}
              <div className="space-y-4">
                {!isDeploySuccess ? (
                  <button
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="w-full h-[60px] bg-[#d8e9ea] text-black font-bold text-lg rounded-xl hover:bg-[#b8d4d6] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-[#d8e9ea]/25 flex items-center justify-center gap-3"
                  >
                    {isDeploying ? (
                      <>
                        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        Deploying... {deployProgress}%
                      </>
                    ) : !isConnected ? (
                      <>
                        <Wallet size={20} />
                        Connect Wallet to Deploy
                      </>
                    ) : (
                      <>
                        <Zap size={20} />
                        Deploy Agent & Launch Token
                      </>
                    )}
                  </button>
                ) : (
                  <div className="w-full h-[60px] bg-[#10b981] text-white font-bold text-lg rounded-xl flex items-center justify-center gap-3">
                    <Check size={20} />
                    Deployment Successful!
                  </div>
                )}

                {/* Progress Bar */}
                {isDeploying && (
                  <div className="w-full bg-[#2a2a2a] rounded-full h-2">
                    <div
                      className="bg-[#d8e9ea] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${deployProgress}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between pt-6 border-t border-[#2a2a2a] mt-8">
                <button
                  onClick={handlePrevious}
                  className="bg-[#2a2a2a] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3a3a3a] transition-all duration-200 flex items-center gap-2"
                >
                  <ArrowLeft size={18} />
                  Previous
                </button>
                {isDeploySuccess && (
                  <button
                    onClick={onBack}
                    className="bg-[#d8e9ea] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#b8d4d6] transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl hover:shadow-[#d8e9ea]/25"
                  >
                    Back to Home
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCreation;
