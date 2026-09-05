"""Normalized failure-bundle schema.

Everything the repair agent reasons about must land in a FailureBundle.
Collectors fill it; triage rules read it; only a pruned slice ever reaches an LLM.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, List, Optional


class Platform(str, Enum):
    IOS = "ios"
    ANDROID = "android"


class FailureClass(str, Enum):
    ELEMENT_NOT_FOUND = "element_not_found"
    ASSERTION_FAILED = "assertion_failed"
    TIMEOUT = "timeout"
    TAP_NO_EFFECT = "tap_no_effect"
    APP_NOT_RUNNING = "app_not_running"
    INSTALL_LAUNCH = "install_launch"
    UNKNOWN = "unknown"


class LocatorProvenance(str, Enum):
    SHARED = "shared"
    IOS_OVERRIDE = "ios_override"
    ANDROID_OVERRIDE = "android_override"
    INLINE = "inline"
    UNRESOLVED = "unresolved"


class OtherPlatformResult(str, Enum):
    PASSED = "passed"
    FAILED_SAME_STEP = "failed_same_step"
    FAILED_EARLIER = "failed_earlier"
    NOT_REACHED = "not_reached"
    NOT_RUN = "not_run"


@dataclass
class DeviceState:
    platform: Platform
    os_version: str = ""
    model: str = ""
    udid: str = ""
    locale: str = ""
    dark_mode: bool = False
    orientation: str = "portrait"
    font_scale: float = 1.0
    density: Optional[float] = None
    keyboard_visible: bool = False
    animations_enabled: bool = True
    accessibility_enabled: bool = True
    api_level: Optional[int] = None
    gesture_nav: Optional[bool] = None


@dataclass
class AppBuild:
    bundle_id: str = ""
    version: str = ""
    build_number: str = ""
    commit_sha: str = ""
    flutter_sdk: str = ""
    renderer: str = ""
    flavor: str = "profile"
    semantics_enabled: Optional[bool] = None
    fresh_install: bool = True


@dataclass
class StepFrame:
    file: str
    line: Optional[int] = None
    command_index: Optional[int] = None
    raw: str = ""


@dataclass
class Selector:
    kind: str = "id"
    value: str = ""
    index: Optional[int] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    def normalized(self) -> str:
        return f"{self.kind}={self.value}".strip().lower()


@dataclass
class FailingStep:
    flow_id: str
    command_index: int
    # Display name ("H100 | Benefits | Claims | TC001 - ...") vs. the real path on
    # disk. flow_id is for humans and fingerprints; flow_file is what may be joined
    # onto a directory. Never use flow_id as a path.
    flow_file: str = ""
    command_type: str = ""
    raw_yaml: str = ""
    # The command as the driver actually executed it, with ${VAR} substituted.
    # Left empty when the run did not record it — it must never be backfilled
    # from raw_yaml, or every templated flow looks like an unresolved-variable bug.
    resolved_command: str = ""
    selector: Selector = field(default_factory=Selector)
    locator_constant: str = ""
    locator_provenance: LocatorProvenance = LocatorProvenance.INLINE
    platform_branch_taken: Optional[str] = None
    timeout_ms: int = 0
    elapsed_ms: int = 0
    call_stack: List[StepFrame] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    failure_class: FailureClass = FailureClass.UNKNOWN
    driver_message: str = ""


@dataclass
class LogWindow:
    window_start: str = ""
    window_end: str = ""
    dart_exceptions: List[str] = field(default_factory=list)
    native_crashes: List[str] = field(default_factory=list)
    anr_traces: List[str] = field(default_factory=list)
    system_alert_owners: List[str] = field(default_factory=list)
    route_stack: List[str] = field(default_factory=list)
    expected_route: Optional[str] = None
    jank_markers: int = 0
    raw_slice_path: str = ""


@dataclass
class RunContext:
    ci_job_id: str = ""
    workflow_id: str = ""
    branch: str = ""
    commit_sha: str = ""
    retry_attempt: int = 0
    passed_on_retry: bool = False
    runner_cpu_pct: Optional[float] = None
    runner_mem_free_mb: Optional[int] = None
    runner_disk_free_mb: Optional[int] = None
    feature_flags: Dict[str, Any] = field(default_factory=dict)
    other_platform_result: OtherPlatformResult = OtherPlatformResult.NOT_RUN
    other_platform_commit: str = ""
    source_diff_files: List[str] = field(default_factory=list)
    semantics_diff: Dict[str, str] = field(default_factory=dict)
    test_data_profile: str = ""


@dataclass
class Artifacts:
    hierarchy_failing: str = ""
    hierarchy_prev_step: str = ""
    hierarchy_green_same_platform: str = ""
    hierarchy_green_other_platform: str = ""
    screenshot_failing: str = ""
    screenshot_prev_step: str = ""
    video: str = ""
    junit_xml: str = ""
    debug_output_dir: str = ""
    har: str = ""


@dataclass
class Inventories:
    semantics_identifiers: List[str] = field(default_factory=list)
    l10n_keys: Dict[str, str] = field(default_factory=dict)
    locator_registry: Dict[str, Any] = field(default_factory=dict)
    platform_view_hosts: List[str] = field(default_factory=list)
    blast_radius: int = 0


@dataclass
class FailureBundle:
    run_id: str
    platform: Platform
    device: DeviceState
    app: AppBuild
    step: FailingStep
    logs: LogWindow = field(default_factory=LogWindow)
    context: RunContext = field(default_factory=RunContext)
    artifacts: Artifacts = field(default_factory=Artifacts)
    inventories: Inventories = field(default_factory=Inventories)
    maestro_version: str = ""

    def fingerprint(self) -> str:
        parts = [
            self.step.flow_id.split("/")[-1],
            str(self.step.command_index),
            self.step.failure_class.value,
            self.step.locator_constant or self.step.selector.normalized(),
            self.logs.route_stack[-1] if self.logs.route_stack else "",
            self.platform.value,
            self.app.commit_sha[:12],
        ]
        return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]

    def cache_key(self) -> str:
        parts = [
            self.step.failure_class.value,
            self.step.locator_constant or self.step.selector.normalized(),
            self.platform.value,
        ]
        return hashlib.sha256("|".join(parts).encode()).hexdigest()[:16]

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(asdict(self), indent=indent, default=str)

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "FailureBundle":
        step_d = dict(d["step"])
        step_d["selector"] = Selector(**step_d["selector"]) if step_d.get("selector") else Selector()
        step_d["call_stack"] = [StepFrame(**f) for f in step_d.get("call_stack", [])]
        step_d["failure_class"] = FailureClass(step_d.get("failure_class", "unknown"))
        step_d["locator_provenance"] = LocatorProvenance(step_d.get("locator_provenance", "inline"))
        dev = dict(d["device"])
        dev["platform"] = Platform(dev["platform"])
        ctx = dict(d.get("context", {}))
        if "other_platform_result" in ctx:
            ctx["other_platform_result"] = OtherPlatformResult(ctx["other_platform_result"])
        return FailureBundle(
            run_id=d["run_id"],
            platform=Platform(d["platform"]),
            device=DeviceState(**dev),
            app=AppBuild(**d.get("app", {})),
            step=FailingStep(**step_d),
            logs=LogWindow(**d.get("logs", {})),
            context=RunContext(**ctx),
            artifacts=Artifacts(**d.get("artifacts", {})),
            inventories=Inventories(**d.get("inventories", {})),
            maestro_version=d.get("maestro_version", ""),
        )


class Action(str, Enum):
    FILE_APP_BUG = "file_app_bug"
    APPLY_CACHED_FIX = "apply_cached_fix"
    PATCH_ENV_WIRING = "patch_env_wiring"
    FIX_INFRA = "fix_infra"
    INJECT_ALERT_HANDLER = "inject_alert_handler"
    RENAME_LOCATOR = "rename_locator"
    ADD_PLATFORM_OVERRIDE = "add_platform_override"
    ADD_SCROLL = "add_scroll"
    WAIT_FOR_ENABLED = "wait_for_enabled"
    WAIT_FOR_ROUTE = "wait_for_route"
    TUNE_TIMEOUT = "tune_timeout"
    REPLACE_POINT_TAP = "replace_point_tap"
    MARK_FLAKY = "mark_flaky"
    ESCALATE_LLM = "escalate_llm"
    NO_ACTION = "no_action"


@dataclass
class Verdict:
    rule: str
    action: Action
    confidence: float
    rationale: str
    patch_hint: Dict[str, Any] = field(default_factory=dict)
    requires_rerun: bool = True
    tokens_spent: int = 0
