import React from 'react';

interface MiniChartProps {
  data: number[];
  priceChange: number;
  width?: number;
  height?: number;
}

const MiniChart: React.FC<MiniChartProps> = ({ 
  data, 
  priceChange, 
  width = 80, 
  height = 40 
}) => {
  if (!data || data.length < 2) {
    return (
      <div 
        className="flex items-center justify-center bg-[#2a2a2a] rounded-md"
        style={{ width, height }}
      >
        <div className="text-[#666] text-xs">No data</div>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  // Generate path for the line chart
  const pathData = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - 8);
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return `${index === 0 ? 'M' : 'L'} ${x + 4} ${y}`;
  }).join(' ');

  const isPositive = priceChange >= 0;
  const strokeColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <div className="relative">
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${data[0]}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Fill area under line */}
        <path
          d={`${pathData} L ${width - 4} ${height - 4} L 4 ${height - 4} Z`}
          fill={`url(#gradient-${data[0]})`}
          strokeWidth="0"
        />
        
        {/* Main line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="drop-shadow-sm"
        />
        
        {/* End point dot */}
        <circle
          cx={width - 4}
          cy={height - 4 - ((data[data.length - 1] - min) / range) * (height - 8)}
          r="2"
          fill={strokeColor}
          className="drop-shadow-sm"
        />
      </svg>
      
      {/* Price change indicator */}
      <div className={`absolute -top-1 -right-1 text-xs font-medium px-1 py-0.5 rounded ${
        isPositive ? 'bg-[#10b981] text-white' : 'bg-[#ef4444] text-white'
      }`}>
        {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
      </div>
    </div>
  );
};

export default MiniChart;