"""Narrow compatibility shims for published local test tooling."""

from __future__ import annotations

import atexit
import os
from pathlib import Path


def _delete_when_process_releases_stdin(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass


if os.name == "nt":
    import gltest.direct.loader as _direct_loader

    _original_inject_message = _direct_loader._inject_message_to_fd0

    def _windows_safe_inject_message(vm) -> None:
        original_unlink = os.unlink

        def defer_locked_unlink(path: str) -> None:
            try:
                original_unlink(path)
            except PermissionError:
                atexit.register(_delete_when_process_releases_stdin, path)

        os.unlink = defer_locked_unlink
        try:
            _original_inject_message(vm)
        finally:
            os.unlink = original_unlink

    _direct_loader._inject_message_to_fd0 = _windows_safe_inject_message
