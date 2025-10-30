// Solana DEX Service - Uses backend API for bonding curve calculations
export interface DEXQuote {
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  slippage: number;
  minimumReceived: string;
  route: string[];
  method: 'bonding-curve';
  confidence: 'high' | 'medium' | 'low';
}

// Solana DEX Service for Bonding Curve Trading
export class DEXService {
  private agentAddress: string;

  constructor(_connection: any, agentAddress: string) {
    this.agentAddress = agentAddress;
  }

  /**
   * Get quote from bonding curve via backend API
   */
  async getDEXQuote(
    amount: string,
    isBuy: boolean,
    slippageTolerance: number = 2
  ): Promise<DEXQuote> {
    console.log(`🔄 Getting bonding curve quote: ${amount} ${isBuy ? 'SOL -> TOKEN' : 'TOKEN -> SOL'}`);

    try {
      // Backend API will calculate bonding curve quote
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const endpoint = isBuy ? '/api/blockchain/calculate-buy' : '/api/blockchain/calculate-sell';

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAddress: this.agentAddress,
          amount: isBuy ? amount : amount, // SOL amount for buy, token amount for sell
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get quote: ${response.statusText}`);
      }

      const data = await response.json();

      const outputAmount = data.outputAmount || '0';
      const minimumReceived = (parseFloat(outputAmount) * (1 - slippageTolerance / 100)).toString();
      const priceImpact = data.priceImpact || 0;

      return {
        inputAmount: amount,
        outputAmount,
        priceImpact,
        slippage: slippageTolerance,
        minimumReceived,
        route: [isBuy ? 'SOL' : 'TOKEN', isBuy ? 'TOKEN' : 'SOL'],
        method: 'bonding-curve',
        confidence: 'high'
      };
    } catch (error) {
      console.error('❌ Failed to get bonding curve quote:', error);
      throw error;
    }
  }

  /**
   * Check if bonding curve is available for this agent
   */
  async isDEXAvailable(): Promise<boolean> {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/agents/${this.agentAddress}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get swap transaction - not used in Solana (backend handles transactions)
   */
  async getSwapTx(_amount: string, _isBuy: boolean, _slippageTolerance: number = 2): Promise<{ to: string; data: string; value: string }> {
    // Solana transactions are handled by backend
    throw new Error('Solana transactions are handled by backend API');
  }
}

// Export factory function
export const createDEXService = (connection: any, agentAddress: string) => {
  return new DEXService(connection, agentAddress);
};
