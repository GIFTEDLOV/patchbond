"""Fail on common committed-secret patterns without reading ignored files."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path


PATTERNS = {
    "private key block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "github token": re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
    "aws access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "assignment-like secret": re.compile(r"(?i)(?:api[_-]?key|secret|private[_-]?key)\s*[=:]\s*['\"][^'\"]{12,}['\"]"),
}


def main() -> int:
    output = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], text=True)
    findings: list[str] = []
    for name in output.splitlines():
        path = Path(name)
        if not path.is_file() or path.stat().st_size > 1_000_000:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in PATTERNS.items():
            if pattern.search(text):
                findings.append(f"{name}: {label}")
    if findings:
        print("\n".join(findings))
        return 1
    print("secret scan passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
