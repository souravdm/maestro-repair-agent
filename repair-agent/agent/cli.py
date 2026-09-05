"""CLI entry point.

  python -m agent.cli triage  --bundle bundle.json
  python -m agent.cli collect --debug-output ./debug --junit report.xml --platform ios
  python -m agent.cli repair  --bundle bundle.json --apply
  python -m agent.cli stats
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from .collect.bundle import collect
from .models import FailureBundle, OtherPlatformResult, Platform
from .pipeline import run
from .triage.cache import FixCache, RunHistory


def _load_bundle(path: str) -> FailureBundle:
    with open(path) as fh:
        return FailureBundle.from_dict(json.load(fh))


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="repair-agent")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("collect", help="assemble a failure bundle from a finished run")
    c.add_argument("--debug-output", required=True)
    c.add_argument("--junit", required=True)
    c.add_argument("--platform", choices=["ios", "android"], required=True)
    c.add_argument("--device", default="")
    c.add_argument("--repo-root", default=".")
    c.add_argument("--flow-root", default="flows")
    c.add_argument("--registry", default="flows/locators.yaml")
    c.add_argument("--dart-root", default="lib")
    c.add_argument("--arb", default="")
    c.add_argument("--bundle-id", default="")
    c.add_argument("--base-ref", default="origin/main")
    c.add_argument("--other-platform-result", default="not_run",
                   choices=[e.value for e in OtherPlatformResult])
    c.add_argument("--other-platform-commit", default="")
    c.add_argument("--green-same", default="", help="last-green hierarchy, same platform")
    c.add_argument("--green-other", default="", help="green hierarchy, other platform")
    c.add_argument("-o", "--out", default="bundle.json")

    for name, helptext in (("triage", "classify only"), ("repair", "classify, patch, verify")):
        r = sub.add_parser(name, help=helptext)
        r.add_argument("--bundle", required=True)
        r.add_argument("--repo-root", default=".")
        r.add_argument("--flow-root", default="flows")
        r.add_argument("--registry", default="flows/locators.yaml")
        r.add_argument("--device", default="")
        r.add_argument("--no-llm", action="store_true")
        r.add_argument("--dry-run-llm", action="store_true",
                       help="build the prompt and report its size without sending it")
        r.add_argument("--min-confidence", type=float, default=0.7)
        r.add_argument("--max-blast-radius", type=int, default=25)
        r.add_argument("--json", action="store_true")
        if name == "repair":
            r.add_argument("--apply", action="store_true", help="apply and rerun-verify")

    sub.add_parser("stats", help="cache effectiveness")

    args = p.parse_args(argv)

    if args.cmd == "collect":
        b = collect(
            debug_dir=args.debug_output,
            junit_path=args.junit,
            platform=Platform(args.platform),
            device_udid=args.device,
            repo_root=args.repo_root,
            flow_root=args.flow_root,
            registry_path=args.registry,
            dart_root=args.dart_root,
            arb_path=args.arb,
            bundle_id=args.bundle_id,
            base_ref=args.base_ref,
            other_platform_result=OtherPlatformResult(args.other_platform_result),
            other_platform_commit=args.other_platform_commit,
            last_green_hierarchy=args.green_same,
            green_other_hierarchy=args.green_other,
        )
        if b is None:
            print("no failing step found; nothing to collect", file=sys.stderr)
            return 1
        with open(args.out, "w") as fh:
            fh.write(b.to_json())
        print(f"wrote {args.out}  fingerprint={b.fingerprint()}  cache_key={b.cache_key()}")
        return 0

    if args.cmd == "stats":
        print(json.dumps(FixCache().stats(), indent=2))
        return 0

    bundle = _load_bundle(args.bundle)
    outcome = run(
        bundle,
        repo_root=args.repo_root,
        flow_root=args.flow_root,
        registry_path=args.registry,
        cache=FixCache(),
        history=RunHistory(),
        allow_llm=not args.no_llm,
        apply_and_verify=(args.cmd == "repair" and getattr(args, "apply", False)),
        min_confidence=args.min_confidence,
        max_blast_radius=args.max_blast_radius,
        device_udid=args.device,
        dry_run_llm=args.dry_run_llm,
    )
    print(json.dumps(outcome.to_dict(), indent=2) if args.json else outcome.human())
    return 0 if outcome.verdict.action.value != "no_action" else 2


if __name__ == "__main__":
    raise SystemExit(main())
