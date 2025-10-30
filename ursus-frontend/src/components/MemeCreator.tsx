import React, { useState, useRef } from 'react';
import { Upload, Zap, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useAgentFactory } from '../hooks/useAgentFactory';
import { useWallet } from '../hooks/useWallet';

interface MemeCreatorProps {
  onSuccess?: (agentAddress: string) => void;
  onCancel?: () => void;
}

const MemeCreator: React.FC<MemeCreatorProps> = ({ onSuccess, onCancel }) => {
  const { isConnected, address } = useWallet();
  const { createAgentToken } = useAgentFactory();
  
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    description: '',
    category: 'Meme'
  });
  
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'preview' | 'deploying' | 'success'>('form');
  const [deployedAddress, setDeployedAddress] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setErrors(prev => ({ ...prev, image: 'Image must be less than 5MB' }));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, image: 'File must be an image' }));
        return;
      }
      
      setImage(file);
      setErrors(prev => ({ ...prev, image: '' }));
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 32) {
      newErrors.name = 'Name must be 32 characters or less';
    }
    
    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    } else if (formData.symbol.length > 10) {
      newErrors.symbol = 'Symbol must be 10 characters or less';
    } else if (!/^[A-Z0-9]+$/.test(formData.symbol.toUpperCase())) {
      newErrors.symbol = 'Symbol must contain only letters and numbers';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }
    
    if (!image) {
      newErrors.image = 'Image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (!isConnected || !address) {
      alert('Please connect your wallet');
      return;
    }
    
    setStep('preview');
  };

  const handleDeploy = async () => {
    if (!image) return;
    
    setStep('deploying');
    
    try {
      // Upload image first
      const imageFormData = new FormData();
      imageFormData.append('image', image);
      imageFormData.append('type', 'agent-avatar');
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: imageFormData
      });
      
      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success) {
        throw new Error('Failed to upload image');
      }
      
      // Create agent
      const agentData = {
        name: formData.name.trim(),
        symbol: formData.symbol.trim().toUpperCase(),
        description: formData.description.trim(),
        category: formData.category,
        instructions: `You are ${formData.name}, a meme token on Solana. ${formData.description}`,
        model: 'gpt-3.5-turbo',
        imageUrl: uploadResult.url
      };
      
      await createAgentToken(agentData, (txHash: string) => {
        console.log('Agent created with tx hash:', txHash);
        setDeployedAddress(txHash); // Use txHash as placeholder
        setStep('success');

        if (onSuccess) {
          onSuccess(txHash);
        }
      });
      
    } catch (error) {
      console.error('Deploy error:', error);
      alert('Failed to deploy meme coin. Please try again.');
      setStep('preview');
    }
  };

  const renderForm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Create Your Meme Coin</h2>
        <p className="text-gray-400">Launch your meme coin on Solana in seconds</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Meme Image *
          </label>
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              imagePreview 
                ? 'border-green-500 bg-green-500/10' 
                : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="space-y-2">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-24 h-24 object-cover rounded-lg mx-auto"
                />
                <p className="text-green-400 text-sm">Image uploaded</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                <p className="text-gray-400">Click to upload image</p>
                <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {errors.image && (
            <p className="text-red-400 text-sm mt-1">{errors.image}</p>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Doge Coin"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            maxLength={32}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        {/* Symbol */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Symbol *
          </label>
          <input
            type="text"
            value={formData.symbol}
            onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
            placeholder="e.g., DOGE"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            maxLength={10}
          />
          {errors.symbol && (
            <p className="text-red-400 text-sm mt-1">{errors.symbol}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your meme coin..."
            rows={3}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
            maxLength={200}
          />
          <div className="flex justify-between items-center mt-1">
            {errors.description && (
              <p className="text-red-400 text-sm">{errors.description}</p>
            )}
            <p className="text-gray-500 text-xs ml-auto">
              {formData.description.length}/200
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!isConnected}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!isConnected ? 'Connect Wallet' : 'Preview & Deploy'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Preview Your Meme Coin</h2>
        <p className="text-gray-400">Review before deploying to Solana</p>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <img 
            src={imagePreview} 
            alt={formData.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
          <div>
            <h3 className="text-xl font-bold text-white">{formData.name}</h3>
            <p className="text-gray-400">${formData.symbol}</p>
          </div>
        </div>
        
        <p className="text-gray-300">{formData.description}</p>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          <div>
            <p className="text-gray-400 text-sm">Initial Price</p>
            <p className="text-white font-medium">~0.000001 SOL</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Supply</p>
            <p className="text-white font-medium">1,000,000,000</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
          <div>
            <p className="text-yellow-500 font-medium">Fair Launch</p>
            <p className="text-gray-300 text-sm">
              No presale, no team allocation. Everyone starts equal when trading begins.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep('form')}
          className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Back to Edit
        </button>
        <button
          onClick={handleDeploy}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Deploy Now (Free)
        </button>
      </div>
    </div>
  );

  const renderDeploying = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto">
        <Loader className="w-16 h-16 text-blue-500 animate-spin" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Deploying Your Meme Coin</h2>
        <p className="text-gray-400">Please wait while we deploy your token to Solana...</p>
      </div>
      <div className="bg-gray-800 rounded-lg p-4">
        <p className="text-gray-300 text-sm">
          This usually takes 30-60 seconds. Do not close this window.
        </p>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Meme Coin Deployed!</h2>
        <p className="text-gray-400">Your token is now live on Solana</p>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-4">
          <img 
            src={imagePreview} 
            alt={formData.name}
            className="w-12 h-12 object-cover rounded-lg"
          />
          <div className="text-left">
            <h3 className="text-lg font-bold text-white">{formData.name}</h3>
            <p className="text-gray-400">${formData.symbol}</p>
          </div>
        </div>
        
        <div className="text-left">
          <p className="text-gray-400 text-sm">Contract Address</p>
          <p className="text-white font-mono text-sm break-all">{deployedAddress}</p>
        </div>
      </div>

      <button
        onClick={() => window.location.href = `/agent/${deployedAddress}`}
        className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg hover:from-green-600 hover:to-blue-700 transition-all"
      >
        View Your Token
      </button>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-gray-900 rounded-lg p-6">
      {step === 'form' && renderForm()}
      {step === 'preview' && renderPreview()}
      {step === 'deploying' && renderDeploying()}
      {step === 'success' && renderSuccess()}
    </div>
  );
};

export default MemeCreator;
