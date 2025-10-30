use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, MintTo};
use crate::errors::AgentFactoryError;

pub fn handler(
    ctx: Context<crate::BuyTokens>,
    sol_amount: u64,
    min_tokens_out: u64,
) -> Result<()> {
    require!(sol_amount > 0, AgentFactoryError::InvalidBuyAmount);

    // Check if agent is graduated
    require!(!ctx.accounts.agent.is_graduated, AgentFactoryError::AlreadyGraduated);

    // Calculate tokens to receive using bonding curve
    let tokens_out = ctx.accounts.agent.bonding_curve.calculate_buy(sol_amount)?;
    
    // Check slippage tolerance
    require!(tokens_out >= min_tokens_out, AgentFactoryError::SlippageExceeded);

    // Calculate fees (1% platform fee)
    let platform_fee = sol_amount
        .checked_mul(100)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_div(10000)
        .ok_or(AgentFactoryError::MathOverflow)?;

    let creator_fee = sol_amount
        .checked_mul(100)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_div(10000)
        .ok_or(AgentFactoryError::MathOverflow)?;

    let net_sol_amount = sol_amount
        .checked_sub(platform_fee)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_sub(creator_fee)
        .ok_or(AgentFactoryError::MathOverflow)?;

    // Transfer SOL from buyer to agent (bonding curve reserves)
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.agent.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, net_sol_amount)?;

    // Transfer platform fee
    if platform_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, platform_fee)?;
    }

    // Transfer creator fee
    if creator_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, creator_fee)?;
    }

    // Mint tokens to buyer
    let agent_id_bytes = ctx.accounts.agent.agent_id.to_le_bytes();
    let agent_bump = ctx.accounts.agent.bump;
    let seeds = &[
        b"agent",
        agent_id_bytes.as_ref(),
        &[agent_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: ctx.accounts.agent.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
    token::mint_to(cpi_ctx, tokens_out)?;

    // Update bonding curve reserves
    ctx.accounts.agent.bonding_curve.update_after_buy(net_sol_amount, tokens_out)?;

    msg!("Tokens purchased successfully!");
    msg!("SOL amount: {}", sol_amount);
    msg!("Tokens received: {}", tokens_out);
    msg!("Platform fee: {}", platform_fee);
    msg!("Creator fee: {}", creator_fee);
    msg!("New SOL reserves: {}", ctx.accounts.agent.bonding_curve.real_sol_reserves);
    msg!("New token reserves: {}", ctx.accounts.agent.bonding_curve.real_token_reserves);

    Ok(())
}

