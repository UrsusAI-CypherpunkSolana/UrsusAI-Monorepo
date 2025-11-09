// Solana Program Addresses
// Last updated: 2025-11-09 (X402 Integration)

export const SOLANA_PROGRAM_ADDRESSES = {
  TESTNET: {
    PROGRAM_ID: "4m6mpe2jdRiM24ui1Z3AGbCheu1DfQEjmEGtaGKD2ftU", // X402-enabled program
    FACTORY_PDA: "CCxYQHRhg8powaDqWdp1PdcHM2PAJHBUsTaHx1uyDecJ",
    PLATFORM_TREASURY: "Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS",
  },
  DEVNET: {
    PROGRAM_ID: "4m6mpe2jdRiM24ui1Z3AGbCheu1DfQEjmEGtaGKD2ftU",
    FACTORY_PDA: "CCxYQHRhg8powaDqWdp1PdcHM2PAJHBUsTaHx1uyDecJ",
    PLATFORM_TREASURY: "Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS",
  },
  MAINNET: {
    PROGRAM_ID: "", // To be deployed
    FACTORY_PDA: "",
    PLATFORM_TREASURY: "",
  }
} as const;

export const DEPLOYMENT_INFO = {
  "network": "solana-testnet",
  "cluster": "testnet",
  "deployer": "Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS",
  "programs": {
    "AgentFactory": {
      "programId": "4m6mpe2jdRiM24ui1Z3AGbCheu1DfQEjmEGtaGKD2ftU",
      "factoryPda": "CCxYQHRhg8powaDqWdp1PdcHM2PAJHBUsTaHx1uyDecJ"
    }
  },
  "timestamp": "2025-11-09T15:00:00.000Z",
  "features": ["x402-payment-protocol"]
} as const;
