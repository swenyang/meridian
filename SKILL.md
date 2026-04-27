---
name: meridian
version: 0.1.0
description: "Meridian — Three-layer autonomous engineering framework. Strategic → Execution → Verification loop with mechanical quality gates. /meridian <task>"
---

# Meridian — Three-Layer Autonomous Engineering

One principle: **design for AI failure modes, not human org charts.**

You (the main agent reading this skill) ARE the Strategic Layer — the project owner. You decompose tasks, dispatch subagents for execution and verification, run mechanical checks via the harness, and manage the overall project lifecycle.

## Harness Setup

```bash
HARNESS="node $HOME/.copilot/skills/meridian/bin/meridian-harness.mjs"
MERIDIAN_DIR=".meridian"
```

All harness commands output JSON to stdout. Parse them to make decisions.

## Protocol: /meridian \<task\>

When the user invokes `/meridian <task>`, execute this protocol:

### Step 0 — Initialize

```bash
$HARNESS init --dir $MERIDIAN_DIR
```

### Step 1 — Requirement Expansion

Before decomposing into tasks, expand the user's brief requirement into a comprehensive product specification. A brief like "build a Tetris game" should produce a spec covering scoring, levels, preview, controls, persistence, polish — not just "falling blocks + line clearing."

#### 1a. Expand

As the strategic layer, use the `prompts/expansion.txt` template to think through:
- Core systems the product needs
- Complete user journeys (first use → core workflow → edge cases → exit → return)
- Industry standards (what a modern 2026 version looks like)
- Quality attributes that matter for this product

Output: a structured JSON product specification.

#### 1b. Adversarial Review of Expansion

Spawn a **general-purpose subagent** with the `prompts/expansion-review.txt` template. This subagent gets:
- The original user requirement
- Your expansion output
- Nothing else (no knowledge of your reasoning process)

The adversarial reviewer will find gaps, blind spots, overscoped features, and missing edge cases.

#### 1c. Iterate Until Satisfied

#### 1c. Iterate Until Satisfied

If the reviewer returns `satisfied: false`:
1. Read their gaps and suggestions
2. Address critical/important gaps — revise or extend the expansion
3. Spawn a new adversarial review subagent with the revised expansion
4. Repeat until `satisfied: true`

If progress stalls (reviewer keeps finding new gaps after multiple rounds), apply the same escalation ladder as task execution:
- **Rethink**: step back and reconsider the product concept from a different angle
- **Simplify**: reduce scope to a tighter MVP, move contested features to "phase 2"
- **Escalate**: present the remaining disagreement to the user as a scope choice

#### 1d. Present to User

Format the finalized expansion as a scope confirmation — **选择题, not open-ended**:

```
[Meridian] 📋 Scope confirmation for: "build a Tetris game"

Core features (will build):
  ✅ Grid rendering + piece movement + rotation
  ✅ Collision detection + line clearing
  ✅ Scoring system with levels and speed progression
  ✅ Next piece preview + hold piece
  ✅ Ghost piece (landing preview)
  ✅ Game over detection + restart
  ✅ High score persistence (local storage)
  ✅ Keyboard controls + pause/resume

Optional features:
  → [A] Include sound effects (recommended)
  → [B] Skip sound effects

  → [A] Include mobile touch controls (recommended)
  → [B] Desktop only

  → [A] Include dark/light theme
  → [B] Single theme

Reply with choices (e.g., "A A B") or Enter for all recommended.
Reply "add: <feature>" to add something I missed.
Reply "skip: <feature>" to remove something.
```

After user confirms → proceed to Step 2 (Decomposition).

### Step 2 — Strategic Decomposition

You are the strategic layer. Read the user's requirement and decompose it into a structured task plan.

**Think through:**
1. What is the user actually asking for? What are the implicit requirements?
2. What technology stack makes sense? (If the choice is non-obvious or irreversible, add to decisions_pending)
3. Break into 5-15 module-level tasks, ordered by dependency
4. Each task needs concrete, mechanically verifiable acceptance criteria — not "code is good" but "running `npm test` passes" or "file src/auth.ts exports function `login`"

**Output a JSON plan** and save to a temp file, then store via harness:

```json
{
  "project": {
    "name": "project-name",
    "description": "one-line summary",
    "tech_stack": "Python + FastAPI + SQLite"
  },
  "tasks": [
    {
      "id": "T1",
      "title": "Project initialization",
      "description": "Create project structure, pyproject.toml, basic directory layout",
      "acceptance_criteria": [
        "pyproject.toml exists with project metadata",
        "src/ directory created with __init__.py",
        "README.md exists"
      ],
      "dependencies": [],
      "priority": 1
    }
  ],
  "decisions_pending": [
    {
      "id": "D1",
      "question": "Database choice",
      "options": [
        { "id": "A", "choice": "SQLite", "pros": "zero config", "cons": "no concurrent writes", "recommendation": true },
        { "id": "B", "choice": "PostgreSQL", "pros": "production-grade", "cons": "needs deployment" }
      ],
      "severity": "irreversible",
      "blockingTasks": ["T3"]
    }
  ]
}
```

Save the plan:
```bash
# Write plan JSON to .meridian/plan.json then:
$HARNESS plan-set --plan .meridian/plan.json --dir $MERIDIAN_DIR
```

Update project memory:
```bash
$HARNESS memory-update --file project_brief --content "<project brief based on requirement + tech stack + constraints>" --dir $MERIDIAN_DIR
$HARNESS memory-update --file architecture --content "<initial architecture overview>" --dir $MERIDIAN_DIR
```

### Step 3 — Handle Decisions

Register any pending decisions:
```bash
$HARNESS decision-add --id D1 --question "Database choice" --options '<json>' --severity irreversible --dir $MERIDIAN_DIR
```

Check if report is due:
```bash
$HARNESS report-due --dir $MERIDIAN_DIR
```

If `due: true` and `immediate: true` (irreversible decision):
- Run `$HARNESS report-format --dir $MERIDIAN_DIR` to get the formatted report
- Print the report to the user
- Wait for user input (e.g., "1A 2B" or just Enter for all recommended)
- Resolve each decision: `$HARNESS decision-resolve --id D1 --choice A --dir $MERIDIAN_DIR`
- Update decisions_log memory: `$HARNESS memory-update --file decisions_log --append "..." --dir $MERIDIAN_DIR`

If `due: true` but `immediate: false` (reversible only, batched):
- Use recommended options and continue
- Accumulate until report is due with 3+ items, then batch-ask user

### Step 4 — Task Execution Loop

For each task in dependency order:

#### 3a. Check if task is ready
All dependencies must be done. Check via `$HARNESS task-status --task <dep_id> --dir $MERIDIAN_DIR`.

#### 3b. Refine the task
As the strategic layer, refine the coarse task into specific implementation instructions. Read current memory to understand what's been built:

```bash
$HARNESS memory-read --file project_brief --dir $MERIDIAN_DIR
$HARNESS memory-read --file architecture --dir $MERIDIAN_DIR
$HARNESS memory-read --file completed_tasks --dir $MERIDIAN_DIR
```

Create a detailed execution prompt by filling in the template from `prompts/execution.txt` with:
- `{project_brief}`: from memory
- `{architecture}`: from memory
- `{relevant_decisions}`: from decisions_log
- `{task_description}`: the refined task instructions
- `{acceptance_criteria}`: from the plan
- `{dependency_summaries}`: summaries of completed dependency tasks
- `{iteration_context}`: empty on first attempt

#### 3c. Dispatch Execution Subagent

Spawn a **general-purpose subagent** with the execution prompt. This subagent has its own isolated context — it cannot see the strategic layer's reasoning.

```
Task tool: agent_type="general-purpose"
prompt = <the filled execution prompt>
```

The subagent will:
1. Read the task and acceptance criteria
2. Write code, create files, modify existing files
3. Run any available tests
4. Report what it did

#### 3d. Collect Evidence & Run Mechanical Verification

After the execution subagent completes:

```bash
$HARNESS verify --dir $MERIDIAN_DIR
```

This auto-detects and runs tests/lint/build, checks git evidence, returns a verdict JSON.

#### 3e. Dispatch Verification Subagent (Adversarial Review)

Spawn another **general-purpose subagent** with the adversarial prompt. This subagent gets **minimal context** — only the code changes and acceptance criteria. It CANNOT see the execution subagent's reasoning or approach.

Prepare the adversarial prompt from `prompts/adversarial.txt`:
- `{acceptance_criteria}`: from the plan
- `{code_changes}`: use `git diff` output or list changed files with content
- `{architecture_structure}`: directory structure only (not implementation details)

```
Task tool: agent_type="general-purpose"
prompt = <the filled adversarial prompt>
```

Parse the subagent's JSON output as findings array.

#### 3f. Synthesize Verdict

Combine mechanical verification and adversarial review:

```
IF mechanical verdict is FAIL → overall FAIL
ELSE IF adversarial findings contain any "critical" severity → overall FAIL
ELSE → overall PASS
```

#### 3g. Handle Verdict

**On PASS:**
```bash
$HARNESS task-complete --task <id> --summary "<what was built>" --dir $MERIDIAN_DIR
$HARNESS memory-update --file completed_tasks --append "\n## <task_id>: <title>\n<summary of what was built>\n" --dir $MERIDIAN_DIR
$HARNESS memory-update --file architecture --content "<updated architecture based on what was built>" --dir $MERIDIAN_DIR
```

**On FAIL:**
```bash
$HARNESS iteration-record --task <id> --verdict FAIL --findings "<combined findings>" --strategy retry --dir $MERIDIAN_DIR
```

The harness returns an `action` field telling you what to do next:

**`action: "retry"`** — Still have attempts left. Go back to Step 3c with iteration context (fill `prompts/iteration-fix.txt` with findings).

**`action: "rethink"`** — 3 retries failed with the same approach. As the strategic layer, you must:
1. Analyze the failure pattern across all 3 attempts — is it the same error repeating? or different errors each time?
2. Consider: is the task too vague? Is there a dependency that wasn't captured? Is the approach fundamentally wrong?
3. Re-decompose the task with a different implementation strategy
4. Record the new attempt with `--strategy rethink`

**`action: "split"`** — Rethinking didn't help. Split this task into 2-3 smaller subtasks:
1. Analyze what part of the task keeps failing
2. Create new subtasks in the plan (add via harness)
3. Mark the original task as superseded
4. Execute the subtasks individually

**`action: "skip_and_revisit"`** — Splitting didn't help. Skip this task:
1. Move to the next independent task
2. After other tasks complete, the context may have changed enough to unblock this one
3. Come back later with fresh context

**`action: "escalate"`** — All recovery strategies exhausted. NOW escalate to user:
1. Present a summary of what was tried and why each approach failed
2. Give the user **options**, not open-ended questions:
   ```
   [Meridian] 🔴 Task T3 blocked after exhausting all strategies
   
   Tried: 3 retries → rethink → split → skip
   Core issue: <your analysis of the root cause>
   
   → [A] Simplify: reduce scope of this task to <specific reduction>
   → [B] Skip: remove this feature entirely, adjust downstream tasks
   → [C] Manual: I'll provide specific guidance for the implementation
   ```

### Step 5 — Checkpoint

After each task completes (PASS), check if a checkpoint is due:

```bash
$HARNESS checkpoint-due --dir $MERIDIAN_DIR
```

If `due: true`, perform a strategic review:

1. Read all memory files (`$HARNESS memory-read-all --dir $MERIDIAN_DIR`)
2. Review the overall project state:
   - Are completed tasks consistent with each other?
   - Is the architecture evolving correctly?
   - Are there new risks or decisions needed?
   - Does the remaining plan still make sense?

3. **Task backtracking (Layer 2):** If a completed task's output is inconsistent or broken:
   ```bash
   $HARNESS task-reopen --task T2 --reason "API interface conflicts with T4 implementation" --dir $MERIDIAN_DIR
   ```
   This reopens T2 (back to pending) and automatically marks any tasks that depend on T2 and are already done as `reverify`. Those reverify tasks will re-run through the verification loop (not full re-execution — just re-verify with the updated dependency).

4. **Plan adjustment (Layer 3):** If the remaining plan needs changes:
   ```bash
   $HARNESS plan-adjust --adjustments '[
     {"action":"add","task":{"id":"T6","title":"Add rate limiting","description":"...","acceptance_criteria":["..."],"dependencies":["T3"]}},
     {"action":"remove","id":"T5"},
     {"action":"update","id":"T4","fields":{"description":"Updated scope...","acceptance_criteria":["new criteria"]}}
   ]' --dir $MERIDIAN_DIR
   ```
   Supports three actions:
   - `add` — insert a new task with full spec
   - `remove` — remove a pending task (cannot remove completed tasks)
   - `update` — modify title/description/criteria/dependencies of an existing task

5. If new decisions found, add them via `$HARNESS decision-add`
6. Update architecture memory if needed
7. Record checkpoint: update `_last_checkpoint_at` in state

Also check for pending decision reports:
```bash
$HARNESS report-due --dir $MERIDIAN_DIR
```

If due, format and present to user.

### Step 5b — Handle reverify tasks

After a checkpoint that reopened tasks, some downstream tasks may be in `reverify` status. For each:

1. Re-run the verification loop (Step 3d-3f) against the current code — the dependency was changed, need to confirm this task's output is still valid
2. If PASS → mark back to `done`
3. If FAIL → treat as a normal failure (enter the execution-verify iteration loop)

### Step 5c — Requirement Evolution (Layer 4)

If the user says `/meridian add <new requirement>` mid-execution:

1. Read current project state (all memory files)
2. Decompose the new requirement **in context of what's already built**
3. Use `$HARNESS plan-adjust` to add new tasks with correct dependencies on existing tasks
4. Continue the task execution loop — new tasks will be picked up in dependency order

### Step 6 — Status Notifications

After each significant event, print a one-line status to the user:

```
[Meridian] ✅ T1 complete | ⏳ T2 executing | Progress 1/8
[Meridian] ❌ T2 FAIL (attempt 1/3) — retrying with findings
[Meridian] 🔄 Checkpoint: all on track, architecture updated
[Meridian] ↩️ Checkpoint: reopened T2, T4-T5 need re-verify
[Meridian] ➕ Added 2 tasks from new requirement, total now 10
[Meridian] 🔴 T3 blocked after all strategies — need your input
```

### Step 7 — Completion

When all tasks are done:

1. Final checkpoint — verify overall consistency
2. Print final summary:
   ```
   [Meridian] ✅ Project complete!
   Tasks: 8/8 done | Iterations: 3 total | Decisions: 2 resolved
   
   Built: <project description>
   Key files: <list main entry points>
   Run: <how to start/test the project>
   ```

## Anti-Patterns

| Temptation | Reality | Do instead |
|---|---|---|
| Skip verification for "simple" tasks | Simple tasks have bugs too | Always run full verification loop |
| Give adversarial agent execution context | Defeats isolation purpose | Only give code + criteria |
| Accept "looks correct" from execution | It probably didn't run it | Require mechanical evidence |
| Ask user about every small decision | Breaks flow, frustrates user | Batch reversible decisions, only interrupt for irreversible |
| Skip checkpoint after few tasks | Drift accumulates silently | Always check when harness says due |
