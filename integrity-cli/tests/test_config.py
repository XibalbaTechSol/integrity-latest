"""Tests for integrity_cli.config: defaults, env-var precedence, on-disk
persistence, and the insecure-default-token guard."""
from __future__ import annotations

import json
import stat

import pytest

from integrity_cli import config


def test_load_config_returns_defaults_when_no_file_exists():
    loaded = config.load_config()
    assert loaded == config.DEFAULT_CONFIG
    # No insecure default token -- this is the whole point of the rewrite.
    assert loaded["AUTH_TOKEN"] == ""


def test_set_and_get_config_value_roundtrips_through_disk():
    config.set_config_value("ORACLE_URL", "http://example:9999")
    assert config.get_config_value("ORACLE_URL") == "http://example:9999"
    # Confirm it actually persisted to disk, not just in-memory.
    on_disk = json.loads(config.CONFIG_FILE.read_text())
    assert on_disk["ORACLE_URL"] == "http://example:9999"


def test_config_file_is_written_with_owner_only_permissions():
    config.set_config_value("AUTH_TOKEN", "sometoken")
    mode = stat.S_IMODE(config.CONFIG_FILE.stat().st_mode)
    assert mode == stat.S_IRUSR | stat.S_IWUSR


def test_env_var_overrides_config_file():
    config.set_config_value("ORACLE_URL", "http://from-file")
    import os

    os.environ["ORACLE_URL"] = "http://from-env"
    try:
        assert config.get_config_value("ORACLE_URL") == "http://from-env"
    finally:
        del os.environ["ORACLE_URL"]


def test_corrupt_config_file_falls_back_to_defaults():
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    config.CONFIG_FILE.write_text("{not valid json")
    assert config.load_config() == config.DEFAULT_CONFIG


def test_get_auth_token_returns_none_when_unset():
    assert config.get_auth_token() is None


def test_get_auth_token_allows_placeholder_in_local_environment():
    config.set_config_value("ENVIRONMENT", "local")
    config.set_config_value("AUTH_TOKEN", "mock_demo_token")
    # In local dev, an obviously-fake token is allowed through -- it's the
    # developer's own machine and their own choice.
    assert config.get_auth_token() == "mock_demo_token"


def test_get_auth_token_refuses_placeholder_outside_local_environment():
    config.set_config_value("ENVIRONMENT", "staging")
    config.set_config_value("AUTH_TOKEN", "mock_demo_token")
    with pytest.raises(ValueError, match="Refusing to use placeholder AUTH_TOKEN"):
        config.get_auth_token()


def test_get_auth_token_accepts_real_looking_token_in_any_environment():
    config.set_config_value("ENVIRONMENT", "staging")
    config.set_config_value("AUTH_TOKEN", "sk_live_a1b2c3d4e5f6")
    assert config.get_auth_token() == "sk_live_a1b2c3d4e5f6"
