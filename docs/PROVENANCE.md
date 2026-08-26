# PatchBond contract provenance

- Contribution classification: `PROJECT`
- Intelligent Contract: `PatchBondEscrow`
- Stage 2 starting Git head: `5c36ffbda2d40b73055e5bf2ae9391893631c862`
- Deployable source: `contracts/patchbond.py`
- Deployable SHA-256: `910c386667333ebc9bc88b58031889c24b406063e6087deb6e8f6f77eacccbf3`
- Contract dependency: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
- GenVM validation bundle: `v0.3.0-rc7`
- Local tooling baseline: `genlayer-test 0.29.2`, `genlayer-py 0.16.3`, `genvm-linter 0.11.0`

Verify the source record with `python tools/source_hash.py`. The CI workflow checks the event SHA, this digest, all tests, mutation guards, GLSim consensus proof, GenVM lint/validation, secrets, and a clean generated state.

Release test authority is a fresh isolated install from `requirements-dev.txt`. GLSim uses `GENVM_VERSION=v0.2.16`; Direct resolves the contract's immutable runner hash to `v0.3.0-rc7`; GenVM lint/validation also use `v0.3.0-rc7`. CI verifies the official `genvm-runners-all.tar.xz` asset as SHA-256 `e218a1854214681560351051f76fe2b878545cf3409455ef372d57014a88ca67` before exposing it under the compatibility cache name required by the locked Direct runner.

Stage 2 did not deploy or broadcast to Bradbury, did not use Studionet, and did not request or access a private key.
