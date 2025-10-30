use anchor_lang::prelude::*;
use super::BondingCurve;

#[account]
#[derive(InitSpace)]
pub struct Agent {
    /// Unique agent ID
    pub agent_id: u64,
    
    /// SPL Token mint address
    pub mint: Pubkey,
    
    /// Creator's wallet address
    pub creator: Pubkey,
    
    /// Agent name (max 32 chars)
    #[max_len(32)]
    pub name: String,
    
    /// Token symbol (max 10 chars)
    #[max_len(10)]
    pub symbol: String,
    
    /// Agent description (max 200 chars)
    #[max_len(200)]
    pub description: String,
    
    /// AI instructions/prompt (max 500 chars)
    #[max_len(500)]
    pub instructions: String,
    
    /// AI model used (max 20 chars)
    #[max_len(20)]
    pub model: String,
    
    /// Category (max 20 chars)
    #[max_len(20)]
    pub category: String,
    
    /// Creation timestamp
    pub created_at: i64,
    
    /// Whether agent has graduated to DEX
    pub is_graduated: bool,
    
    /// Bonding curve parameters
    pub bonding_curve: BondingCurve,
    
    /// Bump seed for PDA
    pub bump: u8,
}

impl Agent {
    pub const INIT_SPACE: usize = 
        8 +           // agent_id
        32 +          // mint
        32 +          // creator
        4 + 32 +      // name
        4 + 10 +      // symbol
        4 + 200 +     // description
        4 + 500 +     // instructions
        4 + 20 +      // model
        4 + 20 +      // category
        8 +           // created_at
        1 +           // is_graduated
        BondingCurve::INIT_SPACE + // bonding_curve
        1;            // bump

    /// Check if agent can be graduated to DEX
    pub fn can_graduate(&self) -> bool {
        !self.is_graduated && 
        self.bonding_curve.real_sol_reserves >= self.bonding_curve.graduation_threshold
    }
}

