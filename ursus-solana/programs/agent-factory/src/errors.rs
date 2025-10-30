use anchor_lang::prelude::*;

#[error_code]
pub enum AgentFactoryError {
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Insufficient liquidity in bonding curve")]
    InsufficientLiquidity,
    
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    
    #[msg("Agent already graduated to DEX")]
    AlreadyGraduated,
    
    #[msg("Agent cannot graduate yet - threshold not reached")]
    CannotGraduate,
    
    #[msg("Invalid agent name")]
    InvalidName,
    
    #[msg("Invalid token symbol")]
    InvalidSymbol,
    
    #[msg("Description too long")]
    DescriptionTooLong,
    
    #[msg("Instructions too long")]
    InstructionsTooLong,
    
    #[msg("Invalid creation fee")]
    InvalidCreationFee,
    
    #[msg("Insufficient funds for creation fee")]
    InsufficientFunds,
    
    #[msg("Invalid buy amount")]
    InvalidBuyAmount,
    
    #[msg("Invalid sell amount")]
    InvalidSellAmount,
    
    #[msg("Maximum buy amount exceeded")]
    MaxBuyExceeded,
}

