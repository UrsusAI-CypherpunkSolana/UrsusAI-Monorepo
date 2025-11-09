use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as TokenTransfer};
use crate::state::{X402Config, X402PaymentRecord, PaymentStatus, X402Error};

/// Call an agent service with payment (Agent-to-Agent interaction)
/// This enables AI agents to pay each other for services
pub fn handler(
    ctx: Context<crate::CallAgentService>,
    amount: u64,
    service_id: String,
    nonce: u64,
    service_params: Vec<u8>, // Serialized service parameters
) -> Result<()> {
    let x402_config = &mut ctx.accounts.target_x402_config;
    let payment_record = &mut ctx.accounts.payment_record;
    let clock = Clock::get()?;
    
    // Verify X402 is enabled for target agent
    require!(x402_config.enabled, X402Error::PaymentsNotEnabled);
    
    // Validate payment amount
    x402_config.validate_payment_amount(amount)?;
    
    // Verify nonce for replay protection
    require!(nonce == x402_config.nonce + 1, X402Error::NonceMismatch);
    
    // Validate service ID
    require!(service_id.len() > 0 && service_id.len() <= 32, X402Error::InvalidServiceId);
    
    // Validate service params size (max 1KB)
    require!(service_params.len() <= 1024, X402Error::InvalidServiceId);

    // Transfer USDC from caller to target agent's payment recipient
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.caller_token_account.to_account_info(),
            to: ctx.accounts.target_token_account.to_account_info(),
            authority: ctx.accounts.caller_authority.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;
    
    // Initialize payment record
    payment_record.agent = ctx.accounts.target_agent.key();
    payment_record.payer = ctx.accounts.caller_agent.key();
    payment_record.amount = amount;
    payment_record.timestamp = clock.unix_timestamp;
    payment_record.service_id = service_id.clone();
    payment_record.status = PaymentStatus::Settled;
    payment_record.bump = ctx.bumps.payment_record;
    
    // Update target agent's X402 config
    x402_config.increment_nonce()?;
    x402_config.record_payment(amount)?;
    
    msg!("Agent-to-Agent service call completed");
    msg!("Caller: {}, Target: {}", ctx.accounts.caller_agent.key(), ctx.accounts.target_agent.key());
    msg!("Service: {}, Amount: {} USDC (smallest units)", service_id, amount);
    
    // Emit event for off-chain processing
    emit!(AgentServiceCallEvent {
        caller_agent: ctx.accounts.caller_agent.key(),
        target_agent: ctx.accounts.target_agent.key(),
        service_id,
        amount,
        timestamp: clock.unix_timestamp,
        service_params,
    });
    
    Ok(())
}

/// Event emitted when an agent calls another agent's service
#[event]
pub struct AgentServiceCallEvent {
    pub caller_agent: Pubkey,
    pub target_agent: Pubkey,
    pub service_id: String,
    pub amount: u64,
    pub timestamp: i64,
    pub service_params: Vec<u8>,
}
