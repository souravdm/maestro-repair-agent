"""Assemble a FailureBundle from a finished Maestro run.

One entry point: collect(). Everything it gathers is cheap, structured and
bounded. Heavy media stays on disk as paths.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, List, Optional

from ..models import (
    AppBuild,
    Artifacts,
    DeviceState,
    FailingStep,
    FailureBundle,
    Inventories,
    LocatorProvenance,
    LogWindow,
    OtherPlatformResult,
    Platform,
    RunContext,
)
from . import flutter as fl
from . import maestro as mz
from . import platforms as pf
from . import pom


def collect(
    debug_dir: str,
    junit_path: str,
    platform: Platform,
    device_udid: str = "",
    repo_root: str = ".",
    flow_root: str = "flows",
    registry_path: str = "flows/locators.yaml",
    dart_root: str = "lib",
    pubspec: str = "pubspec.yaml",
    arb_path: str = "",
    bundle_id: str = "",
    base_ref: str = "origin/main",
    other_platform_result: OtherPlatformResult = OtherPlatformResult.NOT_RUN,
    other_platform_commit: str = "",
    last_green_hierarchy: str = "",
    green_other_hierarchy: str = "",
    passed_on_retry: bool = False,
) -> Optional[FailureBundle]:
    step = mz.extract_failing_step(debug_dir, junit_path)
    if step is None:
        return None

    # ---- platform state + windowed logs
    if platform == Platform.IOS:
        device = pf.ios_device_state(device_udid)
        logs = pf.ios_log_window(device_udid, bundle_id)
    else:
        device = pf.android_device_state(device_udid)
        logs = pf.android_log_window(device_udid, bundle_id)

    log_text = ""
    if logs.raw_slice_path and os.path.exists(logs.raw_slice_path):
        with open(logs.raw_slice_path, errors="ignore") as fh:
            log_text = fh.read()

    # ---- app build
    sdk, renderer, flavor = fl.flutter_build_info(
        os.path.join(repo_root, pubspec), log_text
    )
    app = AppBuild(
        bundle_id=bundle_id,
        commit_sha=_git(repo_root, ["rev-parse", "HEAD"]),
        flutter_sdk=sdk,
        renderer=renderer,
        flavor=flavor,
        semantics_enabled=pf.ios_semantics_enabled(log_text) if platform == Platform.IOS else None,
    )

    # ---- POM resolution
    registry = pom.load_registry(os.path.join(repo_root, registry_path))
    const, prov, branch = pom.resolve_locator(registry, step.selector.value, platform)
    step.locator_constant = const
    step.locator_provenance = prov
    step.platform_branch_taken = branch
    if const and pom.unresolved_branch(registry, const, platform):
        step.locator_provenance = LocatorProvenance.UNRESOLVED

    fr = os.path.join(repo_root, flow_root)
    radius, referencing = pom.blast_radius(fr, const, step.selector.value)
    chain = pom.resolve_call_stack(fr, step.flow_id) if step.flow_id else []
    if chain and not step.call_stack:
        from ..models import StepFrame
        step.call_stack = [StepFrame(file=f) for f in chain]

    # ---- static Flutter inventories (shared across platforms)
    dr = os.path.join(repo_root, dart_root)
    inventories = Inventories(
        semantics_identifiers=fl.semantics_inventory(dr) if os.path.isdir(dr) else [],
        l10n_keys=fl.l10n_map(os.path.join(repo_root, arb_path)) if arb_path else {},
        locator_registry=registry,
        platform_view_hosts=fl.platform_view_hosts(dr) if os.path.isdir(dr) else [],
        blast_radius=radius,
    )

    context = RunContext(
        ci_job_id=os.environ.get("CIRCLE_BUILD_NUM", ""),
        workflow_id=os.environ.get("CIRCLE_WORKFLOW_ID", ""),
        branch=os.environ.get("CIRCLE_BRANCH", _git(repo_root, ["rev-parse", "--abbrev-ref", "HEAD"])),
        commit_sha=app.commit_sha,
        retry_attempt=int(os.environ.get("REPAIR_AGENT_ATTEMPT", "0")),
        passed_on_retry=passed_on_retry,
        runner_cpu_pct=_cpu_pct(),
        runner_mem_free_mb=_mem_free_mb(),
        other_platform_result=other_platform_result,
        other_platform_commit=other_platform_commit,
        source_diff_files=fl.changed_files(repo_root, base_ref),
        semantics_diff=fl.semantics_diff(repo_root, base_ref),
        feature_flags=_feature_flags(),
    )

    hierarchies = mz.find_hierarchies(debug_dir)
    shots = mz.find_screenshots(debug_dir)
    artifacts = Artifacts(
        hierarchy_failing=hierarchies[-1] if hierarchies else "",
        hierarchy_prev_step=hierarchies[-2] if len(hierarchies) > 1 else "",
        hierarchy_green_same_platform=last_green_hierarchy,
        hierarchy_green_other_platform=green_other_hierarchy,
        screenshot_failing=shots[-1] if shots else "",
        screenshot_prev_step=shots[-2] if len(shots) > 1 else "",
        junit_xml=junit_path,
        debug_output_dir=debug_dir,
    )

    if step.selector.kind == "id" and not logs.expected_route:
        logs.expected_route = _expected_route_from_flow(
            os.path.join(fr, step.flow_id) if step.flow_id else ""
        )

    return FailureBundle(
        run_id=os.environ.get("CIRCLE_WORKFLOW_ID") or uuid.uuid4().hex[:12],
        platform=platform,
        device=device,
        app=app,
        step=step,
        logs=logs,
        context=context,
        artifacts=artifacts,
        inventories=inventories,
        maestro_version=mz.maestro_version(),
    )


# ------------------------------------------------------------------ helpers

def _git(root: str, args: List[str]) -> str:
    import subprocess
    try:
        return subprocess.run(
            ["git"] + args, cwd=root, capture_output=True, text=True, timeout=30
        ).stdout.strip()
    except Exception:
        return ""


def _cpu_pct() -> Optional[float]:
    try:
        load = os.getloadavg()[0]
        return round(100.0 * load / (os.cpu_count() or 1), 1)
    except Exception:
        return None


def _mem_free_mb() -> Optional[int]:
    try:
        if os.path.exists("/proc/meminfo"):
            with open("/proc/meminfo") as fh:
                for line in fh:
                    if line.startswith("MemAvailable"):
                        return int(line.split()[1]) // 1024
    except Exception:
        pass
    return None


def _feature_flags() -> Dict[str, Any]:
    """Snapshot whatever the harness exported. A flag flip looks exactly like a
    UI regression, so it must be in the bundle."""
    path = os.environ.get("REPAIR_AGENT_FLAGS_JSON", "")
    if path and os.path.exists(path):
        import json
        try:
            with open(path) as fh:
                return json.load(fh)
        except Exception:
            return {}
    return {k[5:]: v for k, v in os.environ.items() if k.startswith("FLAG_")}


def _expected_route_from_flow(flow_path: str) -> Optional[str]:
    """Flows may annotate the route they expect: `# @route: /pharmacy/refill`."""
    if not flow_path or not os.path.exists(flow_path):
        return None
    try:
        with open(flow_path) as fh:
            for line in fh:
                if "@route:" in line:
                    return line.split("@route:")[1].strip()
    except OSError:
        pass
    return None
