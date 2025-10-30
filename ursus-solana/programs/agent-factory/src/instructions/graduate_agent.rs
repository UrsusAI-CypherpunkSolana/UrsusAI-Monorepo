use anchor_lang::prelude::*;
use crate::errors::AgentFactoryError;

pub fn handler(ctx: Context<crate::GraduateAgent>) -> Result<()> {
    let agent = &mut ctx.accounts.agent;
    
    // Check if agent can graduate
    require!(agent.can_graduate(), AgentFactoryError::CannotGraduate);

    // Mark as graduated
    agent.is_graduated = true;

    msg!("Agent graduated to DEX!");
    msg!("Agent ID: {}", agent.agent_id);
    msg!("Final SOL reserves: {}", agent.bonding_curve.real_sol_reserves);
    msg!("Tokens for DEX liquidity: {}", agent.bonding_curve.real_token_reserves);

    // TODO: Integrate with Raydium/Orca to create liquidity pool
    // This would involve:
    // 1. Creating a liquidity pool on the DEX
    // 2. Transferring SOL and tokens to the pool
    // 3. Burning LP tokens or sending to creator
    
    Ok(())
}

