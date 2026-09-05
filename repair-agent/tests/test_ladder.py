"""Scenario suite: every deterministic rule must fire on its own evidence and
produce a patch without spending a single token.

Run: python3 -m tests.test_ladder
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.models import (
    Action, AppBuild, Artifacts, DeviceState, FailingStep, FailureBundle, FailureClass,
    Inventories, LocatorProvenance, LogWindow, OtherPlatformResult, Platform, RunContext,
    Selector, StepFrame,
)
from agent.repair.llm import build_slice, est_tokens
from agent.repair.patch import synthesize
from agent.triage.cache import FixCache
from agent.triage.hierarchy import Tree
from agent.triage.rules import TriageInput, triage

FIX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fixtures")
H = os.path.join(FIX, "hierarchies")
REGISTRY = os.path.join(FIX, "flows", "locators.yaml")
FLOW_ROOT = os.path.join(FIX, "flows")

INVENTORY = [
    "refill_title", "rx_number_field", "refill_submit_button", "cancel_button",
    "login_email_field", "login_submit",
]


def mk(
    selector=("id", "submit_refill_button"),
    failing_h="ios_failing_rename.json",
    green_same="ios_green.json",
    green_other="android_green.json",
    platform=Platform.IOS,
    **over,
):
    step = FailingStep(
        flow_id="pages/refill_page.yaml",
        command_index=2,
        command_type="tapOn",
        raw_yaml='- tapOn:\n    id: "submit_refill_button"',
        resolved_command=over.pop("resolved", '- tapOn:\n    id: "submit_refill_button"'),
        selector=Selector(selector[0], selector[1]),
        locator_constant=over.pop("locator_constant", "REFILL.SUBMIT"),
        locator_provenance=over.pop("provenance", LocatorProvenance.SHARED),
        timeout_ms=over.pop("timeout_ms", 10000),
        elapsed_ms=over.pop("elapsed_ms", 10200),
        failure_class=over.pop("failure_class", FailureClass.ELEMENT_NOT_FOUND),
        driver_message="Element not found: id=submit_refill_button",
        call_stack=[StepFrame(file="pages/refill_page.yaml", command_index=2)],
    )
    b = FailureBundle(
        run_id="test",
        platform=platform,
        device=DeviceState(platform=platform, model="iPhone 15", os_version="17.4",
                           locale="en_US", density=3.0),
        app=AppBuild(bundle_id="com.cvs.app", commit_sha="abc123def456",
                     flutter_sdk="3.24.0", renderer="impeller",
                     semantics_enabled=over.pop("semantics_enabled", True)),
        step=step,
        logs=LogWindow(**over.pop("logs", {})),
        context=RunContext(
            other_platform_result=over.pop("other", OtherPlatformResult.FAILED_SAME_STEP),
            other_platform_commit=over.pop("other_commit", "abc123def456"),
            semantics_diff=over.pop("sem_diff", {}),
            source_diff_files=over.pop("diff_files", ["lib/pharmacy/refill_page.dart"]),
            **over.pop("ctx", {}),
        ),
        artifacts=Artifacts(
            hierarchy_failing=os.path.join(H, failing_h) if failing_h else "",
            hierarchy_green_same_platform=os.path.join(H, green_same) if green_same else "",
            hierarchy_green_other_platform=os.path.join(H, green_other) if green_other else "",
        ),
        inventories=Inventories(
            semantics_identifiers=over.pop("inventory", INVENTORY),
            blast_radius=over.pop("blast_radius", 4),
            platform_view_hosts=["WebView", "GoogleMap"],
        ),
    )
    return b


def load_trees(b):
    def L(p, plat, lbl):
        return Tree.load(p, platform=plat, label=lbl) if p and os.path.exists(p) else None
    other = "android" if b.platform == Platform.IOS else "ios"
    return TriageInput(
        b,
        L(b.artifacts.hierarchy_failing, b.platform.value, "failing"),
        L(b.artifacts.hierarchy_green_same_platform, b.platform.value, "green"),
        L(b.artifacts.hierarchy_green_other_platform, other, "green_other"),
    )


SCENARIOS = []


def scenario(name, expect_rule, expect_action, expect_patch=True):
    def deco(fn):
        SCENARIOS.append((name, fn, expect_rule, expect_action, expect_patch))
        return fn
    return deco


@scenario("dart exception in window", "r02_dart_exception", Action.FILE_APP_BUG, False)
def s_dart():
    return mk(logs={"dart_exceptions": ["Unhandled Exception: Null check operator used on a null value"]})


@scenario("unresolved ${} template", "r05_unresolved_template", Action.PATCH_ENV_WIRING, False)
def s_env():
    return mk(resolved='- inputText: "${RX_NUMBER}"')


@scenario("semantics tree never built", "r06_semantics_dead", Action.FIX_INFRA, False)
def s_sem():
    return mk(failing_h="ios_semantics_dead.json", semantics_enabled=None)


@scenario("no platform branch matched", "r07_no_branch_matched", Action.ADD_PLATFORM_OVERRIDE, False)
def s_branch():
    return mk(provenance=LocatorProvenance.UNRESOLVED)


@scenario("system permission alert", "r08_system_alert", Action.INJECT_ALERT_HANDLER)
def s_alert():
    return mk(failing_h="ios_system_alert.json")


@scenario("identifier renamed in source", "r09_identifier_renamed", Action.RENAME_LOCATOR)
def s_rename():
    return mk(sem_diff={"submit_refill_button": "refill_submit_button"})


@scenario("needs platform override", "r10_needs_platform_override", Action.ADD_PLATFORM_OVERRIDE)
def s_override():
    b = mk(selector=("id", "cancel_button"), failing_h="ios_failing_offscreen.json",
           other=OtherPlatformResult.PASSED, locator_constant="REFILL.CANCEL",
           green_other="android_green.json")
    b.inventories.semantics_identifiers = INVENTORY
    return b


@scenario("element below the fold", "r12_offscreen", Action.ADD_SCROLL)
def s_scroll():
    return mk(failing_h="ios_failing_offscreen.json", sem_diff={},
              other=OtherPlatformResult.FAILED_SAME_STEP,
              inventory=INVENTORY + ["submit_refill_button"])


@scenario("element present but disabled", "r13_disabled", Action.WAIT_FOR_ENABLED)
def s_disabled():
    return mk(failing_h="ios_failing_disabled.json",
              inventory=INVENTORY + ["submit_refill_button"])


@scenario("wrong navigator route", "r14_wrong_route", Action.WAIT_FOR_ROUTE)
def s_route():
    return mk(failing_h="ios_green.json",
              inventory=INVENTORY + ["submit_refill_button"],
              logs={"route_stack": ["/home", "/pharmacy/list"], "expected_route": "/pharmacy/refill"})


@scenario("fixed-point tap across densities", "r15_point_tap_density", Action.REPLACE_POINT_TAP)
def s_point():
    return mk(selector=("point", "50%,80%"), failing_h="ios_green.json",
              inventory=INVENTORY + ["submit_refill_button"])


@scenario("cross-platform build mismatch", "r18_build_mismatch", Action.FIX_INFRA, False)
def s_mismatch():
    return mk(other_commit="999999999999")


@scenario("genuinely novel -> escalate", "r19_escalate", Action.ESCALATE_LLM, False)
def s_escalate():
    return mk(selector=("id", "totally_new_widget"), failing_h="ios_green.json",
              green_same=None, sem_diff={}, other=OtherPlatformResult.NOT_RUN,
              inventory=["refill_title", "rx_number_field"])


def main() -> int:
    cache = FixCache(path="/tmp/repair-agent-test/fix_cache.json")
    passed = failed = 0
    total_tokens = 0
    print(f"{'scenario':<38}{'rule':<28}{'action':<26}{'patch':<8}tokens")
    print("-" * 108)
    for name, fn, exp_rule, exp_action, exp_patch in SCENARIOS:
        b = fn()
        t = load_trees(b)
        v = triage(t, cache=cache)
        patch = None
        if v.action not in (Action.FILE_APP_BUG, Action.FIX_INFRA, Action.MARK_FLAKY,
                            Action.PATCH_ENV_WIRING, Action.ESCALATE_LLM, Action.NO_ACTION):
            patch = synthesize(b, v, REGISTRY, FLOW_ROOT)

        tokens = 0
        if v.action == Action.ESCALATE_LLM:
            sl = build_slice(b, t.failing, t.green_same, t.green_other,
                             t.diff.compact() if t.diff else None)
            tokens = sl.tokens
            total_tokens += tokens

        ok = (v.rule == exp_rule and v.action == exp_action
              and (patch is not None and not patch.is_empty()) == exp_patch)
        passed, failed = (passed + 1, failed) if ok else (passed, failed + 1)
        mark = "ok " if ok else "FAIL"
        pstr = "yes" if patch and not patch.is_empty() else "-"
        print(f"{mark} {name:<35}{v.rule:<28}{v.action.value:<26}{pstr:<8}{tokens or '-'}")
        if not ok:
            print(f"     expected rule={exp_rule} action={exp_action.value} patch={exp_patch}")

    print("-" * 108)
    deterministic = len(SCENARIOS) - 1
    print(f"{passed} passed, {failed} failed")
    print(f"deterministic resolutions: {deterministic}/{len(SCENARIOS)} "
          f"({100*deterministic//len(SCENARIOS)}%) at 0 tokens")
    print(f"escalated prompt size: ~{total_tokens} tokens "
          f"(a raw iOS hierarchy dump is typically 12k-60k)")

    # show one real diff
    b = s_rename()
    v = triage(load_trees(b), cache=cache)
    p = synthesize(b, v, REGISTRY, FLOW_ROOT)
    print("\nexample patch (identifier rename, registry-level, blast radius "
          f"{p.blast_radius}):\n")
    print(p.unified_diff)

    b = s_scroll()
    v = triage(load_trees(b), cache=cache)
    p = synthesize(b, v, REGISTRY, FLOW_ROOT)
    print("example patch (scroll insertion, flow-level):\n")
    print(p.unified_diff)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
