// Iteration management — counting attempts and checkpoint triggers.

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function readState(dir) {
  return JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
}

function writeState(dir, state) {
  state.updated_at = new Date().toISOString();
  writeFileSync(join(dir, "state.json"), JSON.stringify(state, null, 2), "utf8");
}

/**
 * Count iterations for a task.
 */
export function iterationCount(dir, taskId) {
  const state = readState(dir);
  const attempts = state.iterations.filter((i) => i.task_id === taskId).length;
  return { task: taskId, attempts, max: 3 };
}

/**
 * Record an iteration attempt and determine next action.
 * Instead of escalating to user after 3 failures, returns a recovery strategy
 * for the strategic layer to try. Only truly unresolvable issues reach the user.
 */
export function iterationRecord(dir, taskId, verdict, findings, strategy) {
  const state = readState(dir);
  const attempt = state.iterations.filter((i) => i.task_id === taskId).length + 1;

  state.iterations.push({
    task_id: taskId,
    attempt,
    verdict,
    findings: findings || "",
    strategy: strategy || "retry",
    timestamp: new Date().toISOString(),
  });

  writeState(dir, state);

  // Analyze failure history to suggest recovery strategy
  const taskHistory = state.iterations.filter((i) => i.task_id === taskId);
  const strategies_used = taskHistory.map((i) => i.strategy);

  const result = { recorded: true, task: taskId, attempt };

  if (attempt < 3) {
    // Still have retries — suggest same approach with findings
    result.action = "retry";
    result.reason = `attempt ${attempt}/3, retry with findings`;
  } else if (!strategies_used.includes("rethink")) {
    // 3 retries exhausted, but haven't tried rethinking the approach
    result.action = "rethink";
    result.reason = "3 retries failed with same approach — strategic layer should rethink: redecompose task, change implementation strategy, or fix upstream dependencies";
  } else if (!strategies_used.includes("split")) {
    // Rethink was tried, try splitting into smaller tasks
    result.action = "split";
    result.reason = "rethink failed — strategic layer should split this task into smaller subtasks";
  } else if (!strategies_used.includes("skip_and_revisit")) {
    // Try skipping and coming back later (dependency might resolve)
    result.action = "skip_and_revisit";
    result.reason = "splitting failed — skip this task, continue with others, revisit later with more context";
  } else {
    // All strategies exhausted — now escalate to user, but only with full context
    result.action = "escalate";
    result.reason = "all recovery strategies exhausted — escalate to user with analysis";
    result.strategies_tried = [...new Set(strategies_used)];
  }

  return result;
}

/**
 * Check if a checkpoint is due based on completed tasks since last checkpoint.
 */
export function checkpointDue(dir, interval = 3) {
  const state = readState(dir);
  const lastCheckpoint = state._last_checkpoint_at || state.created_at;

  const completedSince = Object.values(state.tasks).filter(
    (t) => t.status === "done" && t.updated_at > lastCheckpoint
  ).length;

  if (completedSince >= interval) {
    return {
      due: true,
      reason: `${interval} tasks completed since last checkpoint`,
      completedSince,
    };
  }
  return { due: false, completedSince };
}
