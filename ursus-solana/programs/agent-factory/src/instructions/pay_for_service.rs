use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer as TokenTransfer};
use crate::state::{X402Config, X402PaymentRecord, PaymentStatus, X402Error};

/// Pay for an agent service using X402 protocol
/// This instruction handles the payment verification and settlement
pub fn handler(
    ctx: Context<crate::PayForService>,
    amount: u64,
    service_id: String,
    nonce: u64,
) -> Result<()> {
    let x402_config = &mut ctx.accounts.x402_config;
    let payment_record = &mut ctx.accounts.payment_record;
    let clock = Clock::get()?;
    
    // Verify X402 is enabled
    require!(x402_config.enabled, X402Error::PaymentsNotEnabled);
    
    // Validate payment amount
    x402_config.validate_payment_amount(amount)?;
    
    // Verify nonce for replay protection
    require!(nonce == x402_config.nonce + 1, X402Error::NonceMismatch);
    
    // Validate service ID
    require!(service_id.len() > 0 && service_id.len() <= 32, X402Error::InvalidServiceId);

    // Transfer USDC from payer to payment recipient
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        TokenTransfer {
            from: ctx.accounts.payer_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;
    
    // Initialize payment record
    payment_record.agent = ctx.accounts.agent.key();
    payment_record.payer = ctx.accounts.payer.key();
    payment_record.amount = amount;
    payment_record.timestamp = clock.unix_timestamp;
    payment_record.service_id = service_id.clone();
    payment_record.status = PaymentStatus::Verified;
    payment_record.bump = ctx.bumps.payment_record;
    
    // Update X402 config
    x402_config.increment_nonce()?;
    x402_config.record_payment(amount)?;
    
    msg!("Payment processed: {} USDC (smallest units) for service: {}", amount, service_id);
    msg!("Payer: {}, Recipient: {}", ctx.accounts.payer.key(), ctx.accounts.recipient_token_account.key());
    
    Ok(())
}
