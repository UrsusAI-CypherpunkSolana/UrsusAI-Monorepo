import { useState, useCallback, useEffect } from 'react';
import errorHandlingService, { 
  UrsusError, 
  ErrorCategory, 
  ErrorSeverity 
} from '../services/errorHandling';

export interface ErrorState {
  currentError: UrsusError | null;
  errorHistory: UrsusError[];
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
}

export const useErrorHandling = (maxRetries = 3) => {
  const [state, setState] = useState<ErrorState>({
    currentError: null,
    errorHistory: [],
    isRetrying: false,
    retryCount: 0,
    maxRetries
  });

  // Handle error with automatic retry logic
  const handleError = useCallback((
    error: Error | string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Record<string, any> = {}
  ): UrsusError => {
    const ursusError = errorHandlingService.handleError(error, category, severity, context);
    
    setState(prev => ({
      ...prev,
      currentError: ursusError,
      errorHistory: [ursusError, ...prev.errorHistory.slice(0, 9)] // Keep last 10 errors
    }));

    return ursusError;
  }, []);

  // Handle blockchain-specific errors
  const handleBlockchainError = useCallback((
    error: Error,
    context: { transactionHash?: string; tokenAddress?: string } = {}
  ): UrsusError => {
    const ursusError = errorHandlingService.handleBlockchainError(error, context);
    
    setState(prev => ({
      ...prev,
      currentError: ursusError,
      errorHistory: [ursusError, ...prev.errorHistory.slice(0, 9)]
    }));

    return ursusError;
  }, []);

  // Handle trading-specific errors
  const handleTradingError = useCallback((
    error: Error,
    context: { tokenAddress?: string; amount?: string; type?: string } = {}
  ): UrsusError => {
    const ursusError = errorHandlingService.handleTradingError(error, context);
    
    setState(prev => ({
      ...prev,
      currentError: ursusError,
      errorHistory: [ursusError, ...prev.errorHistory.slice(0, 9)]
    }));

    return ursusError;
  }, []);

  // Handle network-specific errors
  const handleNetworkError = useCallback((
    error: Error,
    context: { endpoint?: string; method?: string } = {}
  ): UrsusError => {
    const ursusError = errorHandlingService.handleNetworkError(error, context);
    
    setState(prev => ({
      ...prev,
      currentError: ursusError,
      errorHistory: [ursusError, ...prev.errorHistory.slice(0, 9)]
    }));

    return ursusError;
  }, []);

  // Handle validation errors
  const handleValidationError = useCallback((
    error: Error,
    context: { field?: string; value?: any } = {}
  ): UrsusError => {
    const ursusError = errorHandlingService.handleValidationError(error, context);
    
    setState(prev => ({
      ...prev,
      currentError: ursusError,
      errorHistory: [ursusError, ...prev.errorHistory.slice(0, 9)]
    }));

    return ursusError;
  }, []);

  // Retry function with exponential backoff
  const retry = useCallback(async (
    operation: () => Promise<any>,
    context: Record<string, any> = {}
  ): Promise<any> => {
    if (state.retryCount >= state.maxRetries) {
      throw new Error('Maximum retry attempts exceeded');
    }

    setState(prev => ({ ...prev, isRetrying: true }));

    try {
      const result = await operation();
      
      // Reset retry count on success
      setState(prev => ({
        ...prev,
        isRetrying: false,
        retryCount: 0,
        currentError: null
      }));

      return result;
    } catch (error) {
      const retryDelay = Math.pow(2, state.retryCount) * 1000; // Exponential backoff
      
      setState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1,
        isRetrying: false
      }));

      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      
      if (state.retryCount + 1 < state.maxRetries) {
        return retry(operation, context);
      } else {
        handleError(
          error instanceof Error ? error : new Error(String(error)),
          ErrorCategory.SYSTEM,
          ErrorSeverity.HIGH,
          { ...context, retryCount: state.retryCount + 1 }
        );
        throw error;
      }
    }
  }, [state.retryCount, state.maxRetries, handleError]);

  // Clear current error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentError: null,
      retryCount: 0
    }));
  }, []);

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentError: null,
      errorHistory: [],
      retryCount: 0
    }));
    errorHandlingService.clearErrors();
  }, []);

  // Get error by ID
  const getErrorById = useCallback((id: string): UrsusError | null => {
    return state.errorHistory.find(error => error.id === id) || null;
  }, [state.errorHistory]);

  // Check if error is retryable
  const isRetryable = useCallback((error?: UrsusError): boolean => {
    const targetError = error || state.currentError;
    return targetError?.isRetryable && state.retryCount < state.maxRetries || false;
  }, [state.currentError, state.retryCount, state.maxRetries]);

  // Get error statistics
  const getErrorStats = useCallback(() => {
    return errorHandlingService.getErrorStats();
  }, []);

  // Wrap async operations with error handling
  const withErrorHandling = useCallback(<T>(
    operation: () => Promise<T>,
    category: ErrorCategory,
    context: Record<string, any> = {}
  ): Promise<T> => {
    return operation().catch(error => {
      handleError(
        error instanceof Error ? error : new Error(String(error)),
        category,
        ErrorSeverity.MEDIUM,
        context
      );
      throw error;
    });
  }, [handleError]);

  // Wrap sync operations with error handling
  const withSyncErrorHandling = useCallback(<T>(
    operation: () => T,
    category: ErrorCategory,
    context: Record<string, any> = {}
  ): T | null => {
    try {
      return operation();
    } catch (error) {
      handleError(
        error instanceof Error ? error : new Error(String(error)),
        category,
        ErrorSeverity.MEDIUM,
        context
      );
      return null;
    }
  }, [handleError]);

  // Auto-clear errors after timeout
  useEffect(() => {
    if (state.currentError && state.currentError.severity === ErrorSeverity.LOW) {
      const timeout = setTimeout(() => {
        clearError();
      }, 5000); // Clear low severity errors after 5 seconds

      return () => clearTimeout(timeout);
    }
  }, [state.currentError, clearError]);

  return {
    // State
    ...state,

    // Error handlers
    handleError,
    handleBlockchainError,
    handleTradingError,
    handleNetworkError,
    handleValidationError,

    // Utility functions
    retry,
    clearError,
    clearAllErrors,
    getErrorById,
    isRetryable,
    getErrorStats,
    withErrorHandling,
    withSyncErrorHandling,

    // Computed values
    hasError: !!state.currentError,
    hasRetryableError: isRetryable(),
    canRetry: isRetryable() && !state.isRetrying,
    errorMessage: state.currentError?.userMessage || null,
    technicalMessage: state.currentError?.technicalMessage || null,
    suggestedActions: state.currentError?.suggestedActions || [],
    errorCode: state.currentError?.code || null
  };
};

export default useErrorHandling;
