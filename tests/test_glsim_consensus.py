"""Production-shaped five-validator proof using the official GLSim consensus engine.

No account key or external service is used. Public addresses, exact local web
fixtures, and a fixed model result keep the proof bounded and reproducible.
"""

from __future__ import annotations

import base64
import hashlib
import json

from glsim.consensus import run_consensus
from glsim.engine import SimEngine
from glsim.state import StateStore, TxStatus


BASE = "a" * 40
PATCH = "b" * 40
PATH = "src/auth.py"
CLIENT = "0x" + "1" * 40
DEVELOPER = "0x" + "2" * 40
VALIDATOR_COUNT = 5


def _blob_sha(content: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(content)).encode() + b"\x00" + content).hexdigest()


def _content_body(content: str) -> str:
    raw = content.encode()
    return json.dumps({
        "type": "file",
        "encoding": "base64",
        "size": len(raw),
        "content": base64.b64encode(raw).decode(),
        "sha": _blob_sha(raw),
    })


def _install_submission_mocks(engine: SimEngine) -> None:
    engine.vm.mock_web(
        r"/repos/owner/repo$",
        {"status": 200, "body": json.dumps({"id": 123, "full_name": "owner/repo"})},
    )
    engine.vm.mock_web(
        rf"/commits/{PATCH}$",
        {"status": 200, "body": json.dumps({"sha": PATCH, "parents": [{"sha": BASE}]})},
    )
    engine.vm.mock_web(
        rf"/compare/{BASE}\.\.\.{PATCH}$",
        {"status": 200, "body": json.dumps({"status": "ahead", "merge_base_commit": {"sha": BASE}})},
    )
    engine.vm.mock_web(
        rf"/contents/{PATH}\?ref={BASE}$",
        {"status": 200, "body": _content_body("def auth():\n    return False\n")},
    )
    engine.vm.mock_web(
        rf"/contents/{PATH}\?ref={PATCH}$",
        {"status": 200, "body": _content_body("def auth(user):\n    return user.is_valid\n")},
    )
    engine.vm.mock_llm(r"security remediation adjudicator", json.dumps({"verdict": "FIXED"}))


def _consensus_call(engine: SimEngine, address: str, method: str, args: list, sender: str):
    return run_consensus(
        engine,
        lambda: (engine.call_method(address, method, args=args, sender=sender), b""),
        num_validators=VALIDATOR_COUNT,
        max_rotations=1,
    )


def _prepared_engine(case_id: str):
    state = StateStore(seed="patchbond-stage2")
    engine = SimEngine(state)
    engine.activate()
    engine.vm.warp("2026-08-25T12:00:00Z")
    address, contract = engine.deploy("contracts/patchbond.py", sender=CLIENT)
    engine.vm.value = 100
    created = _consensus_call(
        engine,
        address,
        "create_case",
        [
            case_id,
            DEVELOPER,
            "owner",
            "repo",
            BASE,
            "Authentication denies valid users.",
            "Allow valid users without bypassing checks.",
            [PATH],
            3600,
        ],
        CLIENT,
    )
    engine.vm.value = 0
    accepted = _consensus_call(engine, address, "accept_case", [case_id], DEVELOPER)
    assert created.status == accepted.status == TxStatus.FINALIZED
    _install_submission_mocks(engine)
    return engine, address, contract


def _successful_proof(case_id: str):
    engine, address, contract = _prepared_engine(case_id)
    calls: list[str] = []
    original = contract._assess_submission_memory

    def counted(*args):
        calls.append("derive")
        return original(*args)

    contract._assess_submission_memory = counted
    try:
        consensus = _consensus_call(engine, address, "submit_patch", [case_id, PATCH], DEVELOPER)
        case = engine.call_method(address, "get_case", [case_id])
        submission = engine.call_method(address, "get_submission", [case["active_submission_id"]])
        accounting = engine.call_method(address, "get_accounting")
        proof = {
            "validator_count": VALIDATOR_COUNT,
            "leader_derivations": 1,
            "validator_derivations": len(calls) - 1,
            "votes": consensus.votes,
            "consensus_status": consensus.status.value,
            "stored_verdict": submission["verdict"],
            "stored_digest": submission["evidence_manifest_digest"],
            "case_status": case["status"],
            "accounting": accounting,
        }
        assert consensus.status == TxStatus.FINALIZED
        assert consensus.votes == ["agree"] * VALIDATOR_COUNT
        assert len(calls) == VALIDATOR_COUNT + 1
        assert case["status"] == "PROVISIONAL_FIXED"
        assert submission["verdict"] == "FIXED"
        return proof
    finally:
        engine.deactivate()


def test_glsim_five_validators_independently_derive_and_commit_deterministic_state(capsys):
    first = _successful_proof("case-proof")
    second = _successful_proof("case-proof")
    assert first == second
    print("GLSIM_PROOF=" + json.dumps(first, sort_keys=True))
    assert "GLSIM_PROOF=" in capsys.readouterr().out


def test_glsim_validator_disagreement_rolls_back_preconsensus_storage():
    engine, address, contract = _prepared_engine("case-disagree")
    bound_manager = engine._storages[address.lower()]
    storage_before = bound_manager.snapshot()
    calls = 0
    original = contract._assess_submission_memory

    def divergent(*args):
        nonlocal calls
        calls += 1
        result = original(*args)
        if calls > 1:
            return {"verdict": "NOT_FIXED", "digest": result["digest"]}
        return result

    contract._assess_submission_memory = divergent
    try:
        consensus = _consensus_call(engine, address, "submit_patch", ["case-disagree", PATCH], DEVELOPER)
        restored_manager = engine._storages[address.lower()]
        assert restored_manager.snapshot() == storage_before

        # GLSim 0.29.2 replaces its manager mapping on rollback but leaves the
        # deployed instance's slots bound to the discarded manager. Repair that
        # test-only view in place, then verify the restored state semantically.
        bound_manager.restore(restored_manager.snapshot())
        engine._storages[address.lower()] = bound_manager
        engine.vm._storage = bound_manager
        case = engine.call_method(address, "get_case", ["case-disagree"])
        accounting = engine.call_method(address, "get_accounting")
        assert consensus.status == TxStatus.UNDETERMINED
        assert consensus.votes == ["disagree"] * VALIDATOR_COUNT
        assert calls == VALIDATOR_COUNT + 1
        assert case["status"] == "ACCEPTED"
        assert case["active_submission_id"] == ""
        assert case["settlement_amount"] == 0
        assert accounting == {"total_received": 100, "open_liability": 100, "total_authorized": 0}
    finally:
        engine.deactivate()
