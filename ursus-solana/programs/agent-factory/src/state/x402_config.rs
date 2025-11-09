use anchor_lang::prelude::*;

/// X402 Payment Configuration for an Agent
/// This structure holds the payment settings for agent services
#[account]
#[derive(InitSpace)]
pub struct X402Config {
    /// Agent this config belongs to
    pub agent: Pubkey,
    
    /// Payment recipient address (usually the agent creator)
    pub payment_recipient: Pubkey,
    
    /// Whether X402 payments are enabled for this agent
    pub enabled: bool,
    
    /// Minimum payment amount in lamports
    pub min_payment_amount: u64,
    
    /// Maximum payment amount in lamports (0 = no limit)
    pub max_payment_amount: u64,
    
    /// Service timeout in seconds
    pub service_timeout_seconds: u64,
    
    /// Total payments received
    pub total_payments_received: u64,
    
    /// Total number of service calls
    pub total_service_calls: u64,
    
    /// Nonce for replay protection
    pub nonce: u64,
    
    /// Bump seed for PDA
    pub bump: u8,
}

impl X402Config {
    pub const INIT_SPACE: usize = 
        32 +    // agent
        32 +    // payment_recipient
        1 +     // enabled
        8 +     // min_payment_amount
        8 +     // max_payment_amount
        8 +     // service_timeout_seconds
        8 +     // total_payments_received
        8 +     // total_service_calls
        8 +     // nonce
        1;      // bump

    /// Validate payment amount
    pub fn validate_payment_amount(&self, amount: u64) -> Result<()> {
        require!(amount >= self.min_payment_amount, X402Error::PaymentTooLow);
        
        if self.max_payment_amount > 0 {
            require!(amount <= self.max_payment_amount, X402Error::PaymentTooHigh);
        }
        
        Ok(())
    }

    /// Increment nonce for replay protection
    pub fn increment_nonce(&mut self) -> Result<u64> {
        self.nonce = self.nonce.checked_add(1)
            .ok_or(X402Error::NonceOverflow)?;
        Ok(self.nonce)
    }

    /// Record a successful payment
    pub fn record_payment(&mut self, amount: u64) -> Result<()> {
        self.total_payments_received = self.total_payments_received
            .checked_add(amount)
            .ok_or(X402Error::MathOverflow)?;
        
        self.total_service_calls = self.total_service_calls
            .checked_add(1)
            .ok_or(X402Error::MathOverflow)?;
        
        Ok(())
    }
}

/// X402 Payment Record - stores individual payment details
#[account]
#[derive(InitSpace)]
pub struct X402PaymentRecord {
    /// Agent that received the payment
    pub agent: Pubkey,
    
    /// Payer address
    pub payer: Pubkey,
    
    /// Payment amount in lamports
    pub amount: u64,
    
    /// Timestamp of payment
    pub timestamp: i64,
    
    /// Service identifier (hash of service name)
    #[max_len(32)]
    pub service_id: String,
    
    /// Payment status
    pub status: PaymentStatus,

    /// Bump seed for PDA
    pub bump: u8,
}

impl X402PaymentRecord {
    pub const INIT_SPACE: usize =
        32 +        // agent
        32 +        // payer
        8 +         // amount
        8 +         // timestamp
        4 + 32 +    // service_id
        1 +         // status
        1;          // bump
}

/// Payment status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PaymentStatus {
    /// Payment is pending verification
    Pending,
    /// Payment has been verified
    Verified,
    /// Payment has been settled
    Settled,
    /// Payment failed
    Failed,
}

/// X402 specific errors
#[error_code]
pub enum X402Error {
    #[msg("Payment amount is below minimum")]
    PaymentTooLow,
    
    #[msg("Payment amount exceeds maximum")]
    PaymentTooHigh,
    
    #[msg("X402 payments not enabled for this agent")]
    PaymentsNotEnabled,
    
    #[msg("Invalid payment signature")]
    InvalidPaymentSignature,
    
    #[msg("Payment has expired")]
    PaymentExpired,
    
    #[msg("Nonce mismatch - possible replay attack")]
    NonceMismatch,
    
    #[msg("Nonce overflow")]
    NonceOverflow,
    
    #[msg("Math operation overflow")]
    MathOverflow,
    
    #[msg("Service timeout exceeded")]
    ServiceTimeout,
    
    #[msg("Invalid service identifier")]
    InvalidServiceId,
    
    #[msg("Payment already settled")]
    PaymentAlreadySettled,
    
    #[msg("Insufficient payment amount")]
    InsufficientPayment,
}

