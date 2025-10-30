use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};

declare_id!("GXMVNLiogZ2vinezusVGDkdDcSk1hJKHtj616iWq3345");

pub mod instructions;
pub mod state;
pub mod errors;

use instructions::*;
use state::*;
use errors::*;

#[program]
pub mod agent_factory {
    use super::*;

    /// Initialize the Agent Factory
    pub fn initialize(ctx: Context<Initialize>, creation_fee: u64) -> Result<()> {
        instructions::initialize::handler(ctx, creation_fee)
    }

    /// Create a new AI Agent with bonding curve
    pub fn create_agent(
        ctx: Context<CreateAgent>,
        name: String,
        symbol: String,
        description: String,
        agent_instructions: String,
        model: String,
        category: String,
    ) -> Result<()> {
        instructions::create_agent::handler(
            ctx,
            &name,
            &symbol,
            &description,
            &agent_instructions,
            &model,
            &category,
        )
    }

    /// Buy agent tokens using bonding curve
    pub fn buy_tokens(ctx: Context<BuyTokens>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        instructions::buy_tokens::handler(ctx, sol_amount, min_tokens_out)
    }

    /// Sell agent tokens using bonding curve
    pub fn sell_tokens(ctx: Context<SellTokens>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        instructions::sell_tokens::handler(ctx, token_amount, min_sol_out)
    }

    /// Graduate agent to DEX when threshold is reached
    pub fn graduate_agent(ctx: Context<GraduateAgent>) -> Result<()> {
        instructions::graduate_agent::handler(ctx)
    }

    /// Update platform fee
    pub fn update_creation_fee(ctx: Context<UpdateFee>, new_fee: u64) -> Result<()> {
        instructions::update_fee::handler(ctx, new_fee)
    }
}

// ============================================================================
// Initialize Instruction
// ============================================================================

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + AgentFactory::INIT_SPACE,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Account<'info, AgentFactory>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Platform treasury account
    pub platform_treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// Create Agent Instruction
// ============================================================================

#[derive(Accounts)]
pub struct CreateAgent<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Account<'info, AgentFactory>,

    #[account(
        init,
        payer = creator,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", factory.total_agents.to_le_bytes().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 9,
        mint::authority = agent,
        seeds = [b"mint", agent.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Platform treasury
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

// ============================================================================
// Buy Tokens Instruction
// ============================================================================

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        address = agent.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = buyer
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Creator receives fees
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// CHECK: Platform treasury receives fees
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Sell Tokens Instruction
// ============================================================================

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        address = agent.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = seller
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller: Signer<'info>,

    /// CHECK: Creator receives fees
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    /// CHECK: Platform treasury receives fees
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Graduate Agent Instruction
// ============================================================================

#[derive(Accounts)]
pub struct GraduateAgent<'info> {
    #[account(
        mut,
        constraint = !agent.is_graduated @ AgentFactoryError::AlreadyGraduated
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        address = agent.mint
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: DEX program for liquidity
    pub dex_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ============================================================================
// Update Fee Instruction
// ============================================================================

#[derive(Accounts)]
pub struct UpdateFee<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
        has_one = authority
    )]
    pub factory: Account<'info, AgentFactory>,

    pub authority: Signer<'info>,
}

