// LiteSVM tests for the Deadweight notary.
//
// Two rules carry the whole point of putting this on a chain, and they are what
// most of these tests are about:
//
//   1. The program does not take the client's word for the verdict. It re-derives
//      it from the declared and net figures and rejects a mismatch, so a losing
//      manifest cannot be posted under a flattering label.
//   2. `index` must equal the registry's current count, which makes the ledger an
//      append-only sequence — a client cannot skip an unflattering entry and keep
//      numbering as if nothing were missing.
//
// The field validation is checked alongside so that a later refactor cannot
// quietly drop a guard.

use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    deadweight::{Bias, DeadweightError, LineItem, Mode, Pledge, PledgeArgs, Registry, Verdict},
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const PROGRAM: &[u8] = include_bytes!(concat!(
    env!("CARGO_TARGET_TMPDIR"),
    "/../deploy/deadweight.so"
));

/// 2026-09-05T00:00:00Z. LiteSVM's default clock sits at the epoch, so the tests
/// set one — `committed_at` has to come from the chain, not from the client, and
/// that is only checkable against a known value.
const NOW: i64 = 1_788_566_400;

/// One deployed program, one funded donor, and the registry PDA.
struct Harness {
    svm: LiteSVM,
    donor: Keypair,
    registry: Pubkey,
}

impl Harness {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program(deadweight::id(), PROGRAM).unwrap();
        svm.set_sysvar(&Clock { unix_timestamp: NOW, ..Default::default() });

        let donor = Keypair::new();
        svm.airdrop(&donor.pubkey(), 10_000_000_000).unwrap();

        let registry =
            Pubkey::find_program_address(&[deadweight::REGISTRY_SEED], &deadweight::id()).0;

        Self { svm, donor, registry }
    }

    fn pledge_pda(&self, donor: &Pubkey, index: u64) -> Pubkey {
        Pubkey::find_program_address(
            &[
                deadweight::PLEDGE_SEED,
                donor.as_ref(),
                &index.to_le_bytes(),
            ],
            &deadweight::id(),
        )
        .0
    }

    /// Sign with `payer` and send. The error is flattened to its debug string so
    /// these tests do not depend on which crate owns `TransactionError` today.
    fn send(&mut self, ix: Instruction, payer: &Keypair) -> Result<(), String> {
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|failed| format!("{:?}", failed.err))
    }

    fn initialize(&mut self) -> Result<(), String> {
        let authority = self.donor.insecure_clone();
        self.initialize_as(&authority)
    }

    fn initialize_as(&mut self, authority: &Keypair) -> Result<(), String> {
        let ix = Instruction::new_with_bytes(
            deadweight::id(),
            &deadweight::instruction::InitializeRegistry {}.data(),
            deadweight::accounts::InitializeRegistry {
                registry: self.registry,
                authority: authority.pubkey(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, authority)
    }

    fn commit(&mut self, index: u64, args: PledgeArgs) -> Result<(), String> {
        let donor = self.donor.insecure_clone();
        let pledge = self.pledge_pda(&donor.pubkey(), index);
        let ix = Instruction::new_with_bytes(
            deadweight::id(),
            &deadweight::instruction::CommitPledge { index, args }.data(),
            deadweight::accounts::CommitPledge {
                registry: self.registry,
                pledge,
                donor: donor.pubkey(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        );
        self.send(ix, &donor)
    }

    fn registry_state(&self) -> Registry {
        let account = self.svm.get_account(&self.registry).unwrap();
        let mut data: &[u8] = &account.data;
        Registry::try_deserialize(&mut data).unwrap()
    }

    fn pledge_state(&self, index: u64) -> Pledge {
        let pda = self.pledge_pda(&self.donor.pubkey(), index);
        let account = self.svm.get_account(&pda).unwrap();
        let mut data: &[u8] = &account.data;
        Pledge::try_deserialize(&mut data).unwrap()
    }
}

fn line(item_id: &str, quantity: u32) -> LineItem {
    LineItem { item_id: item_id.to_owned(), quantity }
}

/// A one-line manifest priced at `declared` and netting `net`, both in US cents.
fn args(declared: i64, net: i64, verdict: Verdict) -> PledgeArgs {
    PledgeArgs {
        declared_usd_cents: declared,
        net_usd_cents: net,
        gross_weight_grams: 12_500,
        mode: Mode::Air,
        bias: Bias::Generous,
        verdict,
        manifest_hash: [7u8; 32],
        lines: vec![line("purification-tablets", 500)],
    }
}

fn expect_error(result: Result<(), String>, expected: DeadweightError) {
    let code = u32::from(expected);
    let err = result.expect_err("the instruction should have been rejected");
    assert!(
        err.contains(&format!("Custom({code})")),
        "expected {expected:?} (custom {code}), got {err}"
    );
}

/* ---------------------------------------------------------------------------
   The happy path
   --------------------------------------------------------------------------- */

#[test]
fn notarises_a_landing_manifest() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    let registry = harness.registry_state();
    assert_eq!(registry.authority, harness.donor.pubkey());
    assert_eq!(registry.pledge_count, 0);
    assert_eq!(registry.declared_total_cents, 0);
    assert_eq!(registry.net_total_cents, 0);

    // $704.95 of purification tablets by air, netting $660.00 — 93% of declared,
    // comfortably over the 60% line.
    harness.commit(0, args(70_495, 66_000, Verdict::Lands)).unwrap();

    let pledge = harness.pledge_state(0);
    assert_eq!(pledge.donor, harness.donor.pubkey());
    assert_eq!(pledge.index, 0);
    assert_eq!(pledge.declared_usd_cents, 70_495);
    assert_eq!(pledge.net_usd_cents, 66_000);
    assert_eq!(pledge.gross_weight_grams, 12_500);
    assert_eq!(pledge.mode, Mode::Air);
    assert_eq!(pledge.bias, Bias::Generous);
    assert_eq!(pledge.verdict, Verdict::Lands);
    assert_eq!(pledge.manifest_hash, [7u8; 32]);
    assert_eq!(pledge.lines, vec![line("purification-tablets", 500)]);
    assert_eq!(
        pledge.committed_at, NOW,
        "committed_at must be the chain's clock, not a client-supplied time"
    );

    let registry = harness.registry_state();
    assert_eq!(registry.pledge_count, 1);
    assert_eq!(registry.declared_total_cents, 70_495);
    assert_eq!(registry.net_total_cents, 66_000);
}

/* ---------------------------------------------------------------------------
   Rule 1 — the verdict is re-derived, not accepted
   --------------------------------------------------------------------------- */

#[test]
fn rejects_a_flattering_verdict() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // $100 declared, $10 net — 10%. Claiming this lands is the exact lie the
    // program exists to refuse.
    expect_error(
        harness.commit(0, args(10_000, 1_000, Verdict::Lands)),
        DeadweightError::VerdictDoesNotFollow,
    );

    // A negative net is ash, whatever the client would rather call it.
    expect_error(
        harness.commit(0, args(10_000, -5_000, Verdict::Burdens)),
        DeadweightError::VerdictDoesNotFollow,
    );

    // And a manifest that genuinely lands cannot be filed as a failure either;
    // the check runs in both directions.
    expect_error(
        harness.commit(0, args(10_000, 9_000, Verdict::Burdens)),
        DeadweightError::VerdictDoesNotFollow,
    );

    // Nothing was written.
    assert_eq!(harness.registry_state().pledge_count, 0);
}

#[test]
fn lands_exactly_on_the_threshold() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // 60% of $100 is $60, and the threshold is inclusive.
    harness.commit(0, args(10_000, 6_000, Verdict::Lands)).unwrap();
    assert_eq!(harness.pledge_state(0).verdict, Verdict::Lands);
}

#[test]
fn burdens_one_cent_under_the_threshold() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    expect_error(
        harness.commit(0, args(10_000, 5_999, Verdict::Lands)),
        DeadweightError::VerdictDoesNotFollow,
    );
    harness.commit(0, args(10_000, 5_999, Verdict::Burdens)).unwrap();
    assert_eq!(harness.pledge_state(0).verdict, Verdict::Burdens);
}

#[test]
fn records_a_negative_net_as_ash() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // 200 bottles of water: $155.94 declared, minus $232.28 once freight,
    // sorting and disposal are paid. This is the number the project exists for.
    harness.commit(0, args(15_594, -23_228, Verdict::BecomesAsh)).unwrap();

    let pledge = harness.pledge_state(0);
    assert_eq!(pledge.net_usd_cents, -23_228);
    assert_eq!(pledge.verdict, Verdict::BecomesAsh);

    let registry = harness.registry_state();
    assert_eq!(registry.declared_total_cents, 15_594);
    assert_eq!(registry.net_total_cents, -23_228);
}

#[test]
fn survives_the_widest_figures_a_client_can_send() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // i64::MAX * 100 overflows an i64; the program widens to i128 before the
    // threshold multiply, so this is arithmetic rather than a panic.
    harness
        .commit(0, args(i64::MAX, i64::MAX, Verdict::Lands))
        .unwrap();
    assert_eq!(harness.pledge_state(0).verdict, Verdict::Lands);

    harness
        .commit(1, args(i64::MAX, i64::MIN, Verdict::BecomesAsh))
        .unwrap();
    assert_eq!(harness.pledge_state(1).verdict, Verdict::BecomesAsh);

    // Two i64::MAX declared totals still fit in the registry's i128.
    let registry = harness.registry_state();
    assert_eq!(registry.declared_total_cents, i128::from(i64::MAX) * 2);
    assert_eq!(
        registry.net_total_cents,
        i128::from(i64::MAX) + i128::from(i64::MIN)
    );
}

/* ---------------------------------------------------------------------------
   Rule 2 — the ledger is a sequence
   --------------------------------------------------------------------------- */

#[test]
fn keeps_the_ledger_in_sequence() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // Starting at 1 would leave a hole where entry 0 should be.
    expect_error(
        harness.commit(1, args(10_000, 9_000, Verdict::Lands)),
        DeadweightError::IndexOutOfOrder,
    );

    harness.commit(0, args(10_000, 9_000, Verdict::Lands)).unwrap();

    // Nor can it skip ahead and leave 1 free to be backfilled later with
    // something more flattering.
    expect_error(
        harness.commit(2, args(20_000, 1_000, Verdict::Burdens)),
        DeadweightError::IndexOutOfOrder,
    );

    harness.commit(1, args(20_000, 1_000, Verdict::Burdens)).unwrap();

    let registry = harness.registry_state();
    assert_eq!(registry.pledge_count, 2);
    assert_eq!(registry.declared_total_cents, 30_000);
    assert_eq!(registry.net_total_cents, 10_000);
    assert_eq!(harness.pledge_state(0).verdict, Verdict::Lands);
    assert_eq!(harness.pledge_state(1).verdict, Verdict::Burdens);
}

#[test]
fn refuses_a_second_registry() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    // The registry PDA has exactly one address, so the second caller loses at
    // account creation rather than overwriting the running totals.
    let interloper = Keypair::new();
    harness
        .svm
        .airdrop(&interloper.pubkey(), 10_000_000_000)
        .unwrap();
    assert!(harness.initialize_as(&interloper).is_err());
    assert_eq!(harness.registry_state().authority, harness.donor.pubkey());
}

#[test]
fn commit_requires_an_initialised_registry() {
    let mut harness = Harness::new();
    assert!(harness.commit(0, args(10_000, 9_000, Verdict::Lands)).is_err());
}

/* ---------------------------------------------------------------------------
   Manifest validation
   --------------------------------------------------------------------------- */

#[test]
fn validates_the_manifest() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();

    let mut empty = args(10_000, 9_000, Verdict::Lands);
    empty.lines = vec![];
    expect_error(harness.commit(0, empty), DeadweightError::EmptyManifest);

    let mut crowded = args(10_000, 9_000, Verdict::Lands);
    crowded.lines = (0..=deadweight::MAX_LINES)
        .map(|n| line(&format!("item-{n}"), 1))
        .collect();
    expect_error(harness.commit(0, crowded), DeadweightError::TooManyLines);

    let mut nameless = args(10_000, 9_000, Verdict::Lands);
    nameless.lines = vec![line("", 1)];
    expect_error(harness.commit(0, nameless), DeadweightError::EmptyItemId);

    let mut verbose = args(10_000, 9_000, Verdict::Lands);
    verbose.lines = vec![line(&"z".repeat(deadweight::MAX_ITEM_ID + 1), 1)];
    expect_error(harness.commit(0, verbose), DeadweightError::ItemIdTooLong);

    let mut nothing = args(10_000, 9_000, Verdict::Lands);
    nothing.lines = vec![line("wool-blanket", 0)];
    expect_error(harness.commit(0, nothing), DeadweightError::ZeroQuantity);

    expect_error(
        harness.commit(0, args(0, 0, Verdict::Lands)),
        DeadweightError::DeclaredNotPositive,
    );
    expect_error(
        harness.commit(0, args(-1, 0, Verdict::Lands)),
        DeadweightError::DeclaredNotPositive,
    );

    // A full manifest at the limit is fine, and the longest allowed id fits the
    // account exactly.
    let mut full = args(10_000, 9_000, Verdict::Lands);
    full.lines = (0..deadweight::MAX_LINES)
        .map(|n| line(&format!("{n}{}", "z".repeat(deadweight::MAX_ITEM_ID - 1)), 1))
        .collect();
    harness.commit(0, full).unwrap();
    assert_eq!(harness.pledge_state(0).lines.len(), deadweight::MAX_LINES);
    assert_eq!(harness.registry_state().pledge_count, 1);
}

#[test]
fn refuses_to_overwrite_a_committed_pledge() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();
    harness.commit(0, args(10_000, 9_000, Verdict::Lands)).unwrap();

    // Same donor, same index, different figures: the `init` constraint on the
    // pledge PDA rejects it before the handler runs, so an entry that is on the
    // ledger stays as it was priced.
    assert!(harness.commit(0, args(50_000, 100, Verdict::Burdens)).is_err());
    assert_eq!(harness.pledge_state(0).declared_usd_cents, 10_000);
}

#[test]
fn a_second_donor_starts_at_their_own_pda_but_the_shared_index() {
    let mut harness = Harness::new();
    harness.initialize().unwrap();
    harness.commit(0, args(10_000, 9_000, Verdict::Lands)).unwrap();

    // The pledge seed includes the donor, so two donors never collide — but the
    // index is the registry's, so the sequence stays global.
    let second = Keypair::new();
    harness.svm.airdrop(&second.pubkey(), 10_000_000_000).unwrap();
    let previous = harness.donor.insecure_clone();
    harness.donor = second;

    expect_error(
        harness.commit(0, args(10_000, 9_000, Verdict::Lands)),
        DeadweightError::IndexOutOfOrder,
    );
    harness.commit(1, args(10_000, 1, Verdict::Burdens)).unwrap();

    assert_eq!(harness.pledge_state(1).donor, harness.donor.pubkey());
    assert_ne!(
        harness.pledge_pda(&previous.pubkey(), 1),
        harness.pledge_pda(&harness.donor.pubkey(), 1)
    );
    assert_eq!(harness.registry_state().pledge_count, 2);
}
