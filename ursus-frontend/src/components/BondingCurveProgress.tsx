import React, { useEffect, useState } from 'react';
import { TrendingUp, Zap, Trophy, Target, DollarSign, Users } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface BondingCurveProgressProps {
  currentReserve: number;
  graduationThreshold: number;
  isGraduated: boolean;
  currentPrice?: number;
  marketCap?: number;
  holders?: number;
  className?: string;
  variant?: 'full' | 'compact' | 'mini';
}

export const BondingCurveProgress: React.FC<BondingCurveProgressProps> = ({
  currentReserve,
  graduationThreshold,
  isGraduated,
  currentPrice = 0,
  marketCap = 0,
  holders = 0,
  className = '',
  variant = 'full'
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Calculate progress percentage
  const progressPercentage = Math.min((currentReserve / graduationThreshold) * 100, 100);
  const remainingToGraduation = Math.max(graduationThreshold - currentReserve, 0);

  // Format progress percentage with appropriate precision
  const formatProgress = (progress: number) => {
    if (progress >= 10) return progress.toFixed(1);
    if (progress >= 1) return progress.toFixed(2);
    if (progress >= 0.1) return progress.toFixed(3);
    if (progress >= 0.01) return progress.toFixed(4);
    return progress.toFixed(5);
  };
  
  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [progressPercentage]);

  // Get display width for progress bar (minimum 0.5% for visibility)
  const getDisplayWidth = (progress: number) => {
    if (progress === 0) return 0;
    return Math.max(progress, 0.5);
  };

  // Progress bar color based on completion
  const getProgressColor = () => {
    if (isGraduated) return 'from-yellow-400 via-yellow-500 to-yellow-600';
    if (progressPercentage >= 95) return 'from-orange-400 via-orange-500 to-red-500';
    if (progressPercentage >= 80) return 'from-purple-400 via-purple-500 to-pink-500';
    if (progressPercentage >= 60) return 'from-blue-400 via-blue-500 to-purple-500';
    if (progressPercentage >= 40) return 'from-green-400 via-green-500 to-blue-500';
    if (progressPercentage >= 20) return 'from-cyan-400 via-cyan-500 to-green-500';
    return 'from-gray-400 via-gray-500 to-gray-600';
  };

  // Status text and icon
  const getStatusInfo = () => {
    if (isGraduated) {
      return {
        icon: <Trophy className="w-5 h-5 text-yellow-400" />,
        text: 'Graduated to DEX',
        subtext: 'Trading on Uniswap V2',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10 border-yellow-500/20'
      };
    }
    
    if (progressPercentage >= 95) {
      return {
        icon: <Zap className="w-5 h-5 text-orange-400" />,
        text: 'Almost Graduated!',
        subtext: `${formatNumber(remainingToGraduation)} SOL to go`,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10 border-orange-500/20'
      };
    }

    if (progressPercentage >= 80) {
      return {
        icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
        text: 'Approaching Graduation',
        subtext: `${formatNumber(remainingToGraduation)} SOL remaining`,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10 border-purple-500/20'
      };
    }

    if (progressPercentage >= 40) {
      return {
        icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
        text: 'Growing Strong',
        subtext: `${formatNumber(remainingToGraduation)} SOL to graduation`,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10 border-blue-500/20'
      };
    }

    return {
      icon: <Target className="w-5 h-5 text-gray-400" />,
      text: 'Early Stage',
      subtext: `${formatNumber(remainingToGraduation)} SOL to graduation`,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10 border-gray-500/20'
    };
  };

  const statusInfo = getStatusInfo();

  // Mini variant for cards
  if (variant === 'mini') {
    return (
      <div className={`${className}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#a0a0a0]">Progress</span>
          <span className="text-xs text-[#d8e9ea] font-medium">
            {formatProgress(progressPercentage)}%
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out`}
              style={{ width: `${getDisplayWidth(animatedProgress)}%` }}
            />
          </div>
          {isGraduated && (
            <div className="absolute -top-0.5 right-0 transform translate-x-1/2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full border border-[#1a1a1a]" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 overflow-hidden ${className}`}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex-shrink-0">{statusInfo.icon}</div>
            <span className={`text-sm font-medium truncate ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
          <span className="text-sm text-white font-medium flex-shrink-0 whitespace-nowrap">
            {formatProgress(progressPercentage)}%
          </span>
        </div>

        <div className="relative mb-2">
          <div className="w-full bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out relative`}
              style={{ width: `${getDisplayWidth(animatedProgress)}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            </div>
          </div>
          {isGraduated && (
            <div className="absolute -top-1 right-0 transform translate-x-1/2">
              <div className="w-4 h-4 bg-yellow-400 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center">
                <Trophy className="w-2 h-2 text-[#1a1a1a]" />
              </div>
            </div>
          )}
        </div>

        <div className="text-xs text-[#a0a0a0] truncate">
          {formatNumber(currentReserve)} / {formatNumber(graduationThreshold)} SOL
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex-shrink-0">{statusInfo.icon}</div>
          <span className={`font-medium truncate ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-medium text-white whitespace-nowrap">
            {formatNumber(currentReserve)} / {formatNumber(graduationThreshold)} SOL
          </div>
          <div className="text-xs text-gray-400 whitespace-nowrap">
            {formatProgress(progressPercentage)}% Complete
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-3">
        <div className="w-full bg-[#2a2a2a] rounded-full h-3 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out relative`}
            style={{ width: `${getDisplayWidth(animatedProgress)}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        
        {/* Graduation threshold marker - moves with progress */}
        {!isGraduated && (
          <div
            className="absolute -top-1 transform -translate-x-1/2 transition-all duration-1000 ease-out"
            style={{ left: `${Math.max(Math.min(animatedProgress, 95), 2)}%` }}
          >
            <div className="w-2 h-5 bg-yellow-400 rounded-sm" />
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className="text-xs text-yellow-400 font-medium whitespace-nowrap">
                Graduation
              </div>
            </div>
          </div>
        )}

        {/* Graduated marker */}
        {isGraduated && (
          <div className="absolute -top-1 right-0 transform translate-x-1/2">
            <div className="w-5 h-5 bg-yellow-400 rounded-full border-2 border-[#1a1a1a] flex items-center justify-center">
              <Trophy className="w-3 h-3 text-[#1a1a1a]" />
            </div>
          </div>
        )}
      </div>

      {/* Status Text */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="text-sm text-gray-400 truncate flex-1 min-w-0">
          {statusInfo.subtext}
        </div>

        {isGraduated && (
          <div className="flex items-center gap-1 text-xs text-yellow-400 flex-shrink-0 whitespace-nowrap">
            <Zap className="w-3 h-3" />
            <span>DEX Trading Active</span>
          </div>
        )}
      </div>

      {/* Additional Stats */}
      {(currentPrice > 0 || marketCap > 0 || holders > 0) && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#2a2a2a]">
          {currentPrice > 0 && (
            <div className="text-center overflow-hidden">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-[#d8e9ea]" />
              </div>
              <div className="text-[#d8e9ea] font-bold text-xs truncate px-1">
                {currentPrice.toFixed(12)}
              </div>
              <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Price</div>
            </div>
          )}

          {marketCap > 0 && (
            <div className="text-center overflow-hidden">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-[#d8e9ea]" />
              </div>
              <div className="text-[#d8e9ea] font-bold text-xs truncate px-1">
                {formatNumber(marketCap, { compact: true })}
              </div>
              <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Market Cap</div>
            </div>
          )}

          {holders > 0 && (
            <div className="text-center overflow-hidden">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Users className="w-3 h-3 text-[#d8e9ea]" />
              </div>
              <div className="text-[#d8e9ea] font-bold text-xs truncate px-1">
                {formatNumber(holders, { decimals: 0 })}
              </div>
              <div className="text-[#a0a0a0] text-xs whitespace-nowrap">Holders</div>
            </div>
          )}
        </div>
      )}

      {/* Graduation Benefits (when close to graduation) */}
      {!isGraduated && progressPercentage >= 80 && (
        <div className={`mt-3 p-3 ${statusInfo.bgColor} rounded-lg overflow-hidden`}>
          <div className={`text-sm font-medium ${statusInfo.color} mb-1 truncate`}>
            🎉 Graduation Benefits
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="break-words">• Unlimited liquidity on Uniswap V2</div>
            <div className="break-words">• No bonding curve restrictions</div>
            <div className="break-words">• Professional DEX trading features</div>
            <div className="break-words">• Enhanced price discovery</div>
          </div>
        </div>
      )}

      {/* Graduated Status */}
      {isGraduated && (
        <div className={`mt-3 p-3 ${statusInfo.bgColor} rounded-lg overflow-hidden`}>
          <div className={`text-sm font-medium ${statusInfo.color} mb-1 truncate`}>
            🏆 Token Graduated Successfully!
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div className="break-words">• Now trading on Uniswap V2</div>
            <div className="break-words">• Full DEX liquidity available</div>
            <div className="break-words">• Professional trading features</div>
            <div className="break-words">• Market-driven price discovery</div>
          </div>
        </div>
      )}
    </div>
  );
};
