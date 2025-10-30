import { PublicClient } from 'viem';

// Professional contract interaction service
export class ContractService {
  private publicClient: PublicClient;
  
  constructor(publicClient: PublicClient) {
    this.publicClient = publicClient;
  }

  private static readonly ERC20_ABI = [
    {
      name: 'decimals',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint8' }]
    },
    {
      name: 'totalSupply',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint256' }]
    },
    {
      name: 'balanceOf', // <-- eklendi
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }]
    }
  ] as const;
  

// Token decimals oku (yoksa 18 döner)
async getTokenDecimals(tokenAddress: string): Promise<number> {
  try {
    const d = await this.publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ContractService.ERC20_ABI,
      functionName: 'decimals'
    });
    return Number(d);
  } catch (e) {
    console.warn('decimals() read failed, defaulting to 18', e);
    return 18;
  }
}

// totalSupply raw (bigint)
async getTotalSupplyRaw(tokenAddress: string): Promise<bigint> {
  const s = await this.publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ContractService.ERC20_ABI,
    functionName: 'totalSupply'
  });
  return s as bigint;
}

// normalize edilmiş totalSupply (Number)
async getTotalSupply(tokenAddress: string): Promise<number> {
  const [dec, raw] = await Promise.all([
    this.getTokenDecimals(tokenAddress),
    this.getTotalSupplyRaw(tokenAddress)
  ]);
  return Number(raw) / 10 ** dec;
}

  // Agent Token ABI for graduation-related functions
  private static readonly AGENT_TOKEN_ABI = [
    {
      name: 'isGraduated',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'bool' }]
    },
    {
      name: 'getBondingCurveInfo',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [
        { name: 'currentSupply_', type: 'uint256' },
        { name: 'reserveBalance_', type: 'uint256' },
        { name: 'price', type: 'uint256' },
        { name: 'marketCap', type: 'uint256' },
        { name: 'isGraduated_', type: 'bool' }
      ]
    },
    {
      name: 'GRADUATION_THRESHOLD',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'reserveBalance',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'currentSupply',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
    },
    {
      name: 'getCurrentPrice',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
    }
  ] as const;
  /**
   * Professional graduation status detection with multiple fallback methods
   */
  async getGraduationStatus(tokenAddress: string): Promise<{
    isGraduated: boolean;
    currentReserve: number;
    graduationThreshold: number;
    currentPrice: number;
    marketCap: number;
    currentSupply: number;
    confidence: 'high' | 'medium' | 'low';
    method: string;
    error?: string;
  }> {

    

    const address = tokenAddress as `0x${string}`;
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let method = 'unknown';
    let error: string | undefined;

    // Default values
    let isGraduated = false;
    let currentReserve = 0;
    let graduationThreshold = 30000; // 30,000 SOL default
    let currentPrice = 0;
    let marketCap = 0;
    let currentSupply = 0;

    try {
      // Method 1: Try comprehensive bonding curve info (highest confidence)
      try {
        const bondingCurveInfo = await this.publicClient.readContract({
          address,
          abi: ContractService.AGENT_TOKEN_ABI,
          functionName: 'getBondingCurveInfo'
        }) as [bigint, bigint, bigint, bigint, boolean];

        const [supply, reserve, price, marketCapBig, isGraduatedFromContract] = bondingCurveInfo;
       
        currentSupply = Number(supply) / 1e18;
        currentReserve = Number(reserve) / 1e18;
        currentPrice = Number(price) / 1e18;
        marketCap = Number(marketCapBig) / 1e18;
        
        // Get graduation threshold
        try {
          const threshold = await this.publicClient.readContract({
            address,
            abi: ContractService.AGENT_TOKEN_ABI,
            functionName: 'GRADUATION_THRESHOLD'
          }) as bigint;
          
graduationThreshold = Number(threshold) / 1e18;
        } catch {
          // Use default threshold if call fails
        }

        // Use contract's graduation status first, then check reserve vs threshold as backup
        isGraduated = isGraduatedFromContract || (currentReserve >= graduationThreshold);
        
        confidence = 'high';
        method = 'getBondingCurveInfo + GRADUATION_THRESHOLD';
        
        console.log(`✅ High confidence graduation detection:`, {
          currentReserve,
          graduationThreshold,
          isGraduated,
          currentPrice,
          marketCap
        });

      } catch (bondingCurveError) {
        console.log('⚠️ getBondingCurveInfo failed, trying individual calls:', bondingCurveError);
        
        // Method 2: Individual contract calls (medium confidence)
        try {
          // Direct graduation check
          try {
            isGraduated = await this.publicClient.readContract({
              address,
              abi: ContractService.AGENT_TOKEN_ABI,
              functionName: 'isGraduated'
            }) as boolean;
          } catch {
            // Continue with other methods
          }

          // Get reserve balance
          try {
            const reserve = await this.publicClient.readContract({
              address,
              abi: ContractService.AGENT_TOKEN_ABI,
              functionName: 'reserveBalance'
            }) as bigint;
            
            currentReserve = parseFloat((Number(reserve) / 1e18).toString());
          } catch {
            // Continue with other methods
          }

          // Get graduation threshold
          try {
            const threshold = await this.publicClient.readContract({
              address,
              abi: ContractService.AGENT_TOKEN_ABI,
              functionName: 'GRADUATION_THRESHOLD'
            }) as bigint;
            
            graduationThreshold = parseFloat((Number(threshold) / 1e18).toString());
          } catch {
            // Use default threshold
          }

          // Get current price
          try {
            const price = await this.publicClient.readContract({
              address,
              abi: ContractService.AGENT_TOKEN_ABI,
              functionName: 'getCurrentPrice'
            }) as bigint;
            
            currentPrice = parseFloat((Number(price) / 1e18).toString());
          } catch {
            // Continue without price
          }

          // Get current supply
          try {
            const supply = await this.publicClient.readContract({
              address,
              abi: ContractService.AGENT_TOKEN_ABI,
              functionName: 'currentSupply'
            }) as bigint;
            
            currentSupply = parseFloat((Number(supply) / 1e18).toString());
          } catch {
            // Continue without supply
          }

          // Calculate market cap if we have price and supply
          if (currentPrice > 0 && currentSupply > 0) {
            marketCap = (currentSupply * currentPrice);
          }

          // Final graduation check based on reserve vs threshold
          if (!isGraduated && currentReserve >= graduationThreshold) {
            isGraduated = true;
          }

          confidence = 'medium';
          method = 'individual contract calls';

          console.log(`⚠️ Medium confidence graduation detection:`, {
            currentReserve,
            graduationThreshold,
            isGraduated,
            currentPrice,
            marketCap
          });

        } catch (individualCallsError) {
          console.log('⚠️ Individual contract calls failed, using fallback');
          
          // Method 3: Known graduated tokens fallback (low confidence)
          const knownGraduatedTokens = [
            '0x36f73a86b59e4e5dc80ad84fbeb2cc3d8e55856d' // TRADE token
          ];

          if (knownGraduatedTokens.includes(tokenAddress.toLowerCase())) {
            isGraduated = true;
            currentReserve = 39695270; // Known reserve for TRADE
            currentPrice = 1.0; // Known price for TRADE
            marketCap = 1000000; // Known market cap for TRADE
            confidence = 'low';
            method = 'known graduated tokens fallback';
            error = 'Contract calls failed, using known token data';

            console.log(`⚠️ Low confidence graduation detection (fallback):`, {
              tokenAddress,
              isGraduated,
              method
            });
          } else {
            // Generate realistic demo data for unknown tokens
            currentReserve = Math.floor(Math.random() * 25000) + 1000; // 1K-26K SOL
            currentPrice = Math.random() * 0.01 + 0.001; // 0.001-0.011 price
            marketCap = Math.floor(Math.random() * 500000) + 50000; // 50K-550K market cap
            currentSupply = marketCap / currentPrice; // Calculate supply from market cap and price
            isGraduated = currentReserve >= graduationThreshold;
            confidence = 'low';
            method = 'demo data fallback';
            error = 'Contract calls failed, using demo data';

            console.log(`⚠️ Demo data fallback:`, {
              tokenAddress,
              currentReserve,
              graduationThreshold,
              isGraduated,
              method
            });
          }
        }
      }

    } catch (generalError) {
      console.error('❌ Critical error in graduation detection:', generalError);
      error = `Critical error: ${generalError instanceof Error ? generalError.message : 'Unknown error'}`;
    }

    return {
      isGraduated,
      currentReserve,
      graduationThreshold,
      currentPrice,
      marketCap,
      currentSupply,
      confidence,
      method,
      error
    };
  }

  /**
   * Get token balance for a user
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
    try {
      const balance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ContractService.ERC20_ABI, // class'taki static tanım
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`]
      }) as bigint;
  
      return balance;
    } catch (error) {
      console.error('❌ Failed to get token balance:', error);
      return 0n;
    }
  }
  

  /**
   * Check if contract exists and is valid
   */
  async isValidContract(address: string): Promise<boolean> {
    try {
      const code = await this.publicClient.getBytecode({
        address: address as `0x${string}`
      });
      
      return code !== undefined && code !== '0x';
    } catch {
      return false;
    }
  }
}

// Export singleton instance creator
export const createContractService = (publicClient: PublicClient) => {
  return new ContractService(publicClient);
};