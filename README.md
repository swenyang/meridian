# Meridian

> Three-layer autonomous engineering framework. You're the CEO — Meridian is the team.

A Copilot CLI skill + Node.js harness that builds software through a **Strategic → Execution → Verification** loop with mechanical quality gates.

## What's Different

Most multi-agent frameworks simulate human company org charts: PM Agent, Architect Agent, Frontend Agent, QA Agent... Many roles, same LLM, different system prompts. Token cost multiplied, knowledge unchanged.

Meridian is designed around **AI failure modes**, not human roles:

| AI Failure Mode | Meridian's Response |
|---|---|
| Self-leniency (rates own work too high) | Context isolation — verification can't see execution's reasoning |
| Hallucination ("tests passed" but didn't run) | Mechanical verifier — code-level pass/fail, not LLM judgment |
| Sycophancy (agrees with prior conclusions) | Verification reviewer in isolated context |
| Context degradation (forgets goals mid-project) | Memory system with project_brief anchor |
| Overconfidence ("looks correct" without running) | Evidence required — no stdout, no PASS |
| Scope gaming (puts core tech in "optional") | Technical analysis binds feature list — chosen approach = will-build |
| Toy eval data (3-row tests prove nothing) | Eval dataset quality gate — realism, coverage, difficulty, volume checks |
| Dead features (code exists but never called) | Will-build usage verification — dead code = critical finding |
| Vague acceptance criteria ("tests pass") | Structured typed criteria with schema validation — e2e scenarios, real-data checks |
| Execution grades its own homework | Verification layer independently writes and runs its own acceptance tests |

## Core Principles

1. **The agent that does the work never evaluates it.** Execution and verification are always separate subagents with isolated contexts.
2. **Mechanical verdicts override LLM opinions.** Tool output > verification review findings > self-report. Eval metrics below target = FAIL regardless of passing tests.
3. **Real data, not synthetic data.** Eval against real-world data, not self-generated toy examples.
4. **Core before chrome.** Core function must work on real data before ANY auxiliary features (CLI, batch, caching, formatters). Block auxiliary tasks until core passes real-data eval.
5. **Minimize user interruptions.** Only ask for: irreversible decisions, scope confirmation, design confirmation, verification plan review, escalations after all recovery strategies exhausted.
6. **Scope changes are user decisions.** Never silently reduce scope. Core technical approach = always will-build, never optional.
7. **Match the user's language.** All user-facing output in the same language as the user's input. Internal artifacts may remain in English.

## Architecture

```
                    ┌──────────────┐
                    │  Strategic    │
                    │  Layer        │ ← Project owner: expand, design,
                    │  (main agent) │   decompose, checkpoint, decide
                    └──┬───────┬───┘
           task+context│       │criteria (the WHAT)
                      ↓       ↓
               ┌──────┐     ┌──────────────────────┐
               │Execut.│     │  Verification Layer   │
               │      │     │                       │
               │writes │     │  1. $HARNESS verify   │ ← Baseline: execution's
               │code + │     │     (tests/lint/build) │   tests, lint, build, eval
               │own    │     │                       │
               │tests  │     │  2. Writes OWN e2e +  │ ← Independent: verification
               │(self- │     │     real-data scripts  │   writes its own acceptance
               │check) │     │     → runs them        │   tests from criteria
               │       │     │                       │
               └──┬───┘     │  3. Spec compliance + │ ← Code review: right thing
                  │          │     code quality review│   built well?
                  ↓          └────────┬──────────────┘
               (code to                │ verdict
                strategic)             ↓
                               PASS → next task
                               FAIL → iterate (escalation ladder)
```

**Data flow is deliberately asymmetric.** Strategic sees everything. Execution sees task + project context. Verification sees only code + criteria — never execution's reasoning.

**Verification independence:** The verification layer writes its own acceptance test scripts based on criteria — it does NOT run scripts written by the execution layer. Execution's tests are self-checks (baseline); verification's tests are the acceptance gate.

The verification layer participates in THREE phases:
1. **Requirement expansion** — reviews product spec for gaps, scope reduction, missing technical depth
2. **Design** — reviews architecture for completeness, consistency, implementability
3. **Code** — reviews implementation for bugs, dead will-build features, acceptance criteria

## Protocol

```
/meridian <requirement>
│
▼
Step 0 — Initialize
│  Detect run state:
│  ├── First time → create .meridian/
│  ├── Active run → append requirement, update memory, add to plan
│  └── Previous completed → archive, start fresh (memory preserved)
│  Detect codebase:
│  ├── Existing project → scan architecture/tests/conventions, store in memory
│  └── Empty project → proceed
│
▼
Step 1 — Requirement Expansion ·················· 👤 User checkpoint 1/3
│  1a. Strategic layer expands requirement
│      Core Technical Challenge analysis first (naive → why fails → better → chosen)
│      Three non-negotiable rules enforced:
│        - Chosen technical approach = will-build (not optional)
│        - External deps (API keys) collected upfront
│        - No "deferred to v1.1" dumping ground
│  1b. Verification reviewer checks expansion
│      Technical depth, scope reduction, eval strategy, E2E definition
│  1c. Iterate until reviewer satisfied (escalation ladder if stuck)
│  1d. Present scope to user + collect required credentials
│
▼
Step 2 — Design Phase ··························· 👤 User checkpoint 2/3
│  2a. Design organized by scope item (1:1 mapping to will-build list)
│      Each scope item → design approach + interfaces + confidence
│      Cross-cutting concerns must state which scope items they serve
│  2b. Verification reviewer checks scope coverage first
│      Uncovered scope item = critical gap; orphan design = gold-plating
│  2c. Present design to user (organized by scope, not by tech category)
│  → Confirmed design stored as binding contract
│
▼
│
Step 3 — Strategic Decomposition
│  Confirmed design → structured task list
│  Each task gets `kind` (scaffolding/core/feature/integration/...)
│  Structured acceptance criteria (typed: e2e, real_data, unit, ...)
│  Minimum: ≥3 e2e per core task, ≥3 real-data files per core task
│  Integration checkpoints every 3-4 tasks
│  Core-first ordering: core → auxiliary → polish
│  Final task = end-to-end validation
│
Step 3.5 — Eval Framework Design ················· 👤 User checkpoint 3/3
│  Design product-level eval framework with user:
│  ├── Eval pipeline: input → run product → compare to ground truth → score
│  ├── Metrics & targets (e.g., accuracy ≥ 0.90, error_rate ≤ 0.05)
│  ├── Dataset: ≥30 real files from ≥3 sources, 3 difficulty levels
│  ├── E2E acceptance scenarios (product-level, not per-task)
│  └── User adjusts targets, adds sources, strengthens scenarios
│  This framework is the quality bar — too lenient = broken product passes
│  User selects execution mode:
│  ├── [1] Autopilot (recommended) — no permission prompts
│  ├── [2] Default — manual confirmations
│  └── [3] Autopilot with checkpoints — pauses between tasks
│
Step 4 — Core Hypothesis Validation
│  AFTER user approves verification plan
│  Spike core approach on 3-5 real files
│  Judge results against user-approved criteria
│  Catch fundamental flaws when they're cheap to fix
│
▼ ─── Fully autonomous below — user only involved on escalation ───
│
Step 5 — Handle Decisions
│  Irreversible → block immediately, ask user (multiple-choice)
│  Reversible → use recommended, batch 3+ then confirm
│
Step 6 — Task Execution Loop ←────────────────────┐
│  for each task:                                  │
│    6a. Check dependencies ready                  │
│    6b. Strategic layer refines task               │
│    6c. Execution subagent writes code (isolated)  │
│        └─ Writes own tests (self-check, untrusted)│
│    6d. Verification subagent (isolated context):  │
│        Phase 1: $HARNESS verify (baseline)        │
│          execution's tests + lint + build + eval  │
│        Phase 2: Writes OWN acceptance scripts     │
│          e2e/real_data/integration — independent  │
│          runs them, records pass/fail per criterion│
│        Phase 3: Spec compliance + code quality    │
│          will-build usage, bugs, YAGNI            │
│    6e. Strategic reads verdict:                   │
│        any phase FAIL → overall FAIL              │
│        all clear → PASS                          │
│    6f. Handle verdict:                            │
│        PASS → update memory, next task            │
│        FAIL → escalation ladder:                 │
│          retry(3x) → rethink → split             │
│          → skip → escalate to user               │
│        Integration FAIL → diagnose root cause     │
│          → task-reopen → cascade reverify ────────┘
│
Step 7 — Checkpoint (every N tasks)
│  Strategic layer reviews globally:
│  ├── Consistency check (interface conflicts?)
│  ├── Direction check (drifting from goal?)
│  ├── Plan adjustment (add/remove/update tasks)
│  ├── Task backtracking (reopen → reverify cascade)
│  ├── Eval-driven quality loop (AI/ML projects):
│  │     eval dataset quality gate (realism, coverage, volume)
│  │     → eval → analyze failure clusters → targeted fix
│  │     → re-eval → loop until target or plateau
│  └── Batch decision report if due
│
Step 8 — Status Notifications
│  [Meridian] ✅ T1 complete | ⏳ T2 executing | Progress 1/8
│  [Meridian] ❌ T2 FAIL (attempt 1/3) — retrying
│  [Meridian] 🔴 T3 blocked — escalating with analysis + options
│
Step 9 — Completion
   Mark run complete → next /meridian auto-archives, memory preserved
```

## Failure Recovery

When a task fails, the strategic layer exhausts all options before involving the user:

```
retry (3x)       → same approach, with findings
rethink           → change implementation strategy
split             → break into smaller subtasks
skip & revisit    → do other tasks first, come back later
escalate          → present full analysis + options to user (multiple-choice)
```

## Multi-Layer Iteration

| Layer | Trigger | Mechanism |
|---|---|---|
| **Task retry** | Verification fails | Retry with findings, then escalation ladder |
| **Task backtracking** | Checkpoint finds earlier task is broken | `task-reopen` → cascade re-verify dependents |
| **Plan adjustment** | Scope change mid-execution | `plan-adjust` → add/remove/update tasks |
| **Requirement evolution** | User invokes `/meridian` while run is active | Incremental decomposition into existing plan |
| **Eval-driven quality** | AI output accuracy below target | Analyze failure clusters → targeted fixes → re-eval loop |

## Memory System

Each LLM call is a new stateless process. Memory files maintain continuity:

```
.meridian/
├── state.json              ← Current run state
├── plan.json               ← Current task plan (structured criteria with kind)
├── eval_config.json        ← Eval command + accuracy targets (if applicable)
├── memory/                 ← Persists across runs
│   ├── project_brief.md    ← Anchor: goals + tech stack + constraints
│   ├── decisions_log.md    ← All confirmed decisions (never truncated)
│   ├── architecture.md     ← Current state (updated at checkpoints)
│   ├── completed_tasks.md  ← What's been built (auto-truncates old entries)
│   └── active_issues.md    ← Unresolved problems
├── verification/           ← Verification-layer-written acceptance scripts
│   └── verify_T3_e2e_1.py  ← Independent E2E test (NOT written by execution)
├── tasks/                  ← Current run task records
│   └── T1/                 ← Per-task: prompts, outputs, verdicts, evidence
└── runs/                   ← Archived completed runs
    └── run-20260428-.../   ← State + plan + tasks snapshot
```

**Context injection per layer:**
- **Strategic** (main agent): all memory — full project awareness
- **Execution** (subagent): brief + architecture + current task — enough to build
- **Verification** (subagent): criteria + code diff + will-build features list — deliberately minimal

## Harness (Node.js CLI)

The harness is a mechanical tool — zero LLM, deterministic pass/fail based on exit codes. It handles state management, memory, decisions, iterations, and baseline verification (execution's tests, lint, build, eval targets).

```bash
# State & runs
meridian-harness init | plan-set | validate-plan | run-status | run-complete
meridian-harness task-list | task-status | task-complete

# Iteration
meridian-harness task-reopen | plan-adjust
meridian-harness iteration-record | iteration-count

# Verification (baseline — execution's self-checks)
meridian-harness detect-tools | verify | eval-config

# Memory
meridian-harness memory-read | memory-update | memory-read-all | memory-resolve-issue

# Decisions
meridian-harness decision-add | decision-pending | decision-resolve
meridian-harness report-due | report-format

# Checkpoints
meridian-harness checkpoint-due
```

All commands output JSON. Zero runtime dependencies. 69 integration tests.

**Note:** The harness runs execution's own tests as a baseline check. Acceptance verification (E2E, real-data) is independently written and run by the verification subagent — not by the harness.

## Quick Start

```bash
# Install to Copilot CLI skills
git clone https://github.com/swenyang/meridian.git
cp -r meridian ~/.copilot/skills/meridian

# Then in any project directory (new Copilot CLI session):
/meridian build a REST API with user authentication
```

## Requirements

- Copilot CLI (or compatible coding agent with subagent support)
- Node.js >= 18
- No runtime dependencies, no build step

## License

MIT
