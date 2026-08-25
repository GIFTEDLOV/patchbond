"""Deterministic mutation gate for consensus, challenge, and settlement guards."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


SOURCE = Path("contracts/patchbond.py")


@dataclass(frozen=True)
class Mutation:
    name: str
    target: str
    replacement: str


EXACT_GUARDS = {
    "contract-owned GitHub host": '"https://api.github.com/repos/" + owner + "/" + repo',
    "payable creation": "@gl.public.write.payable",
    "message value bounty": "bounty = gl.message.value",
    "immutable terms copied": "gl.storage.copy_to_memory(self.case_terms[case_id])",
    "challenge client authorization": 'self._require_sender(self.case_terms[case_id].client, "ONLY_CLIENT")',
    "response developer authorization": 'self._require_sender(self.case_terms[case_id].developer, "ONLY_DEVELOPER")',
    "challenge namespace": "challenge_path = validate_challenge_path(challenge_path)",
    "challenge lineage": "self._verify_lineage(owner, repo, patch_sha, challenge_sha)",
    "response lineage": "self._verify_lineage(owner, repo, challenge_sha, response_patch_sha)",
    "inclusive challenge deadline": "deadline_expired(now, int(self.case_challenge_deadline[case_id]))",
    "inclusive response deadline": "deadline_expired(now, int(self.case_response_deadline[case_id]))",
    "strict uncontested settlement deadline": "deadline_window_open(self._now(), int(self.case_challenge_deadline[case_id]))",
    "strict timeout settlement deadline": "deadline_window_open(self._now(), int(self.case_response_deadline[case_id]))",
    "submission validator derivation": "own = self._assess_submission_memory",
    "challenge validator derivation": "own = self._challenge_evidence_memory",
    "response validator derivation": "own = self._assess_response_memory",
    "submission exact comparison": 'set(proposed.keys()) == {"verdict", "digest"}',
    "challenge exact comparison": 'set(proposed.keys()) == {"digest", "content"}',
    "response exact comparison": 'set(proposed.keys()) == {"verdict", "digest"} and proposed == own',
    "fixed is provisional": "STATUS_PROVISIONAL_FIXED",
    "inconclusive remains challenged": "return STATUS_CHALLENGED",
    "exact original bounty": "bounty = int(self.case_terms[case_id].bounty)",
    "single-use settlement": "current = int(self.case_settlement_amount.get(case_id, u256(0)))",
    "finalization-only transfer": "_SettlementRecipient(recipient).emit_transfer(value=u256(amount))",
}


MUTATIONS = tuple(
    Mutation(name, target, target.replace(target[0], "#", 1))
    for name, target in EXACT_GUARDS.items()
) + (
    Mutation(
        "bypass one custom consensus call",
        "result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)",
        "result = leader_fn()",
    ),
    Mutation(
        "transfer before accounting authorization",
        "self.total_authorized = u256(authorized)\n        _SettlementRecipient(recipient).emit_transfer(value=u256(amount))",
        "_SettlementRecipient(recipient).emit_transfer(value=u256(amount))\n        self.total_authorized = u256(authorized)",
    ),
    Mutation(
        "submission storage write before consensus",
        "result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)\n        now = self._now()",
        "self.case_status[case_id] = STATUS_ACCEPTED\n        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)\n        now = self._now()",
    ),
)


def security_violations(source: str) -> list[str]:
    violations = [name for name, needle in EXACT_GUARDS.items() if needle not in source]
    if source.count("result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)") != 3:
        violations.append("all three nondeterministic paths require custom consensus")
    if source.count("gl.storage.copy_to_memory(self.case_terms[case_id])") != 3:
        violations.append("all three nondeterministic paths copy terms to memory")

    method_bounds = (
        ("    def submit_patch(", "    def _challenge_evidence_memory("),
        ("    def challenge(", "    def _assess_response_memory("),
        ("    def respond_to_challenge(", "    def _authorize_and_emit("),
    )
    for method_start, method_end in method_bounds:
        start = source.find(method_start)
        end = source.find(method_end, start)
        block = source[start:end]
        consensus = block.find("result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)")
        first_write = block.find("self.case_", block.find("def validator_fn"))
        if start < 0 or end < 0 or consensus < 0 or first_write < 0 or first_write < consensus:
            violations.append(method_start.strip() + " writes storage only after consensus")

    settlement_start = source.find("    def _authorize_and_emit(")
    settlement_end = source.find("    @gl.public.write\n    def finalize_uncontested", settlement_start)
    settlement = source[settlement_start:settlement_end]
    accounting = settlement.find("self.total_authorized = u256(authorized)")
    transfer = settlement.find("_SettlementRecipient(recipient).emit_transfer")
    if settlement_start < 0 or accounting < 0 or transfer < 0 or accounting > transfer:
        violations.append("settlement accounting is authorized before transfer emission")
    return sorted(set(violations))


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    baseline = security_violations(source)
    if baseline:
        print("baseline security guard failure: " + ", ".join(baseline))
        return 1

    survivors: list[str] = []
    killed = 0
    for mutation in MUTATIONS:
        if mutation.target not in source:
            survivors.append(mutation.name + " (target missing)")
            continue
        mutant = source.replace(mutation.target, mutation.replacement)
        if security_violations(mutant):
            killed += 1
        else:
            survivors.append(mutation.name)

    if survivors:
        print("mutation survivors: " + ", ".join(survivors))
        return 1
    print(f"mutation gate passed: {killed} challenge/consensus/settlement mutations killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
