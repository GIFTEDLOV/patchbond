# PatchBond frontend transaction lifecycle

PatchBond writes use a durable, same-hash reconciliation record. The browser is
an interface to the contract; it is not a source of case state or entitlement.

## Write sequence

Every write follows this sequence:

1. Read the current case and validate the caller role, case status, deadline,
   input, network, and live contract configuration.
2. Broadcast exactly once through the connected wallet.
3. Persist the returned transaction hash immediately in browser
   `localStorage` under `patchbond.pending-transactions.v1`, together with the
   network, contract, method, case ID, and expected state transition.
4. Reconcile that same hash through GenLayer finality and transaction status.
5. After `FINALIZED`, require `FINISHED_WITH_RETURN` before reading the case.
6. Read the case again and verify the expected status, changed submission ID
   where applicable, and settlement recipient, amount, and authorization for a
   terminal settlement.
7. Mark the record `Complete` only after all of those checks pass.

## Refresh and browser restart recovery

On application startup, unresolved records are loaded from `localStorage` and
checked against the configured contract. Recovery calls `waitForFinalized` or
reads the existing transaction by the persisted hash, then performs the same
execution and case-state checks as the original write. The record remains
visible until it is verified complete or the user checks the same hash again.

The local record is not trusted as contract authority. A successful UI action
requires a finalized transaction, successful contract execution, and the
expected state returned by `get_case`.

## No blind rebroadcast

Before broadcasting, the frontend searches unresolved records for the same
contract, method, and case. If one exists, it stops and asks the user to
reconcile that hash. It never creates a replacement transaction automatically.
Wallet rejection occurs before a hash exists, so it creates no recovery record
and can be deliberately retried by the user.

## Failure handling

Consensus disagreement, leader timeout, validator timeout, evidence failures,
assessment failures, execution failures, wallet/RPC failures, and stored-state
mismatches remain separate categories. Infrastructure failures never become a
business-level `NOT_FIXED` result or display as “Patch rejected.”
