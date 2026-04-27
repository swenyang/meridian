// State management — JSON-file-backed project state (zero-dependency, Node 18+).

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const STATE_FILE = "state.json";
const VERSION = "0.1.0";

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

/**
 * Initialize .meridian/ directory structure and state file.
 */
export function init(dir) {
  if (existsSync(statePath(dir))) {
    return { created: false, dir, reason: "already initialized" };
  }

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "memory"), { recursive: true });
  mkdirSync(join(dir, "tasks"), { recursive: true });

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

  const now = new Date().toISOString();
  writeFileSync(
    statePath(dir),
    JSON.stringify(
      {
        version: VERSION,
        tasks: {},
        iterations: [],
        decisions: {},
        created_at: now,
        updated_at: now,
      },
      null,
      2
    ),
    "utf8"
  );

  return { created: true, dir };
}

/**
 * Store a task plan from a JSON file.
 */
export function planSet(dir, planPath) {
  const raw = readFileSync(planPath, "utf8");
  const plan = JSON.parse(raw);

  if (!Array.isArray(plan.tasks)) {
    throw new Error("Plan JSON must contain a 'tasks' array");
  }

  const required = ["id", "title", "description", "acceptance_criteria"];
  for (const task of plan.tasks) {
    for (const field of required) {
      if (task[field] == null) {
        throw new Error(`Task '${task.id || "(unknown)"}' missing required field '${field}'`);
      }
    }
  }

  const state = readState(dir);
  const now = new Date().toISOString();

  for (const task of plan.tasks) {
    state.tasks[task.id] = {
      id: task.id,
      title: task.title,
      description: task.description,
      acceptance_criteria: task.acceptance_criteria,
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

  return { stored: true, taskCount: plan.tasks.length };
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
 */
export function planAdjust(dir, adjustments) {
  const state = readState(dir);
  const now = new Date().toISOString();
  const results = [];

  for (const adj of adjustments) {
    switch (adj.action) {
      case "add": {
        const required = ["id", "title", "description", "acceptance_criteria"];
        for (const field of required) {
          if (adj.task[field] == null) {
            throw new Error(`New task '${adj.task.id || "(unknown)"}' missing field '${field}'`);
          }
        }
        state.tasks[adj.task.id] = {
          id: adj.task.id,
          title: adj.task.title,
          description: adj.task.description,
          acceptance_criteria: adj.task.acceptance_criteria,
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
        if (adj.fields.title) task.title = adj.fields.title;
        if (adj.fields.description) task.description = adj.fields.description;
        if (adj.fields.acceptance_criteria) task.acceptance_criteria = adj.fields.acceptance_criteria;
        if (adj.fields.dependencies) task.dependencies = adj.fields.dependencies;
        if (adj.fields.priority != null) task.priority = adj.fields.priority;
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

  return { adjusted: true, results, totalTasks: Object.keys(state.tasks).length };
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
      attempts,
    };
  });
}
