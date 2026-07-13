"""
Configuration management for the Integrity CLI.

Config is stored as JSON at ~/.integrity-cli/config.json. Values can be
overridden per-invocation by environment variables using the exact names
pinned in docs/INTERFACE_CONTRACT.md section 3 (ORACLE_URL,
BCC_MIDDLEWARE_URL) so this CLI behaves the same way as integrity-sdk and
other packages when wired into docker-compose or CI, without needing a
config file at all.
"""
from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".integrity-cli"
CONFIG_FILE = CONFIG_DIR / "config.json"

# Safe defaults matching docs/INTERFACE_CONTRACT.md section 2 (local
# docker-compose port map). Deliberately NO default AUTH_TOKEN: the old
# prototype shipped "mock_demo_token" as a hardcoded default, which is
# exactly the kind of insecure default that ends up copy-pasted into a
# shared/staging config by accident. Auth must be configured explicitly via
# `integrity auth set-token` or the AUTH_TOKEN env var -- there is no
# fallback value here.
DEFAULT_CONFIG: dict[str, Any] = {
    "ORACLE_URL": "http://localhost:8080",
    "BCC_MIDDLEWARE_URL": "http://localhost:8000",
    "AUTH_TOKEN": "",
    # "local" relaxes the placeholder-token check in get_auth_token() below.
    # Anything else (e.g. "staging", "prod") is treated as a real environment
    # where an obviously-fake token must not silently work.
    "ENVIRONMENT": "local",
}

# If someone sets one of these as AUTH_TOKEN while ENVIRONMENT != "local",
# we fail loudly instead of quietly authenticating with a demo value.
_KNOWN_INSECURE_TOKENS = {"mock_demo_token", "changeme", "test", "demo", "insecure", "password"}


def load_config() -> dict[str, Any]:
    """Load configuration from disk, filling in any keys missing from an
    older/partial config file with defaults (forward-compatible with config
    files written by earlier versions of this CLI)."""
    if not CONFIG_FILE.exists():
        return dict(DEFAULT_CONFIG)
    try:
        with open(CONFIG_FILE) as f:
            config = json.load(f)
    except (json.JSONDecodeError, OSError):
        return dict(DEFAULT_CONFIG)
    merged = dict(DEFAULT_CONFIG)
    merged.update(config)
    return merged


def save_config(config: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2, sort_keys=True)
    # The config file can hold AUTH_TOKEN -- restrict it to the owner, same
    # as the private key files under ~/.integrity-cli/identity/.
    os.chmod(CONFIG_FILE, stat.S_IRUSR | stat.S_IWUSR)


def get_config_value(key: str) -> Any:
    """Read a single config value. Environment variables always win over the
    config file (INTERFACE_CONTRACT.md section 3), so docker-compose/CI can
    override endpoints without touching the developer's on-disk config."""
    if key in os.environ:
        return os.environ[key]
    return load_config().get(key, DEFAULT_CONFIG.get(key))


def set_config_value(key: str, value: str) -> None:
    config = load_config()
    config[key] = value
    save_config(config)


def get_auth_token() -> str | None:
    """Return the configured auth token, or None if none is usable.

    Refuses known-insecure placeholder values outside of local dev so a
    demo/test token can't accidentally authenticate against a real
    deployment -- see _KNOWN_INSECURE_TOKENS above.
    """
    token = get_config_value("AUTH_TOKEN")
    if not token:
        return None
    environment = get_config_value("ENVIRONMENT")
    if environment != "local" and token.strip().lower() in _KNOWN_INSECURE_TOKENS:
        raise ValueError(
            f"Refusing to use placeholder AUTH_TOKEN {token!r} while "
            f"ENVIRONMENT={environment!r}. Configure a real token with "
            "`integrity auth set-token <token>` or the AUTH_TOKEN env var, "
            "or set ENVIRONMENT=local if this really is a local dev box."
        )
    return token
