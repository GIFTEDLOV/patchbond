# PatchBond live Bradbury proof

This document is the reviewer-facing narrative for the canonical proof artifact:
[`artifacts/final-release-proof.json`](../artifacts/final-release-proof.json).
It records one production-like GenLayer Bradbury testnet lifecycle. It is not a
mainnet deployment and it does not replace the historical provenance records.

## Network and contract

| Field | Value |
| --- | --- |
| Network | GenLayer Bradbury testnet |
| Chain ID | `4221` |
| RPC | `https://rpc-bradbury.genlayer.com` |
| Contract | `0x31fAeeb4C21fBDceeE2EF77BF75145ABC7931834` |
| Representative case | `stage4-commitgate-20260826d` |
| Fixture | [`GIFTEDLOV/commitgate`](https://github.com/GIFTEDLOV/commitgate) |
| Base commit | `82a3775101d4815392375d22ff0a71feb62c944b` |
| Patch commit | `0b552ac0c71367d6389cb9e231a58d11c7f77584` |
| Review path | `fixtures/release_guard.py` |

The immutable requirement was: “Only the configured administrator may execute
the protected action. The base implementation permits unauthorized callers.”
The acceptance criteria required an administrator check before the protected
action and no alternate unauthenticated path in the reviewed source.

## Transaction proof

Every row was checked as a finalized transaction with successful execution and
the expected stored consequence. Deterministic writes do not have a separate
semantic validator vote.

| Step | Transaction | Status | Execution | Stored consequence |
| --- | --- | --- | --- | --- |
| Deployment | `0xda16b8c85ab4b3a89cad5b43d9f9efffb0af68fd94dfe3dc2b490966c344dc06` | `FINALIZED` | `FINISHED_WITH_RETURN` | Contract deployed at `0x31fAeeb4C21fBDceeE2EF77BF75145ABC7931834`; initial accounting readable at zero |
| Create case | `0x8d1e5b8dce3195f07ad60357304c1d95c590c4fb8e52492b9c68c3669b7dfa40` | `FINALIZED` | `FINISHED_WITH_RETURN` | Exact terms stored, case `OPEN`, bounty liability funded |
| Accept case | `0x3514526a5ed8c90e62d0de0769b770553d0e9836e8e2c2c4f198533beb4ba899` | `FINALIZED` | `FINISHED_WITH_RETURN` | Case `ACCEPTED` for the named developer |
| Semantic submission | `0xa2526faace86584e090feb6e67bf0a039e46c973984fc027682c0c173bc8e37b` | `FINALIZED` | `FINISHED_WITH_RETURN` | Submission `stage4-commitgate-20260826d:1`; verdict `FIXED`; evidence digest stored; case `PROVISIONAL_FIXED` |
| Uncontested finalization | `0x4ad144ec9b1df874cb4ed7522f2e21aa1934455afc33000fef917b224fbef88c` | `FINALIZED` | `FINISHED_WITH_RETURN` | Case `FINALIZED_DEVELOPER`; `AUTHORIZED_FINALIZED_ONLY` settlement record |

The semantic assessment reached `MAJORITY_AGREE`. The recorded validator votes
were five `AGREE` votes. The verdict was `FIXED`, not a model-authored payout
amount. The evidence manifest digest was:

```text
e15dc8cf51a65f25e014b93de9631f036ab976e31b27beb51f1072cf95466c7a
```

## Provisional and settlement checks

`FIXED` first stored as `PROVISIONAL_FIXED`. The bounty remained unsettled
during the challenge window. After the uncontested deadline, finalization
stored:

- final case status: `FINALIZED_DEVELOPER`;
- recipient: `0x6311de989ab01ae4da77d36cc45d495fbcd4b7a8`;
- authorized amount: `10000000000000000` wei (`0.01 GEN`);
- settlement status: `AUTHORIZED_FINALIZED_ONLY`.

The external consequence was reconciled separately. The developer’s EOA
balance increased by exactly `10000000000000000` wei after finalization. The
Bradbury RPC did not expose a separate native transfer transaction hash for
this internal EOA movement, so no such hash is claimed here.

## What this proves

The proof demonstrates a real funded case, exact repository and commit binding,
independent semantic adjudication, a provisional `FIXED` state, uncontested
finalization, and exact settlement reconciliation on Bradbury.

It does not prove mainnet availability, universal GitHub liveness, or a live
challenged semantic lifecycle. Challenge/response behavior is covered by the
repository’s Direct, mutation, and GLSim gates. Consensus proves validator
agreement about interpretation; it does not authenticate evidence.
