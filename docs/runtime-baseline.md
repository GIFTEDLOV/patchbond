# PatchBond runtime baseline

Verified on 2026-08-25 before implementation. No package was upgraded.

## Installed tooling

| Component | Verified value | Decision |
|---|---:|---|
| GenLayer CLI | `0.39.1` | Kept |
| `genvm-lint` | `0.11.0` | Kept |
| `genlayer-py` | `0.16.3` | Kept |
| `genlayer-test` | `0.29.2` | Kept |
| Python | 3.14 runtime | Kept |
| CLI active network | `testnet-bradbury` | Read-only inspection only; no deployment |

The Direct runner resolved its cached contract SDK to GenVM `v0.2.16`. The contract dependency is pinned to the current official documentation value:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

`genvm-lint` initially selected its newest cached manager bundle, which did not contain that documented dependency and failed with `runners/py-genlayer/1j/b45...tar not found`. Pinning the validator to the already-cached `GENVM_VERSION=v0.3.0-rc7` loaded the exact dependency and passed semantic validation. No package or contract dependency was upgraded. The validator reported a newer runner, which was deliberately not adopted merely because it exists.

## Runtime semantics verified from official documentation

- [`gl.storage.copy_to_memory`](https://docs.genlayer.com/developers/intelligent-contracts/storage) copies storage-backed objects for nondeterministic closures. PatchBond copies the immutable `CaseTerms` object, then captures only ordinary primitives.
- [`gl.vm.run_nondet_unsafe`](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle) is the production custom-equivalence primitive. Validator exceptions count as disagreement. PatchBond validators independently refetch evidence, rerun the semantic decision, and compare only `verdict` plus the deterministic evidence digest.
- [Nondeterministic side-effect rules](https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism) require web/LLM operations inside nondeterministic blocks and storage writes/messages after consensus. PatchBond follows that ordering.
- [`gl.nondet.web.get/request`](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access) returns HTTP response bytes and status metadata. Stable derived fields should be compared, not raw dynamic responses.
- [`gl.nondet.exec_prompt`](https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms) can request JSON but does not guarantee an application schema. PatchBond requests raw output and applies its own exact parser, including duplicate-key rejection.
- [Transaction time](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context) is pinned to the transaction and deterministic across validators. `datetime.now(timezone.utc)` is therefore used for deadlines, never host wall clock.
- [Payable methods and settlement](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers): `@gl.public.write.payable`, `gl.message.value: u256`, and an `@gl.evm.contract_interface` recipient with `emit_transfer(value=...)` are current. External EOA/EVM transfers execute only on finalization.
- [Finality](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/finality): `ACCEPTED` is appealable; `FINALIZED` is irreversible. A transaction hash or finalized label alone is not proof that contract execution and payout succeeded.
- [Current testing guidance](https://docs.genlayer.com/developers/intelligent-contracts/testing) recommends pure/Direct tests first, mocked web/LLM consensus tests, then full runtime validation.
- [Bradbury network](https://docs.genlayer.com/developers/networks): GenLayer RPC `https://rpc-bradbury.genlayer.com`, chain RPC `https://rpc.testnet-chain.genlayer.com`, chain ID `4221`, currency `GEN`.

## Official documentation discrepancy found

The current web-access error-handling example uses `response.status_code`. The installed contract SDK's verified `Response` dataclass exposes `status`, `headers`, and `body`; it has no `status_code`. PatchBond uses `response.status`, which passes Direct execution against the installed SDK. This is recorded rather than hidden by a package upgrade.

## GitHub evidence probes

Probe repository: `genlayerlabs/genlayer-js`.

| Probe | Result |
|---|---|
| Commit | head `1b7f50a3a3f2963ea857941b0fb386081dd5c326`; parent `2af6928e2587091fb33f5f703160c8a160606048`; response 16,291 bytes |
| Compare | `ahead`; `ahead_by=1`; `behind_by=0`; merge base exactly the parent; response 34,584 bytes |
| Contents API, parent | HTTP 200; 3,967-byte JSON; zero redirects |
| Contents API, head | HTTP 200; 3,967-byte JSON; zero redirects |
| Raw, head | HTTP 200; 2,144 bytes; zero redirects |
| API/raw integrity | decoded API and raw bytes identical; SHA-256 `0695982b068f8043a21b6d3ccfc10b5cb7aa5e945186a1e10fbe6f7113dd48cf`; Git blob SHA `ff044a98fde18fcf0154d22b4c886714a43e2596` |
| Invalid commit | HTTP 422; 174-byte failure body |
| Anonymous REST limit | observed `60` requests/hour with remaining-count headers |

PatchBond uses the repository, commit, compare, and contents endpoints. It validates repository `full_name` and numeric repository ID, exact returned commit SHA, `ahead` lineage with exact merge base, content size/type/UTF-8, decoded size, Git blob SHA-1, and SHA-256. URLs are constructed solely from validated immutable terms.

## CI evidence decision

Not used for V1. The exact-commit public check-runs probe did not complete reliably in this environment, check state can be transient/paginated, anonymous GitHub API capacity is only 60 requests/hour, and no Bradbury web-access probe has been run. The manifest records `{"decision":"NOT_USED"}`. Source and lineage evidence remain authoritative.

## Compatibility claim

Bradbury compatibility is **not claimed**. No key was accessed and nothing was deployed. Direct execution and local lint/validation results are reported separately from live-network proof.

## Stage 2 local consensus baseline

Official current testing guidance distinguishes Direct Mode from production consensus and documents GLSim as a lightweight local multi-validator network. The installed `genlayer-test[sim]` 0.29.2 provides `python -m glsim --validators 5`; PatchBond uses its consensus engine directly with exact local web/model fixtures so no account key or external service is required.

The representative proof runs one leader derivation and five independent validator derivations. Five agreeing votes finalize and store `FIXED` as `PROVISIONAL_FIXED`; a forced disagreement produces five disagreeing votes and restores the captured pre-consensus storage snapshot. Repeating the agreeing fixture produces identical case, accounting, verdict, and digest state.

GLSim is production-shaped, not full GenVM. Version 0.29.2 also needs a test-only manager rebind to inspect a restored contract after disagreement; the raw restored snapshot is verified first. This exact limitation is documented in `docs/security-model.md`. No package was upgraded, no Studionet was used, and no Bradbury transaction was broadcast.

The published 0.29.2 Windows wheel also attempts to unlink a temporary file immediately after rebinding it to stdin, which Windows rejects. The pre-existing installed copy already deferred that unlink. `tests/conftest.py` carries the same narrow Windows-only deferred cleanup so a fresh virtual environment is reproducible; Linux CI takes no compatibility path.

Direct and GLSim are explicitly pinned to `GENVM_VERSION=v0.2.16`; otherwise Direct selects the newest cached bundle and its behavior changes after validation downloads. The `genvm-lint` steps override that pin with `v0.3.0-rc7`, the verified bundle containing the contract dependency. This split prevents an encoder/decoder mismatch and removes cache-order dependence.

During the clean gate, the global installation (still labeled 0.29.2) was found to contain a different SDK-compat loader than the published 0.29.2 wheel. That global loader cannot encode messages for the pinned Direct bundle after rc7 enters its cache. Release results therefore come from a newly created isolated environment installed from `requirements-dev.txt`, matching CI, rather than from undeclared global package contents. No global package was upgraded or used to claim the final Direct/GLSim result.
