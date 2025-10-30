use anchor_lang::prelude::*;

/// Bonding curve parameters for pump.fun style pricing
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct BondingCurve {
    /// Virtual SOL reserves for price calculation
    pub virtual_sol_reserves: u64,
    
    /// Virtual token reserves for price calculation
    pub virtual_token_reserves: u64,
    
    /// Real SOL reserves (actual balance)
    pub real_sol_reserves: u64,
    
    /// Real token reserves (tokens in bonding curve)
    pub real_token_reserves: u64,
    
    /// SOL threshold to graduate to DEX (e.g., 30,000 SOL)
    pub graduation_threshold: u64,
    
    /// Total tokens for bonding curve (e.g., 800M tokens)
    pub bonding_curve_supply: u64,
    
    /// Total token supply (e.g., 1B tokens)
    pub total_supply: u64,
}

impl BondingCurve {
    pub const INIT_SPACE: usize = 8 + 8 + 8 + 8 + 8 + 8 + 8;

    /// Create new bonding curve with pump.fun parameters
    pub fn new() -> Self {
        const LAMPORTS_PER_SOL: u64 = 1_000_000_000;
        const TOKEN_DECIMALS: u64 = 1_000_000_000; // 9 decimals
        
        Self {
            // 30 SOL virtual reserves
            virtual_sol_reserves: 30 * LAMPORTS_PER_SOL,
            
            // 1.073B tokens virtual reserves
            virtual_token_reserves: 1_073_000_000 * TOKEN_DECIMALS,
            
            // Start with 0 real SOL
            real_sol_reserves: 0,
            
            // 800M tokens for bonding curve
            real_token_reserves: 800_000_000 * TOKEN_DECIMALS,
            
            // Graduate at 30,000 SOL (~$30,000)
            graduation_threshold: 30_000 * LAMPORTS_PER_SOL,
            
            // 800M tokens for bonding curve
            bonding_curve_supply: 800_000_000 * TOKEN_DECIMALS,
            
            // 1B total supply
            total_supply: 1_000_000_000 * TOKEN_DECIMALS,
        }
    }

    /// Calculate tokens received for SOL amount (constant product formula)
    /// Formula: tokens_out = virtual_token_reserves - (virtual_sol_reserves * virtual_token_reserves) / (virtual_sol_reserves + sol_in)
    pub fn calculate_buy(&self, sol_amount: u64) -> Result<u64> {
        let new_sol_reserves = self.virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        let product = (self.virtual_sol_reserves as u128)
            .checked_mul(self.virtual_token_reserves as u128)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        let new_token_reserves = product
            .checked_div(new_sol_reserves as u128)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))? as u64;

        let tokens_out = self.virtual_token_reserves
            .checked_sub(new_token_reserves)
            .ok_or(error!(crate::errors::AgentFactoryError::InsufficientLiquidity))?;

        Ok(tokens_out)
    }

    /// Calculate SOL received for token amount (constant product formula)
    /// Formula: sol_out = virtual_sol_reserves - (virtual_sol_reserves * virtual_token_reserves) / (virtual_token_reserves + tokens_in)
    pub fn calculate_sell(&self, token_amount: u64) -> Result<u64> {
        let new_token_reserves = self.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        let product = (self.virtual_sol_reserves as u128)
            .checked_mul(self.virtual_token_reserves as u128)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        let new_sol_reserves = product
            .checked_div(new_token_reserves as u128)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))? as u64;

        let sol_out = self.virtual_sol_reserves
            .checked_sub(new_sol_reserves)
            .ok_or(error!(crate::errors::AgentFactoryError::InsufficientLiquidity))?;

        Ok(sol_out)
    }

    /// Update reserves after buy
    pub fn update_after_buy(&mut self, sol_amount: u64, tokens_out: u64) -> Result<()> {
        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_add(sol_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_sub(tokens_out)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_add(sol_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.real_token_reserves = self.real_token_reserves
            .checked_sub(tokens_out)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        Ok(())
    }

    /// Update reserves after sell
    pub fn update_after_sell(&mut self, token_amount: u64, sol_out: u64) -> Result<()> {
        self.virtual_token_reserves = self.virtual_token_reserves
            .checked_add(token_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.virtual_sol_reserves = self.virtual_sol_reserves
            .checked_sub(sol_out)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.real_token_reserves = self.real_token_reserves
            .checked_add(token_amount)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        self.real_sol_reserves = self.real_sol_reserves
            .checked_sub(sol_out)
            .ok_or(error!(crate::errors::AgentFactoryError::MathOverflow))?;

        Ok(())
    }

    /// Get current price (SOL per token)
    pub fn get_current_price(&self) -> u64 {
        if self.virtual_token_reserves == 0 {
            return 0;
        }
        
        // Price = virtual_sol_reserves / virtual_token_reserves
        ((self.virtual_sol_reserves as u128)
            .checked_mul(1_000_000_000) // Scale for precision
            .unwrap_or(0) / self.virtual_token_reserves as u128) as u64
    }

    /// Get market cap in SOL
    pub fn get_market_cap(&self) -> u64 {
        let price = self.get_current_price();
        let circulating_supply = self.bonding_curve_supply
            .checked_sub(self.real_token_reserves)
            .unwrap_or(0);
        
        ((circulating_supply as u128)
            .checked_mul(price as u128)
            .unwrap_or(0) / 1_000_000_000) as u64
    }
}

impl Default for BondingCurve {
    fn default() -> Self {
        Self::new()
    }
}

