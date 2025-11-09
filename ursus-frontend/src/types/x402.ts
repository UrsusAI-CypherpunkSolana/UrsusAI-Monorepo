import { PublicKey } from '@solana/web3.js';

/**
 * X402 Payment Protocol Types
 * On-chain payment configuration and records
 */

export enum PaymentStatus {
  Pending = 0,
  Verified = 1,
  Settled = 2,
  Failed = 3,
}

export interface X402Config {
  agent: PublicKey;
  paymentRecipient: PublicKey;
  enabled: boolean;
  minPaymentAmount: number;
  maxPaymentAmount: number;
  serviceTimeoutSeconds: number;
  totalPaymentsReceived: number;
  totalServiceCalls: number;
  nonce: number;
  bump: number;
}

export interface X402PaymentRecord {
  agent: PublicKey;
  payer: PublicKey;
  amount: number;
  timestamp: number;
  serviceId: string;
  status: PaymentStatus;
  bump: number;
}

export interface ConfigureX402Params {
  agentAddress: string;
  enabled: boolean;
  minPaymentAmount: number;
  maxPaymentAmount: number;
  serviceTimeoutSeconds: number;
}

export interface PayForServiceParams {
  agentAddress: string;
  amount: number;
  serviceId: string;
}

export interface CallAgentServiceParams {
  callerAgentAddress: string;
  targetAgentAddress: string;
  amount: number;
  serviceId: string;
  serviceParams: Uint8Array;
}

export interface X402Event {
  type: 'PaymentReceived' | 'ServiceCalled' | 'ConfigUpdated';
  agent: string;
  payer?: string;
  amount?: number;
  serviceId?: string;
  timestamp: number;
}

