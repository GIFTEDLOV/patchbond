# Security and trust model

## Permanent sequence

Client authentication → immutable terms → repository identity → commit identity and lineage → commit-pinned content → content integrity and canonical evidence digest → deterministic admissibility → bounded semantic adjudication → independent validator consensus → provisional ruling → challenge/response → application finality → settlement.

Consensus proves agreement about interpretation; it does not authenticate evidence. GitHub provenance checks happen before content reaches the model. A challenge artifact is authenticated to the repository and commit, but remains untrusted participant-authored content until adjudicated.

## Deliberate V1 bounds

| Input/evidence | Bound |
|---|---:|
| Case ID | 1–64 canonical `[a-z0-9_-]` characters |
| GitHub owner | 1–39 canonical lowercase safe characters |
| GitHub repository | 1–100 canonical lowercase safe characters |
| Commit | exact lowercase 40-hex |
| Vulnerability specification | 1–4,000 characters |
| Acceptance criteria | 1–4,000 characters |
| Review paths | 1–4, ordered, unique |
| One path | at most 160 characters |
| All path strings | at most 512 characters |
| One source file | at most 8,192 bytes |
| One revision | at most 32,768 bytes |
| Challenge artifact | at most 16,384 bytes; UTF-8 text under `.patchbond/challenges/` |
| HTTP JSON body | at most 262,144 bytes |
| Challenge window | 1 hour–7 days |
| Guaranteed response window | fixed 24 hours |

Paths are repository-relative and reject empty/dot segments, traversal, absolute paths, backslashes, drive/URL syntax, query/fragment/percent syntax, unsafe characters, and duplicates.

## Evidence manifest

Submission digest commits to canonical UTF-8 JSON (`sort_keys=True`, compact separators):

```json
{
  "schema": "patchbond-evidence-v1",
  "repository": {"owner": "owner", "name": "repo", "github_repository_id": 123},
  "base_sha": "<40-hex>",
  "patch_sha": "<40-hex>",
  "review_paths": ["ordered/path"],
  "content": [
    {"path": "ordered/path", "base_sha256": "<64-hex>", "patch_sha256": "<64-hex>"}
  ],
  "lineage": {"status": "ahead", "merge_base_sha": "<base-sha>"},
  "ci": {"decision": "NOT_USED"}
}
```

Challenge and response manifests commit to repository identity, exact commits, exact artifact/source hashes, and lineage. Full GitHub responses and model reasoning are never stored.

## Model authority

The only authoritative model output is exactly:

```json
{"verdict":"FIXED|NOT_FIXED|INCONCLUSIVE"}
```

Malformed JSON, duplicates, extra/missing keys, wrong types, wrong enum values, provider exceptions, web failures, evidence failures, and consensus disagreement are failures—not `NOT_FIXED` or `INCONCLUSIVE`.

## Settlement accounting

Every payable case adds exactly `gl.message.value` to `total_received` and `open_liability`. A single terminal authorization moves exactly that bounty from open liability to `total_authorized`. The invariant is:

`total_received == open_liability + total_authorized`

The contract stores `AUTHORIZED_FINALIZED_ONLY` and emits one finalization-only external transfer. Consumers must verify finalized status, successful execution, expected terminal case state, and settlement reconciliation.
