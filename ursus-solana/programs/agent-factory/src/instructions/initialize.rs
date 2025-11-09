use anchor_lang::prelude::*;

pub fn handler(ctx: Context<crate::Initialize>, creation_fee: u64) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    
    factory.authority = ctx.accounts.authority.key();
    factory.platform_treasury = ctx.accounts.platform_treasury.key();
    factory.creation_fee = creation_fee;
    factory.total_agents = 0;
    factory.bump = ctx.bumps.factory;

    msg!("Agent Factory initialized!");
    msg!("Authority: {}", factory.authority);
    msg!("Platform Treasury: {}", factory.platform_treasury);
    msg!("Creation Fee: {} lamports", factory.creation_fee);

    Ok(())
}

