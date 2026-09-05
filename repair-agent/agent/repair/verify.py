"""Rerun gate. A patch is a proposal until a green rerun proves it.

This is what lets the model stay small: a wrong guess costs one rerun, not a
bad merge.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import List, Optional, Tuple

from .patch import Patch


@dataclass
class VerifyResult:
    green: bool
    applied: bool
    stdout_tail: str = ""
    failed_steps: List[str] = None  # type: ignore[assignment]
    reverted: bool = False

    def __post_init__(self):
        if self.failed_steps is None:
            self.failed_steps = []


def apply_patch(patch: Patch, repo_root: str = ".", reverse: bool = False) -> Tuple[bool, str]:
    if patch.is_empty():
        return False, "empty diff"
    args = ["git", "apply", "-p1"]
    if reverse:
        args.append("-R")
    args.append("-")
    proc = subprocess.run(
        args, cwd=repo_root, input=patch.unified_diff, text=True, capture_output=True
    )
    return proc.returncode == 0, (proc.stderr or proc.stdout).strip()


def _parse_junit(path: str) -> Tuple[bool, List[str]]:
    if not os.path.exists(path):
        return False, ["junit report missing"]
    root = ET.parse(path).getroot()
    failures: List[str] = []
    for case in root.iter("testcase"):
        for bad in list(case.iter("failure")) + list(case.iter("error")):
            failures.append(f"{case.get('classname','')}::{case.get('name','')}: {(bad.get('message') or '')[:120]}")
    return not failures, failures


def rerun(
    flows: List[str],
    device_udid: str = "",
    repo_root: str = ".",
    extra_args: Optional[List[str]] = None,
    timeout_s: int = 1800,
) -> VerifyResult:
    out_dir = tempfile.mkdtemp(prefix="repair-verify-")
    junit = os.path.join(out_dir, "report.xml")
    cmd = ["maestro"]
    if device_udid:
        cmd += ["--device", device_udid]
    cmd += ["test", "--format", "junit", "--output", junit, "--debug-output", out_dir]
    cmd += extra_args or []
    cmd += flows
    try:
        proc = subprocess.run(
            cmd, cwd=repo_root, capture_output=True, text=True, timeout=timeout_s
        )
        green, failures = _parse_junit(junit)
        return VerifyResult(
            green=green and proc.returncode == 0,
            applied=True,
            stdout_tail=(proc.stdout or "")[-1500:],
            failed_steps=failures,
        )
    except subprocess.TimeoutExpired:
        return VerifyResult(green=False, applied=True, stdout_tail="rerun timed out", failed_steps=["timeout"])
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def verify(
    patch: Patch,
    device_udid: str = "",
    repo_root: str = ".",
    keep_on_green: bool = True,
) -> VerifyResult:
    """Apply, rerun, and revert unless green. Registry patches rerun the whole
    blast radius; flow patches rerun only that flow."""
    ok, msg = apply_patch(patch, repo_root)
    if not ok:
        return VerifyResult(green=False, applied=False, stdout_tail=f"git apply failed: {msg}")

    flows = patch.rerun_flows or []
    if patch.blast_radius > 0 and not flows:
        flows = ["."]  # registry change: rerun the suite that references it

    res = rerun(flows, device_udid=device_udid, repo_root=repo_root)
    if not (res.green and keep_on_green):
        apply_patch(patch, repo_root, reverse=True)
        res.reverted = True
    return res
