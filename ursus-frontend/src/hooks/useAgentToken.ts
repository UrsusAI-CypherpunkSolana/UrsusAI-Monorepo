import { useCallback, useState } from 'react'
import { useWallet } from '../contexts/WalletContext'

// Complete ABI for AgentToken contract
const AGENT_TOKEN_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getCurrentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getMarketCap',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getBuyQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'coreAmount', type: 'uint256' }],
    outputs: [
      { name: 'tokenAmount', type: 'uint256' },
      { name: 'currentPrice', type: 'uint256' },
      { name: 'newPrice', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' }
    ]
  },
  {
    name: 'getSellQuote',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [
      { name: 'coreAmount', type: 'uint256' },
      { name: 'currentPrice', type: 'uint256' },
      { name: 'newPrice', type: 'uint256' },
      { name: 'priceImpact', type: 'uint256' }
    ]
  },
  {
    name: 'calculatePurchaseReturn',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'coreAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'calculateSaleReturn',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'purchaseTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: []
  },
  {
    name: 'sellTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_tokenAmount', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'isGraduated',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'purchaseTokens',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    outputs: [{ name: 'tokensReceived', type: 'uint256' }]
  },
  {
    name: 'sellTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'minCoreOut', type: 'uint256' }
    ],
    outputs: [{ name: 'coreReceived', type: 'uint256' }]
  },
  {
    name: 'getReserveBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'creator',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'createdAt',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'description',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'instructions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'model',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  },
  {
    name: 'Purchase',
    type: 'event',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'coreAmount', type: 'uint256', indexed: false },
      { name: 'tokensReceived', type: 'uint256', indexed: false },
      { name: 'newPrice', type: 'uint256', indexed: false }
    ]
  },
  {
    name: 'Sale',
    type: 'event',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokensAmount', type: 'uint256', indexed: false },
      { name: 'coreReceived', type: 'uint256', indexed: false },
      { name: 'newPrice', type: 'uint256', indexed: false }
    ]
  }
] as const

interface AgentTokenInfo {
  description: string
  instructions: string
  model: string
  agentCreator: string
  timestamp: number
}

interface BondingCurveInfo {
  supply: string
  reserve: string
  price: string
  marketCap: string
}

export const useAgentToken = (tokenAddress?: string) => {
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read token info
  const { data: tokenName } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'name',
    enabled: !!tokenAddress,
  })

  const { data: tokenSymbol } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'symbol',
    enabled: !!tokenAddress,
  })

  const { data: totalSupply } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'totalSupply',
    enabled: !!tokenAddress,
  })

  const { data: currentPrice } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'getCurrentPrice',
    enabled: !!tokenAddress,
  })

  const { data: marketCap } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'getMarketCap',
    enabled: !!tokenAddress,
  })

  const { data: reserveBalance } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'getReserveBalance',
    enabled: !!tokenAddress,
  })

  const { data: creator } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'creator',
    enabled: !!tokenAddress,
  })

  const { data: createdAt } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'createdAt',
    enabled: !!tokenAddress,
  })

  const { data: description } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'description',
    enabled: !!tokenAddress,
  })

  const { data: instructions } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'instructions',
    enabled: !!tokenAddress,
  })

  const { data: model } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'model',
    enabled: !!tokenAddress,
  })

  // User balance (if wallet connected)
  const { data: userBalance } = useContractRead({
    address: tokenAddress as `0x${string}`,
    abi: AGENT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: walletClient?.account?.address ? [walletClient.account.address] : undefined,
    enabled: !!tokenAddress && !!walletClient?.account?.address,
  })

  // Real-time trading functions
  const purchaseTokens = useCallback(async (coreAmount: string) => {
    if (!walletClient || !publicClient || !tokenAddress) {
      throw new Error('Wallet not connected or token address not provided')
    }

    setIsLoading(true)
    setError(null)

    try {
      const amountInWei = parseEther(coreAmount)

      // Log the purchase attempt
      console.log('💰 Purchasing tokens with:', coreAmount, 'SOL');

      // Encode function call (buyTokens has no parameters)
      const data = encodeFunctionData({
        abi: AGENT_TOKEN_ABI,
        functionName: 'buyTokens'
      })

      // Send transaction
      const txHash = await walletClient.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data,
        value: amountInWei,
        gas: 500000n, // Increased gas limit
      })

      console.log('✅ Purchase transaction sent:', txHash)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60000
      })

      console.log('✅ Purchase confirmed:', receipt)
      return txHash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, publicClient, tokenAddress])

  const sellTokens = useCallback(async (tokenAmount: string) => {
    if (!walletClient || !publicClient || !tokenAddress) {
      throw new Error('Wallet not connected or token address not provided')
    }

    setIsLoading(true)
    setError(null)

    try {
      const amountInWei = parseEther(tokenAmount)

      // Log the sell attempt
      console.log('💰 Selling tokens:', tokenAmount, 'TRADE');

      // Encode function call (sellTokens takes only token amount)
      const data = encodeFunctionData({
        abi: AGENT_TOKEN_ABI,
        functionName: 'sellTokens',
        args: [amountInWei]
      })

      // Send transaction
      const txHash = await walletClient.sendTransaction({
        to: tokenAddress as `0x${string}`,
        data,
        gas: 500000n, // Increased gas limit
      })

      console.log('✅ Sell transaction sent:', txHash)

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60000
      })

      console.log('✅ Sell confirmed:', receipt)
      return txHash
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sell failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, publicClient, tokenAddress])

  // Helper functions
  const getUserBalance = useCallback(async (userAddress: string) => {
    if (!publicClient || !tokenAddress) return '0'

    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: AGENT_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`]
      }) as bigint

      return formatEther(balance)
    } catch (error) {
      console.error('Error fetching user balance:', error)
      return '0'
    }
  }, [publicClient, tokenAddress])

  const calculatePurchaseReturn = useCallback(async (coreAmount: string) => {
    if (!publicClient || !tokenAddress) return '0'

    try {
      const amountInWei = parseEther(coreAmount)
      const buyQuote = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: AGENT_TOKEN_ABI,
        functionName: 'getBuyQuote',
        args: [amountInWei]
      }) as [bigint, bigint, bigint, bigint]
      const tokensOut = buyQuote[0] // tokenAmount

      return formatEther(tokensOut)
    } catch (error) {
      console.error('Error calculating purchase return:', error)
      return '0'
    }
  }, [publicClient, tokenAddress])

  const calculateSaleReturn = useCallback(async (tokenAmount: string) => {
    if (!publicClient || !tokenAddress) return '0'

    try {
      const amountInWei = parseEther(tokenAmount)
      const sellQuote = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: AGENT_TOKEN_ABI,
        functionName: 'getSellQuote',
        args: [amountInWei]
      }) as [bigint, bigint, bigint, bigint]
      const coreOut = sellQuote[0] // coreAmount

      return formatEther(coreOut)
    } catch (error) {
      console.error('Error calculating sale return:', error)
      return '0'
    }
  }, [publicClient, tokenAddress])

  // Get detailed token information
  const getTokenDetails = useCallback(async () => {
    if (!publicClient || !tokenAddress) return null

    try {
      const [
        name,
        symbol,
        supply,
        price,
        cap,
        reserve,
        creatorAddr,
        timestamp,
        desc,
        instr,
        modelName
      ] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'name'
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'symbol'
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'totalSupply'
        }),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'getCurrentPrice'
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'getMarketCap'
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'getReserveBalance'
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'creator'
        }).catch(() => '0x0000000000000000000000000000000000000000'),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'createdAt'
        }).catch(() => BigInt(0)),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'description'
        }).catch(() => ''),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'instructions'
        }).catch(() => ''),
        publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: AGENT_TOKEN_ABI,
          functionName: 'model'
        }).catch(() => '')
      ])

      return {
        name: name as string,
        symbol: symbol as string,
        totalSupply: formatEther(supply as bigint),
        currentPrice: formatEther(price as bigint),
        marketCap: formatEther(cap as bigint),
        reserveBalance: formatEther(reserve as bigint),
        creator: creatorAddr as string,
        createdAt: Number(timestamp as bigint),
        description: desc as string,
        instructions: instr as string,
        model: modelName as string,
        contractAddress: tokenAddress
      }
    } catch (error) {
      console.error('Error fetching token details:', error)
      return null
    }
  }, [publicClient, tokenAddress])

  // Legacy wrapper functions (deprecated - use purchaseTokens/sellTokens directly)
  const buyTokens = useCallback((coreAmount: string) => {
    return purchaseTokens(coreAmount)
  }, [purchaseTokens])

  const sellTokensAmount = useCallback((tokenAmount: string) => {
    return sellTokens(tokenAmount)
  }, [sellTokens])

  return {
    // Token info
    tokenName: tokenName as string,
    tokenSymbol: tokenSymbol as string,
    totalSupply: totalSupply ? formatEther(totalSupply as bigint) : '0',
    currentPrice: currentPrice ? formatEther(currentPrice as bigint) : '0',
    
    // Additional token data
    marketCap: marketCap ? formatEther(marketCap as bigint) : '0',
    reserveBalance: reserveBalance ? formatEther(reserveBalance as bigint) : '0',
    userBalance: userBalance ? formatEther(userBalance as bigint) : '0',

    // Agent metadata
    creator: creator as string || '',
    createdAt: createdAt ? Number(createdAt as bigint) : 0,
    description: description as string || '',
    instructions: instructions as string || '',
    model: model as string || '',

    // Bonding curve info
    bondingCurveInfo: {
      supply: totalSupply ? formatEther(totalSupply as bigint) : '0',
      reserve: reserveBalance ? formatEther(reserveBalance as bigint) : '0',
      price: currentPrice ? formatEther(currentPrice as bigint) : '0',
      marketCap: marketCap ? formatEther(marketCap as bigint) : '0',
    } as BondingCurveInfo,

    // Agent info
    agentInfo: {
      description: description as string || '',
      instructions: instructions as string || '',
      model: model as string || '',
      agentCreator: creator as string || '',
      timestamp: createdAt ? Number(createdAt as bigint) : 0,
    } as AgentTokenInfo,
    
    // Trading actions
    purchaseTokens,
    sellTokens,

    // Legacy functions (for backward compatibility)
    buyTokens,
    sellTokensAmount,

    // Helper functions
    getUserBalance,
    calculatePurchaseReturn,
    calculateSaleReturn,
    getTokenDetails,

    // State
    isLoading,
    error,

    // Contract info
    tokenAddress: tokenAddress || '',
  }
}
