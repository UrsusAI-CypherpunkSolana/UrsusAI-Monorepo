/**
 * URSUS Enterprise Error Handling & Logging Service
 * Provides comprehensive error handling, logging, and monitoring
 */

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  BLOCKCHAIN = 'blockchain',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  TRADING = 'trading',
  UI = 'ui',
  SYSTEM = 'system'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  tokenAddress?: string;
  transactionHash?: string;
  userAgent?: string;
  url?: string;
  timestamp: number;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export interface UrsusError {
  id: string;
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  isRetryable: boolean;
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
}

class ErrorHandlingService {
  private errorQueue: UrsusError[] = [];
  private maxQueueSize = 100;
  private sessionId: string;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        new Error(`Unhandled Promise Rejection: ${event.reason}`),
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        { url: window.location.href }
      );
    });

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(event.message),
        ErrorCategory.SYSTEM,
        ErrorSeverity.HIGH,
        {
          url: window.location.href,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
    });
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Main error handling method
   */
  handleError(
    error: Error | string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    additionalContext: Record<string, any> = {}
  ): UrsusError {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    const ursusError: UrsusError = {
      id: this.generateErrorId(),
      code: this.generateErrorCode(category, errorObj),
      message: errorObj.message,
      category,
      severity,
      context: {
        userId: this.userId,
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now(),
        stackTrace: errorObj.stack,
        ...additionalContext
      },
      isRetryable: this.isRetryableError(errorObj, category),
      userMessage: this.generateUserMessage(errorObj, category),
      technicalMessage: errorObj.message,
      suggestedActions: this.generateSuggestedActions(errorObj, category)
    };

    this.logError(ursusError);
    this.queueError(ursusError);

    // Send to monitoring service for critical errors
    if (severity === ErrorSeverity.CRITICAL) {
      this.sendToMonitoring(ursusError);
    }

    return ursusError;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private generateErrorCode(category: ErrorCategory, error: Error): string {
    const categoryCode = category.toUpperCase();
    const errorHash = this.hashString(error.message).substring(0, 6);
    return `URSUS_${categoryCode}_${errorHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private isRetryableError(error: Error, category: ErrorCategory): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /connection/i,
      /rate limit/i,
      /temporary/i,
      /503/,
      /502/,
      /504/
    ];

    const nonRetryableCategories = [
      ErrorCategory.VALIDATION,
      ErrorCategory.AUTHENTICATION
    ];

    if (nonRetryableCategories.includes(category)) {
      return false;
    }

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  private generateUserMessage(_error: Error, category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.';
      case ErrorCategory.BLOCKCHAIN:
        return 'Blockchain transaction failed. Please try again or contact support if the issue persists.';
      case ErrorCategory.VALIDATION:
        return 'Invalid input provided. Please check your data and try again.';
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please reconnect your wallet.';
      case ErrorCategory.TRADING:
        return 'Trading operation failed. Please check your balance and try again.';
      case ErrorCategory.UI:
        return 'Interface error occurred. Please refresh the page.';
      case ErrorCategory.SYSTEM:
        return 'System error occurred. Our team has been notified.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private generateSuggestedActions(_error: Error, category: ErrorCategory): string[] {
    const commonActions = ['Refresh the page', 'Try again in a few moments'];

    switch (category) {
      case ErrorCategory.NETWORK:
        return [
          'Check your internet connection',
          'Try switching networks',
          ...commonActions
        ];
      case ErrorCategory.BLOCKCHAIN:
        return [
          'Check your wallet connection',
          'Ensure sufficient gas fees',
          'Verify transaction details',
          ...commonActions
        ];
      case ErrorCategory.VALIDATION:
        return [
          'Check input format',
          'Verify required fields',
          'Review validation messages'
        ];
      case ErrorCategory.AUTHENTICATION:
        return [
          'Reconnect your wallet',
          'Check wallet permissions',
          'Switch to correct network'
        ];
      case ErrorCategory.TRADING:
        return [
          'Check your balance',
          'Verify trading parameters',
          'Ensure token is not graduated',
          ...commonActions
        ];
      default:
        return commonActions;
    }
  }

  private logError(error: UrsusError) {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.code}] ${error.category.toUpperCase()}: ${error.message}`;
    
    switch (logLevel) {
      case 'error':
        console.error(logMessage, error);
        break;
      case 'warn':
        console.warn(logMessage, error);
        break;
      case 'info':
        console.info(logMessage, error);
        break;
      default:
        console.log(logMessage, error);
    }
  }

  private getLogLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  private queueError(error: UrsusError) {
    this.errorQueue.push(error);
    
    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }
  }

  private async sendToMonitoring(error: UrsusError) {
    try {
      // In production, this would send to monitoring service like Sentry, DataDog, etc.
      const monitoringEndpoint = process.env.REACT_APP_MONITORING_ENDPOINT;
      
      if (monitoringEndpoint) {
        await fetch(monitoringEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error,
            environment: process.env.NODE_ENV,
            version: process.env.REACT_APP_VERSION
          })
        });
      }
    } catch (monitoringError) {
      console.error('Failed to send error to monitoring service:', monitoringError);
    }
  }

  /**
   * Specialized error handlers for different domains
   */

  handleBlockchainError(error: Error, context: { transactionHash?: string; tokenAddress?: string } = {}): UrsusError {
    let severity = ErrorSeverity.MEDIUM;
    
    // Determine severity based on error type
    if (error.message.includes('insufficient funds') || error.message.includes('gas')) {
      severity = ErrorSeverity.LOW;
    } else if (error.message.includes('revert') || error.message.includes('execution reverted')) {
      severity = ErrorSeverity.HIGH;
    }

    return this.handleError(error, ErrorCategory.BLOCKCHAIN, severity, context);
  }

  handleTradingError(error: Error, context: { tokenAddress?: string; amount?: string; type?: string } = {}): UrsusError {
    return this.handleError(error, ErrorCategory.TRADING, ErrorSeverity.HIGH, context);
  }

  handleNetworkError(error: Error, context: { endpoint?: string; method?: string } = {}): UrsusError {
    return this.handleError(error, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, context);
  }

  handleValidationError(error: Error, context: { field?: string; value?: any } = {}): UrsusError {
    return this.handleError(error, ErrorCategory.VALIDATION, ErrorSeverity.LOW, context);
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit = 10): UrsusError[] {
    return this.errorQueue.slice(-limit);
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): UrsusError[] {
    return this.errorQueue.filter(error => error.category === category);
  }

  /**
   * Clear error queue
   */
  clearErrors() {
    this.errorQueue = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {
      total: this.errorQueue.length,
      bySeverity: {} as Record<ErrorSeverity, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      retryable: 0
    };

    this.errorQueue.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      if (error.isRetryable) stats.retryable++;
    });

    return stats;
  }
}

// Create singleton instance
export const errorHandlingService = new ErrorHandlingService();
export default errorHandlingService;
