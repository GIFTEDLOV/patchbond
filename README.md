# PatchBond

## Product

PatchBond is a funded security-remediation escrow. A client locks GEN against immutable vulnerability terms and a named developer; the contract authenticates exact GitHub evidence, asks GenLayer validators for one bounded verdict, provides an application-level challenge/response period, and settles only after a terminal result.

## Problem

Security bounties often mix mutable scope, participant-selected evidence, subjective review, and payment authority. That makes provenance failures look like semantic disagreements and lets operational failures accidentally influence entitlement.

## Why GenLayer

Patch remediation needs semantic judgment, but no single model should control funds. GenLayer lets a leader and validators independently retrieve the same authenticated evidence, independently derive the same tiny decision, and reach consensus before deterministic state changes.

Consensus proves agreement about interpretation; it does not authenticate evidence.

## How it works

1. The client creates a payable case with a repository, base commit, vulnerability, criteria, bounded paths, named developer, bounty, and challenge duration.
2. The developer explicitly accepts and submits an exact patch commit.
3. Each validator independently validates repository identity, patch identity, base ancestry, commit-pinned files, Git blob integrity, and a canonical evidence digest.
4. Each validator independently returns only `FIXED`, `NOT_FIXED`, or `INCONCLUSIVE`.
5. `FIXED` is provisional; it never pays immediately. The client may challenge with a commit-pinned text artifact under `.patchbond/challenges/`.
6. The developer has a guaranteed 24-hour response window for a descendant response patch.
7. Uncontested expiry, terminal challenge adjudication, or no-response expiry authorizes exactly one finalization-only settlement.

## Architecture

- [`contracts/patchbond_core.py`](contracts/patchbond_core.py) — pure reference layer for validation, canonical serialization, digests, transitions, deadlines, and accounting.
- [`contracts/patchbond.py`](contracts/patchbond.py) — self-contained deployable multi-case `PatchBondEscrow`; GenVM deploys a single source file, so its deterministic primitives mirror the pure reference layer.
- [`tests`](tests) — pure adversarial tests and GenLayer Direct-mode contract/consensus tests.
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — exact-head, fail-closed Stage 2 gates.
- [`docs/runtime-baseline.md`](docs/runtime-baseline.md) — official-runtime verification and read-only endpoint probes.
- [`docs/security.md`](docs/security.md) — bounds, trust model, schema, and invariants.
- [`docs/security-model.md`](docs/security-model.md) — Stage 2 audit, threat model, consensus proof, and settlement limits.
- [`docs/PROVENANCE.md`](docs/PROVENANCE.md) — exact deployable source digest and locked validation baseline.

## Use

The [`frontend`](frontend) is the Next.js public verification view and wallet-based case workflow. Its durable transaction rules are documented in [`docs/frontend-transaction-lifecycle.md`](docs/frontend-transaction-lifecycle.md).

Run the local gates:

```powershell
python -m pytest -q
python tools/mutation_test.py
python -m pytest -q tests/test_glsim_consensus.py
python tools/secret_scan.py
python tools/source_hash.py
genvm-lint check contracts/patchbond.py
genvm-lint validate contracts/patchbond.py
git diff --check
```

Frontend gates:

```powershell
cd frontend
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Public writes are `create_case`, `accept_case`, `submit_patch`, `challenge`, `respond_to_challenge`, `finalize_uncontested`, and `authorize_client_refund`. Audit views are `get_case`, `get_submission`, and `get_accounting`.

## Live proof

The production-like Bradbury testnet proof uses contract
`0x31fAeeb4C21fBDceeE2EF77BF75145ABC7931834` and representative case
`stage4-commitgate-20260826d`. The semantic assessment is transaction
`0xa2526faace86584e090feb6e67bf0a039e46c973984fc027682c0c173bc8e37b`,
`FINALIZED` with successful execution and stored verdict `FIXED`; its evidence
manifest digest is
`e15dc8cf51a65f25e014b93de9631f036ab976e31b27beb51f1072cf95466c7a`.
The uncontested finalization is
`0x4ad144ec9b1df874cb4ed7522f2e21aa1934455afc33000fef917b224fbef88c`,
stored as `FINALIZED_DEVELOPER` with `AUTHORIZED_FINALIZED_ONLY` settlement;
the developer EOA balance increased by exactly `10000000000000000` wei after
finalization. The fixture is `GIFTEDLOV/commitgate`, from base commit
`82a3775101d4815392375d22ff0a71feb62c944b` to patch commit
`0b552ac0c71367d6389cb9e231a58d11c7f77584`, reviewing
`fixtures/release_guard.py`. This is Bradbury testnet proof, not mainnet
deployment.

The live frontend is deployed at <https://patchbond.vercel.app>.

## Security/trust model

Participants never supply evidence URLs. The contract constructs only `https://api.github.com/repos/{owner}/{repo}/...` URLs from immutable validated terms. GitHub repository/commit provenance is verified before semantic use. Challenge evidence is authenticated to the same repository and commit lineage but remains untrusted participant-authored content until adjudicated. Frontends and backends have no verdict, challenge-persuasion, entitlement, refund, or payout authority.

The developer cannot substitute arbitrary evidence: PatchBond binds the
repository and base commit before work, constructs evidence locations itself,
and verifies exact target commits, ancestry, review paths, file bytes, Git blob
hashes, and source hashes before semantic evaluation. The stored evidence
manifest digest commits to the exact repository, commits, paths, and source
hashes used for adjudication. `FIXED` is provisional, the client receives a
guaranteed challenge window, and challenge evidence is bound to the same
repository and commit lineage. Validators independently retrieve and
adjudicate evidence; they do not merely approve a leader proposal. Consensus
proves validator agreement about interpretation, not evidence authentication.

See [docs/security.md](docs/security.md) for the complete sequence and bounds.
See [docs/security-model.md](docs/security-model.md) for the Stage 2 adversarial review and five-validator proof.

## Limitations

- V1 handles 1–4 bounded review paths; broader changes require a new case design.
- Public GitHub API availability and anonymous rate limits are external liveness dependencies.
- CI/check-run evidence is deliberately non-decisive because the probe was not reliable enough; the separate Bradbury proof uses authenticated repository/commit evidence and finalized contract state.
- Repository deletion, visibility changes, GitHub outage, model failure, or consensus failure reverts/fails; none becomes a party win.
- A case that never reaches provisional `FIXED` remains funded in V1; there is intentionally no unilateral cancellation or refund path.
- External transfers must be reconciled after transaction finality and successful execution.
- GLSim is production-shaped, not a full GenVM or live-network compatibility claim; its 0.29.2 rollback inspection limitation is documented.
- The Bradbury contract address and public RPC configuration are deployed in the
  public frontend; Bradbury remains a testnet network.

## Developer/API detail

The model schema is exactly `{"verdict":"FIXED|NOT_FIXED|INCONCLUSIVE"}`. Submission `FIXED` enters `PROVISIONAL_FIXED`; `NOT_FIXED` and `INCONCLUSIVE` return to `ACCEPTED` for another patch. Challenge `FIXED` authorizes the developer, challenge `NOT_FIXED` authorizes the client, and challenge `INCONCLUSIVE` stays `CHALLENGED` while time remains. Technical/evidence/model failures never map to any verdict.

All storage writes occur after `run_nondet_unsafe` consensus. The validator does not inspect the leader schema alone: it refetches and rehashes evidence, reruns adjudication, then compares the stable verdict and evidence digest.
