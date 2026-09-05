"""Collectors: iOS Simulator and Android device/emulator state and log windows.

Both use post-hoc windowed collection. Never stream full logs into the agent.
"""
from __future__ import annotations

import glob
import json
import os
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ..models import DeviceState, LogWindow, Platform

WINDOW_S = int(os.environ.get("REPAIR_AGENT_LOG_WINDOW_S", "30"))

DART_EXC_RE = re.compile(
    r"(Unhandled Exception|EXCEPTION CAUGHT BY|Null check operator|"
    r"RenderFlex overflowed|setState\(\) called after dispose|"
    r"Failed assertion:|LateInitializationError|type '.*' is not a subtype)"
)
ROUTE_RE = re.compile(r"\[NAV\]\s*(push|pop|replace)\s+(\S+)")
JANK_RE = re.compile(r"Skipped \d+ frames|frame took|Janky frames")


def _sh(cmd: List[str], timeout: int = 120) -> str:
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.stdout or ""
    except Exception:
        return ""


def _scan_log_text(text: str) -> Dict[str, Any]:
    dart, routes, jank = [], [], 0
    for line in text.splitlines():
        if DART_EXC_RE.search(line):
            dart.append(line.strip()[:400])
        m = ROUTE_RE.search(line)
        if m:
            op, route = m.group(1), m.group(2)
            if op == "pop" and routes:
                routes.pop()
            else:
                routes.append(route)
        if JANK_RE.search(line):
            jank += 1
    return {"dart_exceptions": dart[:5], "route_stack": routes[-8:], "jank_markers": jank}


# ------------------------------------------------------------------- iOS

def ios_device_state(udid: str) -> DeviceState:
    st = DeviceState(platform=Platform.IOS, udid=udid)
    raw = _sh(["xcrun", "simctl", "list", "devices", "-j"])
    try:
        data = json.loads(raw or "{}")
        for runtime, devices in (data.get("devices") or {}).items():
            for d in devices:
                if d.get("udid") == udid:
                    st.model = d.get("name", "")
                    st.os_version = runtime.split(".")[-1].replace("iOS-", "").replace("-", ".")
    except json.JSONDecodeError:
        pass
    plist_root = os.path.expanduser(f"~/Library/Developer/CoreSimulator/Devices/{udid}/data")
    glob_pref = os.path.join(plist_root, "Library/Preferences/.GlobalPreferences.plist")
    if os.path.exists(glob_pref):
        out = _sh(["plutil", "-p", glob_pref])
        m = re.search(r'"AppleLocale"\s*=>\s*"([^"]+)"', out)
        if m:
            st.locale = m.group(1)
    ui = _sh(["xcrun", "simctl", "ui", udid, "appearance"]).strip()
    st.dark_mode = ui == "dark"
    incr = _sh(["xcrun", "simctl", "ui", udid, "content_size"]).strip()
    st.font_scale = {"extra-small": 0.8, "small": 0.9, "medium": 1.0,
                     "large": 1.1, "extra-large": 1.2}.get(incr, 1.0)
    return st


def ios_log_window(udid: str, bundle_id: str, at: Optional[float] = None) -> LogWindow:
    at = at or time.time()
    start = datetime.fromtimestamp(at - WINDOW_S, tz=timezone.utc)
    end = datetime.fromtimestamp(at + WINDOW_S, tz=timezone.utc)
    fmt = "%Y-%m-%d %H:%M:%S"
    pred = f'processImagePath CONTAINS "{bundle_id.split(".")[-1]}"' if bundle_id else ""
    args = ["xcrun", "simctl", "spawn", udid, "log", "show",
            "--start", start.strftime(fmt), "--end", end.strftime(fmt), "--style", "compact"]
    if pred:
        args += ["--predicate", pred]
    text = _sh(args, timeout=180)
    scan = _scan_log_text(text)

    crashes: List[str] = []
    cutoff = at - 600
    for pat in (
        os.path.expanduser("~/Library/Logs/DiagnosticReports/*.ips"),
        os.path.expanduser(f"~/Library/Developer/CoreSimulator/Devices/{udid}/data/Library/Logs/DiagnosticReports/*.ips"),
    ):
        for p in glob.glob(pat):
            try:
                if os.path.getmtime(p) >= cutoff:
                    crashes.append(p)
            except OSError:
                continue

    return LogWindow(
        window_start=start.isoformat(),
        window_end=end.isoformat(),
        native_crashes=crashes[:3],
        **scan,
    )


def ios_semantics_enabled(log_text: str) -> Optional[bool]:
    if "semanticsEnabled=true" in log_text or "[SEMANTICS] enabled" in log_text:
        return True
    if "semanticsEnabled=false" in log_text or "[SEMANTICS] disabled" in log_text:
        return False
    return None


# --------------------------------------------------------------- Android

def android_device_state(serial: str = "") -> DeviceState:
    def prop(name: str) -> str:
        args = ["adb"] + (["-s", serial] if serial else []) + ["shell", "getprop", name]
        return _sh(args, timeout=30).strip()

    st = DeviceState(platform=Platform.ANDROID, udid=serial)
    st.model = prop("ro.product.model")
    st.os_version = prop("ro.build.version.release")
    try:
        st.api_level = int(prop("ro.build.version.sdk") or 0) or None
    except ValueError:
        st.api_level = None
    st.locale = prop("persist.sys.locale") or prop("ro.product.locale")
    try:
        st.density = float(prop("ro.sf.lcd_density") or 0) or None
    except ValueError:
        st.density = None
    args = ["adb"] + (["-s", serial] if serial else []) + ["shell", "settings", "get", "global", "window_animation_scale"]
    st.animations_enabled = (_sh(args, timeout=30).strip() or "1") not in ("0", "0.0")
    args = ["adb"] + (["-s", serial] if serial else []) + ["shell", "dumpsys", "input_method"]
    st.keyboard_visible = "mInputShown=true" in _sh(args, timeout=60)
    args = ["adb"] + (["-s", serial] if serial else []) + ["shell", "cmd", "overlay", "list"]
    ov = _sh(args, timeout=30)
    st.gesture_nav = "gestural" in ov.lower() or None
    return st


def android_log_window(serial: str = "", tag_filter: str = "") -> LogWindow:
    args = ["adb"] + (["-s", serial] if serial else []) + ["logcat", "-d", "-t", "2000"]
    if tag_filter:
        args += [f"{tag_filter}:V", "flutter:V", "*:E"]
    text = _sh(args, timeout=120)
    scan = _scan_log_text(text)

    anr: List[str] = []
    dump = _sh(["adb"] + (["-s", serial] if serial else []) + ["shell", "ls", "/data/anr/"], 30)
    for name in dump.split():
        if name.strip():
            anr.append(f"/data/anr/{name.strip()}")

    alerts: List[str] = []
    fg = _sh(["adb"] + (["-s", serial] if serial else []) +
             ["shell", "dumpsys", "activity", "activities"], 90)
    for owner in ("com.android.permissioncontroller", "com.google.android.gms",
                  "com.android.systemui", "com.android.packageinstaller"):
        if owner in fg:
            alerts.append(owner)

    return LogWindow(anr_traces=anr[:3], system_alert_owners=alerts, **scan)


def foreground_route(log_text: str) -> Optional[str]:
    routes = _scan_log_text(log_text)["route_stack"]
    return routes[-1] if routes else None
