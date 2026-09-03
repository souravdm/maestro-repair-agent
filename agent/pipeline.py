"""Orchestration: bundle -> triage -> patch -> verify -> cache.

Cost discipline lives here:
  * tier 0-2 rules run first and are free
  * the model is called only on fallthrough, with a pruned slice
  * every patch must pass a rerun before it is kept or cached
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .models import Action, FailureBundle, Verdict
from .repair.llm import escalate
from .repair.patch import Patch, synthesize
from .repair.verify import VerifyResult, verify
from .triage.cache import FixCache, RunHistory
from .triage.hierarchy import Tree
from .triage.rules import TriageInput, triage

REPORT_ONLY = {
    Action.FILE_APP_BUG,
    Action.FIX_INFRA,
    Action.MARK_FLAKY,
    Action.PATCH_ENV_WIRING,
    Action.NO_ACTION,
}


@dataclass
class Outcome:
    fingerprint: str
    cache_key: str
    verdict: Verdict
    patch: Optional[Patch] = None
    verification: Optional[VerifyResult] = None
    tokens_spent: int = 0
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "fingerprint": self.fingerprint,
            "cache_key": self.cache_key,
            "rule": self.verdict.rule,
            "action": self.verdict.action.value,
            "confidence": self.verdict.confidence,
            "rationale": self.verdict.rationale,
            "patch": self.patch.summary() if self.patch else None,
            "diff": self.patch.unified_diff if self.patch else None,
            "verified_green": self.verification.green if self.verification else None,
            "reverted": self.verification.reverted if self.verification else None,
            "tokens_spent": self.tokens_spent,
            "notes": self.notes,
        }

    def human(self) -> str:
        lines = [
            f"[{self.verdict.rule}] {self.verdict.action.value}  conf={self.verdict.confidence:.2f}  tokens={self.tokens_spent}",
            f"  {self.verdict.rationale}",
        ]
        if self.patch:
            lines.append(f"  patch: {self.patch.summary()}")
        if self.verification:
            state = "GREEN (kept)" if self.verification.green else "RED (reverted)"
            lines.append(f"  rerun: {state}")
        for n in self.notes:
            lines.append(f"  note: {n}")
        return "\n".join(lines)


def _load(path: str, platform: str, label: str) -> Optional[Tree]:
    if path and os.path.exists(path):
        try:
            return Tree.load(path, platform=platform, label=label)
        except Exception:
            return None
    return None


def run(
    bundle: FailureBundle,
    repo_root: str = ".",
    flow_root: str = "flows",
    registry_path: str = "flows/locators.yaml",
    cache: Optional[FixCache] = None,
    history: Optional[RunHistory] = None,
    allow_llm: bool = True,
    apply_and_verify: bool = True,
    min_confidence: float = 0.7,
    max_blast_radius: int = 25,
    device_udid: str = "",
    dry_run_llm: bool = False,
) -> Outcome:
    cache = cache or FixCache()
    a = bundle.artifacts
    failing = _load(a.hierarchy_failing, bundle.platform.value, "failing")
    green_same = _load(a.hierarchy_green_same_platform, bundle.platform.value, "green_same")
    other_plat = "android" if bundle.platform.value == "ios" else "ios"
    green_other = _load(a.hierarchy_green_other_platform, other_plat, "green_other")
    prev = _load(a.hierarchy_prev_step, bundle.platform.value, "prev")

    t = TriageInput(bundle, failing, green_same, green_other, prev)
    verdict = triage(t, cache=cache)
    out = Outcome(bundle.fingerprint(), bundle.cache_key(), verdict)

    # ---- escalate only on fallthrough
    if verdict.action == Action.ESCALATE_LLM:
        if not allow_llm:
            out.notes.append("LLM disabled; stopping with an unexplained failure.")
            return out
        d = t.diff.compact() if t.diff else None
        verdict = escalate(bundle, failing, green_same, green_other, d, dry_run=dry_run_llm)
        out.verdict = verdict
        out.tokens_spent = verdict.tokens_spent

    # ---- cached fixes replay directly
    if verdict.action == Action.APPLY_CACHED_FIX:
        hint = verdict.patch_hint
        out.patch = Patch(
            target_file=hint.get("meta", {}).get("target_file", registry_path),
            unified_diff=hint.get("patch", ""),
            action=Action(hint.get("action", Action.NO_ACTION.value)),
            rationale=verdict.rationale,
            confidence=verdict.confidence,
            blast_radius=hint.get("meta", {}).get("blast_radius", 0),
            rerun_flows=hint.get("meta", {}).get("rerun_flows", []),
            source="cache",
        )
    elif verdict.action in REPORT_ONLY:
        out.notes.append("Reported, not patched: not a test-code defect.")
        return out
    else:
        out.patch = synthesize(
            bundle, verdict, os.path.join(repo_root, registry_path), os.path.join(repo_root, flow_root)
        )
        if out.patch is None:
            out.notes.append("No concrete patch could be synthesized from the verdict.")
            return out

    # ---- gates
    if verdict.confidence < min_confidence:
        out.notes.append(
            f"Confidence {verdict.confidence:.2f} below threshold {min_confidence:.2f}; "
            "proposing for human review instead of applying."
        )
        return out
    if out.patch.blast_radius > max_blast_radius:
        out.notes.append(
            f"Blast radius {out.patch.blast_radius} exceeds {max_blast_radius}; "
            "registry change requires human approval."
        )
        return out
    if not apply_and_verify:
        out.notes.append("Dry run: patch generated, not applied.")
        return out

    # ---- rerun gate
    res = verify(out.patch, device_udid=device_udid, repo_root=repo_root)
    out.verification = res
    if res.green:
        cache.put(
            bundle.cache_key(),
            action=out.patch.action.value,
            patch=out.patch.unified_diff,
            confidence=verdict.confidence,
            verified_green=True,
            source=verdict.rule,
            meta={
                "target_file": out.patch.target_file,
                "blast_radius": out.patch.blast_radius,
                "rerun_flows": out.patch.rerun_flows,
            },
        )
    else:
        cache.invalidate(bundle.cache_key())
        out.notes.append("Rerun failed; patch reverted and cache entry invalidated.")

    if history:
        history.record(
            bundle.step.flow_id, bundle.step.command_index, bundle.platform.value,
            passed=res.green, commit=bundle.app.commit_sha,
            hierarchy_path=a.hierarchy_failing if res.green else "",
        )
    return out
