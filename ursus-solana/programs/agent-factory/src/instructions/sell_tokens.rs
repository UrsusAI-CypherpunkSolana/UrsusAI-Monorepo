use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn};
use crate::errors::AgentFactoryError;

pub fn handler(
    ctx: Context<crate::SellTokens>,
    token_amount: u64,
    min_sol_out: u64,
) -> Result<()> {
    require!(token_amount > 0, AgentFactoryError::InvalidSellAmount);
    
    let agent = &mut ctx.accounts.agent;
    
    // Check if agent is graduated
    require!(!agent.is_graduated, AgentFactoryError::AlreadyGraduated);

    // Calculate SOL to receive using bonding curve
    let sol_out = agent.bonding_curve.calculate_sell(token_amount)?;
    
    // Check slippage tolerance
    require!(sol_out >= min_sol_out, AgentFactoryError::SlippageExceeded);

    // Calculate fees (1% platform fee)
    let platform_fee = sol_out
        .checked_mul(100)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_div(10000)
        .ok_or(AgentFactoryError::MathOverflow)?;

    let creator_fee = sol_out
        .checked_mul(100)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_div(10000)
        .ok_or(AgentFactoryError::MathOverflow)?;

    let net_sol_out = sol_out
        .checked_sub(platform_fee)
        .ok_or(AgentFactoryError::MathOverflow)?
        .checked_sub(creator_fee)
        .ok_or(AgentFactoryError::MathOverflow)?;

    // Burn tokens from seller
    let cpi_accounts = Burn {
        mint: ctx.accounts.mint.to_account_info(),
        from: ctx.accounts.seller_token_account.to_account_info(),
        authority: ctx.accounts.seller.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::burn(cpi_ctx, token_amount)?;

    // Transfer SOL from agent to seller
    let agent_lamports = agent.to_account_info().lamports();
    require!(
        agent_lamports >= net_sol_out,
        AgentFactoryError::InsufficientLiquidity
    );

    **agent.to_account_info().try_borrow_mut_lamports()? -= net_sol_out;
    **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += net_sol_out;

    // Transfer platform fee
    if platform_fee > 0 {
        **agent.to_account_info().try_borrow_mut_lamports()? -= platform_fee;
        **ctx.accounts.platform_treasury.to_account_info().try_borrow_mut_lamports()? += platform_fee;
    }

    // Transfer creator fee
    if creator_fee > 0 {
        **agent.to_account_info().try_borrow_mut_lamports()? -= creator_fee;
        **ctx.accounts.creator.to_account_info().try_borrow_mut_lamports()? += creator_fee;
    }

    // Update bonding curve reserves
    agent.bonding_curve.update_after_sell(token_amount, sol_out)?;

    msg!("Tokens sold successfully!");
    msg!("Tokens sold: {}", token_amount);
    msg!("SOL received: {}", net_sol_out);
    msg!("Platform fee: {}", platform_fee);
    msg!("Creator fee: {}", creator_fee);
    msg!("New SOL reserves: {}", agent.bonding_curve.real_sol_reserves);
    msg!("New token reserves: {}", agent.bonding_curve.real_token_reserves);

    Ok(())
}

