use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::BondingCurve;
use crate::errors::AgentFactoryError;

pub fn handler(
    ctx: Context<crate::CreateAgent>,
    name: &str,
    symbol: &str,
    description: &str,
    instructions: &str,
    model: &str,
    category: &str,
) -> Result<()> {
    // Validate inputs
    require!(name.len() > 0 && name.len() <= 32, AgentFactoryError::InvalidName);
    require!(symbol.len() > 0 && symbol.len() <= 10, AgentFactoryError::InvalidSymbol);
    require!(description.len() <= 200, AgentFactoryError::DescriptionTooLong);
    require!(instructions.len() <= 500, AgentFactoryError::InstructionsTooLong);

    let factory = &mut ctx.accounts.factory;
    let agent = &mut ctx.accounts.agent;

    // Transfer creation fee to platform treasury
    if factory.creation_fee > 0 {
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.creator.to_account_info(),
                to: ctx.accounts.platform_treasury.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, factory.creation_fee)?;
    }

    // Initialize agent
    agent.agent_id = factory.total_agents;
    agent.mint = ctx.accounts.mint.key();
    agent.creator = ctx.accounts.creator.key();
    agent.name = name.to_string();
    agent.symbol = symbol.to_string();
    agent.description = description.to_string();
    agent.instructions = instructions.to_string();
    agent.model = model.to_string();
    agent.category = category.to_string();
    agent.created_at = Clock::get()?.unix_timestamp;
    agent.is_graduated = false;
    agent.bonding_curve = BondingCurve::new();
    agent.bump = ctx.bumps.agent;

    // Increment total agents
    factory.total_agents = factory.total_agents
        .checked_add(1)
        .ok_or(AgentFactoryError::MathOverflow)?;

    msg!("Agent created successfully!");
    msg!("Agent ID: {}", agent.agent_id);
    msg!("Name: {}", name);
    msg!("Symbol: {}", symbol);
    msg!("Mint: {}", agent.mint);
    msg!("Creator: {}", agent.creator);

    Ok(())
}

