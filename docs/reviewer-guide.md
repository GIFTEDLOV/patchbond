# PatchBond reviewer guide

Use this five-minute path to review the product, trust boundary, and live
proof without sending a wallet transaction.

## 30 seconds: product and motivation

1. Open the [PatchBond application](https://patchbond.vercel.app).
2. Read the homepage proof card for case
   `stage4-commitgate-20260826d`.
3. Read [Why GenLayer](../README.md#why-genlayer): deterministic logic can
   authenticate exact code, but cannot decide whether code satisfies a bounded
   natural-language remediation requirement.

## 2 minutes: trust and decision architecture

Read the [architecture](../README.md#architecture) and
[security/trust model](../README.md#security--trust-model).

Check these boundaries:

- the contract binds repository identity, base commit, review paths, terms,
  roles, deadlines, and accounting;
- participant-selected URLs are not authoritative evidence;
- validators independently retrieve and validate evidence before semantic
  evaluation;
- model authority is limited to `FIXED`, `NOT_FIXED`, or `INCONCLUSIVE`;
- `FIXED` is provisional and challengeable;
- the frontend never decides a verdict or payout;
- finality, execution success, expected stored state, and external settlement
  reconciliation are separate checks.

## 5 minutes: live proof and reproducibility

1. Open the [public verification certificate](https://patchbond.vercel.app/verify/stage4-commitgate-20260826d).
   No wallet is required.
2. Confirm the four proof layers: authenticated evidence, semantic
   interpretation, consensus/finality, and state consequence.
3. Compare the transaction table in [Live proof](live-proof.md) with the
   canonical [`final-release-proof.json`](../artifacts/final-release-proof.json).
4. Confirm the semantic assessment is `FIXED`, `FINALIZED`, and
   `FINISHED_WITH_RETURN`, with evidence digest
   `e15dc8cf51a65f25e014b93de9631f036ab976e31b27beb51f1072cf95466c7a`.
5. Confirm finalization stored `FINALIZED_DEVELOPER` and that the developer EOA
   balance delta was exactly `10000000000000000` wei.
6. Inspect the [exact-head CI workflow](https://github.com/GIFTEDLOV/patchbond/actions/workflows/ci.yml)
   and run the documented local frontend gates if desired.

## Review boundary

This is a Bradbury testnet proof. Do not interpret it as a mainnet deployment.
The live case uses the uncontested path; the challenge/response adversarial
surface is covered by the repository’s local Direct, mutation, and GLSim gates.
