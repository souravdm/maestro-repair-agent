"""View-hierarchy normalization, matching, pruning and N-way diffing.

This module is where the token savings live. A full Flutter-on-iOS tree is
routinely 50k+ tokens; the subtree that matters is almost always under 500.
Nothing here calls a model.
"""
from __future__ import annotations

import difflib
import json
import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Maestro emits different attribute names per driver. Normalize once.
_ID_KEYS = ("resource-id", "resourceId", "accessibilityIdentifier", "identifier", "id")
_TEXT_KEYS = ("text", "accessibilityText", "label", "title", "value")
_HINT_KEYS = ("hintText", "hint", "placeholder")
_CLASS_KEYS = ("class", "className", "elementType", "type")
_PKG_KEYS = ("package", "bundleId", "bundle-id")


@dataclass
class Node:
    path: str                     # index path, e.g. "0.3.1.2"
    id: str = ""
    text: str = ""
    hint: str = ""
    cls: str = ""
    package: str = ""
    bounds: Tuple[int, int, int, int] = (0, 0, 0, 0)
    enabled: bool = True
    focused: bool = False
    checked: Optional[bool] = None
    selected: Optional[bool] = None
    depth: int = 0

    # ---- derived
    @property
    def width(self) -> int:
        return self.bounds[2] - self.bounds[0]

    @property
    def height(self) -> int:
        return self.bounds[3] - self.bounds[1]

    @property
    def has_area(self) -> bool:
        return self.width > 0 and self.height > 0

    def signature(self) -> str:
        """Identity used for cross-tree matching. Deliberately excludes bounds
        so the same logical widget matches across platforms and densities."""
        return f"{self.id}|{self.text}|{self.cls.split('.')[-1]}"

    def compact(self) -> Dict[str, Any]:
        """Minimal dict for prompt inclusion. Empty fields dropped."""
        d: Dict[str, Any] = {"p": self.path}
        if self.id:
            d["id"] = self.id
        if self.text:
            d["text"] = self.text[:80]
        if self.hint:
            d["hint"] = self.hint[:40]
        if self.cls:
            d["cls"] = self.cls.split(".")[-1]
        if not self.enabled:
            d["enabled"] = False
        if not self.has_area:
            d["zero_area"] = True
        return d


def _first(attrs: Dict[str, Any], keys: Iterable[str]) -> str:
    for k in keys:
        v = attrs.get(k)
        if v not in (None, "", "null"):
            return str(v)
    return ""


def _parse_bounds(attrs: Dict[str, Any]) -> Tuple[int, int, int, int]:
    b = attrs.get("bounds")
    if isinstance(b, dict):
        x = int(float(b.get("x", 0)))
        y = int(float(b.get("y", 0)))
        w = int(float(b.get("width", 0)))
        h = int(float(b.get("height", 0)))
        return (x, y, x + w, y + h)
    if isinstance(b, str):
        m = re.findall(r"-?\d+", b)
        if len(m) >= 4:
            return tuple(int(v) for v in m[:4])  # type: ignore[return-value]
    return (0, 0, 0, 0)


def _truthy(v: Any, default: bool = True) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("true", "1", "yes")


class Tree:
    """Flattened, normalized hierarchy with lookup indexes."""

    def __init__(self, nodes: List[Node], platform: str = "", label: str = ""):
        self.nodes = nodes
        self.platform = platform
        self.label = label
        self.by_id: Dict[str, List[Node]] = {}
        self.by_text: Dict[str, List[Node]] = {}
        self.by_path: Dict[str, Node] = {}
        for n in nodes:
            self.by_path[n.path] = n
            if n.id:
                self.by_id.setdefault(n.id, []).append(n)
            if n.text:
                self.by_text.setdefault(n.text.strip().lower(), []).append(n)

    def __len__(self) -> int:
        return len(self.nodes)

    # ------------------------------------------------------------ loading
    @classmethod
    def load(cls, path: str, platform: str = "", label: str = "") -> "Tree":
        with open(path) as fh:
            return cls.from_obj(json.load(fh), platform=platform, label=label or path)

    @classmethod
    def from_obj(cls, obj: Any, platform: str = "", label: str = "") -> "Tree":
        nodes: List[Node] = []

        def walk(node: Any, path: str, depth: int) -> None:
            if not isinstance(node, dict):
                return
            attrs = node.get("attributes", node)
            if not isinstance(attrs, dict):
                attrs = {}
            nodes.append(
                Node(
                    path=path,
                    id=_first(attrs, _ID_KEYS),
                    text=_first(attrs, _TEXT_KEYS),
                    hint=_first(attrs, _HINT_KEYS),
                    cls=_first(attrs, _CLASS_KEYS),
                    package=_first(attrs, _PKG_KEYS),
                    bounds=_parse_bounds(attrs),
                    enabled=_truthy(attrs.get("enabled")),
                    focused=_truthy(attrs.get("focused"), False),
                    checked=None if attrs.get("checked") is None else _truthy(attrs.get("checked")),
                    selected=None if attrs.get("selected") is None else _truthy(attrs.get("selected")),
                    depth=depth,
                )
            )
            for i, child in enumerate(node.get("children") or []):
                walk(child, f"{path}.{i}" if path else str(i), depth + 1)

        root = obj[0] if isinstance(obj, list) and obj else obj
        walk(root, "0", 0)
        return cls(nodes, platform=platform, label=label)

    # ------------------------------------------------------------ matching
    def match(self, kind: str, value: str) -> List[Node]:
        """Exact match with Maestro's semantics: id is regex-ish, text is regex."""
        if not value:
            return []
        if kind == "id":
            hits = self.by_id.get(value, [])
            if hits:
                return hits
            try:
                pat = re.compile(value)
                return [n for n in self.nodes if n.id and pat.fullmatch(n.id)]
            except re.error:
                return []
        if kind == "text":
            hits = self.by_text.get(value.strip().lower(), [])
            if hits:
                return hits
            try:
                pat = re.compile(value, re.IGNORECASE)
                return [n for n in self.nodes if n.text and pat.search(n.text)]
            except re.error:
                return []
        return []

    def candidates(self, value: str, k: int = 5) -> List[Tuple[float, Node]]:
        """Nearest plausible replacements, ranked. Pure string distance — free."""
        target = (value or "").lower()
        scored: List[Tuple[float, Node]] = []
        for n in self.nodes:
            for field_val in (n.id, n.text, n.hint):
                if not field_val:
                    continue
                r = difflib.SequenceMatcher(None, target, field_val.lower()).ratio()
                if r > 0.45:
                    scored.append((round(r, 3), n))
                    break
        scored.sort(key=lambda t: -t[0])
        return scored[:k]

    def owners(self) -> Dict[str, int]:
        """package -> node count. Detects system alert chrome on top of the app."""
        out: Dict[str, int] = {}
        for n in self.nodes:
            if n.package:
                out[n.package] = out.get(n.package, 0) + 1
        return out

    def signatures(self) -> Dict[str, Node]:
        out: Dict[str, Node] = {}
        for n in self.nodes:
            sig = n.signature()
            if sig.strip("|"):
                out.setdefault(sig, n)
        return out

    def viewport(self) -> Tuple[int, int, int, int]:
        root = self.by_path.get("0")
        return root.bounds if root else (0, 0, 0, 0)

    def is_offscreen(self, n: Node) -> bool:
        vx0, vy0, vx1, vy1 = self.viewport()
        if vx1 == 0 or vy1 == 0:
            return False
        x0, y0, x1, y1 = n.bounds
        return y1 <= vy0 or y0 >= vy1 or x1 <= vx0 or x0 >= vx1

    def node_at_point(self, spec: str) -> Optional[Node]:
        """Resolve a Maestro point selector ("50%,80%" or "540,1180") to the
        deepest addressable node under it. Used to replace fixed-coordinate taps
        with a stable locator."""
        vx0, vy0, vx1, vy1 = self.viewport()
        vw, vh = max(1, vx1 - vx0), max(1, vy1 - vy0)
        m = re.findall(r"(-?[\d.]+)\s*%?", spec or "")
        if len(m) < 2:
            return None
        pct = "%" in (spec or "")
        x = float(m[0]) / 100.0 * vw if pct else float(m[0])
        y = float(m[1]) / 100.0 * vh if pct else float(m[1])
        hits = [
            n for n in self.nodes
            if n.has_area and n.bounds[0] <= x <= n.bounds[2] and n.bounds[1] <= y <= n.bounds[3]
            and (n.id or n.text)
        ]
        if not hits:
            return None
        return max(hits, key=lambda n: n.depth)

    def semantics_looks_dead(self) -> bool:
        """Flutter on iOS builds semantics lazily. An almost-empty tree with no
        ids and no text is an infra problem, not a missing element."""
        return self.addressable_count() == 0

    def addressable_count(self) -> int:
        """Nodes a locator could actually target."""
        return sum(1 for n in self.nodes if (n.id or n.text) and n.has_area)

    def semantics_looks_sparse(self, floor: int = 8) -> bool:
        """A rendered screen with fewer than `floor` addressable nodes is not a
        screen with a missing widget — it is a screen that is not publishing its
        semantics. Distinct from a fully dead tree, and far more common in
        practice: WebView/platform-view hosted flows, ExcludeSemantics wrappers,
        and screens built before the semantics tree was requested all land here."""
        return 0 < self.addressable_count() < floor


# ---------------------------------------------------------------- pruning

def prune_around(
    tree: Tree,
    anchor_value: str,
    radius: int = 2,
    max_nodes: int = 60,
) -> List[Node]:
    """Return the subtree slice most likely to explain the failure.

    Anchor = best fuzzy candidate for the selector. Slice = its ancestors up to
    `radius` levels plus their descendants, capped. If no anchor, fall back to
    the deepest interactive cluster.
    """
    cands = tree.candidates(anchor_value, k=1)
    if cands:
        anchor = cands[0][1]
        parts = anchor.path.split(".")
        base = ".".join(parts[: max(1, len(parts) - radius)])
    else:
        interactive = [n for n in tree.nodes if n.id or n.text]
        if not interactive:
            return tree.nodes[:max_nodes]
        anchor = max(interactive, key=lambda n: n.depth)
        base = ".".join(anchor.path.split(".")[:-radius] or ["0"])
    slice_ = [n for n in tree.nodes if n.path.startswith(base)]
    slice_.sort(key=lambda n: n.path)
    return slice_[:max_nodes]


# ---------------------------------------------------------------- diffing

@dataclass
class TreeDiff:
    removed: List[Node] = field(default_factory=list)   # in green, gone in failing
    added: List[Node] = field(default_factory=list)     # new in failing
    changed: List[Tuple[Node, Node, List[str]]] = field(default_factory=list)
    only_other_platform: List[Node] = field(default_factory=list)

    def summary(self) -> Dict[str, int]:
        return {
            "removed": len(self.removed),
            "added": len(self.added),
            "changed": len(self.changed),
            "only_other_platform": len(self.only_other_platform),
        }

    def compact(self, cap: int = 12) -> Dict[str, Any]:
        return {
            "removed": [n.compact() for n in self.removed[:cap]],
            "added": [n.compact() for n in self.added[:cap]],
            "changed": [
                {"was": a.compact(), "now": b.compact(), "fields": f}
                for a, b, f in self.changed[:cap]
            ],
            "only_other_platform": [n.compact() for n in self.only_other_platform[:cap]],
            "counts": self.summary(),
        }


def diff(
    failing: Tree,
    green_same: Optional[Tree] = None,
    green_other: Optional[Tree] = None,
) -> TreeDiff:
    """Three-way diff. Cross-platform arm is what makes Flutter cheap to triage:
    a node present in the other platform's green tree but absent here means
    'needs a platform override', not 'element was removed'."""
    out = TreeDiff()
    fail_sigs = failing.signatures()

    if green_same is not None:
        green_sigs = green_same.signatures()
        for sig, gn in green_sigs.items():
            if sig not in fail_sigs:
                out.removed.append(gn)
        for sig, fn in fail_sigs.items():
            if sig not in green_sigs:
                out.added.append(fn)
        for sig in set(green_sigs) & set(fail_sigs):
            gn, fn = green_sigs[sig], fail_sigs[sig]
            fields = []
            if gn.enabled != fn.enabled:
                fields.append("enabled")
            if gn.has_area != fn.has_area:
                fields.append("area")
            if gn.checked != fn.checked:
                fields.append("checked")
            if fields:
                out.changed.append((gn, fn, fields))

    if green_other is not None:
        other_sigs = green_other.signatures()
        for sig, on in other_sigs.items():
            if sig not in fail_sigs:
                out.only_other_platform.append(on)

    return out
