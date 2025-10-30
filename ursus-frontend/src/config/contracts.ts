// Solana Program Addresses
// Last updated: 2025-10-28

export const SOLANA_PROGRAM_ADDRESSES = {
  TESTNET: {
    PROGRAM_ID: "GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345",
    FACTORY_PDA: "8N2Fv9CDy6q9a8kER5EP8u4gvSutu3s6wjFuyv7P7Qb9",
    PLATFORM_TREASURY: "Hf37zaq9y5okWMxU3sW8Djhv3gd6iTy7mrSMfJcYxwQS",
  },
  DEVNET: {
    PROGRAM_ID: "GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345",
    FACTORY_PDA: "8N2Fv9CDy6q9a8kER5EP8u4gvSutu3s6wjFuyv7P7Qb9",
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
      "programId": "GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345",
      "factoryPda": "8N2Fv9CDy6q9a8kER5EP8u4gvSutu3s6wjFuyv7P7Qb9"
    }
  },
  "timestamp": "2025-10-28T19:00:00.000Z"
} as const;
