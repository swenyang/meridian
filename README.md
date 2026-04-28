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

## Architecture

```
                    ┌──────────────┐
                    │  Strategic    │
                    │  Layer        │ ← Project owner: expand, decompose,
                    │  (main agent) │   checkpoint, decide, backtrack
                    └──┬───────┬───┘
              task+context│       │code+criteria(trimmed)
                      ↓       ↓
               ┌──────┐     ┌──────┐
               │Execut.│     │Verif.│
               │      │     │      │ ← Also reviews requirement expansion
               └──┬───┘     └──┬───┘
                  │ code output │ findings
                  ↓            ↓
               ┌─────────────────┐
               │    Harness       │ ← Mechanical verifier (tests, lint, build)
               │    (Node.js CLI) │   State, memory, decisions, iterations
               └────────┬────────┘
                        │
                 PASS → next task
                 FAIL → iterate (escalation ladder)
```

**Data flow is a triangle. Information is deliberately asymmetric.**

The verification layer participates in two phases:
1. **Requirement expansion** — reviews the strategic layer's product spec for gaps
2. **Code verification** — reviews execution layer's code for bugs

Each time it's a fresh subagent instance with minimal context — it can't see reasoning, only output.

## Protocol

```
/meridian <requirement>
│
▼
Step 0 — Initialize
│  Detect project state:
│  ├── First time → create .meridian/
│  ├── Active run → append requirement to current plan (jump to Step 3)
│  └── Previous completed → archive old run, start fresh (memory preserved)
│  Detect codebase:
│  ├── Existing project → scan architecture/tests/conventions, store in memory
│  └── Empty project → proceed
│
▼
Step 1 — Requirement Expansion ··················· 👤 User checkpoint 1/2
│  1a. Strategic layer expands requirement (systems, user journeys, quality)
│  1b. Verification reviewer checks expansion (independent subagent, finds gaps)
│  1c. Iterate until reviewer satisfied (escalation ladder if stuck)
│  1d. Present scope to user (core features ✅ + optional features A/B)
│
▼
Step 2 — Design Phase ···························· 👤 User checkpoint 2/2
│  2a. Generate design artifacts (architecture, data model, API, UI flow...)
│  2b. Verification reviewer checks design (completeness, consistency)
│  2c. Present to user (🟢 high confidence / 🟡 review / 🔴 needs input)
│  → Confirmed design stored as binding contract in memory
│
▼ ─── Fully autonomous below — user only involved on escalation ───
│
Step 3 — Strategic Decomposition
│  Confirmed design → structured task list (JSON)
│  Integration checkpoints every 3-4 build tasks
│  Final task = end-to-end validation
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
│    5d. Mechanical verifier (tests/lint/build)     │
│    5e. Verification reviewer (isolated context)   │
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
│  │     eval → analyze failure clusters → targeted fix → re-eval
│  │     → loop until target accuracy or diminishing returns
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

Real projects aren't linear. Meridian supports 5 layers of iteration:

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
.meridian/memory/
├── project_brief.md      ← Anchor: never drifts, only user can change
├── decisions_log.md      ← All confirmed decisions (never truncated)
├── architecture.md       ← Current state (updated at checkpoints)
├── completed_tasks.md    ← What's been built (auto-truncates old entries)
└── active_issues.md      ← Unresolved problems
```

**Context injection per layer:**
- **Strategic** (main agent): all memory — full project awareness
- **Execution** (subagent): brief + architecture + current task — enough to build
- **Verification** (subagent): criteria + code diff only — deliberately minimal

## Harness (Node.js CLI)

The harness does everything that doesn't need an LLM:

```bash
# State
meridian-harness init | plan-set | task-list | task-status | task-complete

# Iteration
meridian-harness task-reopen | plan-adjust
meridian-harness iteration-record | iteration-count

# Verification
meridian-harness detect-tools | verify

# Memory
meridian-harness memory-read | memory-update | memory-read-all

# Decisions
meridian-harness decision-add | decision-pending | decision-resolve
meridian-harness report-due | report-format

# Checkpoints
meridian-harness checkpoint-due
```

All commands output JSON. Zero runtime dependencies. 40 integration tests.

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
