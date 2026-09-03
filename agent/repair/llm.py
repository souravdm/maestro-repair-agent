"""Last-resort model call.

Contract: the prompt is a *slice*, never a dump. Hard token budget enforced
before the request goes out. If the slice does not fit, prune harder rather
than paying for a bigger context.

Plugs into an existing llm_provider module if one is importable; otherwise
talks to the Anthropic Messages API directly.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..models import Action, FailureBundle, Verdict
from ..triage.hierarchy import Tree, prune_around

MAX_PROMPT_TOKENS = int(os.environ.get("REPAIR_AGENT_MAX_TOKENS", "4000"))

SYSTEM = (
    "You repair Maestro mobile test flows for a Flutter app tested on iOS and Android "
    "through a shared page-object registry. You receive a pruned failure slice, not a full "
    "hierarchy. Reply with JSON only, no prose and no code fences.\n"
    "Schema: {\"diagnosis\": str, \"action\": one of "
    "[rename_locator, add_platform_override, add_scroll, wait_for_enabled, wait_for_route, "
    "tune_timeout, replace_point_tap, inject_alert_handler, file_app_bug, insufficient_evidence], "
    "\"target\": {\"locator\": str|null, \"old\": str|null, \"new\": str|null, "
    "\"platform\": \"ios\"|\"android\"|null, \"timeout_ms\": int|null}, "
    "\"confidence\": 0.0-1.0}\n"
    "Rules: prefer a registry change over a flow change when the locator is shared. "
    "Never invent an identifier that is absent from the supplied inventory slice. "
    "If the evidence does not determine a fix, answer insufficient_evidence."
)


def est_tokens(s: str) -> int:
    return max(1, len(s) // 4)


@dataclass
class Slice:
    payload: Dict[str, Any]
    tokens: int

    def text(self) -> str:
        return json.dumps(self.payload, separators=(",", ":"))


def build_slice(
    bundle: FailureBundle,
    failing: Optional[Tree],
    green_same: Optional[Tree],
    green_other: Optional[Tree],
    diff_compact: Optional[Dict[str, Any]] = None,
    budget: int = MAX_PROMPT_TOKENS,
) -> Slice:
    """Assemble the smallest slice that can determine a fix, then shrink to budget."""
    sel = bundle.step.selector
    inv = bundle.inventories.semantics_identifiers

    # Only inventory entries plausibly related to the selector — never the whole list.
    inv_slice = [i for i in inv if _related(sel.value, i)][:25]

    payload: Dict[str, Any] = {
        "platform": bundle.platform.value,
        "failure_class": bundle.step.failure_class.value,
        "driver_message": bundle.step.driver_message[:240],
        "step": {
            "flow": bundle.step.flow_id,
            "index": bundle.step.command_index,
            "yaml": bundle.step.raw_yaml[:400],
            "resolved": bundle.step.resolved_command[:240],
            "locator_constant": bundle.step.locator_constant,
            "provenance": bundle.step.locator_provenance.value,
            "timeout_ms": bundle.step.timeout_ms,
            "elapsed_ms": bundle.step.elapsed_ms,
        },
        "pom_call_stack": [f.file for f in bundle.step.call_stack][-4:],
        "blast_radius": bundle.inventories.blast_radius,
        "flutter": {
            "route_stack": bundle.logs.route_stack[-3:],
            "expected_route": bundle.logs.expected_route,
            "sdk": bundle.app.flutter_sdk,
            "renderer": bundle.app.renderer,
            "semantics_enabled": bundle.app.semantics_enabled,
        },
        "device": {
            "os": bundle.device.os_version,
            "model": bundle.device.model,
            "locale": bundle.device.locale,
            "density": bundle.device.density,
            "dark_mode": bundle.device.dark_mode,
            "font_scale": bundle.device.font_scale,
        },
        "other_platform_result": bundle.context.other_platform_result.value,
        "source_diff_files": bundle.context.source_diff_files[:10],
        "semantics_inventory_slice": inv_slice,
    }

    if diff_compact:
        payload["hierarchy_diff"] = diff_compact
    if failing is not None:
        payload["failing_slice"] = [
            n.compact() for n in prune_around(failing, sel.value, radius=2, max_nodes=40)
        ]
        payload["local_candidates"] = [
            {"score": s, **n.compact()} for s, n in failing.candidates(sel.value, k=5)
        ]
    if green_other is not None:
        hits = green_other.match(sel.kind, sel.value)
        if hits:
            payload["present_on_other_platform"] = [n.compact() for n in hits[:3]]

    s = Slice(payload, est_tokens(json.dumps(payload)))

    # Progressive shrink: drop the least decisive keys first.
    for key in ("source_diff_files", "device", "semantics_inventory_slice",
                "hierarchy_diff", "failing_slice"):
        if s.tokens <= budget:
            break
        if key == "failing_slice" and "failing_slice" in payload:
            payload[key] = payload[key][:12]
        else:
            payload.pop(key, None)
        s = Slice(payload, est_tokens(json.dumps(payload)))

    return s


def _related(a: str, b: str) -> bool:
    ta = set(re.split(r"[^a-z0-9]+", (a or "").lower())) - {""}
    tb = set(re.split(r"[^a-z0-9]+", (b or "").lower())) - {""}
    return bool(ta & tb)


# ------------------------------------------------------------------ client

def _call_anthropic(system: str, user: str, model: str) -> str:
    import urllib.request

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    body = json.dumps({
        "model": model,
        "max_tokens": 700,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read())
    return "".join(b.get("text", "") for b in data.get("content", []))


def _complete(system: str, user: str, model: str) -> str:
    try:
        from llm_provider import complete  # type: ignore
        return complete(system=system, user=user, agent="repair", model=model)
    except Exception:
        return _call_anthropic(system, user, model)


_ACTION_MAP = {
    "rename_locator": Action.RENAME_LOCATOR,
    "add_platform_override": Action.ADD_PLATFORM_OVERRIDE,
    "add_scroll": Action.ADD_SCROLL,
    "wait_for_enabled": Action.WAIT_FOR_ENABLED,
    "wait_for_route": Action.WAIT_FOR_ROUTE,
    "tune_timeout": Action.TUNE_TIMEOUT,
    "replace_point_tap": Action.REPLACE_POINT_TAP,
    "inject_alert_handler": Action.INJECT_ALERT_HANDLER,
    "file_app_bug": Action.FILE_APP_BUG,
    "insufficient_evidence": Action.NO_ACTION,
}


def escalate(
    bundle: FailureBundle,
    failing: Optional[Tree],
    green_same: Optional[Tree],
    green_other: Optional[Tree],
    diff_compact: Optional[Dict[str, Any]] = None,
    model: str = "claude-sonnet-4-6",
    dry_run: bool = False,
) -> Verdict:
    sl = build_slice(bundle, failing, green_same, green_other, diff_compact)
    if dry_run:
        return Verdict(
            rule="llm(dry_run)",
            action=Action.NO_ACTION,
            confidence=0.0,
            rationale=f"Prompt built, not sent. ~{sl.tokens} tokens.",
            patch_hint={"slice": sl.payload},
            tokens_spent=0,
        )

    raw = _complete(SYSTEM, sl.text(), model)
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        out = json.loads(cleaned)
    except json.JSONDecodeError:
        return Verdict(
            rule="llm",
            action=Action.NO_ACTION,
            confidence=0.0,
            rationale="Model returned unparseable JSON; no patch attempted.",
            tokens_spent=sl.tokens,
        )

    action = _ACTION_MAP.get(out.get("action", ""), Action.NO_ACTION)
    tgt = out.get("target") or {}

    # Guard: never accept an identifier the app does not define.
    inv = set(bundle.inventories.semantics_identifiers)
    if action == Action.RENAME_LOCATOR and inv and tgt.get("new") not in inv:
        return Verdict(
            rule="llm",
            action=Action.NO_ACTION,
            confidence=0.0,
            rationale=f"Model proposed '{tgt.get('new')}', absent from the semantics inventory. Rejected.",
            tokens_spent=sl.tokens,
        )

    hint: Dict[str, Any] = {
        "locator": tgt.get("locator") or bundle.step.locator_constant,
        "old": tgt.get("old") or bundle.step.selector.value,
        "new": tgt.get("new"),
        "platform": tgt.get("platform") or bundle.platform.value,
        "selector": bundle.step.selector.value,
    }
    if tgt.get("timeout_ms"):
        hint["old_timeout_ms"] = bundle.step.timeout_ms
        hint["new_timeout_ms"] = int(tgt["timeout_ms"])
    if tgt.get("new"):
        hint["proposed"] = {"id": tgt["new"]}

    return Verdict(
        rule="llm",
        action=action,
        confidence=float(out.get("confidence", 0.5)),
        rationale=str(out.get("diagnosis", ""))[:400],
        patch_hint=hint,
        tokens_spent=sl.tokens,
    )
