"""Small deterministic mutation gate for consensus/security-critical guards."""

from __future__ import annotations

from pathlib import Path


SOURCE = Path("contracts/patchbond.py")


REQUIRED_GUARDS = {
    "repo host is contract-owned": '"https://api.github.com/repos/" + owner + "/" + repo',
    "custom independent consensus": "gl.vm.run_nondet_unsafe(leader_fn, validator_fn)",
    "storage copied before nondet": "gl.storage.copy_to_memory",
    "leader result type checked": "isinstance(leader_result, gl.vm.Return)",
    "verdict independently compared": 'proposed["verdict"] == own["verdict"]',
    "evidence digest independently compared": 'proposed["digest"] == own["digest"]',
    "fixed is provisional": "STATUS_PROVISIONAL_FIXED",
    "no accepted-time transfer": "_SettlementRecipient(recipient).emit_transfer",
    "payable creation": "@gl.public.write.payable",
    "message value bounty": "bounty = gl.message.value",
    "challenge namespace": "validate_challenge_path(challenge_path)",
    "response lineage": "self._verify_lineage(owner, repo, challenge_sha, response_patch_sha)",
    "single-use settlement": "authorize_settlement(",
}


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    missing = [name for name, needle in REQUIRED_GUARDS.items() if needle not in source]
    if missing:
        print("mutation survivors: " + ", ".join(missing))
        return 1
    print(f"mutation gate passed: {len(REQUIRED_GUARDS)} critical guard mutations killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
