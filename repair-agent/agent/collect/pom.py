"""Collector: POM layer — locator registry, subflow call graph, blast radius.

In a POM Maestro suite the leaf command is rarely the fix site. This module
maps a failing selector back to the registry constant that produced it and
counts how many flows would be affected by changing it.
"""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

from ..models import LocatorProvenance, Platform

RUNFLOW_RE = re.compile(r"runFlow:\s*(?:\n\s*file:\s*(\S+)|(\S+))")
TEMPLATE_RE = re.compile(r"\$\{([A-Za-z0-9_.]+)\}")


def _load_yaml(path: str) -> Any:
    try:
        import yaml  # type: ignore
        with open(path) as fh:
            docs = list(yaml.safe_load_all(fh))
        return docs[-1] if docs else None
    except Exception:
        return None


def load_registry(path: str) -> Dict[str, Any]:
    """Flatten a nested locator registry into DOTTED.KEYS -> value|{platform: value}."""
    data = _load_yaml(path) or {}
    flat: Dict[str, Any] = {}

    def walk(node: Any, prefix: str = "") -> None:
        if isinstance(node, dict):
            platform_keys = {"ios", "android", "shared"}
            if platform_keys & set(k.lower() for k in node.keys()):
                flat[prefix] = {k.lower(): v for k, v in node.items()}
                return
            for k, v in node.items():
                walk(v, f"{prefix}.{k}" if prefix else str(k))
        else:
            flat[prefix] = node

    walk(data)
    return flat


def resolve_locator(
    registry: Dict[str, Any], selector_value: str, platform: Platform
) -> Tuple[str, LocatorProvenance, Optional[str]]:
    """Reverse-map a resolved selector to its registry constant and provenance.

    Returns (constant, provenance, branch_taken).
    """
    plat = platform.value
    for const, val in registry.items():
        if isinstance(val, dict):
            if str(val.get(plat, "")) == selector_value:
                prov = (LocatorProvenance.IOS_OVERRIDE if plat == "ios"
                        else LocatorProvenance.ANDROID_OVERRIDE)
                return const, prov, plat
            if str(val.get("shared", "")) == selector_value:
                return const, LocatorProvenance.SHARED, "shared"
        elif str(val) == selector_value:
            return const, LocatorProvenance.SHARED, None
    return "", LocatorProvenance.INLINE, None


def unresolved_branch(
    registry: Dict[str, Any], constant: str, platform: Platform
) -> bool:
    """True when the constant exists but has no value for this platform and no
    shared fallback — the step silently no-ops."""
    val = registry.get(constant)
    if not isinstance(val, dict):
        return False
    return not (val.get(platform.value) or val.get("shared"))


def build_call_graph(flow_root: str) -> Dict[str, List[str]]:
    """flow file -> subflows it invokes."""
    graph: Dict[str, List[str]] = {}
    for root, _dirs, files in os.walk(flow_root):
        for name in files:
            if not name.endswith((".yaml", ".yml")):
                continue
            path = os.path.relpath(os.path.join(root, name), flow_root)
            try:
                with open(os.path.join(root, name)) as fh:
                    src = fh.read()
            except OSError:
                continue
            subs = [a or b for a, b in RUNFLOW_RE.findall(src) if (a or b)]
            graph[path] = [s.strip("\"'") for s in subs]
    return graph


def callers_of(graph: Dict[str, List[str]], target: str) -> List[str]:
    """Transitive callers — the real rerun set for a page-object change."""
    tgt = os.path.basename(target)
    direct = [f for f, subs in graph.items() if any(os.path.basename(s) == tgt for s in subs)]
    seen = set(direct)
    frontier = list(direct)
    while frontier:
        cur = frontier.pop()
        for f, subs in graph.items():
            if f in seen:
                continue
            if any(os.path.basename(s) == os.path.basename(cur) for s in subs):
                seen.add(f)
                frontier.append(f)
    return sorted(seen)


def blast_radius(flow_root: str, constant: str, selector_value: str = "") -> Tuple[int, List[str]]:
    """How many flow files reference this locator. Static, therefore free."""
    needles = [n for n in (constant, constant.split(".")[-1], selector_value) if n]
    hits: List[str] = []
    for root, _dirs, files in os.walk(flow_root):
        for name in files:
            if not name.endswith((".yaml", ".yml")):
                continue
            p = os.path.join(root, name)
            try:
                with open(p) as fh:
                    src = fh.read()
            except OSError:
                continue
            if any(n in src for n in needles):
                hits.append(os.path.relpath(p, flow_root))
    return len(hits), sorted(hits)


def resolve_call_stack(
    flow_root: str, leaf_flow: str, graph: Optional[Dict[str, List[str]]] = None
) -> List[str]:
    graph = graph or build_call_graph(flow_root)
    chain = callers_of(graph, leaf_flow)
    return chain + [leaf_flow]


def env_leaks(resolved_command: str) -> List[str]:
    return TEMPLATE_RE.findall(resolved_command or "")
