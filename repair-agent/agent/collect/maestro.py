"""Collector: Maestro debug output, JUnit report, hierarchy snapshots.

Run tests as:
  maestro test --format junit --output report.xml --debug-output ./debug flows/
Then point this collector at ./debug.
"""
from __future__ import annotations

import glob
import json
import os
import re
import subprocess
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from ..models import FailingStep, FailureClass, Selector, StepFrame

_CLASS_PATTERNS: List[Tuple[str, FailureClass]] = [
    (r"assertion (is )?false|assert.*failed", FailureClass.ASSERTION_FAILED),
    (r"element .*not found|no element|could not find", FailureClass.ELEMENT_NOT_FOUND),
    (r"timed? ?out|timeout", FailureClass.TIMEOUT),
    (r"app (is )?not running|app was not running", FailureClass.APP_NOT_RUNNING),
    (r"unable to launch|install failed|bundle id", FailureClass.INSTALL_LAUNCH),
]


def classify(message: str) -> FailureClass:
    m = (message or "").lower()
    for pat, cls in _CLASS_PATTERNS:
        if re.search(pat, m):
            return cls
    return FailureClass.UNKNOWN


def maestro_version() -> str:
    try:
        out = subprocess.run(["maestro", "-v"], capture_output=True, text=True, timeout=20)
        return (out.stdout or out.stderr).strip().splitlines()[0]
    except Exception:
        return "unknown"


def parse_junit(path: str) -> List[Dict[str, Any]]:
    """-> [{flow, name, file, message, time_s}] for failing cases only.

    `file` is the flow's real path on disk. `classname`/`name` carry Maestro's
    display name ("H100 | Benefits | Claims | TC001 - ..."), which is not a path
    and must never be joined onto flow_root.
    """
    if not os.path.exists(path):
        return []
    root = ET.parse(path).getroot()
    out: List[Dict[str, Any]] = []
    for case in root.iter("testcase"):
        for bad in list(case.iter("failure")) + list(case.iter("error")):
            out.append({
                "flow": case.get("classname") or case.get("name") or "",
                "name": case.get("name") or "",
                "file": (case.get("file") or "").strip(),
                "message": (bad.get("message") or bad.text or "").strip(),
                "time_s": float(case.get("time") or 0.0),
            })
    return out


def find_hierarchies(debug_dir: str) -> List[str]:
    """Maestro writes per-step hierarchy dumps; newest last.

    Layouts differ by Maestro version: 2.6.x writes
    `<flow>/screen-hierarchy/step-NNN-<command>.json`, where the basename carries
    the step rather than the word "hierarchy", so a basename glob alone misses
    every file.
    """
    pats = [
        "**/screen-hierarchy/*.json",
        "**/*hierarchy*.json",
        "**/view-hierarchy*.json",
        "**/*.viewhierarchy.json",
    ]
    hits: List[str] = []
    for p in pats:
        hits += glob.glob(os.path.join(debug_dir, p), recursive=True)
    return sorted(set(hits), key=lambda p: os.path.getmtime(p))


_STEP_NO_RE = re.compile(r"step-(\d+)-")


def hierarchy_for_step(debug_dir: str, command_index: int) -> str:
    """The dump captured at the failing step, by step number rather than mtime.

    Maestro names dumps `step-NNN-<command>.json` with NNN 1-based, so the file
    for command index i is step-(i+1). Retries and equal mtimes make "newest
    file" an unreliable stand-in; an exact step match is not.
    """
    files = find_hierarchies(debug_dir)
    if not files:
        return ""
    if command_index >= 0:
        for p in files:
            m = _STEP_NO_RE.search(os.path.basename(p))
            if m and int(m.group(1)) == command_index + 1:
                return p
    return files[-1]


def find_screenshots(debug_dir: str) -> List[str]:
    hits = glob.glob(os.path.join(debug_dir, "**/*.png"), recursive=True)
    return sorted(hits, key=lambda p: os.path.getmtime(p))


def find_commands_json(debug_dir: str) -> Optional[str]:
    for p in glob.glob(os.path.join(debug_dir, "**/commands*.json"), recursive=True):
        return p
    return None


def _selector_from_dict(sel: Any) -> Optional[Selector]:
    """Read the selector fields off one candidate dict, or None if absent."""
    if not isinstance(sel, dict):
        return None
    if sel.get("idRegex") or sel.get("id"):
        return Selector("id", str(sel.get("idRegex") or sel.get("id")), raw=sel)
    if sel.get("textRegex") or sel.get("text"):
        return Selector("text", str(sel.get("textRegex") or sel.get("text")), raw=sel)
    if sel.get("point"):
        return Selector("point", str(sel["point"]), raw=sel)
    if sel.get("index") is not None:
        return Selector("index", str(sel["index"]), index=int(sel["index"]), raw=sel)
    return None


# assertConditionCommand nests its selector one level deeper, under the
# condition it is asserting: {condition: {visible: {textRegex: ...}}}.
_CONDITION_KEYS = ("visible", "notVisible", "true", "scrollable")


def parse_selector(command: Dict[str, Any]) -> Selector:
    """Extract the selector from a Maestro command object."""
    for key in ("tapOnElement", "assertConditionCommand", "tapOn", "assertVisible",
                "inputTextCommand", "scrollUntilVisible", "waitUntilVisible",
                "assertNotVisible", "longPressOnElementCommand"):
        node = command.get(key)
        if not isinstance(node, dict):
            continue

        cond = node.get("condition")
        if isinstance(cond, dict):
            for ck in _CONDITION_KEYS:
                found = _selector_from_dict(cond.get(ck))
                if found is not None:
                    return found

        for candidate in (node.get("selector"), node.get("element"), node):
            found = _selector_from_dict(candidate)
            if found is not None:
                return found
    return Selector()


def extract_failing_step(
    debug_dir: str,
    junit_path: str,
    flow_hint: str = "",
) -> Optional[FailingStep]:
    """Assemble the failing step from commands.json + junit message.

    Falls back to a message-only step when commands.json is absent so triage
    still runs (tier-0 rules do not need the tree).
    """
    failures = parse_junit(junit_path)
    if not failures:
        return None
    fail = next((f for f in failures if flow_hint in f["flow"]), failures[0])
    msg = fail["message"]

    step = FailingStep(
        flow_id=fail["flow"],
        flow_file=fail.get("file", ""),
        command_index=-1,
        driver_message=msg,
        failure_class=classify(msg),
        elapsed_ms=int(fail["time_s"] * 1000),
    )

    cj = find_commands_json(debug_dir)
    if not cj:
        return step
    try:
        with open(cj) as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return step

    commands = data if isinstance(data, list) else data.get("commands", [])
    failed = [i for i, c in enumerate(commands) if _status_of(c) in ("FAILED", "ERROR")]
    if failed:
        # A failure propagates up through every enclosing runFlow, so the first
        # FAILED entry is usually a container. The last one is the leaf that
        # actually threw, and that is the step to reason about.
        i = failed[-1]
        c = commands[i]
        inner = c.get("command", c)
        step.command_index = i
        step.command_type = next(iter(inner.keys()), "")
        step.raw_yaml = json.dumps(inner, separators=(",", ":"))[:600]
        step.selector = parse_selector(inner)
        step.timeout_ms = _timeout_of(c, inner)
        src = c.get("sourceDescription") or c.get("source") or ""
        if src:
            step.call_stack = [StepFrame(file=str(src), command_index=i)]
    else:
        step.command_index = max(0, len(commands) - 1)

    return step


def _status_of(entry: Dict[str, Any]) -> str:
    """Maestro 2.6.x nests run state under `metadata`; older builds inline it."""
    meta = entry.get("metadata")
    if isinstance(meta, dict) and meta.get("status"):
        return str(meta["status"]).upper()
    return str(entry.get("status") or entry.get("state") or "").upper()


def _timeout_of(entry: Dict[str, Any], inner: Dict[str, Any]) -> int:
    """Timeout lives on the command body, not the wrapper, and may be a string."""
    body = next(iter(inner.values()), {}) if isinstance(inner, dict) else {}
    for src in (body if isinstance(body, dict) else {}, entry):
        for key in ("timeout", "timeoutMs"):
            try:
                v = int(src.get(key) or 0)
            except (TypeError, ValueError):
                continue
            if v:
                return v
    return 0


def capture_hierarchy(out_path: str, device_udid: str = "") -> Optional[str]:
    """`maestro hierarchy` on demand — used to grab a green baseline."""
    cmd = ["maestro"]
    if device_udid:
        cmd += ["--device", device_udid]
    cmd += ["hierarchy"]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode != 0 or not proc.stdout.strip():
            return None
        os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
        with open(out_path, "w") as fh:
            fh.write(proc.stdout)
        return out_path
    except Exception:
        return None
