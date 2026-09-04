#!/usr/bin/env python3
"""Confirm-or-refute the sparse-semantics diagnosis directly, no inference.

  python3 tools/audit_bundles.py test-reports/.../bundles/*.json

Reports, per bundle: whether the failing hierarchy was found and parsed, how many
addressable nodes it holds, which comparators are available, and which rules were
*eligible* versus which merely didn't match. That last distinction is what the
summary.json could not express — 'evaluated, no match' and 'could never fire,
required input absent' both printed as r19_escalate.
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.models import FailureBundle
from agent.triage.hierarchy import Tree

REQUIRES = {
    "r01 native crash":      lambda b, f, c: bool(b.logs.native_crashes) or b.logs.window_start,
    "r02 dart exception":    lambda b, f, c: bool(b.logs.dart_exceptions) or b.logs.window_start,
    "r03 anr":               lambda b, f, c: b.platform.value == "android",
    "r05 unresolved tmpl":   lambda b, f, c: bool(b.step.resolved_command),
    "r06 dead semantics":    lambda b, f, c: f is not None,
    "r06b sparse semantics": lambda b, f, c: f is not None and c,
    "r07 no branch":         lambda b, f, c: bool(b.inventories.locator_registry),
    "r08 system alert":      lambda b, f, c: f is not None,
    "r09 renamed id":        lambda b, f, c: bool(b.inventories.semantics_identifiers),
    "r10 needs override":    lambda b, f, c: b.artifacts.hierarchy_green_other_platform != "",
    "r12 offscreen":         lambda b, f, c: f is not None,
    "r13 disabled":          lambda b, f, c: f is not None,
    "r14 wrong route":       lambda b, f, c: bool(b.logs.route_stack),
    "r15 point tap":         lambda b, f, c: b.step.selector.kind == "point",
    "r16 timeout tune":      lambda b, f, c: b.artifacts.hierarchy_green_same_platform != "",
    "r18 build mismatch":    lambda b, f, c: bool(b.context.other_platform_commit),
}


def load(p):
    if not p or not os.path.exists(p):
        return None, "missing"
    try:
        return Tree.load(p), "ok"
    except Exception as e:
        return None, f"parse error: {type(e).__name__}"


def main(paths):
    files = [f for p in paths for f in glob.glob(p)]
    if not files:
        print("no bundle files matched", file=sys.stderr)
        return 1

    print(f"{'bundle':<44}{'failing':<22}{'addr':>5}{'prev':>6}{'green':>6}{'other':>6}  blocked rules")
    print("-" * 130)
    blocked_tally = {}
    for fp in sorted(files):
        with open(fp) as fh:
            b = FailureBundle.from_dict(json.load(fh))
        f, fstat = load(b.artifacts.hierarchy_failing)
        prev, _ = load(b.artifacts.hierarchy_prev_step)
        gsame, _ = load(b.artifacts.hierarchy_green_same_platform)
        gother, _ = load(b.artifacts.hierarchy_green_other_platform)

        addr = f.addressable_count() if f else 0
        comp = any(t is not None and t.addressable_count() >= 12 for t in (prev, gsame, gother))
        blocked = [name for name, ok in REQUIRES.items() if not ok(b, f, comp)]
        for name in blocked:
            blocked_tally[name] = blocked_tally.get(name, 0) + 1

        print(f"{os.path.basename(fp)[:43]:<44}{fstat:<22}{addr:>5}"
              f"{(prev.addressable_count() if prev else 0):>6}"
              f"{(gsame.addressable_count() if gsame else 0):>6}"
              f"{(gother.addressable_count() if gother else 0):>6}"
              f"  {len(blocked)} blocked")

    print("\nrules blocked by a missing input (count of bundles):")
    for name, n in sorted(blocked_tally.items(), key=lambda kv: -kv[1]):
        print(f"  {name:<26}{n:>4}/{len(files)}")
    print("\nA rule blocked everywhere is a collector gap, not a hard failure set.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:] or ["bundles/*.json"]))
