use anchor_lang::prelude::*;
use crate::state::X402Config;

/// Update X402 payment settings for an agent
pub fn handler(
    ctx: Context<crate::UpdateX402>,
    enabled: bool,
    min_payment_amount: u64,
    max_payment_amount: u64,
    service_timeout_seconds: u64,
) -> Result<()> {
    let x402_config = &mut ctx.accounts.x402_config;
    let agent = &ctx.accounts.agent;
    
    // Update settings
    x402_config.enabled = enabled;
    x402_config.min_payment_amount = min_payment_amount;
    x402_config.max_payment_amount = max_payment_amount;
    x402_config.service_timeout_seconds = service_timeout_seconds;
    
    msg!("X402 updated for agent: {}", agent.key());
    msg!("Enabled: {}, Min: {}, Max: {}", enabled, min_payment_amount, max_payment_amount);
    
    Ok(())
}

