"""Patch synthesis. Every action produces a unified diff, never an in-place edit.

Two patch targets:
  * the locator registry (shared page-object constants + platform overrides)
  * the flow YAML (waits, scrolls, alert handlers, timeouts)

Registry patches carry blast radius so the pipeline knows how wide to rerun.
"""
from __future__ import annotations

import difflib
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..models import Action, FailureBundle, Verdict


@dataclass
class Patch:
    target_file: str
    unified_diff: str
    action: Action
    rationale: str
    blast_radius: int = 0
    rerun_flows: List[str] = field(default_factory=list)
    confidence: float = 0.0
    source: str = "rules"

    def is_empty(self) -> bool:
        return not self.unified_diff.strip()

    def summary(self) -> str:
        added = sum(1 for l in self.unified_diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
        removed = sum(1 for l in self.unified_diff.splitlines() if l.startswith("-") and not l.startswith("---"))
        return f"{self.target_file}: +{added}/-{removed} ({self.action.value}, r={self.blast_radius})"


def _diff(path: str, before: List[str], after: List[str]) -> str:
    return "".join(
        difflib.unified_diff(before, after, fromfile=f"a/{path}", tofile=f"b/{path}", lineterm="\n")
    )


def _read(path: str) -> List[str]:
    if not os.path.exists(path):
        return []
    with open(path) as fh:
        return fh.readlines()


def _indent_of(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


# --------------------------------------------------------------- registry

def patch_locator_rename(
    registry_path: str, old: str, new: str, blast_radius: int, rationale: str, confidence: float
) -> Patch:
    before = _read(registry_path)
    after = [re.sub(rf"(?<![\w.-]){re.escape(old)}(?![\w.-])", new, l) for l in before]
    return Patch(
        target_file=registry_path,
        unified_diff=_diff(registry_path, before, after),
        action=Action.RENAME_LOCATOR,
        rationale=rationale,
        blast_radius=blast_radius,
        confidence=confidence,
    )


def patch_platform_override(
    registry_path: str,
    locator_constant: str,
    platform: str,
    value: str,
    blast_radius: int,
    rationale: str,
    confidence: float,
) -> Patch:
    """Convert a shared scalar into a platform-keyed mapping, or add one key.

    LOGIN.SUBMIT: submit_button
      ->
    LOGIN.SUBMIT:
      shared: submit_button
      ios: submit_button_ios
    """
    before = _read(registry_path)
    after = list(before)
    leaf = locator_constant.split(".")[-1]
    key_re = re.compile(rf"^(\s*)({re.escape(leaf)}|{re.escape(locator_constant)})\s*:\s*(.*?)\s*$")

    for i, line in enumerate(before):
        m = key_re.match(line)
        if not m:
            continue
        ind, key, cur = m.group(1), m.group(2), m.group(3)
        if cur and not cur.startswith("#"):
            after[i : i + 1] = [
                f"{ind}{key}:\n",
                f"{ind}  shared: {cur}\n",
                f"{ind}  {platform}: {value}\n",
            ]
        else:
            after.insert(i + 1, f"{ind}  {platform}: {value}\n")
        break
    else:
        after.append(f"\n{locator_constant}:\n  {platform}: {value}\n")

    return Patch(
        target_file=registry_path,
        unified_diff=_diff(registry_path, before, after),
        action=Action.ADD_PLATFORM_OVERRIDE,
        rationale=rationale,
        blast_radius=blast_radius,
        confidence=confidence,
    )


# ------------------------------------------------------------------- flows

def _locate_command(lines: List[str], index: int) -> int:
    """Return the line number of the Nth top-level '- ' command in a flow."""
    seen = -1
    for i, line in enumerate(lines):
        if re.match(r"^\s*-\s+\S", line):
            seen += 1
            if seen == index:
                return i
    return len(lines)


def patch_insert_before_step(
    flow_path: str,
    command_index: int,
    snippet_lines: List[str],
    action: Action,
    rationale: str,
    confidence: float,
) -> Patch:
    before = _read(flow_path)
    at = _locate_command(before, command_index)
    ind = _indent_of(before[at]) if at < len(before) else ""
    block = [f"{ind}{s}\n" if not s.endswith("\n") else f"{ind}{s}" for s in snippet_lines]
    after = before[:at] + block + before[at:]
    return Patch(
        target_file=flow_path,
        unified_diff=_diff(flow_path, before, after),
        action=action,
        rationale=rationale,
        confidence=confidence,
        rerun_flows=[flow_path],
    )


def patch_replace_step(
    flow_path: str,
    command_index: int,
    new_lines: List[str],
    action: Action,
    rationale: str,
    confidence: float,
) -> Patch:
    before = _read(flow_path)
    start = _locate_command(before, command_index)
    end = _locate_command(before, command_index + 1)
    ind = _indent_of(before[start]) if start < len(before) else ""
    block = [f"{ind}{s}\n" if not s.endswith("\n") else f"{ind}{s}" for s in new_lines]
    after = before[:start] + block + before[end:]
    return Patch(
        target_file=flow_path,
        unified_diff=_diff(flow_path, before, after),
        action=action,
        rationale=rationale,
        confidence=confidence,
        rerun_flows=[flow_path],
    )


# --------------------------------------------------------------- dispatch

_ALERT_SNIPPET = [
    "- runFlow:",
    "    file: ../components/dismiss_system_alerts.yaml",
]


def synthesize(
    bundle: FailureBundle,
    verdict: Verdict,
    registry_path: str,
    flow_root: str = ".",
) -> Optional[Patch]:
    """Turn a deterministic verdict into a concrete diff. No model involved."""
    h: Dict[str, Any] = verdict.patch_hint or {}
    flow_path = os.path.join(flow_root, bundle.step.flow_id)
    # POM: the fix site is the frame that owns the locator, not the leaf command.
    if bundle.step.call_stack:
        flow_path = os.path.join(flow_root, bundle.step.call_stack[-1].file)
    idx = bundle.step.command_index
    br = bundle.inventories.blast_radius

    if verdict.action == Action.RENAME_LOCATOR:
        return patch_locator_rename(
            registry_path, h["old"], h["new"], br, verdict.rationale, verdict.confidence
        )

    if verdict.action == Action.ADD_PLATFORM_OVERRIDE:
        proposed = (h.get("proposed") or {})
        value = proposed.get("id") or proposed.get("text")
        if not value:
            return None
        return patch_platform_override(
            registry_path,
            h.get("locator") or bundle.step.locator_constant,
            h.get("platform") or bundle.platform.value,
            value,
            br,
            verdict.rationale,
            verdict.confidence,
        )

    if verdict.action == Action.INJECT_ALERT_HANDLER:
        return patch_insert_before_step(
            flow_path, idx, _ALERT_SNIPPET, verdict.action, verdict.rationale, verdict.confidence
        )

    if verdict.action == Action.ADD_SCROLL:
        sel = h.get("selector", bundle.step.selector.value)
        snippet = ["- scrollUntilVisible:", f"    element:", f"      id: \"{sel}\"",
                   "    direction: " + h.get("direction", "DOWN").upper(),
                   "    timeout: 10000"]
        return patch_insert_before_step(
            flow_path, idx, snippet, verdict.action, verdict.rationale, verdict.confidence
        )

    if verdict.action == Action.WAIT_FOR_ENABLED:
        sel = h.get("selector", bundle.step.selector.value)
        snippet = ["- extendedWaitUntil:", "    visible:", f"      id: \"{sel}\"",
                   "      enabled: true", "    timeout: 10000"]
        return patch_insert_before_step(
            flow_path, idx, snippet, verdict.action, verdict.rationale, verdict.confidence
        )

    if verdict.action == Action.WAIT_FOR_ROUTE:
        exp = h.get("expected_route", "")
        snippet = ["- extendedWaitUntil:", "    visible:",
                   f"      id: \"route:{exp}\"", "    timeout: 15000"]
        return patch_insert_before_step(
            flow_path, idx, snippet, verdict.action, verdict.rationale, verdict.confidence
        )

    if verdict.action == Action.TUNE_TIMEOUT:
        before = _read(flow_path)
        start = _locate_command(before, idx)
        end = _locate_command(before, idx + 1)
        old, new = str(h["old_timeout_ms"]), str(h["new_timeout_ms"])
        block = [l.replace(old, new) for l in before[start:end]]
        after = before[:start] + block + before[end:]
        return Patch(
            target_file=flow_path,
            unified_diff=_diff(flow_path, before, after),
            action=verdict.action,
            rationale=verdict.rationale,
            confidence=verdict.confidence,
            rerun_flows=[flow_path],
        )

    if verdict.action == Action.REPLACE_POINT_TAP:
        cands = h.get("candidates") or []
        if not cands:
            return None
        best = cands[0]
        target = best.get("id") or best.get("text")
        key = "id" if best.get("id") else "text"
        return patch_replace_step(
            flow_path, idx, ["- tapOn:", f"    {key}: \"{target}\""],
            verdict.action, verdict.rationale, verdict.confidence,
        )

    # FILE_APP_BUG / FIX_INFRA / MARK_FLAKY / PATCH_ENV_WIRING are reported, not patched:
    # they are not test-code defects and must not be papered over automatically.
    return None
