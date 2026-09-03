"""Fix cache and run history. A cache hit costs zero tokens.

Backed by JSON for portability; swap in Postgres by reimplementing get/put.
Keyed on FailureBundle.cache_key() (commit-independent) so a locator rename
fixed once keeps applying on later commits and across flows sharing the page.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, Optional


class FixCache:
    def __init__(self, path: str = ".repair-agent/fix_cache.json"):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._data: Dict[str, Any] = {}
        if os.path.exists(path):
            try:
                with open(path) as fh:
                    self._data = json.load(fh)
            except (json.JSONDecodeError, OSError):
                self._data = {}

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._data.get(key)
        if not entry:
            return None
        if entry.get("verified_green") is False:
            return None          # a fix that failed its rerun must never replay
        return entry

    def put(
        self,
        key: str,
        action: str,
        patch: str,
        confidence: float,
        verified_green: bool,
        source: str = "rules",
        meta: Optional[Dict[str, Any]] = None,
    ) -> None:
        prev = self._data.get(key, {})
        self._data[key] = {
            "action": action,
            "patch": patch,
            "confidence": confidence,
            "verified_green": verified_green,
            "source": source,
            "applied_count": prev.get("applied_count", 0) + 1,
            "first_seen": prev.get("first_seen", time.time()),
            "last_seen": time.time(),
            "meta": meta or {},
        }
        self.flush()

    def invalidate(self, key: str) -> None:
        if key in self._data:
            self._data[key]["verified_green"] = False
            self.flush()

    def flush(self) -> None:
        tmp = self.path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(self._data, fh, indent=2)
        os.replace(tmp, self.path)

    def stats(self) -> Dict[str, Any]:
        total = len(self._data)
        green = sum(1 for e in self._data.values() if e.get("verified_green"))
        by_action: Dict[str, int] = {}
        replays = 0
        for e in self._data.values():
            by_action[e["action"]] = by_action.get(e["action"], 0) + 1
            replays += max(0, e.get("applied_count", 1) - 1)
        return {
            "entries": total,
            "verified_green": green,
            "token_free_replays": replays,
            "by_action": by_action,
        }


class RunHistory:
    """Per-step pass/fail history. Feeds flake rate and last-green artifacts."""

    def __init__(self, path: str = ".repair-agent/history.json"):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._data: Dict[str, Any] = {}
        if os.path.exists(path):
            try:
                with open(path) as fh:
                    self._data = json.load(fh)
            except (json.JSONDecodeError, OSError):
                self._data = {}

    @staticmethod
    def _k(flow_id: str, index: int, platform: str) -> str:
        return f"{flow_id}#{index}#{platform}"

    def record(
        self,
        flow_id: str,
        index: int,
        platform: str,
        passed: bool,
        commit: str = "",
        hierarchy_path: str = "",
    ) -> None:
        k = self._k(flow_id, index, platform)
        e = self._data.setdefault(k, {"pass": 0, "fail": 0, "last_green": None})
        e["pass" if passed else "fail"] += 1
        if passed and hierarchy_path:
            e["last_green"] = {"commit": commit, "hierarchy": hierarchy_path, "at": time.time()}
        self.flush()

    def flake_rate(self, flow_id: str, index: int, platform: str) -> float:
        e = self._data.get(self._k(flow_id, index, platform))
        if not e:
            return 0.0
        total = e["pass"] + e["fail"]
        return round(e["fail"] / total, 3) if total else 0.0

    def last_green_hierarchy(self, flow_id: str, index: int, platform: str) -> Optional[str]:
        e = self._data.get(self._k(flow_id, index, platform)) or {}
        lg = e.get("last_green") or {}
        return lg.get("hierarchy")

    def flush(self) -> None:
        tmp = self.path + ".tmp"
        with open(tmp, "w") as fh:
            json.dump(self._data, fh, indent=2)
        os.replace(tmp, self.path)
