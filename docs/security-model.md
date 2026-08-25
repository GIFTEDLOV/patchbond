# PatchBond Stage 2 security model

## Trust boundary

Consensus proves agreement about interpretation; it does not authenticate evidence. PatchBond authenticates the client and immutable terms, validates GitHub repository and commit identity, validates lineage, retrieves exact commit-pinned bytes, checks content integrity, and commits a canonical digest before bounded semantic adjudication.

Challenge authentication proves only: "these exact bytes came from this bound repository, commit, and reserved path." It does not prove the allegations are true. The leader and every validator independently judge substance against the original vulnerability specification and acceptance criteria.

Participants cannot provide an evidence host, repository URL, API URL, branch, tag, or raw-content URL. The contract constructs only `https://api.github.com/repos/{owner}/{repo}/...` URLs from immutable validated terms and exact lowercase 40-hex commits.

## Stage 1 review classification

| Area | Finding | Classification | Stage 2 action |
|---|---|---:|---|
| Challenge rights and path | Client-only, provisional-only, reserved repo path | NONE | Boundary and adversarial tests expanded |
| Challenge/response deadlines | One consistent rule existed but was duplicated | LOW | Centralized inclusive-window helpers and exact `-1/0/+1` tests |
| Challenge repository metadata | A non-string `full_name` failed incidentally | LOW | Controlled `EVIDENCE_FAILURE: REPOSITORY_IDENTITY` |
| Challenge proposal schema | Digest/content comparison did not reject extra keys | LOW | Exact two-key validator comparison |
| Response lineage and immutable terms | Correctly bound to challenge history and original terms | NONE | Wrong-repo, wrong-lineage, and immutability tests expanded |
| Technical failure separation | Web/model/evidence/consensus failure never selects a recipient | NONE | Explicit no-client-victory tests |
| Settlement and accounting | Terminal-state, exact-bounty, single-use, case-isolated | NONE | Cross-case, wrong-recipient, duplicate, and transfer-failure tests expanded |
| Nondeterministic boundary | Terms copied to memory; storage writes after consensus | NONE | Five-validator proof and mutation guards |

No BLOCKER, HIGH, or MEDIUM contract defect was found.

## State and deadline rules

`ACCEPTED -> PROVISIONAL_FIXED` occurs only for an authenticated `FIXED` submission and never transfers value. The client may challenge while `now <= challenge_deadline`. Anyone may finalize uncontested only when `now > challenge_deadline`.

An authenticated challenge enters `CHALLENGED` and creates a fixed 24-hour response period. The named developer may respond while `now <= response_deadline`. A client timeout authorization is possible only when `now > response_deadline`.

Challenge adjudication maps `FIXED` to `FINALIZED_DEVELOPER`, `NOT_FIXED` to `FINALIZED_CLIENT`, and `INCONCLUSIVE` back to `CHALLENGED`. A no-response refund is a deterministic procedural consequence after expiry, not an AI verdict. A web, GitHub, model, malformed-output, or consensus failure reverts/fails and never directly changes entitlement.

## Threat-model pass

### Client attacks

- Malicious assertions remain untrusted content and need independent semantic agreement.
- Repository, owner, host, branch, raw URL, traversal, backslash, query, fragment, percent, and symlink substitution fail deterministic validation or exact GitHub response checks.
- Infrastructure failure cannot call settlement or synthesize `NOT_FIXED`; only a later explicit timeout transaction after the guaranteed window can authorize a refund.
- Deterministic transaction timestamps and inclusive participant windows prevent wall-clock or equality manipulation.
- Status and per-case settlement amount prevent repeat challenge and settlement.

### Developer attacks

- Only the named developer can accept, submit, or respond.
- Patch and response commits are exact SHA-1 identifiers in the declared repository. Compare metadata must be `ahead` with the exact expected merge base.
- The response must descend from the challenge commit and also pass original-base source evidence validation.
- Responses create new immutable submissions; they cannot overwrite repository, base, criteria, review paths, client, bounty, or duration.
- `FIXED` submission is provisional, so early payout is impossible.

### External evidence attacks

- Repository `full_name`, numeric immutable repository ID, exact commit SHA, exact merge base, file type, base64 encoding, bounded decoded size, UTF-8, NUL absence, Git blob SHA-1, and SHA-256 are checked.
- Redirect/host confusion is excluded by contract-built GitHub API URLs and no participant URL input.
- Partial, malformed, oversized, unavailable, rate-limited, or non-200 responses are evidence failures, never verdicts.
- GitHub availability and repository retention remain liveness assumptions. V1 deliberately does not use transient CI/check-run state.

### Consensus attacks

- Leader JSON is not trusted. Each validator independently repeats authenticated retrieval, hashing, and semantic derivation.
- Consensus-critical outputs are exact bounded dictionaries: submission/response `verdict,digest`; challenge `digest,content` where content is capped at 16,384 bytes.
- Hostile model JSON must contain exactly one `verdict` key and one enum value. Malformed or duplicate keys are `MODEL_FAILURE`.
- Validator disagreement does not produce a verdict or recipient. All three storage-writing paths occur after `run_nondet_unsafe` returns.
- Storage-backed terms are copied with `gl.storage.copy_to_memory`; nondeterministic closures capture primitives only.

### Accounting attacks

- Each case bounty is immutable `gl.message.value`; no settlement function accepts an amount or recipient argument.
- Recipient is derived from the terminal state and immutable addresses. Authorization uses the exact original case bounty.
- `settlement_amount == 0` is required, and a terminal state prevents a second route.
- Aggregate conservation is `total_received == open_liability + total_authorized`; settling one case cannot change another case's terms or settlement fields.
- Accounting is updated before `emit_transfer` to make duplicate/reentrant execution fail. GenVM transaction atomicity reverts both state and authorization if the call fails.

## Settlement evidence

The current EOA pattern is an `@gl.evm.contract_interface` recipient exposing `emit_transfer` and a call `_SettlementRecipient(recipient).emit_transfer(value=u256(amount))`. This external value operation executes only on transaction finalization.

`FINALIZED_DEVELOPER` or `FINALIZED_CLIENT` plus `AUTHORIZED_FINALIZED_ONLY` proves the contract selected an immutable recipient and exact bounty in a successful terminal execution. It does not, by itself, prove the external balance changed. A consumer must reconcile transaction finality, successful execution, expected case state, triggered transfer/receipt state, and balances.

## Multi-validator proof and tooling limitations

The no-key production-shaped gate uses official GLSim 0.29.2 with five validator votes. The leader derives from local commit-pinned fixtures, five validator invocations independently repeat the derivation, comparison is bounded to verdict/digest, and two identical runs produce the same stored state and digest. A forced disagreement produces five `disagree` votes and GLSim restores the pre-consensus storage snapshot byte-for-byte.

GLSim 0.29.2 has an inspection defect after rollback: it replaces its storage-manager mapping but leaves the already-deployed instance slots bound to the discarded manager. The test proves the restored raw snapshot, performs a test-only in-place rebind, and then verifies semantic state. This is a GLSim limitation, not contract logic, and is not presented as full GenVM/Bradbury proof. Direct similarly checks exceptions but needs an explicit snapshot/revert to model transaction atomicity. GenVM lint/validation remains a separate mandatory gate.

The published 0.29.2 Windows wheel also requires deferred cleanup of its stdin-bound temporary file. The Windows-only test shim mirrors the guard already present in the installed tooling; it changes no contract or consensus behavior.

No Bradbury write or deployment was performed, and no private key was requested or accessed.
