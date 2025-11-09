use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

declare_id!("4m6mpe2jdRiM24ui1Z3AGbCheu1DfQEjmEGtaGKD2ftU");

pub mod instructions;
pub mod state;
pub mod errors;

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

    // ============================================================================
    // X402 Payment Protocol Instructions
    // ============================================================================

    /// Configure X402 payment settings for an agent
    pub fn configure_x402(
        ctx: Context<ConfigureX402>,
        enabled: bool,
        min_payment_amount: u64,
        max_payment_amount: u64,
        service_timeout_seconds: u64,
    ) -> Result<()> {
        instructions::configure_x402::handler(
            ctx,
            enabled,
            min_payment_amount,
            max_payment_amount,
            service_timeout_seconds,
        )
    }

    /// Update X402 payment settings for an agent
    pub fn update_x402(
        ctx: Context<UpdateX402>,
        enabled: bool,
        min_payment_amount: u64,
        max_payment_amount: u64,
        service_timeout_seconds: u64,
    ) -> Result<()> {
        instructions::update_x402::handler(
            ctx,
            enabled,
            min_payment_amount,
            max_payment_amount,
            service_timeout_seconds,
        )
    }

    /// Pay for an agent service using X402 protocol
    pub fn pay_for_service(
        ctx: Context<PayForService>,
        amount: u64,
        service_id: String,
        nonce: u64,
    ) -> Result<()> {
        instructions::pay_for_service::handler(ctx, amount, service_id, nonce)
    }

    /// Call an agent service with payment (Agent-to-Agent interaction)
    pub fn call_agent_service(
        ctx: Context<CallAgentService>,
        amount: u64,
        service_id: String,
        nonce: u64,
        service_params: Vec<u8>,
    ) -> Result<()> {
        instructions::call_agent_service::handler(ctx, amount, service_id, nonce, service_params)
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

// ============================================================================
// X402 Payment Protocol Instructions
// ============================================================================

#[derive(Accounts)]
#[instruction(enabled: bool, min_payment_amount: u64, max_payment_amount: u64, service_timeout_seconds: u64)]
pub struct ConfigureX402<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = authority,
        space = 8 + X402Config::INIT_SPACE,
        seeds = [b"x402_config", agent.key().as_ref()],
        bump
    )]
    pub x402_config: Account<'info, X402Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(enabled: bool, min_payment_amount: u64, max_payment_amount: u64, service_timeout_seconds: u64)]
pub struct UpdateX402<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"x402_config", agent.key().as_ref()],
        bump = x402_config.bump
    )]
    pub x402_config: Account<'info, X402Config>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(amount: u64, service_id: String, nonce: u64)]
pub struct PayForService<'info> {
    #[account(mut)]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"x402_config", agent.key().as_ref()],
        bump = x402_config.bump
    )]
    pub x402_config: Account<'info, X402Config>,

    #[account(
        init,
        payer = payer,
        space = 8 + X402PaymentRecord::INIT_SPACE,
        seeds = [
            b"payment_record",
            agent.key().as_ref(),
            payer.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub payment_record: Account<'info, X402PaymentRecord>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// Payer's USDC token account
    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,

    /// Recipient's USDC token account
    #[account(
        mut,
        constraint = recipient_token_account.owner == x402_config.payment_recipient @ X402Error::InvalidServiceId
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, service_id: String, nonce: u64, service_params: Vec<u8>)]
pub struct CallAgentService<'info> {
    #[account(mut)]
    pub caller_agent: Account<'info, Agent>,

    #[account(mut)]
    pub target_agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [b"x402_config", target_agent.key().as_ref()],
        bump = target_x402_config.bump
    )]
    pub target_x402_config: Account<'info, X402Config>,

    #[account(
        init,
        payer = caller_authority,
        space = 8 + X402PaymentRecord::INIT_SPACE,
        seeds = [
            b"payment_record",
            target_agent.key().as_ref(),
            caller_agent.key().as_ref(),
            &nonce.to_le_bytes()
        ],
        bump
    )]
    pub payment_record: Account<'info, X402PaymentRecord>,

    #[account(
        mut,
        constraint = caller_authority.key() == caller_agent.creator @ X402Error::InvalidServiceId
    )]
    pub caller_authority: Signer<'info>,

    /// Caller's USDC token account
    #[account(mut)]
    pub caller_token_account: Account<'info, TokenAccount>,

    /// Target's USDC token account
    #[account(
        mut,
        constraint = target_token_account.owner == target_x402_config.payment_recipient @ X402Error::InvalidServiceId
    )]
    pub target_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

