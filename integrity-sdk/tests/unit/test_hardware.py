from __future__ import annotations

import builtins
import os
import subprocess

from integrity_sdk.hardware import get_virtualization_env


def test_get_virtualization_env_error_paths(monkeypatch):
    def mock_run(*args, **kwargs):
        raise Exception("systemd-detect-virt failed")

    def mock_open(*args, **kwargs):
        raise Exception("/proc/cpuinfo not found")

    def mock_exists(*args, **kwargs):
        return False

    monkeypatch.setattr(subprocess, "run", mock_run)
    monkeypatch.setattr(builtins, "open", mock_open)
    monkeypatch.setattr(os.path, "exists", mock_exists)

    assert get_virtualization_env() == "none"
