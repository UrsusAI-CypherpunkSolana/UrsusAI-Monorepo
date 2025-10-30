import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { AGENT_FACTORY_PROGRAM_ID } from '../config/solana';

/**
 * Hook to get Anchor program instance
 * Replaces useContract hook for EVM
 */
export const useSolanaProgram = (idl?: Idl) => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet || !idl) return null;

    const provider = new AnchorProvider(
      connection,
      wallet,
      { commitment: 'confirmed' }
    );

    return new Program(idl, AGENT_FACTORY_PROGRAM_ID, provider);
  }, [connection, wallet, idl]);

  return program;
};

export default useSolanaProgram;

