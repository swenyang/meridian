---
name: meridian
version: 0.1.0
description: "Meridian — Three-layer autonomous engineering framework. Strategic → Execution → Verification loop with mechanical quality gates. /meridian <task>"
---

# Meridian — Three-Layer Autonomous Engineering

One principle: **design for AI failure modes, not human org charts.**

You (the main agent reading this skill) ARE the Strategic Layer — the project owner. You decompose tasks, dispatch subagents for execution and verification, run mechanical checks via the harness, and manage the overall project lifecycle.

## Core Principles

1. **The agent that does the work never evaluates it.** Execution and verification are always separate subagents with isolated contexts.
2. **Mechanical verdicts override LLM opinions.** Tool output > verification review findings > self-report.
3. **Minimize user interruptions.** You are the project owner — make decisions yourself whenever possible. Only involve the user for:
   - Irreversible decisions (tech stack, database, core architecture) — present immediately with options
   - Reversible decisions — batch 3+ before asking, use your recommended option in the meantime
   - Escalations after ALL recovery strategies are exhausted (retry → rethink → split → skip)
   - Scope confirmation (once, after requirement expansion)
   
   If you find yourself about to ask the user something, ask: "Can I make this decision myself and move on?" If yes, do it and log it in decisions_log.
4. **Scope changes are user decisions.** Never silently reduce scope. If something feels too ambitious, present it as a choice — don't cut it.

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

The harness returns a `mode` field:

- **`mode: "new"`** — First time. Proceed to Step 0a/0b (project detection).
- **`mode: "active"`** — A run is already in progress. The user is adding a new requirement to an ongoing project. Read current memory, add the new requirement to the existing plan via `plan-adjust`, and continue the task loop from where it left off.
- **`mode: "new_after_archive"`** — Previous run completed and has been archived. Memory (project_brief, architecture, completed_tasks, decisions_log) is preserved from the last run. Start a new run with this context — the strategic layer already knows the project.

**Detect project context:** Check if you're working in an existing codebase or starting fresh.

**Existing project indicators:** source files already exist, git history present, package.json/pyproject.toml with dependencies, README with docs.

#### 0a. If EXISTING project:

Before doing anything else, build a comprehensive understanding of the codebase:

1. **Scan the project structure** — read directory tree, key config files (package.json, pyproject.toml, etc.)
2. **Read entry points** — main files, index files, app bootstrapping code
3. **Read existing tests** — understand what's already tested and the testing patterns used
4. **Read existing docs** — README, CONTRIBUTING, architecture docs if any
5. **Identify conventions** — naming patterns, file organization, import style, error handling patterns
6. **Run existing tests** — `$HARNESS verify --dir $MERIDIAN_DIR` to establish a baseline (all tests should pass BEFORE you start)

Store this context in memory:
```bash
$HARNESS memory-update --file project_brief --content "<existing project summary: what it does, tech stack, key dependencies, conventions>" --dir $MERIDIAN_DIR
$HARNESS memory-update --file architecture --content "<current architecture: directory structure, module responsibilities, data flow, key interfaces>" --dir $MERIDIAN_DIR
```

**Critical rule for existing projects:** The acceptance criteria for EVERY task must include "all existing tests still pass." You are adding to a working system — do not break what already works.

#### 0b. If NEW project:

No codebase to scan — proceed directly to Step 1.

### Step 1 — Requirement Expansion

Before decomposing into tasks, expand the user's brief requirement into a comprehensive product specification. A brief like "build a Tetris game" should produce a spec covering scoring, levels, preview, controls, persistence, polish — not just "falling blocks + line clearing."

#### 1a. Expand

As the strategic layer, use the Appendix A (Expansion Prompt) template to think through:
- Core systems the product needs
- Complete user journeys (first use → core workflow → edge cases → exit → return)
- Industry standards (what a modern 2026 version looks like)
- Quality attributes that matter for this product

Output: a structured JSON product specification.

#### 1b. Verification Review of Expansion

Spawn a **general-purpose subagent** with the Appendix B (Expansion Verification Review) template. This subagent gets:
- The original user requirement
- Your expansion output
- Nothing else (no knowledge of your reasoning process)

The verification reviewer will find gaps, blind spots, overscoped features, and missing edge cases.

#### 1c. Iterate Until Satisfied

#### 1c. Iterate Until Satisfied

If the reviewer returns `satisfied: false`:
1. Read their gaps and suggestions
2. Address critical/important gaps — revise or extend the expansion
3. Spawn a new verification review subagent with the revised expansion
4. Repeat until `satisfied: true`

If progress stalls (reviewer keeps finding new gaps after multiple rounds), apply the same escalation ladder as task execution:
- **Rethink**: step back and reconsider the product concept from a different angle
- **Simplify**: reduce scope to a tighter MVP, move contested features to "phase 2"
- **Escalate**: present the remaining disagreement to the user as a scope choice

#### 1d. Present to User

Format the finalized expansion as a scope confirmation — **选择题, not open-ended**:

```
[Meridian] 📋 Scope confirmation for: "build a Tetris game"

Will build:
  ✅ Grid rendering + piece movement + rotation
  ✅ Collision detection + line clearing
  ✅ Scoring system with levels and speed progression
  ✅ Next piece preview + hold piece
  ✅ Ghost piece (landing preview)
  ✅ Game over detection + restart
  ✅ High score persistence (local storage)
  ✅ Keyboard controls + pause/resume

Scope questions (your call):
  → [A] Include sound effects (recommended)
  → [B] Skip sound effects

  → [A] Include mobile touch controls (recommended)
  → [B] Desktop only

Reply with choices (e.g., "A A") or Enter for all recommended.
Reply "add: <feature>" to add something I missed.
Reply "skip: <feature>" to remove something from will-build.
```

After user confirms → proceed to Step 2 (Design).

### Step 2 — Design Phase

**Purpose:** Produce concrete design artifacts BEFORE implementation starts. These artifacts become the binding contract that guides all autonomous execution. Getting the design right here prevents "built the wrong thing" failures that no amount of code-level verification can catch.

#### 2a. Generate Design

Use the Appendix C (Design Prompt) template. The strategic layer produces design artifacts appropriate for the project type — architecture, data model, API contract, UI flow, etc.

Each artifact is marked with a confidence level:
- 🟢 **High confidence** — AI proceeds without review
- 🟡 **Review recommended** — user should glance, alternatives provided
- 🔴 **Needs input** — can't determine without user preference

#### 2b. Verification Review of Design

Spawn a verification reviewer subagent with Appendix D (Design Verification Review). The reviewer checks:
- Can you actually build the scope from this design alone?
- Do the artifacts agree with each other?
- Are the contracts specific enough to implement without guessing?
- Are the confidence levels honest?

Iterate until the reviewer is satisfied (same escalation ladder as requirement expansion).

#### 2c. Present Design to User

Format the design for review — **highlight 🟡 and 🔴 items, minimize noise from 🟢 items:**

```
[Meridian] 🏗️ Design Review

🟢 High confidence (will proceed unless you object):
  • File structure: src/{api,models,services,utils}/
  • Error handling: custom exception classes + global handler
  • Config: environment variables via python-dotenv

🟡 Review recommended:
  1. Data Model:
     → [Current] PostgreSQL with SQLAlchemy ORM
     → [Alt] SQLite for simpler deployment
  2. Auth approach:
     → [Current] JWT with refresh tokens
     → [Alt] Session-based cookies

🔴 Need your input:
  3. API style:
     → [A] REST with OpenAPI spec
     → [B] GraphQL
     → [C] gRPC

Reply: 1A 2A 3A (or Enter for all current/recommended)
```

After user confirms → store ALL design artifacts in memory:
```bash
$HARNESS memory-update --file architecture --content "<full design document: all artifacts consolidated>" --dir $MERIDIAN_DIR
```

This architecture file now becomes the **binding contract** for all execution. Every task must implement against this design, and every verification checks conformance to it.

### Step 3 — Strategic Decomposition

You are the strategic layer. Read the **confirmed design** and decompose it into a structured task plan.

**Think through:**
1. What is the user actually asking for? What are the implicit requirements?
2. What technology stack makes sense? (If the choice is non-obvious or irreversible, add to decisions_pending)
3. Break into 5-15 module-level tasks, ordered by dependency
4. Each task needs concrete, mechanically verifiable acceptance criteria — not "code is good" but "running `npm test` passes" or "file src/auth.ts exports function `login`"
5. **Integration checkpoints are mandatory.** After every 3-4 build tasks, insert an integration task that verifies the built modules work together end-to-end. Its acceptance criteria must include launching the actual product and exercising the core flow.
6. **The final task must be end-to-end validation** — not another feature, but "launch the product and verify the complete user journey works." Acceptance criteria: the product starts, the core workflow executes successfully, and the output is what the user asked for.

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

### Step 4 — Handle Decisions

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

### Step 5 — Task Execution Loop

For each task in dependency order:

#### 5a. Check if task is ready
All dependencies must be done. Check via `$HARNESS task-status --task <dep_id> --dir $MERIDIAN_DIR`.

#### 5b. Refine the task
As the strategic layer, refine the coarse task into specific implementation instructions. Read current memory to understand what's been built:

```bash
$HARNESS memory-read --file project_brief --dir $MERIDIAN_DIR
$HARNESS memory-read --file architecture --dir $MERIDIAN_DIR
$HARNESS memory-read --file completed_tasks --dir $MERIDIAN_DIR
```

Create a detailed execution prompt by filling in the template from Appendix E (Execution Subagent Prompt) with:
- `{project_brief}`: from memory
- `{architecture}`: from memory
- `{relevant_decisions}`: from decisions_log
- `{task_description}`: the refined task instructions
- `{acceptance_criteria}`: from the plan
- `{dependency_summaries}`: summaries of completed dependency tasks
- `{iteration_context}`: empty on first attempt

#### 5c. Dispatch Execution Subagent

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

#### 5d. Collect Evidence & Run Mechanical Verification

After the execution subagent completes:

```bash
$HARNESS verify --dir $MERIDIAN_DIR
```

This auto-detects and runs tests/lint/build, checks git evidence, returns a verdict JSON.

#### 5e. Dispatch Verification Reviewer

Spawn another **general-purpose subagent** with the verification review prompt. This subagent gets **minimal context** — only the code changes and acceptance criteria. It CANNOT see the execution subagent's reasoning or approach.

Prepare the verification review prompt from Appendix F (Verification Review Prompt):
- `{acceptance_criteria}`: from the plan
- `{code_changes}`: use `git diff` output or list changed files with content
- `{architecture_structure}`: directory structure only (not implementation details)

```
Task tool: agent_type="general-purpose"
prompt = <the filled verification review prompt>
```

Parse the subagent's JSON output as findings array.

#### 5f. Synthesize Verdict

Combine mechanical verification and verification review:

```
IF mechanical verdict is FAIL → overall FAIL
ELSE IF verification review findings contain any "critical" severity → overall FAIL
ELSE → overall PASS
```

#### 5g. Handle Verdict

**On PASS:**
```bash
$HARNESS task-complete --task <id> --summary "<what was built>" --dir $MERIDIAN_DIR
$HARNESS memory-update --file completed_tasks --append "\n## <task_id>: <title>\n<summary of what was built>\n" --dir $MERIDIAN_DIR
$HARNESS memory-update --file architecture --content "<updated architecture based on what was built>" --dir $MERIDIAN_DIR
```

**On FAIL (regular build task):**
```bash
$HARNESS iteration-record --task <id> --verdict FAIL --findings "<combined findings>" --strategy retry --dir $MERIDIAN_DIR
```

The harness returns an `action` field telling you what to do next (see escalation ladder below).

**On FAIL (integration checkpoint or E2E validation task):**

Integration failures are different from regular task failures — the problem usually isn't in the integration task itself, but in an **earlier task's output**. Follow this diagnosis protocol:

1. **Analyze the failure evidence** — read the mechanical verifier output and verification review findings. What specifically broke? A missing function? An incompatible interface? A runtime error?

2. **Trace back to the root cause task** — which earlier task produced the broken output? Look at:
   - Error messages (file paths, function names point to the source)
   - The acceptance criteria of earlier tasks — were they too loose? Did they pass individually but not account for integration?

3. **Reopen the root cause task:**
   ```bash
   $HARNESS task-reopen --task <root_cause_id> --reason "Integration test failed: <specific issue>" --dir $MERIDIAN_DIR
   ```
   This automatically marks downstream dependent tasks as `reverify`.

4. **Update the reopened task's acceptance criteria** — add integration-aware criteria so the same gap doesn't recur. Use `plan-adjust`:
   ```bash
   $HARNESS plan-adjust --adjustments '[{"action":"update","id":"<root_cause_id>","fields":{"acceptance_criteria":["<original criteria>","<new integration-aware criterion>"]}}]' --dir $MERIDIAN_DIR
   ```

5. **Re-execute from the reopened task** — the task loop will pick it up (status is `pending` again), re-run execution + verification, then the `reverify` tasks will re-verify with the fixed dependency, and finally the integration checkpoint will re-run.

6. **If you can't identify which task is at fault** — this is a sign the decomposition was too coarse. Use `plan-adjust` to insert a new diagnostic task between the suspected modules, or split the integration checkpoint into smaller integration tests.

**`action: "retry"`** — Still have attempts left. Go back to Step 3c with iteration context (fill Appendix G (Iteration Fix Context) with findings).

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

### Step 6 — Checkpoint
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

### Step 6b — Handle reverify tasks

After a checkpoint that reopened tasks, some downstream tasks may be in `reverify` status. For each:

1. Re-run the verification loop (Step 3d-3f) against the current code — the dependency was changed, need to confirm this task's output is still valid
2. If PASS → mark back to `done`
3. If FAIL → treat as a normal failure (enter the execution-verify iteration loop)

### Step 6c — Requirement Evolution (Layer 4)

If the user invokes `/meridian <new requirement>` while a run is active (detected via `mode: "active"` in Step 0):

1. Read current project state (all memory files)
2. Decompose the new requirement **in context of what's already built**
3. Use `$HARNESS plan-adjust` to add new tasks with correct dependencies on existing tasks
4. Continue the task execution loop — new tasks will be picked up in dependency order

### Step 6d — Eval-Driven Quality Loop (Layer 5, AI/ML projects)

For projects that involve AI/LLM output (parsing, classification, generation, extraction), code that compiles and tests that pass are NOT enough. The AI output must be **measurably good**. This step runs after the core AI functionality is built and the eval task is complete.

**When to trigger:** After an eval/benchmark task completes, check the results:

```bash
$HARNESS memory-read --file active_issues --dir $MERIDIAN_DIR
# Look for eval results: accuracy metrics, failure cases
```

**The eval improvement loop:**

```
┌─────────────────────────────────────────────┐
│ 1. Run eval against test dataset            │
│    → accuracy: 62%, 15/40 cases failing     │
│                                             │
│ 2. Analyze failures (strategic layer)       │
│    → cluster by failure type:               │
│      - 8 cases: merged headers not detected │
│      - 4 cases: multi-table sheets confused │
│      - 3 cases: CJK encoding issues         │
│                                             │
│ 3. Prioritize: fix biggest cluster first    │
│    → create improvement task:               │
│      "Fix merged header detection"          │
│      with specific failing cases as         │
│      acceptance criteria                    │
│                                             │
│ 4. Execute improvement → verify → re-eval   │
│    → accuracy: 78%, 9/40 cases failing      │
│                                             │
│ 5. Loop: next failure cluster               │
│    → repeat until target accuracy met       │
│      or diminishing returns                 │
└─────────────────────────────────────────────┘
```

**Protocol:**

1. **Read eval results** — the eval task should produce a structured report: overall accuracy, per-case pass/fail, failure reasons.

2. **Analyze failure clusters** — as the strategic layer, group failures by root cause. Don't fix them one-by-one — find patterns:
   - Same type of input causing failures? (e.g., merged cells, multi-table, CJK)
   - Same component failing? (e.g., prompt wording, schema parser, type conversion)
   - Same kind of error? (e.g., missing fields, wrong types, hallucinated data)

3. **Create targeted improvement tasks** via `plan-adjust`:
   - Each task targets ONE failure cluster
   - Acceptance criteria = the specific failing cases must pass
   - Include "existing passing cases must not regress" as criteria

4. **Execute improvement** — normal task execution loop (Step 5)

5. **Re-run eval** — after improvement task passes, re-run the full eval:
   - Did the target cases improve?
   - Did any previously passing cases regress?
   - What's the new overall accuracy?

6. **Record progress** — update memory with eval history:
   ```bash
   $HARNESS memory-update --file active_issues --append "
   ## Eval Round 2: accuracy 62% → 78%
   Fixed: merged header detection (8 cases)
   Remaining: multi-table (4), CJK (3)
   " --dir $MERIDIAN_DIR
   ```

7. **Loop or stop:**
   - Target accuracy not met + clear failure clusters remain → loop back to step 2
   - Target accuracy met → move on
   - Diminishing returns (< 2% improvement per round) → escalate to user with analysis:
     ```
     [Meridian] 📊 Eval plateau at 85% accuracy
     Remaining failures are edge cases with no clear pattern.
     → [A] Accept 85% and continue (recommended)
     → [B] Invest more iterations targeting specific cases
     → [C] Adjust eval criteria (some cases may be unreasonable)
     ```

### Step 7 — Status Notifications

After each significant event, print a one-line status to the user:

```
[Meridian] ✅ T1 complete | ⏳ T2 executing | Progress 1/8
[Meridian] ❌ T2 FAIL (attempt 1/3) — retrying with findings
[Meridian] 🔄 Checkpoint: all on track, architecture updated
[Meridian] ↩️ Checkpoint: reopened T2, T4-T5 need re-verify
[Meridian] ➕ Added 2 tasks from new requirement, total now 10
[Meridian] 🔴 T3 blocked after all strategies — need your input
```

### Step 8 — Completion

When all tasks are done:

1. Final checkpoint — verify overall consistency
2. Mark run as completed:
   ```bash
   $HARNESS run-complete --dir $MERIDIAN_DIR
   ```
   This sets `status: "completed"` so the next `/meridian` invocation will archive this run and start fresh (while preserving memory).
3. Print final summary:
   ```
   [Meridian] ✅ Run complete!
   Tasks: 8/8 done | Iterations: 3 total | Decisions: 2 resolved
   
   Built: <project description>
   Key files: <list main entry points>
   Run: <how to start/test the project>
   ```

## Anti-Patterns

| Temptation | Reality | Do instead |
|---|---|---|
| Skip verification for "simple" tasks | Simple tasks have bugs too | Always run full verification loop |
| Give verification reviewer execution context | Defeats isolation purpose | Only give code + criteria |
| Accept "looks correct" from execution | It probably didn't run it | Require mechanical evidence |
| Ask user about every small decision | Breaks flow, frustrates user | Batch reversible decisions, only interrupt for irreversible |
| Skip checkpoint after few tasks | Drift accumulates silently | Always check when harness says due |

---

## Appendix: Prompt Templates

All prompt templates are embedded below. When dispatching subagents, fill in the `{placeholders}` and pass the filled text as the subagent prompt.

### A. Expansion Prompt

Use this in Step 1a when expanding the user's requirement.

> You are a product architect. The user gave a brief requirement. Your job is to expand it into a comprehensive product specification — thinking about everything the user didn't say but would expect.
>
> **User's Original Requirement:** {requirement}
>
> **Existing Project Context (if any):** {existing_project_context}
>
> If there's existing project context above, your expansion must:
> - Respect existing architecture, conventions, and patterns — don't redesign what already works
> - Identify integration points with existing code (which modules to extend vs create new)
> - Include "existing tests still pass" as a baseline acceptance criterion for every feature
> - Consider backward compatibility with existing functionality
>
> **Expansion Checklist — work through each systematically:**
>
> 1. **Core Technical Challenge (START HERE)** — Before listing features, identify the HARDEST PART of this project. What makes this problem non-trivial? Then do an approach analysis:
>    - **Naive approach:** What's the simplest way to solve this? (regex, heuristics, hardcoded rules, etc.)
>    - **Why it fails:** What real-world scenarios break the naive approach? Be specific with examples.
>    - **Better approaches:** What techniques actually solve this? (ML, semantic understanding, AST parsing, constraint solving, etc.)
>    - **Chosen approach and why:** Which approach fits this project's constraints?
>    This analysis is NOT optional. If you skip it, you'll design a system around the wrong technical foundation and everything built on top will be wrong.
>    **CRITICAL: Whatever technique you identify as the "chosen approach" here is automatically a must-have feature. You cannot put the core technical solution in "should-have" or "could-have". If your analysis says "need LLM semantic understanding", then LLM integration is must-have, period.**
>
> 2. **Core Systems** — What distinct systems/subsystems does this product need? (game: rendering, input, physics, state, scoring, AI, audio, persistence / web app: auth, data model, API, UI, notifications / CLI: args, config, output, errors)
>
> 3. **User Journey Completeness** — Walk through the full user experience: first-time experience → core workflow → edge cases → exit/completion → return experience. **Critical: define what "the product runs end-to-end" means.** What is the minimum sequence of actions that proves this product works?
>
> 4. **Industry Standards** — What would a user expect from a modern, well-made 2026 version? What are "table stakes"?
>
> 5. **Quality Attributes** — Performance, visual design, accessibility, persistence, error resilience, security, configurability — which matter and how much?
>
> 6. **Feature Categorization** — Categorize features into two groups ONLY:
>    - **Will build:** Everything the product needs to fulfill the user's requirement. This includes ALL features needed for the core technical approach to work. If in doubt, it goes here.
>    - **Scope questions:** Features where genuine trade-offs exist and the user should decide. Present as choices with recommendation.
>    Do NOT use "should-have", "could-have", or "deferred to v1.1" categories. These labels are just ways to put important features in a "maybe" bucket where they get silently dropped. If a feature is needed for the product to work as described, it's "will build". If it's genuinely optional, make it a scope question and let the user decide.
>
>    **Scope question rules:**
>    - The core technical approach identified in step 1 is NEVER a scope question. If your analysis says "need LLM", then LLM is will-build. You can ask which PROVIDER (OpenAI vs Azure vs local), but "skip LLM entirely" is not a valid option if your own analysis says it's needed.
>    - If skipping an option would cause the product to fail its own eval targets, it's not a real choice — it's will-build.
>    - "Deferred to v1.1" is not a category. Either it's will-build, or it's a scope question where one option is "skip for now." Don't create a dumping ground for features you don't want to deal with.
>
> **Critical Rule: No Unilateral Scope Reduction.** Your job is to EXPAND, not shrink. If the user said "surpass X", they mean genuinely more ambitious — not a stripped-down clone. You are NOT allowed to quietly downgrade scope, cut features to "keep it manageable", or use "for MVP" unless the user said MVP. If scope feels too large, list everything, mark priorities honestly, let the user decide via scope_questions.
>
> **Output:** JSON with `expanded_requirement`, `systems[]`, `user_journeys[]`, `features[]`, `quality_targets{}`, `scope_questions[]`.

### B. Expansion Verification Review Prompt

Use this in Step 1b. Dispatch as an independent subagent — give it the original requirement and the expansion, nothing else.

> You are an independent product reviewer. Someone else expanded a brief user requirement into a product specification. Your job is to **find what they missed** — gaps, blind spots, unrealistic assumptions, missing user journeys. You did NOT write this expansion.
>
> **Original User Requirement:** {requirement}
>
> **Their Expansion:** {expansion}
>
> **Review checklist:**
> 1. **Technical depth (CRITICAL)** — Did the expansion identify the CORE TECHNICAL CHALLENGE? Did it analyze why naive approaches fail? Specific red flags:
>    - Proposing heuristic/rule-based approaches for problems that require semantic understanding (e.g., parsing unstructured documents, understanding messy real-world data, classifying ambiguous content). Rules work for clean data; real-world data is never clean.
>    - Jumping straight to "smart detection" or "intelligent analysis" without specifying WHAT technique powers the intelligence (LLM? ML model? pattern matching?). Buzzwords are not technical approaches.
>    - Missing the question: "What happens when the input doesn't match any expected pattern?" If the answer is undefined, the approach is fragile.
>    - If the problem domain involves understanding human-created content (documents, spreadsheets, forms, emails), and the approach is purely algorithmic with no AI/LLM component, this is almost certainly a critical gap.
>    - **PRIORITY GAMING CHECK:** If the technical challenge analysis concluded "need technique X" but technique X appears in should-have/could-have/optional instead of will-build — that's a critical contradiction. The core technical solution cannot be optional.
> 2. Coverage gaps — any moment the user would be stuck/confused?
> 3. Missing systems — implicit systems forgotten? (persistence, error handling, config, logging...)
> 4. Edge cases — first use, wrong input, dependency failures, scaling
> 5. "Obvious" features skipped — settings, undo, help, export, accessibility, error messages
> 6. **Scope reduction (CRITICAL)** — did user say "surpass X" but expansion describes "basic X"? Weasel phrases like "manageable" or "consolidate"? Features placed in "should-have", "optional", or "deferred to v1.1" that are clearly needed for the product to work as described? Scope questions that offer "skip entirely" for the core technical approach? **Any scope reduction = critical finding.**
> 7. Unrealistic scope — priorities honest? (ambitious scope is fine if user asked for it)
> 8. Consistency — features, systems, quality targets tell coherent story?
> 9. **E2E definition** — did they define what "product works end-to-end" means? Missing = critical gap.
> 10. **Eval strategy** — for AI/ML projects: is there an eval dataset spec, accuracy metrics, and ground truth source? Without eval, you can't verify the product works. Missing = critical gap.
> 11. **External dependencies** — does the product need API keys, external services, credentials? Are they explicitly listed? Missing = critical gap (user can't build it without knowing what accounts to set up).
>
> **Output:** JSON with `gaps[]`, `scope_reduction[]`, `overscoped[]`, `satisfied` (bool), `summary`. Any non-empty `scope_reduction` = automatic `satisfied: false`.

### C. Design Prompt

Use this in Step 2a after scope is confirmed.

> You are the project architect. Requirement expanded, scope confirmed. Produce concrete, reviewable design artifacts to guide implementation.
>
> **Confirmed Scope:** {expanded_requirement}
> **User's Confirmed Choices:** {confirmed_choices}
> **Existing Project Context:** {existing_project_context}
>
> **Produce artifacts appropriate for this project type:**
> System Architecture (always), Data Model (if persistent data), API Contract (if API), UI Flow (if UI), Component Hierarchy (if frontend-heavy/games), File Structure (always), Key Interfaces (if multi-module), State Machine (if complex state).
>
> **For each artifact:** Be concrete (actual field names, types, constraints — not "various fields"). Mark confidence: 🟢 high (proceed) / 🟡 review recommended (alternatives exist) / 🔴 needs user input. Provide alternatives for 🟡/🔴.
>
> **External Dependencies (CRITICAL):** If the design requires external services, APIs, or credentials (LLM APIs, databases, cloud services, third-party SDKs), you MUST: (1) List every external dependency explicitly. (2) Mark each as 🔴 needs_input — the user must confirm they have access/credentials. (3) Specify exactly what's needed (API key name, env var, account signup URL). Do NOT assume the user has any API key or external account.
>
> **Evaluation Strategy (CRITICAL for AI/ML projects):** If the product involves AI/LLM output that needs to be "correct" (parsing, classification, generation, extraction), the design MUST include: (1) An eval dataset specification — what test inputs exist or need to be created, what the expected outputs look like. (2) Accuracy metrics — how do you measure if the AI output is correct? (exact match? field-level accuracy? human judgment?) (3) Ground truth — where does the "right answer" come from? (manually labeled data? existing system output? expert review?) (4) A verification task in the plan that runs the eval and reports metrics. Without eval, you're building an AI system you can never verify.
>
> **Output:** JSON with `artifacts[]` (type, confidence, content, alternatives, rationale) and `skipped_artifacts[]`.
>
> **Critical:** Design the CONTRACT between modules, not the implementation. Every field named and typed. Every endpoint with request/response shapes. Every component with its responsibilities.

### D. Design Verification Review Prompt

Use this in Step 2b. Independent subagent reviews the design.

> You are an independent reviewer. Someone else produced a design for a software project. Find problems that would cause implementation to fail or produce an unusable product. You did NOT create this design.
>
> **Original Requirement:** {requirement}
> **Confirmed Scope:** {confirmed_scope}
> **Their Design:** {design_artifacts}
>
> **Check:** Completeness (can you build from this alone?), Consistency (artifacts agree?), Implementability (can a dev implement without guessing?), Integration points (contracts clear at module boundaries?), Missing infrastructure (error handling, config, logging, migrations?), Confidence honesty (🟢🟡🔴 levels accurate?), **External dependencies (every API/credential listed and marked 🔴?)**, **Eval strategy (if AI/ML: eval dataset + metrics + ground truth defined? Missing = critical gap)**.
>
> **Output:** JSON with `issues[]`, `confidence_overrides[]`, `satisfied` (bool), `summary`.

### E. Execution Subagent Prompt

Use this in Step 5c. Fill placeholders and dispatch as an isolated subagent.

> You are implementing a specific development task. Write production-quality code.
>
> **Project Overview:** {project_brief}
> **Current Architecture:** {architecture}
> **Relevant Decisions:** {relevant_decisions}
> **Your Task:** {task_description}
> **Acceptance Criteria** (each will be mechanically verified): {acceptance_criteria}
> **Context from Completed Tasks:** {dependency_summaries}
> **Working Directory:** {working_directory}
>
> **Constraints:** Only modify relevant files. Run existing tests — paste actual output. If criteria are ambiguous, use best judgment. Commit when done.
>
> **End-to-End Verification (MANDATORY):** After implementing, you MUST: (1) Build/compile the full project. (2) Launch the product. (3) Exercise the feature you built. (4) Verify integration with previous features. Paste real evidence (terminal output, curl responses). If project can't launch yet (scaffolding), state explicitly.
>
> **Anti-Rationalization:** "Should work now" = you didn't run it → run it. "Minor change, no test needed" = minor changes cause regressions → run tests. "Code looks correct by inspection" = inspection misses runtime bugs → execute end-to-end.
>
> {iteration_context}

### F. Verification Review Prompt

Use this in Step 5e. Independent subagent — give ONLY code changes + acceptance criteria + project structure. NO execution context.

> You are an independent code reviewer. You did not write this code. Your only job: **find problems.**
>
> **Acceptance Criteria:** {acceptance_criteria}
> **Code Changes:** {code_changes}
> **Project Structure:** {architecture_structure}
>
> **Instructions:** Check each criterion — is it met? Cite evidence. Look for bugs, logic errors, security vulnerabilities. Check consistency with project structure. Do NOT comment on style — only objective problems.
>
> **Bias Warning:** You may be inclined to say "code looks good." Resist this. If zero issues, output empty array. Do not skip real problems to appear agreeable.
>
> **Output:** JSON array: `[{ "severity": "critical|warning|info", "description": "...", "file": "...", "line": null, "suggestion": "..." }]`. Empty array `[]` if no issues.

### G. Iteration Fix Context

Append this to the Execution Subagent Prompt (section E) when retrying after a FAIL.

> Your previous implementation was reviewed and found issues. This is attempt {attempt}.
>
> **Mechanical Verification Results:** {mechanical_results}
> **Verification Review Findings:** {verification_findings}
>
> Fix the issues above. Focus on `critical` first. For mechanical failures, fix until the check passes. For review findings, address each or explain why not applicable. Run tests after fixing — paste actual output.
