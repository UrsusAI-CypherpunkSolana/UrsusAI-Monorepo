import React, { useEffect, useState } from 'react';
import { TrendingUp, Zap, Trophy, Target } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface GraduationProgressProps {
  currentReserve: number;
  graduationThreshold: number;
  isGraduated: boolean;
  className?: string;
}

export const GraduationProgress: React.FC<GraduationProgressProps> = ({
  currentReserve,
  graduationThreshold,
  isGraduated,
  className = ''
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Calculate progress percentage
  const progressPercentage = Math.min((currentReserve / graduationThreshold) * 100, 100);
  const remainingToGraduation = Math.max(graduationThreshold - currentReserve, 0);
  
  // Animate progress bar
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [progressPercentage]);

  // Progress bar color based on completion
  const getProgressColor = () => {
    if (isGraduated) return 'from-yellow-400 to-yellow-600';
    if (progressPercentage >= 90) return 'from-orange-400 to-red-500';
    if (progressPercentage >= 70) return 'from-blue-400 to-purple-500';
    if (progressPercentage >= 50) return 'from-green-400 to-blue-500';
    return 'from-gray-400 to-gray-600';
  };

  // Status text and icon
  const getStatusInfo = () => {
    if (isGraduated) {
      return {
        icon: <Trophy className="w-5 h-5 text-yellow-400" />,
        text: 'Graduated to DEX',
        subtext: 'Trading on Uniswap V2',
        color: 'text-yellow-400'
      };
    }
    
    if (progressPercentage >= 95) {
      return {
        icon: <Zap className="w-5 h-5 text-orange-400" />,
        text: 'Almost Graduated!',
        subtext: `${formatNumber(remainingToGraduation.toString())} SOL to go`,
        color: 'text-orange-400'
      };
    }
    
    if (progressPercentage >= 70) {
      return {
        icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
        text: 'Approaching Graduation',
        subtext: `${formatNumber(remainingToGraduation.toString())} SOL remaining`,
        color: 'text-blue-400'
      };
    }
    
    return {
      icon: <Target className="w-5 h-5 text-gray-400" />,
      text: 'Bonding Curve Active',
      subtext: `${formatNumber(remainingToGraduation.toString())} SOL to graduation`,
      color: 'text-gray-400'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusInfo.icon}
          <span className={`font-medium ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-white">
            {formatNumber(currentReserve.toString())} / {formatNumber(graduationThreshold.toString())} SOL
          </div>
          <div className="text-xs text-gray-400">
            {progressPercentage.toFixed(1)}% Complete
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-3">
        <div className="w-full bg-[#2a2a2a] rounded-full h-3 overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${getProgressColor()} transition-all duration-1000 ease-out relative`}
            style={{ width: `${animatedProgress}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        
        {/* Graduation threshold marker */}
        {!isGraduated && (
          <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1">
            <div className="w-2 h-5 bg-yellow-400 rounded-sm" />
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
              <div className="text-xs text-yellow-400 font-medium whitespace-nowrap">
                Graduation
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Text */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {statusInfo.subtext}
        </div>
        
        {isGraduated && (
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Zap className="w-3 h-3" />
            <span>DEX Trading Active</span>
          </div>
        )}
      </div>

      {/* Graduation Benefits (when close to graduation) */}
      {!isGraduated && progressPercentage >= 80 && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
          <div className="text-sm font-medium text-blue-400 mb-1">
            🎉 Graduation Benefits
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div>• Unlimited liquidity on Uniswap V2</div>
            <div>• No bonding curve restrictions</div>
            <div>• Professional DEX trading features</div>
            <div>• Enhanced price discovery</div>
          </div>
        </div>
      )}

      {/* Graduated Status */}
      {isGraduated && (
        <div className="mt-3 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg">
          <div className="text-sm font-medium text-yellow-400 mb-1">
            🏆 Token Graduated Successfully!
          </div>
          <div className="text-xs text-gray-300 space-y-1">
            <div>• Now trading on Uniswap V2</div>
            <div>• Full DEX liquidity available</div>
            <div>• Professional trading features</div>
            <div>• Market-driven price discovery</div>
          </div>
        </div>
      )}
    </div>
  );
};
