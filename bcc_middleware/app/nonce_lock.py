"""
Process-wide, per-signer-address lock serializing "read nonce -> build ->
sign -> broadcast -> wait for receipt" across every chain-writing caller in
this service.

app/anchor.py and app/reputation.py can share the SAME private key on
today's single-operator testnet deployment (`REPUTATION_SIGNER_PRIVATE_KEY`
falls back to `ANCHOR_SIGNER_PRIVATE_KEY` -- see reputation.py's module
docstring), and they run on genuinely different OS threads: anchoring is
invoked (via `asyncio.to_thread`, see main.py) from a request-handling code
path, while the reputation sync loop runs via its own `asyncio.to_thread`
call from a periodic background task. web3.py's `get_transaction_count`
(reads the next nonce, defaults to the 'latest' MINED block -- it does not
see another thread's still-pending transaction) and `send_raw_transaction`
are separate network round-trips with no atomicity between them: two threads
can each read the same "next" nonce before either transaction is mined, then
both submit with that same nonce. One succeeds; the other fails with "nonce
too low" (or worse, silently replaces it if gas pricing works out that way).
PRODUCTION_GAPS.md §5.

The lock must be held for the FULL sequence, including the receipt wait --
not just the nonce read -- so that by the time a second caller for the same
address reads the nonce, the first caller's transaction is actually mined
and `get_transaction_count` correctly reflects it. This trades some
throughput (chain writes for the same key are fully serialized) for
correctness; this service's write volume (periodic score syncs, occasional
anchor flushes) makes that an acceptable cost, not a bottleneck.
"""

from __future__ import annotations

import threading

_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def signer_lock(address: str) -> threading.Lock:
    """
    Returns the same `Lock` instance for the same (case-insensitive)
    address on every call, process-wide. Different addresses get
    independent locks, so callers using genuinely different signer keys
    never block each other.
    """
    key = address.lower()
    with _locks_guard:
        lock = _locks.get(key)
        if lock is None:
            lock = threading.Lock()
            _locks[key] = lock
        return lock
