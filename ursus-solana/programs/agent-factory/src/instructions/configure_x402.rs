use anchor_lang::prelude::*;
use crate::state::{X402Config};

/// Configure X402 payment settings for an agent (first time setup)
pub fn handler(
    ctx: Context<crate::ConfigureX402>,
    enabled: bool,
    min_payment_amount: u64,
    max_payment_amount: u64,
    service_timeout_seconds: u64,
) -> Result<()> {
    let x402_config = &mut ctx.accounts.x402_config;
    let agent = &ctx.accounts.agent;

    // Initialize X402 config
    x402_config.agent = agent.key();
    x402_config.payment_recipient = ctx.accounts.authority.key();
    x402_config.enabled = enabled;
    x402_config.min_payment_amount = min_payment_amount;
    x402_config.max_payment_amount = max_payment_amount;
    x402_config.service_timeout_seconds = service_timeout_seconds;
    x402_config.total_payments_received = 0;
    x402_config.total_service_calls = 0;
    x402_config.nonce = 0;
    x402_config.bump = ctx.bumps.x402_config;

    msg!("X402 configured for agent: {}", agent.key());
    msg!("Enabled: {}, Min: {}, Max: {}", enabled, min_payment_amount, max_payment_amount);

    Ok(())
}
