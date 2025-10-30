import { renderHook, waitFor } from '@testing-library/react';
import { useGraduationStatus } from '../../hooks/useGraduationStatus';
import { createContractService } from '../../services/contractService';

// Mock the contract service
jest.mock('../../services/contractService');
jest.mock('wagmi', () => ({
  usePublicClient: () => ({
    readContract: jest.fn()
  })
}));

const mockContractService = createContractService as jest.MockedFunction<typeof createContractService>;

describe('useGraduationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should calculate progress percentage correctly', async () => {
    const mockGraduationData = {
      isGraduated: false,
      currentReserve: 15000, // 15K SOL
      graduationThreshold: 30000, // 30K SOL
      currentPrice: 0.005,
      marketCap: 100000,
      currentSupply: 20000000,
      confidence: 'high' as const,
      method: 'test',
      error: null
    };

    mockContractService.mockReturnValue({
      getGraduationStatus: jest.fn().mockResolvedValue(mockGraduationData)
    } as any);

    const { result } = renderHook(() => 
      useGraduationStatus('0x1234567890123456789012345678901234567890')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Progress should be 50% (15K / 30K * 100)
    expect(result.current.progressPercentage).toBe(50);
    expect(result.current.remainingToGraduation).toBe(15000);
    expect(result.current.isGraduated).toBe(false);
  });

  it('should mark as graduated when reserve exceeds threshold', async () => {
    const mockGraduationData = {
      isGraduated: true,
      currentReserve: 35000, // 35K SOL (above 30K threshold)
      graduationThreshold: 30000,
      currentPrice: 0.01,
      marketCap: 500000,
      currentSupply: 50000000,
      confidence: 'high' as const,
      method: 'test',
      error: null
    };

    mockContractService.mockReturnValue({
      getGraduationStatus: jest.fn().mockResolvedValue(mockGraduationData)
    } as any);

    const { result } = renderHook(() => 
      useGraduationStatus('0x1234567890123456789012345678901234567890')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should be graduated with 100% progress
    expect(result.current.progressPercentage).toBe(100);
    expect(result.current.remainingToGraduation).toBe(0);
    expect(result.current.isGraduated).toBe(true);
  });

  it('should handle edge case where reserve equals threshold', async () => {
    const mockGraduationData = {
      isGraduated: true,
      currentReserve: 30000, // Exactly 30K SOL
      graduationThreshold: 30000,
      currentPrice: 0.008,
      marketCap: 300000,
      currentSupply: 37500000,
      confidence: 'high' as const,
      method: 'test',
      error: null
    };

    mockContractService.mockReturnValue({
      getGraduationStatus: jest.fn().mockResolvedValue(mockGraduationData)
    } as any);

    const { result } = renderHook(() => 
      useGraduationStatus('0x1234567890123456789012345678901234567890')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should be exactly 100% and graduated
    expect(result.current.progressPercentage).toBe(100);
    expect(result.current.remainingToGraduation).toBe(0);
    expect(result.current.isGraduated).toBe(true);
  });

  it('should use fallback data when contract calls fail', async () => {
    mockContractService.mockReturnValue({
      getGraduationStatus: jest.fn().mockRejectedValue(new Error('Contract not found'))
    } as any);

    const { result } = renderHook(() => 
      useGraduationStatus('0x1234567890123456789012345678901234567890')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should have fallback data with realistic values
    expect(result.current.currentReserve).toBeGreaterThan(0);
    expect(result.current.currentReserve).toBeLessThan(30000);
    expect(result.current.graduationThreshold).toBe(30000);
    expect(result.current.progressPercentage).toBeGreaterThan(0);
    expect(result.current.progressPercentage).toBeLessThan(100);
    expect(result.current.error).toContain('Contract unavailable');
  });

  it('should calculate professional metrics correctly', async () => {
    const mockGraduationData = {
      isGraduated: false,
      currentReserve: 21000, // 21K SOL (70% progress)
      graduationThreshold: 30000,
      currentPrice: 0.006,
      marketCap: 150000,
      currentSupply: 25000000,
      confidence: 'high' as const,
      method: 'test',
      error: null
    };

    mockContractService.mockReturnValue({
      getGraduationStatus: jest.fn().mockResolvedValue(mockGraduationData)
    } as any);

    const { result } = renderHook(() => 
      useGraduationStatus('0x1234567890123456789012345678901234567890')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const metrics = result.current.professionalMetrics;
    
    // Reserve ratio should be 0.7 (21K / 30K)
    expect(metrics.reserveRatio).toBeCloseTo(0.7, 2);
    
    // Risk level should be medium (between 50% and 80%)
    expect(metrics.riskLevel).toBe('medium');
    
    // Performance score should include market cap bonus
    expect(metrics.performanceScore).toBeGreaterThan(70);
    
    // Liquidity score based on 21K reserve
    expect(metrics.liquidityScore).toBeGreaterThan(200); // (21000 / 10000) * 100
  });
});
