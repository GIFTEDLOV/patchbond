# PatchBond contract provenance

- Contribution classification: `PROJECT`
- Intelligent Contract: `PatchBondEscrow`
- Stage 2 starting Git head: `5c36ffbda2d40b73055e5bf2ae9391893631c862`
- Deployable source: `contracts/patchbond.py`
- Deployable SHA-256: `538d908d80f5cf08f5bf0445352bfe153f541aef1f3c76a88eb500ea78094c31`
- Contract dependency: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- GenVM validation bundle: `v0.3.0-rc7`
- Local tooling baseline: `genlayer-test 0.29.2`, `genlayer-py 0.16.3`, `genvm-linter 0.11.0`

Verify the source record with `python tools/source_hash.py`. The CI workflow checks the event SHA, this digest, all tests, mutation guards, GLSim consensus proof, GenVM lint/validation, secrets, and a clean generated state.

Release test authority is a fresh isolated install from `requirements-dev.txt`. Direct/GLSim use `GENVM_VERSION=v0.2.16`; GenVM lint/validation override it with `v0.3.0-rc7`.

Stage 2 did not deploy or broadcast to Bradbury, did not use Studionet, and did not request or access a private key.
