"""Collector: Flutter/Dart static inventories.

One inventory serves both platforms — the main structural advantage of testing
a unified Flutter app. Extracted from source, so it is free and always current.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
from typing import Dict, List, Optional, Set, Tuple

SEM_ID_RE = re.compile(r"""Semantics\s*\((?:[^()]|\([^()]*\))*?identifier\s*:\s*['"]([^'"]+)['"]""", re.S)
SEM_LABEL_RE = re.compile(r"""semanticsLabel\s*:\s*['"]([^'"]+)['"]""")
KEY_RE = re.compile(r"""(?:ValueKey|Key)\s*\(\s*['"]([^'"]+)['"]\s*\)""")
CONST_RE = re.compile(r"""const\s+String\s+\w+\s*=\s*['"]([^'"]+)['"]""")
PLATFORM_VIEW_RE = re.compile(
    r"(WebView|GoogleMap|AndroidView|UiKitView|CameraPreview|MobileScanner|PlatformViewLink)"
)


def semantics_inventory(dart_root: str) -> List[str]:
    """Every identifier the app can actually expose to the accessibility tree."""
    found: Set[str] = set()
    for root, _dirs, files in os.walk(dart_root):
        if any(seg in root for seg in (".dart_tool", "build", ".git", "/test/")):
            continue
        for name in files:
            if not name.endswith(".dart"):
                continue
            path = os.path.join(root, name)
            try:
                with open(path, encoding="utf-8", errors="ignore") as fh:
                    src = fh.read()
            except OSError:
                continue
            for rx in (SEM_ID_RE, SEM_LABEL_RE, KEY_RE, CONST_RE):
                found.update(m for m in rx.findall(src) if 1 < len(m) < 80)
    return sorted(found)


def platform_view_hosts(dart_root: str) -> List[str]:
    hosts: Set[str] = set()
    for root, _dirs, files in os.walk(dart_root):
        if any(seg in root for seg in (".dart_tool", "build", ".git")):
            continue
        for name in files:
            if not name.endswith(".dart"):
                continue
            try:
                with open(os.path.join(root, name), encoding="utf-8", errors="ignore") as fh:
                    hosts.update(PLATFORM_VIEW_RE.findall(fh.read()))
            except OSError:
                continue
    return sorted(hosts)


def l10n_map(arb_path: str) -> Dict[str, str]:
    """key -> string for the run locale. Turns a copy change into a key lookup."""
    if not os.path.exists(arb_path):
        return {}
    try:
        with open(arb_path, encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return {}
    return {k: v for k, v in data.items() if isinstance(v, str) and not k.startswith("@")}


def semantics_diff(repo_root: str, base_ref: str, head_ref: str = "HEAD") -> Dict[str, str]:
    """removed_identifier -> best-guess replacement, from the source diff alone.

    This is the single highest-leverage collector: it turns 'selector broke' into
    'selector broke because this identifier was renamed in <commit>', which is a
    one-line deterministic fix.
    """
    try:
        diff = subprocess.run(
            ["git", "diff", f"{base_ref}...{head_ref}", "--", "*.dart"],
            cwd=repo_root, capture_output=True, text=True, timeout=180,
        ).stdout
    except Exception:
        return {}

    removed: List[str] = []
    added: List[str] = []
    for line in diff.splitlines():
        if line.startswith("-") and not line.startswith("---"):
            for rx in (SEM_ID_RE, KEY_RE, CONST_RE):
                removed += rx.findall(line)
        elif line.startswith("+") and not line.startswith("+++"):
            for rx in (SEM_ID_RE, KEY_RE, CONST_RE):
                added += rx.findall(line)

    import difflib

    out: Dict[str, str] = {}
    for r in set(removed):
        if r in added:
            continue
        near = difflib.get_close_matches(r, list(set(added)), n=1, cutoff=0.6)
        if near:
            out[r] = near[0]
    return out


def changed_files(repo_root: str, base_ref: str, head_ref: str = "HEAD") -> List[str]:
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{base_ref}...{head_ref}"],
            cwd=repo_root, capture_output=True, text=True, timeout=120,
        ).stdout
    except Exception:
        return []
    return [f for f in out.split() if f.endswith((".dart", ".arb", ".yaml", ".yml"))]


def flutter_build_info(pubspec_path: str, log_text: str = "") -> Tuple[str, str, str]:
    """(sdk_constraint, renderer, flavor) — renderer/flavor read from the log."""
    sdk = ""
    if os.path.exists(pubspec_path):
        try:
            with open(pubspec_path) as fh:
                for line in fh:
                    m = re.search(r"flutter:\s*['\"]?([><=^\d.\s]+)", line)
                    if m:
                        sdk = m.group(1).strip()
                        break
        except OSError:
            pass
    renderer = "impeller" if "Impeller" in log_text else ("skia" if "Skia" in log_text else "")
    flavor = "debug" if "Observatory" in log_text or "DevTools" in log_text else "release"
    return sdk, renderer, flavor
