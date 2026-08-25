"""Pure deterministic primitives for PatchBond.

This module intentionally has no GenLayer imports so its validation, canonical
serialization, digest, state-transition, and accounting rules can be tested
with ordinary Python.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Iterable, Mapping, Sequence


MAX_CASE_ID_LENGTH = 64
MAX_REPO_OWNER_LENGTH = 39
MAX_REPO_NAME_LENGTH = 100
MAX_SPEC_LENGTH = 4_000
MAX_CRITERIA_LENGTH = 4_000
MIN_CHALLENGE_WINDOW_SECONDS = 3_600
MAX_CHALLENGE_WINDOW_SECONDS = 7 * 24 * 60 * 60
RESPONSE_WINDOW_SECONDS = 24 * 60 * 60
MAX_REVIEW_PATHS = 4
MAX_PATH_LENGTH = 160
MAX_PATHS_TOTAL_LENGTH = 512
MAX_SOURCE_BYTES_PER_PATH = 8_192
MAX_SOURCE_BYTES_PER_REVISION = 32_768
MAX_CHALLENGE_BYTES = 16_384
MAX_HTTP_BODY_BYTES = 262_144

STATUS_OPEN = "OPEN"
STATUS_ACCEPTED = "ACCEPTED"
STATUS_PROVISIONAL_FIXED = "PROVISIONAL_FIXED"
STATUS_CHALLENGED = "CHALLENGED"
STATUS_FINALIZED_DEVELOPER = "FINALIZED_DEVELOPER"
STATUS_FINALIZED_CLIENT = "FINALIZED_CLIENT"

VERDICT_FIXED = "FIXED"
VERDICT_NOT_FIXED = "NOT_FIXED"
VERDICT_INCONCLUSIVE = "INCONCLUSIVE"
VERDICTS = (VERDICT_FIXED, VERDICT_NOT_FIXED, VERDICT_INCONCLUSIVE)

_CASE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
_OWNER_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$")
_REPO_RE = re.compile(r"^[a-z0-9._-]+$")
_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
_PATH_SEGMENT_RE = re.compile(r"^[A-Za-z0-9._-]+$")


class PatchBondValidationError(ValueError):
    """Raised when deterministic input validation fails."""


class DuplicateKeyError(PatchBondValidationError):
    """Raised when hostile JSON repeats a key."""


def require(condition: bool, message: str) -> None:
    if not condition:
        raise PatchBondValidationError(message)


def validate_case_id(case_id: str) -> str:
    require(isinstance(case_id, str), "case id must be a string")
    require(bool(_CASE_ID_RE.fullmatch(case_id)), "invalid case id")
    return case_id


def validate_repo(repo_owner: str, repo_name: str) -> tuple[str, str]:
    require(isinstance(repo_owner, str) and isinstance(repo_name, str), "repo identity must be strings")
    require(len(repo_owner) <= MAX_REPO_OWNER_LENGTH, "repo owner too long")
    require(bool(_OWNER_RE.fullmatch(repo_owner)), "invalid repo owner")
    require("--" not in repo_owner, "invalid repo owner")
    require(0 < len(repo_name) <= MAX_REPO_NAME_LENGTH, "invalid repo name length")
    require(bool(_REPO_RE.fullmatch(repo_name)), "invalid repo name")
    require(repo_name not in (".", ".."), "invalid repo name")
    require(not repo_name.lower().endswith(".git"), "repo name must not include .git suffix")
    return repo_owner, repo_name


def validate_commit_sha(commit_sha: str) -> str:
    require(isinstance(commit_sha, str), "commit sha must be a string")
    require(bool(_SHA_RE.fullmatch(commit_sha)), "commit sha must be exact lowercase 40-hex")
    return commit_sha


def validate_bounded_text(value: str, label: str, max_length: int) -> str:
    require(isinstance(value, str), f"{label} must be a string")
    require(value == value.strip(), f"{label} must be trimmed")
    require(0 < len(value) <= max_length, f"invalid {label} length")
    require("\x00" not in value, f"{label} contains NUL")
    return value


def validate_review_path(path: str) -> str:
    require(isinstance(path, str), "path must be a string")
    require(0 < len(path) <= MAX_PATH_LENGTH, "invalid path length")
    require(path == path.strip(), "path must be trimmed")
    require("\\" not in path, "backslashes are forbidden")
    require(not path.startswith("/"), "absolute paths are forbidden")
    require("://" not in path and ":" not in path, "URL or drive syntax is forbidden")
    require("?" not in path and "#" not in path and "%" not in path, "URL syntax is forbidden")
    parts = path.split("/")
    require(all(part not in ("", ".", "..") for part in parts), "non-canonical path")
    require(all(bool(_PATH_SEGMENT_RE.fullmatch(part)) for part in parts), "unsafe path character")
    return path


def validate_review_paths(paths: Sequence[str]) -> tuple[str, ...]:
    require(not isinstance(paths, (str, bytes)), "review paths must be a sequence")
    require(1 <= len(paths) <= MAX_REVIEW_PATHS, "invalid review path count")
    normalized = tuple(validate_review_path(path) for path in paths)
    require(sum(len(path) for path in normalized) <= MAX_PATHS_TOTAL_LENGTH, "review paths too large")
    require(len(set(normalized)) == len(normalized), "duplicate review path")
    return normalized


def validate_challenge_path(path: str) -> str:
    path = validate_review_path(path)
    require(path.startswith(".patchbond/challenges/"), "challenge path outside reserved directory")
    require(path != ".patchbond/challenges/", "challenge path must name an artifact")
    require(path.lower().endswith((".txt", ".md", ".json")), "challenge artifact must be bounded text")
    return path


def validate_challenge_window(seconds: int) -> int:
    require(type(seconds) is int, "challenge duration must be an integer")
    require(MIN_CHALLENGE_WINDOW_SECONDS <= seconds <= MAX_CHALLENGE_WINDOW_SECONDS, "invalid challenge duration")
    return seconds


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def evidence_manifest_digest(manifest: Mapping[str, Any]) -> str:
    return sha256_hex(canonical_json(manifest).encode("utf-8"))


def git_blob_sha(content: bytes) -> str:
    header = b"blob " + str(len(content)).encode("ascii") + b"\x00"
    return hashlib.sha1(header + content).hexdigest()


def _reject_duplicates(pairs: Iterable[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError("MODEL_FAILURE: duplicate key")
        result[key] = value
    return result


def parse_verdict(raw: Any) -> str:
    """Parse the exact one-field verdict schema without coercion or cleanup."""
    try:
        if isinstance(raw, str):
            data = json.loads(raw, object_pairs_hook=_reject_duplicates)
        elif isinstance(raw, dict):
            data = raw
        else:
            raise PatchBondValidationError("MODEL_FAILURE: result must be JSON object")
    except (json.JSONDecodeError, UnicodeError) as exc:
        raise PatchBondValidationError("MODEL_FAILURE: malformed JSON") from exc
    require(type(data) is dict, "MODEL_FAILURE: result must be JSON object")
    require(list(data.keys()) == ["verdict"], "MODEL_FAILURE: exact verdict key required")
    verdict = data["verdict"]
    require(type(verdict) is str, "MODEL_FAILURE: verdict must be a string")
    require(verdict in VERDICTS, "MODEL_FAILURE: invalid verdict")
    return verdict


def submission_next_status(verdict: str) -> str:
    require(verdict in VERDICTS, "invalid verdict")
    return STATUS_PROVISIONAL_FIXED if verdict == VERDICT_FIXED else STATUS_ACCEPTED


def challenge_next_status(verdict: str) -> str:
    require(verdict in VERDICTS, "invalid verdict")
    if verdict == VERDICT_FIXED:
        return STATUS_FINALIZED_DEVELOPER
    if verdict == VERDICT_NOT_FIXED:
        return STATUS_FINALIZED_CLIENT
    return STATUS_CHALLENGED


def checked_deadline(start_seconds: int, duration_seconds: int, maximum: int = (1 << 64) - 1) -> int:
    require(type(start_seconds) is int and type(duration_seconds) is int, "deadline values must be integers")
    require(start_seconds >= 0 and duration_seconds >= 0, "deadline values must be nonnegative")
    deadline = start_seconds + duration_seconds
    require(deadline <= maximum, "deadline overflow")
    return deadline


def authorize_settlement(
    bounty: int,
    settlement_amount: int,
    open_liability: int,
    total_authorized: int,
) -> tuple[int, int, int]:
    require(all(type(x) is int for x in (bounty, settlement_amount, open_liability, total_authorized)), "amounts must be integers")
    require(bounty > 0, "bounty must be nonzero")
    require(settlement_amount == 0, "duplicate settlement")
    require(open_liability >= bounty, "escrow liability underflow")
    return bounty, open_liability - bounty, total_authorized + bounty


def accounting_invariant(total_received: int, open_liability: int, total_authorized: int) -> bool:
    return min(total_received, open_liability, total_authorized) >= 0 and total_received == open_liability + total_authorized


def build_source_manifest(
    repo_owner: str,
    repo_name: str,
    repository_id: int,
    base_sha: str,
    patch_sha: str,
    review_paths: Sequence[str],
    base_hashes: Sequence[str],
    patch_hashes: Sequence[str],
) -> dict[str, Any]:
    validate_repo(repo_owner, repo_name)
    require(type(repository_id) is int and repository_id > 0, "invalid GitHub repository id")
    validate_commit_sha(base_sha)
    validate_commit_sha(patch_sha)
    paths = validate_review_paths(review_paths)
    require(base_sha != patch_sha, "base and patch must differ")
    require(len(paths) == len(base_hashes) == len(patch_hashes), "manifest vector length mismatch")
    for digest in tuple(base_hashes) + tuple(patch_hashes):
        require(bool(re.fullmatch(r"[0-9a-f]{64}", digest)), "invalid content digest")
    return {
        "schema": "patchbond-evidence-v1",
        "repository": {"owner": repo_owner, "name": repo_name, "github_repository_id": repository_id},
        "base_sha": base_sha,
        "patch_sha": patch_sha,
        "review_paths": list(paths),
        "content": [
            {"path": path, "base_sha256": base_hashes[i], "patch_sha256": patch_hashes[i]}
            for i, path in enumerate(paths)
        ],
        "lineage": {"status": "ahead", "merge_base_sha": base_sha},
        "ci": {"decision": "NOT_USED"},
    }
