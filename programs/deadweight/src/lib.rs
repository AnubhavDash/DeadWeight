// Deadweight — on-chain notary for a pricing verdict.
//
// This program records what a proposed in-kind donation was *priced at*. It is
// not a donation channel: no lamports move except the rent the donor pays to
// open their own pledge account, and there is no withdraw instruction because
// there is nothing to withdraw. Deployed to devnet only, as a demonstration.
//
// Why put a verdict on a chain at all: the interesting number in this project is
// the gap between what a donor believes they gave and what actually arrives.
// That gap is embarrassing, which is exactly why it tends not to be published.
// A public append-only ledger makes the claim checkable by anyone later.
//
// The program does not trust the client's verdict. `commit_pledge` re-derives it
// from the declared and net figures with the same rule the TypeScript engine
// uses, and rejects the instruction if they disagree — so nobody can post a
// flattering label over a losing manifest.
//
// Money is integer US cents everywhere, matching lib/money.ts. `net_usd_cents`
// is signed, because a consignment can be worth less than nothing.

use anchor_lang::prelude::*;

declare_id!("DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F");

pub const REGISTRY_SEED: &[u8] = b"registry";
pub const PLEDGE_SEED: &[u8] = b"pledge";

/// Lines per pledge. A manifest with more than this is summarised client-side
/// before it is committed; the account is fixed-size so the rent is knowable.
pub const MAX_LINES: usize = 8;
/// Longest catalogue id the account will store, e.g. `purification-tablets`.
pub const MAX_ITEM_ID: usize = 32;

/// The efficiency at or above which a consignment counts as landing, in
/// hundredths. Kept in the same shape as `verdictFor` in lib/logistics.ts.
pub const LANDS_THRESHOLD_PERCENT: i128 = 60;

#[program]
pub mod deadweight {
    use super::*;

    /// Open the singleton registry. Idempotent by construction: the PDA has one
    /// address, so a second call fails at account creation.
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.authority = ctx.accounts.authority.key();
        registry.pledge_count = 0;
        registry.declared_total_cents = 0;
        registry.net_total_cents = 0;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    /// Notarise one priced manifest.
    ///
    /// `index` must equal the registry's current count, which makes the ledger a
    /// genuine append-only sequence rather than a bag of PDAs: a client cannot
    /// quietly skip an unflattering entry and keep numbering.
    pub fn commit_pledge(ctx: Context<CommitPledge>, index: u64, args: PledgeArgs) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        require_eq!(index, registry.pledge_count, DeadweightError::IndexOutOfOrder);

        require!(!args.lines.is_empty(), DeadweightError::EmptyManifest);
        require!(args.lines.len() <= MAX_LINES, DeadweightError::TooManyLines);
        require!(args.declared_usd_cents > 0, DeadweightError::DeclaredNotPositive);

        for line in args.lines.iter() {
            require!(!line.item_id.is_empty(), DeadweightError::EmptyItemId);
            require!(line.item_id.len() <= MAX_ITEM_ID, DeadweightError::ItemIdTooLong);
            require!(line.quantity > 0, DeadweightError::ZeroQuantity);
        }

        // The verdict is re-derived here, not accepted. Widened to i128 so the
        // threshold multiply cannot overflow at any i64 the client can send.
        let declared = i128::from(args.declared_usd_cents);
        let net = i128::from(args.net_usd_cents);
        let derived = if net < 0 {
            Verdict::BecomesAsh
        } else if net * 100 >= declared * LANDS_THRESHOLD_PERCENT {
            Verdict::Lands
        } else {
            Verdict::Burdens
        };
        require!(derived == args.verdict, DeadweightError::VerdictDoesNotFollow);

        let pledge = &mut ctx.accounts.pledge;
        pledge.donor = ctx.accounts.donor.key();
        pledge.index = index;
        pledge.declared_usd_cents = args.declared_usd_cents;
        pledge.net_usd_cents = args.net_usd_cents;
        pledge.gross_weight_grams = args.gross_weight_grams;
        pledge.mode = args.mode;
        pledge.bias = args.bias;
        pledge.verdict = derived;
        pledge.manifest_hash = args.manifest_hash;
        pledge.lines = args.lines;
        pledge.committed_at = Clock::get()?.unix_timestamp;
        pledge.bump = ctx.bumps.pledge;

        registry.pledge_count = registry
            .pledge_count
            .checked_add(1)
            .ok_or(DeadweightError::ArithmeticOverflow)?;
        registry.declared_total_cents = registry
            .declared_total_cents
            .checked_add(declared)
            .ok_or(DeadweightError::ArithmeticOverflow)?;
        registry.net_total_cents = registry
            .net_total_cents
            .checked_add(net)
            .ok_or(DeadweightError::ArithmeticOverflow)?;

        emit!(PledgeCommitted {
            donor: pledge.donor,
            index: pledge.index,
            declared_usd_cents: pledge.declared_usd_cents,
            net_usd_cents: pledge.net_usd_cents,
            gross_weight_grams: pledge.gross_weight_grams,
            verdict: pledge.verdict,
            committed_at: pledge.committed_at,
        });

        Ok(())
    }
}

/* ---------------------------------------------------------------------------
   Instruction data
   --------------------------------------------------------------------------- */

/// One catalogue line, as the manifest builder had it.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq, InitSpace)]
pub struct LineItem {
    /// Kept in step with `MAX_ITEM_ID`; `max_len` takes a literal.
    #[max_len(32)]
    pub item_id: String,
    pub quantity: u32,
}

/// How the consignment travels. Nepal is landlocked, so `SeaPlusRoad` is a sea
/// leg to Kolkata and a road leg over Birgunj–Raxaul.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Mode {
    Air,
    Road,
    SeaPlusRoad,
}

/// Which end of every sourced range the pricing used. Recorded because a verdict
/// without it is not checkable.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Bias {
    Generous,
    Midpoint,
    Harsh,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum Verdict {
    Lands,
    Burdens,
    BecomesAsh,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct PledgeArgs {
    /// What the donor says the goods are worth, in US cents. Always positive.
    pub declared_usd_cents: i64,
    /// What arrives, net of freight, sorting, storage and disposal, in US cents.
    /// Signed: a consignment that costs more to handle than it delivers is
    /// negative, and that is the number this whole project exists to publish.
    pub net_usd_cents: i64,
    pub gross_weight_grams: u64,
    pub mode: Mode,
    pub bias: Bias,
    pub verdict: Verdict,
    /// SHA-256 of the canonical manifest JSON, so an off-chain manifest can be
    /// proved to be the one that was priced without storing it all on-chain.
    pub manifest_hash: [u8; 32],
    pub lines: Vec<LineItem>,
}

/* ---------------------------------------------------------------------------
   Accounts
   --------------------------------------------------------------------------- */

/// Running totals across every pledge. `i128` because the sum of signed nets has
/// no reason to stay inside an i64 once the ledger is long.
#[account]
#[derive(InitSpace)]
pub struct Registry {
    pub authority: Pubkey,
    pub pledge_count: u64,
    pub declared_total_cents: i128,
    pub net_total_cents: i128,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Pledge {
    pub donor: Pubkey,
    pub index: u64,
    pub declared_usd_cents: i64,
    pub net_usd_cents: i64,
    pub gross_weight_grams: u64,
    pub mode: Mode,
    pub bias: Bias,
    pub verdict: Verdict,
    pub manifest_hash: [u8; 32],
    pub committed_at: i64,
    /// Kept in step with `MAX_LINES`; `max_len` takes a literal.
    #[max_len(8)]
    pub lines: Vec<LineItem>,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Registry::INIT_SPACE,
        seeds = [REGISTRY_SEED],
        bump,
    )]
    pub registry: Account<'info, Registry>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct CommitPledge<'info> {
    #[account(
        mut,
        seeds = [REGISTRY_SEED],
        bump = registry.bump,
    )]
    pub registry: Account<'info, Registry>,
    #[account(
        init,
        payer = donor,
        space = 8 + Pledge::INIT_SPACE,
        seeds = [PLEDGE_SEED, donor.key().as_ref(), &index.to_le_bytes()],
        bump,
    )]
    pub pledge: Account<'info, Pledge>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct PledgeCommitted {
    pub donor: Pubkey,
    pub index: u64,
    pub declared_usd_cents: i64,
    pub net_usd_cents: i64,
    pub gross_weight_grams: u64,
    pub verdict: Verdict,
    pub committed_at: i64,
}

#[error_code]
pub enum DeadweightError {
    #[msg("A pledge index must equal the registry's current count.")]
    IndexOutOfOrder,
    #[msg("A pledge must carry at least one manifest line.")]
    EmptyManifest,
    #[msg("Too many manifest lines for one pledge.")]
    TooManyLines,
    #[msg("A manifest line needs a catalogue id.")]
    EmptyItemId,
    #[msg("Catalogue id is longer than the account can store.")]
    ItemIdTooLong,
    #[msg("A manifest line needs a positive quantity.")]
    ZeroQuantity,
    #[msg("Declared value must be positive.")]
    DeclaredNotPositive,
    #[msg("The verdict does not follow from the declared and net figures.")]
    VerdictDoesNotFollow,
    #[msg("Registry totals overflowed.")]
    ArithmeticOverflow,
}
