import React, { useMemo } from 'react';
import {
  TrendingUp,
  Target,
  Award,
  BarChart3,
  DollarSign,
  Activity,
  AlertCircle,
  Zap
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';

interface GraduationStatus {
  isGraduated: boolean;
  currentReserve: number;
  graduationThreshold: number;
  progressPercentage: number;
  remainingToGraduation: number;
  marketCap: number;
  currentPrice: number;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
}

interface ProfessionalGraduationAnalyticsProps {
  graduationStatus: GraduationStatus;
  tokenSymbol: string;
  className?: string;
  variant?: 'compact' | 'full';
}

export const ProfessionalGraduationAnalytics: React.FC<ProfessionalGraduationAnalyticsProps> = ({
  graduationStatus,
  tokenSymbol,
  className = '',
  variant = 'full'
}) => {
  // Professional analytics calculations
  const analytics = useMemo(() => {
    const {
      isGraduated,
      currentReserve,
      graduationThreshold,
      progressPercentage,
      marketCap,
      currentPrice
    } = graduationStatus;

    // Calculate graduation metrics
    const reserveRatio = graduationThreshold > 0 ? (currentReserve / graduationThreshold) : 0;
    const graduationVelocity = progressPercentage > 0 ? (progressPercentage / 100) : 0;
    
    // Estimate time to graduation (simplified)
    const estimatedDaysToGraduation = isGraduated ? 0 : 
      progressPercentage > 0 ? Math.ceil((100 - progressPercentage) / Math.max(progressPercentage / 30, 0.1)) : null;

    // Risk assessment
    const riskLevel = isGraduated ? 'low' : 
      progressPercentage > 80 ? 'low' :
      progressPercentage > 50 ? 'medium' : 'high';

    // Performance metrics
    const performanceScore = isGraduated ? 100 : Math.min(progressPercentage + (marketCap > 100000 ? 10 : 0), 100);

    return {
      reserveRatio,
      graduationVelocity,
      estimatedDaysToGraduation,
      riskLevel,
      performanceScore,
      isHealthy: !graduationStatus.error && !graduationStatus.loading,
      liquidityScore: Math.min((currentReserve / 10000) * 100, 100), // Normalized to 10k base
      priceStability: currentPrice > 0 ? 'stable' : 'unknown'
    };
  }, [graduationStatus]);

  const getStatusIcon = () => {
    if (graduationStatus.loading) {
      return <Activity className="w-4 h-4 text-yellow-400 animate-pulse" />;
    }
    if (graduationStatus.error) {
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
    if (graduationStatus.isGraduated) {
      return <Award className="w-4 h-4 text-green-400" />;
    }
    return <Target className="w-4 h-4 text-blue-400" />;
  };

  const getStatusColor = () => {
    if (graduationStatus.loading) return 'text-yellow-400';
    if (graduationStatus.error) return 'text-red-400';
    if (graduationStatus.isGraduated) return 'text-green-400';
    return 'text-blue-400';
  };

  const getStatusText = () => {
    if (graduationStatus.loading) return 'Analyzing...';
    if (graduationStatus.error) return 'Error';
    if (graduationStatus.isGraduated) return 'Graduated';
    return 'Bonding Curve';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-4 ${className}`}>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        {!graduationStatus.isGraduated && !graduationStatus.loading && !graduationStatus.error && (
          <div className="flex items-center space-x-2">
            <div className="w-20 bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(graduationStatus.progressPercentage, 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {graduationStatus.progressPercentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <BarChart3 className="w-5 h-5" />
          <span>Professional Graduation Analytics</span>
        </h3>
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Target className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-gray-400">Progress</span>
          </div>
          <div className="text-lg font-bold text-white">
            {graduationStatus.progressPercentage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            to graduation
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-400">Reserve</span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatNumber(graduationStatus.currentReserve.toString())}
          </div>
          <div className="text-xs text-gray-500">
            SOL tokens
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-gray-400">Performance</span>
          </div>
          <div className={`text-lg font-bold ${getPerformanceColor(analytics.performanceScore)}`}>
            {analytics.performanceScore.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">
            score
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Zap className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">Risk Level</span>
          </div>
          <div className={`text-lg font-bold ${getRiskColor(analytics.riskLevel)}`}>
            {analytics.riskLevel.toUpperCase()}
          </div>
          <div className="text-xs text-gray-500">
            assessment
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {!graduationStatus.isGraduated && (
        <div className="bg-[#2a2a2a] rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Graduation Progress</span>
            <span className="text-sm text-white">
              {formatNumber(graduationStatus.remainingToGraduation.toString())} SOL remaining
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-400 to-green-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(graduationStatus.progressPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0 SOL</span>
            <span>{formatNumber(graduationStatus.graduationThreshold.toString())} SOL</span>
          </div>
        </div>
      )}

      {/* Advanced Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">Market Metrics</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Market Cap:</span>
              <span className="text-white">{formatNumber(graduationStatus.marketCap.toString())} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current Price:</span>
              <span className="text-white">{graduationStatus.currentPrice.toFixed(6)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Liquidity Score:</span>
              <span className="text-white">{analytics.liquidityScore.toFixed(1)}/100</span>
            </div>
          </div>
        </div>

        <div className="bg-[#2a2a2a] rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">Graduation Metrics</div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Reserve Ratio:</span>
              <span className="text-white">{(analytics.reserveRatio * 100).toFixed(1)}%</span>
            </div>
            {analytics.estimatedDaysToGraduation && (
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Days to Graduation:</span>
                <span className="text-white">{analytics.estimatedDaysToGraduation}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Status:</span>
              <span className={graduationStatus.isGraduated ? 'text-green-400' : 'text-blue-400'}>
                {graduationStatus.isGraduated ? 'Graduated to DEX' : 'Bonding Curve Active'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {graduationStatus.error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">Analysis Error</span>
          </div>
          <p className="text-red-300 text-sm">{graduationStatus.error}</p>
        </div>
      )}

      {/* Professional Footer */}
      <div className="pt-3 border-t border-[#2a2a2a] text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Professional Graduation Analysis • {tokenSymbol}</span>
          {graduationStatus.lastUpdate && (
            <span>Updated: {graduationStatus.lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
    </div>
  );
};
