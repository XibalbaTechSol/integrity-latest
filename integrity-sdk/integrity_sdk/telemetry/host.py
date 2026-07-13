"""
Background host-metric sampler: periodically snapshots process I/O and
network activity to feed the behavioral-signal heuristics in client.py.
This was real, working code in the old prototype — kept largely as-is, with
one bug fixed: `Optional[threading.Thread]` was used as a type annotation
without `Optional` ever being imported from `typing` (only `Set, Dict` were),
which raises `NameError` the moment that line executes (annotations on plain
assignments, unlike function signatures, are evaluated eagerly unless
`from __future__ import annotations` is active — this file didn't have it).
"""

from __future__ import annotations

import math
import os
import threading
import time
from typing import Dict, Optional

import psutil

from .conventions import IntegrityAttributes
from .core import get_meter


class HostTelemetrySampler:
    """Periodically samples host-level I/O and network metrics for the
    current process: storage flux (read/write byte ratio), file-access-path
    entropy, and destination-IP entropy — cheap behavioral signals that
    don't require inspecting model inputs/outputs at all."""

    def __init__(self, interval_sec: float = 10.0):
        self.interval_sec = interval_sec
        self.process = psutil.Process(os.getpid())
        self.meter = get_meter("integrity_host_telemetry")

        self.rw_ratio_gauge = self.meter.create_gauge(
            IntegrityAttributes.STORAGE_FLUX_RW_RATIO,
            description="Ratio of bytes written to bytes read",
        )
        self.path_entropy_gauge = self.meter.create_gauge(
            IntegrityAttributes.ACCESS_PATH_ENTROPY,
            description="Shannon entropy of open file access paths",
        )
        self.ip_entropy_gauge = self.meter.create_gauge(
            IntegrityAttributes.DESTINATION_IP_ENTROPY,
            description="Shannon entropy of destination IP addresses",
        )

        self._last_metrics: Dict[str, float] = {
            "rw_ratio": 0.0,
            "path_entropy": 0.0,
            "ip_entropy": 0.0,
            "cpu_percent": 0.0,
        }
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def get_current_metrics(self) -> Dict[str, float]:
        return self._last_metrics.copy()

    def start(self) -> None:
        if self._thread is not None:
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=self.interval_sec + 1.0)
            self._thread = None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.sample()
            except Exception:
                # Host sampling is best-effort telemetry, not a trust-chain
                # component — a transient psutil failure (process exited,
                # permission denied reading /proc) shouldn't kill the thread.
                pass
            self._stop_event.wait(self.interval_sec)

    def sample(self) -> None:
        try:
            io_counters = self.process.io_counters()
            read_bytes, write_bytes = io_counters.read_bytes, io_counters.write_bytes
            rw_ratio = write_bytes / read_bytes if read_bytes > 0 else 0.0
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            rw_ratio = 0.0
        self.rw_ratio_gauge.set(rw_ratio)
        self._last_metrics["rw_ratio"] = rw_ratio

        try:
            paths = [f.path for f in self.process.open_files()]
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            paths = []
        path_entropy = self._calculate_entropy(paths)
        self.path_entropy_gauge.set(path_entropy)
        self._last_metrics["path_entropy"] = path_entropy

        try:
            connections = self.process.net_connections(kind="inet")
            remote_ips = [c.raddr.ip for c in connections if c.raddr]
        except (psutil.AccessDenied, psutil.NoSuchProcess, AttributeError):
            remote_ips = []
        ip_entropy = self._calculate_entropy(remote_ips)
        self.ip_entropy_gauge.set(ip_entropy)
        self._last_metrics["ip_entropy"] = ip_entropy

        try:
            self._last_metrics["cpu_percent"] = self.process.cpu_percent()
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            pass

    @staticmethod
    def _calculate_entropy(items: list) -> float:
        if not items:
            return 0.0
        counts: Dict[str, int] = {}
        for item in items:
            counts[item] = counts.get(item, 0) + 1
        total = len(items)
        entropy = 0.0
        for count in counts.values():
            p = count / total
            entropy -= p * math.log2(p)
        return entropy
