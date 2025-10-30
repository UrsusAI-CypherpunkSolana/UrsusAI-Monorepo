use anchor_lang::prelude::*;

pub fn handler(ctx: Context<crate::UpdateFee>, new_fee: u64) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    
    let old_fee = factory.creation_fee;
    factory.creation_fee = new_fee;

    msg!("Creation fee updated!");
    msg!("Old fee: {} lamports", old_fee);
    msg!("New fee: {} lamports", new_fee);

    Ok(())
}

