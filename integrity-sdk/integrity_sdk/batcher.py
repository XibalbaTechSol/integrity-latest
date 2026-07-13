"""
Telemetry batching: aggregates per-inference telemetry at the edge so we
proof/transmit in batches rather than one network+ZK-proof round trip per
event. Real, working code carried over from the old prototype unchanged in
behavior (it was never one of the mocked pieces).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List


class TelemetryBatcher:
    def __init__(self, batch_size_limit: int = 50, flush_interval_sec: float = 5.0):
        self.batch_size_limit = batch_size_limit
        self.flush_interval_sec = flush_interval_sec
        self.queue: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._last_flush = time.time()

    def add_telemetry(self, data: Dict[str, Any]) -> None:
        with self._lock:
            self.queue.append(data)

    def should_flush(self) -> bool:
        with self._lock:
            if len(self.queue) >= self.batch_size_limit:
                return True
            return time.time() - self._last_flush >= self.flush_interval_sec and len(self.queue) > 0

    def get_batch_and_clear(self) -> List[Dict[str, Any]]:
        """Drains up to batch_size_limit items, leaving any overflow queued
        for the next cycle rather than growing the batch unboundedly."""
        with self._lock:
            drain_count = min(len(self.queue), self.batch_size_limit)
            batch = self.queue[:drain_count]
            self.queue = self.queue[drain_count:]
            self._last_flush = time.time()
            return batch
