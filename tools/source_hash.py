"""Verify the committed PatchBond deployable source digest."""

from __future__ import annotations

import hashlib
from pathlib import Path


SOURCE = Path("contracts/patchbond.py")
DIGEST_FILE = Path("contracts/patchbond.py.sha256")


def main() -> int:
    record = DIGEST_FILE.read_text(encoding="ascii").strip().split()
    if len(record) != 2 or record[1] != SOURCE.as_posix():
        print("invalid contract provenance record")
        return 1
    actual = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    if actual != record[0]:
        print(f"contract source digest mismatch: expected {record[0]}, got {actual}")
        return 1
    print(f"contract source digest verified: {actual}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
