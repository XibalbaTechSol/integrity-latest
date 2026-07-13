"""
Secrets-vault integration — INTERFACE ONLY, genuinely out of scope for this
build.

The old prototype had no implementation here beyond an interface either;
this rebuild keeps it that way deliberately rather than inventing a fake
backend. A real implementation would integrate with something like
HashiCorp Vault, AWS Secrets Manager, or a TEE-sealed local keystore to hold
the DID private key (did.py currently persists it as a 0600 PEM file on
disk, which is adequate for a dev/CI environment but not for a
production agent handling real value). Building that integration requires
picking and standing up a real vault backend, which is genuinely outside
what this package's rebuild covers — flagged here and in the README rather
than silently left unmentioned or faked with an in-memory stub pretending
to be a vault.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional


class SecretsVault(ABC):
    """Interface a real vault backend would implement. No implementation
    ships in this package — see module docstring."""

    @abstractmethod
    def get_secret(self, key: str) -> Optional[bytes]:
        raise NotImplementedError

    @abstractmethod
    def put_secret(self, key: str, value: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def delete_secret(self, key: str) -> None:
        raise NotImplementedError
