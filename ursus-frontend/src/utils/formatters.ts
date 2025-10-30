/**
 * Professional formatting utilities for financial data
 * Used across the trading platform for consistent number formatting
 */

/**
 * Format a number with appropriate precision and thousand separators
 * @param value - The number to format (as string or number)
 * @param options - Formatting options
 * @returns Formatted string
 */
export interface FormatNumberOptions {
  decimals?: number;
  minDecimals?: number;
  maxDecimals?: number;
  useGrouping?: boolean;
  prefix?: string;
  suffix?: string;
  fallback?: string;
  scientific?: boolean;
  compact?: boolean;
}

export const formatNumber = (
  value: string | number | null | undefined,
  options: FormatNumberOptions = {}
): string => {
  const {
    decimals,
    minDecimals = 0,
    maxDecimals = 8,
    useGrouping = true,
    prefix = '',
    suffix = '',
    fallback = '0',
    scientific = false,
    compact = false
  } = options;

  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === '' || value === 'NaN') {
    return fallback;
  }

  // Convert to number
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Handle invalid numbers
  if (isNaN(numValue) || !isFinite(numValue)) {
    return fallback;
  }

  // Handle zero
  if (numValue === 0) {
    return `${prefix}0${suffix}`;
  }

  // Handle very small numbers with scientific notation
  if (scientific && Math.abs(numValue) < 0.0001 && Math.abs(numValue) > 0) {
    return `${prefix}${numValue.toExponential(2)}${suffix}`;
  }

  // Handle extremely small numbers (like blockchain prices) even without scientific flag
  if (Math.abs(numValue) < 0.00000001 && Math.abs(numValue) > 0) {
    return `${prefix}${numValue.toExponential(2)}${suffix}`;
  }

  // Handle compact notation for large numbers
  if (compact && Math.abs(numValue) >= 1000000) {
    return formatCompactNumber(numValue, { prefix, suffix });
  }

  // Determine decimal places
  let decimalPlaces = decimals;
  if (decimalPlaces === undefined) {
    // Auto-determine based on value magnitude
    if (Math.abs(numValue) >= 1000) {
      decimalPlaces = Math.max(minDecimals, 2);
    } else if (Math.abs(numValue) >= 1) {
      decimalPlaces = Math.max(minDecimals, 4);
    } else if (Math.abs(numValue) >= 0.01) {
      decimalPlaces = Math.max(minDecimals, 6);
    } else {
      decimalPlaces = Math.max(minDecimals, 8);
    }
    decimalPlaces = Math.min(decimalPlaces, maxDecimals);
  }

  // Format the number
  const formatted = numValue.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimalPlaces,
    useGrouping
  });

  return `${prefix}${formatted}${suffix}`;
};

/**
 * Format numbers in compact notation (K, M, B, T)
 */
export const formatCompactNumber = (
  value: number,
  options: { prefix?: string; suffix?: string } = {}
): string => {
  const { prefix = '', suffix = '' } = options;
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (absValue >= 1e12) {
    return `${prefix}${sign}${(absValue / 1e12).toFixed(2)}T${suffix}`;
  } else if (absValue >= 1e9) {
    return `${prefix}${sign}${(absValue / 1e9).toFixed(2)}B${suffix}`;
  } else if (absValue >= 1e6) {
    return `${prefix}${sign}${(absValue / 1e6).toFixed(2)}M${suffix}`;
  } else if (absValue >= 1e3) {
    return `${prefix}${sign}${(absValue / 1e3).toFixed(2)}K${suffix}`;
  } else {
    return `${prefix}${sign}${absValue.toFixed(2)}${suffix}`;
  }
};

/**
 * Format cryptocurrency prices with appropriate precision
 */
export const formatPrice = (
  price: string | number | null | undefined,
  currency: string = 'SOL'
): string => {
  if (!price) return `0.000000000000 ${currency}`;

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice) || numPrice === 0) return `0.000000000000 ${currency}`;

  // Always use decimal format with appropriate precision based on value size
  if (numPrice < 0.000000000001) {
    return `${numPrice.toFixed(18)} ${currency}`;
  } else if (numPrice < 0.000000001) {
    return `${numPrice.toFixed(15)} ${currency}`;
  } else if (numPrice < 0.000001) {
    return `${numPrice.toFixed(12)} ${currency}`;
  } else if (numPrice < 0.001) {
    return `${numPrice.toFixed(9)} ${currency}`;
  } else if (numPrice < 1) {
    return `${numPrice.toFixed(6)} ${currency}`;
  } else {
    return `${numPrice.toFixed(4)} ${currency}`;
  }
};

/**
 * Format percentage values
 */
export const formatPercentage = (
  value: string | number | null | undefined,
  decimals: number = 2
): string => {
  if (value === null || value === undefined || value === '') return '0.00%';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0.00%';
  
  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(decimals)}%`;
};

/**
 * Format market cap values
 */
export const formatMarketCap = (
  value: string | number | null | undefined,
  currency: string = 'SOL'
): string => {
  if (!value) return `0 ${currency}`;

  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue) || numValue === 0) return `0 ${currency}`;

  // Consistent format for all market caps
  if (numValue >= 1000000) {
    return `${(numValue / 1000000).toFixed(2)}M ${currency}`;
  } else if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(2)}K ${currency}`;
  } else {
    return `${numValue.toFixed(4)} ${currency}`;
  }
};

/**
 * Format volume values
 */
export const formatVolume = (
  value: string | number | null | undefined,
  currency: string = 'SOL'
): string => {
  if (!value) return `0 ${currency}`;
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue) || numValue === 0) return `0 ${currency}`;
  
  if (numValue >= 1000) {
    return `${formatCompactNumber(numValue)} ${currency}`;
  }
  
  return `${numValue.toFixed(2)} ${currency}`;
};

/**
 * Format token amounts with appropriate precision
 */
export const formatTokenAmount = (
  amount: string | number | null | undefined,
  symbol: string = '',
  decimals: number = 4
): string => {
  if (!amount) return `0${symbol ? ' ' + symbol : ''}`;
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return `0${symbol ? ' ' + symbol : ''}`;
  
  if (numAmount >= 1000000) {
    return `${formatCompactNumber(numAmount)}${symbol ? ' ' + symbol : ''}`;
  }
  
  return `${numAmount.toFixed(decimals)}${symbol ? ' ' + symbol : ''}`;
};

/**
 * Format time duration (e.g., "2h 30m ago")
 */
export const formatTimeAgo = (date: Date | string | number): string => {
  const now = new Date();
  const targetDate = new Date(date);
  const diffMs = now.getTime() - targetDate.getTime();
  
  if (diffMs < 0) return 'in the future';
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return targetDate.toLocaleDateString();
};

/**
 * Format address for display (truncate middle)
 */
export const formatAddress = (
  address: string | null | undefined,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) return address;
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format transaction hash for display
 */
export const formatTxHash = (hash: string | null | undefined): string => {
  return formatAddress(hash, 8, 6);
};

/**
 * Format large numbers with appropriate units
 */
export const formatLargeNumber = (
  value: string | number | null | undefined,
  options: { decimals?: number; units?: boolean } = {}
): string => {
  const { decimals = 2, units = true } = options;
  
  if (!value) return '0';
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  if (!units) {
    return numValue.toLocaleString('en-US', {
      maximumFractionDigits: decimals
    });
  }
  
  return formatCompactNumber(numValue);
};

/**
 * Validate and sanitize numeric input
 */
export const sanitizeNumericInput = (
  input: string,
  options: { allowNegative?: boolean; maxDecimals?: number } = {}
): string => {
  const { allowNegative = false, maxDecimals = 8 } = options;
  
  // Remove all non-numeric characters except decimal point and minus
  let sanitized = input.replace(/[^0-9.-]/g, '');
  
  // Handle negative sign
  if (!allowNegative) {
    sanitized = sanitized.replace(/-/g, '');
  } else {
    // Only allow one minus sign at the beginning
    const minusIndex = sanitized.indexOf('-');
    if (minusIndex > 0) {
      sanitized = sanitized.replace(/-/g, '');
    } else if (minusIndex === 0) {
      sanitized = '-' + sanitized.slice(1).replace(/-/g, '');
    }
  }
  
  // Only allow one decimal point
  const decimalIndex = sanitized.indexOf('.');
  if (decimalIndex !== -1) {
    const beforeDecimal = sanitized.slice(0, decimalIndex);
    const afterDecimal = sanitized.slice(decimalIndex + 1).replace(/\./g, '');
    sanitized = beforeDecimal + '.' + afterDecimal.slice(0, maxDecimals);
  }
  
  return sanitized;
};

/**
 * Check if a value represents zero or empty
 */
export const isZeroOrEmpty = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined || value === '') return true;
  
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  return isNaN(numValue) || numValue === 0;
};

/**
 * Format price change with color indication
 */
export const formatPriceChange = (
  change: string | number | null | undefined,
  options: { showSign?: boolean; showPercentage?: boolean } = {}
): { formatted: string; isPositive: boolean; isNegative: boolean; isZero: boolean } => {
  const { showSign = true, showPercentage = false } = options;
  
  if (!change) {
    return {
      formatted: '0.00' + (showPercentage ? '%' : ''),
      isPositive: false,
      isNegative: false,
      isZero: true
    };
  }
  
  const numChange = typeof change === 'string' ? parseFloat(change) : change;
  
  if (isNaN(numChange)) {
    return {
      formatted: '0.00' + (showPercentage ? '%' : ''),
      isPositive: false,
      isNegative: false,
      isZero: true
    };
  }
  
  const isPositive = numChange > 0;
  const isNegative = numChange < 0;
  const isZero = numChange === 0;
  
  const sign = showSign ? (isPositive ? '+' : '') : '';
  const suffix = showPercentage ? '%' : '';
  
  return {
    formatted: `${sign}${numChange.toFixed(2)}${suffix}`,
    isPositive,
    isNegative,
    isZero
  };
};

export const formatPriceRaw = (price: string | number | null | undefined): string => {
  if (!price) return '0.000000000000';

  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice) || numPrice === 0) return '0.000000000000';

  if (numPrice < 0.000000000001) {
    return numPrice.toFixed(18);
  } else if (numPrice < 0.000000001) {
    return numPrice.toFixed(15);
  } else if (numPrice < 0.000001) {
    return numPrice.toFixed(12);
  } else if (numPrice < 0.001) {
    return numPrice.toFixed(9);
  } else if (numPrice < 1) {
    return numPrice.toFixed(6);
  } else {
    return numPrice.toFixed(4);
  }
};
