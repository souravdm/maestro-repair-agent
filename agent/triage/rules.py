"""Deterministic triage ladder.

Ordered rules. First match wins. Every rule is pure Python over the
FailureBundle plus normalized trees — zero model tokens. Only the terminal
fallthrough escalates to an LLM.

Design contract: a rule may only fire when its evidence is unambiguous. If a
rule would need to guess, it must return None and let the ladder continue.
"""
from __future__ import annotations

import difflib
import re
from typing import Any, Callable, Dict, List, Optional

from ..models import (
    Action,
    FailureBundle,
    FailureClass,
    LocatorProvenance,
    OtherPlatformResult,
    Platform,
    Verdict,
)
from .hierarchy import Tree, diff

TEMPLATE_RE = re.compile(r"\$\{[A-Za-z0-9_.]+\}")


class TriageInput:
    """Bundle plus lazily-loaded trees."""

    def __init__(
        self,
        bundle: FailureBundle,
        failing: Optional[Tree] = None,
        green_same: Optional[Tree] = None,
        green_other: Optional[Tree] = None,
        prev_step: Optional[Tree] = None,
    ):
        self.b = bundle
        self.failing = failing
        self.green_same = green_same
        self.green_other = green_other
        self.prev_step = prev_step
        self._diff = None

    @property
    def diff(self):
        if self._diff is None and self.failing is not None:
            self._diff = diff(self.failing, self.green_same, self.green_other)
        return self._diff


Rule = Callable[[TriageInput], Optional[Verdict]]


# ------------------------------------------------------------------ tier 0
# App is broken. Never patch a test to paper over this.

def r01_native_crash(t: TriageInput) -> Optional[Verdict]:
    if t.b.logs.native_crashes:
        return Verdict(
            rule="r01_native_crash",
            action=Action.FILE_APP_BUG,
            confidence=0.99,
            rationale=f"Crash report in failure window: {t.b.logs.native_crashes[0]}",
            patch_hint={"artifacts": t.b.logs.native_crashes},
            requires_rerun=False,
        )
    return None


def r02_dart_exception(t: TriageInput) -> Optional[Verdict]:
    if t.b.logs.dart_exceptions:
        first = t.b.logs.dart_exceptions[0]
        return Verdict(
            rule="r02_dart_exception",
            action=Action.FILE_APP_BUG,
            confidence=0.95,
            rationale=f"Dart exception during the step: {first[:180]}",
            patch_hint={"exception": first, "route": t.b.logs.route_stack[-1:] or []},
            requires_rerun=False,
        )
    return None


def r03_anr(t: TriageInput) -> Optional[Verdict]:
    if t.b.logs.anr_traces:
        return Verdict(
            rule="r03_anr",
            action=Action.FILE_APP_BUG,
            confidence=0.95,
            rationale="ANR trace present; main thread blocked, not a locator issue.",
            patch_hint={"artifacts": t.b.logs.anr_traces},
            requires_rerun=False,
        )
    return None


# ------------------------------------------------------------------ tier 1
# Known-answer and infrastructure. Cheapest possible resolutions.

def make_cache_rule(cache) -> Rule:
    def r04_cache_hit(t: TriageInput) -> Optional[Verdict]:
        hit = cache.get(t.b.cache_key())
        if hit:
            return Verdict(
                rule="r04_cache_hit",
                action=Action.APPLY_CACHED_FIX,
                confidence=hit.get("confidence", 0.9),
                rationale=f"Previously fixed identically ({hit.get('applied_count', 1)}x).",
                patch_hint=hit,
            )
        return None

    return r04_cache_hit


def r05_unresolved_template(t: TriageInput) -> Optional[Verdict]:
    """An un-substituted ${VAR} reaching the driver is a wiring bug, never a
    locator bug. Extremely common in POM subflow chains."""
    target = t.b.step.resolved_command or t.b.step.selector.value
    leaks = TEMPLATE_RE.findall(target)
    if leaks:
        missing = [v.strip("${}") for v in leaks]
        return Verdict(
            rule="r05_unresolved_template",
            action=Action.PATCH_ENV_WIRING,
            confidence=0.97,
            rationale=f"Unsubstituted template(s) {missing} reached the driver.",
            patch_hint={
                "missing_vars": missing,
                "call_stack": [f.file for f in t.b.step.call_stack],
                "env_seen": sorted(t.b.step.env.keys()),
            },
        )
    return None


def r06_semantics_dead(t: TriageInput) -> Optional[Verdict]:
    if t.b.app.semantics_enabled is False:
        return Verdict(
            rule="r06_semantics_dead",
            action=Action.FIX_INFRA,
            confidence=0.95,
            rationale="Flutter semantics were never enabled; the tree cannot contain ids.",
            patch_hint={"remedy": "enable_semantics_at_launch"},
        )
    if t.failing is not None and t.failing.semantics_looks_dead():
        return Verdict(
            rule="r06_semantics_dead",
            action=Action.FIX_INFRA,
            confidence=0.85,
            rationale=(
                f"Hierarchy has {len(t.failing)} nodes and almost no ids/text — "
                "semantics tree not built, not a missing widget."
            ),
            patch_hint={"remedy": "enable_semantics_at_launch", "node_count": len(t.failing)},
        )
    return None


def r06b_semantics_sparse(t: TriageInput) -> Optional[Verdict]:
    """Screen renders but publishes almost nothing addressable.

    Judged by ratio against a comparator, never an absolute floor — a legitimately
    minimal screen (spinner, empty state) must not be misclassified. Comparators in
    order of preference: the previous step's tree from the same run (always present
    in --debug-output, needs no green baseline), then a green tree either platform.

    With no comparator this rule declines: it cannot know whether three nodes is a
    collapse or a correct empty state. The observation is attached to the escalation
    instead, by r19.
    """
    if t.failing is None or not t.b.step.selector.value:
        return None
    if t.failing.match(t.b.step.selector.kind, t.b.step.selector.value):
        return None   # element is there; a different rule owns this

    comparator, source = None, ""
    for cand, label in (
        (t.prev_step, "the previous step in this run"),
        (t.green_same, "the last green run"),
        (t.green_other, "the other platform"),
    ):
        if cand is not None and cand.addressable_count() >= 12:
            comparator, source = cand, label
            break
    if comparator is None:
        return None

    here, there = t.failing.addressable_count(), comparator.addressable_count()
    if here >= max(4, 0.3 * there):
        return None

    hosts = {h.lower() for h in t.b.inventories.platform_view_hosts}
    host_hit = next(
        (n.cls for n in t.failing.nodes
         if hosts and any(h in f"{n.cls} {n.id}".lower() for h in hosts)),
        None,
    )
    both = t.b.context.other_platform_result == OtherPlatformResult.FAILED_SAME_STEP

    return Verdict(
        rule="r06b_semantics_sparse",
        action=Action.FIX_INFRA,
        confidence=0.85 if both else 0.7,
        rationale=(
            f"Screen exposes {here} addressable node(s) against {there} in {source}. "
            "The selector cannot resolve because this screen is not publishing "
            "semantics, not because the widget is missing"
            + (f" (platform-view host '{host_hit}' present)" if host_hit else "")
            + (" — and the same step fails on the other platform, so the cause is shared"
               if both else "")
            + "."
        ),
        patch_hint={
            "addressable_here": here,
            "addressable_comparator": there,
            "comparator": source,
            "platform_view_host": host_hit,
            "remedy": ("wrap_platform_view_with_semantics" if host_hit
                       else "add_semantics_identifiers_to_screen"),
            "route": (t.b.logs.route_stack[-1:] or [None])[0],
        },
        requires_rerun=False,
    )


def r07_no_branch_matched(t: TriageInput) -> Optional[Verdict]:
    if t.b.step.locator_provenance == LocatorProvenance.UNRESOLVED:
        return Verdict(
            rule="r07_no_branch_matched",
            action=Action.ADD_PLATFORM_OVERRIDE,
            confidence=0.9,
            rationale=(
                f"No platform branch matched for {t.b.step.locator_constant or 'this step'} "
                f"on {t.b.platform.value}; the step silently no-oped."
            ),
            patch_hint={
                "locator": t.b.step.locator_constant,
                "platform": t.b.platform.value,
                "blast_radius": t.b.inventories.blast_radius,
            },
        )
    return None


def r08_system_alert(t: TriageInput) -> Optional[Verdict]:
    """System chrome on top of the app: permissions, biometrics, OS nags."""
    known = t.b.logs.system_alert_owners[:]
    if t.failing is not None:
        app_pkg = t.b.app.bundle_id
        for owner, count in t.failing.owners().items():
            if owner and app_pkg and owner != app_pkg and count >= 1:
                if any(s in owner.lower() for s in (
                    "springboard", "permissioncontroller", "systemui",
                    "com.apple.", "android.", "google.android.gms",
                )):
                    known.append(owner)
    if known:
        return Verdict(
            rule="r08_system_alert",
            action=Action.INJECT_ALERT_HANDLER,
            confidence=0.9,
            rationale=f"System alert owned by {sorted(set(known))[0]} obscured the app.",
            patch_hint={"owners": sorted(set(known)), "insert_before_index": t.b.step.command_index},
        )
    return None


# ------------------------------------------------------------------ tier 2
# Locator problems, resolved by evidence rather than reasoning.

def r09_identifier_renamed(t: TriageInput) -> Optional[Verdict]:
    """Selector value is absent from the Dart semantics inventory, and the source
    diff shows a rename. Deterministic single-line fix at the registry."""
    val = t.b.step.selector.value
    inv = t.b.inventories.semantics_identifiers
    if not val or not inv or val in inv:
        return None

    explicit = t.b.context.semantics_diff.get(val)
    both_failed = t.b.context.other_platform_result == OtherPlatformResult.FAILED_SAME_STEP

    new_id = explicit
    conf = 0.95 if explicit else 0.0
    if not new_id:
        near = difflib.get_close_matches(val, inv, n=1, cutoff=0.8)
        if near and both_failed:
            new_id = near[0]
            conf = 0.85
    if not new_id:
        return None

    return Verdict(
        rule="r09_identifier_renamed",
        action=Action.RENAME_LOCATOR,
        confidence=conf,
        rationale=(
            f"'{val}' no longer exists in the Dart semantics inventory; "
            f"'{new_id}' does"
            + (" and the source diff records the rename" if explicit else "")
            + (", and both platforms failed at this step" if both_failed else "")
            + "."
        ),
        patch_hint={
            "locator": t.b.step.locator_constant,
            "old": val,
            "new": new_id,
            "blast_radius": t.b.inventories.blast_radius,
        },
    )


def r10_needs_platform_override(t: TriageInput) -> Optional[Verdict]:
    """Single-platform failure, shared locator, and the node exists in the other
    platform's green tree. Propose an override built from the present node."""
    if t.b.context.other_platform_result != OtherPlatformResult.PASSED:
        return None
    if t.b.step.locator_provenance != LocatorProvenance.SHARED:
        return None
    if t.failing is None or t.green_other is None:
        return None

    val = t.b.step.selector.value
    if t.failing.match(t.b.step.selector.kind, val):
        return None  # present here; not an override problem

    present_other = t.green_other.match(t.b.step.selector.kind, val)
    if not present_other:
        return None

    local = t.failing.candidates(val, k=3)
    proposal = local[0][1].compact() if local else None
    return Verdict(
        rule="r10_needs_platform_override",
        action=Action.ADD_PLATFORM_OVERRIDE,
        confidence=0.8 if proposal else 0.6,
        rationale=(
            f"Shared locator resolves on {'ios' if t.b.platform == Platform.ANDROID else 'android'} "
            f"but is absent from the {t.b.platform.value} tree."
        ),
        patch_hint={
            "locator": t.b.step.locator_constant,
            "platform": t.b.platform.value,
            "proposed": proposal,
            "local_candidates": [{"score": s, **n.compact()} for s, n in local],
        },
    )


def r11_platform_view(t: TriageInput) -> Optional[Verdict]:
    """WebView / map / scanner host in the subtree: 'same UI' stops being same."""
    if t.failing is None or not t.b.inventories.platform_view_hosts:
        return None
    hosts = {h.lower() for h in t.b.inventories.platform_view_hosts}
    for n in t.failing.nodes:
        blob = f"{n.cls} {n.id}".lower()
        if any(h in blob for h in hosts):
            return Verdict(
                rule="r11_platform_view",
                action=Action.ESCALATE_LLM,
                confidence=0.5,
                rationale=f"Platform view host '{n.cls}' present; semantics do not cross the boundary.",
                patch_hint={"host": n.cls, "path": n.path},
            )
    return None


def r12_offscreen(t: TriageInput) -> Optional[Verdict]:
    if t.failing is None:
        return None
    hits = t.failing.match(t.b.step.selector.kind, t.b.step.selector.value)
    for n in hits:
        if t.failing.is_offscreen(n) or not n.has_area:
            return Verdict(
                rule="r12_offscreen",
                action=Action.ADD_SCROLL,
                confidence=0.92,
                rationale="Element exists in the tree but lies outside the viewport.",
                patch_hint={
                    "selector": t.b.step.selector.value,
                    "bounds": n.bounds,
                    "viewport": t.failing.viewport(),
                    "direction": "down" if n.bounds[1] >= t.failing.viewport()[3] else "up",
                },
            )
    return None


def r13_disabled(t: TriageInput) -> Optional[Verdict]:
    if t.failing is None:
        return None
    hits = t.failing.match(t.b.step.selector.kind, t.b.step.selector.value)
    for n in hits:
        if not n.enabled:
            return Verdict(
                rule="r13_disabled",
                action=Action.WAIT_FOR_ENABLED,
                confidence=0.9,
                rationale="Element present but disabled; the step raced the app's enable logic.",
                patch_hint={"selector": t.b.step.selector.value, "path": n.path},
            )
    return None


def r14_wrong_route(t: TriageInput) -> Optional[Verdict]:
    """Highest-value Flutter signal: fix the navigation step, not the assertion."""
    exp = t.b.logs.expected_route
    stack = t.b.logs.route_stack
    if exp and stack and stack[-1] != exp:
        return Verdict(
            rule="r14_wrong_route",
            action=Action.WAIT_FOR_ROUTE,
            confidence=0.88,
            rationale=f"Navigator top is '{stack[-1]}', expected '{exp}'.",
            patch_hint={
                "actual_route": stack[-1],
                "expected_route": exp,
                "route_stack": stack[-4:],
                "fix_site": "preceding navigation step",
            },
        )
    return None


def r15_point_tap_density(t: TriageInput) -> Optional[Verdict]:
    """Fixed coordinates never survive a density or screen-size change."""
    if t.b.step.selector.kind != "point":
        return None
    under = t.failing.node_at_point(t.b.step.selector.value) if t.failing else None
    if under is None:
        return None   # nothing addressable under the point; let the model see it
    return Verdict(
        rule="r15_point_tap_density",
        action=Action.REPLACE_POINT_TAP,
        confidence=0.85,
        rationale=(
            f"Step taps a fixed point; coordinates diverge across platforms and densities "
            f"(density={t.b.device.density}, model={t.b.device.model}). "
            f"'{under.id or under.text}' sits under that point and is stable."
        ),
        patch_hint={
            "point": t.b.step.selector.value,
            "candidates": [{"score": 1.0, **under.compact()}],
        },
    )


def r16_timeout_tune(t: TriageInput) -> Optional[Verdict]:
    """Late arrival, not absence: present in green, timed out here, and there is
    corroborating slowness (jank or a starved runner)."""
    if t.b.step.failure_class not in (FailureClass.TIMEOUT, FailureClass.ELEMENT_NOT_FOUND):
        return None
    if not t.b.step.timeout_ms or t.b.step.elapsed_ms < 0.9 * t.b.step.timeout_ms:
        return None
    in_green = bool(
        t.green_same and t.green_same.match(t.b.step.selector.kind, t.b.step.selector.value)
    )
    slow = (t.b.logs.jank_markers > 5) or ((t.b.context.runner_cpu_pct or 0) > 85)
    if in_green and slow:
        new_timeout = min(int(t.b.step.timeout_ms * 2), 60000)
        return Verdict(
            rule="r16_timeout_tune",
            action=Action.TUNE_TIMEOUT,
            confidence=0.8,
            rationale=(
                f"Element present in the green tree; step burned {t.b.step.elapsed_ms}ms of "
                f"{t.b.step.timeout_ms}ms with jank={t.b.logs.jank_markers}, "
                f"cpu={t.b.context.runner_cpu_pct}%."
            ),
            patch_hint={"old_timeout_ms": t.b.step.timeout_ms, "new_timeout_ms": new_timeout},
        )
    return None


def r17_flake(t: TriageInput) -> Optional[Verdict]:
    if t.b.context.passed_on_retry and not t.b.context.source_diff_files:
        return Verdict(
            rule="r17_flake",
            action=Action.MARK_FLAKY,
            confidence=0.85,
            rationale="Passed on retry with no source change since the failing attempt.",
            patch_hint={"retry_attempt": t.b.context.retry_attempt},
            requires_rerun=False,
        )
    return None


def r18_build_mismatch(t: TriageInput) -> Optional[Verdict]:
    """Mismatched artifacts produce phantom single-platform failures."""
    other = t.b.context.other_platform_commit
    if other and t.b.app.commit_sha and other[:12] != t.b.app.commit_sha[:12]:
        return Verdict(
            rule="r18_build_mismatch",
            action=Action.FIX_INFRA,
            confidence=0.9,
            rationale=(
                f"Platform builds differ: {t.b.platform.value}={t.b.app.commit_sha[:12]}, "
                f"other={other[:12]}. Cross-platform comparison is invalid."
            ),
            patch_hint={"remedy": "pin_both_platforms_to_same_commit"},
        )
    return None


def r19_escalate(t: TriageInput) -> Optional[Verdict]:
    d = t.diff
    hint: Dict[str, Any] = {"diff_counts": d.summary() if d else {}}
    note = ""
    if t.failing is not None:
        n = t.failing.addressable_count()
        hint["addressable_nodes"] = n
        hint["comparator_available"] = any(
            c is not None and c.addressable_count() >= 12
            for c in (t.prev_step, t.green_same, t.green_other)
        )
        if n < 8 and not hint["comparator_available"]:
            note = (
                f" The failing screen exposes only {n} addressable node(s) and there is no "
                "comparator tree to judge that against — archive per-step hierarchies so this "
                "becomes decidable without a model."
            )
    return Verdict(
        rule="r19_escalate",
        action=Action.ESCALATE_LLM,
        confidence=0.0,
        rationale="No deterministic rule matched; sending a pruned slice to the model." + note,
        patch_hint=hint,
    )


LADDER: List[Rule] = [
    r01_native_crash,
    r02_dart_exception,
    r03_anr,
    # cache rule injected at position 3 by build_ladder()
    r18_build_mismatch,
    r05_unresolved_template,
    r06_semantics_dead,
    r06b_semantics_sparse,
    r07_no_branch_matched,
    r08_system_alert,
    r17_flake,
    r09_identifier_renamed,
    r10_needs_platform_override,
    r12_offscreen,
    r13_disabled,
    r14_wrong_route,
    r15_point_tap_density,
    r16_timeout_tune,
    r11_platform_view,
    r19_escalate,
]


def build_ladder(cache=None) -> List[Rule]:
    rules = list(LADDER)
    if cache is not None:
        rules.insert(3, make_cache_rule(cache))
    return rules


def triage(t: TriageInput, cache=None) -> Verdict:
    for rule in build_ladder(cache):
        v = rule(t)
        if v is not None:
            return v
    return Verdict("none", Action.NO_ACTION, 0.0, "ladder exhausted")
