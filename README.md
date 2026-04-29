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

## Core Principles

1. **The agent that does the work never evaluates it.** Execution and verification are always separate subagents with isolated contexts.
2. **Mechanical verdicts override LLM opinions.** Tool output > verification review findings > self-report. Eval metrics below target = FAIL regardless of passing tests.
3. **Real data, not synthetic data.** Eval against real-world data, not self-generated toy examples.
4. **Core before chrome.** Core function must work on real data before ANY auxiliary features (CLI, batch, caching, formatters). Block auxiliary tasks until core passes real-data eval.
5. **Minimize user interruptions.** Only ask for: irreversible decisions, scope confirmation, design confirmation, escalations after all recovery strategies exhausted. Never ask "should I start?" — just start.
6. **Scope changes are user decisions.** Never silently reduce scope. Core technical approach = always will-build, never optional.

## Architecture

```
                    ┌──────────────┐
                    │  Strategic    │
                    │  Layer        │ ← Project owner: expand, design,
                    │  (main agent) │   decompose, checkpoint, decide
                    └──┬───────┬───┘
           task+context│       │code+criteria(trimmed)
                      ↓       ↓
               ┌──────┐     ┌──────┐
               │Execut.│     │Verif.│
               │      │     │      │ ← Reviews expansion, design, AND code
               └──┬───┘     └──┬───┘
                  │ code output │ findings
                  ↓            ↓
               ┌─────────────────┐
               │    Harness       │ ← Mechanical verifier (tests, lint, build)
               │    (Node.js CLI) │   + Eval metrics check (accuracy targets)
               │                 │   State, memory, decisions, iterations
               └────────┬────────┘
                        │
                 PASS → next task
                 FAIL → iterate (escalation ladder)
```

**Data flow is a triangle. Information is deliberately asymmetric.** Strategic sees everything. Execution sees task + project context. Verification sees only code + criteria — never execution's reasoning.

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
Step 1 — Requirement Expansion ·················· 👤 User checkpoint 1/2
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
Step 2 — Design Phase ··························· 👤 User checkpoint 2/2
│  2a. Generate design artifacts (architecture, data model, API, UI flow...)
│      Confidence levels: 🟢 proceed / 🟡 review / 🔴 needs input
│      External dependencies + eval strategy required
│  2b. Verification reviewer checks design
│  2c. Present design to user (only 🟡🔴 items need attention)
│  → Confirmed design stored as binding contract
│
▼
Step 2.5 — Core Hypothesis Validation
│  Validate core technical approach on real data BEFORE building infrastructure
│  Catch fundamental flaws when they're cheap to fix
│
▼ ─── Fully autonomous below — user only involved on escalation ───
│
Step 3 — Strategic Decomposition
│  Confirmed design → structured task list
│  Integration checkpoints every 3-4 tasks
│  Eval dataset as first-class early task (real data, 50+ files)
│  Core-first ordering: core → auxiliary → polish
│  Final task = end-to-end validation
│  Print plan, start executing immediately (no "ready?" prompt)
│
Step 4 — Handle Decisions
│  Irreversible → block immediately, ask user (multiple-choice)
│  Reversible → use recommended, batch 3+ then confirm
│
Step 5 — Task Execution Loop ←────────────────────┐
│  for each task:                                  │
│    5a. Check dependencies ready                  │
│    5b. Strategic layer refines task               │
│    5c. Execution subagent writes code (isolated)  │
│        └─ Must E2E verify: launch + use feature  │
│        └─ Will-build features: real call, not stub│
│    5d. Mechanical verifier:                       │
│        tests + lint + build + eval targets        │
│    5e. Verification reviewer (isolated context)   │
│        └─ Will-build usage check: dead code = FAIL│
│    5f. Synthesize verdict:                        │
│        mechanical FAIL → FAIL                    │
│        + reviewer critical → FAIL                │
│        all clear → PASS                          │
│    5g. Handle verdict:                            │
│        PASS → update memory, next task            │
│        FAIL → escalation ladder:                 │
│          retry(3x) → rethink → split             │
│          → skip → escalate to user               │
│        Integration FAIL → diagnose root cause     │
│          → task-reopen → cascade reverify ────────┘
│
Step 6 — Checkpoint (every N tasks)
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
Step 7 — Status Notifications
│  [Meridian] ✅ T1 complete | ⏳ T2 executing | Progress 1/8
│  [Meridian] ❌ T2 FAIL (attempt 1/3) — retrying
│  [Meridian] 🔴 T3 blocked — escalating with analysis + options
│
Step 8 — Completion
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
├── plan.json               ← Current task plan
├── eval_config.json        ← Eval command + accuracy targets (if applicable)
├── memory/                 ← Persists across runs
│   ├── project_brief.md    ← Anchor: goals + tech stack + constraints
│   ├── decisions_log.md    ← All confirmed decisions (never truncated)
│   ├── architecture.md     ← Current state (updated at checkpoints)
│   ├── completed_tasks.md  ← What's been built (auto-truncates old entries)
│   └── active_issues.md    ← Unresolved problems
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

The harness does everything that doesn't need an LLM:

```bash
# State & runs
meridian-harness init | plan-set | run-status | run-complete
meridian-harness task-list | task-status | task-complete

# Iteration
meridian-harness task-reopen | plan-adjust
meridian-harness iteration-record | iteration-count

# Verification
meridian-harness detect-tools | verify | eval-config

# Memory
meridian-harness memory-read | memory-update | memory-read-all | memory-resolve-issue

# Decisions
meridian-harness decision-add | decision-pending | decision-resolve
meridian-harness report-due | report-format

# Checkpoints
meridian-harness checkpoint-due
```

All commands output JSON. Zero runtime dependencies. 49 integration tests.

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
