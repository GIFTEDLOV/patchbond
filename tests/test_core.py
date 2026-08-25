import json

import pytest

from contracts.patchbond_core import (
    MAX_CRITERIA_LENGTH,
    MAX_PATH_LENGTH,
    MAX_SPEC_LENGTH,
    PatchBondValidationError,
    STATUS_ACCEPTED,
    STATUS_CHALLENGED,
    STATUS_FINALIZED_CLIENT,
    STATUS_FINALIZED_DEVELOPER,
    STATUS_PROVISIONAL_FIXED,
    accounting_invariant,
    authorize_settlement,
    build_source_manifest,
    canonical_json,
    challenge_next_status,
    checked_deadline,
    deadline_expired,
    deadline_window_open,
    evidence_manifest_digest,
    git_blob_sha,
    parse_verdict,
    submission_next_status,
    validate_bounded_text,
    validate_case_id,
    validate_challenge_path,
    validate_commit_sha,
    validate_repo,
    validate_review_paths,
)


SHA_A = "a" * 40
SHA_B = "b" * 40
DIGEST_A = "1" * 64
DIGEST_B = "2" * 64


@pytest.mark.parametrize("value", ["A" * 40, "a" * 39, "a" * 41, "g" * 40, "0x" + "a" * 40, "", None])
def test_commit_requires_exact_lowercase_40_hex(value):
    with pytest.raises(PatchBondValidationError):
        validate_commit_sha(value)


def test_commit_valid():
    assert validate_commit_sha(SHA_A) == SHA_A


@pytest.mark.parametrize(
    "path",
    [
        "../secret",
        "src/../secret",
        "/etc/passwd",
        "C:/secret",
        "src\\file.py",
        "https://evil.example/x",
        "src//file.py",
        "./src/file.py",
        "src/file.py?ref=evil",
        "src/%2e%2e/file.py",
        "x" * (MAX_PATH_LENGTH + 1),
    ],
)
def test_review_path_rejects_traversal_absolute_and_url_syntax(path):
    with pytest.raises(PatchBondValidationError):
        validate_review_paths([path])


def test_review_paths_are_ordered_bounded_and_unique():
    assert validate_review_paths(["src/a.py", "src/b.py"]) == ("src/a.py", "src/b.py")
    with pytest.raises(PatchBondValidationError, match="duplicate"):
        validate_review_paths(["src/a.py", "src/a.py"])
    with pytest.raises(PatchBondValidationError, match="count"):
        validate_review_paths(["a", "b", "c", "d", "e"])


@pytest.mark.parametrize("path", ["challenge.md", ".patchbond/other/a.md", ".patchbond/challenges/a.exe"])
def test_challenge_path_is_reserved_bounded_text(path):
    with pytest.raises(PatchBondValidationError):
        validate_challenge_path(path)
    assert validate_challenge_path(".patchbond/challenges/case-1.md").endswith(".md")


@pytest.mark.parametrize("owner,repo", [("-bad", "repo"), ("bad-", "repo"), ("bad--name", "repo"), ("ok", "../repo"), ("ok", "repo.git"), ("ok", "https://evil")])
def test_repo_identity_is_strict(owner, repo):
    with pytest.raises(PatchBondValidationError):
        validate_repo(owner, repo)


def test_case_identifier_is_canonical_and_bounded():
    assert validate_case_id("case-01_alpha") == "case-01_alpha"
    for bad in ("Case", "-case", "case space", "a" * 65):
        with pytest.raises(PatchBondValidationError):
            validate_case_id(bad)


def test_specs_and_criteria_are_nonempty_trimmed_and_bounded():
    for label, limit in (("spec", MAX_SPEC_LENGTH), ("criteria", MAX_CRITERIA_LENGTH)):
        assert validate_bounded_text("x", label, limit) == "x"
        for bad in ("", " x", "x ", "x" * (limit + 1)):
            with pytest.raises(PatchBondValidationError):
                validate_bounded_text(bad, label, limit)


@pytest.mark.parametrize("raw", [
    '{"verdict":"FIXED","extra":1}',
    "{}",
    '{"verdict":1}',
    '{"verdict":"fixed"}',
    '{"verdict":"OTHER"}',
    '{"verdict":"FIXED"',
    '[{"verdict":"FIXED"}]',
    '{"verdict":"FIXED","verdict":"NOT_FIXED"}',
    None,
])
def test_strict_verdict_parser_rejects_hostile_output(raw):
    with pytest.raises(PatchBondValidationError, match="MODEL_FAILURE"):
        parse_verdict(raw)


@pytest.mark.parametrize("verdict", ["FIXED", "NOT_FIXED", "INCONCLUSIVE"])
def test_strict_verdict_parser_accepts_exact_schema(verdict):
    assert parse_verdict(canonical_json({"verdict": verdict})) == verdict


def test_evidence_manifest_is_canonical_ordered_and_repo_bound():
    manifest = build_source_manifest(
        "owner", "repo", 123, SHA_A, SHA_B, ["src/a.py"], [DIGEST_A], [DIGEST_B]
    )
    assert manifest["repository"] == {"owner": "owner", "name": "repo", "github_repository_id": 123}
    assert manifest["lineage"] == {"status": "ahead", "merge_base_sha": SHA_A}
    assert manifest["ci"] == {"decision": "NOT_USED"}
    assert evidence_manifest_digest(manifest) == evidence_manifest_digest(json.loads(canonical_json(manifest)))


def test_manifest_rejects_base_equal_patch_and_vector_mismatch():
    with pytest.raises(PatchBondValidationError):
        build_source_manifest("owner", "repo", 123, SHA_A, SHA_A, ["a.py"], [DIGEST_A], [DIGEST_B])
    with pytest.raises(PatchBondValidationError):
        build_source_manifest("owner", "repo", 123, SHA_A, SHA_B, ["a.py"], [], [DIGEST_B])


def test_git_blob_integrity_known_vector():
    assert git_blob_sha(b"test content\n") == "d670460b4b4aece5915caf5c68d12f560a9fe3e4"


def test_state_transitions_provisional_and_challenge_outcomes():
    assert submission_next_status("FIXED") == STATUS_PROVISIONAL_FIXED
    assert submission_next_status("NOT_FIXED") == STATUS_ACCEPTED
    assert submission_next_status("INCONCLUSIVE") == STATUS_ACCEPTED
    assert challenge_next_status("FIXED") == STATUS_FINALIZED_DEVELOPER
    assert challenge_next_status("NOT_FIXED") == STATUS_FINALIZED_CLIENT
    assert challenge_next_status("INCONCLUSIVE") == STATUS_CHALLENGED


def test_deadline_arithmetic_rejects_overflow():
    assert checked_deadline(100, 20) == 120
    with pytest.raises(PatchBondValidationError, match="overflow"):
        checked_deadline((1 << 64) - 1, 1)


@pytest.mark.parametrize(
    "now,open_expected,expired_expected",
    [(999, True, False), (1000, True, False), (1001, False, True)],
)
def test_deadline_is_inclusive_for_participant_and_strict_for_settlement(now, open_expected, expired_expected):
    assert deadline_window_open(now, 1000) is open_expected
    assert deadline_expired(now, 1000) is expired_expected


def test_settlement_arithmetic_is_single_use_and_conserves_credit():
    amount, liability, authorized = authorize_settlement(100, 0, 250, 50)
    assert (amount, liability, authorized) == (100, 150, 150)
    assert accounting_invariant(300, liability, authorized)
    with pytest.raises(PatchBondValidationError, match="duplicate"):
        authorize_settlement(100, amount, liability, authorized)
    with pytest.raises(PatchBondValidationError, match="underflow"):
        authorize_settlement(200, 0, 100, 0)
