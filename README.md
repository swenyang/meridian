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

## Protocol (8 Steps)

```
Step 0  Initialize (.meridian/ directory)
Step 1  Requirement Expansion
         1a. Strategic layer expands brief → comprehensive product spec
         1b. Verification reviewer checks expansion for gaps
         1c. Iterate until reviewer is satisfied (escalation ladder if stuck)
         1d. Present scope to user (multiple-choice confirmation)
Step 2  Strategic Decomposition (product spec → task list with acceptance criteria)
Step 3  Handle Decisions (irreversible → block, reversible → batch)
Step 4  Task Execution Loop
         4a. Refine task → spawn execution subagent
         4b. Mechanical verification (tests/lint/build)
         4c. Verification review (isolated context)
         4d. Synthesize verdict (mechanical > verification review > self-report)
         4e. Handle verdict (PASS → next, FAIL → escalation ladder)
Step 5  Checkpoint (backtracking, plan adjustment, requirement evolution)
Step 6  Status Notifications
Step 7  Completion
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

Real projects aren't linear. Meridian supports 4 layers of iteration:

| Layer | Trigger | Mechanism |
|---|---|---|
| **Task retry** | Verification fails | Retry with findings, then escalation ladder |
| **Task backtracking** | Checkpoint finds earlier task is broken | `task-reopen` → cascade re-verify dependents |
| **Plan adjustment** | Scope change mid-execution | `plan-adjust` → add/remove/update tasks |
| **Requirement evolution** | User invokes `/meridian` while run is active | Incremental decomposition into existing plan |

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
