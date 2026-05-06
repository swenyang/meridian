// State management — JSON-file-backed project state (zero-dependency, Node 18+).

import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, readdirSync, rmSync } from "fs";
import { join } from "path";

const STATE_FILE = "state.json";
const VERSION = "0.1.0";

// Valid task kinds — determines which acceptance criteria rules apply
const VALID_KINDS = ["scaffolding", "core", "feature", "integration", "refactor", "test", "docs", "infra"];
// Kinds exempt from e2e/integration/real_data requirements
const E2E_EXEMPT_KINDS = ["scaffolding", "docs", "infra"];
// Kinds that require real_data criteria when eval config exists
const REAL_DATA_REQUIRED_KINDS = ["core"];
// Valid acceptance criteria types
const VALID_CRITERIA_TYPES = ["mechanical", "unit", "integration", "e2e", "real_data"];

/**
 * Validate a single acceptance criterion object.
 * Returns { valid, errors[] } for the criterion.
 */
function validateCriterion(criterion, index) {
  const errors = [];
  const prefix = `criteria[${index}]`;

  if (typeof criterion === "string") {
    // Legacy string format — valid but not structured
    return { valid: true, legacy: true, errors: [] };
  }

  if (typeof criterion !== "object" || criterion === null || Array.isArray(criterion)) {
    errors.push(`${prefix}: must be a string or object`);
    return { valid: false, legacy: false, errors };
  }

  // Required fields for all structured criteria
  if (!criterion.type) {
    errors.push(`${prefix}: missing required field 'type'`);
  } else if (!VALID_CRITERIA_TYPES.includes(criterion.type)) {
    errors.push(`${prefix}: invalid type '${criterion.type}' (valid: ${VALID_CRITERIA_TYPES.join(", ")})`);
  }

  if (!criterion.description) {
    errors.push(`${prefix}: missing required field 'description'`);
  }

  // Type-specific required fields
  if (criterion.type === "e2e") {
    if (!criterion.scenario) errors.push(`${prefix}: e2e criterion missing required field 'scenario'`);
    if (!Array.isArray(criterion.steps) || criterion.steps.length === 0) {
      errors.push(`${prefix}: e2e criterion missing required field 'steps' (non-empty array)`);
    }
    if (!criterion.expected) errors.push(`${prefix}: e2e criterion missing required field 'expected'`);
  }

  if (criterion.type === "real_data") {
    if (!criterion.data_source) errors.push(`${prefix}: real_data criterion missing required field 'data_source'`);
    if (!criterion.expected) errors.push(`${prefix}: real_data criterion missing required field 'expected'`);
    if (!criterion.data_file && !criterion.fetch_command) {
      errors.push(`${prefix}: real_data criterion must have 'data_file' or 'fetch_command' for local reproducibility`);
    }
  }

  return { valid: errors.length === 0, legacy: false, errors };
}

/**
 * Validate acceptance_criteria array for a single task.
 * Returns { valid, errors[], warnings[], hasLegacy, criteriaByType }.
 */
function validateCriteria(criteria) {
  const errors = [];
  const warnings = [];
  let hasLegacy = false;
  const criteriaByType = {};

  if (!Array.isArray(criteria) || criteria.length === 0) {
    errors.push("acceptance_criteria must be a non-empty array");
    return { valid: false, errors, warnings, hasLegacy, criteriaByType };
  }

  for (let i = 0; i < criteria.length; i++) {
    const result = validateCriterion(criteria[i], i);
    if (result.legacy) {
      hasLegacy = true;
      warnings.push(`criteria[${i}]: legacy string format '${criteria[i]}' — use structured object format`);
    }
    if (!result.valid) {
      errors.push(...result.errors);
    }
    // Track criteria by type for task-level rules
    if (!result.legacy && result.valid && criteria[i].type) {
      criteriaByType[criteria[i].type] = (criteriaByType[criteria[i].type] || 0) + 1;
    }
  }

  return { valid: errors.length === 0, errors, warnings, hasLegacy, criteriaByType };
}

/**
 * Validate a complete plan in strict mode.
 * Checks task-level rules based on task kind.
 * @param {object} plan - The plan object with tasks array
 * @param {string} meridianDir - The .meridian directory (to check eval config)
 * @returns {{ valid, errors[], warnings[] }}
 */
function validatePlanStrictInternal(plan, meridianDir) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    errors.push("Plan must contain a non-empty 'tasks' array");
    return { valid: false, errors, warnings };
  }

  // Check if eval config exists
  const hasEvalConfig = meridianDir ? existsSync(join(meridianDir, "eval_config.json")) : false;

  for (const task of plan.tasks) {
    const taskPrefix = `task '${task.id || "(unknown)"}'`;

    // Validate kind if present
    if (task.kind != null && !VALID_KINDS.includes(task.kind)) {
      errors.push(`${taskPrefix}: invalid kind '${task.kind}' (valid: ${VALID_KINDS.join(", ")})`);
    }

    // Validate criteria structure
    const criteriaResult = validateCriteria(task.acceptance_criteria);
    errors.push(...criteriaResult.errors.map(e => `${taskPrefix}: ${e}`));
    warnings.push(...criteriaResult.warnings.map(w => `${taskPrefix}: ${w}`));

    if (criteriaResult.hasLegacy) {
      errors.push(`${taskPrefix}: strict mode requires all criteria to be structured objects (found legacy strings)`);
    }

    // Task-kind-level rules
    const kind = task.kind || "feature"; // default to feature if not specified
    const ct = criteriaResult.criteriaByType;

    if (!E2E_EXEMPT_KINDS.includes(kind)) {
      const hasE2eOrIntegration = (ct.e2e || 0) + (ct.integration || 0) > 0;
      if (!hasE2eOrIntegration) {
        errors.push(`${taskPrefix}: ${kind} task must have at least 1 'e2e' or 'integration' criterion`);
      }
    }

    if (REAL_DATA_REQUIRED_KINDS.includes(kind) && hasEvalConfig) {
      if (!ct.real_data) {
        errors.push(`${taskPrefix}: ${kind} task must have at least 1 'real_data' criterion (eval config exists)`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a plan in lenient mode (for plan-set / plan-adjust).
 * Accepts legacy strings with warnings, only errors on malformed structure.
 * @param {Array} criteria - acceptance_criteria array
 * @returns {{ errors[], warnings[] }}
 */
function validateCriteriaLenient(criteria) {
  const result = validateCriteria(criteria);
  // In lenient mode, legacy strings are warnings not errors — already handled
  // Only return structural errors for malformed objects
  return { errors: result.errors, warnings: result.warnings };
}

function statePath(dir) {
  return join(dir, STATE_FILE);
}

function readState(dir) {
  return JSON.parse(readFileSync(statePath(dir), "utf8"));
}

function writeState(dir, state) {
  state.updated_at = new Date().toISOString();
  writeFileSync(statePath(dir), JSON.stringify(state, null, 2), "utf8");
}

function ensureMemoryFiles(dir) {
  mkdirSync(join(dir, "memory"), { recursive: true });
  const memoryFiles = {
    "project_brief.md": "# Project Brief\n\n_Not yet initialized._\n",
    "decisions_log.md": "# Decisions Log\n\n_No decisions recorded yet._\n",
    "architecture.md": "# Architecture\n\n_Not yet initialized._\n",
    "completed_tasks.md": "# Completed Tasks\n\n_No tasks completed yet._\n",
    "active_issues.md": "# Active Issues\n\n_No active issues._\n",
  };
  for (const [name, content] of Object.entries(memoryFiles)) {
    const filePath = join(dir, "memory", name);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, "utf8");
    }
  }
}

function newStateObject() {
  const now = new Date().toISOString();
  return {
    version: VERSION,
    run_id: `run-${now.slice(0, 10).replace(/-/g, "")}-${now.slice(11, 19).replace(/:/g, "")}`,
    status: "active",
    tasks: {},
    iterations: [],
    decisions: {},
    created_at: now,
    updated_at: now,
  };
}

/**
 * Initialize .meridian/ directory. Smart detection:
 * - No .meridian/ → first run, create everything
 * - Has active run → return active (caller decides to add to it or not)
 * - Has completed run → archive it, start new run
 */
export function init(dir) {
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "runs"), { recursive: true });
  mkdirSync(join(dir, "tasks"), { recursive: true });
  ensureMemoryFiles(dir);

  // No state file → first run
  if (!existsSync(statePath(dir))) {
    const state = newStateObject();
    writeFileSync(statePath(dir), JSON.stringify(state, null, 2), "utf8");
    return { created: true, dir, run_id: state.run_id, mode: "new" };
  }

  // State exists — check status
  const state = readState(dir);

  if (state.status === "active") {
    // Active run in progress
    return { created: false, dir, run_id: state.run_id, mode: "active", reason: "run in progress" };
  }

  // Completed run — archive and start fresh
  const archiveDir = join(dir, "runs", state.run_id || `run-archived-${Date.now()}`);
  mkdirSync(archiveDir, { recursive: true });

  // Copy state, plan, tasks, eval_config to archive then clean up
  if (existsSync(statePath(dir))) {
    cpSync(statePath(dir), join(archiveDir, "state.json"));
  }
  const planPath = join(dir, "plan.json");
  if (existsSync(planPath)) {
    cpSync(planPath, join(archiveDir, "plan.json"));
    rmSync(planPath);
  }
  const evalConfigPath = join(dir, "eval_config.json");
  if (existsSync(evalConfigPath)) {
    cpSync(evalConfigPath, join(archiveDir, "eval_config.json"));
    rmSync(evalConfigPath);
  }
  const tasksDir = join(dir, "tasks");
  if (existsSync(tasksDir)) {
    cpSync(tasksDir, join(archiveDir, "tasks"), { recursive: true });
    for (const entry of readdirSync(tasksDir)) {
      rmSync(join(tasksDir, entry), { recursive: true, force: true });
    }
  }

  // Start new run (memory persists!)
  const newState = newStateObject();
  writeFileSync(statePath(dir), JSON.stringify(newState, null, 2), "utf8");

  return {
    created: true,
    dir,
    run_id: newState.run_id,
    mode: "new_after_archive",
    archived: state.run_id,
  };
}

/**
 * Mark the current run as completed.
 */
export function runComplete(dir) {
  const state = readState(dir);
  state.status = "completed";
  state.completed_at = new Date().toISOString();
  writeState(dir, state);
  return { completed: true, run_id: state.run_id };
}

/**
 * Get current run status and context for smart routing.
 */
export function runStatus(dir) {
  if (!existsSync(statePath(dir))) {
    return { exists: false };
  }
  const state = readState(dir);
  const taskCount = Object.keys(state.tasks).length;
  const doneCount = Object.values(state.tasks).filter(t => t.status === "done").length;
  const pendingCount = Object.values(state.tasks).filter(t => t.status === "pending").length;

  // List archived runs
  const runsDir = join(dir, "runs");
  const archivedRuns = existsSync(runsDir)
    ? readdirSync(runsDir).filter(f => f.startsWith("run-"))
    : [];

  return {
    exists: true,
    run_id: state.run_id,
    status: state.status,
    tasks: { total: taskCount, done: doneCount, pending: pendingCount },
    archived_runs: archivedRuns.length,
  };
}

/**
 * Store a task plan from a JSON file.
 * Lenient mode: accepts legacy string criteria with warnings.
 */
export function planSet(dir, planPath) {
  const raw = readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw);

  if (!Array.isArray(plan.tasks)) {
    throw new Error("Plan JSON must contain a 'tasks' array");
  }

  const required = ["id", "title", "description", "acceptance_criteria"];
  const allWarnings = [];

  for (const task of plan.tasks) {
    for (const field of required) {
      if (task[field] == null) {
        throw new Error(`Task '${task.id || "(unknown)"}' missing required field '${field}'`);
      }
    }
    // Validate kind if present
    if (task.kind != null && !VALID_KINDS.includes(task.kind)) {
      throw new Error(`Task '${task.id}': invalid kind '${task.kind}' (valid: ${VALID_KINDS.join(", ")})`);
    }
    // Lenient criteria validation
    const { errors, warnings } = validateCriteriaLenient(task.acceptance_criteria);
    if (errors.length > 0) {
      throw new Error(`Task '${task.id}': ${errors.join("; ")}`);
    }
    allWarnings.push(...warnings.map(w => `task '${task.id}': ${w}`));
  }

  const state = readState(dir);
  const now = new Date().toISOString();

  for (const task of plan.tasks) {
    state.tasks[task.id] = {
      id: task.id,
      title: task.title,
      description: task.description,
      acceptance_criteria: task.acceptance_criteria,
      kind: task.kind || null,
      status: task.status || "pending",
      dependencies: task.dependencies || [],
      priority: task.priority ?? 0,
      created_at: now,
      updated_at: now,
    };
  }

  writeState(dir, state);

  // Also save the raw plan for reference
  writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");

  const result = { stored: true, taskCount: plan.tasks.length };
  if (allWarnings.length > 0) {
    result.warnings = allWarnings;
  }
  return result;
}

/**
 * Query status of a single task.
 */
export function taskStatus(dir, taskId) {
  const state = readState(dir);
  const task = state.tasks[taskId];

  if (!task) {
    return { found: false };
  }

  const attempts = state.iterations.filter((i) => i.task_id === taskId).length;
  const lastIter = state.iterations
    .filter((i) => i.task_id === taskId)
    .sort((a, b) => b.attempt - a.attempt)[0];

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    attempts,
    lastVerdict: lastIter?.verdict ?? null,
  };
}

/**
 * Mark a task as complete.
 */
export function taskComplete(dir, taskId, summary) {
  const state = readState(dir);
  const task = state.tasks[taskId];

  if (!task) {
    throw new Error(`Task '${taskId}' not found`);
  }

  task.status = "done";
  task.summary = summary;
  task.updated_at = new Date().toISOString();

  writeState(dir, state);

  return { completed: true, id: taskId };
}

/**
 * Reopen a completed task and cascade re-verify to dependents.
 * Layer 2: Task backtracking — when checkpoint finds a completed task has issues.
 */
export function taskReopen(dir, taskId, reason) {
  const state = readState(dir);
  const task = state.tasks[taskId];

  if (!task) {
    throw new Error(`Task '${taskId}' not found`);
  }

  task.status = "pending";
  task.reopen_reason = reason;
  task.updated_at = new Date().toISOString();

  // Find all tasks that depend on this task and are done → mark as needs-reverify
  const affected = [];
  for (const t of Object.values(state.tasks)) {
    if (t.dependencies?.includes(taskId) && t.status === "done") {
      t.status = "reverify";
      t.reverify_reason = `dependency ${taskId} was reopened: ${reason}`;
      t.updated_at = new Date().toISOString();
      affected.push(t.id);
    }
  }

  writeState(dir, state);

  return { reopened: true, id: taskId, affected_tasks: affected };
}

/**
 * Adjust the plan: add, remove, or update tasks.
 * Layer 3: Plan adjustment — strategic layer modifies the plan mid-execution.
 * Lenient mode: accepts legacy string criteria with warnings.
 */
export function planAdjust(dir, adjustments) {
  const state = readState(dir);
  const now = new Date().toISOString();
  const results = [];
  const allWarnings = [];

  for (const adj of adjustments) {
    switch (adj.action) {
      case "add": {
        const required = ["id", "title", "description", "acceptance_criteria"];
        for (const field of required) {
          if (adj.task[field] == null) {
            throw new Error(`New task '${adj.task.id || "(unknown)"}' missing field '${field}'`);
          }
        }
        // Validate kind if present
        if (adj.task.kind != null && !VALID_KINDS.includes(adj.task.kind)) {
          throw new Error(`New task '${adj.task.id}': invalid kind '${adj.task.kind}' (valid: ${VALID_KINDS.join(", ")})`);
        }
        // Lenient criteria validation
        const { errors, warnings } = validateCriteriaLenient(adj.task.acceptance_criteria);
        if (errors.length > 0) {
          throw new Error(`New task '${adj.task.id}': ${errors.join("; ")}`);
        }
        allWarnings.push(...warnings.map(w => `task '${adj.task.id}': ${w}`));

        state.tasks[adj.task.id] = {
          id: adj.task.id,
          title: adj.task.title,
          description: adj.task.description,
          acceptance_criteria: adj.task.acceptance_criteria,
          kind: adj.task.kind || null,
          status: "pending",
          dependencies: adj.task.dependencies || [],
          priority: adj.task.priority ?? 0,
          created_at: now,
          updated_at: now,
        };
        results.push({ action: "add", id: adj.task.id });
        break;
      }

      case "remove": {
        const task = state.tasks[adj.id];
        if (!task) {
          results.push({ action: "remove", id: adj.id, error: "not found" });
          break;
        }
        if (task.status === "done") {
          results.push({ action: "remove", id: adj.id, error: "cannot remove completed task" });
          break;
        }
        delete state.tasks[adj.id];
        // Remove from other tasks' dependencies
        for (const t of Object.values(state.tasks)) {
          if (t.dependencies) {
            t.dependencies = t.dependencies.filter((d) => d !== adj.id);
          }
        }
        results.push({ action: "remove", id: adj.id });
        break;
      }

      case "update": {
        const task = state.tasks[adj.id];
        if (!task) {
          results.push({ action: "update", id: adj.id, error: "not found" });
          break;
        }
        // Clone → apply → validate → mutate
        const merged = { ...task };
        if (adj.fields.title) merged.title = adj.fields.title;
        if (adj.fields.description) merged.description = adj.fields.description;
        if (adj.fields.acceptance_criteria) merged.acceptance_criteria = adj.fields.acceptance_criteria;
        if (adj.fields.dependencies) merged.dependencies = adj.fields.dependencies;
        if (adj.fields.priority != null) merged.priority = adj.fields.priority;
        if (adj.fields.kind !== undefined) {
          if (adj.fields.kind != null && !VALID_KINDS.includes(adj.fields.kind)) {
            throw new Error(`Task '${adj.id}': invalid kind '${adj.fields.kind}' (valid: ${VALID_KINDS.join(", ")})`);
          }
          merged.kind = adj.fields.kind;
        }

        // Validate criteria if updated
        if (adj.fields.acceptance_criteria) {
          const { errors, warnings } = validateCriteriaLenient(merged.acceptance_criteria);
          if (errors.length > 0) {
            throw new Error(`Task '${adj.id}': ${errors.join("; ")}`);
          }
          allWarnings.push(...warnings.map(w => `task '${adj.id}': ${w}`));
        }

        // Apply validated changes
        if (adj.fields.title) task.title = adj.fields.title;
        if (adj.fields.description) task.description = adj.fields.description;
        if (adj.fields.acceptance_criteria) task.acceptance_criteria = adj.fields.acceptance_criteria;
        if (adj.fields.dependencies) task.dependencies = adj.fields.dependencies;
        if (adj.fields.priority != null) task.priority = adj.fields.priority;
        if (adj.fields.kind !== undefined) task.kind = adj.fields.kind;
        task.updated_at = now;
        results.push({ action: "update", id: adj.id });
        break;
      }

      default:
        results.push({ action: adj.action, error: `unknown action '${adj.action}'` });
    }
  }

  writeState(dir, state);

  // Update plan.json to reflect current state
  const plan = { tasks: Object.values(state.tasks) };
  writeFileSync(join(dir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");

  const result = { adjusted: true, results, totalTasks: Object.keys(state.tasks).length };
  if (allWarnings.length > 0) {
    result.warnings = allWarnings;
  }
  return result;
}

/**
 * List all tasks with summary info.
 */
export function taskList(dir) {
  const state = readState(dir);

  return Object.values(state.tasks).map((task) => {
    const attempts = state.iterations.filter((i) => i.task_id === task.id).length;
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      kind: task.kind || null,
      attempts,
    };
  });
}

/**
 * Validate a plan file against acceptance criteria quality rules.
 * @param {string} planPath - Path to plan JSON file
 * @param {string} meridianDir - Path to .meridian directory
 * @param {boolean} strict - If true, enforce structured format and task-level rules
 * @returns {{ valid, errors[], warnings[] }}
 */
export function validatePlan(planPath, meridianDir, strict) {
  const raw = readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw);

  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    return { valid: false, errors: ["Plan must contain a non-empty 'tasks' array"], warnings: [] };
  }

  if (strict) {
    return validatePlanStrictInternal(plan, meridianDir);
  }

  // Lenient mode: validate structure only, legacy strings produce warnings
  const errors = [];
  const warnings = [];

  for (const task of plan.tasks) {
    const taskPrefix = `task '${task.id || "(unknown)"}'`;

    if (!task.id || !task.title || !task.description || !task.acceptance_criteria) {
      errors.push(`${taskPrefix}: missing required fields (id, title, description, acceptance_criteria)`);
      continue;
    }

    if (task.kind != null && !VALID_KINDS.includes(task.kind)) {
      errors.push(`${taskPrefix}: invalid kind '${task.kind}' (valid: ${VALID_KINDS.join(", ")})`);
    }

    const result = validateCriteria(task.acceptance_criteria);
    errors.push(...result.errors.map(e => `${taskPrefix}: ${e}`));
    warnings.push(...result.warnings.map(w => `${taskPrefix}: ${w}`));
  }

  return { valid: errors.length === 0, errors, warnings };
}
