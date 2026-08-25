import base64
import hashlib
import json
from datetime import datetime, timezone

import pytest


BASE = "a" * 40
PATCH = "b" * 40
PATCH_2 = "c" * 40
CHALLENGE = "d" * 40
RESPONSE = "e" * 40
PATH = "src/auth.py"
CHALLENGE_PATH = ".patchbond/challenges/case-1.md"


def _hex(address) -> str:
    return "0x" + bytes(address).hex()


def _blob_sha(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\x00" + content).hexdigest()


def _content_body(content: str):
    raw = content.encode()
    return json.dumps(
        {
            "type": "file",
            "encoding": "base64",
            "size": len(raw),
            "content": base64.b64encode(raw).decode(),
            "sha": _blob_sha(raw),
        }
    )


def _commit_body(sha: str):
    return json.dumps({"sha": sha, "parents": [{"sha": BASE}]})


def _compare_body(base: str):
    return json.dumps({"status": "ahead", "merge_base_commit": {"sha": base}})


def _warp_epoch(direct_vm, epoch_seconds: int) -> None:
    instant = datetime.fromtimestamp(epoch_seconds, timezone.utc).isoformat().replace("+00:00", "Z")
    direct_vm.warp(instant)


def _drop_web_mock(direct_vm, url_fragment: str) -> None:
    direct_vm._web_mocks = [
        pair for pair in direct_vm._web_mocks if url_fragment not in pair[0].pattern.replace("\\", "")
    ]


def _mock_submission(
    direct_vm,
    patch=PATCH,
    verdict="FIXED",
    patch_text="def auth():\n    return True\n",
    llm_response=None,
):
    direct_vm.mock_web(r"/repos/owner/repo$", {"status": 200, "body": json.dumps({"id": 123, "full_name": "owner/repo"})})
    direct_vm.mock_web(rf"/commits/{patch}$", {"status": 200, "body": _commit_body(patch)})
    direct_vm.mock_web(rf"/compare/{BASE}\.\.\.{patch}$", {"status": 200, "body": _compare_body(BASE)})
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={BASE}$", {"status": 200, "body": _content_body("def auth():\n    return False\n")})
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={patch}$", {"status": 200, "body": _content_body(patch_text)})
    direct_vm.mock_llm(
        r"security remediation adjudicator",
        llm_response if llm_response is not None else json.dumps({"verdict": verdict}),
    )


def _mock_challenge(direct_vm, lineage_status="ahead", merge_base=PATCH):
    direct_vm.mock_web(r"/repos/owner/repo$", {"status": 200, "body": json.dumps({"id": 123, "full_name": "owner/repo"})})
    direct_vm.mock_web(rf"/commits/{CHALLENGE}$", {"status": 200, "body": _commit_body(CHALLENGE)})
    direct_vm.mock_web(
        rf"/compare/{PATCH}\.\.\.{CHALLENGE}$",
        {"status": 200, "body": json.dumps({"status": lineage_status, "merge_base_commit": {"sha": merge_base}})},
    )
    direct_vm.mock_web(
        rf"/contents/{re_escape(CHALLENGE_PATH)}\?ref={CHALLENGE}$",
        {"status": 200, "body": _content_body("Regression: invalid users are accepted.")},
    )


def _mock_response(direct_vm, verdict="FIXED", response_lineage_status="ahead"):
    direct_vm.mock_web(r"/repos/owner/repo$", {"status": 200, "body": json.dumps({"id": 123, "full_name": "owner/repo"})})
    for sha in (PATCH, RESPONSE, CHALLENGE):
        direct_vm.mock_web(rf"/commits/{sha}$", {"status": 200, "body": _commit_body(sha)})
    direct_vm.mock_web(
        rf"/compare/{CHALLENGE}\.\.\.{RESPONSE}$",
        {
            "status": 200,
            "body": json.dumps(
                {
                    "status": response_lineage_status,
                    "merge_base_commit": {"sha": CHALLENGE if response_lineage_status == "ahead" else BASE},
                }
            ),
        },
    )
    direct_vm.mock_web(rf"/compare/{BASE}\.\.\.{PATCH}$", {"status": 200, "body": _compare_body(BASE)})
    direct_vm.mock_web(rf"/compare/{BASE}\.\.\.{RESPONSE}$", {"status": 200, "body": _compare_body(BASE)})
    direct_vm.mock_web(rf"/compare/{PATCH}\.\.\.{CHALLENGE}$", {"status": 200, "body": _compare_body(PATCH)})
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={BASE}$", {"status": 200, "body": _content_body("def auth():\n    return False\n")})
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={PATCH}$", {"status": 200, "body": _content_body("def auth():\n    return True\n")})
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={RESPONSE}$", {"status": 200, "body": _content_body("def auth(user):\n    return user.is_valid\n")})
    direct_vm.mock_web(
        rf"/contents/{re_escape(CHALLENGE_PATH)}\?ref={CHALLENGE}$",
        {"status": 200, "body": _content_body("Regression: invalid users are accepted.")},
    )
    direct_vm.mock_llm(r"security remediation adjudicator", json.dumps({"verdict": verdict}))


def _deploy_case(direct_vm, direct_deploy, client, developer, case_id="case-1", bounty=100):
    direct_vm.sender = client
    direct_vm.value = bounty
    contract = direct_deploy("contracts/patchbond.py")
    contract.create_case(
        case_id,
        _hex(developer),
        "owner",
        "repo",
        BASE,
        "Authentication always returns false, denying valid users.",
        "The reviewed authentication function must allow valid users without bypassing checks.",
        [PATH],
        3600,
    )
    direct_vm.value = 0
    return contract


def test_create_accept_access_control_and_immutable_terms(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    case = contract.get_case("case-1")
    assert case["status"] == "OPEN"
    assert case["bounty_amount"] == 100
    assert contract.get_accounting() == {"total_received": 100, "open_liability": 100, "total_authorized": 0}

    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("ONLY_DEVELOPER"):
        contract.accept_case("case-1")
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    assert contract.get_case("case-1")["status"] == "ACCEPTED"
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("CASE_NOT_OPEN"):
        contract.accept_case("case-1")


def test_submit_before_accept_wrong_developer_and_base_sha_rejected(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("CASE_NOT_ACCEPTED"):
        contract.submit_patch("case-1", PATCH)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("ONLY_DEVELOPER"):
        contract.submit_patch("case-1", PATCH)
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("PATCH_EQUALS_BASE"):
        contract.submit_patch("case-1", BASE)


@pytest.mark.parametrize("verdict,expected", [("NOT_FIXED", "ACCEPTED"), ("INCONCLUSIVE", "ACCEPTED"), ("FIXED", "PROVISIONAL_FIXED")])
def test_submission_verdict_state_and_no_early_settlement(direct_vm, direct_deploy, direct_alice, direct_bob, verdict, expected):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm, verdict=verdict)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    case = contract.get_case("case-1")
    assert case["status"] == expected
    assert case["settlement_amount"] == 0
    assert contract.get_accounting()["open_liability"] == 100
    submission = contract.get_submission(case["active_submission_id"])
    assert submission["verdict"] == verdict
    assert len(submission["evidence_manifest_digest"]) == 64


def test_duplicate_patch_and_malformed_model_are_failures(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm, verdict="NOT_FIXED")
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("DUPLICATE_PATCH"):
        contract.submit_patch("case-1", PATCH)

    direct_vm.clear_mocks()
    _mock_submission(direct_vm, patch=PATCH_2, llm_response='{"verdict":"FIXED","extra":true}')
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("MODEL_FAILURE"):
        contract.submit_patch("case-1", PATCH_2)


def test_unavailable_404_and_non_descendant_are_evidence_failures(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    direct_vm.mock_web(r".*", {"status": 404, "body": "{}"})
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("EVIDENCE_FAILURE"):
        contract.submit_patch("case-1", PATCH)

    direct_vm.clear_mocks()
    direct_vm.mock_web(r"/repos/owner/repo$", {"status": 200, "body": json.dumps({"id": 123, "full_name": "owner/repo"})})
    direct_vm.mock_web(rf"/commits/{PATCH}$", {"status": 200, "body": _commit_body(PATCH)})
    direct_vm.mock_web(r"/compare/", {"status": 200, "body": json.dumps({"status": "diverged", "merge_base_commit": {"sha": "f" * 40}})})
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("NON_DESCENDANT"):
        contract.submit_patch("case-1", PATCH)


def test_validator_independently_retrieves_and_disagrees(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm, verdict="FIXED")
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)

    direct_vm.clear_mocks()
    _mock_submission(direct_vm, verdict="NOT_FIXED")
    assert direct_vm.run_validator() is False


def test_challenge_authorization_deadline_and_repo_bound_path(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)

    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("ONLY_CLIENT"):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    with direct_vm.prank(direct_alice), direct_vm.expect_revert("INVALID_CHALLENGE"):
        contract.challenge("case-1", CHALLENGE, "https://evil.example/challenge")

    direct_vm.clear_mocks()
    _mock_challenge(direct_vm)
    with direct_vm.prank(direct_alice):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    assert contract.get_case("case-1")["status"] == "CHALLENGED"


def _provisional_then_challenged(direct_vm, direct_deploy, client, developer):
    contract = _deploy_case(direct_vm, direct_deploy, client, developer)
    with direct_vm.prank(developer):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(developer):
        contract.submit_patch("case-1", PATCH)
    direct_vm.clear_mocks()
    _mock_challenge(direct_vm)
    with direct_vm.prank(client):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    direct_vm.clear_mocks()
    return contract


@pytest.mark.parametrize(
    "verdict,expected_status,expected_recipient",
    [("FIXED", "FINALIZED_DEVELOPER", "developer"), ("NOT_FIXED", "FINALIZED_CLIENT", "client"), ("INCONCLUSIVE", "CHALLENGED", "none")],
)
def test_response_flow_and_terminal_entitlement(direct_vm, direct_deploy, direct_alice, direct_bob, verdict, expected_status, expected_recipient):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_response(direct_vm, verdict)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    with direct_vm.prank(direct_bob):
        contract.respond_to_challenge("case-1", RESPONSE)
    case = contract.get_case("case-1")
    assert case["status"] == expected_status
    if expected_recipient == "none":
        assert case["settlement_amount"] == 0
        assert contract.get_accounting()["open_liability"] == 100
    else:
        expected = direct_bob if expected_recipient == "developer" else direct_alice
        assert case["settlement_recipient"].lower() == _hex(expected).lower()
        assert case["settlement_amount"] == 100
        assert case["settlement_status"] == "AUTHORIZED_FINALIZED_ONLY"
        assert contract.get_accounting() == {"total_received": 100, "open_liability": 0, "total_authorized": 100}


def test_response_unauthorized_late_and_wrong_lineage(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_charlie), direct_vm.expect_revert("ONLY_DEVELOPER"):
        contract.respond_to_challenge("case-1", RESPONSE)


def test_response_wrong_lineage_is_evidence_failure(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_response(direct_vm, response_lineage_status="diverged")
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("NON_DESCENDANT"):
        contract.respond_to_challenge("case-1", RESPONSE)

    _mock_response(direct_vm)
    direct_vm.warp("2100-01-01T00:00:00Z")
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("RESPONSE_DEADLINE_PASSED"):
        contract.respond_to_challenge("case-1", RESPONSE)


def test_challenge_wrong_lineage_is_evidence_failure(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    direct_vm.clear_mocks()
    _mock_challenge(direct_vm, lineage_status="diverged", merge_base=BASE)
    with direct_vm.prank(direct_alice), direct_vm.expect_revert("NON_DESCENDANT"):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)


def test_wrong_repository_identity_and_content_integrity_fail(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    direct_vm.mock_web(r"/repos/owner/repo$", {"status": 200, "body": json.dumps({"id": 999, "full_name": "evil/repo"})})
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("REPOSITORY_IDENTITY"):
        contract.submit_patch("case-1", PATCH)

    direct_vm.clear_mocks()
    _mock_submission(direct_vm)
    direct_vm._web_mocks = [
        pair
        for pair in direct_vm._web_mocks
        if f"/contents/{PATH}?ref={PATCH}" not in pair[0].pattern.replace("\\", "")
    ]
    broken = json.loads(_content_body("tampered"))
    broken["sha"] = "0" * 40
    direct_vm.mock_web(rf"/contents/{PATH}\?ref={PATCH}$", {"status": 200, "body": json.dumps(broken)})
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("BLOB_INTEGRITY"):
        contract.submit_patch("case-1", PATCH)


def test_model_exception_is_model_failure(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    direct_vm._llm_mocks.clear()

    def fail_model(_request):
        raise RuntimeError("provider unavailable")

    direct_vm._live_llm_handler = fail_model
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("MODEL_FAILURE"):
        contract.submit_patch("case-1", PATCH)


def test_late_challenge_and_uncontested_finalization(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    direct_vm.warp("2100-01-01T00:00:00Z")
    with direct_vm.prank(direct_alice), direct_vm.expect_revert("CHALLENGE_DEADLINE_PASSED"):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    contract.finalize_uncontested("case-1")
    assert contract.get_case("case-1")["status"] == "FINALIZED_DEVELOPER"
    with direct_vm.expect_revert("NOT_PROVISIONAL"):
        contract.finalize_uncontested("case-1")


def test_no_response_allows_deterministic_client_refund(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.expect_revert("RESPONSE_WINDOW_ACTIVE"):
        contract.authorize_client_refund("case-1")
    direct_vm.warp("2100-01-01T00:00:00Z")
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    contract.authorize_client_refund("case-1")
    case = contract.get_case("case-1")
    assert case["status"] == "FINALIZED_CLIENT"
    assert case["settlement_recipient"].lower() == _hex(direct_alice).lower()


def re_escape(value: str) -> str:
    import re

    return re.escape(value)


def test_multiple_cases_are_isolated(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob, "case-a", 100)
    direct_vm.sender = direct_alice
    direct_vm.value = 250
    contract.create_case(
        "case-b", _hex(direct_charlie), "owner", "repo", BASE,
        "Second vulnerability.", "Second acceptance criterion.", [PATH], 7200,
    )
    direct_vm.value = 0
    assert contract.get_case("case-a")["developer_address"].lower() == _hex(direct_bob).lower()
    assert contract.get_case("case-b")["developer_address"].lower() == _hex(direct_charlie).lower()
    assert contract.get_accounting() == {"total_received": 350, "open_liability": 350, "total_authorized": 0}


@pytest.mark.parametrize("offset,allowed", [(-1, True), (0, True), (1, False)])
def test_challenge_deadline_exact_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob, offset, allowed
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    deadline = contract.get_case("case-1")["challenge_deadline"]
    _warp_epoch(direct_vm, deadline + offset)
    direct_vm.clear_mocks()
    _mock_challenge(direct_vm)
    if allowed:
        with direct_vm.prank(direct_alice):
            contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
        assert contract.get_case("case-1")["status"] == "CHALLENGED"
    else:
        with direct_vm.prank(direct_alice), direct_vm.expect_revert("CHALLENGE_DEADLINE_PASSED"):
            contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
        assert contract.get_case("case-1")["status"] == "PROVISIONAL_FIXED"


@pytest.mark.parametrize("offset,allowed", [(-1, False), (0, False), (1, True)])
def test_uncontested_finalization_exact_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob, offset, allowed
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    deadline = contract.get_case("case-1")["challenge_deadline"]
    _warp_epoch(direct_vm, deadline + offset)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    if allowed:
        contract.finalize_uncontested("case-1")
        assert contract.get_case("case-1")["status"] == "FINALIZED_DEVELOPER"
    else:
        with direct_vm.expect_revert("CHALLENGE_WINDOW_ACTIVE"):
            contract.finalize_uncontested("case-1")
        assert contract.get_case("case-1")["settlement_amount"] == 0


@pytest.mark.parametrize("offset,allowed", [(-1, True), (0, True), (1, False)])
def test_response_deadline_exact_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob, offset, allowed
):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    deadline = contract.get_case("case-1")["response_deadline"]
    _warp_epoch(direct_vm, deadline + offset)
    _mock_response(direct_vm, verdict="INCONCLUSIVE")
    if allowed:
        with direct_vm.prank(direct_bob):
            contract.respond_to_challenge("case-1", RESPONSE)
        assert contract.get_case("case-1")["status"] == "CHALLENGED"
        assert contract.get_case("case-1")["settlement_amount"] == 0
    else:
        with direct_vm.prank(direct_bob), direct_vm.expect_revert("RESPONSE_DEADLINE_PASSED"):
            contract.respond_to_challenge("case-1", RESPONSE)


@pytest.mark.parametrize("offset,allowed", [(-1, False), (0, False), (1, True)])
def test_client_timeout_refund_exact_boundary(
    direct_vm, direct_deploy, direct_alice, direct_bob, offset, allowed
):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    deadline = contract.get_case("case-1")["response_deadline"]
    _warp_epoch(direct_vm, deadline + offset)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    if allowed:
        contract.authorize_client_refund("case-1")
        assert contract.get_case("case-1")["status"] == "FINALIZED_CLIENT"
    else:
        with direct_vm.expect_revert("RESPONSE_WINDOW_ACTIVE"):
            contract.authorize_client_refund("case-1")
        assert contract.get_case("case-1")["settlement_amount"] == 0


@pytest.mark.parametrize(
    "failure_kind,error",
    [
        ("wrong_repo", "REPOSITORY_IDENTITY"),
        ("symlink", "CONTENT_SHAPE"),
        ("oversized", "CONTENT_SIZE"),
        ("invalid_utf8", "CONTENT_NOT_TEXT"),
        ("unavailable", "HTTP_404"),
    ],
)
def test_malformed_challenge_evidence_fails_without_state_change(
    direct_vm, direct_deploy, direct_alice, direct_bob, failure_kind, error
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    direct_vm.clear_mocks()
    _mock_challenge(direct_vm)
    if failure_kind == "wrong_repo":
        _drop_web_mock(direct_vm, "/repos/owner/repo$")
        direct_vm.mock_web(
            r"/repos/owner/repo$",
            {"status": 200, "body": json.dumps({"id": 123, "full_name": 7})},
        )
    else:
        _drop_web_mock(direct_vm, f"/contents/{CHALLENGE_PATH}?ref={CHALLENGE}$")
        pattern = rf"/contents/{re_escape(CHALLENGE_PATH)}\?ref={CHALLENGE}$"
        if failure_kind == "symlink":
            body = json.dumps({"type": "symlink", "encoding": "base64", "size": 0, "content": "", "sha": ""})
            direct_vm.mock_web(pattern, {"status": 200, "body": body})
        elif failure_kind == "oversized":
            body = json.dumps({"type": "file", "encoding": "base64", "size": 16_385, "content": "", "sha": ""})
            direct_vm.mock_web(pattern, {"status": 200, "body": body})
        elif failure_kind == "invalid_utf8":
            raw = b"\xff"
            body = json.dumps({
                "type": "file", "encoding": "base64", "size": 1,
                "content": base64.b64encode(raw).decode(), "sha": _blob_sha(raw),
            })
            direct_vm.mock_web(pattern, {"status": 200, "body": body})
        else:
            direct_vm.mock_web(pattern, {"status": 404, "body": "{}"})
    with direct_vm.prank(direct_alice), direct_vm.expect_revert(error):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    case = contract.get_case("case-1")
    assert case["status"] == "PROVISIONAL_FIXED"
    assert case["challenge_evidence_digest"] == ""
    assert case["settlement_amount"] == 0


def test_technical_response_failure_is_not_client_victory(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_response(direct_vm)
    direct_vm._llm_mocks.clear()

    def fail_model(_request):
        raise RuntimeError("provider unavailable")

    direct_vm._live_llm_handler = fail_model
    with direct_vm.prank(direct_bob), direct_vm.expect_revert("MODEL_FAILURE"):
        contract.respond_to_challenge("case-1", RESPONSE)
    case = contract.get_case("case-1")
    assert case["status"] == "CHALLENGED"
    assert case["settlement_amount"] == 0
    assert contract.get_accounting() == {"total_received": 100, "open_liability": 100, "total_authorized": 0}

    _warp_epoch(direct_vm, case["response_deadline"] + 1)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    contract.authorize_client_refund("case-1")
    assert contract.get_case("case-1")["status"] == "FINALIZED_CLIENT"


def test_challenge_and_response_cannot_mutate_original_terms(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob, bounty=137)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    immutable_keys = (
        "client_address", "developer_address", "repo_owner", "repo_name", "base_commit_sha",
        "vulnerability_spec", "acceptance_criteria", "review_paths", "bounty_amount",
        "challenge_window_seconds",
    )
    before = {key: contract.get_case("case-1")[key] for key in immutable_keys}
    direct_vm.clear_mocks()
    _mock_challenge(direct_vm)
    with direct_vm.prank(direct_alice):
        contract.challenge("case-1", CHALLENGE, CHALLENGE_PATH)
    assert {key: contract.get_case("case-1")[key] for key in immutable_keys} == before
    direct_vm.clear_mocks()
    _mock_response(direct_vm, verdict="INCONCLUSIVE")
    with direct_vm.prank(direct_bob):
        contract.respond_to_challenge("case-1", RESPONSE)
    assert {key: contract.get_case("case-1")[key] for key in immutable_keys} == before


def test_settlement_is_single_case_exact_bounty_and_correct_recipient(
    direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob, "case-a", 100)
    direct_vm.sender = direct_alice
    direct_vm.value = 250
    contract.create_case(
        "case-b", _hex(direct_charlie), "owner", "repo", BASE,
        "Second vulnerability.", "Second acceptance criterion.", [PATH], 7200,
    )
    direct_vm.value = 0
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-a")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-a", PATCH)
    deadline = contract.get_case("case-a")["challenge_deadline"]
    _warp_epoch(direct_vm, deadline + 1)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    contract.finalize_uncontested("case-a")

    case_a = contract.get_case("case-a")
    case_b = contract.get_case("case-b")
    assert case_a["settlement_recipient"].lower() == _hex(direct_bob).lower()
    assert case_a["settlement_amount"] == 100
    assert case_b["settlement_recipient"].lower() == "0x" + "0" * 40
    assert case_b["settlement_amount"] == 0
    assert case_b["bounty_amount"] == 250
    assert contract.get_accounting() == {"total_received": 350, "open_liability": 250, "total_authorized": 100}
    with direct_vm.expect_revert("NOT_PROVISIONAL"):
        contract.finalize_uncontested("case-a")


@pytest.mark.parametrize("failure_kind,error", [("repository", "REPOSITORY_IDENTITY"), ("web", "HTTP_503")])
def test_response_evidence_failure_is_not_client_victory(
    direct_vm, direct_deploy, direct_alice, direct_bob, failure_kind, error
):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    _mock_response(direct_vm)
    if failure_kind == "repository":
        _drop_web_mock(direct_vm, "/repos/owner/repo$")
        direct_vm.mock_web(
            r"/repos/owner/repo$",
            {"status": 200, "body": json.dumps({"id": 999, "full_name": "other/repo"})},
        )
    else:
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", {"status": 503, "body": "{}"})
    with direct_vm.prank(direct_bob), direct_vm.expect_revert(error):
        contract.respond_to_challenge("case-1", RESPONSE)
    case = contract.get_case("case-1")
    assert case["status"] == "CHALLENGED"
    assert case["active_submission_id"] == "case-1:1"
    assert case["settlement_amount"] == 0
    assert contract.get_accounting() == {"total_received": 100, "open_liability": 100, "total_authorized": 0}


def test_failed_transfer_authorization_reverts_terminal_state_and_accounting(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _deploy_case(direct_vm, direct_deploy, direct_alice, direct_bob)
    with direct_vm.prank(direct_bob):
        contract.accept_case("case-1")
    _mock_submission(direct_vm)
    with direct_vm.prank(direct_bob):
        contract.submit_patch("case-1", PATCH)
    case = contract.get_case("case-1")
    _warp_epoch(direct_vm, case["challenge_deadline"] + 1)

    def fail_transfer(_vm, _request):
        raise RuntimeError("transfer authorization failed")

    direct_vm._gl_call_hook = fail_transfer
    snapshot = direct_vm.snapshot()
    with direct_vm.expect_revert("transfer authorization failed"):
        contract.finalize_uncontested("case-1")
    # Direct verifies the exception but does not auto-rollback. Restore its
    # explicit snapshot to model GenVM transaction atomicity before assertions.
    direct_vm.revert(snapshot)
    case = contract.get_case("case-1")
    assert case["status"] == "PROVISIONAL_FIXED"
    assert case["settlement_status"] == "NONE"
    assert case["settlement_amount"] == 0
    assert contract.get_accounting() == {"total_received": 100, "open_liability": 100, "total_authorized": 0}


def test_duplicate_client_timeout_settlement_is_impossible(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    contract = _provisional_then_challenged(direct_vm, direct_deploy, direct_alice, direct_bob)
    case = contract.get_case("case-1")
    _warp_epoch(direct_vm, case["response_deadline"] + 1)
    direct_vm._gl_call_hook = lambda _vm, _request: {"ok": None}
    contract.authorize_client_refund("case-1")
    with direct_vm.expect_revert("NOT_CHALLENGED"):
        contract.authorize_client_refund("case-1")
    assert contract.get_accounting() == {"total_received": 100, "open_liability": 0, "total_authorized": 100}
