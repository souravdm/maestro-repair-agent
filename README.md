# Maestro Failure Repair Agent

Auto-repairs failed Maestro flows for a **unified Flutter app** tested on iOS and
Android through a **shared page-object registry**.

The design principle is that most test failures are not interesting. They are
renamed identifiers, permission dialogs, off-screen elements, missing platform
overrides and unresolved template variables. Sending those to a model is paying
reasoning prices for lookup work. So the agent resolves them with evidence, and
calls a model only for the residue — with a pruned slice, never a dump.

Measured on the bundled scenario suite: **12 of 13 failure classes resolve at
zero tokens**; the one escalation ships a **~400-token** prompt where a raw iOS
hierarchy dump would be 12k–60k.

## Flow

```
finished run ──► collect ──► FailureBundle ──► rule ladder ──► patch ──► rerun gate ──► cache
                                                    │                        │
                                                    └── fallthrough ──► LLM ─┘
                                                        (pruned slice)
```

Nothing is merged on a model's say-so. Every patch is a unified diff that must
pass a green rerun before it is kept, and only verified patches enter the cache.

## Layout

```
agent/
  models.py               FailureBundle schema + fingerprinting
  pipeline.py             orchestration, gates, cache write-back
  cli.py                  collect / triage / repair / stats
  collect/
    maestro.py            debug-output, JUnit, commands.json, hierarchy capture
    platforms.py          simctl + adb: device state, windowed log slices, crashes/ANR
    flutter.py            semantics inventory, l10n map, semantics rename diff
    pom.py                locator registry, subflow call graph, blast radius
    bundle.py             assembles all of the above into one bundle
  triage/
    hierarchy.py          tree normalization, matching, pruning, three-way diff
    rules.py              the deterministic ladder
    cache.py              fix cache + per-step run history
  repair/
    patch.py              unified-diff synthesis (registry-level and flow-level)
    llm.py                pruned-slice prompt, budget enforcement, output guards
    verify.py             apply, rerun, revert unless green
instrumentation/
  repair_agent_probe.dart NavigatorObserver + semantics/flag probes
ci/circleci-snippet.yml   wiring, including the both-platforms dependency
fixtures/, tests/         13 scenarios, runnable with no device
```

## The ladder

First match wins. A rule may only fire on unambiguous evidence; if it would
have to guess, it returns `None` and the ladder continues.

| # | Rule | Fires on | Action |
|---|------|----------|--------|
| 01–03 | crash / Dart exception / ANR | diagnostic in the failure window | file app bug, **no patch** |
| 04 | cache hit | fingerprint seen and previously verified green | replay patch, 0 tokens |
| 18 | build mismatch | platforms built from different commits | fix infra |
| 05 | unresolved `${VAR}` | template reached the driver | fix env wiring |
| 06 | dead semantics | tree has no addressable nodes at all | fix infra |
| 07 | no branch matched | locator has no value for this platform | add override |
| 08 | system alert | non-app package owns the top of the tree | inject handler |
| 17 | flake | passed on retry, no source change | mark flaky |
| 09 | identifier renamed | absent from Dart inventory + rename in source diff | patch **registry** |
| 10 | needs override | present in other platform's green tree, absent here | patch registry |
| 12 | off-screen | element exists, outside viewport | insert scroll |
| 13 | disabled | element exists, `enabled=false` | wait for enabled |
| 14 | wrong route | navigator top ≠ expected route | wait at the **navigation** step |
| 15 | fixed-point tap | `point` selector; resolves node under the point | replace with locator |
| 16 | timeout tune | present in green + jank or starved runner | raise timeout |
| 11 | platform view | WebView/map host in the subtree | escalate |
| 19 | fallthrough | nothing matched | escalate with pruned slice |

Rules 01–03, 05, 06, 17, 18 deliberately produce **no patch**. They are not
test-code defects, and auto-patching them would hide real bugs.

## Why it stays cheap

- **Fingerprint on the locator constant, not the raw selector**, so one cached fix
  serves every flow sharing that page object. Cache key excludes the commit, so a
  rename fixed once keeps applying.
- **Three-way hierarchy diff** (failing / green-same-platform / green-other-platform).
  Diffing trees is free; re-deriving intent from one tree is not.
- **Cross-platform pairing as a classifier.** Both platforms failed the same step →
  shared regression. One failed → platform override or native chrome. This alone
  halves the search space before any reasoning.
- **Static inventories from Dart source.** One semantics inventory serves both
  platforms — the structural advantage of a unified Flutter app.
- **Windowed logs.** `log collect` / `logcat -d` around the failure, never a stream.
- **Progressive prompt shrink.** The slice builder drops least-decisive keys until
  it fits the budget rather than buying more context.

## Guards

- The model may not originate `file_app_bug`, `fix_infra` or `mark_flaky`.
- A proposed identifier absent from the semantics inventory is rejected before patching.
- Confidence below `min_confidence` → proposed for review, not applied.
- Blast radius above `max_blast_radius` → registry change needs human approval.
- Failed rerun → patch reverted **and** the cache entry invalidated so it never replays.

## Setup

```bash
pip install -r requirements.txt          # PyYAML only; everything else is stdlib
```

1. Add `instrumentation/repair_agent_probe.dart` to the test/profile flavor and
   register `RepairAgentNavObserver`. The `[NAV]` and `[SEMANTICS]` markers are what
   rules 06 and 14 read.
2. Annotate flows with `# @route: /path` where a route assertion is meaningful.
3. Keep locators in one registry (`flows/locators.yaml`) with `shared` / `ios` /
   `android` keys — that shape is what makes registry-level patches possible.
4. Run Maestro with `--format junit --debug-output`.
5. Archive the green hierarchy per step on every passing run; it is the baseline
   the diff needs.

## Usage

```bash
# after a failed run
python3 -m agent.cli collect --debug-output artifacts/ios/debug \
    --junit artifacts/ios/report.xml --platform ios --device "$SIM_UDID" \
    --bundle-id com.cvs.app -o bundle.json

# free tier only — no model call at all
python3 -m agent.cli triage --bundle bundle.json --no-llm

# see what an escalation would cost before spending it
python3 -m agent.cli triage --bundle bundle.json --dry-run-llm --json

# full loop: patch, apply, rerun, keep only if green
python3 -m agent.cli repair --bundle bundle.json --apply --device "$SIM_UDID"

python3 -m agent.cli stats     # cache hit rate and token-free replays
```

Scenario suite, no device required:

```bash
python3 -m tests.test_ladder
```

## Extending

- **New rule**: write a function taking `TriageInput` and returning `Optional[Verdict]`,
  insert it in `LADDER` at the right precedence, add a scenario to `tests/test_ladder.py`.
- **New patch shape**: add a branch in `repair/patch.py::synthesize`.
- **Different model routing**: `repair/llm.py` imports `llm_provider.complete` if it is
  importable, and falls back to the Anthropic Messages API.
- **Postgres instead of JSON**: reimplement `FixCache.get/put` and `RunHistory`; nothing
  else touches storage.

## Deliberate non-goals

The agent does not retry blindly, does not widen selectors to make a step pass,
and does not patch anything when the app itself threw. Those all raise the pass
rate while lowering the value of the suite.
